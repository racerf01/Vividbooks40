import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Menu, 
  Moon, 
  Sun, 
  Search, 
  X, 
  PanelLeft,
  PanelLeftClose, 
  User, 
  FolderPlus, 
  FilePlus, 
  LayoutGrid, 
  Folder, 
  FileText,
  FileEdit,
  Plus, 
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  ChevronDown,
  MoreVertical,
  Copy,
  Pencil,
  Trash2,
  CheckSquare,
  Square,
  FolderInput,
  Upload,
  Image,
  Video,
  Music,
  Archive,
  Presentation,
  Table,
  File,
  Download,
  HardDrive,
  Link2,
  ExternalLink,
  Globe,
  Check,
  Users,
  Share2,
  Grid3X3,
  List,
  ArrowUpDown,
  Play
} from 'lucide-react';
import VividLogo from '../imports/Group70';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { ToolsDropdown } from './ToolsDropdown';
import { ToolsMenu } from './ToolsMenu';
import { useEcosystemAccess, useBoardCount } from '../hooks/useEcosystemAccess';
import { useFileStorage } from '../hooks/useFileStorage';
import { useLinkStorage } from '../hooks/useLinkStorage';
import { 
  formatFileSize, 
  getFileTypeInfo,
  StoredFile,
  StoredLink,
  STORAGE_LIMITS 
} from '../types/file-storage';
import { toast } from 'sonner';
import { FilePreviewModal, canPreviewFile } from './FilePreviewModal';
import { AddLinkModal } from './AddLinkModal';
import { detectLinkType, LinkInfo, fetchLinkMetadata, LinkMetadata, extractYouTubeVideoId, getYouTubeThumbnail, extractLoomVideoId, getLoomThumbnail } from '../utils/link-detector';
import { getYouTubeTranscript } from '../utils/youtube-transcript';
import { LinkPreviewModal } from './LinkPreviewModal';
import { saveDocument as saveDocumentToStorage, deleteDocument as deleteDocumentFromStorage, DocumentItem, getDocumentSyncStatus, getDocumentDebugInfo } from '../utils/document-storage';
import { 
  getWorksheetList, 
  getWorksheet,
  deleteWorksheet as deleteWorksheetFromStorage, 
  duplicateWorksheet as duplicateWorksheetInStorage,
  moveWorksheetToFolder,
  getRootWorksheets,
  getWorksheetsInFolder,
  WorksheetListItem,
  getWorksheetSyncStatus,
  getWorksheetDebugInfo
} from '../utils/worksheet-storage';
import {
  getQuizList,
  getQuiz,
  deleteQuiz as deleteQuizFromStorage,
  duplicateQuiz as duplicateQuizInStorage,
  moveQuizToFolder,
  getRootQuizzes,
  getQuizzesInFolder,
  QuizListItem,
  migrateOldQuizStorage,
  getQuizSyncStatus,
  getQuizDebugInfo,
  forceDeleteFromSupabase,
  SyncStatus,
  manualSyncQuizToSupabase
} from '../utils/quiz-storage';
import { getFileSyncStatus, getFileDebugInfo } from '../utils/file-storage';
import { getLinkSyncStatus, getLinkDebugInfo } from '../utils/link-storage';
import { getFolderSyncStatus, getFolderDebugInfo, deleteFolder as deleteFolderFromStorage, isSystemFolder, ensureMediaFolderExists, MEDIA_FOLDER_ID, MEDIA_FOLDER_NAME } from '../utils/folder-storage';
import { supabase } from '../utils/supabase/client';
import { syncFromSupabase as syncQuizzesFromSupabase, saveQuiz } from '../utils/quiz-storage';
import { createEmptyQuiz } from '../types/quiz';
import { syncFromSupabase as syncFoldersFromSupabase } from '../utils/folder-storage';
import { fetchTeacherContentSnapshot } from '../utils/sync/teacher-content-diagnostics';

interface MyContentLayoutProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

interface SharedClass {
  id: string;
  name: string;
  color: string;
}

interface ContentItem {
  id: string;
  name: string;
  type: 'folder' | 'document' | 'board' | 'worksheet';
  color?: string;
  copiedFrom?: 'vividbooks' | 'vividbooks-category';
  children?: ContentItem[];
  sharedWithClasses?: SharedClass[]; // Classes this folder is shared with
  createdAt?: number;
  updatedAt?: number;
}

// SVG Path for folder shape
const FOLDER_BACK_PATH = "M6.31652 12.5701C6.31652 5.62783 11.9444 0 18.8866 0H60.976C65.4295 0 69.5505 2.35648 71.8093 6.19466L73.4384 8.96289C75.6972 12.8011 79.8183 15.1575 84.2718 15.1575H156.69C163.632 15.1575 169.26 20.7854 169.26 27.7277V133.953C169.26 140.895 163.632 146.523 156.69 146.523H18.8867C11.9444 146.523 6.31652 140.895 6.31652 133.953V12.5701Z";

// Predefined folder colors
const FOLDER_COLORS = [
  '#bbf7d0', // green
  '#bfdbfe', // blue
  '#fde68a', // yellow
  '#fecaca', // red
  '#e9d5ff', // purple
  '#fed7aa', // orange
  '#a5f3fc', // cyan
  '#fbcfe8', // pink
];

// Reusable Sync Status Badge Component
const SyncStatusBadge = ({ 
  id, 
  type,
  left = '36px'
}: { 
  id: string; 
  type: 'quiz' | 'document' | 'worksheet' | 'file' | 'link' | 'folder';
  left?: string;
}) => {
  const getSyncStatus = () => {
    switch (type) {
      case 'quiz': return getQuizSyncStatus(id);
      case 'document': return getDocumentSyncStatus(id);
      case 'worksheet': return getWorksheetSyncStatus(id);
      case 'file': return getFileSyncStatus(id);
      case 'link': return getLinkSyncStatus(id);
      case 'folder': return getFolderSyncStatus(id);
    }
  };
  
  const getDebugInfo = () => {
    switch (type) {
      case 'quiz': return getQuizDebugInfo(id);
      case 'document': return getDocumentDebugInfo(id);
      case 'worksheet': return getWorksheetDebugInfo(id);
      case 'file': return getFileDebugInfo(id);
      case 'link': return getLinkDebugInfo(id);
      case 'folder': return getFolderDebugInfo(id);
    }
  };
  
  const syncStatus = getSyncStatus();
  const bgColors: Record<SyncStatus, string> = {
    supabase: '#22c55e',
    pending: '#eab308',
    local: '#ef4444',
  };
  const statusLabels: Record<SyncStatus, string> = {
    supabase: 'sync',
    pending: 'čeká',
    local: 'místní',
  };
  
  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const debugInfo = getDebugInfo();
    console.log(`[SyncDebug] ${type}:`, id);
    console.log(debugInfo);
    
    // For quizzes synced in Supabase, offer force delete option
    if (type === 'quiz' && syncStatus === 'supabase') {
      const action = window.confirm(
        `Sync stav: ${syncStatus}\nTyp: ${type}\n\nDebug info:\n${debugInfo}\n\n` +
        `Klikni OK pro VYNUTIT SMAZÁNÍ tohoto boardu ze Supabase (použij pokud je to "zombie" soubor)`
      );
      
      if (action) {
        const success = await forceDeleteFromSupabase(id);
        if (success) {
          alert('✅ Board byl smazán ze Supabase');
          window.location.reload();
        } else {
          alert('❌ Nepodařilo se smazat board');
        }
      }
    } else {
      alert(`Sync stav: ${syncStatus}\nTyp: ${type}\n\nDebug info (viz konzole):\n${debugInfo}`);
    }
  };
  
  return (
    <button
      onClick={handleClick}
      style={{
        position: 'absolute',
        top: '8px',
        left,
        zIndex: 10,
        padding: '2px 6px',
        borderRadius: '4px',
        fontSize: '9px',
        fontWeight: 700,
        backgroundColor: bgColors[syncStatus],
        color: 'white',
        border: 'none',
        cursor: 'pointer',
      }}
      title={`Klikni pro debug info - stav: ${syncStatus}`}
    >
      {statusLabels[syncStatus]}
    </button>
  );
};

// Folder Card Component (matching library style)
const FolderCard = ({ 
  item, 
  onClick, 
  onMenuClick,
  onDrop,
  onShare
}: { 
  item: ContentItem; 
  onClick: () => void;
  onMenuClick: (action: 'rename' | 'delete') => void;
  onDrop?: (docId: string, itemType: string) => void;
  onShare?: () => void;
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  // System folders (like "Moje obrázky") are always light gray
  const isMediaFolder = item.id === MEDIA_FOLDER_ID || item.isSystemFolder;
  const color = isMediaFolder ? '#e2e8f0' : (item.color || '#bbf7d0');
  // Override name for media folder to ensure consistent naming
  const displayName = item.id === MEDIA_FOLDER_ID ? MEDIA_FOLDER_NAME : item.name;
  const clipId = `clip-${item.id}`;
  const filterId = `filter-${item.id}`;
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const docId = e.dataTransfer.getData('documentId');
    const itemType = e.dataTransfer.getData('itemType') || 'document';
    if (docId && onDrop) {
      onDrop(docId, itemType);
    }
  };
  
  return (
    <div 
      onClick={onClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col items-center gap-2 group cursor-pointer transition-all duration-200 ${isDragOver ? 'scale-110 opacity-80' : ''}`}
      style={{ width: '126px' }}
    >
      <div className="relative w-full transition-transform group-hover:-translate-y-1 duration-200" style={{ aspectRatio: '173/147' }}>
        {/* Menu button */}
        <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button 
                className="p-1.5 rounded-lg bg-white/90 hover:bg-white shadow-sm text-slate-500 hover:text-slate-700"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMenuClick('rename'); }}>
                <Pencil className="h-4 w-4 mr-2" />
                Přejmenovat
              </DropdownMenuItem>
              {onShare && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onShare(); }}>
                  <Users className="h-4 w-4 mr-2" />
                  Sdílet se třídou
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-red-600 focus:text-red-600"
                onClick={(e) => { e.stopPropagation(); onMenuClick('delete'); }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Smazat
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        {/* Sync status badge */}
        <SyncStatusBadge id={item.id} type="folder" left="8px" />

        <svg 
          viewBox="0 0 173.049 146.714" 
          className="w-full h-full overflow-visible"
          fill="none"
          preserveAspectRatio="none"
        >
          <defs>
            <filter 
              id={filterId}
              colorInterpolationFilters="sRGB" 
              filterUnits="userSpaceOnUse" 
              height="140.537" 
              width="192.137" 
              x="-9.54412" 
              y="18.4489"
            >
              <feFlood floodOpacity="0" result="BackgroundImageFix"/>
              <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
              <feOffset dy="2.72689"/>
              <feGaussianBlur stdDeviation="4.77206"/>
              <feComposite in2="hardAlpha" operator="out"/>
              <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.2 0"/>
              <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow"/>
              <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape"/>
            </filter>
          </defs>
          
          <g>
            {/* Back part - 50% opacity */}
            <path 
              d={FOLDER_BACK_PATH} 
              fill={color} 
              fillOpacity="0.5" 
            />
            
            {/* Front part with shadow */}
            <g filter={`url(#${filterId})`}>
              <rect 
                y="25.2661" 
                width="173.049" 
                height="121.448" 
                rx="15" 
                fill={color} 
              />
            </g>
          </g>
        </svg>
        
        {/* System folder icon (e.g., "Moje obrázky") */}
        {isMediaFolder && (
          <div 
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ top: '25%' }}
          >
            <svg 
              width="40" 
              height="40" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="#94a3b8" 
              strokeWidth="1.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              style={{ opacity: 0.6 }}
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
        )}
        
        {/* Shared classes indicator - inside folder front part */}
        {item.sharedWithClasses && item.sharedWithClasses.length > 0 && (
          <div className="absolute z-20 flex items-center gap-1" style={{ top: '20px', left: '6px' }}>
            {item.sharedWithClasses.slice(0, 2).map((cls) => (
              <div
                key={cls.id}
                className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-md"
                style={{ backgroundColor: cls.color }}
                title={`Sdíleno s: ${cls.name}`}
              >
                {cls.name}
        </div>
            ))}
            {item.sharedWithClasses.length > 2 && (
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-md"
                style={{ backgroundColor: '#64748b' }}
              >
                +{item.sharedWithClasses.length - 2}
              </div>
            )}
          </div>
        )}
      </div>
      <span className="text-sm text-center font-medium text-[#4E5871] line-clamp-2 px-1 tracking-wide" style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>
        {displayName}
      </span>
    </div>
  );
};

// Worksheet Preview Card Component (matching document style with amber theme)
const WorksheetPreviewCard = React.forwardRef<HTMLDivElement, { 
  worksheet: WorksheetListItem;
  onClick: () => void;
  onMenuClick: (action: 'edit' | 'duplicate' | 'delete') => void;
  onDragStart?: (e: React.DragEvent) => void;
  isSelected?: boolean;
  onSelect?: (e: React.MouseEvent) => void;
  showSelection?: boolean;
}>(({ 
  worksheet,
  onClick, 
  onMenuClick,
  onDragStart,
  isSelected,
  onSelect,
  showSelection,
}, ref) => {
  // Get worksheet data for preview
  const wsData = getWorksheet(worksheet.id);
  const displayName = worksheet.title || 'Bez názvu';
  const blocksCount = worksheet.blocksCount || 0;
  
  // Generate preview content from blocks
  const previewContent = wsData?.blocks?.slice(0, 3).map((block, i) => {
    if (block.type === 'heading') {
      return <div key={i} style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '6px' }}>{(block.content as any).text || ''}</div>;
    }
    if (block.type === 'paragraph') {
      const text = (block.content as any).html?.replace(/<[^>]*>/g, '') || '';
      return <div key={i} style={{ fontSize: '11px', marginBottom: '4px', color: '#64748b' }}>{text.slice(0, 80)}{text.length > 80 ? '...' : ''}</div>;
    }
    if (block.type === 'multiple-choice') {
      return <div key={i} style={{ fontSize: '11px', marginBottom: '4px', color: '#64748b' }}>📝 {(block.content as any).question?.slice(0, 60) || 'Otázka s výběrem'}...</div>;
    }
    if (block.type === 'free-answer') {
      return <div key={i} style={{ fontSize: '11px', marginBottom: '4px', color: '#64748b' }}>✏️ {(block.content as any).question?.slice(0, 60) || 'Volná odpověď'}...</div>;
    }
    return null;
  });

  return (
    <div 
      ref={ref}
      data-selectable-item
      draggable
      onDragStart={onDragStart}
      onClick={(e) => {
        e.stopPropagation();
        if (onSelect && (e.ctrlKey || e.metaKey || e.shiftKey || showSelection)) {
          onSelect(e);
        } else {
          onClick();
        }
      }}
      className="flex flex-col items-center group cursor-pointer"
      style={{ width: '126px' }}
    >
      {/* Worksheet Preview Card */}
      <div className={`relative w-full bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg border-2 shadow-sm overflow-hidden group-hover:shadow-lg transition-all ${
        isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-amber-200 group-hover:border-amber-400'
      }`}
           style={{ aspectRatio: '3/4' }}>
        
        {/* Selection checkbox */}
        {onSelect && (
          <button
            onClick={(e) => { e.stopPropagation(); onSelect(e); }}
            className={`absolute top-2 right-2 z-20 p-1 rounded transition-all ${
              isSelected || showSelection ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
          >
            {isSelected ? (
              <CheckSquare className="h-5 w-5 text-blue-500" />
            ) : (
              <Square className="h-5 w-5 text-slate-400 hover:text-blue-500" />
            )}
          </button>
        )}
        
        {/* Worksheet icon badge */}
        <div className="absolute top-2 left-2 z-10">
          <div className="p-1.5 rounded-lg bg-amber-500 shadow-sm">
            <FileEdit className="h-3 w-3 text-white" />
          </div>
        </div>
        
        {/* Sync status badge */}
        <SyncStatusBadge id={worksheet.id} type="worksheet" />
        
        {/* Scaled content preview */}
        <div 
          className="absolute overflow-hidden pointer-events-none pt-10"
          style={{ 
            width: '378px',
            height: '504px',
            transform: 'scale(0.333)',
            transformOrigin: 'top left',
            padding: '16px',
            paddingTop: '40px',
            fontSize: '13px',
            lineHeight: '1.5',
            color: '#1f2937'
          }}
        >
          <h1 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '12px', color: '#92400e' }}>
            {displayName}
          </h1>
          {blocksCount === 0 ? (
            <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>Prázdný pracovní list</p>
          ) : (
            <div>
              {previewContent}
              {blocksCount > 3 && (
                <p style={{ fontSize: '10px', color: '#94a3b8', marginTop: '8px' }}>
                  +{blocksCount - 3} dalších bloků
                </p>
              )}
            </div>
          )}
        </div>
        
        {/* Bottom gradient fade */}
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-amber-50 via-amber-50/80 to-transparent" />
        
        {/* Blocks count badge */}
        <div className="absolute bottom-2 left-2 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
          {blocksCount} {blocksCount === 1 ? 'blok' : blocksCount < 5 ? 'bloky' : 'bloků'}
        </div>
        
        {/* Menu button */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <button className="absolute top-1 right-1 p-1 rounded-md bg-white/90 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white border border-amber-200">
              <MoreVertical className="h-3.5 w-3.5 text-amber-600" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMenuClick('edit'); }}>
              <Pencil className="h-4 w-4 mr-2" />
              Upravit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMenuClick('duplicate'); }}>
              <Copy className="h-4 w-4 mr-2" />
              Duplikovat
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={(e) => { e.stopPropagation(); onMenuClick('delete'); }}
              className="text-red-600"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Smazat
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      {/* Worksheet name */}
      <div className="w-full mt-3 flex items-center justify-center gap-1.5">
        <FileEdit className="h-4 w-4 text-amber-500 flex-shrink-0" />
        <h3 className="text-sm font-medium text-amber-800 truncate">{displayName}</h3>
      </div>
    </div>
  );
});

// Quiz/Board Preview Card Component (matching document style with indigo theme)
const QuizPreviewCard = React.forwardRef<HTMLDivElement, { 
  quiz: QuizListItem;
  onClick: () => void;
  onMenuClick: (action: 'edit' | 'duplicate' | 'delete' | 'move' | 'sync') => void;
  onDragStart?: (e: React.DragEvent) => void;
  isSelected?: boolean;
  onSelect?: (e: React.MouseEvent) => void;
  showSelection?: boolean;
}>(({ 
  quiz,
  onClick, 
  onMenuClick,
  onDragStart,
  isSelected,
  onSelect,
  showSelection,
}, ref) => {
  // Get quiz data for preview
  const quizData = getQuiz(quiz.id);
  const displayName = quiz.title || 'Bez názву';
  const syncStatus = getQuizSyncStatus(quiz.id);
  const slidesCount = quiz.slidesCount || 0;
  
  // Get first slide data for preview
  const firstSlide = quizData?.slides?.[0] as any;
  const firstSlideBlocks = firstSlide?.layout?.blocks || [];
  const slideBackground = firstSlide?.background || firstSlide?.layout?.background;
  
  // Find first image URL from blocks
  const getFirstImageUrl = (): string | null => {
    for (const block of firstSlideBlocks) {
      if (block.type === 'image' && block.content) {
        if (typeof block.content === 'string' && (block.content.startsWith('http') || block.content.startsWith('data:'))) {
          return block.content;
        }
      }
    }
    return null;
  };
  
  // Get text content from first slide
  const getFirstSlideContent = () => {
    const result: { header?: string; text?: string; headerBg?: string } = {};
    
    for (const block of firstSlideBlocks) {
      const content = block.content;
      if (!content || block.type !== 'text') continue;
      
      // Extract plain text from HTML content
      const htmlContent = typeof content === 'string' ? content : '';
      const plainText = htmlContent.replace(/<[^>]*>/g, '').trim();
      if (!plainText) continue;
      
      // Check if this is a title block (xlarge font, bold, or has background color)
      const hasBackground = block.background?.color || block.highlightColor;
      const isTitle = block.fontSize === 'xlarge' || block.fontWeight === 'bold' || hasBackground;
      
      if (isTitle && !result.header) {
        result.header = plainText.slice(0, 50);
        result.headerBg = block.background?.color || block.highlightColor || '#7c2d12';
      } else if (!result.text) {
        // Regular text block - collect all remaining text
        result.text = plainText.slice(0, 120);
      }
    }
    return result;
  };
  
  const firstImageUrl = getFirstImageUrl();
  const firstSlideContent = getFirstSlideContent();

  return (
    <div 
      ref={ref}
      data-selectable-item
      draggable
      onDragStart={onDragStart}
      onClick={(e) => {
        e.stopPropagation();
        if (onSelect && (e.ctrlKey || e.metaKey || e.shiftKey || showSelection)) {
          onSelect(e);
        } else {
          onClick();
        }
      }}
      className="flex flex-col items-center group cursor-pointer"
      style={{ width: '126px' }}
    >
      {/* Quiz Preview Card - 4:3 aspect ratio like a screen */}
      <div className={`relative w-full bg-gradient-to-br from-indigo-50 to-violet-50 rounded-lg border-2 shadow-sm overflow-hidden group-hover:shadow-lg transition-all ${
        isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-indigo-200 group-hover:border-indigo-400'
      }`}
           style={{ aspectRatio: '4/3' }}>
        
        {/* Selection checkbox */}
        {onSelect && (
          <button
            onClick={(e) => { e.stopPropagation(); onSelect(e); }}
            className={`absolute top-2 right-2 z-20 p-1 rounded transition-all ${
              isSelected || showSelection ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
          >
            {isSelected ? (
              <CheckSquare className="h-5 w-5 text-blue-500" />
            ) : (
              <Square className="h-5 w-5 text-slate-400 hover:text-blue-500" />
            )}
          </button>
        )}
        
        {/* Quiz icon badge */}
        <div className="absolute top-2 left-2 z-10">
          <div className="p-1.5 rounded-lg bg-indigo-500 shadow-sm">
            <Play className="h-3 w-3 text-white" />
          </div>
        </div>
        
        {/* Sync status badge */}
        <SyncStatusBadge id={quiz.id} type="quiz" />
        
        {/* First slide preview - render actual content */}
        <div className="absolute inset-0 pt-7 overflow-hidden flex flex-col" style={{ backgroundColor: slideBackground || 'white' }}>
          {/* Header/Title block */}
          {firstSlideContent.header && (
            <div 
              className="mx-1 px-2 py-1 text-white font-bold text-[10px] leading-tight line-clamp-2"
              style={{ 
                backgroundColor: firstSlideContent.headerBg || '#7c2d12',
                borderRadius: '3px',
                flexShrink: 0
              }}
            >
              {firstSlideContent.header}
            </div>
          )}
          
          {/* Image if exists */}
          {firstImageUrl && (
            <div className="flex-1 min-h-0 p-1">
              <img 
                src={firstImageUrl}
                alt={displayName}
                className="w-full h-full object-cover rounded"
                loading="lazy"
              />
            </div>
          )}
          
          {/* Text content (show if no image) */}
          {firstSlideContent.text && !firstImageUrl && (
            <div 
              className="px-2 pt-1 text-[9px] leading-snug text-slate-700 line-clamp-5 flex-1"
              style={{ wordBreak: 'break-word' }}
            >
              {firstSlideContent.text}
            </div>
          )}
          
          {/* Empty state - no content */}
          {!firstSlideContent.header && !firstSlideContent.text && !firstImageUrl && (
            <div className="flex items-center justify-center flex-1">
              <p className="text-slate-400 text-[10px] italic">
                {slidesCount === 0 ? 'Prázdný board' : `${slidesCount} slidů`}
              </p>
            </div>
          )}
        </div>
        
        {/* Bottom gradient fade */}
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white via-white/80 to-transparent" />
        
        {/* Slides count badge */}
        <div className="absolute bottom-2 left-2 text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium">
          {slidesCount} {slidesCount === 1 ? 'slide' : slidesCount < 5 ? 'slidy' : 'slidů'}
        </div>
        
        {/* Menu button */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <button className="absolute bottom-2 right-2 z-30 p-1.5 rounded-md bg-white/90 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white border border-indigo-200">
              <MoreVertical className="h-4 w-4 text-indigo-600" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="z-50">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMenuClick('edit'); }}>
              <Pencil className="h-4 w-4 mr-2" />
              Upravit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMenuClick('duplicate'); }}>
              <Copy className="h-4 w-4 mr-2" />
              Duplikovat
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMenuClick('move'); }}>
              <FolderInput className="h-4 w-4 mr-2" />
              Přesunout do složky
            </DropdownMenuItem>
            {syncStatus === 'local' && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={(e) => { e.stopPropagation(); onMenuClick('sync'); }}
                  className="text-blue-600"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Nahrát do cloudu
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={(e) => { e.stopPropagation(); onMenuClick('delete'); }}
              className="text-red-600"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Smazat
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      {/* Quiz name */}
      <div className="w-full mt-3 flex items-center justify-center gap-1.5">
        <Play className="h-4 w-4 text-indigo-500 flex-shrink-0" />
        <h3 className="text-sm font-medium text-indigo-800 truncate">{displayName}</h3>
      </div>
    </div>
  );
});

// Create New Folder Card
const CreateFolderCard = ({ onClick }: { onClick: () => void }) => {
  return (
    <div 
      onClick={onClick}
      className="flex flex-col items-center gap-3 group cursor-pointer w-[173px]"
    >
      <div className="relative w-full aspect-[173/147] transition-transform group-hover:-translate-y-1 duration-200">
        <svg 
          viewBox="0 0 173.049 146.714" 
          className="w-full h-full overflow-visible"
          fill="none"
          preserveAspectRatio="none"
        >
          <g>
            {/* Back part - dashed */}
            <path 
              d={FOLDER_BACK_PATH} 
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="2"
              strokeDasharray="8 4"
            />
            
            {/* Front part - dashed */}
            <rect 
              y="25.2661" 
              width="173.049" 
              height="121.448" 
              rx="15" 
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="2"
              strokeDasharray="8 4"
            />
          </g>
        </svg>
        
        {/* Plus icon */}
        <div className="absolute inset-0 top-6 flex items-center justify-center pointer-events-none">
          <div className="p-3 rounded-full bg-slate-100 group-hover:bg-slate-200 transition-colors">
            <Plus className="w-8 h-8 text-slate-400 group-hover:text-slate-600 transition-colors" />
          </div>
        </div>
      </div>
      <span className="text-sm text-center font-medium text-slate-400 group-hover:text-[#4E5871] transition-colors" style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>
        Nová složka
      </span>
    </div>
  );
};

export function MyContentLayout({ theme, toggleTheme }: MyContentLayoutProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Ecosystem access check
  const ecosystemAccess = useEcosystemAccess();
  const boardCount = useBoardCount();
  
  // File storage hook
  const { 
    files: uploadedFiles, 
    usage: storageUsage, 
    uploading, 
    uploadFile, 
    deleteFile: deleteUploadedFile, 
    downloadFile,
    moveFileToFolder,
    getRootFiles,
    getFilesInFolder,
    getDownloadUrl
  } = useFileStorage();
  
  // File input ref for upload
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Layout states matching DocumentationLayout
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [logoHovered, setLogoHovered] = useState(false);

  // Dialog states
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editFolderOpen, setEditFolderOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<ContentItem | null>(null);
  const [editFolderName, setEditFolderName] = useState('');
  const [deleteFolderOpen, setDeleteFolderOpen] = useState(false);
  const [deletingFolder, setDeletingFolder] = useState<ContentItem | null>(null);
  
  // Share folder dialog
  const [shareFolderOpen, setShareFolderOpen] = useState(false);
  const [sharingFolder, setSharingFolder] = useState<ContentItem | null>(null);
  
  // Mock classes for sharing (TODO: load from actual data)
  const availableClasses: SharedClass[] = [
    { id: 'class-1', name: '6.A', color: '#3b82f6' },
    { id: 'class-2', name: '6.B', color: '#10b981' },
    { id: 'class-3', name: '7.A', color: '#f59e0b' },
    { id: 'class-4', name: '8.A', color: '#ef4444' },
  ];
  
  // Currently open folder
  const [openFolder, setOpenFolder] = useState<ContentItem | null>(null);
  
  // View mode for content (grid or list) - used on main page and in folders, persisted in localStorage
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    const saved = localStorage.getItem('vivid-view-mode');
    return (saved === 'list' || saved === 'grid') ? saved : 'grid';
  });

  // Sort order state
  const [sortBy, setSortBy] = useState<'date-created' | 'date-opened' | 'type' | 'alphabetical'>('date-created');
  
  // Persist view mode to localStorage
  useEffect(() => {
    localStorage.setItem('vivid-view-mode', viewMode);
  }, [viewMode]);
  
  // Accordion slideout - which content type card is expanded
  const [expandedCard, setExpandedCard] = useState<string | null>('board');
  
  // Storage details popup
  const [showStorageDetails, setShowStorageDetails] = useState(false);
  
  // Drag over state for file upload zone
  const [isDragOver, setIsDragOver] = useState(false);
  
  // Global drag over state for full-page dropzone
  const [isGlobalDragOver, setIsGlobalDragOver] = useState(false);
  const dragCounterRef = useRef(0);
  
  // File preview state
  const [previewFile, setPreviewFile] = useState<StoredFile | null>(null);
  const [previewFileUrl, setPreviewFileUrl] = useState<string | null>(null);
  
  // Link preview state
  const [previewLink, setPreviewLink] = useState<StoredLink | null>(null);

  // Links state
  const [addLinkModalOpen, setAddLinkModalOpen] = useState(false);
  
  // Inline link input state
  const [linkInputUrl, setLinkInputUrl] = useState('');
  const [linkInputTitle, setLinkInputTitle] = useState('');
  const [linkInputDetectedInfo, setLinkInputDetectedInfo] = useState<LinkInfo | null>(null);
  const [linkInputMetadata, setLinkInputMetadata] = useState<LinkMetadata | null>(null);
  const [linkInputLoading, setLinkInputLoading] = useState(false);
  const [showLinkTitleInput, setShowLinkTitleInput] = useState(false);
  
  // Use Supabase-synced link storage hook
  const { 
    links: myLinks, 
    saveLink: saveLinkToStorage,
    deleteLink: deleteLinkFromStorage,
    updateLink: updateLinkInStorage,
    moveLinkToFolder: moveLinkToFolderStorage,
    loading: linksLoading 
  } = useLinkStorage();
  
  // Helper to add thumbnails to links that don't have them
  const linksWithThumbnails = myLinks.map(link => {
    // YouTube thumbnail
    if (!link.thumbnailUrl && link.linkType === 'youtube' && link.url) {
      const videoId = extractYouTubeVideoId(link.url);
      if (videoId) {
        return { ...link, thumbnailUrl: getYouTubeThumbnail(videoId) };
      }
    }
    // Loom thumbnail
    if (!link.thumbnailUrl && link.linkType === 'loom' && link.url) {
      const loomId = extractLoomVideoId(link.url);
      if (loomId) {
        return { ...link, thumbnailUrl: getLoomThumbnail(loomId) };
      }
    }
    return link;
  });
  
  // Wrapper to set links (for compatibility)
  const setMyLinks = useCallback((updater: StoredLink[] | ((prev: StoredLink[]) => StoredLink[])) => {
    const newLinks = typeof updater === 'function' ? updater(myLinks) : updater;
    // Find new or updated links and save them
    for (const link of newLinks) {
      const existing = myLinks.find(l => l.id === link.id);
      if (!existing || JSON.stringify(existing) !== JSON.stringify(link)) {
        saveLinkToStorage(link);
      }
    }
    // Find deleted links
    for (const existing of myLinks) {
      if (!newLinks.find(l => l.id === existing.id)) {
        deleteLinkFromStorage(existing.id);
      }
    }
  }, [myLinks, saveLinkToStorage, deleteLinkFromStorage]);

  // Multi-select state
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [moveToFolderOpen, setMoveToFolderOpen] = useState(false);
  const [showBulkToolbar, setShowBulkToolbar] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false); // Confirmation dialog for bulk delete
  const bulkToolbarTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Lasso selection state - using screen coordinates for full-page lasso
  const filesContainerRef = useRef<HTMLDivElement>(null);
  const folderContainerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionRect, setSelectionRect] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  const activeContainerRef = useRef<HTMLDivElement | null>(null);
  // Store the start position relative to container for item intersection calculations
  const containerStartPosRef = useRef<{ x: number; y: number } | null>(null);

  // Track if initial load is complete to prevent overwriting localStorage on first render
  const initialLoadCompleteRef = useRef(false);
  
  // Load folders from localStorage
  const [myFolders, setMyFolders] = useState<ContentItem[]>(() => {
    const saved = localStorage.getItem('vivid-my-folders');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        initialLoadCompleteRef.current = true; // Mark as loaded successfully
        return parsed;
      } catch (e) {
        console.error('Failed to parse saved folders', e);
        // Don't set initialLoadComplete - prevent overwriting corrupted data
      }
    }
    initialLoadCompleteRef.current = true; // No data to load, safe to save
    return [];
  });

  // Prevent marking folders as "dirty" when we are applying remote/background sync updates.
  const suppressFolderDirtyRef = useRef(false);

  // Ensure media folder exists on mount
  useEffect(() => {
    const mediaFolder = ensureMediaFolderExists();
    // If media folder was just created, add it to state
    if (mediaFolder && !myFolders.some(f => f.id === mediaFolder.id)) {
      setMyFolders(prev => {
        if (prev.some(f => f.id === mediaFolder.id)) return prev;
        return [mediaFolder, ...prev];
      });
    }
  }, []);

  // Supabase diagnostics snapshot (server truth)
  const [serverSnapshotOpen, setServerSnapshotOpen] = useState(false);
  const [serverSnapshotLoading, setServerSnapshotLoading] = useState(false);
  const [serverSnapshot, setServerSnapshot] = useState<any | null>(null);

  // Load root documents (not in any folder) from localStorage
  const [myDocuments, setMyDocuments] = useState<ContentItem[]>(() => {
    const saved = localStorage.getItem('vivid-my-documents');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved documents', e);
      }
    }
    return [];
  });
  
  const [copiedContent, setCopiedContent] = useState<ContentItem[]>(() => {
    const saved = localStorage.getItem('vivid-my-content-copied');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved content', e);
      }
    }
    return [
    { 
      id: '2', 
      name: 'Základy fyziky', 
      type: 'folder',
      copiedFrom: 'vividbooks',
      children: [
        { id: '3', name: 'Mechanika', type: 'document', copiedFrom: 'vividbooks' },
        { id: '4', name: 'Test - Síly', type: 'board', copiedFrom: 'vividbooks' }
      ]
    }
  ]});

  // Worksheets from storage
  const [worksheets, setWorksheets] = useState<WorksheetListItem[]>([]);
  
  // Quizzes from storage
  const [quizzes, setQuizzes] = useState<QuizListItem[]>([]);
  
  // Computed: quizzes in the currently open folder (uses state, not localStorage)
  const quizzesInCurrentFolder = useMemo(() => {
    if (!openFolder) return [];
    return quizzes.filter(q => q.folderId === openFolder.id);
  }, [quizzes, openFolder]);
  
  // Computed: root quizzes (no folder)
  const rootQuizzes = useMemo(() => {
    return quizzes.filter(q => !q.folderId);
  }, [quizzes]);
  
  // Load worksheets and quizzes on mount and when needed
  // With retry logic in case sync hasn't completed yet
  useEffect(() => {
    // Migrate old quiz storage format
    migrateOldQuizStorage();
    
    const loadData = () => {
      setWorksheets(getWorksheetList());
      setQuizzes(getQuizList());
    };
    
    // Initial load
    loadData();
    
    // Retry after short delays in case sync is still in progress
    const retry1 = setTimeout(() => {
      const currentQuizzes = getQuizList();
      const currentWorksheets = getWorksheetList();
      if (currentQuizzes.length === 0 && currentWorksheets.length === 0) {
        console.log('[MyContentLayout] Data empty, retrying...');
        loadData();
      }
    }, 500);
    
    const retry2 = setTimeout(() => {
      const currentQuizzes = getQuizList();
      const currentWorksheets = getWorksheetList();
      if (currentQuizzes.length === 0 && currentWorksheets.length === 0) {
        console.log('[MyContentLayout] Data still empty, final retry...');
        loadData();
      }
    }, 1500);
    
    return () => {
      clearTimeout(retry1);
      clearTimeout(retry2);
    };
  }, []);

  // Background pull-sync while user is in the library.
  // This is needed so changes from another browser/device show up without manual reload.
  const backgroundSyncInProgressRef = useRef(false);
  useEffect(() => {
    let disposed = false;

    const tick = async () => {
      if (disposed) return;
      if (backgroundSyncInProgressRef.current) return;
      if (document.visibilityState !== 'visible') return;

      backgroundSyncInProgressRef.current = true;
      try {
        const { data } = await supabase.auth.getSession();
        const userId = data.session?.user?.id;
        const token = data.session?.access_token;
        if (!userId || !token) return;

        // Pull the two critical sources for board visibility: quizzes list + folder tree
        await Promise.allSettled([
          syncQuizzesFromSupabase(userId, token),
          syncFoldersFromSupabase(userId, token),
        ]);

        // IMPORTANT: ensure UI refreshes in this tab
        setQuizzes(getQuizList());
        suppressFolderDirtyRef.current = true;
        try {
          const saved = localStorage.getItem('vivid-my-folders');
          if (saved) setMyFolders(JSON.parse(saved));
        } catch {}
        window.setTimeout(() => { suppressFolderDirtyRef.current = false; }, 0);
      } catch (err) {
        console.warn('[MyContentLayout] Background sync failed:', (err as any)?.message);
      } finally {
        backgroundSyncInProgressRef.current = false;
      }
    };

    // Kick once shortly after mount, then poll
    const initialTimeout = window.setTimeout(() => { void tick(); }, 1200);
    const intervalId = window.setInterval(() => { void tick(); }, 15000);

    return () => {
      disposed = true;
      window.clearTimeout(initialTimeout);
      window.clearInterval(intervalId);
    };
  }, []);
  
  // Refresh worksheets and quizzes when returning to this page or when localStorage changes
  useEffect(() => {
    const handleFocus = () => {
      setWorksheets(getWorksheetList());
      setQuizzes(getQuizList());
    };
    
    // Also refresh when visibility changes (tab becomes visible)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setWorksheets(getWorksheetList());
        setQuizzes(getQuizList());
      }
    };
    
    // Listen for localStorage changes (from other tabs or components)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'vividbooks_quizzes' || e.key?.startsWith('vividbooks_quiz_')) {
        setQuizzes(getQuizList());
      }
      if (e.key === 'vivid-my-folders') {
        const saved = localStorage.getItem('vivid-my-folders');
        if (saved) {
          try {
            suppressFolderDirtyRef.current = true;
            setMyFolders(JSON.parse(saved));
            window.setTimeout(() => { suppressFolderDirtyRef.current = false; }, 0);
          } catch (e) {}
        }
      }
    };
    
    // Listen for custom update events (same tab)
    const handleQuizzesUpdated = () => {
      console.log('[MyContentLayout] Quizzes updated event received');
      setQuizzes(getQuizList());
    };
    
    const handleFoldersUpdated = () => {
      console.log('[MyContentLayout] Folders updated event received');
      const saved = localStorage.getItem('vivid-my-folders');
      if (saved) {
        try {
          suppressFolderDirtyRef.current = true;
          setMyFolders(JSON.parse(saved));
          window.setTimeout(() => { suppressFolderDirtyRef.current = false; }, 0);
        } catch (e) {}
      }
    };
    
    const handleDocumentsUpdated = () => {
      console.log('[MyContentLayout] Documents updated event received');
      const saved = localStorage.getItem('vivid-my-documents');
      if (saved) {
        try {
          setMyDocuments(JSON.parse(saved));
        } catch (e) {}
      }
    };
    
    const handleWorksheetsUpdated = () => {
      console.log('[MyContentLayout] Worksheets updated event received');
      setWorksheets(getWorksheetList());
    };
    
    // General content update - refresh everything
    const handleContentUpdated = () => {
      console.log('[MyContentLayout] Content updated event received - refreshing all');
      setQuizzes(getQuizList());
      setWorksheets(getWorksheetList());
      const savedFolders = localStorage.getItem('vivid-my-folders');
      if (savedFolders) {
        try {
          suppressFolderDirtyRef.current = true;
          setMyFolders(JSON.parse(savedFolders));
          window.setTimeout(() => { suppressFolderDirtyRef.current = false; }, 0);
        } catch (e) {}
      }
      const savedDocs = localStorage.getItem('vivid-my-documents');
      if (savedDocs) {
        try { setMyDocuments(JSON.parse(savedDocs)); } catch (e) {}
      }
    };
    
    // Retry loading folders if they're empty (sync might still be in progress)
    const retryFolders = setTimeout(() => {
      const savedFolders = localStorage.getItem('vivid-my-folders');
      if (savedFolders) {
        try {
          const parsed = JSON.parse(savedFolders);
          if (parsed.length > 0) {
            console.log('[MyContentLayout] Folders loaded on retry');
            setMyFolders(parsed);
          }
        } catch (e) {}
      }
    }, 800);
    
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('quizzes-updated', handleQuizzesUpdated);
    // quiz-storage.ts dispatches this event name
    window.addEventListener('quizStorageChange', handleQuizzesUpdated);
    window.addEventListener('folders-updated', handleFoldersUpdated);
    window.addEventListener('documents-updated', handleDocumentsUpdated);
    window.addEventListener('worksheets-updated', handleWorksheetsUpdated);
    window.addEventListener('content-updated', handleContentUpdated);
    
    return () => {
      clearTimeout(retryFolders);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('quizzes-updated', handleQuizzesUpdated);
      window.removeEventListener('quizStorageChange', handleQuizzesUpdated);
      window.removeEventListener('folders-updated', handleFoldersUpdated);
      window.removeEventListener('documents-updated', handleDocumentsUpdated);
      window.removeEventListener('worksheets-updated', handleWorksheetsUpdated);
      window.removeEventListener('content-updated', handleContentUpdated);
    };
  }, []);

  // Save to localStorage whenever copiedContent changes
  useEffect(() => {
    localStorage.setItem('vivid-my-content-copied', JSON.stringify(copiedContent));
  }, [copiedContent]);

  // Save folders to localStorage whenever myFolders changes
  // Skip the first render to prevent overwriting data during initialization
  const isFirstFolderSaveRef = useRef(true);
  useEffect(() => {
    if (isFirstFolderSaveRef.current) {
      isFirstFolderSaveRef.current = false;
      return; // Skip first render
    }
    // Only save if initial load completed successfully
    if (initialLoadCompleteRef.current) {
      localStorage.setItem('vivid-my-folders', JSON.stringify(myFolders));
      // Mark folders as dirty only when change comes from UI (not remote sync apply)
      if (!suppressFolderDirtyRef.current) {
        localStorage.setItem('vivid-folders-dirty', '1');
      }
    }
  }, [myFolders]);

  const handleFetchServerSnapshot = async () => {
    try {
      setServerSnapshotLoading(true);
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user?.id;
      const token = data.session?.access_token;
      if (!userId || !token) {
        toast.error('Nejste přihlášen');
        return;
      }
      const snapshot = await fetchTeacherContentSnapshot(userId, token);
      setServerSnapshot(snapshot);
      setServerSnapshotOpen(true);
      console.log('[SupabaseSnapshot]', snapshot);
      toast.success(`Supabase seznam načten (boards: ${snapshot.boards.length}, docs: ${snapshot.documents.length})`);
    } catch (e: any) {
      console.error('[SupabaseSnapshot] Failed:', e);
      toast.error(`Nepodařilo se načíst seznam ze Supabase: ${e?.message || e}`);
    } finally {
      setServerSnapshotLoading(false);
    }
  };

  // Save documents to localStorage whenever myDocuments changes
  useEffect(() => {
    localStorage.setItem('vivid-my-documents', JSON.stringify(myDocuments));
  }, [myDocuments]);

  // Handle openFolder URL parameter - open folder when navigated from another page
  useEffect(() => {
    const openFolderId = searchParams.get('openFolder');
    if (openFolderId && myFolders.length > 0) {
      const folderToOpen = myFolders.find(f => f.id === openFolderId);
      if (folderToOpen) {
        setOpenFolder(folderToOpen);
        // Clear the URL parameter after opening
        searchParams.delete('openFolder');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [searchParams, myFolders]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Sorting logic helper (UI-only; keep permissive typing because this component mixes many item shapes)
  const sortContent = useCallback((items: any[], itemType: 'folder' | 'worksheet' | 'file' | 'link' | 'mixed') => {
    if (!items) return [];
    
    return [...items].sort((a, b) => {
      // Helper to get name
      const getName = (item: any) => (item?.name || item?.fileName || item?.title || '').toLowerCase();
      
      // Helper to get date
      const getDate = (item: any, dateType: 'created' | 'updated') => {
        let dateVal = 0;
        
        if (dateType === 'updated' && item.updatedAt) {
          dateVal = new Date(item.updatedAt).getTime();
        } else if (item.createdAt) {
          dateVal = new Date(item.createdAt).getTime();
        } else if (item.id) {
          // Try to extract timestamp from ID
          const parts = item.id.split('-');
          if (parts.length > 1 && !isNaN(Number(parts[1]))) {
            dateVal = Number(parts[1]);
          }
        }
        
        return dateVal;
      };
      
      switch (sortBy) {
        case 'alphabetical':
          return getName(a).localeCompare(getName(b), 'cs', { sensitivity: 'base' });
        
        case 'date-created':
          return getDate(b, 'created') - getDate(a, 'created'); // Newest first
          
        case 'date-opened': // Sort by updated/opened
          return getDate(b, 'updated') - getDate(a, 'updated'); // Newest first
          
        case 'type':
          if (itemType === 'file') {
             const typeA = a?.mimeType || '';
             const typeB = b?.mimeType || '';
             return typeA.localeCompare(typeB);
          }
          if (itemType === 'link') {
             const typeA = a?.linkType || '';
             const typeB = b?.linkType || '';
             return typeA.localeCompare(typeB);
          }
          return getName(a).localeCompare(getName(b), 'cs', { sensitivity: 'base' });
          
        default:
          return 0;
      }
    });
  }, [sortBy]);

  const handleCreateFolder = () => {
    setNewFolderName('');
    setCreateFolderOpen(true);
  };

  const handleConfirmCreateFolder = () => {
    if (!newFolderName.trim()) return;
    
    // Pick a random color from the palette
    const randomColor = FOLDER_COLORS[Math.floor(Math.random() * FOLDER_COLORS.length)];
    
    const newFolder: ContentItem = {
      id: `folder-${Date.now()}`,
      name: newFolderName.trim(),
      type: 'folder',
      color: randomColor,
      children: []
    };
    
    // If we're inside a folder, add to that folder's children
    if (openFolder) {
      setMyFolders(prev => prev.map(f => 
        f.id === openFolder.id 
          ? { ...f, children: [...(f.children || []), newFolder] }
          : f
      ));
      // Update the open folder view
      setOpenFolder(prev => prev ? { ...prev, children: [...(prev.children || []), newFolder] } : null);
    } else {
      setMyFolders(prev => [...prev, newFolder]);
    }
    
    setNewFolderName('');
    setCreateFolderOpen(false);
  };

  const handleStartRename = (folder: ContentItem) => {
    setEditingFolder(folder);
    setEditFolderName(folder.name);
    setEditFolderOpen(true);
  };

  const handleStartShare = (folder: ContentItem) => {
    setSharingFolder(folder);
    setShareFolderOpen(true);
  };

  const handleToggleClassShare = (classItem: SharedClass) => {
    if (!sharingFolder) return;
    
    setMyFolders(prev => prev.map(f => {
      if (f.id !== sharingFolder.id) return f;
      
      const currentShared = f.sharedWithClasses || [];
      const isShared = currentShared.some(c => c.id === classItem.id);
      
      const newShared = isShared
        ? currentShared.filter(c => c.id !== classItem.id)
        : [...currentShared, classItem];
      
      return { ...f, sharedWithClasses: newShared };
    }));
    
    // Update sharingFolder state to reflect changes
    setSharingFolder(prev => {
      if (!prev) return prev;
      const currentShared = prev.sharedWithClasses || [];
      const isShared = currentShared.some(c => c.id === classItem.id);
      const newShared = isShared
        ? currentShared.filter(c => c.id !== classItem.id)
        : [...currentShared, classItem];
      return { ...prev, sharedWithClasses: newShared };
    });
  };

  const handleConfirmRename = () => {
    if (!editingFolder || !editFolderName.trim()) return;
    
    setMyFolders(prev => prev.map(f => 
      f.id === editingFolder.id 
        ? { ...f, name: editFolderName.trim() }
        : f
    ));
    setEditingFolder(null);
    setEditFolderName('');
    setEditFolderOpen(false);
  };

  const handleStartDelete = (folder: ContentItem) => {
    // Prevent deletion of system folders
    if (isSystemFolder(folder.id)) {
      toast.error('Tuto složku nelze smazat - je to systémová složka');
      return;
    }
    setDeletingFolder(folder);
    setDeleteFolderOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!deletingFolder) return;
    
    // Double-check system folder protection
    if (isSystemFolder(deletingFolder.id)) {
      toast.error('Tuto složku nelze smazat - je to systémová složka');
      setDeletingFolder(null);
      setDeleteFolderOpen(false);
      return;
    }
    
    // Delete remotely too (prevents reappearing across browsers)
    const deleted = deleteFolderFromStorage(deletingFolder.id);
    if (!deleted) {
      toast.error('Nepodařilo se smazat složku');
      setDeletingFolder(null);
      setDeleteFolderOpen(false);
      return;
    }
    
    setMyFolders(prev => prev.filter(f => f.id !== deletingFolder.id));
    setDeletingFolder(null);
    setDeleteFolderOpen(false);
  };

  const handleCreateWorksheet = () => {
    // Create a new worksheet with a unique ID
    const newWorksheetId = `worksheet-${Date.now()}`;
    // Navigate to worksheet editor - it will create the worksheet automatically
    navigate(`/library/my-content/worksheet-editor/${newWorksheetId}`);
  };
  
  const handleCreateQuiz = () => {
    // Create a new quiz with a unique ID
    const newQuizId = `quiz-${Date.now()}`;
    // Navigate to quiz editor - it will create the quiz automatically
    navigate(`/quiz/edit/${newQuizId}`);
  };
  
  const handleDeleteWorksheet = (id: string) => {
    if (confirm('Opravdu chceš smazat tento pracovní list?')) {
      deleteWorksheetFromStorage(id);
      setWorksheets(getWorksheetList());
    }
  };
  
  const handleDuplicateWorksheet = (id: string) => {
    const duplicated = duplicateWorksheetInStorage(id);
    if (duplicated) {
      setWorksheets(getWorksheetList());
    }
  };

  // Get icon component based on file type
  const getFileIcon = (mimeType: string | null) => {
    if (!mimeType) return File;
    if (mimeType.startsWith('image/')) return Image;
    if (mimeType.startsWith('video/')) return Video;
    if (mimeType.startsWith('audio/')) return Music;
    if (mimeType.includes('pdf')) return FileText;
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return Presentation;
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return Table;
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('archive')) return Archive;
    if (mimeType.includes('word') || mimeType.includes('document')) return FileText;
    return File;
  };

  // Get color for file type
  const getFileColor = (mimeType: string | null): string => {
    if (!mimeType) return '#64748b';
    if (mimeType.startsWith('image/')) return '#10b981';
    if (mimeType.startsWith('video/')) return '#8b5cf6';
    if (mimeType.startsWith('audio/')) return '#f59e0b';
    if (mimeType.includes('pdf')) return '#ef4444';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '#f97316';
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '#22c55e';
    if (mimeType.includes('word') || mimeType.includes('document')) return '#3b82f6';
    return '#64748b';
  };

  // Handle file upload
  const handleFileUpload = async (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;
    
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const result = await uploadFile(file);
      
      if (result.success) {
        toast.success(`Soubor "${file.name}" byl nahrán`);
        // If in folder, move file to that folder
        if (openFolder && result.file) {
          await moveFileToFolder(result.file.id, openFolder.id);
        }
      } else {
        toast.error(result.error || 'Chyba při nahrávání');
      }
    }
  };

  // Handle file delete
  const handleDeleteUploadedFile = async (fileId: string) => {
    const success = await deleteUploadedFile(fileId);
    if (success) {
      toast.success('Soubor byl smazán');
    } else {
      toast.error('Chyba při mazání souboru');
    }
  };

  // Handle file preview
  const handleOpenFilePreview = async (file: StoredFile) => {
    if (canPreviewFile(file.mimeType)) {
      setPreviewFile(file);
      // Get signed URL for preview
      const url = await getDownloadUrl(file.filePath);
      setPreviewFileUrl(url);
    } else {
      // If can't preview, just download
      downloadFile(file);
    }
  };

  const handleCloseFilePreview = () => {
    setPreviewFile(null);
    setPreviewFileUrl(null);
  };

  // Handle creating worksheet from file
  const handleCreateWorksheetFromFile = (file: StoredFile) => {
    // Close preview
    handleCloseFilePreview();
    // Navigate to worksheet editor with file context
    // Store file info in sessionStorage for the editor to pick up
    sessionStorage.setItem('worksheet-source-file', JSON.stringify({
      id: file.id,
      fileName: file.fileName,
      filePath: file.filePath,
      mimeType: file.mimeType
    }));
    navigate('/library/my-content/worksheet-editor/new?source=file');
    toast.success(`Vytvářím pracovní list z "${file.fileName}"`);
  };

  // Handle creating quiz from file
  const handleCreateQuizFromFile = (file: StoredFile) => {
    // Close preview
    handleCloseFilePreview();
    // Navigate to quiz editor with file context
    sessionStorage.setItem('quiz-source-file', JSON.stringify({
      id: file.id,
      fileName: file.fileName,
      filePath: file.filePath,
      mimeType: file.mimeType
    }));
    navigate('/library/my-content/worksheet-editor/new?source=file&type=quiz');
    toast.success(`Vytvářím kvíz z "${file.fileName}"`);
  };

  // Link handlers
  const handleAddLink = (url: string, title: string, linkInfo: LinkInfo, thumbnailUrl?: string) => {
    console.log('[handleAddLink] START - url:', url, 'title:', title, 'thumbnail:', thumbnailUrl);
    
    const userId = localStorage.getItem('vivid-user-id') || 'anonymous';
    const linkId = `link-${Date.now()}`;
    
    const newLink: StoredLink = {
      id: linkId,
      userId,
      url,
      title,
      linkType: linkInfo.type,
      icon: linkInfo.icon,
      color: linkInfo.color,
      bgColor: linkInfo.bgColor,
      domain: linkInfo.domain,
      createdAt: new Date().toISOString(),
      folderId: openFolder?.id || null,
      thumbnailUrl: thumbnailUrl || undefined,
    };
    
    console.log('[handleAddLink] New link:', newLink);
    
    setMyLinks(prev => {
      console.log('[handleAddLink] Previous links count:', prev.length);
      const updated = [newLink, ...prev];
      console.log('[handleAddLink] Updated links count:', updated.length);
      return updated;
    });
    toast.success(`Odkaz "${title}" přidán`);

    // Stahování transcriptu na pozadí pro YouTube videa
    if (linkInfo.type === 'youtube') {
      console.log('[handleAddLink] Starting background transcript extraction for YouTube video');
      toast.info('Stahuji transcript z videa na pozadí...', { duration: 3000 });
      
      // Asynchronní stahování - nečekáme na výsledek
      getYouTubeTranscript(url).then(result => {
        if (result.success && result.transcript) {
          console.log('[handleAddLink] Transcript extracted successfully, length:', result.transcript.length);
          
          // Aktualizujeme link s transkriptem
          setMyLinks(prev => prev.map(link => 
            link.id === linkId 
              ? { ...link, extractedText: result.transcript, description: 'Transcript extrahován' }
              : link
          ));
          toast.success('Transcript z videa byl úspěšně stažen!', { duration: 3000 });
        } else {
          console.log('[handleAddLink] Transcript extraction failed:', result.error);
        }
      }).catch(err => {
        console.error('[handleAddLink] Transcript extraction error:', err);
      });
    }
  };

  // Inline link input handlers
  const handleLinkInputChange = async (url: string) => {
    setLinkInputUrl(url);
    setLinkInputMetadata(null);
    
    // Normalize URL
    let normalizedUrl = url.trim();
    if (normalizedUrl && !normalizedUrl.match(/^https?:\/\//)) {
      normalizedUrl = 'https://' + normalizedUrl;
    }
    
    if (normalizedUrl && normalizedUrl.length > 10) {
      try {
        new URL(normalizedUrl);
        const info = detectLinkType(normalizedUrl);
        setLinkInputDetectedInfo(info);
        
        // For YouTube - generate thumbnail directly (no API needed)
        const youtubeId = extractYouTubeVideoId(normalizedUrl);
        if (youtubeId) {
          const thumbnail = getYouTubeThumbnail(youtubeId);
          console.log('[LinkInput] YouTube detected, thumbnail:', thumbnail);
          setLinkInputMetadata({ title: 'YouTube Video', thumbnailUrl: thumbnail });
          
          // Try to fetch real title
          setLinkInputLoading(true);
          try {
            const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(normalizedUrl)}&format=json`;
            const response = await fetch(oembedUrl);
            if (response.ok) {
              const data = await response.json();
              setLinkInputMetadata({ title: data.title || 'YouTube Video', thumbnailUrl: thumbnail });
              setLinkInputTitle(data.title || 'YouTube Video');
            } else {
              setLinkInputTitle('YouTube Video');
            }
          } catch {
            setLinkInputTitle('YouTube Video');
          }
          setLinkInputLoading(false);
        } 
        // For Loom - generate thumbnail directly (oEmbed may be blocked by CORS)
        else if (normalizedUrl.includes('loom.com')) {
          const loomId = extractLoomVideoId(normalizedUrl);
          if (loomId) {
            // Use static thumbnail URL - Loom provides predictable URLs
            const thumbnail = `https://cdn.loom.com/sessions/thumbnails/${loomId}-with-play.gif`;
            console.log('[LinkInput] Loom detected, loomId:', loomId, 'thumbnail:', thumbnail);
            
            // For Loom, we can't easily get the title due to CORS, so use "Loom Video"
            // The user can edit the title manually
            setLinkInputMetadata({ 
              title: 'Loom Video', 
              thumbnailUrl: thumbnail 
            });
            setLinkInputTitle('Loom Video');
            setLinkInputLoading(false);
          } else {
            setLinkInputTitle(info.name);
            setLinkInputLoading(false);
          }
        } else {
          // Other services - try fetch metadata
          setLinkInputLoading(true);
          const metadata = await fetchLinkMetadata(normalizedUrl);
          setLinkInputLoading(false);
          
          if (metadata) {
            setLinkInputMetadata(metadata);
            setLinkInputTitle(metadata.title);
          } else {
            setLinkInputTitle(info.name !== 'unknown' ? info.name : info.domain);
          }
        }
      } catch {
        setLinkInputDetectedInfo(null);
        setLinkInputLoading(false);
      }
    } else {
      setLinkInputDetectedInfo(null);
    }
  };

  const handleInlineAddLink = () => {
    console.log('[handleInlineAddLink] START');
    console.log('[handleInlineAddLink] URL:', linkInputUrl);
    console.log('[handleInlineAddLink] Title:', linkInputTitle);
    console.log('[handleInlineAddLink] Metadata:', linkInputMetadata);
    
    if (!linkInputUrl.trim()) {
      console.log('[handleInlineAddLink] Empty URL, returning');
      return;
    }
    
    let normalizedUrl = linkInputUrl.trim();
    if (!normalizedUrl.match(/^https?:\/\//)) {
      normalizedUrl = 'https://' + normalizedUrl;
    }
    
    try {
      new URL(normalizedUrl);
    } catch {
      console.log('[handleInlineAddLink] Invalid URL');
      toast.error('Neplatná URL adresa');
      return;
    }
    
    const info = linkInputDetectedInfo || detectLinkType(normalizedUrl);
    const finalTitle = linkInputTitle.trim() || linkInputMetadata?.title || info.name || info.domain;
    
    console.log('[handleInlineAddLink] Calling handleAddLink with:', normalizedUrl, finalTitle, linkInputMetadata?.thumbnailUrl);
    handleAddLink(normalizedUrl, finalTitle, info, linkInputMetadata?.thumbnailUrl);
    
    // Reset inputs
    setLinkInputUrl('');
    setLinkInputTitle('');
    setLinkInputDetectedInfo(null);
    setLinkInputMetadata(null);
    setShowLinkTitleInput(false);
    console.log('[handleInlineAddLink] DONE');
  };

  const handleDeleteLink = async (linkId: string) => {
    console.log('[DeleteLink] Deleting link:', linkId);
    const success = await deleteLinkFromStorage(linkId);
    if (success) {
      toast.success('Odkaz smazán');
    } else {
      toast.error('Chyba při mazání odkazu');
    }
  };

  const handleOpenLink = (link: StoredLink) => {
    // Open preview modal instead of external link
    setPreviewLink(link);
  };

  const handleOpenLinkExternal = (link: StoredLink) => {
    window.open(link.url, '_blank', 'noopener,noreferrer');
  };

  const handleCreateWorksheetFromLink = (link: StoredLink) => {
    setPreviewLink(null);
    sessionStorage.setItem('worksheet-source-link', JSON.stringify({
      id: link.id,
      title: link.title,
      url: link.url,
      linkType: link.linkType,
      transcript: link.extractedText || link.description || null, // Use extracted transcript if available
    }));
    navigate('/library/my-content/worksheet-editor/new?source=link');
    toast.success(`Vytvářím pracovní list z "${link.title}"`);
  };

  const handleCreateQuizFromLink = (link: StoredLink) => {
    setPreviewLink(null);
    sessionStorage.setItem('quiz-source-link', JSON.stringify({
      id: link.id,
      title: link.title,
      url: link.url,
      linkType: link.linkType,
      transcript: link.extractedText || link.description || null, // Use extracted transcript if available
    }));
    navigate('/library/my-content/worksheet-editor/new?source=link&type=quiz');
    toast.success(`Vytvářím kvíz z "${link.title}"`);
  };

  // Get links for current folder or root
  const getLinksInFolder = (folderId: string | null) => {
    console.log('[getLinksInFolder] Looking for folderId:', folderId, 'Total links:', myLinks.length);
    console.log('[getLinksInFolder] All links folderIds:', myLinks.map(l => ({ id: l.id, folderId: l.folderId })));
    
    if (folderId === null) {
      const filtered = myLinks.filter(l => !l.folderId);
      console.log('[getLinksInFolder] Root links:', filtered.length);
      return filtered;
    }
    const filtered = myLinks.filter(l => l.folderId === folderId);
    console.log('[getLinksInFolder] Folder links:', filtered.length);
    return filtered;
  };

  const getRootLinks = () => {
    const links = getLinksInFolder(null);
    console.log('[getRootLinks] Returning:', links.length, 'links');
    return links;
  };

  const handleCreateDocument = () => {
    // Create a new document with a unique ID
    const newDocId = `doc-${Date.now()}`;
    const newDoc: ContentItem = {
      id: newDocId,
      name: 'Nový dokument',
      type: 'document',
    };

    // If a folder is open, add document to that folder
    if (openFolder) {
      setMyFolders(prev => prev.map(folder => {
        if (folder.id === openFolder.id) {
          const updatedFolder = {
            ...folder,
            children: [...(folder.children || []), newDoc]
          };
          setOpenFolder(updatedFolder); // Update the open folder reference
          return updatedFolder;
        }
        return folder;
      }));
    } else {
      // Add to root documents
      setMyDocuments(prev => [...prev, newDoc]);
    }

    // Save document to storage (localStorage + Supabase)
    const docItem: DocumentItem = {
      id: newDocId,
      name: 'Nový dokument',
      type: 'document',
      title: '',
      folderId: openFolder?.id || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    const docContent = {
      id: newDocId,
      title: '',  // Empty title - input will show placeholder
      content: '',  // Empty content - editor will show placeholder
      documentType: 'document',
      featuredMedia: '',
      sectionImages: [],
      slug: newDocId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    // Save to localStorage AND Supabase
    saveDocumentToStorage(docItem, docContent);

    // Navigate to the editor
    navigate(`/library/my-content/edit/${newDocId}`);
  };

  const handleDeleteDocument = (docId: string) => {
    // Remove from root documents (UI update)
    setMyDocuments(prev => prev.filter(doc => doc.id !== docId));
    // Delete from storage (localStorage + Supabase)
    deleteDocumentFromStorage(docId);
  };

  const handleMoveDocumentToFolder = (docId: string, folderId: string) => {
    // Find the document
    const doc = myDocuments.find(d => d.id === docId);
    if (!doc) return;

    // Remove from root documents
    setMyDocuments(prev => prev.filter(d => d.id !== docId));

    // Add to folder
    setMyFolders(prev => prev.map(folder => {
      if (folder.id === folderId) {
        return {
          ...folder,
          children: [...(folder.children || []), doc]
        };
      }
      return folder;
    }));
  };

  const handleMoveItemToFolder = (itemId: string, itemType: string, folderId: string) => {
    console.log('[handleMoveItemToFolder] Moving:', itemType, itemId, 'to folder:', folderId);
    
    // Check if the dragged item is part of selection - if so, move all selected items
    const draggedKey = `${itemType}:${itemId}`;

    if (selectedItems.has(draggedKey) && selectedItems.size > 1) {
      // Move all selected items
      selectedItems.forEach(item => {
        const [type, id] = item.split(':');
        if (type === 'worksheet') {
          moveWorksheetToFolder(id, folderId);
        } else if (type === 'quiz') {
          moveQuizToFolder(id, folderId);
        } else if (type === 'file') {
          moveFileToFolder(id, folderId);
        } else if (type === 'link') {
          // Move link to folder (persist to Supabase)
          moveLinkToFolderStorage(id, folderId);
        } else {
          handleMoveDocumentToFolder(id, folderId);
        }
      });
      setWorksheets(getWorksheetList()); // Refresh list
      setQuizzes(getQuizList()); // Refresh quizzes list
      clearSelection();
    } else {
      // Move single item
      if (itemType === 'worksheet') {
        moveWorksheetToFolder(itemId, folderId);
        setWorksheets(getWorksheetList()); // Refresh list
      } else if (itemType === 'quiz') {
        moveQuizToFolder(itemId, folderId);
        setQuizzes(getQuizList()); // Refresh list
        console.log('[handleMoveItemToFolder] Quiz moved to folder:', folderId);
      } else if (itemType === 'file') {
        moveFileToFolder(itemId, folderId);
      } else if (itemType === 'link') {
        // Move link to folder (persist to Supabase)
        moveLinkToFolderStorage(itemId, folderId);
        console.log('[handleMoveItemToFolder] Link moved to folder:', folderId);
      } else {
        handleMoveDocumentToFolder(itemId, folderId);
      }
    }
  };

  // Multi-select functions
  const handleItemSelect = (itemId: string, itemType: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const key = `${itemType}:${itemId}`;
    
    if (e.shiftKey && lastSelectedId) {
      // Range selection - select all items between last selected and current
      const allItems = [
        ...myDocuments.map(d => `document:${d.id}`),
        ...getRootWorksheets().map(w => `worksheet:${w.id}`)
      ];
      const lastIndex = allItems.indexOf(lastSelectedId);
      const currentIndex = allItems.indexOf(key);
      
      if (lastIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastIndex, currentIndex);
        const end = Math.max(lastIndex, currentIndex);
        const newSelected = new Set(selectedItems);
        for (let i = start; i <= end; i++) {
          newSelected.add(allItems[i]);
        }
        setSelectedItems(newSelected);
      }
    } else if (e.ctrlKey || e.metaKey) {
      // Toggle single item
      const newSelected = new Set(selectedItems);
      if (newSelected.has(key)) {
        newSelected.delete(key);
      } else {
        newSelected.add(key);
      }
      setSelectedItems(newSelected);
      setLastSelectedId(key);
    } else {
      // Single selection - replace selection
      setSelectedItems(new Set([key]));
      setLastSelectedId(key);
    }
  };

  const clearSelection = () => {
    setSelectedItems(new Set());
    setLastSelectedId(null);
    itemRefs.current.clear();
    setShowBulkToolbar(false);
    if (bulkToolbarTimeoutRef.current) {
      clearTimeout(bulkToolbarTimeoutRef.current);
    }
  };

  // Delay showing bulk toolbar to prevent jumping during lasso selection
  useEffect(() => {
    if (selectedItems.size > 0 && !isSelecting) {
      bulkToolbarTimeoutRef.current = setTimeout(() => {
        setShowBulkToolbar(true);
      }, 500);
    } else if (selectedItems.size === 0) {
      setShowBulkToolbar(false);
      if (bulkToolbarTimeoutRef.current) {
        clearTimeout(bulkToolbarTimeoutRef.current);
      }
    }
    
    return () => {
      if (bulkToolbarTimeoutRef.current) {
        clearTimeout(bulkToolbarTimeoutRef.current);
      }
    };
  }, [selectedItems.size, isSelecting]);

  // Lasso selection handlers - using screen coordinates for full-page support
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Check if we clicked on an interactive element (card, button, etc.)
    const target = e.target as HTMLElement;
    const isInteractive = target.closest('[data-selectable-item]') || 
                          target.closest('button') || 
                          target.closest('[role="menuitem"]') ||
                          target.closest('[data-radix-collection-item]');
    
    if (isInteractive) return;
    
    const container = e.currentTarget;
    if (!container) return;
    
    activeContainerRef.current = container;
    
    // Store screen coordinates for the lasso rectangle (fixed positioning)
    const screenX = e.clientX;
    const screenY = e.clientY;
    
    // Also store container-relative position for item intersection
    const rect = container.getBoundingClientRect();
    containerStartPosRef.current = {
      x: e.clientX - rect.left + container.scrollLeft,
      y: e.clientY - rect.top + container.scrollTop
    };
    
    setIsSelecting(true);
    setSelectionRect({ startX: screenX, startY: screenY, endX: screenX, endY: screenY });
    
    // Clear selection if not holding Ctrl/Cmd
    if (!e.ctrlKey && !e.metaKey) {
      setSelectedItems(new Set());
    }
    
    e.preventDefault();
  }, []);

  // Mouse move and up are handled by global window listeners in the useEffect below

  // Register item ref for lasso selection
  const registerItemRef = useCallback((key: string, element: HTMLDivElement | null) => {
    if (element) {
      itemRefs.current.set(key, element);
    } else {
      itemRefs.current.delete(key);
    }
  }, []);

  // Global mouse move and up listeners for lasso selection (works even outside container)
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isSelecting || !selectionRect) return;
      
      // Update lasso rectangle with current screen position
      setSelectionRect(prev => prev ? { ...prev, endX: e.clientX, endY: e.clientY } : null);
    
      // Check which items are in the selection rectangle using screen coordinates
    const selRect = {
        left: Math.min(selectionRect.startX, e.clientX),
        right: Math.max(selectionRect.startX, e.clientX),
        top: Math.min(selectionRect.startY, e.clientY),
        bottom: Math.max(selectionRect.startY, e.clientY),
    };
    
    const newSelected = new Set<string>();
    itemRefs.current.forEach((element, key) => {
        // Use screen coordinates directly (getBoundingClientRect returns screen coords)
      const itemRect = element.getBoundingClientRect();
        
        // Check intersection using screen coordinates
        if (!(itemRect.right < selRect.left || itemRect.left > selRect.right || 
              itemRect.bottom < selRect.top || itemRect.top > selRect.bottom)) {
        newSelected.add(key);
      }
    });
    
    setSelectedItems(newSelected);
    };

    const handleGlobalMouseUp = () => {
      if (isSelecting) {
    setIsSelecting(false);
    setSelectionRect(null);
    activeContainerRef.current = null;
        containerStartPosRef.current = null;
      }
    };

    // Always add listeners when selecting
    if (isSelecting) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      // Prevent text selection during lasso
      document.body.style.userSelect = 'none';
    }
    
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      document.body.style.userSelect = '';
    };
  }, [isSelecting, selectionRect]);

  // Legacy global mouse up listener (backup)
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isSelecting) {
        setIsSelecting(false);
        setSelectionRect(null);
      }
    };
    
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isSelecting]);

  // Global drag & drop for file upload anywhere on the page
  // IMPORTANT: Only intercepts external file drags, not internal item moves
  useEffect(() => {
    const isExternalFileDrag = (e: DragEvent): boolean => {
      // Check if this is a file drag from outside the browser
      // Internal drags have 'text/plain' or custom types, external file drags have 'Files'
      if (!e.dataTransfer) return false;
      
      // If it has Files AND no documentId, it's external
      const hasFiles = e.dataTransfer.types.includes('Files');
      const hasInternalData = e.dataTransfer.types.includes('text/plain') || 
                              e.dataTransfer.types.some(t => t.startsWith('text/'));
      
      // External file drag = has Files but no internal drag data
      return hasFiles && !hasInternalData;
    };

    const handleDragEnter = (e: DragEvent) => {
      // Only handle external file drags
      if (!isExternalFileDrag(e)) return;
      
      e.preventDefault();
      dragCounterRef.current++;
      if (dragCounterRef.current === 1) {
        setIsGlobalDragOver(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      if (!isGlobalDragOver) return;
      
      e.preventDefault();
      dragCounterRef.current--;
      if (dragCounterRef.current === 0) {
        setIsGlobalDragOver(false);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      // Only prevent default for external file drags
      if (!isExternalFileDrag(e)) return;
      
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleDrop = (e: DragEvent) => {
      // Only handle drops when global overlay is shown (external files)
      if (!isGlobalDragOver) return;
      
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsGlobalDragOver(false);
      
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        handleFileUpload(e.dataTransfer.files);
      }
    };

    // Add listeners to document body
    document.body.addEventListener('dragenter', handleDragEnter);
    document.body.addEventListener('dragleave', handleDragLeave);
    document.body.addEventListener('dragover', handleDragOver);
    document.body.addEventListener('drop', handleDrop);

    return () => {
      document.body.removeEventListener('dragenter', handleDragEnter);
      document.body.removeEventListener('dragleave', handleDragLeave);
      document.body.removeEventListener('dragover', handleDragOver);
      document.body.removeEventListener('drop', handleDrop);
    };
  }, [openFolder, isGlobalDragOver]); // Re-attach when folder changes

  const handleBulkMoveToFolder = (folderId: string) => {
    selectedItems.forEach(item => {
      const [type, id] = item.split(':');
      // Directly move items without going through handleMoveItemToFolder to avoid state issues
      if (type === 'worksheet') {
        moveWorksheetToFolder(id, folderId);
      } else if (type === 'quiz') {
        moveQuizToFolder(id, folderId);
        console.log('[handleBulkMoveToFolder] Quiz moved:', id, 'to folder:', folderId);
      } else if (type === 'file') {
        moveFileToFolder(id, folderId);
      } else if (type === 'link') {
        moveLinkToFolderStorage(id, folderId);
      } else if (type === 'document') {
        handleMoveDocumentToFolder(id, folderId);
      }
    });
    // Refresh all lists after moving
    setWorksheets(getWorksheetList());
    setQuizzes(getQuizList());
    clearSelection();
    setMoveToFolderOpen(false);
    toast.success('Položky přesunuty do složky');
  };

  // Show confirmation dialog for bulk delete
  const handleBulkDelete = () => {
    if (selectedItems.size === 0) return;
    setBulkDeleteOpen(true);
  };
  
  // Actually perform bulk delete after confirmation
  const confirmBulkDelete = async () => {
    console.log('[confirmBulkDelete] START - selected items:', Array.from(selectedItems));
    
    const deletePromises: Promise<any>[] = [];
    const foldersToRemove: string[] = [];
    
    selectedItems.forEach(item => {
      const [type, id] = item.split(':');
      console.log('[confirmBulkDelete] Deleting:', type, id);
      
      if (type === 'document') {
        handleDeleteDocument(id);
      } else if (type === 'worksheet') {
        // Delete worksheet without individual confirm dialog
        deleteWorksheetFromStorage(id);
      } else if (type === 'quiz') {
        deleteQuizFromStorage(id);
        console.log('[confirmBulkDelete] Quiz deleted:', id);
      } else if (type === 'folder') {
        deleteFolderFromStorage(id);
        foldersToRemove.push(id);
      } else if (type === 'file') {
        // Async file delete
        deletePromises.push(deleteUploadedFile(id));
      } else if (type === 'link') {
        console.log('[confirmBulkDelete] Deleting link:', id);
        // Use the storage function for proper Supabase sync
        deletePromises.push(deleteLinkFromStorage(id));
      }
    });
    
    // Wait for all async deletes to complete
    if (deletePromises.length > 0) {
      await Promise.all(deletePromises);
    }
    
    // Refresh lists
    setWorksheets(getWorksheetList());
    setQuizzes(getQuizList());

    if (foldersToRemove.length > 0) {
      const removeFromTree = (items: ContentItem[]): ContentItem[] => {
        return items
          .filter(it => !foldersToRemove.includes(it.id))
          .map(it => (it.children ? { ...it, children: removeFromTree(it.children) } : it));
      };
      setMyFolders(prev => removeFromTree(prev));
      setOpenFolder(prev => (prev && foldersToRemove.includes(prev.id) ? null : prev));
    }
    
    clearSelection();
    setBulkDeleteOpen(false);
    toast.success(`${selectedItems.size} ${selectedItems.size === 1 ? 'položka smazána' : 'položek smazáno'}`);
    console.log('[confirmBulkDelete] DONE');
  };

  const handleCreateBoard = () => {
    // Create new board/quiz and save to localStorage before navigating
    const newBoardId = `board-${Date.now()}`;
    const newQuiz = createEmptyQuiz();
    newQuiz.id = newBoardId;
    newQuiz.title = 'Nový Vividboard';
    newQuiz.folderId = currentFolderId || undefined;
    saveQuiz(newQuiz);
    navigate(`/quiz/edit/${newBoardId}`);
  };

  return (
    <div className="min-h-screen bg-background transition-colors duration-300 relative">
      {/* Global Drop Zone Overlay */}
      {isGlobalDragOver && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
          style={{ backgroundColor: 'rgba(78, 88, 113, 0.85)' }}
        >
          <div className="flex flex-col items-center gap-4 animate-in zoom-in-95 duration-200">
            <div className="w-20 h-20 rounded-2xl bg-white/20 flex items-center justify-center">
              <Upload className="h-10 w-10 text-white" />
            </div>
            <div className="text-center">
              <h3 className="text-2xl font-bold text-white mb-1">
                Pusťte soubory zde
              </h3>
              <p className="text-white/70 text-sm">
                {openFolder ? `Nahrát do "${openFolder.name}"` : 'PDF, PPTX, DOCX, obrázky'}
              </p>
            </div>
          </div>
        </div>
      )}
      
      <div className="flex">
        {/* Left Sidebar - Navigation */}
        <aside 
          className={`
            /* Base layout properties */
            top-0 h-screen shrink-0 bg-[#4E5871] flex flex-col 
            transition-all duration-300 ease-in-out
            
            /* Mobile styles (default) */
            fixed left-0 z-30 w-[294px]
            ${sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
            
            /* Desktop styles (lg breakpoint) */
            lg:sticky lg:translate-x-0 lg:shadow-none
            ${!sidebarVisible 
              ? 'lg:w-0 lg:overflow-hidden lg:border-r-0' 
              : 'lg:w-[312px]'
            }
          `}
        >
          {/* Inner wrapper to maintain width during collapse transition */}
          <div className="w-[294px] lg:w-[312px] h-full flex flex-col min-w-[294px] lg:min-w-[312px]">
            {/* Header with logo and mobile menu button */}
            <div className="p-4">
              {toolsOpen ? (
                <div className="flex items-center justify-between min-h-[40px] animate-in fade-in duration-200">
                   <span className="text-white/90 font-bold text-[12px] uppercase tracking-wider pl-1">
                     Naše produkty
                   </span>
                   <button
                      onClick={() => setToolsOpen(false)}
                      className="p-1.5 rounded-md hover:bg-white/10 transition-colors text-white/90"
                   >
                      <X className="h-5 w-5" />
                   </button>
                </div>
              ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <div 
                    className="flex items-center min-h-[40px]"
                    onMouseEnter={() => setLogoHovered(true)}
                    onMouseLeave={() => setLogoHovered(false)}
                  >
                    <Link to="/docs/knihovna-vividbooks/introduction" className="flex items-center">
                      <div className="w-20 h-10 text-white">
                        <VividLogo />
                      </div>
                    </Link>
                  </div>
                  <ToolsDropdown isOpen={toolsOpen} onToggle={() => setToolsOpen(!toolsOpen)} label="Můj obsah" variant="yellow" />
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="lg:hidden p-1.5 rounded-md transition-colors text-white/70 hover:text-white hover:bg-white/10"
                  >
                    <X className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setSidebarVisible(false)}
                    className="hidden lg:block p-1.5 rounded-md transition-colors text-white/70 hover:text-white hover:bg-white/10"
                    title="Skrýt menu"
                  >
                    <PanelLeftClose className="h-[23px] w-[23px]" />
                  </button>
                </div>
              </div>
              )}
            </div>

            {/* Navigation Menu OR Tools Menu */}
            <div className="flex-1 overflow-hidden text-white flex flex-col">
              {toolsOpen ? (
                <ToolsMenu 
                  activeItem="my-content"
                  onItemClick={() => {
                    setToolsOpen(false);
                    setSidebarOpen(false);
                  }} 
                />
              ) : (
                <div className="flex-1 overflow-y-auto px-4 pb-4">
                  <div className="space-y-8">
                    {/* My Folders Section in Sidebar (user-created only) */}
                    <div>
                      <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-3 px-2 flex items-center gap-2">
                        <Folder className="h-3 w-3" />
                        Moje složky
                      </h3>
                      <div className="space-y-1">
                        {myFolders.filter(f => f.copiedFrom !== 'vividbooks-category' && f.type === 'folder').map(folder => {
                          const isMediaFolder = folder.id === MEDIA_FOLDER_ID || folder.isSystemFolder;
                          const sidebarColor = isMediaFolder ? '#e2e8f0' : (folder.color || '#bbf7d0');
                          const sidebarDisplayName = folder.id === MEDIA_FOLDER_ID ? MEDIA_FOLDER_NAME : folder.name;
                          return (
                          <button
                            key={folder.id}
                            onClick={() => setOpenFolder(folder)}
                            className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm font-medium text-white/90"
                          >
                            <Folder 
                              className="w-4 h-4 flex-shrink-0"
                              style={{ color: sidebarColor, fill: sidebarColor }}
                            />
                            <span className="truncate">{sidebarDisplayName}</span>
                          </button>
                        );})}
                        <button
                           onClick={handleCreateFolder}
                           className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm font-medium text-white/50 hover:text-white"
                        >
                          <Plus className="h-4 w-4" />
                          <span>Nová složka</span>
                        </button>
                      </div>
                    </div>

                    {/* Copied from VividBooks Section in Sidebar */}
                    {myFolders.filter(f => f.copiedFrom === 'vividbooks-category').length > 0 && (
                      <div>
                        <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-3 px-2 flex items-center gap-2">
                          <Copy className="h-3 w-3" />
                          Zkopírováno z VividBooks
                        </h3>
                        <div className="space-y-1">
                          {myFolders.filter(f => f.copiedFrom === 'vividbooks-category').map(folder => (
                              <button
                              key={folder.id}
                              onClick={() => setOpenFolder(folder)}
                                className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm font-medium text-white/90"
                              >
                              <Folder 
                                className="w-4 h-4 flex-shrink-0"
                                style={{ color: folder.color || '#bbf7d0', fill: folder.color || '#bbf7d0' }}
                              />
                              <span className="truncate">{folder.name}</span>
                                    </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 z-20 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0 transition-all duration-300">
           {/* Mobile sidebar toggle */}
               <button
                 onClick={() => setSidebarOpen(!sidebarOpen)}
             className="lg:hidden fixed top-4 left-4 z-30 p-3 rounded-full bg-white shadow-lg border border-slate-200 hover:shadow-xl transition-all"
                 style={{ color: '#4E5871' }}
               >
                 <Menu className="h-5 w-5" />
               </button>

           {/* Desktop sidebar toggle - shows when sidebar is hidden */}
               {!sidebarVisible && (
                   <button
                     onClick={() => setSidebarVisible(true)}
               className="hidden lg:flex fixed top-6 left-6 z-30 p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-all items-center gap-2"
               title="Otevřít menu"
                   >
               <PanelLeft className="h-5 w-5 text-[#4E5871]" />
               <span className="text-sm text-[#4E5871] font-medium">Menu</span>
                   </button>
           )}

           {/* Page Content */}
           <div className="max-w-6xl mx-auto px-4 py-8 lg:px-8">
            
            {/* Folder View - when a folder is open */}
            {openFolder ? (
              <>
                {/* Folder Header */}
                <div className="mb-8 mt-6">
                  <button
                    onClick={() => { clearSelection(); setOpenFolder(null); }}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-[#4E5871] mb-3 transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Zpět na přehled
                  </button>
                  <div className="flex items-center justify-between">
                    <h1 className="text-2xl md:text-3xl font-bold text-[#4E5871] flex items-center gap-3">
                      <Folder 
                        className="w-8 h-8" 
                        style={{ color: openFolder.color || '#bbf7d0', fill: openFolder.color || '#bbf7d0' }}
                      />
                      {openFolder.name}
                    </h1>
                    
                    {/* Actions row: Add folder, Add content dropdown, View toggle */}
                    <div className="flex items-center gap-2">
                      {/* Add folder button */}
                 <Button
                   variant="outline"
                        className="gap-2"
                        onClick={handleCreateFolder}
                 >
                   <FolderPlus className="h-4 w-4" />
                   Nová složka
                 </Button>
                      
                      {/* Quick Add dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                            <Plus className="h-4 w-4" />
                            Přidat obsah
                            <ChevronDown className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-72 p-2 z-50">
                          <div className="grid grid-cols-2 gap-2">
                            {/* Board */}
                            <button
                              onClick={() => handleCreateBoard()}
                   disabled={!ecosystemAccess.canCreateContent}
                              className="flex flex-col items-center gap-2 p-3 rounded-xl transition-all hover:shadow-md disabled:opacity-50"
                              style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe' }}
                 >
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#3b82f6' }}>
                                <LayoutGrid className="h-4 w-4 text-white" />
                              </div>
                              <span className="text-xs font-medium text-blue-700">Board</span>
                            </button>
                            
                            {/* Dokument */}
                            <button
                              onClick={() => handleCreateDocument()}
                   disabled={!ecosystemAccess.canCreateContent}
                              className="flex flex-col items-center gap-2 p-3 rounded-xl transition-all hover:shadow-md disabled:opacity-50"
                              style={{ backgroundColor: '#f3e8ff', border: '1px solid #d8b4fe' }}
                            >
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#a855f7' }}>
                                <FileText className="h-4 w-4 text-white" />
                              </div>
                              <span className="text-xs font-medium text-purple-700">Dokument</span>
                            </button>
                            
                            {/* Pracovní list */}
                            <button
                              onClick={() => handleCreateWorksheet()}
                              disabled={!ecosystemAccess.canCreateContent}
                              className="flex flex-col items-center gap-2 p-3 rounded-xl transition-all hover:shadow-md disabled:opacity-50"
                              style={{ backgroundColor: '#fef3c7', border: '1px solid #fcd34d' }}
                            >
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#f59e0b' }}>
                                <FileEdit className="h-4 w-4 text-white" />
                              </div>
                              <span className="text-xs font-medium text-amber-700">List</span>
                            </button>
                            
                            {/* Nástěnka */}
                            <button
                              onClick={() => navigate('/my-content/canvas/new')}
                              disabled={!ecosystemAccess.canCreateContent}
                              className="flex flex-col items-center gap-2 p-3 rounded-xl transition-all hover:shadow-md disabled:opacity-50"
                              style={{ backgroundColor: '#d1fae5', border: '1px solid #6ee7b7' }}
                 >
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#10b981' }}>
                                <LayoutGrid className="h-4 w-4 text-white" />
                              </div>
                              <span className="text-xs font-medium text-emerald-700">Nástěnka</span>
                            </button>
                            
                            {/* Soubor */}
                            <button
                   onClick={() => fileInputRef.current?.click()}
                              className="flex flex-col items-center gap-2 p-3 rounded-xl transition-all hover:shadow-md"
                              style={{ backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1' }}
                            >
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#64748b' }}>
                                <Upload className="h-4 w-4 text-white" />
               </div>
                              <span className="text-xs font-medium text-slate-600">Soubor</span>
                            </button>
                            
                            {/* Odkaz */}
                            <button
                              onClick={() => setAddLinkModalOpen(true)}
                              className="flex flex-col items-center gap-2 p-3 rounded-xl transition-all hover:shadow-md"
                              style={{ backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1' }}
                            >
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#64748b' }}>
                                <Link2 className="h-4 w-4 text-white" />
                  </div>
                              <span className="text-xs font-medium text-slate-600">Odkaz</span>
                            </button>
                          </div>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {/* Sort dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors mr-2">
                            <ArrowUpDown className="h-4 w-4" />
                            <span className="hidden sm:inline">Řadit</span>
                            <ChevronDown className="h-3 w-3 opacity-50" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => setSortBy('date-created')} className={sortBy === 'date-created' ? 'bg-slate-100' : ''}>
                            Datum vytvoření
                            {sortBy === 'date-created' && <Check className="ml-auto h-4 w-4" />}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setSortBy('date-opened')} className={sortBy === 'date-opened' ? 'bg-slate-100' : ''}>
                            Datum otevření
                            {sortBy === 'date-opened' && <Check className="ml-auto h-4 w-4" />}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setSortBy('type')} className={sortBy === 'type' ? 'bg-slate-100' : ''}>
                            Typu
                            {sortBy === 'type' && <Check className="ml-auto h-4 w-4" />}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setSortBy('alphabetical')} className={sortBy === 'alphabetical' ? 'bg-slate-100' : ''}>
                            Abecedně
                            {sortBy === 'alphabetical' && <Check className="ml-auto h-4 w-4" />}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      
                      {/* View mode toggle */}
                      <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                        <button
                          onClick={() => setViewMode('grid')}
                          className={`p-2 rounded-md transition-all ${
                            viewMode === 'grid' 
                              ? 'bg-white shadow-sm text-slate-700' 
                              : 'text-slate-400 hover:text-slate-600'
                          }`}
                          title="Zobrazit jako ikony"
                        >
                          <Grid3X3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setViewMode('list')}
                          className={`p-2 rounded-md transition-all ${
                            viewMode === 'list' 
                              ? 'bg-white shadow-sm text-slate-700' 
                              : 'text-slate-400 hover:text-slate-600'
                          }`}
                          title="Zobrazit jako seznam"
                        >
                          <List className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <p className="text-muted-foreground mt-1">
                    {(openFolder.children?.length || 0) + getWorksheetsInFolder(openFolder.id).length + getFilesInFolder(openFolder.id).length + getLinksInFolder(openFolder.id).length} položek
                  </p>
             </div>

                {/* Bulk Actions Toolbar for Folder View - Fixed at top */}
                {showBulkToolbar && selectedItems.size > 0 && (
                  <div className="fixed top-0 left-0 right-0 z-50 p-4 bg-blue-50 border-b border-blue-200 shadow-lg flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckSquare className="h-5 w-5 text-blue-500" />
                      <span className="font-medium text-blue-700">
                        Vybráno: {selectedItems.size} {selectedItems.size === 1 ? 'položka' : selectedItems.size < 5 ? 'položky' : 'položek'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => setMoveToFolderOpen(true)}
                        variant="outline"
                        size="sm"
                        className="gap-2"
                      >
                        <FolderInput className="h-4 w-4" />
                        Přesunout do složky
                      </Button>
                      <Button
                        onClick={handleBulkDelete}
                        variant="outline"
                        size="sm"
                        className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        Smazat
                      </Button>
                      <Button
                        onClick={clearSelection}
                        variant="ghost"
                        size="sm"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Folder Content with Lasso Selection */}
                <div 
                  ref={folderContainerRef}
                  className="relative select-none -mx-4 lg:-mx-8 px-4 lg:px-8"
                  onMouseDown={handleMouseDown}
                  style={{ minHeight: 'calc(100vh - 250px)', paddingTop: '20px', paddingBottom: '20px' }}
                >
                  {/* Selection Rectangle */}
                  {(((openFolder.children || []).length > 0) || getWorksheetsInFolder(openFolder.id).length > 0 || getFilesInFolder(openFolder.id).length > 0 || getLinksInFolder(openFolder.id).length > 0) ? (
                    viewMode === 'grid' ? (
                    <div className="flex flex-wrap gap-8">
                      {/* Subfolders */}
                      {sortContent((openFolder.children || []).filter(c => c.type === 'folder'), 'folder').map((subfolder) => (
                        <FolderCard 
                          key={subfolder.id}
                          item={subfolder}
                          onClick={() => {
                            // Navigate into subfolder
                            setOpenFolder(subfolder);
                          }}
                          onMenuClick={(action) => {
                            if (action === 'rename') handleStartRename(subfolder);
                            if (action === 'delete') {
                              // Delete remotely too (prevents reappearing across browsers)
                              deleteFolderFromStorage(subfolder.id);
                              // Delete subfolder from parent
                              setMyFolders(prev => prev.map(f => 
                                f.id === openFolder.id 
                                  ? { ...f, children: f.children?.filter(c => c.id !== subfolder.id) }
                                  : f
                              ));
                              setOpenFolder(prev => prev ? { ...prev, children: prev.children?.filter(c => c.id !== subfolder.id) } : null);
                            }
                          }}
                          onDrop={(docId) => {
                            // Move document into subfolder
                            const doc = (openFolder.children || []).find(c => c.id === docId);
                            if (doc) {
                              setMyFolders(prev => prev.map(f => 
                                f.id === openFolder.id 
                                  ? { 
                                      ...f, 
                                      children: f.children?.map(c => 
                                        c.id === subfolder.id 
                                          ? { ...c, children: [...(c.children || []), doc] }
                                          : c
                                      ).filter(c => c.id !== docId)
                                    }
                                  : f
                              ));
                              setOpenFolder(prev => prev ? { 
                                ...prev, 
                                children: prev.children?.map(c => 
                                  c.id === subfolder.id 
                                    ? { ...c, children: [...(c.children || []), doc] }
                                    : c
                                ).filter(c => c.id !== docId)
                              } : null);
                            }
                          }}
                        />
                      ))}
                      
                      {/* Documents with preview */}
                      {(openFolder.children || []).filter(c => c.type === 'document' || c.type === 'board').map((child) => {
                        // For boards, load from quiz storage; for documents, load from vivid-doc
                        let displayName = child.name || 'Nový dokument';
                        let contentPreview = '';
                        let isEmpty = true;
                        
                        if (child.type === 'board') {
                          // Load board data from quiz storage
                          const quizDataStr = localStorage.getItem(`vividbooks_quiz_${child.id}`);
                          const quizData = quizDataStr ? JSON.parse(quizDataStr) : null;
                          displayName = quizData?.title || child.name || 'Board';
                          const slideCount = quizData?.slides?.length || 0;
                          contentPreview = slideCount > 0 ? `${slideCount} slidů` : '';
                          isEmpty = slideCount === 0;
                        } else {
                          // Load document data
                          const docDataStr = localStorage.getItem(`vivid-doc-${child.id}`);
                          const docData = docDataStr ? JSON.parse(docDataStr) : null;
                          displayName = docData?.title || child.name || 'Nový dokument';
                          contentPreview = docData?.content || '';
                          isEmpty = !contentPreview || contentPreview === '<p></p>';
                        }
                        
                        const isSelected = selectedItems.has(`document:${child.id}`);
                        const isBoard = child.type === 'board';
                        
                        return (
                          <div 
                            key={child.id}
                            ref={(el) => registerItemRef(`document:${child.id}`, el)}
                            data-selectable-item
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('documentId', child.id);
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (e.ctrlKey || e.metaKey || e.shiftKey || selectedItems.size > 0) {
                                handleItemSelect(child.id, 'document', e);
                              } else {
                                setSidebarVisible(false);
                                // Navigate to quiz editor for boards, document view for documents
                                if (isBoard) {
                                  navigate(`/quiz/edit/${child.id}`);
                                } else {
                                  navigate(`/library/my-content/view/${child.id}`);
                                }
                              }
                            }}
                            className="flex flex-col items-center group cursor-pointer"
                            style={{ width: '126px' }}
                          >
                            {/* Document Preview Card */}
                            <div className={`relative w-full bg-white rounded-lg border shadow-sm overflow-hidden group-hover:shadow-lg transition-all ${
                              isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-200 group-hover:border-blue-400'
                            }`}
                                 style={{ aspectRatio: '3/4' }}>
                              
                              {/* Selection checkbox */}
                              <button
                                onClick={(e) => { e.stopPropagation(); handleItemSelect(child.id, 'document', e); }}
                                className={`absolute top-2 right-2 z-20 p-1 rounded transition-all ${
                                  isSelected || selectedItems.size > 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                                }`}
                              >
                                {isSelected ? (
                                  <CheckSquare className="h-5 w-5 text-blue-500" />
                                ) : (
                                  <Square className="h-5 w-5 text-slate-400 hover:text-blue-500" />
                                )}
                              </button>
                              
                              {/* Sync status badge */}
                              <SyncStatusBadge id={child.id} type={isBoard ? 'quiz' : 'document'} left="8px" />
                              
                              {/* Scaled content preview */}
                              <div 
                                className="absolute overflow-hidden pointer-events-none"
                                style={{ 
                                  width: '378px',
                                  height: '504px',
                                  transform: 'scale(0.333)',
                                  transformOrigin: 'top left',
                                  padding: '16px',
                                  fontSize: '13px',
                                  lineHeight: '1.5',
                                  color: '#1f2937'
                                }}
                              >
                                <h1 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '12px', color: '#1e1b4b' }}>
                                  {displayName}
                                </h1>
                                {isBoard ? (
                                  <div className="flex flex-col items-center justify-center h-full" style={{ marginTop: '40px' }}>
                                    <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                                      <Play className="h-8 w-8 text-emerald-600" />
                                    </div>
                                    <p style={{ color: '#059669', fontWeight: '500' }}>VividBoard</p>
                                    {!isEmpty && <p style={{ color: '#9ca3af', fontSize: '12px' }}>{contentPreview}</p>}
                                  </div>
                                ) : isEmpty ? (
                                  <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>Začněte psát...</p>
                                ) : (
                                  <div 
                                    className="prose prose-sm"
                                    dangerouslySetInnerHTML={{ __html: contentPreview }}
                                  />
                                )}
                         </div>
                              
                              {/* Bottom gradient fade */}
                              <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white via-white/80 to-transparent" />
                              
                              {/* Menu button */}
                         <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                  <button className="absolute top-1 right-1 p-1 rounded-md bg-white/90 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white border border-slate-200">
                                    <MoreVertical className="h-3.5 w-3.5 text-slate-500" />
                             </button>
                           </DropdownMenuTrigger>
                           <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={(e) => { 
                                    e.stopPropagation(); 
                                    if (isBoard) {
                                      navigate(`/quiz/edit/${child.id}`);
                                    } else {
                                      navigate(`/library/my-content/edit/${child.id}`);
                                    }
                                  }}>
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Upravit
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={(e) => { 
                                      e.stopPropagation(); 
                                      // Delete from folder
                                      setMyFolders(prev => prev.map(f => 
                                        f.id === openFolder.id 
                                          ? { ...f, children: f.children?.filter(c => c.id !== child.id) }
                                          : f
                                      ));
                                      setOpenFolder(prev => prev ? { ...prev, children: prev.children?.filter(c => c.id !== child.id) } : null);
                                      // Delete data - for boards delete from quiz storage, for docs delete from vivid-doc
                                      if (isBoard) {
                                        localStorage.removeItem(`vividbooks_quiz_${child.id}`);
                                      } else {
                                        localStorage.removeItem(`vivid-doc-${child.id}`);
                                      }
                                    }}
                                    className="text-red-600"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Smazat
                                  </DropdownMenuItem>
                           </DropdownMenuContent>
                         </DropdownMenu>
                       </div>
                            
                            {/* Document/Board name */}
                            <div className="w-full mt-3 flex items-center justify-center gap-1.5">
                              {isBoard ? (
                                <Play className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                              ) : (
                                <FileText className="h-4 w-4 text-purple-500 flex-shrink-0" />
                              )}
                              <h3 className="text-sm font-medium text-[#4E5871] truncate">{displayName}</h3>
                            </div>
                     </div>
                        );
                      })}
                      
                      {/* Worksheets in this folder */}
                      {sortContent(getWorksheetsInFolder(openFolder.id), 'worksheet').map((ws) => (
                        <WorksheetPreviewCard
                          key={ws.id}
                          ref={(el) => registerItemRef(`worksheet:${ws.id}`, el)}
                          worksheet={ws}
                          onClick={() => navigate(`/library/my-content/worksheet-editor/${ws.id}`)}
                          onMenuClick={(action) => {
                            if (action === 'edit') navigate(`/library/my-content/worksheet-editor/${ws.id}`);
                            if (action === 'duplicate') {
                              handleDuplicateWorksheet(ws.id);
                            }
                            if (action === 'delete') {
                              handleDeleteWorksheet(ws.id);
                            }
                          }}
                          onDragStart={(e) => {
                            e.dataTransfer.setData('documentId', ws.id);
                            e.dataTransfer.setData('itemType', 'worksheet');
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          isSelected={selectedItems.has(`worksheet:${ws.id}`)}
                          onSelect={(e) => handleItemSelect(ws.id, 'worksheet', e)}
                          showSelection={selectedItems.size > 0}
                        />
                      ))}

                      {/* Quizzes/Boards in this folder */}
                      {sortContent(quizzesInCurrentFolder, 'worksheet').map((quiz) => (
                        <QuizPreviewCard
                          key={quiz.id}
                          ref={(el) => registerItemRef(`quiz:${quiz.id}`, el)}
                          quiz={quiz}
                          onClick={() => navigate(`/quiz/view/${quiz.id}`)}
                          onMenuClick={(action) => {
                            if (action === 'edit') navigate(`/quiz/edit/${quiz.id}`);
                            if (action === 'duplicate') {
                              const duplicated = duplicateQuizInStorage(quiz.id);
                              if (duplicated) {
                                setQuizzes(getQuizList());
                                toast.success('Board byl duplikován');
                              }
                            }
                            if (action === 'move') {
                              setSelectedItems(new Set([`quiz:${quiz.id}`]));
                              setMoveToFolderOpen(true);
                            }
                            if (action === 'delete') {
                              deleteQuizFromStorage(quiz.id);
                              setQuizzes(getQuizList());
                              toast.success('Board byl smazán');
                            }
                            if (action === 'sync') {
                              toast.promise(
                                manualSyncQuizToSupabase(quiz.id),
                                {
                                  loading: 'Nahrávám do cloudu...',
                                  success: (result) => {
                                    if (result) {
                                      setQuizzes(getQuizList());
                                      return 'Board byl nahrán do cloudu';
                                    }
                                    throw new Error('Sync failed');
                                  },
                                  error: 'Nepodařilo se nahrát do cloudu',
                                }
                              );
                            }
                          }}
                          onDragStart={(e) => {
                            e.dataTransfer.setData('documentId', quiz.id);
                            e.dataTransfer.setData('itemType', 'quiz');
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          isSelected={selectedItems.has(`quiz:${quiz.id}`)}
                          onSelect={(e) => handleItemSelect(quiz.id, 'quiz', e)}
                          showSelection={selectedItems.size > 0}
                        />
                      ))}

                      {/* Uploaded Files in this folder */}
                      {sortContent(getFilesInFolder(openFolder.id), 'file').map((file) => {
                        const FileIcon = getFileIcon(file.mimeType);
                        const fileColor = getFileColor(file.mimeType);
                        const typeInfo = getFileTypeInfo(file.mimeType || '');
                        const isSelected = selectedItems.has(`file:${file.id}`);

                        return (
                          <div
                            key={file.id}
                            ref={(el) => registerItemRef(`file:${file.id}`, el)}
                            data-selectable-item
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('documentId', file.id);
                              e.dataTransfer.setData('itemType', 'file');
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (e.ctrlKey || e.metaKey || e.shiftKey || selectedItems.size > 0) {
                                handleItemSelect(file.id, 'file', e);
                              } else {
                                handleOpenFilePreview(file);
                              }
                            }}
                            className="flex flex-col items-center group cursor-pointer"
                            style={{ width: '126px' }}
                          >
                            {/* File Preview Card */}
                            <div className={`relative w-full bg-white rounded-lg border shadow-sm overflow-hidden group-hover:shadow-lg transition-all ${
                              isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-200 group-hover:border-blue-400'
                            }`}
                                 style={{ aspectRatio: '3/4' }}>
                              
                              {/* Selection checkbox */}
                              <button
                                onClick={(e) => { e.stopPropagation(); handleItemSelect(file.id, 'file', e); }}
                                className={`absolute top-2 right-2 z-20 p-1 rounded transition-all ${
                                  isSelected || selectedItems.size > 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                                }`}
                              >
                                {isSelected ? (
                                  <CheckSquare className="h-5 w-5 text-blue-500" />
                                ) : (
                                  <Square className="h-5 w-5 text-slate-400 hover:text-blue-500" />
                                )}
                              </button>
                              
                              {/* Type Badge */}
                              <div 
                                className="absolute top-2 left-2 z-10 text-[10px] font-semibold px-1.5 py-0.5 rounded"
                                style={{ backgroundColor: `${fileColor}20`, color: fileColor }}
                              >
                                {typeInfo.label}
                              </div>
                              
                              {/* Sync status badge */}
                              <SyncStatusBadge id={file.id} type="file" left="50px" />
                              
                              {/* File Preview - Image thumbnail or Icon */}
                              {file.mimeType?.startsWith('image/') ? (
                                <div className="absolute inset-0">
                                  <img 
                                    src={file.filePath} 
                                    alt={file.fileName}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                    onError={(e) => {
                                      // Fallback to icon if image fails to load
                                      const target = e.target as HTMLImageElement;
                                      target.style.display = 'none';
                                      target.nextElementSibling?.classList.remove('hidden');
                                    }}
                                  />
                                  <div className="hidden absolute inset-0 flex items-center justify-center">
                                    <div 
                                      className="w-16 h-16 rounded-xl flex items-center justify-center"
                                      style={{ backgroundColor: `${fileColor}15` }}
                                    >
                                      <FileIcon className="h-8 w-8" style={{ color: fileColor }} />
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div 
                                    className="w-16 h-16 rounded-xl flex items-center justify-center"
                                    style={{ backgroundColor: `${fileColor}15` }}
                                  >
                                    <FileIcon className="h-8 w-8" style={{ color: fileColor }} />
                                  </div>
                                </div>
                              )}
                              
                              {/* File Size */}
                              <div className="absolute bottom-2 left-2 right-2 text-center">
                                <span className="text-xs text-slate-400">{formatFileSize(file.fileSize)}</span>
                              </div>
                              
                              {/* Menu button */}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                  <button className="absolute top-1 right-1 p-1 rounded-md bg-white/90 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white border border-slate-200">
                                    <MoreVertical className="h-3.5 w-3.5 text-slate-500" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); downloadFile(file); }}>
                                    <Download className="h-4 w-4 mr-2" />
                                    Stáhnout
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={(e) => { e.stopPropagation(); handleDeleteUploadedFile(file.id); }}
                                    className="text-red-600"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Smazat
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            
                            {/* File name */}
                            <div className="w-full mt-3 flex items-center justify-center gap-1.5" title={file.fileName}>
                              <FileIcon className="h-4 w-4 flex-shrink-0" style={{ color: fileColor }} />
                              <h3 className="text-sm font-medium text-[#4E5871] truncate">{file.fileName}</h3>
                            </div>
                          </div>
                        );
                      })}

                      {/* Links in this folder */}
                      {sortContent(getLinksInFolder(openFolder.id), 'link').map((link) => {
                        const isSelected = selectedItems.has(`link:${link.id}`);

                        return (
                          <div
                            key={link.id}
                            ref={(el) => registerItemRef(`link:${link.id}`, el)}
                            data-selectable-item
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('documentId', link.id);
                              e.dataTransfer.setData('itemType', 'link');
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            onClick={(e) => {
                              if (e.ctrlKey || e.metaKey || e.shiftKey || selectedItems.size > 0) {
                                handleItemSelect(link.id, 'link', e);
                              } else {
                                handleOpenLink(link);
                              }
                            }}
                            className="flex flex-col items-center group cursor-pointer"
                            style={{ width: '126px' }}
                          >
                            {/* Link Preview Card */}
                            <div className={`relative w-full aspect-square rounded-lg border-2 shadow-sm overflow-hidden group-hover:shadow-lg transition-all ${
                              isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-200 group-hover:border-slate-300'
                            }`}
                            style={{ backgroundColor: '#f1f5f9' }}
                            >
                              {/* Selection checkbox */}
                              <button
                                onClick={(e) => { e.stopPropagation(); handleItemSelect(link.id, 'link', e); }}
                                className={`absolute top-2 right-2 z-20 p-1 rounded transition-all ${
                                  isSelected || selectedItems.size > 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                                }`}
                              >
                                {isSelected ? (
                                  <CheckSquare className="h-5 w-5 text-blue-500" />
                                ) : (
                                  <Square className="h-5 w-5 text-slate-400 hover:text-blue-500" />
                                )}
                              </button>
                              
                              {/* Sync status badge */}
                              <SyncStatusBadge id={link.id} type="link" left="8px" />
                              
                              {/* Thumbnail or Icon */}
                              <div className="w-full h-full flex items-center justify-center relative">
                                {link.thumbnailUrl && link.linkType === 'youtube' && (
                                  <img 
                                    src={link.thumbnailUrl} 
                                    alt={link.title}
                                    className="absolute inset-0 w-full h-full object-cover"
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                  />
                                )}
                                <div className="p-3 rounded-xl bg-white shadow-sm z-0">
                                  <Link2 className="h-6 w-6 text-slate-500" />
                                </div>
                              </div>
                              
                              {/* Menu button */}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                  <button className="absolute top-1 right-8 p-1 rounded-md bg-white/90 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white border border-slate-200 z-30">
                                    <MoreVertical className="h-3.5 w-3.5 text-slate-500" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); window.open(link.url, '_blank'); }}>
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    Otevřít
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(link.url); toast.success('URL zkopírována'); }}>
                                    <Copy className="h-4 w-4 mr-2" />
                                    Kopírovat URL
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={(e) => { 
                                      e.stopPropagation(); 
                                      deleteLinkFromStorage(link.id);
                                      toast.success('Odkaz smazán');
                                    }}
                                    className="text-red-600"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Smazat
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            
                            {/* Link title */}
                            <div className="w-full mt-3 flex items-center justify-center gap-1.5" title={link.title}>
                              <Link2 className="h-4 w-4 text-blue-500 flex-shrink-0" />
                              <h3 className="text-sm font-medium text-[#4E5871] truncate">{link.title}</h3>
                            </div>
                            <p className="text-xs text-slate-400 truncate w-full text-center">{link.domain}</p>
                          </div>
                        );
                      })}
                 </div>
                    ) : (
                    /* List View */
                    <div className="flex flex-col gap-2">
                      {/* Subtle Header */}
                      <div className="flex items-center gap-4 px-4 py-2 text-xs font-medium text-slate-400 uppercase tracking-wider">
                        <div className="w-10"></div>
                        <div className="flex-1">Název</div>
                        <div className="w-28 text-right hidden sm:block">Typ</div>
                        <div className="w-28 text-right hidden md:block">Vytvořeno</div>
                        <div className="w-6"></div>
                      </div>
                      
                      {/* Subfolders */}
                      {sortContent((openFolder.children || []).filter(c => c.type === 'folder'), 'folder').map((subfolder) => (
                        <div 
                          key={subfolder.id}
                          onClick={() => setOpenFolder(subfolder)}
                          className="flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-slate-50 cursor-pointer group transition-colors"
                        >
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm" style={{ backgroundColor: subfolder.color || '#bbf7d0' }}>
                            <Folder className="h-5 w-5 text-slate-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-700 truncate">{subfolder.name}</p>
                            <p className="text-xs text-slate-400 sm:hidden">Složka</p>
                          </div>
                          <div className="w-28 text-right text-sm text-slate-400 hidden sm:block">Složka</div>
                          <div className="w-28 text-right text-sm text-slate-400 hidden md:block">
                            {subfolder.createdAt ? new Date(subfolder.createdAt).toLocaleDateString('cs-CZ') : '-'}
                          </div>
                          <div className="w-6">
                            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                          </div>
                        </div>
                      ))}
                      
                      {/* Documents */}
                      {sortContent((openFolder.children || []).filter(c => c.type === 'document' || c.type === 'board'), 'file').map((child) => {
                        const docDataStr = localStorage.getItem(`vivid-doc-${child.id}`);
                        const docData = docDataStr ? JSON.parse(docDataStr) : null;
                        const displayName = docData?.title || 'Nový dokument';
                        const isSelected = selectedItems.has(`document:${child.id}`);
                        return (
                          <div 
                            key={child.id}
                            ref={(el) => registerItemRef(`document:${child.id}`, el)}
                            data-selectable-item
                            onClick={(e) => {
                              if (e.ctrlKey || e.metaKey || e.shiftKey || selectedItems.size > 0) {
                                handleItemSelect(child.id, 'document', e);
                              } else {
                                setSidebarVisible(false);
                                navigate(`/library/my-content/view/${child.id}`);
                              }
                            }}
                            className={`flex items-center gap-4 px-4 py-3 rounded-xl cursor-pointer group transition-colors ${
                              isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                            }`}
                          >
                            <button
                              onClick={(e) => { e.stopPropagation(); handleItemSelect(child.id, 'document', e); }}
                              className="w-10 h-10 flex items-center justify-center shrink-0"
                            >
                              {isSelected ? (
                                <CheckSquare className="h-5 w-5 text-blue-500" />
                              ) : (
                                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center shadow-sm group-hover:hidden">
                                  <FileText className="h-5 w-5 text-purple-600" />
                                </div>
                              )}
                              {!isSelected && <Square className="h-5 w-5 text-slate-300 hidden group-hover:block" />}
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-700 truncate">{displayName}</p>
                              <p className="text-xs text-slate-400 sm:hidden">{child.type === 'board' ? 'Board' : 'Dokument'}</p>
                            </div>
                            <div className="w-28 text-right text-sm text-slate-400 hidden sm:block">{child.type === 'board' ? 'Board' : 'Dokument'}</div>
                            <div className="w-28 text-right text-sm text-slate-400 hidden md:block">
                              {child.createdAt ? new Date(child.createdAt).toLocaleDateString('cs-CZ') : '-'}
                            </div>
                            <div className="w-6"></div>
                          </div>
                        );
                      })}
                      
                      {/* Worksheets */}
                      {sortContent(getWorksheetsInFolder(openFolder.id), 'worksheet').map((ws) => {
                        const isSelected = selectedItems.has(`worksheet:${ws.id}`);
                        return (
                          <div 
                            key={ws.id}
                            ref={(el) => registerItemRef(`worksheet:${ws.id}`, el)}
                            data-selectable-item
                            onClick={(e) => {
                              if (e.ctrlKey || e.metaKey || e.shiftKey || selectedItems.size > 0) {
                                handleItemSelect(ws.id, 'worksheet', e);
                              } else {
                                navigate(`/worksheet/${ws.id}`);
                              }
                            }}
                            className={`flex items-center gap-4 px-4 py-3 rounded-xl cursor-pointer group transition-colors ${
                              isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                            }`}
                          >
                            <button
                              onClick={(e) => { e.stopPropagation(); handleItemSelect(ws.id, 'worksheet', e); }}
                              className="w-10 h-10 flex items-center justify-center shrink-0"
                            >
                              {isSelected ? (
                                <CheckSquare className="h-5 w-5 text-blue-500" />
                              ) : (
                                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shadow-sm group-hover:hidden">
                                  <FileEdit className="h-5 w-5 text-amber-600" />
                                </div>
                              )}
                              {!isSelected && <Square className="h-5 w-5 text-slate-300 hidden group-hover:block" />}
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-700 truncate">{ws.title || 'Pracovní list'}</p>
                              <p className="text-xs text-slate-400 sm:hidden">Pracovní list</p>
                            </div>
                            <div className="w-28 text-right text-sm text-slate-400 hidden sm:block">Pracovní list</div>
                            <div className="w-28 text-right text-sm text-slate-400 hidden md:block">
                              {ws.createdAt ? new Date(ws.createdAt).toLocaleDateString('cs-CZ') : '-'}
                            </div>
                            <div className="w-6"></div>
                          </div>
                        );
                      })}
                      
                      {/* Quizzes/Boards */}
                      {sortContent(quizzesInCurrentFolder, 'worksheet').map((quiz) => {
                        const isSelected = selectedItems.has(`quiz:${quiz.id}`);
                        return (
                          <div 
                            key={quiz.id}
                            ref={(el) => registerItemRef(`quiz:${quiz.id}`, el)}
                            data-selectable-item
                            onClick={(e) => {
                              if (e.ctrlKey || e.metaKey || e.shiftKey || selectedItems.size > 0) {
                                handleItemSelect(quiz.id, 'quiz', e);
                              } else {
                                navigate(`/quiz/view/${quiz.id}`);
                              }
                            }}
                            className={`flex items-center gap-4 px-4 py-3 rounded-xl cursor-pointer group transition-colors ${
                              isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                            }`}
                          >
                            <button
                              onClick={(e) => { e.stopPropagation(); handleItemSelect(quiz.id, 'quiz', e); }}
                              className="w-10 h-10 flex items-center justify-center shrink-0"
                            >
                              {isSelected ? (
                                <CheckSquare className="h-5 w-5 text-blue-500" />
                              ) : (
                                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shadow-sm group-hover:hidden">
                                  <Play className="h-5 w-5 text-indigo-600" />
                                </div>
                              )}
                              {!isSelected && <Square className="h-5 w-5 text-slate-300 hidden group-hover:block" />}
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-700 truncate">{quiz.title || 'Board'}</p>
                              <p className="text-xs text-slate-400 sm:hidden">Board</p>
                            </div>
                            <div className="w-28 text-right text-sm text-slate-400 hidden sm:block">Board</div>
                            <div className="w-28 text-right text-sm text-slate-400 hidden md:block">
                              {quiz.createdAt ? new Date(quiz.createdAt).toLocaleDateString('cs-CZ') : '-'}
                            </div>
                            <div className="w-6"></div>
                          </div>
                        );
                      })}
                      
                      {/* Files */}
                      {sortContent(getFilesInFolder(openFolder.id), 'file').map((file) => {
                        const isSelected = selectedItems.has(`file:${file.id}`);
                        const fileType = file.mimeType?.includes('pdf') ? 'PDF' : 
                                         file.mimeType?.includes('presentation') || file.mimeType?.includes('powerpoint') ? 'PowerPoint' : 'Soubor';
                        return (
                          <div 
                            key={file.id}
                            ref={(el) => registerItemRef(`file:${file.id}`, el)}
                            data-selectable-item
                            onClick={(e) => {
                              if (e.ctrlKey || e.metaKey || e.shiftKey || selectedItems.size > 0) {
                                handleItemSelect(file.id, 'file', e);
                              } else {
                                handleOpenFilePreview(file);
                              }
                            }}
                            className={`flex items-center gap-4 px-4 py-3 rounded-xl cursor-pointer group transition-colors ${
                              isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                            }`}
                          >
                            <button
                              onClick={(e) => { e.stopPropagation(); handleItemSelect(file.id, 'file', e); }}
                              className="w-10 h-10 flex items-center justify-center shrink-0"
                            >
                              {isSelected ? (
                                <CheckSquare className="h-5 w-5 text-blue-500" />
                              ) : (
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm group-hover:hidden ${
                                  file.mimeType?.includes('pdf') ? 'bg-red-100' : 
                                  file.mimeType?.includes('presentation') || file.mimeType?.includes('powerpoint') ? 'bg-orange-100' : 'bg-slate-100'
                                }`}>
                                  <FileText className={`h-5 w-5 ${
                                    file.mimeType?.includes('pdf') ? 'text-red-600' : 
                                    file.mimeType?.includes('presentation') || file.mimeType?.includes('powerpoint') ? 'text-orange-600' : 'text-slate-600'
                                  }`} />
                                </div>
                              )}
                              {!isSelected && <Square className="h-5 w-5 text-slate-300 hidden group-hover:block" />}
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-700 truncate">{file.fileName}</p>
                              <p className="text-xs text-slate-400 sm:hidden">{fileType}</p>
                            </div>
                            <div className="w-28 text-right text-sm text-slate-400 hidden sm:block">{fileType}</div>
                            <div className="w-28 text-right text-sm text-slate-400 hidden md:block">
                              {file.createdAt ? new Date(file.createdAt).toLocaleDateString('cs-CZ') : '-'}
                            </div>
                            <div className="w-6"></div>
                          </div>
                        );
                      })}
                      
                      {/* Links */}
                      {sortContent(getLinksInFolder(openFolder.id), 'link').map((link) => {
                        const isSelected = selectedItems.has(`link:${link.id}`);
                        return (
                          <div 
                            key={link.id}
                            ref={(el) => registerItemRef(`link:${link.id}`, el)}
                            data-selectable-item
                            onClick={(e) => {
                              if (e.ctrlKey || e.metaKey || e.shiftKey || selectedItems.size > 0) {
                                handleItemSelect(link.id, 'link', e);
                              } else {
                                handleOpenLink(link);
                              }
                            }}
                            className={`flex items-center gap-4 px-4 py-3 rounded-xl cursor-pointer group transition-colors ${
                              isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                            }`}
                          >
                            <button
                              onClick={(e) => { e.stopPropagation(); handleItemSelect(link.id, 'link', e); }}
                              className="w-10 h-10 flex items-center justify-center shrink-0"
                            >
                              {isSelected ? (
                                <CheckSquare className="h-5 w-5 text-blue-500" />
                              ) : (
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm group-hover:hidden" style={{ backgroundColor: link.bgColor }}>
                                  <Link2 className="h-5 w-5" style={{ color: link.color }} />
                                </div>
                              )}
                              {!isSelected && <Square className="h-5 w-5 text-slate-300 hidden group-hover:block" />}
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-700 truncate">{link.title}</p>
                              <p className="text-xs text-slate-400 sm:hidden">{link.domain}</p>
                            </div>
                            <div className="w-28 text-right text-sm text-slate-400 hidden sm:block">{link.domain}</div>
                            <div className="w-28 text-right text-sm text-slate-400 hidden md:block">
                              {link.createdAt ? new Date(link.createdAt).toLocaleDateString('cs-CZ') : '-'}
                            </div>
                            <div className="w-6"></div>
                          </div>
                        );
                      })}
                    </div>
                    )
               ) : (
                    <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-2xl bg-accent/10">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
                      <p className="font-medium">Tato složka je prázdná</p>
                      <p className="text-sm mt-1 mb-4">
                        {ecosystemAccess.canCreateContent 
                          ? 'Vytvořte nový dokument, složku nebo přetáhněte existující'
                          : 'Vytvořte novou složku nebo přetáhněte existující'
                        }
                      </p>
                      <div className="flex gap-3 justify-center">
                        <Button
                          onClick={handleCreateFolder}
                          variant="outline"
                          className="gap-2"
                        >
                          <FolderPlus className="h-4 w-4" />
                          Nová složka
                        </Button>
                        {ecosystemAccess.canCreateContent && (
                          <>
                        <Button
                          onClick={handleCreateDocument}
                          className="gap-2 bg-[#4E5871] hover:bg-[#3d455a]"
                        >
                          <FilePlus className="h-4 w-4" />
                          Nový dokument
                        </Button>
                        <Button
                          onClick={handleCreateWorksheet}
                          className="gap-2 bg-amber-500 hover:bg-amber-600"
                        >
                          <FileEdit className="h-4 w-4" />
                          Pracovní list
                        </Button>
                        <Button
                          onClick={handleCreateQuiz}
                          className="gap-2 bg-indigo-500 hover:bg-indigo-600"
                        >
                          <Play className="h-4 w-4" />
                          Board
                        </Button>
                        <Button
                          onClick={() => fileInputRef.current?.click()}
                          variant="outline"
                          className="gap-2"
                        >
                          <Upload className="h-4 w-4" />
                          Nahrát soubor
                        </Button>
                          </>
                        )}
                      </div>
                 </div>
               )}
             </div>
              </>
            ) : (
              /* Main Overview */
              <>
                {/* Header Section with Storage Indicator */}
                <div className="mb-4 mt-6 flex items-start justify-between">
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-[#4E5871] mb-2">Můj obsah</h1>
                    <p className="text-base text-muted-foreground">
                      Vytvářejte si své interaktivní materiály a sdílejte je se žáky
                    </p>
                  </div>
                  
                  {/* Storage Indicator - right aligned, two lines */}
                  {ecosystemAccess.canCreateContent && (() => {
                    const totalItems = uploadedFiles.length + myDocuments.length + worksheets.length + boardCount.count + myFolders.filter(f => f.copiedFrom === 'vividbooks-category').length;
                    
                    return (
                      <div className="relative">
                        <button
                          onClick={() => setShowStorageDetails(!showStorageDetails)}
                          className="flex flex-col items-end gap-1 text-sm text-slate-500 hover:text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors text-right"
                        >
                          {/* Line 1: Item count */}
                          <div className="flex items-center gap-2">
                            <HardDrive className="h-4 w-4" />
                            <span>{totalItems} položek</span>
                          </div>
                          {/* Line 2: Storage with progress bar */}
                          <div className="flex items-center gap-2">
                            <span className="text-xs">{formatFileSize(storageUsage.used)} / {formatFileSize(storageUsage.total)}</span>
                            <div
                              className="w-16 h-1.5 rounded-full overflow-hidden"
                              style={{ backgroundColor: '#e2e8f0' }}
                            >
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.min(storageUsage.percentage, 100)}%`,
                                  backgroundColor: storageUsage.percentage >= 90 ? '#ef4444' : storageUsage.percentage >= 70 ? '#f59e0b' : '#3b82f6'
                                }}
                              />
                            </div>
                            <span className="text-xs font-medium" style={{ color: storageUsage.percentage >= 90 ? '#ef4444' : storageUsage.percentage >= 70 ? '#f59e0b' : '#64748b' }}>
                              {storageUsage.percentage}%
                            </span>
                          </div>
                        </button>

                        {/* Popup with details - positioned ABOVE */}
                        {showStorageDetails && (
                          <div className="absolute top-full right-0 mt-2 p-4 bg-white rounded-xl shadow-lg border border-slate-200 z-50 min-w-[280px]">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-semibold text-slate-700">Statistiky úložiště</h4>
                              <button
                                onClick={() => setShowStorageDetails(false)}
                                className="p-1 hover:bg-slate-100 rounded"
                              >
                                <X className="h-4 w-4 text-slate-400" />
                              </button>
                            </div>

                            {/* Stats */}
                            <div className="space-y-0 text-sm mb-4">
                              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                                <div className="flex items-center gap-2 text-slate-500">
                                  <LayoutGrid className="h-4 w-4" />
                                  <span>Boardy</span>
                                </div>
                                <span className="font-medium text-slate-700">{boardCount.loading ? '...' : boardCount.count}</span>
                              </div>
                              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                                <div className="flex items-center gap-2 text-slate-500">
                                  <FileText className="h-4 w-4" />
                                  <span>Dokumenty</span>
                                </div>
                                <span className="font-medium text-slate-700">{myDocuments.length}</span>
                              </div>
                              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                                <div className="flex items-center gap-2 text-slate-500">
                                  <FileEdit className="h-4 w-4" />
                                  <span>Pracovní listy</span>
                                </div>
                                <span className="font-medium text-slate-700">{worksheets.length}</span>
                              </div>
                              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                                <div className="flex items-center gap-2 text-slate-500">
                                  <Upload className="h-4 w-4" />
                                  <span>Nahrané soubory</span>
                                </div>
                                <span className="font-medium text-slate-700">{uploadedFiles.length}</span>
                              </div>
                              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                                <div className="flex items-center gap-2 text-slate-500">
                                  <Copy className="h-4 w-4" />
                                  <span>Zkopírováno z VividBooks</span>
                                </div>
                                <span className="font-medium text-slate-700">{myFolders.filter(f => f.copiedFrom === 'vividbooks-category').length}</span>
                              </div>
                              <div className="flex items-center justify-between py-2">
                                <div className="flex items-center gap-2 text-slate-500">
                                  <Folder className="h-4 w-4" />
                                  <span>Složky</span>
                                </div>
                                <span className="font-medium text-slate-700">{myFolders.filter(f => f.copiedFrom !== 'vividbooks-category' && f.type === 'folder').length}</span>
                              </div>
                            </div>

                            {/* Storage bar */}
                            <div className="pt-3 border-t border-slate-200">
                              <div className="flex justify-between text-sm mb-1">
                                <span className="text-slate-500">Úložiště souborů</span>
                                <span className="font-medium" style={{ color: storageUsage.percentage >= 90 ? '#ef4444' : storageUsage.percentage >= 70 ? '#f59e0b' : '#3b82f6' }}>
                                  {formatFileSize(storageUsage.used)} / {formatFileSize(storageUsage.total)}
                                </span>
                              </div>
                              <div
                                className="w-full h-3 rounded-full overflow-hidden"
                                style={{ backgroundColor: '#e2e8f0' }}
                              >
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${Math.min(storageUsage.percentage, 100)}%`,
                                    backgroundColor: storageUsage.percentage >= 90 ? '#ef4444' : storageUsage.percentage >= 70 ? '#f59e0b' : '#3b82f6'
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Ecosystem Info Banner */}
                {!ecosystemAccess.canCreateContent && !ecosystemAccess.loading && (
                  <div className="mb-8 p-4 rounded-xl bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-violet-100 text-violet-600">
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-violet-800 mb-1">Ekosystém Vividbooks</h3>
                        <p className="text-sm text-violet-700 mb-2">
                          Pro tvorbu dokumentů a pracovních listů potřebujete Ekosystém Vividbooks.
                        </p>
                        <button 
                          onClick={() => navigate('/library/profile?section=nastroje')}
                          className="text-sm font-medium text-violet-600 hover:text-violet-800 hover:underline"
                        >
                          Zjistit více →
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Create New Section - Accordion Slideout */}
                <div className="mb-10">
                  <div className="flex gap-3" style={{ height: '305px', maxWidth: '1000px' }}>
                    {[
                      { 
                        id: 'board', 
                        name: 'Board', 
                        desc: 'Prezentace, texty, písemky, aktivity',
                        meta: 'Struktura prezentace',
                        badge: ecosystemAccess.maxBoards !== -1 ? `${boardCount.loading ? '...' : boardCount.count}/${ecosystemAccess.maxBoards} boardů` : undefined,
                        bgColor: '#eff6ff',
                        iconBg: '#3b82f6',
                        textColor: '#2563eb',
                        borderColor: '#93c5fd',
                        icon: <LayoutGrid className="h-7 w-7" />,
                        image: 'https://cdn.prod.website-files.com/5dfa34b974e1f6e9cbef33b5/66cb9ae705df674027b56a6b_dotazniky-vividboard.avif',
                        enabled: ecosystemAccess.canCreateContent,
                        onAction: handleCreateBoard
                      },
                      { 
                        id: 'document', 
                        name: 'Dokument', 
                        desc: 'Učební text, návody a lekce',
                        meta: 'Struktura dokumentu',
                        bgColor: '#f3e8ff',
                        iconBg: '#a855f7',
                        textColor: '#7c3aed',
                        borderColor: '#c4b5fd',
                        icon: <FileText className="h-7 w-7" />,
                        enabled: ecosystemAccess.canCreateContent,
                        onAction: handleCreateDocument
                      },
                      { 
                        id: 'worksheet', 
                        name: 'Pracovní list', 
                        desc: 'Interaktivní cvičení s AI',
                        meta: 'Otázky, doplňovačky, úlohy',
                        bgColor: '#fef3c7',
                        iconBg: '#f59e0b',
                        textColor: '#b45309',
                        borderColor: '#fbbf24',
                        icon: <FileEdit className="h-7 w-7" />,
                        enabled: ecosystemAccess.canCreateContent,
                        badge: 'AI',
                        onAction: handleCreateWorksheet
                      },
                      // Canvas/Nekonečná nástěnka - temporarily disabled
                      // { 
                      //   id: 'canvas', 
                      //   name: 'Nekonečná nástěnka', 
                      //   shortName: 'Nástěnka',
                      //   desc: 'Společný prostor pro spolupráci',
                      //   meta: 'Prostor bez hranic',
                      //   bgColor: '#d1fae5',
                      //   iconBg: '#10b981',
                      //   textColor: '#047857',
                      //   borderColor: '#34d399',
                      //   icon: <LayoutGrid className="h-7 w-7" />,
                      //   enabled: ecosystemAccess.canCreateContent,
                      //   onAction: () => navigate('/my-content/canvas/new')
                      // },
                      { 
                        id: 'files', 
                        name: 'Moje soubory', 
                        shortName: 'Soubory',
                        desc: 'Nahrajte soubory a sdílejte je se žáky',
                        meta: `${uploadedFiles.length} ${uploadedFiles.length === 1 ? 'soubor' : uploadedFiles.length < 5 ? 'soubory' : 'souborů'}`,
                        bgColor: '#f1f5f9',
                        iconBg: '#64748b',
                        textColor: '#334155',
                        borderColor: '#94a3b8',
                        icon: <HardDrive className="h-7 w-7" />,
                        enabled: ecosystemAccess.canCreateContent,
                        isUploadZone: true,
                        onAction: () => fileInputRef.current?.click()
                      },
                      { 
                        id: 'links', 
                        name: 'Moje odkazy', 
                        shortName: 'Odkazy',
                        desc: 'Nahrajte svoje online materiály a sdílejte je se žáky',
                        meta: `${myLinks.length} ${myLinks.length === 1 ? 'odkaz' : myLinks.length < 5 ? 'odkazy' : 'odkazů'}`,
                        bgColor: '#f1f5f9',
                        iconBg: '#64748b',
                        textColor: '#334155',
                        borderColor: '#94a3b8',
                        icon: <Link2 className="h-7 w-7" />,
                        enabled: true,
                        isLinkZone: true,
                        onAction: () => {}
                      }
                    ].map((card) => {
                      const isExpanded = expandedCard === card.id;
                      
                      return (
                        <div
                          key={card.id}
                          onClick={() => {
                            if (!card.enabled) return;
                            setExpandedCard(isExpanded ? null : card.id);
                          }}
                          className="relative rounded-2xl overflow-hidden"
                          style={{ 
                            flex: isExpanded ? '1 1 auto' : '0 0 80px',
                            minWidth: isExpanded ? '300px' : '80px',
                            height: '100%',
                            backgroundColor: card.bgColor,
                            border: isExpanded ? `2px solid ${card.borderColor}` : '2px solid transparent',
                            boxShadow: isExpanded ? '0 10px 40px rgba(0,0,0,0.1)' : 'none',
                            opacity: card.enabled ? 1 : 0.5,
                            cursor: card.enabled ? 'pointer' : 'not-allowed'
                          }}
                        >
                          {/* Collapsed State */}
                          <div 
                            className="absolute inset-0 flex flex-col items-center px-2 pt-5 pb-4"
                            style={{ 
                              opacity: isExpanded ? 0 : 1,
                              pointerEvents: isExpanded ? 'none' : 'auto'
                            }}
                          >
                            <div 
                              className="p-3 rounded-xl shadow-sm mb-4"
                              style={{ backgroundColor: 'white' }}
                            >
                              <div style={{ color: card.textColor }}>
                                {card.icon}
                              </div>
                            </div>
                            <span 
                              className="text-sm font-semibold whitespace-nowrap flex-1"
                              style={{ 
                                writingMode: 'vertical-rl', 
                                textOrientation: 'mixed', 
                                transform: 'rotate(180deg)',
                                color: card.textColor,
                                fontSize: '20px'
                              }}
                            >
                              {card.shortName || card.name}
                            </span>
                            {!card.enabled && (
                              <span 
                                className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[9px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
                                style={{ backgroundColor: 'rgba(255,255,255,0.9)', color: '#94a3b8' }}
                              >
                                Brzy
                              </span>
                            )}
                          </div>
                          
                          {/* Expanded State - Two Column Layout 60/40 OR Upload Zone */}
                          <div 
                            className="absolute inset-0 flex"
                            style={{ 
                              opacity: isExpanded ? 1 : 0,
                              pointerEvents: isExpanded ? 'auto' : 'none'
                            }}
                          >
                            {card.isUploadZone ? (
                              /* Upload Zone for Files card */
                              <div 
                                className="flex-1 p-6 flex flex-col"
                                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
                                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); }}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setIsDragOver(false);
                                  handleFileUpload(e.dataTransfer.files);
                                }}
                              >
                                <div className="flex items-center justify-between mb-4">
                                  <div>
                                    <h3 className="font-bold text-slate-800 text-xl leading-tight">{card.name}</h3>
                                    <p className="text-sm text-slate-500">{card.meta}</p>
                                  </div>
                                  <button 
                                    onClick={(e) => { 
                                      e.stopPropagation(); 
                                      card.onAction();
                                    }}
                                    className="px-4 py-2 rounded-lg text-white font-medium text-sm flex items-center gap-2 hover:opacity-90"
                                    style={{ backgroundColor: card.iconBg }}
                                  >
                                    <Upload className="h-4 w-4" />
                                    Vybrat soubory
                                  </button>
                                </div>
                                
                                {/* Drag & Drop Zone */}
                                <div 
                                  className={`flex-1 border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-all ${
                                    isDragOver ? 'border-blue-400 bg-blue-50' : 'border-slate-300'
                                  }`}
                                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                                >
                                  <div 
                                    className={`p-4 rounded-2xl mb-3 transition-colors ${isDragOver ? 'bg-blue-100' : 'bg-slate-100'}`}
                                  >
                                    <Upload className={`h-10 w-10 ${isDragOver ? 'text-blue-500' : 'text-slate-400'}`} />
                                  </div>
                                  <p className={`font-medium ${isDragOver ? 'text-blue-600' : 'text-slate-600'}`}>
                                    {isDragOver ? 'Pusťte soubory zde' : 'Přetáhněte soubory sem'}
                                  </p>
                                  <p className="text-sm text-slate-400 mt-1">
                                    PDF, Word, Excel, PowerPoint, obrázky, videa
                                  </p>
                                  <p className="text-xs text-slate-400 mt-2">
                                    Max. 30 MB na soubor
                                  </p>
                                </div>
                              </div>
                            ) : card.isLinkZone ? (
                              /* Links Zone - compact layout */
                              <div className="flex-1 p-4 flex flex-col">
                                <h3 className="font-bold text-slate-800 text-lg mb-1">{card.name}</h3>
                                <p className="text-xs text-slate-500 mb-3">Vložte URL a uložte si odkaz</p>
                                
                                {/* Compact Input Area */}
                                <div className="flex-1 flex flex-col justify-center space-y-2">
                                  <input
                                    type="text"
                                    value={linkInputUrl}
                                    onChange={(e) => handleLinkInputChange(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && linkInputDetectedInfo) {
                                        e.preventDefault();
                                        handleInlineAddLink();
                                      }
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    placeholder="Vložte URL odkazu..."
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:border-slate-400 outline-none text-sm"
                                  />
                                  
                                  {linkInputDetectedInfo ? (
                                    <>
                                      <input
                                        type="text"
                                        value={linkInputTitle}
                                        onChange={(e) => { e.stopPropagation(); setLinkInputTitle(e.target.value); }}
                                        onClick={(e) => e.stopPropagation()}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleInlineAddLink();
                                          }
                                        }}
                                        placeholder="Název odkazu"
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:border-slate-400 outline-none text-sm"
                                      />
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleInlineAddLink(); }}
                                        disabled={linkInputLoading}
                                        style={{ backgroundColor: '#475569' }}
                                        className="w-full py-2.5 rounded-lg text-white font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                                      >
                                        {linkInputLoading ? 'Načítám...' : '+ Přidat odkaz'}
                                      </button>
                                    </>
                                  ) : (
                                    <p className="text-xs text-slate-400 text-center">
                                      YouTube, Google Docs, Notion, Figma...
                                    </p>
                                  )}
                                </div>
                              </div>
                            ) : (
                              /* Standard Two Column Layout */
                              <>
                                {/* Left side - Image/Visual (60%) */}
                                <div 
                                  className="flex items-center justify-center p-4 overflow-hidden"
                                  style={{ width: '60%', backgroundColor: `${card.iconBg}10` }}
                                >
                                  {card.image ? (
                                    <img 
                                      src={card.image} 
                                      alt={card.name}
                                      className="w-full h-full object-contain rounded-xl"
                                    />
                                  ) : (
                                    <div 
                                      className="p-6 rounded-3xl shadow-lg"
                                      style={{ backgroundColor: card.iconBg }}
                                    >
                                      <div style={{ color: 'white' }}>
                                        {React.cloneElement(card.icon as React.ReactElement<any>, { className: 'h-14 w-14' })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                
                                {/* Right side - Info + Button (40%) */}
                                <div className="p-5 flex flex-col h-full" style={{ width: '40%' }}>
                                  <div className="flex-1">
                                    <h3 className="font-bold text-slate-800 text-xl leading-tight mb-1">{card.name}</h3>
                                    <p className="text-sm text-slate-600 leading-relaxed mb-2">{card.desc}</p>
                                    <p className="text-xs text-slate-400">{card.meta}</p>
                                    {card.badge && (
                                      <p className="text-xs font-medium mt-2" style={{ color: card.iconBg }}>{card.badge}</p>
                                    )}
                                  </div>
                                  <button 
                                    onClick={(e) => { 
                                      e.stopPropagation(); 
                                      card.onAction();
                                    }}
                                    className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 hover:opacity-90 hover:shadow-lg mt-auto"
                                    style={{ backgroundColor: card.iconBg }}
                                  >
                                    Vytvořit
                                    <ArrowRight className="h-4 w-4" />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Bulk Actions Toolbar - Fixed at top */}
                {showBulkToolbar && selectedItems.size > 0 && (
                  <div className="fixed top-0 left-0 right-0 z-50 p-4 bg-blue-50 border-b border-blue-200 shadow-lg flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckSquare className="h-5 w-5 text-blue-500" />
                      <span className="font-medium text-blue-700">
                        Vybráno: {selectedItems.size} {selectedItems.size === 1 ? 'položka' : selectedItems.size < 5 ? 'položky' : 'položek'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => setMoveToFolderOpen(true)}
                        variant="outline"
                        size="sm"
                        className="gap-2"
                      >
                        <FolderInput className="h-4 w-4" />
                        Přesunout do složky
                      </Button>
                      <Button
                        onClick={handleBulkDelete}
                        variant="outline"
                        size="sm"
                        className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        Smazat
                      </Button>
                      <Button
                        onClick={clearSelection}
                        variant="ghost"
                        size="sm"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Move to Folder Dialog */}
                <Dialog open={moveToFolderOpen} onOpenChange={setMoveToFolderOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Přesunout do složky</DialogTitle>
                      <DialogDescription>
                        Vyberte složku, do které chcete přesunout {selectedItems.size} {selectedItems.size === 1 ? 'položku' : 'položek'}.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {myFolders.filter(f => f.copiedFrom !== 'vividbooks-category' && f.type === 'folder').map((folder) => (
                        <button
                          key={folder.id}
                          onClick={() => handleBulkMoveToFolder(folder.id)}
                          className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100 transition-colors text-left"
                        >
                          <div 
                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: folder.color || '#bbf7d0' }}
                          >
                            <Folder className="h-4 w-4 text-slate-600" />
                          </div>
                          <span className="font-medium text-[#4E5871]">{folder.name}</span>
                        </button>
                      ))}
                      {myFolders.filter(f => f.copiedFrom !== 'vividbooks-category' && f.type === 'folder').length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          <Folder className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>Nemáte žádné složky</p>
                          <Button
                            onClick={() => { setMoveToFolderOpen(false); handleCreateFolder(); }}
                            variant="link"
                            className="mt-2"
                          >
                            Vytvořit složku
                          </Button>
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFileUpload(e.target.files)}
                />

                {/* My Files Section */}
                <div className="mb-12">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold text-[#4E5871] flex items-center gap-2">
                      <Folder className="h-5 w-5" />
                      Moje soubory
                    </h2>
                    <div className="flex items-center gap-3">
                      {/* Sort dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                            <ArrowUpDown className="h-4 w-4" />
                            <span className="hidden sm:inline">Řadit</span>
                            <ChevronDown className="h-3 w-3 opacity-50" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => setSortBy('date-created')} className={sortBy === 'date-created' ? 'bg-slate-100' : ''}>
                            Datum vytvoření
                            {sortBy === 'date-created' && <Check className="ml-auto h-4 w-4" />}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setSortBy('date-opened')} className={sortBy === 'date-opened' ? 'bg-slate-100' : ''}>
                            Datum otevření
                            {sortBy === 'date-opened' && <Check className="ml-auto h-4 w-4" />}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setSortBy('type')} className={sortBy === 'type' ? 'bg-slate-100' : ''}>
                            Typu
                            {sortBy === 'type' && <Check className="ml-auto h-4 w-4" />}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setSortBy('alphabetical')} className={sortBy === 'alphabetical' ? 'bg-slate-100' : ''}>
                            Abecedně
                            {sortBy === 'alphabetical' && <Check className="ml-auto h-4 w-4" />}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {/* View mode toggle */}
                      <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                        <button
                          onClick={() => setViewMode('grid')}
                          className={`p-2 rounded-md transition-all ${
                            viewMode === 'grid' 
                              ? 'bg-white shadow-sm text-slate-700' 
                              : 'text-slate-400 hover:text-slate-600'
                          }`}
                          title="Zobrazit jako ikony"
                        >
                          <Grid3X3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setViewMode('list')}
                          className={`p-2 rounded-md transition-all ${
                            viewMode === 'list' 
                              ? 'bg-white shadow-sm text-slate-700' 
                              : 'text-slate-400 hover:text-slate-600'
                          }`}
                          title="Zobrazit jako seznam"
                        >
                          <List className="h-4 w-4" />
                        </button>
                      </div>
                      <Button
                        onClick={handleCreateFolder}
                        variant="outline"
                        className="gap-2 text-[#4E5871]"
                      >
                        <FolderPlus className="h-4 w-4" />
                        Vytvořit složku
                      </Button>
                      <Button
                        onClick={handleFetchServerSnapshot}
                        variant="outline"
                        className="text-[#4E5871]"
                        disabled={serverSnapshotLoading}
                        title="Debug: seznam obsahu na Supabase pro aktuální účet"
                      >
                        {serverSnapshotLoading ? 'Načítám...' : 'Supabase seznam'}
                      </Button>
                    </div>
                  </div>
                  
                  {/* Files Grid with Lasso Selection */}
                  <div 
                    ref={filesContainerRef}
                    className="relative select-none -mx-4 lg:-mx-8 px-4 lg:px-8"
                    onMouseDown={handleMouseDown}
                    style={{ minHeight: 'calc(100vh - 400px)', paddingTop: '16px', paddingBottom: '16px' }}
                  >
                    <div className="space-y-4">
                    {/* Selection Rectangle */}
                    {viewMode === 'grid' ? (
                    <>
                    {/* User Folders (not from VividBooks) - only show items with type 'folder' */}
                    {myFolders.filter(f => f.copiedFrom !== 'vividbooks-category' && f.type === 'folder').length > 0 && (
                      <div className="flex flex-wrap gap-8">
                        {sortContent(myFolders.filter(f => f.copiedFrom !== 'vividbooks-category' && f.type === 'folder'), 'folder').map((item) => (
                          <FolderCard 
                            key={item.id}
                            item={item}
                            onClick={() => setOpenFolder(item)}
                            onMenuClick={(action) => {
                              if (action === 'rename') handleStartRename(item);
                              if (action === 'delete') handleStartDelete(item);
                            }}
                            onDrop={(docId, itemType) => handleMoveItemToFolder(docId, itemType, item.id)}
                            onShare={() => handleStartShare(item)}
                          />
                   ))}
                 </div>
                    )}

                    {/* Root Documents, Worksheets, Quizzes, Files and Links (not in folders) - Grid Layout with Previews */}
                    {(myDocuments.length > 0 || getRootWorksheets().length > 0 || rootQuizzes.length > 0 || getRootFiles().length > 0 || getRootLinks().length > 0) && (
                      <div className="flex flex-wrap gap-8 mt-6">
                        {/* Documents */}
                        {sortContent(myDocuments, 'file').map((doc) => {
                          // Get updated data from vivid-doc storage
                          const docDataStr = localStorage.getItem(`vivid-doc-${doc.id}`);
                          const docData = docDataStr ? JSON.parse(docDataStr) : null;
                          const displayName = docData?.title || 'Nový dokument';
                          const contentPreview = docData?.content || '';
                          const isEmpty = !contentPreview || contentPreview === '<p></p>';
                          
                          const isSelected = selectedItems.has(`document:${doc.id}`);
                          return (
                          <div 
                            key={doc.id}
                            ref={(el) => registerItemRef(`document:${doc.id}`, el)}
                            data-selectable-item
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('documentId', doc.id);
                              e.dataTransfer.setData('itemType', 'document');
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (e.ctrlKey || e.metaKey || e.shiftKey || selectedItems.size > 0) {
                                handleItemSelect(doc.id, 'document', e);
                              } else {
                                setSidebarVisible(false);
                                navigate(`/library/my-content/view/${doc.id}`);
                              }
                            }}
                            className="flex flex-col items-center group cursor-pointer"
                            style={{ width: '126px' }}
                          >
                            {/* Document Preview Card - Like Google Docs */}
                            <div className={`relative w-full bg-white rounded-lg border shadow-sm overflow-hidden group-hover:shadow-lg transition-all ${
                              isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-200 group-hover:border-blue-400'
                            }`}
                                 style={{ aspectRatio: '3/4' }}>
                              
                              {/* Selection checkbox */}
                              <button
                                onClick={(e) => handleItemSelect(doc.id, 'document', e)}
                                className={`absolute top-2 right-2 z-20 p-1 rounded transition-all ${
                                  isSelected || selectedItems.size > 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                                }`}
                              >
                                {isSelected ? (
                                  <CheckSquare className="h-5 w-5 text-blue-500" />
                                ) : (
                                  <Square className="h-5 w-5 text-slate-400 hover:text-blue-500" />
                                )}
                              </button>
                              
                              {/* Document icon badge */}
                              <div className="absolute top-2 left-2 z-10">
                                <div className="p-1.5 rounded-lg bg-purple-500 shadow-sm">
                                  <FileText className="h-3 w-3 text-white" />
                                </div>
                              </div>
                              
                              {/* Sync status badge */}
                              <SyncStatusBadge id={doc.id} type="document" />
                              
                              {/* Scaled content preview */}
                              <div 
                                className="absolute overflow-hidden pointer-events-none"
                                style={{ 
                                  width: '378px',  // 3x the card width
                                  height: '504px', // 3x the card height  
                                  transform: 'scale(0.333)',
                                  transformOrigin: 'top left',
                                  padding: '16px',
                                  paddingTop: '40px',
                                  fontSize: '13px',
                                  lineHeight: '1.5',
                                  color: '#1f2937'
                                }}
                              >
                                {/* Title */}
                                <h1 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '12px', color: '#1e1b4b' }}>
                                  {displayName}
                                </h1>
                                {/* Content */}
                                {isEmpty ? (
                                  <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>Začněte psát...</p>
                                ) : (
                                  <div 
                                    className="prose prose-sm"
                                    dangerouslySetInnerHTML={{ __html: contentPreview }}
                                  />
                                )}
                              </div>
                              
                              {/* Bottom gradient fade */}
                              <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white via-white/80 to-transparent" />
                              
                              {/* Menu button */}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                  <button className="absolute top-1 right-1 p-1 rounded-md bg-white/90 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white border border-slate-200">
                                    <MoreVertical className="h-3.5 w-3.5 text-slate-500" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/library/my-content/edit/${doc.id}`); }}>
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Upravit
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={(e) => { e.stopPropagation(); handleDeleteDocument(doc.id); }}
                                    className="text-red-600"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Smazat
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            
                            {/* Document name */}
                            <div className="w-full mt-3 flex items-center justify-center gap-1.5">
                              <FileText className="h-4 w-4 text-purple-500 flex-shrink-0" />
                              <h3 className="text-sm font-medium text-[#4E5871] truncate">{displayName}</h3>
                            </div>
                          </div>
                          );
                        })}
                        
                        {/* Worksheets (root level) */}
                        {sortContent(getRootWorksheets(), 'worksheet').map((ws) => (
                          <WorksheetPreviewCard
                            key={ws.id}
                            ref={(el) => registerItemRef(`worksheet:${ws.id}`, el)}
                            worksheet={ws}
                            onClick={() => navigate(`/library/my-content/worksheet-editor/${ws.id}`)}
                            onMenuClick={(action) => {
                              if (action === 'edit') navigate(`/library/my-content/worksheet-editor/${ws.id}`);
                              if (action === 'duplicate') {
                                handleDuplicateWorksheet(ws.id);
                              }
                              if (action === 'delete') {
                                handleDeleteWorksheet(ws.id);
                              }
                            }}
                            onDragStart={(e) => {
                              e.dataTransfer.setData('documentId', ws.id);
                              e.dataTransfer.setData('itemType', 'worksheet');
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            isSelected={selectedItems.has(`worksheet:${ws.id}`)}
                            onSelect={(e) => handleItemSelect(ws.id, 'worksheet', e)}
                            showSelection={selectedItems.size > 0}
                          />
                        ))}

                        {/* Quizzes/Boards (root level) */}
                        {sortContent(rootQuizzes, 'worksheet').map((quiz) => (
                          <QuizPreviewCard
                            key={quiz.id}
                            ref={(el) => registerItemRef(`quiz:${quiz.id}`, el)}
                            quiz={quiz}
                            onClick={() => navigate(`/quiz/view/${quiz.id}`)}
                            onMenuClick={(action) => {
                              if (action === 'edit') navigate(`/quiz/edit/${quiz.id}`);
                              if (action === 'duplicate') {
                                const duplicated = duplicateQuizInStorage(quiz.id);
                                if (duplicated) {
                                  setQuizzes(getQuizList());
                                  toast.success('Board byl duplikován');
                                }
                              }
                              if (action === 'move') {
                                // Select this quiz and open move dialog
                                setSelectedItems(new Set([`quiz:${quiz.id}`]));
                                setMoveToFolderOpen(true);
                              }
                              if (action === 'delete') {
                                deleteQuizFromStorage(quiz.id);
                                setQuizzes(getQuizList());
                                toast.success('Board byl smazán');
                              }
                              if (action === 'sync') {
                                toast.promise(
                                  manualSyncQuizToSupabase(quiz.id),
                                  {
                                    loading: 'Nahrávám do cloudu...',
                                    success: (result) => {
                                      if (result) {
                                        setQuizzes(getQuizList());
                                        return 'Board byl nahrán do cloudu';
                                      }
                                      throw new Error('Sync failed');
                                    },
                                    error: 'Nepodařilo se nahrát do cloudu',
                                  }
                                );
                              }
                            }}
                            onDragStart={(e) => {
                              e.dataTransfer.setData('documentId', quiz.id);
                              e.dataTransfer.setData('itemType', 'quiz');
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            isSelected={selectedItems.has(`quiz:${quiz.id}`)}
                            onSelect={(e) => handleItemSelect(quiz.id, 'quiz', e)}
                            showSelection={selectedItems.size > 0}
                          />
                        ))}

                        {/* Uploaded Files (root level) */}
                        {sortContent(getRootFiles(), 'file').map((file) => {
                          const FileIcon = getFileIcon(file.mimeType);
                          const fileColor = getFileColor(file.mimeType);
                          const typeInfo = getFileTypeInfo(file.mimeType || '');
                          const isSelected = selectedItems.has(`file:${file.id}`);
                          const hasPreview = canPreviewFile(file.mimeType);

                          return (
                            <div
                              key={file.id}
                              ref={(el) => registerItemRef(`file:${file.id}`, el)}
                              data-selectable-item
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData('documentId', file.id);
                                e.dataTransfer.setData('itemType', 'file');
                                e.dataTransfer.effectAllowed = 'move';
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (e.ctrlKey || e.metaKey || e.shiftKey || selectedItems.size > 0) {
                                  handleItemSelect(file.id, 'file', e);
                                } else {
                                  handleOpenFilePreview(file);
                                }
                              }}
                              className="flex flex-col items-center group cursor-pointer"
                              style={{ width: '126px' }}
                            >
                              {/* File Preview Card */}
                              <div className={`relative w-full bg-white rounded-lg border shadow-sm overflow-hidden group-hover:shadow-lg transition-all ${
                                isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-200 group-hover:border-blue-400'
                              }`}
                                   style={{ aspectRatio: '3/4' }}>
                                
                                {/* Selection checkbox */}
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleItemSelect(file.id, 'file', e); }}
                                  className={`absolute top-2 right-2 z-20 p-1 rounded transition-all ${
                                    isSelected || selectedItems.size > 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                                  }`}
                                >
                                  {isSelected ? (
                                    <CheckSquare className="h-5 w-5 text-blue-500" />
                                  ) : (
                                    <Square className="h-5 w-5 text-slate-400 hover:text-blue-500" />
                                  )}
                                </button>
                                
                                {/* Type Badge */}
                                <div 
                                  className="absolute top-2 left-2 z-10 text-[10px] font-semibold px-1.5 py-0.5 rounded"
                                  style={{ backgroundColor: `${fileColor}20`, color: fileColor }}
                                >
                                  {typeInfo.label}
                                </div>
                                
                                {/* File Preview - Image thumbnail or Icon */}
                                {file.mimeType?.startsWith('image/') ? (
                                  <div className="absolute inset-0">
                                    <img 
                                      src={file.filePath} 
                                      alt={file.fileName}
                                      className="w-full h-full object-cover"
                                      loading="lazy"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.style.display = 'none';
                                        target.nextElementSibling?.classList.remove('hidden');
                                      }}
                                    />
                                    <div className="hidden absolute inset-0 flex items-center justify-center">
                                      <div 
                                        className="w-16 h-16 rounded-xl flex items-center justify-center"
                                        style={{ backgroundColor: `${fileColor}15` }}
                                      >
                                        <FileIcon className="h-8 w-8" style={{ color: fileColor }} />
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <div 
                                      className="w-16 h-16 rounded-xl flex items-center justify-center"
                                      style={{ backgroundColor: `${fileColor}15` }}
                                    >
                                      <FileIcon className="h-8 w-8" style={{ color: fileColor }} />
                                    </div>
                                  </div>
                                )}
                                
                                {/* File Size */}
                                <div className="absolute bottom-2 left-2 right-2 text-center">
                                  <span className="text-xs text-slate-400">{formatFileSize(file.fileSize)}</span>
                                </div>
                                
                                {/* Menu button */}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                    <button className="absolute top-1 right-1 p-1 rounded-md bg-white/90 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white border border-slate-200">
                                      <MoreVertical className="h-3.5 w-3.5 text-slate-500" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); downloadFile(file); }}>
                                      <Download className="h-4 w-4 mr-2" />
                                      Stáhnout
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem 
                                      onClick={(e) => { e.stopPropagation(); handleDeleteUploadedFile(file.id); }}
                                      className="text-red-600"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Smazat
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                              
                              {/* File name */}
                              <h3 className="w-full mt-3 text-sm font-medium text-[#4E5871] truncate text-center" title={file.fileName}>
                                {file.fileName}
                              </h3>
                            </div>
                          );
                        })}

                        {/* Saved Links (root level) */}
                        {sortContent(getRootLinks(), 'link').map((link) => {
                          const isSelected = selectedItems.has(`link:${link.id}`);

                          return (
                            <div
                              key={link.id}
                              ref={(el) => registerItemRef(`link:${link.id}`, el)}
                              data-selectable-item
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData('documentId', link.id);
                                e.dataTransfer.setData('itemType', 'link');
                                e.dataTransfer.effectAllowed = 'move';
                              }}
                              onClick={(e) => {
                                if (e.ctrlKey || e.metaKey || e.shiftKey || selectedItems.size > 0) {
                                  handleItemSelect(link.id, 'link', e);
                                } else {
                                  handleOpenLink(link);
                                }
                              }}
                              className={`flex flex-col items-center group cursor-pointer ${isSelected ? 'opacity-100' : ''}`}
                              style={{ width: '126px' }}
                            >
                              {/* Link Preview Card - Square */}
                              <div className={`relative w-full aspect-square rounded-lg border-2 shadow-sm overflow-hidden group-hover:shadow-lg transition-all ${
                                isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-200 group-hover:border-slate-300'
                              }`}
                              style={{ backgroundColor: '#f1f5f9' }}
                              >
                                {/* Sync status badge */}
                                <SyncStatusBadge id={link.id} type="link" left="8px" />
                                
                                {/* Thumbnail or Fallback - always show icon as fallback */}
                                <div className="w-full h-full flex items-center justify-center relative">
                                  {/* Background thumbnail (if available) */}
                                  {link.thumbnailUrl && link.linkType === 'youtube' && (
                                    <img 
                                      src={link.thumbnailUrl} 
                                      alt={link.title}
                                      className="absolute inset-0 w-full h-full object-cover"
                                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                    />
                                  )}
                                  {/* Fallback icon - always present but hidden behind thumbnail */}
                                  <div className="p-3 rounded-xl bg-white shadow-sm z-0">
                                    <Link2 className="h-6 w-6 text-slate-500" />
                                  </div>
                                </div>
                                
                                {/* Menu button - three dots */}
                                <div className="absolute top-1 right-1 z-50">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button 
                                        className="p-1.5 rounded-lg bg-white/90 hover:bg-white shadow-sm text-slate-500 hover:text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <MoreVertical className="h-4 w-4" />
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="z-[100]">
                                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenLink(link); }}>
                                        <ExternalLink className="h-4 w-4 mr-2" />
                                        Otevřít odkaz
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={(e) => { 
                                        e.stopPropagation(); 
                                        navigator.clipboard.writeText(link.url);
                                        toast.success('Odkaz zkopírován');
                                      }}>
                                        <Copy className="h-4 w-4 mr-2" />
                                        Kopírovat URL
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem 
                                        onClick={(e) => { 
                                          e.stopPropagation(); 
                                          console.log('[MenuDelete] Deleting link:', link.id);
                                          setMyLinks(prev => {
                                            console.log('[MenuDelete] Before:', prev.length);
                                            const newLinks = prev.filter(l => l.id !== link.id);
                                            console.log('[MenuDelete] After:', newLinks.length);
                                            return newLinks;
                                          });
                                          toast.success('Odkaz smazán');
                                        }}
                                        className="text-red-600"
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Smazat
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                                
                                {/* External Link indicator */}
                                <div className="absolute bottom-1 right-1 p-1 bg-white/90 rounded shadow-sm">
                                  <ExternalLink className="h-3 w-3 text-slate-500" />
                                </div>
                              </div>
                              
                              {/* Link title & domain */}
                              <h3 className="w-full mt-2 text-sm font-medium text-[#4E5871] truncate text-center" title={link.title}>
                                {link.title}
                              </h3>
                              <p className="text-xs text-slate-400 truncate">{link.domain}</p>
                            </div>
                          );
                        })}
                 </div>
               )}

                    </>
                    ) : (
                    /* List View for Main Page */
                    <div className="flex flex-col gap-2">
                      {/* Subtle Header */}
                      <div className="flex items-center gap-4 px-4 py-2 text-xs font-medium text-slate-400 uppercase tracking-wider">
                        <div className="w-10"></div>
                        <div className="flex-1">Název</div>
                        <div className="w-28 text-right hidden sm:block">Typ</div>
                        <div className="w-28 text-right hidden md:block">Vytvořeno</div>
                        <div className="w-6"></div>
                      </div>
                      
                      {/* Folders */}
                      {sortContent(myFolders.filter(f => f.copiedFrom !== 'vividbooks-category' && f.type === 'folder'), 'folder').map((item) => (
                        <div 
                          key={item.id}
                          onClick={() => setOpenFolder(item)}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.currentTarget.classList.add('bg-blue-50', 'ring-2', 'ring-blue-300');
                          }}
                          onDragLeave={(e) => {
                            e.currentTarget.classList.remove('bg-blue-50', 'ring-2', 'ring-blue-300');
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.currentTarget.classList.remove('bg-blue-50', 'ring-2', 'ring-blue-300');
                            const docId = e.dataTransfer.getData('documentId');
                            const itemType = e.dataTransfer.getData('itemType') as 'document' | 'worksheet' | 'file' | 'link';
                            if (docId && itemType) {
                              handleMoveItemToFolder(docId, itemType, item.id);
                            }
                          }}
                          className="flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-slate-50 cursor-pointer group transition-colors"
                        >
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm" style={{ backgroundColor: item.color || '#bbf7d0' }}>
                            <Folder className="h-5 w-5 text-slate-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-700 truncate">{item.name}</p>
                            <p className="text-xs text-slate-400 sm:hidden">Složka</p>
                          </div>
                          <div className="w-28 text-right text-sm text-slate-400 hidden sm:block">Složka</div>
                          <div className="w-28 text-right text-sm text-slate-400 hidden md:block">
                            {item.createdAt ? new Date(item.createdAt).toLocaleDateString('cs-CZ') : '-'}
                          </div>
                          <div className="w-6">
                            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                          </div>
                        </div>
                      ))}
                      
                      {/* Documents */}
                      {sortContent(myDocuments, 'file').map((doc) => {
                        const docDataStr = localStorage.getItem(`vivid-doc-${doc.id}`);
                        const docData = docDataStr ? JSON.parse(docDataStr) : null;
                        const displayName = docData?.title || 'Nový dokument';
                        const isSelected = selectedItems.has(`document:${doc.id}`);
                        return (
                          <div 
                            key={doc.id}
                            ref={(el) => registerItemRef(`document:${doc.id}`, el)}
                            data-selectable-item
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('documentId', doc.id);
                              e.dataTransfer.setData('itemType', 'document');
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            onClick={(e) => {
                              if (e.ctrlKey || e.metaKey || e.shiftKey || selectedItems.size > 0) {
                                handleItemSelect(doc.id, 'document', e);
                              } else {
                                setSidebarVisible(false);
                                navigate(`/library/my-content/view/${doc.id}`);
                              }
                            }}
                            className={`flex items-center gap-4 px-4 py-3 rounded-xl cursor-pointer group transition-colors ${
                              isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                            }`}
                          >
                            <button
                              onClick={(e) => { e.stopPropagation(); handleItemSelect(doc.id, 'document', e); }}
                              className="w-10 h-10 flex items-center justify-center shrink-0"
                            >
                              {isSelected ? (
                                <CheckSquare className="h-5 w-5 text-blue-500" />
                              ) : (
                                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center shadow-sm group-hover:hidden">
                                  <FileText className="h-5 w-5 text-purple-600" />
                                </div>
                              )}
                              {!isSelected && <Square className="h-5 w-5 text-slate-300 hidden group-hover:block" />}
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-700 truncate">{displayName}</p>
                              <p className="text-xs text-slate-400 sm:hidden">{doc.type === 'board' ? 'Board' : 'Dokument'}</p>
                            </div>
                            <div className="w-28 text-right text-sm text-slate-400 hidden sm:block">{doc.type === 'board' ? 'Board' : 'Dokument'}</div>
                            <div className="w-28 text-right text-sm text-slate-400 hidden md:block">
                              {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString('cs-CZ') : '-'}
                            </div>
                            <div className="w-6"></div>
                          </div>
                        );
                      })}
                      
                      {/* Worksheets */}
                      {sortContent(getRootWorksheets(), 'worksheet').map((ws) => {
                        const isSelected = selectedItems.has(`worksheet:${ws.id}`);
                        return (
                          <div 
                            key={ws.id}
                            ref={(el) => registerItemRef(`worksheet:${ws.id}`, el)}
                            data-selectable-item
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('documentId', ws.id);
                              e.dataTransfer.setData('itemType', 'worksheet');
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            onClick={(e) => {
                              if (e.ctrlKey || e.metaKey || e.shiftKey || selectedItems.size > 0) {
                                handleItemSelect(ws.id, 'worksheet', e);
                              } else {
                                navigate(`/worksheet/${ws.id}`);
                              }
                            }}
                            className={`flex items-center gap-4 px-4 py-3 rounded-xl cursor-pointer group transition-colors ${
                              isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                            }`}
                          >
                            <button
                              onClick={(e) => { e.stopPropagation(); handleItemSelect(ws.id, 'worksheet', e); }}
                              className="w-10 h-10 flex items-center justify-center shrink-0"
                            >
                              {isSelected ? (
                                <CheckSquare className="h-5 w-5 text-blue-500" />
                              ) : (
                                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shadow-sm group-hover:hidden">
                                  <FileEdit className="h-5 w-5 text-amber-600" />
                                </div>
                              )}
                              {!isSelected && <Square className="h-5 w-5 text-slate-300 hidden group-hover:block" />}
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-700 truncate">{ws.title || 'Pracovní list'}</p>
                              <p className="text-xs text-slate-400 sm:hidden">Pracovní list</p>
                            </div>
                            <div className="w-28 text-right text-sm text-slate-400 hidden sm:block">Pracovní list</div>
                            <div className="w-28 text-right text-sm text-slate-400 hidden md:block">
                              {ws.createdAt ? new Date(ws.createdAt).toLocaleDateString('cs-CZ') : '-'}
                            </div>
                            <div className="w-6"></div>
                          </div>
                        );
                      })}
                      
                      {/* Quizzes/Boards */}
                      {sortContent(rootQuizzes, 'worksheet').map((quiz) => {
                        const isSelected = selectedItems.has(`quiz:${quiz.id}`);
                        return (
                          <div 
                            key={quiz.id}
                            ref={(el) => registerItemRef(`quiz:${quiz.id}`, el)}
                            data-selectable-item
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('documentId', quiz.id);
                              e.dataTransfer.setData('itemType', 'quiz');
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            onClick={(e) => {
                              if (e.ctrlKey || e.metaKey || e.shiftKey || selectedItems.size > 0) {
                                handleItemSelect(quiz.id, 'quiz', e);
                              } else {
                                navigate(`/quiz/view/${quiz.id}`);
                              }
                            }}
                            className={`flex items-center gap-4 px-4 py-3 rounded-xl cursor-pointer group transition-colors ${
                              isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                            }`}
                          >
                            <button
                              onClick={(e) => { e.stopPropagation(); handleItemSelect(quiz.id, 'quiz', e); }}
                              className="w-10 h-10 flex items-center justify-center shrink-0"
                            >
                              {isSelected ? (
                                <CheckSquare className="h-5 w-5 text-blue-500" />
                              ) : (
                                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shadow-sm group-hover:hidden">
                                  <Play className="h-5 w-5 text-indigo-600" />
                                </div>
                              )}
                              {!isSelected && <Square className="h-5 w-5 text-slate-300 hidden group-hover:block" />}
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-700 truncate">{quiz.title || 'Board'}</p>
                              <p className="text-xs text-slate-400 sm:hidden">Board</p>
                            </div>
                            <div className="w-28 text-right text-sm text-slate-400 hidden sm:block">Board</div>
                            <div className="w-28 text-right text-sm text-slate-400 hidden md:block">
                              {quiz.createdAt ? new Date(quiz.createdAt).toLocaleDateString('cs-CZ') : '-'}
                            </div>
                            <div className="w-6"></div>
                          </div>
                        );
                      })}
                      
                      {/* Files */}
                      {sortContent(getRootFiles(), 'file').map((file) => {
                        const isSelected = selectedItems.has(`file:${file.id}`);
                        const fileType = file.mimeType?.includes('pdf') ? 'PDF' : 
                                         file.mimeType?.includes('presentation') || file.mimeType?.includes('powerpoint') ? 'PowerPoint' : 'Soubor';
                        return (
                          <div 
                            key={file.id}
                            ref={(el) => registerItemRef(`file:${file.id}`, el)}
                            data-selectable-item
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('documentId', file.id);
                              e.dataTransfer.setData('itemType', 'file');
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            onClick={(e) => {
                              if (e.ctrlKey || e.metaKey || e.shiftKey || selectedItems.size > 0) {
                                handleItemSelect(file.id, 'file', e);
                              } else {
                                handleOpenFilePreview(file);
                              }
                            }}
                            className={`flex items-center gap-4 px-4 py-3 rounded-xl cursor-pointer group transition-colors ${
                              isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                            }`}
                          >
                            <button
                              onClick={(e) => { e.stopPropagation(); handleItemSelect(file.id, 'file', e); }}
                              className="w-10 h-10 flex items-center justify-center shrink-0"
                            >
                              {isSelected ? (
                                <CheckSquare className="h-5 w-5 text-blue-500" />
                              ) : (
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm group-hover:hidden ${
                                  file.mimeType?.includes('pdf') ? 'bg-red-100' : 
                                  file.mimeType?.includes('presentation') || file.mimeType?.includes('powerpoint') ? 'bg-orange-100' : 'bg-slate-100'
                                }`}>
                                  <FileText className={`h-5 w-5 ${
                                    file.mimeType?.includes('pdf') ? 'text-red-600' : 
                                    file.mimeType?.includes('presentation') || file.mimeType?.includes('powerpoint') ? 'text-orange-600' : 'text-slate-600'
                                  }`} />
                                </div>
                              )}
                              {!isSelected && <Square className="h-5 w-5 text-slate-300 hidden group-hover:block" />}
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-700 truncate">{file.fileName}</p>
                              <p className="text-xs text-slate-400 sm:hidden">{fileType}</p>
                            </div>
                            <div className="w-28 text-right text-sm text-slate-400 hidden sm:block">{fileType}</div>
                            <div className="w-28 text-right text-sm text-slate-400 hidden md:block">
                              {file.createdAt ? new Date(file.createdAt).toLocaleDateString('cs-CZ') : '-'}
                            </div>
                            <div className="w-6"></div>
                          </div>
                        );
                      })}
                      
                      {/* Links */}
                      {sortContent(getRootLinks(), 'link').map((link) => {
                        const isSelected = selectedItems.has(`link:${link.id}`);
                        return (
                          <div 
                            key={link.id}
                            ref={(el) => registerItemRef(`link:${link.id}`, el)}
                            data-selectable-item
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('documentId', link.id);
                              e.dataTransfer.setData('itemType', 'link');
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            onClick={(e) => {
                              if (e.ctrlKey || e.metaKey || e.shiftKey || selectedItems.size > 0) {
                                handleItemSelect(link.id, 'link', e);
                              } else {
                                handleOpenLink(link);
                              }
                            }}
                            className={`flex items-center gap-4 px-4 py-3 rounded-xl cursor-pointer group transition-colors ${
                              isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                            }`}
                          >
                            <button
                              onClick={(e) => { e.stopPropagation(); handleItemSelect(link.id, 'link', e); }}
                              className="w-10 h-10 flex items-center justify-center shrink-0"
                            >
                              {isSelected ? (
                                <CheckSquare className="h-5 w-5 text-blue-500" />
                              ) : (
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm group-hover:hidden" style={{ backgroundColor: link.bgColor }}>
                                  <Link2 className="h-5 w-5" style={{ color: link.color }} />
                                </div>
                              )}
                              {!isSelected && <Square className="h-5 w-5 text-slate-300 hidden group-hover:block" />}
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-700 truncate">{link.title}</p>
                              <p className="text-xs text-slate-400 sm:hidden">{link.domain}</p>
                            </div>
                            <div className="w-28 text-right text-sm text-slate-400 hidden sm:block">{link.domain}</div>
                            <div className="w-28 text-right text-sm text-slate-400 hidden md:block">
                              {link.createdAt ? new Date(link.createdAt).toLocaleDateString('cs-CZ') : '-'}
                            </div>
                            <div className="w-6"></div>
                          </div>
                        );
                      })}
                      
                      {/* Empty state in list */}
                      {myFolders.filter(f => f.copiedFrom !== 'vividbooks-category' && f.type === 'folder').length === 0 && myDocuments.length === 0 && getRootWorksheets().length === 0 && rootQuizzes.length === 0 && getRootFiles().length === 0 && getRootLinks().length === 0 && (
                        <div className="text-center py-12 text-muted-foreground">
                          <Folder className="h-10 w-10 mx-auto mb-3 opacity-30" />
                          <p>Zatím nemáte žádný obsah</p>
                        </div>
                      )}
                    </div>
                    )}

                    {/* Empty State - only show in grid mode */}
                    {viewMode === 'grid' && myFolders.filter(f => f.copiedFrom !== 'vividbooks-category' && f.type === 'folder').length === 0 && myDocuments.length === 0 && getRootWorksheets().length === 0 && rootQuizzes.length === 0 && getRootFiles().length === 0 && getRootLinks().length === 0 && (
                      <div className="text-center py-16 border-2 border-dashed rounded-2xl bg-accent/10">
                        <Folder className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                        <p className="text-muted-foreground font-medium">Zatím nemáte žádné soubory</p>
                        <p className="text-sm text-muted-foreground mt-1 mb-4">
                          {ecosystemAccess.canCreateContent
                            ? 'Vytvořte si první dokument nebo složku'
                            : 'Vytvořte si první složku'
                          }
                        </p>
                        <div className="flex gap-3 justify-center">
                          <Button
                            onClick={handleCreateFolder}
                            variant="outline"
                            className="gap-2"
                          >
                            <FolderPlus className="h-4 w-4" />
                            Nová složka
                          </Button>
                          {ecosystemAccess.canCreateContent && (
                          <>
                          <Button
                            onClick={handleCreateDocument}
                            className="gap-2 bg-[#4E5871] hover:bg-[#3d455a]"
                          >
                            <FilePlus className="h-4 w-4" />
                            Nový dokument
                          </Button>
                          <Button
                            onClick={() => fileInputRef.current?.click()}
                            variant="outline"
                            className="gap-2"
                          >
                            <Upload className="h-4 w-4" />
                            Nahrát soubor
                          </Button>
                          </>
                          )}
                        </div>
                      </div>
                    )}
                    </div>{/* End space-y-4 */}
                  </div>{/* End lasso container */}
                </div>

                {/* Zkopírováno z VividBooks Section */}
                {myFolders.filter(f => f.copiedFrom === 'vividbooks-category').length > 0 && (
                  <div className="mb-12">
                    <h2 className="text-lg font-semibold text-[#4E5871] mb-6 flex items-center gap-2">
                      <Copy className="h-5 w-5" />
                      Zkopírováno z VividBooks
                    </h2>
                    
                    <div className="flex flex-wrap gap-8">
                      {sortContent(myFolders.filter(f => f.copiedFrom === 'vividbooks-category'), 'folder').map((item) => (
                        <FolderCard 
                          key={item.id}
                          item={item}
                          onClick={() => setOpenFolder(item)}
                          onMenuClick={(action) => {
                            if (action === 'rename') handleStartRename(item);
                            if (action === 'delete') handleStartDelete(item);
                          }}
                          onDrop={(docId) => handleMoveDocumentToFolder(docId, item.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

           </div>
        </main>
      </div>

      {/* Create Folder Dialog */}
      <Dialog open={createFolderOpen} onOpenChange={setCreateFolderOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderPlus className="h-5 w-5 text-[#4E5871]" />
              Nová složka
            </DialogTitle>
            <DialogDescription>
              Zadejte název pro novou složku. Složku můžete později přejmenovat.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Název složky..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleConfirmCreateFolder();
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateFolderOpen(false)}>
              Zrušit
            </Button>
            <Button 
              onClick={handleConfirmCreateFolder}
              disabled={!newFolderName.trim()}
              className="bg-[#4E5871] hover:bg-[#3d455a]"
            >
              Vytvořit složku
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Folder Dialog */}
      <Dialog open={editFolderOpen} onOpenChange={setEditFolderOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-[#4E5871]" />
              Přejmenovat složku
            </DialogTitle>
            <DialogDescription>
              Zadejte nový název pro složku "{editingFolder?.name}".
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Nový název složky..."
              value={editFolderName}
              onChange={(e) => setEditFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleConfirmRename();
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditFolderOpen(false)}>
              Zrušit
            </Button>
            <Button 
              onClick={handleConfirmRename}
              disabled={!editFolderName.trim()}
              className="bg-[#4E5871] hover:bg-[#3d455a]"
            >
              Uložit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Folder Confirmation Dialog */}
      <Dialog open={deleteFolderOpen} onOpenChange={setDeleteFolderOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Smazat složku
            </DialogTitle>
            <DialogDescription>
              Opravdu chcete smazat složku "{deletingFolder?.name}"? Tato akce je nevratná.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDeleteFolderOpen(false)}>
              Zrušit
            </Button>
            <Button 
              onClick={handleConfirmDelete}
              variant="destructive"
            >
              Smazat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Supabase Server Snapshot Dialog */}
      <Dialog open={serverSnapshotOpen} onOpenChange={setServerSnapshotOpen}>
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>Seznam souborů na Supabase (debug)</DialogTitle>
            <DialogDescription>
              Toto je serverový stav pro aktuálně přihlášený účet. Kopii najdete i v konzoli pod `[SupabaseSnapshot]`.
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm space-y-2">
            {serverSnapshot ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div><strong>Boards:</strong> {serverSnapshot.boards?.length ?? 0}</div>
                  <div><strong>Docs:</strong> {serverSnapshot.documents?.length ?? 0}</div>
                  <div><strong>Folders:</strong> {serverSnapshot.folders?.length ?? 0}</div>
                  <div><strong>Worksheets:</strong> {serverSnapshot.worksheets?.length ?? 0}</div>
                  <div><strong>Files:</strong> {serverSnapshot.files?.length ?? 0}</div>
                  <div><strong>Links:</strong> {serverSnapshot.links?.length ?? 0}</div>
                </div>
                <div className="max-h-[320px] overflow-auto rounded border border-slate-200 bg-slate-50 p-3 font-mono text-[11px] whitespace-pre">
                  {JSON.stringify(serverSnapshot, null, 2)}
                </div>
              </>
            ) : (
              <div className="text-muted-foreground">Snapshot není k dispozici.</div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setServerSnapshotOpen(false)}>Zavřít</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Smazat {selectedItems.size} {selectedItems.size === 1 ? 'položku' : selectedItems.size < 5 ? 'položky' : 'položek'}
            </DialogTitle>
            <DialogDescription>
              Opravdu chcete smazat {selectedItems.size} {selectedItems.size === 1 ? 'vybranou položku' : 'vybraných položek'}? Tato akce je nevratná.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>
              Zrušit
            </Button>
            <Button 
              onClick={confirmBulkDelete}
              variant="destructive"
            >
              Smazat vše
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Folder Dialog */}
      <Dialog open={shareFolderOpen} onOpenChange={setShareFolderOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5 text-blue-500" />
              Sdílet složku se třídou
            </DialogTitle>
            <DialogDescription>
              Vyberte třídy, se kterými chcete sdílet složku "{sharingFolder?.name}". Žáci uvidí tuto složku ve svém dashboardu.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-2 py-4">
            {availableClasses.map((cls) => {
              const isShared = sharingFolder?.sharedWithClasses?.some(c => c.id === cls.id);
              return (
                <button
                  key={cls.id}
                  onClick={() => handleToggleClassShare(cls)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                    isShared 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: cls.color }}
                  >
                    {cls.name.slice(0, 2)}
                  </div>
                  <span className="flex-1 text-left font-medium text-slate-700">{cls.name}</span>
                  {isShared && (
                    <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                  )}
                </button>
              );
            })}
            
            {availableClasses.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Nemáte žádné třídy</p>
                <p className="text-sm">Vytvořte třídu v sekci Třídy</p>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button onClick={() => setShareFolderOpen(false)}>
              Hotovo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* File Preview Modal */}
      {previewFile && (
        <FilePreviewModal
          file={previewFile}
          fileUrl={previewFileUrl}
          onClose={handleCloseFilePreview}
          onDownload={() => downloadFile(previewFile)}
          onCreateWorksheet={handleCreateWorksheetFromFile}
          onCreateQuiz={handleCreateQuizFromFile}
        />
      )}

      {/* Global Lasso Selection Overlay - renders at page level for full-page lasso */}
      {isSelecting && selectionRect && (
        <div
          className="fixed pointer-events-none z-[9999]"
          style={{
            left: Math.min(selectionRect.startX, selectionRect.endX),
            top: Math.min(selectionRect.startY, selectionRect.endY),
            width: Math.abs(selectionRect.endX - selectionRect.startX),
            height: Math.abs(selectionRect.endY - selectionRect.startY),
            backgroundColor: 'rgba(59, 130, 246, 0.15)',
            border: '2px solid rgba(59, 130, 246, 0.6)',
            borderRadius: '4px',
          }}
        />
      )}

      {/* Add Link Modal */}
      <AddLinkModal
        isOpen={addLinkModalOpen}
        onClose={() => setAddLinkModalOpen(false)}
        onAdd={handleAddLink}
        currentFolderId={openFolder?.id}
      />

      {/* Link Preview Modal */}
      {previewLink && (
        <LinkPreviewModal
          link={previewLink}
          onClose={() => setPreviewLink(null)}
          onCreateWorksheet={handleCreateWorksheetFromLink}
          onCreateQuiz={handleCreateQuizFromLink}
        />
      )}
    </div>
  );
}
