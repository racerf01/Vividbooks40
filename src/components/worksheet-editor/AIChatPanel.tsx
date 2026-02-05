/**
 * AIChatPanel - AI Chat panel pro editor pracovních listů
 * 
 * Tři režimy:
 * 1. Vytvořit - generuje nové bloky, uživatel vybírá a vkládá
 * 2. Upravit - přímo upravuje existující obsah v listu
 * 3. Z Vividbooks - výběr dokumentů z knihovny a generování obsahu
 */

import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2, Sparkles, Trash2, ChevronRight, Check, Plus, FileText, HelpCircle, CheckCircle2, PenLine, BookOpen, Info, Pencil, FilePlus, ArrowLeft, RotateCcw, Folder, FolderOpen, ChevronDown, Library, ClipboardList, FileEdit, ImageIcon, X } from 'lucide-react';
import { Button } from '../ui/button';
import { AIMessage, AIAction } from '../../types/worksheet-editor';
import { Worksheet, WorksheetBlock, generateBlockId, ImageBlock } from '../../types/worksheet';
import { StoredFile, StoredLink } from '../../types/file-storage';
import { getWorksheetList, getWorksheetsInFolder, WorksheetListItem } from '../../utils/worksheet-storage';
import { useAIChat } from '../../hooks/useAIChat';
import { FolderUp, Link2 } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { DOCUMENT_TYPES } from '../../types/document-types';
import { useAnalytics } from '../../hooks/useAnalytics';
import { extractImagesFromHtml, ExtractedImage, formatImagesForPrompt } from '../../utils/extract-images';
import { processImagesWithLottieScreenshots } from '../../utils/lottie-screenshot';
import { searchImagesForWorksheet, UnsplashImage, trackDownload } from '../../utils/unsplash-search';
import { ImageSelectionStep, ImageOption } from './ImageSelectionStep';

type AIMode = 'select' | 'create' | 'edit' | 'from-docs' | 'from-my-content';
type FromDocsStep = 'browse' | 'select-type' | 'select-images' | 'generating';
type FromMyContentStep = 'browse' | 'select-type' | 'generating';
type ContentType = 'test' | 'worksheet' | 'text';

// MenuItem structure from Vividbooks library
interface MenuItem {
  id: string;
  label: string;
  slug?: string;
  type?: string;
  icon?: string;
  color?: string;
  children?: MenuItem[];
}

// Helper to check if item is a folder (has children or is explicitly a folder/group type)
const isFolder = (item: MenuItem): boolean => {
  return !!(item.children && item.children.length > 0) || 
         item.type === 'folder' || 
         item.type === 'group';
};

// Get the identifier to use for a menu item (prefer slug, fallback to id)
const getItemIdentifier = (item: MenuItem): string | null => {
  // Use slug if available, otherwise use id
  return item.slug || item.id || null;
};

// Helper to check if item is a document we want to include (not a workbook)
const isSelectableDocument = (item: MenuItem): boolean => {
  // Must have some identifier (slug or id)
  if (!item.slug && !item.id) return false;
  // Exclude workbooks - we only want lessons, tests, experiments etc.
  if (item.type === 'workbook') return false;
  // If it's a folder, it's not a document
  if (isFolder(item)) return false;
  return true;
};

// Normalize item type for display
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

// Available subjects
const SUBJECTS = [
  { id: 'fyzika', label: 'Fyzika', color: '#7c3aed' },
  { id: 'chemie', label: 'Chemie', color: '#ef4444' },
  { id: 'prirodopis', label: 'Přírodopis', color: '#22c55e' },
  { id: 'matematika', label: 'Matematika', color: '#3b82f6' },
  { id: 'dejepis', label: 'Dějepis', color: '#d97706' },
];

interface AIChatPanelProps {
  worksheet: Worksheet;
  onAddBlocks: (blocks: WorksheetBlock[]) => void;
  onUpdateWorksheet: (updates: Partial<Worksheet>) => void;
  onReplaceBlocks?: (blocks: WorksheetBlock[]) => void;
  onClose?: () => void;
}

export function AIChatPanel({
  worksheet,
  onAddBlocks,
  onUpdateWorksheet,
  onReplaceBlocks,
  onClose,
}: AIChatPanelProps) {
  const hasContent = worksheet?.blocks && worksheet.blocks.length > 0;
  
  // Mode state - always start with 'select' to show options
  const [mode, setMode] = useState<AIMode>('select');
  
  // Navigation back handler - goes back within AI panel or closes if at root
  const handleBack = () => {
    if (mode === 'from-docs') {
      // Navigate within from-docs workflow
      if (fromDocsStep === 'select-images') {
        setFromDocsStep('select-type');
      } else if (fromDocsStep === 'select-type') {
        setFromDocsStep('browse');
      } else if (fromDocsStep === 'browse' && activeSubject) {
        setActiveSubject(null);
      } else {
        setMode('select');
      }
    } else if (mode === 'from-my-content') {
      // Navigate within from-my-content workflow
      if (fromMyContentStep === 'select-type') {
        setFromMyContentStep('browse');
      } else {
        setMode('select');
      }
    } else if (mode === 'edit' || mode === 'create') {
      setMode('select');
    } else {
      // At root (select mode) - close the panel
      onClose?.();
    }
  };
  
  // Close panel handler
  const handleClose = () => {
    onClose?.();
  };
  
  // Edit mode state
  const [editMessages, setEditMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [editInput, setEditInput] = useState('');
  const [isEditLoading, setIsEditLoading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [originalBlocks, setOriginalBlocks] = useState<WorksheetBlock[] | null>(null);
  
  // From-docs mode state
  const [fromDocsStep, setFromDocsStep] = useState<FromDocsStep>('browse');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [selectedContentType, setSelectedContentType] = useState<ContentType | null>(null);
  const [isGeneratingFromDocs, setIsGeneratingFromDocs] = useState(false);
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [libraryMenu, setLibraryMenu] = useState<MenuItem[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);
  
  // Analytics
  const analytics = useAnalytics();
  const [loadedPages, setLoadedPages] = useState<Map<string, string>>(new Map());

  // From-my-content mode state
  const [fromMyContentStep, setFromMyContentStep] = useState<FromMyContentStep>('browse');
  const [myFiles, setMyFiles] = useState<StoredFile[]>([]);
  const [myLinks, setMyLinks] = useState<StoredLink[]>([]);
  const [myFolders, setMyFolders] = useState<{ id: string; name: string; color?: string; children?: any[] }[]>([]);
  const [myDocuments, setMyDocuments] = useState<{ id: string; name: string; type: string; content?: string }[]>([]);
  const [myWorksheets, setMyWorksheets] = useState<WorksheetListItem[]>([]);
  const [selectedMyContent, setSelectedMyContent] = useState<Set<string>>(new Set());
  const [expandedMyFolders, setExpandedMyFolders] = useState<Set<string>>(new Set());
  const [isGeneratingFromMyContent, setIsGeneratingFromMyContent] = useState(false);
  const [myContentType, setMyContentType] = useState<ContentType | null>(null);
  
  const {
    messages,
    isLoading,
    inputValue,
    setInputValue,
    sendMessage,
    applyAction,
    clearChat,
    quickPrompts,
  } = useAIChat({
    worksheet,
    onAddBlocks,
    onUpdateWorksheet,
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const editScrollRef = useRef<HTMLDivElement>(null);
  const [showQuickPrompts, setShowQuickPrompts] = useState(true);

  // Track selected blocks per message
  const [selectedBlocks, setSelectedBlocks] = useState<Map<string, Set<string>>>(new Map());
  
  // Store extracted images from documents to add after AI generation
  const [pendingImages, setPendingImages] = useState<ExtractedImage[]>([]);
  
  // Unsplash image search - DISABLED by default, user must select images manually
  const [searchUnsplash, setSearchUnsplash] = useState(false);
  const [isSearchingImages, setIsSearchingImages] = useState(false);
  
  // Store fetched content for image selection step
  const [fetchedContent, setFetchedContent] = useState<{ text: string; images: ExtractedImage[] } | null>(null);

  // Scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    if (editScrollRef.current) {
      editScrollRef.current.scrollTop = editScrollRef.current.scrollHeight;
    }
  }, [editMessages, isEditLoading]);

  // Store additional image blocks per message (keyed by message ID)
  const [messageImageBlocks, setMessageImageBlocks] = useState<Map<string, WorksheetBlock[]>>(new Map());
  
  // Helper to get all blocks for a message (AI generated + images)
  const getMessageBlocks = (msg: AIMessage): WorksheetBlock[] => {
    const aiBlocks = msg.generatedBlocks || [];
    const imageBlocks = messageImageBlocks.get(msg.id) || [];
    return [...aiBlocks, ...imageBlocks];
  };
  
  // Initialize selection for new messages with blocks
  useEffect(() => {
    let hasChanges = false;
    const newMap = new Map(selectedBlocks);
    
    messages.forEach(msg => {
      const allBlocks = getMessageBlocks(msg);
      if (allBlocks.length > 0 && !msg.applied && !newMap.has(msg.id)) {
        newMap.set(msg.id, new Set(allBlocks.map(b => b.id)));
        hasChanges = true;
      }
    });

    if (hasChanges) {
      setSelectedBlocks(newMap);
    }
  }, [messages, messageImageBlocks]);
  
  // Add pending images to newly generated messages
  // RULE: Every image = HALF width, paired with HALF width content block!
  // Images are EVENLY distributed - NEVER at the end, NEVER full width!
  useEffect(() => {
    if (pendingImages.length === 0) return;
    
    const latestMessageWithBlocks = [...messages].reverse().find(
      msg => msg.generatedBlocks && 
             msg.generatedBlocks.length > 0 && 
             !msg.applied && 
             !messageImageBlocks.has(msg.id)
    );
    
    if (latestMessageWithBlocks) {
      console.log('[AI Layout] Adding', pendingImages.length, 'images as HALF-WIDTH PAIRS');
      
      // IMPORTANT: Remove any AI-generated image blocks - we only use user-selected images!
      const aiBlocksRaw = latestMessageWithBlocks.generatedBlocks!;
      const aiBlocks = aiBlocksRaw.filter(b => b.type !== 'image');
      if (aiBlocksRaw.length !== aiBlocks.length) {
        console.log('[AI Layout] Removed', aiBlocksRaw.length - aiBlocks.length, 'AI-generated images');
      }
      
      const suitableBlockTypes = ['paragraph', 'infobox', 'multiple-choice', 'fill-blank', 'free-answer'];
      
      // Find suitable blocks (not first, not last 2)
      const suitableIndices: number[] = [];
      aiBlocks.forEach((b, i) => {
        if (suitableBlockTypes.includes(b.type) && i > 0 && i < aiBlocks.length - 2) {
          suitableIndices.push(i);
        }
      });
      
      // Fallback
      if (suitableIndices.length === 0) {
        aiBlocks.forEach((b, i) => {
          if (suitableBlockTypes.includes(b.type) && i > 0) {
            suitableIndices.push(i);
          }
        });
      }
      
      // Only use as many images as we have positions
      const numImages = Math.min(pendingImages.length, suitableIndices.length);
      const imagePositions: number[] = [];
      
      if (numImages > 0) {
        const useableCount = Math.max(1, Math.ceil(suitableIndices.length * 0.9));
        for (let i = 0; i < numImages; i++) {
          const idx = Math.floor(i * useableCount / numImages);
          const pos = suitableIndices[Math.min(idx, suitableIndices.length - 1)];
          if (!imagePositions.includes(pos)) {
            imagePositions.push(pos);
          }
        }
      }
      
      console.log('[AI Layout] Blocks:', aiBlocks.length, 'Suitable:', suitableIndices, 'ImagePos:', imagePositions);
      
      const modifiedBlocks: WorksheetBlock[] = [];
      let imageIndex = 0;
      
      for (let i = 0; i < aiBlocks.length; i++) {
        const block = { ...aiBlocks[i] };
        
        if (imageIndex < imagePositions.length && i === imagePositions[imageIndex]) {
          // PAIR: content (half) + image (half) - ALWAYS side by side!
          block.width = 'half';
          modifiedBlocks.push(block);
          
          const img = pendingImages[imageIndex];
          const imageBlock: ImageBlock = {
            id: generateBlockId(),
            type: 'image' as const,
            order: modifiedBlocks.length,
            width: 'half' as const, // ALWAYS half - never full!
            content: {
              url: img.url || '',
              alt: img.alt || '',
              caption: img.caption || '',
              size: 'full' as const,
              alignment: 'center' as 'left' | 'center' | 'right',
            },
          };
          
          modifiedBlocks.push(imageBlock);
          imageIndex++;
          
          console.log('[AI Layout] PAIR at', i, ': content(half) + image(half)');
        } else {
          block.width = 'full';
          modifiedBlocks.push(block);
        }
      }
      
      // NO leftover images - only paired ones!
      
      // Update order numbers
      modifiedBlocks.forEach((block, idx) => {
        block.order = idx;
      });
      
      // Count for logging
      const imageCount = modifiedBlocks.filter(b => b.type === 'image').length;
      const contentCount = modifiedBlocks.length - imageCount;
      
      console.log('[AI Layout] Final:', contentCount, 'content +', imageCount, 'images INTERSPERSED');
      console.log('[AI Layout] Block order:', modifiedBlocks.map(b => b.type).join(', '));
      
      // IMPORTANT: Store ALL blocks together (content + images in correct order)
      // Do NOT separate them - this keeps images where they belong!
      latestMessageWithBlocks.generatedBlocks = modifiedBlocks as WorksheetBlock[];
      
      // DON'T store images separately anymore - they're already in generatedBlocks
      // setMessageImageBlocks is NOT used for this case
      
      // Update selection to include all blocks
      setSelectedBlocks(prev => {
        const newMap = new Map(prev);
        const allBlockIds = new Set(modifiedBlocks.map(b => b.id));
        newMap.set(latestMessageWithBlocks.id, allBlockIds);
        return newMap;
      });
      
      // Clear pending images
      setPendingImages([]);
    }
  }, [messages, pendingImages, messageImageBlocks]);
  
  // Track which messages have had Unsplash search done
  const unsplashSearchedRef = useRef<Set<string>>(new Set());
  
  // Search Unsplash for images when AI generates blocks (if enabled and no pending images)
  useEffect(() => {
    if (!searchUnsplash || pendingImages.length > 0 || isSearchingImages) return;
    
    // Find the latest message with generated blocks that hasn't had Unsplash search
    const latestMessageWithBlocks = [...messages].reverse().find(
      msg => msg.generatedBlocks && 
             msg.generatedBlocks.length > 0 && 
             !msg.applied && 
             !unsplashSearchedRef.current.has(msg.id) &&
             !messageImageBlocks.has(msg.id)
    );
    
    if (latestMessageWithBlocks) {
      unsplashSearchedRef.current.add(latestMessageWithBlocks.id);
      
      // Extract topic from the message content or worksheet
      const topic = worksheet?.metadata?.topic || worksheet?.title || '';
      const messageText = latestMessageWithBlocks.content || '';
      
      // Search Unsplash
      setIsSearchingImages(true);
      console.log('[Unsplash] Searching images for:', topic, messageText.substring(0, 100));
      
      searchImagesForWorksheet(topic, undefined, messageText)
        .then(images => {
          if (images.length > 0) {
            console.log('[Unsplash Layout] Found', images.length, 'images - NO images at end!');
            
            const selectedImages = images.slice(0, 3);
            
            // IMPORTANT: Remove any AI-generated image blocks first!
            const aiBlocksRaw = latestMessageWithBlocks.generatedBlocks!;
            const aiBlocks = aiBlocksRaw.filter(b => b.type !== 'image');
            if (aiBlocksRaw.length !== aiBlocks.length) {
              console.log('[Unsplash] Removed', aiBlocksRaw.length - aiBlocks.length, 'AI-generated images');
            }
            
            // Track downloads (Unsplash API requirement)
            selectedImages.forEach(img => trackDownload(img.downloadUrl));
            
            // Find suitable blocks (not first, not last 2)
            const suitableBlockTypes = ['paragraph', 'infobox', 'multiple-choice', 'fill-blank', 'free-answer'];
            const suitableIndices: number[] = [];
            aiBlocks.forEach((b, i) => {
              if (suitableBlockTypes.includes(b.type) && i > 0 && i < aiBlocks.length - 2) {
                suitableIndices.push(i);
              }
            });
            
            // Fallback
            if (suitableIndices.length === 0) {
              aiBlocks.forEach((b, i) => {
                if (suitableBlockTypes.includes(b.type) && i > 0) {
                  suitableIndices.push(i);
                }
              });
            }
            
            // Only use as many images as we have positions
            const numImages = Math.min(selectedImages.length, suitableIndices.length);
            const imagePositions: number[] = [];
            
            if (numImages > 0) {
              const useableCount = Math.max(1, Math.ceil(suitableIndices.length * 0.9));
              for (let i = 0; i < numImages; i++) {
                const idx = Math.floor(i * useableCount / numImages);
                const pos = suitableIndices[Math.min(idx, suitableIndices.length - 1)];
                if (!imagePositions.includes(pos)) {
                  imagePositions.push(pos);
                }
              }
            }
            
            console.log('[Unsplash] Blocks:', aiBlocks.length, 'ImagePos:', imagePositions);
            
            // Build new blocks with images as HALF-WIDTH PAIRS
            const newBlocks: WorksheetBlock[] = [];
            let imageIdx = 0;
            
            for (let i = 0; i < aiBlocks.length; i++) {
              const block = { ...aiBlocks[i] };
              
              if (imageIdx < imagePositions.length && i === imagePositions[imageIdx]) {
                // PAIR: content (half) + image (half)
                block.width = 'half';
                newBlocks.push(block);
                
                const img = selectedImages[imageIdx];
                newBlocks.push({
                  id: generateBlockId(),
                  type: 'image' as const,
                  order: newBlocks.length,
                  width: 'half' as const, // ALWAYS half!
                  content: {
                    url: img.url,
                    alt: img.alt,
                    caption: `${img.alt} (Foto: ${img.author})`,
                    size: 'full' as const,
                    alignment: 'center' as const,
                  },
                } as ImageBlock);
                imageIdx++;
                console.log('[Unsplash] PAIR at', i, ': content(half) + image(half)');
              } else {
                block.width = 'full';
                newBlocks.push(block);
              }
            }
            
            // Update order
            newBlocks.forEach((b, idx) => { b.order = idx; });
            
            const imageCount = newBlocks.filter(b => b.type === 'image').length;
            console.log('[Unsplash] Final:', newBlocks.length - imageCount, 'content +', imageCount, 'images as PAIRS');
            
            // Store all blocks together (images are already interspersed)
            latestMessageWithBlocks.generatedBlocks = newBlocks;
            
            // Update selection
            setSelectedBlocks(prev => {
              const newMap = new Map(prev);
              newMap.set(latestMessageWithBlocks.id, new Set(newBlocks.map(b => b.id)));
              return newMap;
            });
          }
        })
        .catch(err => console.warn('[Unsplash] Search failed:', err))
        .finally(() => setIsSearchingImages(false));
    }
  }, [messages, searchUnsplash, pendingImages, messageImageBlocks, worksheet, isSearchingImages]);

  // Start edit mode - save original blocks for potential revert
  const startEditMode = () => {
    if (!worksheet?.blocks) return;
    setOriginalBlocks([...worksheet.blocks]);
    setMode('edit');
    setEditMessages([{
      role: 'assistant',
      content: 'Co chcete s obsahem udělat? Mohu ho přeložit, zjednodušit, rozšířit, opravit pravopis...'
    }]);
  };

  // Handle edit mode message send
  const handleEditSend = async () => {
    if (!editInput.trim() || isEditLoading) return;
    
    const userMessage = editInput.trim();
    setEditMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setEditInput('');
    setIsEditLoading(true);

    try {
      const currentBlocks = worksheet?.blocks || [];
      console.log('[Edit] Current blocks count:', currentBlocks.length);
      
      if (currentBlocks.length === 0) {
        setEditMessages(prev => [...prev, { 
          role: 'assistant', 
          content: 'Pracovní list je prázdný. Nejprve přidejte nějaký obsah, který můžu upravit.'
        }]);
        setIsEditLoading(false);
        return;
      }
      
      const prompt = buildEditPrompt(userMessage, currentBlocks);
      console.log('[Edit] Prompt length:', prompt.length);
      
      // Call AI to modify blocks
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${import.meta.env.VITE_GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192,
          }
        }),
      });

      const data = await response.json();
      console.log('[Edit] API response status:', response.status);
      console.log('[Edit] API response data:', data);
      
      if (data.error) {
        console.error('[Edit] API error:', data.error);
        throw new Error(data.error.message || 'API error');
      }
      
      const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      console.log('[Edit] AI response length:', aiResponse.length);
      
      // Parse the response and update blocks
      const updatedBlocks = parseEditResponse(aiResponse, currentBlocks);
      
      if (updatedBlocks && onReplaceBlocks) {
        onReplaceBlocks(updatedBlocks);
        setHasUnsavedChanges(true);
        setEditMessages(prev => [...prev, { 
          role: 'assistant', 
          content: '✅ Provedl jsem změny. Podívejte se na ně v náhledu vpravo. Pokud jste spokojeni, klikněte na "Potvrdit změny".'
        }]);
      } else {
        setEditMessages(prev => [...prev, { 
          role: 'assistant', 
          content: 'Omlouvám se, nepodařilo se provést změny. Zkuste to prosím znovu s jiným zadáním.'
        }]);
      }
    } catch (error) {
      console.error('Edit error:', error);
      setEditMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Došlo k chybě při zpracování. Zkuste to prosím znovu.'
      }]);
    } finally {
      setIsEditLoading(false);
    }
  };

  // Confirm changes
  const confirmChanges = () => {
    setHasUnsavedChanges(false);
    setOriginalBlocks(null);
    setMode('select');
    setEditMessages([]);
  };

  // Revert changes
  const revertChanges = () => {
    if (originalBlocks && onReplaceBlocks) {
      onReplaceBlocks(originalBlocks);
    }
    setHasUnsavedChanges(false);
    setOriginalBlocks(null);
    setMode('select');
    setEditMessages([]);
  };

  // Create mode handlers
  const handleSend = () => {
    if (inputValue.trim()) {
      sendMessage();
      setShowQuickPrompts(false);
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    sendMessage(prompt);
    setShowQuickPrompts(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (mode === 'edit') {
        handleEditSend();
      } else {
      handleSend();
      }
    }
  };

  // Block selection handlers
  const toggleBlockSelection = (messageId: string, blockId: string) => {
    setSelectedBlocks(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(messageId) || new Set<string>();
      const newSet = new Set(current);
      
      if (newSet.has(blockId)) {
        newSet.delete(blockId);
      } else {
        newSet.add(blockId);
      }
      
      newMap.set(messageId, newSet);
      return newMap;
    });
  };

  const getSelectedCount = (messageId: string): number => {
    const selected = selectedBlocks.get(messageId);
    return selected ? selected.size : 0;
  };

  const isBlockSelected = (messageId: string, blockId: string): boolean => {
    const selected = selectedBlocks.get(messageId);
    return selected ? selected.has(blockId) : false;
  };

  const insertSelectedBlocks = (messageId: string, allBlocks: WorksheetBlock[]) => {
    const selected = selectedBlocks.get(messageId);
    if (!selected || selected.size === 0) return;
    
    let blocksToInsert = allBlocks.filter(b => selected.has(b.id));
    
    // VALIDATION: Ensure half-width blocks are properly paired (one must be image)
    // Go through blocks and fix any orphan half-width blocks
    const validatedBlocks: WorksheetBlock[] = [];
    let i = 0;
    
    while (i < blocksToInsert.length) {
      const block = { ...blocksToInsert[i] };
      const nextBlock = i + 1 < blocksToInsert.length ? { ...blocksToInsert[i + 1] } : null;
      
      // Check if this and next form a valid half-width pair
      const bothHalf = block.width === 'half' && nextBlock && nextBlock.width === 'half';
      const hasImage = block.type === 'image' || (nextBlock && nextBlock.type === 'image');
      
      if (bothHalf && hasImage) {
        // Valid pair - push BOTH and skip next
        console.log('[Insert Validation] Valid pair:', block.type, '+', nextBlock!.type);
        validatedBlocks.push(block);
        validatedBlocks.push(nextBlock!);
        i += 2; // Skip both blocks!
      } else if (block.width === 'half') {
        // Orphan half-width - convert to full
        console.log('[Insert Validation] Orphan half-width, converting:', block.type);
        block.width = 'full';
        validatedBlocks.push(block);
        i++;
      } else {
        // Full width block - just push
        validatedBlocks.push(block);
        i++;
      }
    }
    
    if (validatedBlocks.length > 0) {
      onAddBlocks(validatedBlocks);
      applyAction({ type: 'generate-content', description: 'Vložit bloky' }, messageId);
    }
  };

  // Find pending message (with AI blocks or image blocks)
  const pendingMessage = messages.find(msg => {
    const allBlocks = getMessageBlocks(msg);
    return allBlocks.length > 0 && !msg.applied;
  });
  const pendingCount = pendingMessage ? getSelectedCount(pendingMessage.id) : 0;

  // Fetch library menu for a subject
  const fetchLibraryMenu = async (subject: string) => {
    setIsLoadingLibrary(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/menu?category=${subject}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );
      if (response.ok) {
        const data = await response.json();
        setLibraryMenu(data.menu || []);
      }
    } catch (error) {
      console.error('Error fetching library menu:', error);
    } finally {
      setIsLoadingLibrary(false);
    }
  };

  // Fetch page content with images
  interface PageContentResult {
    text: string;
    images: ExtractedImage[];
  }
  
  const fetchPageContent = async (identifier: string, category: string): Promise<PageContentResult> => {
    // The identifier might be a full path like "folder/page" or just "page"
    // Extract just the last segment for the API call
    const pageSlug = identifier.includes('/') ? identifier.split('/').pop() || identifier : identifier;
    const url = `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/pages/${pageSlug}?category=${category}`;
    console.log('[AI From Docs] Fetching URL:', url);
    console.log('[AI From Docs] Original identifier:', identifier, '-> pageSlug:', pageSlug);
    
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`
        }
      });
      console.log('[AI From Docs] Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('[AI From Docs] FULL API response:', JSON.stringify(data, null, 2));
        
        // The API might return {page: {...}} or just {...}
        const pageData = data.page || data;
        console.log('[AI From Docs] Page data:', { 
          title: pageData.title, 
          contentLength: pageData.content?.length,
          hasContent: !!pageData.content,
          hasSectionImages: !!pageData.sectionImages,
          sectionImagesCount: pageData.sectionImages?.length,
          contentPreview: pageData.content?.substring(0, 200)
        });
        // Extract text content from HTML
        const htmlContent = pageData.content || '';
        if (!htmlContent) {
          console.warn('[AI From Docs] Page has no content!', pageData);
          return { text: '', images: [] };
        }
        
        // Extract images from HTML
        const images = extractImagesFromHtml(htmlContent);
        
        // Also extract Lottie URLs from sectionImages if present
        if (pageData.sectionImages && Array.isArray(pageData.sectionImages)) {
          for (const section of pageData.sectionImages) {
            // Check for Lottie config
            if (section.lottieConfig) {
              const lottieConfig = section.lottieConfig;
              // Add intro URL if present
              if (lottieConfig.introUrl) {
                images.push({
                  url: lottieConfig.introUrl,
                  alt: section.title || 'Animace',
                  type: 'lottie',
                });
              }
              // Add step URLs
              if (lottieConfig.steps && Array.isArray(lottieConfig.steps)) {
                for (const step of lottieConfig.steps) {
                  if (step.url && !images.some(img => img.url === step.url)) {
                    images.push({
                      url: step.url,
                      alt: step.label || section.title || 'Animace',
                      type: 'lottie',
                    });
                  }
                }
              }
            }
            // Check for image URL
            if (section.imageUrl && !images.some(img => img.url === section.imageUrl)) {
              images.push({
                url: section.imageUrl,
                alt: section.title || 'Obrázek',
                type: 'image',
              });
            }
          }
        }
        
        console.log('[AI From Docs] Extracted images (including sectionImages):', images.length, images);
        
        const textContent = htmlContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        return { 
          text: `### ${pageData.title || pageSlug}\n${textContent}`,
          images 
        };
      } else {
        const errorText = await response.text();
        console.log('[AI From Docs] Response not ok:', response.status, errorText);
      }
    } catch (error) {
      console.error('Error fetching page:', error);
    }
    return { text: '', images: [] };
  };

  // From-docs helper functions
  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  // Get all selectable document identifiers from items (excluding workbooks)
  const getAllDocIdentifiers = (items: MenuItem[]): string[] => {
    const identifiers: string[] = [];
    items.forEach(item => {
      if (isSelectableDocument(item)) {
        const id = getItemIdentifier(item);
        if (id) identifiers.push(id);
      }
      if (item.children) {
        identifiers.push(...getAllDocIdentifiers(item.children));
      }
    });
    return identifiers;
  };

  const toggleDocSelection = (identifier: string, item?: MenuItem) => {
    console.log('[AI From Docs] Toggle selection:', { 
      identifier, 
      itemLabel: item?.label, 
      itemSlug: item?.slug, 
      itemId: item?.id,
      itemType: item?.type 
    });
    setSelectedDocs(prev => {
      const next = new Set(prev);
      if (item && isFolder(item) && item.children) {
        // Toggle all selectable children
        const childIds = getAllDocIdentifiers(item.children);
        console.log('[AI From Docs] Folder children identifiers:', childIds);
        const allSelected = childIds.every(id => prev.has(id));
        if (allSelected) {
          childIds.forEach(id => next.delete(id));
        } else {
          childIds.forEach(id => next.add(id));
        }
      } else if (identifier) {
        if (next.has(identifier)) {
          next.delete(identifier);
        } else {
          next.add(identifier);
        }
      }
      console.log('[AI From Docs] Selected docs now:', Array.from(next));
      return next;
    });
  };

  const getFolderSelectionState = (item: MenuItem): boolean | 'partial' => {
    if (!item.children) return false;
    const childIds = getAllDocIdentifiers(item.children);
    if (childIds.length === 0) return false;
    const selectedCount = childIds.filter(id => selectedDocs.has(id)).length;
    if (selectedCount === 0) return false;
    if (selectedCount === childIds.length) return true;
    return 'partial';
  };

  const startFromDocsMode = () => {
    setMode('from-docs');
    setFromDocsStep('browse');
    setSelectedDocs(new Set());
    setExpandedFolders(new Set());
    setSelectedContentType(null);
    setActiveSubject(null);
    setLibraryMenu([]);
  };

  const startFromMyContentMode = () => {
    setMode('from-my-content');
    setFromMyContentStep('browse');
    setSelectedMyContent(new Set());
    setExpandedMyFolders(new Set());
    setMyContentType(null);
    
    // Load ALL user content from localStorage
    const filesStr = localStorage.getItem('vivid-my-files');
    const linksStr = localStorage.getItem('vivid-my-links');
    const foldersStr = localStorage.getItem('vivid-my-folders');
    const documentsStr = localStorage.getItem('vivid-my-documents');
    
    const files: StoredFile[] = filesStr ? JSON.parse(filesStr) : [];
    const links: StoredLink[] = linksStr ? JSON.parse(linksStr) : [];
    const folders = foldersStr ? JSON.parse(foldersStr) : [];
    const documents = documentsStr ? JSON.parse(documentsStr) : [];
    
    // Load worksheets from worksheet-storage
    const worksheets = getWorksheetList();
    
    // Filter out Vividbooks content (copiedFrom === 'vividbooks' or 'vividbooks-category')
    const filteredFolders = folders.filter((f: any) => 
      f.copiedFrom !== 'vividbooks' && f.copiedFrom !== 'vividbooks-category'
    );
    const filteredDocuments = documents.filter((d: any) => 
      d.copiedFrom !== 'vividbooks' && d.copiedFrom !== 'vividbooks-category'
    );
    
    // Load all content (without Vividbooks content)
    setMyFiles(files);
    setMyLinks(links);
    setMyFolders(filteredFolders);
    setMyDocuments(filteredDocuments);
    setMyWorksheets(worksheets);
  };
  
  const toggleMyFolder = (folderId: string) => {
    setExpandedMyFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const toggleMyContentSelection = (id: string) => {
    setSelectedMyContent(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleGenerateFromMyContent = async (contentType: ContentType) => {
    setFromMyContentStep('generating');
    setIsGeneratingFromMyContent(true);

    try {
      // Collect text from selected content
      const selectedFiles = myFiles.filter(f => selectedMyContent.has(f.id));
      const selectedLinks = myLinks.filter(l => selectedMyContent.has(l.id));
      const selectedDocs = myDocuments.filter(d => selectedMyContent.has(d.id));
      
      // Also check folder children
      const getTextFromFolder = (folder: any): string => {
        let text = '';
        if (folder.children) {
          for (const child of folder.children) {
            if (selectedMyContent.has(child.id) && child.content) {
              text += `\n\n--- Dokument: ${child.name} ---\n${child.content}`;
            }
          }
        }
        return text;
      };

      let combinedText = '';

      // Add text from files
      for (const file of selectedFiles) {
        if (file.extractedText) {
          combinedText += `\n\n--- Soubor: ${file.fileName} ---\n${file.extractedText}`;
        }
      }

      // Add text from links
      for (const link of selectedLinks) {
        if (link.extractedText) {
          combinedText += `\n\n--- Odkaz: ${link.title} (${link.url}) ---\n${link.extractedText}`;
        }
      }
      
      // Add text from documents
      for (const doc of selectedDocs) {
        if (doc.content) {
          combinedText += `\n\n--- Dokument: ${doc.name} ---\n${doc.content}`;
        }
      }
      
      // Add text from folder children
      for (const folder of myFolders) {
        combinedText += getTextFromFolder(folder);
      }

      if (!combinedText.trim()) {
        // No text available - still send with names only
        const names = [
          ...selectedFiles.map(f => f.fileName),
          ...selectedLinks.map(l => l.title),
          ...selectedDocs.map(d => d.name)
        ].join(', ');
        
        combinedText = `Vybrané materiály: ${names}. Poznámka: Text z těchto materiálů není dostupný pro analýzu.`;
      }

      // Generate using AI
      const prompt = contentType === 'test'
        ? `Vytvoř testové otázky z následujícího obsahu. Použij různé typy otázek (výběr z možností, doplňovací, otevřené). Obsah:\n${combinedText}`
        : `Vytvoř pracovní list s cvičeními z následujícího obsahu. Zahrň různé typy úloh. Obsah:\n${combinedText}`;

      await sendMessage(prompt);
      setMode('create');
      setFromMyContentStep('browse');
    } catch (error) {
      console.error('Error generating from my content:', error);
      setFromMyContentStep('browse');
    } finally {
      setIsGeneratingFromMyContent(false);
    }
  };

  const selectSubject = (subjectId: string) => {
    // Track subject access
    const subjectInfo = SUBJECTS.find(s => s.id === subjectId);
    analytics.trackSubjectAccessed(subjectId, subjectInfo?.label || subjectId, 'worksheet_ai');
    
    setActiveSubject(subjectId);
    fetchLibraryMenu(subjectId);
  };

  // Step 1: Fetch content and go to image selection
  const handleProceedToImageSelection = async () => {
    if (!selectedContentType || selectedDocs.size === 0 || !activeSubject) return;

    setFromDocsStep('generating');
    setIsGeneratingFromDocs(true);

    console.log('[AI From Docs] Selected identifiers:', Array.from(selectedDocs));
    console.log('[AI From Docs] Active subject:', activeSubject);

    try {
      // Fetch content for all selected pages
      const contentPromises = Array.from(selectedDocs).map(async (identifier) => {
        console.log('[AI From Docs] Fetching page:', identifier);
        const result = await fetchPageContent(identifier, activeSubject);
        console.log('[AI From Docs] Got content length:', result.text.length, 'images:', result.images.length, 'for', identifier);
        return result;
      });
      const results = await Promise.all(contentPromises);
      
      // Combine text content
      const textContents = results.map(r => r.text).filter(t => t && t.length > 10);
      const fullContent = textContents.join('\n\n');
      
      // Collect all images (including Lottie for processing in ImageSelectionStep)
      const allImages = results.flatMap(r => r.images);
      console.log('[AI From Docs] Total images found:', allImages.length);

      // Store content and images for image selection step
      setFetchedContent({ text: fullContent, images: allImages });
      
      // Go to image selection step
      setFromDocsStep('select-images');
    } catch (error) {
      console.error('Error fetching content:', error);
      setFromDocsStep('select-type');
    } finally {
      setIsGeneratingFromDocs(false);
    }
  };

  // Step 2: Generate worksheet with selected images
  const handleGenerateWithImages = (selectedImages: ImageOption[]) => {
    if (!fetchedContent || !selectedContentType) return;

    setFromDocsStep('generating');
    setIsGeneratingFromDocs(true);

    const typeLabels = { test: 'test s otázkami', worksheet: 'pracovní list', text: 'výukový text' };

    // Convert selected images to pending images format
    const pendingImgs: ExtractedImage[] = selectedImages.map(img => ({
      url: img.url,
      alt: img.alt,
      caption: img.caption,
      type: 'image' as const,
    }));
    
    setPendingImages(pendingImgs);
    console.log('[AI From Docs] Selected', pendingImgs.length, 'images for insertion');

    // Include only non-base64 image info in prompt (base64 images are added as blocks separately)
    const nonBase64Images = pendingImgs.filter(img => !img.url.startsWith('data:'));
    const imageInfo = formatImagesForPrompt(nonBase64Images);
    
    // Limit content length to prevent very long prompts
    const contentText = fetchedContent.text.length > 8000 
      ? fetchedContent.text.substring(0, 8000) + '\n\n[... obsah zkrácen ...]'
      : fetchedContent.text;
    
    const prompt = `Na základě následujícího obsahu vytvoř ${typeLabels[selectedContentType]}:\n\n${contentText}${imageInfo}`;
    
    console.log('[AI From Docs] Prompt length:', prompt.length);

    // Use the existing sendMessage function
    sendMessage(prompt);
    setMode('create');
    setIsGeneratingFromDocs(false);
    setFetchedContent(null);
  };

  // Skip image selection and generate without images
  const handleSkipImageSelection = () => {
    if (!fetchedContent || !selectedContentType) return;

    setFromDocsStep('generating');
    setIsGeneratingFromDocs(true);

    const typeLabels = { test: 'test s otázkami', worksheet: 'pracovní list', text: 'výukový text' };
    const prompt = `Na základě následujícího obsahu vytvoř ${typeLabels[selectedContentType]}:\n\n${fetchedContent.text}`;

    sendMessage(prompt);
    setMode('create');
    setIsGeneratingFromDocs(false);
    setFetchedContent(null);
  };

  // Render menu item (folder or document)
  const renderMenuItem = (item: MenuItem, depth: number = 0) => {
    const isExpanded = expandedFolders.has(item.id);
    const itemIsFolder = isFolder(item);
    const itemIsDocument = isSelectableDocument(item);
    const itemType = getItemType(item);
    
    // Skip workbooks entirely
    if (itemType === 'workbook') return null;
    
    // Get selection state
    const itemId = getItemIdentifier(item);
    const isSelected = itemIsDocument && itemId
      ? selectedDocs.has(itemId)
      : itemIsFolder
        ? getFolderSelectionState(item)
        : false;
    
    // Check if this folder has any selectable content
    const hasSelectableContent = itemIsFolder
      ? getAllDocIdentifiers(item.children || []).length > 0
      : itemIsDocument;
    
    // Get the icon for this document type
    const docType = DOCUMENT_TYPES.find(t => t.id === itemType);
    const IconComponent = docType?.icon;

  return (
      <div key={item.id}>
        <div
          className={`flex items-center gap-2 py-2 px-2 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={(e) => {
            e.stopPropagation();
            if (itemIsFolder) {
              toggleFolder(item.id);
            } else if (itemId) {
              toggleDocSelection(itemId);
            }
          }}
        >
          {/* Checkbox - only show if has selectable content */}
          {hasSelectableContent ? (
            <div
              className="w-4 h-4 rounded flex items-center justify-center shrink-0"
              style={{
                border: isSelected ? 'none' : '1.5px solid #94a3b8',
                backgroundColor: isSelected === true ? '#2563eb' : isSelected === 'partial' ? '#93c5fd' : 'transparent',
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (itemIsDocument) {
                  const id = getItemIdentifier(item);
                  if (id) toggleDocSelection(id);
                } else if (itemIsFolder) {
                  toggleDocSelection('', item);
                }
              }}
            >
              {isSelected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
            </div>
          ) : (
            <div className="w-4 shrink-0" />
          )}

          {/* Folder/Document icon */}
          {itemIsFolder ? (
            <>
              <ChevronRight 
                className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
              />
              {isExpanded ? (
                <FolderOpen className="h-4 w-4 text-amber-500" />
              ) : (
                <Folder className="h-4 w-4 text-amber-500" />
              )}
            </>
          ) : (
            <>
              <div className="w-4" /> {/* Spacer for alignment */}
              {IconComponent ? (
                <IconComponent className={`h-4 w-4 ${docType?.color || 'text-blue-500'}`} />
              ) : (
                <FileText className="h-4 w-4 text-blue-500" />
              )}
            </>
          )}

          <span className="text-sm text-slate-700 truncate">{item.label}</span>
        </div>

        {/* Children */}
        {itemIsFolder && isExpanded && item.children && (
          <div>
            {item.children.map(child => renderMenuItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // ========================================
  // RENDER: Mode Selection
  // ========================================
  if (mode === 'select') {
    return (
      <div className="h-full flex flex-col bg-white">
        {/* Header with close button */}
        <div className="shrink-0 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-medium text-slate-700 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-500" />
            AI Asistent
          </h3>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <Sparkles className="h-12 w-12 text-blue-500 mb-4" />
          <h2 className="text-lg font-semibold text-slate-800 mb-2">Co chcete udělat?</h2>
          {hasContent && (
            <p className="text-sm text-slate-500 text-center mb-6">
              Váš list už obsahuje {worksheet?.blocks?.length || 0} {(worksheet?.blocks?.length || 0) === 1 ? 'blok' : (worksheet?.blocks?.length || 0) < 5 ? 'bloky' : 'bloků'}
            </p>
          )}
          
          <div className="w-full max-w-xs space-y-3">
            {/* Show "Upravit" only when there's content */}
            {hasContent && (
              <button
                onClick={startEditMode}
                className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-purple-200 bg-purple-50 hover:bg-purple-100 hover:border-purple-300 transition-all text-left"
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#7c3aed' }}>
                  <Pencil className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-medium text-slate-800">Upravit obsah</p>
                  <p className="text-xs text-slate-500">Přeložit, zjednodušit, opravit...</p>
                </div>
              </button>
            )}
            
            <button
              onClick={() => setMode('create')}
              className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 hover:border-blue-300 transition-all text-left"
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#2563eb' }}>
                <FilePlus className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-medium text-slate-800">{hasContent ? 'Vytvořit nový obsah' : 'Vytvořit obsah'}</p>
                <p className="text-xs text-slate-500">{hasContent ? 'Přidat další bloky a úlohy' : 'Generovat bloky a úlohy pomocí AI'}</p>
              </div>
            </button>

            <button
              onClick={startFromDocsMode}
              className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-amber-200 bg-amber-50 hover:bg-amber-100 hover:border-amber-300 transition-all text-left"
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#f59e0b' }}>
                <Library className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-medium text-slate-800">Z Vividbooks</p>
                <p className="text-xs text-slate-500">Vytvořit z dokumentů knihovny</p>
              </div>
            </button>

            <button
              onClick={startFromMyContentMode}
              className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-green-200 bg-green-50 hover:bg-green-100 hover:border-green-300 transition-all text-left"
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#10b981' }}>
                <FolderUp className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-medium text-slate-800">Z mého obsahu</p>
                <p className="text-xs text-slate-500">Vytvořit z mých souborů a odkazů</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ========================================
  // RENDER: From Docs Mode
  // ========================================
  if (mode === 'from-docs') {
    // Step 1: Browse and select documents
    if (fromDocsStep === 'browse') {
      // If no subject selected, show subject picker
      if (!activeSubject) {
        return (
          <div className="h-full flex flex-col bg-white">
            {/* Header with back and close */}
            <div className="shrink-0 px-4 py-3 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={handleBack}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Zpět
                </button>
                <button
                  onClick={handleClose}
                  className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <h3 className="font-medium text-slate-800">Vyberte předmět</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Z jakého předmětu chcete vybrat dokumenty?
              </p>
            </div>

            {/* Subject list */}
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
          </div>
        );
      }

      // Subject selected - show folder tree
      return (
        <div className="h-full flex flex-col bg-white">
          {/* Header with back and close */}
          <div className="shrink-0 px-4 py-3 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={handleBack}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
              >
                <ArrowLeft className="h-4 w-4" />
                Zpět
              </button>
              <button
                onClick={handleClose}
                className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <h3 className="font-medium text-slate-800">
              {SUBJECTS.find(s => s.id === activeSubject)?.label}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {selectedDocs.size > 0 ? `Vybráno: ${selectedDocs.size} dokumentů` : 'Označte obsah'}
            </p>
          </div>

          {/* Folder tree */}
          <div className="flex-1 overflow-y-auto p-2">
            {isLoadingLibrary ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              </div>
            ) : libraryMenu.length > 0 ? (
              libraryMenu
                .filter(item => getItemType(item) !== 'workbook') // Filter out workbooks at top level
                .map(item => renderMenuItem(item))
            ) : (
              <p className="text-sm text-slate-500 text-center py-8">Žádný obsah</p>
            )}
          </div>

          {/* Footer with action button */}
          <div className="shrink-0 p-4 border-t border-slate-200 bg-slate-50">
            <button
              onClick={() => setFromDocsStep('select-type')}
              disabled={selectedDocs.size === 0}
              className="w-full py-3 rounded-xl text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: selectedDocs.size > 0 ? '#2563eb' : '#94a3b8' }}
            >
              Pokračovat ({selectedDocs.size})
            </button>
          </div>
        </div>
      );
    }

    // Step 2: Select content type
    if (fromDocsStep === 'select-type') {
      return (
        <div className="h-full flex flex-col bg-white">
          {/* Header with back and close */}
          <div className="shrink-0 px-4 py-3 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={handleBack}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
              >
                <ArrowLeft className="h-4 w-4" />
                Zpět
              </button>
              <button
                onClick={handleClose}
                className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <h3 className="font-medium text-slate-800">Co chcete vytvořit?</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Z {selectedDocs.size} vybraných dokumentů
            </p>
          </div>

          {/* Content type options */}
          <div className="flex-1 flex flex-col justify-center p-6 space-y-3">
            <button
              onClick={() => setSelectedContentType('test')}
              className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                selectedContentType === 'test' 
                  ? 'border-green-500 bg-green-50' 
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#22c55e' }}>
                <ClipboardList className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-medium text-slate-800">Test</p>
                <p className="text-xs text-slate-500">Otázky s možnostmi odpovědí</p>
              </div>
              {selectedContentType === 'test' && (
                <Check className="h-5 w-5 text-green-500 ml-auto" />
              )}
            </button>

            <button
              onClick={() => setSelectedContentType('worksheet')}
              className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                selectedContentType === 'worksheet' 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#2563eb' }}>
                <FileEdit className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-medium text-slate-800">Pracovní list</p>
                <p className="text-xs text-slate-500">Mix úloh a aktivit</p>
              </div>
              {selectedContentType === 'worksheet' && (
                <Check className="h-5 w-5 text-blue-500 ml-auto" />
              )}
            </button>

            <button
              onClick={() => setSelectedContentType('text')}
              className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                selectedContentType === 'text' 
                  ? 'border-purple-500 bg-purple-50' 
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#7c3aed' }}>
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-medium text-slate-800">Výukový text</p>
                <p className="text-xs text-slate-500">Shrnutí a vysvětlení látky</p>
              </div>
              {selectedContentType === 'text' && (
                <Check className="h-5 w-5 text-purple-500 ml-auto" />
              )}
            </button>
          </div>

          {/* Footer */}
          <div className="shrink-0 p-4 border-t border-slate-200 bg-slate-50 flex gap-2">
            <button
              onClick={() => setFromDocsStep('browse')}
              className="flex-1 py-3 rounded-xl text-slate-600 font-medium border border-slate-300 hover:bg-slate-100 transition-colors"
            >
              Zpět
            </button>
            <button
              onClick={handleProceedToImageSelection}
              disabled={!selectedContentType}
              className="flex-1 py-3 rounded-xl text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: selectedContentType ? '#2563eb' : '#94a3b8' }}
            >
              Pokračovat
            </button>
          </div>
        </div>
      );
    }

    // Step 3: Image selection
    if (fromDocsStep === 'select-images' && fetchedContent) {
      return (
        <div className="h-full flex flex-col bg-white">
          {/* Header with back and close */}
          <div className="shrink-0 px-4 py-3 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between">
              <button
                onClick={handleBack}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
              >
                <ArrowLeft className="h-4 w-4" />
                Zpět
              </button>
              <button
                onClick={handleClose}
                className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          
          {/* Image selection content */}
          <div className="flex-1 overflow-hidden">
            <ImageSelectionStep
              topic={worksheet?.metadata?.topic || worksheet?.title || 'vzdělávací materiál'}
              content={fetchedContent.text}
              lessonImages={fetchedContent.images}
              onConfirm={handleGenerateWithImages}
              onSkip={handleSkipImageSelection}
            />
          </div>
        </div>
      );
    }

    // Step 4: Generating (loading state)
    return (
      <div className="h-full flex flex-col items-center justify-center bg-white p-6">
        <Loader2 className="h-12 w-12 text-blue-500 animate-spin mb-4" />
        <p className="text-slate-600">Generuji obsah...</p>
      </div>
    );
  }

  // ========================================
  // RENDER: From My Content Mode
  // ========================================
  if (mode === 'from-my-content') {
    const hasMyContent = myFiles.length > 0 || myLinks.length > 0 || myFolders.length > 0 || myDocuments.length > 0;
    
    // Helper to get root items (not in any folder)
    const getRootFiles = () => myFiles.filter(f => !f.folderId);
    const getRootLinks = () => myLinks.filter(l => !l.folderId);
    const getRootDocuments = () => myDocuments.filter(d => !(d as any).folderId);
    const getRootWorksheets = () => myWorksheets.filter(w => !w.folderId);
    
    // Helper to get items in a folder
    const getFilesInFolder = (folderId: string) => myFiles.filter(f => f.folderId === folderId);
    const getLinksInFolder = (folderId: string) => myLinks.filter(l => l.folderId === folderId);
    const getWorksheetsInFolderLocal = (folderId: string) => myWorksheets.filter(w => w.folderId === folderId);
    
    // Checkbox component
    const Checkbox = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
      <button
        onClick={(e) => { e.stopPropagation(); onChange(); }}
        className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
          checked ? 'bg-blue-500 border-blue-500' : 'border-slate-300 hover:border-slate-400'
        }`}
      >
        {checked && <Check className="h-3 w-3 text-white" />}
      </button>
    );
    
    // Render a single document/file/link/worksheet item with checkbox
    const renderItem = (item: { id: string; name: string; icon: 'folder' | 'document' | 'file' | 'link' | 'worksheet'; level: number; hasChildren?: boolean; isExpanded?: boolean; onToggle?: () => void }) => (
      <div
        key={item.id}
        className="flex items-center gap-2 py-2 hover:bg-slate-50 rounded-lg px-2 cursor-pointer"
        style={{ paddingLeft: `${item.level * 24 + 8}px` }}
        onClick={() => {
          if (item.hasChildren && item.onToggle) {
            item.onToggle();
          } else {
            toggleMyContentSelection(item.id);
          }
        }}
      >
        <Checkbox 
          checked={selectedMyContent.has(item.id)} 
          onChange={() => toggleMyContentSelection(item.id)} 
        />
        
        {item.hasChildren && (
          <button 
            onClick={(e) => { e.stopPropagation(); item.onToggle?.(); }}
            className="p-0.5 hover:bg-slate-200 rounded"
          >
            <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform ${item.isExpanded ? 'rotate-90' : ''}`} />
          </button>
        )}
        
        {item.icon === 'folder' ? (
          <Folder className="h-5 w-5 text-slate-500 shrink-0" />
        ) : item.icon === 'document' ? (
          <HelpCircle className="h-5 w-5 text-slate-500 shrink-0" />
        ) : item.icon === 'link' ? (
          <Link2 className="h-5 w-5 text-slate-500 shrink-0" />
        ) : item.icon === 'worksheet' ? (
          <ClipboardList className="h-5 w-5 text-amber-500 shrink-0" />
        ) : (
          <FileText className="h-5 w-5 text-slate-500 shrink-0" />
        )}
        
        <span className="text-sm text-slate-700 truncate">{item.name}</span>
      </div>
    );
    
    // Recursive folder renderer
    const renderFolderTree = (folder: any, level: number = 0): React.ReactNode[] => {
      const isExpanded = expandedMyFolders.has(folder.id);
      const folderFiles = getFilesInFolder(folder.id);
      const folderLinks = getLinksInFolder(folder.id);
      const folderWorksheets = getWorksheetsInFolderLocal(folder.id);
      // Filter out Vividbooks content from children
      const folderChildren = (folder.children || []).filter((c: any) => 
        c.copiedFrom !== 'vividbooks' && c.copiedFrom !== 'vividbooks-category'
      );
      const hasChildren = folderFiles.length > 0 || folderLinks.length > 0 || folderChildren.length > 0 || folderWorksheets.length > 0;
      
      const elements: React.ReactNode[] = [];
      
      // Folder row
      elements.push(
        <div key={folder.id}>
          {renderItem({
            id: folder.id,
            name: folder.name,
            icon: 'folder',
            level,
            hasChildren,
            isExpanded,
            onToggle: () => toggleMyFolder(folder.id)
          })}
        </div>
      );
      
      // Children (if expanded)
      if (isExpanded) {
        // Nested folders (from children)
        folderChildren.filter((c: any) => c.type === 'folder').forEach((childFolder: any) => {
          elements.push(...renderFolderTree(childFolder, level + 1));
        });
        
        // Documents in folder
        folderChildren.filter((c: any) => c.type !== 'folder').forEach((child: any) => {
          elements.push(
            <div key={child.id}>
              {renderItem({
                id: child.id,
                name: child.name,
                icon: 'document',
                level: level + 1
              })}
            </div>
          );
        });
        
        // Files in folder
        folderFiles.forEach(file => {
          elements.push(
            <div key={file.id}>
              {renderItem({
                id: file.id,
                name: file.fileName,
                icon: 'file',
                level: level + 1
              })}
            </div>
          );
        });
        
        // Links in folder
        folderLinks.forEach(link => {
          elements.push(
            <div key={link.id}>
              {renderItem({
                id: link.id,
                name: link.title,
                icon: 'link',
                level: level + 1
              })}
            </div>
          );
        });
        
        // Worksheets in folder
        folderWorksheets.forEach(ws => {
          elements.push(
            <div key={ws.id}>
              {renderItem({
                id: ws.id,
                name: ws.title,
                icon: 'worksheet',
                level: level + 1
              })}
            </div>
          );
        });
      }
      
      return elements;
    };
    
    // Step 1: Browse and select my content
    if (fromMyContentStep === 'browse') {
      return (
        <div className="h-full flex flex-col bg-white">
          {/* Header */}
          <div className="shrink-0 px-4 py-3 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={handleBack}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
              >
                <ArrowLeft className="h-4 w-4" />
                Zpět
              </button>
              <button
                onClick={handleClose}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <FolderUp className="h-5 w-5 text-green-500" />
              Z mého obsahu
            </h3>
            <p className="text-xs text-slate-500 mt-1">Vyberte materiály pro generování</p>
          </div>

          {/* Content - Tree view */}
          <div className="flex-1 overflow-y-auto py-2">
            {!hasMyContent ? (
              <div className="text-center py-8 px-4">
                <FolderUp className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600 font-medium">Nemáte žádný obsah</p>
                <p className="text-sm text-slate-500 mt-1">
                  Nahrajte soubory nebo přidejte odkazy v sekci "Můj obsah"
                </p>
              </div>
            ) : (
              <div>
                {/* Folders (recursive tree) */}
                {myFolders.map(folder => renderFolderTree(folder, 0))}
                
                {/* Root Files */}
                {getRootFiles().map(file => renderItem({
                  id: file.id,
                  name: file.fileName,
                  icon: 'file',
                  level: 0
                }))}
                
                {/* Root Links */}
                {getRootLinks().map(link => renderItem({
                  id: link.id,
                  name: link.title,
                  icon: 'link',
                  level: 0
                }))}

                {/* Root Worksheets */}
                {getRootWorksheets().map(ws => renderItem({
                  id: ws.id,
                  name: ws.title,
                  icon: 'worksheet',
                  level: 0
                }))}
                
                {/* Root Documents */}
                {getRootDocuments().map((doc: any) => renderItem({
                  id: doc.id,
                  name: doc.name,
                  icon: 'document',
                  level: 0
                }))}
              </div>
            )}
          </div>

          {/* Footer */}
          {selectedMyContent.size > 0 && (
            <div className="shrink-0 p-4 border-t border-slate-200 bg-white">
              <button
                onClick={() => setFromMyContentStep('select-type')}
                className="w-full py-3 rounded-xl font-medium text-white transition-all"
                style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
              >
                Pokračovat ({selectedMyContent.size} vybráno)
              </button>
            </div>
          )}
        </div>
      );
    }

    // Step 2: Select content type
    if (fromMyContentStep === 'select-type') {
      return (
        <div className="h-full flex flex-col bg-white">
          {/* Header */}
          <div className="shrink-0 px-4 py-3 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={handleBack}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
              >
                <ArrowLeft className="h-4 w-4" />
                Zpět
              </button>
              <button
                onClick={handleClose}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <h3 className="font-semibold text-slate-800">Co chcete vytvořit?</h3>
            <p className="text-xs text-slate-500 mt-1">{selectedMyContent.size} materiálů vybráno</p>
          </div>

          {/* Content type selection */}
          <div className="flex-1 flex flex-col items-center justify-center p-6">
            <div className="space-y-3 w-full max-w-xs">
              <button
                onClick={() => {
                  setMyContentType('worksheet');
                  handleGenerateFromMyContent('worksheet');
                }}
                className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 hover:border-blue-300 transition-all text-left"
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500">
                  <FileEdit className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-medium text-slate-800">Pracovní list</p>
                  <p className="text-xs text-slate-500">Cvičení a úlohy pro žáky</p>
                </div>
              </button>

              <button
                onClick={() => {
                  setMyContentType('test');
                  handleGenerateFromMyContent('test');
                }}
                className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-purple-200 bg-purple-50 hover:bg-purple-100 hover:border-purple-300 transition-all text-left"
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#a855f7' }}>
                  <ClipboardList className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-medium text-slate-800">Test</p>
                  <p className="text-xs text-slate-500">Testové otázky k ověření znalostí</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Step 3: Generating
    if (fromMyContentStep === 'generating') {
      return (
        <div className="h-full flex flex-col bg-white">
          <div className="flex-1 flex flex-col items-center justify-center p-6">
            <Loader2 className="h-12 w-12 text-green-500 animate-spin mb-4" />
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Generuji obsah...</h3>
            <p className="text-sm text-slate-500 text-center">
              AI analyzuje vaše materiály a vytváří cvičení
            </p>
          </div>
        </div>
      );
    }
  }

  // ========================================
  // RENDER: Edit Mode
  // ========================================
  if (mode === 'edit') {
    return (
      <div className="h-full flex flex-col bg-white">
        {/* Header */}
        {/* Header with back and close */}
        <div className="shrink-0 px-4 py-3 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between">
            <button
              onClick={handleBack}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Zpět
            </button>
            <div className="flex items-center gap-2">
              {hasUnsavedChanges && (
                <>
                  <button
                    onClick={revertChanges}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Vrátit
                  </button>
                  <button
                    onClick={confirmChanges}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white rounded-lg"
                    style={{ backgroundColor: '#10b981' }}
                  >
                    <Check className="h-4 w-4" />
                    Potvrdit
                  </button>
                </>
              )}
              <button
                onClick={handleClose}
                className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Chat area - centered */}
        <div className="flex-1 flex flex-col justify-center">
          <div 
            ref={editScrollRef}
            className="max-h-[60vh] overflow-y-auto px-4 py-6 space-y-4"
          >
            {editMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div 
                  className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
                    msg.role === 'user' 
                      ? 'text-white' 
                      : 'bg-slate-100 text-slate-800 border border-slate-200'
                  }`}
                  style={msg.role === 'user' ? { backgroundColor: '#2563eb' } : undefined}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            
            {isEditLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-100 rounded-xl px-4 py-3 flex items-center gap-2 border border-slate-200">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  <span className="text-sm text-slate-600">Upravuji obsah...</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input */}
        <div className="shrink-0 p-4 border-t border-slate-200 bg-slate-50">
          <div className="flex gap-2">
            <input
              value={editInput}
              onChange={(e) => setEditInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Např. přelož do angličtiny, zjednoduš text..."
              className="flex-1 px-4 py-3 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isEditLoading}
            />
            <Button
              size="icon"
              onClick={handleEditSend}
              disabled={!editInput.trim() || isEditLoading}
              className="h-12 w-12 rounded-xl"
              style={{ backgroundColor: '#2563eb' }}
            >
              {isEditLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ========================================
  // RENDER: Create Mode (existing behavior)
  // ========================================
  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header with back, close, and insert button */}
      <div className="shrink-0 px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <button
          onClick={handleBack}
          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Zpět
        </button>
        <div className="flex items-center gap-2">
          {pendingMessage && pendingCount > 0 && (
            <button
              onClick={() => insertSelectedBlocks(pendingMessage.id, getMessageBlocks(pendingMessage))}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
              style={{ backgroundColor: '#2563eb' }}
            >
              <Plus className="h-4 w-4" />
              Vložit ({pendingCount})
            </button>
          )}
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Scrollable chat area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.map((msg) => (
          <div key={msg.id}>
            {msg.role === 'user' ? (
              <div className="flex justify-end">
                <div 
                  className="max-w-[85%] rounded-lg px-3 py-2 text-sm text-white"
                  style={{ backgroundColor: '#2563eb' }}
                >
                  {msg.content}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-slate-100 rounded-lg px-3 py-2 text-sm text-slate-800 border border-slate-200">
                  {msg.content}
                </div>

                {(() => {
                  const allBlocks = getMessageBlocks(msg);
                  return allBlocks.length > 0 && !msg.applied && (
                    <div className="space-y-2">
                      {allBlocks.map((block) => {
                        const selected = isBlockSelected(msg.id, block.id);
                        return (
                          <BlockPreviewCard
                            key={block.id}
                            block={block}
                            isSelected={selected}
                            onToggle={() => toggleBlockSelection(msg.id, block.id)}
                          />
                        );
                      })}
                    </div>
                  );
                })()}

                {msg.applied && (
                  <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg border border-green-200">
                    <Check className="h-4 w-4" />
                    Bloky byly vloženy
                  </div>
                )}

                {msg.suggestedActions && msg.suggestedActions.length > 0 && !msg.applied && getMessageBlocks(msg).length === 0 && (
                  <div className="space-y-1.5">
                    {msg.suggestedActions.map((action, i) => (
                      <button
                        key={i}
                        onClick={() => applyAction(action, msg.id)}
                        className="w-full text-left px-3 py-2 rounded-md bg-blue-50 hover:bg-blue-100 text-sm text-blue-700 border border-blue-200 flex items-center gap-2"
                      >
                        <span className="flex-1">{action.description}</span>
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-100 rounded-lg px-4 py-3 flex items-center gap-2 border border-slate-200">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <span className="text-sm text-slate-600">Generuji...</span>
            </div>
          </div>
        )}

        {showQuickPrompts && messages.length <= 1 && (
          <div className="mt-4">
            <p className="text-xs text-slate-500 mb-3 uppercase tracking-wide font-medium">Rychlé akce</p>
            <div className="space-y-2">
              {quickPrompts.map((qp, i) => (
                <button
                  key={i}
                  onClick={() => handleQuickPrompt(qp.prompt)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-colors"
                >
                  <span className="text-lg">{qp.icon}</span>
                  <span className="flex-1 text-sm text-slate-700">{qp.label}</span>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Fixed input at bottom */}
      <div className="shrink-0 p-3 border-t border-slate-200 bg-slate-50">
        <div className="flex gap-2">
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Napiš co potřebuješ..."
            className="flex-1 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            style={{ backgroundColor: '#2563eb' }}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>

        {messages.length > 2 && (
          <button
            onClick={clearChat}
            className="mt-2 flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600"
          >
            <Trash2 className="h-3 w-3" />
            Vymazat chat
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================
// HELPER FUNCTIONS FOR EDIT MODE
// ============================================

function buildEditPrompt(userRequest: string, blocks: WorksheetBlock[]): string {
  // Sanitize blocks - remove large data like base64 images
  const sanitizedBlocks = blocks.map(block => {
    if (block.type === 'image') {
      const content = block.content as any;
      return {
        ...block,
        content: {
          ...content,
          url: content.url?.startsWith('data:') ? '[BASE64_IMAGE]' : content.url,
        }
      };
    }
    return block;
  });
  
  const blocksJson = JSON.stringify(sanitizedBlocks, null, 2);
  console.log('[BuildEditPrompt] Blocks JSON length:', blocksJson.length);

  return `Jsi AI asistent pro úpravu vzdělávacího obsahu. Uživatel chce upravit existující pracovní list.

POŽADAVEK UŽIVATELE: ${userRequest}

AKTUÁLNÍ BLOKY (JSON):
${blocksJson}

TVŮJ ÚKOL:
1. Uprav bloky podle požadavku uživatele
2. Zachovej strukturu bloků (id, type, order, width atd.)
3. Uprav pouze obsah (content) podle požadavku
4. Vrať POUZE upravený JSON pole bloků, nic jiného

DŮLEŽITÉ:
- Vrať POUZE validní JSON pole bloků
- Nezabaluj do markdown code blocks
- Zachovej všechny originální id a strukturu
- U obrázků zachovej originální URL (nebo [BASE64_IMAGE] pokud tam je)
- Uprav pouze to, co uživatel požaduje`;
}

function parseEditResponse(response: string, originalBlocks: WorksheetBlock[]): WorksheetBlock[] | null {
  console.log('[EditParse] Raw response length:', response.length);
  console.log('[EditParse] Raw response preview:', response.substring(0, 500));
  
  try {
    // Try to extract JSON array from response
    let jsonStr = response.trim();

    // Remove markdown code blocks if present
    if (jsonStr.includes('```')) {
      console.log('[EditParse] Found code blocks, removing...');
      jsonStr = jsonStr.replace(/```json?\n?/gi, '').replace(/```/g, '').trim();
    }

    let parsedBlocks: any[] | null = null;

    // Find array in response
    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      console.log('[EditParse] Found array, parsing...');
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        console.log('[EditParse] Successfully parsed', parsed.length, 'blocks');
        parsedBlocks = parsed;
      } else {
        console.log('[EditParse] Parsed but empty or not array:', typeof parsed);
      }
    } else {
      console.log('[EditParse] No array found in response');
      // Try to parse the whole response as JSON
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed) && parsed.length > 0) {
        console.log('[EditParse] Direct parse successful:', parsed.length, 'blocks');
        parsedBlocks = parsed;
      }
    }

    if (!parsedBlocks) return null;

    // Restore original base64 images that were sanitized
    const originalBlockMap = new Map(originalBlocks.map(b => [b.id, b]));
    
    const restoredBlocks = parsedBlocks.map(block => {
      if (block.type === 'image' && block.content?.url === '[BASE64_IMAGE]') {
        const original = originalBlockMap.get(block.id);
        if (original && original.type === 'image') {
          console.log('[EditParse] Restoring base64 image for block:', block.id);
          return {
            ...block,
            content: {
              ...block.content,
              url: (original.content as any).url,
            }
          };
        }
      }
      return block;
    });

    return restoredBlocks as WorksheetBlock[];
  } catch (e) {
    console.error('[EditParse] Failed to parse edit response:', e);
    console.error('[EditParse] Response was:', response);
    return null;
  }
}

// ============================================
// BLOCK PREVIEW CARD
// ============================================

interface BlockPreviewCardProps {
  block: WorksheetBlock;
  isSelected: boolean;
  onToggle: () => void;
}

function BlockPreviewCard({ block, isSelected, onToggle }: BlockPreviewCardProps) {
  const { icon: Icon, label, color } = getBlockMeta(block.type);

  return (
    <div
      onClick={onToggle}
      className="cursor-pointer p-3 rounded-xl border-2 transition-all"
      style={{
        borderColor: isSelected ? '#3b82f6' : '#e2e8f0',
        backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
      }}
    >
      <div className="flex items-start gap-3">
        <div 
          className="shrink-0 w-5 h-5 mt-0.5 rounded flex items-center justify-center"
          style={{
            backgroundColor: isSelected ? '#2563eb' : '#ffffff',
            border: isSelected ? '2px solid #2563eb' : '2px solid #cbd5e1',
          }}
        >
          {isSelected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
        </div>
        
        <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
          <BlockContent block={block} />
        </div>
      </div>
    </div>
  );
}

// ============================================
// BLOCK CONTENT RENDERER
// ============================================

function BlockContent({ block }: { block: WorksheetBlock }) {
  const content = block.content as any;
  
  switch (block.type) {
    case 'heading':
      return <p className="text-sm font-semibold text-slate-800">{content.text}</p>;
      
    case 'paragraph':
      return <p className="text-sm text-slate-700">{content.text}</p>;
      
    case 'infobox':
      return (
        <div>
          {content.title && <p className="text-sm font-medium text-slate-800">{content.title}</p>}
          <p className="text-sm text-slate-600">{content.text}</p>
        </div>
      );
      
    case 'multiple-choice':
      return (
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-slate-800">{content.question}</p>
          {content.options?.map((opt: any, i: number) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className={`font-medium ${opt.isCorrect ? 'text-green-600' : 'text-slate-500'}`}>
                {String.fromCharCode(65 + i)})
              </span>
              <span className={opt.isCorrect ? 'text-green-700' : 'text-slate-600'}>
                {opt.text} {opt.isCorrect && '✓'}
              </span>
            </div>
            ))}
          </div>
      );
      
    case 'fill-blank':
      return (
        <div>
          <p className="text-sm text-slate-700">{content.text}</p>
          {content.blanks?.length > 0 && (
            <p className="text-xs text-slate-500 mt-1">
              Odpovědi: {content.blanks.map((b: any) => b.answer || b).join(', ')}
          </p>
        )}
      </div>
      );
      
    case 'free-answer':
      return (
        <div>
          <p className="text-sm font-medium text-slate-800">{content.question}</p>
          {content.hint && <p className="text-xs text-slate-500 mt-1">Nápověda: {content.hint}</p>}
          {content.sampleAnswer && <p className="text-xs text-green-600 mt-1">Vzor: {content.sampleAnswer}</p>}
    </div>
  );
      
    default:
      return <p className="text-sm text-slate-600">Blok</p>;
  }
}

// ============================================
// HELPERS
// ============================================

function getBlockMeta(type: string): { icon: typeof FileText; label: string; color: string } {
  const meta: Record<string, { icon: typeof FileText; label: string; color: string }> = {
    heading: { icon: FileText, label: 'Nadpis', color: 'bg-slate-100 text-slate-600' },
    paragraph: { icon: FileText, label: 'Odstavec', color: 'bg-slate-100 text-slate-600' },
    infobox: { icon: Info, label: 'Infobox', color: 'bg-blue-100 text-blue-600' },
    'multiple-choice': { icon: CheckCircle2, label: 'Otázka ABC', color: 'bg-green-100 text-green-600' },
    'fill-blank': { icon: PenLine, label: 'Doplňovačka', color: 'bg-amber-100 text-amber-600' },
    'free-answer': { icon: HelpCircle, label: 'Otevřená otázka', color: 'bg-purple-100 text-purple-600' },
    examples: { icon: BookOpen, label: 'Příklady', color: 'bg-indigo-100 text-indigo-600' },
  };
  return meta[type] || { icon: FileText, label: type, color: 'bg-slate-100 text-slate-600' };
}

function getSubjectLabel(subject: string): string {
  const labels: Record<string, string> = {
    fyzika: 'Fyzika',
    chemie: 'Chemie',
    matematika: 'Matematika',
    prirodopis: 'Přírodopis',
    zemepis: 'Zeměpis',
    dejepis: 'Dějepis',
    cestina: 'Čeština',
    anglictina: 'Angličtina',
  };
  return labels[subject] || subject;
}
