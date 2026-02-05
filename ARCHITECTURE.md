# Vividbooks40 - Architektura a Technická Specifikace

> **Tento soubor slouží jako referenční dokumentace pro AI asistenty a vývojáře.**
> Při hlášení bugů nebo požadavcích na změny vlož relevantní části tohoto dokumentu do konverzace.

---

## ⚠️ KRITICKÁ PRAVIDLA - PŘEČTI NEJDŘÍVE!

### 🔴 Tlačítka - VŽDY použij inline styly!

**PROBLÉM:** V projektu existují globální CSS styly, které přepisují Tailwind třídy `bg-*` u tlačítek. Tlačítka pak nemají výplň a jsou neviditelná.

**ŘEŠENÍ:** Pro tlačítka VŽDY používej **inline styly** místo Tailwind tříd pro barvy:

```tsx
// ❌ ŠPATNĚ - Tailwind třídy se přepíšou globálním CSS
<button className="bg-blue-500 text-white">Klikni</button>

// ✅ SPRÁVNĚ - Inline styly mají nejvyšší prioritu
<button style={{ backgroundColor: '#3b82f6', color: 'white', padding: '8px 16px', borderRadius: '8px', border: 'none' }}>
  Klikni
</button>
```

**Běžné barvy:**
- Modrá: `#3b82f6` (blue-500), `#2563eb` (blue-600)
- Zelená: `#22c55e` (green-500), `#10b981` (emerald-500)
- Červená: `#ef4444` (red-500)
- Oranžová: `#f97316` (orange-500), `#f59e0b` (amber-500)
- Fialová: `#a855f7` (purple-500)
- Šedá: `#475569` (slate-600)

---

## 🗄️ Databázové Schéma (Supabase)

### Učitelský obsah (RLS enabled - teacher_id = auth.uid())

| Tabulka | Klíčové sloupce | Popis |
|---------|-----------------|-------|
| `teacher_boards` | id, teacher_id, folder_id, title, **slides** (JSONB), **settings** (JSONB), slides_count | Quizzy a VividBoardy - **slides obsahuje celý obsah!** |
| `teacher_folders` | id, teacher_id, name, color, parent_id, position, is_system_folder | Hierarchická struktura složek |
| `teacher_documents` | id, teacher_id, folder_id, title, content | Textové dokumenty |
| `teacher_worksheets` | id, teacher_id, folder_id, name, content (JSONB), pdf_settings (JSONB) | Pracovní listy |
| `teacher_files` | id, teacher_id, folder_id, file_name, file_url, file_type, file_size | Nahrané soubory |
| `teacher_links` | id, teacher_id, folder_id, title, url, thumbnail_url, transcript | Uložené odkazy |
| `teacher_deleted_items` | teacher_id, item_type, item_id, deleted_at, client_id | **Server-side tombstones** pro prevenci zombie souborů |

### Školy a Licence

| Tabulka | Klíčové sloupce | Popis |
|---------|-----------------|-------|
| `schools` | id, **code** (UNIQUE), name, address, city | Školy - **code je 6-znakový kód pro přihlášení** |
| `school_licenses` | id, school_id, subjects (JSONB[]), features (JSONB) | Licence předmětů a funkcí |
| `teachers` | id, email, name, school_id, user_id, last_active, activity_level | Učitelé přiřazení ke školám |

### Třídy a Studenti

| Tabulka | Klíčové sloupce | Popis |
|---------|-----------------|-------|
| `classes` | id, name, teacher_id, grade, school_id | Třídy |
| `students` | id, name, email, class_id, auth_id | Studenti |
| `assignments` | id, title, type, class_id, board_id, subject, **questions** (JSONB), **worksheet_id** | Úkoly - pro paper_test obsahuje strukturu otázek |
| `results` | id, student_id, assignment_id, score, percentage, **answers** (JSONB) | Výsledky - pro paper_test obsahuje odpovědi na jednotlivé otázky |

---

## 🔄 Synchronizační Mechanismus (DŮLEŽITÉ!)

### Přehled architektury

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SYNC ARCHITECTURE                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────────────────┐   │
│   │  localStorage │────►│  Sync Queue  │────►│     Supabase REST API    │   │
│   │  (cache)      │◄────│  (persistent)│◄────│  (source of truth)       │   │
│   └──────────────┘     └──────────────┘     └──────────────────────────┘   │
│                                                                              │
│   Okamžité operace:                                                         │
│   - saveQuiz(), deleteQuiz() → localStorage + queueUpsert/queueDelete       │
│   - UI se aktualizuje okamžitě z localStorage                               │
│   - Sync Queue zpracovává operace na pozadí                                 │
│                                                                              │
│   Při načítání (jiný prohlížeč):                                            │
│   - getQuizAsync() → localStorage → pokud nenajde → Supabase fetch          │
│   - syncFromSupabase() → stáhne data ze serveru, merguje s local            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Sync Queue (`src/utils/sync/sync-queue.ts`)

**Centralizovaná fronta pro VŠECHNY Supabase operace.**

```typescript
// Operace se přidávají do fronty
queueUpsert('teacher_boards', boardId, { title, slides, ... });
queueDelete('teacher_boards', boardId);

// Fronta zajišťuje:
// 1. Sekvenční zpracování (žádné race conditions)
// 2. Retry s exponenciálním backoffem (max 5 pokusů)
// 3. Persistenci přes page reload (localStorage)
// 4. Potvrzení ze serveru před smazáním z fronty
```

**Klíčové vlastnosti:**
- `QUEUE_KEY = 'vivid-sync-queue'` - fronta přežije refresh stránky
- `MAX_RETRIES = 5` - po 5 neúspěšných pokusech se operace zahodí
- `BASE_DELAY_MS = 1000` - exponenciální backoff mezi pokusy
- Automatické zpracování každých 5s a při window focus

### Server-Side Tombstones (`src/utils/sync/teacher-tombstones.ts`)

**Řeší problém "zombie" souborů (smazané položky se vrací).**

```typescript
// Při DELETE:
await recordTeacherTombstone(userId, token, 'quiz', quizId);
// → zapíše do teacher_deleted_items

// Při SYNC:
const tombstones = await fetchTeacherTombstones(userId, token);
// → lokálně smaže položky, které jsou v tombstones
```

**Tabulka `teacher_deleted_items`:**
```sql
CREATE TABLE teacher_deleted_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id uuid NOT NULL,
  item_type text NOT NULL,  -- 'quiz', 'document', 'folder', etc.
  item_id text NOT NULL,
  deleted_at timestamptz DEFAULT now(),
  client_id text,  -- identifikace prohlížeče
  UNIQUE(teacher_id, item_type, item_id)
);
```

### Lokální Tombstones (deletedIds)

**Každý storage modul má lokální Set pro smazané položky:**

```typescript
// quiz-storage.ts
const DELETED_IDS_KEY = 'vividbooks_deleted_quiz_ids';
let deletedQuizIds = new Set<string>();

// Při deleteQuiz():
deletedQuizIds.add(id);
localStorage.setItem(DELETED_IDS_KEY, JSON.stringify([...deletedQuizIds]));

// Při syncFromSupabase():
// Filtruje položky, které jsou v deletedQuizIds
const filteredItems = remoteItems.filter(item => !deletedQuizIds.has(item.id));
```

### Cross-Browser Sync (`getQuizAsync`)

**Umožňuje načíst board v jiném prohlížeči:**

```typescript
export async function getQuizAsync(id: string): Promise<Quiz | null> {
  // 1. Zkusit localStorage (rychlé)
  const localData = localStorage.getItem(`vividbooks_quiz_${id}`);
  if (localData) return JSON.parse(localData);
  
  // 2. Fallback na Supabase (cross-browser)
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/teacher_boards?id=eq.${id}&select=*`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  
  // 3. Cache do localStorage pro budoucí použití
  localStorage.setItem(`vividbooks_quiz_${id}`, JSON.stringify(quiz));
  return quiz;
}
```

---

## 📁 Systémové Složky (Média)

### Konstanta "Moje obrázky" složka

```typescript
// folder-storage.ts
export const MEDIA_FOLDER_ID = 'folder-media-library';
export const MEDIA_FOLDER_NAME = 'Moje obrázky';
export const MEDIA_FOLDER_COLOR = '#e2e8f0'; // Light gray - system folder

// Vlastnost isSystemFolder brání smazání
interface ContentItem {
  isSystemFolder?: boolean;
}
```

### PDF Import → Obrázky do Média složky

```typescript
// QuizEditorLayout.tsx - handlePdfImport()
// 1. Vytvoří podsložku v Média: "PDF - [název souboru]"
const pdfSubfolderId = await createMediaSubfolder(pdfSubfolderName);

// 2. Každá stránka PDF → JPEG → upload do Supabase Storage
const uploadResult = await uploadFile(pageFile, { folderId: pdfSubfolderId });

// 3. Board pouze odkazuje na URL obrázku (neobsahuje base64)
slide.layout.blocks[0].content = uploadResult.file.filePath;
```

---

## 💾 localStorage Klíče (KRITICKÉ!)

### Autentizace a Profil
```
vivid-teacher-school          → JSON: { id, code, name, address, city }
vivid-teacher-school-teachers → JSON: Teacher[]
vividbooks_current_user_profile → JSON: { id, userId, email, name, role, schoolId }
viewMode                      → 'teacher' | 'student'
```

### Obsah (Sync s Supabase)
```
vividbooks_quizzes            → JSON: QuizListItem[]
vividbooks_quiz_{id}          → JSON: { id, title, slides[], settings }
vividbooks_supabase_quiz_ids  → JSON: string[] (IDs synchronizované do Supabase)
vividbooks_deleted_quiz_ids   → JSON: string[] (lokálně smazané, blokují sync)

vivid-my-folders              → JSON: ContentItem[]
vivid-my-folders_supabase_ids → JSON: string[]
vivid-deleted-folder-ids      → JSON: string[]

vivid-my-documents            → JSON: DocumentItem[]
vivid-document_{id}           → JSON: { content }
vivid-documents_supabase_ids  → JSON: string[]
vivid-deleted-doc-ids         → JSON: string[]

vivid-worksheets              → JSON: WorksheetListItem[]
vivid-worksheet_{id}          → JSON: Worksheet
vivid-worksheets_supabase_ids → JSON: string[]
vivid-deleted-worksheet-ids   → JSON: string[]

vivid-my-files                → JSON: FileItem[]
vivid-files_supabase_ids      → JSON: string[]
vivid-deleted-file-ids        → JSON: string[]

vivid-my-links                → JSON: StoredLink[]
vivid-links_supabase_ids      → JSON: string[]
vivid-deleted-link-ids        → JSON: string[]
```

### Sync Queue
```
vivid-sync-queue              → JSON: QueuedOperation[] (pending operations)
vivid-client-id               → string (unikátní ID tohoto prohlížeče)
```

### Systémové
```
theme                         → 'light' | 'dark'
supabase-synced               → 'true' (flag první synchronizace)
lastCategory                  → Poslední zobrazená kategorie v dokumentaci
```

---

## 🔐 Autentizační Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TEACHER LOGIN FLOW                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. TeacherLoginPage.tsx                                                     │
│     ├─ Uživatel zadá kód školy (např. "PASCAL")                             │
│     ├─ fetch → schools.code = "PASCAL" → vrátí school objekt                │
│     ├─ fetch → teachers.school_id = school.id → seznam učitelů              │
│     ├─ Uživatel vybere učitele a zadá heslo                                 │
│     ├─ supabase.auth.signInWithPassword(email, password)                    │
│     └─ UKLÁDÁ:                                                               │
│         ├─ vivid-teacher-school = school                                     │
│         ├─ vivid-teacher-school-teachers = teachers                          │
│         └─ vividbooks_current_user_profile = { ..., schoolId: school.id }   │
│                                                                              │
│  2. App.tsx - onAuthStateChange                                              │
│     ├─ Zachytí event 'SIGNED_IN' nebo 'INITIAL_SESSION'                     │
│     ├─ Získá session.user a session.access_token                            │
│     └─ Volá syncUserData(user, accessToken)                                  │
│                                                                              │
│  3. syncUserData()                                                           │
│     ├─ Test Supabase konektivity (5s timeout)                               │
│     ├─ Detekce student/admin → přeskočí teacher sync                        │
│     ├─ Paralelně synchronizuje všechny typy obsahu ze Supabase              │
│     └─ Dispatch 'content-updated' event pro UI refresh                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Klíčové Soubory

### Sync System
| Soubor | Účel |
|--------|------|
| `src/utils/sync/sync-queue.ts` | **Centrální fronta** pro všechny Supabase operace |
| `src/utils/sync/teacher-tombstones.ts` | Server-side tombstones proti zombie souborům |

### Storage Moduly
| Soubor | Účel |
|--------|------|
| `src/utils/quiz-storage.ts` | CRUD + sync pro quizzy/boardy, **getQuizAsync()** pro cross-browser |
| `src/utils/folder-storage.ts` | CRUD + sync pro složky, **systémová složka "Média"** |
| `src/utils/document-storage.ts` | CRUD + sync pro dokumenty |
| `src/utils/worksheet-storage.ts` | CRUD + sync pro pracovní listy |
| `src/utils/file-storage.ts` | CRUD + sync pro soubory, **uploadFile()** |
| `src/utils/link-storage.ts` | CRUD + sync pro odkazy |

### Auth a App
| Soubor | Účel |
|--------|------|
| `src/App.tsx` | Hlavní komponenta, auth state management, sync orchestrace |
| `src/utils/supabase/client.ts` | Supabase klient s persistSession: true |
| `src/components/teacher/TeacherLoginPage.tsx` | Login flow pro učitele |

### Editor
| Soubor | Účel |
|--------|------|
| `src/components/quiz/QuizEditorLayout.tsx` | Hlavní editor, **auto-save**, **PDF import**, **isDirty/isSaving** stavy |
| `src/components/shared/AssetPicker.tsx` | Výběr obrázků, **LibraryTab** s Média složkou |

---

## ⚠️ Známé Závislosti a Gotchas

### 1. Párování školy
- **TeacherLoginPage** ukládá školu do `vivid-teacher-school`
- **ProfilePageLayout** čte školu z `vivid-teacher-school`, NE z profilu!
- **handleSchoolPaired** musí uložit do obou: profilu (schoolId) I vivid-teacher-school

### 2. Synchronizace vyžaduje accessToken
- Bez správného accessToken RLS blokuje přístup k datům
- Access token získáváme z `onAuthStateChange` session
- Timeout pro getUser()/getSession() je 5s - pokud vyprší, sync selže

### 3. Quizzy obsahují slides v Supabase
- Tabulka `teacher_boards` má sloupec `slides` (JSONB)
- Při sync se musí stahovat I ukládat celý obsah slidů
- `slides_count` je jen metadata, skutečný obsah je v `slides`

### 4. Zombie soubory - ŘEŠENÍ
Problém: Smazaná položka se objeví znovu po refreshi v jiném prohlížeči.

Řešení (3 vrstvy ochrany):
1. **Lokální deletedIds Set** - blokuje sync z obnovení položky
2. **Server tombstones** (`teacher_deleted_items`) - informuje ostatní prohlížeče
3. **Sync Queue** - potvrzuje DELETE ze serveru před odstraněním z fronty

### 5. PDF Import - velikost boardu
- PDF stránky se **NEUKLÁDAJÍ jako base64** přímo do boardu
- Místo toho se nahrávají do Supabase Storage jako JPEG
- Board obsahuje pouze URL reference na obrázky
- Obrázky se ukládají do systémové složky "Média" → podsložka "PDF - [název]"

### 6. Auto-save a indikace v editoru
- **isDirty** = neuložené změny (oranžová tečka + "Neuloženo")
- **isSaving** = probíhá ukládání (zelený spinner + "Ukládám...")
- Auto-save spouští se 2s po poslední změně
- Tlačítko "Zpět" **čeká na dokončení ukládání** před navigací
- `beforeunload` event varuje uživatele při zavírání s neuloženými změnami

---

## 🔧 Supabase Konfigurace

```
Project URL: https://njbtqmsxbyvpwigfceke.supabase.co
Project ID: njbtqmsxbyvpwigfceke
Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qYnRxbXN4Ynl2cHdpZ2ZjZWtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MzczODksImV4cCI6MjA3ODQxMzM4OX0.nY0THq2YU9wrjYsPoxYwXRXczE3Vh7cB1opzAV8c50g
```

### RLS Policies (KRITICKÉ!)

Všechny `teacher_*` tabulky mají RLS enabled s politikami:
```sql
-- SELECT: Uživatel vidí pouze své položky
CREATE POLICY "teacher_X_select_own" ON teacher_X
  FOR SELECT USING (auth.uid() = teacher_id);

-- INSERT: Uživatel může vložit pouze se svým ID
CREATE POLICY "teacher_X_insert_own" ON teacher_X
  FOR INSERT WITH CHECK (auth.uid() = teacher_id);

-- UPDATE: Uživatel může upravit pouze své položky
CREATE POLICY "teacher_X_update_own" ON teacher_X
  FOR UPDATE USING (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id);

-- DELETE: Uživatel může smazat pouze své položky
CREATE POLICY "teacher_X_delete_own" ON teacher_X
  FOR DELETE USING (auth.uid() = teacher_id);
```

---

## 📋 Checklist při změnách

### Při změně auth flow:
- [ ] Ověř, že se ukládá `vivid-teacher-school`
- [ ] Ověř, že se ukládá `vividbooks_current_user_profile` s `schoolId`
- [ ] Ověř, že `syncUserData` dostává `accessToken`

### Při změně sync:
- [ ] Používá se `queueUpsert/queueDelete` místo přímého fetch?
- [ ] Je timeout nastaven (10-15s)?
- [ ] Fallback na localStorage funguje?
- [ ] Přidáváš do `deletedIds` při mazání?

### Při změně delete operací:
- [ ] Volá se `recordTeacherTombstone()`?
- [ ] Přidává se ID do lokálních `deletedIds`?
- [ ] Používá se `queueDelete()` pro server sync?

### Při změně profilu/školy:
- [ ] Čte se škola z `vivid-teacher-school`?
- [ ] Ukládá se změna do OBOU míst (localStorage + Supabase)?

### Při změně editoru boardů:
- [ ] Nastavuje se `setIsDirty(true)` při změnách?
- [ ] Auto-save je správně nakonfigurován?
- [ ] Tlačítko zpět čeká na dokončení ukládání?

---

*Poslední aktualizace: 2026-01-14*
