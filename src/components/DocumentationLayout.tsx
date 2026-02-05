import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner@2.0.3';
import { NavigationMenu } from './NavigationMenu';
import { HtmlRenderer } from './HtmlRenderer';
import { ContentWithMedia } from './ContentWithMedia';
import { SearchModal } from './SearchModal';
import { TableOfContents } from './TableOfContents';
import { PrintQRCode } from './PrintQRCode';
import { LoadingSpinner } from './LoadingSpinner';
import { useAnalytics } from '../hooks/useAnalytics';
import { useNPS } from '../hooks/useNPS';
import { NPSPopup } from './nps/NPSPopup';
import { Menu, Moon, Sun, Search, X, Copy, Check, Printer, Maximize2, Minimize2, PanelLeft, PanelLeftClose, BookOpen, ArrowLeft, ChevronRight, Pencil, ChevronDown, Folder, FileText, LayoutGrid, Plus, Sparkles, Monitor, Link as LinkIcon, FileEdit, MessageSquareText } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "./ui/dropdown-menu";
import VividLogo from '../imports/Group70';
import { projectId, publicAnonKey } from '../utils/supabase/info.tsx';
import { SectionMediaItem } from '../types/section-media';
import { LottieSequencePlayer } from './media/LottieSequencePlayer';
import { DOCUMENT_TYPES } from '../types/document-types';
import { WorksheetView } from './WorksheetView';
import { WorkbookView } from './WorkbookView';
import { CategoryOverview } from './admin/CategoryOverview';
import { TeacherAssistant } from './library/TeacherAssistant';
import { ToolsMenu } from './ToolsMenu';
import { ToolsDropdown } from './ToolsDropdown';
import { DEFAULT_WORKSHEET_DATA, Worksheet, Subject, Grade, generateBlockId } from '../types/worksheet';
import { DEFAULT_WORKBOOK_DATA } from './admin/WorkbookEditor';
import { saveWorksheet } from '../utils/worksheet-storage';
import { saveFolders, getFolders } from '../utils/folder-storage';
import { saveDocument as saveDocumentToStorage } from '../utils/document-storage';
import { generateWorksheetContent } from '../utils/ai-worksheet-generator';
import { useRAGSync } from '../hooks/useRAGSync';
import { TeachMeButton } from './rag/TeachMeButton';
import { TeachMeChat } from './rag/TeachMeChat';
import { ShareInClassButton, StudentShareHeaderIndicator, FirebaseTeacherPanel } from './classroom';
import { QRCodeSVG } from 'qrcode.react';
import { useClassroomShare } from '../contexts/ClassroomShareContext';
import { WorksheetTypeSelector, WorksheetType, getPromptModifier } from './worksheet/WorksheetTypeSelector';
import { QuizTypeSelector, QuizType } from './quiz/QuizTypeSelector';
import { ImageSelectionStep, ImageOption } from './worksheet-editor/ImageSelectionStep';
import { extractImagesFromHtml, ExtractedImage } from '../utils/extract-images';
import { generateQuizFromDocument } from '../utils/ai-quiz-generator';
import { GeneratingLoader } from './ui/GeneratingLoader';
import { useLicenseAccess } from '../hooks/useLicenseAccess';
import { useEcosystemAccess } from '../hooks/useEcosystemAccess';
import { SubjectPromo } from './SubjectPromo';
import { SUBJECTS } from '../types/profile';
import { useViewMode } from '../contexts/ViewModeContext';
import { saveSharedDocument, loadSharedDocument } from '../utils/shared-documents';
import * as quizStorage from '../utils/quiz-storage';
import { supabase } from '../utils/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

interface Page {
  id: string;
  slug: string;
  title: string;
  content: string;
  description: string;
  category?: string;
  featuredMedia?: string;
  sectionImages?: SectionMediaItem[]; // Backwards compatibility name in API might still be sectionImages, but we treat as SectionMediaItem
  documentType?: string;
  showTOC?: boolean; // Whether to show table of contents (default true)
  externalUrl?: string; // For linking to VividBoard or external URLs
}

interface MenuItem {
  id: string;
  label: string;
  slug?: string;
  children?: MenuItem[];
  color?: string;
  coverImage?: string;
  pageNumber?: string;
}

interface DocumentationLayoutProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export function DocumentationLayout({ theme, toggleTheme }: DocumentationLayoutProps) {
  const params = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  // Locked mode uses encoded parameter to make it less obvious
  // Format: ?s=v1 (where v1 is a simple token for "view locked")
  const isLockedMode = searchParams.get('s') === 'v1';
  const category = params.category;
  const slug = params['*'];
  const myContentId = params.id; // For /library/my-content/view/:id route
  const isMyContent = location.pathname.startsWith('/library/my-content/view/');
  const activeCategory = isMyContent ? 'my-content' : (category || 'fyzika');
  const isLibraryHomepage = activeCategory === 'knihovna-vividbooks' && (!slug || slug === 'introduction');
  const navigate = useNavigate();
  
  // Analytics - track subject access when category changes
  const analytics = useAnalytics();
  
  // License-based access control
  const licenseAccess = useLicenseAccess(activeCategory);
  const ecosystemAccess = useEcosystemAccess();
  const { isStudent: isStudentMode } = useViewMode();
  
  // NPS - show survey every 30 days (only for teachers, not students)
  const { showNPS, setShowNPS, submitNPS, dismissNPS } = useNPS({
    enabled: !isStudentMode,
  });
  const classroomShare = useClassroomShare();
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Page cache for prefetching
  const pageCacheRef = useRef<Map<string, Page>>(new Map());
  
  // Sidebar visibility states
  // sidebarOpen: controls mobile overlay
  // sidebarVisible: controls desktop column visibility
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  
  // Auto-hide sidebar when viewing my-content documents
  useEffect(() => {
    if (location.pathname.startsWith('/library/my-content/view/')) {
      setSidebarVisible(false);
      
      // Check for copied document toast message
      const copiedDocToast = sessionStorage.getItem('copied-doc-toast');
      if (copiedDocToast) {
        try {
          const { title, path } = JSON.parse(copiedDocToast);
          sessionStorage.removeItem('copied-doc-toast');
          
          // Show toast after a short delay to ensure page is loaded
          setTimeout(() => {
            toast.success(`Lekce "${title}" byla zkopírována!`, {
              description: `Uloženo do: ${path}. Nyní můžeš dokument upravit jak potřebuješ.`,
              duration: 8000,
            });
          }, 300);
        } catch (e) {
          console.error('Failed to parse copied doc toast', e);
          sessionStorage.removeItem('copied-doc-toast');
        }
      }
    }
  }, [location.pathname]);
  
  // Sidebar Tab State (Lifted from NavigationMenu)
  const [sidebarTab, setSidebarTab] = useState<'folders' | 'workbooks'>('folders');
  
  // Effective view mode - considers license restrictions
  // If user has only basic access (workbooks tier), force workbooks view
  const effectiveViewMode: 'folders' | 'workbooks' = useMemo(() => {
    // Skip license check for my-content
    if (isMyContent) return sidebarTab;
    
    // If license restricts folder view, force workbooks
    if (!licenseAccess.loading && !licenseAccess.canViewFolders && licenseAccess.hasAccess) {
      return 'workbooks';
    }
    
    return sidebarTab;
  }, [sidebarTab, licenseAccess.loading, licenseAccess.canViewFolders, licenseAccess.hasAccess, isMyContent]);
  
  // History for tab navigation
  const [lastFolderSlug, setLastFolderSlug] = useState<string | null>(null);
  const [lastWorkbookSlug, setLastWorkbookSlug] = useState<string | null>(null);
  
  // Menu for navigation - moved up so handleTabChange can use it
  const [menu, setMenu] = useState<MenuItem[]>([]);
  // Menu cache to speed up category switching (stored by category)
  const menuCacheRef = useRef<Record<string, { menu: MenuItem[], timestamp: number }>>({});
  
  // RAG Integration
  const { state: ragState, syncToRAG } = useRAGSync(page?.id);
  const [showTeachMeChat, setShowTeachMeChat] = useState(false);
  
  // AI Assistant Panel state
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiPanelFullscreen, setAIPanelFullscreen] = useState(false);
  // Track previous sidebar state before opening AI panel
  const sidebarWasVisibleRef = useRef(true);
  
  // Share panel state (for connecting students - live sharing)
  const [showSharePanel, setShowSharePanel] = useState(false);
  // Document share panel state (for sharing link with QR code)
  const [showDocSharePanel, setShowDocSharePanel] = useState(false);
  const [docShareLocked, setDocShareLocked] = useState(true); // Default to locked mode
  
  const handleOpenAIPanel = () => {
    // Remember sidebar state before opening AI panel
    sidebarWasVisibleRef.current = sidebarVisible;
    setShowAIPanel(true);
    setShowSharePanel(false);
    setShowDocSharePanel(false);
    setShowTeachMeChat(false);
    setSidebarVisible(false); // Close left sidebar when AI opens
  };
  
  const handleCloseAIPanel = () => {
    setShowAIPanel(false);
    setAIPanelFullscreen(false);
    // Restore sidebar to its previous state
    setSidebarVisible(sidebarWasVisibleRef.current);
  };

  const handleOpenSharePanel = () => {
    setShowSharePanel(true);
    setShowDocSharePanel(false);
    setShowAIPanel(false);
    setSidebarVisible(false);
    setShowTeachMeChat(false); // Close teach me if open
  };
  
  const handleCloseSharePanel = () => {
    setShowSharePanel(false);
    // Don't change sidebar visibility - just close the share panel
  };
  
  const handleOpenDocSharePanel = () => {
    setShowDocSharePanel(true);
    setShowSharePanel(false);
    setShowAIPanel(false);
    setSidebarVisible(false);
    setShowTeachMeChat(false);
  };
  
  const handleCloseDocSharePanel = () => {
    setShowDocSharePanel(false);
  };

  const handleTeachMeClick = async () => {
    if (!page) return;

    // Vždy synchronizovat aktuální dokument při otevření chatu
    // (zajistí, že AI má správný kontext pro aktuální stránku)
    if (ragState.status !== 'active' && ragState.status !== 'uploading' && ragState.status !== 'indexing') {
       toast.info('Připravuji AI učitele...');
       await syncToRAG({
         documentId: page.id,
         title: page.title,
         content: page.content,
         subject: activeCategory,
         grade: '6', 
         topic: page.title,
         type: 'lekce'
       });
    }
    setShowTeachMeChat(true);
    setSidebarVisible(false);
  };

  const handleCloseChat = () => {
    setShowTeachMeChat(false);
    // Don't change sidebar visibility - just close the chat panel
  };

  // Helper to find first item of a type in menu
  const findFirstItemOfType = useCallback((items: MenuItem[], isWorkbookType: boolean): string | null => {
    for (const item of items) {
      const isWorkbook = item.type === 'workbook' || item.icon === 'workbook' || item.icon === 'book';
      if (isWorkbookType === isWorkbook && item.slug) {
        return item.slug;
      }
      if (item.children) {
        const found = findFirstItemOfType(item.children, isWorkbookType);
        if (found) return found;
      }
    }
    return null;
  }, []);
  
  // Handler for tab change with navigation
  const handleTabChange = (newTab: 'folders' | 'workbooks') => {
    // Save current position to history for current tab
    if (slug) {
      if (sidebarTab === 'folders') {
        setLastFolderSlug(slug);
      } else {
        setLastWorkbookSlug(slug);
      }
    }
    
    // Switch tab - just change the tab, don't navigate
    // The user stays on the same page, only the sidebar content changes
    setSidebarTab(newTab);
    
    // DON'T navigate when switching tabs - keep the user on the same page
    // The sidebar will show the appropriate menu for the selected tab
    // and will try to find/highlight the current page in that menu
  };
  
  // Auto-switch tab based on page documentType
  useEffect(() => {
    if (page) {
      if (page.documentType === 'workbook' || page.documentType === 'worksheet') {
        setSidebarTab('workbooks');
      } else {
        // For all other document types (folders, groups, regular pages), switch to folders tab
        setSidebarTab('folders');
      }
    }
  }, [page]);
  
  // Reader mode state - can be set via URL param ?reader=true
  const [readerMode, setReaderMode] = useState(() => {
    // Check URL param on initial render
    const params = new URLSearchParams(window.location.search);
    return params.get('reader') === 'true';
  });

  // Sync reader mode with URL parameter and hide sidebar
  useEffect(() => {
    const isReaderFromUrl = searchParams.get('reader') === 'true';
    if (isReaderFromUrl !== readerMode) {
      setReaderMode(isReaderFromUrl);
    }
    // Automatically hide sidebar in reader mode or locked mode
    if (isReaderFromUrl || isLockedMode) {
      setSidebarVisible(false);
    }
  }, [searchParams, isLockedMode]);

  // Auto-hide the left sidebar when entering a concrete document.
  // - We treat "document" as a resolved `page` (lesson/textbook/etc).
  // - We keep sidebar visible for folder overviews (CategoryOverview), where `page` is null.
  // - We keep sidebar visible for workbooks and worksheets.
  useEffect(() => {
    if (isMyContent) return;
    if (readerMode) return; // readerMode already controls sidebar visibility

    const isInDocument = !!slug && !!page;
    const isWorkbookOrWorksheet = page?.documentType === 'workbook' || page?.documentType === 'worksheet';
    
    // Don't hide sidebar for workbooks and worksheets
    if (isWorkbookOrWorksheet) {
      setSidebarVisible(true);
      return;
    }
    
    setSidebarVisible(!isInDocument);
  }, [isMyContent, readerMode, slug, page?.id, page?.documentType]);
  
  // My Content sidebar data
  const [myContentFolders, setMyContentFolders] = useState<any[]>([]);
  
  // Load my content data for sidebar
  useEffect(() => {
    if (isMyContent) {
      const savedFolders = localStorage.getItem('vivid-my-folders');
      if (savedFolders) {
        try { setMyContentFolders(JSON.parse(savedFolders)); } catch (e) {}
      }
    }
  }, [isMyContent]);
  
  // Derived: folders copied from VividBooks (with copiedFrom === 'vividbooks-category')
  const myContentCopied = myContentFolders.filter((f: any) => f.copiedFrom === 'vividbooks-category');
  
  const [toolsOpen, setToolsOpen] = useState(false);

  const MENU_GROUPS = [
    {
      title: "1. stupeň",
      items: [
        { id: 'matematika-1', label: 'Matematika' },
        { id: 'prvouka', label: 'Prvouka' }
      ]
    },
    {
      title: "2. stupeň",
      items: [
        { id: 'matematika', label: 'Matematika' },
        { id: 'fyzika', label: 'Fyzika' },
        { id: 'prirodopis', label: 'Přírodopis' },
        { id: 'chemie', label: 'Chemie' }
      ]
    },
    {
      title: "Ostatní",
      items: [
         { id: 'navody', label: 'Návody' }
      ]
    }
  ];

  const [searchOpen, setSearchOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [videoExpanded, setVideoExpanded] = useState(false);
  const [isGeneratingWorksheet, setIsGeneratingWorksheet] = useState(false);
  const [showWorksheetTypeSelector, setShowWorksheetTypeSelector] = useState(false);
  const [showQuizTypeSelector, setShowQuizTypeSelector] = useState(false);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [quizLoadingMessages, setQuizLoadingMessages] = useState<string[]>([]);
  const [showImageSelection, setShowImageSelection] = useState(false);
  const [pendingWorksheetType, setPendingWorksheetType] = useState<WorksheetType | null>(null);
  const [extractedLessonImages, setExtractedLessonImages] = useState<ExtractedImage[]>([]);
  const [activeMediaItem, setActiveMediaItem] = useState<SectionMediaItem | null>(null);
  const [imageTransition, setImageTransition] = useState(false);
  const [menuHovered, setMenuHovered] = useState(false);
  const [logoHovered, setLogoHovered] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);
  
  // Lightbox galerie
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<{ url: string; title: string }[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  
  const contentRef = useRef<HTMLDivElement>(null);
  const tocScrollContainerRef = useRef<HTMLDivElement>(null);

  // Find worksheet siblings for navigation arrows (search in workbooks only)
  // Only show navigation if user came through workbook path (URL contains workbook slug)
  const worksheetNavigation = useMemo(() => {
    if (!slug || !menu.length) {
      return { siblings: [], currentIndex: -1, workbookSlug: '' };
    }
    
    // Only look for workbook navigation if URL has multiple path segments (e.g. "workbook-slug/page-slug")
    // If slug is just "page-slug" without prefix, user came from folders, not workbook
    if (!slug.includes('/')) {
      return { siblings: [], currentIndex: -1, workbookSlug: '' };
    }
    
    // Extract the last part of the slug (the actual page slug, not the full path)
    const pageSlug = slug.split('/').pop() || slug;
    // Extract the workbook path prefix (everything before the last segment)
    const urlWorkbookPath = slug.substring(0, slug.lastIndexOf('/'));
    
    // First, find all workbooks in the menu
    const findWorkbooks = (items: MenuItem[], parentPath: string = ''): { workbook: MenuItem; path: string }[] => {
      let workbooks: { workbook: MenuItem; path: string }[] = [];
      for (const item of items) {
        const currentPath = item.slug ? (parentPath ? `${parentPath}/${item.slug}` : item.slug) : parentPath;
        const isWorkbook = item.type === 'workbook' || item.icon === 'workbook' || item.icon === 'book';
        if (isWorkbook && item.children && item.children.length > 0) {
          workbooks.push({ workbook: item, path: currentPath });
        }
        if (item.children) {
          workbooks = workbooks.concat(findWorkbooks(item.children, currentPath));
        }
      }
      return workbooks;
    };
    
    // Then find the workbook containing our page - but only if URL path matches workbook path
    const workbooks = findWorkbooks(menu);
    
    for (const { workbook, path } of workbooks) {
      // Check if URL path prefix matches this workbook's path
      if (path !== urlWorkbookPath) continue;
      
      // Check if any child matches our page slug
      const found = workbook.children?.find(child => child.slug === pageSlug);
      if (found && workbook.children) {
        const currentIndex = workbook.children.findIndex(c => c.slug === pageSlug);
        // Return the path prefix so we can build correct navigation URLs
        return { siblings: workbook.children, currentIndex, workbookSlug: path };
      }
    }
    
    return { siblings: [], currentIndex: -1, workbookSlug: '' };
  }, [menu, slug]);

  // Lock body scroll when image selection modal is open
  useEffect(() => {
    if (showImageSelection) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showImageSelection]);

  useEffect(() => {
    // Helper to find worksheet by ID in the menu tree
    const findWorksheetById = (items: MenuItem[], id: string): MenuItem | null => {
      for (const menuItem of items) {
        if (menuItem.id === id) return menuItem;
        if (menuItem.children) {
          const found = findWorksheetById(menuItem.children, id);
          if (found) return found;
        }
      }
      return null;
    };
    
    // Transform workbookPages to children for display
    // Use LIVE data from original worksheets (true references)
    const transformWorkbooks = (items: MenuItem[], allItems: MenuItem[]): MenuItem[] => {
      return items.map(item => {
        if (item.type === 'workbook' && (item as any).workbookPages && (item as any).workbookPages.length > 0) {
          const pages = (item as any).workbookPages as { id: string; pageNumber: number; worksheetId: string; worksheetSlug: string; worksheetLabel: string; worksheetCover?: string }[];
          const children: MenuItem[] = pages
            .sort((a, b) => a.pageNumber - b.pageNumber)
            .map(page => {
              // Find the original worksheet to get LIVE data
              const originalWorksheet = findWorksheetById(allItems, page.worksheetId);
              const baseLabel = originalWorksheet?.label || page.worksheetLabel;
              // Remove existing "str. XX" prefix if present to avoid duplication
              const cleanLabel = baseLabel.replace(/^str\.?\s*\d+\s*/i, '').trim();
              return {
                id: page.worksheetId,
                label: `str. ${page.pageNumber} ${cleanLabel}`,
                slug: originalWorksheet?.slug || page.worksheetSlug,
                type: 'worksheet',
                coverImage: originalWorksheet?.coverImage || page.worksheetCover,
                // Preserve pdfTranscript from original worksheet
                pdfTranscript: (originalWorksheet as any)?.pdfTranscript,
              };
            });
          return { ...item, children };
        }
        if (item.children) {
          return { ...item, children: transformWorkbooks(item.children, allItems) };
        }
        return item;
      });
    };
    
    // Check cache first (valid for 5 minutes)
    const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    const cached = menuCacheRef.current[activeCategory];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      // Use cached menu immediately
      setMenu(cached.menu);
      return;
    }
    
    // No valid cache - clear old menu and fetch new
    setMenu([]);
    
    const loadMenu = async () => {
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
          let loadedMenu = data.menu || [];
          loadedMenu = transformWorkbooks(loadedMenu, loadedMenu);
          
          // Store in cache
          menuCacheRef.current[activeCategory] = {
            menu: loadedMenu,
            timestamp: Date.now()
          };
          
          setMenu(loadedMenu);
        }
      } catch (err) {
        console.error('Error loading menu for breadcrumbs:', err);
      }
    };

    loadMenu();
  }, [activeCategory]);

  useEffect(() => {
    if (isMyContent && myContentId) {
      // Load from localStorage for my-content
      loadMyContentPage(myContentId);
      setVideoExpanded(false);
      setActiveMediaItem(null);
    } else if (slug) {
      loadPage(slug);
      setVideoExpanded(false); // Reset video size when page changes
      setActiveMediaItem(null); // Reset active section media
    } else {
      // If no slug, show welcome message for the category
      setPage(null);
      setLoading(false);
    }
  }, [slug, activeCategory, isMyContent, myContentId]);

  // Track subject access (only once per subject per session)
  const lastTrackedSubject = useRef<string | null>(null);
  useEffect(() => {
    if (activeCategory) {
      localStorage.setItem('lastCategory', activeCategory);
      
      // Track subject access when navigating to a subject category (only once per subject)
      const subjectCategories = ['fyzika', 'chemie', 'prirodopis', 'matematika', 'matematika-1', 'matematika-2', 'prvouka'];
      if (subjectCategories.includes(activeCategory) && activeCategory !== lastTrackedSubject.current) {
        lastTrackedSubject.current = activeCategory;
        const subjectLabels: Record<string, string> = {
          'fyzika': 'Fyzika',
          'chemie': 'Chemie',
          'prirodopis': 'Přírodopis',
          'matematika': 'Matematika',
          'matematika-1': 'Matematika 1. st.',
          'matematika-2': 'Matematika 2. st.',
          'prvouka': 'Prvouka',
        };
        analytics.trackSubjectAccessed(activeCategory, subjectLabels[activeCategory] || activeCategory, 'navigation');
      }
    }
  }, [activeCategory, analytics]);

  // Track document opened when page loads (only once per page)
  const lastTrackedPageId = useRef<string | null>(null);
  useEffect(() => {
    if (page && page.id && page.id !== lastTrackedPageId.current) {
      lastTrackedPageId.current = page.id;
      // Determine document type
      const docType: 'vividbooks' | 'custom' | 'edited' = isMyContent ? 'custom' : 'vividbooks';
      analytics.trackDocumentOpened(page.id, docType, activeCategory);
    }
  }, [page?.id, isMyContent, activeCategory, analytics]);

  // Track scroll position when sharing in class (for teachers)
  useEffect(() => {
    if (!classroomShare.state.isSharing) return;

    const handleScroll = () => {
      classroomShare.updateScrollPosition(window.scrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [classroomShare.state.isSharing, classroomShare.updateScrollPosition]);

  // Track navigation changes when sharing in class (for teachers)
  useEffect(() => {
    if (!classroomShare.state.isSharing) return;
    
    const currentPath = location.pathname;
    const documentTitle = page?.title || activeCategory || 'Dokument';
    
    classroomShare.updateDocumentPath(currentPath, documentTitle);
  }, [location.pathname, page?.title, activeCategory, classroomShare.state.isSharing]);

  // Prefetch sibling pages when page loads (for faster navigation)
  useEffect(() => {
    if (page && worksheetNavigation.siblings.length > 0 && !loading) {
      // Small delay to not block main thread
      const timer = setTimeout(() => {
        prefetchSiblings();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [page, worksheetNavigation, loading]);


  useEffect(() => {
    // Keyboard shortcut for search (Cmd/Ctrl + K)
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'Escape' && readerMode) {
        setReaderMode(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [readerMode]);

  // Lightbox galerie - zpracování kliků na obrázky
  useEffect(() => {
    if (!contentRef.current) return;
    
    const handleGalleryClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const figure = target.closest('figure[data-gallery-image]');
      if (!figure) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      // Najít všechny obrázky v galerii (nebo všechny figure s data-gallery-image na stránce)
      const gallery = figure.closest('.image-gallery');
      const allFigures = gallery 
        ? Array.from(gallery.querySelectorAll('figure[data-gallery-image]'))
        : Array.from(contentRef.current!.querySelectorAll('figure[data-gallery-image]'));
        
      const images = allFigures.map(fig => ({
        url: fig.getAttribute('data-image-url') || '',
        title: fig.getAttribute('data-image-title') || '',
      })).filter(img => img.url);
      
      const clickedIndex = allFigures.indexOf(figure);
      
      console.log('[Lightbox] Opening with', images.length, 'images, index:', clickedIndex);
      
      setLightboxImages(images);
      setLightboxIndex(clickedIndex >= 0 ? clickedIndex : 0);
      setLightboxOpen(true);
    };
    
    const container = contentRef.current;
    container.addEventListener('click', handleGalleryClick);
    
    return () => {
      container?.removeEventListener('click', handleGalleryClick);
    };
  }, [page?.id]); // Re-register když se změní stránka
  
  // Keyboard navigation pro lightbox - separátní effect
  useEffect(() => {
    if (!lightboxOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxOpen(false);
      } else if (e.key === 'ArrowLeft') {
        setLightboxIndex(prev => (prev > 0 ? prev - 1 : lightboxImages.length - 1));
      } else if (e.key === 'ArrowRight') {
        setLightboxIndex(prev => (prev < lightboxImages.length - 1 ? prev + 1 : 0));
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, lightboxImages.length]);

  // Scroll tracking for section media
  useEffect(() => {
    if (!page?.sectionImages || page.sectionImages.length === 0 || !contentRef.current) {
      setActiveMediaItem(null);
      return;
    }

    const handleScroll = () => {
      if (!contentRef.current) return;

      const h2Elements = Array.from(contentRef.current.querySelectorAll('h2'))
        .filter(h2 => {
          // Filter out hidden elements (display: none has no offsetParent)
          // This is crucial because we render content twice (mobile/desktop)
          return (h2 as HTMLElement).offsetParent !== null;
        });
        
      // Trigger transition when heading is closer to the top
      // Increased offset to 300px so the image changes slightly before the heading reaches the top
      const scrollPosition = window.scrollY + 300; 

      // Find the index of the current section (last H2 passed)
      let currentH2Index = -1;

      for (let i = 0; i < h2Elements.length; i++) {
        const rect = h2Elements[i].getBoundingClientRect();
        const elementTop = rect.top + window.scrollY;

        if (scrollPosition >= elementTop) {
          currentH2Index = i;
        } else {
          break; // Optimization: stop once we pass the scroll point
        }
      }

      // Find matching section media by looking backwards from current section
      let foundMedia: SectionMediaItem | null = null;
      
      if (currentH2Index >= 0 && page.sectionImages) {
        // Iterate backwards from current H2 to find the first one with media attached
        for (let i = currentH2Index; i >= 0; i--) {
          const h2Text = (h2Elements[i].textContent || '').trim();
          if (!h2Text) continue;

          const mediaItem = page.sectionImages.find(si => (si.heading || '').trim() === h2Text);
          
          if (mediaItem) {
            foundMedia = mediaItem;
            break; // Found the nearest media, stop looking back
          }
        }
      }

      // Update state with transition if media changed
      // We compare objects directly or IDs to detect change
      // IMPORTANT: If IDs are duplicated in DB, comparing IDs is not enough.
      // We should also compare headings or the object reference itself.
      const mediaChanged = foundMedia !== activeMediaItem;

      if (mediaChanged) {
        if (foundMedia) {
          // Transition to new media
          if (activeMediaItem) setImageTransition(true);
          
          // Small delay for transition out if replacing existing
          const delay = activeMediaItem ? 150 : 0;
          
          setTimeout(() => {
            setActiveMediaItem(foundMedia);
            setImageTransition(false);
          }, delay);
        } else {
          // Transition to no media (only happens if scrolled above first section with media)
          if (activeMediaItem) {
            setImageTransition(true);
            setTimeout(() => {
              setActiveMediaItem(null);
              setImageTransition(false);
            }, 150);
          }
        }
      }
    };

    // Initial check
    setTimeout(handleScroll, 100); // Small delay to ensure content is rendered

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [page, activeMediaItem]);

  // Load page from localStorage or Supabase (for My Content)
  const loadMyContentPage = async (contentId: string) => {
    setLoading(true);
    setError('');

    try {
      // First, check vivid-doc-${id} (user-created documents in localStorage)
      console.log('[DocumentView] Looking for localStorage key:', `vivid-doc-${contentId}`);
      let docData = localStorage.getItem(`vivid-doc-${contentId}`);
      
      // Try without suffix if not found
      if (!docData) {
        const strippedId = contentId.replace(/-(text|lesson|document|worksheet)$/, '');
        if (strippedId !== contentId) {
          console.log('[DocumentView] Trying stripped localStorage key:', `vivid-doc-${strippedId}`);
          docData = localStorage.getItem(`vivid-doc-${strippedId}`);
        }
      }
      
      console.log('[DocumentView] localStorage result:', docData ? 'FOUND' : 'NOT FOUND');
      if (docData) {
        const data = JSON.parse(docData);
        setPage({
          id: data.id || contentId,
          slug: data.slug || contentId,
          title: data.title || 'Bez názvu',
          content: data.content || '',
          description: data.description || '',
          category: 'my-content',
          featuredMedia: data.featuredMedia,
          sectionImages: data.sectionImages,
          documentType: data.documentType || 'lesson',
          showTOC: data.showTOC !== false, // Default to true if not set
        });
        setLoading(false);
        return;
      }

      // Second, check copied content (vivid-my-content-copied)
      const savedJson = localStorage.getItem('vivid-my-content-copied');
      if (savedJson) {
        const items = JSON.parse(savedJson);
        
        // Recursive search
        const findItem = (items: any[]): any => {
          for (const item of items) {
            if (item.id === contentId) return item;
            if (item.children) {
              const found = findItem(item.children);
              if (found) return found;
            }
          }
          return null;
        };

        const found = findItem(items);
        if (found) {
          setPage({
            id: found.id,
            slug: found.slug || found.id,
            title: found.name,
            content: found.content || '',
            description: found.description || '',
            category: 'my-content',
            featuredMedia: found.featuredMedia,
            sectionImages: found.sectionImages,
            documentType: found.documentType || 'lesson',
          });
          setLoading(false);
          return;
        }
      }

      // Third, try to load from teacher_documents (generated documents)
      console.log('[DocumentView] Trying teacher_documents for:', contentId);
      
      // Try exact ID first, then without suffix (e.g., "xxx-text" -> "xxx")
      let teacherDoc = null;
      let teacherError = null;
      
      // Use .maybeSingle() instead of .single() to avoid 406 errors
      const { data: exactMatch, error: exactError } = await supabase
        .from('teacher_documents')
        .select('*')
        .eq('id', contentId)
        .maybeSingle();
      
      if (!exactError && exactMatch) {
        teacherDoc = exactMatch;
      } else {
        // Try without common suffixes (-text, -lesson, etc.)
        const strippedId = contentId.replace(/-(text|lesson|document|worksheet)$/, '');
        if (strippedId !== contentId) {
          console.log('[DocumentView] Trying stripped ID:', strippedId);
          const { data: strippedMatch, error: strippedError } = await supabase
            .from('teacher_documents')
            .select('*')
            .eq('id', strippedId)
            .maybeSingle();
          if (!strippedError && strippedMatch) {
            teacherDoc = strippedMatch;
          } else {
            teacherError = exactError;
          }
        } else {
          teacherError = exactError;
        }
      }
      
      console.log('[DocumentView] teacher_documents result:', JSON.stringify({ 
        hasDoc: !!teacherDoc, 
        docId: teacherDoc?.id,
        docTitle: teacherDoc?.title,
        error: teacherError?.message || teacherError?.code || null 
      }));
      
      if (!teacherError && teacherDoc) {
        // Content může být JSON wrapper s html a sectionImages
        let htmlContent = teacherDoc.content || '';
        // Prioritně použít section_images z databáze (snake_case)
        let sectionImages: any[] = teacherDoc.section_images || [];
        
        try {
          const parsed = JSON.parse(teacherDoc.content);
          if (parsed.html !== undefined) {
            htmlContent = parsed.html;
            // Fallback na sectionImages uvnitř content JSON pokud není v DB
            if (sectionImages.length === 0) {
              sectionImages = parsed.sectionImages || [];
            }
          }
        } catch {
          // Content je přímo HTML string
        }
        
        console.log('[DocumentView] Loaded from teacher_documents:', {
          id: teacherDoc.id,
          title: teacherDoc.title,
          contentLength: htmlContent.length,
          sectionImagesCount: sectionImages.length,
        });
        
        setPage({
          id: teacherDoc.id,
          slug: teacherDoc.id,
          title: teacherDoc.title || 'Bez názvu',
          content: htmlContent,
          description: teacherDoc.description || '',
          category: 'my-content',
          featuredMedia: teacherDoc.featured_media,
          sectionImages: sectionImages,
          documentType: teacherDoc.document_type || 'lesson',
          showTOC: true,
        });
        setLoading(false);
        return;
      }

      // Fourth, try to load from shared_documents
      const result = await loadSharedDocument(contentId);
      if (result.success && result.document) {
        const doc = result.document;
        setPage({
          id: doc.id,
          slug: doc.slug || doc.id,
          title: doc.title || 'Bez názvu',
          content: doc.content || '',
          description: doc.description || '',
          category: 'my-content',
          featuredMedia: doc.featured_media,
          sectionImages: doc.section_images,
          documentType: doc.document_type || 'lesson',
          showTOC: doc.show_toc !== false,
        });
        setLoading(false);
        return;
      }

      // Not found anywhere
      console.error('[DocumentView] Document not found anywhere:', contentId);
      const availableKeys = Object.keys(localStorage).filter(k => k.startsWith('vivid-doc-'));
      console.log('[DocumentView] Available localStorage keys:', availableKeys.slice(0, 10));
      
      // Store the missing ID for recovery option
      setError(`notfound:${contentId}`);
    } catch (err) {
      console.error('Error loading my content:', err);
      setError('Chyba při načítání');
    } finally {
      setLoading(false);
    }
  };

  // Fetch a single page (used for both main load and prefetch)
  const fetchPageData = async (pageSlug: string): Promise<Page | null> => {
    const actualSlug = pageSlug.split('/').pop() || pageSlug;
    
    // Check cache first
    const cached = pageCacheRef.current.get(actualSlug);
    if (cached) return cached;

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/pages/${actualSlug}?category=${activeCategory}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      if (data.page) {
        // Store in cache
        pageCacheRef.current.set(actualSlug, data.page);
      }
      return data.page;
    } catch (err) {
      console.error('Error fetching page:', err);
      return null;
    }
  };

  // Prefetch sibling pages in the background
  const prefetchSiblings = async () => {
    const { siblings, currentIndex } = worksheetNavigation;
    if (siblings.length === 0) return;
    
    // Prefetch previous and next pages
    const prevSibling = currentIndex > 0 ? siblings[currentIndex - 1] : null;
    const nextSibling = currentIndex < siblings.length - 1 ? siblings[currentIndex + 1] : null;
    
    // Also prefetch 2 pages ahead/behind for smoother navigation
    const prev2Sibling = currentIndex > 1 ? siblings[currentIndex - 2] : null;
    const next2Sibling = currentIndex < siblings.length - 2 ? siblings[currentIndex + 2] : null;
    
    const slugsToFetch = [prevSibling?.slug, nextSibling?.slug, prev2Sibling?.slug, next2Sibling?.slug]
      .filter((s): s is string => !!s);
    
    // Fetch in parallel, silently in background
    await Promise.all(slugsToFetch.map(s => fetchPageData(s)));
  };

  const loadPage = async (pageSlug: string) => {
    setLoading(true);
    setError('');

    // Handle deep paths - extract the actual slug (last segment)
    const actualSlug = pageSlug.split('/').pop() || pageSlug;

    try {
      const pageData = await fetchPageData(actualSlug);
      
      if (!pageData) {
           // Check if this is a workbook from menu (workbooks may not have a page record)
           const findMenuItemBySlug = (items: MenuItem[], targetSlug: string): MenuItem | null => {
             for (const item of items) {
               if (item.slug === targetSlug) return item;
               if (item.children) {
                 const found = findMenuItemBySlug(item.children, targetSlug);
                 if (found) return found;
               }
             }
             return null;
           };
           
           const menuItem = findMenuItemBySlug(menu, actualSlug);
           
           // If it's a workbook, create a virtual page from menu data
           if (menuItem && (menuItem.type === 'workbook' || menuItem.icon === 'book' || menuItem.icon === 'workbook')) {
             console.log('[DocumentationLayout] Creating virtual page for workbook:', actualSlug);
             const virtualPage: Page = {
               id: menuItem.id,
               slug: menuItem.slug || actualSlug,
               title: menuItem.label,
               content: JSON.stringify({
                 coverImage: menuItem.coverImage || '',
                 author: (menuItem as any).author,
                 purchaseUrl: (menuItem as any).eshopUrl, // Map eshopUrl to purchaseUrl for WorkbookView
               }),
               description: '',
               icon: 'book',
               documentType: 'workbook',
               featuredMedia: menuItem.coverImage || '',
               sectionImages: [],
               worksheetData: null,
               showTOC: false,
             };
             setPage(virtualPage);
             return;
           }
           
           // Don't set error for 404, so we can fallback to Folder View (CategoryOverview)
           setPage(null);
           return;
      }

      // Check if this page should redirect to VividBoard
      const boardTypes = ['test', 'exam', 'practice'];
      const shouldCheckBoard = boardTypes.includes(pageData.documentType || '');
      
      // 1. Check for explicit board:// URL
      if (pageData.externalUrl?.startsWith('board://')) {
        const boardId = pageData.externalUrl.replace('board://', '');
        navigate(`/quiz/view/${boardId}`, { replace: true });
        return;
      }
      
      // 2. For test/exam/practice types, check if a board exists with standard naming
      if (shouldCheckBoard) {
        const expectedBoardId = `board_${actualSlug}`;
        const quiz = quizStorage.getQuiz(expectedBoardId);
        if (quiz) {
          navigate(`/quiz/view/${expectedBoardId}`, { replace: true });
          return;
        }
      }

      setPage(pageData);
    } catch (err: any) {
      console.error('Error loading page:', err);
      setError('Failed to load page');
    } finally {
      setLoading(false);
    }
  };

  const copyPageUrl = async () => {
    const url = window.location.href;
    let success = false;

    try {
      await navigator.clipboard.writeText(url);
      success = true;
    } catch (err) {
      // Fallback for environments where Clipboard API is blocked
      try {
        const textArea = document.createElement("textarea");
        textArea.value = url;
        
        // Ensure it's not visible but part of the DOM
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        
        textArea.focus();
        textArea.select();
        
        success = document.execCommand('copy');
        document.body.removeChild(textArea);
      } catch (e) {
        console.error('Copy failed', e);
      }
    }

    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrintPDF = () => {
    window.print();
  };

  const toggleReaderMode = () => {
    if (!readerMode) {
      // Entering reader mode
      setReaderMode(true);
      setSidebarVisible(false);
    } else {
      // Exiting reader mode
      setReaderMode(false);
      setSidebarVisible(true);
    }
  };

  const handleCopyAndEdit = () => {
    if (!page) return;

    try {
      // Get category/subject name (e.g. "Fyzika")
      const categoryLabel = MENU_GROUPS.flatMap(g => g.items).find(i => i.id === activeCategory)?.label || activeCategory;
      
      // Find the TOP LEVEL book that contains this page by searching menu recursively
      // We need to find which top-level book (e.g., "Základy") contains the current page
      const findTopLevelBookForPage = (pageId: string, actualPageSlug: string): { id: string; label: string; color?: string; coverImage?: string } | null => {
        for (const topBook of menu) {
          // Check if page is directly this top-level book
          if (topBook.id === pageId || topBook.slug === actualPageSlug) {
            return { id: topBook.id, label: topBook.label, color: topBook.color, coverImage: topBook.coverImage };
          }
          
          // Check if page is anywhere in this book's children (search by ID and slug)
          const searchInChildren = (items: MenuItem[]): boolean => {
            for (const item of items) {
              // Match by ID or by slug
              if (item.id === pageId || item.slug === actualPageSlug) {
                return true;
              }
              if (item.children && searchInChildren(item.children)) {
                return true;
              }
            }
            return false;
          };
          
          if (topBook.children && searchInChildren(topBook.children)) {
            return { id: topBook.id, label: topBook.label, color: topBook.color, coverImage: topBook.coverImage };
          }
        }
        return null;
      };
      
      // Use page.id AND page.slug to find the book
      const pageId = page.id || '';
      const actualPageSlug = page.slug || ''; // This is the actual page slug like "hmota"
      let topBook = findTopLevelBookForPage(pageId, actualPageSlug);
      
      // Fallback: hardcoded mapping for known pages
      if (!topBook && actualPageSlug) {
        const pageToBookMap: { [key: string]: string } = {
          // Základy
          'hmota': 'Základy',
          'castice-hmoty': 'Základy',
          'latky': 'Základy',
          'skupenstvi': 'Základy',
          'vlastnosti-latek': 'Základy',
          'teplotni-rozdeleni-latek': 'Základy',
          // Add more mappings as needed
        };
        
        if (pageToBookMap[actualPageSlug]) {
          topBook = { id: actualPageSlug, label: pageToBookMap[actualPageSlug] };
        }
      }
      
      let bookLabel = topBook?.label || 'Základy'; // Default to Základy instead of Ostatní
      
      // Fallback colors for known books if not in menu
      const bookColorMap: { [key: string]: string } = {
        'Základy': '#1e3a8a', // Dark blue
        'Síly': '#7c3aed', // Purple
        'Kapaliny a plyny': '#0891b2', // Cyan
        'Optika': '#ea580c', // Orange
        'Energie': '#dc2626', // Red
        'Akustika': '#059669', // Green
        'Elektřina a magnetismus': '#2563eb', // Blue
        'Fyzika mikrosvěta': '#9333ea', // Purple
        'Vesmír': '#0f172a', // Dark gray/black
      };
      
      // If no color from menu, use fallback
      if (!topBook?.color && bookColorMap[bookLabel]) {
        topBook = topBook || { id: '', label: bookLabel };
        topBook.color = bookColorMap[bookLabel];
      }
      
      console.log('=== COPY DEBUG ===');
      console.log('Page ID:', pageId);
      console.log('Page.slug (actual):', actualPageSlug);
      console.log('Menu has', menu.length, 'top-level items');
      if (menu.length > 0) {
        console.log('First menu item:', menu[0].label, 'color:', menu[0].color, 'with', menu[0].children?.length || 0, 'children');
      }
      console.log('Found top book:', topBook);
      console.log('Book label:', bookLabel);
      console.log('Book color:', topBook?.color);
      console.log('=== END DEBUG ===')
      
      // Folder colors from MyContentLayout
      const FOLDER_COLORS = ['#bbf7d0', '#bfdbfe', '#fde68a', '#fecaca', '#e9d5ff', '#99f6e4', '#fed7aa', '#fca5a5'];
      
      // Get existing folders using folder-storage
      let existingFolders: any[] = getFolders();

      // Find or create SUBJECT folder (e.g. "Fyzika")
      let subjectFolder = existingFolders.find(f => f.name === categoryLabel && f.copiedFrom === 'vividbooks-category');
      
      if (!subjectFolder) {
        const randomColor = FOLDER_COLORS[Math.floor(Math.random() * FOLDER_COLORS.length)];
        subjectFolder = {
          id: `folder-vb-${activeCategory}-${Date.now()}`,
          name: categoryLabel,
          type: 'folder',
          color: randomColor,
          copiedFrom: 'vividbooks-category',
          children: []
        };
        existingFolders.push(subjectFolder);
      }

      // Find or create BOOK folder inside subject (e.g. "Základy" inside "Fyzika")
      subjectFolder.children = subjectFolder.children || [];
      let bookFolder = subjectFolder.children.find((f: any) => f.name === bookLabel && f.type === 'folder');
      
      if (!bookFolder) {
        // Use color from VividBooks menu if available, otherwise use random color
        const bookColor = topBook?.color || FOLDER_COLORS[Math.floor(Math.random() * FOLDER_COLORS.length)];
        bookFolder = {
          id: `folder-vb-book-${topBook?.id || 'other'}-${Date.now()}`,
          name: bookLabel,
          type: 'folder',
          color: bookColor,
          copiedFrom: 'vividbooks-book',
          children: []
        };
        subjectFolder.children.push(bookFolder);
      }

      // Create new document item
      const newDocId = crypto.randomUUID();
      const newItem = {
        id: newDocId,
        name: page.title,
        type: page.documentType === 'worksheet' ? 'board' : 'document',
        copiedFrom: 'vividbooks',
        originalId: page.id,
        documentType: page.documentType || 'lesson',
      };

      // Save document content using document-storage (saves to localStorage AND Supabase)
      const docData = {
        id: newDocId,
        title: page.title,
        content: page.content || '',
        description: page.description || '',
        slug: page.slug || '',
        featuredMedia: page.featuredMedia || '',
        sectionImages: page.sectionImages || [],
        documentType: page.documentType || 'lesson',
        copiedFrom: 'vividbooks',
        originalId: page.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      // Use the proper storage function that syncs to Supabase
      saveDocumentToStorage({
        id: newDocId,
        name: page.title,
        type: 'document',
        title: page.title,
        description: page.description || '',
        copiedFrom: 'vividbooks',
        originalId: page.id,
        folderId: bookFolder.id, // Set the folder ID so it syncs correctly
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, docData);

      // Add document to book folder's children
      bookFolder.children = bookFolder.children || [];
      bookFolder.children.push(newItem);

      // Update folders using folder-storage (saves to localStorage AND Supabase)
      const updatedFolders = existingFolders.map(f => 
        f.id === subjectFolder.id ? subjectFolder : f
      );
      saveFolders(updatedFolders);

      // Store toast message for display after navigation
      sessionStorage.setItem('copied-doc-toast', JSON.stringify({
        title: page.title,
        path: `Můj obsah → Zkopírováno z VividBooks → ${categoryLabel} → ${bookLabel}`
      }));

      // Navigate to view the copied document
      navigate(`/library/my-content/view/${newDocId}`);

    } catch (e) {
      console.error("Failed to copy", e);
      toast.error("Chyba při kopírování");
    }
  };

  // Open worksheet type selector popup
  const handleOpenWorksheetSelector = () => {
    setShowWorksheetTypeSelector(true);
  };

  // Open quiz type selector popup
  const handleOpenQuizSelector = () => {
    setShowQuizTypeSelector(true);
  };

  // Generate contextual loading messages for quiz generation
  const generateQuizLoadingMessages = (topic: string, quizType: QuizType): string[] => {
    const topicLower = topic.toLowerCase();
    const typeLabel = quizType === 'aktivita' ? 'aktivitu' : quizType === 'test' ? 'test' : 'písemku';
    
    const baseMessages = [
      `Analyzuji téma "${topic}"...`,
      `Připravuji ${typeLabel}...`,
      `Vybírám klíčové koncepty...`,
      `Vytvářím interaktivní obsah...`,
    ];
    
    // Add type-specific messages
    if (quizType === 'aktivita') {
      baseMessages.push(
        `Navrhuji nástěnky pro diskuzi...`,
        `Připravuji hlasování...`,
        `Vytvářím spojovačky a doplňovačky...`,
        `Přidávám zpětnou vazbu...`
      );
    } else if (quizType === 'test') {
      baseMessages.push(
        `Generuji otázky s výběrem...`,
        `Připravuji příklady k procvičení...`,
        `Nastavuji správné odpovědi...`
      );
    } else {
      baseMessages.push(
        `Formuluji otevřené otázky...`,
        `Připravuji otázky k zamyšlení...`,
        `Vytvářím otázky na porozumění...`
      );
    }
    
    // Add topic-specific fun messages
    baseMessages.push(
      `Přemýšlím o "${topicLower}"...`,
      `Hledám zajímavosti o ${topicLower}...`,
      `Ladím poslední detaily...`
    );
    
    return baseMessages;
  };

  // Handle quiz type selection - generate quiz and navigate to editor
  const handleQuizTypeSelected = async (quizType: QuizType) => {
    console.log('[Quiz] Type selected:', quizType, 'Page:', page?.title);
    if (!page) return;
    
    setShowQuizTypeSelector(false);
    
    // Generate contextual loading messages
    const loadingMessages = generateQuizLoadingMessages(page.title || 'Dokument', quizType);
    setQuizLoadingMessages(loadingMessages);
    setIsGeneratingQuiz(true);
    
    try {
      // Extract media from the document for the AI to use
      const documentMedia: { type: 'image' | 'lottie'; url: string; caption?: string }[] = [];
      
      // Extract images from HTML
      const htmlImages = extractImagesFromHtml(page.content || '');
      htmlImages.forEach(img => {
        documentMedia.push({
          type: img.type === 'lottie' ? 'lottie' : 'image',
          url: img.url,
          caption: img.alt,
        });
      });
      
      // Also check sectionImages for Lottie animations
      if (page.sectionImages && page.sectionImages.length > 0) {
        page.sectionImages.forEach((sectionImg: any) => {
          if (sectionImg.type === 'lottie' && sectionImg.lottieConfig?.steps?.[0]?.url) {
            documentMedia.push({
              type: 'lottie',
              url: sectionImg.lottieConfig.steps[0].url,
              caption: sectionImg.heading || 'Animace',
            });
          }
        });
      }
      
      console.log('[Quiz] Document media extracted:', documentMedia.length);
      
      // Strip HTML tags for plain text content
      const plainContent = (page.content || '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      const result = await generateQuizFromDocument({
        documentContent: plainContent,
        documentTitle: page.title || 'Dokument',
        quizType,
        subject: activeCategory,
        documentMedia,
      });
      
      if (result.error || !result.quiz) {
        toast.error(result.error || 'Chyba při generování');
        return;
      }
      
      // Save the quiz to storage
      quizStorage.saveQuiz(result.quiz);
      
      const typeLabel = quizType === 'aktivita' ? 'Aktivita' : quizType === 'test' ? 'Test' : 'Písemka';
      toast.success(`${typeLabel} vytvořena! (${result.quiz.slides.length} slidů)`);
      
      // Navigate to the quiz editor
      navigate(`/quiz/edit/${result.quiz.id}`);
      
    } catch (error: any) {
      console.error('[Quiz] Generation error:', error);
      toast.error('Chyba při generování: ' + (error.message || 'Neznámá chyba'));
    } finally {
      setIsGeneratingQuiz(false);
      setQuizLoadingMessages([]);
    }
  };

  // After user selects worksheet type, extract images and show image selection
  const handleWorksheetTypeSelected = (worksheetType: WorksheetType) => {
    console.log('[Worksheet] Type selected:', worksheetType, 'Page:', page?.title);
    if (!page) return;
    
    // Close the type selector
    setShowWorksheetTypeSelector(false);
    
    // Store the selected type
    setPendingWorksheetType(worksheetType);
    
    // Extract images from the page content
    const images = extractImagesFromHtml(page.content || '');
    console.log('[Worksheet] Extracted images from HTML:', images.length);
    
    // Also check sectionImages for Lottie animations
    if (page.sectionImages && page.sectionImages.length > 0) {
      console.log('[Worksheet] Found sectionImages:', page.sectionImages.length);
      page.sectionImages.forEach((sectionImg: any) => {
        if (sectionImg.type === 'lottie' && sectionImg.lottieConfig?.steps?.[0]?.url) {
          images.push({
            type: 'lottie',
            url: sectionImg.lottieConfig.steps[0].url,
            alt: sectionImg.heading || 'Animace',
          });
        }
      });
    }
    
    console.log('[Worksheet] Total images for selection:', images.length);
    setExtractedLessonImages(images);
    
    // Show image selection step
    console.log('[Worksheet] Opening image selection popup');
    setShowImageSelection(true);
  };

  // Handle image selection complete - proceed with worksheet generation
  const handleImageSelectionComplete = async (selectedImages: ImageOption[]) => {
    setShowImageSelection(false);
    
    if (!page || !pendingWorksheetType) return;
    
    const worksheetType = pendingWorksheetType;
    setPendingWorksheetType(null);

    try {
      // Show loading state
      setIsGeneratingWorksheet(true);
      
      // Get type-specific labels
      const typeLabels: Record<WorksheetType, string> = {
        'test': 'Test',
        'pisemka': 'Písemka',
        'pracovni-list': 'Pracovní list',
      };
      
      // Show loading toast
      const loadingToast = toast.loading(`Vytvářím ${typeLabels[worksheetType].toLowerCase()} z dokumentu...`, {
        description: 'AI generuje obsah na základě dokumentu'
      });

      // Map category to subject
      const categoryToSubject: Record<string, Subject> = {
        'fyzika': 'fyzika',
        'chemie': 'chemie',
        'matematika': 'matematika',
        'prirodopis': 'prirodopis',
        'zemepis': 'zemepis',
        'dejepis': 'dejepis',
        'cestina': 'cestina',
        'anglictina': 'anglictina',
      };
      
      const subject: Subject = categoryToSubject[activeCategory] || 'other';
      
      // Extract text content from HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = page.content || '';
      const textContent = tempDiv.textContent || tempDiv.innerText || '';
      
      // Create worksheet ID
      const worksheetId = crypto.randomUUID();
      
      // Get type-specific prompt modifier
      const promptModifier = getPromptModifier(worksheetType);
      
      // Build prompt for AI
      const prompt = `${promptModifier}

DŮLEŽITÉ - Vycházej z tohoto učebního materiálu:

NÁZEV DOKUMENTU: ${page.title}

OBSAH DOKUMENTU:
${textContent.substring(0, 4000)}

Ujisti se, že všechny otázky a úlohy vycházejí přímo z obsahu dokumentu a jsou relevantní pro dané téma.`;

      // Generate content using AI
      const response = await generateWorksheetContent({
        prompt,
        context: {
          subject,
          grade: 6,
          topic: page.title,
        }
      });

      // Build blocks with images distributed throughout
      // RULE: Every image MUST be HALF width, paired with HALF width content!
      // If no pair available, image is NOT added!
      let blocks = response.blocks || [];
      
      // IMPORTANT: Remove ANY image blocks that AI generated!
      // We only use images that the USER selected in ImageSelectionStep!
      const blocksWithoutAIImages = blocks.filter((b: any) => b.type !== 'image');
      console.log('[Layout] Removed', blocks.length - blocksWithoutAIImages.length, 'AI-generated images');
      blocks = blocksWithoutAIImages;
      
      console.log('=== [Layout] Building with', selectedImages.length, 'user-selected images ===');
      
      if (selectedImages.length > 0) {
        const suitableBlockTypes = ['paragraph', 'infobox', 'multiple-choice', 'fill-blank', 'free-answer'];
        
        // Find ALL suitable blocks that can be paired with images
        const suitableIndices: number[] = [];
        blocks.forEach((b: any, i: number) => {
          if (suitableBlockTypes.includes(b.type)) {
            suitableIndices.push(i);
          }
        });
        
        console.log('[Layout] Suitable blocks for pairing:', suitableIndices.length);
        
        // LIMIT: Only use as many images as we have blocks to pair with!
        const maxPairs = Math.min(selectedImages.length, suitableIndices.length);
        
        // Distribute image positions evenly across suitable blocks
        const imagePositions: number[] = [];
        for (let i = 0; i < maxPairs; i++) {
          const idx = Math.floor(i * suitableIndices.length / maxPairs);
          imagePositions.push(suitableIndices[idx]);
        }
        
        console.log('[Layout] Will create', maxPairs, 'pairs at positions:', imagePositions);
        
        const finalBlocks: typeof blocks = [];
        let imageIdx = 0;
        
        for (let i = 0; i < blocks.length; i++) {
          const block = { ...blocks[i] };
          
          if (imageIdx < imagePositions.length && i === imagePositions[imageIdx]) {
            // PAIR: content (half) + image (half) - ALWAYS together!
            block.width = 'half' as const;
            finalBlocks.push(block);
            
            const img = selectedImages[imageIdx];
            finalBlocks.push({
              id: generateBlockId(),
              type: 'image' as const,
              order: finalBlocks.length,
              width: 'half' as const, // MUST be half!
              content: {
                url: img.url,
                alt: img.caption || '',
                caption: img.caption || '',
                size: 'full' as const,
                alignment: 'center' as const,
              },
            });
            
            console.log('[Layout] PAIR created: block', i, '(half) + image (half)');
            imageIdx++;
          } else {
            block.width = 'full' as const;
            finalBlocks.push(block);
          }
        }
        
        // Extra images that couldn't be paired are SKIPPED (not added)
        if (imageIdx < selectedImages.length) {
          console.log('[Layout] SKIPPED', selectedImages.length - imageIdx, 'images (no pairs available)');
        }
        
        console.log('[Layout] Result:', finalBlocks.map(b => `${b.type}(${b.width})`).join(', '));
        
        // Update order numbers
        finalBlocks.forEach((b, idx) => { b.order = idx; });
        blocks = finalBlocks;
      }

      // Create worksheet
      const worksheet: Worksheet = {
        id: worksheetId,
        title: `${typeLabels[worksheetType]}: ${page.title}`,
        blocks: blocks,
        metadata: {
          subject,
          grade: 6,
          topic: page.title,
          columns: 1,
          globalFontSize: 'normal',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // DEBUG: Log blocks before saving
      console.log('=== [SAVE] Worksheet blocks before save ===');
      worksheet.blocks.forEach((b, i) => {
        console.log(`  Block ${i}: ${b.type} width=${b.width}`);
      });

      // Save worksheet
      saveWorksheet(worksheet);

      // Dismiss loading toast and show success
      toast.dismiss(loadingToast);
      setIsGeneratingWorksheet(false);
      toast.success(`${typeLabels[worksheetType]} vytvořen!`, {
        description: `Vygenerováno ${blocks.length} bloků z dokumentu "${page.title}"`
      });

      // Navigate to worksheet editor
      navigate(`/library/my-content/worksheet-editor/${worksheetId}`);

    } catch (e) {
      console.error("Failed to create worksheet", e);
      setIsGeneratingWorksheet(false);
      toast.error("Chyba při vytváření materiálu", {
        description: e instanceof Error ? e.message : 'Neznámá chyba'
      });
    }
  };
  
  // Handle skipping image selection
  const handleSkipImageSelection = () => {
    handleImageSelectionComplete([]);
  };

  const isOverview = !loading && !error && !page;

  return (
    <div 
      className="min-h-screen bg-background transition-colors duration-300"
      style={{ paddingTop: classroomShare.state.isSharing ? '40px' : undefined }}
    >
      {/* Loading Overlay for Worksheet Generation */}
      {isGeneratingWorksheet && (
        <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-start justify-center" style={{ paddingTop: '20px' }}>
          <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-md mx-4 text-center">
            <div className="mb-4">
              <img 
                src="https://app.vividbooks.com/assets/img/loading-new.gif" 
                alt="Loading" 
                className="h-24 mx-auto object-contain"
              />
            </div>
            <h3 className="text-xl font-semibold text-slate-800 mb-2">
              Vytvářím materiál
            </h3>
            <p className="text-slate-500">
              AI generuje obsah z dokumentu...
            </p>
          </div>
        </div>
      )}
      
      {/* Worksheet Type Selector Popup */}
      <WorksheetTypeSelector
        isOpen={showWorksheetTypeSelector}
        onClose={() => setShowWorksheetTypeSelector(false)}
        onSelect={handleWorksheetTypeSelected}
        documentTitle={page?.title || 'Dokument'}
      />
      
      {/* Quiz Type Selector Popup */}
      <QuizTypeSelector
        isOpen={showQuizTypeSelector}
        onClose={() => setShowQuizTypeSelector(false)}
        onSelect={handleQuizTypeSelected}
        documentTitle={page?.title || 'Dokument'}
      />
      
      {/* Quiz Generation Loading Overlay */}
      {isGeneratingQuiz && quizLoadingMessages.length > 0 && (
        <GeneratingLoader 
          messages={quizLoadingMessages}
          title="Generuji obsah"
          intervalMs={2500}
          onCancel={() => {
            setIsGeneratingQuiz(false);
            setQuizLoadingMessages([]);
          }}
        />
      )}
      
      {/* Image Selection Popup */}
      {showImageSelection && (
        <div 
          className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-hidden"
          onClick={(e) => {
            // Close on backdrop click
            if (e.target === e.currentTarget) handleSkipImageSelection();
          }}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col relative overflow-hidden"
            style={{ minHeight: '500px' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={handleSkipImageSelection}
              className="absolute top-4 right-4 z-10 p-2 rounded-lg bg-white/80 hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors shadow-sm"
              title="Zavřít"
            >
              <X className="h-5 w-5" />
            </button>
            <ImageSelectionStep
              topic={page?.title || 'Pracovní list'}
              content={page?.content || ''}
              lessonImages={extractedLessonImages}
              onConfirm={handleImageSelectionComplete}
              onSkip={handleSkipImageSelection}
            />
          </div>
        </div>
      )}

      <div className="flex">
        {/* Left Sidebar - Navigation */}
        {/* Hidden in reader mode or when sidebarVisible is false on desktop */}
        <aside 
          className={`
            /* Base layout properties */
            top-0 h-screen shrink-0 ${toolsOpen || isMyContent ? 'bg-[#4E5871]' : 'bg-[#EAEFFA]'} flex flex-col
            
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
                    className="flex items-center justify-center min-h-[40px] w-20"
                    onMouseEnter={() => setLogoHovered(true)}
                    onMouseLeave={() => setLogoHovered(false)}
                  >
                    {slug && logoHovered && !isMyContent ? (
                      <Link to={`/docs/${activeCategory}`} className="flex items-center gap-2 text-[#4E5871] font-medium text-sm whitespace-nowrap animate-in fade-in duration-200">
                        <ArrowLeft className="h-4 w-4" />
                        Zpět
                      </Link>
                    ) : isMyContent ? (
                      <Link to="/library/my-content" className="flex items-center">
                        <div className={`w-20 h-10 ${isMyContent ? 'text-white' : 'text-[#4E5871]'}`}>
                          <VividLogo />
                        </div>
                      </Link>
                    ) : (
                      <Link to="/docs/knihovna-vividbooks/introduction" className="flex items-center">
                        <div className="w-20 h-10 text-[#4E5871]">
                          <VividLogo />
                        </div>
                      </Link>
                    )}
                  </div>
                  <ToolsDropdown 
                    isOpen={toolsOpen} 
                    onToggle={() => setToolsOpen(!toolsOpen)} 
                    label={isMyContent ? 'Můj obsah' : 'Knihovna'}
                    variant={isMyContent ? 'yellow' : 'default'}
                  />
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="lg:hidden p-1.5 rounded-md transition-colors"
                    style={{ color: isMyContent ? '#ffffff' : '#4E5871' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isMyContent ? 'rgba(255,255,255,0.1)' : '#F1F4F9'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <X className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setSidebarVisible(false)}
                    className="hidden lg:block p-1.5 rounded-md transition-colors"
                    style={{ color: isMyContent ? '#ffffff' : '#4E5871' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isMyContent ? 'rgba(255,255,255,0.1)' : '#F1F4F9'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    title="Skrýt menu"
                  >
                    <PanelLeftClose className="h-[23px] w-[23px]" />
                  </button>
                </div>
              </div>
              )}
            </div>

            {/* Navigation Menu (Categories + Switch) OR Tools Menu OR My Content Menu */}
            <div className="flex-1 overflow-hidden text-[#4E5871]">
              {toolsOpen ? (
                <ToolsMenu 
                  activeItem={isMyContent ? 'my-content' : 'library'}
                  onItemClick={() => {
                  setToolsOpen(false);
                  setSidebarOpen(false);
                  }}
                  isStudentMode={isStudentMode}
                />
              ) : isMyContent ? (
                /* My Content Sidebar - Dark theme */
                <div className="h-full overflow-y-auto p-4 bg-[#4E5871]">
                  {/* My Folders Section */}
                  <div className="mb-6">
                    <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-3 px-2 flex items-center gap-2">
                      <Folder className="h-3 w-3" />
                      Moje složky
                    </h3>
                    <div className="space-y-1">
                      {myContentFolders.filter((f: any) => f.copiedFrom !== 'vividbooks-category').map((folder: any) => (
                        <button
                          key={folder.id}
                          onClick={() => {
                            navigate('/library/my-content');
                            setSidebarOpen(false);
                          }}
                          className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm font-medium text-white/90"
                        >
                          <div 
                            className="w-4 h-4 rounded flex-shrink-0"
                            style={{ backgroundColor: folder.color || '#f472b6' }}
                          />
                          <span className="truncate">{folder.name}</span>
                        </button>
                      ))}
                      <button
                        onClick={() => {
                          navigate('/library/my-content');
                          setSidebarOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm text-white/50"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Nová složka</span>
                      </button>
                    </div>
                  </div>
                  
                  {/* Copied Content Section */}
                  {myContentCopied.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-3 px-2 flex items-center gap-2">
                        <Copy className="h-3 w-3" />
                        Zkopírováno z VividBooks
                      </h3>
                      <div className="space-y-1">
                        {myContentCopied.map((folder: any) => (
                          <button
                            key={folder.id}
                            onClick={() => {
                              // Navigate to My Content with folder ID to open it
                              navigate(`/library/my-content?openFolder=${folder.id}`);
                              setSidebarOpen(false);
                            }}
                            className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm font-medium text-white/90"
                          >
                            <div 
                              className="w-4 h-4 rounded flex-shrink-0"
                              style={{ backgroundColor: folder.color || '#f472b6' }}
                            />
                            <span className="truncate">{folder.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <NavigationMenu 
                  groups={MENU_GROUPS}
                  activeCategory={activeCategory}
                  onNavigate={() => setSidebarOpen(false)}
                  activeTab={effectiveViewMode}
                  onTabChange={handleTabChange}
                  canViewFolders={licenseAccess.canViewFolders}
                  showTree={!!slug && !isLibraryHomepage}
                  currentSlug={slug}
                  isStudentMode={isStudentMode}
                  hideTabSwitcher={isLibraryHomepage}
                />
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
        <main 
          className="flex-1 min-w-0"
          style={{ marginRight: (showTeachMeChat || showSharePanel || showDocSharePanel || (showAIPanel && !aiPanelFullscreen)) ? '360px' : '0' }}
        >
          {/* Locked mode - only show logo and reader mode button */}
          {isLockedMode && page && (
            <div className="bg-background px-4 pt-5 pb-2 print:hidden">
              <div className="w-full flex items-center justify-between">
                {/* Logo */}
                <div className="w-20 h-10 text-[#4E5871]">
                  <VividLogo />
                </div>
                
                {/* Reader mode button */}
                <button
                  onClick={toggleReaderMode}
                  className={`flex p-2 rounded-md transition-all items-center gap-2 ${
                    readerMode 
                      ? 'bg-orange-500 text-white shadow-sm' 
                      : 'hover:bg-accent'
                  }`}
                  style={{ color: readerMode ? '#ffffff' : '#4E5871' }}
                  title={readerMode ? "Vypnout čtenářský mód" : "Zapnout čtenářský mód"}
                >
                  <BookOpen className="h-5 w-5" />
                  <span className="font-medium">Čtenářský mód</span>
                </button>
              </div>
            </div>
          )}

          {/* Mobile menu button and search bar - Not sticky anymore (hidden for worksheet, workbook, and locked mode) */}
          {!isLockedMode && (!page || (page.documentType !== 'worksheet' && page.documentType !== 'workbook')) && (
          <div className="bg-background px-4 pt-5 pb-2 print:hidden">
            {showTeachMeChat ? (
              // Header pro Teach Me Mode
              <div className="w-full flex items-center gap-2 relative justify-center h-10">
                 <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex items-center gap-3">
                    {/* Teach Me Button - Active State */}
                    <button
                      onClick={handleCloseChat}
                      className="flex p-2 rounded-md transition-all items-center gap-2 bg-yellow-400 text-slate-900 shadow-sm hover:bg-yellow-500"
                      title="Vypnout učitele"
                    >
                       <Sparkles className="h-5 w-5" />
                       <span className="font-medium">Nauč mě</span>
                    </button>
                 </div>
                 
                 {/* Non-clickable Logo */}
                 <div className="absolute left-0 top-1/2 -translate-y-1/2">
                    <div className="w-20 h-10 text-[#4E5871] opacity-50 cursor-default pointer-events-none">
                      <VividLogo />
                    </div>
                 </div>
              </div>
            ) : (
              // Standard Header
              <div className="w-full flex items-center gap-2 relative">
              {/* Reader Mode Button (Centered) */}
              {page && (
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 hidden lg:flex items-center gap-3">
                   {/* Teach Me Button - hidden in reader mode, requires Ecosystem */}
                   {!readerMode && ecosystemAccess.canUseTeachMe && (
                     <div onClick={handleTeachMeClick}>
                        <TeachMeButton 
                          isActive={showTeachMeChat} 
                          status={ragState.status}
                        />
                     </div>
                   )}

                   <button
                      onClick={toggleReaderMode}
                      className={`flex p-2 rounded-md transition-all items-center gap-2 ${
                        readerMode 
                          ? 'bg-orange-500 text-white shadow-sm' 
                          : 'hover:bg-accent'
                      }`}
                      style={{ color: readerMode ? '#ffffff' : '#4E5871' }}
                      title={readerMode ? "Vypnout čtenářský mód" : "Zapnout čtenářský mód"}
                    >
                      <BookOpen className="h-5 w-5" />
                      <span className="font-medium">Čtenářský mód</span>
                   </button>
                </div>
              )}

              {/* Sidebar Toggle (Mobile) */}
              {!readerMode && (
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-md transition-colors"
                style={{ color: '#4E5871' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F1F4F9'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <Menu className="h-5 w-5" />
              </button>
              )}

              {/* Sidebar Toggle (Desktop) - Only visible when sidebar is hidden */}
              {!sidebarVisible && (
                <div className="hidden lg:flex items-center gap-3 mr-2">
                  <div 
                    className="flex items-center min-h-[40px]"
                    onMouseEnter={() => setLogoHovered(true)}
                    onMouseLeave={() => setLogoHovered(false)}
                  >
                    <button 
                        onClick={() => {
                          setSidebarVisible(true);
                          setShowTeachMeChat(false);
                        }}
                        className="w-20 h-10 text-[#4E5871] cursor-pointer hover:opacity-80 transition-opacity"
                        title="Otevřít menu"
                      >
                        <VividLogo />
                      </button>
                  </div>
                </div>
              )}
              
              {!readerMode && (
              <div className="flex items-center gap-1">
                {(slug || (isMyContent && myContentId)) && !isLibraryHomepage && (
                  <button
                    onClick={() => isMyContent ? navigate('/library/my-content') : navigate(-1)}
                    className="p-2 rounded-md transition-colors hover:bg-accent"
                    style={{ color: '#4E5871' }}
                    title="Zpět"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                )}
                {/* Hide search when viewing a document or on library homepage */}
                {!slug && !(isMyContent && myContentId) && !isLibraryHomepage && (
                  <button
                    onClick={() => setSearchOpen(true)}
                    className="p-2 rounded-md transition-colors hover:bg-accent"
                    style={{ color: '#4E5871' }}
                    title="Hledat (⌘K)"
                  >
                    <Search className="h-5 w-5" />
                  </button>
                )}
              </div>
              )}

              {/* Breadcrumbs */}
              {slug && !readerMode && (
                <div className="hidden items-center text-sm text-[#4E5871] ml-2 overflow-hidden">
                   <div className="h-4 w-px bg-gray-300 mx-2 flex-shrink-0"></div>
                   
                   {/* Category Root */}
                   <Link 
                     to={`/docs/${activeCategory}`}
                     className="hover:text-foreground transition-colors whitespace-nowrap flex-shrink-0" 
                   >
                     {MENU_GROUPS.flatMap(g => g.items).find(i => i.id === activeCategory)?.label || activeCategory}
                   </Link>

                   {/* Segments */}
                   {(() => {
                     // Helper to find item label by slug or id recursively
                     const findLabel = (items: MenuItem[], slugOrId: string): string | null => {
                       for (const item of items) {
                         if (item.slug === slugOrId || item.id === slugOrId) return item.label;
                         if (item.children) {
                           const found = findLabel(item.children, slugOrId);
                           if (found) return found;
                         }
                       }
                       return null;
                     };

                     const segments = slug.split('/').filter(Boolean);
                     return segments.map((segment, index) => {
                       const isLast = index === segments.length - 1;
                       const path = segments.slice(0, index + 1).join('/');
                       const url = `/docs/${activeCategory}/${path}`;
                       
                       // Determine label
                       let label = segment;
                       
                       if (isLast && page) {
                          label = page.title;
                       } else {
                          // Try to find label in menu
                          const foundLabel = findLabel(menu, segment);
                          if (foundLabel) {
                            label = foundLabel;
                          } else {
                            // Fallback prettify
                            label = label.replace(/-/g, ' ');
                            label = label.charAt(0).toUpperCase() + label.slice(1);
                          }
                       }

                       return (
                         <div key={path} className="flex items-center min-w-0">
                           <ChevronRight className="h-4 w-4 mx-1 text-gray-400 flex-shrink-0" />
                           {isLast ? (
                             <span className="font-medium text-foreground truncate max-w-[200px]">
                               {label}
                             </span>
                           ) : (
                             <Link 
                               to={url}
                               className="hover:text-foreground transition-colors whitespace-nowrap truncate max-w-[150px]"
                             >
                               {label}
                             </Link>
                           )}
                         </div>
                       );
                     });
                   })()}
                </div>
              )}

              <div className="flex-1" />

              <div className="flex items-center gap-1 sm:gap-2">
                {page && (
                  <>
                    {/* Edit button for My Content */}
                    {!readerMode && isMyContent && myContentId && (
                      <button
                        onClick={() => navigate(`/library/my-content/edit/${myContentId}`)}
                        className="hidden lg:flex p-2 px-4 rounded-lg transition-colors bg-[#4E5871] hover:bg-[#3d455a] items-center gap-2 text-white font-medium"
                        title="Upravit"
                      >
                        <Pencil className="h-4 w-4" />
                        <span>Upravit</span>
                      </button>
                    )}

                    {/* Student share indicator - handled by FirebaseStudentView */}

                    {/* Actions Dropdown for page view */}
                    {!readerMode && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="hidden lg:flex p-2 rounded-md transition-colors hover:bg-accent items-center gap-2 text-[#4E5871] outline-none"
                            title="Akce"
                          >
                            <span className="font-medium">Akce</span>
                            <ChevronDown className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          {/* Connect Students - teachers only */}
                          {!isStudentMode && !isMyContent && (
                            <DropdownMenuItem 
                              onClick={handleOpenSharePanel}
                              className="py-3 px-3 cursor-pointer bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-md mx-1 mb-1"
                            >
                              <Monitor className="h-5 w-5 mr-3 text-emerald-600" />
                              <span className="font-medium">Připojit studenty</span>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem 
                            onClick={handleOpenDocSharePanel}
                            className="py-3 px-3 cursor-pointer"
                          >
                            <LinkIcon className="h-5 w-5 mr-3" />
                            <span>Sdílet</span>
                          </DropdownMenuItem>
                          
                          {/* Ecosystem features - require license */}
                          {!isMyContent && ecosystemAccess.canCreateContent && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuLabel className="text-xs text-muted-foreground px-3 py-2">Vytvořit</DropdownMenuLabel>
                              <DropdownMenuItem 
                                onClick={handleCopyAndEdit}
                                className="py-3 px-3 cursor-pointer"
                              >
                                <Copy className="h-5 w-5 mr-3" />
                                <span>Kopírovat a upravit</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={handleOpenWorksheetSelector}
                                className="py-3 px-3 cursor-pointer"
                              >
                                <FileEdit className="h-5 w-5 mr-3" />
                                <span>Pracovní list</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={handleOpenQuizSelector}
                                disabled={isGeneratingQuiz}
                                className="py-3 px-3 cursor-pointer"
                              >
                                <MessageSquareText className="h-5 w-5 mr-3" />
                                <span>{isGeneratingQuiz ? 'Generuji...' : 'Kvíz'}</span>
                              </DropdownMenuItem>
                            </>
                          )}
                          
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={handlePrintPDF}
                            className="py-3 px-3 cursor-pointer"
                          >
                            <Printer className="h-5 w-5 mr-3" />
                            <span>Tisknout</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </>
                )}

                {/* AI Assistant Button - hidden on library homepage where AI is integrated */}
                {!isLibraryHomepage && (
                <button
                  onClick={handleOpenAIPanel}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 500,
                    backgroundColor: showAIPanel ? '#f59e0b' : '#fef3c7',
                    color: showAIPanel ? 'white' : '#92400e',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (!showAIPanel) {
                      e.currentTarget.style.backgroundColor = '#fde68a';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!showAIPanel) {
                      e.currentTarget.style.backgroundColor = '#fef3c7';
                    }
                  }}
                  title="AI asistent"
                >
                  <Sparkles className="h-4 w-4" />
                  <span className="hidden sm:inline">AI asistent</span>
                </button>
                )}

                {/* Dark mode toggle removed */}
              </div>
            </div>
            )}
          </div>
          )}

          {/* Sidebar Toggle for Worksheet (when top bar is hidden) - hidden in locked mode */}
          {!isLockedMode && !sidebarVisible && page?.documentType === 'worksheet' && (
            <button
              onClick={() => setSidebarVisible(true)}
              className="absolute top-4 left-4 z-50 p-2 bg-white/80 backdrop-blur-sm shadow-sm border border-slate-200 rounded-md text-[#4E5871] hover:bg-white transition-all print:hidden"
              title="Zobrazit menu"
            >
              <PanelLeft className="h-5 w-5" />
            </button>
          )}

          <div className={`
            ${readerMode ? 'w-full px-8 py-12' : isOverview ? 'w-full' : 'max-w-6xl mx-auto px-4 py-6 md:py-8 lg:px-8'}
          `}>
            {loading || licenseAccess.loading ? (
              <LoadingSpinner className="py-12" />
            ) : !licenseAccess.hasAccess && !isMyContent ? (
              // Show promo page for subjects without license or school connection
              (() => {
                const subjectMeta = SUBJECTS.find(s => s.id === activeCategory || s.id.startsWith(activeCategory));
                const subjectLabel = subjectMeta?.label || activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1);
                return <SubjectPromo 
                  subject={activeCategory} 
                  subjectLabel={subjectLabel} 
                  needsSchoolConnection={licenseAccess.needsSchoolConnection}
                />;
              })()
            ) : error ? (
              <div className="text-center py-8 md:py-12 px-4">
                <h1 className="text-2xl md:text-4xl mb-4" style={{ fontWeight: 600 }}>
                  {error.startsWith('notfound:') ? 'Dokument nenalezen' : 'Chyba'}
                </h1>
                <p className="text-muted-foreground text-sm md:text-base mb-4">
                  {error.startsWith('notfound:') 
                    ? 'Tento dokument neexistuje nebo byl smazán.'
                    : error}
                </p>
                {error.startsWith('notfound:') && (
                  <p className="text-xs text-muted-foreground mb-6 font-mono bg-muted px-3 py-2 rounded inline-block">
                    ID: {error.replace('notfound:', '')}
                  </p>
                )}
                <div className="flex flex-col items-center gap-3">
                  {error.startsWith('notfound:') && (
                    <button
                      onClick={() => {
                        const missingId = error.replace('notfound:', '');
                        // Create empty document with this ID
                        const docData = {
                          id: missingId,
                          title: 'Obnovený dokument',
                          content: '<p>Obsah dokumentu byl ztracen. Prosím, vytvořte ho znovu.</p>',
                          documentType: 'document',
                          updatedAt: new Date().toISOString(),
                        };
                        localStorage.setItem(`vivid-doc-${missingId}`, JSON.stringify(docData));
                        // Reload
                        window.location.reload();
                      }}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
                    >
                      Vytvořit prázdný dokument
                    </button>
                  )}
                  <Link 
                    to="/library/my-content" 
                    className="text-primary hover:underline"
                  >
                    ← Zpět na moje materiály
                  </Link>
                  <Link 
                    to="/" 
                    className="text-muted-foreground hover:text-foreground transition-colors text-sm"
                  >
                    Domů
                  </Link>
                </div>
              </div>
            ) : isLibraryHomepage ? (
              <div className="flex-1 h-[calc(100vh-60px)] flex flex-col overflow-hidden bg-background">
                <TeacherAssistant onClose={() => {}} mode="integrated" />
              </div>
            ) : page ? (
              page.documentType === 'worksheet' ? (
                (() => {
                  const { siblings, currentIndex, workbookSlug } = worksheetNavigation;
                  
                  // Only show navigation arrows if worksheet is part of a workbook
                  const isInWorkbook = siblings.length > 0 && currentIndex !== -1;
                  
                  const prevSibling = currentIndex > 0 ? siblings[currentIndex - 1] : null;
                  const nextSibling = currentIndex >= 0 && currentIndex < siblings.length - 1 ? siblings[currentIndex + 1] : null;
                  
                  // Build full path using workbook prefix
                  const buildPath = (childSlug: string) => {
                    return workbookSlug ? `${workbookSlug}/${childSlug}` : childSlug;
                  };
                  
                  const handlePrev = isInWorkbook && prevSibling?.slug
                    ? () => {
                        setSlideDirection('left');
                        navigate(`/docs/${category}/${buildPath(prevSibling.slug)}`);
                      }
                    : undefined;
                  
                  const handleNext = isInWorkbook && nextSibling?.slug
                    ? () => {
                        setSlideDirection('right');
                        navigate(`/docs/${category}/${buildPath(nextSibling.slug)}`);
                      }
                    : undefined;
                  
                  // Get page numbers (use index+1 if pageNumber not set)
                  const prevPageNumber = prevSibling ? (prevSibling.pageNumber || String(currentIndex)) : undefined;
                  const nextPageNumber = nextSibling ? (nextSibling.pageNumber || String(currentIndex + 2)) : undefined;
                  
                  // Find menu item to get pdfTranscript - search by SLUG, prefer items WITH pdfTranscript
                  const findMenuItemBySlug = (items: MenuItem[], targetSlug: string): MenuItem | null => {
                    let matchWithTranscript: MenuItem | null = null;
                    let matchWithoutTranscript: MenuItem | null = null;
                    
                    const search = (searchItems: MenuItem[]) => {
                      for (const item of searchItems) {
                        if (item.slug === targetSlug) {
                          if ((item as any).pdfTranscript) {
                            matchWithTranscript = item;
                          } else if (!matchWithoutTranscript) {
                            matchWithoutTranscript = item;
                          }
                        }
                        if (item.children) {
                          search(item.children);
                        }
                      }
                    };
                    
                    search(items);
                    // Prefer the one WITH pdfTranscript
                    return matchWithTranscript || matchWithoutTranscript;
                  };
                  const menuItemForPage = findMenuItemBySlug(menu, page.slug || '');
                  const pdfTranscriptFromMenu = (menuItemForPage as any)?.pdfTranscript || (page as any).pdfTranscript;
                  
                  
                  return (
                <WorksheetView 
                      key={page.slug}
                  title={page.title}
                  data={(() => {
                    try {
                      // First try to use worksheetData field (from migration import)
                      if ((page as any).worksheetData) {
                        return { ...DEFAULT_WORKSHEET_DATA, ...(page as any).worksheetData };
                      }
                      // Fallback to parsing content as JSON
                      return { ...DEFAULT_WORKSHEET_DATA, ...JSON.parse(page.content || '{}') };
                    } catch {
                      return DEFAULT_WORKSHEET_DATA;
                    }
                  })()}
                      onPrev={handlePrev}
                      onNext={handleNext}
                      prevPageNumber={prevPageNumber}
                      nextPageNumber={nextPageNumber}
                      showNavigation={isInWorkbook}
                      slideDirection={slideDirection}
                      pdfTranscript={pdfTranscriptFromMenu}
                    />
                  );
                })()
              ) : page.documentType === 'workbook' ? (
                <WorkbookView 
                  title={page.title}
                  data={(() => {
                    try {
                      return { ...DEFAULT_WORKBOOK_DATA, ...JSON.parse(page.content || '{}') };
                    } catch {
                      return DEFAULT_WORKBOOK_DATA;
                    }
                  })()}
                  pages={(() => {
                    // Find current menu item and get its children
                    const findMenuItem = (items: MenuItem[], targetSlug: string): MenuItem | null => {
                      for (const item of items) {
                        if (item.slug === targetSlug) return item;
                        if (item.children) {
                          const found = findMenuItem(item.children, targetSlug);
                          if (found) return found;
                        }
                      }
                      return null;
                    };
                    // Extract last part of slug to find menu item
                    const pageSlug = slug?.includes('/') ? slug.split('/').pop() || slug : slug;
                    const currentMenuItem = findMenuItem(menu, pageSlug || '');
                    return (currentMenuItem?.children || []).map((child, index) => ({
                      id: child.id,
                      label: child.label,
                      slug: child.slug,
                      pageNumber: (child as any).pageNumber || String(index + 1)
                    }));
                  })()}
                  category={category || ''}
                  workbookSlug={slug || ''}
                />
              ) : (page.featuredMedia || (page.sectionImages && page.sectionImages.length > 0)) ? (
                // Layout with featured media or section images - two columns
                <div>
                  {/* Page title at top */}
                  <div className={`mb-8 md:mb-12 ${readerMode ? 'text-center mx-auto' : ''}`}>
                    <div className={`flex items-start justify-between gap-4 mb-4 md:mb-0 ${readerMode ? 'justify-center' : ''}`}>
                      <div className="flex-1 min-w-0">
                        {page.documentType && (
                          (() => {
                            const type = DOCUMENT_TYPES.find(t => t.id === page.documentType);
                            if (!type) return null;
                            const Icon = type.icon;
                            return (
                              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4 border ${type.bgColor} ${type.color} ${type.borderColor} ${readerMode ? 'mx-auto' : ''}`}>
                                <Icon className="w-4 h-4" />
                                <span className="text-sm font-medium">{type.label}</span>
                              </div>
                            );
                          })()
                        )}
                        <h1 
                          className={`${
                            readerMode 
                              ? 'text-4xl md:text-6xl leading-relaxed py-12 md:py-16' 
                              : 'text-2xl md:text-4xl mb-2'
                          } break-words`} 
                          style={{ fontFamily: "'Cooper Light', serif", fontWeight: 300 }}
                        >
                          {page.title}
                        </h1>
                        {page.description && (
                          <p className={`text-muted-foreground ${readerMode ? 'text-xl' : 'text-sm md:text-base'}`}>{page.description}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className={`flex flex-col lg:flex-row gap-6 md:gap-8 ${readerMode ? 'justify-center' : ''}`}>
                    {/* Left column - Main content */}
                    <article 
                      className={`min-w-0 ${
                        readerMode 
                          ? 'flex-1 text-2xl leading-relaxed' // Equal width and larger text in reader mode
                          : videoExpanded ? 'lg:w-[40%]' : 'lg:w-[60%]'
                      } shrink-0`} 
                      ref={contentRef}
                    >
                      {/* Mobile: Show content with inline section media */}
                      <div className="lg:hidden">
                        <ContentWithMedia 
                          content={page.content} 
                          sectionMedia={page.sectionImages || []} 
                        />
                      </div>
                      
                      {/* Desktop: Show regular content without inline media */}
                      <div className="hidden lg:block">
                        <HtmlRenderer content={page.content} readerMode={readerMode} hideMethodology={isStudentMode} />
                      </div>
                    </article>

                    {/* Right column - Featured media + TOC + Section images */}
                    <div className={`${
                      readerMode 
                        ? 'flex-1' 
                        : videoExpanded ? 'lg:w-[60%]' : 'lg:w-[40%]'
                    } shrink-0 space-y-4`}>
                      
                      {!readerMode && page.featuredMedia && (
                        <button
                          onClick={() => setVideoExpanded(!videoExpanded)}
                          className="hidden lg:flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-all"
                        >
                          {videoExpanded ? (
                            <>
                              <Minimize2 className="h-4 w-4" />
                              Zmenšit
                            </>
                          ) : (
                            <>
                              <Maximize2 className="h-4 w-4" />
                              Zvětšit
                            </>
                          )}
                        </button>
                      )}

                      {/* Featured media - scrolls with page */}
                      {page.featuredMedia && (
                        <div className="rounded-lg overflow-hidden border border-border bg-card print:border-gray-300 shadow-sm">
                          {page.featuredMedia.includes('youtube.com') || page.featuredMedia.includes('youtu.be') ? (
                            <>
                              <div className="relative w-full print:hidden" style={{ paddingBottom: '56.25%' }}>
                                <iframe
                                  className="absolute top-0 left-0 w-full h-full"
                                  src={page.featuredMedia.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')}
                                  title={page.title}
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                />
                              </div>
                              <PrintQRCode url={page.featuredMedia} title={`Video: ${page.title}`} size={100} />
                            </>
                          ) : page.featuredMedia.includes('loom.com') ? (
                            <>
                              <div className="relative w-full print:hidden" style={{ paddingBottom: '56.25%' }}>
                                <iframe
                                  className="absolute top-0 left-0 w-full h-full"
                                  src={page.featuredMedia.replace('/share/', '/embed/')}
                                  title={page.title}
                                  allowFullScreen
                                />
                              </div>
                              <PrintQRCode url={page.featuredMedia} title={`Loom video: ${page.title}`} size={100} />
                            </>
                          ) : page.featuredMedia.match(/\.(mp4|webm|ogg)$/i) ? (
                            <>
                              <video controls className="w-full print:hidden">
                                <source src={page.featuredMedia} />
                                Your browser does not support the video tag.
                              </video>
                              <PrintQRCode url={page.featuredMedia} title={`Video soubor: ${page.title}`} size={100} />
                            </>
                          ) : (
                            <img 
                              src={page.featuredMedia} 
                              alt={page.title}
                              className="w-full h-auto"
                            />
                          )}
                        </div>
                      )}

                      {/* Sticky container for TOC and section images */}
                      <div className={`sticky top-4 space-y-4`}>
                        {/* Table of Contents - with max height and scroll, expands on hover */}
                        {!readerMode && page?.showTOC !== false && (
                          <div 
                            ref={tocScrollContainerRef}
                            className={`
                              hidden lg:block overflow-y-auto transition-all duration-300 pb-4
                              max-h-[200px] hover:max-h-[500px]
                            `}
                            onMouseEnter={() => setMenuHovered(true)}
                            onMouseLeave={() => setMenuHovered(false)}
                          >
                            <TableOfContents contentRef={contentRef} scrollContainerRef={tocScrollContainerRef} />
                          </div>
                        )}

                        {/* Active section media - card flip effect */}
                        {activeMediaItem && (
                          <div className={`rounded-lg overflow-hidden border border-border bg-card print:border-gray-300 perspective-1000 transition-opacity duration-300 mt-[30px] ${
                            menuHovered ? 'opacity-0' : 'opacity-100'
                          }`}>
                            <div className={`transition-all duration-300 ${
                                imageTransition 
                                  ? 'opacity-0 translate-x-8' 
                                  : 'opacity-100 translate-x-0'
                              }`}>
                              
                              {activeMediaItem.type === 'lottie' && activeMediaItem.lottieConfig ? (
                                <div className={
                                  readerMode 
                                    ? 'w-full max-w-4xl mx-auto' 
                                    : videoExpanded 
                                      ? 'w-full mx-auto' 
                                      : 'w-full h-auto'
                                }>
                                  <LottieSequencePlayer
                                    introUrl={activeMediaItem.lottieConfig.introUrl}
                                    steps={activeMediaItem.lottieConfig.steps}
                                    shouldLoop={activeMediaItem.lottieConfig.shouldLoop}
                                    autoplay={activeMediaItem.lottieConfig.autoplay}
                                    backgroundImage={activeMediaItem.lottieConfig.backgroundImage}
                                  />
                                </div>
                              ) : (
                                <img 
                                  key={activeMediaItem.imageUrl}
                                  src={activeMediaItem.imageUrl} 
                                  alt={`Illustration for ${activeMediaItem.heading}`}
                                  className={`${
                                    readerMode 
                                      ? 'max-h-[85vh] w-auto mx-auto object-contain' 
                                      : videoExpanded 
                                        ? 'max-h-[calc(100vh-240px)] w-auto mx-auto object-contain' 
                                        : 'w-full h-auto'
                                  }`}
                                />
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                // Default layout without featured media
                <div className={`flex gap-8 ${readerMode ? 'justify-center' : ''}`}>
                  <article className={`flex-1 ${readerMode ? 'max-w-4xl text-2xl leading-relaxed' : 'max-w-3xl'}`} ref={contentRef}>
                    <div className="mb-8 md:mb-12">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h1 
                            className={`${
                              readerMode 
                                ? 'text-4xl md:text-6xl leading-relaxed py-12 md:py-16' 
                                : 'text-2xl md:text-4xl mb-2'
                            } break-words`} 
                            style={{ fontFamily: "'Cooper Light', serif", fontWeight: 300 }}
                          >
                            {page.title}
                          </h1>
                          {page.description && (
                            <p className={`text-muted-foreground ${readerMode ? 'text-xl' : 'text-sm md:text-base'}`}>{page.description}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <HtmlRenderer content={page.content} readerMode={readerMode} hideMethodology={isStudentMode} />
                  </article>

                  {/* Right Sidebar - Table of Contents */}
                  {!readerMode && page?.showTOC !== false && (
                    <aside className="hidden lg:block w-56 shrink-0">
                      <div className="sticky top-20">
                        <TableOfContents contentRef={contentRef} scrollContainerRef={tocScrollContainerRef} />
                      </div>
                    </aside>
                  )}
                </div>
              )
            ) : (
              <CategoryOverview 
                category={activeCategory} 
                isAdmin={false} 
                folderSlug={slug} 
                viewMode={effectiveViewMode}
                preloadedMenu={menu}
                isStudentMode={isStudentMode}
              />
            )}
          </div>
        </main>

      </div>

      {/* Right Sidebar - AI Chat Panel */}
      {showTeachMeChat && page && (
        <div 
          style={{
            position: 'fixed',
            top: classroomShare.state.isSharing ? '40px' : 0,
            right: 0,
            bottom: 0,
            width: '360px',
            maxWidth: '100vw',
            zIndex: 99999,
            backgroundColor: '#1e1b4b',
            borderLeft: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            overflow: 'hidden'
          }}
        >
           <TeachMeChat
              documentId={page.id}
              ragDocumentId={ragState.documentId}
              documentTitle={page.title}
              subject={activeCategory || 'obecné'}
              grade="6"
              topic={page.title}
                onClose={handleCloseChat}
                mode="panel"
                documentContent={page.content}
             />
            </div>
        )}

      {/* Right Sidebar - Share Panel (Connect Students) */}
      {showSharePanel && (
        <div 
          style={{
            position: 'fixed',
            top: classroomShare.state.isSharing ? '40px' : 0,
            right: 0,
            bottom: 0,
            width: '360px',
            maxWidth: '100vw',
            zIndex: 99999,
            backgroundColor: '#4a5568',
            borderLeft: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            overflow: 'hidden'
          }}
        >
          <FirebaseTeacherPanel
            isOpen={true}
            onClose={handleCloseSharePanel}
            documentTitle={page?.title || activeCategory || 'Dokument'}
            documentPath={window.location.pathname}
          />
        </div>
      )}

      {/* Right Sidebar - Document Share Panel */}
      {showDocSharePanel && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: '360px',
            maxWidth: '100vw',
            zIndex: 99999,
            backgroundColor: '#4a5568',
            borderLeft: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            overflow: 'hidden'
          }}
        >
          {/* Header */}
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LinkIcon className="w-5 h-5 text-white/70" />
              <span className="font-semibold text-white">Sdílet dokument</span>
            </div>
            <button 
              onClick={handleCloseDocSharePanel} 
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* QR Code */}
            <div className="flex flex-col items-center">
              <div className="bg-white p-4 rounded-xl">
                <QRCodeSVG 
                  value={`${window.location.origin}${window.location.pathname}${docShareLocked ? '?s=v1' : ''}`}
                  size={180}
                  level="M"
                />
              </div>
              <p className="text-white/60 text-sm mt-3 text-center">
                Naskenujte QR kód pro otevření dokumentu
              </p>
            </div>

            {/* Link display */}
            <div>
              <label className="text-white/70 text-sm mb-2 block">Odkaz</label>
              <div className="bg-slate-600/50 rounded-xl p-3 break-all text-white/90 text-sm">
                {`${window.location.origin}${window.location.pathname}${docShareLocked ? '?s=v1' : ''}`}
              </div>
            </div>

            {/* Copy button */}
            <button
              onClick={async () => {
                const url = `${window.location.origin}${window.location.pathname}${docShareLocked ? '?s=v1' : ''}`;
                
                // If this is my-content, save to Supabase for sharing
                if (isMyContent && page) {
                  toast.loading('Připravuji sdílení...');
                  const result = await saveSharedDocument({
                    id: page.id,
                    title: page.title,
                    content: page.content,
                    description: page.description,
                    document_type: page.documentType || 'lesson',
                    featured_media: page.featuredMedia,
                    section_images: page.sectionImages,
                    slug: page.slug,
                    show_toc: page.showTOC,
                  });
                  toast.dismiss();
                  
                  if (!result.success) {
                    toast.error('Nepodařilo se připravit sdílení: ' + (result.error || 'Neznámá chyba'));
                    return;
                  }
                }
                
                navigator.clipboard.writeText(url);
                toast.success('Odkaz zkopírován!');
              }}
              className="w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 text-white bg-orange-500 hover:bg-orange-600 transition-colors"
            >
              <Copy className="w-5 h-5" />
              Kopírovat odkaz
            </button>

            {/* Settings */}
            <div className="space-y-4">
              <h3 className="text-white font-semibold">Nastavení</h3>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white">Zamknutý mód</p>
                  <p className="text-white/50 text-sm">Bez menu, vyhledávání a akcí</p>
                </div>
                <div
                  onClick={() => setDocShareLocked(!docShareLocked)}
                  style={{ 
                    width: '48px',
                    height: '28px',
                    borderRadius: '14px',
                    backgroundColor: docShareLocked ? '#10b981' : '#64748b',
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                >
                  <div 
                    style={{ 
                      position: 'absolute',
                      top: '4px',
                      width: '20px',
                      height: '20px',
                      backgroundColor: 'white',
                      borderRadius: '50%',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                      transition: 'left 0.2s, right 0.2s',
                      right: docShareLocked ? '4px' : 'auto',
                      left: docShareLocked ? 'auto' : '4px'
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Right Sidebar - AI Assistant Panel */}
      {showAIPanel && (
        <div 
          style={{
            position: 'fixed',
            top: classroomShare.state.isSharing ? '40px' : 0,
            right: 0,
            bottom: 0,
            left: aiPanelFullscreen ? 0 : 'auto',
            width: aiPanelFullscreen ? '100%' : '400px',
            maxWidth: '100vw',
            zIndex: 99999,
            backgroundColor: 'var(--background)',
            borderLeft: aiPanelFullscreen ? 'none' : '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: aiPanelFullscreen ? 'none' : '-4px 0 24px rgba(0, 0, 0, 0.1)',
            transition: 'width 0.3s ease, left 0.3s ease'
          }}
        >
          {/* AI Panel Header */}
          <div className="flex items-center justify-between p-4 border-b border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-400 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-amber-900">AI asistent</span>
              {/* Context indicator */}
              {(page || slug || activeCategory) && !isLibraryHomepage && (
                <span className="text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full ml-2">
                  {(() => {
                    // Find the actual folder name from menu - search by ID first
                    let title = page?.title;
                    if (!title && slug) {
                      const slugParts = slug.split('/');
                      const lastSlugPart = slugParts[slugParts.length - 1];
                      
                      const findMenuItem = (items: MenuItem[]): MenuItem | null => {
                        for (const item of items) {
                          if (item.id === lastSlugPart || 
                              item.id === slug ||
                              item.slug === slug || 
                              item.slug === lastSlugPart) {
                            return item;
                          }
                          if (item.children) {
                            const found = findMenuItem(item.children);
                            if (found) return found;
                          }
                        }
                        return null;
                      };
                      const menuItem = findMenuItem(menu);
                      title = menuItem?.label;
                    }
                    title = title || activeCategory;
                    return title && title.length > 25 ? title.substring(0, 25) + '...' : title;
                  })()}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setAIPanelFullscreen(!aiPanelFullscreen)}
                className="p-2 rounded-lg hover:bg-amber-100 transition-colors text-amber-600 hover:text-amber-800"
                title={aiPanelFullscreen ? "Zmenšit" : "Na celou obrazovku"}
              >
                {aiPanelFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                onClick={handleCloseAIPanel}
                className="p-2 rounded-lg hover:bg-amber-100 transition-colors text-amber-600 hover:text-amber-800"
                title="Zavřít"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* AI Panel Content */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <TeacherAssistant 
              onClose={handleCloseAIPanel} 
              mode="sidebar" 
              context={{
                category: activeCategory,
                page: page ? { id: page.id, title: page.title, slug: page.slug } : undefined,
                path: location.pathname,
                currentSlug: slug,
                folderTitle: (() => {
                  // Find the actual folder name from menu - search by ID first, then slug
                  if (!slug) return undefined;
                  const slugParts = slug.split('/');
                  const lastSlugPart = slugParts[slugParts.length - 1];
                  
                  const findMenuItem = (items: MenuItem[]): MenuItem | null => {
                    for (const item of items) {
                      // Match by ID first (most reliable), then by slug
                      if (item.id === lastSlugPart || 
                          item.id === slug ||
                          item.slug === slug || 
                          item.slug === lastSlugPart) {
                        return item;
                      }
                      if (item.children) {
                        const found = findMenuItem(item.children);
                        if (found) return found;
                      }
                    }
                    return null;
                  };
                  const menuItem = findMenuItem(menu);
                  console.log('[AI Panel] Looking for:', lastSlugPart, 'Found:', menuItem?.label);
                  return menuItem?.label || undefined;
                })()
              }}
            />
          </div>
        </div>
      )}

      {/* Search Modal */}
      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} contentType={isMyContent ? 'my-content' : 'library'} />
      
      {/* Teacher sharing top bar - fixed at very top */}
      {classroomShare.state.isSharing && classroomShare.state.currentSession && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: '40px',
            backgroundColor: '#dc2626',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            zIndex: 999999,
            fontSize: '14px',
            fontWeight: 500,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ position: 'relative' }}>
              <div style={{ width: '10px', height: '10px', backgroundColor: 'white', borderRadius: '50%' }} />
              <div style={{ 
                position: 'absolute', 
                inset: 0, 
                width: '10px', 
                height: '10px', 
                backgroundColor: 'white', 
                borderRadius: '50%',
                animation: 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite'
              }} />
            </div>
            <span>ŽIVĚ</span>
          </div>
          <span>|</span>
          <span>Sdílím: {classroomShare.state.currentSession.className}</span>
          <button
            onClick={handleOpenSharePanel}
            style={{
              marginLeft: '16px',
              padding: '4px 12px',
              backgroundColor: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '6px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            Panel
          </button>
        </div>
      )}
      
      {/* Global style for ping animation */}
      <style>{`
        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
      `}</style>

      {/* NPS Popup - shows every 30 days for teachers */}
      <NPSPopup
        isOpen={showNPS}
        onClose={() => {
          dismissNPS();
        }}
        onSubmit={async (score, feedback) => {
          await submitNPS(score, feedback);
        }}
      />

      {/* Lightbox galerie */}
      {lightboxOpen && lightboxImages.length > 0 && (
        <div 
          className="fixed inset-0 z-[9999] flex"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.95)' }}
          onClick={() => setLightboxOpen(false)}
        >
          {/* Hlavní obrázek */}
          <div className="flex-1 flex items-center justify-center p-8" onClick={(e) => e.stopPropagation()}>
            <div className="relative max-w-full max-h-full">
              <img 
                src={lightboxImages[lightboxIndex]?.url} 
                alt={lightboxImages[lightboxIndex]?.title}
                className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
              />
              <p className="text-white text-center mt-4 text-lg">
                {lightboxImages[lightboxIndex]?.title}
              </p>
            </div>
            
            {/* Navigační šipky */}
            {lightboxImages.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex(prev => prev > 0 ? prev - 1 : lightboxImages.length - 1); }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full text-white hover:bg-white/20 transition-colors"
                  style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                >
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex(prev => prev < lightboxImages.length - 1 ? prev + 1 : 0); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full text-white hover:bg-white/20 transition-colors"
                  style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                >
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              </>
            )}
          </div>
          
          {/* Boční panel s miniaturami */}
          <div 
            className="w-48 bg-black/50 overflow-y-auto p-3 space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-white/60 text-xs mb-2 text-center">
              {lightboxIndex + 1} / {lightboxImages.length}
            </div>
            {lightboxImages.map((img, idx) => (
              <div
                key={idx}
                onClick={() => setLightboxIndex(idx)}
                className={`cursor-pointer rounded-lg overflow-hidden transition-all ${
                  idx === lightboxIndex ? 'ring-2 ring-white scale-105' : 'opacity-60 hover:opacity-100'
                }`}
              >
                <img 
                  src={img.url} 
                  alt={img.title}
                  className="w-full h-24 object-cover"
                />
                <p className="text-white text-xs p-1 truncate bg-black/50">{img.title}</p>
              </div>
            ))}
          </div>
          
          {/* Zavřít tlačítko */}
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-56 p-2 rounded-full text-white hover:bg-white/20 transition-colors"
            style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
