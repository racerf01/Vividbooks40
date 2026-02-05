/**
 * WorkbookSpread - Dvojstránka pracovního sešitu
 * 
 * Zobrazuje dvě stránky vedle sebe jako v otevřené knize.
 * Podporuje cover spread a běžné dvojstránky.
 */

import { memo } from 'react';
import { Trash2, Copy, Plus, ChevronRight } from 'lucide-react';
import { WorkbookSpread as SpreadType, WorkbookPage, WorkbookChapter, getChapterColor } from '../../types/workbook';
import { Worksheet } from '../../types/worksheet';
import { WorksheetThumbnail } from './WorksheetThumbnail';

interface PageCardProps {
  page: WorkbookPage | null;
  worksheet: Worksheet | null;
  position: 'left' | 'right';
  chapters: WorkbookChapter[];
  isHovered: boolean;
  isSelected: boolean;
  showChapterColors: boolean;
  onClick: () => void;
  onRemove: () => void;
  onCopy: () => void;
}

/**
 * Karta jedné stránky v dvojstránce
 */
const PageCard = memo(function PageCard({
  page,
  worksheet,
  position,
  chapters,
  isHovered,
  isSelected,
  showChapterColors,
  onClick,
  onRemove,
  onCopy,
}: PageCardProps) {
  if (!page) {
    return (
      <div className="w-[130px] h-full flex items-center justify-center bg-slate-100/50 text-slate-400">
        <Plus className="w-6 h-6" />
      </div>
    );
  }
  
  // Barva kapitoly
  const chapterColor = page.chapterId && showChapterColors
    ? getChapterColor(page.chapterId, chapters)
    : null;
  
  return (
    <div
      onClick={onClick}
      className={`
        relative w-[130px] h-full p-1.5 transition-all cursor-pointer group
        ${position === 'left' ? 'rounded-l-lg' : 'rounded-r-lg'}
        ${isHovered ? 'ring-2 ring-emerald-400 shadow-lg shadow-emerald-500/20' : ''}
        ${isSelected ? 'ring-2 ring-blue-500 shadow-lg shadow-blue-500/30' : ''}
        hover:shadow-lg
      `}
      style={{
        backgroundColor: chapterColor ? `${chapterColor}15` : 'white',
      }}
    >
      {/* Action buttons */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-20 flex gap-1">
        <button
          onClick={(e) => { e.stopPropagation(); onCopy(); }}
          className="p-1.5 bg-white rounded-full shadow-sm hover:bg-gray-50 border border-slate-200"
          title="Kopírovat stránku"
        >
          <Copy className="w-3 h-3 text-blue-600" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="p-1.5 bg-white rounded-full shadow-sm hover:bg-red-50 border border-slate-200"
          title="Odstranit stránku"
        >
          <Trash2 className="w-3 h-3 text-red-600" />
        </button>
      </div>
      
      {/* Thumbnail */}
      <div
        className={`
          aspect-[1/1.414] bg-white mb-1.5 mt-1 overflow-hidden shadow-sm
          ${position === 'left' ? 'rounded-tl rounded-bl' : 'rounded-tr rounded-br'}
        `}
      >
        <WorksheetThumbnail
          worksheet={worksheet}
          pageIndex={page.worksheetPageIndex}
        />
      </div>
      
      {/* Page info */}
      <div className="flex items-center gap-1.5 px-0.5 h-[20px] text-slate-600">
        <span className="font-medium text-xs">{page.pageNumber}</span>
        {page.chapterTitle && (
          <>
            <span className="text-slate-300">·</span>
            <p className="text-[10px] truncate flex-1 opacity-70">
              {page.chapterTitle}
            </p>
          </>
        )}
      </div>
      
      {/* Chapter color indicator */}
      {chapterColor && showChapterColors && (
        <div
          className="absolute bottom-0 left-0 right-0 h-1 rounded-b-lg"
          style={{ backgroundColor: chapterColor }}
        />
      )}
    </div>
  );
});

interface CoverCardProps {
  title: string;
  coverImage?: string;
  onClick: () => void;
}

/**
 * Karta obálky
 */
const CoverCard = memo(function CoverCard({ title, coverImage, onClick }: CoverCardProps) {
  return (
    <div
      onClick={onClick}
      className="w-[130px] h-full bg-gradient-to-br from-emerald-500 to-emerald-700 p-4 text-white flex flex-col justify-between cursor-pointer hover:from-emerald-400 hover:to-emerald-600 transition-all rounded-l-lg group"
    >
      <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">
        Obálka
      </span>
      <div className="flex-1 flex items-center justify-center">
        {coverImage ? (
          <img src={coverImage} alt="Cover" className="max-w-full max-h-full object-contain rounded" />
        ) : (
          <div className="text-5xl opacity-30">📖</div>
        )}
      </div>
      <h2 className="text-sm font-bold line-clamp-3 mt-2">
        {title}
      </h2>
      
      {/* Edit indicator */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-l-lg">
        <span className="text-white text-xs font-medium">Upravit obálku</span>
      </div>
    </div>
  );
});

interface WorkbookSpreadProps {
  spread: SpreadType;
  worksheets: { [id: string]: Worksheet };
  chapters: WorkbookChapter[];
  workbookTitle: string;
  coverImage?: string;
  showChapterColors: boolean;
  hoveredChapterId: string | null;
  selectedPageId: string | null;
  onHoverChapter: (chapterId: string | null) => void;
  onSelectPage: (pageId: string) => void;
  onEditPage: (pageId: string, worksheetId: string) => void;
  onRemovePage: (pageId: string) => void;
  onCopyPage: (pageId: string) => void;
  onEditCover: () => void;
}

/**
 * Kompletní dvojstránka
 */
export const WorkbookSpread = memo(function WorkbookSpread({
  spread,
  worksheets,
  chapters,
  workbookTitle,
  coverImage,
  showChapterColors,
  hoveredChapterId,
  selectedPageId,
  onHoverChapter,
  onSelectPage,
  onEditPage,
  onRemovePage,
  onCopyPage,
  onEditCover,
}: WorkbookSpreadProps) {
  const getWorksheet = (page: WorkbookPage | null) => {
    if (!page) return null;
    return worksheets[page.worksheetId] || null;
  };
  
  const isPageHovered = (page: WorkbookPage | null) => {
    if (!page || !hoveredChapterId) return false;
    return page.chapterId === hoveredChapterId;
  };
  
  return (
    <div
      className="flex justify-center"
      onMouseEnter={() => {
        const chapterId = spread.leftPage?.chapterId || spread.rightPage?.chapterId;
        if (chapterId) onHoverChapter(chapterId);
      }}
      onMouseLeave={() => onHoverChapter(null)}
    >
      <div
        className={`
          flex rounded-lg overflow-hidden transition-all
          ${spread.isCoverSpread ? 'shadow-xl' : 'shadow-lg hover:shadow-xl'}
          bg-white
        `}
        style={{ height: '220px' }}
      >
        {/* Left page */}
        {spread.isCoverSpread ? (
          <CoverCard
            title={workbookTitle}
            coverImage={coverImage}
            onClick={onEditCover}
          />
        ) : (
          <PageCard
            page={spread.leftPage}
            worksheet={getWorksheet(spread.leftPage)}
            position="left"
            chapters={chapters}
            isHovered={isPageHovered(spread.leftPage)}
            isSelected={spread.leftPage?.id === selectedPageId}
            showChapterColors={showChapterColors}
            onClick={() => {
              if (spread.leftPage) {
                onSelectPage(spread.leftPage.id);
                onEditPage(spread.leftPage.id, spread.leftPage.worksheetId);
              }
            }}
            onRemove={() => spread.leftPage && onRemovePage(spread.leftPage.id)}
            onCopy={() => spread.leftPage && onCopyPage(spread.leftPage.id)}
          />
        )}
        
        {/* Spine (hřbet) */}
        <div className={`w-1 ${spread.isCoverSpread ? 'bg-black/20' : 'bg-slate-100'} shadow-inner`} />
        
        {/* Right page */}
        <PageCard
          page={spread.rightPage}
          worksheet={getWorksheet(spread.rightPage)}
          position="right"
          chapters={chapters}
          isHovered={isPageHovered(spread.rightPage)}
          isSelected={spread.rightPage?.id === selectedPageId}
          showChapterColors={showChapterColors}
          onClick={() => {
            if (spread.rightPage) {
              onSelectPage(spread.rightPage.id);
              onEditPage(spread.rightPage.id, spread.rightPage.worksheetId);
            }
          }}
          onRemove={() => spread.rightPage && onRemovePage(spread.rightPage.id)}
          onCopy={() => spread.rightPage && onCopyPage(spread.rightPage.id)}
        />
      </div>
      
      {/* Spread index label */}
      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-slate-400 font-medium">
        {spread.isCoverSpread ? 'Titulní strana' : `Stránky ${(spread.index - 1) * 2 + 2}–${(spread.index - 1) * 2 + 3}`}
      </div>
    </div>
  );
});
