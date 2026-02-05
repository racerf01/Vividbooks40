import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Lottie from "lottie-react";
import { 
  ChevronRight, 
  ChevronDown, 
  FileText, 
  FolderOpen, 
  Folder,
  Plus,
  Trash2,
  Edit2,
  GripVertical,
  Settings,
  Book,
  LayoutGrid,
  Image as ImageIcon,
  Play,
  FileEdit,
  Upload,
  ArrowLeft
} from 'lucide-react';
import { DndContext, DragEndEvent, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DOCUMENT_TYPES } from '../types/document-types';
import { projectId, publicAnonKey } from '../utils/supabase/info.tsx';
import { supabase } from '../utils/supabase/client';
import { getIcon, IconPicker } from './IconPicker';

interface Category {
  id: string;
  label: string;
}

interface MenuItem {
  id: string;
  label: string;
  slug?: string;
  icon?: string;
  type?: string;
  color?: string;
  coverImage?: string;
  viewMode?: 'classic' | 'rich'; 
  layoutMode?: 'standard' | 'overview'; 
  children?: MenuItem[];
  externalUrl?: string;
}

interface Page {
  id: string;
  slug: string;
  title: string;
  category: string;
  description?: string;
}

const SUBJECTS = [
  { id: 'fyzika', label: 'Fyzika' },
  { id: 'chemie', label: 'Chemie' },
  { id: 'prirodopis', label: 'Přírodopis' },
  { id: 'matematika', label: 'Matematika' },
  { id: 'dejepis', label: 'Dějepis' }
];

const OTHER_CATEGORIES = [
  { id: 'navody', label: 'Návody' },
  { id: 'knihovna-vividbooks', label: 'Knihovna Vividbooks' }
];

const ALL_CATEGORIES = [...SUBJECTS, ...OTHER_CATEGORIES];

interface AdminSidebarProps {
  activeCategory: string;
  activeSlug: string | null;
  onSelectPage: (category: string, slug: string) => void;
}

interface SortableItemProps {
  item: MenuItem;
  level: number;
  activeSlug: string | null;
  expandedItems: Set<string>;
  onToggleExpand: (id: string) => void;
  onSelectPage: (slug: string) => void;
  onDeleteItem: (item: MenuItem) => void;
  onEditItem: (item: MenuItem) => void;
  onAddChild: (parentId: string, type: 'page' | 'group' | 'workbook', label: string, slug?: string) => void;
  onCreatePage: (label: string, parentId?: string, documentType?: string) => Promise<void>;
  category: string;
  allPages: MenuItem[];
  activeTab: 'folders' | 'workbooks';
  navigate: (path: string) => void;
}

function SortableItem({ 
  item, 
  level, 
  activeSlug, 
  expandedItems, 
  onToggleExpand, 
  onSelectPage,
  onDeleteItem,
  onEditItem,
  onAddChild,
  onCreatePage,
  category,
  allPages,
  activeTab,
  navigate
}: SortableItemProps) {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [newItemLabel, setNewItemLabel] = useState('');
  const [worksheetSubmenu, setWorksheetSubmenu] = useState(false);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isExpanded = expandedItems.has(item.id);
  const hasChildren = item.children && item.children.length > 0;
  const isGroup = !item.slug || item.type === 'workbook';
  const isWorkbook = item.type === 'workbook' || item.icon === 'book';
  const isActiveItem = item.slug === activeSlug;

  const showFolderBackground = level === 0 && isExpanded && hasChildren;
  
  const containsSubfolders = item.children?.some(child => 
       !child.slug || child.type === 'workbook' || (child.children && child.children.length > 0)
  );
  const isCompactFolder = hasChildren && !containsSubfolders;

  const handleAddChild = async (type: 'page' | 'group' | 'workbook' | 'board' | 'worksheet-create' | 'worksheet-pdf') => {
    if (!newItemLabel.trim()) return;
    
    const label = newItemLabel.trim();
    
    try {
      if (type === 'page') {
        await onCreatePage(label, item.id, 'page');
      } else if (type === 'board') {
        await onCreatePage(label, item.id, 'board');
      } else if (type === 'worksheet-create') {
        await onCreatePage(label, item.id, 'worksheet-editor');
      } else if (type === 'worksheet-pdf') {
        await onCreatePage(label, item.id, 'worksheet');
      } else if (type === 'group') {
        onAddChild(item.id, 'group', label);
      } else if (type === 'workbook') {
        await onCreatePage(label, item.id, 'workbook');
      }
    } catch (err) {
      console.error('Error adding child:', err);
    }
    
    setShowAddMenu(false);
    setNewItemLabel('');
    setWorksheetSubmenu(false);
  };

  const getIconForType = (item: MenuItem) => {
    let type = item.type;
    const icon = item.icon;
    
    if (type === 'workbook' || icon === 'book' || icon === 'workbook') type = 'workbook';
    else if (type === 'worksheet' || icon === 'file-edit') type = 'worksheet';
    else if (type === 'textbook') type = 'textbook';
    else if (type === 'experiment') type = 'experiment';
    else if (type === 'test') type = 'test';
    else if (type === 'exam') type = 'exam';
    else if (type === 'methodology') type = 'methodology';
    else if (type === 'exercise' || type === 'practice') type = 'practice';
    else if ((!type && !hasChildren) || type === 'lesson' || type === 'document' || icon === 'message-square') type = 'lesson';

    const docType = DOCUMENT_TYPES.find(t => t.id === type);
    if (docType) return docType.icon;

    if (type === 'lesson') {
       const lessonType = DOCUMENT_TYPES.find(t => t.id === 'lesson');
       return lessonType ? lessonType.icon : FileText;
    }

    return FileText;
  };

  const Icon = !isGroup ? getIconForType(item) : null;

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className={`transition-all duration-300 rounded-2xl ${showFolderBackground ? 'bg-[#F7F9FC] pb-1 mb-1' : ''}`}
    >
      <div
        className={`
           relative flex items-center gap-1 px-3 cursor-pointer rounded-lg transition-colors group select-none
           ${isCompactFolder ? 'py-1 mb-0.5' : 'py-2 mb-1'}
           ${isActiveItem ? 'nav-item-active' : ''}
        `}
        style={{ 
          paddingLeft: `${0.75 + level * 0.5}rem`,
          backgroundColor: isActiveItem ? '#F1F4F9' : 'transparent',
          color: isActiveItem ? '#1e1b4b' : '#4E5871'
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (item.slug) {
            // Check if this is a board type - navigate to quiz editor instead
            const boardTypes = ['practice', 'test', 'exam'];
            const isBoardType = boardTypes.includes(item.type || '');
            const hasBoardUrl = item.externalUrl?.startsWith('board://');
            
            if (isBoardType || hasBoardUrl) {
              // Try to find board ID from externalUrl or construct from slug
              let boardId = '';
              if (hasBoardUrl) {
                boardId = item.externalUrl!.replace('board://', '');
              } else {
                boardId = `board_${item.slug}`;
              }
              navigate(`/quiz/edit/${boardId}?returnUrl=${encodeURIComponent(`/admin/${category}/${item.slug}`)}`);
            } else {
              onSelectPage(item.slug);
            }
          } else {
            onToggleExpand(item.id);
          }
        }}
        onMouseEnter={(e) => {
          if (!isActiveItem && !showFolderBackground) e.currentTarget.style.backgroundColor = '#F1F4F9';
        }}
        onMouseLeave={(e) => {
            if (!isActiveItem && !showFolderBackground) e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <div 
            {...attributes} 
            {...listeners} 
            className="absolute left-1 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing p-1 hover:bg-slate-200/50 rounded transition-opacity"
            onClick={(e) => e.stopPropagation()}
        >
            <GripVertical className="h-3 w-3 text-slate-400" />
        </div>

        {isGroup && (
            <div 
                className="p-1 -ml-1 rounded-md hover:bg-slate-200/50 text-slate-400 hover:text-slate-600 transition-colors z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleExpand(item.id);
                }}
            >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
                )}
            </div>
        )}

        {isGroup ? (
             isWorkbook ? (
                <Book className={`h-4 w-4 flex-shrink-0 ${isActiveItem ? 'text-indigo-900' : ''}`} />
             ) : (
                <Folder 
                  className={`h-4 w-4 flex-shrink-0 ${isActiveItem ? 'text-indigo-900' : ''}`}
                  style={{ 
                    color: isActiveItem ? '#1e1b4b' : (item.color || '#94a3b8'),
                    fill: isActiveItem ? 'currentColor' : (item.color ? `${item.color}20` : 'transparent'),
                    fillOpacity: isActiveItem ? 0.1 : 1
                  }} 
                />
             )
        ) : (
             Icon ? (
                <Icon className={`h-4 w-4 flex-shrink-0 ${isActiveItem ? 'text-indigo-600' : 'text-slate-400'}`} />
             ) : (
                <FileText className={`h-4 w-4 flex-shrink-0 ${isActiveItem ? 'text-indigo-600' : 'text-slate-400'}`} />
             )
        )}

        <span className={`truncate flex-1 ml-1.5 ${isActiveItem ? 'font-semibold text-slate-900' : ''} text-[0.9rem]`}>
            {item.label}
        </span>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {isGroup && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAddMenu(!showAddMenu);
                    if (!isExpanded) onToggleExpand(item.id);
                  }}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded transition-colors"
                  title="Přidat položku"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditItem(item);
              }}
              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded transition-colors"
              title="Upravit"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteItem(item);
              }}
              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              title="Smazat"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
        </div>
      </div>

      {showAddMenu && isGroup && (
        <div className="mx-3 my-1 p-3 bg-white border border-slate-200 rounded-lg shadow-lg z-20 relative" style={{ marginLeft: `${0.75 + level * 0.5 + 1.5}rem` }}>
          {/* Submenu state for worksheet options */}
          {worksheetSubmenu ? (
            <>
              <button
                onClick={() => setWorksheetSubmenu(false)}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 mb-2"
              >
                <ArrowLeft className="h-3 w-3" />
                Zpět
              </button>
              <p className="text-[10px] uppercase text-muted-foreground font-medium mb-2">Pracovní list</p>
              <input
                type="text"
                value={newItemLabel}
                onChange={(e) => setNewItemLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setShowAddMenu(false);
                    setNewItemLabel('');
                    setWorksheetSubmenu(false);
                  }
                }}
                placeholder="Název pracovního listu..."
                className="w-full px-2 py-1.5 bg-background rounded focus:outline-none focus:ring-2 focus:ring-ring mb-2 shadow-sm"
                style={{ color: '#4E5871', fontSize: '0.85rem' }}
                autoFocus
              />
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={() => {
                    handleAddChild('worksheet-create');
                    setWorksheetSubmenu(false);
                  }}
                  disabled={!newItemLabel.trim()}
                  className="flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded hover:bg-emerald-100 transition-colors disabled:opacity-50"
                  style={{ fontSize: '0.8rem' }}
                >
                  <FileEdit className="h-4 w-4" />
                  <div className="text-left">
                    <div className="font-medium">Vytvořit</div>
                    <div className="text-[10px] opacity-70">Otevřít editor pracovních listů</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    handleAddChild('worksheet-pdf');
                    setWorksheetSubmenu(false);
                  }}
                  disabled={!newItemLabel.trim()}
                  className="flex items-center gap-2 px-3 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded hover:bg-amber-100 transition-colors disabled:opacity-50"
                  style={{ fontSize: '0.8rem' }}
                >
                  <Upload className="h-4 w-4" />
                  <div className="text-left">
                    <div className="font-medium">Nahrát PDF</div>
                    <div className="text-[10px] opacity-70">Přidat existující pracovní list</div>
                  </div>
                </button>
              </div>
            </>
          ) : (
            <>
              <input
                type="text"
                value={newItemLabel}
                onChange={(e) => setNewItemLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newItemLabel.trim()) handleAddChild('page');
                  if (e.key === 'Escape') {
                    setShowAddMenu(false);
                    setNewItemLabel('');
                  }
                }}
                placeholder="Název..."
                className="w-full px-2 py-1.5 bg-background rounded focus:outline-none focus:ring-2 focus:ring-ring mb-3 shadow-sm"
                style={{ color: '#4E5871', fontSize: '0.85rem' }}
                autoFocus
              />
              
              <div className="grid grid-cols-2 gap-1.5">
                {/* Složka */}
                <button
                  onClick={() => handleAddChild(activeTab === 'workbooks' ? 'workbook' : 'group')}
                  disabled={!newItemLabel.trim()}
                  className="flex items-center justify-center gap-1.5 px-2 py-2 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                  style={{ fontSize: '0.75rem', color: '#4E5871' }}
                  title="Přidat složku"
                >
                  <Folder className="h-4 w-4 text-slate-500" />
                  Složka
                </button>
                
                {/* Dokument */}
                <button
                  onClick={() => handleAddChild('page')}
                  disabled={!newItemLabel.trim()}
                  className="flex items-center justify-center gap-1.5 px-2 py-2 border border-blue-200 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
                  style={{ fontSize: '0.75rem', color: '#1e40af' }}
                  title="Přidat dokument"
                >
                  <FileText className="h-4 w-4" />
                  Dokument
                </button>
                
                {/* Board */}
                <button
                  onClick={() => handleAddChild('board')}
                  disabled={!newItemLabel.trim()}
                  className="flex items-center justify-center gap-1.5 px-2 py-2 border border-purple-200 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-50"
                  style={{ fontSize: '0.75rem', color: '#7c3aed' }}
                  title="Přidat Vividboard"
                >
                  <Play className="h-4 w-4" />
                  Board
                </button>
                
                {/* Pracovní list */}
                <button
                  onClick={() => setWorksheetSubmenu(true)}
                  disabled={!newItemLabel.trim()}
                  className="flex items-center justify-center gap-1.5 px-2 py-2 border border-emerald-200 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50"
                  style={{ fontSize: '0.75rem', color: '#059669' }}
                  title="Přidat pracovní list"
                >
                  <FileEdit className="h-4 w-4" />
                  Pracovní list
                </button>
              </div>

            </>
          )}
        </div>
      )}

      {hasChildren && isExpanded && (
        <div className={`relative ${level > 0 ? 'ml-2 border-l border-slate-100' : ''}`}>
          {(() => {
            const groups: Record<string, MenuItem[]> = {};
            
            item.children!.forEach(child => {
                let type = child.type;
                const isFolder = child.type === 'group' || child.type === 'folder' || (child.children && child.children.length > 0);

                if (type === 'workbook' || child.icon === 'book' || child.icon === 'workbook') type = 'workbook';
                else if (type === 'worksheet' || child.icon === 'file-edit') type = 'worksheet';
                else if (type === 'textbook') type = 'textbook';
                else if (type === 'experiment') type = 'experiment';
                else if (type === 'methodology') type = 'methodology';
                else if (type === 'test') type = 'test';
                else if (type === 'exam') type = 'exam';
                else if (type === 'exercise' || type === 'practice') type = 'practice';
                else if (isFolder && !child.slug) type = 'folder'; 
                else if ((!type) || type === 'lesson' || type === 'document' || child.icon === 'message-square') type = 'lesson';

                if (!type) type = 'lesson';

                if (!groups[type]) groups[type] = [];
                groups[type].push(child);
            });

            const sortOrder = [
               'folder', 
               'textbook', 
               'lesson', 
               'worksheet', 
               'experiment', 
               'methodology', 
               'practice', 
               'test', 
               'exam'
            ];
            
            const sortedGroups = Object.keys(groups).sort((a, b) => {
               const indexA = sortOrder.indexOf(a);
               const indexB = sortOrder.indexOf(b);
               if (indexA === -1 && indexB === -1) return 0;
               if (indexA === -1) return 1;
               if (indexB === -1) return -1;
               return indexA - indexB;
            });

             const typeLabels: Record<string, string> = {
                 'lesson': 'Lekce',
                 'worksheet': 'Pracovní listy',
                 'textbook': 'Učební texty',
                 'experiment': 'Experimenty',
                 'methodology': 'Metodika',
                 'test': 'Testy',
                 'exam': 'Písemky',
                 'practice': 'Procvičování',
                 'folder': 'Složky',
                 'workbook': 'Pracovní sešity'
              };

            return sortedGroups.map(type => (
                <div key={type} className="mb-1">
                    {type !== 'folder' && (
                         <div 
                           className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 px-3 mt-1"
                           style={{ paddingLeft: `${0.75 + (level + 1) * 0.5}rem` }}
                         >
                            {typeLabels[type] || type}
                         </div>
                    )}
                    {groups[type].map(child => (
                        <SortableItem
                          key={child.id}
                          item={child}
                          level={level + 1}
                          activeSlug={activeSlug}
                          expandedItems={expandedItems}
                          onToggleExpand={onToggleExpand}
                          onSelectPage={onSelectPage}
                          onDeleteItem={onDeleteItem}
                          onEditItem={onEditItem}
                          onAddChild={onAddChild}
                          onCreatePage={onCreatePage}
                          category={category}
                          allPages={allPages}
                          activeTab={activeTab}
                          navigate={navigate}
                        />
                    ))}
                </div>
            ));
          })()}
        </div>
      )}
    </div>
  );
}

export function AdminSidebar({ activeCategory, activeSlug, onSelectPage }: AdminSidebarProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'folders' | 'workbooks'>('folders');
  const [categories, setCategories] = useState<Category[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showRootAddMenu, setShowRootAddMenu] = useState(false);
  const [newItemLabel, setNewItemLabel] = useState('');
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editCoverImage, setEditCoverImage] = useState('');
  const [previewLottieData, setPreviewLottieData] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'classic' | 'rich'>('classic');
  const [layoutMode, setLayoutMode] = useState<'standard' | 'overview'>('standard');
  const [creating, setCreating] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    const fetchLottie = async () => {
      if (!editCoverImage || !editCoverImage.startsWith('http')) {
        setPreviewLottieData(null);
        return;
      }
      try {
        const res = await fetch(editCoverImage);
        if (res.ok) {
          try {
            const text = await res.clone().text();
            try {
                const data = JSON.parse(text);
                if (data && (data.v || data.layers)) {
                    setPreviewLottieData(data);
                    return;
                }
            } catch {}
          } catch {}
        }
        setPreviewLottieData(null);
      } catch (e) {
        setPreviewLottieData(null);
      }
    };
    
    const timer = setTimeout(fetchLottie, 500);
    return () => clearTimeout(timer);
  }, [editCoverImage]);

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    if (activeCategory) {
      loadMenu();
    }
  }, [activeCategory]);

  const loadCategories = async () => {
    setCategories(ALL_CATEGORIES);
  };

  const loadMenu = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/menu?category=${activeCategory}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setMenu(data.menu || []);
        
        const allIds = new Set<string>();
        const collectIds = (items: MenuItem[]) => {
          items.forEach(item => {
            if (item.children && item.children.length > 0) {
              allIds.add(item.id);
              collectIds(item.children);
            }
          });
        };
        collectIds(data.menu || []);
        setExpandedItems(allIds);
      }
    } catch (err) {
      console.error('Error loading menu:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const createNewPage = async (title: string, parentId?: string, itemType: 'page' | 'workbook' | 'board' | 'worksheet-editor' | 'worksheet' = 'page') => {
    if (creating) return;
    
    setCreating(true);
    try {
      const slug = title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        alert('Relace vypršela. Přihlaste se znovu.');
        return;
      }

      // Determine the document type for the API
      let documentType = 'lesson';
      let externalUrl = '';
      if (itemType === 'workbook') documentType = 'workbook';
      else if (itemType === 'board') {
        documentType = 'practice'; // Board is stored as practice type
        externalUrl = `board://board_${slug}`; // Pre-set the board ID
      }
      else if (itemType === 'worksheet-editor' || itemType === 'worksheet') documentType = 'worksheet';

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/pages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            slug,
            title,
            content: '',
            description: '',
            category: activeCategory,
            documentType,
            externalUrl
          })
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Chyba při vytváření stránky');
      }

      const responseData = await response.json();

      // Determine icon and type for menu item
      let menuType: string | undefined;
      let menuIcon: string | undefined;
      let menuExternalUrl: string | undefined;
      
      if (itemType === 'workbook') {
        menuType = 'workbook';
        menuIcon = 'book';
      } else if (itemType === 'board') {
        menuType = 'practice';
        menuIcon = 'play';
        // Set externalUrl to board:// scheme so it opens in quiz editor
        menuExternalUrl = `board://board_${slug}`;
      } else if (itemType === 'worksheet-editor' || itemType === 'worksheet') {
        menuType = 'worksheet';
        menuIcon = 'file-edit';
      }

      const newPage: MenuItem = {
        id: crypto.randomUUID(),
        label: title,
        slug: slug,
        type: menuType,
        icon: menuIcon,
        externalUrl: menuExternalUrl,
        children: itemType === 'workbook' ? [] : undefined
      };

      let updatedMenu: MenuItem[];
      if (parentId) {
        const findAndUpdate = (items: MenuItem[]): MenuItem[] => {
          return items.map(item => {
            if (item.id === parentId) {
              return {
                ...item,
                children: [...(item.children || []), newPage]
              };
            }
            if (item.children) {
              return {
                ...item,
                children: findAndUpdate(item.children)
              };
            }
            return item;
          });
        };
        updatedMenu = findAndUpdate(menu);
      } else {
        updatedMenu = [...menu, newPage];
      }

      await saveMenu(updatedMenu);
      
      // Navigate to the appropriate editor based on item type
      if (itemType === 'board') {
        // Create the board in localStorage and navigate to quiz editor
        const boardId = `board_${slug}`;
        const { createEmptyQuiz } = await import('../types/quiz');
        const { saveQuiz } = await import('../utils/quiz-storage');
        const newQuiz = createEmptyQuiz();
        newQuiz.id = boardId;
        newQuiz.title = title;
        newQuiz.subject = activeCategory || undefined;
        saveQuiz(newQuiz);
        navigate(`/quiz/edit/${boardId}`);
      } else if (itemType === 'worksheet-editor') {
        // Navigate to worksheet editor
        navigate(`/worksheet/edit/new?title=${encodeURIComponent(title)}&category=${encodeURIComponent(activeCategory || '')}&slug=${encodeURIComponent(slug)}`);
      } else {
        // Navigate to admin page
        navigate(`/admin/${activeCategory}/${slug}`);
      }
    } catch (err) {
      console.error('Error creating page:', err);
      alert('Chyba při vytváření stránky: ' + (err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const handleAddRootItem = async (type: 'page' | 'group' | 'workbook') => {
    if (!newItemLabel.trim()) return;

    if (type === 'page') {
      await createNewPage(newItemLabel.trim(), undefined, 'page');
      setShowRootAddMenu(false);
      setNewItemLabel('');
    } else if (type === 'workbook') {
      await createNewPage(newItemLabel.trim(), undefined, 'workbook');
      setShowRootAddMenu(false);
      setNewItemLabel('');
    } else {
      const newGroup: MenuItem = {
        id: crypto.randomUUID(),
        label: newItemLabel.trim(),
        children: [],
      };

      const updatedMenu = [...menu, newGroup];
      await saveMenu(updatedMenu);
      setShowRootAddMenu(false);
      setNewItemLabel('');
    }
  };

  const handleAddChild = async (parentId: string, type: 'group' | 'workbook' | 'page', label: string, slug?: string) => {
    if (type === 'workbook') {
      await createNewPage(label, parentId, 'workbook');
      return;
    }

    const findAndUpdate = (items: MenuItem[]): MenuItem[] => {
      return items.map(item => {
        if (item.id === parentId) {
          const newChild: MenuItem = {
            id: crypto.randomUUID(),
            label,
            slug,
            children: [],
          };
          return {
            ...item,
            children: [...(item.children || []), newChild]
          };
        }
        if (item.children) {
          return {
            ...item,
            children: findAndUpdate(item.children)
          };
        }
        return item;
      });
    };

    const updatedMenu = findAndUpdate(menu);
    await saveMenu(updatedMenu);
  };

  const getAllPages = (items: MenuItem[]): MenuItem[] => {
    let pages: MenuItem[] = [];
    items.forEach(item => {
      if (item.slug) pages.push(item);
      if (item.children) pages = [...pages, ...getAllPages(item.children)];
    });
    return pages;
  };

  const handleDeleteItem = async (item: MenuItem) => {
    if (!confirm(`Opravdu chcete smazat "${item.label}"?`)) {
      return;
    }

    // Check if this is a board type
    const boardTypes = ['practice', 'test', 'exam'];
    const isBoardType = boardTypes.includes(item.type || '');
    const hasBoardUrl = item.externalUrl?.startsWith('board://');
    
    if (isBoardType || hasBoardUrl) {
      // Delete board from localStorage
      let boardId = '';
      if (hasBoardUrl) {
        boardId = item.externalUrl!.replace('board://', '');
      } else if (item.slug) {
        boardId = `board_${item.slug}`;
      }
      
      if (boardId) {
        // Delete the quiz data
        localStorage.removeItem(`vividbooks_quiz_${boardId}`);
        
        // Also remove from quiz list
        try {
          const quizListStr = localStorage.getItem('vividbooks_quizzes');
          if (quizListStr) {
            const quizList = JSON.parse(quizListStr);
            const updatedList = quizList.filter((q: any) => q.id !== boardId);
            localStorage.setItem('vividbooks_quizzes', JSON.stringify(updatedList));
          }
        } catch (e) {
          console.error('Error updating quiz list:', e);
        }
      }
    }

    // Try to delete from database (may fail for boards that only exist in localStorage)
    let dbDeleteFailed = false;
    if (item.slug) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.access_token) {
          const response = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/pages/${item.slug}?category=${activeCategory}`,
            {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
              }
            }
          );

          if (!response.ok) {
            console.warn(`Failed to delete page from DB (status ${response.status}) - continuing with local deletion`);
            dbDeleteFailed = true;
          }
        } else {
          console.warn('No session available for DB delete - continuing with local deletion');
          dbDeleteFailed = true;
        }
      } catch (err) {
        console.error('Error deleting page from DB:', err);
        dbDeleteFailed = true;
      }
    }

    // For boards, we already deleted from localStorage above, so continue even if DB delete failed
    // For regular documents, show warning if DB delete failed
    if (dbDeleteFailed && !(isBoardType || hasBoardUrl)) {
      alert('Varování: Stránka nebyla smazána z databáze, ale bude odstraněna z menu.');
    }

    const removeItem = (items: MenuItem[]): MenuItem[] => {
      return items.filter(i => {
        if (i.id === item.id) return false;
        if (i.children) {
          i.children = removeItem(i.children);
        }
        return true;
      });
    };

    const updatedMenu = removeItem(menu);
    await saveMenu(updatedMenu);
  };

  const handleEditItem = (item: MenuItem) => {
    setEditingItem(item);
    setEditLabel(item.label);
    setEditIcon(item.icon || '');
    setEditColor(item.color || '');
    setEditCoverImage(item.coverImage || (item as any).lottieUrl || '');
    
    if (item.viewMode) {
       setViewMode(item.viewMode);
    } else {
       setViewMode(!!item.coverImage ? 'rich' : 'classic');
    }

    if (item.layoutMode) {
       setLayoutMode(item.layoutMode);
    } else {
       setLayoutMode('standard');
    }
  };

  const saveEdit = async () => {
    if (!editingItem || !editLabel.trim()) return;

    const updateItem = (items: MenuItem[]): MenuItem[] => {
      return items.map(item => {
        if (item.id === editingItem.id) {
          return { 
            ...item, 
            label: editLabel.trim(),
            icon: editIcon || undefined,
            color: editColor || undefined,
            coverImage: editCoverImage || undefined,
            viewMode: viewMode,
            layoutMode: layoutMode
          };
        }
        if (item.children) {
          return { ...item, children: updateItem(item.children) };
        }
        return item;
      });
    };

    const updatedMenu = updateItem(menu);
    await saveMenu(updatedMenu);
    setEditingItem(null);
    setEditLabel('');
    setEditIcon('');
    setEditColor('');
    setEditCoverImage('');
    setPreviewLottieData(null);
  };

  const saveMenu = async (updatedMenu: MenuItem[]) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/menu`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token || publicAnonKey}`
          },
          body: JSON.stringify({
            category: activeCategory,
            menu: updatedMenu
          })
        }
      );

      if (response.ok) {
        setMenu(updatedMenu);
      }
    } catch (err) {
      console.error('Error saving menu:', err);
    }
  };

  const flattenItems = (items: MenuItem[]): string[] => {
    const result: string[] = [];
    items.forEach(item => {
      result.push(item.id);
      if (item.children) {
        result.push(...flattenItems(item.children));
      }
    });
    return result;
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;

    const findItem = (items: MenuItem[], id: string): MenuItem | null => {
      for (const item of items) {
        if (item.id === id) return item;
        if (item.children) {
          const found = findItem(item.children, id);
          if (found) return found;
        }
      }
      return null;
    };

    const removeItem = (items: MenuItem[], id: string): MenuItem[] => {
      return items.filter(item => {
        if (item.id === id) return false;
        if (item.children) {
          item.children = removeItem(item.children, id);
        }
        return true;
      });
    };

    const insertAfter = (items: MenuItem[], targetId: string, newItem: MenuItem): MenuItem[] => {
      const result: MenuItem[] = [];
      for (const item of items) {
        result.push(item);
        if (item.id === targetId) {
          result.push(newItem);
        }
        if (item.children) {
          item.children = insertAfter(item.children, targetId, newItem);
        }
      }
      return result;
    };

    const draggedItem = findItem(menu, active.id as string);
    if (!draggedItem) return;

    let newMenu = removeItem([...menu], active.id as string);
    newMenu = insertAfter(newMenu, over.id as string, draggedItem);

    await saveMenu(newMenu);
  };

  const migrateToPhysics = async () => {
    if (!confirm('Opravdu chcete přesunout obsah ze všech ostatních předmětů do Fyziky?')) return;
    
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      let physicsItems: MenuItem[] = [];
      
      const physRes = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/menu?category=fyzika`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      if (physRes.ok) {
        const data = await physRes.json();
        physicsItems = data.menu || [];
      }

      for (const cat of ALL_CATEGORIES) {
        if (cat.id === 'fyzika') continue;
        
        const res = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/menu?category=${cat.id}`, {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        });
        
        if (res.ok) {
          const data = await res.json();
          if (data.menu && data.menu.length > 0) {
            physicsItems = [...physicsItems, ...data.menu];
             await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/menu`, {
               method: 'PUT',
               headers: {
                 'Content-Type': 'application/json',
                 'Authorization': `Bearer ${session?.access_token || publicAnonKey}`
               },
               body: JSON.stringify({ category: cat.id, menu: [] })
             });
          }
        }
      }

      await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/menu`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || publicAnonKey}`
        },
        body: JSON.stringify({ category: 'fyzika', menu: physicsItems })
      });

      alert('Hotovo. Obsah byl přesunut do Fyziky.');
      window.location.href = '/admin/fyzika';
    } catch (e) {
      console.error(e);
      alert('Chyba při přesunu.');
    } finally {
      setLoading(false);
    }
  };

  const filteredMenu = menu.filter(item => {
    if (activeTab === 'folders') {
      return item.type !== 'workbook';
    } else {
      return item.type === 'workbook';
    }
  });

  const allPages = getAllPages(menu);

  return (
    <div className="h-full overflow-y-auto" style={{ backgroundColor: '#EAEFFA' }}>
      {/* Header */}
      <div className="p-4 border-b border-slate-200/60">
        <h1 className="text-lg font-bold text-[#4E5871]">Admin Vividbooks</h1>
      </div>
      
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold" style={{ color: '#4E5871', fontSize: '0.85rem' }}>Struktura</h2>
        </div>

        <select
          value={activeCategory}
          onChange={(e) => window.location.href = `/admin/${e.target.value}`}
          className="w-full px-3 py-2 bg-white/50 hover:bg-white transition-colors rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-medium appearance-none cursor-pointer"
          style={{ color: '#4E5871', fontSize: '0.85rem' }}
        >
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.label}
            </option>
          ))}
        </select>

        <div className="flex mt-4 p-1.5 bg-slate-200/40 rounded-xl border border-slate-200/60">
          <button
            onClick={() => setActiveTab('folders')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'folders' 
                ? 'bg-white text-slate-800 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
            Složky
          </button>
          <button
            onClick={() => setActiveTab('workbooks')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'workbooks' 
                ? 'bg-white text-indigo-700 shadow-sm' 
                : 'text-slate-500 hover:text-indigo-600 hover:bg-white/50'
            }`}
          >
             <svg viewBox="0 0 37 33" className="h-4 w-4" fill="currentColor" preserveAspectRatio="xMidYMid meet">
                <path d="M34.2 15.7C34.4 15.2 34.7 14.4 34.2 13.4C34.2 13.3 34.2 13.2 34.2 13.2L28.1 2.9C27.4 1.9 26.4 1.5 25 1.5C23.6 1.5 24.3 1.5 24 1.5C20.6 1.8 17.2 3.7 15.1 6.3C15.1 6.4 14.9 6.5 14.9 6.7C14.5 6.5 14 6.5 13.7 6.4C13.7 6.4 13.7 6.4 13.6 6.4C13.1 6.4 12.5 6.3 11.9 6.3C11.6 6.3 11.2 6.3 10.9 6.3C8.2 6.5 5.6 7.6 3.4 9.5C3.4 9.5 3.4 9.5 3.3 9.6C3 9.9 2.6 10.2 2.3 10.6C1.6 11.5 1.6 12.3 1.7 12.9V13.1L1.8 13.3L2.1 13.9C1.8 14.1 1.6 14.5 1.6 14.8C1.6 14.8 1.6 14.9 1.6 15L8.7 29.8C9 30.3 9.4 30.6 10 30.5C10.4 30.5 11.6 29.2 12 28.8C14.6 26.7 18 25.7 21.3 25.8C21.4 25.8 21.5 25.8 21.6 25.8C21.6 25.8 21.8 25.8 21.9 25.8C21.9 25.8 21.9 25.8 22 25.8C22.2 25.8 22.4 25.8 22.6 25.8C22.7 25.8 22.8 25.8 23 25.8C23.5 25.9 24 25.1 24.3 24.8C26.1 23.2 28.6 22.5 30.9 22.3C31.5 22.3 32.9 22.5 32.7 21.4C32.7 21.1 31.4 19.4 31.5 19.3C31.9 19.1 33.6 19.3 33.9 19.1C33.9 19.1 34.1 18.8 34.1 18.3C34.1 17.9 33.6 17.2 33.2 16.7C33.6 16.5 33.9 16.2 34.2 15.7ZM4.4 10.7C6.2 9.1 8.5 8.1 10.9 8C11.2 8 11.5 8 11.7 8C12.2 8 12.7 8 13.2 8C13.7 8 14.3 8.1 14.6 8.5L21.4 21.8C21.4 21.8 21.4 21.9 21.4 22C21.4 22.3 21.4 22.5 21 22.5C20.2 22.5 19.2 22.2 18.3 22.1C18 22.1 17.7 22.1 17.4 22.1C15.3 22.1 13.1 22.5 11.3 23.5C10.7 23.8 10.1 24.4 9.5 24.4C8.9 24.4 9 24.3 8.8 24L3.2 12.4C3.2 12 3.3 11.7 3.6 11.4C3.8 11.1 4.1 10.9 4.4 10.7ZM30.6 15.8C28.4 16.5 26.3 18.1 24.7 19.7C24.2 20.2 24.2 20.7 23.8 21.1C23.7 21.2 23.6 21.3 23.5 21.3C23.4 21.3 23.4 21.3 23.3 21.3C22.9 20.7 16 7.6 16.3 7.2C18.1 4.9 21.1 3.3 24 3C24.3 3 24.6 3 24.9 3C25.6 3 26.2 3.1 26.6 3.7L32.7 14C32.8 14.3 32.8 14.5 32.7 14.7C32.5 15.4 31.3 15.5 30.5 15.7L30.6 15.8Z" />
             </svg>
             Sešity
          </button>
        </div>

        <button 
          onClick={migrateToPhysics}
          className="w-full mt-2 text-xs text-muted-foreground hover:text-primary underline"
        >
          Přesunout vše do Fyziky
        </button>
      </div>

      <div className="p-2 pb-20">
        {loading ? (
          <div className="text-center py-8" style={{ color: '#4E5871', fontSize: '0.85rem' }}>
            Načítám...
          </div>
        ) : (
          <>
            {activeTab === 'workbooks' ? (
              /* Simple flat list for workbooks */
              <div className="space-y-1">
                {filteredMenu.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => item.slug && onSelectPage(activeCategory, item.slug)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
                      item.slug === activeSlug 
                        ? 'bg-indigo-100 text-indigo-700' 
                        : 'hover:bg-white/50 text-slate-600'
                    }`}
                  >
                    <Book className="h-4 w-4 flex-shrink-0" />
                    <span className="text-sm font-medium truncate">{item.label}</span>
                  </button>
                ))}
                {filteredMenu.length === 0 && (
                  <div className="text-center py-8 text-slate-400 text-sm">
                    Zatím žádné pracovní sešity
                  </div>
                )}
              </div>
            ) : (
              /* Full tree view for folders */
              filteredMenu.length > 0 && (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={flattenItems(filteredMenu)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-0.5">
                      {filteredMenu.map((item) => (
                        <SortableItem
                          key={item.id}
                          item={item}
                          level={0}
                          activeSlug={activeSlug}
                          expandedItems={expandedItems}
                          onToggleExpand={toggleExpand}
                          onSelectPage={(slug) => onSelectPage(activeCategory, slug)}
                          onDeleteItem={handleDeleteItem}
                          onEditItem={handleEditItem}
                          onAddChild={handleAddChild}
                          onCreatePage={createNewPage}
                          category={activeCategory}
                          allPages={allPages}
                          activeTab={activeTab}
                          navigate={navigate}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )
            )}

            <div className="mt-2">
              {showRootAddMenu ? (
                <div className="p-3 bg-muted/50 border border-border rounded">
                  <input
                    type="text"
                    value={newItemLabel}
                    onChange={(e) => setNewItemLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddRootItem(activeTab === 'workbooks' ? 'workbook' : 'page');
                      if (e.key === 'Escape') {
                        setShowRootAddMenu(false);
                        setNewItemLabel('');
                      }
                    }}
                    placeholder="Název..."
                    className="w-full px-2 py-1.5 bg-background rounded focus:outline-none focus:ring-2 focus:ring-ring mb-2 shadow-sm"
                    style={{ color: '#4E5871', fontSize: '0.85rem' }}
                    autoFocus
                  />
                  <div className="grid grid-cols-2 gap-2">
                    {activeTab === 'folders' ? (
                      <>
                        <button
                          onClick={() => handleAddRootItem('group')}
                          disabled={!newItemLabel.trim() || creating}
                          className="flex items-center justify-center gap-1 px-2 py-1.5 border border-border bg-white rounded transition-colors disabled:opacity-50"
                          style={{ color: '#4E5871', fontSize: '0.75rem' }}
                          title="Přidat složku"
                        >
                          <Folder className="h-3 w-3" />
                          Složka
                        </button>
                        <button
                          onClick={() => handleAddRootItem('page')}
                          disabled={!newItemLabel.trim() || creating}
                          className="flex items-center justify-center gap-1 px-2 py-1.5 bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                          style={{ fontSize: '0.75rem' }}
                          title="Přidat stránku"
                        >
                          <FileText className="h-3 w-3" />
                          Stránka
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleAddRootItem('workbook')}
                        disabled={!newItemLabel.trim() || creating}
                        className="col-span-2 flex items-center justify-center gap-1 px-2 py-1.5 border border-indigo-200 bg-indigo-50 text-indigo-700 rounded hover:bg-indigo-100 transition-colors disabled:opacity-50"
                        style={{ fontSize: '0.75rem' }}
                        title="Vytvořit složku (sešit)"
                      >
                        <Book className="h-3 w-3" />
                        Vytvořit složku
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setShowRootAddMenu(false);
                      setNewItemLabel('');
                    }}
                    className="w-full mt-2 px-2 py-1.5 transition-colors"
                    style={{ color: '#4E5871', fontSize: '0.85rem' }}
                  >
                    Zrušit
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowRootAddMenu(true)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 border-2 border-dashed border-border rounded transition-colors"
                  style={{ color: '#4E5871', fontSize: '0.85rem' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#F1F4F9';
                    e.currentTarget.style.borderColor = '#4E5871';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.borderColor = '';
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {activeTab === 'workbooks' ? 'Přidat složku' : 'Přidat položku'}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {editingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setEditingItem(null)}>
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4">Upravit položku</h3>
            
            <label className="block text-sm mb-2 text-muted-foreground">Název</label>
            <input
              type="text"
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
              className="w-full px-3 py-2 bg-input-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring mb-4"
              autoFocus
            />
            
            {!editingItem.slug && (
              <>
                <div className="mb-4">
                  <label className="block text-sm mb-2 text-muted-foreground">Vzhled položky (v menu)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                        type="button"
                        onClick={() => setViewMode('classic')}
                        className={`flex flex-col items-center justify-center gap-2 p-2 rounded-lg border transition-all ${viewMode === 'classic' ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500' : 'border-gray-200 hover:bg-gray-50 text-gray-600'}`}
                    >
                        <div className={`p-1.5 rounded-full ${viewMode === 'classic' ? 'bg-blue-200 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                           <LayoutGrid className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-medium text-center leading-tight">Klasická ikona</span>
                    </button>
                    <button 
                        type="button"
                        onClick={() => {
                           setViewMode('rich');
                           setTimeout(() => document.getElementById('cover-image-input')?.focus(), 0);
                        }}
                        className={`flex flex-col items-center justify-center gap-2 p-2 rounded-lg border transition-all ${viewMode === 'rich' ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500' : 'border-gray-200 hover:bg-gray-50 text-gray-600'}`}
                    >
                        <div className={`p-1.5 rounded-full ${viewMode === 'rich' ? 'bg-blue-200 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                           <ImageIcon className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-medium text-center leading-tight">Rozšířený náhled</span>
                    </button>
                  </div>
                </div>

                <div className="mb-4">
                   <label className="block text-sm mb-2 text-muted-foreground">Zobrazení obsahu (po otevření)</label>
                   <div className="grid grid-cols-2 gap-2">
                      <button 
                          type="button"
                          onClick={() => setLayoutMode('standard')}
                          className={`flex flex-col items-center justify-center gap-2 p-2 rounded-lg border transition-all ${layoutMode === 'standard' ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500' : 'border-gray-200 hover:bg-gray-50 text-gray-600'}`}
                      >
                          <div className={`p-1.5 rounded-full ${layoutMode === 'standard' ? 'bg-blue-200 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                             <Folder className="w-4 h-4" />
                          </div>
                          <span className="text-[10px] font-medium text-center leading-tight">Složky a soubory</span>
                      </button>
                      <button 
                          type="button"
                          onClick={() => setLayoutMode('overview')}
                          className={`flex flex-col items-center justify-center gap-2 p-2 rounded-lg border transition-all ${layoutMode === 'overview' ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500' : 'border-gray-200 hover:bg-gray-50 text-gray-600'}`}
                      >
                          <div className={`p-1.5 rounded-full ${layoutMode === 'overview' ? 'bg-blue-200 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                             <Settings className="w-4 h-4" />
                          </div>
                          <span className="text-[10px] font-medium text-center leading-tight">Přehled sekcí</span>
                      </button>
                   </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm mb-2 text-muted-foreground">Barva složky</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={editColor || '#ffffff'}
                      onChange={(e) => setEditColor(e.target.value)}
                      className="h-8 w-8 p-0 border border-border rounded cursor-pointer"
                    />
                    <span className="text-sm text-muted-foreground">{editColor || 'Žádná'}</span>
                  </div>
                </div>

                <div className="mb-4 animate-in fade-in zoom-in-95 duration-200">
                    <label className="block text-sm mb-2 text-muted-foreground">Náhled (URL)</label>
                    <input
                      id="cover-image-input"
                      type="text"
                      value={editCoverImage}
                      onChange={(e) => setEditCoverImage(e.target.value)}
                      placeholder="https://... (obrázek nebo Lottie animace)"
                      className="w-full px-3 py-2 bg-input-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    {editCoverImage?.trim() !== '' && (
                      <div className="mt-2 h-32 w-full bg-muted rounded-md overflow-hidden border border-border relative">
                        {previewLottieData ? (
                            <div className="absolute inset-0 z-10">
                                <Lottie 
                                    animationData={previewLottieData} 
                                    loop={true} 
                                    className="w-full h-full"
                                    style={{ width: '100%', height: '100%' }}
                                    rendererSettings={{ preserveAspectRatio: 'xMidYMid slice' }}
                                />
                            </div>
                        ) : (
                             <img 
                               src={editCoverImage} 
                               alt="Preview" 
                               className="absolute inset-0 w-full h-full object-cover" 
                             />
                        )}
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1">
                       {viewMode === 'rich' && 'Složka se v seznamu zobrazí jako velká karta s náhledem. '}
                       {viewMode === 'classic' && 'Složka se v seznamu zobrazí jako klasická ikona. '}
                       {layoutMode === 'overview' && 'Obsah se zobrazí v režimu přehledu sekcí.'}
                    </p>
                </div>
              </>
            )}

            {editingItem.slug && (
              <>
                <div className="mb-4">
                  <label className="block text-sm mb-2 text-muted-foreground">Ikona</label>
                  <IconPicker 
                    value={editIcon} 
                    onChange={setEditIcon}
                  />
                </div>
              </>
            )}
            
            <div className="flex gap-2">
              <button
                onClick={saveEdit}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90"
              >
                Uložit
              </button>
              <button
                onClick={() => setEditingItem(null)}
                className="flex-1 px-4 py-2 border border-border rounded hover:bg-accent"
              >
                Zrušit
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}