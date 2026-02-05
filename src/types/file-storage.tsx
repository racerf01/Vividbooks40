// =============================================
// FILE STORAGE TYPES
// For teacher file upload system
// =============================================

import { LinkType } from '../utils/link-detector';

/**
 * Stored file metadata
 */
export interface StoredFile {
  id: string;
  userId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string | null;
  createdAt: string;
  folderId?: string | null;  // Folder where file is stored (null = root)
  extractedText?: string | null;  // Text extracted from PDF/documents for AI processing
  thumbnailUrl?: string | null;  // Thumbnail image (base64 data URL) for preview
  slideCount?: number | null;  // Number of slides for presentations
}

/**
 * Stored link (external URL saved as file-like item)
 */
export interface StoredLink {
  id: string;
  userId: string;
  url: string;
  title: string;
  linkType: LinkType;
  icon: string;
  color: string;
  bgColor: string;
  domain: string;
  createdAt: string;
  folderId?: string | null;  // Folder where link is stored (null = root)
  description?: string;       // Optional description
  thumbnailUrl?: string;      // Optional thumbnail (e.g., for YouTube)
  extractedText?: string | null;  // Transcript/text extracted from link for AI processing
}

/**
 * Storage usage information
 */
export interface StorageUsage {
  used: number;       // bytes used
  total: number;      // total bytes allowed
  percentage: number; // percentage used (0-100)
  fileCount: number;  // number of files
}

/**
 * Upload result
 */
export interface UploadResult {
  success: boolean;
  file?: StoredFile;
  error?: string;
}

/**
 * Storage limits
 */
export const STORAGE_LIMITS = {
  MAX_TOTAL_BYTES: 300 * 1024 * 1024,      // 300 MB per user
  MAX_FILE_BYTES: 30 * 1024 * 1024,         // 30 MB per file
  STORAGE_BUCKET: 'teacher-files',
} as const;

/**
 * Allowed file types
 */
export const ALLOWED_FILE_TYPES = {
  // Documents
  'application/pdf': { extension: 'pdf', label: 'PDF', icon: 'file-text' },
  'application/msword': { extension: 'doc', label: 'Word', icon: 'file-text' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { extension: 'docx', label: 'Word', icon: 'file-text' },
  'application/vnd.ms-excel': { extension: 'xls', label: 'Excel', icon: 'table' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { extension: 'xlsx', label: 'Excel', icon: 'table' },
  'application/vnd.ms-powerpoint': { extension: 'ppt', label: 'PowerPoint', icon: 'presentation' },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { extension: 'pptx', label: 'PowerPoint', icon: 'presentation' },
  
  // Images
  'image/jpeg': { extension: 'jpg', label: 'Obrázek', icon: 'image' },
  'image/png': { extension: 'png', label: 'Obrázek', icon: 'image' },
  'image/gif': { extension: 'gif', label: 'GIF', icon: 'image' },
  'image/webp': { extension: 'webp', label: 'Obrázek', icon: 'image' },
  'image/svg+xml': { extension: 'svg', label: 'SVG', icon: 'image' },
  
  // Videos
  'video/mp4': { extension: 'mp4', label: 'Video', icon: 'video' },
  'video/webm': { extension: 'webm', label: 'Video', icon: 'video' },
  'video/quicktime': { extension: 'mov', label: 'Video', icon: 'video' },
  
  // Audio
  'audio/mpeg': { extension: 'mp3', label: 'Audio', icon: 'music' },
  'audio/wav': { extension: 'wav', label: 'Audio', icon: 'music' },
  
  // Archives
  'application/zip': { extension: 'zip', label: 'Archiv', icon: 'archive' },
  'application/x-rar-compressed': { extension: 'rar', label: 'Archiv', icon: 'archive' },
} as const;

export type AllowedMimeType = keyof typeof ALLOWED_FILE_TYPES;

/**
 * Check if a file type is allowed
 */
export function isAllowedFileType(mimeType: string): mimeType is AllowedMimeType {
  return mimeType in ALLOWED_FILE_TYPES;
}

/**
 * Get file type info
 */
export function getFileTypeInfo(mimeType: string) {
  if (isAllowedFileType(mimeType)) {
    return ALLOWED_FILE_TYPES[mimeType];
  }
  return { extension: 'file', label: 'Soubor', icon: 'file' };
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
}

