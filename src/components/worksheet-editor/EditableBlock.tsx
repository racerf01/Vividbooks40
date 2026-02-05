/**
 * EditableBlock - Blok s inline editací v canvasu
 * 
 * Umožňuje editovat obsah bloků přímo v A4 náhledu
 */

import React, { useState, useRef, useEffect, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, X, Check, Circle, Square, Type, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Copy, Trash2, ImageIcon, Table as TableIcon, QrCode, ArrowLeftRight, Bold, Italic, Underline } from 'lucide-react';
import { WorksheetBlock, ChoiceOption, GlobalFontSize, SpacerStyle, ExamplesContent, MathExample, ExampleDifficulty, AnswerBoxStyle, ImageContent, ImageSize, BlockImage, TableContent, ConnectPairsContent, ImageHotspotsContent, VideoQuizContent, ConnectPairContent, WorksheetHotspot, WorksheetVideoQuestion, HeaderFooterContent, QRCodeContent, FreeCanvasContent } from '../../types/worksheet';
import { FreeCanvasEditor } from './FreeCanvasEditor';
import { FreeCanvasFullscreen } from './FreeCanvasFullscreen';
import { QRCodeSVG } from 'qrcode.react';
import { LatexRenderer } from './LatexRenderer';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { WorksheetTextToolbar } from './WorksheetTextToolbar';
import { useAssetPicker } from '../../hooks/useAssetPicker';

function PrintSafePattern({ variant, lineSpacing = 40 }: { variant: 'dotted' | 'lined'; lineSpacing?: number }) {
  const id = useId().replace(/:/g, '');
  const patternId = `${variant}-pattern-${id}`;
  const dotColor = '#94a3b8';   // slate-400
  const lineColor = '#cbd5e1';  // slate-300

  if (variant === 'dotted') {
    return (
      <svg className="absolute inset-0 w-full h-full" aria-hidden="true" style={{ display: 'block' }}>
        <defs>
          <pattern id={patternId} patternUnits="userSpaceOnUse" width="16" height="16">
            <circle cx="2" cy="2" r="1" fill={dotColor} />
          </pattern>
        </defs>
        <rect y="12" width="100%" height="calc(100% - 12px)" fill={`url(#${patternId})`} />
      </svg>
    );
  }

  return (
    <svg className="absolute inset-0 w-full h-full" aria-hidden="true" style={{ display: 'block' }}>
      <defs>
        <pattern id={patternId} patternUnits="userSpaceOnUse" width="1" height={lineSpacing}>
          <line x1="0" y1={lineSpacing - 1} x2="2000" y2={lineSpacing - 1} stroke={lineColor} strokeWidth="1" />
        </pattern>
      </defs>
      <rect y="8" width="100%" height="calc(100% - 8px)" fill={`url(#${patternId})`} />
    </svg>
  );
}

// Get font sizes based on global setting
const getFontSizes = (globalSize: GlobalFontSize = 'normal') => {
  const multipliers = {
    small: 0.85,
    normal: 1,
    large: 1.2,
  };
  const m = multipliers[globalSize];
  
  return {
    title: `${Math.round(14 * m)}pt`,    // base 14pt
    body: `${Math.round(12 * m)}pt`,     // base 12pt
    small: `${Math.round(9 * m)}pt`,     // base 9pt
    large: `${Math.round(14 * m)}pt`,    // base 14pt
    h1: `${Math.round(36 * m)}pt`,       // base 36pt (Nadpis 1)
    h2: `${Math.round(24 * m)}pt`,       // base 24pt (Nadpis 2)
    h3: `${Math.round(18 * m)}pt`,       // base 18pt (Nadpis 3)
  };
};

// Default font sizes
const FONT_SIZES = getFontSizes('normal');

// Consistent font family
const FONT_FAMILY = "'Fenomen Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

interface EditableBlockProps {
  block: WorksheetBlock;
  isSelected: boolean;
  isHovered?: boolean;
  onSelect: () => void;
  onUpdate: (content: any) => void;
  onUpdateMargin?: (marginBottom: number) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  globalFontSize?: GlobalFontSize;
  activityNumber?: number; // Number for activity blocks (multiple-choice, fill-blank, free-answer)
  /** If block is rendered in a side-by-side row, which column is it in? */
  columnPosition?: 'left' | 'right';
  onOpenAI?: () => void;
}

export function EditableBlock({ block, isSelected, isHovered, onSelect, onUpdate, onUpdateMargin, onDelete, onDuplicate, onMoveUp, onMoveDown, globalFontSize = 'normal', activityNumber, columnPosition, onOpenAI }: EditableBlockProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isResizingMargin, setIsResizingMargin] = useState(false);
  const [localMargin, setLocalMargin] = useState<number | null>(null);
  const [toolbarPosition, setToolbarPosition] = useState({ top: 0, left: 0 });
  const blockRef = useRef<HTMLDivElement>(null);

  // Check if this is a block that can be edited inline (shows toolbar or resize handles)
  const isTextBlock = ['heading', 'paragraph', 'infobox', 'multiple-choice', 'fill-blank', 'free-answer', 'spacer', 'image-hotspots', 'connect-pairs'].includes(block.type);

  // Check if we should show the text formatting toolbar
  const showTextToolbar = isEditing && isTextBlock && block.type !== 'spacer';

  // Current margin value - use local during drag
  const marginBottom = localMargin ?? block.marginBottom ?? 0;
  const marginStyle = block.marginStyle || 'empty';

  // Sync isEditing with isSelected from parent to ensure only one toolbar is open
  useEffect(() => {
    if (isSelected && !isEditing) {
      setIsEditing(true);
    } else if (!isSelected && isEditing) {
      setIsEditing(false);
    }
  }, [isSelected]);

  // Global click handler to close toolbar when clicking outside the canvas
  useEffect(() => {
    if (!isEditing) return;

    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // If the target is no longer in the document, it might have been a dropdown item
      // that was just removed. In this case, we should assume it was a valid click inside the toolbar.
      if (!document.contains(target)) {
        return;
      }

      // Check if clicking on this block
      const clickedOnBlock = target.closest(`[data-block-id="${block.id}"]`);
      // Check if clicking on the toolbar (either by class or by data attribute)
      const clickedOnToolbar = target.closest('.worksheet-text-toolbar') || 
                               target.closest('[data-toolbar-for-block]') ||
                               target.closest('[data-toolbar-element]');
      
      // Check if clicking on settings overlay
      const clickedOnSettings = target.closest('[data-settings-overlay]');
      
      // If clicking outside both the block and its toolbar/settings, close editing
      if (!clickedOnBlock && !clickedOnToolbar && !clickedOnSettings) {
        setIsEditing(false);
      }
    };

    // Use capture to catch clicks before they are stopped by other handlers
    document.addEventListener('mousedown', handleGlobalClick, true);
    return () => document.removeEventListener('mousedown', handleGlobalClick, true);
  }, [isEditing, block.id]);

  // Calculate toolbar position when editing starts
  useEffect(() => {
    if (isEditing && isTextBlock && blockRef.current) {
      const updatePosition = () => {
        const rect = blockRef.current?.getBoundingClientRect();
        if (rect) {
          setToolbarPosition({
            top: rect.top - 64, // 64px above the block (increased to avoid overlaps)
            left: rect.left + rect.width / 2, // Centered horizontally
          });
        }
      };
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
      return () => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition, true);
      };
    }
  }, [isEditing, isTextBlock]);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  // Get visual styles from block
  const visualStyles = block.visualStyles || {};
  
  // Map shadow option to CSS box-shadow
  const getShadowStyle = (shadow?: 'none' | 'small' | 'medium' | 'large'): string => {
    switch (shadow) {
      case 'small': return '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)';
      case 'medium': return '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)';
      case 'large': return '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)';
      default: return 'none';
    }
  };

  // Check if visual styles require extra padding
  const hasVisualBackground = visualStyles.backgroundColor && visualStyles.backgroundColor !== 'transparent';
  const hasVisualBorder = visualStyles.borderColor && visualStyles.borderColor !== 'transparent';
  const hasVisualShadow = visualStyles.shadow && visualStyles.shadow !== 'none';

  // Build visual style object
  const visualStyleObj: React.CSSProperties = {
    backgroundColor: hasVisualBackground ? visualStyles.backgroundColor : undefined,
    border: hasVisualBorder ? `${visualStyles.borderWidth || 2}px solid ${visualStyles.borderColor}` : undefined,
    borderRadius: typeof visualStyles.borderRadius === 'number' ? `${visualStyles.borderRadius}px` : undefined,
    boxShadow: getShadowStyle(visualStyles.shadow),
    // Add extra padding when visual styles are applied
    padding: (hasVisualBackground || hasVisualBorder || hasVisualShadow) ? '12px 16px' : undefined,
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto',
    ...visualStyleObj,
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect();
    // Single click to edit for text blocks
    if (isTextBlock) {
      setIsEditing(true);
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    // Check if the new focus target is still within this block
    const blockElement = e.currentTarget.closest('[data-block-id]');
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    
    // If focus is moving to another element within the same block OR to the toolbar, don't exit editing
    if (relatedTarget && (
      blockElement?.contains(relatedTarget) || 
      relatedTarget.closest('.worksheet-text-toolbar') || 
      relatedTarget.closest('[data-toolbar-element]')
    )) {
      return;
    }
    
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Only handle Escape to exit editing mode
    // Do NOT prevent Enter - it should create new lines in textareas
    if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  // Handle margin resize
  const handleMarginMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onUpdateMargin) return;
    
    setIsResizingMargin(true);
    const startY = e.clientY;
    const startMargin = block.marginBottom ?? 0;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientY - startY;
      const newMargin = Math.max(0, Math.min(500, startMargin + delta));
      setLocalMargin(newMargin);
      onUpdateMargin(newMargin);
    };

    const handleMouseUp = () => {
      setIsResizingMargin(false);
      setLocalMargin(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, [block.marginBottom, onUpdateMargin]);

  const highlightClass = isSelected
    ? 'ring-2 ring-blue-500 bg-blue-50/50'
    : isHovered
      ? 'ring-2 ring-blue-300 bg-blue-50/40'
      : 'hover:bg-slate-50 cursor-pointer';

  // Get current text formatting state from block content
  const getTextFormatState = () => {
    const content = block.content as any;
    
    // Get default font size based on block type
    let defaultFontSize = 12;
    if (block.type === 'heading') {
      // Default font sizes for headings (from getFontSizes)
      const headingDefaults = { h1: 36, h2: 24, h3: 18 };
      defaultFontSize = headingDefaults[content?.level as 'h1' | 'h2' | 'h3'] || 36;
    }
    
    // Handle legacy 'small'/'normal'/'large' values by converting to numbers
    let fontSizeValue = content?.fontSize;
    if (fontSizeValue === 'small') fontSizeValue = 9;
    else if (fontSizeValue === 'normal') fontSizeValue = 12;
    else if (fontSizeValue === 'large') fontSizeValue = 18;
    else if (typeof fontSizeValue !== 'number') fontSizeValue = defaultFontSize;
    
    return {
      fontSize: fontSizeValue,
      textAlign: content?.align || 'left',
      isBold: content?.isBold || false,
      isItalic: content?.isItalic || false,
      isUnderline: content?.isUnderline || false,
      textColor: content?.textColor || '#000000',
      highlightColor: content?.highlightColor || 'transparent',
      listType: content?.listType || 'none',
    };
  };

  const formatState = getTextFormatState();

  // Handlers for text formatting
  const handleFontSizeChange = (size: number) => {
    const content = block.content as any;
    onUpdate({ ...content, fontSize: size });
  };

  const handleAlignChange = (align: 'left' | 'center' | 'right') => {
    const content = block.content as any;
    onUpdate({ ...content, align });
  };

  const handleBoldToggle = () => {
    const content = block.content as any;
    onUpdate({ ...content, isBold: !content?.isBold });
  };

  const handleItalicToggle = () => {
    const content = block.content as any;
    onUpdate({ ...content, isItalic: !content?.isItalic });
  };

  const handleUnderlineToggle = () => {
    const content = block.content as any;
    onUpdate({ ...content, isUnderline: !content?.isUnderline });
  };

  const handleTextColorChange = (color: string) => {
    const content = block.content as any;
    onUpdate({ ...content, textColor: color });
  };

  const handleHighlightColorChange = (color: string) => {
    const content = block.content as any;
    onUpdate({ ...content, highlightColor: color });
  };

  const handleListTypeChange = (listType: 'none' | 'bullet' | 'numbered' | 'checklist') => {
    const content = block.content as any;
    onUpdate({ ...content, listType });
  };

  const handleInsertSymbol = (symbol: string) => {
    const content = block.content as any;
    // Insert symbol at the end of text/html content
    if (content?.html !== undefined) {
      onUpdate({ ...content, html: (content.html || '') + symbol });
    } else if (content?.text !== undefined) {
      onUpdate({ ...content, text: (content.text || '') + symbol });
    } else if (content?.question !== undefined) {
      onUpdate({ ...content, question: (content.question || '') + symbol });
    }
  };

  return (
    <>
    <div
      ref={(node) => {
        setNodeRef(node);
        // @ts-ignore - node might be null
        blockRef.current = node;
      }}
      style={style}
      data-block-id={block.id}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      className={`
        group relative py-1 px-4 rounded-lg transition-all
        ${isDragging ? 'shadow-xl scale-[1.01]' : ''}
        ${block.type === 'table' ? '' : highlightClass}
        ${isEditing && block.type !== 'table' ? 'ring-2 ring-blue-500' : ''}
      `}
    >
      
      {/* Block content with optional image */}
      <BlockWithImage
        block={block}
        isEditing={isEditing}
        isSelected={isSelected}
        onUpdate={onUpdate}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        globalFontSize={globalFontSize}
        activityNumber={activityNumber}
      />
      
      {/* Bottom margin space with optional pattern */}
      {marginBottom > 0 && (
        <div style={{ height: marginBottom }} className="relative">
          {marginStyle === 'dotted' && (
            <PrintSafePattern key={`dotted-margin-${marginBottom}`} variant="dotted" />
          )}
          {marginStyle === 'lined' && (
            <PrintSafePattern key={`lined-margin-${marginBottom}`} variant="lined" lineSpacing={40} />
          )}
        </div>
      )}
      
      {/* Margin resize handle - visible on hover, always at the very bottom (not for tables or spacers which have their own resize) */}
      {onUpdateMargin && block.type !== 'table' && block.type !== 'spacer' && (
        <div
          onMouseDown={handleMarginMouseDown}
          className={`
            absolute left-1/2 -translate-x-1/2 w-16 h-4 cursor-row-resize
            flex items-center justify-center
            opacity-0 group-hover:opacity-100 transition-opacity
            ${isResizingMargin ? 'opacity-100' : ''}
          `}
          style={{ bottom: -8 }}
        >
          <div 
            className={`
              w-10 h-3 rounded-full border-2 transition-colors
              ${isResizingMargin 
                ? 'bg-blue-500 border-blue-500' 
                : 'bg-white border-slate-300 hover:border-blue-400'
              }
            `}
          />
        </div>
      )}

      {/* Action buttons - 2x2 grid, positioned OUTSIDE on the right */}
      {isSelected && (
        <div 
          className="absolute top-1/2 z-[9999]"
          style={{ 
            right: '0px',
            transform: 'translateX(100%) translateY(-50%)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="grid grid-cols-2 gap-1 bg-white rounded-xl shadow-xl border border-slate-200 p-1.5">
            {/* Row 1: Up + Duplicate */}
            <button
              onClick={() => onMoveUp?.()}
              className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center hover:bg-blue-100 transition-colors"
              title={columnPosition === 'right' ? 'Přesunout doleva' : 'Posunout nahoru'}
            >
              {columnPosition === 'right' ? (
                <ChevronLeft size={20} className="text-blue-600" />
              ) : (
                <ChevronUp size={20} className="text-blue-600" />
              )}
            </button>
            <button
              onClick={() => onDuplicate?.()}
              className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center hover:bg-blue-100 transition-colors"
              title="Duplikovat"
            >
              <Copy size={16} className="text-blue-600" />
            </button>
            
            {/* Row 2: Down + Delete */}
            <button
              onClick={() => onMoveDown?.()}
              className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center hover:bg-blue-100 transition-colors"
              title={columnPosition === 'left' ? 'Přesunout doprava' : 'Posunout dolů'}
            >
              {columnPosition === 'left' ? (
                <ChevronRight size={20} className="text-blue-600" />
              ) : (
                <ChevronDown size={20} className="text-blue-600" />
              )}
            </button>
            <button
              onClick={() => onDelete?.()}
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
              style={{ backgroundColor: '#ef4444', border: '1px solid #dc2626' }}
              title="Smazat"
            >
              <Trash2 size={16} color="white" />
            </button>
          </div>
        </div>
      )}
    </div>

    {/* Text formatting toolbar - REMOVED per user request */}
    {/* showTextToolbar && createPortal(...) */}
    </>
  );
}

// ============================================
// BLOCK CONTENT COMPONENTS
// ============================================

interface BlockContentProps {
  block: WorksheetBlock;
  isEditing: boolean;
  isSelected?: boolean;
  onUpdate: (content: any) => void;
  onBlur: (e: React.FocusEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  globalFontSize?: GlobalFontSize;
  activityNumber?: number;
}

// Size to width mapping for block images
const imageSizeToWidth: Record<ImageSize, string> = {
  small: '25%',
  medium: '35%',
  large: '50%',
  full: '100%',
};

/**
 * BlockWithImage - Wrapper that renders optional image alongside block content
 */
function BlockWithImage({ block, isEditing, isSelected, onUpdate, onBlur, onKeyDown, globalFontSize = 'normal', activityNumber }: BlockContentProps) {
  const image = block.image;
  
  // If no image, just render the content directly
  if (!image?.url) {
    return (
      <BlockContent
        block={block}
        isEditing={isEditing}
        isSelected={isSelected}
        onUpdate={onUpdate}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        globalFontSize={globalFontSize}
        activityNumber={activityNumber}
      />
    );
  }

  const imageWidth = imageSizeToWidth[image.size] || '35%';

  // Image before content (above)
  if (image.position === 'before') {
    return (
      <div className="flex flex-col gap-3">
        <div style={{ maxWidth: imageWidth }}>
          <img 
            src={image.url} 
            alt={image.alt || ''} 
            className="w-full h-auto rounded-lg"
          />
        </div>
        <BlockContent
          block={block}
          isEditing={isEditing}
          isSelected={isSelected}
          onUpdate={onUpdate}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          globalFontSize={globalFontSize}
          activityNumber={activityNumber}
        />
      </div>
    );
  }

  // Image beside content (left or right)
  const isImageLeft = image.position === 'beside-left';
  
  return (
    <div className="flex gap-4 items-start">
      {isImageLeft && (
        <div style={{ width: imageWidth, flexShrink: 0 }}>
          <img 
            src={image.url} 
            alt={image.alt || ''} 
            className="w-full h-auto rounded-lg"
          />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <BlockContent
          block={block}
          isEditing={isEditing}
          isSelected={isSelected}
          onUpdate={onUpdate}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          globalFontSize={globalFontSize}
          activityNumber={activityNumber}
        />
      </div>
      {!isImageLeft && (
        <div style={{ width: imageWidth, flexShrink: 0 }}>
          <img 
            src={image.url} 
            alt={image.alt || ''} 
            className="w-full h-auto rounded-lg"
          />
        </div>
      )}
    </div>
  );
}

function BlockContent({ block, isEditing, isSelected, onUpdate, onBlur, onKeyDown, globalFontSize = 'normal', activityNumber }: BlockContentProps) {
  const fontSizes = getFontSizes(globalFontSize);
  const effectiveIsEditing = isEditing || (isSelected && ['image-hotspots', 'connect-pairs', 'fill-blank'].includes(block.type));
  switch (block.type) {
    case 'heading':
      return (
        <HeadingEditor
          content={block.content}
          isEditing={isEditing}
          onUpdate={onUpdate}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          fontSizes={fontSizes}
        />
      );
    case 'paragraph':
      return (
        <ParagraphEditor
          content={block.content}
          isEditing={isEditing}
          onUpdate={onUpdate}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          fontSizes={fontSizes}
        />
      );
    case 'infobox':
      return (
        <InfoboxEditor
          content={block.content}
          isEditing={isEditing}
          onUpdate={onUpdate}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          fontSizes={fontSizes}
        />
      );
    case 'multiple-choice':
      return (
        <MultipleChoiceEditor
          content={block.content}
          isEditing={isEditing}
          onUpdate={onUpdate}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          fontSizes={fontSizes}
          activityNumber={activityNumber}
        />
      );
    case 'fill-blank':
      return (
        <FillBlankEditor
          content={block.content}
          isEditing={effectiveIsEditing}
          onUpdate={onUpdate}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          fontSizes={fontSizes}
          activityNumber={activityNumber}
        />
      );
    case 'free-answer':
      return (
        <FreeAnswerEditor
          content={block.content}
          isEditing={isEditing}
          onUpdate={onUpdate}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          fontSizes={fontSizes}
          activityNumber={activityNumber}
        />
      );
    case 'spacer':
      return (
        <SpacerEditor
          content={block.content as { height: number; style: SpacerStyle }}
          isEditing={isEditing}
          onUpdate={onUpdate}
        />
      );
    case 'examples':
      return (
        <ExamplesEditor
          content={block.content as ExamplesContent}
          isEditing={isEditing}
          onUpdate={onUpdate}
        />
      );
    case 'image':
      return (
        <ImageEditor
          content={block.content as ImageContent}
          isEditing={isEditing}
          onUpdate={onUpdate}
        />
      );
    case 'table':
      return (
        <TableEditor
          content={block.content as TableContent}
          isEditing={isEditing}
          onUpdate={onUpdate}
          onBlur={onBlur}
        />
      );
    case 'connect-pairs':
      return (
        <ConnectPairsEditorBlock
          content={block.content as ConnectPairsContent}
          isEditing={effectiveIsEditing}
          onUpdate={onUpdate}
          activityNumber={activityNumber}
        />
      );
    case 'image-hotspots':
      return (
        <ImageHotspotsEditorBlock
          content={block.content as ImageHotspotsContent}
          isEditing={effectiveIsEditing}
          onUpdate={onUpdate}
          activityNumber={activityNumber}
        />
      );
    case 'video-quiz':
      return (
        <VideoQuizEditorBlock
          content={block.content as VideoQuizContent}
          isEditing={isEditing}
          onUpdate={onUpdate}
          activityNumber={activityNumber}
        />
      );
    case 'qr-code':
      return (
        <QRCodeEditor
          content={block.content as QRCodeContent}
          isEditing={isEditing}
          onUpdate={onUpdate}
        />
      );
    case 'header-footer':
      return (
        <HeaderFooterEditorBlock
          content={block.content as HeaderFooterContent}
          isEditing={isEditing}
          onUpdate={onUpdate}
        />
      );
    case 'free-canvas':
      return (
        <FreeCanvasActivityBlock
          block={block}
          isEditing={isEditing}
          onUpdate={onUpdate}
          activityNumber={activityNumber}
        />
      );
    default:
      return <p className="text-slate-400">Neznámý typ bloku</p>;
  }
}

// ============================================
// HEADING EDITOR
// ============================================

interface FontSizes {
  title: string;
  body: string;
  small: string;
  large: string;
  h1: string;
  h2: string;
  h3: string;
}

interface HeadingEditorProps {
  content: { text: string; level: 'h1' | 'h2' | 'h3'; align?: 'left' | 'center' | 'right'; isBold?: boolean; isItalic?: boolean; isUnderline?: boolean; fontSize?: number; textColor?: string; highlightColor?: string };
  isEditing: boolean;
  onUpdate: (content: any) => void;
  onBlur: (e: React.FocusEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  fontSizes: FontSizes;
}

function HeadingEditor({ content, isEditing, onUpdate, onBlur, onKeyDown, fontSizes }: HeadingEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isBold = content.isBold || false;
  const isItalic = content.isItalic || false;
  const isUnderline = content.isUnderline || false;
  const textColor = content.textColor || '#1e293b'; // default slate-800
  const highlightColor = content.highlightColor || 'transparent';

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, []);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      // Select all text
      textareaRef.current.setSelectionRange(0, textareaRef.current.value.length);
      autoResize();
    }
  }, [isEditing, autoResize]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdate({ ...content, text: e.target.value });
    autoResize();
  };

  const handleKeyDownLocal = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Only blur on Enter without Shift (Shift+Enter for new line)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onBlur(e as unknown as React.FocusEvent);
    }
    onKeyDown(e);
  };

  // Font sizes for headings - use custom fontSize if set, otherwise use global font size defaults
  const defaultSize = {
    h1: fontSizes.h1,
    h2: fontSizes.h2,
    h3: fontSizes.h3,
  }[content.level];
  
  // If content.fontSize is set (as a number), use it; otherwise fall back to default
  const sizeStyle = content.fontSize ? `${content.fontSize}pt` : defaultSize;

  const alignClass = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  }[content.align || 'left'];

  // H1 uses Cooper Light font - no quotes format like index.css line 510
  const isH1 = content.level === 'h1';
  const fontClass = isH1 ? 'font-cooper' : '';
  const baseFontWeight = isH1 ? 300 : 700;
  const fontWeight = isBold && !isH1 ? 'bold' : baseFontWeight;
  const fontFamily = isH1 ? 'Cooper Light, serif' : undefined;

  const formattingStyle: React.CSSProperties = {
    fontStyle: isItalic ? 'italic' : 'normal',
    textDecoration: isUnderline ? 'underline' : 'none',
    color: textColor,
    backgroundColor: highlightColor,
  };

  if (isEditing) {
    return (
      <textarea
        ref={textareaRef}
        value={content.text}
        onChange={handleChange}
        onBlur={onBlur}
        onKeyDown={handleKeyDownLocal}
        onInput={autoResize}
        className={`w-full bg-transparent border-none outline-none resize-none overflow-hidden ${alignClass} ${fontClass}`}
        style={{ fontSize: sizeStyle, fontWeight, fontFamily, ...formattingStyle, minHeight: '1.2em', lineHeight: 1.2 }}
        placeholder="Zadejte nadpis..."
        rows={1}
      />
    );
  }

  const HeadingTag = content.level as keyof JSX.IntrinsicElements;
  
  // Style object with font for H1 - apply to all child elements too
  const headingStyle: React.CSSProperties = {
    fontSize: sizeStyle,
    fontWeight,
    fontFamily,
    lineHeight: 1.2,
    ...formattingStyle,
  };
  
  // For H1, we need to ensure the font is applied to ALL nested elements
  // because Tailwind's base styles can override inherited fonts
  const innerStyle: React.CSSProperties = isH1 
    ? { fontFamily: 'Cooper Light, serif', fontWeight: 300, ...formattingStyle }
    : { ...formattingStyle };
  
  return (
    <HeadingTag 
      className={`${alignClass} ${fontClass}`}
      style={headingStyle}
    >
      {content.text ? (
        <span style={innerStyle}>
          <LatexRenderer text={content.text} style={innerStyle} />
        </span>
      ) : (
        <span className="text-slate-400" style={innerStyle}>Nadpis...</span>
      )}
    </HeadingTag>
  );
}

// ============================================
// PARAGRAPH EDITOR
// ============================================

// Color definitions for infobox mode
const PARAGRAPH_BG_COLORS: Record<string, { bg: string; border: string }> = {
  none: { bg: 'transparent', border: 'transparent' },
  blue: { bg: '#dbeafe', border: '#93c5fd' },
  green: { bg: '#dcfce7', border: '#86efac' },
  yellow: { bg: '#fef9c3', border: '#fde047' },
  red: { bg: '#fee2e2', border: '#fca5a5' },
  purple: { bg: '#f3e8ff', border: '#d8b4fe' },
  gray: { bg: '#f1f5f9', border: '#cbd5e1' },
};

interface ParagraphEditorProps {
  content: {
    html: string;
    displayMode?: 'normal' | 'infobox';
    bgColor?: string;
    hasBorder?: boolean;
    align?: 'left' | 'center' | 'right' | 'justify';
    fontSize?: number | 'small' | 'normal' | 'large'; // number in pt, or legacy string values
    textColor?: string;
    highlightColor?: string;
  };
  isEditing: boolean;
  onUpdate: (content: any) => void;
  onBlur: (e: React.FocusEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  fontSizes: FontSizes;
}

function ParagraphEditor({ content, isEditing, onUpdate, onBlur, onKeyDown, fontSizes }: ParagraphEditorProps) {
  const editorRef = useRef<HTMLTextAreaElement>(null);
  
  const displayMode = content.displayMode || 'normal';
  const bgColor = content.bgColor || 'blue';
  const hasBorder = content.hasBorder ?? true;
  const align = content.align || 'left';
  const rawFontSize = content.fontSize;
  const isBold = content.isBold || false;
  const isItalic = content.isItalic || false;
  const isUnderline = content.isUnderline || false;
  const textColor = content.textColor || '#475569'; // default slate-600
  const highlightColor = content.highlightColor || 'transparent';

  // Get colors
  const colors = PARAGRAPH_BG_COLORS[bgColor] || PARAGRAPH_BG_COLORS.blue;

  // Font size - handle both numeric and legacy string values
  let fontSizeStyle: string;
  if (typeof rawFontSize === 'number') {
    fontSizeStyle = `${rawFontSize}pt`;
  } else if (rawFontSize === 'small') {
    fontSizeStyle = fontSizes.small;
  } else if (rawFontSize === 'large') {
    fontSizeStyle = fontSizes.large;
  } else {
    fontSizeStyle = fontSizes.body; // default 'normal'
  }

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.style.height = 'auto';
      editorRef.current.style.height = `${editorRef.current.scrollHeight}px`;
    }
  }, []);

  // Focus editor when editing starts
  useEffect(() => {
    if (isEditing && editorRef.current) {
      editorRef.current.focus();
      // Place cursor at end
      const len = editorRef.current.value.length;
      editorRef.current.setSelectionRange(len, len);
      // Auto-resize on initial focus
      autoResize();
    }
  }, [isEditing, autoResize]);

  // Infobox wrapper style
  const wrapperStyle: React.CSSProperties = displayMode === 'infobox' 
    ? {
        backgroundColor: colors.bg,
        border: hasBorder ? `2px solid ${colors.border}` : 'none',
        borderRadius: '12px',
        padding: '16px',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
      }
    : {};

  // Strip HTML to get plain text
  const plainText = content.html?.replace(/<[^>]*>/g, '') || '';

  const textStyle: React.CSSProperties = {
    textAlign: align,
    fontSize: fontSizeStyle,
    fontFamily: FONT_FAMILY,
    lineHeight: 1.5,
    outline: 'none',
    minHeight: '1.5em',
    margin: 0,
    fontWeight: isBold ? 'bold' : 'normal',
    fontStyle: isItalic ? 'italic' : 'normal',
    textDecoration: isUnderline ? 'underline' : 'none',
    color: textColor,
    backgroundColor: highlightColor,
  };

  const handleInsertLatex = (latex: string) => {
    const newValue = plainText + ' ' + latex;
    onUpdate({ ...content, html: newValue });
  };

  if (isEditing) {
    return (
      <div
        style={wrapperStyle}
        className={displayMode === 'infobox' ? 'paragraph-infobox' : undefined}
        data-bg-color={displayMode === 'infobox' ? bgColor : undefined}
        data-has-border={displayMode === 'infobox' ? (hasBorder ? 'true' : 'false') : undefined}
      >
        {/* Editable content - use textarea for consistent font */}
        <textarea
          ref={editorRef}
          value={plainText}
          onChange={(e) => {
            onUpdate({ ...content, html: e.target.value });
            autoResize();
          }}
          onBlur={onBlur}
          onKeyDown={(e) => {
            // Allow Enter for new lines - don't prevent default
            if (e.key === 'Enter') {
              // Let the default behavior happen (insert newline)
              // Just trigger auto-resize after
              setTimeout(autoResize, 0);
              return;
            }
            // Pass other keys to parent handler (e.g., Escape)
            onKeyDown(e);
          }}
          onInput={autoResize}
          className="w-full bg-transparent border-none outline-none resize-none overflow-hidden"
          style={{ ...textStyle, minHeight: '40px' }}
          placeholder="Odstavec textu..."
        />
      </div>
    );
  }

  // Non-editing view - with LaTeX support
  return (
    <div
      style={wrapperStyle}
      className={displayMode === 'infobox' ? 'paragraph-infobox' : undefined}
      data-bg-color={displayMode === 'infobox' ? bgColor : undefined}
      data-has-border={displayMode === 'infobox' ? (hasBorder ? 'true' : 'false') : undefined}
    >
      <div 
        style={{ ...textStyle, whiteSpace: 'pre-wrap' }}
      >
        {plainText ? (
          <LatexRenderer text={plainText} />
        ) : (
          <span style={{ color: '#94a3b8' }}>Odstavec textu...</span>
        )}
      </div>
    </div>
  );
}

// ============================================
// INFOBOX EDITOR
// ============================================

interface InfoboxEditorProps {
  content: { title?: string; html: string; variant: 'blue' | 'green' | 'yellow' | 'purple' };
  isEditing: boolean;
  onUpdate: (content: any) => void;
  onBlur: (e: React.FocusEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  fontSizes: FontSizes;
}

function InfoboxEditor({ content, isEditing, onUpdate, onBlur, onKeyDown, fontSizes }: InfoboxEditorProps) {
  const titleRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const plainText = content.html?.replace(/<[^>]*>/g, '') || '';

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    if (textRef.current) {
      textRef.current.style.height = 'auto';
      textRef.current.style.height = `${textRef.current.scrollHeight}px`;
    }
  }, []);

  useEffect(() => {
    if (isEditing && titleRef.current) {
      titleRef.current.focus();
    }
    if (isEditing) {
      // Delay to ensure DOM is ready
      setTimeout(autoResize, 0);
    }
  }, [isEditing, autoResize]);

  const variantStyles = {
    blue: 'bg-blue-50 border-l-4 border-blue-500',
    green: 'bg-green-50 border-l-4 border-green-500',
    yellow: 'bg-yellow-50 border-l-4 border-yellow-500',
    purple: 'bg-purple-50 border-l-4 border-purple-500',
  };

  return (
    <div className={`p-4 rounded-lg ${variantStyles[content.variant]}`} style={{ fontSize: fontSizes.body }}>
      {isEditing ? (
        <>
          <input
            ref={titleRef}
            type="text"
            value={content.title || ''}
            onChange={(e) => onUpdate({ ...content, title: e.target.value })}
            onKeyDown={onKeyDown}
            className="w-full font-semibold text-slate-800 bg-transparent border-none outline-none mb-2"
            style={{ fontSize: fontSizes.title }}
            placeholder="Titulek (volitelný)..."
          />
          <textarea
            ref={textRef}
            value={plainText}
            onChange={(e) => {
              onUpdate({ ...content, html: `<p>${e.target.value}</p>` });
              autoResize();
            }}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
            onInput={autoResize}
            className="w-full text-slate-700 bg-transparent border-none outline-none resize-none overflow-hidden"
            style={{ fontSize: fontSizes.body, minHeight: '40px' }}
            placeholder="Text infoboxu..."
          />
        </>
      ) : (
        <>
          {content.title && (
            <h4 className="font-semibold mb-1 text-slate-800" style={{ fontSize: fontSizes.title }}>{content.title}</h4>
          )}
          <div 
            className="text-slate-700"
            style={{ fontSize: fontSizes.body }}
            dangerouslySetInnerHTML={{ 
              __html: content.html || '<p class="text-slate-400">Infobox...</p>' 
            }}
          />
        </>
      )}
    </div>
  );
}

// ============================================
// MULTIPLE CHOICE EDITOR
// ============================================

interface MultipleChoiceEditorProps {
  content: {
    question: string;
    options: ChoiceOption[];
    correctAnswers: string[];
    allowMultiple: boolean;
    explanation?: string;
  };
  isEditing: boolean;
  onUpdate: (content: any) => void;
  onBlur: (e: React.FocusEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  fontSizes: FontSizes;
  activityNumber?: number;
}

function MultipleChoiceEditor({ content, isEditing, onUpdate, onBlur, onKeyDown, fontSizes, activityNumber }: MultipleChoiceEditorProps) {
  const questionRef = useRef<HTMLTextAreaElement>(null);
  const variant = content.variant || 'text';
  const gridColumns = content.gridColumns || 1;
  const letterPosition = content.letterPosition || 'bottom';
  
  // Text styles for question
  const questionStyles: React.CSSProperties = {
    fontFamily: content.fontFamily || "'Fenomen Sans', sans-serif",
    fontSize: content.fontSize ? `${content.fontSize}pt` : fontSizes.title,
    fontWeight: content.fontWeight === 'bold' || content.isBold ? 'bold' : (content.fontWeight || '500'),
    color: content.textColor || '#1e293b',
    lineHeight: content.lineHeight || 1.2,
    letterSpacing: `${content.letterSpacing || 0}%`,
    textAlign: content.align || 'left',
    fontStyle: content.isItalic ? 'italic' : 'normal',
    textDecoration: content.isUnderline ? 'underline' : 'none',
  };

  // Text styles for options
  const optionTextStyles: React.CSSProperties = {
    fontFamily: content.fontFamily || "'Fenomen Sans', sans-serif",
    fontSize: content.fontSize ? `${Math.max(8, content.fontSize * 0.85)}pt` : fontSizes.body,
    fontWeight: content.fontWeight === 'bold' || content.isBold ? 'bold' : 'normal',
    color: content.textColor || '#475569',
    lineHeight: content.lineHeight || 1.5,
    letterSpacing: `${content.letterSpacing || 0}%`,
    fontStyle: content.isItalic ? 'italic' : 'normal',
    textDecoration: content.isUnderline ? 'underline' : 'none',
  };

  const correctAnswers = content.correctAnswers || [];
  const circleColor = content.circleColor || '#1e293b';
  const circleSize = content.circleSize || 21;

  const autoResize = useCallback(() => {
    if (questionRef.current) {
      questionRef.current.style.height = 'auto';
      questionRef.current.style.height = `${questionRef.current.scrollHeight}px`;
    }
  }, []);

  useEffect(() => {
    if (isEditing && questionRef.current) {
      questionRef.current.focus();
      setTimeout(autoResize, 0);
    }
  }, [isEditing, autoResize]);

  const handleQuestionChange = (value: string) => {
    onUpdate({ ...content, question: value });
  };

  const applyFormat = (command: string) => {
    const textarea = questionRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);

    if (!selectedText) return;

    let formattedText = '';
    switch (command) {
      case 'bold':
        formattedText = `**${selectedText}**`;
        break;
      case 'italic':
        formattedText = `*${selectedText}*`;
        break;
      case 'underline':
        formattedText = `<u>${selectedText}</u>`;
        break;
      default:
        return;
    }

    const newValue = text.substring(0, start) + formattedText + text.substring(end);
    handleQuestionChange(newValue);

    // Reset selection after state update
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start, start + formattedText.length);
    }, 0);
  };

  const handleOptionChange = (optionId: string, text: string) => {
    onUpdate({
      ...content,
      options: content.options.map(opt =>
        opt.id === optionId ? { ...opt, text } : opt
      ),
    });
  };

  const applyOptionFormat = (optionId: string, command: string) => {
    const option = content.options.find(o => o.id === optionId);
    if (!option) return;

    // We don't have refs for each option input, so we'll use a simpler approach
    // or just rely on the user manually typing markdown for now.
    // But since you asked for bold/italic on selection, I'll add a helper that
    // can be triggered if we find the active element.
    const activeEl = document.activeElement as HTMLInputElement;
    if (!activeEl || activeEl.tagName !== 'INPUT') return;

    const start = activeEl.selectionStart || 0;
    const end = activeEl.selectionEnd || 0;
    const text = activeEl.value;
    const selectedText = text.substring(start, end);

    if (!selectedText) return;

    let formattedText = '';
    switch (command) {
      case 'bold': formattedText = `**${selectedText}**`; break;
      case 'italic': formattedText = `*${selectedText}*`; break;
      case 'underline': formattedText = `<u>${selectedText}</u>`; break;
    }

    const newValue = text.substring(0, start) + formattedText + text.substring(end);
    handleOptionChange(optionId, newValue);
  };

  const removeOption = (optionId: string) => {
    if (content.options.length <= 2) return;
    onUpdate({
      ...content,
      options: content.options.filter(opt => opt.id !== optionId),
      correctAnswers: content.correctAnswers.filter(id => id !== optionId),
    });
  };

  // 1. ABC text
  const renderTextVariant = () => (
    <div 
      className="grid"
      style={{ 
        gridTemplateColumns: gridColumns === 4 
          ? 'repeat(auto-fill, minmax(160px, 1fr))' 
          : `repeat(${gridColumns}, minmax(0, 1fr))`,
        columnGap: '24px',
        rowGap: gridColumns <= 2 ? '12px' : '16px',
        marginTop: '12px'
      }}
    >
      {content.options.map((opt, i) => {
        const isCorrect = correctAnswers.includes(opt.id);
        return (
          <div key={opt.id} className="flex items-start gap-3 group/option min-w-0">
            {/* Circle with letter */}
            <div
              className={`flex items-center justify-center shrink-0 font-semibold choice-circle ${isCorrect ? 'choice-circle--correct' : ''}`}
              style={{
                width: `${circleSize}px`,
                height: `${circleSize}px`,
                minWidth: `${circleSize}px`,
                minHeight: `${circleSize}px`,
                borderRadius: '50%',
                border: isCorrect ? 'none' : `1.5px solid ${circleColor}`,
                color: isCorrect ? '#ffffff' : circleColor,
                backgroundColor: isCorrect ? '#22c55e' : 'transparent',
                fontSize: `${Math.round(circleSize * 0.57)}px`,
                marginTop: '2px'
              }}
            >
              {String.fromCharCode(65 + i)}
            </div>
            
            {/* Text area */}
            <div className="flex-1 min-w-0 leading-normal group/option-text relative">
              {isEditing ? (
                <div className="flex items-start gap-2 w-full relative">
                  <input
                    type="text"
                    value={opt.text}
                    onChange={(e) => handleOptionChange(opt.id, e.target.value)}
                    onBlur={onBlur}
                    onKeyDown={onKeyDown}
                    className="flex-1 bg-transparent border-none outline-none p-0 m-0 w-full min-w-0"
                    style={{ 
                      ...optionTextStyles, 
                      height: 'auto', 
                      lineHeight: optionTextStyles.lineHeight || 'normal',
                      padding: 0,
                      margin: 0
                    }}
                    placeholder={`Možnost ${i + 1}`}
                  />
                  {/* Mini format toolbar for options */}
                  <div className="absolute -top-7 left-0 flex items-center gap-1 bg-white border border-slate-200 rounded-md shadow-sm p-0.5 z-50 opacity-0 group-hover/option-text:opacity-100 transition-opacity">
                    <button
                      onMouseDown={(e) => { e.preventDefault(); applyOptionFormat(opt.id, 'bold'); }}
                      className="p-0.5 hover:bg-slate-100 rounded text-slate-600"
                    >
                      <Bold size={12} />
                    </button>
                    <button
                      onMouseDown={(e) => { e.preventDefault(); applyOptionFormat(opt.id, 'italic'); }}
                      className="p-0.5 hover:bg-slate-100 rounded text-slate-600"
                    >
                      <Italic size={12} />
                    </button>
                    <button
                      onMouseDown={(e) => { e.preventDefault(); applyOptionFormat(opt.id, 'underline'); }}
                      className="p-0.5 hover:bg-slate-100 rounded text-slate-600"
                    >
                      <Underline size={12} />
                    </button>
                  </div>
                  {content.options.length > 2 && (
                    <button
                      onClick={() => removeOption(opt.id)}
                      className="opacity-0 group-hover/option:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-all shrink-0"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ) : (
                <div 
                  style={{ 
                    ...optionTextStyles, 
                    lineHeight: optionTextStyles.lineHeight || 'normal',
                    padding: 0,
                    margin: 0
                  }} 
                  className="break-words"
                >
                  {opt.text ? (
                    <LatexRenderer text={opt.text} />
                  ) : (
                    <span className="text-slate-300 italic">Možnost {i + 1}...</span>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  // 2. ABC text + obr. (Mixed) AND 3. ABC obrázky
  const renderImageVariant = (isMixed: boolean) => (
    <div 
      className="grid gap-6 mt-4"
      style={{ 
        gridTemplateColumns: `repeat(${content.gridColumns || 4}, minmax(0, 1fr))` 
      }}
    >
      {content.options.map((opt, i) => {
        const isCorrect = correctAnswers.includes(opt.id);
        return (
          <div key={opt.id} className="relative group/opt flex flex-col">
            {/* Image Box */}
            <div 
              className="aspect-square bg-slate-50 rounded-xl border border-slate-300 relative mb-2"
              style={{ overflow: 'visible' }}
            >
              <div className="w-full h-full rounded-xl overflow-hidden relative">
                {opt.imageUrl ? (
                  <img src={opt.imageUrl} className="w-full h-full object-cover" alt={opt.text} style={{ display: 'block' }} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                    <ImageIcon className="w-8 h-8 opacity-20" />
                  </div>
                )}
                {isEditing && (
                  <div className="absolute inset-0 bg-black/5 opacity-0 group-hover/opt:opacity-100 transition-opacity pointer-events-none" />
                )}
              </div>

              {/* Letter Overlay */}
              {letterPosition === 'overlay' && (
                <div
                  className={`flex items-center justify-center font-semibold choice-circle ${isCorrect ? 'choice-circle--correct' : ''}`}
                  style={{
                    position: 'absolute',
                    top: '8px',
                    left: '8px',
                    width: `${circleSize + 3}px`,
                    height: `${circleSize + 3}px`,
                    borderRadius: '50%',
                    border: isCorrect ? 'none' : `1.5px solid ${circleColor}`,
                    color: isCorrect ? '#ffffff' : circleColor,
                    backgroundColor: isCorrect ? '#22c55e' : 'rgba(255,255,255,0.95)',
                    fontSize: `${Math.round(circleSize * 0.57)}px`,
                    zIndex: 100,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                    pointerEvents: 'none'
                  }}
                >
                  {String.fromCharCode(65 + i)}
                </div>
              )}
            </div>
            
            {/* Bottom section (Letter and Text) */}
            <div className="flex items-start gap-2 px-1 min-h-[24px]">
              {/* Letter Bottom */}
              {letterPosition === 'bottom' && (
                <div
                  className={`flex items-center justify-center shrink-0 font-semibold choice-circle ${isCorrect ? 'choice-circle--correct' : ''}`}
                  style={{
                    width: `${circleSize}px`,
                    height: `${circleSize}px`,
                    minWidth: `${circleSize}px`,
                    minHeight: `${circleSize}px`,
                    borderRadius: '50%',
                    border: isCorrect ? 'none' : `1.5px solid ${circleColor}`,
                    color: isCorrect ? '#ffffff' : circleColor,
                    backgroundColor: isCorrect ? '#22c55e' : 'transparent',
                    fontSize: `${Math.round(circleSize * 0.57)}px`,
                    marginTop: '1px'
                  }}
                >
                  {String.fromCharCode(65 + i)}
                </div>
              )}

              {/* Text - ONLY visible in Mixed variant */}
              {isMixed && (
                <div className="flex-1 min-w-0 leading-tight group/mixed-text relative">
                  {isEditing ? (
                    <div className="relative">
                      <input
                        type="text"
                        value={opt.text}
                        onChange={(e) => handleOptionChange(opt.id, e.target.value)}
                        onBlur={onBlur}
                        onKeyDown={onKeyDown}
                        className="w-full bg-transparent border-none outline-none p-0 m-0 w-full"
                        style={{ 
                          ...optionTextStyles, 
                          lineHeight: optionTextStyles.lineHeight || 'tight',
                          padding: 0,
                          margin: 0
                        }}
                        placeholder={`Možnost ${i + 1}`}
                      />
                      {/* Mini format toolbar for mixed options */}
                      <div className="absolute -top-7 left-0 flex items-center gap-1 bg-white border border-slate-200 rounded-md shadow-sm p-0.5 z-50 opacity-0 group-hover/mixed-text:opacity-100 transition-opacity">
                        <button
                          onMouseDown={(e) => { e.preventDefault(); applyOptionFormat(opt.id, 'bold'); }}
                          className="p-0.5 hover:bg-slate-100 rounded text-slate-600"
                        >
                          <Bold size={12} />
                        </button>
                        <button
                          onMouseDown={(e) => { e.preventDefault(); applyOptionFormat(opt.id, 'italic'); }}
                          className="p-0.5 hover:bg-slate-100 rounded text-slate-600"
                        >
                          <Italic size={12} />
                        </button>
                        <button
                          onMouseDown={(e) => { e.preventDefault(); applyOptionFormat(opt.id, 'underline'); }}
                          className="p-0.5 hover:bg-slate-100 rounded text-slate-600"
                        >
                          <Underline size={12} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div 
                      style={{ 
                        ...optionTextStyles, 
                        lineHeight: optionTextStyles.lineHeight || 'tight',
                        padding: 0,
                        margin: 0
                      }} 
                      className="break-words"
                    >
                      {opt.text ? (
                        <LatexRenderer text={opt.text} />
                      ) : (
                        <span className="text-slate-300 italic">Možnost {i + 1}...</span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Delete button when editing */}
            {isEditing && content.options.length > 2 && (
              <button
                onClick={() => removeOption(opt.id)}
                className="absolute -top-2 -right-2 bg-white border border-slate-200 rounded-full p-1 shadow-sm text-slate-400 hover:text-red-500 opacity-0 group-hover/opt:opacity-100 transition-all z-20"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );

  // 4. Ano / Ne (Boolean)
  const renderBooleanVariant = () => (
    <div 
      className="grid gap-x-6"
      style={{ 
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        rowGap: '12px',
        marginTop: '12px'
      }}
    >
      {[
        { id: 'opt-bool-0', text: 'Ano' },
        { id: 'opt-bool-1', text: 'Ne' }
      ].map((opt, i) => {
        const isCorrect = correctAnswers.includes(opt.id);
        return (
          <div 
            key={opt.id} 
            className="flex items-center gap-3 group/option cursor-pointer min-w-0"
            onClick={() => isEditing && onUpdate({ ...content, correctAnswers: [opt.id] })}
          >
          <div
            className={`flex items-center justify-center shrink-0 font-semibold choice-circle ${isCorrect ? 'choice-circle--correct' : ''}`}
            style={{
              width: `${circleSize}px`,
              height: `${circleSize}px`,
              minWidth: `${circleSize}px`,
              minHeight: `${circleSize}px`,
              borderRadius: '50%',
              border: isCorrect ? 'none' : `1.5px solid ${circleColor}`,
              color: isCorrect ? '#ffffff' : circleColor,
              backgroundColor: isCorrect ? '#22c55e' : 'transparent',
              fontSize: `${Math.round(circleSize * 0.57)}px`,
            }}
          >
            {String.fromCharCode(65 + i)}
          </div>
            
            <div className="flex-1 leading-normal min-w-0">
              <div style={optionTextStyles} className="font-bold">
                {opt.text}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div style={{ fontSize: fontSizes.body }}>
      {/* Question section */}
      <div className="flex items-start gap-3 mb-3">
        {activityNumber && (
          <div
            className="flex items-center justify-center shrink-0 font-bold text-white activity-number-circle"
            style={{ 
              width: `${circleSize}px`,
              height: `${circleSize}px`,
              minWidth: `${circleSize}px`,
              minHeight: `${circleSize}px`,
              borderRadius: '50%',
              backgroundColor: circleColor,
              fontSize: `${Math.round(circleSize * 0.57)}px`,
            }}
          >
            {activityNumber}
          </div>
        )}
        <div className="flex-1 relative group/question">
          {isEditing ? (
            <div className="relative">
              <textarea
                ref={questionRef}
                value={content.question}
                onChange={(e) => {
                  handleQuestionChange(e.target.value);
                  autoResize();
                }}
                onBlur={onBlur}
                onKeyDown={onKeyDown}
                onInput={autoResize}
                className="w-full bg-transparent border-none outline-none resize-none overflow-hidden p-0 m-0 display-block"
                style={{ 
                  ...questionStyles,
                  minHeight: '1.5em',
                  lineHeight: questionStyles.lineHeight || 1.2
                }}
                placeholder="Zadejte otázku..."
                rows={1}
              />
              {/* Mini format toolbar for selection */}
              <div className="absolute -top-8 left-0 flex items-center gap-1 bg-white border border-slate-200 rounded-lg shadow-sm p-1 z-50 opacity-0 group-hover/question:opacity-100 transition-opacity">
                <button
                  onMouseDown={(e) => { e.preventDefault(); applyFormat('bold'); }}
                  className="p-1 hover:bg-slate-100 rounded text-slate-600"
                  title="Tučné"
                >
                  <Bold size={14} />
                </button>
                <button
                  onMouseDown={(e) => { e.preventDefault(); applyFormat('italic'); }}
                  className="p-1 hover:bg-slate-100 rounded text-slate-600"
                  title="Kurzíva"
                >
                  <Italic size={14} />
                </button>
                <button
                  onMouseDown={(e) => { e.preventDefault(); applyFormat('underline'); }}
                  className="p-1 hover:bg-slate-100 rounded text-slate-600"
                  title="Podtržené"
                >
                  <Underline size={14} />
                </button>
              </div>
            </div>
          ) : (
            <div style={{ ...questionStyles, margin: 0, padding: 0, minHeight: '1.5em' }}>
              {content.question ? (
                <LatexRenderer text={content.question} />
              ) : (
                <span className="text-slate-400">Otázka...</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Answer options based on variant */}
      {(() => {
        switch (variant) {
          case 'text': return renderTextVariant();
          case 'mixed': return renderImageVariant(true);
          case 'image': return renderImageVariant(false);
          case 'boolean': return renderBooleanVariant();
          default: return renderTextVariant();
        }
      })()}
    </div>
  );
}

// ============================================
// FILL BLANK EDITOR
// ============================================

interface FillBlankEditorProps {
  content: {
    instruction?: string;
    segments: Array<
      | { type: 'text'; content: string }
      | { type: 'blank'; id: string; correctAnswer: string; acceptedAnswers?: string[] }
    >;
  };
  isEditing: boolean;
  onUpdate: (content: any) => void;
  onBlur: (e: React.FocusEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  fontSizes: FontSizes;
  activityNumber?: number;
}

function FillBlankEditor({ content, isEditing, onUpdate, onBlur, onKeyDown, fontSizes, activityNumber }: FillBlankEditorProps) {
  const instructionRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  // Convert segments to editable text with [brackets]
  const segmentsToText = (segments: FillBlankSegment[]) => {
    return segments.map(s => s.type === 'text' ? s.content : `[${s.correctAnswer}]`).join('');
  };

  // Convert editable text with [brackets] back to segments
  const textToSegments = (text: string): FillBlankSegment[] => {
    const segments: FillBlankSegment[] = [];
    const regex = /\[([^\]]+)\]/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ type: 'text', content: text.substring(lastIndex, match.index) });
      }
      segments.push({ 
        type: 'blank', 
        id: `blank-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, 
        correctAnswer: match[1] 
      });
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      segments.push({ type: 'text', content: text.substring(lastIndex) });
    }

    return segments.length > 0 ? segments : [{ type: 'text', content: '' }];
  };

  useEffect(() => {
    if (isEditing && instructionRef.current) {
      instructionRef.current.focus();
    }
  }, [isEditing]);

  const [localText, setLocalText] = useState(segmentsToText(content.segments));

  useEffect(() => {
    if (!isEditing) {
      setLocalText(segmentsToText(content.segments));
    }
  }, [isEditing, content.segments]);

  const insertBlank = () => {
    if (!textRef.current) return;
    const start = textRef.current.selectionStart;
    const end = textRef.current.selectionEnd;
    const text = textRef.current.value;
    const selectedText = text.substring(start, end) || 'odpověď';
    const before = text.substring(0, start);
    const after = text.substring(end);
    const newText = `${before}[${selectedText}]${after}`;
    
    setLocalText(newText);
    onUpdate({ ...content, segments: textToSegments(newText) });
    
    // Focus back and select the placeholder text inside brackets
    setTimeout(() => {
      if (textRef.current) {
        textRef.current.focus();
        textRef.current.setSelectionRange(start + 1, start + 1 + selectedText.length);
      }
    }, 0);
  };

  return (
    <div style={{ fontSize: fontSizes.body }}>
      <div className="flex items-start gap-3">
        {activityNumber && (
          <div
            className="flex items-center justify-center shrink-0 font-bold text-white"
            style={{ 
              width: '21px',
              height: '21px',
              minWidth: '21px',
              minHeight: '21px',
              borderRadius: '50%',
              backgroundColor: '#1e293b',
              fontSize: '12px',
            }}
          >
            {activityNumber}
          </div>
        )}
        <div className="flex-1">
          {isEditing ? (
            <div className="space-y-3 bg-slate-50/50 p-4 rounded-2xl border-2 border-slate-100">
              <div className="flex items-center justify-between gap-4">
                <input
                  ref={instructionRef}
                  type="text"
                  value={content.instruction || ''}
                  onChange={(e) => onUpdate({ ...content, instruction: e.target.value })}
                  onKeyDown={onKeyDown}
                  className="flex-1 text-slate-500 bg-transparent border-none outline-none font-medium"
                  style={{ fontSize: fontSizes.small }}
                  placeholder="Instrukce (např. Doplňte chybějící slova)..."
                />
                <button
                  onClick={insertBlank}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-purple-600 hover:border-purple-300 hover:bg-purple-50 transition-all shadow-sm shrink-0"
                >
                  <Plus size={14} />
                  Vytvořit mezeru
                </button>
              </div>
              
              <textarea
                ref={textRef}
                value={localText}
                onChange={(e) => {
                  setLocalText(e.target.value);
                  onUpdate({ ...content, segments: textToSegments(e.target.value) });
                }}
                className="w-full bg-white p-4 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-purple-500/20 text-slate-700 min-h-[120px] resize-none shadow-inner"
                style={{ fontSize: fontSizes.body }}
                placeholder="Napište text a slova k doplnění dejte do hranatých závorek, např. [slovo]..."
              />
              
              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                <Info size={12} />
                <span>Tip: Označte slovo a klikněte na „Vytvořit mezeru“ nebo pište přímo <strong>[slovo]</strong>.</span>
              </div>
            </div>
          ) : (
            <>
              {content.instruction && (
                <p className="text-slate-500 mb-2 font-medium" style={{ fontSize: fontSizes.small }}>
                  <LatexRenderer text={content.instruction} />
                </p>
              )}
              <p className="text-slate-700 leading-relaxed" style={{ fontSize: fontSizes.body }}>
                {content.segments.map((seg, i) => (
                  <span key={i}>
                    {seg.type === 'text' ? (
                      <LatexRenderer text={seg.content} />
                    ) : (
                      <span className="inline-block min-w-[80px] border-b-2 border-slate-400 text-center mx-1 px-1">
                        <span className="text-slate-400 opacity-0 print:opacity-0" style={{ fontSize: fontSizes.small }}>{seg.correctAnswer || '...'}</span>
                      </span>
                    )}
                  </span>
                ))}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// FREE ANSWER EDITOR
// ============================================

interface FreeAnswerEditorProps {
  content: {
    question: string;
    lines: number;
    hint?: string;
    sampleAnswer?: string;
  };
  isEditing: boolean;
  onUpdate: (content: any) => void;
  onBlur: (e: React.FocusEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  fontSizes: FontSizes;
  activityNumber?: number;
}

function FreeAnswerEditor({ content, isEditing, onUpdate, onBlur, onKeyDown, fontSizes, activityNumber }: FreeAnswerEditorProps) {
  const questionRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    if (questionRef.current) {
      questionRef.current.style.height = 'auto';
      questionRef.current.style.height = `${questionRef.current.scrollHeight}px`;
    }
  }, []);

  useEffect(() => {
    if (isEditing && questionRef.current) {
      questionRef.current.focus();
      setTimeout(autoResize, 0);
    }
  }, [isEditing, autoResize]);

  const handleInsertLatex = (latex: string) => {
    onUpdate({ ...content, question: content.question + ' ' + latex });
  };

  return (
    <div style={{ fontSize: fontSizes.body }}>
      {/* Question with optional activity number */}
      <div className="flex items-start gap-3 mb-3">
        {activityNumber && (
          <div
            className="flex items-center justify-center shrink-0 font-bold text-white"
            style={{ 
              width: '21px',
              height: '21px',
              minWidth: '21px',
              minHeight: '21px',
              borderRadius: '50%',
              backgroundColor: '#1e293b',
              fontSize: '12px',
            }}
          >
            {activityNumber}
          </div>
        )}
        <div className="flex-1">
          {isEditing ? (
            <textarea
              ref={questionRef}
              value={content.question}
              onChange={(e) => {
                onUpdate({ ...content, question: e.target.value });
                autoResize();
              }}
              onKeyDown={onKeyDown}
              onInput={autoResize}
              className="w-full font-medium text-slate-800 bg-transparent border-none outline-none resize-none overflow-hidden"
              style={{ fontSize: fontSizes.title, minHeight: '1.5em' }}
              placeholder="Zadejte otázku..."
              rows={1}
            />
          ) : (
            <p className="font-medium text-slate-800" style={{ fontSize: fontSizes.title }}>
              {content.question ? (
                <LatexRenderer text={content.question} />
              ) : (
                <span className="text-slate-400">Otázka...</span>
              )}
            </p>
          )}
        </div>
      </div>

      {content.hint && (
        <p className="text-slate-500 mb-1 italic" style={{ fontSize: fontSizes.small, paddingLeft: activityNumber ? '40px' : 0 }}>
          <LatexRenderer text={content.hint} />
        </p>
      )}

      <div 
        className="mt-1"
        style={{ height: `${content.lines * 40}px`, marginLeft: activityNumber ? '40px' : 0 }}
      >
        {Array.from({ length: content.lines }).map((_, i) => (
          <div key={i} className="border-b border-slate-300" style={{ height: '40px' }} />
        ))}
      </div>
    </div>
  );
}

// ============================================
// SPACER EDITOR
// ============================================

interface SpacerEditorProps {
  content: {
    height: number;
    style: SpacerStyle;
  };
  isEditing: boolean;
  onUpdate: (content: any) => void;
}

function SpacerEditor({ content, isEditing, onUpdate }: SpacerEditorProps) {
  const [isResizing, setIsResizing] = useState(false);
  // Track height locally during drag for smoothness
  const [localHeight, setLocalHeight] = useState<number | null>(null);

  // Default values for safety
  const height = localHeight ?? content?.height ?? 100;
  const style = content?.style ?? 'empty';

  // Handle vertical resize drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);

    const startY = e.clientY;
    const startHeight = content?.height ?? 100;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientY - startY;
      const newHeight = Math.max(20, Math.min(1000, startHeight + delta));
      setLocalHeight(newHeight);
      onUpdate({ height: newHeight, style });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setLocalHeight(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, [content?.height, style, onUpdate]);

  // Render pattern based on style
  const renderPattern = () => {
    const lineSpacing = 40; // px between lines (increased by 70%)
    
    switch (style) {
      case 'dotted':
        return <PrintSafePattern key={`dotted-${height}`} variant="dotted" />;
      case 'lined':
        return <PrintSafePattern key={`lined-${height}`} variant="lined" lineSpacing={lineSpacing} />;
      case 'empty':
      default:
        return null;
    }
  };

  return (
    <div 
      className={`relative ${isEditing ? 'ring-1 ring-blue-400 ring-dashed' : ''}`}
      style={{ height }}
    >
      {renderPattern()}
      
      {/* Resize handle */}
      {isEditing && (
        <div
          onMouseDown={handleMouseDown}
          className={`
            absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-4 cursor-row-resize
            flex items-center justify-center
            z-[1000]
          `}
          style={{ bottom: -8 }}
        >
          <div 
            className={`
              w-10 h-3 rounded-full border-2 transition-colors
              ${isResizing 
                ? 'bg-blue-500 border-blue-500' 
                : 'bg-white border-slate-300 hover:border-blue-400'
              }
            `}
          />
        </div>
      )}
    </div>
  );
}

// ============================================
// QR CODE EDITOR
// ============================================

interface QRCodeEditorProps {
  content: QRCodeContent;
  isEditing: boolean;
  onUpdate: (content: QRCodeContent) => void;
}

function QRCodeEditor({ content, isEditing, onUpdate }: QRCodeEditorProps) {
  const { url, caption, captionPosition, size = 150 } = content;
  const inputRef = useRef<HTMLInputElement>(null);
  const captionRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && !url && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing, url]);

  return (
    <div className="flex flex-col gap-4 py-4">
      {isEditing ? (
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Odkaz / Text pro QR kód</label>
              <input
                ref={inputRef}
                type="text"
                value={url}
                onChange={(e) => onUpdate({ ...content, url: e.target.value })}
                placeholder="https://vividbooks.com..."
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Popisek</label>
              <textarea
                ref={captionRef}
                value={caption}
                onChange={(e) => onUpdate({ ...content, caption: e.target.value })}
                placeholder="Naskenujte pro více informací..."
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none min-h-[60px]"
              />
            </div>
          </div>
        </div>
      ) : null}

      <div className={`flex ${captionPosition === 'left' ? 'flex-row-reverse' : 'flex-col'} items-center gap-4 w-full`}>
        <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-100 flex-shrink-0">
          {url ? (
            <QRCodeSVG value={url} size={size} level="M" includeMargin={false} />
          ) : (
            <div 
              className="bg-slate-50 flex items-center justify-center rounded border border-dashed border-slate-200"
              style={{ width: size, height: size }}
            >
              <QrCode className="w-8 h-8 text-slate-300" />
            </div>
          )}
        </div>
        
        {caption && (
          <div className={`text-slate-600 leading-relaxed flex-1 min-w-0 break-words ${captionPosition === 'left' ? 'text-left' : 'text-center'}`} style={{ fontSize: '11pt' }}>
            {caption}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// EXAMPLES EDITOR
// ============================================

interface ExamplesEditorProps {
  content: ExamplesContent;
  isEditing: boolean;
  onUpdate: (content: ExamplesContent) => void;
}

function ExamplesEditor({ content, isEditing, onUpdate }: ExamplesEditorProps) {
  const { examples, columns, labelType, showDifficultyColors } = content;
  const answerBoxStyle: AnswerBoxStyle = content.answerBoxStyle || 'block';
  const rowSpacing = content.rowSpacing || 16; // default 16px
  const fontSize = content.fontSize || 14; // default 14px
  const [editingId, setEditingId] = useState<string | null>(null);

  // Update single example expression
  const handleExpressionChange = (id: string, newExpression: string) => {
    const updatedExamples = examples.map(ex => 
      ex.id === id ? { ...ex, expression: newExpression } : ex
    );
    onUpdate({ ...content, examples: updatedExamples });
  };

  // Get label for example
  const getLabel = (index: number): string => {
    if (labelType === 'none') return '';
    if (labelType === 'numbers') return `${index + 1}`;
    // letters: A, B, C, ...
    return String.fromCharCode(65 + index);
  };

  // Get difficulty color
  const getDifficultyColor = (difficulty: ExampleDifficulty): string => {
    if (!showDifficultyColors) return '#9ca3af'; // gray-400 when colors off
    switch (difficulty) {
      case 'easy': return '#22c55e'; // green-500
      case 'medium': return '#f97316'; // orange-500
      case 'hard': return '#ef4444'; // red-500
      default: return '#9ca3af';
    }
  };

  // Get answer box background color
  const getAnswerBoxBg = (difficulty: ExampleDifficulty): string => {
    if (!showDifficultyColors) return '#f1f5f9'; // slate-100 when colors off
    switch (difficulty) {
      case 'easy': return '#dcfce7'; // green-100
      case 'medium': return '#ffedd5'; // orange-100
      case 'hard': return '#fee2e2'; // red-100
      default: return '#f1f5f9';
    }
  };

  // Get answer box border color for line style
  const getAnswerBoxBorder = (difficulty: ExampleDifficulty): string => {
    if (!showDifficultyColors) return '#9ca3af'; // gray-400 when colors off
    switch (difficulty) {
      case 'easy': return '#22c55e'; // green-500
      case 'medium': return '#f97316'; // orange-500
      case 'hard': return '#ef4444'; // red-500
      default: return '#9ca3af';
    }
  };

  // If no examples, show placeholder
  if (examples.length === 0) {
    return (
      <div 
        className={`
          flex items-center justify-center py-12 rounded-xl border-2 border-dashed
          ${isEditing ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-slate-50'}
        `}
      >
        <div className="text-center">
          <p className="text-slate-500 font-medium">Příklady</p>
          <p className="text-sm text-slate-400 mt-1">
            {isEditing 
              ? 'Klikněte na "Nastavení" a zadejte vzorový příklad'
              : 'Žádné příklady k zobrazení'
            }
          </p>
        </div>
      </div>
    );
  }

  // Calculate actual row spacing - bigger when answer boxes are shown
  const actualRowSpacing = answerBoxStyle !== 'none' ? rowSpacing + 8 : rowSpacing;

  return (
    <div 
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        columnGap: '32px',
        rowGap: `${actualRowSpacing}px`,
      }}
    >
      {examples.map((example, index) => (
        <div 
          key={example.id} 
          className="flex items-center gap-2"
        >
          {/* Label/bullet - only show if labelType is not 'none' */}
          {labelType !== 'none' && (
            <div 
              className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center"
              style={{ 
                border: `2px solid ${getDifficultyColor(example.difficulty)}`,
              }}
            >
              <span 
                className="text-xs font-bold"
                style={{ color: getDifficultyColor(example.difficulty) }}
              >
                {getLabel(index)}
              </span>
            </div>
          )}

          {/* Bullet point for 'none' label type */}
          {labelType === 'none' && (
            <div 
              className="flex-shrink-0 w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: getDifficultyColor(example.difficulty) }}
            />
          )}

          {/* Expression - editable when clicked */}
          {editingId === example.id ? (
            <input
              type="text"
              value={example.expression}
              onChange={(e) => handleExpressionChange(example.id, e.target.value)}
              onBlur={() => setEditingId(null)}
              onKeyDown={(e) => e.key === 'Enter' && setEditingId(null)}
              autoFocus
              className="text-slate-800 font-medium bg-blue-50 border border-blue-300 rounded px-1 outline-none"
              style={{ fontSize: `${fontSize}px`, minWidth: '80px' }}
            />
          ) : (
            <span 
              className="text-slate-800 font-medium whitespace-nowrap cursor-text hover:bg-slate-100 rounded px-1 -mx-1"
              style={{ fontSize: `${fontSize}px` }}
              onClick={() => isEditing && setEditingId(example.id)}
              title={isEditing ? 'Klikněte pro úpravu' : ''}
            >
              {example.expression}
            </span>
          )}

          {/* Answer box - block style */}
          {answerBoxStyle === 'block' && (
            <div 
              className="rounded-lg"
              style={{ 
                backgroundColor: getAnswerBoxBg(example.difficulty),
                minWidth: '60px',
                maxWidth: '90px',
                height: '28px',
                flex: 1,
              }}
            />
          )}

          {/* Answer box - line style */}
          {answerBoxStyle === 'line' && (
            <div 
              style={{ 
                borderBottom: `2px solid ${getAnswerBoxBorder(example.difficulty)}`,
                minWidth: '60px',
                maxWidth: '90px',
                height: '24px',
                flex: 1,
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================
// IMAGE EDITOR
// ============================================

interface ImageEditorProps {
  content: ImageContent;
  isEditing: boolean;
  onUpdate: (content: any) => void;
}

function ImageEditor({ content, isEditing, onUpdate }: ImageEditorProps) {
  const { 
    url, 
    alt, 
    caption, 
    showCaption = true, 
    size = 100, 
    alignment = 'center',
    gallery = [],
    galleryLayout = 'grid',
    gridColumns = 2,
    containerHeight = 0,
    imageActivityType = 'none'
  } = content;
  
  // Hooks must be before any early returns!
  const [isLoading, setIsLoading] = useState(true);
  
  const { openAssetPicker, AssetPickerModal } = useAssetPicker({
    onSelect: (result) => {
      onUpdate({ ...content, url: result.url, gallery: [result.url] });
    },
  });

  const displayImages = (gallery.length > 0 ? gallery : [url]).filter(u => !!u);
  const hasGallery = displayImages.length > 1;

  // Size and Crop logic
  const zoomFactor = size > 100 ? size / 100 : 1;
  
  // Pro galerii držíme šířku (obrázky na pozicích) a zmenšujeme jen výšku.
  // Pro samostatný obrázek zmenšujeme šířku standardně.
  const containerMaxWidth = (hasGallery || size > 100) ? '100%' : `${size}%`;

  // Alignment to justify-content mapping
  const alignmentToJustify: Record<string, string> = {
    left: 'flex-start',
    center: 'center',
    right: 'flex-end',
  };

  // No image URL and no gallery - show placeholder
  if (displayImages.length === 0) {
    return (
      <>
        <div 
          className="flex flex-col items-center justify-center py-8 px-4 border-2 border-dashed border-slate-300 rounded-lg bg-slate-50 w-full"
        >
          <ImageIcon className="w-12 h-12 text-slate-400 mb-2" />
          <p className="text-slate-500 text-sm mb-2">Žádný obrázek</p>
          {isEditing && (
            <button
              onClick={openAssetPicker}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors"
            >
              Vybrat obrázek
            </button>
          )}
        </div>
        
        {AssetPickerModal}
      </>
    );
  }

  const renderSingleImage = (imgUrl: string, index?: number) => {
    // Základní výška pro mřížku (pokud není nastavena explicitně)
    const baseHeight = containerHeight > 0 ? containerHeight : 250;
    
    // Výpočet výšky: pro galerii měníme při size < 100 pouze výšku políček
    const currentHeight = hasGallery 
      ? (size < 100 ? (size / 100) * baseHeight : baseHeight)
      : (containerHeight > 0 ? containerHeight : 'auto');

    const itemCaption = (content.galleryCaptions || [])[index ?? 0];

    return (
      <div key={index ?? 0} className="relative w-full flex flex-col">
        {/* Image Container with Markers */}
        <div className="relative w-full">
          <div 
            className="relative overflow-hidden rounded-lg w-full flex items-center justify-center bg-slate-50"
            style={{ 
              height: typeof currentHeight === 'number' ? `${currentHeight}px` : currentHeight,
            }}
          >
            {/* Main Image */}
            <img
              src={imgUrl}
              alt={alt || ''}
              className="w-full transition-opacity duration-300"
              style={{ 
                opacity: isLoading ? 0.5 : 1,
                height: currentHeight === 'auto' ? 'auto' : '100%',
                objectFit: (hasGallery || size > 100 || containerHeight > 0) ? 'cover' : 'contain',
                transform: size > 100 ? `scale(${zoomFactor})` : 'none',
                transformOrigin: 'center center',
              }}
              onLoad={() => setIsLoading(false)}
            />
          </div>

          {/* Activity Overlays - positioned relative to image container, outside overflow-hidden */}
          {imageActivityType === 'text-input' && (
            <div 
              className="absolute shadow-lg pointer-events-none"
              style={{
                bottom: '12px',
                left: '12px',
                right: '12px',
                height: '32px',
                backgroundColor: '#ffffff',
                border: '2.5px solid #334155',
                borderRadius: '8px',
                zIndex: 50,
              }}
            />
          )}
          {imageActivityType === 'checkbox-circle' && (
            <div 
              className="absolute shadow-lg pointer-events-none"
              style={{
                top: '12px',
                right: '12px',
                width: '32px',
                height: '32px',
                backgroundColor: '#ffffff',
                border: '2.5px solid #334155',
                borderRadius: '50%',
                zIndex: 50,
              }}
            />
          )}
          {imageActivityType === 'checkbox-square' && (
            <div 
              className="absolute shadow-lg pointer-events-none"
              style={{
                top: '12px',
                left: '12px',
                width: '32px',
                height: '32px',
                backgroundColor: '#ffffff',
                border: '2.5px solid #334155',
                borderRadius: '6px',
                zIndex: 50,
              }}
            />
          )}
        </div>

        {/* Individual Item Caption */}
        {hasGallery && itemCaption && (
          <div className="mt-1.5 text-center text-[11px] font-medium text-slate-600 px-1 leading-tight">
            {itemCaption}
          </div>
        )}
      </div>
    );
  };

  return (
    <div 
      className="flex flex-col group/image w-full"
      style={{ alignItems: hasGallery ? 'stretch' : alignmentToJustify[alignment] }}
    >
      <div className="relative w-full" style={{ maxWidth: containerMaxWidth }}>
        
        {/* Grid Layout (handles 1 or more images) */}
        <div 
          className="grid gap-4 w-full"
          style={{ 
            gridTemplateColumns: displayImages.length > 1 
              ? `repeat(${gridColumns}, minmax(0, 1fr))` 
              : '1fr'
          }}
        >
          {displayImages.map((imgUrl, idx) => renderSingleImage(imgUrl, idx))}
        </div>

      </div>
      
      {showCaption && caption && (
        <div className="mt-2 text-slate-500 text-sm text-center w-full">
          {caption}
        </div>
      )}
      
      {AssetPickerModal}
    </div>
  );
}

// ============================================
// TABLE EDITOR
// ============================================

interface TableEditorProps {
  content: TableContent;
  isEditing: boolean;
  onUpdate: (content: TableContent) => void;
  onBlur: (e: React.FocusEvent) => void;
}

function TableEditor({ content, isEditing, onUpdate, onBlur }: TableEditorProps) {
  const editorWrapperRef = useRef<HTMLDivElement>(null);
  const [hasBorder, setHasBorder] = useState(content.hasBorder);
  const [hasRoundedCorners, setHasRoundedCorners] = useState(content.hasRoundedCorners);
  const [colorStyle, setColorStyle] = useState(content.colorStyle || 'default');

  // Click outside detection to close editing
  useEffect(() => {
    if (!isEditing) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      const container = editorWrapperRef.current;
      if (container && !container.contains(e.target as Node)) {
        // Trigger blur to close editing
        onBlur({ currentTarget: container, relatedTarget: null } as unknown as React.FocusEvent);
      }
    };

    // Small delay to prevent immediate triggering
    const timeout = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isEditing, onBlur]);
  
  // Generate table HTML from rows/columns if html is empty
  const generateTableHTML = (rows: number, cols: number, hasHeader: boolean): string => {
    let html = '<table>';
    for (let r = 0; r < rows; r++) {
      if (r === 0 && hasHeader) {
        html += '<thead><tr>';
        for (let c = 0; c < cols; c++) {
          html += '<th></th>';
        }
        html += '</tr></thead><tbody>';
      } else {
        if (r === 1 && hasHeader) {
          // Already opened tbody
        } else if (r === 0 && !hasHeader) {
          html += '<tbody>';
        }
        html += '<tr>';
        for (let c = 0; c < cols; c++) {
          html += '<td></td>';
        }
        html += '</tr>';
      }
    }
    html += '</tbody></table>';
    return html;
  };

  const initialHTML = content.html || generateTableHTML(content.rows, content.columns, content.hasHeader);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        blockquote: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'worksheet-table',
        },
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: initialHTML,
    editable: true, // Always editable
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      onUpdate({
        ...content,
        html,
        hasBorder,
        hasRoundedCorners,
        colorStyle,
      });
    },
  });

  // Apply styles to table element
  useEffect(() => {
    if (editorWrapperRef.current) {
      const table = editorWrapperRef.current.querySelector('table');
      if (table) {
        // Apply border class
        if (!hasBorder) {
          table.classList.add('no-border');
        } else {
          table.classList.remove('no-border');
        }
        // Apply rounded corners class
        if (!hasRoundedCorners) {
          table.classList.add('no-rounded');
        } else {
          table.classList.remove('no-rounded');
        }
        // Apply color style
        if (colorStyle && colorStyle !== 'default') {
          const colorMap: Record<string, { header: string; border: string }> = {
            blue: { header: '#dbeafe', border: '#3b82f6' },
            green: { header: '#dcfce7', border: '#22c55e' },
            purple: { header: '#f3e8ff', border: '#a855f7' },
            yellow: { header: '#fef3c7', border: '#f59e0b' },
            red: { header: '#fee2e2', border: '#ef4444' },
            pink: { header: '#fce7f3', border: '#ec4899' },
            cyan: { header: '#cffafe', border: '#06b6d4' },
          };
          const colors = colorMap[colorStyle];
          if (colors) {
            table.style.setProperty('--table-header-bg', colors.header);
            table.style.setProperty('--table-border-color', colors.border);
          }
        } else {
          table.style.removeProperty('--table-header-bg');
          table.style.removeProperty('--table-border-color');
        }
      }
    }
  }, [hasBorder, hasRoundedCorners, colorStyle, editor]);

  const applyColorStyle = (style: string) => {
    setColorStyle(style as TableContent['colorStyle']);
    onUpdate({
      ...content,
      html: editor?.getHTML() || content.html,
      colorStyle: style as TableContent['colorStyle'],
    });
  };

  const toggleBorder = (checked: boolean) => {
    setHasBorder(checked);
    onUpdate({
      ...content,
      html: editor?.getHTML() || content.html,
      hasBorder: checked,
    });
  };

  const toggleRoundedCorners = (checked: boolean) => {
    setHasRoundedCorners(checked);
    onUpdate({
      ...content,
      html: editor?.getHTML() || content.html,
      hasRoundedCorners: checked,
    });
  };

  if (!editor) return null;

  return (
    <div 
      className="worksheet-table-container relative" 
      ref={editorWrapperRef} 
      style={{ paddingTop: isEditing ? '50px' : '0', paddingBottom: isEditing ? '60px' : '0' }}
      onBlur={(e) => {
        // Check if focus is moving outside the table container
        const container = editorWrapperRef.current;
        const relatedTarget = e.relatedTarget as HTMLElement | null;
        if (container && relatedTarget && !container.contains(relatedTarget)) {
          onBlur(e);
        }
      }}
    >
      <div className="tiptap-editor">
        <EditorContent editor={editor} />
      </div>

      {/* Table control buttons - only visible when editing */}
      {isEditing && (
        <>
        {/* TOP row: Style dropdown, Add Row, Delete dropdown */}
          <div
            className="flex justify-between items-center px-0"
            style={{
              position: 'absolute',
              top: 8,
              left: 0,
              right: 0,
              zIndex: 9999,
              pointerEvents: 'none'
            }}
          >
            {/* Style dropdown */}
            <div className="relative" style={{ pointerEvents: 'auto' }}>
              <details className="table-dropdown">
                <summary className="table-dropdown-btn">
                  <span>Styl</span>
                  <ChevronDown size={14} />
                </summary>
                <div className="table-dropdown-menu" style={{ minWidth: '200px' }}>
                  <div className="table-dropdown-section-title">Barvy</div>
                  <div className="table-color-grid">
                    <button
                      onClick={() => applyColorStyle('default')}
                      className="table-color-btn"
                      style={{ background: '#f8fafc', borderColor: '#94a3b8' }}
                      title="Výchozí"
                    />
                    <button
                      onClick={() => applyColorStyle('blue')}
                      className="table-color-btn"
                      style={{ background: '#dbeafe', borderColor: '#3b82f6' }}
                      title="Modrá"
                    />
                    <button
                      onClick={() => applyColorStyle('green')}
                      className="table-color-btn"
                      style={{ background: '#dcfce7', borderColor: '#22c55e' }}
                      title="Zelená"
                    />
                    <button
                      onClick={() => applyColorStyle('purple')}
                      className="table-color-btn"
                      style={{ background: '#f3e8ff', borderColor: '#a855f7' }}
                      title="Fialová"
                    />
                    <button
                      onClick={() => applyColorStyle('yellow')}
                      className="table-color-btn"
                      style={{ background: '#fef3c7', borderColor: '#f59e0b' }}
                      title="Žlutá"
                    />
                    <button
                      onClick={() => applyColorStyle('red')}
                      className="table-color-btn"
                      style={{ background: '#fee2e2', borderColor: '#ef4444' }}
                      title="Červená"
                    />
                    <button
                      onClick={() => applyColorStyle('pink')}
                      className="table-color-btn"
                      style={{ background: '#fce7f3', borderColor: '#ec4899' }}
                      title="Růžová"
                    />
                    <button
                      onClick={() => applyColorStyle('cyan')}
                      className="table-color-btn"
                      style={{ background: '#cffafe', borderColor: '#06b6d4' }}
                      title="Tyrkysová"
                    />
                  </div>

                  <div className="table-dropdown-divider" />
                  <div className="table-dropdown-section-title">Nastavení</div>

                  <label className="table-dropdown-checkbox">
                    <input
                      type="checkbox"
                      checked={editor.isActive('tableHeader')}
                      onChange={() => editor.chain().focus().toggleHeaderRow().run()}
                    />
                    <span>Záhlaví</span>
                  </label>

                  <label className="table-dropdown-checkbox">
                    <input
                      type="checkbox"
                      checked={hasBorder}
                      onChange={(e) => toggleBorder(e.target.checked)}
                    />
                    <span>Ohraničení</span>
                  </label>

                  <label className="table-dropdown-checkbox">
                    <input
                      type="checkbox"
                      checked={hasRoundedCorners}
                      onChange={(e) => toggleRoundedCorners(e.target.checked)}
                    />
                    <span>Zaoblené rohy</span>
                  </label>
                </div>
              </details>
            </div>

            {/* Add Row button */}
            <button
              onClick={() => editor.chain().focus().addRowBefore().run()}
              className="table-add-btn table-add-btn-blue"
              style={{ pointerEvents: 'auto' }}
              title="Přidat řádek nahoře"
            >
              <Plus size={16} />
              <span className="table-add-btn-text">Přidat řádek</span>
            </button>

            {/* Delete dropdown */}
            <div className="relative" style={{ pointerEvents: 'auto' }}>
              <details className="table-dropdown">
                <summary className="table-dropdown-btn table-dropdown-btn-danger">
                  <span>Smazat</span>
                  <ChevronDown size={14} />
                </summary>
                <div className="table-dropdown-menu table-dropdown-menu-right">
                  <button
                    onClick={() => editor.chain().focus().deleteRow().run()}
                    className="table-dropdown-item table-dropdown-item-danger"
                  >
                    Smazat řádek
                  </button>
                  <button
                    onClick={() => editor.chain().focus().deleteColumn().run()}
                    className="table-dropdown-item table-dropdown-item-danger"
                  >
                    Smazat sloupec
                  </button>
                  <div className="table-dropdown-divider" />
                  <button
                    onClick={() => editor.chain().focus().deleteTable().run()}
                    className="table-dropdown-item table-dropdown-item-danger-strong"
                  >
                    Smazat celou tabulku
                  </button>
                </div>
              </details>
            </div>
          </div>

          {/* Resize handle - on the bottom edge of table */}
          <div
            className="flex justify-center"
            style={{
              position: 'absolute',
              bottom: 52,
              left: 0,
              right: 0,
              zIndex: 10000,
              pointerEvents: 'none'
            }}
          >
            <div
              className="table-resize-handle"
              style={{ pointerEvents: 'auto' }}
              onMouseDown={(e) => {
                e.preventDefault();
                const startY = e.clientY;
                const table = editorWrapperRef.current?.querySelector('table');
                if (!table) return;
                const startHeight = table.offsetHeight;

                const onMouseMove = (moveEvent: MouseEvent) => {
                  const delta = moveEvent.clientY - startY;
                  const newHeight = Math.max(60, startHeight + delta);
                  table.style.height = `${newHeight}px`;
                };

                const onMouseUp = () => {
                  document.removeEventListener('mousemove', onMouseMove);
                  document.removeEventListener('mouseup', onMouseUp);
                  // Save the new height
                  if (editor) {
                    onUpdate({
                      ...content,
                      html: editor.getHTML(),
                    });
                  }
                };

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
              }}
            />
          </div>

          {/* BOTTOM row: Add Column Left, Add Row, Add Column Right */}
          <div
            className="flex justify-between items-center"
            style={{
              position: 'absolute',
              bottom: 16,
              left: 0,
              right: 0,
              zIndex: 9999,
              pointerEvents: 'none'
            }}
          >
            {/* Add Column Left */}
            <button
              onClick={() => editor.chain().focus().addColumnBefore().run()}
              className="table-add-btn table-add-btn-green"
              style={{ pointerEvents: 'auto' }}
              title="Přidat sloupec vlevo"
            >
              <Plus size={16} />
              <span className="table-add-btn-text">Přidat sloupec</span>
            </button>

            {/* Add Row bottom */}
            <button
              onClick={() => editor.chain().focus().addRowAfter().run()}
              className="table-add-btn table-add-btn-blue"
              style={{ pointerEvents: 'auto' }}
              title="Přidat řádek dole"
            >
              <Plus size={16} />
              <span className="table-add-btn-text">Přidat řádek</span>
            </button>

            {/* Add Column Right */}
            <button
              onClick={() => editor.chain().focus().addColumnAfter().run()}
              className="table-add-btn table-add-btn-green"
              style={{ pointerEvents: 'auto' }}
              title="Přidat sloupec vpravo"
            >
              <Plus size={16} />
              <span className="table-add-btn-text">Přidat sloupec</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================
// CONNECT PAIRS EDITOR (SPOJOVAČKA)
// ============================================

interface ConnectPairsEditorBlockProps {
  content: ConnectPairsContent;
  isEditing: boolean;
  onUpdate: (content: ConnectPairsContent) => void;
  activityNumber?: number;
}

function ConnectPairsEditorBlock({ content, isEditing, onUpdate, activityNumber }: ConnectPairsEditorBlockProps) {
  // Logic for shuffling in view mode (consistent with print)
  const rightItems = React.useMemo(() => {
    const items = content.pairs.map((p, idx) => ({ ...p.right, originalIdx: idx }));
    if (content.shuffleSides && !isEditing) {
      // Stable shuffle based on pair IDs to avoid jumping on every re-render
      // but still be "shuffled" for the preview
      return [...items].sort((a, b) => {
        const hashA = a.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const hashB = b.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return hashA - hashB;
      });
    }
    return items;
  }, [content.pairs, content.shuffleSides, isEditing]);

  const addPair = () => {
    const newId = Date.now().toString();
    const newPair: ConnectPairContent = {
      id: `pair-${newId}`,
      left: { id: `left-${newId}`, type: 'text', content: '' },
      right: { id: `right-${newId}`, type: 'text', content: '' },
    };
    onUpdate({
      ...content,
      pairs: [...content.pairs, newPair],
    });
  };

  const updatePair = (pairId: string, side: 'left' | 'right', value: string) => {
    onUpdate({
      ...content,
      pairs: content.pairs.map(pair =>
        pair.id === pairId
          ? { ...pair, [side]: { ...pair[side], content: value } }
          : pair
      ),
    });
  };

  const removePair = (pairId: string) => {
    if (content.pairs.length <= 2) return;
    onUpdate({
      ...content,
      pairs: content.pairs.filter(pair => pair.id !== pairId),
    });
  };

  const renderItem = (item: any, side: 'left' | 'right', pairId: string, label?: string) => {
    if (isEditing) {
      if (item.type === 'image') {
        return (
          <div className="flex-1 space-y-2">
            <div className="relative aspect-video bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
              {item.content ? (
                <img src={item.content} className="w-full h-full object-cover" alt="" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400">
                  <ImageIcon size={20} />
                </div>
              )}
            </div>
            <input
              type="text"
              value={item.content}
              onChange={(e) => updatePair(pairId, side, e.target.value)}
              placeholder="URL obrázku..."
              className="w-full px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        );
      }
      return (
        <input
          type="text"
          value={item.content}
          onChange={(e) => updatePair(pairId, side, e.target.value)}
          placeholder={side === 'left' ? 'Levá strana' : 'Pravá strana'}
          className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      );
    }

    // View mode - UI polished with labels inside
    return (
      <div className={`flex-1 flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm border shadow-sm transition-all ${
        side === 'left' 
          ? 'bg-blue-50 border-blue-100 text-blue-900' 
          : 'bg-purple-50 border-purple-100 text-purple-900'
      }`}>
        {label && (
          <div 
            className="flex items-center justify-center shrink-0 font-semibold choice-circle"
            style={{
              width: '21px',
              height: '21px',
              minWidth: '21px',
              minHeight: '21px',
              borderRadius: '50%',
              border: '1.5px solid #1e293b',
              color: '#1e293b',
              backgroundColor: '#ffffff',
              fontSize: '11px',
            }}
          >
            {label.replace('.', '').replace(':', '')}
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          {item.type === 'image' ? (
            <div className="aspect-video rounded-lg overflow-hidden border border-black/5 bg-white/50">
              {item.content ? (
                <img src={item.content} className="w-full h-full object-cover" alt="" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300">
                  <ImageIcon size={20} />
                </div>
              )}
            </div>
          ) : (
            <div className="leading-tight">
              {item.content ? <LatexRenderer text={item.content} /> : <span className="opacity-30 italic">...</span>}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header with activity number */}
      <div className="flex items-center gap-3">
        {activityNumber && (
          <div
            className="flex items-center justify-center shrink-0 font-bold text-white"
            style={{ 
              width: '21px',
              height: '21px',
              borderRadius: '50%',
              backgroundColor: '#1e293b',
              fontSize: '12px',
            }}
          >
            {activityNumber}
          </div>
        )}
        <span className="font-semibold text-slate-800">
          {content.instruction || 'Spoj správné dvojice'}
        </span>
      </div>

      {/* Pairs grid */}
      <div className="space-y-3" style={{ paddingLeft: activityNumber ? '32px' : 0 }}>
        {isEditing ? (
          // Editing mode - show pairs directly
          content.pairs.map((pair, idx) => (
            <div key={pair.id} className="flex items-center gap-3 group">
              <span className="text-slate-400 text-[10px] font-bold w-4 flex-shrink-0">{idx + 1}.</span>
              {renderItem(pair.left, 'left', pair.id)}
              <div className="flex-shrink-0 text-slate-300">
                <ArrowLeftRight size={14} />
              </div>
              {renderItem(pair.right, 'right', pair.id)}
              {content.pairs.length > 2 && (
                <button
                  onClick={() => removePair(pair.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-all flex-shrink-0"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))
        ) : (
          // View mode - UI polished with labels inside
          content.pairs.map((pair, idx) => (
            <div key={pair.id} className="flex items-center gap-12 group"> {/* Even more space in the middle */}
              {renderItem(pair.left, 'left', pair.id, `${idx + 1}.`)}
              
              <div className="flex-shrink-0 flex flex-col items-center">
                <div className="w-10 h-[1.5px] bg-slate-200 relative">
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-slate-300" />
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-slate-300" />
                </div>
              </div>
              
              {renderItem(rightItems[idx], 'right', rightItems[idx].id, `${String.fromCharCode(65 + idx)}:`)}
            </div>
          ))
        )}

        {isEditing && (
          <button
            onClick={addPair}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mt-2 text-sm font-medium"
          >
            <Plus size={14} />
            Přidat dvojici
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================
// IMAGE HOTSPOTS EDITOR (POZNÁVAČKA)
// ============================================

interface ImageHotspotsEditorBlockProps {
  content: ImageHotspotsContent;
  isEditing: boolean;
  onUpdate: (content: ImageHotspotsContent) => void;
  activityNumber?: number;
}

function ImageHotspotsEditorBlock({ content, isEditing, onUpdate, activityNumber }: ImageHotspotsEditorBlockProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [draggedHotspotId, setDraggedHotspotId] = useState<string | null>(null);
  const [isPlacementMode, setIsPlacementMode] = useState(false);
  const [ghostPos, setGhostPos] = useState<{ x: number, y: number } | null>(null);
  const isDraggingRef = React.useRef(false);
  const ignoreNextClickRef = React.useRef(false);
  const dragStartRef = React.useRef<{ x: number; y: number; hX: number; hY: number } | null>(null);

  const updateHotspot = (hotspotId: string, updates: Partial<WorksheetHotspot>) => {
    onUpdate({
      ...content,
      hotspots: content.hotspots.map(h =>
        h.id === hotspotId ? { ...h, ...updates } : h
      ),
    });
  };

  const removeHotspot = (hotspotId: string) => {
    onUpdate({
      ...content,
      hotspots: content.hotspots.filter(h => h.id !== hotspotId),
    });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPlacementMode || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setGhostPos({ x, y });
  };

  const handlePointerLeave = () => {
    setGhostPos(null);
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    if (!isEditing || !containerRef.current) {
      console.log('[Hotspots] Click ignored:', { isEditing, hasRef: !!containerRef.current });
      return;
    }
    
    if (isPlacementMode) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      
      console.log('[Hotspots] Adding point at:', { x, y });
      
      onUpdate({
        ...content,
        hotspots: [...content.hotspots, {
          id: `hotspot-${Date.now()}`,
          x,
          y,
          label: '',
        }]
      });
      return;
    }

    if (ignoreNextClickRef.current) {
      ignoreNextClickRef.current = false;
      return;
    }
    
    // Check if clicking on an existing hotspot
    if ((e.target as HTMLElement).closest('.hotspot-marker')) return;
  };

  const handleMarkerPointerDown = (hotspot: WorksheetHotspot, e: React.PointerEvent) => {
    if (!isEditing || isPlacementMode) return;
    e.preventDefault();
    e.stopPropagation();
    
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    
    setDraggedHotspotId(hotspot.id);
    isDraggingRef.current = false;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      hX: hotspot.x,
      hY: hotspot.y
    };
  };

  const handleMarkerPointerMove = (e: React.PointerEvent) => {
    if (!draggedHotspotId || !dragStartRef.current || !containerRef.current) return;
    
    const dx = Math.abs(e.clientX - dragStartRef.current.x);
    const dy = Math.abs(e.clientY - dragStartRef.current.y);
    
    if (dx > 3 || dy > 3) {
      isDraggingRef.current = true;
      ignoreNextClickRef.current = true;
    }

    if (isDraggingRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const dxPercent = ((e.clientX - dragStartRef.current.x) / rect.width) * 100;
      const dyPercent = ((e.clientY - dragStartRef.current.y) / rect.height) * 100;
      
      let x = dragStartRef.current.hX + dxPercent;
      let y = dragStartRef.current.hY + dyPercent;
      
      x = Math.max(0, Math.min(100, x));
      y = Math.max(0, Math.min(100, y));
      
      updateHotspot(draggedHotspotId, { x, y });
    }
  };

  const handleMarkerPointerUp = (e: React.PointerEvent) => {
    if (!draggedHotspotId) return;
    const target = e.currentTarget as HTMLElement;
    target.releasePointerCapture(e.pointerId);
    setDraggedHotspotId(null);
    dragStartRef.current = null;
    
    if (isDraggingRef.current) {
      setTimeout(() => {
        isDraggingRef.current = false;
      }, 50);
    }
  };

  const markerSize = (content.markerSize || 100) / 100;
  const isABC = content.answerType === 'abc';
  const isSideBySide = content.layout === 'side-by-side';

  return (
    <div className="space-y-4">
      {/* Header with activity number */}
      <div className="flex items-center gap-3">
        {activityNumber && (
          <div
            className="flex items-center justify-center shrink-0 font-bold text-white shadow-sm"
            style={{ 
              width: '21px',
              height: '21px',
              borderRadius: '50%',
              backgroundColor: '#1e293b',
              fontSize: '12px',
            }}
          >
            {activityNumber}
          </div>
        )}
        <span className="font-semibold text-slate-800">
          {content.instruction || 'Označ správná místa na obrázku'}
        </span>
      </div>

      <div style={{ paddingLeft: activityNumber ? '32px' : 0 }}>
        <div className={isSideBySide ? "flex gap-8 items-start" : "space-y-8"}>
          {/* Image Area */}
          <div 
            ref={containerRef}
            className={`relative rounded-2xl overflow-hidden border-2 border-slate-100 bg-white shadow-sm group/image-area ${isEditing ? (isPlacementMode ? 'cursor-none' : 'cursor-crosshair') : ''} ring-2 ring-purple-500/10 ${isSideBySide ? "flex-1" : "w-full mb-6"}`}
            onClick={handleContainerClick}
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
            style={{ minHeight: content.imageUrl ? 'auto' : '200px', touchAction: 'none' }}
          >
            {content.imageUrl ? (
              <img
                src={content.imageUrl}
                alt="Poznávačka"
                className="w-full h-auto max-h-[600px] object-contain block pointer-events-none select-none"
              />
            ) : (
              <div className="flex items-center justify-center py-12">
                <div className="text-center text-slate-400">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ImageIcon size={32} className="opacity-20" />
                  </div>
                  <span className="text-sm font-medium">Obrázek nebyl nastaven</span>
                  {isEditing && <p className="text-xs mt-2 text-slate-400">Vložte URL v nastavení vlevo</p>}
                </div>
              </div>
            )}

            {/* Placement mode control toggle - Always visible when selected */}
            {isEditing && content.imageUrl && (
              <div className="absolute top-4 right-4 z-[100] transition-all duration-300">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const newMode = !isPlacementMode;
                    setIsPlacementMode(newMode);
                    if (!newMode) setGhostPos(null);
                    console.log('[Hotspots] Toggle placement mode:', newMode);
                  }}
                  className={`pointer-events-auto flex items-center gap-2 px-5 py-2.5 rounded-full shadow-lg font-bold transition-all border-2 ${
                    isPlacementMode 
                      ? 'bg-purple-600 text-white border-purple-400 scale-105' 
                      : 'bg-white text-purple-700 border-purple-500 hover:scale-105 hover:bg-purple-50 active:scale-95'
                  }`}
                  style={{ 
                    fontSize: '14px',
                  }}
                >
                  {isPlacementMode ? (
                    <>
                      <X size={18} strokeWidth={2.5} />
                      Ukončit vkládání
                    </>
                  ) : (
                    <>
                      <Plus size={18} strokeWidth={2.5} />
                      Umístit body
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Ghost marker */}
            {isPlacementMode && ghostPos && (
              <div
                className="absolute pointer-events-none flex items-center justify-center shadow-lg z-30 opacity-70 animate-pulse"
                style={{
                  left: `${ghostPos.x}%`,
                  top: `${ghostPos.y}%`,
                  transform: `translate(-50%, -50%) scale(${markerSize})`,
                  width: '28px',
                  height: '28px',
                  borderRadius: content.markerStyle === 'pin' ? '28px 28px 0 28px' : '50%',
                  backgroundColor: '#9333ea',
                  border: '2px solid white',
                  rotate: content.markerStyle === 'pin' ? '45deg' : '0deg',
                }}
              >
                <span className="text-white font-black" style={{ fontSize: '12px', rotate: content.markerStyle === 'pin' ? '-45deg' : '0deg' }}>
                  {isABC ? String.fromCharCode(65 + content.hotspots.length) : (content.hotspots.length + 1)}
                </span>
              </div>
            )}
            
            {/* Hotspot markers on image */}
            {content.hotspots.map((hotspot, idx) => {
              const labelChar = isABC ? String.fromCharCode(65 + idx) : (idx + 1).toString();
              const isBeingDragged = draggedHotspotId === hotspot.id;
              
              return (
                <div
                  key={hotspot.id}
                  onPointerDown={(e) => handleMarkerPointerDown(hotspot, e)}
                  onPointerMove={handleMarkerPointerMove}
                  onPointerUp={handleMarkerPointerUp}
                  className={`absolute hotspot-marker flex items-center justify-center shadow-lg z-20 transition-all ${isBeingDragged ? 'scale-125 cursor-grabbing ring-4 ring-purple-500/20' : 'hover:scale-110 cursor-grab'} group/pin ${isPlacementMode ? 'pointer-events-none opacity-50' : ''}`}
                  style={{
                    left: `${hotspot.x}%`,
                    top: `${hotspot.y}%`,
                    transform: `translate(-50%, -50%) scale(${markerSize})`,
                    width: '28px',
                    height: '28px',
                    borderRadius: content.markerStyle === 'pin' ? '28px 28px 0 28px' : '50%',
                    backgroundColor: '#9333ea',
                    border: '2px solid white',
                    rotate: content.markerStyle === 'pin' ? '45deg' : '0deg',
                    touchAction: 'none'
                  }}
                >
                  <span 
                    className="text-white font-black pointer-events-none select-none"
                    style={{ 
                      fontSize: '12px',
                      rotate: content.markerStyle === 'pin' ? '-45deg' : '0deg'
                    }}
                  >
                    {labelChar}
                  </span>
                  
                  {isEditing && (
                    <button
                      onClick={(e) => { e.stopPropagation(); removeHotspot(hotspot.id); }}
                      className="absolute -top-6 -right-6 w-5 h-5 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 shadow-sm opacity-0 group-hover/pin:opacity-100 transition-opacity"
                      style={{ rotate: content.markerStyle === 'pin' ? '-45deg' : '0deg' }}
                    >
                      <X size={10} />
                    </button>
                  )}
                </div>
              );
            })}
            
            {isEditing && content.imageUrl && !isPlacementMode && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-[10px] font-bold px-3 py-1.5 rounded-full backdrop-blur-md border border-white/10 uppercase tracking-widest pointer-events-none">
                Tažením přesuňte • Umístit body pro přidání
              </div>
            )}
          </div>

          {/* Legend (Answers Area) */}
          {content.hotspots.length > 0 && (
            <div className={isSideBySide ? "flex-1" : "mt-8"}>
              <div className={isSideBySide ? "flex flex-col gap-y-6" : "grid grid-cols-2 gap-x-12 gap-y-10"}>
                {content.hotspots.map((hotspot, idx) => {
                  const labelChar = isABC ? String.fromCharCode(65 + idx) : (idx + 1).toString();
                  return (
                    <div key={hotspot.id} className="flex items-center gap-4 group">
                      <div 
                        className="flex items-center justify-center shrink-0 font-semibold choice-circle"
                        style={{
                          width: '21px',
                          height: '21px',
                          minWidth: '21px',
                          minHeight: '21px',
                          borderRadius: '50%',
                          border: '1.5px solid #1e293b',
                          color: '#1e293b',
                          backgroundColor: '#ffffff',
                          fontSize: '12px',
                        }}
                      >
                        {labelChar}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <div className="flex items-center gap-2 group/edit">
                            <input
                              type="text"
                              value={hotspot.label}
                              onChange={(e) => updateHotspot(hotspot.id, { label: e.target.value })}
                              placeholder="Správná odpověď..."
                              className="w-full bg-transparent border-b-2 border-slate-200 focus:border-slate-400 py-1 text-sm outline-none transition-colors font-medium text-slate-700"
                            />
                            <button
                              onClick={() => removeHotspot(hotspot.id)}
                              className="opacity-0 group-hover/edit:opacity-100 p-1.5 text-slate-300 hover:text-red-500 transition-all hover:bg-red-50 rounded-lg"
                              title="Smazat bod"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 w-full border-b-2 border-dotted border-slate-300 pb-1 px-1">
                            <span className="text-sm text-slate-800 font-medium">{hotspot.label || '...'}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// VIDEO QUIZ EDITOR
// ============================================

interface VideoQuizEditorBlockProps {
  content: VideoQuizContent;
  isEditing: boolean;
  onUpdate: (content: VideoQuizContent) => void;
  activityNumber?: number;
}

function VideoQuizEditorBlock({ content, isEditing, onUpdate, activityNumber }: VideoQuizEditorBlockProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const updateQuestion = (questionId: string, question: string) => {
    onUpdate({
      ...content,
      questions: content.questions.map(q =>
        q.id === questionId ? { ...q, question } : q
      ),
    });
  };

  const removeQuestion = (questionId: string) => {
    onUpdate({
      ...content,
      questions: content.questions.filter(q => q.id !== questionId),
    });
  };

  // Extract video ID for thumbnail
  const getYouTubeId = (url: string) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    return match ? match[1] : null;
  };

  const videoId = content.videoId || getYouTubeId(content.videoUrl);
  const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null;

  return (
    <div className="space-y-4">
      {/* Header with activity number */}
      <div className="flex items-center gap-3">
        {activityNumber && (
          <div
            className="flex items-center justify-center shrink-0 font-bold text-white"
            style={{ 
              width: '21px',
              height: '21px',
              borderRadius: '50%',
              backgroundColor: '#1e293b',
              fontSize: '12px',
            }}
          >
            {activityNumber}
          </div>
        )}
        <span className="font-medium text-slate-700">
          {content.instruction || 'Video kvíz'}
        </span>
      </div>

      <div style={{ paddingLeft: activityNumber ? '32px' : 0 }} className="space-y-4">
        {/* Video Card - Always show if URL exists */}
        {content.videoUrl ? (
          <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden shadow-sm max-w-2xl">
            <div className="relative aspect-video bg-black flex items-center justify-center">
              {thumbnailUrl ? (
                <>
                  <img
                    src={thumbnailUrl}
                    alt="Video thumbnail"
                    className="w-full h-full object-cover opacity-80"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center shadow-2xl transition-transform hover:scale-105">
                      <div className="w-0 h-0 border-t-10 border-b-10 border-l-16 border-transparent border-l-white ml-1.5" />
                    </div>
                  </div>
                </>
              ) : (
                <PlayCircle className="w-12 h-12 text-white/20" />
              )}
              {isEditing && (
                <div className="absolute top-3 right-3 bg-black/60 text-white text-[10px] px-2 py-1 rounded-full backdrop-blur-md">
                  YouTube Video
                </div>
              )}
            </div>
            <div className="px-4 py-3 flex items-center justify-between bg-white border-t border-slate-100">
              <div className="flex items-center gap-2">
                <PlayCircle className="w-4 h-4 text-red-600" />
                <span className="text-xs font-semibold text-slate-700 truncate max-w-[200px]">
                  {content.videoUrl}
                </span>
              </div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {content.questions.length} OTÁZEK
              </div>
            </div>
          </div>
        ) : isEditing && (
          <div className="flex items-center justify-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
            <div className="text-center text-slate-400">
              <PlayCircle size={40} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">Vložte odkaz na video v nastavení</p>
            </div>
          </div>
        )}

        {/* Questions Summary */}
        {content.questions.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Otázky ve videu:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {content.questions.map((q, idx) => (
                <div key={q.id} className="flex items-start gap-3 p-3 bg-white border border-slate-100 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex flex-col items-center gap-1.5 shrink-0">
                    <span className="flex items-center justify-center w-6 h-6 bg-slate-800 text-white rounded-lg text-xs font-bold">
                      {idx + 1}
                    </span>
                    <span className="text-[9px] font-mono font-bold text-slate-400 bg-slate-50 px-1 rounded">
                      {formatTime(q.timestamp)}
                    </span>
                  </div>
                  
                  <div className="flex-1 min-w-0 pt-0.5">
                    {isEditing ? (
                      <input
                        type="text"
                        value={q.question}
                        onChange={(e) => updateQuestion(q.id, e.target.value)}
                        placeholder={`Otázka ${idx + 1}`}
                        className="w-full bg-transparent border-none text-sm text-slate-700 outline-none p-0 focus:ring-0 font-medium"
                      />
                    ) : (
                      <p className="text-sm text-slate-700 font-medium leading-snug">
                        {q.question || `Otázka ${idx + 1}...`}
                      </p>
                    )}
                    
                    {/* Compact options preview */}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {q.options.map((opt, optIdx) => (
                        <div 
                          key={opt.id} 
                          className={`text-[9px] px-1.5 py-0.5 rounded-full border ${opt.isCorrect ? 'bg-green-50 border-green-200 text-green-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}
                        >
                          {String.fromCharCode(65 + optIdx)}
                        </div>
                      ))}
                    </div>
                  </div>

                  {isEditing && (
                    <button
                      onClick={(e) => { e.stopPropagation(); removeQuestion(q.id); }}
                      className="text-slate-300 hover:text-red-500 transition-colors p-1"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// HEADER FOOTER EDITOR
// ============================================

interface HeaderFooterEditorBlockProps {
  content: HeaderFooterContent;
  isEditing: boolean;
  onUpdate: (content: HeaderFooterContent) => void;
}

function HeaderFooterEditorBlock({ content, isEditing, onUpdate }: HeaderFooterEditorBlockProps) {
  const isHeader = content.variant === 'header';
  
  // Smajlíci pro zpětnou vazbu
  const SMILEYS = ['😢', '🙁', '😐', '🙂', '😊'];
  const HEARTS = ['💔', '🖤', '🤍', '🩷', '❤️'];
  const STARS = ['☆', '☆', '☆', '☆', '☆'];
  
  const feedbackIcons = content.feedbackType === 'smileys' ? SMILEYS 
    : content.feedbackType === 'hearts' ? HEARTS 
    : content.feedbackType === 'stars' ? STARS 
    : [];
    
  const PageNumberIcon = () => (
    <div className="flex items-center flex-shrink-0 ml-auto">
      <div 
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          backgroundColor: '#000000',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          fontWeight: 'bold',
        }}
      >
        1
      </div>
    </div>
  );
  
  return (
    <div className="py-3">
      {/* Oddělovací linka nahoře (pouze pro patičku) */}
      {!isHeader && (
        <div className="border-t-2 border-slate-300 mb-4" />
      )}
      
      {isHeader ? (
        // === HLAVIČKA ===
        <div className="flex gap-4 items-start">
          {/* Hlavní pole - vše v jednom řádku */}
          <div className="flex-1 min-w-0 flex gap-4 items-end">
            {/* Jméno a příjmení */}
            {(content.showName !== false || content.showSurname !== false) && (
              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium text-slate-500">Jméno a příjmení:</span>
                <div className="border-b-2 border-dotted border-slate-300 mt-1 h-6" />
              </div>
            )}
            
            {/* Třída */}
            {content.showClass !== false && (
              <div className="w-36">
                <span className="text-xs font-medium text-slate-500">{content.classLabel || 'Třída'}:</span>
                <div className="border-b-2 border-dotted border-slate-300 mt-1 h-6" />
              </div>
            )}
            
            {/* Známka */}
            {content.showGrade !== false && (
              <div className="w-20">
                <span className="text-xs font-medium text-slate-500">{content.gradeLabel || 'Známka'}:</span>
                <div className="border-b-2 border-dotted border-slate-300 mt-1 h-6" />
              </div>
            )}
            
            {/* Vlastní info - inline s poli */}
            {content.customInfo && (
              <div className="flex-shrink-0">
                <p className="text-xs text-slate-500 italic">{content.customInfo}</p>
              </div>
            )}
            
            {/* Číslo stránky */}
            {content.showPageNumber && <PageNumberIcon />}
          </div>
          
          {/* QR kód */}
          {content.showQrCode && content.qrCodeUrl && (
            <div className="flex-shrink-0">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(content.qrCodeUrl)}`}
                alt="QR kód"
                className="w-20 h-20 border border-slate-200 rounded"
              />
            </div>
          )}
        </div>
      ) : (
        // === PATIČKA ===
        <div className="flex gap-4 items-start">
          {/* Info text a zpětná vazba v gridu */}
          <div className="flex-1 grid grid-cols-2 gap-4">
            {/* Levý sloupec: Info text */}
            <div>
              {content.showFooterInfo && content.footerInfo && (
                <p className="text-sm text-slate-600">{content.footerInfo}</p>
              )}
            </div>
            
            {/* Pravý sloupec: Zpětná vazba */}
            <div>
              {content.showFeedback && content.feedbackType && content.feedbackType !== 'none' && (
                <div>
                  <p className="text-sm font-medium text-slate-600 mb-2">
                    {content.feedbackText || 'Tento pracovní list se mi vyplňoval:'}
                  </p>
                  <div className="flex gap-2 items-center">
                    {feedbackIcons.slice(0, content.feedbackCount || 5).map((icon, idx) => (
                      <span 
                        key={idx} 
                        className="text-2xl opacity-40 hover:opacity-100 transition-opacity cursor-pointer"
                        title={`${idx + 1} z ${content.feedbackCount || 5}`}
                      >
                        {icon}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* QR kód */}
          {content.showQrCode && content.qrCodeUrl && (
            <div className="flex-shrink-0">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(content.qrCodeUrl)}`}
                alt="QR kód"
                className="w-20 h-20 border border-slate-200 rounded"
              />
            </div>
          )}

          {/* Číslo stránky */}
          {content.showPageNumber && <PageNumberIcon />}
        </div>
      )}
    </div>
  );
}

// ============================================
// FREE CANVAS EDITOR BLOCK
// ============================================

// ============================================
// FREE CANVAS ACTIVITY BLOCK - Kompletně nová struktura
// ============================================

interface FreeCanvasActivityBlockProps {
  block: WorksheetBlock;
  isEditing: boolean;
  onUpdate: (content: any) => void;
  activityNumber?: number;
}

function FreeCanvasActivityBlock({ block, isEditing, onUpdate, activityNumber }: FreeCanvasActivityBlockProps) {
  const content = block.content as FreeCanvasContent;
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [blockWidth, setBlockWidth] = useState(750);

  const handleEnterFullscreen = () => {
    if (containerRef.current) {
      setBlockWidth(containerRef.current.offsetWidth);
    }
    setIsFullscreen(true);
  };

  const instructionText = (content as any).question || '';

  return (
    <div 
      ref={containerRef}
      className="w-full relative"
      style={{ 
        margin: '-4px -16px -4px -16px',
        width: 'calc(100% + 32px)',
      }}
    >
      {/* 1. Zadání s číslem - normální padding */}
      <div 
        className="flex gap-3 items-start px-4 py-1"
        style={{
          fontFamily: content.fontFamily || FONT_FAMILY,
          fontSize: content.fontSize || FONT_SIZES.body,
          fontWeight: content.fontWeight || 'normal',
          fontStyle: content.italic ? 'italic' : 'normal',
          color: content.textColor || '#1e293b',
          lineHeight: content.lineHeight || 1.5,
        }}
      >
        {activityNumber && (
          <div style={{
            width: `${content.circleSize || 21}px`,
            height: `${content.circleSize || 21}px`,
            borderRadius: '50%',
            backgroundColor: content.circleColor || '#1e293b',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: `${(content.circleSize || 21) * 0.6}px`,
            fontWeight: 'bold',
            flexShrink: 0,
            marginTop: '2px',
          }}>
            {activityNumber}
          </div>
        )}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <textarea
              value={instructionText}
              onChange={(e) => onUpdate({ ...content, question: e.target.value })}
              className="w-full bg-transparent border-none outline-none resize-none overflow-hidden p-0 m-0"
              style={{ minHeight: '1.5em' }}
              placeholder="Zadejte zadání aktivity..."
            />
          ) : (
            <div style={{ minHeight: '1.5em' }}>
              {instructionText || <span className="text-slate-400">Zadání aktivity...</span>}
            </div>
          )}
        </div>
      </div>

      {/* 2. Plátno - PŘES CELOU ŠÍŘKU bez jakýchkoliv okrajů */}
      <div className="w-full overflow-hidden bg-white border-t border-gray-200">
        <FreeCanvasEditor
          content={content}
          onUpdate={onUpdate}
          isEditing={false}
          onEnterFullscreen={handleEnterFullscreen}
        />
      </div>

      {isFullscreen && (
        <FreeCanvasFullscreen
          content={{ ...content, canvasWidth: blockWidth }}
          onUpdate={(newContent) => onUpdate({ ...newContent, canvasWidth: blockWidth })}
          onClose={() => setIsFullscreen(false)}
          blockId={block.id}
          blockWidth={blockWidth}
        />
      )}
    </div>
  );
}
