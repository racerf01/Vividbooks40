/**
 * Upload base64 image to Supabase Storage
 * Řeší problém s ukládáním velkých base64 dat do databáze
 */

import { supabase } from './client';

const BUCKET_NAME = 'generated-images';

/**
 * Convert base64 to Blob
 */
function base64ToBlob(base64: string, mimeType: string = 'image/png'): Blob {
  // Remove data URL prefix if present
  const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
  
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

/**
 * Upload base64 image to Supabase Storage and return public URL
 * 
 * @param base64 - Base64 encoded image (with or without data URL prefix)
 * @param fileName - Desired filename (without extension)
 * @param folder - Optional folder path (e.g., 'illustrations', 'photos')
 * @param mimeType - Image MIME type (default: image/png)
 * @returns Public URL of uploaded image, or null if failed
 */
export async function uploadBase64ToStorage(
  base64: string,
  fileName: string,
  folder: string = 'illustrations',
  mimeType: string = 'image/png'
): Promise<string | null> {
  try {
    // Generate unique filename
    const extension = mimeType.split('/')[1] || 'png';
    const uniqueFileName = `${folder}/${fileName}-${Date.now()}.${extension}`;
    
    // Convert base64 to blob
    const blob = base64ToBlob(base64, mimeType);
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(uniqueFileName, blob, {
        contentType: mimeType,
        upsert: false,
      });
    
    if (error) {
      console.error('[UploadImage] Upload error:', error);
      return null;
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path);
    
    console.log('[UploadImage] Uploaded successfully:', urlData.publicUrl);
    return urlData.publicUrl;
  } catch (err) {
    console.error('[UploadImage] Error:', err);
    return null;
  }
}

/**
 * Check if string is a base64 data URL
 */
export function isBase64DataUrl(str: string): boolean {
  return str?.startsWith('data:') && str?.includes('base64');
}

/**
 * Process image URL - if it's base64, upload to storage and return real URL
 * If it's already a URL, return as-is
 */
export async function processImageUrl(
  imageUrl: string,
  fileName: string,
  folder: string = 'illustrations'
): Promise<string> {
  // If it's already a regular URL, return as-is
  if (!isBase64DataUrl(imageUrl)) {
    return imageUrl;
  }
  
  // Extract MIME type from data URL
  const mimeMatch = imageUrl.match(/data:([^;]+);/);
  const mimeType = mimeMatch?.[1] || 'image/png';
  
  // Upload to storage
  const uploadedUrl = await uploadBase64ToStorage(imageUrl, fileName, folder, mimeType);
  
  // Return uploaded URL or original if upload failed
  return uploadedUrl || imageUrl;
}
