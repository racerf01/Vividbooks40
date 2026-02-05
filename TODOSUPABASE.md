# TODO: Supabase Integration

Toto jsou úkoly, které je třeba dokončit až bude Supabase opět funkční.

## 🔴 Kritické (musí fungovat)

### Ukládání pracovních sešitů
- [ ] Vytvořit tabulku `workbooks` pro pracovní sešity
  - `id` UUID
  - `teacher_id` UUID (FK na teachers)
  - `title` TEXT
  - `description` TEXT
  - `cover_image` TEXT (URL)
  - `worksheets` JSONB (pole worksheet IDs s pořadím)
  - `settings` JSONB (metadata sešitu)
  - `created_at` TIMESTAMP
  - `updated_at` TIMESTAMP
  - `folder_id` UUID (nullable, FK na folders)

### Propojení pracovních listů se sešitem
- [ ] Přidat `workbook_id` do `teacher_worksheets` tabulky
- [ ] Přidat `page_range` JSONB do `teacher_worksheets` (start_page, end_page)
- [ ] Vytvořit sync funkce pro workbook storage

### Editor Pro - Admin integrace
- [ ] Propojit ukládání z Pro editoru do pages struktury
- [ ] Sync pracovních listů mezi Pro a Basic editorem

## 🟡 Důležité (nice to have brzy)

### Šablony pracovních sešitů
- [ ] Vytvořit tabulku `workbook_templates`
- [ ] Import/Export šablon

### Verze a historie
- [ ] Rozšířit `document_versions` o podporu workbooks
- [ ] Autosave pro workbook strukturu

### Sdílení
- [ ] Vytvořit share linky pro celé sešity
- [ ] Oprávnění pro kolaboraci

## 🟢 Budoucí vylepšení

### Export
- [ ] Export celého sešitu jako PDF
- [ ] Export jako ZIP s jednotlivými listy

### Statistiky
- [ ] Tracking použití šablon
- [ ] Analytics pro sešity

---

## Poznámky

### Offline Mode
Aktuálně používáme `?offline=1` nebo `localStorage.setItem('vividbooks-offline-mode', 'true')` pro bypass Supabase auth.

### Testovací URL
- Basic Editor: `http://localhost:3000/library/my-content/worksheet-editor/:id?offline=1`
- Pro Editor: `http://localhost:3000/admin/worksheet-pro/:id?offline=1`
- Workbook Editor: `http://localhost:3000/admin/workbook-pro/:id?offline=1` (TODO)

---
*Vytvořeno: 2026-01-30*
*Poslední update: 2026-01-30*
