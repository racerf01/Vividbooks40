import React, { useState, useEffect } from 'react';
import { Folder, FileText, ChevronRight, ChevronDown, Book, User, X, ArrowLeft, BookOpen, Loader2, FolderOpen } from 'lucide-react';
import { projectId, publicAnonKey } from '../utils/supabase/info.tsx';
import { DOCUMENT_TYPES } from '../types/document-types';
import { useAnalytics } from '../hooks/useAnalytics';

// Available subjects - same as AIChatPanel
const SUBJECTS = [
  { id: 'fyzika', label: 'Fyzika', color: '#7c3aed' },
  { id: 'chemie', label: 'Chemie', color: '#ef4444' },
  { id: 'prirodopis', label: 'Přírodopis', color: '#22c55e' },
  { id: 'matematika', label: 'Matematika', color: '#3b82f6' },
  { id: 'dejepis', label: 'Dějepis', color: '#d97706' },
];

// Normalize item type for display - same as AIChatPanel
const getItemType = (item: MenuItem): string => {
  let type = item.type || '';
  const icon = item.icon || '';
  
  if (type === 'workbook' || icon === 'book' || icon === 'workbook') return 'workbook';
  if (type === 'worksheet' || icon === 'file-edit') return 'worksheet';
  if (type === 'textbook') return 'textbook';
  if (type === 'experiment') return 'experiment';
  if (type === 'methodology') return 'methodology';
  if (type === 'test') return 'test';
  if (type === 'exam') return 'exam';
  if (type === 'practice' || type === 'exercise') return 'practice';
  if (type === 'guide') return 'guide';
  if (type === '3d-model') return '3d-model';
  if (type === 'minigame') return 'minigame';
  return 'lesson'; // Default to lesson
};

interface MenuItem {
  id: string;
  label?: string;
  title?: string;
  name?: string;
  slug?: string;
  type?: string;
  icon?: string;
  children?: MenuItem[];
}

interface MyContentItem {
  id: string;
  name: string;
  type: 'folder' | 'document';
  children?: MyContentItem[];
  slug?: string;
}

interface DocumentLinkPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (item: { type: 'vividbooks' | 'mycontent'; category?: string; slug: string; title: string; id?: string }) => void;
}

export function DocumentLinkPicker({ 
  isOpen, 
  onClose, 
  onSelect
}: DocumentLinkPickerProps) {
  const [activeTab, setActiveTab] = useState<'vividbooks' | 'mycontent'>('mycontent');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [myContent, setMyContent] = useState<MyContentItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Analytics
  const analytics = useAnalytics();
  
  // Vividbooks navigation state
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [libraryMenu, setLibraryMenu] = useState<MenuItem[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);

  // Load content when dialog opens
  useEffect(() => {
    if (isOpen) {
      if (activeTab === 'mycontent') {
        loadMyContent();
      }
    }
  }, [isOpen, activeTab]);

  // Fetch library menu for a subject
  const fetchLibraryMenu = async (subjectId: string) => {
    setIsLoadingLibrary(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/menu?category=${subjectId}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        console.log('[DocumentLinkPicker] Loaded menu:', data.menu?.length, 'items');
        setLibraryMenu(data.menu || []);
      }
    } catch (err) {
      console.error('Error loading library menu:', err);
    } finally {
      setIsLoadingLibrary(false);
    }
  };

  const selectSubject = (subjectId: string) => {
    // Track subject access
    const subjectInfo = SUBJECTS.find(s => s.id === subjectId);
    analytics.trackSubjectAccessed(subjectId, subjectInfo?.label || subjectId, 'link_picker');
    
    setActiveSubject(subjectId);
    fetchLibraryMenu(subjectId);
    setExpandedFolders(new Set());
  };

  const handleBack = () => {
    if (activeSubject) {
      setActiveSubject(null);
      setLibraryMenu([]);
    }
  };

  const loadMyContent = () => {
    try {
      const foldersData = localStorage.getItem('vivid-my-content');
      const folders = foldersData ? JSON.parse(foldersData) : [];
      
      const docsData = localStorage.getItem('vivid-my-documents');
      const documents = docsData ? JSON.parse(docsData) : [];

      const rootItems: MyContentItem[] = [];
      
      folders
        .filter((f: any) => !f.parentId)
        .forEach((folder: any) => {
          rootItems.push({
            id: folder.id,
            name: folder.name,
            type: 'folder',
            children: buildFolderChildren(folder.id, folders, documents)
          });
        });

      documents
        .filter((d: any) => !d.folderId)
        .forEach((doc: any) => {
          rootItems.push({
            id: doc.id,
            name: doc.name || doc.title || 'Bez názvu',
            type: 'document',
            slug: doc.id
          });
        });

      setMyContent(rootItems);
    } catch (error) {
      console.error('Error loading my content:', error);
    }
  };

  const buildFolderChildren = (folderId: string, allFolders: any[], allDocs: any[]): MyContentItem[] => {
    const children: MyContentItem[] = [];
    
    allFolders
      .filter((f: any) => f.parentId === folderId)
      .forEach((folder: any) => {
        children.push({
          id: folder.id,
          name: folder.name,
          type: 'folder',
          children: buildFolderChildren(folder.id, allFolders, allDocs)
        });
      });

    allDocs
      .filter((d: any) => d.folderId === folderId)
      .forEach((doc: any) => {
        children.push({
          id: doc.id,
          name: doc.name || doc.title || 'Bez názvu',
          type: 'document',
          slug: doc.id
        });
      });

    return children;
  };

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const handleSelectMyContent = (item: MyContentItem) => {
    if (item.type === 'document') {
      onSelect({
        type: 'mycontent',
        slug: item.slug || item.id,
        title: item.name,
        id: item.id
      });
    }
  };

  const handleSelectVividbooksItem = (item: MenuItem) => {
    const title = item.label || item.title || item.name || 'Bez názvu';
    const slug = item.slug || item.id;
    
    onSelect({
      type: 'vividbooks',
      category: activeSubject || '',
      slug: slug,
      title: title
    });
  };

  const isFolder = (item: MenuItem): boolean => {
    return !!(item.children && item.children.length > 0) || item.type === 'folder' || item.type === 'category';
  };

  const isSelectableDocument = (item: MenuItem): boolean => {
    // Must have some identifier (slug or id)
    if (!item.slug && !item.id) return false;
    // Exclude workbooks
    const itemType = getItemType(item);
    if (itemType === 'workbook') return false;
    // If it's a folder, it's not a document
    if (isFolder(item)) return false;
    return true;
  };

  const filterMyContent = (items: MyContentItem[]): MyContentItem[] => {
    if (!searchQuery) return items;
    
    return items.filter(item => {
      if (item.type === 'document') {
        return item.name.toLowerCase().includes(searchQuery.toLowerCase());
      }
      const filteredChildren = filterMyContent(item.children || []);
      return filteredChildren.length > 0 || item.name.toLowerCase().includes(searchQuery.toLowerCase());
    }).map(item => {
      if (item.type === 'folder') {
        return { ...item, children: filterMyContent(item.children || []) };
      }
      return item;
    });
  };

  // Render Vividbooks menu item
  const renderLibraryMenuItem = (item: MenuItem, depth: number = 0) => {
    const isExpanded = expandedFolders.has(item.id);
    const itemIsFolder = isFolder(item);
    const itemIsDocument = isSelectableDocument(item);
    const title = item.label || item.title || item.name || 'Bez názvu';
    const itemType = getItemType(item);
    
    // Skip workbooks
    if (itemType === 'workbook') return null;
    
    // Get the icon for this document type
    const docType = DOCUMENT_TYPES.find(t => t.id === itemType);
    const IconComponent = docType?.icon;
    
    if (itemIsFolder) {
      return (
        <div key={item.id}>
          <button
            onClick={() => toggleFolder(item.id)}
            className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-slate-100 rounded-lg transition-colors text-left"
            style={{ paddingLeft: `${12 + depth * 16}px` }}
          >
            <ChevronRight 
              className={`h-4 w-4 text-slate-400 transition-transform shrink-0 ${isExpanded ? 'rotate-90' : ''}`} 
            />
            {isExpanded ? (
              <FolderOpen className="h-4 w-4 text-slate-400 shrink-0" />
            ) : (
              <Folder className="h-4 w-4 text-slate-400 shrink-0" />
            )}
            <span className="text-sm font-medium text-slate-700">{title}</span>
          </button>
          {isExpanded && item.children && (
            <div>
              {item.children.map(child => renderLibraryMenuItem(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    if (itemIsDocument) {
      return (
        <button
          key={item.id}
          onClick={() => handleSelectVividbooksItem(item)}
          className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-indigo-50 rounded-lg transition-colors text-left group"
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          <div className="w-4 shrink-0" /> {/* Spacer for alignment with folder chevron */}
          {IconComponent ? (
            <IconComponent className={`h-4 w-4 shrink-0 ${docType?.color || 'text-blue-500'}`} />
          ) : (
            <FileText className="h-4 w-4 text-blue-500 shrink-0" />
          )}
          <span className="text-sm text-slate-700 group-hover:text-indigo-700">{title}</span>
        </button>
      );
    }

    return null;
  };

  // Render my content item
  const renderMyContentItem = (item: MyContentItem, depth: number = 0) => {
    const isExpanded = expandedFolders.has(item.id);
    
    if (item.type === 'folder') {
      return (
        <div key={item.id}>
          <button
            onClick={() => toggleFolder(item.id)}
            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-100 rounded-lg transition-colors text-left"
            style={{ paddingLeft: `${12 + depth * 20}px` }}
          >
            <div className="w-5 h-5 flex items-center justify-center text-slate-400">
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </div>
            <Folder className="w-5 h-5 text-amber-500" />
            <span className="text-sm font-medium text-slate-700">{item.name}</span>
          </button>
          {isExpanded && item.children && (
            <div>
              {item.children.map(child => renderMyContentItem(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    return (
      <button
        key={item.id}
        onClick={() => handleSelectMyContent(item)}
        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-indigo-50 rounded-lg transition-colors text-left group"
        style={{ paddingLeft: `${12 + depth * 20}px` }}
      >
        <div className="w-5 h-5" />
        <FileText className="w-5 h-5 text-indigo-500" />
        <span className="text-sm text-slate-700 group-hover:text-indigo-700">{item.name}</span>
      </button>
    );
  };

  if (!isOpen) return null;

  // Render Vividbooks content
  const renderVividbooksContent = () => {
    // Subject not selected - show subject list
    if (!activeSubject) {
      return (
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {SUBJECTS.map(subject => (
            <button
              key={subject.id}
              onClick={() => selectSubject(subject.id)}
              className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 transition-all text-left"
            >
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: subject.color }}
              >
                <BookOpen className="h-5 w-5 text-white" />
              </div>
              <span className="font-medium text-slate-800">{subject.label}</span>
              <ChevronRight className="h-5 w-5 text-slate-400 ml-auto" />
            </button>
          ))}
        </div>
      );
    }

    // Subject selected - show folder tree
    const subjectInfo = SUBJECTS.find(s => s.id === activeSubject);

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Subject header with back button */}
        <div className="shrink-0 px-4 py-3 border-b border-slate-100 bg-slate-50">
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Zpět
          </button>
          <h3 className="font-semibold text-slate-800">{subjectInfo?.label}</h3>
          <p className="text-xs text-slate-500">Vyberte dokument</p>
        </div>

        {/* Folder tree */}
        <div className="flex-1 overflow-y-auto p-2">
          {isLoadingLibrary ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
            </div>
          ) : libraryMenu.length > 0 ? (
            libraryMenu.map(item => renderLibraryMenuItem(item))
          ) : (
            <p className="text-sm text-slate-500 text-center py-8">Žádný obsah</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex justify-center z-50 overflow-y-auto"
      style={{ paddingTop: '100px', paddingBottom: '100px' }}
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl overflow-hidden h-fit flex flex-col"
        style={{ width: '600px', maxHeight: 'calc(100vh - 200px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">Odkaz na dokument</h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="shrink-0 flex border-b border-slate-200">
          <button
            onClick={() => {
              setActiveTab('mycontent');
              setActiveSubject(null);
            }}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'mycontent' 
                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <User className="w-4 h-4" />
            Můj obsah
          </button>
          <button
            onClick={() => {
              setActiveTab('vividbooks');
              setActiveSubject(null);
            }}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'vividbooks' 
                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Book className="w-4 h-4" />
            Vividbooks
          </button>
        </div>

        {/* Search - only for My Content */}
        {activeTab === 'mycontent' && (
          <div className="shrink-0 px-4 py-3 border-b border-slate-100">
            <input
              type="text"
              placeholder="Hledat..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-[300px]">
          {activeTab === 'mycontent' ? (
            <div className="flex-1 overflow-y-auto p-2">
              {filterMyContent(myContent).length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Žádné dokumenty</p>
                </div>
              ) : (
                filterMyContent(myContent).map(item => renderMyContentItem(item))
              )}
            </div>
          ) : (
            renderVividbooksContent()
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Zrušit
          </button>
        </div>
      </div>
    </div>
  );
}

export default DocumentLinkPicker;
