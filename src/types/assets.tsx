/**
 * Vividbooks Assets Types
 * 
 * Typy pro systém médií Vividbooks
 */

// Typ assetu
export type AssetType = 'animation' | 'image' | 'sticker' | 'symbol';

// Licenční tier
export type LicenseTier = 'basic' | 'premium' | 'enterprise';

// Vividbooks asset z databáze
export interface VividbooksAsset {
  id: string;
  name: string;
  description?: string;
  assetType: AssetType;
  fileUrl: string;
  thumbnailUrl?: string;
  mimeType?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  durationMs?: number;
  category?: string;
  subcategory?: string;
  tags: string[];
  aiDescription?: string;
  licenseRequired: boolean;
  licenseTier: LicenseTier;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  usageCount: number;
}

// Kategorie assetů
export interface AssetCategory {
  id: string;
  name: string;
  label: string;
  icon?: string;
  color?: string;
  parentId?: string;
  position: number;
}

// Záznam o použití assetu
export interface AssetUsage {
  id: string;
  assetId: string;
  userId: string;
  schoolId?: string;
  contentType: 'board' | 'worksheet' | 'document';
  contentId: string;
  createdAt: string;
}

// Výsledek výběru z AssetPickeru
export interface AssetPickerResult {
  type: 'upload' | 'library' | 'giphy' | 'google' | 'vividbooks';
  url: string;
  thumbnailUrl?: string;
  name?: string;
  mimeType?: string;
  assetId?: string; // Pro Vividbooks assets
  assetType?: AssetType;
  width?: number;
  height?: number;
}

// Konfigurace AssetPickeru
export interface AssetPickerConfig {
  // Které taby zobrazit
  showUpload?: boolean;
  showLibrary?: boolean;
  showGiphy?: boolean;
  showGoogle?: boolean;
  showVividbooks?: boolean;
  
  // Omezení typů
  allowedTypes?: ('image' | 'animation' | 'gif' | 'sticker' | 'symbol')[];
  
  // Omezení velikosti (v bytes)
  maxFileSize?: number;
  
  // Povolené MIME typy
  allowedMimeTypes?: string[];
  
  // Výchozí tab
  defaultTab?: AssetPickerTab;
  
  // Callback po výběru
  onSelect?: (result: AssetPickerResult) => void;
  
  // Callback po zavření
  onClose?: () => void;
}

// Tab v AssetPickeru
export type AssetPickerTab = 'upload' | 'library' | 'giphy' | 'google' | 'vividbooks';

// Filter pro Vividbooks assets
export interface VividbooksAssetFilter {
  search?: string;
  assetType?: AssetType | 'all';
  category?: string;
  tags?: string[];
  licenseTier?: LicenseTier;
}

// Giphy GIF
export interface GiphyGif {
  id: string;
  title: string;
  url: string;
  images: {
    fixed_height: {
      url: string;
      width: string;
      height: string;
    };
    fixed_width: {
      url: string;
      width: string;
      height: string;
    };
    original: {
      url: string;
      width: string;
      height: string;
    };
    preview_gif: {
      url: string;
    };
  };
}

// Stav storage uživatele
export interface UserStorageState {
  usedBytes: number;
  totalBytes: number;
  usedPercentage: number;
  fileCount: number;
}

// Soubor v uživatelské knihovně
export interface UserLibraryFile {
  id: string;
  userId: string;
  fileName: string;
  fileUrl: string;
  thumbnailUrl?: string;
  mimeType: string;
  fileSize: number;
  width?: number;
  height?: number;
  createdAt: string;
  folderId?: string;
}

export default {
  // Export prázdný objekt pro default export
};




