import { useRef, useCallback } from 'react';
import { useDrag, useDrop, DropTargetMonitor } from 'react-dnd';
import { GripVertical, Trash2, ChevronDown, ChevronRight, Check } from 'lucide-react';

const ITEM_TYPES = {
  CHAPTER: 'CHAPTER',
  PAGE: 'PAGE',
};

interface PageInfo {
  id: string;
  pageNumber: number;
  worksheetId: string;
  worksheetTitle?: string;
}

interface ChapterItemProps {
  id: string;
  title: string;
  color: string;
  index: number;
  pages: PageInfo[];
  isExpanded: boolean;
  isHovered: boolean;
  selectedPages: Set<number>;
  moveChapter: (dragId: string, hoverId: string) => void;
  onDelete: (id: string) => void;
  onToggleExpand: () => void;
  onHover: (hovered: boolean) => void;
  onSelectChapterPages: (id: string) => void;
  onPageSelect: (pageNumber: number, multi: boolean) => void;
  onMovePage: (pageNumber: number, targetChapterId: string) => void;
}

interface ChapterDragItem {
  id: string;
  type: string;
  index: number;
}

interface PageDragItem {
  pageNumber: number;
  type: string;
}

export function ChapterItem({
  id,
  title,
  color,
  index,
  pages,
  isExpanded,
  isHovered,
  selectedPages,
  moveChapter,
  onDelete,
  onToggleExpand,
  onHover,
  onSelectChapterPages,
  onPageSelect,
  onMovePage,
}: ChapterItemProps) {
  const elementRef = useRef<HTMLDivElement>(null);

  // DRAG LOGIC - for dragging this chapter
  const [{ isDragging }, drag] = useDrag({
    type: ITEM_TYPES.CHAPTER,
    item: () => ({ id, type: ITEM_TYPES.CHAPTER, index }),
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  // DROP LOGIC - for reordering chapters (when another chapter is dropped on this one)
  const [{ isOver, canDrop }, drop] = useDrop<ChapterDragItem, void, { isOver: boolean; canDrop: boolean }>({
    accept: ITEM_TYPES.CHAPTER,
    canDrop: (item) => item.id !== id,
    drop(item: ChapterDragItem) {
      if (item.id !== id) {
        moveChapter(item.id, id);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  });

  // DROP LOGIC - for pages dropped into this chapter
  const [{ isPageOver }, pageDrop] = useDrop<PageDragItem, void, { isPageOver: boolean }>({
    accept: ITEM_TYPES.PAGE,
    drop(item) {
      onMovePage(item.pageNumber, id);
    },
    collect: (monitor) => ({
      isPageOver: monitor.isOver(),
    }),
  });

  // Combine all refs properly
  const combinedRef = useCallback((node: HTMLDivElement | null) => {
    elementRef.current = node;
    drag(node);
    drop(node);
    pageDrop(node);
  }, [drag, drop, pageDrop]);

  const showDropIndicator = isOver && canDrop;

  return (
    <div>
      {/* Drop indicator line above */}
      <div
        style={{
          height: showDropIndicator ? '4px' : '0px',
          backgroundColor: showDropIndicator ? '#3b82f6' : 'transparent',
          borderRadius: '2px',
          margin: showDropIndicator ? '4px 0' : '0',
          transition: 'all 0.15s ease',
        }}
      />
      
      {/* Chapter header */}
      <div
        ref={combinedRef}
        style={{
          opacity: isDragging ? 0.4 : 1,
          backgroundColor: isPageOver ? 'rgba(34, 197, 94, 0.15)' : undefined,
          border: isPageOver ? '2px dashed #22c55e' : '2px dashed transparent',
        }}
        className={`
          p-2 rounded-lg transition-colors cursor-grab active:cursor-grabbing
          ${isHovered ? 'bg-slate-700' : 'hover:bg-slate-700/50'}
        `}
        onMouseEnter={() => onHover(true)}
        onMouseLeave={() => onHover(false)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Grip icon */}
          <div className="text-slate-500 hover:text-slate-300">
            <GripVertical size={14} />
          </div>
          
          {/* Color dot */}
          <div
            style={{ 
              width: '10px', 
              height: '10px', 
              borderRadius: '50%',
              backgroundColor: color,
              flexShrink: 0,
            }}
          />
          
          {/* Title - clickable to select pages */}
          <div 
            style={{ flex: 1, minWidth: 0, color: 'white', cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              onSelectChapterPages(id);
            }}
          >
            <div style={{ 
              fontSize: '15px', 
              fontWeight: 500,
            }}>
              {title}
            </div>
          </div>
          
          {/* Expand/collapse button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className="p-1 hover:bg-slate-600 rounded transition-colors"
          >
            {isExpanded ? (
              <ChevronDown size={14} className="text-slate-400" />
            ) : (
              <ChevronRight size={14} className="text-slate-400" />
            )}
          </button>
          
          {/* Delete button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Opravdu smazat kapitolu "${title}"?`)) {
                onDelete(id);
              }
            }}
            style={{ 
              padding: '4px',
              opacity: isHovered ? 1 : 0,
              flexShrink: 0,
            }}
            className="hover:bg-red-500/20 rounded transition-opacity"
            title="Smazat kapitolu"
          >
            <Trash2 size={14} className="text-red-400" />
          </button>
        </div>
      </div>
      
      {/* Pages in chapter */}
      {isExpanded && (
        <div style={{ paddingLeft: '28px', marginTop: '4px', marginBottom: '8px' }}>
          {pages.map((page) => (
            <PageItem
              key={page.id}
              {...page}
              isSelected={selectedPages.has(page.pageNumber)}
              onSelect={onPageSelect}
              onMovePage={onMovePage}
              chapterId={id}
            />
          ))}
          {pages.length === 0 && (
            <div style={{ 
              fontSize: '13px', 
              color: '#475569',
              padding: '6px 8px',
              fontStyle: 'italic',
            }}>
              Žádné stránky
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Page item component
interface PageItemProps extends PageInfo {
  isSelected: boolean;
  chapterId: string;
  onSelect: (pageNumber: number, multi: boolean) => void;
  onMovePage: (pageNumber: number, targetChapterId: string) => void;
}

function PageItem({ pageNumber, worksheetTitle, isSelected, chapterId, onSelect, onMovePage }: PageItemProps) {
  const elementRef = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag] = useDrag({
    type: ITEM_TYPES.PAGE,
    item: () => ({ pageNumber, type: ITEM_TYPES.PAGE, chapterId }),
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  // Drop zone for reordering pages
  const [{ isOver }, drop] = useDrop<PageDragItem, void, { isOver: boolean }>({
    accept: ITEM_TYPES.PAGE,
    drop(item) {
      // Přesunout stránku na tuto pozici
      if (item.pageNumber !== pageNumber) {
        // Pro teď jen přesuneme do stejné kapitoly
        onMovePage(item.pageNumber, chapterId);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  // Combine refs
  const combinedRef = useCallback((node: HTMLDivElement | null) => {
    elementRef.current = node;
    drag(node);
    drop(node);
  }, [drag, drop]);

  return (
    <div
      ref={combinedRef}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(pageNumber, e.ctrlKey || e.metaKey);
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '4px 8px',
        borderRadius: '4px',
        cursor: 'grab',
        opacity: isDragging ? 0.4 : 1,
        backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.2)' : isOver ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
        borderTop: isOver ? '2px solid #3b82f6' : '2px solid transparent',
        transition: 'all 0.15s',
      }}
      className="hover:bg-slate-700/50 active:cursor-grabbing"
    >
      <GripVertical size={12} className="text-slate-600" />
      <span style={{ 
        fontSize: '13px', 
        color: '#64748b',
        fontWeight: 600,
        width: '22px',
      }}>
        {pageNumber}
      </span>
      <span style={{ 
        fontSize: '13px', 
        color: isSelected ? '#93c5fd' : '#94a3b8',
        flex: 1,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {worksheetTitle || 'Prázdná stránka'}
      </span>
      {isSelected && (
        <Check size={12} style={{ color: '#3b82f6', flexShrink: 0 }} />
      )}
    </div>
  );
}

export { ITEM_TYPES };
