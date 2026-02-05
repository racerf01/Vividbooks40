/**
 * Quiz Editor Layout
 * 
 * 3-column layout similar to WorksheetEditorLayout:
 * 1. Narrow toolbar (slide types)
 * 2. Structure panel (slide list)
 * 3. Main editing area
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus,
  Save,
  Play,
  Settings,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Trash2,
  Undo2,
  Redo2,
  Copy,
  GripVertical,
  FileText,
  HelpCircle,
  MessageSquare,
  Calculator,
  CheckCircle,
  XCircle,
  MoreVertical,
  Eye,
  EyeOff,
  Share2,
  Download,
  ListOrdered,
  Lightbulb,
  BarChart2,
  Users,
  Radio,
  Link2,
  BookOpen,
  Bookmark,
  Sparkles,
  SlidersHorizontal,
  ArrowLeft,
  ArrowRight,
  Palette,
  History,
  LayoutGrid,
  Printer,
  Layers,
  Zap,
  Paintbrush,
  // New activity icons
  Puzzle,
  MapPin,
  Film,
  // Block editing icons
  Type,
  Image as ImageIcon,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  X,
  Upload,
  Grid2X2,
} from 'lucide-react';

const NoteIcon = ({ size = 20, className = "" }: { size?: number, className?: string }) => (
  <svg 
    width={size} 
    height={size * (13/6)} 
    viewBox="0 0 6 13" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ height: size }}
  >
    <g clipPath="url(#clip0_note_icon_preview)">
      <path d="M1.91903 5.57928C1.91903 5.19451 1.80615 5.06625 1.5965 5.05021C1.43524 5.05021 1.27398 5.08228 1.11272 5.21054C0.886947 5.40293 0.677305 5.70754 0.661179 5.89993C0.645052 6.09232 0.661179 6.34884 0.596673 6.50916C0.532168 6.62139 0.43541 6.63742 0.354779 6.63742C0.12901 6.62139 0 6.46107 0 6.18852C0 5.06625 0.935326 4.29669 1.8384 3.96001C2.25768 3.79969 2.69309 3.71952 2.96724 3.71952C3.41878 3.71952 3.77356 4.18446 3.77356 4.66544C3.77356 5.17847 3.6768 5.46706 3.30589 7.87192C3.14463 8.898 2.93499 10.0042 2.93499 10.5814C2.93499 10.9501 3.08012 11.1746 3.48328 11.1746C4.01545 11.1746 4.40248 10.3409 4.43473 9.9882C4.46699 9.73168 4.56374 9.58739 4.74113 9.58739C4.93465 9.58739 5.14429 9.76375 5.14429 10.0042C5.14429 10.405 4.88627 11.2227 4.07996 11.848C3.69292 12.1526 3.17688 12.4251 2.54796 12.4251C1.64488 12.4251 1.08046 11.8159 1.08046 11.0143C1.08046 10.2768 1.19335 9.57136 1.532 8.00018C1.79002 6.84585 1.9029 6.02819 1.9029 5.61135L1.91903 5.57928ZM3.30589 0C3.91869 0 4.30572 0.368746 4.30572 0.945913C4.30572 1.65134 3.61229 2.18041 2.88661 2.18041C2.24156 2.18041 1.85453 1.79563 1.85453 1.25053C1.85453 0.480973 2.61246 0 3.28977 0L3.30589 0Z" fill="currentColor"/>
    </g>
    <defs>
      <clipPath id="clip0_note_icon_preview">
        <rect width="5.12817" height="12.3931" fill="white"/>
      </clipPath>
    </defs>
  </svg>
);
import { boardToWorksheet } from '../../utils/content-converter';
import { saveWorksheet } from '../../utils/worksheet-storage';
import { useVersionHistory } from '../../hooks/useVersionHistory';
import { useFileStorage } from '../../hooks/useFileStorage';
import { getMediaFolderId, ensureMediaFolderExists, createMediaSubfolder } from '../../utils/folder-storage';
import { VersionHistoryPanel } from '../shared/VersionHistoryPanel';
import { database } from '../../utils/firebase-config';
import { ref, onValue, off } from 'firebase/database';
import { supabase } from '../../utils/supabase/client';
import { projectId } from '../../utils/supabase/info';
import { 
  Quiz, 
  QuizSlide, 
  InfoSlide, 
  ActivityType, 
  createEmptyQuiz, 
  createABCSlide, 
  createOpenSlide, 
  createExampleSlide, 
  createInfoSlide, 
  createBoardSlide, 
  createVotingSlide, 
  createFillBlanksSlide, 
  createImageHotspotsSlide, 
  createConnectPairsSlide, 
  createVideoQuizSlide,
  createFormSlide,
  createCertificateSlide,
  FillBlanksActivitySlide, 
  ImageHotspotsActivitySlide, 
  ConnectPairsActivitySlide, 
  VideoQuizActivitySlide,
  OpenActivitySlide,
  ExampleActivitySlide,
  ToolsSlide,
  getTemplateById,
} from '../../types/quiz';
import { getContrastColor } from '../../utils/color-utils';
import { SLIDE_TYPES, SlideTypeOption } from './slide-types';
import { toast } from 'sonner';
import * as pdfjsLib from 'pdfjs-dist';

// Set worker path for PDF.js - Using a consistent and reliable CDN URL
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs';

import { ABCSlideEditor } from './slides/ABCSlideEditor';
import { OpenSlideEditor } from './slides/OpenSlideEditor';
import { ExampleSlideEditor } from './slides/ExampleSlideEditor';
import { InfoSlideEditor } from './slides/InfoSlideEditor';
import { BoardSlideEditor } from './slides/BoardSlideEditor';
import { VotingSlideEditor } from './slides/VotingSlideEditor';
import { ConnectPairsEditor } from './slides/ConnectPairsEditor';
import { FillBlanksEditor } from './slides/FillBlanksEditor';
import { ImageHotspotsEditor } from './slides/ImageHotspotsEditor';
import { VideoQuizEditor } from './slides/VideoQuizEditor';
import { FormEditor } from './slides/FormEditor';
import { CertificateEditor } from './slides/CertificateEditor';
import { SlideTextToolbar } from './slides/SlideTextToolbar';
import { BackgroundPicker } from './slides/BackgroundPicker';
import { PageSettingsPanel, LayoutIcon } from './slides/PageSettingsPanel';
import { BlockSettingsPanel } from './slides/BlockSettingsPanel';
import { QuizPreview } from './QuizPreview';
import { ShareEditDialog } from './ShareEditDialog';
import { getBoardComments, BoardComment, getCommentsGroupedBySlide, addBoardComment } from '../../utils/supabase/board-comments';
import { SlideCommentsPreview } from './slides/SlideCommentsPreview';
import { TeacherSession } from './QuizLiveSession';
import { AIBoardPanel } from './AIBoardPanel';
import * as storage from '../../utils/profile-storage';
import * as quizStorage from '../../utils/quiz-storage';

const SLIDE_COLORS = [
  { color: '#ffffff', label: 'Bílá' },
  { color: '#f8fafc', label: 'Šedá' },
  { color: '#eff6ff', label: 'Modrá' },
  { color: '#f0fdf4', label: 'Zelená' },
  { color: '#fefce8', label: 'Žlutá' },
  { color: '#fff1f2', label: 'Červená' },
  { color: '#faf5ff', label: 'Fialová' },
];

// ============================================
// UI COMPONENTS (SIDEBAR)
// ============================================

type ActivePanel = 'board' | 'content' | 'ai' | 'settings';

function SidebarButton({ 
  onClick, 
  isActive = false, 
  icon: Icon, 
  label,
  variant = 'default',
  disabled = false,
  isLoading = false,
}: { 
  onClick: () => void;
  isActive?: boolean;
  icon: any;
  label: string;
  variant?: 'default' | 'orange' | 'green';
  disabled?: boolean;
  isLoading?: boolean;
}) {
  let bgColor = isActive ? '#4E5871' : 'white';
  let iconColor = isActive ? 'white' : '#4E5871';
  let labelColor = '#4E5871';

  if (variant === 'orange') {
    bgColor = isLoading ? '#F5A574' : '#E8956D';
    iconColor = 'white';
    labelColor = '#E8956D';
  } else if (variant === 'green') {
    bgColor = '#4eebc0';
    iconColor = '#4E5871';
    labelColor = '#4E5871';
  }
  
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        if (!disabled && !isLoading) {
          onClick();
        }
      }}
      disabled={disabled || isLoading}
      style={{ 
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: 'none',
        border: 'none',
        padding: 0,
        marginBottom: '8px',
      }}
    >
      <div 
        style={{ 
          width: '70px', 
          height: '70px',
          backgroundColor: bgColor,
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s',
        }}
      >
        {isLoading ? (
          <Loader2 size={28} className="animate-spin" style={{ color: iconColor }} strokeWidth={1.5} />
        ) : (
          <Icon size={28} strokeWidth={1.5} style={{ color: iconColor }} />
        )}
      </div>
      <span 
        style={{ 
          fontSize: '12px',
          fontWeight: 500,
          marginTop: '8px',
          color: labelColor,
          textAlign: 'center',
        }}
      >
        {isLoading ? 'Načítám...' : label}
      </span>
    </button>
  );
}

function AddContentButton({ 
  onClick, 
  isActive,
}: { 
  onClick: () => void;
  isActive: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ 
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        cursor: 'pointer',
        background: 'none',
        border: 'none',
        padding: 0,
        marginBottom: '8px',
      }}
    >
      <div 
        style={{ 
          width: '70px', 
          height: '70px',
          backgroundColor: isActive ? '#4E5871' : 'white',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div 
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : '#4E5871',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Plus size={22} strokeWidth={2} style={{ color: 'white' }} />
        </div>
      </div>
      <span 
        style={{ 
          fontSize: '12px',
          fontWeight: 500,
          marginTop: '8px',
          color: '#4E5871',
          textAlign: 'center',
        }}
      >
        Přidat obsah
      </span>
    </button>
  );
}

// ============================================
// INLINE COLOR PICKER (for page settings panel)
// ============================================

const COLOR_GRID = {
  grays: ['transparent', '#ffffff', '#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b', '#1e293b', '#0f172a'],
  colors: [
    '#7f1d1d', '#b91c1c', '#166534', '#0f766e', '#0369a1', '#1d4ed8', '#6d28d9', '#a21caf',
    '#dc2626', '#ef4444', '#22c55e', '#14b8a6', '#0ea5e9', '#3b82f6', '#8b5cf6', '#d946ef',
    '#fca5a5', '#fecaca', '#86efac', '#5eead4', '#7dd3fc', '#93c5fd', '#c4b5fd', '#f0abfc',
    '#fee2e2', '#fef2f2', '#dcfce7', '#ccfbf1', '#e0f2fe', '#dbeafe', '#ede9fe', '#fae8ff',
  ],
};

function InlineColorPicker({ value, onChange }: { value?: string; onChange: (color: string) => void }) {
  const selectedColor = value || '#ffffff';
  
  return (
    <div className="space-y-3">
      {/* Grays row */}
      <div className="flex gap-1.5 flex-wrap">
        {COLOR_GRID.grays.map((color, idx) => (
          <button
            key={`gray-${idx}`}
            onClick={() => onChange(color === 'transparent' ? '#ffffff' : color)}
            className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${
              selectedColor === color ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-slate-200'
            }`}
            style={{ backgroundColor: color === 'transparent' ? '#fff' : color }}
          >
            {color === 'transparent' && (
              <div className="w-full h-full rounded-full relative overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-5 h-0.5 bg-red-400 rotate-45" />
                </div>
              </div>
            )}
          </button>
        ))}
      </div>
      
      {/* Color grid */}
      <div className="grid grid-cols-8 gap-1.5">
        {COLOR_GRID.colors.map((color, idx) => (
          <button
            key={`color-${idx}`}
            onClick={() => onChange(color)}
            className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${
              selectedColor === color ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-transparent'
            }`}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================
// SLIDE TYPE DEFINITIONS
// ============================================

interface SlideTypeOption {
  id: string;
  type: 'info' | 'activity' | 'tools';
  activityType?: ActivityType;
  label: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}

// Helper to render a single block in thumbnail
function renderBlockThumbnail(block: any, isFirst: boolean = false, compact: boolean = false, fullHeight: boolean = false, templateColor?: string) {
  const fontSize = compact ? '8px' : (isFirst ? '12px' : '9px');
  // Use block background first, then template color as fallback
  const blockBgColor = block.background?.color;
  const bgColor = (blockBgColor && blockBgColor !== 'transparent' && blockBgColor !== '') 
    ? blockBgColor 
    : (templateColor || 'transparent');
  const hasBackground = bgColor !== 'transparent' && bgColor !== '';
  
  // Wrapper style for background color - always fill height when fullHeight is true
  const wrapperStyle: React.CSSProperties = {
    backgroundColor: bgColor,
    height: fullHeight ? '100%' : 'auto',
    minHeight: fullHeight ? '100%' : undefined,
    padding: hasBackground ? '4px' : '2px',
    borderRadius: '2px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: block.verticalAlign === 'bottom' ? 'flex-end' : 
                    block.verticalAlign === 'middle' ? 'center' : 'flex-start',
    overflow: 'hidden',
  };
  
  // Text block with content
  if (block.type === 'text' && block.content) {
    // Calculate max lines based on context - show as much text as possible
    const maxLines = compact ? 10 : (fullHeight ? 20 : 15);
    
    return (
      <div style={wrapperStyle}>
        <p 
          className="leading-tight overflow-hidden"
          style={{ 
            fontSize,
            fontWeight: block.fontWeight === 'bold' || isFirst ? 600 : 400,
            fontFamily: block.fontFamily === 'cooper' ? '"Cooper Light", serif' :
                        block.fontFamily === 'space' ? '"Space Grotesk", sans-serif' :
                        block.fontFamily === 'sora' ? '"Sora", sans-serif' :
                        block.fontFamily === 'playfair' ? '"Playfair Display", serif' :
                        block.fontFamily === 'itim' ? '"Itim", cursive' :
                        block.fontFamily === 'sacramento' ? '"Sacramento", cursive' :
                        block.fontFamily === 'lora' ? '"Lora", serif' :
                        block.fontFamily === 'oswald' ? '"Oswald", sans-serif' :
                        '"Fenomen Sans", sans-serif',
            textAlign: block.textAlign || 'left',
            color: block.textColor || '#1e293b',
            display: '-webkit-box',
            WebkitLineClamp: maxLines,
            WebkitBoxOrient: 'vertical' as const,
            overflow: 'hidden',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {block.content}
        </p>
      </div>
    );
  }
  
  // Image block with content
  if (block.type === 'image' && block.content) {
    return (
      <div style={{ ...wrapperStyle, height: '100%', overflow: 'hidden' }}>
        <img 
          src={block.content} 
          alt="" 
          className="w-full h-full object-cover rounded"
          style={{ 
            objectPosition: block.imagePosition || 'center',
          }}
        />
      </div>
    );
  }
  
  // Any block with background (even without content) - show the colored area
  if (hasBackground) {
    return <div style={wrapperStyle} />;
  }
  
  // Empty block without background - still render placeholder to maintain layout
  if (fullHeight) {
    return <div style={{ ...wrapperStyle, backgroundColor: 'rgba(0,0,0,0.02)' }} />;
  }
  
  return null;
}

// Slide thumbnail - renders visual representation of the slide
function SlidePreviewThumbnail({ slide }: { slide: QuizSlide }) {
  // Info slide
  if (slide.type === 'info') {
    const infoSlide = slide as InfoSlide;
    const bgColor = infoSlide.slideBackground?.color || '#ffffff';
    
    // Get template colors if template is set
    const template = infoSlide.templateId ? getTemplateById(infoSlide.templateId) : undefined;
    const getBlockTemplateColor = (blockIndex: number): string | undefined => {
      if (!template?.blockColors) return undefined;
      return template.blockColors[blockIndex % template.blockColors.length];
    };
    
    // Check for layout blocks
    if (infoSlide.layout?.blocks?.length) {
      const layoutType = infoSlide.layout.type;
      const blocks = infoSlide.layout.blocks;
      
      // Single block layout (full page)
      if (layoutType === 'single') {
        return (
          <div className="w-full h-full p-1 flex items-stretch" style={{ backgroundColor: bgColor }}>
            <div className="flex-1">{blocks[0] && renderBlockThumbnail(blocks[0], true, false, true, getBlockTemplateColor(0))}</div>
          </div>
        );
      }
      
      // Title + content layout
      if (layoutType === 'title-content') {
        return (
          <div className="w-full h-full p-1 flex flex-col gap-0.5" style={{ backgroundColor: bgColor }}>
            <div className="flex-shrink-0">{blocks[0] && renderBlockThumbnail(blocks[0], true, false, false, getBlockTemplateColor(0))}</div>
            <div className="flex-1 min-h-0">{blocks[1] && renderBlockThumbnail(blocks[1], false, false, true, getBlockTemplateColor(1))}</div>
          </div>
        );
      }
      
      // 2 columns layout
      if (layoutType === '2cols') {
        return (
          <div className="w-full h-full p-1 flex gap-0.5" style={{ backgroundColor: bgColor }}>
            <div className="flex-1 min-w-0">{blocks[0] && renderBlockThumbnail(blocks[0], false, true, true, getBlockTemplateColor(0))}</div>
            <div className="flex-1 min-w-0">{blocks[1] && renderBlockThumbnail(blocks[1], false, true, true, getBlockTemplateColor(1))}</div>
          </div>
        );
      }
      
      // Title + 2 columns layout
      if (layoutType === 'title-2cols') {
        return (
          <div className="w-full h-full p-1 flex flex-col gap-0.5" style={{ backgroundColor: bgColor }}>
            <div className="flex-shrink-0">{blocks[0] && renderBlockThumbnail(blocks[0], true, false, false, getBlockTemplateColor(0))}</div>
            <div className="flex-1 flex gap-0.5 min-h-0">
              <div className="flex-1 min-w-0">{blocks[1] && renderBlockThumbnail(blocks[1], false, true, true, getBlockTemplateColor(1))}</div>
              <div className="flex-1 min-w-0">{blocks[2] && renderBlockThumbnail(blocks[2], false, true, true, getBlockTemplateColor(2))}</div>
            </div>
          </div>
        );
      }
      
      // 3 columns layout
      if (layoutType === '3cols') {
        return (
          <div className="w-full h-full p-1 flex gap-0.5" style={{ backgroundColor: bgColor }}>
            <div className="flex-1 min-w-0">{blocks[0] && renderBlockThumbnail(blocks[0], false, true, true, getBlockTemplateColor(0))}</div>
            <div className="flex-1 min-w-0">{blocks[1] && renderBlockThumbnail(blocks[1], false, true, true, getBlockTemplateColor(1))}</div>
            <div className="flex-1 min-w-0">{blocks[2] && renderBlockThumbnail(blocks[2], false, true, true, getBlockTemplateColor(2))}</div>
          </div>
        );
      }
      
      // Title + 3 columns layout
      if (layoutType === 'title-3cols') {
        return (
          <div className="w-full h-full p-1 flex flex-col gap-0.5" style={{ backgroundColor: bgColor }}>
            <div className="flex-shrink-0">{blocks[0] && renderBlockThumbnail(blocks[0], true, false, false, getBlockTemplateColor(0))}</div>
            <div className="flex-1 flex gap-0.5 min-h-0">
              <div className="flex-1 min-w-0">{blocks[1] && renderBlockThumbnail(blocks[1], false, true, true, getBlockTemplateColor(1))}</div>
              <div className="flex-1 min-w-0">{blocks[2] && renderBlockThumbnail(blocks[2], false, true, true, getBlockTemplateColor(2))}</div>
              <div className="flex-1 min-w-0">{blocks[3] && renderBlockThumbnail(blocks[3], false, true, true, getBlockTemplateColor(3))}</div>
            </div>
          </div>
        );
      }
      
      // Left large + right split layout
      if (layoutType === 'left-large-right-split') {
        return (
          <div className="w-full h-full p-1 flex gap-0.5" style={{ backgroundColor: bgColor }}>
            <div className="flex-[2] min-w-0">{blocks[0] && renderBlockThumbnail(blocks[0], true, false, true, getBlockTemplateColor(0))}</div>
            <div className="flex-1 flex flex-col gap-0.5 min-w-0">
              <div className="flex-1 min-h-0">{blocks[1] && renderBlockThumbnail(blocks[1], false, true, true, getBlockTemplateColor(1))}</div>
              <div className="flex-1 min-h-0">{blocks[2] && renderBlockThumbnail(blocks[2], false, true, true, getBlockTemplateColor(2))}</div>
            </div>
          </div>
        );
      }
      
      // Right large + left split layout
      if (layoutType === 'right-large-left-split') {
        return (
          <div className="w-full h-full p-1 flex gap-0.5" style={{ backgroundColor: bgColor }}>
            <div className="flex-1 flex flex-col gap-0.5 min-w-0">
              <div className="flex-1 min-h-0">{blocks[0] && renderBlockThumbnail(blocks[0], false, true, true, getBlockTemplateColor(0))}</div>
              <div className="flex-1 min-h-0">{blocks[1] && renderBlockThumbnail(blocks[1], false, true, true, getBlockTemplateColor(1))}</div>
            </div>
            <div className="flex-[2] min-w-0">{blocks[2] && renderBlockThumbnail(blocks[2], true, false, true, getBlockTemplateColor(2))}</div>
          </div>
        );
      }
      
      // Grid 2x2 layout
      if (layoutType === 'grid-2x2') {
        return (
          <div className="w-full h-full p-1 grid grid-cols-2 grid-rows-2 gap-0.5" style={{ backgroundColor: bgColor }}>
            <div className="min-w-0 min-h-0">{blocks[0] && renderBlockThumbnail(blocks[0], false, true, true, getBlockTemplateColor(0))}</div>
            <div className="min-w-0 min-h-0">{blocks[1] && renderBlockThumbnail(blocks[1], false, true, true, getBlockTemplateColor(1))}</div>
            <div className="min-w-0 min-h-0">{blocks[2] && renderBlockThumbnail(blocks[2], false, true, true, getBlockTemplateColor(2))}</div>
            <div className="min-w-0 min-h-0">{blocks[3] && renderBlockThumbnail(blocks[3], false, true, true, getBlockTemplateColor(3))}</div>
          </div>
        );
      }
      
      // Default fallback - vertical stack
      return (
        <div 
          className="w-full h-full p-2 flex flex-col gap-1"
          style={{ backgroundColor: bgColor }}
        >
          {blocks.slice(0, 3).map((block, i) => (
            <div key={i} className="overflow-hidden">
              {renderBlockThumbnail(block, i === 0, false, false, getBlockTemplateColor(i))}
            </div>
          ))}
        </div>
      );
    }
    
    // Legacy
    return (
      <div className="w-full h-full p-3 flex flex-col justify-center" style={{ backgroundColor: bgColor }}>
        {infoSlide.title && (
          <p className="text-sm font-bold text-slate-800 text-center mb-2">{infoSlide.title}</p>
        )}
        {infoSlide.media?.url && (
          <img src={infoSlide.media.url} alt="" className="w-full h-16 object-cover rounded" />
        )}
      </div>
    );
  }
  
  // Activity slides
  const activitySlide = slide as any;
  const question = activitySlide.question || activitySlide.instruction || '';
  
  switch (activitySlide.activityType) {
    case 'abc':
    case 'true-false':
      return (
        <div className="w-full h-full p-3 bg-white flex flex-col">
          <p className="text-xs font-bold text-slate-800 text-center mb-2 line-clamp-2">{question || 'Otázka'}</p>
          <div className="flex-1 flex flex-col gap-1 justify-center">
            {(activitySlide.options || []).slice(0, 4).map((opt: any, i: number) => (
              <div 
                key={i} 
                className="flex items-center gap-1 px-2 py-1 rounded text-[10px]"
                style={{ backgroundColor: opt.isCorrect ? '#dcfce7' : '#f1f5f9' }}
              >
                <span className="font-bold text-slate-500">{String.fromCharCode(65 + i)}</span>
                <span className="text-slate-700 truncate">{opt.text?.slice(0, 25) || ''}</span>
              </div>
            ))}
          </div>
        </div>
      );
    
    case 'open':
      return (
        <div className="w-full h-full p-3 bg-white flex flex-col">
          <p className="text-xs font-bold text-slate-800 text-center mb-3 line-clamp-2">{question || 'Otázka'}</p>
          <div className="flex-1 border-2 border-dashed border-slate-300 rounded bg-slate-50" />
        </div>
      );
    
    case 'example':
      return (
        <div className="w-full h-full p-3 bg-white flex flex-col">
          <p className="text-xs font-bold text-slate-800 text-center mb-2">{activitySlide.topic || 'Příklady'}</p>
          <div className="flex-1 flex flex-col gap-1">
            {(activitySlide.examples || []).slice(0, 3).map((ex: any, i: number) => (
              <div key={i} className="text-[10px] text-slate-700 bg-emerald-50 px-2 py-1 rounded truncate">
                {i + 1}) {ex.question?.slice(0, 20) || '...'}
              </div>
            ))}
          </div>
        </div>
      );
    
    case 'fill-blanks':
      return (
        <div className="w-full h-full p-3 bg-white flex items-center justify-center">
          <div className="text-[10px] text-slate-700 text-center flex flex-wrap justify-center gap-1">
            <span>Text</span>
            <span className="bg-purple-200 px-2 rounded">____</span>
            <span>slovo</span>
            <span className="bg-purple-200 px-2 rounded">____</span>
          </div>
        </div>
      );
    
    case 'connect-pairs':
      return (
        <div className="w-full h-full p-2 bg-white flex items-center justify-between gap-2">
          <div className="flex flex-col gap-1 flex-1">
            {(activitySlide.pairs || []).slice(0, 4).map((_: any, i: number) => (
              <div key={i} className="h-4 bg-orange-100 rounded text-[8px] flex items-center justify-center text-orange-700">
                {i + 1}
              </div>
            ))}
          </div>
          <div className="text-orange-400 text-lg">↔</div>
          <div className="flex flex-col gap-1 flex-1">
            {(activitySlide.pairs || []).slice(0, 4).map((_: any, i: number) => (
              <div key={i} className="h-4 bg-orange-100 rounded text-[8px] flex items-center justify-center text-orange-700">
                {String.fromCharCode(65 + i)}
              </div>
            ))}
          </div>
        </div>
      );
    
    case 'image-hotspots':
      return (
        <div className="w-full h-full relative bg-slate-100">
          {activitySlide.imageUrl ? (
            <>
              <img src={activitySlide.imageUrl} alt="" className="w-full h-full object-cover" />
              {(activitySlide.hotspots || []).slice(0, 5).map((h: any, i: number) => (
                <div 
                  key={i}
                  className="absolute w-3 h-3 bg-pink-500 rounded-full border border-white"
                  style={{ left: `${h.x}%`, top: `${h.y}%`, transform: 'translate(-50%, -50%)' }}
                />
              ))}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-[10px] text-slate-400">Obrázek</span>
            </div>
          )}
        </div>
      );
    
    case 'video-quiz':
      return (
        <div className="w-full h-full bg-slate-800 flex flex-col items-center justify-center">
          <div className="w-12 h-8 bg-black rounded flex items-center justify-center mb-1">
            <div className="w-0 h-0 border-l-[8px] border-l-white border-y-[5px] border-y-transparent" />
          </div>
          <span className="text-[9px] text-white/70">{activitySlide.questions?.length || 0} otázek</span>
        </div>
      );
    
    case 'voting':
      return (
        <div className="w-full h-full p-3 bg-white flex flex-col">
          <p className="text-[10px] font-bold text-slate-800 text-center mb-2 truncate">{question || 'Hlasování'}</p>
          <div className="flex-1 flex items-end justify-center gap-1">
            {[40, 70, 30, 55].map((h, i) => (
              <div key={i} className="w-4 bg-indigo-400 rounded-t" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
      );
    
    case 'board':
      return (
        <div className="w-full h-full p-2 bg-white flex flex-col">
          <p className="text-[10px] font-bold text-slate-800 text-center mb-2 truncate">{question || 'Nástěnka'}</p>
          <div className="flex-1 grid grid-cols-3 gap-1">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-amber-100 rounded" />
            ))}
          </div>
        </div>
      );
    
    default:
      return (
        <div className="w-full h-full bg-slate-100 flex items-center justify-center">
          <span className="text-xs text-slate-400">Náhled</span>
        </div>
      );
  }
}

// ============================================
// SORTABLE ITEM COMPONENT
// ============================================

function SortableSlideItem({ 
  slide, 
  index, 
  selectedSlideId, 
  setSelectedSlideId, 
  multiSelectedIds,
  setMultiSelectedIds,
  typeInfo, 
  chapterName, 
  chapterCount, 
  showSlidePreviews,
  duplicateSlide,
  deleteSlide,
  getSlideTitle
}: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: slide.id });

  const isActive = selectedSlideId === slide.id;
  const isMultiSelected = multiSelectedIds.includes(slide.id);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : (isActive ? 10 : (isMultiSelected ? 5 : 0)),
    position: 'relative' as const,
  };

  const handleItemClick = (e: React.MouseEvent) => {
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      if (isMultiSelected) {
        setMultiSelectedIds(multiSelectedIds.filter((id: string) => id !== slide.id));
      } else {
        setMultiSelectedIds([...multiSelectedIds, slide.id]);
      }
    } else {
      setSelectedSlideId(slide.id);
      setMultiSelectedIds([]);
    }
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes}
      {...listeners}
      data-slide-id={slide.id}
      className="outline-none"
    >
      {/* Compact view (no visual preview) */}
      {!showSlidePreviews ? (
        <div
          onClick={handleItemClick}
          className={`
            group relative flex flex-col rounded-xl cursor-pointer transition-all border-2
            ${isActive
              ? 'border-indigo-600 ring-1 ring-indigo-600 shadow-xl z-[10] bg-white' 
              : isMultiSelected
                ? 'border-blue-400 border-dashed shadow-md z-[5] bg-white'
                : 'border-slate-200 hover:border-indigo-200 hover:shadow-sm z-0 bg-white'
            }
          `}
        >
          {chapterName && (
            <div className="px-3 py-2 flex items-center gap-2.5 bg-transparent border-b border-slate-50">
              <div className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                {chapterCount}
              </div>
              <span className="text-[11px] font-bold truncate text-indigo-700">{chapterName}</span>
            </div>
          )}
          
          <div className="flex items-center gap-2.5 py-2 px-3">
            <div className="flex items-center gap-1.5">
              <span className={`text-[10px] font-bold w-4 text-center ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}>{index + 1}</span>
              <div 
                className={`rounded p-1 ${isActive ? 'text-indigo-400 hover:bg-indigo-50' : 'text-slate-300 hover:bg-slate-50'}`}
              >
                <GripVertical className="w-3 h-3" />
              </div>
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div 
                  className="w-6 h-6 rounded flex items-center justify-center shrink-0"
                  style={{ color: isActive ? '#4f46e5' : typeInfo.color }}
                >
                  {React.cloneElement(typeInfo.icon as React.ReactElement, { className: 'w-[18px] h-[18px]' })}
                </div>
                <p className={`text-[13px] font-semibold truncate leading-snug ${isActive ? 'text-indigo-900' : 'text-slate-700'}`}>
                  {getSlideTitle(slide) || <span className="text-slate-400 italic font-normal">Bez názvu</span>}
                </p>
              </div>
            </div>
            
            {/* Actions overlay */}
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
              <button
                onClick={(e) => { e.stopPropagation(); duplicateSlide(slide.id); }}
                className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-indigo-600"
                title="Duplikovat"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); deleteSlide(slide.id); }}
                className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"
                title="Smazat"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Preview view with visual thumbnail */
        <div
          onClick={handleItemClick}
          className={`
            group relative rounded-xl cursor-pointer transition-all border-2 overflow-hidden
            ${isActive
              ? 'border-indigo-600 ring-1 ring-indigo-600 shadow-2xl z-[10] bg-white' 
              : isMultiSelected
                ? 'border-blue-400 border-dashed shadow-lg z-[5] bg-white'
                : 'border-slate-200 hover:border-indigo-300 hover:shadow-md z-0 bg-white'
            }
          `}
        >
          {chapterName && (
            <div className="px-2.5 py-1.5 flex items-center gap-2 border-b border-slate-50 bg-transparent">
              <div className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                {chapterCount}
              </div>
              <span className="text-[10px] font-bold truncate text-indigo-700">{chapterName}</span>
            </div>
          )}

          {/* Header bar */}
          <div className={`flex items-center gap-2 px-2 py-1.5 border-b ${isActive ? 'bg-indigo-50/30 border-indigo-100' : 'bg-slate-50 border-slate-200'}`}>
            <div 
              className={`rounded p-0.5 ${isActive ? 'text-indigo-400 hover:bg-indigo-50' : 'text-slate-300 hover:bg-slate-200'}`}
            >
              <GripVertical className="w-3 h-3" />
            </div>
            <span className={`text-xs font-bold ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}>{index + 1}</span>
            <div 
              className="w-5 h-5 rounded flex items-center justify-center shrink-0"
              style={{ color: isActive ? '#4f46e5' : typeInfo.color }}
            >
              {React.cloneElement(typeInfo.icon as React.ReactElement, { className: 'w-3.5 h-3.5' })}
            </div>
            <span className={`text-[11px] font-bold flex-1 truncate ${isActive ? 'text-indigo-900' : 'text-slate-700'}`}>
                {getSlideTitle(slide) || <span className="text-slate-400 italic font-normal">Bez názvu</span>}
            </span>
            
            {/* Actions */}
            <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 transition-opacity">
              <button
                onClick={(e) => { e.stopPropagation(); duplicateSlide(slide.id); }}
                className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-indigo-600"
                title="Duplikovat"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); deleteSlide(slide.id); }}
                className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-500"
                title="Smazat"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          
          {/* Visual preview - slide thumbnail with 16:9 aspect ratio */}
          <div className="overflow-hidden rounded" style={{ aspectRatio: '16/9', width: '100%' }}>
            <SlidePreviewThumbnail slide={slide} />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// STORAGE (using centralized quiz-storage)
// ============================================

const { saveQuiz, getQuiz: loadQuizLocal, getQuizAsync: loadQuizAsync } = quizStorage;

// ============================================
// SESSION TYPES
// ============================================

interface StudentResponse {
  slideId: string;
  answer: string | string[];
  isCorrect?: boolean;
  answeredAt: string;
}

interface SessionStudent {
  studentName: string;
  responses: Record<string, StudentResponse>;
  completedAt?: string;
  joinedAt?: string;
  isOnline?: boolean;
}

interface SessionData {
  id: string;
  type: 'live' | 'shared';
  sessionName?: string;
  quizId: string;
  createdAt: string;
  endedAt?: string;
  students: Record<string, SessionStudent>;
  settings?: {
    anonymousAccess?: boolean;
    showSolutionHints?: boolean;
    showActivityResults?: boolean;
  };
}

const ColorIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg width="21" height="19" viewBox="0 0 21 19" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <g>
      <path d="M4.15823 17.3472H0.835443C0.379747 17.3472 0 17.7186 0 18.1644C0 18.6101 0.379747 18.9816 0.835443 18.9816H4.13924C4.59494 18.9816 4.97468 18.6101 4.97468 18.1644C4.97468 17.7186 4.59494 17.3472 4.13924 17.3472H4.15823Z" fill="currentColor"/>
      <path d="M16.6899 0L14.1076 5.99902C14.1076 5.99902 14.1646 5.99902 14.2025 5.99902C15.8734 5.99902 17.3544 6.70479 18.3987 7.80059L20.981 1.78299L16.6709 0.0185728L16.6899 0Z" fill="currentColor"/>
      <path d="M14.2025 7.52197C11.8861 7.52197 10.0063 9.36068 10.0063 11.6266C10.0063 14.3939 9.91138 17.4027 6.70252 17.4213C6.2848 17.4213 5.94302 17.7556 5.94302 18.1828C5.94302 18.6099 6.2848 18.9257 6.70252 18.9443C15.8544 18.9443 18.3987 13.911 18.3987 11.6451C18.3987 9.37925 16.519 7.54055 14.2025 7.54055V7.52197Z" fill="currentColor"/>
    </g>
  </svg>
);

// ============================================
// MAIN COMPONENT
// ============================================

interface QuizEditorLayoutProps {
  theme?: 'light' | 'dark';
}

export function QuizEditorLayout({ theme = 'light' }: QuizEditorLayoutProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Get returnUrl from search params (for admin navigation)
  const returnUrl = searchParams.get('returnUrl');
    
  // Track window width for responsive toolbar labels
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Check if user is admin (for showing advanced features)
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const email = session?.user?.email;
      setIsAdmin(email?.endsWith('@admin.cz') || email === '123456@gmail.com' || email === 'vitekskop@vividbooks.com');
    });
  }, []);
  
  // Quiz state
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const quizRef = useRef<Quiz | null>(null); // Ref to always have current quiz value
  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Keep ref in sync with state
  useEffect(() => {
    quizRef.current = quiz;
  }, [quiz]);
  
  // Warn user before closing page with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty || isSaving) {
        e.preventDefault();
        e.returnValue = 'Máte neuložené změny. Opravdu chcete odejít?';
        return e.returnValue;
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, isSaving]);
  
  const [showPreview, setShowPreview] = useState(false);
  const [isImportingPdf, setIsImportingPdf] = useState(false);
  const [showNewSlideDropdown, setShowNewSlideDropdown] = useState(false);
  const [showShareEditDialog, setShowShareEditDialog] = useState(false);
  const [boardComments, setBoardComments] = useState<BoardComment[]>([]);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  
  // Load board comments
  const loadComments = useCallback(async () => {
    if (id) {
      const comments = await getBoardComments(id);
      setBoardComments(comments);
    }
  }, [id]);
  
  useEffect(() => {
    loadComments();
  }, [loadComments]);
  const newSlideDropdownRef = useRef<HTMLDivElement>(null);
  const dropdownContentRef = useRef<HTMLDivElement>(null);

  const { uploadFile } = useFileStorage();

  // Dnd sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement to start drag (prevents accidental drags on click)
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (quiz && over && active.id !== over.id) {
      const activeId = active.id as string;
      const overId = over.id as string;
      
      const oldIndex = quiz.slides.findIndex((s) => s.id === activeId);
      const newIndex = quiz.slides.findIndex((s) => s.id === overId);
      
      let newSlides = [...quiz.slides];
      
      if (multiSelectedIds.includes(activeId)) {
        // Multi-drag: move all selected slides together to the target position
        const selectedIndices = multiSelectedIds
          .map(id => quiz.slides.findIndex(s => s.id === id))
          .filter(idx => idx !== -1)
          .sort((a, b) => a - b);
        
        const selectedSlides = selectedIndices.map(idx => quiz.slides[idx]);
        
        // Remove selected slides
        newSlides = newSlides.filter(s => !multiSelectedIds.includes(s.id));
        
        // Find new insertion point after removal
        let adjustedNewIndex = newSlides.findIndex(s => s.id === overId);
        
        // Determine if we should insert before or after the 'over' item
        // If we are moving downwards, insert after. If upwards, insert before.
        // Actually, SortableContext logic usually handles this. 
        // Let's match the target index as closely as possible.
        if (oldIndex < newIndex) {
          adjustedNewIndex += 1; // Insert after
        }
        
        newSlides.splice(adjustedNewIndex, 0, ...selectedSlides);
      } else {
        // Single drag
        newSlides = arrayMove(quiz.slides, oldIndex, newIndex);
      }
      
      // Update slide order property
      newSlides.forEach((s, idx) => {
        s.order = idx;
      });
      
      updateQuizWithUndo({
        ...quiz,
        slides: newSlides,
        updatedAt: new Date().toISOString()
      });
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const isInsideTrigger = newSlideDropdownRef.current?.contains(target);
      const isInsideContent = dropdownContentRef.current?.contains(target);
      
      if (!isInsideTrigger && !isInsideContent) {
        setShowNewSlideDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  
  // Undo/Redo state
  const [undoStack, setUndoStack] = useState<Quiz[]>([]);
  const [redoStack, setRedoStack] = useState<Quiz[]>([]);
  const maxUndoSteps = 50;

  // Update quiz with undo support
  const updateQuizWithUndo = useCallback((newQuiz: Quiz) => {
    if (quiz) {
      setUndoStack(prev => {
        const newStack = [...prev, quiz];
        return newStack.slice(-maxUndoSteps);
      });
      setRedoStack([]); // Clear redo on new action
    }
    setQuiz(newQuiz);
    setIsDirty(true);
  }, [quiz]);

  // Undo action
  const undo = useCallback(() => {
    if (undoStack.length > 0) {
      const previousState = undoStack[undoStack.length - 1];
      setUndoStack(prev => prev.slice(0, -1));
      if (quiz) {
        setRedoStack(prev => [...prev, quiz]);
      }
      setQuiz(previousState);
      setIsDirty(true);
    }
  }, [undoStack, quiz]);

  // Redo action
  const redo = useCallback(() => {
    if (redoStack.length > 0) {
      const nextState = redoStack[redoStack.length - 1];
      setRedoStack(prev => prev.slice(0, -1));
      if (quiz) {
        setUndoStack(prev => [...prev, quiz]);
      }
      setQuiz(nextState);
      setIsDirty(true);
    }
  }, [redoStack, quiz]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo/Redo shortcuts
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);
  
  // UI state
  const [isResizing, setIsResizing] = useState(false);
  const [showLiveSession, setShowLiveSession] = useState(false);
  const [viewMode, setViewMode] = useState<'editor' | 'results'>(
    (searchParams.get('tab') as 'editor' | 'results') || 'editor'
  );
  // Open AI panel automatically if coming from PDF or Worksheet
  const fromPdfParam = searchParams.get('fromPdf') === 'true';
  const fromWorksheetParam = searchParams.get('fromWorksheet') === 'true';
  const openAIParam = searchParams.get('openAI') === 'true';
  const [activePanel, setActivePanel] = useState<ActivePanel>((fromPdfParam || fromWorksheetParam || openAIParam) ? 'ai' : 'board');
  const [contentPanelMode, setContentPanelMode] = useState<'add' | 'change'>('add');
  const [showSettings, setShowSettings] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showImportInput, setShowImportInput] = useState(false);
  const [importInputValue, setImportInputValue] = useState('');
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showActivitiesSubmenu, setShowActivitiesSubmenu] = useState(false);
  const [showSlidePreviews, setShowSlidePreviews] = useState(false);
  const [showPageSettings, setShowPageSettings] = useState(false);
  const [pageSettingsSection, setPageSettingsSection] = useState<'type' | 'template' | 'layout' | 'background' | 'chapter' | 'note' | 'comments' | undefined>(undefined);
  const [pageSettingsInitialShowActivities, setPageSettingsInitialShowActivities] = useState(false);
  const [selectedBlockIndex, setSelectedBlockIndex] = useState<number | null>(null);
  const [showBlockSettings, setShowBlockSettings] = useState(false); // Panel se otevírá jen explicitně
  const [blockSettingsSection, setBlockSettingsSection] = useState<string | null>(null);
  const [showBlockColorPicker, setShowBlockColorPicker] = useState(false);

  // Multi-selection and Marquee
  const [multiSelectedIds, setMultiSelectedIds] = useState<string[]>([]);
  const [selectionRect, setSelectionRect] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  const [isMarqueeSelecting, setIsMarqueeSelecting] = useState(false);
  const marqueeStartPos = useRef<{ x: number, y: number } | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleMarqueeMouseDown = (e: React.MouseEvent) => {
    // Only if clicking on the background of the list container (or the container itself)
    // We check if the click target is the container or a spacer, not a slide card
    const target = e.target as HTMLElement;
    if (target.closest('[data-slide-id]')) return;

    setIsMarqueeSelecting(true);
    
    // Get coordinates relative to the scroll container
    const rect = scrollContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const startX = e.clientX;
    const startY = e.clientY;
    
    marqueeStartPos.current = { x: startX, y: startY };
    setSelectionRect({ x: startX, y: startY, w: 0, h: 0 });
    
    // Clear selection if not holding shift
    if (!e.shiftKey) {
      setMultiSelectedIds([]);
    }
  };

  const handleMarqueeMouseMove = (e: React.MouseEvent) => {
    if (!isMarqueeSelecting || !marqueeStartPos.current) return;

    const x = Math.min(e.clientX, marqueeStartPos.current.x);
    const y = Math.min(e.clientY, marqueeStartPos.current.y);
    const w = Math.abs(e.clientX - marqueeStartPos.current.x);
    const h = Math.abs(e.clientY - marqueeStartPos.current.y);

    setSelectionRect({ x, y, w, h });
    
    // Find items within rect
    if (quiz && scrollContainerRef.current) {
      const items = scrollContainerRef.current.querySelectorAll('[data-slide-id]');
      const newSelectedIds: string[] = e.shiftKey ? [...multiSelectedIds] : [];
      
      items.forEach((item) => {
        const rect = item.getBoundingClientRect();
        const slideId = item.getAttribute('data-slide-id');
        if (!slideId) return;

        const isInside = 
          rect.left < x + w &&
          rect.right > x &&
          rect.top < y + h &&
          rect.bottom > y;

        if (isInside) {
          if (!newSelectedIds.includes(slideId)) {
            newSelectedIds.push(slideId);
          }
        } else if (!e.shiftKey) {
          const idx = newSelectedIds.indexOf(slideId);
          if (idx > -1) newSelectedIds.splice(idx, 1);
        }
      });
      
      setMultiSelectedIds(newSelectedIds);
    }
  };

  const handleMarqueeMouseUp = () => {
    setIsMarqueeSelecting(false);
    setSelectionRect(null);
    marqueeStartPos.current = null;
  };

  useEffect(() => {
    if (isMarqueeSelecting) {
      const handleGlobalMouseMove = (e: MouseEvent) => handleMarqueeMouseMove(e as any);
      const handleGlobalMouseUp = () => handleMarqueeMouseUp();
      
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleGlobalMouseMove);
        window.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isMarqueeSelecting, multiSelectedIds]);

  // Helper to open page settings and close block settings
  const openPageSettings = (section?: typeof pageSettingsSection, showActivities = false) => {
    setSelectedBlockIndex(null);
    setPageSettingsSection(section);
    setPageSettingsInitialShowActivities(showActivities);
    setShowPageSettings(true);
  };
  
  // Toggle page settings - close if open, open if closed
  const togglePageSettings = () => {
    if (showPageSettings) {
      setShowPageSettings(false);
      setPageSettingsSection(undefined);
      setPageSettingsInitialShowActivities(false);
    } else {
      setSelectedBlockIndex(null);
      setPageSettingsSection(undefined);
      setShowPageSettings(true);
    }
  };
  const [editingTextBlockIndex, setEditingTextBlockIndex] = useState<number | null>(null);
  
  
  // Results state
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  
  // Get current user
  const profile = storage.getCurrentUserProfile();
  
  // Version history hook
  const versionHistory = useVersionHistory({
    documentId: id || '',
    documentType: 'quiz',
    content: quiz ? JSON.stringify(quiz) : '',
    title: quiz?.title || 'Nová tabule',
    userId: profile?.userId,
    userType: 'teacher',
    userName: profile?.firstName,
    autoSave: true,
    autoSaveDelay: 10000, // Auto-save every 10 seconds for better UX
    onVersionRestored: useCallback((version) => {
      try {
        const restoredQuiz = JSON.parse(version.content);
        setQuiz(restoredQuiz);
        setIsDirty(true);
      } catch (e) {
        console.error('Failed to parse restored quiz:', e);
      }
    }, []),
  });
  
  // Load sessions when Results tab is active
  useEffect(() => {
    if (viewMode !== 'results' || !id) return;
    
    setLoadingSessions(true);
    
    // Load live sessions
    const liveSessionsRef = ref(database, 'quiz_sessions');
    const sharedSessionsRef = ref(database, 'quiz_shares');
    
    // Combined loading
    let liveLoaded = false;
    let sharedLoaded = false;
    let liveData: SessionData[] = [];
    let sharedData: SessionData[] = [];
    
    const combineAndSetSessions = () => {
      if (liveLoaded && sharedLoaded) {
        const allSessions = [...liveData, ...sharedData];
        // Filter out sessions with 0 participants
        const activeSessions = allSessions.filter(session => {
          const studentCount = Object.keys(session.students || {}).length;
          return studentCount > 0;
        });
        
        activeSessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setSessions(activeSessions);
        setLoadingSessions(false);
      }
    };
    
    // Listener for live sessions
    onValue(liveSessionsRef, (snapshot) => {
      const data = snapshot.val();
      liveData = [];
      if (data) {
        Object.entries(data).forEach(([sessionId, sessionData]: [string, any]) => {
          if (sessionData.quizId === id) {
            liveData.push({
              id: sessionId,
              type: 'live',
              sessionName: sessionData.teacherName ? `Živé promítání - ${sessionData.teacherName}` : 'Živé promítání',
              quizId: sessionData.quizId,
              createdAt: sessionData.createdAt,
              endedAt: sessionData.endedAt,
              students: sessionData.students || {},
            });
          }
        });
      }
      liveLoaded = true;
      combineAndSetSessions();
    });
    
    // Listener for shared sessions
    onValue(sharedSessionsRef, (snapshot) => {
      const data = snapshot.val();
      sharedData = [];
      if (data) {
        Object.entries(data).forEach(([sessionId, sessionData]: [string, any]) => {
          if (sessionData.quizId === id) {
            // Convert responses format to students format for consistency
            const students: Record<string, SessionStudent> = {};
            if (sessionData.responses) {
              Object.entries(sessionData.responses).forEach(([studentId, studentData]: [string, any]) => {
                students[studentId] = {
                  studentName: studentData.studentName || 'Anonymní',
                  responses: studentData.responses || {},
                  completedAt: studentData.completedAt,
                };
              });
            }
            
            sharedData.push({
              id: sessionId,
              type: 'shared',
              sessionName: sessionData.sessionName || 'Sdílený úkol',
              quizId: sessionData.quizId,
              createdAt: sessionData.createdAt,
              students: students,
              settings: sessionData.settings,
            });
          }
        });
      }
      sharedLoaded = true;
      combineAndSetSessions();
    });
    
    return () => {
      off(liveSessionsRef);
      off(sharedSessionsRef);
    };
  }, [viewMode, id]);
  
  // Loading state for async quiz fetch
  const [isLoadingQuiz, setIsLoadingQuiz] = useState(true);
  
  // Load or create quiz (with async Supabase fallback)
  useEffect(() => {
    if (!id) return;
    
    const loadQuizData = async () => {
      setIsLoadingQuiz(true);
      
      // First try localStorage (fast)
      let existingQuiz = loadQuizLocal(id);
      
      // If not in localStorage, try Supabase (for cross-browser support)
      if (!existingQuiz) {
        console.log('[QuizEditor] Quiz not in localStorage, trying Supabase...');
        existingQuiz = await loadQuizAsync(id);
      }
      
      if (existingQuiz) {
        console.log('[QuizEditor] Loaded existing quiz:', existingQuiz.id, existingQuiz.title);
        setQuiz(existingQuiz);
        if (existingQuiz.slides.length > 0) {
          setSelectedSlideId(existingQuiz.slides[0].id);
        }
      } else {
        console.log('[QuizEditor] Creating new quiz:', id);
        const newQuiz = createEmptyQuiz(id);
        
        // Check if coming from PDF or Worksheet with context
        const fromPdf = searchParams.get('fromPdf') === 'true';
        const fromWorksheet = searchParams.get('fromWorksheet') === 'true';
        console.log('[QuizEditor] fromPdf:', fromPdf, 'fromWorksheet:', fromWorksheet);
        if (fromPdf || fromWorksheet) {
          const pdfDataStr = sessionStorage.getItem('vividboard_from_pdf');
          console.log('[QuizEditor] sessionStorage data exists:', !!pdfDataStr);
          if (pdfDataStr) {
            try {
              const pdfData = JSON.parse(pdfDataStr);
              console.log('[QuizEditor] Parsed PDF data:', {
                title: pdfData.title,
                transcriptLength: pdfData.transcript?.length || 0,
                sourceId: pdfData.sourceId,
                preview: pdfData.transcript?.substring(0, 100)
              });
              newQuiz.title = pdfData.title || pdfData.sourceTitle || 'Nový Vividboard';
              // Store transcript for AI panel to use (persisted in quiz)
              newQuiz.pdfTranscript = pdfData.transcript;
              // Store source worksheet info for linking back
              if (pdfData.linkBackToWorksheet && pdfData.sourceId) {
                newQuiz.sourceWorksheet = {
                  id: pdfData.sourceId,
                  slug: pdfData.sourceSlug,
                  category: pdfData.sourceCategory
                };
              }
              // Clear sessionStorage
              sessionStorage.removeItem('vividboard_from_pdf');
            } catch (e) {
              console.error('[QuizEditor] Failed to parse PDF data:', e);
            }
          } else {
            console.log('[QuizEditor] No PDF data in sessionStorage, checking URL params');
            // Fallback: read source info from URL params
            const sourceId = searchParams.get('sourceId');
            const sourceSlug = searchParams.get('sourceSlug');
            const sourceCategory = searchParams.get('sourceCategory');
            if (sourceId && sourceCategory) {
              console.log('[QuizEditor] Found source info in URL:', { sourceId, sourceSlug, sourceCategory });
              newQuiz.sourceWorksheet = {
                id: sourceId,
                slug: sourceSlug || sourceId,
                category: sourceCategory
              };
            }
          }
        }
        
        console.log('[QuizEditor] Setting quiz with sourceWorksheet:', newQuiz.sourceWorksheet);
        setQuiz(newQuiz);
        if (newQuiz.slides.length > 0) {
          setSelectedSlideId(newQuiz.slides[0].id);
        }
        
        // Save immediately to localStorage to prevent race conditions with sync
        // This ensures the quiz exists before any Supabase sync can overwrite
        // Filter in getQuizList() will hide empty quizzes from the library
        saveQuiz(newQuiz);
        console.log('[QuizEditor] Saved new quiz to localStorage:', newQuiz.id);
      }
      
      setIsLoadingQuiz(false);
    };
    
    loadQuizData();
  }, [id, searchParams]);
  
  // Auto-save (local + server)
  useEffect(() => {
    if (quiz && isDirty && !isSaving) {
      const timer = setTimeout(async () => {
        setIsSaving(true);
        console.log('[AutoSave] Starting save...');
        
        // Save to localStorage
        saveQuiz(quiz);
        setIsDirty(false);
        
        // Also save to Supabase pages API (server) for cross-browser access
        try {
          let accessToken: string | undefined;
          try {
            const storageKey = `sb-njbtqmsxbyvpwigfceke-auth-token`;
            const stored = localStorage.getItem(storageKey);
            if (stored) {
              const parsed = JSON.parse(stored);
              accessToken = parsed?.access_token;
            }
          } catch (e) {}
          
          if (accessToken) {
            const boardSlug = `board-${quiz.id}`;
            await fetch(
              `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/pages`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  slug: boardSlug,
                  title: quiz.title || 'Board',
                  category: 'knihovna-vividbooks',
                  type: 'board',
                  worksheetData: quiz,
                })
              }
            );
            console.log('[AutoSave] Board saved to server');
          }
        } catch (err) {
          console.warn('[AutoSave] Server save failed:', err);
        } finally {
          setIsSaving(false);
          console.log('[AutoSave] Save complete');
        }
      }, 2000); // 2 seconds delay for server save
      return () => clearTimeout(timer);
    }
  }, [quiz, isDirty, isSaving]);
  
  // Publish to server (Supabase pages API)
  
  // Get selected slide
  const selectedSlide = quiz?.slides.find(s => s.id === selectedSlideId) || null;
  const selectedSlideIndex = quiz?.slides.findIndex(s => s.id === selectedSlideId) ?? -1;
  
  // Track window width for responsive navigation arrows
  const [showNavArrows, setShowNavArrows] = useState(window.innerWidth >= 1265);
  
  useEffect(() => {
    const handleResize = () => {
      setShowNavArrows(window.innerWidth >= 1265);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Navigation functions for editor
  const goToPrevSlide = useCallback(() => {
    if (!quiz || selectedSlideIndex <= 0) return;
    setSelectedSlideId(quiz.slides[selectedSlideIndex - 1].id);
  }, [quiz, selectedSlideIndex]);
  
  const goToNextSlide = useCallback(() => {
    if (!quiz || selectedSlideIndex >= quiz.slides.length - 1) return;
    setSelectedSlideId(quiz.slides[selectedSlideIndex + 1].id);
  }, [quiz, selectedSlideIndex]);
  
  // Keyboard navigation for slides
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' || 
                       target.tagName === 'TEXTAREA' || 
                       target.isContentEditable ||
                       target.closest('[contenteditable="true"]');
      
      // Arrow key navigation (only when not typing)
      if (!isTyping && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          goToPrevSlide();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          goToNextSlide();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToPrevSlide, goToNextSlide]);
  
  // ============================================
  // SLIDE OPERATIONS
  // ============================================
  
  const addSlide = useCallback((typeOption: SlideTypeOption) => {
    if (!quiz) return;
    
    const order = quiz.slides.length;
    let newSlide: QuizSlide;
    
    switch (typeOption.id) {
      case 'abc':
        newSlide = createABCSlide(order);
        break;
      case 'open':
        newSlide = createOpenSlide(order);
        break;
      case 'example':
        newSlide = createExampleSlide(order);
        break;
      case 'board':
        newSlide = createBoardSlide(order);
        break;
      case 'voting':
        newSlide = createVotingSlide(order);
        break;
      case 'fill-blanks':
        newSlide = createFillBlanksSlide(order);
        break;
      case 'connect-pairs':
        newSlide = createConnectPairsSlide(order);
        break;
      case 'image-hotspots':
        newSlide = createImageHotspotsSlide(order);
        break;
      case 'video-quiz':
        newSlide = createVideoQuizSlide(order);
        break;
      case 'form':
        newSlide = createFormSlide(order);
        break;
      case 'certificate':
        newSlide = createCertificateSlide(order);
        break;
      case 'info':
      default:
        newSlide = createInfoSlide(order);
        break;
    }
    
    updateQuizWithUndo({
      ...quiz,
      slides: [...quiz.slides, newSlide],
      updatedAt: new Date().toISOString(),
    });
    setSelectedSlideId(newSlide.id);
    
    // Switch to board view after adding
    setActivePanel('board');
  }, [quiz, updateQuizWithUndo]);

  const changeSlideType = useCallback((typeOption: SlideTypeOption) => {
    if (!quiz || !selectedSlideId) return;
    
    const currentIndex = quiz.slides.findIndex(s => s.id === selectedSlideId);
    if (currentIndex === -1) return;
    
    const currentSlide = quiz.slides[currentIndex];
    const currentActivityType = (currentSlide as any).activityType;
    
    // Get template for the new type to get default properties
    let template: any;
    switch (typeOption.id) {
      case 'abc': template = createABCSlide(currentSlide.order); break;
      case 'open': template = createOpenSlide(currentSlide.order); break;
      case 'example': template = createExampleSlide(currentSlide.order); break;
      case 'board': template = createBoardSlide(currentSlide.order); break;
      case 'voting': template = createVotingSlide(currentSlide.order); break;
      case 'fill-blanks': template = createFillBlanksSlide(currentSlide.order); break;
      case 'connect-pairs': template = createConnectPairsSlide(currentSlide.order); break;
      case 'image-hotspots': template = createImageHotspotsSlide(currentSlide.order); break;
      case 'video-quiz': template = createVideoQuizSlide(currentSlide.order); break;
      case 'form': template = createFormSlide(currentSlide.order); break;
      case 'certificate': template = createCertificateSlide(currentSlide.order); break;
      case 'info':
      default: template = createInfoSlide(currentSlide.order); break;
    }
    
    // Create new slide object by merging
    // We start with currentSlide to preserve ALL existing content (even from other types)
    const newSlide = { ...currentSlide };
    
    // Update the type-defining properties
    newSlide.type = template.type;
    if (template.activityType) {
      (newSlide as any).activityType = template.activityType;
    } else {
      delete (newSlide as any).activityType;
    }
    
    // Special conversions between Open and Example
    if (currentActivityType === 'open' && typeOption.id === 'example') {
      // Open -> Example: map question to problem, correctAnswers[0] to finalAnswer
      const openSlide = currentSlide as OpenActivitySlide;
      (newSlide as any).problem = openSlide.question || '';
      (newSlide as any).finalAnswer = openSlide.correctAnswers?.[0] || '';
      (newSlide as any).steps = [];
    } else if (currentActivityType === 'example' && typeOption.id === 'open') {
      // Example -> Open: map problem to question, finalAnswer to correctAnswers
      const exampleSlide = currentSlide as ExampleActivitySlide;
      (newSlide as any).question = exampleSlide.problem || '';
      (newSlide as any).correctAnswers = exampleSlide.finalAnswer ? [exampleSlide.finalAnswer] : [];
    }
    
    // Add any missing properties required by the new type from the template
    Object.keys(template).forEach(key => {
      if (!(key in newSlide)) {
        (newSlide as any)[key] = template[key];
      }
    });
    
    const newSlides = [...quiz.slides];
    newSlides[currentIndex] = newSlide as QuizSlide;
    
    setQuiz({
      ...quiz,
      slides: newSlides,
      updatedAt: new Date().toISOString()
    });
    setIsDirty(true);
    
    // Switch to board structure view only if NOT in page settings
    if (!showPageSettings) {
      setActivePanel('board');
    }
  }, [quiz, selectedSlideId, showPageSettings]);

  const deleteSlide = useCallback((slideId: string) => {
    if (!quiz) return;
    
    // If the slide being deleted is part of a multi-selection, delete all selected slides
    const idsToDelete = multiSelectedIds.includes(slideId) 
      ? multiSelectedIds 
      : [slideId];
    
    const newSlides = quiz.slides.filter(s => !idsToDelete.includes(s.id));
    
    // Reorder
    newSlides.forEach((s, i) => s.order = i);
    
    updateQuizWithUndo({
      ...quiz,
      slides: newSlides,
      updatedAt: new Date().toISOString(),
    });
    
    if (idsToDelete.includes(selectedSlideId as string)) {
      setSelectedSlideId(newSlides[0]?.id || null);
    }
    
    setMultiSelectedIds([]);
  }, [quiz, selectedSlideId, multiSelectedIds, updateQuizWithUndo]);
  
  const duplicateSlide = useCallback((slideId: string) => {
    if (!quiz) return;
    
    // If the slide being duplicated is part of a multi-selection, duplicate all selected slides
    const idsToDuplicate = multiSelectedIds.includes(slideId)
      ? [...quiz.slides].filter(s => multiSelectedIds.includes(s.id)).map(s => s.id)
      : [slideId];
    
    const newSlides = [...quiz.slides];
    const duplicatedSlides: QuizSlide[] = [];
    
    // Find the last index of the selection to insert after it
    const lastIndex = Math.max(...idsToDuplicate.map(id => quiz.slides.findIndex(s => s.id === id)));
    
    idsToDuplicate.forEach(id => {
      const slide = quiz.slides.find(s => s.id === id);
      if (slide) {
        duplicatedSlides.push({
          ...slide,
          id: crypto.randomUUID(),
        });
      }
    });
    
    newSlides.splice(lastIndex + 1, 0, ...duplicatedSlides);
    
    // Reorder
    newSlides.forEach((s, i) => s.order = i);
    
    updateQuizWithUndo({
      ...quiz,
      slides: newSlides,
      updatedAt: new Date().toISOString(),
    });
    
    // Select the first duplicated slide
    if (duplicatedSlides.length > 0) {
      setSelectedSlideId(duplicatedSlides[0].id);
      setMultiSelectedIds(duplicatedSlides.map(s => s.id));
    }
  }, [quiz, multiSelectedIds, updateQuizWithUndo]);

  const handleImportFromOldFormat = useCallback(async () => {
    console.log('Starting handleImportFromOldFormat');
    const input = importInputValue;
    if (!input) {
      alert('Prosím vložte ID nebo link.');
      return;
    }

    let data;
    let url = input.trim();
    
    // If it's just a UUID, prepend the API URL
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(url)) {
      // Use ?all=true to get the full content/pages structure
      url = `https://api.vividboard.cz/boards/${url}?all=true`;
    } else if (url.includes('api.vividboard.cz/boards/') && !url.includes('all=true')) {
      // Ensure ?all=true is present for the API URL to get content
      url += url.includes('?') ? '&all=true' : '?all=true';
    }

    try {
      if (url.startsWith('http')) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Nepodařilo se načíst data z API (${response.status})`);
        data = await response.json();
      } else {
        data = JSON.parse(input);
      }
    } catch (e) {
      alert('Chyba při parsování dat: ' + e);
      return;
    }

    if (!data) return;

    // Helper to strip HTML tags and ql-editor wrapper
    const stripHtml = (html: string) => {
      if (!html) return '';
      
      let text = html;
      
      // Handle Quill formulas: <span class="ql-formula" data-value="x^2"></span>
      text = text.replace(/<span[^>]*class=['"]ql-formula['"][^>]*data-value=['"]([^'"]*)['"][^>]*>[\s\S]*?<\/span>/gi, function(_match, formula) {
        // Double the backslashes so \frac stays as literal \frac (not form-feed + rac)
        const safeFormula = formula.replace(/\\/g, '\\\\');
        return '$' + safeFormula + '$';
      });
      
      // Remove ql-editor divs
      text = text.replace(/<div class=['"]ql-editor['"]>/g, '');
      text = text.replace(/<\/div>/g, '');
      
      // Remove other tags but keep content
      text = text.replace(/<[^>]*>?/gm, '');
      
      // Decode common entities
      text = text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
      return text.trim();
    };

    // Helper to map legacy slides to new format
    const mapLegacySlides = (legacySlides: any[]): QuizSlide[] => {
      const slides: QuizSlide[] = [];
      let slideOrder = 0;

      legacySlides.forEach((legacy) => {
        const id = `slide-imported-${Date.now()}-${slideOrder}`;

        // Handle the nested structure (data.content.pages)
        if (legacy.type === 'selector' && legacy.data?.pageContent?.data?.activity) {
          const activity = legacy.data.pageContent.data.activity;
          const activityKey = activity.key;
          const activityData = activity.data?.[activityKey];

          if (activityKey === 'abc' && activityData) {
            const abcSlide = createABCSlide(slideOrder++);
            abcSlide.id = id;
            
            // Extract question
            const questionHtml = activityData.selector?.tabs?.text?.data || '';
            abcSlide.question = stripHtml(questionHtml);

            // Extract options
            const buttons = activityData.selectorAnswers?.tabs?.buttons?.buttons || [];
            abcSlide.options = buttons.map((btn: any, i: number) => ({
              id: `opt-${i}-${Date.now()}`,
              label: String.fromCharCode(65 + i),
              content: stripHtml(btn.text || ''),
              isCorrect: !!btn.isValid
            }));
            
            slides.push(abcSlide);
            return;
          }
          
          if (activityKey === 'open' && activityData) {
            const openSlide = createOpenSlide(slideOrder++);
            openSlide.id = id;
            const questionHtml = activityData.selector?.tabs?.text?.data || '';
            openSlide.question = stripHtml(questionHtml);
            const answerHtml = activityData.selectorAnswers?.tabs?.text?.data || '';
            if (answerHtml) {
              openSlide.correctAnswers = [stripHtml(answerHtml)];
            }
            slides.push(openSlide);
            return;
          }
          
          // Handle "input" activity type as Example (simple problem + answer)
          if (activityKey === 'input' && activityData) {
            const exampleSlide = createExampleSlide(slideOrder++);
            exampleSlide.id = id;
            
            // Question/problem is in selector.tabs.text.data
            const questionHtml = activityData.selector?.tabs?.text?.data || '';
            exampleSlide.problem = stripHtml(questionHtml);
            exampleSlide.title = ''; // No title for imported examples
            
            // Answer is directly in activityData.answer
            const answerHtml = activityData.answer || '';
            if (answerHtml) {
              exampleSlide.finalAnswer = stripHtml(answerHtml);
            }
            
            // No steps for simple examples
            exampleSlide.steps = [];
            
            slides.push(exampleSlide);
            return;
          }
        }

        // Handle info_page with images (new format from legacy board)
        if (legacy.type === 'selector' && legacy.data?.pageContent?.key === 'info_page') {
          const infoPageData = legacy.data.pageContent.data?.info_page?.data?.info;
          const notes = legacy.data.notes || {};
          
          if (infoPageData) {
            const infoSlide = createInfoSlide(slideOrder++);
            infoSlide.id = id;
            
            // Set chapter name and note from notes
            if (notes.chapter) {
              infoSlide.chapterName = notes.chapter;
            }
            if (notes.text) {
              infoSlide.note = stripHtml(notes.text);
            }
            
            // Get selectors data - find the one with images first, then fallback to text
            const selectors = infoPageData.selectors || [];
            
            // Find selector with images (check all selectors, not just first one)
            let imageSelector = selectors.find((s: any) => 
              s.activeTab === 'image' && s.tabs?.image?.images?.length > 0
            );
            
            // Also check selectors that have images even if activeTab is different
            if (!imageSelector) {
              imageSelector = selectors.find((s: any) => s.tabs?.image?.images?.length > 0);
            }
            
            if (imageSelector) {
              const tabs = imageSelector.tabs;
              const images = tabs.image.images;
              
              // Create single-block layout for full-page image
              infoSlide.layout = {
                type: 'single',
                blocks: [{
                  id: `block-${Date.now()}`,
                  type: 'image',
                  content: images[0].image || '',
                  // Set gallery for all images (even if just one, to support solution button)
                  gallery: images.map((img: any) => img.image).filter(Boolean),
                  galleryIndex: 0,
                  // Map galleryMenu to galleryNavType (solution = show solution button)
                  galleryNavType: tabs.image.galleryMenu === 'solution' ? 'solution' : 
                                  images.length > 1 ? 'dots-bottom' : undefined,
                  imageFit: tabs.image.setup?.align === 'contain' ? 'contain' : 'cover',
                  imageCaption: images[0].description || '',
                  imageLink: images[0].link || '',
                }],
              };
              
              // Set blockGap to 0 for full-page image
              infoSlide.blockGap = 0;
              infoSlide.blockRadius = parseInt(tabs.image.setup?.borderRadius) || 10;
            } else {
              // Find text selector
              const textSelector = selectors.find((s: any) => s.tabs?.text?.data);
              
              if (textSelector && textSelector.tabs.text.data) {
                // Text-based info slide with single block
                infoSlide.layout = {
                  type: 'single',
                  blocks: [{
                    id: `block-${Date.now()}`,
                    type: 'text',
                    content: stripHtml(textSelector.tabs.text.data),
                    textAlign: 'center',
                    fontSize: 'large',
                  }],
                };
              } else {
                // Fallback: use title-content layout
                infoSlide.title = notes.chapter || 'Importovaná stránka';
              }
            }
            
            slides.push(infoSlide);
            return;
          }
        }

        // Fallback for older flat structure (legacy.type is 'abc', 'info', etc.)
        if (['text', 'info'].includes(legacy.type)) {
          const infoSlide = createInfoSlide(slideOrder++);
          infoSlide.id = id;
          infoSlide.title = stripHtml(legacy.title || legacy.name || '');
          if (infoSlide.layout) {
            infoSlide.layout.blocks[0].content = stripHtml(legacy.title || legacy.name || '');
            infoSlide.layout.blocks[1].content = stripHtml(legacy.content || legacy.text || '');
          }
          slides.push(infoSlide);
        } else if (['abc', 'multi', 'multiple-choice'].includes(legacy.type)) {
          const abcSlide = createABCSlide(slideOrder++);
          abcSlide.id = id;
          abcSlide.question = stripHtml(legacy.question || legacy.text || '');
          const options = legacy.options || legacy.answers || [];
          if (options) {
            abcSlide.options = options.map((opt: any, i: number) => ({
              id: opt.id || `opt-${i}-${Date.now()}`,
              label: String.fromCharCode(65 + i),
              content: typeof opt === 'string' ? stripHtml(opt) : stripHtml(opt.text || opt.content || opt.answer || ''),
              isCorrect: Array.isArray(legacy.correct) 
                ? legacy.correct.includes(i) 
                : (opt.is_correct || opt.isCorrect || i === legacy.correct_index || i === legacy.correctIndex),
            }));
          }
          abcSlide.explanation = stripHtml(legacy.explanation || legacy.hint || legacy.transcript);
          slides.push(abcSlide);
        } else if (['open', 'question'].includes(legacy.type)) {
          const openSlide = createOpenSlide(slideOrder++);
          openSlide.id = id;
          openSlide.question = stripHtml(legacy.question || legacy.text || '');
          if (legacy.answer || legacy.correct_answer || legacy.correctAnswer) {
            openSlide.correctAnswers = [stripHtml(legacy.answer || legacy.correct_answer || legacy.correctAnswer)];
          }
          openSlide.explanation = stripHtml(legacy.explanation || legacy.hint || legacy.transcript);
          slides.push(openSlide);
        } else if (legacy.type === 'example') {
          const exampleSlide = createExampleSlide(slideOrder++);
          exampleSlide.id = id;
          exampleSlide.title = stripHtml(legacy.title || legacy.name || '');
          exampleSlide.problem = stripHtml(legacy.problem || legacy.content || legacy.text || '');
          if (legacy.steps) {
            exampleSlide.steps = legacy.steps.map((step: any, i: number) => ({
              id: `step-${i}-${Date.now()}`,
              content: typeof step === 'string' ? stripHtml(step) : stripHtml(step.content || step.text || ''),
            }));
          }
          exampleSlide.finalAnswer = stripHtml(legacy.finalAnswer || legacy.answer || '');
          slides.push(exampleSlide);
        } else if (legacy.type !== 'config' && legacy.type !== 'add') {
          // General fallback
          const fallback = createInfoSlide(slideOrder++);
          fallback.id = id;
          fallback.title = stripHtml(legacy.title || legacy.name || legacy.type || 'Importovaný slide');
          if (fallback.layout) {
            fallback.layout.blocks[1].content = typeof legacy === 'string' ? legacy : JSON.stringify(legacy);
          }
          slides.push(fallback);
        }
      });
      
      return slides;
    };

    // Map old format to new format
    const legacySlides = data.content?.pages || data.slides || data.questions || [];
    
    if (!Array.isArray(legacySlides) || legacySlides.length === 0) {
      alert('V importovaných datech nebyly nalezeny žádné slidy ani otázky.');
      return;
    }

    const importedSlides = mapLegacySlides(legacySlides);

    if (importedSlides.length === 0) {
      alert('Nepodařilo se naimportovat žádné slidy. Zkontrolujte formát dat.');
      return;
    }

    const newQuiz: Quiz = {
      ...quiz!,
      title: data.name || data.title || quiz!.title,
      // @ts-ignore
      boardType: data.type || 'practice',
      slides: importedSlides,
      updatedAt: new Date().toISOString(),
    };

    setQuiz(newQuiz);
    if (importedSlides.length > 0) {
      setSelectedSlideId(importedSlides[0].id);
    }
    setIsDirty(true);
    setShowImportInput(false);
    setImportInputValue('');
    alert(`Board byl úspěšně importován! (${importedSlides.length} slidů)`);
  }, [quiz, importInputValue, setSelectedSlideId, setIsDirty, setShowImportInput, setImportInputValue]);
  
  const updateSlide = useCallback((slideId: string, updates: Partial<QuizSlide>) => {
    if (!quiz) return;
    
    const newSlides = quiz.slides.map(s => 
      s.id === slideId ? { ...s, ...updates } : s
    );
    
    updateQuizWithUndo({
      ...quiz,
      slides: newSlides,
      updatedAt: new Date().toISOString(),
    });
  }, [quiz, updateQuizWithUndo]);
  
  const moveSlide = useCallback((slideId: string, direction: 'up' | 'down') => {
    if (!quiz) return;
    
    // If the slide being moved is part of a multi-selection, move all selected slides
    const idsToMove = multiSelectedIds.includes(slideId)
      ? [...quiz.slides].filter(s => multiSelectedIds.includes(s.id)).map(s => s.id)
      : [slideId];
    
    if (idsToMove.length === 0) return;

    const newSlides = [...quiz.slides];
    
    // Find min and max index of slides to move
    const indices = idsToMove.map(id => quiz.slides.findIndex(s => s.id === id)).sort((a, b) => a - b);
    const minIdx = indices[0];
    const maxIdx = indices[indices.length - 1];

    if (direction === 'up' && minIdx === 0) return;
    if (direction === 'down' && maxIdx === quiz.slides.length - 1) return;

    if (direction === 'up') {
      // For each slide index, swap it with the one above it
      // To keep relative order, we move them one by one starting from the top one
      for (const idx of indices) {
        [newSlides[idx], newSlides[idx - 1]] = [newSlides[idx - 1], newSlides[idx]];
      }
    } else {
      // For each slide index, swap it with the one below it
      // To keep relative order, we move them one by one starting from the bottom one
      for (let i = indices.length - 1; i >= 0; i--) {
        const idx = indices[i];
        [newSlides[idx], newSlides[idx + 1]] = [newSlides[idx + 1], newSlides[idx]];
      }
    }

    // Reorder
    newSlides.forEach((s, i) => s.order = i);
    
    updateQuizWithUndo({
      ...quiz,
      slides: newSlides,
      updatedAt: new Date().toISOString(),
    });
  }, [quiz, multiSelectedIds, updateQuizWithUndo]);

  const handlePdfImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !quiz) return;

    setIsImportingPdf(true);
    const toastId = toast.loading('Zpracovávám PDF...', {
      description: 'Převádím stránky na obrázky a nahrávám do knihovny.'
    });

    // Helper: upload with timeout
    const uploadWithTimeout = async (pageFile: File, folderId: string, timeoutMs = 30000): Promise<string | null> => {
      return Promise.race([
        (async () => {
          const result = await uploadFile(pageFile, { folderId });
          return result.success && result.file ? result.file.filePath : null;
        })(),
        new Promise<null>((resolve) => setTimeout(() => {
          console.warn('[PDF Import] Upload timeout reached');
          resolve(null);
        }, timeoutMs)),
      ]);
    };

    try {
      // Ensure media folder exists for storing PDF page images
      ensureMediaFolderExists();
      const pdfBaseName = file.name.replace(/\.pdf$/i, '');
      
      // Create a subfolder for this PDF in the Média folder (synced to Supabase immediately)
      const pdfSubfolderId = await createMediaSubfolder(`PDF - ${pdfBaseName}`);
      console.log('[PDF Import] Created subfolder for PDF:', pdfSubfolderId);
      
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;
      const newSlides: QuizSlide[] = [];
      
      // Higher quality for better readability
      const RENDER_SCALE = 2.0;
      const JPEG_QUALITY = 0.85;
      const BATCH_SIZE = 3; // Process 3 pages at a time
      let successCount = 0;
      let fallbackCount = 0;

      // Process pages in batches for better performance
      for (let batchStart = 1; batchStart <= numPages; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, numPages);
        const progress = Math.round((batchStart / numPages) * 100);
        console.log(`[PDF Import] Processing batch: pages ${batchStart}-${batchEnd} of ${numPages} (${progress}%)`);
        toast.loading(`Zpracovávám stránky ${batchStart}-${batchEnd} z ${numPages} (${progress}%)`, { 
          id: toastId,
          description: `${newSlides.length} stránek zpracováno` 
        });
        
        // Process batch in parallel
        const batchPromises = [];
        for (let i = batchStart; i <= batchEnd; i++) {
          batchPromises.push((async (pageNum: number) => {
            try {
              console.log(`[PDF Import] Starting page ${pageNum}`);
              const page = await pdf.getPage(pageNum);
              const viewport = page.getViewport({ scale: RENDER_SCALE });
              
              // Render to canvas
              const canvas = document.createElement('canvas');
              const context = canvas.getContext('2d');
              canvas.height = viewport.height;
              canvas.width = viewport.width;

              if (!context) return null;

              await page.render({ canvasContext: context, viewport }).promise;
              
              // Convert canvas to Blob
              const blob = await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob((b) => b ? resolve(b) : reject(new Error('Blob creation failed')), 'image/jpeg', JPEG_QUALITY);
              });
              
              // Create a File object for upload
              const pageFileName = `${pdfBaseName}_page_${pageNum}.jpg`;
              const pageFile = new File([blob], pageFileName, { type: 'image/jpeg' });
              
              // Try upload with timeout, fallback to base64
              let imageUrl: string;
              const uploadedUrl = await uploadWithTimeout(pageFile, pdfSubfolderId, 20000);
              
              if (uploadedUrl) {
                imageUrl = uploadedUrl;
                successCount++;
                console.log(`[PDF Import] Page ${pageNum} uploaded successfully`);
              } else {
                // Fallback to base64 if upload fails or times out
                console.warn(`[PDF Import] Page ${pageNum} upload failed/timeout, using base64`);
                imageUrl = canvas.toDataURL('image/jpeg', 0.7);
                fallbackCount++;
              }

              // Extract text (with timeout protection)
              let pageText = '';
              try {
                const textContent = await Promise.race([
                  page.getTextContent(),
                  new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
                ]);
                if (textContent) {
                  pageText = textContent.items
                    .map((item: any) => item.str)
                    .join(' ')
                    .replace(/\s+/g, ' ')
                    .trim();
                }
              } catch { /* ignore text extraction errors */ }

              // Create new slide
              const slideOrder = quiz.slides.length + pageNum - 1;
              const newSlide = createInfoSlide(slideOrder, 'single');
              
              newSlide.layout = {
                type: 'single',
                blocks: [
                  {
                    id: crypto.randomUUID(),
                    type: 'image',
                    content: imageUrl,
                    imageFit: 'contain'
                  }
                ]
              };
              
              newSlide.note = pageText;
              
              // Clean up canvas to free memory
              canvas.width = 0;
              canvas.height = 0;
              
              console.log(`[PDF Import] ✅ Page ${pageNum} completed`);
              return { pageNum, slide: newSlide };
            } catch (pageErr) {
              console.error(`[PDF Import] ❌ Error processing page ${pageNum}:`, pageErr);
              return null;
            }
          })(i));
        }
        
        // Wait for batch to complete
        const batchResults = await Promise.all(batchPromises);
        
        // Add successful slides (sorted by page number)
        const validResults = batchResults.filter(r => r !== null) as { pageNum: number; slide: QuizSlide }[];
        validResults.sort((a, b) => a.pageNum - b.pageNum);
        newSlides.push(...validResults.map(r => r.slide));
        
        console.log(`[PDF Import] Batch ${batchStart}-${batchEnd} completed. ${validResults.length}/${batchResults.length} pages successful. Total: ${newSlides.length} slides`);
      }

      if (newSlides.length === 0) {
        throw new Error('Nepodařilo se zpracovat žádnou stránku z PDF');
      }

      const updatedQuiz = {
        ...quiz,
        slides: [...quiz.slides, ...newSlides],
        updatedAt: new Date().toISOString(),
      };

      // Recalculate order for all slides
      updatedQuiz.slides.forEach((s, idx) => {
        s.order = idx;
      });

      updateQuizWithUndo(updatedQuiz);
      
      const description = fallbackCount > 0 
        ? `Přidáno ${newSlides.length} stránek. ${successCount} nahráno do knihovny, ${fallbackCount} uloženo lokálně.`
        : `Přidáno ${newSlides.length} stránek z PDF. Obrázky uloženy do vaší knihovny.`;
      
      toast.success(`Import dokončen!`, { id: toastId, description });
      
      // Select the first imported slide
      if (newSlides.length > 0) {
        setSelectedSlideId(newSlides[0].id);
      }
    } catch (err) {
      console.error('PDF import error:', err);
      toast.error('Chyba při importu PDF', { 
        id: toastId,
        description: err instanceof Error ? err.message : 'Neznámá chyba' 
      });
    } finally {
      setIsImportingPdf(false);
      if (pdfInputRef.current) pdfInputRef.current.value = '';
    }
  };
  
  // Navigate to full results page
  const openSessionResults = (session: SessionData) => {
    // For both live and shared sessions, navigate to the results page
    // The results page needs to know the session type to load from the correct Firebase path
    navigate(`/quiz/results/${session.id}?type=${session.type}`);
  };
  
  // ============================================
  // RENDER HELPERS
  // ============================================
  
  const renderSessionsList = () => (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 bg-white">
        <h2 className="text-xl font-bold text-slate-800">Výsledky</h2>
        <p className="text-sm text-slate-500 mt-1">Přehled všech sessions pro tento board</p>
      </div>
      
      {/* Sessions list */}
      <div className="flex-1 overflow-auto p-4">
        {loadingSessions ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <BarChart2 className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">Žádné aktivní sessions</p>
            <p className="text-sm mt-1">Spusťte kvíz nebo sdílejte ho se studenty</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => {
              const studentCount = Object.keys(session.students || {}).length;
              
              return (
                <button
                  key={session.id}
                  onClick={() => openSessionResults(session)}
                  className="w-full bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow text-left"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        session.type === 'live' ? 'bg-amber-100' : 'bg-blue-100'
                      }`}>
                        {session.type === 'live' ? (
                          <Radio className="w-6 h-6 text-amber-600" />
                        ) : (
                          <Link2 className="w-6 h-6 text-blue-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{session.sessionName}</p>
                        <p className="text-sm text-slate-500">
                          {session.type === 'live' ? 'Živé promítání' : 'Sdílený úkol'} • {new Date(session.createdAt).toLocaleDateString('cs-CZ')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-2xl font-bold text-indigo-600">{studentCount}</p>
                        <p className="text-xs text-slate-400">účastníků</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  // ============================================
  // RENDER
  // ============================================
  
  if (!quiz) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-100">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }
  
  if (showPreview) {
    // Calculate the current slide index from selectedSlideId
    const previewSlideIndex = selectedSlideId 
      ? quiz.slides.findIndex(s => s.id === selectedSlideId)
      : 0;
    
    return (
      <QuizPreview 
        quiz={quiz} 
        onClose={() => setShowPreview(false)} 
        initialSlideIndex={previewSlideIndex >= 0 ? previewSlideIndex : 0}
      />
    );
  }
  
  if (showLiveSession) {
    return (
      <TeacherSession
        quiz={quiz}
        teacherId={profile?.userId || 'anonymous'}
        teacherName={profile?.firstName || 'Učitel'}
        onClose={() => setShowLiveSession(false)}
      />
    );
  }
  
  // Show loading indicator while fetching quiz from Supabase
  if (isLoadingQuiz) {
    return (
      <div className="flex h-screen bg-[#F8F9FB] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
          <p className="text-slate-600 font-medium">Načítám board...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex h-screen bg-[#F8F9FB] overflow-hidden font-sans">
      {/* 1. LEFT NARROW NAVIGATION STRIP */}
      <div 
        className="left-toolbar print:!hidden"
        style={{ 
          width: '100px',
          minWidth: '100px',
          height: '100%',
          backgroundColor: '#E8ECF4',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: '16px',
          paddingBottom: '16px',
          borderRight: '1px solid #D8DCE6',
          zIndex: 20,
        }}
      >
        {/* Back button - shows "Ukládám..." when saving is in progress */}
        <button
          type="button"
          disabled={isSaving}
          onClick={async () => {
            // If saving in progress, don't allow navigation
            if (isSaving) {
              console.log('[QuizEditor] Save in progress, cannot navigate');
              return;
            }
            
            // If there are unsaved changes, save first
            if (isDirty && quiz) {
              setIsSaving(true);
              console.log('[QuizEditor] Saving before navigation...');
              
              try {
                // Save to localStorage
                saveQuiz(quiz);
                setIsDirty(false);
                
                // Also save to Supabase
                let accessToken: string | undefined;
                try {
                  const storageKey = `sb-njbtqmsxbyvpwigfceke-auth-token`;
                  const stored = localStorage.getItem(storageKey);
                  if (stored) {
                    const parsed = JSON.parse(stored);
                    accessToken = parsed?.access_token;
                  }
                } catch (e) {}
                
                if (accessToken) {
                  const boardSlug = `board-${quiz.id}`;
                  await fetch(
                    `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/pages`,
                    {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({
                        slug: boardSlug,
                        title: quiz.title || 'Board',
                        category: 'knihovna-vividbooks',
                        type: 'board',
                        worksheetData: quiz,
                      })
                    }
                  );
                  console.log('[QuizEditor] Saved before navigation');
                }
              } catch (err) {
                console.warn('[QuizEditor] Save before navigation failed:', err);
              } finally {
                setIsSaving(false);
              }
            }
            
            // Navigate after save
            const sourceWorksheet = quiz?.sourceWorksheet;
            let targetUrl = returnUrl || '/library/my-content';
            
            if (sourceWorksheet && quiz) {
              // Add linkBoard parameter to return URL
              const separator = targetUrl.includes('?') ? '&' : '?';
              targetUrl = `${targetUrl}${separator}linkBoard=${quiz.id}&linkToItem=${sourceWorksheet.id}`;
              console.log('[QuizEditor] Navigating back with board link:', targetUrl);
            }
            
            navigate(targetUrl);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '16px',
            background: 'none',
            border: 'none',
            cursor: isSaving ? 'wait' : 'pointer',
            padding: 0,
            opacity: isSaving ? 0.7 : 1,
          }}
        >
          {isSaving ? (
            <>
              <Loader2 size={16} className="animate-spin" style={{ color: '#22c55e' }} />
              <span style={{ fontSize: '12px', fontWeight: 500, color: '#22c55e' }}>Ukládám...</span>
            </>
          ) : isDirty ? (
            <>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#f59e0b' }} />
              <span style={{ fontSize: '12px', fontWeight: 500, color: '#f59e0b' }}>Neuloženo</span>
            </>
          ) : (
            <>
              <ArrowLeft size={16} strokeWidth={2} style={{ color: '#4E5871' }} />
              <span style={{ fontSize: '12px', fontWeight: 500, color: '#4E5871' }}>Zpět</span>
            </>
          )}
        </button>
        
        {/* My Board Tab (Settings) */}
        <SidebarButton
          onClick={() => {
            setActivePanel('settings');
            setViewMode('editor');
          }}
          isActive={activePanel === 'settings' && viewMode === 'editor'}
          icon={BookOpen}
          label="Můj board"
        />
        
        {/* Structure Tab (Slide list) */}
        <SidebarButton
          onClick={() => {
            setActivePanel('board');
            setViewMode('editor');
          }}
          isActive={activePanel === 'board' && viewMode === 'editor'}
          icon={Layers}
          label="Struktura"
        />
        
        {/* Add Content Tab */}
        <SidebarButton
          onClick={() => {
            setContentPanelMode('add');
            setActivePanel('content');
            setViewMode('editor');
          }}
          isActive={activePanel === 'content' && viewMode === 'editor' && contentPanelMode === 'add'}
          icon={Plus}
          label="Přidat obsah"
        />
        
        {/* AI Tab */}
        <SidebarButton
          onClick={() => {
            setActivePanel('ai');
            setViewMode('editor');
          }}
          isActive={activePanel === 'ai' && viewMode === 'editor'}
          icon={Sparkles}
          label="AI"
        />
        
        {/* Spacer */}
        <div style={{ flex: 1 }} />
      </div>
      
      {/* 2. CONTEXTUAL SIDEBAR PANEL (Only visible in editor mode) */}
      {viewMode === 'editor' && (
        <div 
          className="flex flex-col transition-all duration-300 relative"
          style={{ width: '320px', minWidth: '320px', backgroundColor: '#F2F5F9', zIndex: 100 }}
        >
          {/* PANEL CONTENT */}
          
          {/* BOARD STRUCTURE PANEL */}
          {activePanel === 'board' && (
            <div className="flex flex-col h-full bg-white relative overflow-visible">
              {/* Header with high z-index and explicit stacking context to keep dropdown on top */}
              <div className="p-6 border-b border-slate-100 bg-[#F8F9FB] min-h-[170px] flex flex-col justify-between relative z-[500] overflow-visible">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <input
                      type="text"
                      value={quiz.title}
                      onChange={(e) => {
                        setQuiz({ ...quiz, title: e.target.value });
                        setIsDirty(true);
                      }}
                      className="text-base font-bold text-slate-800 bg-transparent border-none outline-none focus:ring-2 focus:ring-indigo-100 rounded px-1 -ml-1 w-full truncate"
                      placeholder="Název boardu..."
                    />
                    <button 
                      onClick={(e) => { e.stopPropagation(); setActivePanel('settings'); }}
                      className="p-1.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors shrink-0"
                      title="Nastavení boardu"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {/* View switcher: List vs Grid - No background */}
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={() => setShowSlidePreviews(false)}
                      className={`p-1.5 rounded-md transition-all ${
                        !showSlidePreviews 
                          ? 'text-indigo-600' 
                          : 'text-slate-400 hover:text-slate-600'
                      }`}
                      title="Seznam"
                    >
                      <ListOrdered className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setShowSlidePreviews(true)}
                      className={`p-1.5 rounded-md transition-all ${
                        showSlidePreviews 
                          ? 'text-indigo-600' 
                          : 'text-slate-400 hover:text-slate-600'
                      }`}
                      title="Náhledy"
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* New Slide Button Dropdown - Joined with rounded corners */}
                <div className="relative" ref={newSlideDropdownRef}>
                  <div className="flex items-stretch bg-white border border-slate-200 rounded-xl shadow-sm hover:border-slate-300 transition-all overflow-hidden">
                    <button
                      onClick={() => setShowNewSlideDropdown(!showNewSlideDropdown)}
                      className="flex-1 flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <span>Nová stránka</span>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showNewSlideDropdown ? 'rotate-180' : ''}`} />
                    </button>
                    <div className="w-px bg-slate-100" />
                    <button
                      onClick={() => {
                        const infoType = SLIDE_TYPES.find(t => t.id === 'info');
                        if (infoType) addSlide(infoType);
                      }}
                      className="px-5 flex items-center justify-center text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors"
                      title="Rychle přidat informační stránku"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>

                  {showNewSlideDropdown && createPortal(
                    <div 
                      ref={dropdownContentRef}
                      className="fixed bg-white border border-slate-200 rounded-xl shadow-2xl z-[9999] overflow-hidden py-1 max-h-[450px] overflow-y-auto"
                      style={{ 
                        width: newSlideDropdownRef.current?.offsetWidth || 272,
                        top: (newSlideDropdownRef.current?.getBoundingClientRect().bottom || 0) + 4,
                        left: newSlideDropdownRef.current?.getBoundingClientRect().left || 0
                      }}
                    >
                      {/* Informace */}
                      <button
                        onClick={() => {
                          const type = SLIDE_TYPES.find(t => t.id === 'info');
                          if (type) addSlide(type);
                          setShowNewSlideDropdown(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-left transition-colors"
                      >
                        <div 
                          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: '#4E587115', color: '#4E5871' }}
                        >
                          {React.cloneElement(SLIDE_TYPES.find(t => t.id === 'info')?.icon as React.ReactElement, { className: 'w-5 h-5' })}
                        </div>
                        <div className="min-w-0">
                          <span className="block text-sm font-semibold text-slate-700 truncate">Informace</span>
                          <span className="block text-[10px] text-slate-400 truncate">Text, obrázky, video</span>
                        </div>
                      </button>

                      {/* Aktivita - Opens activity selection in left panel */}
                      <button
                        onClick={() => {
                          setContentPanelMode('add');
                          setActivePanel('content');
                          setShowActivitiesSubmenu(true);
                          setShowNewSlideDropdown(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-left transition-colors"
                      >
                        <div 
                          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: '#03CA9015', color: '#03CA90' }}
                        >
                          {React.cloneElement(SLIDE_TYPES.find(t => t.id === 'abc')?.icon as React.ReactElement, { className: 'w-5 h-5' })}
                        </div>
                        <div className="min-w-0">
                          <span className="block text-sm font-semibold text-slate-700 truncate">Aktivita</span>
                          <span className="block text-[10px] text-slate-400 truncate">Kvízy, hry, hlasování</span>
                        </div>
                      </button>

                      {/* Nástroje */}
                      <button
                        onClick={() => {
                          const type = SLIDE_TYPES.find(t => t.id === 'tools');
                          if (type) addSlide(type);
                          setShowNewSlideDropdown(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-left transition-colors"
                      >
                        <div 
                          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: '#FF815815', color: '#FF8158' }}
                        >
                          {React.cloneElement(SLIDE_TYPES.find(t => t.type === 'tools')?.icon as React.ReactElement, { className: 'w-5 h-5' })}
                        </div>
                        <div className="min-w-0">
                          <span className="block text-sm font-semibold text-slate-700 truncate">Nástroje</span>
                          <span className="block text-[10px] text-slate-400 truncate">Interaktivní pomůcky</span>
                        </div>
                      </button>

                      <div className="border-t border-slate-100 my-1" />

                      {/* Import PDF */}
                      <button
                        onClick={() => {
                          pdfInputRef.current?.click();
                          setShowNewSlideDropdown(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-orange-50 text-left text-orange-600 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-semibold">Importovat z PDF</span>
                      </button>

                      {/* Import from board */}
                      <button
                        onClick={() => {
                          alert('Funkce bude brzy dostupná');
                          setShowNewSlideDropdown(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 text-left text-indigo-600 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                          <BookOpen className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-semibold">Vložit z boardu</span>
                      </button>
                    </div>,
                    document.body
                  )}
                </div>
              </div>
              
              <div 
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto p-3 bg-[#F8F9FB] relative z-0 select-none"
                onMouseDown={handleMarqueeMouseDown}
              >
                {selectionRect && (
                  <div 
                    style={{
                      position: 'fixed',
                      left: selectionRect.x,
                      top: selectionRect.y,
                      width: selectionRect.w,
                      height: selectionRect.h,
                      backgroundColor: 'rgba(99, 102, 241, 0.1)',
                      border: '1px solid rgb(99, 102, 241)',
                      zIndex: 999999,
                      pointerEvents: 'none'
                    }}
                  />
                )}
                {quiz.slides.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-4">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                      <BookOpen className="w-8 h-8 text-slate-300" />
                    </div>
                    <p className="font-medium text-slate-600 mb-1">Zatím žádné slidy</p>
                    <p className="text-xs text-slate-400 mb-4">Začněte přidáním obsahu nebo použijte AI</p>
                    <button
                      onClick={() => setActivePanel('content')}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                    >
                      Přidat obsah
                    </button>
                  </div>
                ) : (
                  <DndContext 
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext 
                      items={quiz.slides.map(s => s.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className={showSlidePreviews ? 'space-y-3' : 'space-y-2'}>
                        {(() => {
                          let chapterCount = 0;
                          return quiz.slides.map((slide, index) => {
                            const typeInfo = SLIDE_TYPES.find(t => 
                              t.type === slide.type && 
                              (slide.type !== 'activity' || t.activityType === (slide as any).activityType)
                            ) || SLIDE_TYPES[0];
                            
                            const chapterName = (slide as any).chapterName;
                            if (chapterName) chapterCount++;
                            
                            return (
                              <SortableSlideItem 
                                key={slide.id}
                                slide={slide}
                                index={index}
                                selectedSlideId={selectedSlideId}
                                setSelectedSlideId={setSelectedSlideId}
                                multiSelectedIds={multiSelectedIds}
                                setMultiSelectedIds={setMultiSelectedIds}
                                typeInfo={typeInfo}
                                chapterName={chapterName}
                                chapterCount={chapterCount}
                                showSlidePreviews={showSlidePreviews}
                                duplicateSlide={duplicateSlide}
                                deleteSlide={deleteSlide}
                                getSlideTitle={getSlideTitle}
                              />
                            );
                          });
                        })()}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </div>
            </div>
          )}

          {/* ADD CONTENT PANEL */}
          {activePanel === 'content' && (
            <div className="flex flex-col h-full bg-white">
              <div className="p-5 border-b border-slate-100 bg-[#F8F9FB]">
                <h2 className="text-xl font-bold text-[#4E5871]">
                  {contentPanelMode === 'add' ? 'Přidat obsah' : 'Změnit typ stránky'}
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  {contentPanelMode === 'add' 
                    ? 'Vyberte, co chcete přidat do svého boardu' 
                    : 'Vyberte nový typ pro aktuální stránku'}
                </p>
              </div>
              
              <div className="p-5 overflow-y-auto flex-1">
                {!showActivitiesSubmenu ? (
                  <>
                    {/* Main options */}
                    <div className="mb-6">
                      <h3 className="text-sm font-semibold text-slate-500 mb-3">
                        {contentPanelMode === 'add' ? 'Přidat stránku:' : 'Změnit na:'}
                      </h3>
                      <div className="space-y-2">
                        {/* Informace */}
                        <button
                          onClick={() => {
                            const infoType = SLIDE_TYPES.find(t => t.id === 'info');
                            if (infoType) {
                              if (contentPanelMode === 'add') addSlide(infoType);
                              else changeSlideType(infoType);
                            }
                          }}
                          className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-slate-400 hover:shadow-md transition-all text-left group"
                        >
                          {(() => {
                            const type = SLIDE_TYPES.find(t => t.id === 'info') || SLIDE_TYPES[0];
                            return (
                              <>
                                <div 
                                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" 
                                  style={{ backgroundColor: `${type.color}15`, color: type.color }}
                                >
                                  {type.icon}
                          </div>
                                <span className="font-semibold text-slate-700 group-hover:text-slate-900">Informace</span>
                              </>
                            );
                          })()}
                          <Plus className="w-5 h-5 text-slate-300 ml-auto group-hover:text-slate-500" />
                        </button>
                        
                        {/* Aktivity */}
                        <button
                          onClick={() => setShowActivitiesSubmenu(true)}
                          className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-emerald-400 hover:shadow-md transition-all text-left group"
                        >
                          {(() => {
                            const type = SLIDE_TYPES.find(t => t.id === 'abc') || SLIDE_TYPES[1];
                            return (
                              <>
                                <div 
                                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" 
                                  style={{ backgroundColor: `${type.color}15`, color: type.color }}
                                >
                                  {type.icon}
                          </div>
                                <span className="font-semibold text-slate-700 group-hover:text-emerald-700">Aktivita</span>
                              </>
                            );
                          })()}
                          <ChevronRight className="w-5 h-5 text-slate-300 ml-auto group-hover:text-emerald-500" />
                        </button>
                        
                        {/* Nástroje */}
                        <button
                          onClick={() => {
                            const toolType = SLIDE_TYPES.find(t => t.type === 'tools');
                            if (toolType) {
                              if (contentPanelMode === 'add') addSlide(toolType);
                              else changeSlideType(toolType);
                            }
                          }}
                          className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-orange-400 hover:shadow-md transition-all text-left group"
                        >
                          {(() => {
                            const type = SLIDE_TYPES.find(t => t.type === 'tools') || SLIDE_TYPES[SLIDE_TYPES.length - 1];
                            return (
                              <>
                                <div 
                                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" 
                                  style={{ backgroundColor: `${type.color}15`, color: type.color }}
                                >
                                  {type.icon}
                          </div>
                                <span className="font-semibold text-slate-700 group-hover:text-orange-700">Nástroje</span>
                              </>
                            );
                          })()}
                          <Plus className="w-5 h-5 text-slate-300 ml-auto group-hover:text-orange-500" />
                        </button>
                      </div>
                    </div>
                    
                    {/* Additional options (only in add mode) */}
                    {contentPanelMode === 'add' && (
                      <div className="space-y-2">
                        <button
                          onClick={() => {
                            // TODO: Implement import from another board
                            alert('Funkce bude brzy dostupná');
                          }}
                          className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-indigo-400 hover:shadow-md transition-all text-left group"
                        >
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#8b5cf615', color: '#8b5cf6' }}>
                            <BookOpen className="w-5 h-5" />
                          </div>
                          <span className="font-semibold text-slate-700 group-hover:text-indigo-700">Přidat obsah z jiného boardu</span>
                        </button>
                        
                        <button
                          onClick={() => pdfInputRef.current?.click()}
                          disabled={isImportingPdf}
                          className={`w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-indigo-400 hover:shadow-md transition-all text-left group ${isImportingPdf ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#f9731615', color: '#f97316' }}>
                            {isImportingPdf ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
                          </div>
                          <span className="font-semibold text-slate-700 group-hover:text-indigo-700">
                            {isImportingPdf ? 'Zpracovávám PDF...' : 'Přidat obsah z PDF'}
                          </span>
                        </button>
                        
                        <input 
                          type="file"
                          ref={pdfInputRef}
                          onChange={handlePdfImport}
                          accept="application/pdf"
                          className="hidden"
                        />
                      </div>
                    )}
                  </>
                ) : (
                  /* Activities submenu */
                  <>
                    <button
                      onClick={() => setShowActivitiesSubmenu(false)}
                      className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-4"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span className="text-sm font-medium">Zpět</span>
                    </button>
                    
                    <h3 className="text-sm font-semibold text-slate-500 mb-3">
                      {contentPanelMode === 'add' ? 'Vyberte aktivitu:' : 'Změnit na aktivitu:'}
                    </h3>
                    <div className="space-y-6">
                      {/* Vyhodnotitelné */}
                      <div>
                        <h4 className="text-[10px] uppercase font-bold text-emerald-600 mb-2 px-1 tracking-wider text-left">Aktivity vyhodnotitelné</h4>
                        <div className="space-y-2">
                          {SLIDE_TYPES.filter(t => t.type === 'activity' && t.category === 'evaluable').map((type) => (
                            <button
                              key={type.id}
                              onClick={() => {
                                if (contentPanelMode === 'add') addSlide(type);
                                else changeSlideType(type);
                                setShowActivitiesSubmenu(false);
                              }}
                              className="w-full flex items-center gap-4 p-3 rounded-xl border border-slate-200 hover:border-emerald-400 hover:shadow-md transition-all text-left group"
                            >
                              <div 
                                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                                style={{ backgroundColor: `${type.color}15`, color: type.color }}
                              >
                                {React.cloneElement(type.icon as React.ReactElement, { className: 'w-5 h-5' })}
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="block font-semibold text-slate-700 group-hover:text-emerald-700 text-sm leading-tight">{type.label}</span>
                                <p className="text-[11px] text-slate-400 truncate mt-0.5">{type.description}</p>
                              </div>
                              <Plus className="w-4 h-4 text-slate-300 ml-auto group-hover:text-emerald-500" />
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Nevyhodnotitelné */}
                      <div>
                        <h4 className="text-[10px] uppercase font-bold text-violet-600 mb-2 px-1 tracking-wider text-left">Nevyhodnotitelné</h4>
                        <div className="space-y-2">
                          {SLIDE_TYPES.filter(t => t.type === 'activity' && t.category === 'non-evaluable').map((type) => (
                            <button
                              key={type.id}
                              onClick={() => {
                                if (contentPanelMode === 'add') addSlide(type);
                                else changeSlideType(type);
                                setShowActivitiesSubmenu(false);
                              }}
                              className="w-full flex items-center gap-4 p-3 rounded-xl border border-slate-200 hover:border-violet-400 hover:shadow-md transition-all text-left group"
                            >
                              <div 
                                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                                style={{ backgroundColor: `${type.color}15`, color: type.color }}
                              >
                                {React.cloneElement(type.icon as React.ReactElement, { className: 'w-5 h-5' })}
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="block font-semibold text-slate-700 group-hover:text-violet-700 text-sm leading-tight">{type.label}</span>
                                <p className="text-[11px] text-slate-400 truncate mt-0.5">{type.description}</p>
                              </div>
                              <Plus className="w-4 h-4 text-slate-300 ml-auto group-hover:text-violet-500" />
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Živé */}
                      <div>
                        <h4 className="text-[10px] uppercase font-bold text-red-600 mb-2 px-1 tracking-wider text-left">Živé aktivity</h4>
                        <div className="space-y-2">
                          {SLIDE_TYPES.filter(t => t.type === 'activity' && t.category === 'live').map((type) => (
                            <button
                              key={type.id}
                              onClick={() => {
                                if (contentPanelMode === 'add') addSlide(type);
                                else changeSlideType(type);
                                setShowActivitiesSubmenu(false);
                              }}
                              className="w-full flex items-center gap-4 p-3 rounded-xl border border-slate-200 hover:border-red-400 hover:shadow-md transition-all text-left group"
                            >
                              <div 
                                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                                style={{ backgroundColor: `${type.color}15`, color: type.color }}
                              >
                                {React.cloneElement(type.icon as React.ReactElement, { className: 'w-5 h-5' })}
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="block font-semibold text-slate-700 group-hover:text-red-700 text-sm leading-tight">{type.label}</span>
                                <p className="text-[11px] text-slate-400 truncate mt-0.5">{type.description}</p>
                              </div>
                              <Plus className="w-4 h-4 text-slate-300 ml-auto group-hover:text-red-500" />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
          
          {/* AI PANEL */}
          {activePanel === 'ai' && (
            <div className="flex flex-col h-full bg-white">
            <AIBoardPanel
              quiz={quiz}
              pdfTranscript={quiz.pdfTranscript}
              onAddSlides={(newSlides) => {
                // Add slides to quiz
                const updatedSlides = [...quiz.slides];
                newSlides.forEach((slide, idx) => {
                  slide.order = updatedSlides.length + idx;
                  updatedSlides.push(slide);
                });
                setQuiz({
                  ...quiz,
                  slides: updatedSlides,
                  updatedAt: new Date().toISOString(),
                });
                setIsDirty(true);
                // Select first new slide
                if (newSlides.length > 0) {
                  setSelectedSlideId(newSlides[0].id);
                }
                // Switch to board view to see results
                setActivePanel('board');
              }}
              onClose={() => setActivePanel('board')}
            />
            </div>
          )}
          
          {/* SETTINGS PANEL */}
          {activePanel === 'settings' && (
            <div className="flex flex-col h-full border-0" style={{ backgroundColor: '#F2F5F9' }}>
              <div className="px-6 flex-1 overflow-y-auto" style={{ paddingTop: '155px' }}>
                <div className="space-y-4">
                  {/* Board Name - 80px height */}
                  <input
                    type="text"
                    value={quiz.title}
                    onChange={(e) => {
                      setQuiz({ ...quiz, title: e.target.value });
                      setIsDirty(true);
                    }}
                    className="w-full px-5 text-2xl font-bold rounded-2xl border-0 focus:ring-2 focus:ring-indigo-300 outline-none transition-all text-slate-700 placeholder-slate-400"
                    placeholder="Název boardu"
                    style={{ backgroundColor: '#DFE4F0', height: '80px' }}
                  />
                  
                  {/* Označení dropdown */}
                  <div className="flex items-center gap-4">
                    <span className="text-base font-medium text-slate-500 whitespace-nowrap">Označení:</span>
                    <select 
                      value={(quiz as any).boardType || 'practice'}
                      onChange={(e) => {
                        setQuiz({ ...quiz, boardType: e.target.value } as any);
                        setIsDirty(true);
                      }}
                      className="flex-1 px-4 py-3.5 rounded-2xl border-0 focus:ring-2 focus:ring-indigo-300 outline-none text-slate-700 font-medium"
                      style={{ backgroundColor: '#DFE4F0' }}
                    >
                      <option value="practice">Procvičování</option>
                      <option value="text">Text</option>
                      <option value="test">Písemky</option>
                      <option value="lesson">Lekce</option>
                    </select>
                </div>
                
                  {/* Subject dropdown - full width */}
                  <select 
                    value={quiz.subject || ''}
                    onChange={(e) => {
                      setQuiz({ ...quiz, subject: e.target.value });
                      setIsDirty(true);
                    }}
                    className="w-full px-5 py-4 rounded-2xl border-0 focus:ring-2 focus:ring-indigo-300 outline-none text-slate-600 font-medium"
                    style={{ backgroundColor: '#DFE4F0' }}
                  >
                    <option value="">Předmět</option>
                    <option value="matematika">Matematika</option>
                    <option value="fyzika">Fyzika</option>
                    <option value="chemie">Chemie</option>
                    <option value="biologie">Biologie</option>
                    <option value="cestina">Český jazyk</option>
                    <option value="anglictina">Anglický jazyk</option>
                    <option value="dejepis">Dějepis</option>
                    <option value="zemepis">Zeměpis</option>
                  </select>
                </div>
                
                {/* Action buttons - no background, smaller spacing */}
                <div className="mt-8 space-y-2">
                  {/* Version History Button */}
                  <button
                    onClick={() => setShowVersionHistory(true)}
                    className="w-full flex items-center gap-4 px-2 py-2.5 rounded-lg hover:bg-slate-200 transition-colors text-slate-600"
                  >
                    <History className="w-5 h-5" />
                    <span className="font-medium">Historie verzí</span>
                  </button>
                  
                  {/* Share Edit Link Button */}
                  <button
                    onClick={() => setShowShareEditDialog(true)}
                    className="w-full flex items-center gap-4 px-2 py-2.5 rounded-lg hover:bg-slate-200 transition-colors text-slate-600"
                  >
                    <Share2 className="w-5 h-5" />
                    <span className="font-medium">Sdílet odkaz pro úpravu</span>
                  </button>
                  
                  {/* Results Button */}
                  <button
                    onClick={() => setViewMode('results')}
                    className="w-full flex items-center gap-4 px-2 py-2.5 rounded-lg hover:bg-slate-200 transition-colors text-slate-600"
                  >
                    <BarChart2 className="w-5 h-5" />
                    <span className="font-medium">Výsledky</span>
                  </button>
                  
                  {/* Print Button */}
                  <button
                    onClick={() => {
                      saveQuiz(quiz);
                      setIsDirty(false);
                      const worksheet = boardToWorksheet(quiz);
                      saveWorksheet(worksheet);
                      navigate(`/worksheet/edit/${worksheet.id}`);
                    }}
                    className="w-full flex items-center gap-4 px-2 py-2.5 rounded-lg hover:bg-slate-200 transition-colors text-slate-600"
                  >
                    <Printer className="w-5 h-5" />
                    <span className="font-medium">Tisknout</span>
                  </button>
                  
                  
                  {/* Delete Button */}
                  <button
                    onClick={() => {
                      if (confirm('Opravdu chcete smazat tento board? Tato akce je nevratná.')) {
                        navigate('/quizzes');
                      }
                    }}
                    className="w-full flex items-center gap-4 px-2 py-2.5 rounded-lg hover:bg-red-100 transition-colors text-red-500"
                  >
                    <Trash2 className="w-5 h-5" />
                    <span className="font-medium">Smazat</span>
                  </button>

                  <div className="pt-4 mt-4 border-t border-slate-200">
                    {!showImportInput ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setShowImportInput(true);
                        }}
                        className="w-full flex items-center gap-4 px-2 py-2 rounded-lg hover:bg-slate-200 transition-colors text-slate-400 text-xs"
                      >
                        <Download className="w-4 h-4" />
                        <span>Importovat ze starého formátu</span>
                      </button>
                    ) : (
                      <div className="space-y-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
                        <input
                          type="text"
                          value={importInputValue}
                          onChange={(e) => setImportInputValue(e.target.value)}
                          placeholder="ID nebo link na API"
                          className="w-full px-2 py-1.5 text-xs rounded border border-slate-300 focus:ring-1 focus:ring-indigo-300 outline-none"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleImportFromOldFormat}
                            className="flex-1 px-2 py-1.5 bg-indigo-600 text-white text-[10px] font-bold rounded hover:bg-indigo-700 transition-colors"
                          >
                            Importovat
                          </button>
                          <button
                            onClick={() => {
                              setShowImportInput(false);
                              setImportInputValue('');
                            }}
                            className="px-2 py-1.5 bg-slate-200 text-slate-600 text-[10px] font-bold rounded hover:bg-slate-300 transition-colors"
                          >
                            Zrušit
                  </button>
                        </div>
                      </div>
                    )}
                    
                    {/* Save as Interactive Worksheet */}
                    <button
                      onClick={async () => {
                        saveQuiz(quiz);
                        setIsDirty(false);
                        
                        // Determine category - from sourceWorksheet or ask user
                        let category = quiz.sourceWorksheet?.category;
                        if (!category) {
                          const input = prompt('Do které kategorie uložit? (fyzika, matematika, chemie, atd.)', 'fyzika');
                          if (!input) return;
                          category = input.trim();
                        }
                        
                        try {
                          const { data: { session } } = await supabase.auth.getSession();
                          if (!session?.access_token) {
                            alert('Nepodařilo se získat session');
                            return;
                          }
                            const menuResp = await fetch(
                              `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/menu?category=${category}`,
                              { headers: { 'Authorization': `Bearer ${session.access_token}` } }
                            );
                            if (!menuResp.ok) {
                              alert('Nepodařilo se načíst menu');
                              return;
                            }
                          const menuData = await menuResp.json();
                          let menu = menuData.menu || [];
                          const worksheetId = quiz.sourceWorksheet?.id;
                          const newBoardItem = {
                            id: `board-${quiz.id}`,
                            label: `${quiz.title} - Interaktivní`,
                            slug: `interactive-${quiz.id}`,
                            type: 'interactive',
                            icon: 'play',
                            externalUrl: `board://${quiz.id}`,
                          };
                          
                          // Check if already exists
                          const alreadyExists = (items: any[]): boolean => {
                            for (const item of items) {
                              if (item.id === newBoardItem.id) return true;
                              if (item.children && alreadyExists(item.children)) return true;
                            }
                            return false;
                          };
                          
                          if (alreadyExists(menu)) {
                            alert('Tento interaktivní list už v menu existuje.');
                            return;
                          }
                          
                          let added = false;
                          let updatedMenu = menu;
                          
                          if (worksheetId) {
                            // Try to add next to source worksheet
                            const addBoardToParent = (items: any[]): any[] => {
                              return items.map((item) => {
                                if (item.children && item.children.length > 0) {
                                  const worksheetIndex = item.children.findIndex((c: any) => c.id === worksheetId);
                                  if (worksheetIndex !== -1) {
                                    const newChildren = [...item.children];
                                    newChildren.splice(worksheetIndex + 1, 0, newBoardItem);
                                    added = true;
                                    return { ...item, children: newChildren };
                                  }
                                  return { ...item, children: addBoardToParent(item.children) };
                                }
                                return item;
                              });
                            };
                            updatedMenu = addBoardToParent(menu);
                            if (!added) {
                              const worksheetIndex = menu.findIndex((item: any) => item.id === worksheetId);
                              if (worksheetIndex !== -1) {
                                updatedMenu = [...menu];
                                updatedMenu.splice(worksheetIndex + 1, 0, newBoardItem);
                                added = true;
                              }
                            }
                          }
                          
                          // If not added (no worksheetId or not found), add to root
                          if (!added) {
                            updatedMenu = [...menu, newBoardItem];
                          }
                            const saveResp = await fetch(
                              `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/menu`,
                              {
                                method: 'PUT',
                                headers: {
                                  'Content-Type': 'application/json',
                                  'Authorization': `Bearer ${session.access_token}`,
                                },
                                body: JSON.stringify({ menu: updatedMenu, category }),
                              }
                            );
                            if (saveResp.ok) {
                              alert('✓ Interaktivní pracovní list byl uložen do složky!');
                            } else {
                              alert('Nepodařilo se uložit');
                            }
                          } catch (e) {
                            console.error('Save error:', e);
                            alert('Chyba: ' + (e instanceof Error ? e.message : 'Neznámá chyba'));
                          }
                        }}
                        className="w-full flex items-center gap-4 px-2 py-2 mt-2 rounded-lg hover:bg-emerald-50 transition-colors text-emerald-600 text-xs"
                      >
                        <Link2 className="w-4 h-4" />
                      <span>Uložit jako Interaktivní PL</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* 3. MAIN CONTENT AREA - High z-index to stay above sidebar */}
      <div 
        className="flex-1 flex flex-col relative bg-slate-100 cursor-default" 
        style={{ zIndex: 10 }}
      >
        {viewMode === 'editor' ? (
          <>
            {/* Top bar - clean, no background */}
            <div 
              className="h-16 flex items-center justify-between px-6 z-10"
            >
              {/* Slide navigation */}
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => {
                    const currentIndex = quiz.slides.findIndex(s => s.id === selectedSlideId);
                    if (currentIndex > 0) {
                      setSelectedSlideId(quiz.slides[currentIndex - 1].id);
                    }
                  }}
                  disabled={!selectedSlideId || quiz.slides.findIndex(s => s.id === selectedSlideId) === 0}
                  className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors flex items-center justify-center"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="px-4 py-1.5 rounded-full text-sm font-medium" style={{ backgroundColor: '#374151', color: '#f3f4f6' }}>
                  {selectedSlideId ? quiz.slides.findIndex(s => s.id === selectedSlideId) + 1 : 0} / {quiz.slides.length}
                </div>
                <button
                  onClick={() => {
                    const currentIndex = quiz.slides.findIndex(s => s.id === selectedSlideId);
                    if (currentIndex < quiz.slides.length - 1) {
                      setSelectedSlideId(quiz.slides[currentIndex + 1].id);
                    }
                  }}
                  disabled={!selectedSlideId || quiz.slides.findIndex(s => s.id === selectedSlideId) === quiz.slides.length - 1}
                  className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors flex items-center justify-center"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
            </div>
            
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                {/* Undo/Redo buttons - square icons */}
                      <button
                  onClick={undo}
                  disabled={undoStack.length === 0}
                  className="w-10 h-10 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300 disabled:opacity-30 disabled:hover:bg-slate-200 transition-colors flex items-center justify-center"
                  title="Zpět (Ctrl+Z)"
                >
                  <Undo2 className="w-5 h-5" />
                      </button>
                      <button
                  onClick={redo}
                  disabled={redoStack.length === 0}
                  className="w-10 h-10 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300 disabled:opacity-30 disabled:hover:bg-slate-200 transition-colors flex items-center justify-center"
                  title="Vpřed (Ctrl+Shift+Z)"
                >
                  <Redo2 className="w-5 h-5" />
                      </button>

                {/* Preview - square icon */}
                      <button
                  onClick={() => setShowPreview(true)}
                  className="w-10 h-10 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors flex items-center justify-center"
                  title="Náhled"
                >
                  <Eye className="w-5 h-5" />
                      </button>

                {/* Print / Worksheet - square icon */}
                                <button
                                  onClick={() => {
                    // Auto-save first
                    saveQuiz(quiz);
                    setIsDirty(false);
                    // Convert to worksheet and open
                    const worksheet = boardToWorksheet(quiz);
                    saveWorksheet(worksheet);
                    navigate(`/worksheet/edit/${worksheet.id}`);
                  }}
                  className="w-10 h-10 rounded-lg text-white flex items-center justify-center transition-colors"
                  style={{ backgroundColor: '#f97316' }}
                  title="Pracovní list"
                >
                  <Printer className="w-5 h-5" />
                                </button>

                {/* Play and Share - green button */}
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => {
                    // Use ref to get the CURRENT quiz value (avoid stale closure)
                    const currentQuiz = quizRef.current;
                    if (!currentQuiz) {
                      console.error('[QuizEditor] No quiz to save!');
                      return;
                    }
                    
                    // Debug: log quiz state before save
                    console.log('[QuizEditor] Saving before navigation:', {
                      id: currentQuiz.id,
                      title: currentQuiz.title,
                      slidesCount: currentQuiz.slides?.length,
                      hasSettings: !!currentQuiz.settings,
                    });
                    
                    // Save SYNCHRONOUSLY before navigation
                    saveQuiz(currentQuiz);
                    setIsDirty(false);
                    
                    // Debug: verify save worked
                    const storageKey = `vividbooks_quiz_${currentQuiz.id}`;
                    const saved = localStorage.getItem(storageKey);
                    console.log('[QuizEditor] Verify save:', saved ? 'SUCCESS' : 'FAILED', saved ? JSON.parse(saved).slides?.length + ' slides' : '');
                    
                    // Navigate to quiz view page
                    navigate(`/quiz/view/${currentQuiz.id}`);
                  }}
                  disabled={quiz.slides.length === 0}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all hover:scale-105 disabled:opacity-50 disabled:transform-none"
                  style={{ backgroundColor: '#78F1B1', color: '#1a1a1a' }}
                >
                  <Play className="w-5 h-5" />
                  {windowWidth > 1050 ? 'Přehrát a sdílet' : 'Přehrát'}
                </button>
              </div>
                            </div>
                          </div>
            
            {/* Editor Canvas - Responsive with reserved space for block settings on left, expanded to right */}
            <div 
              className="flex-1 overflow-auto p-4 flex justify-center bg-slate-100 relative cursor-default"
              style={{ paddingLeft: showNavArrows ? '80px' : '16px', paddingRight: showNavArrows ? '80px' : '16px' }}
              onClick={() => {
                // Close block selection when clicking anywhere on canvas
                setSelectedBlockIndex(null);
                setShowBlockSettings(false);
                setActivePanel('board');
                setEditingTextBlockIndex(null);
                setShowPageSettings(false);
              }}
            >
              {selectedSlide ? (
                <div 
                  className="relative w-full flex flex-col mb-4 transition-all duration-300 mx-auto" 
                  style={{ 
                    width: '100%',
                    maxWidth: showNavArrows 
                      ? 'calc((100vh - 220px) * 4 / 3 * 1.023)' 
                      : 'calc((100vh - 220px) * 4 / 3 * 0.93)',
                  }}
                  onClick={() => {
                    // Clicking on empty space around slide deselects block
                    setSelectedBlockIndex(null);
                    setShowBlockSettings(false);
                  }}
                >
                  {/* Settings and Slide Type Info - aligned left */}
                  <div className="flex items-center justify-start gap-2 mb-3 relative z-[100] min-h-[40px] ml-2.5">
                    {/* BLOCK SETTINGS - When a block is selected */}
                    {selectedBlockIndex !== null && selectedSlide?.type === 'info' && selectedSlide.layout ? (
                      <>
                        {/* Close Button - X in white circle */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBlockIndex(null);
                            setBlockSettingsSection(null);
                          }}
                          className="w-8 h-8 rounded-full bg-white border border-slate-200 hover:border-slate-400 hover:bg-slate-50 text-slate-500 flex items-center justify-center transition-all shrink-0"
                          title="Zavřít nastavení bloku"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        
                        {/* Block Settings Button - Toggles BlockSettingsPanel */}
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            if (showBlockSettings) {
                              setShowBlockSettings(false);
                              setBlockSettingsSection(null);
                            } else {
                              setShowBlockSettings(true);
                              // For text blocks, open format section by default
                              const blockType = selectedSlide.layout?.blocks[selectedBlockIndex]?.type;
                              setBlockSettingsSection(blockType === 'text' ? 'format' : null);
                            }
                          }}
                          className="flex items-center gap-2 px-3 py-2 rounded-2xl transition-all group active:scale-95 h-10"
                          style={{ 
                            backgroundColor: showBlockSettings ? '#1d4ed8' : '#dbeafe',
                            color: showBlockSettings ? '#ffffff' : '#1d4ed8',
                            border: '1px solid #93c5fd',
                          }}
                          title={showBlockSettings ? "Zavřít nastavení bloku" : "Otevřít nastavení bloku"}
                        >
                          <Settings className="w-4 h-4" />
                          <span className="text-[13px] font-medium whitespace-nowrap">
                            Blok
                          </span>
                        </button>
                        
                        {/* Block Background Color Button - wider style */}
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setShowBlockSettings(true);
                            setBlockSettingsSection('background');
                          }}
                          className="flex items-center justify-center px-4 h-10 rounded-2xl transition-all group active:scale-95 border border-slate-200 hover:border-slate-400"
                          style={{ 
                            backgroundColor: selectedSlide.layout.blocks[selectedBlockIndex]?.background?.color || '#ffffff',
                            color: getContrastColor(selectedSlide.layout.blocks[selectedBlockIndex]?.background?.color || '#ffffff'),
                          }}
                          title="Barva pozadí bloku"
                        >
                          <ColorIcon className="w-5 h-5" />
                        </button>

                        {/* Text Block Toolbar */}
                        {selectedSlide.layout.blocks[selectedBlockIndex]?.type === 'text' && (
                          <>
                            <div className="w-px h-6 bg-slate-200 mx-1" />
                            
                            {/* Text label with gray background - clickable to open settings */}
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowBlockSettings(true);
                                setBlockSettingsSection('format');
                              }}
                              className="flex items-center gap-2 px-3 rounded-2xl h-10 hover:opacity-90 transition-opacity"
                              style={{ backgroundColor: '#64748b' }}
                            >
                              <Type className="w-4 h-4 text-white" />
                              <span className="text-[13px] font-medium text-white">Text</span>
                            </button>
                            
                            <SlideTextToolbar
                              isBold={selectedSlide.layout.blocks[selectedBlockIndex]?.fontWeight === 'bold'}
                              isItalic={selectedSlide.layout.blocks[selectedBlockIndex]?.fontStyle === 'italic'}
                              isUnderline={selectedSlide.layout.blocks[selectedBlockIndex]?.textDecoration === 'underline'}
                              textAlign={selectedSlide.layout.blocks[selectedBlockIndex]?.textAlign || 'left'}
                              fontSize={selectedSlide.layout.blocks[selectedBlockIndex]?.fontSize || 'medium'}
                              textColor={selectedSlide.layout.blocks[selectedBlockIndex]?.textColor || '#000000'}
                              highlightColor={selectedSlide.layout.blocks[selectedBlockIndex]?.highlightColor || 'transparent'}
                              textOverflow={selectedSlide.layout.blocks[selectedBlockIndex]?.textOverflow === 'scroll' ? 'scroll' : 'fit'}
                              listType={selectedSlide.layout.blocks[selectedBlockIndex]?.listType || 'none'}
                              onBoldToggle={() => {
                                const block = selectedSlide.layout!.blocks[selectedBlockIndex];
                                const newBlocks = [...selectedSlide.layout!.blocks];
                                newBlocks[selectedBlockIndex] = { ...block, fontWeight: block.fontWeight === 'bold' ? 'normal' : 'bold' };
                                updateSlide(selectedSlide.id, { layout: { ...selectedSlide.layout!, blocks: newBlocks } });
                              }}
                              onItalicToggle={() => {
                                const block = selectedSlide.layout!.blocks[selectedBlockIndex];
                                const newBlocks = [...selectedSlide.layout!.blocks];
                                newBlocks[selectedBlockIndex] = { ...block, fontStyle: block.fontStyle === 'italic' ? 'normal' : 'italic' };
                                updateSlide(selectedSlide.id, { layout: { ...selectedSlide.layout!, blocks: newBlocks } });
                              }}
                              onUnderlineToggle={() => {
                                const block = selectedSlide.layout!.blocks[selectedBlockIndex];
                                const newBlocks = [...selectedSlide.layout!.blocks];
                                newBlocks[selectedBlockIndex] = { ...block, textDecoration: block.textDecoration === 'underline' ? 'none' : 'underline' };
                                updateSlide(selectedSlide.id, { layout: { ...selectedSlide.layout!, blocks: newBlocks } });
                              }}
                              onAlignChange={(align) => {
                                const newBlocks = [...selectedSlide.layout!.blocks];
                                newBlocks[selectedBlockIndex] = { ...newBlocks[selectedBlockIndex], textAlign: align };
                                updateSlide(selectedSlide.id, { layout: { ...selectedSlide.layout!, blocks: newBlocks } });
                              }}
                              onFontSizeChange={(size) => {
                                const newBlocks = [...selectedSlide.layout!.blocks];
                                newBlocks[selectedBlockIndex] = { ...newBlocks[selectedBlockIndex], fontSize: size };
                                updateSlide(selectedSlide.id, { layout: { ...selectedSlide.layout!, blocks: newBlocks } });
                              }}
                              onTextColorChange={(color) => {
                                const newBlocks = [...selectedSlide.layout!.blocks];
                                newBlocks[selectedBlockIndex] = { ...newBlocks[selectedBlockIndex], textColor: color };
                                updateSlide(selectedSlide.id, { layout: { ...selectedSlide.layout!, blocks: newBlocks } });
                              }}
                              onHighlightColorChange={(color) => {
                                const newBlocks = [...selectedSlide.layout!.blocks];
                                newBlocks[selectedBlockIndex] = { ...newBlocks[selectedBlockIndex], highlightColor: color };
                                updateSlide(selectedSlide.id, { layout: { ...selectedSlide.layout!, blocks: newBlocks } });
                              }}
                              onTextOverflowChange={(overflow) => {
                                const newBlocks = [...selectedSlide.layout!.blocks];
                                newBlocks[selectedBlockIndex] = { ...newBlocks[selectedBlockIndex], textOverflow: overflow };
                                updateSlide(selectedSlide.id, { layout: { ...selectedSlide.layout!, blocks: newBlocks } });
                              }}
                              onSizePresetChange={(preset) => {
                                const newBlocks = [...selectedSlide.layout!.blocks];
                                newBlocks[selectedBlockIndex] = { 
                                  ...newBlocks[selectedBlockIndex], 
                                  fontSize: preset.fontSize, 
                                  textOverflow: preset.textOverflow 
                                };
                                updateSlide(selectedSlide.id, { layout: { ...selectedSlide.layout!, blocks: newBlocks } });
                              }}
                              onListTypeChange={(type) => {
                                const newBlocks = [...selectedSlide.layout!.blocks];
                                const block = newBlocks[selectedBlockIndex];
                                let content = block.content || '';
                                content = content.split('\n').map(line => 
                                  line.replace(/^(\d+\.\s|•\s|☐\s|☑\s)/, '')
                                ).join('\n');
                                if (type !== 'none') {
                                  content = content.split('\n').map((line, idx) => {
                                    if (!line.trim()) return line;
                                    if (type === 'numbered') return `${idx + 1}. ${line}`;
                                    if (type === 'bullet') return `• ${line}`;
                                    if (type === 'checklist') return `☐ ${line}`;
                                    return line;
                                  }).join('\n');
                                }
                                newBlocks[selectedBlockIndex] = { ...block, listType: type, content };
                                updateSlide(selectedSlide.id, { layout: { ...selectedSlide.layout!, blocks: newBlocks } });
                              }}
                              onInsertSymbol={(symbol) => {
                                const newBlocks = [...selectedSlide.layout!.blocks];
                                const block = newBlocks[selectedBlockIndex];
                                newBlocks[selectedBlockIndex] = { ...block, content: (block.content || '') + symbol };
                                updateSlide(selectedSlide.id, { layout: { ...selectedSlide.layout!, blocks: newBlocks } });
                              }}
                            />
                          </>
                        )}

                        {/* Image Block Toolbar */}
                        {(selectedSlide.layout.blocks[selectedBlockIndex]?.type === 'image' || selectedSlide.layout.blocks[selectedBlockIndex]?.type === 'lottie') && (
                          <>
                            <div className="w-px h-6 bg-slate-200 mx-1" />
                            
                            {/* Image label with purple background - clickable to open settings */}
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowBlockSettings(true);
                                setBlockSettingsSection(null);
                              }}
                              className="flex items-center gap-2 px-3 rounded-2xl h-10 hover:opacity-90 transition-opacity"
                              style={{ backgroundColor: '#6366f1' }}
                            >
                              <ImageIcon className="w-4 h-4 text-white" />
                              <span className="text-[13px] font-medium text-white">Obrázek</span>
                            </button>
                            
                            {/* Upload/Change image button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowBlockSettings(true);
                                setBlockSettingsSection('image');
                              }}
                              className="flex items-center gap-2 px-4 bg-white border border-slate-200 hover:border-slate-400 rounded-2xl transition-all h-10"
                              title="Nahrát nový obrázek"
                            >
                              <Upload className="w-4 h-4 text-slate-500" />
                              <span className="text-[13px] font-medium text-[#4E5871]">
                                {selectedSlide.layout.blocks[selectedBlockIndex]?.content ? 'Změnit' : 'Nahrát'}
                              </span>
                            </button>

                            {/* Image scale slider - only show if image exists */}
                            {selectedSlide.layout.blocks[selectedBlockIndex]?.content && (
                              <div className="flex items-center gap-3 bg-white border border-slate-200 px-4 rounded-2xl h-10">
                                <span className="text-[13px] font-medium text-[#4E5871] whitespace-nowrap">Velikost</span>
                                <input
                                  type="range"
                                  min="10"
                                  max="200"
                                  value={selectedSlide.layout.blocks[selectedBlockIndex]?.imageScale || 100}
                                  onChange={(e) => {
                                    const newBlocks = [...selectedSlide.layout!.blocks];
                                    newBlocks[selectedBlockIndex] = { 
                                      ...newBlocks[selectedBlockIndex], 
                                      imageScale: parseInt(e.target.value),
                                      imageFit: 'contain'
                                    };
                                    updateSlide(selectedSlide.id, { layout: { ...selectedSlide.layout!, blocks: newBlocks } });
                                  }}
                                  className="w-16 accent-indigo-500"
                                  style={{ height: '4px' }}
                                  title="Velikost obrázku"
                                />
                              </div>
                            )}

                            {/* Gallery button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowBlockSettings(true);
                                setBlockSettingsSection('image');
                              }}
                              className={`flex items-center gap-2 px-4 rounded-2xl transition-all h-10 ${
                                selectedSlide.layout.blocks[selectedBlockIndex]?.gallery?.length 
                                  ? 'bg-indigo-50 border border-indigo-300 text-indigo-600' 
                                  : 'bg-white border border-slate-200 hover:border-slate-400 text-[#4E5871]'
                              }`}
                              title="Spravovat galerii obrázků"
                            >
                              <Grid2X2 className="w-4 h-4" />
                              <span className="text-[13px] font-medium">
                                {selectedSlide.layout.blocks[selectedBlockIndex]?.gallery?.length 
                                  ? `Galerie (${selectedSlide.layout.blocks[selectedBlockIndex]?.gallery?.length})` 
                                  : 'Galerie'}
                              </span>
                            </button>
                          </>
                        )}

                        {/* Link Block Toolbar */}
                        {selectedSlide.layout.blocks[selectedBlockIndex]?.type === 'link' && (
                          <>
                            <div className="w-px h-6 bg-slate-200 mx-1" />
                            
                            {/* Link label with orange background - clickable to open settings */}
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowBlockSettings(true);
                                setBlockSettingsSection(null);
                              }}
                              className="flex items-center gap-2 px-3 rounded-2xl h-10 hover:opacity-90 transition-opacity"
                              style={{ backgroundColor: '#f97316' }}
                            >
                              <Link2 className="w-4 h-4 text-white" />
                              <span className="text-[13px] font-medium text-white">Odkaz</span>
                            </button>
                            
                            {/* URL input */}
                            <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 rounded-2xl h-10">
                              <Link2 className="w-4 h-4 text-slate-400 shrink-0" />
                              <input
                                type="text"
                                value={selectedSlide.layout.blocks[selectedBlockIndex]?.content || ''}
                                onChange={(e) => {
                                  const newBlocks = [...selectedSlide.layout!.blocks];
                                  newBlocks[selectedBlockIndex] = { 
                                    ...newBlocks[selectedBlockIndex], 
                                    content: e.target.value 
                                  };
                                  updateSlide(selectedSlide.id, { layout: { ...selectedSlide.layout!, blocks: newBlocks } });
                                }}
                                placeholder="https://..."
                                className="w-44 text-[13px] font-medium text-[#4E5871] bg-transparent border-none focus:outline-none placeholder-slate-400"
                              />
                            </div>

                            {/* Link display style dropdown */}
                            <select
                              value={selectedSlide.layout.blocks[selectedBlockIndex]?.linkMode || 'button'}
                              onChange={(e) => {
                                const newBlocks = [...selectedSlide.layout!.blocks];
                                newBlocks[selectedBlockIndex] = { 
                                  ...newBlocks[selectedBlockIndex], 
                                  linkMode: e.target.value as 'button' | 'embed' | 'video' | 'qr' | 'preview'
                                };
                                updateSlide(selectedSlide.id, { layout: { ...selectedSlide.layout!, blocks: newBlocks } });
                              }}
                              className="text-[13px] font-medium text-[#4E5871] bg-white border border-slate-200 rounded-2xl h-10 px-4 focus:outline-none focus:border-indigo-400 cursor-pointer"
                            >
                              <option value="button">Tlačítko</option>
                              <option value="preview">Náhled</option>
                              <option value="embed">Vložit</option>
                              <option value="video">Video</option>
                              <option value="qr">QR kód</option>
                            </select>
                          </>
                        )}
                      </>
                    ) : (
                      /* PAGE SETTINGS - When no block is selected */
                      <>
                        {/* Page Settings Button - Light blue - toggles panel */}
                        <button
                          onClick={(e) => { e.stopPropagation(); togglePageSettings(); }}
                          className="flex items-center gap-2 px-3 py-2 rounded-2xl transition-all group active:scale-95 h-10 ml-1"
                          style={{ 
                            backgroundColor: showPageSettings ? '#1d4ed8' : '#dbeafe',
                            color: showPageSettings ? '#ffffff' : '#1d4ed8',
                            border: '1px solid #93c5fd',
                          }}
                          title={showPageSettings ? "Zavřít nastavení stránky" : "Otevřít nastavení stránky"}
                        >
                          <Settings className="w-4 h-4" />
                          <span className="text-[13px] font-medium whitespace-nowrap">
                            Stránka
                          </span>
                        </button>

                    {/* Page Type Buttons */}
                    {selectedSlide.type === 'activity' ? (
                      <>
                        {/* 1. Category Button: Aktivita */}
                    <button
                      onClick={(e) => { e.stopPropagation(); openPageSettings('type'); }}
                          className="flex items-center gap-2.5 bg-white border border-slate-200 hover:border-slate-400 px-4 py-2 rounded-2xl transition-all group active:scale-95 h-10 ml-1"
                          title="Změnit typ stránky"
                        >
                          <div style={{ color: '#03CA90' }}>
                            {React.cloneElement(SLIDE_TYPES.find(t => t.id === 'abc')?.icon as React.ReactElement, { className: 'w-4 h-4' })}
                          </div>
                          <span className="text-[13px] font-medium text-[#4E5871] whitespace-nowrap">
                            Aktivita
                          </span>
                        </button>

                        {/* 2. Specific Type Button */}
                        <button
                          onClick={(e) => { e.stopPropagation(); openPageSettings('type', true); }}
                          className="flex items-center gap-2.5 bg-white border border-slate-200 hover:border-slate-400 px-4 py-2 rounded-2xl transition-all group active:scale-95 h-10 ml-1"
                          title="Změnit typ aktivity"
                        >
                          {(() => {
                            const typeInfo = SLIDE_TYPES.find(t => 
                              t.type === selectedSlide.type && 
                              t.activityType === (selectedSlide as any).activityType
                            ) || SLIDE_TYPES[0];
                            return (
                              <>
                                <div style={{ color: typeInfo.color }}>
                                  {React.cloneElement(typeInfo.icon as React.ReactElement, { className: 'w-4 h-4' })}
                                </div>
                                <span className="text-[13px] font-medium text-[#4E5871] whitespace-nowrap">
                                  {typeInfo.label}
                                </span>
                              </>
                            );
                          })()}
                        </button>
                      </>
                    ) : (
                      /* Standard button for non-activity slides */
                      <button
                        onClick={(e) => { e.stopPropagation(); openPageSettings('type'); }}
                        className="flex items-center gap-2.5 bg-white border border-slate-200 hover:border-slate-400 px-4 py-2 rounded-2xl transition-all group active:scale-95 h-10 ml-1"
                      title="Změnit typ stránky"
                    >
                      {(() => {
                        const typeInfo = SLIDE_TYPES.find(t => 
                          t.type === selectedSlide.type && 
                          (selectedSlide.type !== 'activity' || t.activityType === (selectedSlide as any).activityType)
                        ) || SLIDE_TYPES[0];
                        return (
                          <>
                            <div style={{ color: typeInfo.color }}>
                              {React.cloneElement(typeInfo.icon as React.ReactElement, { className: 'w-4 h-4' })}
                            </div>
                            <span className="text-[13px] font-medium text-[#4E5871] whitespace-nowrap">
                                {typeInfo.label}
                            </span>
                          </>
                        );
                      })()}
                    </button>
                    )}

                    {/* Layout Button (only for info slides) */}
                    {selectedSlide.type === 'info' && (
                        <button 
                        onClick={(e) => { e.stopPropagation(); openPageSettings('layout'); }}
                        className="flex items-center gap-2.5 bg-white border border-slate-200 hover:border-slate-400 px-4 py-2 rounded-2xl transition-all group active:scale-95 h-10"
                          title="Změnit rozložení"
                        >
                            {windowWidth > 1140 && (
                        <span className="text-[13px] font-medium text-[#4E5871] whitespace-nowrap">
                          Rozvržení
                        </span>
                            )}
                        <LayoutIcon type={(selectedSlide as InfoSlide).layout?.type || 'title-content'} size="small" />
                        </button>
                    )}

                        {/* Background Color Button - just icon - for all slides including activities */}
                    <button 
                      onClick={(e) => { e.stopPropagation(); openPageSettings('background'); }}
                          className="flex items-center justify-center w-10 h-10 rounded-2xl transition-all group active:scale-95 border border-slate-200 hover:border-slate-400"
                      style={{ 
                        backgroundColor: (() => {
                          const bg = (selectedSlide as any).slideBackground;
                          if (bg?.type === 'color') return bg.color;
                          if (typeof bg === 'string') return bg;
                          return '#ffffff';
                        })(),
                        color: (() => {
                          const bgColor = (() => {
                            const bg = (selectedSlide as any).slideBackground;
                            if (bg?.type === 'color') return bg.color;
                            if (typeof bg === 'string') return bg;
                            return '#ffffff';
                          })();
                          return getContrastColor(bgColor === 'transparent' ? '#f8fafc' : bgColor);
                        })()
                      }}
                      title="Změnit barvu pozadí"
                    >
                          <ColorIcon className="w-[18px] h-[16px]" />
                    </button>

                    <div className="flex-1" /> {/* Spacer */}

                    {/* Navigation and Slide Operations */}
                    <div className="flex items-center gap-2">
                      {/* Move Slide Buttons */}
                      <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-2xl h-10">
                            {windowWidth > 1050 && (
                        <span className="text-[13px] font-medium text-[#4E5871] whitespace-nowrap">
                          Přesunout
                        </span>
                            )}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); moveSlide(selectedSlide.id, 'up'); }}
                            disabled={quiz?.slides.findIndex(s => s.id === selectedSlide.id) === 0}
                            className={`p-1 rounded-lg transition-all ${
                              quiz?.slides.findIndex(s => s.id === selectedSlide.id) === 0
                                ? 'bg-slate-50 text-slate-300 cursor-not-allowed'
                                : 'bg-slate-100 text-[#4E5871] hover:bg-slate-200 active:scale-90'
                            }`}
                          >
                            <ChevronLeft className="w-5 h-5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); moveSlide(selectedSlide.id, 'down'); }}
                            disabled={quiz?.slides.findIndex(s => s.id === selectedSlide.id) === quiz?.slides.length - 1}
                            className={`p-1 rounded-lg transition-all ${
                              quiz?.slides.findIndex(s => s.id === selectedSlide.id) === quiz?.slides.length - 1
                                ? 'bg-slate-50 text-slate-300 cursor-not-allowed'
                                : 'bg-slate-100 text-[#4E5871] hover:bg-slate-200 active:scale-90'
                            }`}
                          >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                      </div>
                      </div>

                      {/* Duplicate Button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); duplicateSlide(selectedSlide.id); }}
                        className="w-10 h-10 bg-white border border-slate-200 text-[#4E5871] hover:border-indigo-400 hover:text-indigo-600 rounded-2xl transition-all flex items-center justify-center active:scale-95 group"
                        title="Duplikovat stránku"
                      >
                        <Copy className="w-5 h-5" />
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          if (confirm('Opravdu chcete tuto stránku smazat?')) {
                            deleteSlide(selectedSlide.id);
                          }
                        }}
                        className="w-10 h-10 bg-white border border-slate-200 text-[#4E5871] hover:bg-red-50 hover:border-red-300 hover:text-red-600 rounded-2xl transition-all flex items-center justify-center active:scale-95"
                        title="Smazat stránku"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                      </>
                    )}
                  </div>
                  
                  {/* The actual editor with navigation arrows */}
                  <div className="relative">
                    {/* Left Arrow - Gray style like in preview (hidden on smaller screens) */}
                    {showNavArrows && (
                      <button
                        onClick={goToPrevSlide}
                        disabled={selectedSlideIndex <= 0}
                        className={`absolute top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                          selectedSlideIndex <= 0 
                            ? 'opacity-30 cursor-not-allowed' 
                            : 'hover:scale-110 hover:h-20 active:scale-95'
                        }`}
                        style={{ 
                          left: '-60px',
                          backgroundColor: '#CBD5E1'
                        }}
                      >
                        <ArrowLeft className="w-5 h-5 text-slate-600" />
                      </button>
                    )}
                    
                    {/* Slide Editor */}
                    <div 
                      className="rounded-xl shadow-sm border border-slate-200 transition-colors duration-300"
                      style={{ 
                        backgroundColor: (selectedSlide as any).slideBackground?.color || '#ffffff'
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {renderSlideEditor(
                        selectedSlide, 
                        updateSlide, 
                        () => {
                          setSelectedBlockIndex(null);
                          setActivePanel('board');
                          setShowPageSettings(false);
                          setEditingTextBlockIndex(null);
                        },
                        selectedBlockIndex,
                        (blockIndex) => {
                          setSelectedBlockIndex(blockIndex);
                          if (blockIndex !== null) {
                            setShowPageSettings(false); // Close page settings when block is selected
                            // Don't auto-open block settings - user must click on settings button
                          } else {
                            setActivePanel('board');
                            setShowBlockSettings(false);
                          }
                        },
                        (blockIndex) => {
                          // Open block settings when clicking on settings button
                          setShowBlockSettings(true);
                          const infoSlide = selectedSlide as InfoSlide;
                          const blockType = infoSlide.layout?.blocks[blockIndex]?.type;
                          setBlockSettingsSection(blockType === 'text' ? 'format' : null);
                        },
                        (blockIndex) => {
                          setEditingTextBlockIndex(blockIndex);
                        },
                        () => {
                          setEditingTextBlockIndex(null);
                        },
                        quiz
                      )}
                    </div>
                    
                    {/* Right Arrow - Purple style like in preview (hidden on smaller screens) */}
                    {showNavArrows && (
                      <button
                        onClick={goToNextSlide}
                        disabled={!quiz || selectedSlideIndex >= quiz.slides.length - 1}
                        className={`absolute top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full flex items-center justify-center text-white transition-all duration-300 ${
                          !quiz || selectedSlideIndex >= quiz.slides.length - 1 
                            ? 'opacity-30 cursor-not-allowed' 
                            : 'hover:scale-110 hover:h-20 active:scale-95'
                        }`}
                        style={{ 
                          right: '-60px',
                          backgroundColor: '#7C3AED'
                        }}
                      >
                        <ArrowRight className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                  
                  {/* Buttons below slide */}
                  <div className="flex items-center justify-between mt-4">
                    {/* Left side: Comments + Nová kapitola */}
                    <div className="flex items-center gap-1">
                      {/* Comments button */}
                      {(() => {
                        const slideComments = boardComments.filter(c => c.slide_id === selectedSlide.id);
                        const unreadCount = slideComments.filter(c => !c.is_read).length;
                        return (
                          <SlideCommentsPreview
                            comments={slideComments}
                            unreadCount={unreadCount}
                            onOpenPanel={() => {
                              setPageSettingsSection('comments');
                              setShowPageSettings(true);
                            }}
                          />
                        );
                      })()}
                      
                      {/* Nová kapitola */}
                      <button
                        onClick={(e) => { e.stopPropagation(); openPageSettings('chapter'); }}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      >
                        <ListOrdered className="w-4 h-4" />
                        <span>
                          {(selectedSlide as any).chapterName || 'Nová kapitola'}
                        </span>
                      </button>
                    </div>
                    
                    {/* Přidat poznámku - right */}
                    <button
                      onClick={(e) => { e.stopPropagation(); openPageSettings('note'); }}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span className="truncate max-w-[200px]">
                        {(selectedSlide as any).note 
                          ? ((selectedSlide as any).note.length > 30 
                              ? (selectedSlide as any).note.substring(0, 30) + '...' 
                              : (selectedSlide as any).note)
                          : 'Přidat poznámku'}
                      </span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <div className="w-24 h-24 bg-slate-200 rounded-full flex items-center justify-center mb-6 opacity-50">
                    <Plus className="w-10 h-10 text-slate-400" />
                  </div>
                  <p className="text-xl font-medium text-slate-600">Začněte tvořit</p>
                  <p className="text-slate-500 mt-2 mb-6">Vyberte "Přidat obsah" v levém panelu pro vytvoření prvního slidu.</p>
                  <button
                    onClick={() => setActivePanel('content')}
                    className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium shadow-lg hover:bg-indigo-700 hover:shadow-xl transition-all"
                  >
                    + Přidat první blok
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Results View */
          <div className="flex-1 bg-slate-50 overflow-hidden">
            {renderSessionsList()}
          </div>
        )}
      </div>

      {/* Version History Modal */}
      {showVersionHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <VersionHistoryPanel
            versions={versionHistory.versions}
            loading={versionHistory.loading}
            error={versionHistory.error}
            totalVersions={versionHistory.totalVersions}
            hasMoreVersions={versionHistory.hasMoreVersions}
            hasUnsavedChanges={versionHistory.hasUnsavedChanges}
            autoSavePending={versionHistory.autoSavePending}
            currentVersion={versionHistory.lastSavedVersion}
            onSaveManual={versionHistory.saveManualVersion}
            onRestore={versionHistory.restoreVersion}
            onLoadMore={versionHistory.loadMoreVersions}
            onClose={() => setShowVersionHistory(false)}
          />
        </div>
      )}
      
      {/* Page Settings Panel - Rendered via portal to document.body */}
      {showPageSettings && selectedSlide && createPortal(
        <PageSettingsPanel
          slide={selectedSlide}
          onClose={() => {
            setShowPageSettings(false);
            setPageSettingsSection(undefined);
            setPageSettingsInitialShowActivities(false);
          }}
          onUpdate={(updates) => updateSlide(selectedSlide.id, updates)}
          onTypeChange={changeSlideType}
          initialSection={pageSettingsSection}
          initialShowActivitiesList={pageSettingsInitialShowActivities}
          comments={boardComments}
          boardId={id}
          onCommentsUpdated={loadComments}
        />,
        document.body
      )}
      
      {/* Block Settings Panel - Rendered via portal to document.body */}
      {showBlockSettings && selectedBlockIndex !== null && selectedSlide?.type === 'info' && selectedSlide.layout && createPortal(
        <BlockSettingsPanel
          key={`block-${selectedBlockIndex}-${blockSettingsSection}`}
          block={selectedSlide.layout.blocks[selectedBlockIndex]}
          blockIndex={selectedBlockIndex}
          initialSection={blockSettingsSection || undefined}
          onUpdate={(updates) => {
            const newBlocks = [...selectedSlide.layout!.blocks];
            newBlocks[selectedBlockIndex] = { ...newBlocks[selectedBlockIndex], ...updates };
            updateSlide(selectedSlide.id, { layout: { ...selectedSlide.layout!, blocks: newBlocks } });
          }}
          onClose={() => { setShowBlockSettings(false); setSelectedBlockIndex(null); setBlockSettingsSection(null); }}
          onImageUpload={async (file) => {
            const toastId = toast.loading('Nahrávám obrázek...');
            try {
              const result = await uploadFile(file);
              if (result.success && result.file) {
                const newBlocks = [...selectedSlide.layout!.blocks];
                newBlocks[selectedBlockIndex] = { ...newBlocks[selectedBlockIndex], content: result.file.filePath };
                updateSlide(selectedSlide.id, { layout: { ...selectedSlide.layout!, blocks: newBlocks } });
                toast.success('Obrázek nahrán', { id: toastId });
              } else {
                toast.error(result.error || 'Chyba při nahrávání', { id: toastId });
              }
            } catch (err) {
              console.error('Upload error:', err);
              toast.error('Neočekávaná chyba při nahrávání', { id: toastId });
            }
          }}
        />,
        document.body
      )}
      
      {/* No backdrop - allow interaction with slide while panel is open */}
      
      {/* Share Edit Dialog */}
      {quiz && (
        <ShareEditDialog
          isOpen={showShareEditDialog}
          onClose={() => setShowShareEditDialog(false)}
          boardId={quiz.id}
          boardTitle={quiz.title || 'Board'}
        />
      )}
    </div>
  );
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getSlideTitle(slide: QuizSlide): string {
  if (slide.type === 'info') {
    const infoSlide = slide as InfoSlide;
    const noteText = infoSlide.note ? infoSlide.note.replace(/<[^>]*>/g, '').substring(0, 50).trim() : '';

    if (infoSlide.layout?.blocks) {
      // 1. Try to find a heading/title block (bold or xlarge)
      const headingBlock = infoSlide.layout.blocks.find(b => 
        (b.type === 'text' && (b.fontSize === 'xlarge' || b.fontWeight === 'bold'))
      );
      if (headingBlock && headingBlock.content) {
        return headingBlock.content.replace(/<[^>]*>/g, '').substring(0, 60).trim();
      }

      // 2. Try to find any text content
      const textBlock = infoSlide.layout.blocks.find(b => b.type === 'text' && b.content);
      if (textBlock && textBlock.content) {
        return textBlock.content.replace(/<[^>]*>/g, '').substring(0, 60).trim();
      }

      // 3. Try to find a video title or link title
      const linkBlock = infoSlide.layout.blocks.find(b => b.type === 'link' && (b.linkTitle || b.content));
      if (linkBlock) {
        return linkBlock.linkTitle || linkBlock.content.replace(/<[^>]*>/g, '').substring(0, 60).trim();
      }

      // 4. Try image caption or note for media
      const mediaBlock = infoSlide.layout.blocks.find(b => (b.type === 'image' || b.type === 'lottie'));
      if (mediaBlock) {
        const label = mediaBlock.type === 'image' ? 'Obrázek' : 'Animace';
        const detail = mediaBlock.imageCaption || noteText;
        return detail ? `${label}: ${detail}` : label;
      }
    }

    if (noteText) return noteText;
    return slide.title || '';
  }
  
  if (slide.type === 'activity') {
    const activity = slide as any;
    if (activity.question) {
      return activity.question.replace(/<[^>]*>/g, '').substring(0, 60).trim();
    }
    if (activity.title) return activity.title;
    
    // Activity type fallback labels
    const typeLabel = SLIDE_TYPES.find(t => t.activityType === activity.activityType)?.label;
    if (typeLabel) return typeLabel;
  }
  
  return '';
}

function renderSlideEditor(
  slide: QuizSlide, 
  onUpdate: (id: string, updates: Partial<QuizSlide>) => void,
  onSlideClick?: () => void,
  selectedBlockIndex: number | null,
  onBlockSelect: (index: number | null) => void,
  onOpenBlockSettings?: (blockIndex: number) => void,
  onTextEditStart?: (blockIndex: number) => void,
  onTextEditEnd?: () => void,
  quiz?: Quiz | null
) {
  if (slide.type === 'info') {
    return (
      <InfoSlideEditor 
        slide={slide as InfoSlide} 
        onUpdate={onUpdate}
        selectedBlockIndex={selectedBlockIndex}
        onBlockSelect={onBlockSelect}
        onOpenBlockSettings={onOpenBlockSettings}
        onTextEditStart={onTextEditStart}
        onTextEditEnd={onTextEditEnd}
      />
    );
  }
  
  if (slide.type === 'activity') {
    const activity = slide as any;
    switch (activity.activityType) {
      case 'abc':
        return <ABCSlideEditor slide={activity} onUpdate={onUpdate} />;
      case 'open':
        return <OpenSlideEditor slide={activity} onUpdate={onUpdate} />;
      case 'example':
        return <ExampleSlideEditor slide={activity} onUpdate={onUpdate} />;
      case 'board':
        return <BoardSlideEditor slide={activity} onUpdate={onUpdate} />;
      case 'voting':
        return <VotingSlideEditor slide={activity} onUpdate={onUpdate} />;
      default:
        return (
          <div className="p-8 text-center text-slate-500">
            Editor pro tento typ aktivity ({activity.activityType}) zatím není k dispozici.
          </div>
        );
    }
  }

  return null;
}

export default QuizEditorLayout;
