/**
 * Quiz Storage - Utility funkce pro ukládání kvízů/boardů do localStorage
 * 
 * V2: Používá sync-queue pro spolehlivou synchronizaci
 */

import { Quiz, QuizSlide } from '../types/quiz';
import { supabase } from './supabase/client';
import { syncBoardToRAG } from './gemini-rag';
import { clearTeacherTombstone, fetchTeacherTombstones, recordTeacherTombstone } from './sync/teacher-tombstones';
import { queueUpsert, queueDelete } from './sync/sync-queue';

const QUIZZES_KEY = 'vividbooks_quizzes';
const QUIZ_PREFIX = 'vividbooks_quiz_';
const SUPABASE_IDS_KEY = 'vividbooks_supabase_quiz_ids';
const DELETED_IDS_KEY = 'vividbooks_deleted_quiz_ids';

// Supabase config for direct fetch calls
const SUPABASE_URL = 'https://njbtqmsxbyvpwigfceke.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qYnRxbXN4Ynl2cHdpZ2ZjZWtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MzczODksImV4cCI6MjA3ODQxMzM4OX0.nY0THq2YU9wrjYsPoxYwXRXczE3Vh7cB1opzAV8c50g';
const SUPABASE_PROJECT_ID = 'njbtqmsxbyvpwigfceke';
const SUPABASE_ANON_KEY = SUPABASE_KEY;

// Track which quiz IDs exist in Supabase
let supabaseQuizIds = new Set<string>();

// Track which quiz IDs were deleted locally (to prevent sync from restoring them)
let deletedQuizIds = new Set<string>();

// Initialize from localStorage
try {
  const stored = localStorage.getItem(SUPABASE_IDS_KEY);
  if (stored) {
    supabaseQuizIds = new Set(JSON.parse(stored));
  }
  
  const deletedStored = localStorage.getItem(DELETED_IDS_KEY);
  if (deletedStored) {
    deletedQuizIds = new Set(JSON.parse(deletedStored));
  }
} catch (e) {
  console.error('[QuizStorage] Error loading Supabase IDs:', e);
}

// Get current user ID
async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}

/**
 * Extract base ID from a quiz ID (removes user suffix if present)
 * e.g. "board-123-7b7de157" -> "board-123"
 */
function getBaseQuizId(id: string): string {
  // Match pattern: ends with -XXXXXXXX (8 hex chars, typical user ID prefix)
  const match = id.match(/^(.+)-[a-f0-9]{8}$/i);
  return match ? match[1] : id;
}

/**
 * Check if two quiz IDs represent the same quiz (with or without user suffix)
 */
function isSameQuiz(id1: string, id2: string): boolean {
  if (id1 === id2) return true;
  const base1 = getBaseQuizId(id1);
  const base2 = getBaseQuizId(id2);
  return base1 === base2 || base1 === id2 || id1 === base2;
}

// Notify listeners of changes
function notifyQuizChange() {
  window.dispatchEvent(new Event('quizStorageChange'));
}

/**
 * Sync status for quizzes
 */
export type SyncStatus = 'supabase' | 'pending' | 'local';

/**
 * Typ pro seznam kvízů (metadata)
 */
export interface QuizListItem {
  id: string;
  title: string;
  subject?: string;
  grade?: number;
  createdAt: string;
  updatedAt: string;
  slidesCount: number;
  folderId?: string | null; // ID složky, ve které je kvíz uložen (null = root)
}

/**
 * Get raw quiz list without filtering (internal use)
 */
function getRawQuizList(): QuizListItem[] {
  try {
    const list = localStorage.getItem(QUIZZES_KEY);
    return list ? JSON.parse(list) : [];
  } catch (error) {
    console.error('Error loading quiz list:', error);
    return [];
  }
}

/**
 * Získat seznam všech kvízů (metadata) - pro UI zobrazení
 */
export function getQuizList(): QuizListItem[] {
  try {
    const parsedList = getRawQuizList();
    
    // Filter out empty quizzes (0 slides) only for display
    // This cleans up any "zombie" files created by opening the editor without saving content
    return parsedList.filter((item: QuizListItem) => item.slidesCount > 0);
  } catch (error) {
    console.error('Error loading quiz list:', error);
    return [];
  }
}

/**
 * Uložit/aktualizovat kvíz
 */
export function saveQuiz(quiz: Quiz): void {
  try {
    console.log('[QuizStorage] saveQuiz called:', {
      id: quiz.id,
      title: quiz.title,
      slidesCount: quiz.slides?.length || 0,
    });
    
    // Uložit samotný quiz do localStorage
    try {
      localStorage.setItem(
        `${QUIZ_PREFIX}${quiz.id}`, 
        JSON.stringify(quiz)
      );
    } catch (e) {
      console.warn('[QuizStorage] Failed to save quiz to localStorage (quota exceeded)', e);
    }
    
    // Update list - use RAW list to preserve all items (including those with 0 slides)
    const list = getRawQuizList();
    const existingIndex = list.findIndex(item => item.id === quiz.id);
    
    const listItem: QuizListItem = {
      id: quiz.id,
      title: quiz.title || 'Bez názvu',
      subject: quiz.subject || undefined,
      grade: quiz.grade || undefined,
      updatedAt: new Date().toISOString(),
      createdAt: existingIndex >= 0 ? list[existingIndex].createdAt : new Date().toISOString(),
      slidesCount: quiz.slides?.length || 0,
      folderId: existingIndex >= 0 ? list[existingIndex].folderId : undefined,
    };
    
    if (existingIndex >= 0) {
      list[existingIndex] = listItem;
    } else {
      list.unshift(listItem);
    }
    
    try {
      localStorage.setItem(QUIZZES_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('[QuizStorage] Failed to update quiz list in localStorage', e);
    }
    
    // Remove from deleted IDs if re-saving
    if (deletedQuizIds.has(quiz.id)) {
      deletedQuizIds.delete(quiz.id);
      localStorage.setItem(DELETED_IDS_KEY, JSON.stringify([...deletedQuizIds]));
    }
    
    // Notify local changes immediately
    notifyQuizChange();
    
    // Queue for sync (replaces fire-and-forget async)
    queueUpsert('teacher_boards', quiz.id, {
      title: quiz.title || 'Bez názvu',
      subject: quiz.subject || null,
      grade: quiz.grade || null,
      slides: quiz.slides || [],
      settings: quiz.settings || {},
      slides_count: quiz.slides?.length || 0,
      folder_id: listItem.folderId || null,
      created_at: listItem.createdAt || new Date().toISOString(),
    });
    
    console.log('[QuizStorage] Queued quiz for sync:', quiz.id);
    
    // Sync to RAG in background (for AI assistant context)
    if (quiz.slides && quiz.slides.length > 0) {
      syncBoardToRAG({
        id: quiz.id,
        title: quiz.title,
        subject: quiz.subject,
        grade: quiz.grade,
        slides: quiz.slides
      }).catch(err => {
        console.warn('[QuizStorage] RAG sync failed:', err);
      });
    }
  } catch (error) {
    console.error('Error saving quiz:', error);
  }
}

// Track if table is known to be missing (to avoid repeated error logs)
let tableKnownMissing = false;

/**
 * Sync a single quiz to Supabase
 * Uses UPSERT with conflict handling
 */
async function syncQuizToSupabase(quiz: Quiz, listItem: QuizListItem): Promise<void> {
  // Skip if we already know the table doesn't exist
  if (tableKnownMissing) {
    return;
  }
  
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.warn('[QuizStorage] No user ID for sync');
      return; 
    }

    // Get fresh access token
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    
    if (!accessToken) {
      console.warn('[QuizStorage] No access token for sync');
      return;
    }

    console.log('[QuizStorage] Syncing quiz:', quiz.id, 'for user:', userId);

    const recordData = {
      id: quiz.id,
      teacher_id: userId,
      title: quiz.title || 'Bez názvu',
      subject: quiz.subject || null,
      grade: quiz.grade || null,
      slides: quiz.slides || [],
      settings: quiz.settings || {},
      slides_count: quiz.slides?.length || 0,
      folder_id: listItem.folderId || null,
      created_at: listItem.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Use direct fetch for better reliability and RLS handling
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/teacher_boards?id=eq.${quiz.id}&teacher_id=eq.${userId}`,
      {
        method: 'PATCH', // Update first
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(recordData)
      }
    );

    let success = false;

    if (response.ok) {
      // Check if update actually happened (matched a row)
      const result = await response.json();
      if (result && result.length > 0) {
        console.log('[QuizStorage] ✅ Successfully updated quiz:', quiz.id);
        success = true;
      }
    }

    // If update didn't work (record doesn't exist), try INSERT
    if (!success) {
      const insertResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/teacher_boards`,
        {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
          },
          body: JSON.stringify(recordData)
        }
      );

      if (insertResponse.ok) {
        console.log('[QuizStorage] ✅ Successfully inserted quiz:', quiz.id);
        success = true;
      } else {
        const errorText = await insertResponse.text();
        
        // Handle duplicate key error (conflict)
        if (errorText.includes('duplicate key') || errorText.includes('unique constraint')) {
           // Try with user suffix first
           const newId = `${quiz.id}-${userId.substring(0, 8)}`;
           console.log('[QuizStorage] ⚠️ ID conflict, trying UPDATE with suffixed ID:', newId);
           
           // First try to UPDATE the existing record with suffixed ID (it might already exist)
           const updateResponse = await fetch(
             `${SUPABASE_URL}/rest/v1/teacher_boards?id=eq.${newId}&teacher_id=eq.${userId}`,
             {
               method: 'PATCH',
               headers: {
                 'apikey': SUPABASE_KEY,
                 'Authorization': `Bearer ${accessToken}`,
                 'Content-Type': 'application/json',
                 'Prefer': 'return=representation',
               },
               body: JSON.stringify({ ...recordData, id: newId })
             }
           );
           
           if (updateResponse.ok) {
             const updateResult = await updateResponse.json();
             if (updateResult && updateResult.length > 0) {
               // Update succeeded - sync local storage to use this ID
               const localQuiz = getQuiz(quiz.id);
               if (localQuiz) {
                 localQuiz.id = newId;
                 localStorage.setItem(`${QUIZ_PREFIX}${newId}`, JSON.stringify(localQuiz));
                 localStorage.removeItem(`${QUIZ_PREFIX}${quiz.id}`);
               }
               
               // Update list
               const list = getRawQuizList();
               const idx = list.findIndex(q => q.id === quiz.id);
               if (idx >= 0) {
                 list[idx].id = newId;
                 localStorage.setItem(QUIZZES_KEY, JSON.stringify(list));
               }
               
               supabaseQuizIds.add(newId);
               localStorage.setItem(SUPABASE_IDS_KEY, JSON.stringify([...supabaseQuizIds]));
               console.log('[QuizStorage] ✅ Successfully updated existing record with ID:', newId);
               notifyQuizChange();
               return;
             }
           }
           
           // If UPDATE didn't match any rows, try INSERT with new ID
           const newRecordData = { ...recordData, id: newId };
           const retryResponse = await fetch(
             `${SUPABASE_URL}/rest/v1/teacher_boards`,
             {
               method: 'POST',
               headers: {
                 'apikey': SUPABASE_KEY,
                 'Authorization': `Bearer ${accessToken}`,
                 'Content-Type': 'application/json',
                 'Prefer': 'return=representation',
               },
               body: JSON.stringify(newRecordData)
             }
           );
           
           if (retryResponse.ok) {
             // Update local storage with new ID
             const localQuiz = getQuiz(quiz.id);
             if (localQuiz) {
               localQuiz.id = newId;
               localStorage.setItem(`${QUIZ_PREFIX}${newId}`, JSON.stringify(localQuiz));
               localStorage.removeItem(`${QUIZ_PREFIX}${quiz.id}`);
             }
             
             // Update list
             const list = getRawQuizList();
             const idx = list.findIndex(q => q.id === quiz.id);
             if (idx >= 0) {
               list[idx].id = newId;
               localStorage.setItem(QUIZZES_KEY, JSON.stringify(list));
             }
             
             supabaseQuizIds.add(newId);
             localStorage.setItem(SUPABASE_IDS_KEY, JSON.stringify([...supabaseQuizIds]));
             console.log('[QuizStorage] ✅ Successfully synced with new ID:', newId);
             notifyQuizChange();
             return;
           } else {
             // Both UPDATE and INSERT failed - the record exists but we can't update it
             // This means it's a true duplicate, just mark as synced and move on
             console.warn('[QuizStorage] ⚠️ Record exists in Supabase, marking as synced:', newId);
             supabaseQuizIds.add(quiz.id);
             supabaseQuizIds.add(newId);
             localStorage.setItem(SUPABASE_IDS_KEY, JSON.stringify([...supabaseQuizIds]));
             notifyQuizChange();
             return;
           }
        } else if (errorText.includes('does not exist') || insertResponse.status === 404) {
          tableKnownMissing = true;
        } else {
          console.error('[QuizStorage] ❌ Insert failed:', insertResponse.status, errorText);
        }
      }
    }

    if (success) {
      // Mark as synced
      supabaseQuizIds.add(quiz.id);
      localStorage.setItem(SUPABASE_IDS_KEY, JSON.stringify([...supabaseQuizIds]));
      notifyQuizChange();

      // If this quiz was ever tombstoned, clear it (best-effort)
      try {
        await clearTeacherTombstone(userId, accessToken, 'quiz', quiz.id);
      } catch {
        // ignore
      }
    }
  } catch (error: any) {
    console.error('[QuizStorage] Sync exception:', error?.message);
  }
}

/**
 * Načíst kvíz podle ID (pouze localStorage)
 */
export function getQuiz(id: string): Quiz | null {
  try {
    const data = localStorage.getItem(`${QUIZ_PREFIX}${id}`);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error loading quiz:', error);
    return null;
  }
}

/**
 * Načíst kvíz podle ID s fallbackem na Supabase
 * Použít v editoru pro cross-browser podporu
 */
export async function getQuizAsync(id: string): Promise<Quiz | null> {
  try {
    // 1. Zkusit localStorage
    const localData = localStorage.getItem(`${QUIZ_PREFIX}${id}`);
    if (localData) {
      console.log('[QuizStorage] getQuizAsync: found in localStorage:', id);
      return JSON.parse(localData);
    }
    
    // 2. Fallback na Supabase
    console.log('[QuizStorage] getQuizAsync: not in localStorage, trying Supabase:', id);
    
    const userId = await getCurrentUserId();
    if (!userId) {
      console.log('[QuizStorage] getQuizAsync: no user logged in');
      return null;
    }
    
    // Get access token
    let accessToken: string | undefined;
    try {
      const storageKey = `sb-${SUPABASE_PROJECT_ID}-auth-token`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        accessToken = parsed?.access_token;
      }
    } catch (e) {}
    
    if (!accessToken) {
      console.log('[QuizStorage] getQuizAsync: no access token');
      return null;
    }
    
    // Fetch from Supabase
    const response = await fetch(
      `https://${SUPABASE_PROJECT_ID}.supabase.co/rest/v1/teacher_boards?id=eq.${id}&select=*`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (!response.ok) {
      console.warn('[QuizStorage] getQuizAsync: Supabase fetch failed:', response.status);
      return null;
    }
    
    const data = await response.json();
    if (!data || data.length === 0) {
      console.log('[QuizStorage] getQuizAsync: not found in Supabase:', id);
      return null;
    }
    
    const row = data[0];
    const quiz: Quiz = {
      id: row.id,
      title: row.title || 'Bez názvu',
      subject: row.subject || undefined,
      grade: row.grade || undefined,
      slides: row.slides || [],
      settings: row.settings || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
    
    console.log('[QuizStorage] getQuizAsync: loaded from Supabase:', id, quiz.title);
    
    // Cache to localStorage for future use
    try {
      localStorage.setItem(`${QUIZ_PREFIX}${id}`, JSON.stringify(quiz));
      
      // Also update list
      const list = getRawQuizList();
      const existingIndex = list.findIndex(item => item.id === id);
      const listItem: QuizListItem = {
        id: quiz.id,
        title: quiz.title || 'Bez názvu',
        subject: quiz.subject,
        grade: quiz.grade,
        createdAt: quiz.createdAt || new Date().toISOString(),
        updatedAt: quiz.updatedAt || new Date().toISOString(),
        slidesCount: quiz.slides?.length || 0,
        folderId: row.folder_id || null,
      };
      if (existingIndex >= 0) {
        list[existingIndex] = listItem;
      } else {
        list.unshift(listItem);
      }
      localStorage.setItem(QUIZZES_KEY, JSON.stringify(list));
      
      // Mark as synced
      supabaseQuizIds.add(id);
      localStorage.setItem(SUPABASE_IDS_KEY, JSON.stringify([...supabaseQuizIds]));
    } catch (e) {
      console.warn('[QuizStorage] getQuizAsync: failed to cache to localStorage:', e);
    }
    
    return quiz;
  } catch (error) {
    console.error('[QuizStorage] getQuizAsync error:', error);
    return null;
  }
}

/**
 * Načíst veřejný board bez nutnosti přihlášení
 * Používá se pro PublicBoardViewer
 */
export async function getPublicQuizAsync(id: string): Promise<Quiz | null> {
  try {
    console.log('[QuizStorage] getPublicQuizAsync: fetching public board:', id);
    
    // Fetch from Supabase without authentication (uses anon key only)
    // This relies on RLS policy: "Anyone can view public boards" where is_public = true
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/teacher_boards?id=eq.${id}&is_public=eq.true&select=*`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (!response.ok) {
      console.warn('[QuizStorage] getPublicQuizAsync: fetch failed:', response.status);
      return null;
    }
    
    const data = await response.json();
    if (!data || data.length === 0) {
      console.log('[QuizStorage] getPublicQuizAsync: not found or not public:', id);
      return null;
    }
    
    const row = data[0];
    const quiz: Quiz = {
      id: row.id,
      title: row.title || 'Bez názvu',
      subject: row.subject || undefined,
      grade: row.grade || undefined,
      slides: row.slides || [],
      settings: row.settings || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
    
    console.log('[QuizStorage] getPublicQuizAsync: loaded public board:', id, quiz.title);
    return quiz;
  } catch (error) {
    console.error('[QuizStorage] getPublicQuizAsync error:', error);
    return null;
  }
}

/**
 * Nastavit board jako veřejný (pro sdílení)
 */
export async function setBoardPublic(id: string, isPublic: boolean): Promise<boolean> {
  try {
    console.log('[QuizStorage] setBoardPublic:', id, isPublic);
    
    const userId = await getCurrentUserId();
    if (!userId) {
      console.warn('[QuizStorage] setBoardPublic: no user logged in');
      return false;
    }
    
    // Get access token
    let accessToken: string | undefined;
    try {
      const storageKey = `sb-${SUPABASE_PROJECT_ID}-auth-token`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        accessToken = parsed?.access_token;
      }
    } catch (e) {}
    
    if (!accessToken) {
      console.warn('[QuizStorage] setBoardPublic: no access token');
      return false;
    }
    
    // Update the board in Supabase
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/teacher_boards?id=eq.${id}&teacher_id=eq.${userId}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ is_public: isPublic }),
      }
    );
    
    if (!response.ok) {
      console.error('[QuizStorage] setBoardPublic: update failed:', response.status);
      return false;
    }
    
    console.log('[QuizStorage] setBoardPublic: success');
    return true;
  } catch (error) {
    console.error('[QuizStorage] setBoardPublic error:', error);
    return false;
  }
}

/**
 * Smazat kvíz (localStorage + Supabase)
 */
export function deleteQuiz(id: string): void {
  try {
    console.log('[QuizStorage] Deleting quiz:', id);
    
    // Delete from localStorage
    localStorage.removeItem(`${QUIZ_PREFIX}${id}`);
    
    // Use raw list to ensure we remove the item even if it had 0 slides
    const list = getRawQuizList().filter(item => item.id !== id);
    localStorage.setItem(QUIZZES_KEY, JSON.stringify(list));
    
    // Remove from supabase IDs tracking
    supabaseQuizIds.delete(id);
    localStorage.setItem(SUPABASE_IDS_KEY, JSON.stringify([...supabaseQuizIds]));
    
    // Add to deleted IDs to prevent sync from restoring it
    deletedQuizIds.add(id);
    localStorage.setItem(DELETED_IDS_KEY, JSON.stringify([...deletedQuizIds]));
    console.log('[QuizStorage] Added to deleted IDs, count:', deletedQuizIds.size);
    
    // CRITICAL: Write tombstone IMMEDIATELY (not just via queue)
    // This prevents zombie files if the page is closed before queue processes
    (async () => {
      try {
        const userId = await getCurrentUserId();
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        
        if (userId && token) {
          await recordTeacherTombstone(userId, token, 'quiz', id);
          console.log('[QuizStorage] ✅ Immediate tombstone recorded for:', id);
        }
      } catch (err) {
        console.warn('[QuizStorage] Immediate tombstone failed (will retry via queue):', err);
      }
    })();
    
    // Queue for server delete (backup + actual delete)
    queueDelete('teacher_boards', id);
    
    console.log('[QuizStorage] Queued quiz for deletion:', id);
    
    // Notify change
    notifyQuizChange();
  } catch (error) {
    console.error('Error deleting quiz:', error);
  }
}

/**
 * Duplikovat kvíz
 */
export function duplicateQuiz(id: string): Quiz | null {
  try {
    const original = getQuiz(id);
    if (!original) return null;
    
    const duplicate: Quiz = {
      ...original,
      id: crypto.randomUUID(),
      title: `${original.title || 'Bez názvu'} (kopie)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    saveQuiz(duplicate);
    return duplicate;
  } catch (error) {
    console.error('Error duplicating quiz:', error);
    return null;
  }
}

/**
 * Zkontrolovat, zda quiz existuje
 */
export function quizExists(id: string): boolean {
  return localStorage.getItem(`${QUIZ_PREFIX}${id}`) !== null;
}

/**
 * Přesunout kvíz do složky
 */
export function moveQuizToFolder(quizId: string, folderId: string | null): void {
  try {
    // Use raw list to be able to move quizzes even if they have 0 slides
    const list = getRawQuizList();
    const index = list.findIndex(item => item.id === quizId);
    
    if (index >= 0) {
      list[index].folderId = folderId;
      localStorage.setItem(QUIZZES_KEY, JSON.stringify(list));
    }
  } catch (error) {
    console.error('Error moving quiz to folder:', error);
  }
}

/**
 * Získat kvízy v konkrétní složce
 */
export function getQuizzesInFolder(folderId: string | null): QuizListItem[] {
  const list = getQuizList();
  return list.filter(item => (item.folderId || null) === folderId);
}

/**
 * Získat kvízy v root (bez složky)
 */
export function getRootQuizzes(): QuizListItem[] {
  return getQuizzesInFolder(null);
}

/**
 * Migrate from old storage format if needed
 */
export function migrateOldQuizStorage(): void {
  try {
    // Check for quizzes stored with old key format
    const keys = Object.keys(localStorage);
    const oldQuizKeys = keys.filter(k => k.startsWith('vivid-quiz-'));
    
    for (const key of oldQuizKeys) {
      const data = localStorage.getItem(key);
      if (data) {
        const quiz = JSON.parse(data);
        // Save to new format
        saveQuiz(quiz);
        // Remove old format
        localStorage.removeItem(key);
      }
    }
  } catch (error) {
    console.error('Error migrating old quiz storage:', error);
  }
}

/**
 * Get sync status for a quiz
 */
export function getQuizSyncStatus(id: string): SyncStatus {
  const existsInSupabase = supabaseQuizIds.has(id);
  if (existsInSupabase) return 'supabase';
  return 'local';
}

/**
 * Manually sync a quiz to Supabase (for local-only quizzes)
 * Returns true if successful, false otherwise
 */
export async function manualSyncQuizToSupabase(id: string): Promise<boolean> {
  try {
    const quiz = getQuiz(id);
    if (!quiz) {
      console.error('[QuizStorage] Quiz not found for sync:', id);
      return false;
    }
    
    const quizzes = getQuizList();
    const listItem = quizzes.find(q => q.id === id);
    if (!listItem) {
      console.error('[QuizStorage] Quiz list item not found:', id);
      return false;
    }
    
    console.log('[QuizStorage] Manual sync starting for:', id);
    await syncQuizToSupabase(quiz, listItem);
    
    // Mark as synced
    supabaseQuizIds.add(id);
    
    console.log('[QuizStorage] Manual sync completed for:', id);
    return true;
  } catch (error) {
    console.error('[QuizStorage] Manual sync failed:', error);
    return false;
  }
}

/**
 * Uložit quiz přímo do Supabase (bez závislosti na localStorage)
 * Používat když localStorage quota exceeded
 */
export async function syncQuizDirectToSupabase(quiz: Quiz): Promise<boolean> {
  try {
    console.log('[QuizStorage] Direct sync starting for:', quiz.id);
    
    const listItem: QuizListItem = {
      id: quiz.id,
      title: quiz.title || 'Bez názvu',
      subject: quiz.subject || undefined,
      grade: quiz.grade || undefined,
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      slidesCount: quiz.slides?.length || 0,
      folderId: undefined,
    };
    
    await syncQuizToSupabase(quiz, listItem);
    
    // Mark as synced
    supabaseQuizIds.add(quiz.id);
    
    console.log('[QuizStorage] Direct sync completed for:', quiz.id);
    return true;
  } catch (error) {
    console.error('[QuizStorage] Direct sync failed:', error);
    return false;
  }
}

/**
 * Get debug info for a quiz
 */
export function getQuizDebugInfo(id: string): string {
  const quizzes = getQuizList();
  const quiz = quizzes.find(q => q.id === id);
  
  return JSON.stringify({
    id,
    syncStatus: getQuizSyncStatus(id),
    inSupabaseIds: supabaseQuizIds.has(id),
    supabaseIdsCount: supabaseQuizIds.size,
    inDeletedIds: deletedQuizIds.has(id),
    deletedIdsCount: deletedQuizIds.size,
    existsInList: !!quiz,
    quizData: quiz || null,
  }, null, 2);
}

/**
 * Force delete a quiz from Supabase (for cleaning zombie files)
 * This bypasses local storage and directly deletes from server
 */
export async function forceDeleteFromSupabase(id: string): Promise<boolean> {
  try {
    console.log('[QuizStorage] Force deleting quiz from Supabase:', id);
    
    const userId = await getCurrentUserId();
    if (!userId) {
      console.error('[QuizStorage] No user ID for force delete');
      return false;
    }
    
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) {
      console.error('[QuizStorage] No access token for force delete');
      return false;
    }
    
    // 1. Record tombstone first
    await recordTeacherTombstone(userId, token, 'quiz', id);
    console.log('[QuizStorage] Recorded tombstone for:', id);
    
    // 2. Delete from Supabase
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/teacher_boards?id=eq.${id}&teacher_id=eq.${userId}`,
      {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
      }
    );
    
    if (response.ok) {
      const rows = await response.json();
      const deletedCount = Array.isArray(rows) ? rows.length : 0;
      console.log('[QuizStorage] ✅ Force delete success:', id, 'deleted', deletedCount, 'rows');
      
      // 3. Clean up local storage
      localStorage.removeItem(`${QUIZ_PREFIX}${id}`);
      
      const list = getRawQuizList().filter(item => item.id !== id);
      localStorage.setItem(QUIZZES_KEY, JSON.stringify(list));
      
      supabaseQuizIds.delete(id);
      localStorage.setItem(SUPABASE_IDS_KEY, JSON.stringify([...supabaseQuizIds]));
      
      deletedQuizIds.add(id);
      localStorage.setItem(DELETED_IDS_KEY, JSON.stringify([...deletedQuizIds]));
      
      notifyQuizChange();
      return true;
    } else {
      const errorText = await response.text();
      console.error('[QuizStorage] ❌ Force delete failed:', response.status, errorText);
      return false;
    }
  } catch (error: any) {
    console.error('[QuizStorage] Force delete exception:', error?.message);
    return false;
  }
}

/**
 * Sync quizzes from Supabase
 * @param passedUserId - Optional user ID to use directly (avoids calling getUser which can timeout)
 * @param accessToken - Optional access token for authenticated requests
 */
export async function syncFromSupabase(passedUserId?: string, accessToken?: string): Promise<void> {
  try {
    // Use passed userId if available, otherwise try to get it (may timeout)
    const userId = passedUserId || await getCurrentUserId();
    if (!userId) {
      console.log('[QuizStorage] No user logged in, skipping sync from Supabase');
      return;
    }

    // Require an authenticated token; using anon key with RLS can return empty data and corrupt local "synced IDs"
    let token = accessToken;
    if (!token) {
      const { data: sessionData } = await supabase.auth.getSession();
      token = sessionData?.session?.access_token;
    }
    if (!token) {
      console.warn('[QuizStorage] No access token available for sync; skipping');
      return;
    }

    // Pull server tombstones and apply locally (prevents cross-browser zombie restores)
    console.log('[QuizStorage] Fetching tombstones from server...');
    const tombstones = await fetchTeacherTombstones(userId, token);
    console.log('[QuizStorage] Tombstones received:', tombstones.length, 'total');
    const tombstonedQuizIds = tombstones.filter(t => t.item_type === 'quiz').map(t => t.item_id);
    console.log('[QuizStorage] Quiz tombstones:', tombstonedQuizIds.length, tombstonedQuizIds.slice(0, 5));
    if (tombstonedQuizIds.length > 0) {
      let changed = false;
      for (const tid of tombstonedQuizIds) {
        if (!deletedQuizIds.has(tid)) {
          deletedQuizIds.add(tid);
          changed = true;
          console.log('[QuizStorage] Added tombstoned ID to deletedQuizIds:', tid);
        }
      }
      if (changed) {
        localStorage.setItem(DELETED_IDS_KEY, JSON.stringify([...deletedQuizIds]));
      }
    }

    console.log('[QuizStorage] Fetching quizzes from Supabase for user:', userId);

    // Use direct fetch instead of supabase.from() to avoid timeout issues
    const authToken = token;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
    
    let data: any[] | null = null;
    let error: { message: string; code?: number } | null = null;
    
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/teacher_boards?teacher_id=eq.${userId}&select=*`,
        {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);
      
      if (response.ok) {
        data = await response.json();
        console.log('[QuizStorage] Direct fetch success, got', data?.length || 0, 'quizzes');
      } else {
        const errorText = await response.text();
        error = { message: errorText, code: response.status };
      }
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      if (fetchErr.name === 'AbortError') {
        console.error('[QuizStorage] Fetch timed out after 10s');
        return;
      }
      error = { message: fetchErr?.message || 'Unknown error' };
    }

    if (error) {
      // Log detailed error info
      const isTableMissing = error.code === 404 || 
                             error.message?.includes('does not exist') ||
                             error.message?.includes('Could not find');
      
      if (isTableMissing) {
        console.warn('[QuizStorage] Table teacher_boards does not exist - using local storage only');
      } else {
        console.error('[QuizStorage] Error syncing from Supabase:', JSON.stringify(error, null, 2));
      }
      return;
    }

    console.log('[QuizStorage] Syncing quizzes from Supabase, found:', data?.length || 0);
    console.log('[QuizStorage] Deleted IDs to filter out:', deletedQuizIds.size, '[', [...deletedQuizIds].slice(0, 10).join(', '), ']');
    console.log('[QuizStorage] Supabase quiz IDs (first 10):', (data || []).slice(0, 10).map((q: any) => q.id).join(', '));

    // Get current local quizzes to merge - use RAW list to preserve all items
    const localQuizzes = getRawQuizList();
    const supabaseQuizzes: QuizListItem[] = [];
    const quizzesToDeleteFromSupabase: string[] = [];
    
    // Process each quiz from Supabase
    for (const q of (data || [])) {
      // Skip quizzes that were deleted locally
      if (deletedQuizIds.has(q.id)) {
        console.log('[QuizStorage] Skipping deleted quiz from Supabase:', q.id, q.title);
        quizzesToDeleteFromSupabase.push(q.id);
        continue;
      }
      
      // Save full quiz content to localStorage (including slides!)
      if (q.slides && q.slides.length > 0) {
        const fullQuiz: Quiz = {
          id: q.id,
          title: q.title,
          subject: q.subject,
          grade: q.grade,
          slides: q.slides,
          settings: q.settings || {},
          createdAt: q.created_at,
          updatedAt: q.updated_at,
        };
        // Save directly to localStorage without triggering sync back
        localStorage.setItem(`${QUIZ_PREFIX}${q.id}`, JSON.stringify(fullQuiz));
      }
      
      // Add to list
      supabaseQuizzes.push({
        id: q.id,
        title: q.title,
        subject: q.subject,
        grade: q.grade,
        createdAt: q.created_at,
        updatedAt: q.updated_at,
        slidesCount: q.slides_count || q.slides?.length || 0,
        folderId: q.folder_id,
      });
    }

    // Merge: keep local quizzes that aren't in Supabase yet (and aren't deleted)
    const supabaseIds = new Set(supabaseQuizzes.map(q => q.id));
    const supabaseBaseIds = new Set(supabaseQuizzes.map(q => getBaseQuizId(q.id)));
    
    // Filter local quizzes - exclude if:
    // 1. Exact ID match in Supabase
    // 2. Base ID match (local "board-123" matches Supabase "board-123-7b7de157")
    // 3. Deleted locally
    const localOnly = localQuizzes.filter(q => {
      if (supabaseIds.has(q.id)) return false;
      if (deletedQuizIds.has(q.id)) return false;
      // Check if a version with user suffix exists in Supabase
      const baseId = getBaseQuizId(q.id);
      if (supabaseBaseIds.has(baseId)) {
        // Found matching board in Supabase with suffix - clean up local version
        console.log('[QuizStorage] Local quiz matches Supabase version with suffix, removing local:', q.id);
        localStorage.removeItem(`${QUIZ_PREFIX}${q.id}`);
        return false;
      }
      return true;
    });
    
    // Combined list: Supabase first, then local-only
    const mergedQuizzes = [...supabaseQuizzes, ...localOnly];

    localStorage.setItem(QUIZZES_KEY, JSON.stringify(mergedQuizzes));
    
    // Track which IDs are from Supabase
    supabaseQuizIds = supabaseIds;
    localStorage.setItem(SUPABASE_IDS_KEY, JSON.stringify([...supabaseIds]));
    
    console.log(`[QuizStorage] Synced ${supabaseQuizzes.length} from Supabase (with slides), kept ${localOnly.length} local-only, filtered ${quizzesToDeleteFromSupabase.length} deleted`);
    notifyQuizChange();
    
    // Retry deleting quizzes that are still in Supabase but were deleted locally
    if (quizzesToDeleteFromSupabase.length > 0) {
      console.log('[QuizStorage] Retrying delete for quizzes still in Supabase:', quizzesToDeleteFromSupabase.length);
      
      // Get fresh access token for delete operations
      const { data: sessionData } = await supabase.auth.getSession();
      const deleteToken = token || sessionData?.session?.access_token;
      if (!deleteToken) {
        console.warn('[QuizStorage] No access token for retry deletes; skipping');
        return;
      }
      
      for (const id of quizzesToDeleteFromSupabase) {
        try {
          // Ensure server tombstone exists (best-effort)
          await recordTeacherTombstone(userId, deleteToken, 'quiz', id);

          const response = await fetch(
            `${SUPABASE_URL}/rest/v1/teacher_boards?id=eq.${id}&teacher_id=eq.${userId}`,
            {
              method: 'DELETE',
              headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${deleteToken}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation',
              },
            }
          );
          
          if (response.ok) {
            let deletedCount = 0;
            try {
              const rows = await response.json();
              deletedCount = Array.isArray(rows) ? rows.length : 0;
            } catch {}

            if (deletedCount > 0) {
              console.log('[QuizStorage] ✅ Retry delete success:', id);
              deletedQuizIds.delete(id);
              localStorage.setItem(DELETED_IDS_KEY, JSON.stringify([...deletedQuizIds]));
            } else {
              console.warn('[QuizStorage] Retry delete returned ok but deleted 0 rows (keeping tombstone):', id);
            }
          } else {
            const errorText = await response.text();
            console.warn('[QuizStorage] ❌ Retry delete failed:', id, response.status, errorText);
          }
        } catch (err: any) {
          console.warn('[QuizStorage] Delete exception for', id, ':', err?.message);
        }
      }
    }
    
    // Auto-upload local-only quizzes to Supabase in background
    // CRITICAL: Filter out any that are in server tombstones (prevents zombie resurrection!)
    if (localOnly.length > 0) {
      // tombstonedQuizIds already contains server tombstones from earlier in this function
      const safeLocalOnly = localOnly.filter(q => !tombstonedQuizIds.includes(q.id));
      const blockedByTombstone = localOnly.length - safeLocalOnly.length;
      
      if (blockedByTombstone > 0) {
        console.log('[QuizStorage] ⛔ Blocked', blockedByTombstone, 'local quizzes from uploading (server tombstone exists)');
        // Also clean up these from localStorage
        for (const quizItem of localOnly) {
          if (tombstonedQuizIds.includes(quizItem.id)) {
            console.log('[QuizStorage] Cleaning tombstoned quiz from localStorage:', quizItem.id);
            localStorage.removeItem(`${QUIZ_PREFIX}${quizItem.id}`);
            deletedQuizIds.add(quizItem.id);
          }
        }
        localStorage.setItem(DELETED_IDS_KEY, JSON.stringify([...deletedQuizIds]));
        
        // Update the list without tombstoned items
        const cleanedList = getRawQuizList().filter(q => !tombstonedQuizIds.includes(q.id));
        localStorage.setItem(QUIZZES_KEY, JSON.stringify(cleanedList));
        notifyQuizChange();
      }
      
      if (safeLocalOnly.length > 0) {
        console.log('[QuizStorage] Uploading', safeLocalOnly.length, 'local-only quizzes to Supabase...');
        for (const quizItem of safeLocalOnly) {
          const quiz = getQuiz(quizItem.id);
          if (quiz) {
            syncQuizToSupabase(quiz, quizItem).catch(err => {
              console.warn('[QuizStorage] Failed to upload local quiz:', quizItem.id, err);
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('[QuizStorage] Sync error:', error);
  }
}

/**
 * Migrate local quizzes to Supabase
 */
export async function migrateToSupabase(): Promise<{ success: boolean; migrated: number }> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return { success: false, migrated: 0 };

    const quizzes = getQuizList();
    let migrated = 0;

    for (const quizItem of quizzes) {
      const quiz = getQuiz(quizItem.id);
      if (!quiz) continue;

      const { error } = await supabase
        .from('teacher_boards')
        .upsert({
          id: quiz.id,
          teacher_id: userId,
          title: quiz.title,
          subject: quiz.subject,
          grade: quiz.grade,
          slides_count: quiz.slides?.length || 0,
          folder_id: quizItem.folderId,
          created_at: quizItem.createdAt || new Date().toISOString(),
          updated_at: quizItem.updatedAt || new Date().toISOString(),
        }, { onConflict: 'id' });

      if (!error) migrated++;
    }

    console.log(`[QuizStorage] Migrated ${migrated} quizzes to Supabase`);
    return { success: true, migrated };
  } catch (error) {
    console.error('[QuizStorage] Migration error:', error);
    return { success: false, migrated: 0 };
  }
}

/**
 * Clean up local duplicates and force upload remaining local items to Supabase
 * This resolves sync issues where local items have different IDs than Supabase items
 */
export async function cleanupDuplicatesAndForceUpload(): Promise<{ cleaned: number; uploaded: number; errors: string[] }> {
  const result = { cleaned: 0, uploaded: 0, errors: [] as string[] };
  
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      result.errors.push('Uživatel není přihlášen');
      return result;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) {
      result.errors.push('Chybí přístupový token');
      return result;
    }

    console.log('[QuizStorage] Starting cleanup and force upload...');

    // 1. Fetch all Supabase quizzes
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/teacher_boards?teacher_id=eq.${userId}&select=id,title`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${accessToken}`,
        }
      }
    );

    if (!response.ok) {
      result.errors.push('Nepodařilo se načíst data ze serveru');
      return result;
    }

    const supabaseQuizzes = await response.json();
    const supabaseIdSet = new Set(supabaseQuizzes.map((q: any) => q.id));
    const supabaseBaseIds = new Set(supabaseQuizzes.map((q: any) => getBaseQuizId(q.id)));
    const supabaseTitles = new Map(supabaseQuizzes.map((q: any) => [q.id, q.title]));

    console.log('[QuizStorage] Supabase has', supabaseQuizzes.length, 'quizzes');

    // 2. Get all local quizzes
    const localQuizzes = getRawQuizList();
    console.log('[QuizStorage] Local has', localQuizzes.length, 'quizzes');

    // 3. Find and clean duplicates
    const toClean: string[] = [];
    const toUpload: QuizListItem[] = [];

    for (const localQuiz of localQuizzes) {
      // Check if exact ID exists in Supabase
      if (supabaseIdSet.has(localQuiz.id)) {
        // Already synced, skip
        supabaseQuizIds.add(localQuiz.id);
        continue;
      }

      // Check if base ID exists (local without suffix, Supabase with suffix)
      const baseId = getBaseQuizId(localQuiz.id);
      
      // Find matching Supabase quiz
      const matchingSupabaseId = supabaseQuizzes.find((sq: any) => {
        // Match: local "board-123" should match Supabase "board-123-7b7de157"
        return getBaseQuizId(sq.id) === baseId || sq.id === baseId;
      })?.id;

      if (matchingSupabaseId) {
        // Duplicate found - clean local
        console.log('[QuizStorage] Cleaning duplicate local:', localQuiz.id, '-> matches Supabase:', matchingSupabaseId);
        toClean.push(localQuiz.id);
        supabaseQuizIds.add(matchingSupabaseId);
      } else {
        // Truly local-only, needs upload
        toUpload.push(localQuiz);
      }
    }

    // 4. Clean duplicates
    if (toClean.length > 0) {
      console.log('[QuizStorage] Cleaning', toClean.length, 'local duplicates');
      for (const id of toClean) {
        localStorage.removeItem(`${QUIZ_PREFIX}${id}`);
        result.cleaned++;
      }
      
      // Update list
      const cleanedList = localQuizzes.filter(q => !toClean.includes(q.id));
      localStorage.setItem(QUIZZES_KEY, JSON.stringify(cleanedList));
    }

    // 5. Upload remaining local items
    if (toUpload.length > 0) {
      console.log('[QuizStorage] Uploading', toUpload.length, 'local quizzes');
      for (const quizItem of toUpload) {
        const quiz = getQuiz(quizItem.id);
        if (!quiz) continue;

        try {
          await syncQuizToSupabase(quiz, quizItem);
          result.uploaded++;
        } catch (err: any) {
          console.warn('[QuizStorage] Failed to upload:', quizItem.id, err);
          result.errors.push(`${quizItem.title || quizItem.id}: ${err.message}`);
        }
      }
    }

    // 6. Save updated Supabase IDs
    localStorage.setItem(SUPABASE_IDS_KEY, JSON.stringify([...supabaseQuizIds]));
    notifyQuizChange();

    console.log('[QuizStorage] Cleanup complete:', result);
    return result;

  } catch (error: any) {
    console.error('[QuizStorage] Cleanup error:', error);
    result.errors.push(error.message);
    return result;
  }
}
