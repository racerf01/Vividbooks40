import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Send, 
  Sparkles, 
  Loader2,
  Wand2,
  FileText,
  RefreshCw,
  CheckCircle2,
  Lightbulb,
  PenLine,
  BookOpen,
  ListChecks,
  Undo2,
  Redo2,
  Eye,
  Library,
  FolderUp,
  FilePlus,
  Pencil,
  ArrowLeft,
  Folder,
  FolderOpen,
  ChevronRight,
  Check,
  Link2,
  Youtube,
  FileImage,
  FileAudio,
  FileVideo,
  File,
  FileEdit
} from 'lucide-react';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { useAnalytics } from '../hooks/useAnalytics';
import { DOCUMENT_TYPES } from '../types/document-types';
import { StoredFile, StoredLink } from '../types/file-storage';
import { getWorksheetList, getWorksheet, getWorksheetsInFolder, WorksheetListItem } from '../utils/worksheet-storage';
import { chatWithAIProxy } from '../utils/ai-chat-proxy';

// Available AI Models
const AI_MODELS = [
  { id: 'gemini-3-flash', label: 'Gemini 3.0 Flash', provider: 'google' },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini', provider: 'openai' },
] as const;

type AIModelId = typeof AI_MODELS[number]['id'];

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

// Helper to check if item is a folder
const isFolder = (item: MenuItem): boolean => {
  return !!(item.children && item.children.length > 0) || 
         item.type === 'folder' || 
         item.type === 'group';
};

// Get the identifier to use for a menu item
const getItemIdentifier = (item: MenuItem): string | null => {
  return item.slug || item.id || null;
};

// Helper to check if item is a selectable document
const isSelectableDocument = (item: MenuItem): boolean => {
  if (!item.slug && !item.id) return false;
  if (item.type === 'workbook') return false;
  if (isFolder(item)) return false;
  return true;
};

// Normalize item type for display
const getItemType = (item: MenuItem): string => {
  let type = item.type || '';
  const icon = item.icon || '';
  
  if (type === 'workbook' || icon === 'book' || icon === 'workbook') return 'workbook';
  if (type === 'worksheet' || icon === 'file-edit') return 'worksheet';
  return type || 'lesson';
};

// Available subjects
const SUBJECTS = [
  { id: 'fyzika', label: 'Fyzika', color: '#7c3aed' },
  { id: 'chemie', label: 'Chemie', color: '#ef4444' },
  { id: 'prirodopis', label: 'Přírodopis', color: '#22c55e' },
  { id: 'matematika', label: 'Matematika', color: '#3b82f6' },
  { id: 'dejepis', label: 'Dějepis', color: '#d97706' },
];

type AIMode = 'select' | 'chat' | 'from-docs' | 'from-my-content';
type FromDocsStep = 'browse' | 'generating';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isAppliedChange?: boolean; // Flag for changes applied to document
}

interface DocumentAIPanelProps {
  isOpen: boolean;
  onClose: () => void;
  documentContent: string;
  documentTitle: string;
  selectedText?: { text: string; html: string; from: number; to: number; timestamp?: number } | null;
  onClearSelection?: () => void; // Clear the current selection
  onInsertContent: (content: string) => void;
  onReplaceContent: (content: string) => void;
  onReplaceSelection?: (content: string) => void; // Replace only the selected text
  onApplyContent?: (content: string) => void; // Direct apply without confirmation
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}

// Quick prompts for selected text (Canvas-like)
const SELECTION_PROMPTS = [
  { 
    id: 'rewrite', 
    label: 'Přeformulovat', 
    icon: RefreshCw, 
    prompt: 'Přeformuluj tento text jiným způsobem, zachovej význam.',
    bgColor: '#dbeafe',
    textColor: '#2563eb',
  },
  { 
    id: 'expand', 
    label: 'Rozšířit', 
    icon: PenLine, 
    prompt: 'Rozšiř tento text o více detailů a informací.',
    bgColor: '#dcfce7',
    textColor: '#16a34a',
  },
  { 
    id: 'simplify', 
    label: 'Zjednodušit', 
    icon: Lightbulb, 
    prompt: 'Zjednodušte tento text tak, aby byl srozumitelnější.',
    bgColor: '#fef3c7',
    textColor: '#d97706',
  },
  { 
    id: 'shorter', 
    label: 'Zkrátit', 
    icon: FileText, 
    prompt: 'Zkrať tento text, zachovej pouze klíčové informace.',
    bgColor: '#f3e8ff',
    textColor: '#9333ea',
  },
];

// Quick prompts for document editing
const QUICK_PROMPTS = [
  { 
    id: 'summarize', 
    label: 'Shrň dokument', 
    icon: FileText, 
    prompt: 'Vytvoř stručné shrnutí tohoto dokumentu.',
    bgColor: '#dbeafe',
    textColor: '#2563eb',
    hoverBg: '#bfdbfe'
  },
  { 
    id: 'improve', 
    label: 'Vylepši text', 
    icon: Wand2, 
    prompt: 'Vylepši a zlepši čitelnost tohoto textu. Zachovej význam ale zlepši styl.',
    bgColor: '#f3e8ff',
    textColor: '#9333ea',
    hoverBg: '#e9d5ff'
  },
  { 
    id: 'expand', 
    label: 'Rozšiř obsah', 
    icon: PenLine, 
    prompt: 'Rozšiř tento text o další relevantní informace a detaily.',
    bgColor: '#dcfce7',
    textColor: '#16a34a',
    hoverBg: '#bbf7d0'
  },
  { 
    id: 'simplify', 
    label: 'Zjednodušit', 
    icon: Lightbulb, 
    prompt: 'Zjednodušte tento text tak, aby byl srozumitelný pro mladší čtenáře.',
    bgColor: '#fef3c7',
    textColor: '#d97706',
    hoverBg: '#fde68a'
  },
  { 
    id: 'outline', 
    label: 'Osnova', 
    icon: ListChecks, 
    prompt: 'Vytvoř strukturovanou osnovu tohoto dokumentu s hlavními body.',
    bgColor: '#e0e7ff',
    textColor: '#4f46e5',
    hoverBg: '#c7d2fe'
  },
  { 
    id: 'continue', 
    label: 'Pokračuj v psaní', 
    icon: BookOpen, 
    prompt: 'Pokračuj v psaní tohoto dokumentu. Přidej další odstavec nebo sekci.',
    bgColor: '#ffe4e6',
    textColor: '#e11d48',
    hoverBg: '#fecdd3'
  },
];

export function DocumentAIPanel({
  isOpen,
  onClose,
  documentContent,
  documentTitle,
  selectedText,
  onClearSelection,
  onInsertContent,
  onReplaceContent,
  onReplaceSelection,
  onApplyContent,
  canUndo,
  canRedo,
  onUndo,
  onRedo
}: DocumentAIPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastGeneratedContent, setLastGeneratedContent] = useState<string | null>(null);
  const [mode, setMode] = useState<AIMode>('select');
  const [selectedModel, setSelectedModel] = useState<AIModelId>(() => {
    // Load saved model preference from localStorage
    const saved = localStorage.getItem('document-ai-model');
    return (saved as AIModelId) || 'gemini-3-flash';
  });
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // Analytics
  const analytics = useAnalytics();
  
  // Save model preference when changed
  const handleModelChange = (modelId: AIModelId) => {
    setSelectedModel(modelId);
    localStorage.setItem('document-ai-model', modelId);
    setShowModelDropdown(false);
  };
  
  // Check if we have selected text
  const hasSelection = selectedText && selectedText.text.trim().length > 0;
  
  // Handle selection-based prompt (Canvas-like)
  const handleSelectionPrompt = async (promptTemplate: string) => {
    if (!selectedText || !onReplaceSelection) return;
    
    setIsLoading(true);
    setMessages(prev => [...prev, { role: 'user', content: promptTemplate }]);
    
    try {
      const systemPrompt = `Jsi AI asistent pro úpravu textu. Upravuješ POUZE označenou část dokumentu.

OZNAČENÝ TEXT K ÚPRAVĚ:
${selectedText.text}

DŮLEŽITÉ PRAVIDLA:
1. Odpovídej POUZE v češtině
2. Vrať POUZE upravený text (ne celý dokument)
3. NIKDY nepoužívej markdown (**, *, #, \`\`\`)
4. Pro formátování používej pouze HTML: <strong>, <em>, <p>
5. Zachovej přibližnou délku textu (pokud není řečeno jinak)`;

      const result = await chatWithAIProxy(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: promptTemplate }
        ],
        selectedModel,
        { temperature: 0.7, max_tokens: 2048 }
      );
      
      // Clean up result
      let cleanResult = result
        .replace(/<code>/g, '').replace(/<\/code>/g, '')
        .replace(/<pre>/g, '').replace(/<\/pre>/g, '')
        .replace(/```html/g, '').replace(/```/g, '').replace(/`/g, '')
        .trim();
      
      // Apply the change
      onReplaceSelection(cleanResult);
      
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Označený text byl upraven.',
        isAppliedChange: true
      }]);
      
    } catch (error: any) {
      console.error('Selection prompt error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Chyba: ${error.message || 'Nepodařilo se upravit text'}`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // From-docs mode state
  const [fromDocsStep, setFromDocsStep] = useState<FromDocsStep>('browse');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [libraryMenu, setLibraryMenu] = useState<MenuItem[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);

  // From-my-content state
  const [myDocuments, setMyDocuments] = useState<{ id: string; name: string; type: string; content?: string; folderId?: string }[]>([]);
  const [myFolders, setMyFolders] = useState<{ id: string; name: string; color?: string; children?: any[] }[]>([]);
  const [myFiles, setMyFiles] = useState<StoredFile[]>([]);
  const [myLinks, setMyLinks] = useState<StoredLink[]>([]);
  const [myWorksheets, setMyWorksheets] = useState<WorksheetListItem[]>([]);
  const [selectedMyContent, setSelectedMyContent] = useState<Set<string>>(new Set());
  const [expandedMyFolders, setExpandedMyFolders] = useState<Set<string>>(new Set());

  // Check if document has content
  const hasContent = documentContent && documentContent.trim().length > 0 && 
    documentContent.trim() !== '<p></p>' && 
    documentContent.trim() !== '<p><br></p>';

  // Navigation back handler
  const handleBack = () => {
    if (mode === 'from-docs') {
      if (activeSubject) {
        setActiveSubject(null);
      } else {
        setMode('select');
      }
    } else if (mode === 'from-my-content') {
      setMode('select');
    } else if (mode === 'chat' && !hasContent) {
      setMode('select');
    } else {
      onClose();
    }
  };

  // Select a subject and load its menu
  const selectSubject = async (subject: string) => {
    // Track subject access
    const subjectInfo = SUBJECTS.find(s => s.id === subject);
    analytics.trackSubjectAccessed(subject, subjectInfo?.label || subject, 'ai_panel');
    
    setActiveSubject(subject);
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

  // Fetch page content
  const fetchPageContent = async (identifier: string, category: string): Promise<string> => {
    const pageSlug = identifier.includes('/') ? identifier.split('/').pop() || identifier : identifier;
    const url = `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/pages/${pageSlug}?category=${category}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const pageData = data.page || data;
        const htmlContent = pageData.content || '';
        const textContent = htmlContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        return `### ${pageData.title || pageSlug}\n${textContent}`;
      }
    } catch (error) {
      console.error('Error fetching page:', error);
    }
    return '';
  };

  // Toggle folder expansion
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

  // Get all selectable document identifiers from items
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

  // Toggle document selection
  const toggleDocSelection = (identifier: string, item?: MenuItem) => {
    setSelectedDocs(prev => {
      const next = new Set(prev);
      if (item && isFolder(item) && item.children) {
        const childIds = getAllDocIdentifiers(item.children);
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
      return next;
    });
  };

  // Get folder selection state
  const getFolderSelectionState = (item: MenuItem): boolean | 'partial' => {
    if (!item.children) return false;
    const childIds = getAllDocIdentifiers(item.children);
    if (childIds.length === 0) return false;
    const selectedCount = childIds.filter(id => selectedDocs.has(id)).length;
    if (selectedCount === 0) return false;
    if (selectedCount === childIds.length) return true;
    return 'partial';
  };

  // Start from-docs mode
  const startFromDocsMode = () => {
    setMode('from-docs');
    setFromDocsStep('browse');
    setSelectedDocs(new Set());
    setExpandedFolders(new Set());
    setActiveSubject(null);
    setLibraryMenu([]);
  };

  // Start from-my-content mode
  const startFromMyContentMode = () => {
    setMode('from-my-content');
    setSelectedMyContent(new Set());
    setExpandedMyFolders(new Set());
    
    // Load ALL user content from localStorage
    const filesStr = localStorage.getItem('vivid-my-files');
    const linksStr = localStorage.getItem('vivid-my-links');
    const foldersStr = localStorage.getItem('vivid-my-folders');
    const documentsStr = localStorage.getItem('vivid-my-documents');
    
    const files: StoredFile[] = filesStr ? JSON.parse(filesStr) : [];
    const links: StoredLink[] = linksStr ? JSON.parse(linksStr) : [];
    const folders = foldersStr ? JSON.parse(foldersStr) : [];
    const documents = documentsStr ? JSON.parse(documentsStr) : [];
    
    // Load worksheets
    const worksheets = getWorksheetList();
    
    // Filter out Vividbooks content
    const filteredFolders = folders.filter((f: any) => 
      f.copiedFrom !== 'vividbooks' && f.copiedFrom !== 'vividbooks-category'
    );
    const filteredDocuments = documents.filter((d: any) => 
      d.copiedFrom !== 'vividbooks' && d.copiedFrom !== 'vividbooks-category'
    );
    
    setMyFiles(files);
    setMyLinks(links);
    setMyFolders(filteredFolders);
    setMyDocuments(filteredDocuments);
    setMyWorksheets(worksheets);
  };

  // Toggle my content selection
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

  // Toggle my folder expansion
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

  // Fetch selected docs and apply to document
  const handleApplyFromDocs = async () => {
    if (selectedDocs.size === 0 || !activeSubject) return;
    
    setFromDocsStep('generating');
    setIsLoading(true);
    
    try {
      // Fetch content for all selected pages
      const contentPromises = Array.from(selectedDocs).map(identifier => 
        fetchPageContent(identifier, activeSubject)
      );
      
      const contents = await Promise.all(contentPromises);
      const combinedContent = contents.filter(c => c).join('\n\n');
      
      if (combinedContent && onApplyContent) {
        // Generate HTML from the content using AI proxy
        let htmlContent = await chatWithAIProxy(
          [
            { 
              role: 'system', 
              content: 'Převeď text do formátu HTML dokumentu. Použij pouze tagy <h2>, <h3>, <p>, <strong>, <em>, <ul>, <li>. NEPOUŽÍVEJ markdown, code tagy ani monospace font.'
            },
            { role: 'user', content: combinedContent }
          ],
          selectedModel,
          { temperature: 0.3, max_tokens: 4096 }
        );
        
        // Clean up
        htmlContent = htmlContent
          .replace(/<code>/g, '').replace(/<\/code>/g, '')
          .replace(/<pre>/g, '').replace(/<\/pre>/g, '')
          .replace(/```html/g, '').replace(/```/g, '').replace(/`/g, '');
        
        onApplyContent(htmlContent);
        
        setMessages([{
          role: 'assistant',
          content: `Obsah z ${selectedDocs.size} dokumentů byl vložen do dokumentu.`,
          isAppliedChange: true
        }]);
      }
      
      setMode('chat');
    } catch (error) {
      console.error('Error applying docs:', error);
    } finally {
      setIsLoading(false);
      setFromDocsStep('browse');
    }
  };

  // Apply content from my-content
  const handleApplyFromMyContent = async () => {
    if (selectedMyContent.size === 0) return;
    
    setIsLoading(true);
    
    try {
      // Collect content from selected items
      let combinedContent = '';
      const selectedNames: string[] = [];
      
      // From files (extracted text)
      for (const file of myFiles) {
        if (selectedMyContent.has(file.id)) {
          selectedNames.push(file.fileName);
          if (file.extractedText) {
            combinedContent += `<h2>${file.fileName}</h2>\n<p>${file.extractedText}</p>\n\n`;
          }
        }
      }
      
      // From links (YouTube, websites)
      for (const link of myLinks) {
        if (selectedMyContent.has(link.id)) {
          selectedNames.push(link.title || link.url);
          if (link.extractedText) {
            combinedContent += `<h2>${link.title || 'Odkaz'}</h2>\n<p>${link.extractedText}</p>\n\n`;
          } else if (link.type === 'youtube') {
            // Embed YouTube video
            const videoId = link.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)?.[1];
            if (videoId) {
              combinedContent += `<h2>${link.title || 'YouTube video'}</h2>\n<p><a href="${link.url}" target="_blank">${link.url}</a></p>\n\n`;
            }
          } else {
            combinedContent += `<h2>${link.title || 'Odkaz'}</h2>\n<p><a href="${link.url}" target="_blank">${link.url}</a></p>\n\n`;
          }
        }
      }
      
      // From documents
      for (const doc of myDocuments) {
        if (selectedMyContent.has(doc.id)) {
          selectedNames.push(doc.name);
          if (doc.content) {
            combinedContent += `<h2>${doc.name}</h2>\n${doc.content}\n\n`;
          }
        }
      }
      
      // From worksheets
      const allWorksheets = getWorksheetList();
      for (const wsMeta of allWorksheets) {
        if (selectedMyContent.has(wsMeta.id)) {
          selectedNames.push(wsMeta.title || 'Pracovní list');
          const wsData = getWorksheet(wsMeta.id);
          if (wsData?.blocks) {
            let wsContent = `<h2>${wsMeta.title || 'Pracovní list'}</h2>\n`;
            for (const block of wsData.blocks) {
              const content = block.content as any;
              if (block.type === 'heading' && content?.text) {
                const level = content.level === 'h1' ? 'h2' : content.level === 'h2' ? 'h3' : 'h4';
                wsContent += `<${level}>${content.text}</${level}>\n`;
              } else if (block.type === 'paragraph' && content?.html) {
                wsContent += `${content.html}\n`;
              } else if (block.type === 'infobox') {
                if (content?.title) wsContent += `<p><strong>${content.title}</strong></p>\n`;
                if (content?.html) wsContent += `${content.html}\n`;
              } else if (block.type === 'multiple-choice' && content?.question) {
                wsContent += `<p><strong>Otázka:</strong> ${content.question}</p>\n`;
                if (content?.options?.length) {
                  wsContent += '<ul>\n';
                  for (const opt of content.options) {
                    wsContent += `<li>${opt.text}</li>\n`;
                  }
                  wsContent += '</ul>\n';
                }
              } else if (block.type === 'free-answer' && content?.question) {
                wsContent += `<p><strong>Otázka:</strong> ${content.question}</p>\n`;
                if (content?.hint) wsContent += `<p><em>Nápověda: ${content.hint}</em></p>\n`;
              } else if (block.type === 'fill-blank' && content?.segments) {
                if (content?.instruction) wsContent += `<p><em>${content.instruction}</em></p>\n`;
                let fillText = '';
                for (const seg of content.segments) {
                  if (seg.type === 'text') {
                    fillText += seg.content;
                  } else if (seg.type === 'blank') {
                    fillText += `_____ (${seg.correctAnswer})`;
                  }
                }
                wsContent += `<p>${fillText}</p>\n`;
              } else if (block.type === 'examples' && content?.examples?.length) {
                wsContent += '<p><strong>Příklady:</strong></p>\n<ul>\n';
                for (const ex of content.examples) {
                  wsContent += `<li>${ex.problem} = ${ex.solution || '?'}</li>\n`;
                }
                wsContent += '</ul>\n';
              }
            }
            combinedContent += wsContent + '\n';
          }
        }
      }
      
      // From folder children
      for (const folder of myFolders) {
        if (folder.children) {
          for (const child of folder.children) {
            if (selectedMyContent.has(child.id)) {
              selectedNames.push(child.name);
              if (child.content) {
                combinedContent += `<h2>${child.name}</h2>\n${child.content}\n\n`;
              }
            }
          }
        }
      }
      
      if (combinedContent && onApplyContent) {
        onApplyContent(combinedContent);
        
        setMessages([{
          role: 'assistant',
          content: `Obsah z ${selectedMyContent.size} položek byl vložen do dokumentu.`,
          isAppliedChange: true
        }]);
      } else if (selectedNames.length > 0) {
        // No text content but items were selected - show message
        setMessages([{
          role: 'assistant',
          content: `Vybrané položky (${selectedNames.join(', ')}) nemají textový obsah k vložení.`
        }]);
      }
      
      setMode('chat');
    } catch (error) {
      console.error('Error applying my content:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Render menu item (folder or document)
  const renderMenuItem = (item: MenuItem, depth: number = 0) => {
    const isExpanded = expandedFolders.has(item.id);
    const itemIsFolder = isFolder(item);
    const itemIsDocument = isSelectableDocument(item);
    const itemType = getItemType(item);
    
    if (itemType === 'workbook') return null;
    
    const itemId = getItemIdentifier(item);
    const isSelected = itemIsDocument && itemId
      ? selectedDocs.has(itemId)
      : itemIsFolder
        ? getFolderSelectionState(item)
        : false;
    
    const hasSelectableContent = itemIsFolder
      ? getAllDocIdentifiers(item.children || []).length > 0
      : itemIsDocument;
    
    const docType = DOCUMENT_TYPES.find(t => t.id === itemType);
    const IconComponent = docType?.icon;

    return (
      <div key={item.id}>
        <div
          className="flex items-center gap-2 py-2 px-2 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors"
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
              <div className="w-4" />
              {IconComponent ? (
                <IconComponent className={`h-4 w-4 ${docType?.color || 'text-blue-500'}`} />
              ) : (
                <FileText className="h-4 w-4 text-blue-500" />
              )}
            </>
          )}

          <span className="text-sm text-slate-700 truncate">{item.label}</span>
        </div>

        {itemIsFolder && isExpanded && item.children && (
          <div>
            {item.children.map(child => renderMenuItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const sendMessage = async (prompt: string) => {
    if (!prompt.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: prompt };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // Check if we have selected text - if so, work only with selection
    const workingWithSelection = hasSelection && onReplaceSelection;

    try {
      let systemPrompt: string;
      
      if (workingWithSelection) {
        // Working with selected text only
        systemPrompt = `Jsi AI asistent pro úpravu textu. Upravuješ POUZE označenou část dokumentu.

OZNAČENÝ TEXT K ÚPRAVĚ:
${selectedText?.text}

DŮLEŽITÉ PRAVIDLA:
1. Odpovídej POUZE v češtině
2. Vrať POUZE upravený text označené části (ne celý dokument)
3. NIKDY nepoužívej markdown (**, *, #, \`\`\`)
4. Pro formátování používej pouze HTML: <strong>, <em>, <p>
5. Zachovej přibližnou délku a styl textu`;
      } else {
        // Working with whole document
        systemPrompt = `Jsi AI asistent pro tvorbu vzdělávacích dokumentů. Pomáháš učitelům psát a upravovat dokumenty.

Aktuální dokument:
Název: ${documentTitle}
Obsah: ${documentContent || '(prázdný dokument)'}

DŮLEŽITÉ PRAVIDLA:
1. Odpovídej POUZE v češtině
2. NIKDY nepoužívej markdown syntaxi (žádné **, *, #, \`\`\`, \` atd.)
3. NIKDY nepoužívej <code> tagy ani monospace font
4. Pro formátování používej POUZE tyto HTML tagy:
   - <p> pro odstavce (běžný text)
   - <h2>, <h3> pro nadpisy
   - <strong> pro tučné písmo
   - <em> pro kurzívu
   - <ul><li> pro seznamy
5. Vrať POUZE upravený obsah dokumentu jako čisté HTML
6. Zachovej styl a strukturu původního dokumentu
7. Text musí být v normálním fontu, ne v code/monospace`;
      }

      // Use AI proxy with selected model
      let text = await chatWithAIProxy(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        selectedModel,
        { temperature: 0.7, max_tokens: 4096 }
      );
      
      if (!text) {
        text = 'Nepodařilo se vygenerovat odpověď.';
      }

      // Clean up the response - remove code tags and markdown artifacts
      text = text
        .replace(/<code>/g, '')
        .replace(/<\/code>/g, '')
        .replace(/<pre>/g, '')
        .replace(/<\/pre>/g, '')
        .replace(/```html/g, '')
        .replace(/```/g, '')
        .replace(/`/g, '')
        .trim();
      
      if (workingWithSelection && onReplaceSelection) {
        // Apply only to selected text
        onReplaceSelection(text);
        const assistantMessage: Message = { 
          role: 'assistant', 
          content: 'Označený text byl upraven.',
          isAppliedChange: true 
        };
        setMessages(prev => [...prev, assistantMessage]);
        setLastGeneratedContent(text);
      } else {
        // Check if response contains HTML content that can be inserted
        const hasHtmlContent = text.includes('<p>') || text.includes('<h2>') || text.includes('<ul>');
        
        if (hasHtmlContent && onApplyContent) {
          // Auto-apply content and show simple message
          onApplyContent(text);
          const assistantMessage: Message = { 
            role: 'assistant', 
            content: 'Změny byly aplikovány do dokumentu. Podívej se na výsledek vpravo.',
            isAppliedChange: true 
          };
          setMessages(prev => [...prev, assistantMessage]);
          setLastGeneratedContent(text);
        } else {
          // Show full response for non-HTML content
          const assistantMessage: Message = { role: 'assistant', content: text };
          setMessages(prev => [...prev, assistantMessage]);
          setLastGeneratedContent(hasHtmlContent ? text : null);
        }
      }
    } catch (error) {
      console.error('AI Error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Omlouvám se, došlo k chybě při zpracování požadavku. Zkuste to prosím znovu.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    sendMessage(prompt);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  };

  const handleInsertContent = () => {
    if (lastGeneratedContent) {
      onInsertContent(lastGeneratedContent);
      setLastGeneratedContent(null);
    }
  };

  const handleReplaceContent = () => {
    if (lastGeneratedContent) {
      onReplaceContent(lastGeneratedContent);
      setLastGeneratedContent(null);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setLastGeneratedContent(null);
  };

  if (!isOpen) return null;

  // ========================================
  // MODE SELECTION - Empty document
  // ========================================
  if (mode === 'select' && !hasContent) {
  return (
    <div 
        className="bg-white shadow-2xl flex flex-col"
        style={{ width: '400px', height: '100vh', zIndex: 99999 }}
    >
      {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
          <h3 className="font-medium text-slate-700 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-500" />
            AI Asistent
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            title="Zavřít"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mode Selection */}
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="mb-6 w-16 h-16 bg-blue-50 flex items-center justify-center rounded-2xl shadow-sm border-2 border-blue-100">
            <Sparkles className="h-8 w-8 text-blue-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-4" style={{ fontFamily: "'Cooper Light', serif", fontWeight: 300 }}>
            Co chcete udělat?
          </h2>
          <div className="text-sm text-slate-500 text-center mb-10 max-w-sm leading-relaxed">
            <p>Otevřete si naše materiály s doložkou MŠMT v levém menu.</p>
            <p>Nebo si zde vytvořte něco podle sebe.</p>
          </div>
          
          <div className="w-full max-w-xs space-y-3">
            <button
              onClick={() => setMode('chat')}
              className="w-full flex items-center gap-4 p-4 rounded-3xl border-2 border-blue-100 bg-blue-50 hover:bg-blue-100 hover:border-blue-200 transition-all text-left group"
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform" style={{ backgroundColor: '#2563eb' }}>
                <FilePlus className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="font-bold text-slate-800 text-base leading-tight">Vytvořit obsah</p>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">Generovat bloky a úlohy pomocí AI</p>
              </div>
            </button>

            <button
              onClick={startFromDocsMode}
              className="w-full flex items-center gap-4 p-4 rounded-3xl border-2 border-amber-100 bg-amber-50 hover:bg-amber-100 hover:border-amber-200 transition-all text-left group"
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform" style={{ backgroundColor: '#f59e0b' }}>
                <Library className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="font-bold text-slate-800 text-base leading-tight">Z Vividbooks</p>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">Vytvořit z dokumentů knihovny</p>
              </div>
            </button>

            <button
              onClick={startFromMyContentMode}
              className="w-full flex items-center gap-4 p-4 rounded-3xl border-2 border-green-100 bg-green-50 hover:bg-green-100 hover:border-green-200 transition-all text-left group"
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform" style={{ backgroundColor: '#10b981' }}>
                <FolderUp className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="font-bold text-slate-800 text-base leading-tight">Z mého obsahu</p>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">Vytvořit z mých souborů a odkazů</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ========================================
  // FROM DOCS MODE - Select documents from Vividbooks
  // ========================================
  if (mode === 'from-docs') {
    // Step 1: Select subject
    if (!activeSubject) {
      return (
        <div 
          className="bg-white shadow-2xl flex flex-col"
          style={{ width: '400px', height: '100vh', zIndex: 99999 }}
        >
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
                onClick={onClose}
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

    // Step 2: Browse and select documents
    return (
      <div 
        className="bg-white shadow-2xl flex flex-col"
        style={{ width: '400px', height: '100vh', zIndex: 99999 }}
      >
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
              onClick={onClose}
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

        <div className="flex-1 overflow-y-auto p-2">
          {isLoadingLibrary ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            </div>
          ) : libraryMenu.length > 0 ? (
            libraryMenu
              .filter(item => getItemType(item) !== 'workbook')
              .map(item => renderMenuItem(item))
          ) : (
            <p className="text-sm text-slate-500 text-center py-8">Žádný obsah</p>
          )}
        </div>

        <div className="shrink-0 p-4 border-t border-slate-200 bg-slate-50">
          <button
            onClick={handleApplyFromDocs}
            disabled={selectedDocs.size === 0 || isLoading}
            className="w-full py-3 rounded-xl text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{ backgroundColor: selectedDocs.size > 0 ? '#2563eb' : '#94a3b8' }}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Načítám...
              </>
            ) : (
              `Vložit do dokumentu (${selectedDocs.size})`
            )}
          </button>
        </div>
      </div>
    );
  }

  // ========================================
  // FROM MY CONTENT MODE - Select from user's content
  // ========================================
  if (mode === 'from-my-content') {
    return (
      <div 
        className="bg-white shadow-2xl flex flex-col"
        style={{ width: '400px', height: '100vh', zIndex: 99999 }}
      >
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
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <FolderUp className="h-5 w-5 text-green-500" />
            Z mého obsahu
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {selectedMyContent.size > 0 ? `Vybráno: ${selectedMyContent.size} položek` : 'Vyberte dokumenty'}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {myDocuments.length === 0 && myFolders.length === 0 && myFiles.length === 0 && myLinks.length === 0 && myWorksheets.length === 0 ? (
            <div className="text-center py-8">
              <FolderUp className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">Žádný vlastní obsah</p>
              <p className="text-xs text-slate-400 mt-1">Přidejte obsah v "Můj obsah"</p>
            </div>
          ) : (
            <>
              {/* Render folders with their content */}
              {myFolders.map(folder => {
                // Get items in this folder
                const folderFiles = myFiles.filter(f => f.folderId === folder.id);
                const folderLinks = myLinks.filter(l => l.folderId === folder.id);
                const folderDocs = myDocuments.filter(d => (d as any).folderId === folder.id);
                const folderWorksheets = getWorksheetsInFolder(folder.id);
                const folderChildren = folder.children || [];
                const allItems = [...folderFiles, ...folderLinks, ...folderDocs, ...folderWorksheets, ...folderChildren];

                if (allItems.length === 0 && folderChildren.length === 0) return null;
                
                return (
                  <div key={folder.id}>
                    <div
                      className="flex items-center gap-2 py-2 px-2 rounded-lg cursor-pointer hover:bg-slate-100"
                      onClick={() => toggleMyFolder(folder.id)}
                    >
                      <ChevronRight 
                        className={`h-4 w-4 text-slate-400 transition-transform ${expandedMyFolders.has(folder.id) ? 'rotate-90' : ''}`} 
                      />
                      {expandedMyFolders.has(folder.id) ? (
                        <FolderOpen className="h-4 w-4 text-amber-500" />
                      ) : (
                        <Folder className="h-4 w-4 text-amber-500" />
                      )}
                      <span className="text-sm text-slate-700 font-medium">{folder.name}</span>
                      <span className="text-xs text-slate-400 ml-auto">{allItems.length}</span>
                    </div>
                    {expandedMyFolders.has(folder.id) && (
                      <div className="ml-6">
                        {/* Links in folder */}
                        {folderLinks.map(link => (
                          <div
                            key={link.id}
                            className="flex items-center gap-2 py-2 px-2 rounded-lg cursor-pointer hover:bg-slate-100"
                            onClick={() => toggleMyContentSelection(link.id)}
                          >
                            <div
                              className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                              style={{
                                border: selectedMyContent.has(link.id) ? 'none' : '1.5px solid #94a3b8',
                                backgroundColor: selectedMyContent.has(link.id) ? '#2563eb' : 'transparent',
                              }}
                            >
                              {selectedMyContent.has(link.id) && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                            </div>
                            {link.type === 'youtube' ? (
                              <Youtube className="h-4 w-4 text-red-500" />
                            ) : (
                              <Link2 className="h-4 w-4 text-blue-500" />
                            )}
                            <span className="text-sm text-slate-700 truncate">{link.title || link.url}</span>
                          </div>
                        ))}
                        {/* Files in folder */}
                        {folderFiles.map(file => {
                          const isImage = file.mimeType?.startsWith('image/');
                          const isVideo = file.mimeType?.startsWith('video/');
                          const isAudio = file.mimeType?.startsWith('audio/');
                          const isPdf = file.mimeType === 'application/pdf';
                          return (
                            <div
                              key={file.id}
                              className="flex items-center gap-2 py-2 px-2 rounded-lg cursor-pointer hover:bg-slate-100"
                              onClick={() => toggleMyContentSelection(file.id)}
                            >
                              <div
                                className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                                style={{
                                  border: selectedMyContent.has(file.id) ? 'none' : '1.5px solid #94a3b8',
                                  backgroundColor: selectedMyContent.has(file.id) ? '#2563eb' : 'transparent',
                                }}
                              >
                                {selectedMyContent.has(file.id) && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                              </div>
                              {isImage ? <FileImage className="h-4 w-4 text-green-500" /> 
                               : isVideo ? <FileVideo className="h-4 w-4 text-purple-500" />
                               : isAudio ? <FileAudio className="h-4 w-4 text-orange-500" />
                               : isPdf ? <FileText className="h-4 w-4 text-red-500" />
                               : <File className="h-4 w-4 text-slate-500" />}
                              <span className="text-sm text-slate-700 truncate">{file.fileName}</span>
                            </div>
                          );
                        })}
                        {/* Documents in folder */}
                        {folderDocs.map(doc => (
                          <div
                            key={doc.id}
                            className="flex items-center gap-2 py-2 px-2 rounded-lg cursor-pointer hover:bg-slate-100"
                            onClick={() => toggleMyContentSelection(doc.id)}
                          >
                            <div
                              className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                              style={{
                                border: selectedMyContent.has(doc.id) ? 'none' : '1.5px solid #94a3b8',
                                backgroundColor: selectedMyContent.has(doc.id) ? '#2563eb' : 'transparent',
                              }}
                            >
                              {selectedMyContent.has(doc.id) && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                            </div>
                            <FileText className="h-4 w-4 text-blue-500" />
                            <span className="text-sm text-slate-700">{doc.name}</span>
                          </div>
                        ))}
                        {/* Worksheets in folder */}
                        {folderWorksheets.map(ws => (
                          <div
                            key={ws.id}
                            className="flex items-center gap-2 py-2 px-2 rounded-lg cursor-pointer hover:bg-slate-100"
                            onClick={() => toggleMyContentSelection(ws.id)}
                          >
                            <div
                              className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                              style={{
                                border: selectedMyContent.has(ws.id) ? 'none' : '1.5px solid #94a3b8',
                                backgroundColor: selectedMyContent.has(ws.id) ? '#2563eb' : 'transparent',
                              }}
                            >
                              {selectedMyContent.has(ws.id) && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                            </div>
                            <FileEdit className="h-4 w-4 text-amber-500" />
                            <span className="text-sm text-slate-700">{ws.title || 'Bez názvu'}</span>
                          </div>
                        ))}
                        {/* Children from folder.children */}
                        {folderChildren.map((child: any) => (
                          <div
                            key={child.id}
                            className="flex items-center gap-2 py-2 px-2 rounded-lg cursor-pointer hover:bg-slate-100"
                            onClick={() => toggleMyContentSelection(child.id)}
                          >
                            <div
                              className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                              style={{
                                border: selectedMyContent.has(child.id) ? 'none' : '1.5px solid #94a3b8',
                                backgroundColor: selectedMyContent.has(child.id) ? '#2563eb' : 'transparent',
                              }}
                            >
                              {selectedMyContent.has(child.id) && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                            </div>
                            <FileText className="h-4 w-4 text-blue-500" />
                            <span className="text-sm text-slate-700">{child.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Items without folder (root level) */}
              {(() => {
                const rootFiles = myFiles.filter(f => !f.folderId);
                const rootLinks = myLinks.filter(l => !l.folderId);
                const rootDocs = myDocuments.filter(d => !(d as any).folderId);
                const rootWorksheets = getWorksheetsInFolder(null);
                
                if (rootFiles.length === 0 && rootLinks.length === 0 && rootDocs.length === 0 && rootWorksheets.length === 0) return null;
                
                return (
                  <div className="mt-2 pt-2 border-t border-slate-100">
                    <p className="text-xs font-medium text-slate-400 uppercase px-2 py-1">Bez složky</p>
                    {/* Root links */}
                    {rootLinks.map(link => (
                      <div
                        key={link.id}
                        className="flex items-center gap-2 py-2 px-2 rounded-lg cursor-pointer hover:bg-slate-100"
                        onClick={() => toggleMyContentSelection(link.id)}
                      >
                        <div
                          className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                          style={{
                            border: selectedMyContent.has(link.id) ? 'none' : '1.5px solid #94a3b8',
                            backgroundColor: selectedMyContent.has(link.id) ? '#2563eb' : 'transparent',
                          }}
                        >
                          {selectedMyContent.has(link.id) && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                        </div>
                        {link.type === 'youtube' ? (
                          <Youtube className="h-4 w-4 text-red-500" />
                        ) : (
                          <Link2 className="h-4 w-4 text-blue-500" />
                        )}
                        <span className="text-sm text-slate-700 truncate">{link.title || link.url}</span>
                      </div>
                    ))}
                    {/* Root files */}
                    {rootFiles.map(file => {
                      const isImage = file.mimeType?.startsWith('image/');
                      const isVideo = file.mimeType?.startsWith('video/');
                      const isAudio = file.mimeType?.startsWith('audio/');
                      const isPdf = file.mimeType === 'application/pdf';
                      return (
                        <div
                          key={file.id}
                          className="flex items-center gap-2 py-2 px-2 rounded-lg cursor-pointer hover:bg-slate-100"
                          onClick={() => toggleMyContentSelection(file.id)}
                        >
                          <div
                            className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                            style={{
                              border: selectedMyContent.has(file.id) ? 'none' : '1.5px solid #94a3b8',
                              backgroundColor: selectedMyContent.has(file.id) ? '#2563eb' : 'transparent',
                            }}
                          >
                            {selectedMyContent.has(file.id) && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                          </div>
                          {isImage ? <FileImage className="h-4 w-4 text-green-500" /> 
                           : isVideo ? <FileVideo className="h-4 w-4 text-purple-500" />
                           : isAudio ? <FileAudio className="h-4 w-4 text-orange-500" />
                           : isPdf ? <FileText className="h-4 w-4 text-red-500" />
                           : <File className="h-4 w-4 text-slate-500" />}
                          <span className="text-sm text-slate-700 truncate">{file.fileName}</span>
                        </div>
                      );
                    })}
                    {/* Root documents */}
                    {rootDocs.map(doc => (
                      <div
                        key={doc.id}
                        className="flex items-center gap-2 py-2 px-2 rounded-lg cursor-pointer hover:bg-slate-100"
                        onClick={() => toggleMyContentSelection(doc.id)}
                      >
                        <div
                          className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                          style={{
                            border: selectedMyContent.has(doc.id) ? 'none' : '1.5px solid #94a3b8',
                            backgroundColor: selectedMyContent.has(doc.id) ? '#2563eb' : 'transparent',
                          }}
                        >
                          {selectedMyContent.has(doc.id) && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                        </div>
                        <FileText className="h-4 w-4 text-blue-500" />
                        <span className="text-sm text-slate-700">{doc.name}</span>
                      </div>
                    ))}
                    {/* Root worksheets */}
                    {rootWorksheets.map(ws => (
                      <div
                        key={ws.id}
                        className="flex items-center gap-2 py-2 px-2 rounded-lg cursor-pointer hover:bg-slate-100"
                        onClick={() => toggleMyContentSelection(ws.id)}
                      >
                        <div
                          className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                          style={{
                            border: selectedMyContent.has(ws.id) ? 'none' : '1.5px solid #94a3b8',
                            backgroundColor: selectedMyContent.has(ws.id) ? '#2563eb' : 'transparent',
                          }}
                        >
                          {selectedMyContent.has(ws.id) && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                        </div>
                        <FileEdit className="h-4 w-4 text-amber-500" />
                        <span className="text-sm text-slate-700">{ws.title || 'Bez názvu'}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </>
          )}
        </div>

        <div className="shrink-0 p-4 border-t border-slate-200 bg-slate-50">
          <button
            onClick={handleApplyFromMyContent}
            disabled={selectedMyContent.size === 0 || isLoading}
            className="w-full py-3 rounded-xl text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{ backgroundColor: selectedMyContent.size > 0 ? '#10b981' : '#94a3b8' }}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Načítám...
              </>
            ) : (
              `Vložit do dokumentu (${selectedMyContent.size})`
            )}
          </button>
        </div>
      </div>
    );
  }

  // ========================================
  // CHAT MODE - Document has content or user chose to create
  // ========================================
  return (
    <div 
      className="bg-white shadow-2xl flex flex-col"
      style={{ width: '400px', height: '100vh', zIndex: 99999 }}
    >
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2">
          {!hasContent && (
            <button
              onClick={() => setMode('select')}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors mr-1"
              title="Zpět"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <h3 className="font-medium text-slate-700 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-500" />
            AI Asistent
          </h3>
        </div>
        <div className="flex items-center gap-1">
          {/* Undo/Redo buttons */}
          {(canUndo || canRedo) && (
            <div className="flex items-center gap-1 mr-2">
              <button
                onClick={onUndo}
                disabled={!canUndo}
                className={`p-1.5 rounded-lg transition-colors ${canUndo ? 'hover:bg-slate-100 text-slate-600' : 'text-slate-300 cursor-not-allowed'}`}
                title="Zpět"
              >
                <Undo2 className="h-4 w-4" />
              </button>
              <button
                onClick={onRedo}
                disabled={!canRedo}
                className={`p-1.5 rounded-lg transition-colors ${canRedo ? 'hover:bg-slate-100 text-slate-600' : 'text-slate-300 cursor-not-allowed'}`}
                title="Vpřed"
              >
                <Redo2 className="h-4 w-4" />
              </button>
            </div>
          )}
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              title="Vymazat chat"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            title="Zavřít"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.length === 0 ? (
          <div className="space-y-4">
            <div className="text-center py-6">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-blue-50 flex items-center justify-center">
                <Sparkles className="h-7 w-7 text-blue-500" />
              </div>
              <h3 className="font-semibold text-slate-800 mb-1">AI Asistent</h3>
              <p className="text-sm text-slate-500">
                {hasContent 
                  ? 'Pomohu vám s úpravou dokumentu' 
                  : 'Popište, jaký obsah chcete vytvořit'}
              </p>
            </div>

            {/* Selection-based prompts (Canvas-like) - show when text is selected */}
            {hasSelection && onReplaceSelection && (
            <div className="space-y-3">
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Pencil className="h-4 w-4 text-indigo-600" />
                    <p className="text-sm font-medium text-indigo-800">Označený text</p>
                  </div>
                  <button
                    onClick={() => {
                      if (onClearSelection) {
                        onClearSelection();
                      }
                    }}
                    className="text-xs text-indigo-500 hover:text-indigo-700 hover:underline"
                  >
                    Zrušit výběr
                  </button>
                </div>
                <p className="text-xs text-indigo-600 line-clamp-3 italic">
                  "{selectedText?.text.substring(0, 150)}{selectedText && selectedText.text.length > 150 ? '...' : ''}"
                </p>
              </div>
              
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider px-1">
                Upravit označený text
              </p>
              <div className="grid grid-cols-2 gap-2">
                {SELECTION_PROMPTS.map(prompt => {
                  const Icon = prompt.icon;
                  return (
                    <button
                      key={prompt.id}
                      onClick={() => handleSelectionPrompt(prompt.prompt)}
                      disabled={isLoading}
                      className="flex items-center gap-2 p-3 rounded-xl text-left transition-all shadow-sm hover:shadow-md disabled:opacity-50"
                      style={{
                        backgroundColor: prompt.bgColor,
                        color: prompt.textColor,
                      }}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="text-sm font-medium">{prompt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            )}
            
            {/* Quick Prompts - only show if document has content and NO selection */}
            {hasContent && !hasSelection && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider px-1">
                Rychlé akce
              </p>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_PROMPTS.map(prompt => {
                  const Icon = prompt.icon;
                  return (
                    <button
                      key={prompt.id}
                      onClick={() => handleQuickPrompt(prompt.prompt)}
                      className="flex items-center gap-2 p-3 rounded-xl text-left transition-all shadow-sm hover:shadow-md"
                      style={{
                        backgroundColor: prompt.bgColor,
                        color: prompt.textColor,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = prompt.hoverBg;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = prompt.bgColor;
                      }}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="text-sm font-medium">{prompt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            )}

            {/* Example prompts for empty document */}
            {!hasContent && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider px-1">
                  Příklady
                </p>
                <div className="space-y-2">
                  {[
                    'Vytvoř lekci o fotosyntéze pro 6. třídu',
                    'Napiš shrnutí o druhé světové válce',
                    'Připrav výklad o zlomcích s příklady',
                  ].map((example, idx) => (
                    <button
                      key={idx}
                      onClick={() => sendMessage(example)}
                      className="w-full text-left p-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-sm text-slate-600 transition-colors"
                    >
                      "{example}"
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.isAppliedChange ? (
                // Special card for applied changes
                <div className="w-full bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-green-800">Změny aplikovány</p>
                      <p className="text-sm text-green-600">Podívej se na dokument vpravo →</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-green-600">
                    <Eye className="h-3.5 w-3.5" />
                    <span>Použij šipky v hlavičce pro Zpět/Vpřed</span>
                  </div>
                </div>
              ) : (
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-indigo-500 text-white'
                    : 'bg-slate-100 text-slate-800'
                }`}
              >
                {message.role === 'assistant' ? (
                  <div 
                    className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2"
                    dangerouslySetInnerHTML={{ __html: message.content }}
                  />
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                )}
              </div>
              )}
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-100 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                <span className="text-sm text-slate-500">Přemýšlím...</span>
              </div>
            </div>
          </div>
        )}
      </div>


      {/* Input */}
      <div className="shrink-0 p-4 border-t border-slate-200 bg-slate-50">
        {/* Model Selector */}
        <div className="relative mb-2">
          <button
            onClick={() => setShowModelDropdown(!showModelDropdown)}
            className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <Sparkles className="h-3 w-3" />
            <span>{AI_MODELS.find(m => m.id === selectedModel)?.label || selectedModel}</span>
            <ChevronRight className={`h-3 w-3 transition-transform ${showModelDropdown ? 'rotate-90' : ''}`} />
          </button>
          
          {showModelDropdown && (
            <div className="absolute bottom-full left-0 mb-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-50 min-w-[180px]">
              {AI_MODELS.map(model => (
                <button
                  key={model.id}
                  onClick={() => handleModelChange(model.id)}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                    selectedModel === model.id 
                      ? 'bg-indigo-50 text-indigo-700' 
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <Check className={`h-3.5 w-3.5 ${selectedModel === model.id ? 'opacity-100' : 'opacity-0'}`} />
                  <span>{model.label}</span>
                  <span className="text-xs text-slate-400 ml-auto">
                    {model.provider === 'google' ? 'Google' : 'OpenAI'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={hasContent ? "Napište zprávu..." : "Popište, co chcete vytvořit..."}
            className="flex-1 px-4 py-2.5 text-sm border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            rows={2}
            disabled={isLoading}
          />
          <button
            onClick={() => sendMessage(inputValue)}
            disabled={!inputValue.trim() || isLoading}
            className="p-2.5 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default DocumentAIPanel;

