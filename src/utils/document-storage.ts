/**
 * Document Storage - Utility funkce pro ukládání dokumentů
 * 
 * Používá Supabase jako primární storage s localStorage jako fallback/cache
 * 
 * V2: Používá sync-queue pro spolehlivou synchronizaci
 */

import { supabase } from './supabase/client';
import { fetchTeacherTombstones, recordTeacherTombstone } from './sync/teacher-tombstones';
import { queueUpsert, queueDelete } from './sync/sync-queue';

const DOCUMENTS_KEY = 'vivid-my-documents';
const DOC_PREFIX = 'vivid-doc-';
const SUPABASE_IDS_KEY = 'vivid-documents-supabase-ids';
const DELETED_IDS_KEY = 'vivid-documents-deleted-ids';

// Supabase config for direct fetch calls
const SUPABASE_URL = 'https://njbtqmsxbyvpwigfceke.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qYnRxbXN4Ynl2cHdpZ2ZjZWtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MzczODksImV4cCI6MjA3ODQxMzM4OX0.nY0THq2YU9wrjYsPoxYwXRXczE3Vh7cB1opzAV8c50g';

// Track which IDs are from Supabase
let supabaseDocIds = new Set<string>();

// Track which IDs were deleted locally (tombstones)
let deletedDocIds = new Set<string>();

// Load IDs from localStorage on init
try {
  const stored = localStorage.getItem(SUPABASE_IDS_KEY);
  if (stored) supabaseDocIds = new Set(JSON.parse(stored));
  
  const deletedStored = localStorage.getItem(DELETED_IDS_KEY);
  if (deletedStored) deletedDocIds = new Set(JSON.parse(deletedStored));
} catch { /* ignore */ }

export type SyncStatus = 'supabase' | 'pending' | 'local';

/**
 * Get sync status for a document
 */
export function getDocumentSyncStatus(id: string): SyncStatus {
  const existsInSupabase = supabaseDocIds.has(id);
  if (existsInSupabase) return 'supabase';
  return 'local';
}

/**
 * Get debug info for a document
 */
export function getDocumentDebugInfo(id: string): string {
  const docs = getDocuments();
  const doc = docs.find(d => d.id === id);
  
  return JSON.stringify({
    id,
    syncStatus: getDocumentSyncStatus(id),
    inSupabaseIds: supabaseDocIds.has(id),
    supabaseIdsCount: supabaseDocIds.size,
    existsInList: !!doc,
    docData: doc || null,
  }, null, 2);
}

export interface DocumentItem {
  id: string;
  name: string;
  type: 'document';
  title?: string;
  content?: string;
  description?: string;
  copiedFrom?: string;
  originalId?: string;
  folderId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

// =============================================
// HELPER FUNCTIONS
// =============================================

async function getCurrentUserId(): Promise<string | null> {
  try {
    // First try getSession
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) {
      return session.user.id;
    }
    
    // Fallback: try getUser (might refresh token)
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      return user.id;
    }
    
    console.warn('[DocumentStorage] No authenticated user found');
    return null;
  } catch (error) {
    console.error('[DocumentStorage] getCurrentUserId error:', error);
    return null;
  }
}

function notifyDocumentChange(): void {
  window.dispatchEvent(new CustomEvent('documents-updated'));
}

// =============================================
// LOCALSTORAGE FUNCTIONS
// =============================================

export function getDocuments(): DocumentItem[] {
  try {
    const list = localStorage.getItem(DOCUMENTS_KEY);
    return list ? JSON.parse(list) : [];
  } catch (error) {
    console.error('[DocumentStorage] Error loading documents:', error);
    return [];
  }
}

export function getDocument(id: string): any | null {
  try {
    const data = localStorage.getItem(`${DOC_PREFIX}${id}`);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('[DocumentStorage] Error loading document:', error);
    return null;
  }
}

function saveDocumentToLocalStorageOnly(doc: DocumentItem, content?: any): void {
  try {
    // Save document metadata to list
    const list = getDocuments();
    const existingIndex = list.findIndex(item => item.id === doc.id);
    
    const listItem: DocumentItem = {
      ...doc,
      updatedAt: new Date().toISOString(),
      createdAt: existingIndex >= 0 ? list[existingIndex].createdAt : new Date().toISOString(),
    };
    
    if (existingIndex >= 0) {
      list[existingIndex] = listItem;
    } else {
      list.unshift(listItem);
    }
    
    localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(list));
    
    // Save document content separately
    if (content !== undefined) {
      localStorage.setItem(`${DOC_PREFIX}${doc.id}`, JSON.stringify(content));
    }
    
    notifyDocumentChange();
  } catch (error) {
    console.error('[DocumentStorage] Error saving document:', error);
  }
}

export function saveDocument(doc: DocumentItem, content?: any): void {
  saveDocumentToLocalStorageOnly(doc, content);
  
  // Remove from deleted IDs if re-saving
  if (deletedDocIds.has(doc.id)) {
    deletedDocIds.delete(doc.id);
    localStorage.setItem(DELETED_IDS_KEY, JSON.stringify([...deletedDocIds]));
  }
  
  // Queue for sync (replaces fire-and-forget async)
  const docContent = content || getDocument(doc.id);
  
  queueUpsert('teacher_documents', doc.id, {
    title: doc.title || doc.name || 'Nový dokument',
    content: docContent?.content || '',
    description: doc.description,
    document_type: 'document',
    folder_id: doc.folderId || null,
    copied_from: doc.copiedFrom || null,
    original_id: doc.originalId || null,
    created_at: doc.createdAt || new Date().toISOString(),
  });
  
  console.log('[DocumentStorage] Queued document for sync:', doc.id);
}

export function deleteDocument(id: string): void {
  try {
    // Remove from localStorage immediately
    localStorage.removeItem(`${DOC_PREFIX}${id}`);
    const list = getDocuments().filter(item => item.id !== id);
    localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(list));
    
    // Track as deleted locally (prevents zombie restore)
    deletedDocIds.add(id);
    localStorage.setItem(DELETED_IDS_KEY, JSON.stringify([...deletedDocIds]));
    
    // Remove from supabase IDs tracking
    supabaseDocIds.delete(id);
    localStorage.setItem(SUPABASE_IDS_KEY, JSON.stringify([...supabaseDocIds]));
    
    notifyDocumentChange();
    
    // Queue for server delete (with tombstone)
    queueDelete('teacher_documents', id);
    
    console.log('[DocumentStorage] Queued document for deletion:', id);
  } catch (error) {
    console.error('[DocumentStorage] Error deleting document:', error);
  }
}

// =============================================
// SYNC FUNCTIONS
// =============================================

/**
 * Sync documents from Supabase to localStorage
 * SMART SYNC: Nejdřív nahraje lokální dokumenty, pak stáhne ze Supabase
 * @param passedUserId - Optional user ID to use directly (avoids calling getUser which can timeout)
 */
export async function syncFromSupabase(passedUserId?: string, accessToken?: string): Promise<void> {
  try {
    const userId = passedUserId || await getCurrentUserId();
    if (!userId) return;

    // Require authenticated token; anon key with RLS can return empty and break local state
    let token = accessToken;
    if (!token) {
      const { data } = await supabase.auth.getSession();
      token = data.session?.access_token;
    }
    if (!token) {
      console.warn('[DocumentStorage] No access token available for sync; skipping');
      return;
    }

    // Apply server tombstones first
    const tombstones = await fetchTeacherTombstones(userId, token);
    const tombstonedDocIds = tombstones.filter(t => t.item_type === 'document').map(t => t.item_id);
    if (tombstonedDocIds.length > 0) {
      let changed = false;
      for (const tid of tombstonedDocIds) {
        if (!deletedDocIds.has(tid)) {
          deletedDocIds.add(tid);
          changed = true;
        }
      }
      if (changed) {
        localStorage.setItem(DELETED_IDS_KEY, JSON.stringify([...deletedDocIds]));
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    let remoteData: any[] = [];
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/teacher_documents?teacher_id=eq.${userId}&select=*`,
        {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);
      
      if (response.ok) {
        remoteData = await response.json();
        console.log('[DocumentStorage] Direct fetch success, got', remoteData.length, 'documents');
      } else {
        console.error('[DocumentStorage] Sync fetch failed:', response.status);
        return;
      }
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      console.error('[DocumentStorage] Fetch error:', fetchErr);
      return;
    }

    const remoteIds = new Set(remoteData.map(d => d.id));
    const localDocuments = getDocuments();
    const localIds = new Set(localDocuments.map(d => d.id));
    
    // 1. Detect Remote Deletions (Was in sync before, but now missing from remote)
    const remoteDeletions = [...supabaseDocIds].filter(id => !remoteIds.has(id));
    
    for (const id of remoteDeletions) {
      // If we deleted it locally, it's fine (it's in deletedDocIds).
      // If we didn't delete it locally, but it's gone from remote -> it was deleted by another client.
      if (!deletedDocIds.has(id) && localIds.has(id)) {
        console.log('[DocumentStorage] Detected remote deletion, removing locally:', id);
        localStorage.removeItem(`${DOC_PREFIX}${id}`);
        // Remove from local list logic happens at the end (we rebuild list)
      }
    }

    // 2. Process Remote Items (Updates & New items)
    const processedRemoteItems: DocumentItem[] = [];
    const itemsToDeleteRemotely: string[] = [];

    for (const doc of remoteData) {
      // If this item is marked as deleted locally, we should delete it from remote (retry delete)
      if (deletedDocIds.has(doc.id)) {
        itemsToDeleteRemotely.push(doc.id);
        continue;
      }

      const docItem: DocumentItem = {
        id: doc.id,
        name: doc.title,
        type: 'document',
        title: doc.title,
        content: doc.content,
        description: doc.description,
        copiedFrom: doc.copied_from,
        originalId: doc.original_id,
        folderId: doc.folder_id,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
      };
      
      processedRemoteItems.push(docItem);
      
      // Save content
      localStorage.setItem(`${DOC_PREFIX}${doc.id}`, JSON.stringify({ 
        title: doc.title, 
        content: doc.content 
      }));
    }

    // 3. Detect New Local Items (Never synced before)
    // IMPORTANT: Also filter out items that are already in remoteIds to prevent duplicates
    const newLocalItems = localDocuments.filter(d => 
      !supabaseDocIds.has(d.id) && !remoteIds.has(d.id)
    );
    
    // 4. Merge: Remote Items + New Local Items
    // (We filter out local items that were "synced but now missing from remote" implicitly because we only include processedRemoteItems and newLocalItems)
    
    // However, we need to be careful not to include newLocalItems that are in deletedDocIds (should happen automatically via filter)
    const validNewLocalItems = newLocalItems.filter(d => !deletedDocIds.has(d.id));
    
    const finalList = [...processedRemoteItems, ...validNewLocalItems];
    localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(finalList));
    
    // Update synced IDs
    const newSyncedIds = new Set(processedRemoteItems.map(d => d.id));
    supabaseDocIds = newSyncedIds;
    localStorage.setItem(SUPABASE_IDS_KEY, JSON.stringify([...newSyncedIds]));
    
    notifyDocumentChange();

    // 5. Background: Retry Deletes
    if (itemsToDeleteRemotely.length > 0) {
      console.log('[DocumentStorage] Retrying delete for', itemsToDeleteRemotely.length, 'items');
      for (const id of itemsToDeleteRemotely) {
        // Ensure tombstone exists (best-effort)
        void recordTeacherTombstone(userId, token, 'document', id);
        fetch(`${SUPABASE_URL}/rest/v1/teacher_documents?id=eq.${id}&teacher_id=eq.${userId}`, {
          method: 'DELETE',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
          }
        }).then(res => {
          if (res.ok) {
             // PostgREST can return ok even if 0 rows matched; don't clear tombstone unless we deleted a row.
             return res.json().then((rows: any) => {
               const deletedCount = Array.isArray(rows) ? rows.length : 0;
               if (deletedCount > 0) {
                 deletedDocIds.delete(id);
                 localStorage.setItem(DELETED_IDS_KEY, JSON.stringify([...deletedDocIds]));
               } else {
                 console.warn('[DocumentStorage] Retry delete returned ok but deleted 0 rows (keeping tombstone):', id);
               }
             }).catch(() => {});
          }
          return;
        });
      }
    }

    // 6. Background: Upload New Local Items
    // CRITICAL: Also filter out items that exist in server tombstones (prevents zombie resurrection!)
    if (validNewLocalItems.length > 0) {
      const safeLocalItems = validNewLocalItems.filter(d => !tombstonedDocIds.includes(d.id));
      const blockedByTombstone = validNewLocalItems.length - safeLocalItems.length;
      
      if (blockedByTombstone > 0) {
        console.log('[DocumentStorage] ⛔ Blocked', blockedByTombstone, 'local items from uploading (server tombstone exists)');
        // Clean up tombstoned items from localStorage
        for (const item of validNewLocalItems) {
          if (tombstonedDocIds.includes(item.id)) {
            console.log('[DocumentStorage] Cleaning tombstoned doc from localStorage:', item.id);
            localStorage.removeItem(`${DOC_PREFIX}${item.id}`);
            deletedDocIds.add(item.id);
          }
        }
        localStorage.setItem(DELETED_IDS_KEY, JSON.stringify([...deletedDocIds]));
        
        // Update the list without tombstoned items
        const cleanedList = getDocuments().filter(d => !tombstonedDocIds.includes(d.id));
        localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(cleanedList));
        notifyDocumentChange();
      }
      
      if (safeLocalItems.length > 0) {
        console.log('[DocumentStorage] Uploading', safeLocalItems.length, 'new local items');
        for (const item of safeLocalItems) {
          saveDocument(item); // This triggers individual upload logic
        }
      }
    }

  } catch (error) {
    console.error('[DocumentStorage] Sync error:', error);
  }
}

export async function migrateToSupabase(): Promise<{ success: boolean; migrated: number }> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return { success: false, migrated: 0 };

    const documents = getDocuments();
    let migrated = 0;

    for (const doc of documents) {
      const content = getDocument(doc.id);
      
      const { error } = await supabase
        .from('teacher_documents')
        .upsert({
          id: doc.id,
          teacher_id: userId,
          title: doc.title || doc.name || 'Nový dokument',
          content: content?.content || '',
          description: doc.description,
          document_type: 'document',
          folder_id: doc.folderId,
          copied_from: doc.copiedFrom,
          original_id: doc.originalId,
          created_at: doc.createdAt,
          updated_at: doc.updatedAt || new Date().toISOString(),
        }, { onConflict: 'id' });

      if (!error) migrated++;
    }

    console.log(`[DocumentStorage] Migrated ${migrated} documents to Supabase`);
    return { success: true, migrated };
  } catch (error) {
    console.error('[DocumentStorage] Migration error:', error);
    return { success: false, migrated: 0 };
  }
}

/**
 * Uložit dokument přímo do Supabase (bez závislosti na localStorage)
 * Používat když localStorage quota exceeded
 */
export async function syncDocumentDirectToSupabase(doc: {
  id: string;
  title: string;
  content: string;
  documentType?: string;
  sectionImages?: any[];
}): Promise<boolean> {
  const MAX_RETRIES = 3;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[DocumentStorage] Direct sync attempt ${attempt}/${MAX_RETRIES} for:`, doc.id);
      
      const userId = await getCurrentUserId();
      if (!userId) {
        console.error('[DocumentStorage] No user ID for direct sync');
        if (attempt < MAX_RETRIES) {
          // Wait and retry - session might be loading
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        return false;
      }
      
      const upsertData = {
        id: doc.id,
        teacher_id: userId,
        title: doc.title || 'Dokument',
        content: doc.content || '',
        document_type: doc.documentType || 'document',
        section_images: doc.sectionImages || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      console.log('[DocumentStorage] Upserting with data:', {
        id: upsertData.id,
        teacher_id: upsertData.teacher_id,
        title: upsertData.title,
        contentLength: upsertData.content.length,
        sectionImagesCount: upsertData.section_images.length,
      });
      
      const { error, data } = await supabase
        .from('teacher_documents')
        .upsert(upsertData, { onConflict: 'id' })
        .select('id');
      
      if (error) {
        console.error('[DocumentStorage] Direct sync failed:', error.message, error.code, error.details);
        if (attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        return false;
      }
      
      // Mark as synced
      supabaseDocIds.add(doc.id);
      
      console.log('[DocumentStorage] ✅ Direct sync completed for:', doc.id);
      return true;
    } catch (error) {
      console.error(`[DocumentStorage] Direct sync error (attempt ${attempt}):`, error);
      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }
    }
  }
  
  console.error('[DocumentStorage] ❌ All sync attempts failed for:', doc.id);
  return false;
}
