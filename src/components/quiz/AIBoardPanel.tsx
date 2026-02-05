/**
 * AIBoardPanel - AI Chat panel pro editor boardů
 * 
 * Tři režimy:
 * 1. Vytvořit - generuje nové slidy, uživatel vybírá a vkládá
 * 2. Z Vividbooks - výběr dokumentů z knihovny a generování obsahu
 * 3. Z mého obsahu - výběr ze souborů a odkazů
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Loader2, 
  Sparkles, 
  Trash2, 
  ChevronRight, 
  Check, 
  Plus, 
  FileText, 
  HelpCircle, 
  CheckCircle2, 
  BookOpen, 
  Pencil, 
  FilePlus, 
  ArrowLeft, 
  Folder, 
  FolderOpen, 
  Library, 
  ClipboardList, 
  FileEdit, 
  X,
  ListOrdered,
  MessageSquare,
  Lightbulb,
  FolderUp,
  Link2,
} from 'lucide-react';
import { Button } from '../ui/button';
import {
  Quiz,
  QuizSlide,
  createABCSlide,
  createOpenSlide,
  createExampleSlide,
  createInfoSlide,
  createBoardSlide,
  createVotingSlide,
  createFillBlanksSlide,
  createConnectPairsSlide,
  createSlideLayout,
} from '../../types/quiz';
import { StoredFile, StoredLink } from '../../types/file-storage';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { chatWithAIProxy } from '../../utils/ai-chat-proxy';
import { getWorksheetList } from '../../utils/worksheet-storage';
import { useFileStorage } from '../../hooks/useFileStorage';

type AIMode = 'select' | 'create' | 'from-docs' | 'from-my-content';
type FromDocsStep = 'browse' | 'select-type' | 'generating';
type FromMyContentStep = 'browse' | 'select-type' | 'generating';
type ContentType = 'quiz' | 'test';

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

// Available subjects
const SUBJECTS = [
  { id: 'fyzika', label: 'Fyzika', color: '#7c3aed' },
  { id: 'chemie', label: 'Chemie', color: '#ef4444' },
  { id: 'prirodopis', label: 'Přírodopis', color: '#22c55e' },
  { id: 'matematika', label: 'Matematika', color: '#3b82f6' },
  { id: 'dejepis', label: 'Dějepis', color: '#d97706' },
];

// Quick prompts for create mode
const QUICK_PROMPTS = [
  { label: 'ABC otázky k tématu', prompt: 'Vytvoř 5 ABC otázek k tématu', icon: '📝' },
  { label: 'Otevřené otázky', prompt: 'Vytvoř 3 otevřené otázky k procvičení', icon: '💭' },
  { label: 'Příklady s řešením', prompt: 'Vytvoř 3 příklady s krokovým řešením', icon: '🧮' },
  { label: 'Informační slidy', prompt: 'Vytvoř informační slidy s vysvětlením tématu', icon: '📚' },
];

// AI Message type
interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  generatedSlides?: QuizSlide[];
  applied?: boolean;
  error?: string;
}

const createAIMessage = (role: 'user' | 'assistant', content: string): AIMessage => ({
  id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  role,
  content,
});

interface AIBoardPanelProps {
  quiz: Quiz;
  onAddSlides: (slides: QuizSlide[]) => void;
  onClose?: () => void;
  pdfTranscript?: string; // Transcript from PDF with activity markers
}

export function AIBoardPanel({
  quiz,
  onAddSlides,
  onClose,
  pdfTranscript,
}: AIBoardPanelProps) {
  const hasContent = quiz?.slides && quiz.slides.length > 0;
  
  // Debug log
  console.log('[AIBoardPanel] Received props:', {
    pdfTranscriptProp: pdfTranscript ? `${pdfTranscript?.length} chars` : 'none',
    quizPdfTranscript: quiz?.pdfTranscript ? `${quiz.pdfTranscript.length} chars` : 'none',
    quizTitle: quiz?.title,
  });

  // File storage hook - for uploaded files (PDF, PPTX, etc.)
  const { files: uploadedFiles, loading: filesLoading } = useFileStorage();
  
  // Mode state
  const [mode, setMode] = useState<AIMode>('select');
  
  // Chat state
  const [messages, setMessages] = useState<AIMessage[]>([
    createAIMessage('assistant', 'Ahoj! Jsem AI asistent pro tvorbu boardů. Řekni mi, jaké slidy chceš vytvořit, nebo vyber některou z rychlých akcí.')
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showQuickPrompts, setShowQuickPrompts] = useState(true);
  const [showPdfAction, setShowPdfAction] = useState(false);
  
  // Effect to handle PDF transcript when it becomes available
  useEffect(() => {
    if (pdfTranscript && pdfTranscript.length > 0) {
      console.log('[AIBoardPanel] PDF transcript detected, length:', pdfTranscript.length);
      setMode('create');
      setShowPdfAction(true);
      setShowQuickPrompts(false);
      setMessages([
        createAIMessage('assistant', '📄 Načetl jsem přepis z PDF! Klikni na "Generovat aktivity z PDF" níže.')
      ]);
    }
  }, [pdfTranscript]);
  
  // Selection state for generated slides
  const [selectedSlides, setSelectedSlides] = useState<Map<string, Set<string>>>(new Map());
  
  // From-docs state
  const [fromDocsStep, setFromDocsStep] = useState<FromDocsStep>('browse');
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [libraryMenu, setLibraryMenu] = useState<MenuItem[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [selectedContentType, setSelectedContentType] = useState<ContentType | null>(null);
  const [isGeneratingFromDocs, setIsGeneratingFromDocs] = useState(false);
  
  // From-my-content state
  const [fromMyContentStep, setFromMyContentStep] = useState<FromMyContentStep>('browse');
  const [myFiles, setMyFiles] = useState<StoredFile[]>([]);
  const [myLinks, setMyLinks] = useState<StoredLink[]>([]);
  const [myFolders, setMyFolders] = useState<any[]>([]);
  const [myDocuments, setMyDocuments] = useState<any[]>([]);
  const [myWorksheets, setMyWorksheets] = useState<any[]>([]);
  const [expandedMyFolders, setExpandedMyFolders] = useState<Set<string>>(new Set());
  const [selectedMyContent, setSelectedMyContent] = useState<Set<string>>(new Set());
  const [isGeneratingFromMyContent, setIsGeneratingFromMyContent] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Initialize selection for new messages with slides
  useEffect(() => {
    let hasChanges = false;
    const newMap = new Map(selectedSlides);
    
    messages.forEach(msg => {
      if (msg.generatedSlides && msg.generatedSlides.length > 0 && !msg.applied && !newMap.has(msg.id)) {
        newMap.set(msg.id, new Set(msg.generatedSlides.map(s => s.id)));
        hasChanges = true;
      }
    });

    if (hasChanges) {
      setSelectedSlides(newMap);
    }
  }, [messages]);

  // Navigation handlers
  const handleBack = () => {
    if (mode === 'from-docs') {
      if (fromDocsStep === 'select-type') {
        setFromDocsStep('browse');
      } else if (fromDocsStep === 'browse' && activeSubject) {
        setActiveSubject(null);
      } else {
        setMode('select');
      }
    } else if (mode === 'from-my-content') {
      if (fromMyContentStep === 'select-type') {
        setFromMyContentStep('browse');
      } else {
        setMode('select');
      }
    } else if (mode === 'create') {
      setMode('select');
    } else {
      onClose?.();
    }
  };

  const handleClose = () => {
    onClose?.();
  };

  // ============================================
  // AI GENERATION
  // ============================================

  // Helper to clean content - remove raw HTML if AI generated it incorrectly
  const cleanContent = (content: string): string => {
    if (!content) return '';
    // If content is wrapped in HTML tags like <p>...</p>, extract the text
    // Only do this if it looks like raw HTML being displayed
    const trimmed = content.trim();
    if (trimmed.startsWith('<p>') && trimmed.endsWith('</p>')) {
      // Extract content between tags
      return trimmed.replace(/<\/?p>/g, '').trim();
    }
    if (trimmed.startsWith('<div>') && trimmed.endsWith('</div>')) {
      return trimmed.replace(/<\/?div>/g, '').trim();
    }
    return content;
  };

  const generateSlides = async (prompt: string): Promise<QuizSlide[]> => {
    const systemPrompt = `Jsi expertní asistent pro tvorbu vzdělávacích Vividboardů pro české základní školy.

## DOSTUPNÉ TYPY SLIDŮ:

### 1. INFO - Informační slide s bloky
\`\`\`json
{
  "type": "info",
  "layout": {
    "type": "title-content",
    "blocks": [
      { "id": "block-1", "type": "text", "content": "Nadpis", "fontSize": "xlarge", "fontWeight": "bold", "textAlign": "center" },
      { "id": "block-2", "type": "text", "content": "<p>Text obsahu...</p>", "fontSize": "medium" }
    ],
    "titleHeight": 15
  }
}
\`\`\`
Layouty: "single", "title-content", "title-2cols", "title-3cols", "2cols", "3cols"
Typy bloků: "text", "image", "lottie"

### 2. ABC - Výběr z možností (kvízová otázka)
\`\`\`json
{
  "type": "abc",
  "question": "Jaký je vzorec pro rychlost?",
  "questionImage": "",
  "options": [
    { "id": "a", "label": "A", "content": "v = s/t", "isCorrect": true },
    { "id": "b", "label": "B", "content": "v = t/s", "isCorrect": false },
    { "id": "c", "label": "C", "content": "v = s×t", "isCorrect": false },
    { "id": "d", "label": "D", "content": "v = s+t", "isCorrect": false }
  ],
  "explanation": "Rychlost je dráha dělená časem.",
  "points": 1
}
\`\`\`

### 3. OPEN - Otevřená otázka (krátká odpověď)
\`\`\`json
{
  "type": "open",
  "question": "Kolik je 5 + 3 × 2?",
  "correctAnswers": ["11"],
  "caseSensitive": false,
  "hint": "Nezapomeň na pořadí operací",
  "points": 1
}
\`\`\`

### 4. TRUE-FALSE - Pravda/Nepravda
\`\`\`json
{
  "type": "true-false",
  "question": "Voda vře při 100°C za normálního tlaku.",
  "correctAnswer": true,
  "explanation": "Za normálního atmosférického tlaku voda vře při 100°C.",
  "points": 1
}
\`\`\`

### 5. FILL-BLANKS - Doplňování slov do vět
DŮLEŽITÉ: V textu označ mezery pomocí ___ (tři podtržítka). Pro každou mezeru uveď správnou odpověď v poli blanks.
Pokud ve vstupním textu vidíš ___ bez odpovědi, musíš z kontextu určit, jaké slovo tam patří!

\`\`\`json
{
  "type": "fill-blanks",
  "instruction": "Doplň chybějící slova",
  "sentences": [
    {
      "id": "s1",
      "text": "Pokud je v nějakém místě větší tlak vzduchu, říkáme že je tam ___. Pokud je menší tlak, říkáme že je tam ___.",
      "blanks": [
        { "id": "b1", "correctWord": "přetlak" },
        { "id": "b2", "correctWord": "podtlak" }
      ]
    }
  ],
  "distractors": ["vakuum", "atmosféra"],
  "shuffleOptions": true,
  "countAsMultiple": true
}
\`\`\`
Blanks musí být ve stejném pořadí jako ___ v textu! Pozice se vypočítá automaticky.

### 6. MATCHING - Přiřazování (párování)
\`\`\`json
{
  "type": "matching",
  "instruction": "Spoj pojmy s jejich definicemi",
  "pairs": [
    { "id": "p1", "left": "Newton", "right": "Jednotka síly" },
    { "id": "p2", "left": "Joule", "right": "Jednotka energie" },
    { "id": "p3", "left": "Watt", "right": "Jednotka výkonu" }
  ],
  "countAsMultiple": true
}
\`\`\`

### 7. ORDERING - Řazení do správného pořadí
\`\`\`json
{
  "type": "ordering",
  "instruction": "Seřaď od nejmenšího k největšímu",
  "items": [
    { "id": "i1", "content": "milimetr", "correctPosition": 1 },
    { "id": "i2", "content": "centimetr", "correctPosition": 2 },
    { "id": "i3", "content": "metr", "correctPosition": 3 }
  ],
  "countAsMultiple": true
}
\`\`\`

### 8. CONNECT-PAIRS - Spojovačka (vizuální spojování čarami)
\`\`\`json
{
  "type": "connect-pairs",
  "instruction": "Spoj správné dvojice",
  "pairs": [
    { "id": "p1", "left": { "id": "l1", "type": "text", "content": "H₂O" }, "right": { "id": "r1", "type": "text", "content": "Voda" } },
    { "id": "p2", "left": { "id": "l2", "type": "text", "content": "CO₂" }, "right": { "id": "r2", "type": "text", "content": "Oxid uhličitý" } }
  ],
  "countAsMultiple": true,
  "shuffleSides": true
}
\`\`\`

### 9. EXAMPLE - Příklad s postupným řešením
\`\`\`json
{
  "type": "example",
  "title": "Výpočet rychlosti",
  "problem": "Auto ujelo 150 km za 2 hodiny. Jaká byla jeho průměrná rychlost?",
  "steps": [
    { "description": "Zapíšeme známé hodnoty", "result": "s = 150 km, t = 2 h" },
    { "description": "Použijeme vzorec", "result": "v = s/t = 150/2" },
    { "description": "Vypočítáme", "result": "v = 75 km/h" }
  ],
  "finalAnswer": "75 km/h"
}
\`\`\`

### 10. BOARD - Nástěnka pro diskuzi třídy
\`\`\`json
{
  "type": "board",
  "boardType": "text",
  "question": "Co si myslíte o tomto tématu?",
  "allowMedia": false,
  "allowAnonymous": false
}
\`\`\`
boardType: "text" (volné odpovědi), "pros-cons" (pro/proti)

### 11. VOTING - Hlasování
\`\`\`json
{
  "type": "voting",
  "votingType": "single",
  "question": "Kterou možnost preferuješ?",
  "options": [
    { "id": "v1", "label": "A", "content": "Možnost A" },
    { "id": "v2", "label": "B", "content": "Možnost B" }
  ],
  "showResults": true
}
\`\`\`
votingType: "single", "multiple", "scale" (1-10), "feedback" (emoji)

## ROZPOZNÁVÁNÍ ZNAČEK Z PDF:
Pokud uživatel poslal přepis z PDF se značkami, použij je:
- [ABC: ...] → type: "abc"
- [OPEN: ...] → type: "open"
- [TRUE-FALSE: ...] → type: "true-false"
- [FILL-BLANKS: ...] → type: "fill-blanks"
- [MATCHING: ...] → type: "matching"
- [ORDERING: ...] → type: "ordering"
- [CONNECT-PAIRS: ...] → type: "connect-pairs"
- [EXAMPLE: ...] → type: "example"
- [INFO: ...] → type: "info"

## SPOLEČNÁ POLE PRO VŠECHNY SLIDY:
Každý slide MUSÍ mít pole "chapterName" pokud má úkol číslo:
- "chapterName": "Cv. 1" - VŽDY vyplň číslo úkolu z PDF! (např. "Cv. 1", "Úkol 2", "1.", "a)")
- "note": "Poznámka pro učitele" - soukromá poznámka (např. zdroj, tip, instrukce)

## KRITICKY DŮLEŽITÉ - ČÍSLA ÚKOLŮ:
Pokud PDF obsahuje označení úkolů jako:
- "Cv. 1", "Cv. 2" → chapterName: "Cv. 1"
- "Úkol 1", "Úkol 2" → chapterName: "Úkol 1"
- "1.", "2.", "3." → chapterName: "1."
- "a)", "b)", "c)" → chapterName: "a)"
- Bez čísla → chapterName: "" (prázdné)

Příklad:
\`\`\`json
{
  "type": "open",
  "chapterName": "Cv. 3",
  "question": "Vypočítej...",
  ...
}
\`\`\`

## PRAVIDLA:
1. Vrať POUZE JSON pole se slidy, žádný další text
2. Každý slide musí mít správnou strukturu podle typu
3. Pro ABC vždy označ právě jednu správnou odpověď (isCorrect: true)
4. Používej srozumitelný český jazyk
5. Vytváříš pestré a zajímavé úlohy
6. **VŽDY extrahuj číslo úkolu z PDF a vlož do "chapterName"!**
7. Pokud jsou v PDF poznámky k úkolu, vlož je do "note"

## KONTEXT:
- Název: ${quiz.title || 'Nový board'}
- Předmět: ${quiz.subject || 'Neurčeno'}
- Ročník: ${quiz.grade ? `${quiz.grade}. ročník` : 'Neurčeno'}
- Existující slidy: ${quiz.slides.length}

Vrať POUZE JSON pole se slidy, žádný další text.`;

    try {
      // Use Supabase Edge Function proxy (API key is safely stored on server)
      const aiResponse = await chatWithAIProxy(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        'gemini-2.0-flash',
        { temperature: 0.7, max_tokens: 32000 }
      );
      
      // Parse JSON from response with error recovery
      let jsonStr = aiResponse.trim();
      if (jsonStr.includes('```')) {
        jsonStr = jsonStr.replace(/```json?\n?/gi, '').replace(/```/g, '').trim();
      }
      
      const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
      if (!arrayMatch) {
        throw new Error('No JSON array found in response');
      }
      
      let slidesData: any[];
      try {
        slidesData = JSON.parse(arrayMatch[0]);
      } catch (parseError) {
        // Try to fix common JSON errors
        console.warn('[AIBoardPanel] Initial JSON parse failed, attempting recovery...');
        let fixedJson = arrayMatch[0]
          // Remove trailing commas before ] or }
          .replace(/,\s*([}\]])/g, '$1')
          // Fix unescaped newlines in strings
          .replace(/(?<!\\)\n/g, '\\n')
          // Fix unescaped quotes in strings (basic attempt)
          .replace(/"([^"]*)":\s*"([^"]*?)(?<!\\)"([^,}\]]*?)"/g, '"$1": "$2\\"$3"');
        
        try {
          slidesData = JSON.parse(fixedJson);
          console.log('[AIBoardPanel] JSON recovery successful');
        } catch (retryError) {
          // Last resort: try to extract individual objects
          console.warn('[AIBoardPanel] JSON recovery failed, trying object extraction...');
          const objectMatches = arrayMatch[0].match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
          if (objectMatches && objectMatches.length > 0) {
            slidesData = [];
            for (const objStr of objectMatches) {
              try {
                const obj = JSON.parse(objStr);
                if (obj.type) slidesData.push(obj);
              } catch {
                // Skip invalid objects
              }
            }
            if (slidesData.length === 0) {
              throw new Error('Failed to parse any valid slides from AI response');
            }
            console.log(`[AIBoardPanel] Extracted ${slidesData.length} slides from broken JSON`);
          } else {
            throw parseError; // Re-throw original error
          }
        }
      }
      
      // Convert to proper QuizSlide objects
      const slides: QuizSlide[] = slidesData.map((slideData: any, index: number) => {
        const order = quiz.slides.length + index;
        
        // Common fields for all slides
        const commonFields = {
          chapterName: slideData.chapterName || '',
          note: slideData.note || '',
        };
        
        switch (slideData.type) {
          case 'abc':
            const abcLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
            const abcIds = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
            const options = (slideData.options || []).map((opt: any, idx: number) => ({
              id: opt.id || abcIds[idx] || `opt-${idx}`,
              label: opt.label || abcLabels[idx] || String.fromCharCode(65 + idx),
              content: opt.content || opt.text || '',
              isCorrect: Boolean(opt.isCorrect),
            }));
            return {
              ...createABCSlide(order),
              ...commonFields,
              question: slideData.question || '',
              questionImage: slideData.questionImage || '',
              options,
              explanation: slideData.explanation || '',
              points: slideData.points || 1,
            };
            
          case 'open':
            return {
              ...createOpenSlide(order),
              ...commonFields,
              question: slideData.question || '',
              correctAnswers: Array.isArray(slideData.correctAnswers) 
                ? slideData.correctAnswers 
                : slideData.sampleAnswer ? [slideData.sampleAnswer] : [],
              caseSensitive: slideData.caseSensitive || false,
              hint: slideData.hint || '',
              points: slideData.points || 1,
            };
            
          case 'true-false':
            // Convert to ABC with two options
            return {
              ...createABCSlide(order),
              ...commonFields,
              question: slideData.question || '',
              options: [
                { id: 'true', label: 'A', content: 'Pravda', isCorrect: slideData.correctAnswer === true },
                { id: 'false', label: 'B', content: 'Nepravda', isCorrect: slideData.correctAnswer === false },
              ],
              explanation: slideData.explanation || '',
              points: slideData.points || 1,
            };
            
          case 'example':
            return {
              ...createExampleSlide(order),
              ...commonFields,
              title: slideData.title || '',
              problem: slideData.problem || '',
              steps: (slideData.steps || []).map((step: any, idx: number) => ({
                id: step.id || `step-${idx}`,
                description: step.description || '',
                result: step.result || '',
              })),
              finalAnswer: slideData.finalAnswer || '',
            };
            
          case 'fill-blanks':
            // Process sentences and calculate blank positions
            const processedSentences = (slideData.sentences || []).map((s: any, idx: number) => {
              const sentenceText = s.text || '';
              const processedBlanks: { id: string; text: string; position: number }[] = [];
              
              // Find all ___ in the text and map them to blanks
              const blankPattern = /___+/g;
              let match;
              let blankIdx = 0;
              
              while ((match = blankPattern.exec(sentenceText)) !== null) {
                const blankData = s.blanks?.[blankIdx];
                if (blankData) {
                  processedBlanks.push({
                    id: blankData.id || `blank-${idx}-${blankIdx}`,
                    text: blankData.correctWord || blankData.text || '', // Use correctWord or text
                    position: match.index,
                  });
                }
                blankIdx++;
              }
              
              return {
                id: s.id || `sentence-${idx}`,
                text: sentenceText,
                blanks: processedBlanks,
              };
            });
            
            return {
              ...createFillBlanksSlide(order),
              ...commonFields,
              instruction: slideData.instruction || 'Doplň chybějící slova',
              sentences: processedSentences,
              distractors: slideData.distractors || [],
              shuffleOptions: slideData.shuffleOptions !== false,
              countAsMultiple: slideData.countAsMultiple !== false,
            };
            
          case 'matching':
            // Convert simple matching to connect-pairs format
            return {
              ...createConnectPairsSlide(order),
              ...commonFields,
              instruction: slideData.instruction || 'Spoj správné dvojice',
              pairs: (slideData.pairs || []).map((p: any, idx: number) => ({
                id: p.id || `pair-${idx}`,
                left: typeof p.left === 'string' 
                  ? { id: `left-${idx}`, type: 'text', content: p.left }
                  : p.left,
                right: typeof p.right === 'string'
                  ? { id: `right-${idx}`, type: 'text', content: p.right }
                  : p.right,
              })),
              countAsMultiple: slideData.countAsMultiple !== false,
              shuffleSides: slideData.shuffleSides !== false,
            };
            
          case 'connect-pairs':
            return {
              ...createConnectPairsSlide(order),
              ...commonFields,
              instruction: slideData.instruction || 'Spoj správné dvojice',
              pairs: (slideData.pairs || []).map((p: any, idx: number) => ({
                id: p.id || `pair-${idx}`,
                left: typeof p.left === 'string' 
                  ? { id: `left-${idx}`, type: 'text', content: p.left }
                  : p.left,
                right: typeof p.right === 'string'
                  ? { id: `right-${idx}`, type: 'text', content: p.right }
                  : p.right,
              })),
              countAsMultiple: slideData.countAsMultiple !== false,
              shuffleSides: slideData.shuffleSides !== false,
            };
            
          case 'ordering':
            // Convert to connect-pairs with numbered positions
            const orderingPairs = (slideData.items || []).map((item: any, idx: number) => ({
              id: `pair-${idx}`,
              left: { id: `left-${idx}`, type: 'text' as const, content: item.content || '' },
              right: { id: `right-${idx}`, type: 'text' as const, content: String(item.correctPosition || idx + 1) },
            }));
            return {
              ...createConnectPairsSlide(order),
              ...commonFields,
              instruction: slideData.instruction || 'Seřaď do správného pořadí',
              pairs: orderingPairs,
              countAsMultiple: true,
              shuffleSides: true,
            };
            
          case 'board':
            return {
              ...createBoardSlide(order),
              ...commonFields,
              question: slideData.question || '',
              boardType: slideData.boardType || 'text',
              allowMedia: slideData.allowMedia || false,
              allowAnonymous: slideData.allowAnonymous || false,
            };
            
          case 'voting':
            return {
              ...createVotingSlide(order, slideData.votingType || 'single'),
              ...commonFields,
              question: slideData.question || '',
              options: (slideData.options || []).map((opt: any, idx: number) => ({
                id: opt.id || `vote-${idx}`,
                label: opt.label || String.fromCharCode(65 + idx),
                content: opt.content || '',
              })),
              showResults: slideData.showResults !== false,
            };
            
          case 'info':
          default:
            // Handle new block-based layout
            if (slideData.layout && slideData.layout.blocks) {
              return {
                ...createInfoSlide(order, slideData.layout.type || 'title-content'),
                ...commonFields,
                layout: {
                  type: slideData.layout.type || 'title-content',
                  blocks: slideData.layout.blocks.map((block: any, idx: number) => ({
                    id: block.id || `block-${idx}`,
                    type: block.type || 'text',
                    // Clean content - remove raw HTML tags if they're displayed as text
                    content: cleanContent(block.content || ''),
                    fontSize: block.fontSize || 'medium',
                    fontWeight: block.fontWeight || 'normal',
                    textAlign: block.textAlign || 'left',
                  })),
                  titleHeight: slideData.layout.titleHeight || 15,
                },
              };
            }
            // Fallback for old format - create proper block layout
            const infoSlide = createInfoSlide(order, 'title-content');
            if (infoSlide.layout && infoSlide.layout.blocks) {
              // Clean title - remove HTML tags
              infoSlide.layout.blocks[0].content = cleanContent(slideData.title || '');
              // Clean content - if it looks like HTML, strip tags for plain text display
              infoSlide.layout.blocks[1].content = cleanContent(slideData.content || '');
            }
            return { ...infoSlide, ...commonFields };
        }
      });
      
      return slides;
    } catch (error) {
      console.error('AI generation error:', error);
      throw error;
    }
  };

  // Send message handler
  const handleSend = async (customPrompt?: string) => {
    const prompt = customPrompt || inputValue.trim();
    if (!prompt || isLoading) return;

    const userMessage = createAIMessage('user', prompt);
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setShowQuickPrompts(false);

    try {
      const slides = await generateSlides(prompt);
      
      const aiMessage = createAIMessage(
        'assistant',
        slides.length > 0 
          ? `Vygeneroval jsem ${slides.length} ${slides.length === 1 ? 'slide' : slides.length < 5 ? 'slidy' : 'slidů'}. Vyber, které chceš přidat do boardu.`
          : 'Omlouvám se, nepodařilo se vygenerovat žádné slidy. Zkuste upřesnit požadavek.'
      );
      aiMessage.generatedSlides = slides;
      
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      const errorMessage = createAIMessage(
        'assistant',
        'Omlouvám se, něco se pokazilo. Zkuste to prosím znovu.'
      );
      errorMessage.error = error instanceof Error ? error.message : 'Unknown error';
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    handleSend(prompt);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Selection handlers
  const toggleSlideSelection = (messageId: string, slideId: string) => {
    setSelectedSlides(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(messageId) || new Set<string>();
      const newSet = new Set(current);
      
      if (newSet.has(slideId)) {
        newSet.delete(slideId);
      } else {
        newSet.add(slideId);
      }
      
      newMap.set(messageId, newSet);
      return newMap;
    });
  };

  const getSelectedCount = (messageId: string): number => {
    const selected = selectedSlides.get(messageId);
    return selected ? selected.size : 0;
  };

  const isSlideSelected = (messageId: string, slideId: string): boolean => {
    const selected = selectedSlides.get(messageId);
    return selected ? selected.has(slideId) : false;
  };

  const insertSelectedSlides = (messageId: string, allSlides: QuizSlide[]) => {
    const selected = selectedSlides.get(messageId);
    if (!selected || selected.size === 0) return;
    
    const slidesToInsert = allSlides.filter(s => selected.has(s.id));
    
    if (slidesToInsert.length > 0) {
      onAddSlides(slidesToInsert);
      
      setMessages(prev => prev.map(msg =>
        msg.id === messageId ? { ...msg, applied: true } : msg
      ));
      
      const confirmMessage = createAIMessage(
        'assistant',
        '✅ Slidy byly přidány do boardu. Můžeš je upravit v editoru nebo mi říct, co dalšího potřebuješ.'
      );
      setMessages(prev => [...prev, confirmMessage]);
    }
  };

  // Find all pending messages with slides
  const pendingMessages = messages.filter(msg => 
    msg.generatedSlides && msg.generatedSlides.length > 0 && !msg.applied
  );
  
  // Count total selected slides across all messages
  const totalSelectedCount = pendingMessages.reduce((total, msg) => {
    return total + getSelectedCount(msg.id);
  }, 0);
  
  // Insert all selected slides from all messages
  const insertAllSelectedSlides = () => {
    pendingMessages.forEach(msg => {
      const count = getSelectedCount(msg.id);
      if (count > 0) {
        insertSelectedSlides(msg.id, msg.generatedSlides || []);
      }
    });
  };

  // Clear chat
  const clearChat = () => {
    setMessages([
      createAIMessage('assistant', 'Chat byl vymazán. Jak ti mohu pomoci?')
    ]);
    setShowQuickPrompts(true);
  };

  // ============================================
  // FROM DOCS HANDLERS
  // ============================================

  const fetchLibraryMenu = async (subject: string) => {
    setIsLoadingLibrary(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/menu?category=${subject}`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
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

  const fetchPageContent = async (identifier: string, category: string): Promise<string> => {
    const pageSlug = identifier.includes('/') ? identifier.split('/').pop() || identifier : identifier;
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/pages/${pageSlug}?category=${category}`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );
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

  const isFolder = (item: MenuItem): boolean => {
    return !!(item.children && item.children.length > 0) || item.type === 'folder' || item.type === 'group';
  };

  const getItemIdentifier = (item: MenuItem): string | null => {
    return item.slug || item.id || null;
  };

  const isSelectableDocument = (item: MenuItem): boolean => {
    if (!item.slug && !item.id) return false;
    if (item.type === 'workbook') return false;
    if (isFolder(item)) return false;
    return true;
  };

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

  const toggleDocSelection = (identifier: string) => {
    setSelectedDocs(prev => {
      const next = new Set(prev);
      if (next.has(identifier)) {
        next.delete(identifier);
      } else {
        next.add(identifier);
      }
      return next;
    });
  };

  const selectSubject = (subjectId: string) => {
    setActiveSubject(subjectId);
    fetchLibraryMenu(subjectId);
  };

  const handleGenerateFromDocs = async () => {
    if (!selectedContentType || selectedDocs.size === 0 || !activeSubject) return;

    setFromDocsStep('generating');
    setIsGeneratingFromDocs(true);

    try {
      const contentPromises = Array.from(selectedDocs).map(identifier => 
        fetchPageContent(identifier, activeSubject)
      );
      const results = await Promise.all(contentPromises);
      const fullContent = results.filter(t => t.length > 10).join('\n\n');

      const prompt = selectedContentType === 'test'
        ? `Vytvoř testové ABC otázky z následujícího obsahu:\n\n${fullContent}`
        : `Vytvoř mix slidů (info, ABC otázky, příklady) z následujícího obsahu:\n\n${fullContent}`;

      await handleSend(prompt);
      setMode('create');
      setFromDocsStep('browse');
    } catch (error) {
      console.error('Error generating from docs:', error);
      setFromDocsStep('select-type');
    } finally {
      setIsGeneratingFromDocs(false);
    }
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

  // ============================================
  // FROM MY CONTENT HANDLERS
  // ============================================

  const loadMyContent = () => {
    // Load ALL user content from localStorage
    const filesStr = localStorage.getItem('vivid-my-files');
    const linksStr = localStorage.getItem('vivid-my-links');
    const foldersStr = localStorage.getItem('vivid-my-folders');
    const documentsStr = localStorage.getItem('vivid-my-documents');
    
    const localFiles: StoredFile[] = filesStr ? JSON.parse(filesStr) : [];
    const links: StoredLink[] = linksStr ? JSON.parse(linksStr) : [];
    const folders = foldersStr ? JSON.parse(foldersStr) : [];
    const documents = documentsStr ? JSON.parse(documentsStr) : [];
    
    // Combine uploaded files (from useFileStorage - PDF, PPTX, etc.) with local files
    // Use uploadedFiles as primary source, add any local files that aren't duplicates
    const uploadedFileIds = new Set(uploadedFiles.map(f => f.id));
    const combinedFiles = [
      ...uploadedFiles,
      ...localFiles.filter(f => !uploadedFileIds.has(f.id))
    ];
    
    // Load worksheets from worksheet-storage
    const worksheets = getWorksheetList();
    
    // Filter out Vividbooks content
    const filteredFolders = folders.filter((f: any) => 
      f.copiedFrom !== 'vividbooks' && f.copiedFrom !== 'vividbooks-category'
    );
    const filteredDocuments = documents.filter((d: any) => 
      d.copiedFrom !== 'vividbooks' && d.copiedFrom !== 'vividbooks-category'
    );
    
    setMyFiles(combinedFiles);
    setMyLinks(links);
    setMyFolders(filteredFolders);
    setMyDocuments(filteredDocuments);
    setMyWorksheets(worksheets);
  };
  
  const startFromMyContentMode = () => {
    setMode('from-my-content');
    setFromMyContentStep('browse');
    setSelectedMyContent(new Set());
    setExpandedMyFolders(new Set());
    loadMyContent();
  };
  
  // Update files when uploadedFiles changes (async loading)
  useEffect(() => {
    if (mode === 'from-my-content' && !filesLoading) {
      loadMyContent();
    }
  }, [uploadedFiles, filesLoading, mode]);
  
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
      const selectedFiles = myFiles.filter(f => selectedMyContent.has(f.id));
      const selectedLinks = myLinks.filter(l => selectedMyContent.has(l.id));
      const selectedWs = myWorksheets.filter((w: any) => selectedMyContent.has(w.id));
      const selectedDocs = myDocuments.filter((d: any) => selectedMyContent.has(d.id));

      let combinedText = '';
      
      // Add file content
      for (const file of selectedFiles) {
        if (file.extractedText) {
          combinedText += `\n\n--- Soubor: ${file.fileName} ---\n${file.extractedText}`;
        } else {
          combinedText += `\n\n--- Soubor: ${file.fileName} (bez extrahovaného textu) ---`;
        }
      }
      
      // Add link content
      for (const link of selectedLinks) {
        if (link.extractedText) {
          combinedText += `\n\n--- Odkaz: ${link.title} ---\n${link.extractedText}`;
        }
      }
      
      // Add worksheet content
      for (const ws of selectedWs) {
        const wsTitle = ws.title || 'Pracovní list';
        let wsContent = '';
        if (ws.blocks) {
          wsContent = ws.blocks
            .filter((b: any) => b.type === 'text' || b.type === 'heading')
            .map((b: any) => b.content || b.text || '')
            .join('\n');
        }
        combinedText += `\n\n--- Pracovní list: ${wsTitle} ---\n${wsContent}`;
      }
      
      // Add document content
      for (const doc of selectedDocs) {
        const docTitle = doc.name || doc.title || 'Dokument';
        combinedText += `\n\n--- Dokument: ${docTitle} ---\n${doc.content || ''}`;
      }

      if (!combinedText.trim()) {
        const allNames = [
          ...selectedFiles.map(f => f.fileName),
          ...selectedLinks.map(l => l.title),
          ...selectedWs.map((w: any) => w.title || 'Pracovní list'),
          ...selectedDocs.map((d: any) => d.name || d.title || 'Dokument')
        ];
        combinedText = `Vybrané materiály: ${allNames.join(', ')}`;
      }

      const prompt = contentType === 'test'
        ? `Vytvoř testové ABC otázky z následujícího obsahu:\n\n${combinedText}`
        : `Vytvoř mix slidů (info, ABC otázky, příklady) z následujícího obsahu:\n\n${combinedText}`;

      await handleSend(prompt);
      setMode('create');
      setFromMyContentStep('browse');
    } catch (error) {
      console.error('Error generating from my content:', error);
      setFromMyContentStep('browse');
    } finally {
      setIsGeneratingFromMyContent(false);
    }
  };

  // ============================================
  // RENDER: Mode Selection
  // ============================================
  if (mode === 'select') {
    return (
      <div className="h-full flex flex-col bg-white">
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
              Váš board už obsahuje {quiz.slides.length} {quiz.slides.length === 1 ? 'slide' : quiz.slides.length < 5 ? 'slidy' : 'slidů'}
            </p>
          )}
          
          <div className="w-full max-w-xs space-y-3">
            <button
              onClick={() => setMode('create')}
              className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 hover:border-blue-300 transition-all text-left"
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500">
                <FilePlus className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-medium text-slate-800">{hasContent ? 'Vytvořit nový obsah' : 'Vytvořit obsah'}</p>
                <p className="text-xs text-slate-500">Generovat slidy pomocí AI</p>
              </div>
            </button>

            <button
              onClick={startFromDocsMode}
              className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-amber-200 bg-amber-50 hover:bg-amber-100 hover:border-amber-300 transition-all text-left"
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-amber-500">
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
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-green-500">
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

  // ============================================
  // RENDER: From Docs Mode
  // ============================================
  if (mode === 'from-docs') {
    // Subject selection
    if (!activeSubject) {
      return (
        <div className="h-full flex flex-col bg-white">
          <div className="shrink-0 px-4 py-3 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between mb-2">
              <button onClick={handleBack} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
                <ArrowLeft className="h-4 w-4" /> Zpět
              </button>
              <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <h3 className="font-medium text-slate-800">Vyberte předmět</h3>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {SUBJECTS.map(subject => (
              <button
                key={subject.id}
                onClick={() => selectSubject(subject.id)}
                className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 transition-all text-left"
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: subject.color }}>
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

    // Browse documents
    if (fromDocsStep === 'browse') {
      const renderMenuItem = (item: MenuItem, depth: number = 0): React.ReactNode => {
        const isExpanded = expandedFolders.has(item.id);
        const itemIsFolder = isFolder(item);
        const itemIsDocument = isSelectableDocument(item);
        const itemId = getItemIdentifier(item);
        const isSelected = itemIsDocument && itemId ? selectedDocs.has(itemId) : false;

        if (item.type === 'workbook') return null;

        return (
          <div key={item.id}>
            <div
              className="flex items-center gap-2 py-2 px-2 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors"
              style={{ paddingLeft: `${depth * 16 + 8}px` }}
              onClick={() => {
                if (itemIsFolder) {
                  toggleFolder(item.id);
                } else if (itemId) {
                  toggleDocSelection(itemId);
                }
              }}
            >
              {itemIsDocument && (
                <div
                  className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                  style={{
                    border: isSelected ? 'none' : '1.5px solid #94a3b8',
                    backgroundColor: isSelected ? '#2563eb' : 'transparent',
                  }}
                >
                  {isSelected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                </div>
              )}
              {itemIsFolder ? (
                <>
                  <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  {isExpanded ? <FolderOpen className="h-4 w-4 text-amber-500" /> : <Folder className="h-4 w-4 text-amber-500" />}
                </>
              ) : (
                <>
                  <div className="w-4" />
                  <FileText className="h-4 w-4 text-blue-500" />
                </>
              )}
              <span className="text-sm text-slate-700 truncate">{item.label}</span>
            </div>
            {itemIsFolder && isExpanded && item.children && (
              <div>{item.children.map(child => renderMenuItem(child, depth + 1))}</div>
            )}
          </div>
        );
      };

      return (
        <div className="h-full flex flex-col bg-white">
          <div className="shrink-0 px-4 py-3 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between mb-2">
              <button onClick={handleBack} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
                <ArrowLeft className="h-4 w-4" /> Zpět
              </button>
              <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <h3 className="font-medium text-slate-800">{SUBJECTS.find(s => s.id === activeSubject)?.label}</h3>
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
              libraryMenu.filter(item => item.type !== 'workbook').map(item => renderMenuItem(item))
            ) : (
              <p className="text-sm text-slate-500 text-center py-8">Žádný obsah</p>
            )}
          </div>

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

    // Select content type
    if (fromDocsStep === 'select-type') {
      return (
        <div className="h-full flex flex-col bg-white">
          <div className="shrink-0 px-4 py-3 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between mb-2">
              <button onClick={handleBack} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
                <ArrowLeft className="h-4 w-4" /> Zpět
              </button>
              <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <h3 className="font-medium text-slate-800">Co chcete vytvořit?</h3>
          </div>

          <div className="flex-1 flex flex-col justify-center p-6 space-y-3">
            <button
              onClick={() => setSelectedContentType('test')}
              className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                selectedContentType === 'test' ? 'border-green-500 bg-green-50' : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-green-500">
                <ClipboardList className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-medium text-slate-800">Test</p>
                <p className="text-xs text-slate-500">ABC otázky k ověření znalostí</p>
              </div>
              {selectedContentType === 'test' && <Check className="h-5 w-5 text-green-500 ml-auto" />}
            </button>

            <button
              onClick={() => setSelectedContentType('quiz')}
              className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                selectedContentType === 'quiz' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500">
                <FileEdit className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-medium text-slate-800">Kvíz</p>
                <p className="text-xs text-slate-500">Mix slidů a aktivit</p>
              </div>
              {selectedContentType === 'quiz' && <Check className="h-5 w-5 text-blue-500 ml-auto" />}
            </button>
          </div>

          <div className="shrink-0 p-4 border-t border-slate-200 bg-slate-50">
            <button
              onClick={handleGenerateFromDocs}
              disabled={!selectedContentType}
              className="w-full py-3 rounded-xl text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: selectedContentType ? '#2563eb' : '#94a3b8' }}
            >
              Generovat
            </button>
          </div>
        </div>
      );
    }

    // Generating
    return (
      <div className="h-full flex flex-col items-center justify-center bg-white p-6">
        <Loader2 className="h-12 w-12 text-blue-500 animate-spin mb-4" />
        <p className="text-slate-600">Generuji obsah...</p>
      </div>
    );
  }

  // ============================================
  // RENDER: From My Content Mode
  // ============================================
  if (mode === 'from-my-content') {
    const hasMyContent = myFiles.length > 0 || myLinks.length > 0 || myFolders.length > 0 || myDocuments.length > 0 || myWorksheets.length > 0;
    
    // Helper to get root items (not in any folder)
    const getRootFiles = () => myFiles.filter(f => !f.folderId);
    const getRootLinks = () => myLinks.filter(l => !l.folderId);
    const getRootDocuments = () => myDocuments.filter((d: any) => !d.folderId);
    const getRootWorksheets = () => myWorksheets.filter((w: any) => !w.folderId);
    
    // Helper to get items in a folder
    const getFilesInFolder = (folderId: string) => myFiles.filter(f => f.folderId === folderId);
    const getLinksInFolder = (folderId: string) => myLinks.filter(l => l.folderId === folderId);
    const getWorksheetsInFolder = (folderId: string) => myWorksheets.filter((w: any) => w.folderId === folderId);
    
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
    
    // Render a single item
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
          <Folder className="h-5 w-5 text-amber-500 shrink-0" />
        ) : item.icon === 'document' ? (
          <FileText className="h-5 w-5 text-blue-500 shrink-0" />
        ) : item.icon === 'link' ? (
          <Link2 className="h-5 w-5 text-green-500 shrink-0" />
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
      const folderWorksheets = getWorksheetsInFolder(folder.id);
      const folderChildren = (folder.children || []).filter((c: any) => 
        c.copiedFrom !== 'vividbooks' && c.copiedFrom !== 'vividbooks-category'
      );
      const hasChildren = folderFiles.length > 0 || folderLinks.length > 0 || folderChildren.length > 0 || folderWorksheets.length > 0;
      
      const elements: React.ReactNode[] = [];
      
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
      
      if (isExpanded) {
        // Render child folders
        folderChildren.forEach((child: any) => {
          elements.push(...renderFolderTree(child, level + 1));
        });
        
        // Render files in folder
        folderFiles.forEach(file => {
          elements.push(
            <div key={file.id}>
              {renderItem({ id: file.id, name: file.fileName, icon: 'file', level: level + 1 })}
            </div>
          );
        });
        
        // Render links in folder
        folderLinks.forEach(link => {
          elements.push(
            <div key={link.id}>
              {renderItem({ id: link.id, name: link.title, icon: 'link', level: level + 1 })}
            </div>
          );
        });
        
        // Render worksheets in folder
        folderWorksheets.forEach((ws: any) => {
          elements.push(
            <div key={ws.id}>
              {renderItem({ id: ws.id, name: ws.title || 'Bez názvu', icon: 'worksheet', level: level + 1 })}
            </div>
          );
        });
      }
      
      return elements;
    };

    if (fromMyContentStep === 'browse') {
      return (
        <div className="h-full flex flex-col bg-white">
          <div className="shrink-0 px-4 py-3 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between mb-2">
              <button onClick={handleBack} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
                <ArrowLeft className="h-4 w-4" /> Zpět
              </button>
              <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <FolderUp className="h-5 w-5 text-green-500" />
              Z mého obsahu
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto py-2 px-2">
            {filesLoading ? (
              <div className="text-center py-8 px-4">
                <Loader2 className="h-8 w-8 text-blue-500 mx-auto mb-3 animate-spin" />
                <p className="text-slate-600 font-medium">Načítám soubory...</p>
              </div>
            ) : !hasMyContent ? (
              <div className="text-center py-8 px-4">
                <FolderUp className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600 font-medium">Nemáte žádný obsah</p>
                <p className="text-sm text-slate-500 mt-1">Nahrajte soubory v sekci "Můj obsah"</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {/* Root folders */}
                {myFolders.filter((f: any) => !f.parentId).map(folder => renderFolderTree(folder, 0))}
                
                {/* Root files */}
                {getRootFiles().map(file => (
                  <div key={file.id}>
                    {renderItem({ id: file.id, name: file.fileName, icon: 'file', level: 0 })}
                  </div>
                ))}
                
                {/* Root links */}
                {getRootLinks().map(link => (
                  <div key={link.id}>
                    {renderItem({ id: link.id, name: link.title, icon: 'link', level: 0 })}
                  </div>
                ))}
                
                {/* Root documents */}
                {getRootDocuments().map((doc: any) => (
                  <div key={doc.id}>
                    {renderItem({ id: doc.id, name: doc.name || doc.title || 'Dokument', icon: 'document', level: 0 })}
                  </div>
                ))}
                
                {/* Root worksheets */}
                {getRootWorksheets().map((ws: any) => (
                  <div key={ws.id}>
                    {renderItem({ id: ws.id, name: ws.title || 'Bez názvu', icon: 'worksheet', level: 0 })}
                  </div>
                ))}
              </div>
            )}
          </div>

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

    if (fromMyContentStep === 'select-type') {
      return (
        <div className="h-full flex flex-col bg-white">
          <div className="shrink-0 px-4 py-3 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between mb-2">
              <button onClick={handleBack} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
                <ArrowLeft className="h-4 w-4" /> Zpět
              </button>
              <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <h3 className="font-semibold text-slate-800">Co chcete vytvořit?</h3>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-3">
            <button
              onClick={() => handleGenerateFromMyContent('quiz')}
              className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 hover:border-blue-300 transition-all text-left"
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500">
                <FileEdit className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-medium text-slate-800">Kvíz</p>
                <p className="text-xs text-slate-500">Mix slidů a aktivit</p>
              </div>
            </button>

            <button
              onClick={() => handleGenerateFromMyContent('test')}
              className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-purple-200 bg-purple-50 hover:bg-purple-100 hover:border-purple-300 transition-all text-left"
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#a855f7' }}>
                <ClipboardList className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-medium text-slate-800">Test</p>
                <p className="text-xs text-slate-500">ABC otázky k ověření znalostí</p>
              </div>
            </button>
          </div>
        </div>
      );
    }

    // Generating
    return (
      <div className="h-full flex flex-col bg-white">
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <Loader2 className="h-12 w-12 text-green-500 animate-spin mb-4" />
          <h3 className="text-lg font-semibold text-slate-800 mb-2">Generuji obsah...</h3>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: Create Mode
  // ============================================
  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <button onClick={handleBack} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
          <ArrowLeft className="h-4 w-4" /> Zpět
        </button>
        <div className="flex items-center gap-2">
          {totalSelectedCount > 0 && (
            <button
              onClick={insertAllSelectedSlides}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
              style={{ backgroundColor: '#2563eb' }}
            >
              <Plus className="h-4 w-4" />
              Vložit ({totalSelectedCount})
            </button>
          )}
          <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Chat area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id}>
            {msg.role === 'user' ? (
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm text-white" style={{ backgroundColor: '#2563eb' }}>
                  {msg.content}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-slate-100 rounded-lg px-3 py-2 text-sm text-slate-800 border border-slate-200">
                  {msg.content}
                </div>

                {msg.generatedSlides && msg.generatedSlides.length > 0 && !msg.applied && (
                  <div className="space-y-2">
                    {msg.generatedSlides.map((slide) => (
                      <SlidePreviewCard
                        key={slide.id}
                        slide={slide}
                        isSelected={isSlideSelected(msg.id, slide.id)}
                        onToggle={() => toggleSlideSelection(msg.id, slide.id)}
                      />
                    ))}
                  </div>
                )}

                {msg.applied && (
                  <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg border border-green-200">
                    <Check className="h-4 w-4" />
                    Slidy byly vloženy
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

        {/* PDF Transcript action button */}
        {showPdfAction && pdfTranscript && (
          <div className="mt-4 mb-4">
            <p className="text-xs text-slate-500 mb-3 uppercase tracking-wide font-medium">📄 Přepis z PDF</p>
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg mb-3">
              <p className="text-sm text-emerald-800 mb-2">
                Načtený přepis: <strong>{pdfTranscript.length}</strong> znaků
              </p>
              <p className="text-xs text-emerald-600 line-clamp-3">
                {pdfTranscript.substring(0, 200)}...
              </p>
            </div>
            
            {/* Option 1: Generate exactly from transcript */}
            <button
              onClick={() => {
                const parsePrompt = `Převeď tento přepis pracovního listu na Vividboard aktivity.

DŮLEŽITÉ INSTRUKCE:
1. Použij značky v přepisu jako [ABC], [OPEN], [FILL-BLANKS], [TRUE-FALSE], [MATCHING], [INFO] atd.
2. Pro FILL-BLANKS: Každá mezera ___ musí mít v "blanks" odpovídající "correctWord" - to je slovo které tam patří!
3. Vrať POUZE JSON pole, bez dalšího textu.
4. Zpracuj CELÝ text, vytvoř tolik slidů kolik je potřeba.

PŘEPIS:
${pdfTranscript}

Vrať POUZE čistý JSON pole slidů.`;
                handleQuickPrompt(parsePrompt);
                setShowPdfAction(false);
              }}
              disabled={isLoading}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px 16px',
                backgroundColor: '#10b981',
                color: 'white',
                borderRadius: '12px',
                fontWeight: 600,
                border: 'none',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.7 : 1,
                marginBottom: '8px'
              }}
            >
              <Sparkles className="w-5 h-5" />
              {isLoading ? 'Generuji...' : 'Generovat přesně podle zadání'}
            </button>
            
            {/* Option 2: Use as inspiration - opens chat */}
            <button
              onClick={() => {
                setShowPdfAction(false);
                setShowQuickPrompts(false);
                setMessages([
                  createAIMessage('assistant', `📄 Mám načtený přepis pracovního listu (${pdfTranscript.length} znaků).

**Co bys chtěl(a) vytvořit?**

Například:
- "Vytvoř 5 kvízových otázek na toto téma"
- "Udělej z toho interaktivní procvičování"  
- "Přidej vysvětlující slidy před každý úkol"
- "Vytvoř jednodušší verzi pro slabší žáky"

Napiš mi, co potřebuješ! 👇`)
                ]);
                setInputValue('');
              }}
              disabled={isLoading}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px 16px',
                backgroundColor: 'white',
                color: '#475569',
                borderRadius: '12px',
                fontWeight: 500,
                border: '2px solid #e2e8f0',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.7 : 1
              }}
            >
              <MessageSquare className="w-5 h-5" />
              Použít jako inspiraci...
            </button>
          </div>
        )}

        {showQuickPrompts && messages.length <= 1 && (
          <div className="mt-4">
            <p className="text-xs text-slate-500 mb-3 uppercase tracking-wide font-medium">Rychlé akce</p>
            <div className="space-y-2">
              {QUICK_PROMPTS.map((qp, i) => (
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

      {/* Input */}
      <div className="shrink-0 p-3 border-t border-slate-200 bg-slate-50">
        <div className="flex gap-2">
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Napiš co potřebuješ..."
            className="flex-1 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          <Button
            size="icon"
            onClick={() => handleSend()}
            disabled={!inputValue.trim() || isLoading}
            style={{ backgroundColor: '#2563eb' }}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>

        {messages.length > 2 && (
          <button onClick={clearChat} className="mt-2 flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600">
            <Trash2 className="h-3 w-3" />
            Vymazat chat
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================
// SLIDE PREVIEW CARD
// ============================================

interface SlidePreviewCardProps {
  slide: QuizSlide;
  isSelected: boolean;
  onToggle: () => void;
}

function SlidePreviewCard({ slide, isSelected, onToggle }: SlidePreviewCardProps) {
  const getSlideInfo = () => {
    switch (slide.type) {
      case 'info':
        return { icon: FileText, label: 'Informace', color: 'bg-indigo-100 text-indigo-600' };
      case 'activity':
        switch ((slide as any).activityType) {
          case 'abc':
            return { icon: ListOrdered, label: 'ABC otázka', color: 'bg-green-100 text-green-600' };
          case 'open':
            return { icon: MessageSquare, label: 'Otevřená', color: 'bg-amber-100 text-amber-600' };
          case 'example':
            return { icon: Lightbulb, label: 'Příklad', color: 'bg-purple-100 text-purple-600' };
          default:
            return { icon: HelpCircle, label: 'Aktivita', color: 'bg-slate-100 text-slate-600' };
        }
      default:
        return { icon: FileText, label: slide.type, color: 'bg-slate-100 text-slate-600' };
    }
  };

  const { icon: Icon, label, color } = getSlideInfo();

  const getSlideTitle = () => {
    if (slide.type === 'info') return (slide as any).title || '';
    if ((slide as any).question) return (slide as any).question?.substring(0, 60) + '...';
    if ((slide as any).title) return (slide as any).title;
    return '';
  };

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
          <p className="text-sm text-slate-800 line-clamp-2">{getSlideTitle()}</p>
        </div>
      </div>
    </div>
  );
}

