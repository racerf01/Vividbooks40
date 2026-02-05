/**
 * FreeformCanvas - Grafický editor pro PRO worksheet editor
 * 
 * Bloky jsou absolutně pozicované na plátně s možností:
 * - Přetahování (drag) s přichytáváním na grid
 * - Změna velikosti (resize) pomocí bobánků
 * - Multi-page layout (A4 stránky)
 * - Červené zvýraznění bloků mimo stránku
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { WorksheetBlock, BlockType, GlobalFontSize } from '../../types/worksheet';
import { Plus, Sparkles, Type, ImageIcon, Info, CheckSquare, PenLine, MessageSquare, PlusCircle, QrCode, GripVertical, Palette } from 'lucide-react';
import { EditableBlock } from '../worksheet-editor/EditableBlock';

// Page dimensions at 96dpi
const MM_TO_PX = 96 / 25.4;
const PAGE_DIMENSIONS = {
  a4: { width: Math.round(210 * MM_TO_PX), height: Math.round(297 * MM_TO_PX) }, // 794 x 1123
  b5: { width: Math.round(176 * MM_TO_PX), height: Math.round(250 * MM_TO_PX) },
  a5: { width: Math.round(148 * MM_TO_PX), height: Math.round(210 * MM_TO_PX) },
};

const PADDING = 24; // Page padding
const HEADER_HEIGHT = 60; // Fixed header area
const FOOTER_HEIGHT = 40; // Fixed footer area
const GRID_SIZE = 16; // Grid snap size in pixels

type PageFormat = 'a4' | 'b5' | 'a5';

interface FreeformCanvasProps {
  blocks: WorksheetBlock[];
  selectedBlockId: string | null;
  hoveredBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  onUpdateBlock: (id: string, content: any) => void;
  onUpdateBlockPosition: (id: string, x: number, y: number, pageIndex: number) => void;
  onUpdateBlockSize: (id: string, width: number, height: number) => void;
  onUpdateBlockMargin: (id: string, margin: number) => void;
  onUpdateBlockOrder?: (blockId: string, order: number) => void;
  onDeleteBlock?: (id: string) => void;
  onDuplicateBlock?: (id: string) => void;
  onAddBlock: (type: BlockType) => void;
  onSwitchToAI: () => void;
  onOpenAddPanel: () => void;
  onOpenAI?: () => void;
  globalFontSize?: GlobalFontSize;
  pageFormat?: PageFormat;
  gridColumns?: number;
  gridGapPx?: number;
  showGridOverlay?: boolean;
  pageBackgroundColor?: string;
}

/**
 * Calculate reading order for blocks based on their position
 * Order: page index -> Y position -> X position (top-to-bottom, left-to-right)
 */
function calculateBlockOrder(blocks: WorksheetBlock[]): Map<string, number> {
  const orderMap = new Map<string, number>();
  
  // Sort blocks by position (page, y, x)
  const sortedBlocks = [...blocks].sort((a, b) => {
    // First by page
    const pageA = a.pageIndex || 0;
    const pageB = b.pageIndex || 0;
    if (pageA !== pageB) return pageA - pageB;
    
    // Then by Y (with tolerance for same row)
    const yA = a.posY || 0;
    const yB = b.posY || 0;
    const yTolerance = 50; // Blocks within 50px are considered same row
    if (Math.abs(yA - yB) > yTolerance) return yA - yB;
    
    // Then by X
    const xA = a.posX || 0;
    const xB = b.posX || 0;
    return xA - xB;
  });
  
  // Assign order
  sortedBlocks.forEach((block, index) => {
    orderMap.set(block.id, index + 1);
  });
  
  return orderMap;
}

// Grid overlay component
function GridOverlay({ 
  columns, 
  gap, 
  pageWidth,
  pageHeight,
  headerHeight,
  footerHeight,
}: { 
  columns: number; 
  gap: number;
  pageWidth: number;
  pageHeight: number;
  headerHeight: number;
  footerHeight: number;
}) {
  const contentWidth = pageWidth - (PADDING * 2);
  const columnWidth = (contentWidth - (columns - 1) * gap) / columns;

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

export function FreeformCanvas({
  blocks,
  selectedBlockId,
  hoveredBlockId,
  onSelectBlock,
  onUpdateBlock,
  onUpdateBlockPosition,
  onUpdateBlockSize,
  onUpdateBlockMargin,
  onUpdateBlockOrder,
  onDeleteBlock,
  onDuplicateBlock,
  onAddBlock,
  onSwitchToAI,
  onOpenAddPanel,
  onOpenAI,
  globalFontSize = 'normal',
  pageFormat = 'a4',
  gridColumns = 12,
  gridGapPx = 16,
  showGridOverlay = false,
  pageBackgroundColor,
}: FreeformCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Page dimensions
  const pageWidth = PAGE_DIMENSIONS[pageFormat]?.width || PAGE_DIMENSIONS.a4.width;
  const pageHeight = PAGE_DIMENSIONS[pageFormat]?.height || PAGE_DIMENSIONS.a4.height;
  
  // Calculate reading order based on positions
  const blockOrderMap = useMemo(() => calculateBlockOrder(blocks), [blocks]);
  
  // Update block order when positions change
  useEffect(() => {
    if (!onUpdateBlockOrder) return;
    
    blocks.forEach(block => {
      const calculatedOrder = blockOrderMap.get(block.id) || 0;
      if (block.order !== calculatedOrder) {
        onUpdateBlockOrder(block.id, calculatedOrder);
      }
    });
  }, [blockOrderMap, blocks, onUpdateBlockOrder]);
  
  // Content area dimensions
  const contentWidth = pageWidth - PADDING * 2;
  const contentHeight = pageHeight - HEADER_HEIGHT - FOOTER_HEIGHT;
  const columnWidth = (contentWidth - (gridColumns - 1) * gridGapPx) / gridColumns;

  // Drag state
  const [dragState, setDragState] = useState<{
    blockId: string;
    type: 'move' | 'resize-left' | 'resize-right' | 'resize-bottom';
    startX: number;
    startY: number;
    startPosX: number;
    startPosY: number;
    startWidth: number;
    startMarginBottom: number;
  } | null>(null);

  // Activity numbers for blocks
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

  // Auto-layout blocks that don't have positions
  const blocksWithPositions = useMemo(() => {
    let currentY = 0;
    let currentX = PADDING;
    let rowHeight = 0;
    
    return blocks.map((block, index) => {
      // If block already has position, use it
      if (block.posX !== undefined && block.posY !== undefined) {
        return block;
      }
      
      // Calculate default position
      const blockWidth = block.blockWidth || contentWidth;
      const blockHeight = block.blockHeight || 100;
      
      // Check if block fits in current row
      if (currentX + blockWidth > pageWidth - PADDING) {
        // Move to next row
        currentX = PADDING;
        currentY += rowHeight + 16;
        rowHeight = 0;
      }
      
      const posX = currentX;
      const posY = currentY;
      
      // Update position for next block
      currentX += blockWidth + gridGapPx;
      rowHeight = Math.max(rowHeight, blockHeight);
      
      return {
        ...block,
        posX,
        posY,
        blockWidth,
      };
    });
  }, [blocks, contentWidth, pageWidth, gridGapPx]);

  // Group blocks by page
  const blocksByPage = useMemo(() => {
    const pages: Record<number, typeof blocksWithPositions> = { 0: [] };
    
    blocksWithPositions.forEach(block => {
      const pageIndex = block.pageIndex || 0;
      if (!pages[pageIndex]) {
        pages[pageIndex] = [];
      }
      pages[pageIndex].push(block);
    });

    return pages;
  }, [blocksWithPositions]);

  // Get number of pages
  const pageCount = Math.max(1, ...Object.keys(blocksByPage).map(Number)) + 1;

  // Handle drag/resize
  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragState.startX;
      const deltaY = e.clientY - dragState.startY;

      if (dragState.type === 'move') {
        // Move block
        let newX = dragState.startPosX + deltaX;
        let newY = dragState.startPosY + deltaY;

        // Snap to grid (unless shift is held)
        if (!e.shiftKey) {
          // Snap X to column boundaries
          const relativeX = newX - PADDING;
          const columnIndex = Math.round(relativeX / (columnWidth + gridGapPx));
          newX = PADDING + columnIndex * (columnWidth + gridGapPx);
          
          // Snap Y to grid
          newY = Math.round(newY / GRID_SIZE) * GRID_SIZE;
        }

        // Constrain to page bounds (allow going past bottom for warning)
        newX = Math.max(PADDING, Math.min(newX, pageWidth - PADDING - (dragState.startWidth || columnWidth)));
        newY = Math.max(0, newY);

        onUpdateBlockPosition(dragState.blockId, newX, newY, 0);
      } else if (dragState.type === 'resize-left') {
        // Resize from left (decrease width, increase X)
        const columnsDelta = Math.round(deltaX / (columnWidth + gridGapPx));
        const newWidth = Math.max(columnWidth, dragState.startWidth - columnsDelta * (columnWidth + gridGapPx));
        const newX = dragState.startPosX + (dragState.startWidth - newWidth);
        
        onUpdateBlockSize(dragState.blockId, newWidth, 0);
        onUpdateBlockPosition(dragState.blockId, newX, dragState.startPosY, 0);
      } else if (dragState.type === 'resize-right') {
        // Resize from right
        const columnsDelta = Math.round(deltaX / (columnWidth + gridGapPx));
        const newWidth = Math.max(columnWidth, dragState.startWidth + columnsDelta * (columnWidth + gridGapPx));
        
        onUpdateBlockSize(dragState.blockId, newWidth, 0);
      } else if (dragState.type === 'resize-bottom') {
        // Change margin bottom (add space below block)
        const newMargin = Math.max(0, Math.min(300, dragState.startMarginBottom + deltaY));
        onUpdateBlockMargin(dragState.blockId, newMargin);
      }
    };

    const handleMouseUp = () => {
      setDragState(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, columnWidth, gridGapPx, pageWidth, onUpdateBlockPosition, onUpdateBlockSize]);

  // Start drag
  const startDrag = useCallback((
    e: React.MouseEvent,
    blockId: string,
    type: 'move' | 'resize-left' | 'resize-right' | 'resize-bottom',
    block: WorksheetBlock
  ) => {
    e.preventDefault();
    e.stopPropagation();
    
    setDragState({
      blockId,
      type,
      startX: e.clientX,
      startY: e.clientY,
      startPosX: block.posX ?? PADDING,
      startPosY: block.posY ?? 0,
      startWidth: block.blockWidth ?? contentWidth,
      startMarginBottom: block.marginBottom ?? 0,
    });
    
    onSelectBlock(blockId);
  }, [contentWidth, onSelectBlock]);

  // Check if block exceeds page bounds
  const exceedsPageBounds = useCallback((block: WorksheetBlock) => {
    const y = block.posY ?? 0;
    const height = block.blockHeight ?? 100;
    return y + height > contentHeight;
  }, [contentHeight]);

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
      {Array.from({ length: pageCount }).map((_, pageIndex) => (
        <React.Fragment key={pageIndex}>
        <div
          className="relative shadow-xl rounded-sm print:shadow-none print:rounded-none worksheet-a4-page a4-page"
          style={{
            width: `${pageWidth}px`,
            height: `${pageHeight}px`,
            marginBottom: 0,
            boxShadow: '0 10px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
            overflow: 'hidden', // Clip content that exceeds page bounds
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
              pageHeight={pageHeight}
              headerHeight={HEADER_HEIGHT}
              footerHeight={FOOTER_HEIGHT}
            />
          )}

          {/* Fixed header */}
          <div
            className="absolute top-0 left-0 right-0 border-b border-dashed border-slate-200 print:border-slate-300"
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

          {/* Content area - blocks are absolutely positioned here */}
          <div 
            className="absolute"
            style={{
              top: HEADER_HEIGHT,
              left: 0,
              right: 0,
              bottom: FOOTER_HEIGHT,
              overflow: 'visible', // Allow bobánky and action buttons to show outside
            }}
          >
            {(blocksByPage[pageIndex] || []).map((block) => {
              const isSelected = selectedBlockId === block.id;
              const isHovered = hoveredBlockId === block.id;
              const x = block.posX ?? PADDING;
              const y = block.posY ?? 0;
              const width = block.blockWidth ?? contentWidth;
              const exceeds = exceedsPageBounds(block);
              
              return (
                <div
                  key={block.id}
                  data-block-id={block.id}
                  className="absolute"
                  style={{
                    left: x,
                    top: y,
                    width: width,
                    zIndex: isSelected ? 100 : (block.zIndex || 1),
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectBlock(block.id);
                  }}
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
                    globalFontSize={globalFontSize}
                    activityNumber={activityNumbers[block.id]}
                    onOpenAI={onOpenAI}
                    onDragHandleMouseDown={(e) => startDrag(e, block.id, 'move', block)}
                    isGridDragging={dragState?.blockId === block.id && dragState?.type === 'move'}
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

                      {/* Out of bounds warning */}
                      {exceeds && (
                        <div 
                          className="absolute -top-6 right-0 bg-red-500 text-white text-xs px-2 py-1 rounded print:hidden"
                          style={{ zIndex: 200 }}
                        >
                          Mimo stránku!
                        </div>
                      )}
                      
                      {/* Left bobánek - resize from left */}
                      {isSelected && width > columnWidth && (
                        <div
                          onMouseDown={(e) => startDrag(e, block.id, 'resize-left', block)}
                          className="absolute print:hidden transition-all hover:scale-105 active:scale-95 select-none cursor-ew-resize"
                          style={{
                            left: '-12px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            width: '20px',
                            height: '56px',
                            backgroundColor: dragState?.blockId === block.id && dragState?.type === 'resize-left' ? '#1D4ED8' : '#3B82F6',
                            borderRadius: '10px',
                            border: '2px solid white',
                            boxShadow: '0 2px 8px rgba(59, 130, 246, 0.4)',
                            zIndex: 10001,
                          }}
                          title="Táhni pro změnu velikosti"
                        />
                      )}
                      
                      {/* Right bobánek - resize from right */}
                      {isSelected && (
                        <div
                          onMouseDown={(e) => startDrag(e, block.id, 'resize-right', block)}
                          className="absolute print:hidden transition-all hover:scale-105 active:scale-95 select-none cursor-ew-resize"
                          style={{
                            right: '-12px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            width: '20px',
                            height: '56px',
                            backgroundColor: dragState?.blockId === block.id && dragState?.type === 'resize-right' ? '#1D4ED8' : '#3B82F6',
                            borderRadius: '10px',
                            border: '2px solid white',
                            boxShadow: '0 2px 8px rgba(59, 130, 246, 0.4)',
                            zIndex: 10001,
                          }}
                          title="Táhni pro změnu velikosti"
                        />
                      )}
                      
                      {/* Bottom bobánek - resize height / add margin */}
                      {isSelected && (
                        <div
                          onMouseDown={(e) => startDrag(e, block.id, 'resize-bottom', block)}
                          className="absolute print:hidden transition-all hover:scale-105 active:scale-95 select-none cursor-ns-resize"
                          style={{
                            bottom: '-14px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: '56px',
                            height: '20px',
                            backgroundColor: dragState?.blockId === block.id && dragState?.type === 'resize-bottom' ? '#1D4ED8' : '#3B82F6',
                            borderRadius: '10px',
                            border: '2px solid white',
                            boxShadow: '0 2px 8px rgba(59, 130, 246, 0.4)',
                            zIndex: 10001,
                          }}
                          title="Táhni dolů pro změnu výšky"
                        />
                      )}
                    </>
                  )}

                  {/* Red overlay for out of bounds */}
                  {exceeds && (
                    <div
                      className="absolute inset-0 pointer-events-none print:hidden"
                      style={{
                        outline: '3px solid #EF4444',
                        borderRadius: '6px',
                        boxShadow: '0 0 20px rgba(239, 68, 68, 0.3)',
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Fixed footer */}
          <div
            className="absolute bottom-0 left-0 right-0 border-t border-dashed border-slate-200 print:border-slate-300 flex items-center justify-center"
            style={{ height: FOOTER_HEIGHT, padding: PADDING }}
          >
            <span className="text-xs text-slate-400">
              Strana {pageIndex + 1}{pageCount > 1 ? ` / ${pageCount}` : ''}
            </span>
          </div>

          {/* Page number indicator (right side) */}
          <div 
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-slate-100 text-slate-500 px-2 py-1 rounded text-xs print:hidden"
          >
            {pageIndex + 1}
          </div>

        </div>

        {/* Quick add bar - below each page */}
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
