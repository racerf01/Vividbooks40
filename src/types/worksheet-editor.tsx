/**
 * Typy pro AI Editor pracovních listů - Editor State
 * 
 * Obsahuje typy pro stav editoru, AI chat a akce.
 */

import type { Worksheet, WorksheetBlock, BlockType } from './worksheet';

// ============================================
// EDITOR STATE
// ============================================

/**
 * Stav uložení dokumentu
 */
export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

/**
 * Mód zobrazení editoru
 */
export type EditorViewMode = 'edit' | 'preview' | 'split';

/**
 * Panel který je momentálně aktivní
 */
export type ActivePanel = 'blocks' | 'editor' | 'ai-chat' | 'settings';

/**
 * Hlavní stav editoru pracovních listů
 */
export interface EditorState {
  /** Aktuálně editovaný pracovní list */
  currentWorksheet: Worksheet | null;
  /** ID aktuálně vybraného bloku (null = žádný vybraný) */
  selectedBlockId: string | null;
  /** Jsou neuložené změny? */
  isDirty: boolean;
  /** Probíhá AI generování? */
  isGenerating: boolean;
  /** Stav ukládání */
  saveStatus: SaveStatus;
  /** Mód zobrazení */
  viewMode: EditorViewMode;
  /** Aktivní panel (pro mobilní zobrazení) */
  activePanel: ActivePanel;
  /** Historie pro undo (posledních N stavů) */
  undoStack: Worksheet[];
  /** Historie pro redo */
  redoStack: Worksheet[];
  /** Maximální velikost undo stacku */
  maxUndoSize: number;
}

/**
 * Výchozí stav editoru
 */
export const DEFAULT_EDITOR_STATE: Omit<EditorState, 'currentWorksheet'> = {
  selectedBlockId: null,
  isDirty: false,
  isGenerating: false,
  saveStatus: 'saved',
  viewMode: 'edit',
  activePanel: 'blocks',
  undoStack: [],
  redoStack: [],
  maxUndoSize: 50,
};

// ============================================
// AI CHAT
// ============================================

/**
 * Role v AI konverzaci
 */
export type AIMessageRole = 'user' | 'assistant' | 'system';

/**
 * Typ AI akce navržené asistentem
 */
export type AIActionType = 
  | 'add-block'
  | 'edit-block'
  | 'delete-block'
  | 'reorder-blocks'
  | 'update-metadata'
  | 'generate-content'
  | 'none';

/**
 * Navržená AI akce
 */
export interface AIAction {
  /** Typ akce */
  type: AIActionType;
  /** Popis akce pro uživatele */
  description: string;
  /** Data potřebná pro provedení akce */
  payload?: {
    blockType?: BlockType;
    blockId?: string;
    content?: Partial<WorksheetBlock['content']>;
    newOrder?: string[];
    metadata?: Partial<Worksheet['metadata']>;
  };
}

/**
 * Zpráva v AI chatu
 */
export interface AIMessage {
  /** Unikátní ID zprávy */
  id: string;
  /** Role odesílatele */
  role: AIMessageRole;
  /** Textový obsah zprávy */
  content: string;
  /** Čas odeslání (ISO string) */
  timestamp: string;
  /** Navržené akce (pouze pro assistant) */
  suggestedActions?: AIAction[];
  /** Vygenerované bloky pro náhled a výběr */
  generatedBlocks?: WorksheetBlock[];
  /** Byl obsah zprávy aplikován? */
  applied?: boolean;
  /** Chybová zpráva (pokud něco selhalo) */
  error?: string;
}

/**
 * Stav AI chatu
 */
export interface AIChatState {
  /** Historie zpráv */
  messages: AIMessage[];
  /** Právě se generuje odpověď? */
  isLoading: boolean;
  /** Je chat otevřený? */
  isOpen: boolean;
  /** Aktuální vstup uživatele */
  inputValue: string;
  /** Kontext pro AI (např. vybraný blok) */
  context: AIContext;
}

/**
 * Kontext předávaný AI
 */
export interface AIContext {
  /** Celý pracovní list (pro kontext) */
  worksheet: Worksheet | null;
  /** ID vybraného bloku (pokud je vybraný) */
  selectedBlockId: string | null;
  /** Vybraný blok (pro pohodlí) */
  selectedBlock: WorksheetBlock | null;
  /** Metadata pro kontext */
  metadata: {
    subject: string;
    grade: number;
    topic?: string;
  } | null;
}

/**
 * Výchozí stav AI chatu
 */
export const DEFAULT_AI_CHAT_STATE: AIChatState = {
  messages: [],
  isLoading: false,
  isOpen: false,
  inputValue: '',
  context: {
    worksheet: null,
    selectedBlockId: null,
    selectedBlock: null,
    metadata: null,
  },
};

// ============================================
// EDITOR AKCE (pro reducer pattern)
// ============================================

/**
 * Typy akcí editoru
 */
export type EditorActionType =
  // Worksheet akce
  | 'SET_WORKSHEET'
  | 'UPDATE_WORKSHEET'
  | 'RESET_WORKSHEET'
  // Block akce
  | 'SELECT_BLOCK'
  | 'ADD_BLOCK'
  | 'UPDATE_BLOCK'
  | 'DELETE_BLOCK'
  | 'MOVE_BLOCK'
  | 'DUPLICATE_BLOCK'
  // Editor state akce
  | 'SET_DIRTY'
  | 'SET_SAVE_STATUS'
  | 'SET_VIEW_MODE'
  | 'SET_ACTIVE_PANEL'
  | 'SET_GENERATING'
  // Undo/Redo
  | 'UNDO'
  | 'REDO'
  | 'PUSH_UNDO';

/**
 * Payload pro SET_WORKSHEET
 */
export interface SetWorksheetPayload {
  worksheet: Worksheet;
}

/**
 * Payload pro UPDATE_WORKSHEET
 */
export interface UpdateWorksheetPayload {
  updates: Partial<Omit<Worksheet, 'id' | 'createdAt'>>;
}

/**
 * Payload pro ADD_BLOCK
 */
export interface AddBlockPayload {
  block: WorksheetBlock;
  /** Pozice kam vložit (undefined = na konec) */
  afterBlockId?: string;
}

/**
 * Payload pro UPDATE_BLOCK
 */
export interface UpdateBlockPayload {
  blockId: string;
  updates: Partial<WorksheetBlock>;
}

/**
 * Payload pro DELETE_BLOCK
 */
export interface DeleteBlockPayload {
  blockId: string;
}

/**
 * Payload pro MOVE_BLOCK
 */
export interface MoveBlockPayload {
  blockId: string;
  /** Nová pozice (index) */
  newIndex: number;
}

/**
 * Payload pro DUPLICATE_BLOCK
 */
export interface DuplicateBlockPayload {
  blockId: string;
}

/**
 * Union type pro všechny editor akce
 */
export type EditorAction =
  | { type: 'SET_WORKSHEET'; payload: SetWorksheetPayload }
  | { type: 'UPDATE_WORKSHEET'; payload: UpdateWorksheetPayload }
  | { type: 'RESET_WORKSHEET' }
  | { type: 'SELECT_BLOCK'; payload: { blockId: string | null } }
  | { type: 'ADD_BLOCK'; payload: AddBlockPayload }
  | { type: 'UPDATE_BLOCK'; payload: UpdateBlockPayload }
  | { type: 'DELETE_BLOCK'; payload: DeleteBlockPayload }
  | { type: 'MOVE_BLOCK'; payload: MoveBlockPayload }
  | { type: 'DUPLICATE_BLOCK'; payload: DuplicateBlockPayload }
  | { type: 'SET_DIRTY'; payload: { isDirty: boolean } }
  | { type: 'SET_SAVE_STATUS'; payload: { status: SaveStatus } }
  | { type: 'SET_VIEW_MODE'; payload: { mode: EditorViewMode } }
  | { type: 'SET_ACTIVE_PANEL'; payload: { panel: ActivePanel } }
  | { type: 'SET_GENERATING'; payload: { isGenerating: boolean } }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'PUSH_UNDO'; payload: { worksheet: Worksheet } };

// ============================================
// DRAG & DROP
// ============================================

/**
 * Data při drag operaci
 */
export interface DragData {
  /** ID přesouvaného bloku */
  blockId: string;
  /** Typ bloku */
  blockType: BlockType;
  /** Index odkud se přesouvá */
  sourceIndex: number;
}

/**
 * Stav drag & drop
 */
export interface DragState {
  /** Právě probíhá drag? */
  isDragging: boolean;
  /** Data o přesouvaném bloku */
  dragData: DragData | null;
  /** Index nad kterým se nachází kurzor */
  overIndex: number | null;
}

// ============================================
// POMOCNÉ FUNKCE
// ============================================

/**
 * Vytvoří novou AI zprávu
 */
export function createAIMessage(
  role: AIMessageRole,
  content: string,
  suggestedActions?: AIAction[],
  generatedBlocks?: WorksheetBlock[]
): AIMessage {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    role,
    content,
    timestamp: new Date().toISOString(),
    suggestedActions,
    generatedBlocks,
    applied: false,
  };
}

/**
 * Systémová zpráva pro inicializaci AI chatu
 */
export const AI_SYSTEM_PROMPT = `Jsi pomocník pro tvorbu pracovních listů pro učitele ZŠ. 
Pomáháš vytvářet vzdělávací obsah v češtině.
Můžeš navrhovat:
- Přidání nových bloků (nadpisy, text, otázky)
- Úpravy existujících bloků
- Generování obsahu podle tématu

Odpovídej stručně a věcně. Nabízej konkrétní akce které může učitel jedním kliknutím aplikovat.`;




