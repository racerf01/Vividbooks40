/**
 * AdminColumnBrowser - macOS Finder-style column browser for admin content
 * 
 * Features:
 * - Column-based navigation
 * - Documents grouped by type
 * - Compact rows for better overview
 * - Click to edit
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Plus,
  FileText,
  MoreHorizontal,
  Trash2,
  Edit2,
  RefreshCw,
  Home,
  ArrowLeft,
  Check,
  X,
  Move,
  Copy,
  Eye,
  ExternalLink,
  Calendar,
  Database,
  Tag,
  Loader2,
  Bot,
  Sparkles,
  LayoutGrid,
  Image,
  Settings,
  Download,
  BarChart3,
  BookOpen,
  Book,
  LogOut,
  Upload
} from 'lucide-react';
import { AIContentAgent } from './AIContentAgent';
import { projectId } from '../../utils/supabase/info';
import { supabase } from '../../utils/supabase/client';
import { extractTextFromPDF, syncPdfTranscriptToRAG } from '../../utils/gemini-rag';
import { DOCUMENT_TYPES } from '../../types/document-types';
import { saveWorksheet } from '../../utils/worksheet-storage';
import { importBoardFromLegacy, isImportableBoardUrl } from '../../utils/board-import';
import { saveQuiz, getQuiz } from '../../utils/quiz-storage';
import { createEmptyQuiz } from '../../types/quiz';
import type { Worksheet } from '../../types/worksheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '../ui/dropdown-menu';

/**
 * Utility to get current session reliably, trying localStorage first
 * then falling back to Supabase API with a timeout to prevent hanging.
 */
async function getSupabaseSession() {
  // Method 1: Try localStorage
  try {
    const storageKey = `sb-njbtqmsxbyvpwigfceke-auth-token`;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.access_token) {
        console.log('[Auth] Got token from localStorage');
        return {
          data: {
            session: {
              access_token: parsed.access_token,
              user: parsed.user
            }
          },
          error: null
        };
      }
    }
  } catch (e) {
    console.error('[Auth] Error reading from localStorage:', e);
  }

  // Method 2: Fallback to getSession with timeout
  try {
    const sessionPromise = supabase.auth.getSession();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Session timeout')), 3000)
    );
    const result = await Promise.race([sessionPromise, timeoutPromise]) as any;
    console.log('[Auth] Got session from API:', result?.data?.session ? 'yes' : 'no');
    return {
      data: { session: result?.data?.session || null },
      error: result?.error || null
    };
  } catch (e) {
    console.error('[Auth] Session fetch failed/timeout:', e);
    return { data: { session: null }, error: e };
  }
}

// =============================================
// TYPES
// =============================================

interface WorksheetLink {
  label: string;
  url?: string;
  itemId?: string; // Reference to another MenuItem
  level?: number; // For practice items (1, 2, 3)
}

interface ExtendedWorksheetData {
  isExtended?: boolean;
  solutionPdf?: WorksheetLink;
  interactive?: WorksheetLink[];
  textbook?: WorksheetLink;
  methodology?: WorksheetLink;
  practice?: WorksheetLink[];
  minigames?: WorksheetLink[];
  tests?: WorksheetLink[];
  exams?: WorksheetLink[];
  bonuses?: WorksheetLink[];
}

interface WorkbookPage {
  id: string;
  pageNumber: number;        // Číslo stránky v sešitu (str. X)
  worksheetId: string;       // ID pracovního listu
  worksheetSlug: string;     // Slug pro navigaci
  worksheetLabel: string;    // Název pracovního listu
  worksheetCover?: string;   // Náhled
}

interface WorkbookBonus {
  id: string;
  label: string;
  url?: string;
  type?: 'link' | 'pdf' | 'file';
}

interface MenuItem {
  id: string;
  label: string;
  slug?: string;
  type?: string;
  icon?: string;
  color?: string;
  textColor?: string;  // Barva textu v hlavičce složky
  coverImage?: string;
  children?: MenuItem[];
  externalUrl?: string;
  url?: string;
  viewMode?: 'classic' | 'rich';
  contentView?: 'standard' | 'overview';
  layoutMode?: string;
  extendedWorksheet?: ExtendedWorksheetData;
  workbookPages?: WorkbookPage[];  // Pro typ 'workbook' - stránky sešitu
  pdfTranscript?: string;  // Přepis PDF dokumentu pomocí AI
  // Workbook metadata
  author?: string;
  eshopUrl?: string;
  bonuses?: WorkbookBonus[];
}

interface Category {
  id: string;
  label: string;
  color: string;
}

const CATEGORIES: Category[] = [
  { id: 'fyzika', label: 'Fyzika', color: '#7c3aed' },
  { id: 'chemie', label: 'Chemie', color: '#ef4444' },
  { id: 'prirodopis', label: 'Přírodopis', color: '#22c55e' },
  { id: 'matematika', label: 'Matematika', color: '#3b82f6' },
  { id: 'dejepis', label: 'Dějepis', color: '#d97706' },
  { id: 'navody', label: 'Návody', color: '#f59e0b' },
  { id: 'knihovna-vividbooks', label: 'Knihovna Vividbooks', color: '#06b6d4' },
];

interface AdminColumnBrowserProps {
  activeCategory: string;
  onSelectDocument: (category: string, slug: string, type?: string) => void;
  onCreateDocument?: (parentId: string | null, type: string) => void;
}

// =============================================
// HELPER FUNCTIONS
// =============================================

// Check if item is a folder
const isFolder = (item: MenuItem): boolean => {
  return !!(item.children && item.children.length > 0) || 
         item.type === 'folder' || 
         item.type === 'group';
};

// Get document type info
const getDocTypeInfo = (type?: string) => {
  const docType = DOCUMENT_TYPES.find(t => t.id === type);
  return docType || { id: 'document', label: 'Dokument', icon: FileText, color: 'text-slate-600', bgColor: 'bg-slate-50' };
};

// Group items by type
const groupItemsByType = (items: MenuItem[]): Map<string, MenuItem[]> => {
  const groups = new Map<string, MenuItem[]>();
  
  // First add folders (NOT workbooks)
  const folders = items.filter(item => isFolder(item) && item.type !== 'workbook');
  if (folders.length > 0) {
    groups.set('_folders', folders);
  }
  
  // Then add workbooks separately
  const workbooks = items.filter(item => item.type === 'workbook');
  if (workbooks.length > 0) {
    groups.set('_workbooks', workbooks);
  }
  
  // Then group documents by type (exclude folders and workbooks)
  const documents = items.filter(item => !isFolder(item) && item.type !== 'workbook');
  documents.forEach(item => {
    const type = item.type || 'document';
    if (!groups.has(type)) {
      groups.set(type, []);
    }
    groups.get(type)!.push(item);
  });
  
  return groups;
};

// =============================================
// COLUMN COMPONENT
// =============================================

interface ColumnProps {
  items: MenuItem[];
  selectedId: string | null;
  onSelect: (item: MenuItem) => void;
  onDoubleClick: (item: MenuItem) => void;
  title?: string;
  isLoading?: boolean;
  level: number;
  onCreateNew?: (type: string) => void;
  onFileDrop?: (files: File[]) => void;
  // Multi-select
  checkedItems: Set<string>;
  onToggleCheck: (itemId: string, e: React.MouseEvent) => void;
}

function Column({ items, selectedId, onSelect, onDoubleClick, title, isLoading, level, onCreateNew, onFileDrop, checkedItems, onToggleCheck }: ColumnProps) {
  const groupedItems = groupItemsByType(items);
  const [isDragOver, setIsDragOver] = useState(false);
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files).filter(
      file => file.type === 'application/pdf'
    );
    
    if (files.length > 0 && onFileDrop) {
      onFileDrop(files);
    }
  };
  
  return (
    <div 
      className={`flex-shrink-0 h-full flex flex-col bg-white border-r border-slate-200 transition-colors ${
        isDragOver ? 'bg-green-50 border-green-400 border-2' : ''
      }`}
      style={{ width: 260, minWidth: 260 }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Column Header */}
      {title && (
        <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">
            {title}
          </span>
          {onCreateNew && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1 hover:bg-slate-200 rounded transition-colors">
                  <Plus className="w-3.5 h-3.5 text-slate-500" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => onCreateNew('folder')}>
                  <Folder className="w-4 h-4 mr-2 text-amber-600" />
                  Složka
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onCreateNew('workbook')}>
                  <Book className="w-4 h-4 mr-2 text-indigo-600" />
                  Pracovní sešit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onCreateNew('document')}>
                  <FileText className="w-4 h-4 mr-2 text-blue-600" />
                  Dokument
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onCreateNew('board')}>
                  <LayoutGrid className="w-4 h-4 mr-2 text-purple-600" />
                  Board
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onCreateNew('worksheet-pdf')}>
                  <FileText className="w-4 h-4 mr-2 text-green-600" />
                  Pracovní list (PDF)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onCreateNew('worksheet-editor')}>
                  <Edit2 className="w-4 h-4 mr-2 text-green-600" />
                  Pracovní list editor
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onCreateNew('link')}>
                  <ExternalLink className="w-4 h-4 mr-2 text-indigo-600" />
                  Odkaz
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}
      
      {/* Column Content */}
      <div className="flex-1 overflow-y-auto relative">
        {/* Drag overlay */}
        {isDragOver && (
          <div className="absolute inset-0 bg-green-100/90 flex flex-col items-center justify-center z-10 pointer-events-none">
            <Plus className="w-8 h-8 text-green-600 mb-2" />
            <span className="text-sm font-medium text-green-700">Pusťte PDF sem</span>
          </div>
        )}
        
        {isLoading ? (
          <div className="flex items-center justify-center h-20">
            <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-400">
            Prázdná složka
            <div className="mt-2 text-[10px] text-slate-300">
              Přetáhněte PDF soubory sem
            </div>
          </div>
        ) : (
          <>
            {Array.from(groupedItems.entries()).map(([typeKey, typeItems]) => {
              const isFolderGroup = typeKey === '_folders';
              const isWorkbookGroup = typeKey === '_workbooks';
              const isDocumentGroup = !isFolderGroup && !isWorkbookGroup;
              const docType = isDocumentGroup ? getDocTypeInfo(typeKey) : null;
              
              return (
                <div key={typeKey}>
                  {/* Type Header */}
                  {isFolderGroup && (
                    <div className="px-3 py-1.5 bg-amber-50/50 border-b border-amber-100">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-600">
                        Složky ({typeItems.length})
                      </span>
                    </div>
                  )}
                  {isWorkbookGroup && (
                    <div className="px-3 py-1.5 bg-indigo-50/50 border-b border-indigo-100">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600">
                        Pracovní sešity ({typeItems.length})
                      </span>
                    </div>
                  )}
                  {isDocumentGroup && docType && (
                    <div className="px-3 py-1.5 bg-slate-50/50 border-b border-slate-100">
                      <span className={`text-[10px] font-semibold uppercase tracking-wider ${docType.color}`}>
                        {docType.label} ({typeItems.length})
                      </span>
                    </div>
                  )}
                  
                  {/* Items */}
                  {typeItems.map(item => {
                    const isSelected = item.id === selectedId;
                    const isChecked = checkedItems.has(item.id);
                    const itemIsFolder = isFolder(item);
                    const itemIsWorkbook = item.type === 'workbook';
                    const itemDocType = !itemIsFolder && !itemIsWorkbook ? getDocTypeInfo(item.type) : null;
                    
                    // Icon selection: workbook > folder > document type
                    let IconComponent;
                    let iconColor = '';
                    if (itemIsWorkbook) {
                      IconComponent = Book;
                      iconColor = 'text-indigo-600';
                    } else if (itemIsFolder) {
                      IconComponent = isSelected ? FolderOpen : Folder;
                      iconColor = 'text-amber-600';
                    } else {
                      IconComponent = itemDocType?.icon || FileText;
                      iconColor = itemDocType?.color || 'text-slate-500';
                    }
                    
                    return (
                      <div
                        key={item.id}
                        className={`
                          flex items-center gap-1.5 px-2 py-1 cursor-pointer border-b border-slate-50
                          transition-colors group
                          ${isChecked
                            ? 'bg-indigo-100'
                            : isSelected 
                              ? 'bg-indigo-500 text-white' 
                              : 'hover:bg-slate-50 text-slate-700'
                          }
                        `}
                        onClick={() => onSelect(item)}
                        onDoubleClick={() => onDoubleClick(item)}
                      >
                        {/* Checkbox */}
                        <button
                          onClick={(e) => onToggleCheck(item.id, e)}
                          className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                            isChecked 
                              ? 'bg-indigo-500 border-indigo-500' 
                              : isSelected
                                ? 'border-white/50 hover:border-white'
                                : 'border-slate-300 hover:border-slate-400 opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3 text-white" />}
                        </button>
                        
                        {/* Icon */}
                        <IconComponent 
                          className={`w-3.5 h-3.5 flex-shrink-0 ${
                            isSelected && !isChecked
                              ? 'text-white' 
                              : iconColor
                          }`}
                        />
                        
                        {/* Label */}
                        <span className={`flex-1 text-xs truncate ${isSelected && !isChecked ? 'text-white' : ''}`}>
                          {item.label}
                        </span>
                        
                        {/* Chevron for folders */}
                        {itemIsFolder && (
                          <ChevronRight className={`w-3 h-3 flex-shrink-0 ${isSelected && !isChecked ? 'text-white/70' : 'text-slate-300'}`} />
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

// =============================================
// EXTENDED WORKSHEET FIELDS COMPONENT
// =============================================

interface ExtendedFieldProps {
  label: string;
  fieldKey: keyof ExtendedWorksheetData;
  isArray?: boolean;
  showLevel?: boolean; // For practice items
  selectedItem: MenuItem;
  setSelectedItem: (item: MenuItem) => void;
  menuStructure: MenuItem[];
  setMenuStructure: (menu: MenuItem[]) => void;
  siblingItems: MenuItem[];
}

function ExtendedField({ label, fieldKey, isArray, showLevel, selectedItem, setSelectedItem, menuStructure, setMenuStructure, siblingItems }: ExtendedFieldProps) {
  const extData = selectedItem.extendedWorksheet || {};
  const currentValue = extData[fieldKey] as WorksheetLink | WorksheetLink[] | undefined;
  const items = isArray ? (currentValue as WorksheetLink[] || []) : (currentValue ? [currentValue as WorksheetLink] : []);
  
  const updateField = (newValue: WorksheetLink | WorksheetLink[] | undefined) => {
    const updatedItem = {
      ...selectedItem,
      extendedWorksheet: {
        ...extData,
        [fieldKey]: newValue
      }
    };
    setSelectedItem(updatedItem);
    const updateItem = (menuItems: MenuItem[]): MenuItem[] => menuItems.map(item => 
      item.id === selectedItem.id ? updatedItem : 
      item.children ? { ...item, children: updateItem(item.children) } : item
    );
    setMenuStructure(updateItem(menuStructure));
  };
  
  const addItem = () => {
    if (isArray) {
      updateField([...items, { label: '', url: '' }]);
    } else {
      updateField({ label: '', url: '' });
    }
  };
  
  const removeItem = (index: number) => {
    if (isArray) {
      const newItems = items.filter((_, i) => i !== index);
      updateField(newItems.length > 0 ? newItems : undefined);
    } else {
      updateField(undefined);
    }
  };
  
  const updateItem = (index: number, updates: Partial<WorksheetLink>) => {
    const newItems = items.map((item, i) => i === index ? { ...item, ...updates } : item);
    if (isArray) {
      updateField(newItems);
    } else {
      updateField(newItems[0]);
    }
  };
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-600">{label}</span>
        {(isArray || items.length === 0) && (
          <button
            onClick={addItem}
            className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Přidat
          </button>
        )}
      </div>
      
      {items.map((item, index) => (
        <div key={index} className="bg-slate-50 rounded-lg p-2 space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={item.label || ''}
              onChange={(e) => updateItem(index, { label: e.target.value })}
              placeholder="Název..."
              className="flex-1 px-2 py-1 text-xs border rounded"
            />
            <button onClick={() => removeItem(index)} className="text-red-500 hover:text-red-700">
              <X className="w-3 h-3" />
            </button>
          </div>
          
          <div className="flex gap-1">
            <input
              type="url"
              value={item.url || ''}
              onChange={(e) => updateItem(index, { url: e.target.value, itemId: undefined })}
              placeholder="URL odkazu..."
              className="flex-1 px-2 py-1 text-xs border rounded"
            />
            {/* Level selector for practice items */}
            {showLevel && (
              <select
                value={item.level || 1}
                onChange={(e) => updateItem(index, { level: parseInt(e.target.value) })}
                className="w-16 px-1 py-1 text-xs border rounded bg-white"
                title="Úroveň"
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            )}
          </div>
          
          {/* Select from siblings */}
          <select
            value={item.itemId || ''}
            onChange={(e) => {
              const selectedId = e.target.value;
              if (selectedId) {
                const selected = siblingItems.find(s => s.id === selectedId);
                if (selected) {
                  updateItem(index, { 
                    itemId: selectedId, 
                    label: item.label || selected.label,
                    url: selected.url || `/docs/${selected.slug}` 
                  });
                }
              } else {
                updateItem(index, { itemId: undefined });
              }
            }}
            className="w-full px-2 py-1 text-xs border rounded bg-white"
          >
            <option value="">Nebo vybrat ze složky...</option>
            {siblingItems.filter(s => s.id !== selectedItem.id).map(s => (
              <option key={s.id} value={s.id}>
                {s.label} ({s.type || 'dokument'})
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}

interface ExtendedWorksheetFieldsProps {
  selectedItem: MenuItem;
  setSelectedItem: (item: MenuItem) => void;
  menuStructure: MenuItem[];
  setMenuStructure: (menu: MenuItem[]) => void;
  columns: { parentId: string | null; items: MenuItem[] }[];
  currentCategory: string;
}

function ExtendedWorksheetFields({ selectedItem, setSelectedItem, menuStructure, setMenuStructure, columns, currentCategory }: ExtendedWorksheetFieldsProps) {
  // Get sibling items from current folder
  const currentColumn = columns.find(col => col.items.some(item => item.id === selectedItem.id));
  const siblingItems = currentColumn?.items || [];
  
  // Also get all items from menu for broader selection
  const getAllItems = (items: MenuItem[]): MenuItem[] => {
    return items.flatMap(item => [item, ...(item.children ? getAllItems(item.children) : [])]);
  };
  const allItems = getAllItems(menuStructure);
  
  const fieldProps = {
    selectedItem,
    setSelectedItem,
    menuStructure,
    setMenuStructure,
    siblingItems: [...siblingItems, ...allItems.filter(i => !siblingItems.some(s => s.id === i.id))].slice(0, 50) // Limit for performance
  };
  
  return (
    <div className="mt-3 space-y-3 pl-2 border-l-2 border-indigo-200">
      <ExtendedField label="Řešení PDF" fieldKey="solutionPdf" {...fieldProps} />
      <ExtendedField label="Interaktivní pracovní list" fieldKey="interactive" isArray {...fieldProps} />
      <ExtendedField label="Učební text" fieldKey="textbook" {...fieldProps} />
      <ExtendedField label="Metodika" fieldKey="methodology" {...fieldProps} />
      <ExtendedField label="Procvičování" fieldKey="practice" isArray showLevel {...fieldProps} />
      <ExtendedField label="Procvičovací minihry" fieldKey="minigames" isArray {...fieldProps} />
      <ExtendedField label="Testy" fieldKey="tests" isArray {...fieldProps} />
      <ExtendedField label="Písemky" fieldKey="exams" isArray {...fieldProps} />
      <ExtendedField label="Bonusy" fieldKey="bonuses" isArray {...fieldProps} />
    </div>
  );
}

// =============================================
// MAIN COMPONENT
// =============================================

export function AdminColumnBrowser({ activeCategory, onSelectDocument, onCreateDocument }: AdminColumnBrowserProps) {
  console.log('[AdminColumnBrowser] Render with activeCategory:', activeCategory);
  
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Use activeCategory directly - no internal state duplication
  // This ensures the component always shows what the URL says
  const currentCategory = activeCategory;
  
  // State for menu structure
  const [menuStructure, setMenuStructure] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // State for column navigation - array of {parentId, items, selectedId}
  const [columns, setColumns] = useState<Array<{
    parentId: string | null;
    items: MenuItem[];
    selectedId: string | null;
    title: string;
  }>>([]);
  
  // Selected item for preview/info
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [selectedPageDetails, setSelectedPageDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // AI Agent panel
  const [showAIAgent, setShowAIAgent] = useState(false);
  
  // Board conversion state
  const [convertingBoard, setConvertingBoard] = useState(false);
  
  // Handle linking board to worksheet when returning from editor
  useEffect(() => {
    const linkBoardId = searchParams.get('linkBoard');
    const linkToItemId = searchParams.get('linkToItem');
    
    if (linkBoardId && linkToItemId && menuStructure.length > 0) {
      console.log('[AdminColumnBrowser] Linking board', linkBoardId, 'to item', linkToItemId);
      
      // Find and update the item
      const updateItem = (items: MenuItem[]): MenuItem[] => items.map(item => {
        if (item.id === linkToItemId) {
          // Add board to interactive field
          const extendedWorksheet = item.extendedWorksheet || {};
          const interactive = extendedWorksheet.interactive || [];
          
          // Check if already linked
          const boardUrl = `board://${linkBoardId}`;
          if (!interactive.some(i => i.url === boardUrl)) {
            console.log('[AdminColumnBrowser] Adding interactive board link:', boardUrl);
            return {
              ...item,
              extendedWorksheet: {
                ...extendedWorksheet,
                isExtended: true,
                interactive: [...interactive, { 
                  label: 'Interaktivní verze', 
                  url: boardUrl 
                }]
              }
            };
          }
        }
        if (item.children) {
          return { ...item, children: updateItem(item.children) };
        }
        return item;
      });
      
      const updatedMenu = updateItem(menuStructure);
      setMenuStructure(updatedMenu);
      
      // Save to server
      (async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            await fetch(
              `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/menu`,
              {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ menu: updatedMenu, category: currentCategory }),
              }
            );
            console.log('[AdminColumnBrowser] ✓ Menu updated with board link');
          }
        } catch (e) {
          console.error('[AdminColumnBrowser] Failed to save board link:', e);
        }
      })();
      
      // Clear URL params
      searchParams.delete('linkBoard');
      searchParams.delete('linkToItem');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, menuStructure, currentCategory]);
  
  // New item dialog (folder, document, board, etc.)
  const [showItemDialog, setShowItemDialog] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemUrl, setNewItemUrl] = useState('');
  const [newItemPdfFile, setNewItemPdfFile] = useState<File | null>(null);
  const [newItemPreviewFile, setNewItemPreviewFile] = useState<File | null>(null);
  const [pendingItemColumn, setPendingItemColumn] = useState<number | null>(null);
  const [pendingItemType, setPendingItemType] = useState<string>('folder');
  const [isUploading, setIsUploading] = useState(false);
  
  // Fetch page details when item is selected
  useEffect(() => {
    const fetchPageDetails = async () => {
      if (!selectedItem || isFolder(selectedItem) || !selectedItem.slug) {
        setSelectedPageDetails(null);
        return;
      }
      
      setLoadingDetails(true);
      try {
        const { data: { session } } = await getSupabaseSession();
        const accessToken = session?.access_token;
        
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/pages/${selectedItem.slug}?category=${currentCategory}`,
          {
            headers: accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}
          }
        );
        
        if (response.ok) {
          const responseData = await response.json();
          // Backend returns { page: {...} } so extract the page object
          const data = responseData.page || responseData;
          console.log('[AdminColumnBrowser] Page details loaded:', data);
          console.log('[AdminColumnBrowser] worksheetData:', data.worksheetData);
          setSelectedPageDetails(data);
          
          // If page has worksheetData, populate extendedWorksheet on the selectedItem
          if (data.worksheetData && selectedItem.type === 'worksheet') {
            const wd = data.worksheetData;
            const hasAnyExtendedData = wd.solutionPdfUrl || wd.textbookUrl || wd.methodologyUrl || 
              (wd.exercises?.length > 0) || (wd.minigames?.length > 0) || (wd.tests?.length > 0) ||
              (wd.exams?.length > 0) || (wd.bonuses?.length > 0) || (wd.interactiveWorksheets?.length > 0);
            
            if (hasAnyExtendedData && !selectedItem.extendedWorksheet?.isExtended) {
              const extendedWorksheet: ExtendedWorksheetData = {
                isExtended: true,
                solutionPdf: wd.solutionPdfUrl ? { label: 'Řešení', url: wd.solutionPdfUrl } : undefined,
                interactive: (wd.interactiveWorksheets || []).map((i: any) => ({ label: i.label || 'Interaktivní', url: i.url })),
                textbook: wd.textbookUrl ? { label: 'Učební text', url: wd.textbookUrl } : undefined,
                methodology: wd.methodologyUrl ? { label: 'Metodika', url: wd.methodologyUrl } : undefined,
                practice: (wd.exercises || []).map((e: any) => ({ label: e.label || 'Procvičování', url: e.url, level: e.level || 1 })),
                minigames: (wd.minigames || []).map((m: any) => ({ label: m.label || 'Minihra', url: m.url })),
                tests: (wd.tests || []).map((t: any) => ({ label: t.label || 'Test', url: t.url })),
                exams: (wd.exams || []).map((e: any) => ({ label: e.label || 'Písemka', url: e.url })),
                bonuses: (wd.bonuses || []).map((b: any) => ({ label: b.label || 'Bonus', url: b.url })),
              };
              
              // Update selectedItem with extendedWorksheet
              const updatedItem = { ...selectedItem, extendedWorksheet };
              setSelectedItem(updatedItem);
              
              // Also update in menuStructure
              const updateItem = (items: MenuItem[]): MenuItem[] => items.map(item => 
                item.id === selectedItem.id ? updatedItem : 
                item.children ? { ...item, children: updateItem(item.children) } : item
              );
              setMenuStructure(updateItem(menuStructure));
            }
          }
        } else {
          setSelectedPageDetails(null);
        }
      } catch (err) {
        console.error('Error fetching page details:', err);
        setSelectedPageDetails(null);
      } finally {
        setLoadingDetails(false);
      }
    };
    
    fetchPageDetails();
  }, [selectedItem, currentCategory]);
  
  // Multi-select state for bulk actions
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveTargetId, setMoveTargetId] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  
  // Toggle item check
  const toggleItemCheck = (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };
  
  // Clear all checks
  const clearChecks = () => {
    setCheckedItems(new Set());
  };
  
  // Update showBulkActions when checked items change
  useEffect(() => {
    setShowBulkActions(checkedItems.size > 0);
  }, [checkedItems]);
  
  // Fetch menu structure when category changes
  useEffect(() => {
    console.log('[AdminColumnBrowser] useEffect triggered, activeCategory:', activeCategory);
    
    if (!activeCategory) {
      console.log('[AdminColumnBrowser] No category, skipping fetch');
      return;
    }
    
    // CRITICAL: Reset state immediately when category changes to prevent showing stale data
    setColumns([]);
    setSelectedItem(null);
    setLoading(true);
    
    let isCurrentFetch = true;
    
    const fetchMenu = async () => {
      try {
        // Get session reliably
        const { data: { session } } = await getSupabaseSession();
        const accessToken = session?.access_token;
        
        if (!isCurrentFetch) return;
        
        console.log(`[AdminColumnBrowser] Fetching menu for category: ${activeCategory}`);
        
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/menu?category=${activeCategory}`,
          {
            headers: accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {},
            cache: 'no-store'
          }
        );
        
        if (!isCurrentFetch) return;
        
        if (response.ok) {
          const data = await response.json();
          let menu = data.menu || [];
          
          if (!isCurrentFetch) return;
          
          console.log(`[AdminColumnBrowser] Got menu with ${menu.length} root items for category "${activeCategory}":`, menu);
          
          // Helper to find worksheet by ID in the menu tree
          const findWorksheetById = (items: MenuItem[], id: string): MenuItem | null => {
            for (const item of items) {
              if (item.id === id) return item;
              if (item.children) {
                const found = findWorksheetById(item.children, id);
                if (found) return found;
              }
            }
            return null;
          };
          
          // Transform workbookPages to children for display compatibility
          const transformWorkbooks = (items: MenuItem[], allItems: MenuItem[]): MenuItem[] => {
            return items.map(item => {
              if (item.type === 'workbook' && item.workbookPages && item.workbookPages.length > 0) {
                const children: MenuItem[] = item.workbookPages
                  .sort((a, b) => a.pageNumber - b.pageNumber)
                  .map(page => {
                    const originalWorksheet = findWorksheetById(allItems, page.worksheetId);
                    const baseLabel = originalWorksheet?.label || page.worksheetLabel;
                    const cleanLabel = baseLabel.replace(/^str\.?\s*\d+\s*/i, '').trim();
                    return {
                      id: page.worksheetId,
                      label: `str. ${page.pageNumber} ${cleanLabel}`,
                      slug: originalWorksheet?.slug || page.worksheetSlug,
                      type: 'worksheet',
                      coverImage: originalWorksheet?.coverImage || page.worksheetCover,
                      extendedWorksheet: originalWorksheet?.extendedWorksheet,
                      _isWorkbookReference: true,
                      _pageNumber: page.pageNumber,
                    } as MenuItem;
                  });
                return { ...item, children };
              }
              if (item.children) {
                return { ...item, children: transformWorkbooks(item.children, allItems) };
              }
              return item;
            });
          };
          
          const transformedMenu = transformWorkbooks(menu, menu);
          
          if (!isCurrentFetch) return;
          
          setMenuStructure(transformedMenu);
          setColumns([{
            parentId: null,
            items: transformedMenu,
            selectedId: null,
            title: CATEGORIES.find(c => c.id === activeCategory)?.label || activeCategory
          }]);
        }
      } catch (err) {
        if (isCurrentFetch) {
          console.error('[AdminColumnBrowser] Failed to fetch menu:', err);
        }
      } finally {
        if (isCurrentFetch) {
          setLoading(false);
        }
      }
    };
    
    fetchMenu();
    
    return () => {
      isCurrentFetch = false;
    };
  }, [activeCategory]);
  
  // Handle category change - just navigate, the URL change will trigger re-render with new activeCategory
  const handleCategoryChange = (newCategory: string) => {
    console.log('[AdminColumnBrowser] handleCategoryChange:', newCategory);
    navigate(`/admin/${newCategory}`);
  };
  
  // Handle item selection
  const handleSelect = (item: MenuItem, columnIndex: number) => {
    // Update selection in current column
    const newColumns = [...columns.slice(0, columnIndex + 1)];
    newColumns[columnIndex] = {
      ...newColumns[columnIndex],
      selectedId: item.id
    };
    
    // If folder, add new column with children
    if (isFolder(item) && item.children) {
      newColumns.push({
        parentId: item.id,
        items: item.children,
        selectedId: null,
        title: item.label
      });
    }
    
    setColumns(newColumns);
    setSelectedItem(item);
    
    // Scroll to show new column
    setTimeout(() => {
      if (containerRef.current) {
        containerRef.current.scrollLeft = containerRef.current.scrollWidth;
      }
    }, 50);
  };
  
  // Handle double click to open document
  const handleDoubleClick = (item: MenuItem) => {
    if (!isFolder(item) && item.slug) {
      onSelectDocument(currentCategory, item.slug, item.type);
    }
  };
  
  // Create folder (called from dialog)
  const createFolder = async (columnIndex: number, folderName: string) => {
    const column = columns[columnIndex];
    const parentId = column.parentId;
    
    const slug = folderName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const id = `folder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const newFolder: MenuItem = {
      id,
      label: folderName,
      slug,
      type: 'folder',
      icon: 'folder',
      children: [],
    };
    
    // Add to menu structure
    const addToParent = (items: MenuItem[]): MenuItem[] => {
      return items.map(item => {
        if (item.id === parentId) {
          return {
            ...item,
            children: [...(item.children || []), newFolder]
          };
        }
        if (item.children) {
          return { ...item, children: addToParent(item.children) };
        }
        return item;
      });
    };
    
    let updatedMenu: MenuItem[];
    if (parentId === null || parentId === 'root') {
      // Adding to root level
      updatedMenu = [...menuStructure, newFolder];
    } else {
      // Adding as child of existing folder
      updatedMenu = addToParent(menuStructure);
    }
    
    setMenuStructure(updatedMenu);
    
    // Update column display
    setColumns(prev => {
      const updated = [...prev];
      updated[columnIndex] = {
        ...column,
        items: [...column.items, newFolder]
      };
      return updated;
    });
    
    // Save to backend
    try {
      const { data: { session } } = await getSupabaseSession();
      if (session?.access_token) {
        console.log('[AdminColumnBrowser] Saving folder to backend, menu items:', updatedMenu.length);
        const resp = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/menu`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ menu: updatedMenu, category: currentCategory }),
        });
        
        if (resp.ok) {
          console.log('[AdminColumnBrowser] Folder saved successfully');
        } else {
          const errorText = await resp.text();
          console.error('[AdminColumnBrowser] Error saving folder:', resp.status, errorText);
          alert('Chyba při ukládání složky: ' + errorText);
        }
      } else {
        console.error('[AdminColumnBrowser] No session for saving folder');
        alert('Není přihlášen - nelze uložit složku');
      }
    } catch (err) {
      console.error('Error saving folder:', err);
      alert('Chyba při ukládání: ' + (err as Error).message);
    }
  };
  
  // Handle create new
  const handleCreateNew = async (columnIndex: number, type: string) => {
    // Show dialog for all types
    setPendingItemColumn(columnIndex);
    setPendingItemType(type);
    setNewItemName('');
    setShowItemDialog(true);
  };
  
  // Actually create the item after dialog confirms
  const createItem = async (columnIndex: number, type: string, itemName: string) => {
    const column = columns[columnIndex];
    const parentId = column.parentId;
    
    if (type === 'folder') {
      // Use existing folder creation logic
      await createFolder(columnIndex, itemName);
      return;
    }
    
    // Workbook is like a folder but with type 'workbook'
    if (type === 'workbook') {
      const slug = itemName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const id = `workbook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const newWorkbook: MenuItem = {
        id,
        label: itemName,
        slug,
        type: 'workbook',
        icon: 'book',
        children: [],
        workbookPages: [],
      };
      
      // Add to menu structure (same logic as folder)
      const addToParent = (items: MenuItem[]): MenuItem[] => {
        return items.map(item => {
          if (item.id === parentId) {
            return { ...item, children: [...(item.children || []), newWorkbook] };
          }
          if (item.children) {
            return { ...item, children: addToParent(item.children) };
          }
          return item;
        });
      };
      
      let updatedMenu: MenuItem[];
      if (parentId === null || parentId === 'root') {
        updatedMenu = [...menuStructure, newWorkbook];
      } else {
        updatedMenu = addToParent(menuStructure);
      }
      
      setMenuStructure(updatedMenu);
      
      // Save to backend
      try {
        const { data: { session } } = await getSupabaseSession();
        if (session?.access_token) {
          await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/menu`,
            {
              method: 'PUT',
              headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ menu: updatedMenu, category: currentCategory })
            }
          );
        }
      } catch (err) {
        console.error('Failed to save workbook:', err);
      }
      
      return;
    }
    
    const slug = itemName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const id = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Determine actual type for storage
    let actualType = type;
    if (type === 'worksheet-pdf' || type === 'worksheet-editor') {
      actualType = 'worksheet';
    }
    
    const newItem: MenuItem = {
      id,
      label: itemName,
      slug,
      type: actualType,
      icon: type === 'board' ? 'layout-grid' : type === 'link' ? 'external-link' : 'file-text',
    };
    
    // Add to menu structure
    const addToParent = (items: MenuItem[]): MenuItem[] => {
      return items.map(item => {
        if (item.id === parentId) {
          return {
            ...item,
            children: [...(item.children || []), newItem]
          };
        }
        if (item.children) {
          return { ...item, children: addToParent(item.children) };
        }
        return item;
      });
    };
    
    let updatedMenu: MenuItem[];
    if (parentId === null || parentId === 'root') {
      updatedMenu = [...menuStructure, newItem];
    } else {
      updatedMenu = addToParent(menuStructure);
    }
    
    setMenuStructure(updatedMenu);
    
    // Update column display
    setColumns(prev => {
      const updated = [...prev];
      updated[columnIndex] = {
        ...column,
        items: [...column.items, newItem]
      };
      return updated;
    });
    
    // Create page in backend
    try {
      const { data: { session } } = await getSupabaseSession();
      if (session?.access_token) {
        // Create the page
        await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/pages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            slug,
            title: itemName,
            category: currentCategory,
            type: actualType,
            content: '',
          }),
        });
        
        // Save menu
        await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/menu`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ menu: updatedMenu, category: currentCategory }),
        });
        
        console.log(`[AdminColumnBrowser] Created ${type}: ${itemName}`);
        
        // Navigate to editor for the new item
        if (type === 'board') {
          navigate(`/quiz/new?title=${encodeURIComponent(itemName)}`);
        } else if (type === 'worksheet-editor') {
          // Create worksheet in teacher's content storage and open editor
          const newWorksheet: Worksheet = {
            id,
            title: itemName,
            description: '',
            blocks: [],
            metadata: {
              subject: 'other',
              grade: 6,
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: 'draft',
          };
          saveWorksheet(newWorksheet);
          navigate(`/library/my-content/worksheet-editor/${id}`);
        } else if (type !== 'link') {
          // Open document editor
          navigate(`/admin/${currentCategory}/${slug}`);
        }
      }
    } catch (err) {
      console.error('Error creating item:', err);
      alert('Chyba při vytváření položky');
    }
  };
  
  // Create worksheet PDF with file upload
  const createWorksheetPdf = async (columnIndex: number, itemName: string, pdfFile: File, previewFile?: File) => {
    const column = columns[columnIndex];
    const parentId = column.parentId;
    
    try {
      // Sanitize and upload PDF
      const safeName = pdfFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const pdfFileName = `worksheet-${Date.now()}-${safeName}`;
      
      const { error: pdfError } = await supabase.storage
        .from('teacher-files')
        .upload(`admin-uploads/${pdfFileName}`, pdfFile);
      
      if (pdfError) {
        alert(`Chyba při nahrávání PDF: ${pdfError.message}`);
        return;
      }
      
      const { data: pdfUrlData } = supabase.storage
        .from('teacher-files')
        .getPublicUrl(`admin-uploads/${pdfFileName}`);
      
      const pdfUrl = pdfUrlData.publicUrl;
      
      // Upload preview if provided
      let previewUrl: string | undefined;
      if (previewFile) {
        const previewFileName = `preview-${Date.now()}-${previewFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const { error: previewError } = await supabase.storage
          .from('teacher-files')
          .upload(`covers/${previewFileName}`, previewFile);
        
        if (!previewError) {
          const { data: previewUrlData } = supabase.storage
            .from('teacher-files')
            .getPublicUrl(`covers/${previewFileName}`);
          previewUrl = previewUrlData.publicUrl;
        }
      }
      
      const slug = itemName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const id = `worksheet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const newItem: MenuItem = {
        id,
        label: itemName,
        slug,
        type: 'worksheet',
        icon: 'file-text',
        url: pdfUrl,
        coverImage: previewUrl,
      };
      
      // Add to menu structure
      const addToParent = (items: MenuItem[]): MenuItem[] => {
        return items.map(item => {
          if (item.id === parentId) {
            return { ...item, children: [...(item.children || []), newItem] };
          }
          if (item.children) {
            return { ...item, children: addToParent(item.children) };
          }
          return item;
        });
      };
      
      let updatedMenu: MenuItem[];
      if (parentId === null || parentId === 'root') {
        updatedMenu = [...menuStructure, newItem];
      } else {
        updatedMenu = addToParent(menuStructure);
      }
      
      setMenuStructure(updatedMenu);
      setColumns(prev => {
        const updated = [...prev];
        updated[columnIndex] = { ...column, items: [...column.items, newItem] };
        return updated;
      });
      
      // Save to backend
      const { data: { session } } = await getSupabaseSession();
      if (session?.access_token) {
        await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/pages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body: JSON.stringify({
            slug, title: itemName, category: currentCategory, type: 'worksheet',
            worksheetData: { pdfUrl, name: itemName, previewImageUrl: previewUrl }
          }),
        });
        
        await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/menu`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body: JSON.stringify({ menu: updatedMenu, category: currentCategory }),
        });
      }
      
      console.log(`[AdminColumnBrowser] Created worksheet PDF: ${itemName}`);
    } catch (err) {
      console.error('Error creating worksheet PDF:', err);
      alert('Chyba při vytváření pracovního listu');
    }
  };
  
  // Create link
  const createLink = async (columnIndex: number, itemName: string, url: string) => {
    const column = columns[columnIndex];
    const parentId = column.parentId;
    
    const slug = itemName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const id = `link-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const newItem: MenuItem = {
      id,
      label: itemName,
      slug,
      type: 'link',
      icon: 'external-link',
      url: url || undefined,
    };
    
    const addToParent = (items: MenuItem[]): MenuItem[] => {
      return items.map(item => {
        if (item.id === parentId) {
          return { ...item, children: [...(item.children || []), newItem] };
        }
        if (item.children) {
          return { ...item, children: addToParent(item.children) };
        }
        return item;
      });
    };
    
    let updatedMenu: MenuItem[];
    if (parentId === null || parentId === 'root') {
      updatedMenu = [...menuStructure, newItem];
    } else {
      updatedMenu = addToParent(menuStructure);
    }
    
    setMenuStructure(updatedMenu);
    setColumns(prev => {
      const updated = [...prev];
      updated[columnIndex] = { ...column, items: [...column.items, newItem] };
      return updated;
    });
    
    // Save to backend
    try {
      const { data: { session } } = await getSupabaseSession();
      if (session?.access_token) {
        await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/menu`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body: JSON.stringify({ menu: updatedMenu, category: currentCategory }),
        });
      }
    } catch (err) {
      console.error('Error saving link:', err);
    }
    
    console.log(`[AdminColumnBrowser] Created link: ${itemName} -> ${url}`);
  };
  
  // Handle PDF file drop
  const handleFileDrop = async (columnIndex: number, files: File[]) => {
    const column = columns[columnIndex];
    const parentId = column.parentId;
    
    // Track all new items and accumulate menu changes
    let currentMenu = [...menuStructure];
    const newItems: MenuItem[] = [];
    
    for (const file of files) {
      try {
        // Sanitize filename - remove special characters
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const fileName = `worksheet-${Date.now()}-${safeName}`;
        
        // Upload PDF to Supabase storage
        const { data, error } = await supabase.storage
          .from('teacher-files')
          .upload(`admin-uploads/${fileName}`, file);
        
        if (error) {
          console.error('Upload error:', error);
          alert(`Chyba při nahrávání ${file.name}: ${error.message}`);
          continue;
        }
        
        const { data: urlData } = supabase.storage
          .from('teacher-files')
          .getPublicUrl(`admin-uploads/${fileName}`);
        
        const pdfUrl = urlData.publicUrl;
        
        // Create worksheet document
        const worksheetName = file.name.replace('.pdf', '').replace(/_/g, ' ');
        const slug = worksheetName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const id = `worksheet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Add to menu structure
        const newItem: MenuItem = {
          id,
          label: worksheetName,
          slug,
          type: 'worksheet',
          icon: 'file-text',
          url: pdfUrl,
        };
        
        newItems.push(newItem);
        
        // Find parent and add new item to accumulated menu
        const addToParent = (items: MenuItem[]): MenuItem[] => {
          return items.map(item => {
            if (item.id === parentId) {
              return {
                ...item,
                children: [...(item.children || []), newItem]
              };
            }
            if (item.children) {
              return { ...item, children: addToParent(item.children) };
            }
            return item;
          });
        };
        
        if (parentId === null || parentId === 'root') {
          currentMenu = [...currentMenu, newItem];
        } else {
          currentMenu = addToParent(currentMenu);
        }
        
        // Also create page in backend
        const { data: { session } } = await getSupabaseSession();
        if (session?.access_token) {
          await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/pages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              slug,
              title: worksheetName,
              category: currentCategory,
              type: 'worksheet',
              worksheetData: {
                pdfUrl,
                name: worksheetName,
              }
            }),
          });
        }
        
        console.log(`[AdminColumnBrowser] Uploaded PDF: ${file.name} -> ${pdfUrl}`);
        
      } catch (err) {
        console.error('Error processing file:', err);
        alert(`Chyba při zpracování ${file.name}`);
      }
    }
    
    // Update React state with accumulated menu
    setMenuStructure(currentMenu);
    
    // Refresh the column with all new items
    if (columns[columnIndex] && newItems.length > 0) {
      const col = columns[columnIndex];
      setColumns(prev => {
        const updated = [...prev];
        updated[columnIndex] = {
          ...col,
          items: [...col.items, ...newItems]
        };
        return updated;
      });
    }
    
    // Save updated menu to backend
    const { data: { session } } = await getSupabaseSession();
    if (session?.access_token) {
      console.log('[AdminColumnBrowser] Saving menu after PDF upload, items:', currentMenu.length);
      const resp = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/menu`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ menu: currentMenu, category: currentCategory }),
      });
      
      if (resp.ok) {
        console.log('[AdminColumnBrowser] Menu saved after PDF upload');
      } else {
        console.error('[AdminColumnBrowser] Failed to save menu after PDF upload');
      }
    }
  };
  
  // Breadcrumb navigation
  const navigateToColumn = (index: number) => {
    setColumns(prev => prev.slice(0, index + 1));
    if (index === 0) {
      setSelectedItem(null);
    }
  };
  
  // Handle bulk delete
  const handleBulkDelete = async () => {
    console.log('[AdminColumnBrowser] handleBulkDelete called, checkedItems:', checkedItems.size);
    
    if (checkedItems.size === 0) {
      console.log('[AdminColumnBrowser] No items selected, returning');
      return;
    }
    
    const confirmed = window.confirm(`Opravdu chcete smazat ${checkedItems.size} položek?`);
    if (!confirmed) {
      console.log('[AdminColumnBrowser] User cancelled delete');
      return;
    }
    
    console.log('[AdminColumnBrowser] User confirmed delete, getting session...');
    
    try {
      // Get current session reliably
      const { data: { session } } = await getSupabaseSession();
      console.log('[AdminColumnBrowser] Session:', session ? 'exists' : 'null');
      
      const accessToken = session?.access_token;
      const userEmail = session?.user?.email || '';
      
      console.log('[AdminColumnBrowser] Starting bulk delete, user:', userEmail, 'token:', accessToken ? `${accessToken.substring(0, 20)}...` : 'missing');
      
      if (!accessToken) {
        alert('Nejste přihlášeni');
        return;
      }
      
      // Check if user is admin (either @admin.cz suffix or specific admin emails)
      const isAdmin = userEmail.endsWith('@admin.cz') || userEmail === '123456@gmail.com';
      if (!isAdmin) {
        alert('Pro mazání obsahu musíte být přihlášeni jako admin');
        return;
      }
      
      // Find all items to delete (need to collect slugs)
      const itemsToDelete: Array<{slug: string, isFolder: boolean, id: string}> = [];
      
      const collectItems = (items: MenuItem[]) => {
        for (const item of items) {
          if (checkedItems.has(item.id)) {
            itemsToDelete.push({
              slug: item.slug || item.id,
              isFolder: isFolder(item),
              id: item.id
            });
          }
          if (item.children) {
            collectItems(item.children);
          }
        }
      };
      
      collectItems(menuStructure);
      
      console.log('[AdminColumnBrowser] Items to delete:', itemsToDelete);
      
      if (itemsToDelete.length === 0) {
        alert('Žádné položky k mazání nebyly nalezeny');
        return;
      }
      
      // Delete pages (not folders for now - folders need special handling)
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];
      
      for (const item of itemsToDelete) {
        if (!item.isFolder) {
          try {
            // Note: slug is a path parameter, category is query parameter
            const deleteUrl = `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/pages/${encodeURIComponent(item.slug)}?category=${currentCategory}`;
            console.log(`[AdminColumnBrowser] DELETE ${deleteUrl}`);
            
            const response = await fetch(deleteUrl, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              }
            });
            
            if (response.ok) {
              successCount++;
              console.log(`[AdminColumnBrowser] ✓ Deleted: ${item.slug}`);
            } else {
              errorCount++;
              const errorText = await response.text();
              console.error(`[AdminColumnBrowser] ✗ Failed to delete ${item.slug}: ${response.status}`, errorText);
              errors.push(`${item.slug}: ${response.status}`);
            }
          } catch (err) {
            errorCount++;
            console.error(`[AdminColumnBrowser] ✗ Error deleting ${item.slug}:`, err);
            errors.push(`${item.slug}: ${err}`);
          }
        } else {
          console.log(`[AdminColumnBrowser] ⊘ Skipping folder: ${item.slug}`);
        }
      }
      
      // Now remove items from menu structure (even if page delete failed - item might only exist in menu)
      const itemIdsToRemove = new Set(itemsToDelete.map(i => i.id));
      console.log('[AdminColumnBrowser] IDs to remove from menu:', Array.from(itemIdsToRemove));
      console.log('[AdminColumnBrowser] Current menu has', menuStructure.length, 'root items');
      
      const removeFromMenu = (items: MenuItem[]): MenuItem[] => {
        return items
          .filter(item => !itemIdsToRemove.has(item.id))
          .map(item => ({
            ...item,
            children: item.children ? removeFromMenu(item.children) : undefined
          }));
      };
      
      const updatedMenu = removeFromMenu(menuStructure);
      console.log('[AdminColumnBrowser] Updated menu has', updatedMenu.length, 'root items');
      
      // Save updated menu
      let menuSaved = false;
      try {
        console.log('[AdminColumnBrowser] Saving menu to server for category:', currentCategory);
        console.log('[AdminColumnBrowser] Menu before:', menuStructure.length, 'items');
        console.log('[AdminColumnBrowser] Menu after:', updatedMenu.length, 'items');
        
        const menuResponse = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/menu`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ menu: updatedMenu, category: currentCategory })
          }
        );
        
        const menuResponseText = await menuResponse.text();
        console.log('[AdminColumnBrowser] Menu save response:', menuResponse.status, menuResponseText);
        
        if (menuResponse.ok) {
          console.log('[AdminColumnBrowser] ✓ Menu updated successfully, removed', itemsToDelete.length, 'items');
          menuSaved = true;
        } else {
          console.error('[AdminColumnBrowser] ✗ Failed to update menu:', menuResponseText);
          errors.push(`Menu update failed: ${menuResponse.status}`);
        }
      } catch (err) {
        console.error('[AdminColumnBrowser] ✗ Error updating menu:', err);
        errors.push(`Menu update error: ${err}`);
      }
      
      // Show results
      if (menuSaved) {
        // Wait a bit for the server to process
        await new Promise(resolve => setTimeout(resolve, 500));
        
        alert(`Úspěšně odstraněno ${itemsToDelete.length} položek z menu`);
        clearChecks();
        
        // Force reload from server (no cache)
        window.location.href = window.location.href;
      } else {
        alert(`Nepodařilo se uložit změny menu.\n\nChyby:\n${errors.join('\n')}`);
        clearChecks();
      }
      
    } catch (err) {
      console.error('Bulk delete error:', err);
      alert('Chyba při mazání');
    }
  };
  
  // Handle bulk move
  const handleBulkMove = async () => {
    if (checkedItems.size === 0 || moveTargetId === undefined) return;
    
    setIsMoving(true);
    
    try {
      const { data: { session } } = await getSupabaseSession();
      const accessToken = session?.access_token;
      
      if (!accessToken) {
        alert('Nejste přihlášeni');
        setIsMoving(false);
        return;
      }
      
      // Collect items to move
      const itemsToMove: MenuItem[] = [];
      const collectItems = (items: MenuItem[]) => {
        for (const item of items) {
          if (checkedItems.has(item.id)) {
            itemsToMove.push(item);
          }
          if (item.children) {
            collectItems(item.children);
          }
        }
      };
      collectItems(menuStructure);
      
      if (itemsToMove.length === 0) {
        alert('Žádné položky k přesunu');
        setIsMoving(false);
        return;
      }
      
      // Remove items from current location and add to target
      const itemIdsToMove = new Set(itemsToMove.map(i => i.id));
      
      // Remove from menu (but keep the items)
      const removeFromMenu = (items: MenuItem[]): MenuItem[] => {
        return items
          .filter(item => !itemIdsToMove.has(item.id))
          .map(item => ({
            ...item,
            children: item.children ? removeFromMenu(item.children) : undefined
          }));
      };
      
      let updatedMenu = removeFromMenu(menuStructure);
      
      // Add items to target location
      if (moveTargetId === null) {
        // Move to root
        updatedMenu = [...updatedMenu, ...itemsToMove];
      } else {
        // Move to specific folder
        const addToTarget = (items: MenuItem[]): MenuItem[] => {
          return items.map(item => {
            if (item.id === moveTargetId) {
              return {
                ...item,
                children: [...(item.children || []), ...itemsToMove]
              };
            }
            if (item.children) {
              return { ...item, children: addToTarget(item.children) };
            }
            return item;
          });
        };
        updatedMenu = addToTarget(updatedMenu);
      }
      
      // Save updated menu
      const menuResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/menu`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ menu: updatedMenu, category: currentCategory })
        }
      );
      
      if (menuResponse.ok) {
        alert(`Úspěšně přesunuto ${itemsToMove.length} položek`);
        clearChecks();
        setShowMoveModal(false);
        setMoveTargetId(null);
        window.location.href = window.location.href;
      } else {
        const errorText = await menuResponse.text();
        alert(`Nepodařilo se přesunout položky: ${errorText}`);
      }
    } catch (err) {
      console.error('Bulk move error:', err);
      alert('Chyba při přesunu');
    } finally {
      setIsMoving(false);
    }
  };
  
  // Get all folders for move target picker
  const getAllFolders = (items: MenuItem[], path: string = ''): Array<{id: string; label: string; path: string}> => {
    const folders: Array<{id: string; label: string; path: string}> = [];
    for (const item of items) {
      if (isFolder(item)) {
        const currentPath = path ? `${path} / ${item.label}` : item.label;
        folders.push({ id: item.id, label: item.label, path: currentPath });
        if (item.children) {
          folders.push(...getAllFolders(item.children, currentPath));
        }
      }
    }
    return folders;
  };
  
  return (
    <div className="h-full w-full flex flex-col bg-slate-100 overflow-hidden">
      {/* Category Selector + Breadcrumb Header */}
      <div className="px-4 py-2 bg-white border-b border-slate-200 flex items-center gap-3">
        {/* Category Selector */}
        <select
          value={currentCategory}
          onChange={(e) => handleCategoryChange(e.target.value)}
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium cursor-pointer border-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
          style={{ color: CATEGORIES.find(c => c.id === currentCategory)?.color || '#4E5871' }}
        >
          {CATEGORIES.map(cat => (
            <option key={cat.id} value={cat.id} style={{ color: '#333' }}>
              {cat.label}
            </option>
          ))}
        </select>
        
        <div className="w-px h-5 bg-slate-200" />
        
        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-sm overflow-x-auto flex-1">
          {columns.map((col, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />}
              <button
                onClick={() => navigateToColumn(idx)}
                className={`px-2 py-1 rounded truncate max-w-[150px] ${
                  idx === columns.length - 1
                    ? 'font-medium text-slate-800'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {idx === 0 ? <Home className="w-3.5 h-3.5" /> : col.title}
              </button>
            </React.Fragment>
          ))}
        </div>
        
        {/* Refresh button */}
        <button
          onClick={() => {
            window.location.reload();
          }}
          className="p-1.5 hover:bg-slate-100 rounded transition-colors"
          title="Obnovit"
        >
          <RefreshCw className="w-4 h-4 text-slate-400" />
        </button>
        
        {/* AI Agent button */}
        <button
          onClick={() => setShowAIAgent(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            backgroundColor: '#8b5cf6',
            color: 'white',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 500,
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#7c3aed'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#8b5cf6'}
        >
          <Sparkles className="w-4 h-4" />
          AI Asistent
        </button>
        
        
        {/* Admin Menu Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                backgroundColor: '#4E5871',
                color: 'white',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
              }}
            >
              <Settings className="w-4 h-4" />
              <ChevronDown className="w-3.5 h-3.5 opacity-70" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => navigate('/admin/licence')}>
              <Settings className="h-4 w-4 mr-2" />
              Správa licencí
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/admin/customer-success')}>
              <BarChart3 className="h-4 w-4 mr-2" />
              Aktivita škol
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/admin/migration')}>
              <Download className="h-4 w-4 mr-2" />
              Migrace obsahu
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/admin/curriculum-factory')} className="text-purple-600">
              <Sparkles className="h-4 w-4 mr-2" />
              Curriculum Factory
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/admin/data-sets')} className="text-amber-600">
              <Database className="h-4 w-4 mr-2" />
              Data Set Creator
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/admin/rag-upload')} className="text-indigo-600">
              <Upload className="h-4 w-4 mr-2" />
              RAG - Nahrát PDF do AI
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/docs/fyzika')} className="text-indigo-600">
              <BookOpen className="h-4 w-4 mr-2" />
              Zobrazit Vividbooks
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={async () => {
                const categoryLabel = CATEGORIES.find(c => c.id === currentCategory)?.label || currentCategory;
                if (!window.confirm(`Opravdu chcete VYMAZAT VŠECHNA DATA z kategorie "${categoryLabel}"?\n\nTato akce je NEVRATNÁ!`)) {
                  return;
                }
                if (!window.confirm(`POTVRZENÍ: Kategorie "${categoryLabel}" bude zcela vyčištěna. Pokračovat?`)) {
                  return;
                }
                try {
                  const { data: { session } } = await getSupabaseSession();
                  if (!session?.access_token) {
                    alert('Nejste přihlášeni');
                    return;
                  }
                  const response = await fetch(
                    `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/menu`,
                    {
                      method: 'PUT',
                      headers: {
                        'Authorization': `Bearer ${session.access_token}`,
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({ menu: [], category: currentCategory })
                    }
                  );
                  if (response.ok) {
                    alert(`Kategorie "${categoryLabel}" byla vyčištěna.`);
                    window.location.reload();
                  } else {
                    alert('Chyba při mazání: ' + await response.text());
                  }
                } catch (err) {
                  alert('Chyba: ' + err);
                }
              }} 
              className="text-orange-600"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Vyčistit kategorii
            </DropdownMenuItem>
            <DropdownMenuItem onClick={async () => {
              await supabase.auth.signOut();
              navigate('/');
            }} className="text-red-600">
              <LogOut className="h-4 w-4 mr-2" />
              Odhlásit se
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        {/* Selected item count */}
        <div className="text-xs text-slate-400">
          {columns[columns.length - 1]?.items.length || 0} položek
        </div>
      </div>
      
      {/* Bulk Actions Toolbar */}
      {showBulkActions && (
        <div className="px-4 py-2 bg-indigo-50 border-b border-indigo-200 flex items-center gap-3">
          <span className="text-sm font-medium text-indigo-700">
            {checkedItems.size} vybráno
          </span>
          
          <div className="flex-1" />
          
          <button
            onClick={() => setShowMoveModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-100 rounded transition-colors"
          >
            <Move className="w-4 h-4" />
            Přesunout
          </button>
          
          <button
            onClick={handleBulkDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:bg-red-100 rounded transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Smazat
          </button>
          
          <button
            onClick={clearChecks}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-200 rounded transition-colors"
          >
            <X className="w-4 h-4" />
            Zrušit výběr
          </button>
        </div>
      )}
      
      {/* Columns Container - with horizontal scroll */}
      <div 
        ref={containerRef}
        className="flex-1 flex overflow-x-auto overflow-y-hidden"
        style={{ scrollBehavior: 'smooth', minWidth: 0 }}
      >
        {columns.map((col, idx) => (
          <Column
            key={`${col.parentId}-${idx}`}
            items={col.items}
            selectedId={col.selectedId}
            onSelect={(item) => handleSelect(item, idx)}
            onDoubleClick={handleDoubleClick}
            title={col.title || (idx === 0 ? currentCategory.toUpperCase() : 'Položky')}
            isLoading={idx === 0 && loading}
            level={idx}
            onCreateNew={(type) => handleCreateNew(idx, type)}
            onFileDrop={(files) => handleFileDrop(idx, files)}
            checkedItems={checkedItems}
            onToggleCheck={toggleItemCheck}
          />
        ))}
        
        {/* Preview Panel - Shows when a document is selected */}
        {selectedItem && !isFolder(selectedItem) && (
          <div 
            className="flex-shrink-0 h-full bg-white border-r border-slate-200 overflow-y-auto"
            style={{ width: 320, minWidth: 320 }}
          >
            <div className="p-4 space-y-4">
              {/* Preview Header - clickable image for cover change */}
              <div className="flex items-start gap-3">
                <label className="cursor-pointer group relative">
                  {selectedItem.coverImage ? (
                    <img 
                      src={selectedItem.coverImage} 
                      alt="" 
                      className="w-16 h-16 rounded-lg object-cover group-hover:opacity-75 transition-opacity"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center group-hover:bg-slate-200 transition-colors">
                      {(() => {
                        const docType = getDocTypeInfo(selectedItem.type);
                        const IconComponent = docType.icon;
                        return <IconComponent className={`w-8 h-8 ${docType.color}`} />;
                      })()}
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-black/50 rounded-lg p-1">
                      <Image className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const fileName = `cover-${selectedItem.id}-${Date.now()}.${file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '')}`;
                      const { error } = await supabase.storage.from('teacher-files').upload(`covers/${fileName}`, file);
                      if (error) { alert('Chyba: ' + error.message); return; }
                      const { data: urlData } = supabase.storage.from('teacher-files').getPublicUrl(`covers/${fileName}`);
                      const url = urlData.publicUrl;
                      setSelectedItem({ ...selectedItem, coverImage: url });
                      const updateCover = (items: MenuItem[]): MenuItem[] => items.map(item => 
                        item.id === selectedItem.id ? { ...item, coverImage: url } : 
                        item.children ? { ...item, children: updateCover(item.children) } : item
                      );
                      setMenuStructure(updateCover(menuStructure));
                    }}
                  />
                </label>
                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    value={selectedItem.label}
                    onChange={(e) => {
                      const newLabel = e.target.value;
                      setSelectedItem({ ...selectedItem, label: newLabel });
                      const updateLabel = (items: MenuItem[]): MenuItem[] => items.map(item => 
                        item.id === selectedItem.id ? { ...item, label: newLabel } : 
                        item.children ? { ...item, children: updateLabel(item.children) } : item
                      );
                      setMenuStructure(updateLabel(menuStructure));
                    }}
                    className="font-semibold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none w-full truncate"
                  />
                  <p className="text-xs text-slate-500 mt-0.5">
                    {getDocTypeInfo(selectedItem.type).label}
                  </p>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-2">
                {/* Preview Button */}
                <button
                  onClick={() => {
                    const baseUrl = import.meta.env.BASE_URL || '/';
                    window.open(`${baseUrl}docs/${currentCategory}/${selectedItem.slug}`, '_blank');
                  }}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    backgroundColor: '#e2e8f0',
                    color: '#475569',
                    borderRadius: '8px',
                    fontWeight: 500,
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#cbd5e1'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#e2e8f0'}
                >
                  <Eye className="w-4 h-4" />
                  Náhled
                </button>
                
                {/* Edit Button */}
                <button
                  onClick={() => selectedItem.slug && onSelectDocument(currentCategory, selectedItem.slug, selectedItem.type)}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    backgroundColor: '#4E5871',
                    color: 'white',
                    borderRadius: '8px',
                    fontWeight: 500,
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#3d4660'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#4E5871'}
                >
                  <Edit2 className="w-4 h-4" />
                  Upravit
                </button>
              </div>
              
              {/* Save Changes Button */}
              <button
                onClick={async () => {
                  try {
                    const { data: { session } } = await getSupabaseSession();
                    if (!session?.access_token) {
                      alert('Není přihlášen');
                      return;
                    }
                    
                    const resp = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/menu`, {
                      method: 'PUT',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`,
                      },
                      body: JSON.stringify({ menu: menuStructure, category: currentCategory }),
                    });
                    
                    if (resp.ok) {
                      alert('Změny uloženy');
                    } else {
                      alert('Chyba při ukládání');
                    }
                  } catch (err) {
                    console.error('Save error:', err);
                    alert('Chyba při ukládání');
                  }
                }}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  backgroundColor: '#22c55e',
                  color: 'white',
                  borderRadius: '8px',
                  fontWeight: 500,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  marginTop: '8px',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#16a34a'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#22c55e'}
              >
                <Check className="w-4 h-4" />
                Uložit změny
              </button>
              
              {/* Loading indicator */}
              {loadingDetails && (
                <div className="flex items-center gap-2 py-2 text-sm text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Načítám detaily...
                </div>
              )}
              
              {/* API Load status */}
              {!loadingDetails && !selectedPageDetails && (
                <div className="text-xs text-amber-600 bg-amber-50 rounded p-2">
                  ⚠️ Detaily stránky nebyly načteny (stránka možná neexistuje v databázi)
                </div>
              )}
              
              {/* Basic Info */}
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Základní info</h4>
                <div className="bg-slate-50 rounded-lg p-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5" />
                      Slug
                    </span>
                    <code className="text-xs bg-white px-2 py-0.5 rounded border">{selectedItem.slug}</code>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Typ</span>
                    <select
                      value={selectedItem.type || 'document'}
                      onChange={(e) => {
                        // Update the item type
                        const newType = e.target.value;
                        setSelectedItem({ ...selectedItem, type: newType });
                        // Update in menu structure
                        const updateItemType = (items: MenuItem[]): MenuItem[] => {
                          return items.map(item => {
                            if (item.id === selectedItem.id) {
                              return { ...item, type: newType };
                            }
                            if (item.children) {
                              return { ...item, children: updateItemType(item.children) };
                            }
                            return item;
                          });
                        };
                        setMenuStructure(updateItemType(menuStructure));
                      }}
                      className="text-xs bg-white px-2 py-1 rounded border cursor-pointer"
                    >
                      <option value="document">Dokument</option>
                      <option value="lesson">Lekce</option>
                      <option value="ucebni-text">Učební text</option>
                      <option value="worksheet">Pracovní list</option>
                      <option value="board">Board</option>
                      <option value="link">Odkaz</option>
                      <option value="practice">Procvičování</option>
                      <option value="test">Test</option>
                      <option value="exam">Písemka</option>
                      <option value="interactive">Interaktivní</option>
                      <option value="bonus">Bonus</option>
                      <option value="methodology">Metodika</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">ID</span>
                    <code className="text-xs bg-white px-2 py-0.5 rounded border truncate max-w-[150px]">{selectedItem.id}</code>
                  </div>
                </div>
              </div>
              
              {/* URL field - for links and board-based items */}
              {['link', 'practice', 'interactive', 'test', 'exam', 'bonus'].includes(selectedItem.type || '') && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <ExternalLink className="w-3.5 h-3.5" />
                    URL odkazu
                  </h4>
                  <input
                    type="url"
                    value={selectedItem.url || selectedItem.externalUrl || ''}
                    onChange={(e) => {
                      const newUrl = e.target.value;
                      setSelectedItem({ ...selectedItem, url: newUrl, externalUrl: newUrl });
                      const updateItemUrl = (items: MenuItem[]): MenuItem[] => items.map(item => 
                        item.id === selectedItem.id ? { ...item, url: newUrl, externalUrl: newUrl } : 
                        item.children ? { ...item, children: updateItemUrl(item.children) } : item
                      );
                      setMenuStructure(updateItemUrl(menuStructure));
                    }}
                    placeholder="https://..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {(selectedItem.url || selectedItem.externalUrl) && (
                    <div className="flex items-center gap-3 flex-wrap">
                      <a href={selectedItem.url || selectedItem.externalUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline">
                        <ExternalLink className="w-3 h-3" /> Otevřít
                      </a>
                      
                      {/* Preview button for boards */}
                      {(selectedItem.url || selectedItem.externalUrl || '').startsWith('board://') && (
                        <button
                          onClick={() => {
                            const boardId = (selectedItem.url || selectedItem.externalUrl || '').replace('board://', '');
                            // Open editor directly - no license check there
                            window.open(`/quiz/edit/${boardId}`, '_blank');
                          }}
                          className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700"
                        >
                          <Eye className="w-3 h-3" /> Náhled/Editovat
                        </button>
                      )}
                      
                      {/* Convert to Board button - show if URL contains board ID but is not already board:// */}
                      {!(selectedItem.url || selectedItem.externalUrl || '').startsWith('board://') && 
                       isImportableBoardUrl(selectedItem.url || selectedItem.externalUrl || '') && (
                        <button
                          onClick={async () => {
                            const url = selectedItem.url || selectedItem.externalUrl || '';
                            if (!url) return;
                            
                            setConvertingBoard(true);
                            try {
                              const imported = await importBoardFromLegacy(url, selectedItem.label);
                              
                              if (!imported) {
                                alert('Nepodařilo se importovat board. Zkontrolujte URL.');
                                return;
                              }
                              
                              // Create and save the quiz with a clean UUID (not the imported- prefix)
                              const newQuizId = crypto.randomUUID();
                              const boardSlug = `board-${newQuizId}`;
                              console.log(`[Admin] Creating quiz with ID: ${newQuizId}`);
                              console.log(`[Admin] Imported data:`, { 
                                title: imported.title, 
                                slidesCount: imported.slides.length,
                                firstSlideType: imported.slides[0]?.type 
                              });
                              
                              // Build quiz object
                              const quiz = {
                                id: newQuizId,
                                title: imported.title,
                                slides: imported.slides,
                                createdAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString(),
                              };
                              
                              // Update the menu item with board:// URL
                              const newBoardUrl = `board://${quiz.id}`;
                              
                              console.log(`[Admin] Updating menu item ${selectedItem.id} with new URL: ${newBoardUrl}`);
                              
                              // Update menu structure first
                              const updateItemUrl = (items: MenuItem[]): MenuItem[] => items.map(item => 
                                item.id === selectedItem.id ? { ...item, url: newBoardUrl, externalUrl: newBoardUrl, slug: boardSlug } : 
                                item.children ? { ...item, children: updateItemUrl(item.children) } : item
                              );
                              const updatedMenu = updateItemUrl(menuStructure);
                              
                              // SAVE TO SERVER immediately
                              console.log(`[Admin] Saving to server, category: ${currentCategory}`);
                              
                              let serverSaveSuccess = false;
                              try {
                                const { data: { session } } = await getSupabaseSession();
                                console.log(`[Admin] Session obtained: ${session ? 'yes' : 'no'}`);
                                
                                if (session?.access_token && currentCategory) {
                                  // 1. Save board content to pages API (like worksheets)
                                  console.log(`[Admin] Saving board to pages API with slug: ${boardSlug}`);
                                  const pageResponse = await fetch(
                                    `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/pages`,
                                    {
                                      method: 'POST',
                                      headers: {
                                        'Authorization': `Bearer ${session.access_token}`,
                                        'Content-Type': 'application/json'
                                      },
                                      body: JSON.stringify({
                                        slug: boardSlug,
                                        title: imported.title,
                                        category: currentCategory,
                                        type: 'board',
                                        worksheetData: quiz, // Store full quiz as worksheetData
                                      })
                                    }
                                  );
                                  
                                  if (pageResponse.ok) {
                                    console.log(`[Admin] Board saved to pages API`);
                                  } else {
                                    const pageError = await pageResponse.text();
                                    console.error(`[Admin] Failed to save board to pages:`, pageError);
                                  }
                                  
                                  // 2. Update menu
                                  const response = await fetch(
                                    `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/menu`,
                                    {
                                      method: 'PUT',
                                      headers: {
                                        'Authorization': `Bearer ${session.access_token}`,
                                        'Content-Type': 'application/json'
                                      },
                                      body: JSON.stringify({ menu: updatedMenu, category: currentCategory })
                                    }
                                  );
                                  
                                  console.log(`[Admin] Menu response: ${response.status}`);
                                  serverSaveSuccess = response.ok && pageResponse.ok;
                                  
                                  if (!response.ok) {
                                    const errorText = await response.text();
                                    console.error(`[Admin] Server error: ${errorText}`);
                                  }
                                  
                                  // 3. Also save to localStorage for local viewing
                                  saveQuiz(quiz as any);
                                  console.log(`[Admin] Also saved to localStorage`);
                                }
                              } catch (saveError) {
                                console.error('[Admin] Error saving to server:', saveError);
                              }
                              
                              // Now update local state
                              setMenuStructure(updatedMenu);
                              setSelectedItem({ ...selectedItem, url: newBoardUrl, externalUrl: newBoardUrl, slug: boardSlug });
                              
                              // Show alert after state updates (use setTimeout to let React render first)
                              setTimeout(() => {
                                if (serverSaveSuccess) {
                                  alert(`Board úspěšně převeden a uložen! (${quiz.slides.length} slidů)`);
                                } else {
                                  alert(`Board převeden! (${quiz.slides.length} slidů)\nKlikni "Uložit změny" pro uložení na server.`);
                                }
                              }, 100);
                            } catch (err) {
                              console.error('Board conversion failed:', err);
                              alert('Chyba při převodu boardu: ' + err);
                            } finally {
                              setConvertingBoard(false);
                            }
                          }}
                          disabled={convertingBoard}
                          className="inline-flex items-center gap-1 text-xs text-green-600 hover:text-green-700 disabled:opacity-50"
                        >
                          {convertingBoard ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" /> Převádím...
                            </>
                          ) : (
                            <>
                              <Download className="w-3 h-3" /> Převést na board
                            </>
                          )}
                        </button>
                      )}
                      
                      {/* Show "Already a board" indicator */}
                      {(selectedItem.url || selectedItem.externalUrl || '').startsWith('board://') && (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600">
                          <Check className="w-3 h-3" /> VividBoard
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              {/* PDF field - for worksheets */}
              {selectedItem.type === 'worksheet' && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    PDF soubor
                  </h4>
                  <input
                    type="url"
                    value={selectedItem.url || ''}
                    onChange={(e) => {
                      const newUrl = e.target.value;
                      setSelectedItem({ ...selectedItem, url: newUrl });
                      const updateItemUrl = (items: MenuItem[]): MenuItem[] => items.map(item => 
                        item.id === selectedItem.id ? { ...item, url: newUrl } : 
                        item.children ? { ...item, children: updateItemUrl(item.children) } : item
                      );
                      setMenuStructure(updateItemUrl(menuStructure));
                    }}
                    placeholder="URL PDF souboru..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="flex gap-2">
                    {selectedItem.url && (
                      <a href={selectedItem.url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline">
                        <ExternalLink className="w-3 h-3" /> Otevřít PDF
                      </a>
                    )}
                    <label className="inline-flex items-center gap-1 text-xs text-green-600 hover:underline cursor-pointer">
                      <Upload className="w-3 h-3" /> Nahrát nové PDF
                      <input
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const fileName = `pdf-${selectedItem.id}-${Date.now()}.pdf`;
                          const { error } = await supabase.storage.from('teacher-files').upload(`worksheets/${fileName}`, file);
                          if (error) { alert('Chyba: ' + error.message); return; }
                          const { data: urlData } = supabase.storage.from('teacher-files').getPublicUrl(`worksheets/${fileName}`);
                          const url = urlData.publicUrl;
                          setSelectedItem({ ...selectedItem, url });
                          const updateUrl = (items: MenuItem[]): MenuItem[] => items.map(item => 
                            item.id === selectedItem.id ? { ...item, url } : 
                            item.children ? { ...item, children: updateUrl(item.children) } : item
                          );
                          setMenuStructure(updateUrl(menuStructure));
                        }}
                      />
                    </label>
                  </div>
                  
                  {/* PDF Transcript Section */}
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                      <Sparkles className="w-3.5 h-3.5" />
                      AI Přepis PDF
                    </h4>
                    
                    {selectedItem.pdfTranscript ? (
                      <div className="space-y-2">
                        <div className="max-h-[200px] overflow-y-auto bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-600 whitespace-pre-wrap">
                          {selectedItem.pdfTranscript.substring(0, 1000)}
                          {selectedItem.pdfTranscript.length > 1000 && '...'}
                        </div>
                        <div className="flex gap-2">
                          <span className="text-xs text-slate-400">
                            {selectedItem.pdfTranscript.length} znaků
                          </span>
                            <button
                              onClick={async () => {
                                const updatedItem = { ...selectedItem, pdfTranscript: undefined };
                                setSelectedItem(updatedItem);
                                const updateItem = (items: MenuItem[]): MenuItem[] => items.map(item => 
                                  item.id === selectedItem.id ? updatedItem : 
                                  item.children ? { ...item, children: updateItem(item.children) } : item
                                );
                                const updatedMenu = updateItem(menuStructure);
                                setMenuStructure(updatedMenu);
                                
                                // Save to server
                                const { data: { session } } = await supabase.auth.getSession();
                                if (session?.access_token) {
                                  await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/menu`, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                                    body: JSON.stringify({ menu: updatedMenu, category: currentCategory }),
                                  });
                                  console.log('[AdminColumnBrowser] ✓ Přepis smazán ze serveru');
                                }
                              }}
                              className="text-xs text-red-500 hover:underline"
                            >
                              Smazat přepis
                            </button>
                          </div>
                          
                          {/* Create Vividboard button */}
                          <button
                            onClick={() => {
                              // Store transcript in sessionStorage (URL has length limits)
                              const pdfData = {
                                title: selectedItem.label || 'Nový Vividboard',
                                transcript: selectedItem.pdfTranscript || '',
                                sourceId: selectedItem.id,
                                sourceSlug: selectedItem.slug || selectedItem.id,
                                sourceCategory: currentCategory,
                                linkBackToWorksheet: true // Flag to link board back to worksheet
                              };
                              console.log('[AdminColumnBrowser] Saving PDF data to sessionStorage:', {
                                title: pdfData.title,
                                transcriptLength: pdfData.transcript.length,
                                sourceId: pdfData.sourceId,
                                preview: pdfData.transcript.substring(0, 100)
                              });
                              sessionStorage.setItem('vividboard_from_pdf', JSON.stringify(pdfData));
                              // Include source info in URL for persistence after refresh
                              const sourceParams = `&sourceId=${encodeURIComponent(selectedItem.id)}&sourceSlug=${encodeURIComponent(selectedItem.slug || selectedItem.id)}&sourceCategory=${encodeURIComponent(currentCategory)}`;
                              navigate(`/quiz/new?fromPdf=true${sourceParams}&returnUrl=${encodeURIComponent(window.location.pathname)}`);
                            }}
                            style={{
                              marginTop: '12px',
                              width: '100%',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '8px',
                              padding: '10px 16px',
                              backgroundColor: '#10b981',
                              color: 'white',
                              borderRadius: '8px',
                              fontSize: '14px',
                              fontWeight: 500,
                              border: 'none',
                              cursor: 'pointer'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#059669'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#10b981'}
                          >
                            <Sparkles className="w-4 h-4" />
                            Vytvořit Vividboard z přepisu
                          </button>
                        </div>
                      ) : (
                      <>
                        {(() => {
                          // Find any PDF URL from various sources
                          const pdfUrl = selectedItem.url || selectedItem.externalUrl || selectedItem.extendedWorksheet?.solutionPdf?.url;
                          return pdfUrl ? (
                          <div className="flex flex-col gap-2">
                            <button
                              onClick={async () => {
                                if (!pdfUrl) return;
                                
                                // Set loading state
                                const loadingItem = { ...selectedItem, pdfTranscript: '⏳ Vytvářím přepis...' };
                                setSelectedItem(loadingItem);
                                
                                try {
                                  const result = await extractTextFromPDF(pdfUrl, false);
                                  
                                  if (result.success && result.text) {
                                    const updatedItem = { ...selectedItem, pdfTranscript: result.text };
                                    setSelectedItem(updatedItem);
                                    const updateItem = (items: MenuItem[]): MenuItem[] => items.map(item => 
                                      item.id === selectedItem.id ? updatedItem : 
                                      item.children ? { ...item, children: updateItem(item.children) } : item
                                    );
                                    const updatedMenu = updateItem(menuStructure);
                                    setMenuStructure(updatedMenu);
                                    
                                    // Save to server
                                    const { data: { session } } = await supabase.auth.getSession();
                                    if (session?.access_token) {
                                      console.log('[AdminColumnBrowser] Saving pdfTranscript to server:', {
                                        category: currentCategory,
                                        itemId: selectedItem.id,
                                        transcriptLength: result.text.length,
                                      });
                                      const saveResponse = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/menu`, {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                                        body: JSON.stringify({ menu: updatedMenu, category: currentCategory }),
                                      });
                                      console.log('[AdminColumnBrowser] ✓ Přepis uložen na server, response:', saveResponse.status);
                                      
                                      // Sync transcript to RAG for AI assistant
                                      syncPdfTranscriptToRAG({
                                        documentId: selectedItem.id,
                                        title: selectedItem.label || 'Pracovní list',
                                        transcript: result.text,
                                        subject: currentCategory,
                                      }).catch(err => console.warn('[AdminColumnBrowser] RAG sync failed:', err));
                                    }
                                  } else {
                                    alert('Chyba při vytváření přepisu: ' + (result.error || 'Neznámá chyba'));
                                    setSelectedItem({ ...selectedItem, pdfTranscript: undefined });
                                  }
                                } catch (error) {
                                  alert('Chyba: ' + (error instanceof Error ? error.message : 'Neznámá chyba'));
                                  setSelectedItem({ ...selectedItem, pdfTranscript: undefined });
                                }
                              }}
                              className="inline-flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
                            >
                              <FileText className="w-4 h-4" />
                              Jednoduchý přepis
                            </button>
                            <button
                              onClick={async () => {
                                if (!pdfUrl) return;
                                
                                // Set loading state
                                const loadingItem = { ...selectedItem, pdfTranscript: '⏳ Analyzuji PDF a označuji aktivity...' };
                                setSelectedItem(loadingItem);
                                
                                try {
                                  const result = await extractTextFromPDF(pdfUrl, true);
                                  
                                  if (result.success && result.text) {
                                    const updatedItem = { ...selectedItem, pdfTranscript: result.text };
                                    setSelectedItem(updatedItem);
                                    const updateItem = (items: MenuItem[]): MenuItem[] => items.map(item => 
                                      item.id === selectedItem.id ? updatedItem : 
                                      item.children ? { ...item, children: updateItem(item.children) } : item
                                    );
                                    const updatedMenu = updateItem(menuStructure);
                                    setMenuStructure(updatedMenu);
                                    
                                    // Save to server
                                    const { data: { session } } = await supabase.auth.getSession();
                                    if (session?.access_token) {
                                      await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/menu`, {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                                        body: JSON.stringify({ menu: updatedMenu, category: currentCategory }),
                                      });
                                      console.log('[AdminColumnBrowser] ✓ Přepis s aktivitami uložen na server');
                                      
                                      // Sync transcript to RAG for AI assistant
                                      syncPdfTranscriptToRAG({
                                        documentId: selectedItem.id,
                                        title: selectedItem.label || 'Pracovní list',
                                        transcript: result.text,
                                        subject: currentCategory,
                                      }).catch(err => console.warn('[AdminColumnBrowser] RAG sync failed:', err));
                                    }
                                  } else {
                                    alert('Chyba při vytváření přepisu: ' + (result.error || 'Neznámá chyba'));
                                    setSelectedItem({ ...selectedItem, pdfTranscript: undefined });
                                  }
                                } catch (error) {
                                  alert('Chyba: ' + (error instanceof Error ? error.message : 'Neznámá chyba'));
                                  setSelectedItem({ ...selectedItem, pdfTranscript: undefined });
                                }
                              }}
                              className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-100 transition-colors"
                            >
                              <Sparkles className="w-4 h-4" />
                              Přepis s aktivitami pro Vividboard
                            </button>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic">
                            Nejprve nahrajte PDF soubor
                          </p>
                        );
                        })()}
                      </>
                    )}
                  </div>
                  
                  {/* Extended Worksheet Toggle */}
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedItem.extendedWorksheet?.isExtended || false}
                        onChange={(e) => {
                          const isExtended = e.target.checked;
                          const updatedItem = {
                            ...selectedItem,
                            extendedWorksheet: {
                              ...selectedItem.extendedWorksheet,
                              isExtended
                            }
                          };
                          setSelectedItem(updatedItem);
                          const updateItem = (items: MenuItem[]): MenuItem[] => items.map(item => 
                            item.id === selectedItem.id ? updatedItem : 
                            item.children ? { ...item, children: updateItem(item.children) } : item
                          );
                          setMenuStructure(updateItem(menuStructure));
                        }}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm font-medium text-slate-700">Rozšířený pracovní list</span>
                    </label>
                  </div>
                  
                  {/* Extended Worksheet Fields */}
                  {selectedItem.extendedWorksheet?.isExtended && (
                    <ExtendedWorksheetFields
                      selectedItem={selectedItem}
                      setSelectedItem={setSelectedItem}
                      menuStructure={menuStructure}
                      setMenuStructure={setMenuStructure}
                      columns={columns}
                      currentCategory={currentCategory}
                    />
                  )}
                </div>
              )}
              
              {/* Page Details (from API) */}
              {selectedPageDetails && !loadingDetails && (
                <>
                  {/* Description */}
                  {selectedPageDetails.description && (
                    <div className="space-y-1">
                      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Popis</h4>
                      <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">
                        {selectedPageDetails.description.substring(0, 200)}
                        {selectedPageDetails.description.length > 200 ? '...' : ''}
                      </p>
                    </div>
                  )}
                  
                  {/* Updated At */}
                  {selectedPageDetails.updatedAt && (
                    <div className="space-y-1">
                      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Poslední úprava</h4>
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        {new Date(selectedPageDetails.updatedAt).toLocaleString('cs-CZ')}
                      </div>
                    </div>
                  )}
                  
                  {/* Legacy IDs */}
                  {selectedPageDetails.legacyIds && Object.keys(selectedPageDetails.legacyIds).length > 0 && (
                    <div className="space-y-1">
                      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Database className="w-3.5 h-3.5" />
                        Legacy IDs
                      </h4>
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1.5 text-xs">
                        {Object.entries(selectedPageDetails.legacyIds).map(([key, value]) => (
                          <div key={key} className="flex items-center justify-between">
                            <span className="text-amber-700 font-medium">{key}</span>
                            <code className="bg-white px-2 py-0.5 rounded text-amber-800">{String(value)}</code>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Legacy Metadata */}
                  {selectedPageDetails.legacyMetadata && Object.keys(selectedPageDetails.legacyMetadata).length > 0 && (
                    <div className="space-y-1">
                      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Legacy Metadata</h4>
                      <div className="bg-slate-50 rounded-lg p-3 space-y-1.5 text-xs">
                        {Object.entries(selectedPageDetails.legacyMetadata).map(([key, value]) => (
                          <div key={key} className="flex items-center justify-between">
                            <span className="text-slate-500">{key}</span>
                            <span className="text-slate-700">{typeof value === 'boolean' ? (value ? '✓' : '✗') : String(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Section Images count */}
                  {selectedPageDetails.sectionImages && selectedPageDetails.sectionImages.length > 0 && (
                    <div className="space-y-1">
                      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pravý panel</h4>
                      <p className="text-sm text-slate-600">
                        {selectedPageDetails.sectionImages.length} mediální položky
                      </p>
                    </div>
                  )}
                  
                  {/* Featured Media */}
                  {selectedPageDetails.featuredMedia && (
                    <div className="space-y-1">
                      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Úvodní obsah</h4>
                      <img 
                        src={selectedPageDetails.featuredMedia} 
                        alt="Featured" 
                        className="w-full h-32 object-cover rounded-lg"
                      />
                    </div>
                  )}
                  
                  {/* External URL */}
                  {selectedPageDetails.externalUrl && (
                    <div className="space-y-1">
                      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Externí odkaz</h4>
                      <a 
                        href={selectedPageDetails.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-indigo-600 hover:underline flex items-center gap-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        {selectedPageDetails.externalUrl.substring(0, 40)}...
                      </a>
                    </div>
                  )}
                  
                  {/* Content length */}
                  {selectedPageDetails.content && (
                    <div className="space-y-1">
                      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Obsah</h4>
                      <div className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">
                        <div className="flex justify-between">
                          <span>Délka HTML:</span>
                          <span className="font-mono">{selectedPageDetails.content.length.toLocaleString()} znaků</span>
                        </div>
                        <div className="flex justify-between mt-1">
                          <span>H2 nadpisů:</span>
                          <span className="font-mono">{(selectedPageDetails.content.match(/<h2/gi) || []).length}</span>
                        </div>
                        <div className="flex justify-between mt-1">
                          <span>Obrázků:</span>
                          <span className="font-mono">{(selectedPageDetails.content.match(/<img/gi) || []).length}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Document Type */}
                  {selectedPageDetails.documentType && (
                    <div className="space-y-1">
                      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Typ dokumentu (API)</h4>
                      <code className="text-xs bg-slate-100 px-2 py-1 rounded">{selectedPageDetails.documentType}</code>
                    </div>
                  )}
                  
                  {/* Category */}
                  {selectedPageDetails.category && (
                    <div className="space-y-1">
                      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Kategorie (API)</h4>
                      <code className="text-xs bg-slate-100 px-2 py-1 rounded">{selectedPageDetails.category}</code>
                    </div>
                  )}
                  
                  {/* Raw JSON expandable */}
                  <details className="mt-4">
                    <summary className="text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-600">
                      📋 Surová data (JSON)
                    </summary>
                    <pre className="mt-2 text-xs bg-slate-900 text-green-400 p-3 rounded-lg overflow-auto max-h-64">
                      {JSON.stringify(selectedPageDetails, null, 2)}
                    </pre>
                  </details>
                </>
              )}
            </div>
          </div>
        )}
        
        {/* Workbook Settings Panel */}
        {selectedItem && selectedItem.type === 'workbook' && (
          <div 
            className="flex-shrink-0 h-full bg-white border-r border-slate-200 overflow-y-auto"
            style={{ width: 320, minWidth: 320 }}
          >
            <div className="p-4 space-y-4">
              {/* Workbook Header - clickable cover image */}
              <div className="flex items-start gap-3">
                <label className="cursor-pointer group relative">
                  {selectedItem.coverImage ? (
                    <img 
                      src={selectedItem.coverImage} 
                      alt="" 
                      className="w-16 h-20 rounded-lg object-cover group-hover:opacity-75 transition-opacity"
                    />
                  ) : (
                    <div className="w-16 h-20 rounded-lg bg-indigo-100 flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
                      <BookOpen className="w-8 h-8 text-indigo-400" />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-black/50 rounded-lg p-1">
                      <Image className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const fileName = `cover-${selectedItem.id}-${Date.now()}.${file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '')}`;
                      const { error } = await supabase.storage.from('teacher-files').upload(`covers/${fileName}`, file);
                      if (error) { alert('Chyba: ' + error.message); return; }
                      const { data: urlData } = supabase.storage.from('teacher-files').getPublicUrl(`covers/${fileName}`);
                      const url = urlData.publicUrl;
                      setSelectedItem({ ...selectedItem, coverImage: url });
                      const updateCover = (items: MenuItem[]): MenuItem[] => items.map(item => 
                        item.id === selectedItem.id ? { ...item, coverImage: url } : 
                        item.children ? { ...item, children: updateCover(item.children) } : item
                      );
                      setMenuStructure(updateCover(menuStructure));
                    }}
                  />
                </label>
                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    value={selectedItem.label}
                    onChange={(e) => {
                      const newLabel = e.target.value;
                      setSelectedItem({ ...selectedItem, label: newLabel });
                      const updateLabel = (items: MenuItem[]): MenuItem[] => items.map(item => 
                        item.id === selectedItem.id ? { ...item, label: newLabel } : 
                        item.children ? { ...item, children: updateLabel(item.children) } : item
                      );
                      setMenuStructure(updateLabel(menuStructure));
                    }}
                    className="font-semibold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none w-full"
                  />
                  <p className="text-xs text-slate-500 mt-0.5">
                    Pracovní sešit • {selectedItem.workbookPages?.length || selectedItem.children?.length || 0} stránek
                  </p>
                </div>
              </div>
              
              {/* Workbook Pages */}
              {(() => {
                // Initialize pages from children if workbookPages is empty
                const pages = selectedItem.workbookPages && selectedItem.workbookPages.length > 0 
                  ? selectedItem.workbookPages 
                  : (selectedItem.children || []).map((child, index) => ({
                      id: `page-${child.id}`,
                      pageNumber: parseInt(child.label.match(/str\.\s*(\d+)/)?.[1] || '') || (index + 1),
                      worksheetId: child.id,
                      worksheetSlug: child.slug || '',
                      worksheetLabel: child.label.replace(/^str\.\s*\d+\s*/, ''),
                      worksheetCover: child.coverImage,
                    }));
                
                // Get all worksheets for selection
                const getAllWorksheets = (items: MenuItem[]): MenuItem[] => {
                  return items.flatMap(item => [
                    ...(item.type === 'worksheet' ? [item] : []),
                    ...(item.children ? getAllWorksheets(item.children) : [])
                  ]);
                };
                const allWorksheets = getAllWorksheets(menuStructure);
                
                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Stránky sešitu
                      </label>
                      <button
                        onClick={() => {
                          const maxPageNum = pages.length > 0 
                            ? Math.max(...pages.map(p => p.pageNumber)) 
                            : 0;
                          const newPage: WorkbookPage = {
                            id: `page-${Date.now()}`,
                            pageNumber: maxPageNum + 1,
                            worksheetId: '',
                            worksheetSlug: '',
                            worksheetLabel: 'Nová stránka',
                          };
                          const updatedItem = {
                            ...selectedItem,
                            workbookPages: [...pages, newPage]
                          };
                          setSelectedItem(updatedItem);
                          const updateItem = (items: MenuItem[]): MenuItem[] => items.map(item =>
                            item.id === selectedItem.id ? updatedItem :
                            item.children ? { ...item, children: updateItem(item.children) } : item
                          );
                          setMenuStructure(updateItem(menuStructure));
                        }}
                        className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Přidat stránku
                      </button>
                    </div>
                    
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {pages
                        .sort((a, b) => a.pageNumber - b.pageNumber)
                        .map((page) => (
                          <div key={page.id} className="bg-slate-50 rounded-lg p-2 space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-slate-500">str.</span>
                              <input
                                type="number"
                                value={page.pageNumber}
                                onChange={(e) => {
                                  const newPageNum = parseInt(e.target.value) || 1;
                                  const updatedPages = pages.map(p =>
                                    p.id === page.id ? { ...p, pageNumber: newPageNum } : p
                                  );
                                  const updatedItem = { ...selectedItem, workbookPages: updatedPages };
                                  setSelectedItem(updatedItem);
                                  const updateItem = (items: MenuItem[]): MenuItem[] => items.map(item =>
                                    item.id === selectedItem.id ? updatedItem :
                                    item.children ? { ...item, children: updateItem(item.children) } : item
                                  );
                                  setMenuStructure(updateItem(menuStructure));
                                }}
                                className="w-12 px-1 py-1 text-xs border rounded text-center"
                                min={1}
                              />
                              <span className="flex-1 text-xs text-slate-600 truncate">{page.worksheetLabel}</span>
                              <button 
                                onClick={() => {
                                  const updatedPages = pages.filter(p => p.id !== page.id);
                                  const updatedItem = { ...selectedItem, workbookPages: updatedPages };
                                  setSelectedItem(updatedItem);
                                  const updateItem = (items: MenuItem[]): MenuItem[] => items.map(item =>
                                    item.id === selectedItem.id ? updatedItem :
                                    item.children ? { ...item, children: updateItem(item.children) } : item
                                  );
                                  setMenuStructure(updateItem(menuStructure));
                                }}
                                className="text-red-500 hover:text-red-700"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                            
                            <select
                              value={page.worksheetId}
                              onChange={(e) => {
                                const ws = allWorksheets.find(w => w.id === e.target.value);
                                const updatedPages = pages.map(p =>
                                  p.id === page.id ? { 
                                    ...p, 
                                    worksheetId: e.target.value,
                                    worksheetSlug: ws?.slug || '',
                                    worksheetLabel: ws?.label || 'Pracovní list',
                                    worksheetCover: ws?.coverImage
                                  } : p
                                );
                                const updatedItem = { ...selectedItem, workbookPages: updatedPages };
                                setSelectedItem(updatedItem);
                                const updateItem = (items: MenuItem[]): MenuItem[] => items.map(item =>
                                  item.id === selectedItem.id ? updatedItem :
                                  item.children ? { ...item, children: updateItem(item.children) } : item
                                );
                                setMenuStructure(updateItem(menuStructure));
                              }}
                              className="w-full px-2 py-1.5 text-xs border rounded bg-white"
                            >
                              <option value="">Vybrat pracovní list...</option>
                              {allWorksheets.map(ws => (
                                <option key={ws.id} value={ws.id}>
                                  {ws.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        ))}
                    </div>
                    
                    {pages.length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-4">
                        Žádné stránky. Klikni "Přidat stránku".
                      </p>
                    )}
                  </div>
                );
              })()}
              
              {/* Author */}
              <div className="space-y-2 pt-4 border-t border-slate-200">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Autor
                </label>
                <input
                  type="text"
                  value={selectedItem.author || ''}
                  onChange={(e) => {
                    const updatedItem = { ...selectedItem, author: e.target.value };
                    setSelectedItem(updatedItem);
                    const updateItem = (items: MenuItem[]): MenuItem[] => items.map(item =>
                      item.id === selectedItem.id ? updatedItem :
                      item.children ? { ...item, children: updateItem(item.children) } : item
                    );
                    setMenuStructure(updateItem(menuStructure));
                  }}
                  placeholder="Jméno autora..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              
              {/* Eshop URL */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Odkaz na eshop
                </label>
                <input
                  type="url"
                  value={selectedItem.eshopUrl || ''}
                  onChange={(e) => {
                    const updatedItem = { ...selectedItem, eshopUrl: e.target.value };
                    setSelectedItem(updatedItem);
                    const updateItem = (items: MenuItem[]): MenuItem[] => items.map(item =>
                      item.id === selectedItem.id ? updatedItem :
                      item.children ? { ...item, children: updateItem(item.children) } : item
                    );
                    setMenuStructure(updateItem(menuStructure));
                  }}
                  placeholder="https://eshop.vividbooks.com/..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {selectedItem.eshopUrl && (
                  <a href={selectedItem.eshopUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline">
                    <ExternalLink className="w-3 h-3" /> Otevřít eshop
                  </a>
                )}
              </div>
              
              {/* Bonuses */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Bonusy
                  </label>
                  <button
                    onClick={() => {
                      const newBonus: WorkbookBonus = {
                        id: `bonus-${Date.now()}`,
                        label: '',
                        url: '',
                        type: 'link',
                      };
                      const updatedItem = {
                        ...selectedItem,
                        bonuses: [...(selectedItem.bonuses || []), newBonus]
                      };
                      setSelectedItem(updatedItem);
                      const updateItem = (items: MenuItem[]): MenuItem[] => items.map(item =>
                        item.id === selectedItem.id ? updatedItem :
                        item.children ? { ...item, children: updateItem(item.children) } : item
                      );
                      setMenuStructure(updateItem(menuStructure));
                    }}
                    className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Přidat bonus
                  </button>
                </div>
                
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {(selectedItem.bonuses || []).map((bonus) => (
                    <div key={bonus.id} className="bg-slate-50 rounded-lg p-2 space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={bonus.label}
                          onChange={(e) => {
                            const updatedBonuses = (selectedItem.bonuses || []).map(b =>
                              b.id === bonus.id ? { ...b, label: e.target.value } : b
                            );
                            const updatedItem = { ...selectedItem, bonuses: updatedBonuses };
                            setSelectedItem(updatedItem);
                            const updateItem = (items: MenuItem[]): MenuItem[] => items.map(item =>
                              item.id === selectedItem.id ? updatedItem :
                              item.children ? { ...item, children: updateItem(item.children) } : item
                            );
                            setMenuStructure(updateItem(menuStructure));
                          }}
                          placeholder="Název bonusu..."
                          className="flex-1 px-2 py-1 text-xs border rounded"
                        />
                        <button 
                          onClick={() => {
                            const updatedBonuses = (selectedItem.bonuses || []).filter(b => b.id !== bonus.id);
                            const updatedItem = { ...selectedItem, bonuses: updatedBonuses };
                            setSelectedItem(updatedItem);
                            const updateItem = (items: MenuItem[]): MenuItem[] => items.map(item =>
                              item.id === selectedItem.id ? updatedItem :
                              item.children ? { ...item, children: updateItem(item.children) } : item
                            );
                            setMenuStructure(updateItem(menuStructure));
                          }}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <input
                        type="url"
                        value={bonus.url || ''}
                        onChange={(e) => {
                          const updatedBonuses = (selectedItem.bonuses || []).map(b =>
                            b.id === bonus.id ? { ...b, url: e.target.value } : b
                          );
                          const updatedItem = { ...selectedItem, bonuses: updatedBonuses };
                          setSelectedItem(updatedItem);
                          const updateItem = (items: MenuItem[]): MenuItem[] => items.map(item =>
                            item.id === selectedItem.id ? updatedItem :
                            item.children ? { ...item, children: updateItem(item.children) } : item
                          );
                          setMenuStructure(updateItem(menuStructure));
                        }}
                        placeholder="URL odkazu..."
                        className="w-full px-2 py-1 text-xs border rounded"
                      />
                    </div>
                  ))}
                </div>
                
                {(!selectedItem.bonuses || selectedItem.bonuses.length === 0) && (
                  <p className="text-xs text-slate-400 text-center py-2">
                    Žádné bonusy.
                  </p>
                )}
              </div>
              
              {/* Save Button */}
              <button
                onClick={async () => {
                  try {
                    const { data: { session } } = await getSupabaseSession();
                    if (!session?.access_token) { alert('Nepřihlášen'); return; }
                    
                    const response = await fetch(
                      `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/menu`,
                      {
                        method: 'PUT',
                        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ menu: menuStructure, category: currentCategory })
                      }
                    );
                    
                    if (response.ok) {
                      alert('Uloženo!');
                      window.location.reload();
                    } else {
                      alert('Chyba: ' + await response.text());
                    }
                  } catch (err) {
                    alert('Chyba: ' + err);
                  }
                }}
                style={{
                  width: '100%',
                  padding: '12px 24px',
                  backgroundColor: '#22c55e',
                  color: 'white',
                  borderRadius: '12px',
                  fontWeight: 500,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#16a34a'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#22c55e'}
              >
                <Check className="w-4 h-4" />
                Uložit změny
              </button>
              
              {/* Info */}
              <div className="text-xs text-slate-400 pt-2 border-t">
                <p>ID: {selectedItem.id}</p>
                <p>Typ: workbook</p>
              </div>
            </div>
          </div>
        )}
        
        {/* Folder Settings Panel - Shows when a folder (not workbook) is selected */}
        {selectedItem && isFolder(selectedItem) && selectedItem.type !== 'workbook' && (
          <div 
            className="flex-shrink-0 h-full bg-white border-r border-slate-200 overflow-y-auto"
            style={{ width: 320, minWidth: 320 }}
          >
            <div className="p-4 space-y-4">
              {/* Folder Header */}
              <div className="flex items-start gap-3">
                <div 
                  className="w-16 h-16 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: selectedItem.color || '#bbf7d0' }}
                >
                  <Folder className="w-8 h-8 text-white/80" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-800 truncate">{selectedItem.label}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Složka • {selectedItem.children?.length || 0} položek
                  </p>
                </div>
              </div>
              
              {/* Folder Name */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Název složky
                </label>
                <input
                  type="text"
                  value={selectedItem.label}
                  onChange={(e) => {
                    const updateLabel = (items: MenuItem[]): MenuItem[] => {
                      return items.map(item => {
                        if (item.id === selectedItem.id) {
                          return { ...item, label: e.target.value };
                        }
                        if (item.children) {
                          return { ...item, children: updateLabel(item.children) };
                        }
                        return item;
                      });
                    };
                    setMenuStructure(updateLabel(menuStructure));
                    setSelectedItem({ ...selectedItem, label: e.target.value });
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              
              {/* Folder Color + Text Color - same row */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Barvy
                </label>
                <div className="flex items-center gap-4">
                  {/* Folder background color */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Pozadí:</span>
                    <div className="relative w-8 h-8 rounded-lg border border-slate-200 overflow-hidden shadow-sm cursor-pointer">
                      <input 
                        type="color" 
                        value={selectedItem.color || '#bbf7d0'} 
                        onChange={(e) => {
                          const updateColor = (items: MenuItem[]): MenuItem[] => {
                            return items.map(item => {
                              if (item.id === selectedItem.id) {
                                return { ...item, color: e.target.value };
                              }
                              if (item.children) {
                                return { ...item, children: updateColor(item.children) };
                              }
                              return item;
                            });
                          };
                          setMenuStructure(updateColor(menuStructure));
                          setSelectedItem({ ...selectedItem, color: e.target.value });
                        }}
                        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] p-0 border-0 cursor-pointer"
                      />
                    </div>
                  </div>
                  
                  {/* Text color */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Text:</span>
                    <div className="relative w-8 h-8 rounded-lg border border-slate-200 overflow-hidden shadow-sm cursor-pointer">
                      <input 
                        type="color" 
                        value={selectedItem.textColor || '#ffffff'} 
                        onChange={(e) => {
                          const updateTextColor = (items: MenuItem[]): MenuItem[] => {
                            return items.map(item => {
                              if (item.id === selectedItem.id) {
                                return { ...item, textColor: e.target.value };
                              }
                              if (item.children) {
                                return { ...item, children: updateTextColor(item.children) };
                              }
                              return item;
                            });
                          };
                          setMenuStructure(updateTextColor(menuStructure));
                          setSelectedItem({ ...selectedItem, textColor: e.target.value });
                        }}
                        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] p-0 border-0 cursor-pointer"
                      />
                    </div>
                    <button
                      onClick={() => {
                        const updateTextColor = (items: MenuItem[]): MenuItem[] => {
                          return items.map(item => {
                            if (item.id === selectedItem.id) {
                              return { ...item, textColor: '#ffffff' };
                            }
                            if (item.children) {
                              return { ...item, children: updateTextColor(item.children) };
                            }
                            return item;
                          });
                        };
                        setMenuStructure(updateTextColor(menuStructure));
                        setSelectedItem({ ...selectedItem, textColor: '#ffffff' });
                      }}
                      className={`px-2 py-1 text-xs border rounded transition-colors ${
                        selectedItem.textColor === '#ffffff' || !selectedItem.textColor
                          ? 'bg-slate-100 border-slate-300 text-slate-700'
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                      title="Bílá (pro tmavé pozadí)"
                    >
                      Bílá
                    </button>
                    <button
                      onClick={() => {
                        const updateTextColor = (items: MenuItem[]): MenuItem[] => {
                          return items.map(item => {
                            if (item.id === selectedItem.id) {
                              return { ...item, textColor: '#4E5871' };
                            }
                            if (item.children) {
                              return { ...item, children: updateTextColor(item.children) };
                            }
                            return item;
                          });
                        };
                        setMenuStructure(updateTextColor(menuStructure));
                        setSelectedItem({ ...selectedItem, textColor: '#4E5871' });
                      }}
                      className={`px-2 py-1 text-xs border rounded transition-colors ${
                        selectedItem.textColor === '#4E5871'
                          ? 'bg-slate-700 border-slate-600 text-white'
                          : 'bg-slate-600 border-slate-500 text-white/70 hover:bg-slate-700 hover:text-white'
                      }`}
                      title="Tmavá (pro světlé pozadí)"
                    >
                      Tmavá
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Cover Image */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Náhledový obrázek (URL)
                </label>
                <input
                  type="text"
                  value={selectedItem.coverImage || ''}
                  onChange={(e) => {
                    const updateCoverImage = (items: MenuItem[]): MenuItem[] => {
                      return items.map(item => {
                        if (item.id === selectedItem.id) {
                          return { ...item, coverImage: e.target.value };
                        }
                        if (item.children) {
                          return { ...item, children: updateCoverImage(item.children) };
                        }
                        return item;
                      });
                    };
                    setMenuStructure(updateCoverImage(menuStructure));
                    setSelectedItem({ ...selectedItem, coverImage: e.target.value });
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="https://..."
                />
                {selectedItem.coverImage && (
                  <img 
                    src={selectedItem.coverImage} 
                    alt="Preview" 
                    className="w-full h-24 object-cover rounded-lg mt-2"
                  />
                )}
              </div>
              
              {/* Vzhled položky (v menu) */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Vzhled položky (v menu)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      const updateViewMode = (items: MenuItem[]): MenuItem[] => {
                        return items.map(item => {
                          if (item.id === selectedItem.id) {
                            return { ...item, viewMode: 'classic' };
                          }
                          if (item.children) {
                            return { ...item, children: updateViewMode(item.children) };
                          }
                          return item;
                        });
                      };
                      setMenuStructure(updateViewMode(menuStructure));
                      setSelectedItem({ ...selectedItem, viewMode: 'classic' });
                    }}
                    className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                      selectedItem.viewMode === 'classic' 
                        ? 'border-indigo-500 bg-indigo-50' 
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <LayoutGrid className={`w-5 h-5 ${selectedItem.viewMode === 'classic' ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <span className={`text-xs font-medium ${selectedItem.viewMode === 'classic' ? 'text-indigo-600' : 'text-slate-600'}`}>
                      Klasická ikona
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      const updateViewMode = (items: MenuItem[]): MenuItem[] => {
                        return items.map(item => {
                          if (item.id === selectedItem.id) {
                            return { ...item, viewMode: 'rich' };
                          }
                          if (item.children) {
                            return { ...item, children: updateViewMode(item.children) };
                          }
                          return item;
                        });
                      };
                      setMenuStructure(updateViewMode(menuStructure));
                      setSelectedItem({ ...selectedItem, viewMode: 'rich' });
                    }}
                    className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                      (!selectedItem.viewMode || selectedItem.viewMode === 'rich')
                        ? 'border-indigo-500 bg-indigo-50' 
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <Image className={`w-5 h-5 ${(!selectedItem.viewMode || selectedItem.viewMode === 'rich') ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <span className={`text-xs font-medium ${(!selectedItem.viewMode || selectedItem.viewMode === 'rich') ? 'text-indigo-600' : 'text-slate-600'}`}>
                      Rozšířený náhled
                    </span>
                  </button>
                </div>
              </div>
              
              {/* Zobrazení obsahu (po otevření) */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Zobrazení obsahu (po otevření)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      const updateContentView = (items: MenuItem[]): MenuItem[] => {
                        return items.map(item => {
                          if (item.id === selectedItem.id) {
                            return { ...item, contentView: 'files' };
                          }
                          if (item.children) {
                            return { ...item, children: updateContentView(item.children) };
                          }
                          return item;
                        });
                      };
                      setMenuStructure(updateContentView(menuStructure));
                      setSelectedItem({ ...selectedItem, contentView: 'files' });
                    }}
                    className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                      selectedItem.contentView === 'files'
                        ? 'border-indigo-500 bg-indigo-50' 
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <Folder className={`w-5 h-5 ${selectedItem.contentView === 'files' ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <span className={`text-xs font-medium ${selectedItem.contentView === 'files' ? 'text-indigo-600' : 'text-slate-600'}`}>
                      Složky a soubory
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      const updateContentView = (items: MenuItem[]): MenuItem[] => {
                        return items.map(item => {
                          if (item.id === selectedItem.id) {
                            return { ...item, contentView: 'overview' };
                          }
                          if (item.children) {
                            return { ...item, children: updateContentView(item.children) };
                          }
                          return item;
                        });
                      };
                      setMenuStructure(updateContentView(menuStructure));
                      setSelectedItem({ ...selectedItem, contentView: 'overview' });
                    }}
                    className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                      (!selectedItem.contentView || selectedItem.contentView === 'overview')
                        ? 'border-indigo-500 bg-indigo-50' 
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <Settings className={`w-5 h-5 ${(!selectedItem.contentView || selectedItem.contentView === 'overview') ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <span className={`text-xs font-medium ${(!selectedItem.contentView || selectedItem.contentView === 'overview') ? 'text-indigo-600' : 'text-slate-600'}`}>
                      Přehled sekcí
                    </span>
                  </button>
                </div>
              </div>
              
              {/* Save Button */}
              <button
                onClick={async () => {
                  try {
                    console.log('[FolderSettings] Saving menu structure...');
                    console.log('[FolderSettings] Selected item:', selectedItem);
                    console.log('[FolderSettings] Menu structure:', menuStructure);
                    
                    const { data: { session } } = await getSupabaseSession();
                    if (!session?.access_token) {
                      alert('Nepřihlášen');
                      return;
                    }
                    
                    const response = await fetch(
                      `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/menu`,
                      {
                        method: 'PUT',
                        headers: {
                          'Authorization': `Bearer ${session.access_token}`,
                          'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ menu: menuStructure, category: currentCategory })
                      }
                    );
                    
                    const responseText = await response.text();
                    console.log('[FolderSettings] Response:', response.status, responseText);
                    
                    if (response.ok) {
                      alert('Nastavení uloženo! Stránka se obnoví.');
                      // Reload to see changes
                      window.location.reload();
                    } else {
                      alert('Chyba při ukládání: ' + responseText);
                    }
                  } catch (err) {
                    console.error('Save error:', err);
                    alert('Chyba při ukládání: ' + err);
                  }
                }}
                style={{
                  width: '100%',
                  padding: '12px 24px',
                  backgroundColor: '#4E5871',
                  color: 'white',
                  borderRadius: '12px',
                  fontWeight: 500,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#3d4660'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#4E5871'}
              >
                <Check className="w-4 h-4" />
                Uložit nastavení
              </button>
              
              {/* Folder Info */}
              <div className="space-y-1 pt-4 border-t border-slate-100">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Info</h4>
                <div className="bg-slate-50 rounded-lg p-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5" />
                      ID
                    </span>
                    <code className="text-xs bg-white px-2 py-0.5 rounded border">{selectedItem.id}</code>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Folder className="w-3.5 h-3.5" />
                      Typ
                    </span>
                    <code className="text-xs bg-white px-2 py-0.5 rounded border">{selectedItem.type || 'folder'}</code>
                  </div>
                  {selectedItem.slug && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" />
                        Slug
                      </span>
                      <code className="text-xs bg-white px-2 py-0.5 rounded border">{selectedItem.slug}</code>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Item Creation Dialog (folder, document, board, etc.) */}
      {showItemDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200]">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-[420px]">
            <h3 className="text-lg font-semibold mb-4">
              {pendingItemType === 'folder' ? 'Nová složka' :
               pendingItemType === 'workbook' ? 'Nový pracovní sešit' :
               pendingItemType === 'document' ? 'Nový dokument' :
               pendingItemType === 'board' ? 'Nový board' :
               pendingItemType === 'worksheet-pdf' ? 'Nový pracovní list (PDF)' :
               pendingItemType === 'worksheet-editor' ? 'Nový pracovní list' :
               pendingItemType === 'link' ? 'Nový odkaz' : 'Nová položka'}
            </h3>
            
            {/* Name field - always shown */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-slate-600 mb-1">Název</label>
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="Název..."
                className="w-full px-4 py-2 border rounded-lg"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setShowItemDialog(false);
                  }
                }}
              />
            </div>
            
            {/* URL field - for links */}
            {pendingItemType === 'link' && (
              <div className="mb-3">
                <label className="block text-sm font-medium text-slate-600 mb-1">URL odkazu</label>
                <input
                  type="url"
                  value={newItemUrl}
                  onChange={(e) => setNewItemUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
            )}
            
            {/* PDF file - for worksheet-pdf */}
            {pendingItemType === 'worksheet-pdf' && (
              <>
                <div className="mb-3">
                  <label className="block text-sm font-medium text-slate-600 mb-1">PDF soubor *</label>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setNewItemPdfFile(file);
                        if (!newItemName) {
                          setNewItemName(file.name.replace('.pdf', '').replace(/_/g, ' '));
                        }
                      }
                    }}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium text-slate-600 mb-1">Náhledový obrázek (volitelné)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setNewItemPreviewFile(e.target.files?.[0] || null)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </>
            )}
            
            <div className="flex gap-2 justify-end mt-4">
              <button
                onClick={() => {
                  setShowItemDialog(false);
                  setNewItemName('');
                  setNewItemUrl('');
                  setNewItemPdfFile(null);
                  setNewItemPreviewFile(null);
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#e2e8f0',
                  color: '#475569',
                  borderRadius: '8px',
                  fontWeight: 500,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Zrušit
              </button>
              <button
                disabled={isUploading || !newItemName.trim() || (pendingItemType === 'worksheet-pdf' && !newItemPdfFile)}
                onClick={async () => {
                  if (!newItemName.trim() || pendingItemColumn === null) return;
                  
                  if (pendingItemType === 'worksheet-pdf' && newItemPdfFile) {
                    setIsUploading(true);
                    try {
                      await createWorksheetPdf(pendingItemColumn, newItemName.trim(), newItemPdfFile, newItemPreviewFile || undefined);
                    } finally {
                      setIsUploading(false);
                    }
                  } else if (pendingItemType === 'link') {
                    await createLink(pendingItemColumn, newItemName.trim(), newItemUrl);
                  } else {
                    await createItem(pendingItemColumn, pendingItemType, newItemName.trim());
                  }
                  
                  setShowItemDialog(false);
                  setNewItemName('');
                  setNewItemUrl('');
                  setNewItemPdfFile(null);
                  setNewItemPreviewFile(null);
                  setPendingItemColumn(null);
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: isUploading ? '#94a3b8' : 
                                   pendingItemType === 'folder' ? '#f59e0b' : 
                                   pendingItemType === 'board' ? '#8b5cf6' : '#22c55e',
                  color: 'white',
                  borderRadius: '8px',
                  fontWeight: 500,
                  border: 'none',
                  cursor: isUploading ? 'wait' : 'pointer',
                  opacity: (!newItemName.trim() || (pendingItemType === 'worksheet-pdf' && !newItemPdfFile)) ? 0.5 : 1,
                }}
              >
                {isUploading ? 'Nahrávám...' : 'Vytvořit'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* AI Content Agent Panel */}
      <AIContentAgent
        isOpen={showAIAgent}
        onClose={() => setShowAIAgent(false)}
        currentCategory={currentCategory}
        menuStructure={menuStructure}
        selectedItem={selectedItem}
        selectedPageDetails={selectedPageDetails}
        onRefreshMenu={() => {
          setLoading(true);
          window.location.reload();
        }}
      />
      
      {/* Move Modal */}
      {showMoveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Move className="w-5 h-5 text-indigo-600" />
              Přesunout {checkedItems.size} položek
            </h3>
            
            <p className="text-sm text-slate-600 mb-4">
              Vyberte cílovou složku:
            </p>
            
            <div className="max-h-64 overflow-y-auto border rounded-lg mb-4">
              {/* Root option */}
              <button
                onClick={() => setMoveTargetId(null)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 border-b ${
                  moveTargetId === null ? 'bg-indigo-50 text-indigo-700' : ''
                }`}
              >
                <Home className="w-4 h-4" />
                Kořen ({currentCategory})
              </button>
              
              {/* Folder options */}
              {getAllFolders(menuStructure).map(folder => (
                <button
                  key={folder.id}
                  onClick={() => setMoveTargetId(folder.id)}
                  disabled={checkedItems.has(folder.id)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b ${
                    moveTargetId === folder.id ? 'bg-indigo-50 text-indigo-700' : ''
                  } ${checkedItems.has(folder.id) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <Folder className="w-4 h-4 text-amber-500" />
                    <span className="truncate">{folder.path}</span>
                  </div>
                </button>
              ))}
            </div>
            
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowMoveModal(false);
                  setMoveTargetId(null);
                }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Zrušit
              </button>
              <button
                onClick={handleBulkMove}
                disabled={isMoving}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isMoving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Přesouvám...
                  </>
                ) : (
                  <>
                    <Move className="w-4 h-4" />
                    Přesunout
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

