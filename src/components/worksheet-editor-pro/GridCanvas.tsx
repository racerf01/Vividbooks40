/**
 * GridCanvas - Grid layout pro PRO worksheet editor
 * 
 * Bloky jsou v lineárním pořadí (flow) s možností:
 * - Změna gridSpan pomocí bobánků (levý/pravý)
 * - Změna marginBottom pomocí spodního bobánku
 * - Stejný vzhled papíru jako FreeformCanvas
 * - Ideální pro AI generování (jednoduchý JSON output)
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { WorksheetBlock, BlockType, GlobalFontSize, GridColumns } from '../../types/worksheet';
import { Plus, Sparkles, Type, ImageIcon, Info, CheckSquare, PenLine, MessageSquare, PlusCircle, QrCode, Scissors, Palette } from 'lucide-react';
import { EditableBlock } from '../worksheet-editor/EditableBlock';

// Page dimensions at 96dpi
const MM_TO_PX = 96 / 25.4;
const PAGE_DIMENSIONS = {
  a4: { width: Math.round(210 * MM_TO_PX), height: Math.round(297 * MM_TO_PX) }, // 794 x 1123
  b5: { width: Math.round(176 * MM_TO_PX), height: Math.round(250 * MM_TO_PX) },
  a5: { width: Math.round(148 * MM_TO_PX), height: Math.round(210 * MM_TO_PX) },
};

const PADDING = 24;
const HEADER_HEIGHT = 60;
const FOOTER_HEIGHT = 40;

type PageFormat = 'a4' | 'b5' | 'a5';

interface GridCanvasProps {
  blocks: WorksheetBlock[];
  selectedBlockId: string | null;
  hoveredBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  onHoverBlock?: (id: string | null) => void;
  onUpdateBlock: (id: string, content: any) => void;
  onUpdateBlockMargin: (id: string, margin: number) => void;
  onUpdateBlockGridSpan?: (id: string, gridSpan: number, gridStart: number) => void;
  onDeleteBlock?: (id: string) => void;
  onDuplicateBlock?: (id: string) => void;
  onMoveBlockUp?: (id: string) => void;
  onMoveBlockDown?: (id: string) => void;
  onAddBlock: (type: BlockType) => void;
  onSwitchToAI: () => void;
  onOpenAddPanel: () => void;
  onOpenAI?: () => void;
  globalFontSize?: GlobalFontSize;
  pageFormat?: PageFormat;
  gridColumns?: GridColumns;
  gridGapPx?: number;
  showGridOverlay?: boolean;
  pendingInsertType?: BlockType | null;
  onInsertBefore?: (targetBlockId: string) => void;
  // Drag and drop from add panel
  isDraggingFromPanel?: boolean;
  onDropBlock?: (type: BlockType, insertBeforeId: string | null) => void;
  // Page styling
  pageBackgroundColor?: string;
}

// Drop Zone component for drag and drop from panel
function DropZone({ 
  zoneId, 
  isActive, 
  onDragEnter, 
  onDragLeave, 
  onDrop,
  gridColumns,
}: { 
  zoneId: string;
  isActive: boolean; 
  onDragEnter: () => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  gridColumns: number;
}) {
  return (
    <div
      style={{
        gridColumn: '1 / -1',
        height: isActive ? '48px' : '16px',
        position: 'relative',
        transition: 'height 0.15s ease',
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        onDragEnter();
      }}
      onDragLeave={(e) => {
        // Only trigger if actually leaving the element
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          onDragLeave();
        }
      }}
      onDrop={onDrop}
    >
      {isActive && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            right: 0,
            height: '4px',
            backgroundColor: '#3B82F6',
            borderRadius: '2px',
            transform: 'translateY(-50%)',
            boxShadow: '0 0 12px rgba(59, 130, 246, 0.6)',
          }}
        >
          {/* Plus indicator in the middle */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: '24px',
              height: '24px',
              backgroundColor: '#3B82F6',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(59, 130, 246, 0.5)',
            }}
          >
            <Plus size={14} color="white" />
          </div>
        </div>
      )}
    </div>
  );
}

// Grid overlay component
function GridOverlay({ 
  columns, 
  gap, 
  pageWidth,
  headerHeight,
  footerHeight,
}: { 
  columns: number; 
  gap: number;
  pageWidth: number;
  headerHeight: number;
  footerHeight: number;
}) {
  const contentWidth = pageWidth - (PADDING * 2);

  return (
    <div 
      className="absolute pointer-events-none print:hidden"
      style={{
        top: headerHeight,
        left: PADDING,
        right: PADDING,
        bottom: footerHeight,
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: `${gap}px`,
      }}
    >
      {Array.from({ length: columns }).map((_, i) => (
        <div 
          key={i}
          style={{
            backgroundColor: 'rgba(99, 102, 241, 0.08)',
            border: '1px dashed rgba(99, 102, 241, 0.3)',
            borderRadius: '4px',
          }}
        />
      ))}
    </div>
  );
}

// Quick add bar
function QuickAddBar({ 
  onAddBlock, 
  onSwitchToAI, 
  onOpenAddPanel 
}: { 
  onAddBlock: (type: BlockType) => void;
  onSwitchToAI: () => void;
  onOpenAddPanel: () => void;
}) {
  const Item = ({ 
    icon: Icon, 
    label, 
    onClick, 
    variant = 'default' 
  }: { 
    icon: any; 
    label: string; 
    onClick: () => void;
    variant?: 'default' | 'ai' | 'more';
  }) => (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex flex-col items-center justify-start gap-1.5 group transition-all shrink-0 py-2 px-2.5"
    >
      <div className="w-10 h-10 flex items-center justify-center">
        <Icon 
          size={27} 
          strokeWidth={1.5} 
          className={`transition-colors ${
            variant === 'ai' ? 'text-blue-500 group-hover:text-blue-600' : 
            variant === 'more' ? 'text-slate-500 group-hover:text-slate-600' : 
            'text-slate-400 group-hover:text-slate-500'
          }`}
        />
      </div>
      <span className={`font-normal text-center leading-tight transition-colors ${
        variant === 'ai' ? 'text-blue-500 group-hover:text-blue-600' : 'text-slate-400 group-hover:text-slate-500'
      }`} style={{ fontSize: '13px' }}>
        {label}
      </span>
    </button>
  );

  const Divider = () => <div className="w-px h-9 bg-slate-200 self-center" />;

  return (
    <div 
      className="bg-slate-50 rounded-xl py-2 px-3 print:hidden"
      data-print-hide="true"
    >
      <div className="text-[8px] font-medium text-slate-400 mb-1.5 px-1">Přidat:</div>
      <div className="flex items-center justify-center gap-1">
        <Item icon={Sparkles} label="Podle AI" onClick={onSwitchToAI} variant="ai" />
        <Divider />
        <Item icon={Type} label="Odstavec" onClick={() => onAddBlock('paragraph')} />
        <Item icon={ImageIcon} label="Obrázek" onClick={() => onAddBlock('image')} />
        <Item icon={Info} label="Infobox" onClick={() => onAddBlock('infobox')} />
        <Item icon={QrCode} label="QR kód" onClick={() => onAddBlock('qr-code')} />
        <Divider />
        <Item icon={CheckSquare} label="Výběr" onClick={() => onAddBlock('multiple-choice')} />
        <Item icon={PenLine} label="Doplnění" onClick={() => onAddBlock('fill-blank')} />
        <Item icon={MessageSquare} label="Volná" onClick={() => onAddBlock('free-answer')} />
        <Item icon={Palette} label="Plátno" onClick={() => onAddBlock('free-canvas')} />
        <Divider />
        <Item icon={PlusCircle} label="Více" onClick={onOpenAddPanel} variant="more" />
      </div>
    </div>
  );
}

// Page break indicator
function PageBreak({ pageNumber }: { pageNumber: number }) {
  return (
    <div 
      className="w-full py-6 relative flex items-center justify-center print:hidden"
      data-print-hide="true"
    >
      <div className="absolute inset-x-0 top-1/2 border-t-2 border-dashed border-slate-300" />
      <div className="relative flex items-center gap-2 px-4 bg-slate-300">
        <Scissors className="h-4 w-4 text-slate-400 rotate-90" />
        <span className="text-xs font-medium text-slate-500">
          Konec strany {pageNumber}
        </span>
        <Scissors className="h-4 w-4 text-slate-400 -rotate-90" />
      </div>
    </div>
  );
}

export function GridCanvas({
  blocks,
  selectedBlockId,
  hoveredBlockId,
  onSelectBlock,
  onHoverBlock,
  onUpdateBlock,
  onUpdateBlockMargin,
  onUpdateBlockGridSpan,
  onDeleteBlock,
  onDuplicateBlock,
  onMoveBlockUp,
  onMoveBlockDown,
  onAddBlock,
  onSwitchToAI,
  onOpenAddPanel,
  onOpenAI,
  globalFontSize = 'normal',
  pageFormat = 'a4',
  gridColumns = 12,
  gridGapPx = 16,
  showGridOverlay = false,
  pendingInsertType,
  onInsertBefore,
  isDraggingFromPanel,
  onDropBlock,
  pageBackgroundColor,
}: GridCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [blockHeights, setBlockHeights] = useState<Record<string, number>>({});
  const [dropZoneActive, setDropZoneActive] = useState<string | null>(null); // 'before-{blockId}' or 'end'

  // Page dimensions
  const pageWidth = PAGE_DIMENSIONS[pageFormat]?.width || PAGE_DIMENSIONS.a4.width;
  const pageHeight = PAGE_DIMENSIONS[pageFormat]?.height || PAGE_DIMENSIONS.a4.height;
  const contentWidth = pageWidth - PADDING * 2;
  const contentHeight = pageHeight - HEADER_HEIGHT - FOOTER_HEIGHT;
  const columnWidth = (contentWidth - (gridColumns - 1) * gridGapPx) / gridColumns;

  // Resize state for bobánky
  const [resizeState, setResizeState] = useState<{
    blockId: string;
    type: 'right' | 'bottom';
    startX: number;
    startY: number;
    startGridSpan: number;
    startMarginBottom: number;
  } | null>(null);

  // Activity numbers
  const activityNumbers = useMemo(() => {
    const numbers: Record<string, number> = {};
    let counter = 1;
    blocks.forEach((block) => {
      if (['multiple-choice', 'fill-blank', 'free-answer', 'matching', 'ordering', 'free-canvas'].includes(block.type)) {
        numbers[block.id] = counter++;
      }
    });
    return numbers;
  }, [blocks]);

  // Calculate pages based on block heights
  const pagesData = useMemo(() => {
    const pages: { blocks: WorksheetBlock[]; pageNumber: number }[] = [];
    let currentPage: WorksheetBlock[] = [];
    let currentHeight = 0;
    let pageNumber = 1;

    let currentRowSpan = 0;
    let maxRowHeight = 0;

    blocks.forEach((block) => {
      const blockHeight = (blockHeights[block.id] || 100) + (block.marginBottom || 0);
      const blockGridSpan = block.gridSpan || gridColumns;
      
      // If block doesn't fit in current row, add the row height to total and start new row
      if (currentRowSpan + blockGridSpan > gridColumns) {
        currentHeight += maxRowHeight + gridGapPx;
        currentRowSpan = 0;
        maxRowHeight = 0;
      }

      // Check for page break
      if (currentHeight + blockHeight > contentHeight && currentPage.length > 0) {
        pages.push({ blocks: currentPage, pageNumber });
        currentPage = [];
        currentHeight = 0;
        pageNumber++;
        currentRowSpan = 0;
        maxRowHeight = 0;
      }

      currentPage.push(block);
      currentRowSpan += blockGridSpan;
      maxRowHeight = Math.max(maxRowHeight, blockHeight);
    });

    // Add final row height
    currentHeight += maxRowHeight;

    if (currentPage.length > 0 || blocks.length === 0) {
      pages.push({ blocks: currentPage, pageNumber });
    }

    return pages;
  }, [blocks, blockHeights, contentHeight]);

  // Measure block heights
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      const newHeights: Record<string, number> = {};
      entries.forEach((entry) => {
        const blockId = (entry.target as HTMLElement).dataset.blockId;
        if (blockId) {
          newHeights[blockId] = entry.contentRect.height;
        }
      });
      setBlockHeights((prev) => ({ ...prev, ...newHeights }));
    });

    const blockElements = containerRef.current.querySelectorAll('[data-block-id]');
    blockElements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [blocks]);

  // Handle resize drag
  useEffect(() => {
    if (!resizeState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeState.startX;
      const deltaY = e.clientY - resizeState.startY;

      if (resizeState.type === 'right' && onUpdateBlockGridSpan) {
        // Resize from right - change span only
        const columnsDelta = Math.round(deltaX / (columnWidth + gridGapPx));
        const newSpan = Math.max(1, Math.min(gridColumns, resizeState.startGridSpan + columnsDelta));
        onUpdateBlockGridSpan(resizeState.blockId, newSpan, 1); // gridStart is always 1 (auto-flow)
      } else if (resizeState.type === 'bottom') {
        // Change margin bottom
        const newMargin = Math.max(0, Math.min(300, resizeState.startMarginBottom + deltaY));
        onUpdateBlockMargin(resizeState.blockId, newMargin);
      }
    };

    const handleMouseUp = () => {
      setResizeState(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizeState, columnWidth, gridGapPx, gridColumns, onUpdateBlockGridSpan, onUpdateBlockMargin]);

  // Start resize
  const startResize = useCallback((
    e: React.MouseEvent,
    blockId: string,
    type: 'right' | 'bottom',
    block: WorksheetBlock
  ) => {
    e.preventDefault();
    e.stopPropagation();
    
    setResizeState({
      blockId,
      type,
      startX: e.clientX,
      startY: e.clientY,
      startGridSpan: block.gridSpan || gridColumns,
      startMarginBottom: block.marginBottom || 0,
    });
    
    onSelectBlock(blockId);
  }, [gridColumns, onSelectBlock]);

  // Render block with bobánky
  const renderBlock = (block: WorksheetBlock) => {
    const isSelected = selectedBlockId === block.id;
    const isHovered = hoveredBlockId === block.id;
    const blockGridSpan = block.gridSpan || gridColumns;
    
    // Can resize?
    const canShrinkRight = blockGridSpan > 1; // Can shrink from right if span > 1
    const canGrowRight = blockGridSpan < gridColumns; // Can grow if not at full width

    return (
      <div 
        key={block.id}
        className="relative"
        style={{ 
          // Use CSS Grid auto-flow - just specify span, let grid auto-place
          gridColumn: `span ${blockGridSpan}`,
          alignSelf: 'start', // Don't stretch to fill row height
        }}
        data-block-id={block.id}
        onMouseEnter={() => onHoverBlock?.(block.id)}
        onMouseLeave={() => onHoverBlock?.(null)}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Block content */}
        <EditableBlock
          block={block}
          isSelected={isSelected}
          isHovered={isHovered}
          onSelect={() => onSelectBlock(block.id)}
          onUpdate={(content) => onUpdateBlock(block.id, { content })}
          onUpdateMargin={(margin) => onUpdateBlockMargin(block.id, margin)}
          onDelete={onDeleteBlock ? () => onDeleteBlock(block.id) : undefined}
          onDuplicate={onDuplicateBlock ? () => onDuplicateBlock(block.id) : undefined}
          onMoveUp={onMoveBlockUp ? () => onMoveBlockUp(block.id) : undefined}
          onMoveDown={onMoveBlockDown ? () => onMoveBlockDown(block.id) : undefined}
          globalFontSize={globalFontSize}
          activityNumber={activityNumbers[block.id]}
          onOpenAI={onOpenAI}
          hideTextToolbar={true}
        />

        {/* Selection border and bobánky */}
        {(isSelected || isHovered) && (
          <>
            {/* Blue selection border */}
            <div
              className="absolute inset-0 pointer-events-none print:hidden"
              style={{
                border: isSelected ? '2px solid #3B82F6' : '2px dashed #93C5FD',
                borderRadius: '6px',
                zIndex: 90,
              }}
            />

            {/* Right bobánek - resize width */}
            {isSelected && (canShrinkRight || canGrowRight) && (
              <div
                onMouseDown={(e) => startResize(e, block.id, 'right', block)}
                className="absolute print:hidden transition-all hover:scale-105 active:scale-95 select-none cursor-ew-resize"
                style={{
                  right: '-12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '20px',
                  height: '56px',
                  backgroundColor: resizeState?.blockId === block.id && resizeState?.type === 'right' ? '#1D4ED8' : '#3B82F6',
                  borderRadius: '10px',
                  border: '2px solid white',
                  boxShadow: '0 2px 8px rgba(59, 130, 246, 0.4)',
                  zIndex: 10001,
                }}
                title={`Táhni pro změnu velikosti (${blockGridSpan}/${gridColumns} sloupců)`}
              />
            )}

            {/* Bottom bobánek - add margin */}
            {isSelected && (
              <div
                onMouseDown={(e) => startResize(e, block.id, 'bottom', block)}
                className="absolute print:hidden transition-all hover:scale-105 active:scale-95 select-none cursor-ns-resize"
                style={{
                  bottom: '-14px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '56px',
                  height: '20px',
                  backgroundColor: resizeState?.blockId === block.id && resizeState?.type === 'bottom' ? '#1D4ED8' : '#3B82F6',
                  borderRadius: '10px',
                  border: '2px solid white',
                  boxShadow: '0 2px 8px rgba(59, 130, 246, 0.4)',
                  zIndex: 10001,
                }}
                title="Táhni dolů pro přidání mezery"
              />
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div 
      ref={containerRef}
      className="worksheet-pages-row pages-row"
      style={{ 
        width: `${pageWidth}px`, 
        marginLeft: 'auto', 
        marginRight: 'auto',
      }}
    >
      {/* Render pages */}
      {pagesData.map((page, pageIndex) => (
        <React.Fragment key={pageIndex}>
          <div
            className="relative shadow-xl rounded-sm print:shadow-none print:rounded-none worksheet-a4-page a4-page"
            style={{
              width: `${pageWidth}px`,
              minHeight: `${pageHeight}px`,
              marginBottom: 0,
              boxShadow: '0 10px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
              backgroundColor: pageBackgroundColor || '#FFFFFF',
            }}
            onClick={() => onSelectBlock(null)}
          >
            {/* Grid overlay */}
            {showGridOverlay && (
              <GridOverlay
                columns={gridColumns}
                gap={gridGapPx}
                pageWidth={pageWidth}
                headerHeight={HEADER_HEIGHT}
                footerHeight={FOOTER_HEIGHT}
              />
            )}

            {/* Fixed header */}
            <div
              className="border-b border-dashed border-slate-200 print:border-slate-300"
              style={{ height: HEADER_HEIGHT, padding: PADDING, paddingTop: 12 }}
            >
              <div className="flex justify-between items-end h-full text-sm text-slate-500">
                <div className="flex-1">
                  <span>Jméno a příjmení:</span>
                  <div className="border-b border-slate-400 mt-1" style={{ width: '80%' }} />
                </div>
                <div className="flex-1 text-center">
                  <span>Třída:</span>
                  <div className="border-b border-slate-400 mt-1 mx-auto" style={{ width: '60%' }} />
                </div>
                <div className="flex-1 text-right">
                  <span>Známka:</span>
                  <div className="border-b border-slate-400 mt-1 ml-auto" style={{ width: '40%' }} />
                </div>
              </div>
            </div>

            {/* Content area - CSS Grid layout */}
            <div 
              style={{
                padding: PADDING,
                paddingTop: 16,
                paddingBottom: 16,
                minHeight: contentHeight,
                // CSS Grid for proper column layout
                display: 'grid',
                gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
                gap: `${gridGapPx}px`,
                alignItems: 'start', // Blocks align to top
                alignContent: 'start', // Rows align to top
              }}
            >
              {page.blocks.length === 0 && pageIndex === 0 ? (
                /* Empty state */
                <>
                  {/* Drop zone for empty page */}
                  {isDraggingFromPanel && (
                    <DropZone
                      zoneId="end"
                      isActive={dropZoneActive === 'end'}
                      onDragEnter={() => setDropZoneActive('end')}
                      onDragLeave={() => setDropZoneActive(null)}
                      onDrop={(e) => {
                        e.preventDefault();
                        const blockType = e.dataTransfer.getData('application/x-block-type') as BlockType;
                        if (blockType && onDropBlock) {
                          onDropBlock(blockType, null);
                        }
                        setDropZoneActive(null);
                      }}
                      gridColumns={gridColumns}
                    />
                  )}
                  <div 
                    className="h-full flex flex-col items-center justify-center text-center py-20"
                    style={{ gridColumn: '1 / -1' }} // Span all columns
                  >
                    <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-4">
                      <Sparkles className="h-8 w-8 text-blue-500" />
                    </div>
                    <h3 className="text-xl font-semibold text-slate-700 mb-2">
                      Začněte tvořit
                    </h3>
                    <p className="text-slate-500 max-w-sm mb-6">
                      Popište AI asistentovi, jaký pracovní list chcete vytvořit, nebo přidejte bloky ručně.
                    </p>
                  </div>
                </>
              ) : (
                /* Blocks - rendered in CSS Grid with drop zones */
                <>
                  {page.blocks.map((block, blockIndex) => (
                    <React.Fragment key={block.id}>
                      {/* Drop zone before this block */}
                      {isDraggingFromPanel && (
                        <DropZone
                          zoneId={`before-${block.id}`}
                          isActive={dropZoneActive === `before-${block.id}`}
                          onDragEnter={() => setDropZoneActive(`before-${block.id}`)}
                          onDragLeave={() => setDropZoneActive(null)}
                          onDrop={(e) => {
                            e.preventDefault();
                            const blockType = e.dataTransfer.getData('application/x-block-type') as BlockType;
                            if (blockType && onDropBlock) {
                              onDropBlock(blockType, block.id);
                            }
                            setDropZoneActive(null);
                          }}
                          gridColumns={gridColumns}
                        />
                      )}
                      {renderBlock(block)}
                    </React.Fragment>
                  ))}
                  {/* Drop zone at the end */}
                  {isDraggingFromPanel && (
                    <DropZone
                      zoneId="end"
                      isActive={dropZoneActive === 'end'}
                      onDragEnter={() => setDropZoneActive('end')}
                      onDragLeave={() => setDropZoneActive(null)}
                      onDrop={(e) => {
                        e.preventDefault();
                        const blockType = e.dataTransfer.getData('application/x-block-type') as BlockType;
                        if (blockType && onDropBlock) {
                          onDropBlock(blockType, null);
                        }
                        setDropZoneActive(null);
                      }}
                      gridColumns={gridColumns}
                    />
                  )}
                </>
              )}
            </div>

            {/* Fixed footer */}
            <div
              className="border-t border-dashed border-slate-200 print:border-slate-300 flex items-center justify-center"
              style={{ height: FOOTER_HEIGHT, padding: PADDING }}
            >
              <span className="text-xs text-slate-400">
                Strana {page.pageNumber}{pagesData.length > 1 ? ` / ${pagesData.length}` : ''}
              </span>
            </div>

            {/* Page number indicator (right side) */}
            <div 
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-slate-100 text-slate-500 px-2 py-1 rounded text-xs print:hidden"
            >
              {page.pageNumber}
            </div>
          </div>

          {/* Page break between pages */}
          {pageIndex < pagesData.length - 1 && (
            <PageBreak pageNumber={page.pageNumber} />
          )}

          {/* Quick add bar - after each page */}
          <div 
            className="print:hidden py-4 flex justify-center"
            style={{ width: `${pageWidth}px` }}
          >
            <QuickAddBar 
              onAddBlock={onAddBlock}
              onSwitchToAI={onSwitchToAI}
              onOpenAddPanel={onOpenAddPanel}
            />
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}
