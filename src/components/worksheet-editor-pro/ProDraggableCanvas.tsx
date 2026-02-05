/**
 * ProDraggableCanvas - Masonry-style canvas for PRO worksheet editor
 * 
 * Features:
 * - Grid-based layout with columns
 * - Blocks can span multiple columns
 * - Masonry-style positioning (blocks don't wait for row to complete)
 * - Resize handles for grid span adjustment
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { WorksheetBlock, BlockType, BlockWidth, GlobalFontSize, GridColumns, GridGap } from '../../types/worksheet';
import { Plus, GripVertical, Sparkles, Type, ImageIcon, Info, CheckSquare, PenLine, MessageSquare, PlusCircle, QrCode, Palette } from 'lucide-react';
import { EditableBlock } from '../worksheet-editor/EditableBlock';

// Page dimensions
const MM_TO_PX = 96 / 25.4;
const PAGE_DIMENSIONS_PX = {
  a4: { width: Math.round(210 * MM_TO_PX), height: Math.round(297 * MM_TO_PX) },
  b5: { width: Math.round(176 * MM_TO_PX), height: Math.round(250 * MM_TO_PX) },
  a5: { width: Math.round(148 * MM_TO_PX), height: Math.round(210 * MM_TO_PX) },
};

type PageFormat = 'a4' | 'b5' | 'a5';

interface ProDraggableCanvasProps {
  blocks: WorksheetBlock[];
  selectedBlockId: string | null;
  hoveredBlockId?: string | null;
  onSelectBlock: (blockId: string | null) => void;
  onUpdateBlock: (blockId: string, content: any) => void;
  onUpdateBlockMargin: (blockId: string, marginBottom: number) => void;
  onUpdateBlockGridSpan?: (blockId: string, span: number) => void;
  onUpdateBlockGridStart?: (blockId: string, start: number) => void;
  onDeleteBlock?: (blockId: string) => void;
  onDuplicateBlock?: (blockId: string) => void;
  onMoveBlockUp?: (blockId: string) => void;
  onMoveBlockDown?: (blockId: string) => void;
  onAddBlock: (type: BlockType) => void;
  onSwitchToAI: () => void;
  onOpenAddPanel: () => void;
  onOpenAI?: () => void;
  globalFontSize?: GlobalFontSize;
  pendingInsertType?: BlockType | null;
  onInsertBefore?: (targetBlockId: string) => void;
  // PRO-specific props
  gridColumns: GridColumns;
  gridGapPx: number;
  pageFormat: PageFormat;
  showGridOverlay?: boolean;
}

// Grid overlay component
function GridOverlay({ columns, gap, pageWidth }: { columns: number; gap: number; pageWidth: number }) {
  const columnWidth = (pageWidth - 48 - (columns - 1) * gap) / columns; // 48 = padding
  
  return (
    <div 
      className="absolute inset-0 pointer-events-none print:hidden"
      style={{ 
        padding: '24px',
        zIndex: 5,
      }}
    >
      <div className="relative w-full h-full flex" style={{ gap: `${gap}px` }}>
        {Array.from({ length: columns }).map((_, i) => (
          <div
            key={i}
            style={{
              width: `${columnWidth}px`,
              height: '100%',
              backgroundColor: 'rgba(99, 102, 241, 0.08)',
              border: '1px dashed rgba(99, 102, 241, 0.3)',
              borderRadius: '4px',
            }}
          />
        ))}
      </div>
    </div>
  );
}

// Quick add bar - full version with all block types
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

export function ProDraggableCanvas({
  blocks,
  selectedBlockId,
  hoveredBlockId,
  onSelectBlock,
  onUpdateBlock,
  onUpdateBlockMargin,
  onUpdateBlockGridSpan,
  onUpdateBlockGridStart,
  onDeleteBlock,
  onDuplicateBlock,
  onMoveBlockUp,
  onMoveBlockDown,
  onAddBlock,
  onSwitchToAI,
  onOpenAddPanel,
  onOpenAI,
  globalFontSize = 'normal',
  pendingInsertType,
  onInsertBefore,
  gridColumns,
  gridGapPx,
  pageFormat,
  showGridOverlay,
}: ProDraggableCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [insertHoverId, setInsertHoverId] = useState<string | null>(null);
  
  // Drag resize state
  const [dragResize, setDragResize] = useState<{
    blockId: string;
    side: 'left' | 'right' | 'bottom';
    startX: number;
    startY: number;
    startSpan: number;
    startGridStart: number;
    startMarginBottom: number;
    columnWidth: number;
  } | null>(null);
  
  // Drag move state (for repositioning)
  const [dragMove, setDragMove] = useState<{
    blockId: string;
    startX: number;
    startGridStart: number;
    columnWidth: number;
  } | null>(null);

  // Get page dimensions
  const pageWidth = PAGE_DIMENSIONS_PX[pageFormat]?.width || PAGE_DIMENSIONS_PX.a4.width;
  const pageHeight = PAGE_DIMENSIONS_PX[pageFormat]?.height || PAGE_DIMENSIONS_PX.a4.height;

  // Activity numbers for blocks
  const activityNumbers = useMemo(() => {
    const numbers: Record<string, number> = {};
    let counter = 1;
    blocks.forEach((block) => {
      if (['multiple-choice', 'fill-blank', 'free-answer', 'matching', 'ordering'].includes(block.type)) {
        numbers[block.id] = counter++;
      }
    });
    return numbers;
  }, [blocks]);

  // Handle drag resize
  useEffect(() => {
    if (!dragResize) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragResize.startX;
      const deltaY = e.clientY - dragResize.startY;
      const columnsDelta = Math.round(deltaX / dragResize.columnWidth);
      
      if (dragResize.side === 'bottom') {
        const newMargin = Math.max(0, Math.min(300, dragResize.startMarginBottom + deltaY));
        onUpdateBlockMargin(dragResize.blockId, newMargin);
      } else if (dragResize.side === 'left') {
        // Left: decrease span, increase start (shrink from left)
        const newSpan = Math.max(1, dragResize.startSpan - columnsDelta);
        const newStart = Math.max(1, dragResize.startGridStart + columnsDelta);
        if (newStart + newSpan - 1 <= gridColumns && newSpan >= 1) {
          onUpdateBlockGridStart?.(dragResize.blockId, newStart);
          onUpdateBlockGridSpan?.(dragResize.blockId, newSpan);
        }
      } else {
        // Right: change span
        const newSpan = Math.max(1, Math.min(dragResize.startSpan + columnsDelta, gridColumns - dragResize.startGridStart + 1));
        onUpdateBlockGridSpan?.(dragResize.blockId, newSpan);
      }
    };
    
    const handleMouseUp = () => setDragResize(null);
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragResize, gridColumns, onUpdateBlockGridSpan, onUpdateBlockGridStart, onUpdateBlockMargin]);

  // Handle drag move
  useEffect(() => {
    if (!dragMove) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragMove.startX;
      const columnsDelta = Math.round(deltaX / dragMove.columnWidth);
      const newStart = Math.max(1, Math.min(dragMove.startGridStart + columnsDelta, gridColumns));
      onUpdateBlockGridStart?.(dragMove.blockId, newStart);
    };
    
    const handleMouseUp = () => setDragMove(null);
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragMove, gridColumns, onUpdateBlockGridStart]);

  // Render blocks in CSS grid
  const renderBlocks = () => {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
          gap: `8px ${gridGapPx}px`,
          gridAutoRows: 'min-content',
          alignItems: 'start',
          position: 'relative',
          zIndex: 10,
        }}
      >
        {blocks.map((block) => {
          const span = block.gridSpan || gridColumns;
          const actualSpan = Math.min(span, gridColumns);
          const gridStart = block.gridStart || 1;
          const actualStart = Math.max(1, Math.min(gridStart, gridColumns - actualSpan + 1));
          const isSelected = selectedBlockId === block.id;
          const isHovered = hoveredBlockId === block.id;
          
          const canShrinkLeft = actualSpan > 1;
          const canShrinkRight = actualSpan > 1;
          const canGrowRight = actualStart + actualSpan <= gridColumns;
          const showRightHandle = canGrowRight || canShrinkRight;
          
          const columnWidth = (pageWidth - 48) / gridColumns;
          
          return (
            <div
              key={block.id}
              data-block-id={block.id}
              style={{
                gridColumn: actualStart === 1 ? `span ${actualSpan}` : `${actualStart} / span ${actualSpan}`,
                position: 'relative',
                zIndex: isSelected ? 50 : 1,
              }}
              onMouseEnter={() => pendingInsertType && setInsertHoverId(block.id)}
            >
              {/* Insert indicator */}
              {pendingInsertType && insertHoverId === block.id && (
                <button
                  type="button"
                  className="absolute left-0 right-0 h-6 flex items-center justify-center"
                  style={{ top: '-12px', zIndex: 9999 }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onInsertBefore?.(block.id);
                  }}
                >
                  <div 
                    className="absolute left-0 right-0 top-1/2 -translate-y-1/2 rounded-full"
                    style={{ height: '4px', backgroundColor: '#2563eb', zIndex: 1 }}
                  />
                  <div 
                    className="relative flex items-center justify-center shadow-lg"
                    style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#2563eb', color: 'white', zIndex: 10 }}
                  >
                    <Plus className="w-4 h-4" />
                  </div>
                </button>
              )}
              
              <EditableBlock
                block={block}
                isSelected={isSelected}
                isHovered={isHovered}
                onSelect={() => onSelectBlock(block.id)}
                onUpdate={(content) => onUpdateBlock(block.id, content)}
                onUpdateMargin={(margin) => onUpdateBlockMargin(block.id, margin)}
                onDelete={onDeleteBlock ? () => onDeleteBlock(block.id) : undefined}
                onDuplicate={onDuplicateBlock ? () => onDuplicateBlock(block.id) : undefined}
                onMoveUp={onMoveBlockUp ? () => onMoveBlockUp(block.id) : undefined}
                onMoveDown={onMoveBlockDown ? () => onMoveBlockDown(block.id) : undefined}
                globalFontSize={globalFontSize}
                activityNumber={activityNumbers[block.id]}
                onOpenAI={onOpenAI}
                onDragHandleMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setDragMove({
                    blockId: block.id,
                    startX: e.clientX,
                    startGridStart: actualStart,
                    columnWidth,
                  });
                }}
                isGridDragging={dragMove?.blockId === block.id}
              />
              
              {/* Selection border and resize handles */}
              {(isSelected || isHovered) && (
                <>
                  {/* Blue selection border */}
                  <div
                    className="absolute inset-0 pointer-events-none print:hidden"
                    style={{
                      border: '2px solid #3B82F6',
                      borderRadius: '6px',
                      zIndex: 90,
                    }}
                  />
                  
                  {/* Left handle */}
                  {canShrinkLeft && (
                    <div
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setDragResize({
                          blockId: block.id,
                          side: 'left',
                          startX: e.clientX,
                          startY: e.clientY,
                          startSpan: actualSpan,
                          startGridStart: actualStart,
                          startMarginBottom: block.marginBottom || 0,
                          columnWidth,
                        });
                      }}
                      className="absolute print:hidden select-none cursor-ew-resize"
                      style={{
                        left: '-12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: '20px',
                        height: '56px',
                        backgroundColor: dragResize?.blockId === block.id && dragResize?.side === 'left' ? '#1D4ED8' : '#3B82F6',
                        borderRadius: '10px',
                        border: '2px solid white',
                        boxShadow: '0 2px 8px rgba(59, 130, 246, 0.4)',
                        zIndex: 10001,
                      }}
                    />
                  )}
                  
                  {/* Right handle */}
                  {showRightHandle && (
                    <div
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setDragResize({
                          blockId: block.id,
                          side: 'right',
                          startX: e.clientX,
                          startY: e.clientY,
                          startSpan: actualSpan,
                          startGridStart: actualStart,
                          startMarginBottom: block.marginBottom || 0,
                          columnWidth,
                        });
                      }}
                      className="absolute print:hidden select-none cursor-ew-resize"
                      style={{
                        right: '-12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: '20px',
                        height: '56px',
                        backgroundColor: dragResize?.blockId === block.id && dragResize?.side === 'right' ? '#1D4ED8' : '#3B82F6',
                        borderRadius: '10px',
                        border: '2px solid white',
                        boxShadow: '0 2px 8px rgba(59, 130, 246, 0.4)',
                        zIndex: 10001,
                      }}
                    />
                  )}
                  
                  {/* Bottom handle */}
                  <div
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setDragResize({
                        blockId: block.id,
                        side: 'bottom',
                        startX: e.clientX,
                        startY: e.clientY,
                        startSpan: actualSpan,
                        startGridStart: actualStart,
                        startMarginBottom: block.marginBottom || 0,
                        columnWidth,
                      });
                    }}
                    className="absolute print:hidden select-none cursor-ns-resize"
                    style={{
                      bottom: '-14px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '56px',
                      height: '20px',
                      backgroundColor: dragResize?.blockId === block.id && dragResize?.side === 'bottom' ? '#1D4ED8' : '#3B82F6',
                      borderRadius: '10px',
                      border: '2px solid white',
                      boxShadow: '0 2px 8px rgba(59, 130, 246, 0.4)',
                      zIndex: 10001,
                    }}
                  />
                </>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="worksheet-pages-row pages-row" style={{ width: `${pageWidth}px`, marginLeft: 'auto', marginRight: 'auto' }}>
      <div 
        ref={containerRef}
        className="relative bg-white shadow-xl rounded-sm print:shadow-none print:rounded-none worksheet-a4-page a4-page"
        style={{
          width: `${pageWidth}px`,
          minHeight: `${pageHeight}px`,
          padding: '24px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
        }}
        onClick={() => onSelectBlock(null)}
      >
        {/* Grid overlay */}
        {showGridOverlay && (
          <GridOverlay columns={gridColumns} gap={gridGapPx} pageWidth={pageWidth} />
        )}
        
        {/* Blocks */}
        {renderBlocks()}
        
        {/* Quick add bar */}
        <QuickAddBar onAddBlock={onAddBlock} onSwitchToAI={onSwitchToAI} onOpenAddPanel={onOpenAddPanel} />
      </div>
    </div>
  );
}
