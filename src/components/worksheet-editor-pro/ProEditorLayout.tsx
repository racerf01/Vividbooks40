/**
 * WorksheetEditorPro - Advanced worksheet editor for internal use
 * 
 * Features:
 * - All features from basic editor
 * - Extended block types
 * - Advanced AI assistance
 * - Template management
 * - Multi-page layouts
 * - Export to multiple formats
 * - Collaboration features (future)
 * 
 * Shares components with basic editor:
 * - EditableBlock, DraggableCanvas, PrintableWorksheet
 * - Block types, settings overlays
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { Loader2, Undo2, Redo2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Worksheet,
  WorksheetBlock,
  BlockType,
  BlockWidth,
  BlockImage,
  GridColumns,
  GridGap,
  GlobalFontSize,
  createEmptyWorksheet,
  createEmptyBlock,
} from '../../types/worksheet';
import { SaveStatus } from '../../types/worksheet-editor';

// Shared components from basic editor
import { FreeformCanvas } from './FreeformCanvas';
import { GridCanvas } from './GridCanvas';
import { ProBlockSettingsPanel } from './ProBlockSettingsPanel';
import { PrintableWorksheet } from '../worksheet-editor/PrintableWorksheet';
import { AIChatPanel } from '../worksheet-editor/AIChatPanel';
import { ProStructurePanel } from './ProStructurePanel';
import { ProSettingsPanel } from './ProSettingsPanel';
import { ProAddContentPanel } from './ProAddContentPanel';
import { VersionHistoryPanel } from '../shared/VersionHistoryPanel';

// Pro-specific components
import { ProMiniSidebar, ProActivePanel } from './ProMiniSidebar';
import { SheetSettingsPanel } from './SheetSettingsPanel';
import { DebugPanel } from './DebugPanel';
import { JsonEditorPanel } from './JsonEditorPanel';

// Hooks
import { usePDFExport } from '../../hooks/usePDFExport';
import { useVersionHistory } from '../../hooks/useVersionHistory';
import { saveWorksheet as saveToStorage, getWorksheet } from '../../utils/worksheet-storage';
import { getCurrentUserProfile } from '../../utils/profile-storage';

interface ProEditorLayoutProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

// Page format type (from workbook)
type PageFormat = 'a4' | 'b5' | 'a5';

export function ProEditorLayout({ theme, toggleTheme }: ProEditorLayoutProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Get page format from URL (passed from workbook) or default to A4
  const pageFormat = (searchParams.get('pageFormat') as PageFormat) || 'a4';
  
  // Get workbook ID from URL for back navigation
  const workbookId = searchParams.get('workbookId');
  
  // Editor state
  const [worksheet, setWorksheet] = useState<Worksheet | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  
  // Panel state - using PRO panel types
  const [activePanel, setActivePanel] = useState<ProActivePanel>('sheet-settings');
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [rightPanel, setRightPanel] = useState<'debug' | 'json' | null>(null);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(true);
  const [showGridOverlay, setShowGridOverlay] = useState(false);
  const canvasZoom = 0.83; // Fixed 83% zoom to fit on screen
  
  // Block settings overlay
  const [isBlockSettingsOpen, setIsBlockSettingsOpen] = useState(false);
  const [forceAIOpen, setForceAIOpen] = useState(false);
  
  // Insert mode
  const [pendingInsertType, setPendingInsertType] = useState<BlockType | null>(null);
  
  // Drag and drop from add panel
  const [isDraggingFromPanel, setIsDraggingFromPanel] = useState(false);
  const [draggingBlockType, setDraggingBlockType] = useState<BlockType | null>(null);
  
  // PDF Export
  const { printRef, handleExport, isExporting } = usePDFExport();
  
  // Get current user profile
  const profile = getCurrentUserProfile();
  
  // Version history
  const versionHistory = useVersionHistory({
    documentId: id || '',
    documentType: 'worksheet',
    content: worksheet ? JSON.stringify(worksheet) : '',
    title: worksheet?.title || 'Nový pracovní list',
    userId: profile?.userId,
    userType: 'teacher',
    userName: profile?.name,
    autoSave: true,
    autoSaveDelay: 60000,
    onVersionRestored: useCallback((version) => {
      try {
        const restoredWorksheet = JSON.parse(version.content);
        setWorksheet(restoredWorksheet);
        setIsDirty(true);
      } catch (e) {
        console.error('Failed to parse restored worksheet:', e);
      }
    }, []),
  });
  
  // Undo/Redo history
  const [history, setHistory] = useState<Worksheet[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoRedoAction = useRef(false);
  const MAX_HISTORY = 100; // Pro has more history
  
  // Refs
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const worksheetRef = useRef<Worksheet | null>(null);
  
  // Keep ref in sync
  useEffect(() => {
    worksheetRef.current = worksheet;
  }, [worksheet]);
  
  // Track worksheet changes for undo/redo
  useEffect(() => {
    if (!worksheet || isUndoRedoAction.current) {
      isUndoRedoAction.current = false;
      return;
    }
    
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(worksheet)));
      if (newHistory.length > MAX_HISTORY) {
        newHistory.shift();
      }
      return newHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, MAX_HISTORY - 1));
  }, [worksheet]);
  
  // Undo/Redo functions
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      isUndoRedoAction.current = true;
      const prevState = history[historyIndex - 1];
      setWorksheet(JSON.parse(JSON.stringify(prevState)));
      setHistoryIndex(historyIndex - 1);
    }
  }, [history, historyIndex]);
  
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      isUndoRedoAction.current = true;
      const nextState = history[historyIndex + 1];
      setWorksheet(JSON.parse(JSON.stringify(nextState)));
      setHistoryIndex(historyIndex + 1);
    }
  }, [history, historyIndex]);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z for undo
      if (e.ctrlKey && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
      // Ctrl+Shift+Z or Ctrl+Y for redo
      if ((e.ctrlKey && e.shiftKey && e.key === 'Z') || (e.ctrlKey && e.key === 'y')) {
        e.preventDefault();
        handleRedo();
      }
      // Ctrl+S for save
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        handleManualSave();
      }
      // Ctrl+Shift+E for export
      if (e.ctrlKey && e.shiftKey && e.key === 'E') {
        e.preventDefault();
        if (worksheet && !isExporting) {
          handleExport(worksheet);
        }
      }
      // Ctrl+Shift+D for debug panel
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setRightPanel(prev => prev === 'debug' ? null : 'debug');
        setRightPanelCollapsed(false);
      }
      // Ctrl+Shift+J for JSON editor
      if (e.ctrlKey && e.shiftKey && e.key === 'J') {
        e.preventDefault();
        setRightPanel(prev => prev === 'json' ? null : 'json');
        setRightPanelCollapsed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, worksheet, isExporting, handleExport]);
  
  // Initialize worksheet
  useEffect(() => {
    if (!id) return;
    
    const saved = getWorksheet(id);
    if (saved) {
      setWorksheet(saved);
    } else {
      setWorksheet(createEmptyWorksheet(id));
    }
  }, [id]);
  
  // Autosave
  useEffect(() => {
    if (!worksheet || !isDirty) return;
    
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    
    setSaveStatus('unsaved');
    
    autoSaveTimerRef.current = setTimeout(() => {
      performSave();
    }, 2000);
    
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [worksheet, isDirty]);
  
  // Perform save
  const performSave = useCallback(() => {
    if (!worksheet) return;
    
    setSaveStatus('saving');
    
    const updated: Worksheet = {
      ...worksheet,
      updatedAt: new Date().toISOString(),
    };
    
    saveToStorage(updated);
    
    setTimeout(() => {
      setSaveStatus('saved');
      setIsDirty(false);
    }, 500);
  }, [worksheet]);
  
  // Manual save
  const handleManualSave = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    performSave();
    toast.success('Uloženo');
  }, [performSave]);
  
  // Update worksheet
  const updateWorksheet = useCallback((updates: Partial<Worksheet> | ((prev: Worksheet) => Worksheet)) => {
    setWorksheet(prev => {
      if (!prev) return prev;
      const updated = typeof updates === 'function' ? updates(prev) : { ...prev, ...updates };
      return { ...updated, updatedAt: new Date().toISOString() };
    });
    setIsDirty(true);
  }, []);

  // Block operations - same as basic editor
  const addBlock = useCallback((type: BlockType, afterBlockId?: string) => {
    updateWorksheet(prev => {
      const gridColumns = prev.metadata.gridColumns || 12;
      const defaultGridSpan = Math.ceil(gridColumns / 2); // Default to half width
      const newBlock = { ...createEmptyBlock(type, prev.blocks.length), gridSpan: defaultGridSpan };
      let newBlocks: WorksheetBlock[];
      
      if (afterBlockId) {
        const index = prev.blocks.findIndex(b => b.id === afterBlockId);
        newBlocks = [
          ...prev.blocks.slice(0, index + 1),
          newBlock,
          ...prev.blocks.slice(index + 1),
        ];
      } else {
        newBlocks = [...prev.blocks, newBlock];
      }
      
      newBlocks = newBlocks.map((b, i) => ({ ...b, order: i }));
      return { ...prev, blocks: newBlocks };
    });
  }, [updateWorksheet]);

  const insertBlockAtIndex = useCallback((type: BlockType, index: number) => {
    updateWorksheet(prev => {
      const gridColumns = prev.metadata.gridColumns || 12;
      const defaultGridSpan = Math.ceil(gridColumns / 2); // Default to half width
      const safeIndex = Math.max(0, Math.min(index, prev.blocks.length));
      const newBlock = { ...createEmptyBlock(type, safeIndex), gridSpan: defaultGridSpan };
      const newBlocks = [
        ...prev.blocks.slice(0, safeIndex),
        newBlock,
        ...prev.blocks.slice(safeIndex),
      ].map((b, i) => ({ ...b, order: i }));

      return { ...prev, blocks: newBlocks };
    });
  }, [updateWorksheet]);

  const confirmInsertBefore = useCallback((targetBlockId: string) => {
    if (!pendingInsertType) return;
    updateWorksheet(prev => {
      const targetIndex = prev.blocks.findIndex(b => b.id === targetBlockId);
      if (targetIndex === -1) return prev;
      
      const gridColumns = prev.metadata.gridColumns || 12;
      const defaultGridSpan = Math.ceil(gridColumns / 2); // Default to half width
      const safeIndex = Math.max(0, targetIndex);
      const newBlock = { ...createEmptyBlock(pendingInsertType, safeIndex), gridSpan: defaultGridSpan };
      const newBlocks = [
        ...prev.blocks.slice(0, safeIndex),
        newBlock,
        ...prev.blocks.slice(safeIndex),
      ].map((b, i) => ({ ...b, order: i }));

      return { ...prev, blocks: newBlocks };
    });
    setPendingInsertType(null);
    setActivePanel('structure');
  }, [pendingInsertType, updateWorksheet]);

  const insertAtEnd = useCallback(() => {
    if (!pendingInsertType) return;
    updateWorksheet(prev => {
      const gridColumns = prev.metadata.gridColumns || 12;
      const defaultGridSpan = Math.ceil(gridColumns / 2); // Default to half width
      const index = prev.blocks.length;
      const newBlock = { ...createEmptyBlock(pendingInsertType, index), gridSpan: defaultGridSpan };
      const newBlocks = [...prev.blocks, newBlock].map((b, i) => ({ ...b, order: i }));
      return { ...prev, blocks: newBlocks };
    });
    setPendingInsertType(null);
    setActivePanel('structure');
  }, [pendingInsertType, updateWorksheet]);

  const cancelInsert = useCallback(() => {
    setPendingInsertType(null);
  }, []);

  // Drag and drop handlers
  const handleDragStartFromPanel = useCallback((type: BlockType) => {
    setIsDraggingFromPanel(true);
    setDraggingBlockType(type);
  }, []);

  const handleDragEndFromPanel = useCallback(() => {
    setIsDraggingFromPanel(false);
    setDraggingBlockType(null);
  }, []);

  const handleDropBlock = useCallback((type: BlockType, insertBeforeId: string | null) => {
    updateWorksheet(prev => {
      const gridColumns = prev.metadata.gridColumns || 12;
      const defaultGridSpan = Math.ceil(gridColumns / 2); // Default to half width
      let insertIndex = prev.blocks.length;
      
      if (insertBeforeId) {
        const targetIndex = prev.blocks.findIndex(b => b.id === insertBeforeId);
        if (targetIndex !== -1) {
          insertIndex = targetIndex;
        }
      }
      
      const newBlock = { ...createEmptyBlock(type, insertIndex), gridSpan: defaultGridSpan };
      const newBlocks = [
        ...prev.blocks.slice(0, insertIndex),
        newBlock,
        ...prev.blocks.slice(insertIndex),
      ].map((b, i) => ({ ...b, order: i }));
      
      return { ...prev, blocks: newBlocks };
    });
    
    setIsDraggingFromPanel(false);
    setDraggingBlockType(null);
    // Switch to structure panel after successful drop
    setActivePanel('structure');
  }, [updateWorksheet]);
  
  const deleteBlock = useCallback((blockId: string) => {
    updateWorksheet(prev => {
      const newBlocks = prev.blocks
        .filter(b => b.id !== blockId)
        .map((b, i) => ({ ...b, order: i }));
      return { ...prev, blocks: newBlocks };
    });
    
    if (selectedBlockId === blockId) {
      setSelectedBlockId(null);
    }
  }, [selectedBlockId, updateWorksheet]);
  
  const updateBlock = useCallback((blockId: string, updates: Partial<WorksheetBlock>) => {
    updateWorksheet(prev => ({
      ...prev,
      blocks: prev.blocks.map(b => {
        if (b.id !== blockId) return b;
        // If updates contains 'content', merge it with existing content
        if (updates.content) {
          return { 
            ...b, 
            ...updates,
            content: { ...b.content, ...updates.content }
          };
        }
        return { ...b, ...updates };
      })
    }));
  }, [updateWorksheet]);
  
  const updateBlockWidth = useCallback((blockId: string, width: BlockWidth, widthPercent?: number) => {
    updateWorksheet(prev => ({
      ...prev,
      blocks: prev.blocks.map(b =>
        b.id === blockId 
          ? { ...b, width, ...(widthPercent !== undefined && { widthPercent }) } 
          : b
      )
    }));
  }, [updateWorksheet]);

  const updateBlockMargin = useCallback((blockId: string, marginBottom: number) => {
    updateWorksheet(prev => ({
      ...prev,
      blocks: prev.blocks.map(b =>
        b.id === blockId ? { ...b, marginBottom } : b
      )
    }));
  }, [updateWorksheet]);

  const updateBlockOrder = useCallback((blockId: string, order: number) => {
    updateWorksheet(prev => ({
      ...prev,
      blocks: prev.blocks.map(b =>
        b.id === blockId ? { ...b, order } : b
      )
    }));
  }, [updateWorksheet]);

  const updateBlockMarginStyle = useCallback((blockId: string, marginStyle: 'empty' | 'dotted' | 'lined') => {
    updateWorksheet(prev => ({
      ...prev,
      blocks: prev.blocks.map(b =>
        b.id === blockId ? { ...b, marginStyle } : b
      )
    }));
  }, [updateWorksheet]);

  const updateBlockImage = useCallback((blockId: string, image: BlockImage | undefined) => {
    updateWorksheet(prev => ({
      ...prev,
      blocks: prev.blocks.map(b =>
        b.id === blockId ? { ...b, image } : b
      )
    }));
  }, [updateWorksheet]);

  const updateBlockVisualStyles = useCallback((blockId: string, visualStyles: any) => {
    updateWorksheet(prev => ({
      ...prev,
      blocks: prev.blocks.map(b =>
        b.id === blockId ? { ...b, visualStyles } : b
      )
    }));
  }, [updateWorksheet]);

  const duplicateBlock = useCallback((blockId: string) => {
    updateWorksheet(prev => {
      const blockIndex = prev.blocks.findIndex(b => b.id === blockId);
      if (blockIndex === -1) return prev;
      
      const originalBlock = prev.blocks[blockIndex];
      const newBlock: WorksheetBlock = {
        ...JSON.parse(JSON.stringify(originalBlock)),
        id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      };
      
      const newBlocks = [
        ...prev.blocks.slice(0, blockIndex + 1),
        newBlock,
        ...prev.blocks.slice(blockIndex + 1),
      ].map((b, i) => ({ ...b, order: i }));
      
      return { ...prev, blocks: newBlocks };
    });
  }, [updateWorksheet]);

  // Move block (for drag & drop)
  const moveBlock = useCallback((activeId: string, overId: string) => {
    updateWorksheet(prev => {
      if (activeId === overId) return prev;
      
      const oldIndex = prev.blocks.findIndex(b => b.id === activeId);
      const newIndex = prev.blocks.findIndex(b => b.id === overId);
      
      if (oldIndex === -1 || newIndex === -1) return prev;
      
      const newBlocks = arrayMove(prev.blocks, oldIndex, newIndex)
        .map((b, i) => ({ ...b, order: i }));
      
      return { ...prev, blocks: newBlocks };
    });
  }, [updateWorksheet]);

  const moveBlockUp = useCallback((blockId: string) => {
    updateWorksheet(prev => {
      const currentIndex = prev.blocks.findIndex(b => b.id === blockId);
      if (currentIndex <= 0) return prev;
      
      const newBlocks = arrayMove(prev.blocks, currentIndex, currentIndex - 1)
        .map((b, i) => ({ ...b, order: i }));
      
      return { ...prev, blocks: newBlocks };
    });
  }, [updateWorksheet]);

  const moveBlockDown = useCallback((blockId: string) => {
    updateWorksheet(prev => {
      const currentIndex = prev.blocks.findIndex(b => b.id === blockId);
      if (currentIndex === -1 || currentIndex >= prev.blocks.length - 1) return prev;
      
      const newBlocks = arrayMove(prev.blocks, currentIndex, currentIndex + 1)
        .map((b, i) => ({ ...b, order: i }));
      
      return { ...prev, blocks: newBlocks };
    });
  }, [updateWorksheet]);

  // Drag & Drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const [activeId, setActiveId] = useState<string | null>(null);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (over && active.id !== over.id) {
      moveBlock(active.id as string, over.id as string);
    }
  }, [moveBlock]);

  // Block selection
  const handleSelectBlock = useCallback((blockId: string | null) => {
    setForceAIOpen(false);
    if (blockId === null) {
      setSelectedBlockId(null);
      setIsBlockSettingsOpen(false);
    } else {
      setSelectedBlockId(blockId);
      setIsBlockSettingsOpen(true);
    }
  }, []);

  const handleCloseBlockSettings = useCallback(() => {
    setIsBlockSettingsOpen(false);
    setSelectedBlockId(null);
    setForceAIOpen(false);
  }, []);

  // Back navigation
  const handleBack = useCallback(() => {
    if (saveStatus === 'saving') return;
    if (isDirty && worksheet) {
      saveToStorage(worksheet);
    }
    navigate('/admin');
  }, [saveStatus, isDirty, worksheet, navigate]);

  // Set hovered block (no scroll - scroll only from sidebar)
  const handleHoverBlock = useCallback((blockId: string | null) => {
    setHoveredBlockId(blockId);
  }, []);

  // Get selected block
  const selectedBlock = worksheet?.blocks.find(b => b.id === selectedBlockId);
  
  if (!worksheet) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }
  
  return (
    <div className="h-screen bg-slate-100 flex overflow-hidden worksheet-editor-pro">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 flex overflow-hidden relative worksheet-editor-main">
          {/* Mini Sidebar - always visible */}
          <ProMiniSidebar
            activePanel={activePanel}
            onPanelChange={setActivePanel}
            saveStatus={saveStatus}
            onOpenHistory={() => setShowVersionHistory(true)}
            hasUnsavedVersions={versionHistory.hasUnsavedChanges}
            workbookId={workbookId}
          />
          
          {/* Main Panel - PRO panels + basic editor panels */}
          {activePanel !== 'ai' && (
            <aside style={{ width: '300px', minWidth: '300px', maxWidth: '300px' }} className="flex-shrink-0 border-r border-[#334155] bg-[#1e293b] overflow-y-auto">
              {/* Block Settings Panel - shows when a block is selected */}
              {isBlockSettingsOpen && selectedBlock ? (
                <ProBlockSettingsPanel
                  block={selectedBlock}
                  onClose={handleCloseBlockSettings}
                  onUpdateBlock={updateBlock}
                  onDeleteBlock={deleteBlock}
                  onDuplicateBlock={duplicateBlock}
                  onMoveUp={moveBlockUp}
                  onMoveDown={moveBlockDown}
                  canMoveUp={worksheet.blocks.findIndex(b => b.id === selectedBlock.id) > 0}
                  canMoveDown={worksheet.blocks.findIndex(b => b.id === selectedBlock.id) < worksheet.blocks.length - 1}
                  gridColumns={worksheet.metadata.gridColumns || 12}
                />
              ) : (
                <>
                  {/* PRO: Sheet Settings Panel */}
                  {activePanel === 'sheet-settings' && (
                    <SheetSettingsPanel
                      gridColumns={worksheet.metadata.gridColumns || 12}
                      gridGap={worksheet.metadata.gridGap || 'medium'}
                      globalFontSize={worksheet.metadata.globalFontSize || 'small'}
                      pageFormat={pageFormat}
                      layoutMode={worksheet.metadata.layoutMode || 'grid'}
                      onGridColumnsChange={(gridColumns) => {
                        setWorksheet(prev => {
                          if (!prev) return prev;
                          return {
                            ...prev,
                            metadata: { ...prev.metadata, gridColumns },
                            // Reset all blocks to full span when changing grid
                            blocks: prev.blocks.map(block => ({
                              ...block,
                              gridSpan: gridColumns,
                            }))
                          };
                        });
                      }}
                      onGridGapChange={(gridGap) => {
                        setWorksheet(prev => {
                          if (!prev) return prev;
                          return {
                            ...prev,
                            metadata: { ...prev.metadata, gridGap }
                          };
                        });
                      }}
                      onGlobalFontSizeChange={(globalFontSize) => {
                        setWorksheet(prev => {
                          if (!prev) return prev;
                          return {
                            ...prev,
                            metadata: { ...prev.metadata, globalFontSize }
                          };
                        });
                      }}
                      onLayoutModeChange={(layoutMode) => {
                        setWorksheet(prev => {
                          if (!prev) return prev;
                          return {
                            ...prev,
                            metadata: { ...prev.metadata, layoutMode }
                          };
                        });
                      }}
                      showGridOverlay={showGridOverlay}
                      onShowGridOverlayChange={setShowGridOverlay}
                      pageBackgroundColor={worksheet.metadata.pageBackgroundColor}
                      onPageBackgroundColorChange={(pageBackgroundColor) => {
                        setWorksheet(prev => {
                          if (!prev) return prev;
                          return {
                            ...prev,
                            metadata: { ...prev.metadata, pageBackgroundColor }
                          };
                        });
                      }}
                    />
                  )}

                  {activePanel === 'settings' && (
                    <ProSettingsPanel
                      worksheet={worksheet}
                      onUpdateWorksheet={updateWorksheet}
                    />
                  )}
                  
                  {activePanel === 'structure' && (
                    <ProStructurePanel
                      worksheet={worksheet}
                      selectedBlockId={selectedBlockId}
                      onSelectBlock={handleSelectBlock}
                      onHoverBlock={handleHoverBlock}
                      onAddBlock={addBlock}
                    />
                  )}
                  
                  {activePanel === 'add' && (
                    <ProAddContentPanel
                      onAddBlock={(type) => setPendingInsertType(type)}
                      pendingInsertType={pendingInsertType}
                      onInsertAtEnd={insertAtEnd}
                      onCancelInsert={cancelInsert}
                      onDragStart={handleDragStartFromPanel}
                      onDragEnd={handleDragEndFromPanel}
                    />
                  )}
                </>
              )}
            </aside>
          )}
          
          {/* AI Panel - Full width when active */}
          {activePanel === 'ai' && (
            <aside 
              className="flex-shrink-0 border-r border-[#334155] bg-[#1e293b] flex flex-col"
              style={{ width: '300px', minWidth: '300px', maxWidth: '300px' }}
            >
              <AIChatPanel
                worksheet={worksheet}
                onAddBlocks={(blocks) => {
                  if (!worksheet) return;
                  const startOrder = worksheet.blocks.length;
                  const newBlocks = blocks.map((block, idx) => ({
                    ...block,
                    order: startOrder + idx,
                  }));
                  updateWorksheet({
                    blocks: [...worksheet.blocks, ...newBlocks],
                  });
                  if (newBlocks.length > 0) {
                    setSelectedBlockId(newBlocks[0].id);
                    setActivePanel('structure');
                  }
                }}
                onUpdateWorksheet={updateWorksheet}
                onReplaceBlocks={(blocks) => {
                  if (!worksheet) return;
                  updateWorksheet({ blocks });
                }}
                onClose={() => setActivePanel('structure')}
              />
            </aside>
          )}
          
          {/* Main Canvas Area */}
          <main 
            className="flex-1 overflow-auto print:p-0 print:bg-white print:overflow-visible relative" 
            style={{ 
              padding: '24px', 
              backgroundColor: '#0f172a',  /* slate-900 - dark mode background */
              color: '#e2e8f0'  /* slate-200 */
            }}
          >
            {/* Undo/Redo Floating Controls */}
            <div style={{
              position: 'fixed',
              top: '12px',
              right: '24px',
              display: 'flex',
              gap: '8px',
              zIndex: 100,
              backgroundColor: '#1e293b',
              padding: '4px',
              borderRadius: '8px',
              border: '1px solid #334155',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}>
              <button
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                style={{
                  padding: '6px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: historyIndex <= 0 ? 'not-allowed' : 'pointer',
                  color: historyIndex <= 0 ? '#475569' : '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'all 0.1s ease',
                }}
                title="Zpět (Ctrl+Z)"
                onMouseEnter={(e) => { if (historyIndex > 0) e.currentTarget.style.backgroundColor = '#334155'; }}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <Undo2 size={18} />
              </button>
              <div style={{ width: '1px', backgroundColor: '#334155', margin: '4px 0' }} />
              <button
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                style={{
                  padding: '6px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: historyIndex >= history.length - 1 ? 'not-allowed' : 'pointer',
                  color: historyIndex >= history.length - 1 ? '#475569' : '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'all 0.1s ease',
                }}
                title="Vpřed (Ctrl+Shift+Z)"
                onMouseEnter={(e) => { if (historyIndex < history.length - 1) e.currentTarget.style.backgroundColor = '#334155'; }}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <Redo2 size={18} />
              </button>
            </div>

            {/* Canvas wrapper with zoom */}
            <div 
              style={{ 
                transform: `scale(${canvasZoom})`,
                transformOrigin: 'top center',
                // Compensate for the scale to prevent content from being cut off
                marginBottom: canvasZoom < 1 ? `-${(1 - canvasZoom) * 100}%` : 0,
              }}
            >
            {/* Conditional rendering based on layout mode */}
            {worksheet.metadata.layoutMode === 'freeform' ? (
              /* FREEFORM MODE - for manual creative editing */
              <FreeformCanvas
                blocks={worksheet.blocks}
                selectedBlockId={selectedBlockId}
                hoveredBlockId={hoveredBlockId}
                onSelectBlock={handleSelectBlock}
                onUpdateBlock={updateBlock}
                onUpdateBlockMargin={updateBlockMargin}
                onUpdateBlockOrder={updateBlockOrder}
                onDeleteBlock={deleteBlock}
                onDuplicateBlock={duplicateBlock}
                onAddBlock={addBlock}
                onSwitchToAI={() => setActivePanel('ai')}
                onOpenAddPanel={() => setActivePanel('add')}
                onOpenAI={() => setForceAIOpen(true)}
                globalFontSize={worksheet.metadata.globalFontSize}
                pageFormat={pageFormat}
                showGridOverlay={showGridOverlay}
                gridColumns={worksheet.metadata.gridColumns || 12}
                gridGapPx={
                  worksheet.metadata.gridGap === 'none' ? 0 :
                  worksheet.metadata.gridGap === 'small' ? 8 :
                  worksheet.metadata.gridGap === 'large' ? 24 : 16
                }
                onUpdateBlockPosition={(blockId, x, y, pageIndex) => {
                  setWorksheet(prev => {
                    if (!prev) return prev;
                    return {
                      ...prev,
                      blocks: prev.blocks.map(b => 
                        b.id === blockId ? { ...b, posX: x, posY: y, pageIndex } : b
                      )
                    };
                  });
                }}
                onUpdateBlockSize={(blockId, width, height) => {
                  setWorksheet(prev => {
                    if (!prev) return prev;
                    return {
                      ...prev,
                      blocks: prev.blocks.map(b => 
                        b.id === blockId ? { ...b, blockWidth: width, blockHeight: height } : b
                      )
                    };
                  });
                }}
                pageBackgroundColor={worksheet.metadata.pageBackgroundColor}
              />
            ) : (
              /* GRID MODE (default) - for AI generation */
              <GridCanvas
                blocks={worksheet.blocks}
                selectedBlockId={selectedBlockId}
                hoveredBlockId={hoveredBlockId}
                onSelectBlock={handleSelectBlock}
                onHoverBlock={handleHoverBlock}
                onUpdateBlock={updateBlock}
                onUpdateBlockMargin={updateBlockMargin}
                onUpdateBlockGridSpan={(blockId, gridSpan, gridStart) => {
                  setWorksheet(prev => {
                    if (!prev) return prev;
                    return {
                      ...prev,
                      blocks: prev.blocks.map(b => 
                        b.id === blockId ? { ...b, gridSpan, gridStart } : b
                      )
                    };
                  });
                }}
                onDeleteBlock={deleteBlock}
                onDuplicateBlock={duplicateBlock}
                onMoveBlockUp={moveBlockUp}
                onMoveBlockDown={moveBlockDown}
                onAddBlock={addBlock}
                onSwitchToAI={() => setActivePanel('ai')}
                onOpenAddPanel={() => setActivePanel('add')}
                onOpenAI={() => setForceAIOpen(true)}
                globalFontSize={worksheet.metadata.globalFontSize}
                pageFormat={pageFormat}
                gridColumns={worksheet.metadata.gridColumns || 12}
                gridGapPx={
                  worksheet.metadata.gridGap === 'none' ? 0 :
                  worksheet.metadata.gridGap === 'small' ? 8 :
                  worksheet.metadata.gridGap === 'large' ? 24 : 16
                }
                showGridOverlay={showGridOverlay}
                pendingInsertType={pendingInsertType}
                onInsertBefore={confirmInsertBefore}
                isDraggingFromPanel={isDraggingFromPanel}
                onDropBlock={handleDropBlock}
                pageBackgroundColor={worksheet.metadata.pageBackgroundColor}
              />
            )}
            </div>{/* End zoom wrapper */}
          </main>
          
        </div>
        
        {/* Right Panel - Debug/JSON (Pro features) */}
        {!rightPanelCollapsed && rightPanel && (
          <aside style={{ width: '300px', minWidth: '300px', maxWidth: '300px' }} className="flex-shrink-0 border-l border-[#334155] bg-[#1e293b] overflow-hidden">
            {rightPanel === 'debug' && (
              <DebugPanel
                worksheet={worksheet}
                selectedBlockId={selectedBlockId}
                onClose={() => setRightPanelCollapsed(true)}
              />
            )}
            
            {rightPanel === 'json' && (
              <JsonEditorPanel
                worksheet={worksheet}
                onUpdateWorksheet={(updated) => {
                  setWorksheet(updated);
                  setIsDirty(true);
                }}
                onClose={() => setRightPanelCollapsed(true)}
              />
            )}
          </aside>
        )}
      </DndContext>
      
      {/* Hidden printable worksheet */}
      {worksheet && (
        <div style={{ position: 'absolute', left: '-9999px', top: 0, opacity: 0, pointerEvents: 'none' }}>
          <PrintableWorksheet ref={printRef} worksheet={worksheet} />
        </div>
      )}
      
      {/* Version History Modal */}
      {showVersionHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
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
    </div>
  );
}
