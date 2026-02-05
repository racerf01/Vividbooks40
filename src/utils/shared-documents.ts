/**
 * Shared Documents Utility
 * Handles saving and loading shared documents from Supabase
 */

import { supabase } from './supabase/client';

export interface SharedDocument {
  id: string;
  title: string;
  content: string;
  description?: string;
  document_type: string;
  featured_media?: string;
  section_images?: any[];
  slug?: string;
  show_toc?: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * Save a document to Supabase for sharing
 */
export async function saveSharedDocument(doc: SharedDocument): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('shared_documents')
      .upsert({
        id: doc.id,
        title: doc.title,
        content: doc.content,
        description: doc.description || '',
        document_type: doc.document_type || 'lesson',
        featured_media: doc.featured_media || null,
        section_images: doc.section_images || null,
        slug: doc.slug || doc.id,
        show_toc: doc.show_toc !== false,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'id',
      });

    if (error) {
      console.error('Error saving shared document:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('Error saving shared document:', err);
    return { success: false, error: 'Failed to save document' };
  }
}

/**
 * Load a shared document from Supabase
 */
export async function loadSharedDocument(id: string): Promise<{ success: boolean; document?: SharedDocument; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('shared_documents')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Error loading shared document:', error);
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: false, error: 'Document not found' };
    }

    return {
      success: true,
      document: {
        id: data.id,
        title: data.title,
        content: data.content,
        description: data.description,
        document_type: data.document_type,
        featured_media: data.featured_media,
        section_images: data.section_images,
        slug: data.slug,
        show_toc: data.show_toc,
        created_at: data.created_at,
        updated_at: data.updated_at,
      }
    };
  } catch (err) {
    console.error('Error loading shared document:', err);
    return { success: false, error: 'Failed to load document' };
  }
}

/**
 * Check if a document exists in Supabase shared storage
 */
export async function isDocumentShared(id: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('shared_documents')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    return !error && !!data;
  } catch {
    return false;
  }
}


