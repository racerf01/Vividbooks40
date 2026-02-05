/**
 * Workbook Types - Typy pro pracovní sešity
 * 
 * Pracovní sešit (Workbook) obsahuje více pracovních listů (Worksheets)
 * uspořádaných do stránek. Jeden pracovní list může zabírat více stránek.
 */

import { Worksheet } from './worksheet';

/**
 * Stránka v pracovním sešitě
 * Reprezentuje jednu fyzickou stránku v sešitě
 */
export interface WorkbookPage {
  id: string;
  pageNumber: number; // 1-indexed číslo stránky
  worksheetId: string; // ID pracovního listu na této stránce
  worksheetPageIndex: number; // Která stránka worksheetu (0-indexed, pro multi-page worksheets)
  startsChapterId?: string; // ID kapitoly, která ZAČÍNÁ na této stránce (ne které patří)
}

/**
 * Kapitola v pracovním sešitě
 */
export interface WorkbookChapter {
  id: string;
  title: string;
  color: string; // CSS barva pro vizuální odlišení
  order: number;
}

/**
 * Formát stránky pracovního sešitu
 */
export type PageFormat = 'a4' | 'b5' | 'a5';

/**
 * Rozměry stránek v mm
 */
export const PAGE_FORMAT_DIMENSIONS: Record<PageFormat, { width: number; height: number; label: string }> = {
  a4: { width: 210, height: 297, label: 'A4 (210 × 297 mm)' },
  b5: { width: 176, height: 250, label: 'B5 (176 × 250 mm)' },
  a5: { width: 148, height: 210, label: 'A5 (148 × 210 mm)' },
};

/**
 * Nastavení pracovního sešitu
 */
export interface WorkbookSettings {
  pageFormat: PageFormat;
  orientation: 'portrait' | 'landscape';
  margins: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  showPageNumbers: boolean;
  showChapterColors: boolean;
  pageLimit: number; // Maximální počet stránek
}

/**
 * Hlavní typ pracovního sešitu
 */
export interface Workbook {
  id: string;
  title: string;
  description: string;
  coverImage?: string; // URL obrázku obálky
  
  // Obsah
  pages: WorkbookPage[];
  chapters: WorkbookChapter[];
  worksheets: { [worksheetId: string]: Worksheet }; // Cache pracovních listů
  
  // Nastavení
  settings: WorkbookSettings;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  folderId?: string;
}

/**
 * Spread (dvojstránka) pro zobrazení
 */
export interface WorkbookSpread {
  index: number; // Index spreadu (0 = cover + page 1, 1 = page 2+3, etc.)
  leftPage: WorkbookPage | null;
  rightPage: WorkbookPage | null;
  isCoverSpread: boolean;
}

/**
 * Stav canvasu (pozice, zoom)
 */
export interface CanvasState {
  x: number;
  y: number;
  zoom: number;
}

/**
 * Výchozí nastavení pracovního sešitu
 */
export const DEFAULT_WORKBOOK_SETTINGS: WorkbookSettings = {
  pageFormat: 'a4',
  orientation: 'portrait',
  margins: { top: 20, bottom: 20, left: 20, right: 20 },
  showPageNumbers: true,
  showChapterColors: true,
  pageLimit: 64,
};

/**
 * Výchozí barvy pro kapitoly
 */
export const CHAPTER_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EC4899', // pink
  '#8B5CF6', // purple
  '#06B6D4', // cyan
  '#F97316', // orange
  '#6366F1', // indigo
];

/**
 * Vytvoří prázdný pracovní sešit
 */
export function createEmptyWorkbook(id: string): Workbook {
  return {
    id,
    title: 'Nový pracovní sešit',
    description: '',
    pages: [],
    chapters: [],
    worksheets: {},
    settings: { ...DEFAULT_WORKBOOK_SETTINGS },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Vytvoří spreads z pole stránek
 */
export function createSpreadsFromPages(pages: WorkbookPage[]): WorkbookSpread[] {
  const spreads: WorkbookSpread[] = [];
  
  if (pages.length === 0) {
    return spreads;
  }
  
  // První spread: Cover + Page 1
  spreads.push({
    index: 0,
    leftPage: null, // Cover je speciální
    rightPage: pages[0] || null,
    isCoverSpread: true,
  });
  
  // Ostatní spready: Page 2+3, 4+5, etc.
  for (let i = 1; i < pages.length; i += 2) {
    spreads.push({
      index: spreads.length,
      leftPage: pages[i] || null,
      rightPage: pages[i + 1] || null,
      isCoverSpread: false,
    });
  }
  
  return spreads;
}

/**
 * Získá barvu kapitoly
 */
export function getChapterColor(chapterId: string, chapters: WorkbookChapter[]): string {
  const chapter = chapters.find(c => c.id === chapterId);
  if (chapter) return chapter.color;
  
  // Fallback na index-based barvu
  const index = parseInt(chapterId.split('-')[1] || '0');
  return CHAPTER_COLORS[index % CHAPTER_COLORS.length];
}

/**
 * Získá kapitolu pro danou stránku.
 * Kapitola platí od stránky kde začíná až do další kapitoly.
 * 
 * @param pageNumber - číslo stránky (1-indexed)
 * @param pages - všechny stránky sešitu (seřazené podle pageNumber)
 * @param chapters - všechny kapitoly sešitu
 * @returns kapitola nebo null
 */
export function getChapterForPage(
  pageNumber: number,
  pages: WorkbookPage[],
  chapters: WorkbookChapter[]
): WorkbookChapter | null {
  // Najdi stránku s nejbližším startsChapterId <= pageNumber
  let currentChapterId: string | null = null;
  
  // Projdi stránky od začátku a najdi poslední kapitolu, která začala před/na této stránce
  const sortedPages = [...pages].sort((a, b) => a.pageNumber - b.pageNumber);
  
  for (const page of sortedPages) {
    if (page.pageNumber > pageNumber) break;
    if (page.startsChapterId) {
      currentChapterId = page.startsChapterId;
    }
  }
  
  if (!currentChapterId) return null;
  return chapters.find(c => c.id === currentChapterId) || null;
}

/**
 * Zjistí, jestli na dané stránce začíná nová kapitola
 */
export function doesPageStartChapter(
  pageNumber: number,
  pages: WorkbookPage[]
): boolean {
  const page = pages.find(p => p.pageNumber === pageNumber);
  return !!page?.startsChapterId;
}

/**
 * Vrátí ID kapitoly, která začíná na dané stránce (nebo null)
 */
export function getChapterStartingAtPage(
  pageNumber: number,
  pages: WorkbookPage[],
  chapters: WorkbookChapter[]
): WorkbookChapter | null {
  const page = pages.find(p => p.pageNumber === pageNumber);
  if (!page?.startsChapterId) return null;
  return chapters.find(c => c.id === page.startsChapterId) || null;
}
