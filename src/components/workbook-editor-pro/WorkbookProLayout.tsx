/**
 * WorkbookProLayout - Hlavní layout pro Workbook Pro editor
 * 
 * Figma-style editor pro správu pracovních sešitů.
 * Nekonečné plátno s dvojstránkami, klik otevře editor listu.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import {
  BookOpen,
  Plus,
  Settings,
  ArrowLeft,
  Loader2,
  Check,
  ChevronRight,
  Trash2,
  MousePointer2,
  PanelLeftClose,
  PanelLeft,
  Image,
  LayoutGrid,
} from 'lucide-react';
import { toast } from 'sonner';

import { InfiniteCanvas } from './InfiniteCanvas';
import { WorkbookSpread } from './WorkbookSpread';
import { ChapterItem, ITEM_TYPES } from './ChapterItem';
import {
  Workbook,
  WorkbookPage,
  WorkbookChapter,
  WorkbookSpread as SpreadType,
  createEmptyWorkbook,
  createSpreadsFromPages,
  CHAPTER_COLORS,
  getChapterForPage,
  getChapterStartingAtPage,
} from '../../types/workbook';
import { Worksheet, createEmptyWorksheet } from '../../types/worksheet';

interface WorkbookProLayoutProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

type ViewMode = 'canvas' | 'covers' | 'settings';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Generuje demo data pro testování
 */
function generateDemoWorkbook(id: string): Workbook {
  const worksheets: { [id: string]: Worksheet } = {};
  const pages: WorkbookPage[] = [];
  const chapters: WorkbookChapter[] = [
    { id: 'chapter-1', title: 'Úvod do zlomků', color: CHAPTER_COLORS[0], order: 1 },
    { id: 'chapter-2', title: 'Sčítání a odčítání', color: CHAPTER_COLORS[1], order: 2 },
    { id: 'chapter-3', title: 'Násobení a dělení', color: CHAPTER_COLORS[2], order: 3 },
  ];
  
  // Vytvořit demo worksheets a pages
  const worksheetTitles = [
    'Co je to zlomek?',
    'Čitatel a jmenovatel',
    'Krácení zlomků',
    'Rozšiřování zlomků',
    'Sčítání zlomků',
    'Odčítání zlomků',
    'Slovní úlohy I',
    'Násobení zlomků',
    'Dělení zlomků',
    'Smíšená čísla',
    'Opakování',
    'Test',
  ];
  
  worksheetTitles.forEach((title, index) => {
    const wsId = `ws-${index + 1}`;
    const chapterIndex = index < 4 ? 0 : index < 7 ? 1 : 2;
    
    worksheets[wsId] = {
      ...createEmptyWorksheet(wsId),
      title,
      subtitle: chapters[chapterIndex].title,
      blocks: [
        {
          id: `block-${index}-1`,
          type: 'title',
          content: { text: title },
          settings: {},
        },
        {
          id: `block-${index}-2`,
          type: 'text',
          content: { text: 'Lorem ipsum dolor sit amet...' },
          settings: {},
        },
        {
          id: `block-${index}-3`,
          type: 'task',
          content: { text: 'Úloha 1: Vyřešte následující příklad.' },
          settings: { taskNumber: 1 },
        },
        {
          id: `block-${index}-4`,
          type: 'lines',
          content: {},
          settings: { lineCount: 4 },
        },
      ],
    };
    
    // Nastav startsChapterId pouze na první stránku každé kapitoly
    const isFirstPageOfChapter = 
      index === 0 || // První stránka = první kapitola
      (index === 4 && chapterIndex === 1) || // Stránka 5 = začátek druhé kapitoly
      (index === 7 && chapterIndex === 2);   // Stránka 8 = začátek třetí kapitoly
    
    pages.push({
      id: `page-${index + 1}`,
      pageNumber: index + 1,
      worksheetId: wsId,
      worksheetPageIndex: 0,
      startsChapterId: isFirstPageOfChapter ? chapters[chapterIndex].id : undefined,
    });
  });
  
  return {
    id,
    title: 'Pracovní sešit - Zlomky',
    description: 'Kompletní pracovní sešit pro výuku zlomků',
    pages,
    chapters,
    worksheets,
    settings: {
      pageFormat: 'a4',
      orientation: 'portrait',
      margins: { top: 20, bottom: 20, left: 20, right: 20 },
      showPageNumbers: true,
      showChapterColors: true,
      pageLimit: 45,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function WorkbookProLayout({ theme, toggleTheme }: WorkbookProLayoutProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // State
  const [workbook, setWorkbook] = useState<Workbook>(() => 
    generateDemoWorkbook(id || 'demo-workbook')
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [viewMode, setViewMode] = useState<ViewMode>('canvas');
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [hoveredChapterId, setHoveredChapterId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [canvasZoom, setCanvasZoom] = useState(0.8); // Track zoom for fixed-size badges
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [newChapterDialog, setNewChapterDialog] = useState<{ open: boolean; fromPage: number }>({ open: false, fromPage: 1 });
  const [newChapterTitle, setNewChapterTitle] = useState('');
  
  // Chapter drag & color state
  const [draggingChapterId, setDraggingChapterId] = useState<string | null>(null);
  const [chapterDropTargetId, setChapterDropTargetId] = useState<string | null>(null);
  const [editingChapterColor, setEditingChapterColor] = useState<string | null>(null);
  
  // Selection & Drag state
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [draggedPages, setDraggedPages] = useState<number[]>([]);
  const [dropTarget, setDropTarget] = useState<{ type: 'position' | 'chapter'; value: number | string } | null>(null);
  
  // Lasso state
  const [isLassoActive, setIsLassoActive] = useState(false);
  const [lassoStart, setLassoStart] = useState<{ x: number; y: number } | null>(null);
  const [lassoEnd, setLassoEnd] = useState<{ x: number; y: number } | null>(null);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  
  // Track Space key for lasso vs pan conflict resolution
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') setIsSpacePressed(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setIsSpacePressed(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);
  
  // Vytvoř spreads z pages
  const spreads = useMemo(
    () => createSpreadsFromPages(workbook.pages),
    [workbook.pages]
  );
  
  // Handlers
  const handleSave = useCallback(async () => {
    setSaveStatus('saving');
    
    // TODO: Supabase save
    // Viz TODOSUPABASE.md
    
    await new Promise(resolve => setTimeout(resolve, 500));
    setSaveStatus('saved');
    
    setTimeout(() => setSaveStatus('idle'), 2000);
  }, []);
  
  // Autosave - ukládá při změnách workbooku
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstRender = useRef(true);
  
  useEffect(() => {
    // Přeskočit první renderování
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    
    // Debounce autosave - 1.5 sekundy po poslední změně
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }
    
    autosaveTimeoutRef.current = setTimeout(() => {
      handleSave();
    }, 1500);
    
    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [workbook, handleSave]);
  
  // Blokovat opuštění editoru během ukládání
  const handleBack = useCallback(() => {
    if (saveStatus === 'saving') {
      toast.warning('Počkejte, probíhá ukládání...');
      return;
    }
    navigate(-1);
  }, [navigate, saveStatus]);
  
  // Blokovat beforeunload během ukládání
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saveStatus === 'saving') {
        e.preventDefault();
        e.returnValue = 'Probíhá ukládání, opravdu chcete odejít?';
        return e.returnValue;
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveStatus]);
  
  const handleEditPage = useCallback((pageId: string, worksheetId: string) => {
    // Otevři worksheet editor pro daný list s formátem z workbooku a ID workbooku pro navigaci zpět
    navigate(`/admin/worksheet-pro/${worksheetId}?offline=1&pageFormat=${workbook.settings.pageFormat}&workbookId=${workbook.id}`);
  }, [navigate, workbook.settings.pageFormat, workbook.id]);
  
  const handleRemovePage = useCallback((pageId: string) => {
    setWorkbook(prev => ({
      ...prev,
      pages: prev.pages
        .filter(p => p.id !== pageId)
        .map((p, i) => ({ ...p, pageNumber: i + 1 })),
      updatedAt: new Date().toISOString(),
    }));
    toast.success('Stránka odstraněna');
  }, []);
  
  const handleCopyPage = useCallback((pageId: string) => {
    const pageToCopy = workbook.pages.find(p => p.id === pageId);
    if (!pageToCopy) return;
    
    const newPage: WorkbookPage = {
      ...pageToCopy,
      id: `page-${Date.now()}`,
      pageNumber: workbook.pages.length + 1,
    };
    
    setWorkbook(prev => ({
      ...prev,
      pages: [...prev.pages, newPage],
      updatedAt: new Date().toISOString(),
    }));
    toast.success('Stránka zkopírována');
  }, [workbook.pages]);
  
  const handleAddPage = useCallback(() => {
    // Vytvořit nový worksheet a přidat jako stránku
    const newWsId = `ws-new-${Date.now()}`;
    const newWorksheet = createEmptyWorksheet(newWsId);
    
    const newPage: WorkbookPage = {
      id: `page-${Date.now()}`,
      pageNumber: workbook.pages.length + 1,
      worksheetId: newWsId,
      worksheetPageIndex: 0,
    };
    
    setWorkbook(prev => ({
      ...prev,
      pages: [...prev.pages, newPage],
      worksheets: { ...prev.worksheets, [newWsId]: newWorksheet },
      updatedAt: new Date().toISOString(),
    }));
    
    // Rovnou otevři editor s formátem z workbooku a ID workbooku pro navigaci zpět
    navigate(`/admin/worksheet-pro/${newWsId}?offline=1&pageFormat=${workbook.settings.pageFormat}&workbookId=${workbook.id}`);
  }, [workbook.pages, navigate, workbook.settings.pageFormat]);
  
  const handleEditCover = useCallback(() => {
    toast.info('Editor obálky - TODO');
  }, []);
  
  const handleToggleChapterColors = useCallback(() => {
    setWorkbook(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        showChapterColors: !prev.settings.showChapterColors,
      },
    }));
  }, []);
  
  // === LASSO SELECTION LOGIC ===
  
  // Start lasso on mousedown on empty canvas area
  const handleLassoStart = useCallback((e: React.MouseEvent) => {
    // Only start lasso if clicking on empty area (not on a page)
    const target = e.target as HTMLElement;
    if (target.closest('[data-page]')) return;
    if (target.closest('button')) return; // Don't start on buttons
    if (e.button !== 0) return; // Only left click
    if (isSpacePressed) return; // Don't interfere with pan mode
    
    const container = canvasContainerRef.current;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setIsLassoActive(true);
    setLassoStart({ x, y });
    setLassoEnd({ x, y });
  }, [isSpacePressed]);
  
  // Update lasso on mousemove
  const handleLassoMove = useCallback((e: React.MouseEvent) => {
    if (!isLassoActive || !lassoStart) return;
    
    const container = canvasContainerRef.current;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setLassoEnd({ x, y });
  }, [isLassoActive, lassoStart]);
  
  // End lasso and select pages within rectangle
  const handleLassoEnd = useCallback(() => {
    if (!isLassoActive || !lassoStart || !lassoEnd) {
      setIsLassoActive(false);
      return;
    }
    
    const container = canvasContainerRef.current;
    if (!container) {
      setIsLassoActive(false);
      return;
    }
    
    // Calculate lasso rectangle in screen coordinates
    const lassoRect = {
      left: Math.min(lassoStart.x, lassoEnd.x),
      right: Math.max(lassoStart.x, lassoEnd.x),
      top: Math.min(lassoStart.y, lassoEnd.y),
      bottom: Math.max(lassoStart.y, lassoEnd.y),
    };
    
    // Only select if lasso is larger than 10px (prevent accidental clicks)
    const lassoWidth = lassoRect.right - lassoRect.left;
    const lassoHeight = lassoRect.bottom - lassoRect.top;
    
    if (lassoWidth > 10 && lassoHeight > 10) {
      // Find all page elements and check intersection
      const containerRect = container.getBoundingClientRect();
      const pageElements = container.querySelectorAll('[data-page]');
      const newSelectedPages = new Set<number>();
      
      pageElements.forEach((el) => {
        const pageNum = parseInt(el.getAttribute('data-page') || '0', 10);
        if (!pageNum) return;
        
        const pageRect = el.getBoundingClientRect();
        // Convert to container-relative coordinates
        const pageLeft = pageRect.left - containerRect.left;
        const pageRight = pageRect.right - containerRect.left;
        const pageTop = pageRect.top - containerRect.top;
        const pageBottom = pageRect.bottom - containerRect.top;
        
        // Check if page overlaps with lasso
        const overlaps = !(
          pageRight < lassoRect.left ||
          pageLeft > lassoRect.right ||
          pageBottom < lassoRect.top ||
          pageTop > lassoRect.bottom
        );
        
        if (overlaps) {
          newSelectedPages.add(pageNum);
        }
      });
      
      setSelectedPages(newSelectedPages);
    } else {
      // Small lasso = click on empty space = clear selection
      setSelectedPages(new Set());
    }
    
    setIsLassoActive(false);
    setLassoStart(null);
    setLassoEnd(null);
  }, [isLassoActive, lassoStart, lassoEnd]);
  
  // Calculate lasso rectangle for display
  const lassoRect = useMemo(() => {
    if (!isLassoActive || !lassoStart || !lassoEnd) return null;
    return {
      left: Math.min(lassoStart.x, lassoEnd.x),
      top: Math.min(lassoStart.y, lassoEnd.y),
      width: Math.abs(lassoEnd.x - lassoStart.x),
      height: Math.abs(lassoEnd.y - lassoStart.y),
    };
  }, [isLassoActive, lassoStart, lassoEnd]);
  
  // === SELECTION & DRAG LOGIC ===
  
  // Toggle page selection (ctrl/cmd click)
  const handlePageSelect = useCallback((pageNum: number, isMultiSelect: boolean) => {
    setSelectedPages(prev => {
      const next = new Set(prev);
      if (isMultiSelect) {
        if (next.has(pageNum)) {
          next.delete(pageNum);
        } else {
          next.add(pageNum);
        }
      } else {
        // Single click - select only this page
        if (next.has(pageNum) && next.size === 1) {
          next.clear(); // Deselect if already selected alone
        } else {
          next.clear();
          next.add(pageNum);
        }
      }
      return next;
    });
  }, []);
  
  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedPages(new Set());
  }, []);
  
  // Start dragging selected pages
  const handleDragStart = useCallback((pageNum: number) => {
    const pages = selectedPages.has(pageNum) 
      ? Array.from(selectedPages) 
      : [pageNum];
    setDraggedPages(pages);
    setIsDragging(true);
  }, [selectedPages]);
  
  // Handle drop on position
  const handleDropOnPosition = useCallback((targetPosition: number) => {
    if (draggedPages.length === 0) return;
    
    // Reorder pages
    const newPages = [...workbook.pages];
    const movedPages = draggedPages
      .map(pn => workbook.pages.find(p => p.pageNumber === pn))
      .filter(Boolean) as WorkbookPage[];
    
    // Remove moved pages from their positions
    draggedPages.forEach(pn => {
      const idx = newPages.findIndex(p => p.pageNumber === pn);
      if (idx !== -1) newPages.splice(idx, 1);
    });
    
    // Find insert position
    let insertIdx = newPages.findIndex(p => p.pageNumber >= targetPosition);
    if (insertIdx === -1) insertIdx = newPages.length;
    
    // Insert moved pages
    newPages.splice(insertIdx, 0, ...movedPages);
    
    // Renumber all pages
    const renumberedPages = newPages.map((p, i) => ({ ...p, pageNumber: i + 1 }));
    
    setWorkbook(prev => ({
      ...prev,
      pages: renumberedPages,
      updatedAt: new Date().toISOString(),
    }));
    
    setIsDragging(false);
    setDraggedPages([]);
    setDropTarget(null);
    clearSelection();
    toast.success(`Přesunuto ${draggedPages.length} stránek`);
  }, [draggedPages, workbook.pages, clearSelection]);
  
  // Handle drop on chapter - nastaví začátek kapitoly na první stránce z výběru
  const handleDropOnChapter = useCallback((chapterId: string) => {
    if (draggedPages.length === 0) return;
    
    const chapter = workbook.chapters.find(c => c.id === chapterId);
    if (!chapter) return;
    
    // Najdi první stránku z výběru (nejnižší číslo)
    const sortedPages = [...draggedPages].sort((a, b) => a - b);
    const firstPageNum = sortedPages[0];
    
    // Nastav startsChapterId na první stránku
    const updatedPages = workbook.pages.map(page => {
      if (page.pageNumber === firstPageNum) {
        return {
          ...page,
          startsChapterId: chapterId,
        };
      }
      return page;
    });
    
    setWorkbook(prev => ({
      ...prev,
      pages: updatedPages,
      updatedAt: new Date().toISOString(),
    }));
    
    setIsDragging(false);
    setDraggedPages([]);
    setDropTarget(null);
    clearSelection();
    toast.success(`Kapitola "${chapter.title}" začíná od stránky ${firstPageNum}`);
  }, [draggedPages, workbook.pages, workbook.chapters, clearSelection]);
  
  // Cancel drag
  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    setDraggedPages([]);
    setDropTarget(null);
  }, []);
  
  // Otevřít dialog pro vytvoření nové kapitoly
  const handleStartChapter = useCallback((fromPageNumber: number) => {
    setNewChapterTitle('');
    setNewChapterDialog({ open: true, fromPage: fromPageNumber });
  }, []);
  
  // Potvrdit vytvoření kapitoly
  const handleConfirmNewChapter = useCallback(() => {
    const title = newChapterTitle.trim();
    if (!title) {
      toast.error('Zadej název kapitoly');
      return;
    }
    
    const fromPageNumber = newChapterDialog.fromPage;
    
    // Vybrat barvu (cyklicky z CHAPTER_COLORS)
    const usedColors = workbook.chapters.map(c => c.color);
    const availableColor = CHAPTER_COLORS.find(c => !usedColors.includes(c)) || CHAPTER_COLORS[workbook.chapters.length % CHAPTER_COLORS.length];
    
    const newChapter: WorkbookChapter = {
      id: `chapter-${Date.now()}`,
      title,
      color: availableColor,
      order: workbook.chapters.length + 1,
    };
    
    // Nastav startsChapterId pouze na stránku kde kapitola začíná
    const updatedPages = workbook.pages.map(page => {
      if (page.pageNumber === fromPageNumber) {
        return {
          ...page,
          startsChapterId: newChapter.id,
        };
      }
      return page;
    });
    
    setWorkbook(prev => ({
      ...prev,
      chapters: [...prev.chapters, newChapter],
      pages: updatedPages,
      updatedAt: new Date().toISOString(),
    }));
    
    setNewChapterDialog({ open: false, fromPage: 1 });
    toast.success(`Kapitola "${title}" vytvořena od stránky ${fromPageNumber}`);
  }, [newChapterTitle, newChapterDialog.fromPage, workbook.chapters, workbook.pages]);
  
  // Smazat kapitolu
  const handleDeleteChapter = useCallback((chapterId: string) => {
    const chapter = workbook.chapters.find(c => c.id === chapterId);
    if (!chapter) return;
    
    // Odeber startsChapterId ze všech stránek
    const updatedPages = workbook.pages.map(page => {
      if (page.startsChapterId === chapterId) {
        return { ...page, startsChapterId: undefined };
      }
      return page;
    });
    
    // Odeber kapitolu ze seznamu
    const updatedChapters = workbook.chapters.filter(c => c.id !== chapterId);
    
    setWorkbook(prev => ({
      ...prev,
      chapters: updatedChapters,
      pages: updatedPages,
      updatedAt: new Date().toISOString(),
    }));
    
    toast.success(`Kapitola "${chapter.title}" smazána`);
  }, [workbook.chapters, workbook.pages]);
  
  // Přeřadit kapitolu (drag & drop)
  const handleChapterDrop = useCallback((draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    
    setWorkbook(prev => {
      const chapters = [...prev.chapters];
      const draggedIndex = chapters.findIndex(c => c.id === draggedId);
      const targetIndex = chapters.findIndex(c => c.id === targetId);
      
      if (draggedIndex === -1 || targetIndex === -1) return prev;
      
      // Získej stránky pro každou kapitolu
      const getChapterPages = (chapterId: string) => {
        return prev.pages
          .filter(p => getChapterForPage(p.pageNumber, prev.pages, prev.chapters)?.id === chapterId)
          .sort((a, b) => a.pageNumber - b.pageNumber);
      };
      
      // Přesuň kapitolu v poli
      const [draggedChapter] = chapters.splice(draggedIndex, 1);
      chapters.splice(targetIndex, 0, draggedChapter);
      
      // Přečísluj stránky podle nového pořadí kapitol
      const reorderedPages: typeof prev.pages = [];
      let pageNum = 1;
      
      // Projdi kapitoly v novém pořadí
      for (const chapter of chapters) {
        const chapterPages = getChapterPages(chapter.id);
        let isFirstInChapter = true;
        
        for (const page of chapterPages) {
          reorderedPages.push({
            ...page,
            pageNumber: pageNum,
            startsChapterId: isFirstInChapter ? chapter.id : undefined,
          });
          isFirstInChapter = false;
          pageNum++;
        }
      }
      
      // Přidej stránky bez kapitoly na konec
      const assignedPageIds = new Set(reorderedPages.map(p => p.id));
      const unassignedPages = prev.pages
        .filter(p => !assignedPageIds.has(p.id))
        .sort((a, b) => a.pageNumber - b.pageNumber);
      
      for (const page of unassignedPages) {
        reorderedPages.push({
          ...page,
          pageNumber: pageNum,
          startsChapterId: undefined,
        });
        pageNum++;
      }
      
      return {
        ...prev,
        chapters,
        pages: reorderedPages,
        updatedAt: new Date().toISOString(),
      };
    });
    
    setDraggingChapterId(null);
    setChapterDropTargetId(null);
    toast.success('Kapitola přesunuta');
  }, []);
  
  // Změnit barvu kapitoly
  const handleChapterColorChange = useCallback((chapterId: string, newColor: string) => {
    setWorkbook(prev => ({
      ...prev,
      chapters: prev.chapters.map(c => 
        c.id === chapterId ? { ...c, color: newColor } : c
      ),
      updatedAt: new Date().toISOString(),
    }));
    setEditingChapterColor(null);
  }, []);
  
  // Dostupné barvy pro kapitoly
  const chapterColors = [
    '#3b82f6', // blue
    '#22c55e', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#f97316', // orange
    '#84cc16', // lime
    '#6366f1', // indigo
  ];
  
  // Vybrat všechny stránky kapitoly
  const handleSelectChapterPages = useCallback((chapterId: string) => {
    const chapter = workbook.chapters.find(c => c.id === chapterId);
    if (!chapter) return;
    
    // Najdi všechny stránky, které patří do této kapitoly
    const chapterPages = new Set<number>();
    
    workbook.pages.forEach(page => {
      const pageChapter = getChapterForPage(page.pageNumber, workbook.pages, workbook.chapters);
      if (pageChapter?.id === chapterId) {
        chapterPages.add(page.pageNumber);
      }
    });
    
    setSelectedPages(chapterPages);
    toast.info(`Vybráno ${chapterPages.size} stránek z kapitoly "${chapter.title}"`);
  }, [workbook.chapters, workbook.pages]);
  
  return (
    <div className="h-screen flex bg-slate-900 text-white overflow-hidden">
      {/* Figma-style left sidebar */}
      {sidebarOpen && (
        <aside 
          className="flex-shrink-0 flex flex-col overflow-hidden"
          style={{ backgroundColor: '#1e293b', width: '320px', borderRight: '1px solid #334155' }}
        >
          {/* Back button + Title + Toggle */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #334155' }}>
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={handleBack}
                disabled={saveStatus === 'saving'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '13px',
                  cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer',
                  opacity: saveStatus === 'saving' ? 0.5 : 1,
                }}
              >
                <ArrowLeft size={14} />
                <span>Zpět</span>
              </button>
              
              <button
                onClick={() => setSidebarOpen(false)}
                style={{
                  padding: '4px',
                  borderRadius: '4px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                }}
                title="Zavřít panel"
              >
                <PanelLeftClose size={16} />
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              <BookOpen size={18} style={{ color: '#10b981', flexShrink: 0 }} />
              <div className="flex-1 min-w-0">
                <h1 style={{ fontSize: '14px', fontWeight: 600, color: '#f1f5f9', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {workbook.title}
                </h1>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    {workbook.pages.length} stran · {workbook.chapters.length} kapitol
                  </span>
                  {saveStatus === 'saving' && (
                    <span style={{ fontSize: '11px', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Loader2 size={10} className="animate-spin" />
                      Ukládám...
                    </span>
                  )}
                  {saveStatus === 'saved' && (
                    <span style={{ fontSize: '11px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Check size={10} />
                      Uloženo
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Navigation tabs - Obsah, Obálka, Nastavení */}
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #334155' }}>
            <div className="flex flex-col gap-1">
              <button
                onClick={() => setViewMode('canvas')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: viewMode === 'canvas' ? '#334155' : 'transparent',
                  color: viewMode === 'canvas' ? '#fff' : '#94a3b8',
                  fontSize: '13px',
                  fontWeight: 500,
                  width: '100%',
                  textAlign: 'left',
                }}
              >
                <LayoutGrid size={16} />
                Obsah
              </button>
              
              <button
                onClick={() => setViewMode('covers')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: viewMode === 'covers' ? '#334155' : 'transparent',
                  color: viewMode === 'covers' ? '#fff' : '#94a3b8',
                  fontSize: '13px',
                  fontWeight: 500,
                  width: '100%',
                  textAlign: 'left',
                }}
              >
                <Image size={16} />
                Obálka
              </button>
              
              <button
                onClick={() => setViewMode('settings')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: viewMode === 'settings' ? '#334155' : 'transparent',
                  color: viewMode === 'settings' ? '#fff' : '#94a3b8',
                  fontSize: '13px',
                  fontWeight: 500,
                  width: '100%',
                  textAlign: 'left',
                }}
              >
                <Settings size={16} />
                Nastavení
              </button>
            </div>
          </div>
          
          {/* Chapters list - when canvas viewMode */}
          {viewMode === 'canvas' && (
            <div className="flex-1 overflow-y-auto">
              <DndProvider backend={HTML5Backend}>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-sm text-slate-300">Kapitoly</h2>
                    <button className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white">
                      <Plus size={16} />
                    </button>
                  </div>
                
                <div>
                  {(() => {
                    // Kapitoly jsou v pořadí jak jsou v poli (uživatel je může přesouvat drag & drop)
                    return workbook.chapters.map((chapter, chapterIndex) => {
                      // Získej stránky v kapitole
                      const chapterPages = workbook.pages
                        .filter(p => getChapterForPage(p.pageNumber, workbook.pages, workbook.chapters)?.id === chapter.id)
                        .sort((a, b) => a.pageNumber - b.pageNumber);
                      
                      const pagesInfo = chapterPages.map(page => ({
                        id: page.id,
                        pageNumber: page.pageNumber,
                        worksheetId: page.worksheetId,
                        worksheetTitle: workbook.worksheets[page.worksheetId]?.title,
                      }));
                      
                      return (
                        <ChapterItem
                          key={chapter.id}
                          id={chapter.id}
                          title={chapter.title}
                          color={chapter.color}
                          index={chapterIndex}
                          pages={pagesInfo}
                          isExpanded={expandedChapters.has(chapter.id)}
                          isHovered={hoveredChapterId === chapter.id}
                          selectedPages={selectedPages}
                          moveChapter={handleChapterDrop}
                          onDelete={handleDeleteChapter}
                          onToggleExpand={() => {
                            setExpandedChapters(prev => {
                              const next = new Set(prev);
                              if (next.has(chapter.id)) {
                                next.delete(chapter.id);
                              } else {
                                next.add(chapter.id);
                              }
                              return next;
                            });
                          }}
                          onHover={(hovered) => setHoveredChapterId(hovered ? chapter.id : null)}
                          onSelectChapterPages={handleSelectChapterPages}
                          onPageSelect={handlePageSelect}
                          onMovePage={(pageNumber, targetChapterId) => {
                            // Přesunout stránku do kapitoly a přečíslovat
                            const chapter = workbook.chapters.find(c => c.id === targetChapterId);
                            if (!chapter) return;
                            
                            setWorkbook(prev => {
                              // Najdi stránku kterou přesouváme
                              const movingPage = prev.pages.find(p => p.pageNumber === pageNumber);
                              if (!movingPage) return prev;
                              
                              // Získej stránky pro každou kapitolu
                              const getChapterPages = (chapterId: string) => {
                                return prev.pages
                                  .filter(p => getChapterForPage(p.pageNumber, prev.pages, prev.chapters)?.id === chapterId)
                                  .filter(p => p.id !== movingPage.id) // Vynech přesouvanou stránku
                                  .sort((a, b) => a.pageNumber - b.pageNumber);
                              };
                              
                              // Přečísluj stránky
                              const reorderedPages: typeof prev.pages = [];
                              let newPageNum = 1;
                              
                              for (const ch of prev.chapters) {
                                const chapterPages = getChapterPages(ch.id);
                                
                                // Pokud je toto cílová kapitola, přidej přesouvanou stránku na konec
                                if (ch.id === targetChapterId) {
                                  // Nejdřív existující stránky kapitoly
                                  let isFirstInChapter = true;
                                  for (const page of chapterPages) {
                                    reorderedPages.push({
                                      ...page,
                                      pageNumber: newPageNum,
                                      startsChapterId: isFirstInChapter ? ch.id : undefined,
                                    });
                                    isFirstInChapter = false;
                                    newPageNum++;
                                  }
                                  // Pak přesouvaná stránka
                                  reorderedPages.push({
                                    ...movingPage,
                                    pageNumber: newPageNum,
                                    startsChapterId: chapterPages.length === 0 ? ch.id : undefined,
                                  });
                                  newPageNum++;
                                } else {
                                  // Normální kapitola
                                  let isFirstInChapter = true;
                                  for (const page of chapterPages) {
                                    reorderedPages.push({
                                      ...page,
                                      pageNumber: newPageNum,
                                      startsChapterId: isFirstInChapter ? ch.id : undefined,
                                    });
                                    isFirstInChapter = false;
                                    newPageNum++;
                                  }
                                }
                              }
                              
                              // Přidej stránky bez kapitoly na konec
                              const assignedPageIds = new Set(reorderedPages.map(p => p.id));
                              const unassignedPages = prev.pages
                                .filter(p => !assignedPageIds.has(p.id))
                                .sort((a, b) => a.pageNumber - b.pageNumber);
                              
                              for (const page of unassignedPages) {
                                reorderedPages.push({
                                  ...page,
                                  pageNumber: newPageNum,
                                  startsChapterId: undefined,
                                });
                                newPageNum++;
                              }
                              
                              return {
                                ...prev,
                                pages: reorderedPages,
                                updatedAt: new Date().toISOString(),
                              };
                            });
                            
                            toast.success(`Stránka přesunuta do kapitoly "${chapter.title}"`);
                          }}
                        />
                      );
                    });
                  })()}
                </div>
              </div>
            </DndProvider>
          </div>
          )}
        </aside>
      )}
      
      {/* Toggle sidebar button when closed */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            zIndex: 50,
            padding: '8px',
            borderRadius: '8px',
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            color: '#94a3b8',
            cursor: 'pointer',
          }}
          title="Otevřít panel"
        >
          <PanelLeft size={18} />
        </button>
      )}
        
      {/* Canvas area */}
        <main 
          ref={canvasContainerRef}
          className="flex-1 relative"
          onMouseDown={viewMode === 'canvas' ? handleLassoStart : undefined}
          onMouseMove={viewMode === 'canvas' ? handleLassoMove : undefined}
          onMouseUp={viewMode === 'canvas' ? handleLassoEnd : undefined}
          onMouseLeave={viewMode === 'canvas' ? handleLassoEnd : undefined}
        >
          {/* Lasso selection overlay */}
          {lassoRect && (
            <div
              style={{
                position: 'absolute',
                left: lassoRect.left,
                top: lassoRect.top,
                width: lassoRect.width,
                height: lassoRect.height,
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                border: '2px solid #3b82f6',
                borderRadius: '4px',
                pointerEvents: 'none',
                zIndex: 1000,
              }}
            />
          )}
          
          {viewMode === 'canvas' ? (
            <InfiniteCanvas showControls={true} onCanvasStateChange={(state) => setCanvasZoom(state.zoom)}>
              {/* Workbook content - centered container */}
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center',
                transform: 'translateX(-50%)',
              }}>
                {/* Page spreads grid - 3 items per row with chapter breaks */}
                {/* Layout: Page 1 (single), then spreads 2-3, 4-5, 6-7, etc., ending with single page if even total */}
                {(() => {
                  const totalPages = workbook.settings.pageLimit;
                  
                  // Build items: first page single, then spreads, last page single if even
                  type SpreadItem = { 
                    type: 'single'; 
                    pageNum: number;
                    chapterId?: string;
                    startsNewChapter: boolean;
                    chapterInfo?: { id: string; title: string; color: string };
                  } | { 
                    type: 'spread'; 
                    leftPage: number; 
                    rightPage: number;
                    chapterId?: string;
                    startsNewChapter: boolean;
                    chapterInfo?: { id: string; title: string; color: string };
                  };
                  const items: SpreadItem[] = [];
                  
                  let lastChapterId: string | null = null;
                  
                  // Helper: získej kapitolu pro stránku (používá novou logiku)
                  const getPageChapter = (pageNum: number) => {
                    return getChapterForPage(pageNum, workbook.pages, workbook.chapters);
                  };
                  
                  // Helper: zjisti jestli na stránce ZAČÍNÁ nová kapitola
                  const pageStartsChapter = (pageNum: number) => {
                    return getChapterStartingAtPage(pageNum, workbook.pages, workbook.chapters);
                  };
                  
                  // Page 1 is always single (titulní strana)
                  const page1Chapter = getPageChapter(1);
                  const page1StartsChapter = pageStartsChapter(1);
                  items.push({ 
                    type: 'single', 
                    pageNum: 1,
                    chapterId: page1Chapter?.id,
                    startsNewChapter: !!page1StartsChapter,
                    chapterInfo: page1StartsChapter || undefined,
                  });
                  lastChapterId = page1Chapter?.id || null;
                  
                  // Spreads: 2-3, 4-5, 6-7, etc.
                  // Ale pokud pravá stránka začíná kapitolu, rozděl spread na dvě single pages
                  for (let leftPage = 2; leftPage < totalPages; leftPage += 2) {
                    const rightPage = leftPage + 1;
                    if (rightPage <= totalPages) {
                      const leftChapter = getPageChapter(leftPage);
                      const rightChapter = getPageChapter(rightPage);
                      const leftStartsChapter = pageStartsChapter(leftPage);
                      const rightStartsChapter = pageStartsChapter(rightPage);
                      
                      // Pokud PRAVÁ stránka začíná kapitolu, rozděl spread
                      if (rightStartsChapter) {
                        // Levá stránka jako single
                        items.push({
                          type: 'single',
                          pageNum: leftPage,
                          chapterId: leftChapter?.id,
                          startsNewChapter: !!leftStartsChapter,
                          chapterInfo: leftStartsChapter || undefined,
                        });
                        
                        // Pravá stránka jako single - začíná novou kapitolu
                        items.push({
                          type: 'single',
                          pageNum: rightPage,
                          chapterId: rightChapter?.id,
                          startsNewChapter: true,
                          chapterInfo: rightStartsChapter,
                        });
                      } else {
                        // Normální spread
                        const spreadChapter = leftChapter;
                        const startsNewChapter = !!leftStartsChapter;
                        
                        items.push({ 
                          type: 'spread', 
                          leftPage, 
                          rightPage,
                          chapterId: spreadChapter?.id,
                          startsNewChapter,
                          chapterInfo: leftStartsChapter || undefined,
                        });
                      }
                      
                      if (rightChapter) {
                        lastChapterId = rightChapter.id;
                      } else if (leftChapter) {
                        lastChapterId = leftChapter.id;
                      }
                    }
                  }
                  
                  // Last page is single if total is even
                  if (totalPages % 2 === 0) {
                    const lastPageChapter = getPageChapter(totalPages);
                    const lastStartsChapter = pageStartsChapter(totalPages);
                    items.push({ 
                      type: 'single', 
                      pageNum: totalPages,
                      chapterId: lastPageChapter?.id,
                      startsNewChapter: !!lastStartsChapter,
                      chapterInfo: lastStartsChapter || undefined,
                    });
                  }
                  
                  const itemsPerRow = 3;
                  
                  // Group items into rows, but start new row when chapter changes
                  type RowGroup = { items: SpreadItem[]; chapterInfo?: { id: string; title: string; color: string } };
                  const rowGroups: RowGroup[] = [];
                  let currentRow: SpreadItem[] = [];
                  
                  items.forEach((item, idx) => {
                    // If item starts new chapter, finalize current row and start new one
                    if (item.startsNewChapter && currentRow.length > 0) {
                      rowGroups.push({ items: currentRow });
                      currentRow = [];
                    }
                    
                    currentRow.push(item);
                    
                    // If row is full, finalize it
                    if (currentRow.length >= itemsPerRow) {
                      const chapterInfo = currentRow.find(i => i.chapterInfo)?.chapterInfo;
                      rowGroups.push({ items: currentRow, chapterInfo });
                      currentRow = [];
                    }
                  });
                  
                  // Don't forget the last partial row
                  if (currentRow.length > 0) {
                    const chapterInfo = currentRow.find(i => i.chapterInfo)?.chapterInfo;
                    rowGroups.push({ items: currentRow, chapterInfo });
                  }
                  
                  return (
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '32px',
                      alignItems: 'center',
                    }}>
                      {rowGroups.map((rowGroup, rowIndex) => {
                        const rowItems = rowGroup.items;
                        
                        // Check if first item in this row starts a new chapter
                        const rowStartsNewChapter = rowItems[0]?.startsNewChapter;
                        const chapterInfo = rowItems[0]?.chapterInfo || rowGroup.chapterInfo;
                        
                        return (
                          <div 
                            key={rowIndex}
                            style={{ 
                              display: 'flex', 
                              flexDirection: 'column',
                              alignItems: 'center',
                              marginTop: rowStartsNewChapter && rowIndex > 0 ? '60px' : '0',
                            }}
                          >
                            <div style={{ 
                              display: 'flex', 
                              gap: '24px',
                              justifyContent: 'flex-start',
                            }}>
                            {rowItems.map((item, idx) => {
                              // Check if THIS item specifically starts a new chapter (for mid-row breaks)
                              const itemStartsChapter = item.startsNewChapter && idx > 0;
                              
                              if (item.type === 'single') {
                                const pageNum = item.pageNum;
                                const page = workbook.pages.find(p => p.pageNumber === pageNum);
                                const ws = page ? workbook.worksheets[page.worksheetId] : null;
                                const isFirst = pageNum === 1;
                                const isLast = pageNum === totalPages;
                                const pageChapter = getChapterForPage(pageNum, workbook.pages, workbook.chapters);
                                const startsChapter = getChapterStartingAtPage(pageNum, workbook.pages, workbook.chapters);
                                
                                return (
                                  <div 
                                    key={`single-${pageNum}`}
                                    style={{ 
                                      display: 'flex', 
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                      position: 'relative',
                                      paddingTop: '32px', // Fixed space for badge
                                    }}
                                  >
                                    {/* Badge kapitoly nad stránkou - fixed size nezávislá na zoomu */}
                                    {startsChapter && (
                                      <div 
                                        style={{
                                          position: 'absolute',
                                          top: 0,
                                          left: '50%',
                                          transform: `translateX(-50%) scale(${1 / canvasZoom})`,
                                          transformOrigin: 'center top',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '6px',
                                          padding: '4px 12px',
                                          backgroundColor: '#0f172a',
                                          border: `2px solid ${startsChapter.color}`,
                                          borderRadius: '16px',
                                          cursor: 'pointer',
                                          whiteSpace: 'nowrap',
                                          zIndex: 50,
                                        }}
                                        onClick={() => handleSelectChapterPages(startsChapter.id)}
                                        title="Klikni pro výběr všech stránek této kapitoly"
                                      >
                                        <div style={{
                                          width: '8px',
                                          height: '8px',
                                          borderRadius: '50%',
                                          backgroundColor: startsChapter.color,
                                        }} />
                                        <span style={{
                                          fontSize: '11px',
                                          fontWeight: 600,
                                          color: startsChapter.color,
                                          textTransform: 'uppercase',
                                          letterSpacing: '0.5px',
                                        }}>
                                          {startsChapter.title}
                                        </span>
                                      </div>
                                    )}
                                    
                                    <div 
                                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}
                                      onMouseEnter={(e) => {
                                        const btn = e.currentTarget.querySelector('.add-chapter-btn') as HTMLElement;
                                        if (btn) btn.style.opacity = '1';
                                      }}
                                      onMouseLeave={(e) => {
                                        const btn = e.currentTarget.querySelector('.add-chapter-btn') as HTMLElement;
                                        if (btn) btn.style.opacity = '0';
                                      }}
                                    >
                                      {/* Chapter color bar removed */}
                                      <div 
                                        data-page={pageNum}
                                        draggable
                                        onClick={(e) => {
                                          if (e.ctrlKey || e.metaKey) {
                                            e.stopPropagation();
                                            handlePageSelect(pageNum, true);
                                          } else if (selectedPages.size > 0 && !isDragging) {
                                            handlePageSelect(pageNum, false);
                                          } else if (page) {
                                            handleEditPage(page.id, page.worksheetId);
                                          }
                                        }}
                                        onDragStart={(e) => {
                                          e.dataTransfer.effectAllowed = 'move';
                                          e.dataTransfer.setData('text/plain', String(pageNum));
                                          handleDragStart(pageNum);
                                        }}
                                        onDragEnd={handleDragEnd}
                                        onDragOver={(e) => {
                                          e.preventDefault();
                                          setDropTarget({ type: 'position', value: pageNum });
                                        }}
                                        onDragLeave={() => setDropTarget(null)}
                                        onDrop={(e) => {
                                          e.preventDefault();
                                          handleDropOnPosition(pageNum);
                                        }}
                                        style={{
                                          width: '140px',
                                          height: '198px',
                                          backgroundColor: ws ? '#f8fafc' : '#1e293b',
                                          borderRadius: '8px',
                                          border: selectedPages.has(pageNum) 
                                            ? `3px solid ${pageChapter?.color || '#3b82f6'}` 
                                            : dropTarget?.type === 'position' && dropTarget.value === pageNum
                                              ? '3px solid #22c55e'
                                              : ws ? '1px solid #e2e8f0' : '2px dashed #334155',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          gap: '8px',
                                          cursor: isDragging ? 'grabbing' : 'pointer',
                                          transition: 'all 0.15s',
                                          position: 'relative',
                                          opacity: draggedPages.includes(pageNum) ? 0.5 : 1,
                                          boxShadow: selectedPages.has(pageNum) 
                                            ? `0 12px 32px -4px ${pageChapter?.color || '#3b82f6'}90, 0 6px 16px -2px ${pageChapter?.color || '#3b82f6'}60` 
                                            : 'none',
                                        }}
                                        onMouseEnter={(e) => {
                                          if (!isDragging) {
                                            e.currentTarget.style.transform = 'scale(1.02)';
                                            const btn = e.currentTarget.querySelector('.add-chapter-btn') as HTMLElement;
                                            if (btn) btn.style.opacity = '1';
                                          }
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.transform = 'scale(1)';
                                          const btn = e.currentTarget.querySelector('.add-chapter-btn') as HTMLElement;
                                          if (btn) btn.style.opacity = '0';
                                        }}
                                      >
                                        {/* Selection indicator with chapter color */}
                                        {selectedPages.has(pageNum) && (
                                          <div style={{
                                            position: 'absolute',
                                            top: '-8px',
                                            right: '-8px',
                                            width: '20px',
                                            height: '20px',
                                            borderRadius: '50%',
                                            backgroundColor: pageChapter?.color || '#3b82f6',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            zIndex: 10,
                                          }}>
                                            <Check size={12} style={{ color: '#fff' }} />
                                          </div>
                                        )}
                                        {ws ? (
                                          <span style={{ 
                                            fontSize: '11px', 
                                            color: '#64748b',
                                            textAlign: 'center',
                                            padding: '8px',
                                          }}>
                                            {ws.title}
                                          </span>
                                        ) : (
                                          <>
                                            <Plus size={20} style={{ color: '#475569' }} />
                                            <span style={{ fontSize: '11px', color: '#64748b' }}>Prázdná</span>
                                          </>
                                        )}
                                      </div>
                                      {/* Page number below card */}
                                      <span style={{ 
                                        fontSize: '14px', 
                                        color: '#64748b',
                                        fontWeight: 600,
                                        marginTop: '8px',
                                      }}>
                                        {pageNum}
                                      </span>
                                      {/* Hover button to add chapter - above card (only if no chapter starts here) */}
                                      {!startsChapter && (
                                        <button
                                          className="add-chapter-btn"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleStartChapter(pageNum);
                                          }}
                                          style={{
                                            position: 'absolute',
                                            top: '-28px',
                                            left: '50%',
                                            transform: 'translateX(-50%)',
                                            padding: '4px 10px',
                                            borderRadius: '12px',
                                            border: '1px dashed #475569',
                                            backgroundColor: 'rgba(15, 23, 42, 0.9)',
                                            color: '#94a3b8',
                                            fontSize: '11px',
                                            fontWeight: 500,
                                            cursor: 'pointer',
                                            whiteSpace: 'nowrap',
                                            opacity: 0,
                                            transition: 'all 0.2s',
                                            zIndex: 5,
                                          }}
                                          title="Začít novou kapitolu zde"
                                        >
                                          + Přidat kapitolu
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              } else {
                                // Spread
                                const { leftPage: leftPageNum, rightPage: rightPageNum } = item;
                                const leftPage = workbook.pages.find(p => p.pageNumber === leftPageNum);
                                const rightPage = workbook.pages.find(p => p.pageNumber === rightPageNum);
                                const leftWs = leftPage ? workbook.worksheets[leftPage.worksheetId] : null;
                                const rightWs = rightPage ? workbook.worksheets[rightPage.worksheetId] : null;
                                const leftChapter = getChapterForPage(leftPageNum, workbook.pages, workbook.chapters);
                                const rightChapter = getChapterForPage(rightPageNum, workbook.pages, workbook.chapters);
                                // Kapitola může začínat na levé NEBO pravé stránce spreadu
                                const leftStartsChapter = getChapterStartingAtPage(leftPageNum, workbook.pages, workbook.chapters);
                                const rightStartsChapter = getChapterStartingAtPage(rightPageNum, workbook.pages, workbook.chapters);
                                const startsChapter = leftStartsChapter || rightStartsChapter;
                                
                                // Can always start new chapter (just sets startsChapterId on this page)
                                const canStartChapter = true;
                                
                                // Pozice badge - nad levou nebo pravou stránkou podle toho kde kapitola začíná
                                // Spread: levá stránka 140px + 4px gap + pravá stránka 140px = 284px
                                // Střed levé: 70px, střed pravé: 70 + 4 + 140 = 214px
                                const badgePosition = leftStartsChapter ? '70px' : '214px';
                                
                                return (
                                  <div 
                                    key={`spread-${leftPageNum}`}
                                    style={{ 
                                      display: 'flex', 
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                      position: 'relative',
                                      paddingTop: '32px', // Fixed space for badge
                                      width: '284px', // 140px + 4px gap + 140px
                                    }}
                                  >
                                    {/* Badge kapitoly nad stránkou - fixed size nezávislá na zoomu */}
                                    {startsChapter && (
                                      <div 
                                        style={{
                                          position: 'absolute',
                                          top: 0,
                                          left: badgePosition,
                                          transform: `translateX(-50%) scale(${1 / canvasZoom})`,
                                          transformOrigin: 'center top',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '6px',
                                          padding: '4px 12px',
                                          backgroundColor: '#0f172a',
                                          border: `2px solid ${startsChapter.color}`,
                                          borderRadius: '16px',
                                          cursor: 'pointer',
                                          whiteSpace: 'nowrap',
                                          zIndex: 50,
                                        }}
                                        onClick={() => handleSelectChapterPages(startsChapter.id)}
                                        title="Klikni pro výběr všech stránek této kapitoly"
                                      >
                                        <div style={{
                                          width: '8px',
                                          height: '8px',
                                          borderRadius: '50%',
                                          backgroundColor: startsChapter.color,
                                        }} />
                                        <span style={{
                                          fontSize: '11px',
                                          fontWeight: 600,
                                          color: startsChapter.color,
                                          textTransform: 'uppercase',
                                          letterSpacing: '0.5px',
                                        }}>
                                          {startsChapter.title}
                                        </span>
                                      </div>
                                    )}
                                    
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0' }}>
                                      <div style={{ display: 'flex', gap: '4px', position: 'relative' }}>
                                      {/* Chapter color bar removed */}
                                      
                                      {/* Left page wrapper */}
                                      <div 
                                        style={{ position: 'relative' }}
                                        onMouseEnter={(e) => {
                                          const btn = e.currentTarget.querySelector('.add-chapter-btn-left') as HTMLElement;
                                          if (btn) btn.style.opacity = '1';
                                        }}
                                        onMouseLeave={(e) => {
                                          const btn = e.currentTarget.querySelector('.add-chapter-btn-left') as HTMLElement;
                                          if (btn) btn.style.opacity = '0';
                                        }}
                                      >
                                        {/* Hover button for left page */}
                                        {!leftStartsChapter && (
                                          <button
                                            className="add-chapter-btn-left"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleStartChapter(leftPageNum);
                                            }}
                                            style={{
                                              position: 'absolute',
                                              top: '-28px',
                                              left: '50%',
                                              transform: 'translateX(-50%)',
                                              padding: '4px 10px',
                                              borderRadius: '12px',
                                              border: '1px dashed #475569',
                                              backgroundColor: 'rgba(15, 23, 42, 0.9)',
                                              color: '#94a3b8',
                                              fontSize: '11px',
                                              fontWeight: 500,
                                              cursor: 'pointer',
                                              whiteSpace: 'nowrap',
                                              opacity: 0,
                                              transition: 'all 0.2s',
                                              zIndex: 5,
                                            }}
                                            title="Začít novou kapitolu zde"
                                          >
                                            + Přidat kapitolu
                                          </button>
                                        )}
                                        <div 
                                          data-page={leftPageNum}
                                          draggable
                                          onClick={(e) => {
                                            if (e.ctrlKey || e.metaKey) {
                                              e.stopPropagation();
                                              handlePageSelect(leftPageNum, true);
                                            } else if (selectedPages.size > 0 && !isDragging) {
                                              handlePageSelect(leftPageNum, false);
                                            } else if (leftPage) {
                                              handleEditPage(leftPage.id, leftPage.worksheetId);
                                            }
                                          }}
                                          onDragStart={(e) => {
                                            e.dataTransfer.effectAllowed = 'move';
                                            handleDragStart(leftPageNum);
                                          }}
                                          onDragEnd={handleDragEnd}
                                          onDragOver={(e) => {
                                            e.preventDefault();
                                            setDropTarget({ type: 'position', value: leftPageNum });
                                          }}
                                          onDragLeave={() => setDropTarget(null)}
                                          onDrop={(e) => {
                                            e.preventDefault();
                                            handleDropOnPosition(leftPageNum);
                                          }}
                                        style={{
                                          width: '140px',
                                          height: '198px',
                                          backgroundColor: leftWs ? '#f8fafc' : '#1e293b',
                                          borderRadius: '4px 0 0 4px',
                                          border: selectedPages.has(leftPageNum) 
                                            ? `3px solid ${leftChapter?.color || '#3b82f6'}` 
                                            : dropTarget?.type === 'position' && dropTarget.value === leftPageNum
                                              ? '3px solid #22c55e'
                                              : leftWs ? '1px solid #e2e8f0' : '2px dashed #334155',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          gap: '8px',
                                          cursor: isDragging ? 'grabbing' : 'pointer',
                                          transition: 'all 0.15s',
                                          position: 'relative',
                                          opacity: draggedPages.includes(leftPageNum) ? 0.5 : 1,
                                          boxShadow: selectedPages.has(leftPageNum) 
                                            ? `0 12px 32px -4px ${leftChapter?.color || '#3b82f6'}90, 0 6px 16px -2px ${leftChapter?.color || '#3b82f6'}60` 
                                            : 'none',
                                        }}
                                        onMouseEnter={(e) => {
                                          if (!isDragging) e.currentTarget.style.transform = 'scale(1.02)';
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.transform = 'scale(1)';
                                        }}
                                      >
                                        {/* Selection indicator with chapter color */}
                                        {selectedPages.has(leftPageNum) && (
                                          <div style={{
                                            position: 'absolute',
                                            top: '-8px',
                                            right: '-8px',
                                            width: '20px',
                                            height: '20px',
                                            borderRadius: '50%',
                                            backgroundColor: leftChapter?.color || '#3b82f6',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            zIndex: 10,
                                          }}>
                                            <Check size={12} style={{ color: '#fff' }} />
                                          </div>
                                        )}
                                        {leftWs ? (
                                          <span style={{ 
                                            fontSize: '11px', 
                                            color: '#64748b',
                                            textAlign: 'center',
                                            padding: '8px',
                                          }}>
                                            {leftWs.title}
                                          </span>
                                        ) : (
                                          <>
                                            <Plus size={20} style={{ color: '#475569' }} />
                                            <span style={{ fontSize: '11px', color: '#64748b' }}>Prázdná</span>
                                          </>
                                          )}
                                        </div>
                                      </div>
                                      
                                      {/* Right page wrapper */}
                                      <div 
                                        style={{ position: 'relative' }}
                                        onMouseEnter={(e) => {
                                          const btn = e.currentTarget.querySelector('.add-chapter-btn-right') as HTMLElement;
                                          if (btn) btn.style.opacity = '1';
                                        }}
                                        onMouseLeave={(e) => {
                                          const btn = e.currentTarget.querySelector('.add-chapter-btn-right') as HTMLElement;
                                          if (btn) btn.style.opacity = '0';
                                        }}
                                      >
                                        {/* Hover button for right page */}
                                        {!rightStartsChapter && (
                                          <button
                                            className="add-chapter-btn-right"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleStartChapter(rightPageNum);
                                            }}
                                            style={{
                                              position: 'absolute',
                                              top: '-28px',
                                              left: '50%',
                                              transform: 'translateX(-50%)',
                                              padding: '4px 10px',
                                              borderRadius: '12px',
                                              border: '1px dashed #475569',
                                              backgroundColor: 'rgba(15, 23, 42, 0.9)',
                                              color: '#94a3b8',
                                              fontSize: '11px',
                                              fontWeight: 500,
                                              cursor: 'pointer',
                                              whiteSpace: 'nowrap',
                                              opacity: 0,
                                              transition: 'all 0.2s',
                                              zIndex: 5,
                                            }}
                                            title="Začít novou kapitolu zde"
                                          >
                                            + Přidat kapitolu
                                          </button>
                                        )}
                                        <div 
                                          data-page={rightPageNum}
                                          draggable
                                          onClick={(e) => {
                                            if (e.ctrlKey || e.metaKey) {
                                              e.stopPropagation();
                                              handlePageSelect(rightPageNum, true);
                                            } else if (selectedPages.size > 0 && !isDragging) {
                                              handlePageSelect(rightPageNum, false);
                                            } else if (rightPage) {
                                              handleEditPage(rightPage.id, rightPage.worksheetId);
                                            }
                                          }}
                                          onDragStart={(e) => {
                                            e.dataTransfer.effectAllowed = 'move';
                                          handleDragStart(rightPageNum);
                                        }}
                                        onDragEnd={handleDragEnd}
                                        onDragOver={(e) => {
                                          e.preventDefault();
                                          setDropTarget({ type: 'position', value: rightPageNum });
                                        }}
                                        onDragLeave={() => setDropTarget(null)}
                                        onDrop={(e) => {
                                          e.preventDefault();
                                          handleDropOnPosition(rightPageNum);
                                        }}
                                        style={{
                                          width: '140px',
                                          height: '198px',
                                          backgroundColor: rightWs ? '#f8fafc' : '#1e293b',
                                          borderRadius: '0 4px 4px 0',
                                          border: selectedPages.has(rightPageNum) 
                                            ? `3px solid ${rightChapter?.color || '#3b82f6'}` 
                                            : dropTarget?.type === 'position' && dropTarget.value === rightPageNum
                                              ? '3px solid #22c55e'
                                              : rightWs ? '1px solid #e2e8f0' : '2px dashed #334155',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          gap: '8px',
                                          cursor: isDragging ? 'grabbing' : 'pointer',
                                          transition: 'all 0.15s',
                                          position: 'relative',
                                          opacity: draggedPages.includes(rightPageNum) ? 0.5 : 1,
                                          boxShadow: selectedPages.has(rightPageNum) 
                                            ? `0 12px 32px -4px ${rightChapter?.color || '#3b82f6'}90, 0 6px 16px -2px ${rightChapter?.color || '#3b82f6'}60` 
                                            : 'none',
                                        }}
                                        onMouseEnter={(e) => {
                                          if (!isDragging) e.currentTarget.style.transform = 'scale(1.02)';
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.transform = 'scale(1)';
                                        }}
                                      >
                                        {/* Selection indicator with chapter color */}
                                        {selectedPages.has(rightPageNum) && (
                                          <div style={{
                                            position: 'absolute',
                                            top: '-8px',
                                            right: '-8px',
                                            width: '20px',
                                            height: '20px',
                                            borderRadius: '50%',
                                            backgroundColor: rightChapter?.color || '#3b82f6',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            zIndex: 10,
                                          }}>
                                            <Check size={12} style={{ color: '#fff' }} />
                                          </div>
                                        )}
                                        {rightWs ? (
                                          <span style={{ 
                                            fontSize: '11px', 
                                            color: '#64748b',
                                            textAlign: 'center',
                                            padding: '8px',
                                          }}>
                                            {rightWs.title}
                                          </span>
                                        ) : (
                                          <>
                                            <Plus size={20} style={{ color: '#475569' }} />
                                            <span style={{ fontSize: '11px', color: '#64748b' }}>Prázdná</span>
                                          </>
                                          )}
                                        </div>
                                      </div>
                                      </div>
                                      {/* Page numbers below spread */}
                                      <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
                                        <span style={{ 
                                          width: '140px',
                                          textAlign: 'center',
                                          fontSize: '14px', 
                                          color: '#64748b',
                                          fontWeight: 600,
                                        }}>
                                          {leftPageNum}
                                        </span>
                                        <span style={{ 
                                          width: '140px',
                                          textAlign: 'center',
                                          fontSize: '14px', 
                                          color: '#64748b',
                                          fontWeight: 600,
                                        }}>
                                          {rightPageNum}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              }
                            })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </InfiniteCanvas>
          ) : viewMode === 'covers' ? (
            // Covers view - 4 strany obálky
            <InfiniteCanvas showControls={true} onCanvasStateChange={(state) => setCanvasZoom(state.zoom)}>
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center',
                transform: 'translateX(-50%)',
              }}>
                {/* Cover title */}
                <div style={{ textAlign: 'center', marginBottom: '48px' }}>
                  <h1 
                    style={{ 
                      fontSize: '28px', 
                      fontWeight: 300, 
                      color: '#cbd5e1', 
                      marginBottom: '12px',
                      fontFamily: "'Georgia', serif",
                    }}
                  >
                    Obálky sešitu
                  </h1>
                  <p style={{ color: '#64748b', fontSize: '14px' }}>
                    4 strany: Přední, Vnitřní přední, Vnitřní zadní, Zadní
                  </p>
                </div>
                
                {/* Cover spreads - 2x2 grid */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(2, 1fr)', 
                  gap: '32px',
                }}>
                  {/* Front cover (přední obálka) */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <div 
                      style={{
                        width: '210px',
                        height: '297px',
                        backgroundColor: '#1e293b',
                        borderRadius: '8px',
                        border: '2px solid #334155',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#3b82f6';
                        e.currentTarget.style.transform = 'scale(1.02)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#334155';
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      {workbook.coverImage ? (
                        <img 
                          src={workbook.coverImage} 
                          alt="Cover" 
                          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px' }}
                        />
                      ) : (
                        <>
                          <BookOpen size={48} style={{ color: '#475569' }} />
                          <span style={{ color: '#64748b', fontSize: '13px', fontWeight: 500 }}>Přední obálka</span>
                        </>
                      )}
                    </div>
                    <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 500 }}>PŘEDNÍ</span>
                  </div>
                  
                  {/* Inside front cover (vnitřní přední) */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <div 
                      style={{
                        width: '210px',
                        height: '297px',
                        backgroundColor: '#1e293b',
                        borderRadius: '8px',
                        border: '2px dashed #334155',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#3b82f6';
                        e.currentTarget.style.transform = 'scale(1.02)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#334155';
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      <Plus size={32} style={{ color: '#475569' }} />
                      <span style={{ color: '#64748b', fontSize: '13px' }}>Vnitřní přední</span>
                    </div>
                    <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 500 }}>VNITŘNÍ PŘEDNÍ</span>
                  </div>
                  
                  {/* Inside back cover (vnitřní zadní) */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <div 
                      style={{
                        width: '210px',
                        height: '297px',
                        backgroundColor: '#1e293b',
                        borderRadius: '8px',
                        border: '2px dashed #334155',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#3b82f6';
                        e.currentTarget.style.transform = 'scale(1.02)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#334155';
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      <Plus size={32} style={{ color: '#475569' }} />
                      <span style={{ color: '#64748b', fontSize: '13px' }}>Vnitřní zadní</span>
                    </div>
                    <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 500 }}>VNITŘNÍ ZADNÍ</span>
                  </div>
                  
                  {/* Back cover (zadní obálka) */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <div 
                      style={{
                        width: '210px',
                        height: '297px',
                        backgroundColor: '#1e293b',
                        borderRadius: '8px',
                        border: '2px dashed #334155',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#3b82f6';
                        e.currentTarget.style.transform = 'scale(1.02)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#334155';
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      <Plus size={32} style={{ color: '#475569' }} />
                      <span style={{ color: '#64748b', fontSize: '13px' }}>Zadní obálka</span>
                    </div>
                    <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 500 }}>ZADNÍ</span>
                  </div>
                </div>
              </div>
            </InfiniteCanvas>
          ) : (
            // Settings view - full settings form in main area
            <div className="h-full overflow-y-auto" style={{ backgroundColor: '#0f172a' }}>
              <div className="max-w-2xl mx-auto p-8">
                <div className="flex items-center gap-3 mb-8">
                  <Settings size={24} style={{ color: '#64748b' }} />
                  <h1 style={{ fontSize: '24px', fontWeight: 600, color: '#f1f5f9' }}>
                    Nastavení sešitu
                  </h1>
                </div>
                
                <div className="space-y-6">
                  {/* Title */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Název sešitu</label>
                    <input
                      type="text"
                      value={workbook.title}
                      onChange={(e) => setWorkbook(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-base focus:outline-none focus:border-blue-500 text-white"
                      placeholder="Zadejte název sešitu..."
                    />
                  </div>
                  
                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Popis</label>
                    <textarea
                      value={workbook.description}
                      onChange={(e) => setWorkbook(prev => ({ ...prev, description: e.target.value }))}
                      rows={4}
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-base focus:outline-none focus:border-blue-500 resize-none text-white"
                      placeholder="Popis sešitu..."
                    />
                  </div>
                  
                  <div className="border-t border-slate-700 pt-6">
                    <h2 className="text-lg font-medium text-slate-200 mb-4">Formát stránky</h2>
                    
                    <div className="grid grid-cols-2 gap-4">
                      {/* Page format */}
                      <div>
                        <label className="block text-sm text-slate-400 mb-2">Formát</label>
                        <select
                          value={workbook.settings.pageFormat}
                          onChange={(e) => setWorkbook(prev => ({
                            ...prev,
                            settings: { ...prev.settings, pageFormat: e.target.value as 'a4' | 'b5' | 'a5' },
                          }))}
                          className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-base focus:outline-none focus:border-blue-500 text-white"
                        >
                          <option value="a4">A4 (210 × 297 mm)</option>
                          <option value="b5">B5 (176 × 250 mm)</option>
                          <option value="a5">A5 (148 × 210 mm)</option>
                        </select>
                      </div>
                      
                      {/* Page limit */}
                      <div>
                        <label className="block text-sm text-slate-400 mb-2">
                          Limit stránek: <span className="text-white font-medium">{workbook.settings.pageLimit}</span>
                        </label>
                        <input
                          type="range"
                          min={8}
                          max={128}
                          step={8}
                          value={workbook.settings.pageLimit}
                          onChange={(e) => setWorkbook(prev => ({
                            ...prev,
                            settings: { ...prev.settings, pageLimit: parseInt(e.target.value) },
                          }))}
                          className="w-full mt-2"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="border-t border-slate-700 pt-6">
                    <h2 className="text-lg font-medium text-slate-200 mb-4">Zobrazení</h2>
                    
                    <div className="space-y-3">
                      {/* Show chapter colors */}
                      <label className="flex items-center gap-3 cursor-pointer p-3 bg-slate-800 rounded-lg hover:bg-slate-750 transition-colors">
                        <input
                          type="checkbox"
                          checked={workbook.settings.showChapterColors}
                          onChange={(e) => setWorkbook(prev => ({
                            ...prev,
                            settings: { ...prev.settings, showChapterColors: e.target.checked },
                          }))}
                          className="w-5 h-5 rounded border-slate-600"
                        />
                        <div>
                          <span className="text-sm font-medium text-slate-200">Zobrazit barvy kapitol</span>
                          <p className="text-xs text-slate-400">Barevné označení stránek podle kapitol</p>
                        </div>
                      </label>
                      
                      {/* Show page numbers */}
                      <label className="flex items-center gap-3 cursor-pointer p-3 bg-slate-800 rounded-lg hover:bg-slate-750 transition-colors">
                        <input
                          type="checkbox"
                          checked={workbook.settings.showPageNumbers}
                          onChange={(e) => setWorkbook(prev => ({
                            ...prev,
                            settings: { ...prev.settings, showPageNumbers: e.target.checked },
                          }))}
                          className="w-5 h-5 rounded border-slate-600"
                        />
                        <div>
                          <span className="text-sm font-medium text-slate-200">Zobrazit čísla stránek</span>
                          <p className="text-xs text-slate-400">Číslování stránek v patičce</p>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      
      {/* New Chapter Dialog */}
      {newChapterDialog.open && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setNewChapterDialog({ open: false, fromPage: 1 })}
        >
          <div 
            style={{
              backgroundColor: '#1e293b',
              borderRadius: '16px',
              padding: '24px',
              minWidth: '400px',
              border: '1px solid #334155',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', color: '#f1f5f9' }}>
              Nová kapitola od stránky {newChapterDialog.fromPage}
            </h2>
            
            <input
              type="text"
              value={newChapterTitle}
              onChange={(e) => setNewChapterTitle(e.target.value)}
              placeholder="Název kapitoly..."
              autoFocus
              style={{
                width: '100%',
                padding: '12px 16px',
                backgroundColor: '#0f172a',
                border: '1px solid #475569',
                borderRadius: '8px',
                color: '#f1f5f9',
                fontSize: '15px',
                marginBottom: '20px',
                outline: 'none',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmNewChapter();
                if (e.key === 'Escape') setNewChapterDialog({ open: false, fromPage: 1 });
              }}
            />
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setNewChapterDialog({ open: false, fromPage: 1 })}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: '1px solid #475569',
                  backgroundColor: 'transparent',
                  color: '#94a3b8',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Zrušit
              </button>
              <button
                onClick={handleConfirmNewChapter}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#3b82f6',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Vytvořit kapitolu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
