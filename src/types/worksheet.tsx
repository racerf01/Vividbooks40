/**
 * Typy pro AI Editor pracovních listů
 * 
 * Pracovní list se skládá z bloků různých typů.
 * Každý blok má svůj specifický obsah podle typu.
 */

// ============================================
// ZÁKLADNÍ TYPY
// ============================================

/**
 * Dostupné typy bloků v pracovním listu
 */
export type BlockType = 
  | 'heading'
  | 'paragraph'
  | 'infobox'
  | 'multiple-choice'
  | 'fill-blank'
  | 'free-answer'
  | 'spacer'
  | 'examples'
  | 'image'
  | 'table'
  | 'connect-pairs'     // Spojovačka - connect matching pairs
  | 'image-hotspots'    // Poznávačka - identify points on image
  | 'video-quiz'        // Video quiz with questions at timestamps
  | 'qr-code'           // QR kód s popiskem
  | 'header-footer'     // Hlavička a patička
  | 'free-canvas';      // Volné plátno - mini Figma canvas

/**
 * Pozice obrázku v bloku
 */
export type ImagePosition = 'before' | 'beside-left' | 'beside-right';

/**
 * Velikost obrázku
 */
export type ImageSize = 'small' | 'medium' | 'large' | 'full';

/**
 * Nastavení obrázku pro blok
 */
export interface BlockImage {
  /** URL obrázku */
  url: string;
  /** Alternativní text / popisek */
  alt?: string;
  /** Pozice obrázku vůči obsahu */
  position: ImagePosition;
  /** Velikost obrázku */
  size: ImageSize;
  /** Šířka v procentech (10-90) při position: beside-* */
  widthPercent?: number;
}

/**
 * Styl volného prostoru
 */
export type SpacerStyle = 'empty' | 'dotted' | 'lined';

/**
 * Úroveň nadpisu
 */
export type HeadingLevel = 'h1' | 'h2' | 'h3';

/**
 * Varianta infoboxu (barva)
 */
export type InfoboxVariant = 'blue' | 'green' | 'yellow' | 'purple';

/**
 * Předmět pro který je pracovní list určen
 */
export type Subject = 
  | 'fyzika'
  | 'chemie'
  | 'matematika'
  | 'prirodopis'
  | 'zemepis'
  | 'dejepis'
  | 'cestina'
  | 'anglictina'
  | 'other';

/**
 * Ročník ZŠ
 */
export type Grade = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

// ============================================
// OBSAH BLOKŮ
// ============================================

/**
 * Obsah bloku s nadpisem
 */
export interface HeadingContent {
  /** Text nadpisu */
  text: string;
  /** Úroveň nadpisu (h1, h2, h3) */
  level: HeadingLevel;
  /** Zarovnání textu */
  align?: 'left' | 'center' | 'right';
  /** Vlastní velikost písma (přepíše výchozí velikost podle úrovně) */
  fontSize?: number;
  /** Tučné písmo */
  isBold?: boolean;
  /** Kurzíva */
  isItalic?: boolean;
  /** Podtržení */
  isUnderline?: boolean;
  /** Barva textu */
  textColor?: string;
  /** Barva zvýraznění */
  highlightColor?: string;
}

/**
 * Obsah bloku s odstavcem
 */
export interface ParagraphContent {
  /** HTML obsah odstavce (může obsahovat formátování) */
  html: string;
}

/**
 * Obsah infoboxu
 */
export interface InfoboxContent {
  /** Titulek infoboxu (volitelný) */
  title?: string;
  /** HTML obsah infoboxu */
  html: string;
  /** Barevná varianta */
  variant: InfoboxVariant;
}

/**
 * Možnost odpovědi v multiple-choice otázce
 */
export interface ChoiceOption {
  /** Unikátní ID možnosti */
  id: string;
  /** Text možnosti */
  text: string;
  /** URL obrázku (pro obrázkovou variantu) */
  imageUrl?: string;
}

/**
 * Obsah multiple-choice otázky
 */
export interface MultipleChoiceContent {
  /** Text otázky */
  question: string;
  /** Seznam možností */
  options: ChoiceOption[];
  /** ID správných odpovědí */
  correctAnswers: string[];
  /** Povolit výběr více odpovědí */
  allowMultiple: boolean;
  /** Vysvětlení správné odpovědi (zobrazí se po vyplnění) */
  explanation?: string;
  /** Varianta zobrazení (textová / obrázková) */
  variant?: 'text' | 'image';
  /** Počet sloupců pro obrázkovou variantu */
  gridColumns?: number;
}

/**
 * Segment textu v fill-blank - buď běžný text nebo mezera k doplnění
 */
export type FillBlankSegment = 
  | { type: 'text'; content: string }
  | { type: 'blank'; id: string; correctAnswer: string; acceptedAnswers?: string[] };

/**
 * Obsah fill-blank (doplňování do textu)
 */
export interface FillBlankContent {
  /** Instrukce k úloze (volitelné) */
  instruction?: string;
  /** Segmenty textu a mezer */
  segments: FillBlankSegment[];
}

/**
 * Obsah otázky s volnou odpovědí
 */
export interface FreeAnswerContent {
  /** Text otázky */
  question: string;
  /** Počet řádků pro odpověď */
  lines: number;
  /** Nápověda pro žáka (volitelná) */
  hint?: string;
  /** Vzorová odpověď pro učitele (volitelná) */
  sampleAnswer?: string;
}

/**
 * Obsah volného prostoru
 */
export interface SpacerContent {
  /** Výška v pixelech */
  height: number;
  /** Styl prostoru */
  style: SpacerStyle;
}

/**
 * Obsah bloku s obrázkem
 */
export interface ImageContent {
  /** URL obrázku */
  url: string;
  /** Alternativní text / popisek */
  alt?: string;
  /** Titulek pod obrázkem */
  caption?: string;
  /** Zobrazit popisek (default: true) */
  showCaption?: boolean;
  /** Velikost obrázku (0-100% velikost, 100-200% ořez) */
  size: number;
  /** Zarovnání (left, center, right) */
  alignment?: 'left' | 'center' | 'right';
  /** Galerie obrázků */
  gallery?: string[];
  /** Popisky pro jednotlivé obrázky v galerii */
  galleryCaptions?: string[];
  /** Rozložení galerie (vždy grid) */
  galleryLayout?: 'grid' | 'row';
  /** Počet sloupců v mřížce */
  gridColumns?: number;
  /** Typ aktivity na obrázcích */
  imageActivityType?: 'none' | 'text-input' | 'checkbox-circle' | 'checkbox-square';
  /** Výška kontejneru pro ořez (v px) */
  containerHeight?: number;
}

/**
 * Obsah bloku s tabulkou
 */
export interface TableContent {
  /** HTML obsah tabulky (TipTap table format) */
  html: string;
  /** Počet řádků */
  rows: number;
  /** Počet sloupců */
  columns: number;
  /** Má záhlaví */
  hasHeader: boolean;
  /** Má ohraničení */
  hasBorder: boolean;
  /** Má zaoblené rohy */
  hasRoundedCorners: boolean;
  /** Barevný styl (volitelný) */
  colorStyle?: 'default' | 'blue' | 'green' | 'purple' | 'yellow' | 'red' | 'pink' | 'cyan';
}

// ============================================
// ACTIVITY BLOCK CONTENT TYPES
// ============================================

/**
 * Item in a connect-pairs activity (can be text or image)
 */
export interface ConnectPairItemContent {
  id: string;
  type: 'text' | 'image';
  content: string; // Text or image URL
}

/**
 * A pair to connect in the worksheet
 */
export interface ConnectPairContent {
  id: string;
  left: ConnectPairItemContent;
  right: ConnectPairItemContent;
}

/**
 * Obsah bloku spojovačky (Connect Pairs)
 */
export interface ConnectPairsContent {
  /** Instrukce k úloze */
  instruction?: string;
  /** Dvojice k propojení */
  pairs: ConnectPairContent[];
  /** Zamíchat strany */
  shuffleSides: boolean;
}

/**
 * Hotspot marker style for worksheet
 */
export type WorksheetHotspotMarkerStyle = 'circle' | 'pin' | 'question-mark';

/**
 * Single hotspot on an image for worksheet
 */
export interface WorksheetHotspot {
  id: string;
  x: number; // Percentage position (0-100)
  y: number; // Percentage position (0-100)
  label: string; // The correct answer/label for the hotspot
  options?: { id: string; text: string; isCorrect: boolean }[]; // ABC options if any
}

/**
 * Obsah bloku poznávačky (Image Hotspots)
 */
export interface ImageHotspotsContent {
  /** Instrukce k úloze */
  instruction?: string;
  /** URL obrázku */
  imageUrl: string;
  /** Body na obrázku */
  hotspots: WorksheetHotspot[];
  /** Styl markeru */
  markerStyle: WorksheetHotspotMarkerStyle;
  /** Velikost markeru (procenta, 100 = normální) */
  markerSize: number;
  /** Typ odpovědi: abc, numeric, text */
  answerType: 'abc' | 'numeric' | 'text';
  /** Rozložení aktivity */
  layout?: 'stacked' | 'side-by-side';
}

/**
 * Video question for worksheet
 */
export interface WorksheetVideoQuestion {
  id: string;
  timestamp: number; // Seconds from start
  question: string;
  options: {
    id: string;
    label: string; // A, B, C, D
    content: string;
    isCorrect: boolean;
  }[];
}

/**
 * Obsah bloku video kvízu
 */
export interface VideoQuizContent {
  /** Instrukce k úloze */
  instruction?: string;
  /** URL videa (YouTube) */
  videoUrl: string;
  /** Extrahované YouTube ID */
  videoId?: string;
  /** Otázky k videu */
  questions: WorksheetVideoQuestion[];
}

/**
 * Typ označení příkladů
 */
export type ExamplesLabelType = 'letters' | 'numbers' | 'none';

/**
 * Obtížnost příkladu
 */
export type ExampleDifficulty = 'easy' | 'medium' | 'hard';

/**
 * Jednotlivý příklad
 */
export interface MathExample {
  /** ID příkladu */
  id: string;
  /** Text příkladu (např. "0,4 + 0,5 =") */
  expression: string;
  /** Správná odpověď */
  answer: string;
  /** Obtížnost (pro barevné rozlišení) */
  difficulty: ExampleDifficulty;
}

/**
 * Styl pole pro odpovědi
 */
export type AnswerBoxStyle = 'block' | 'line' | 'none';

/**
 * Obsah bloku s příklady
 */
export interface ExamplesContent {
  /** Vzorový příklad ze kterého AI vychází */
  sampleExample: string;
  /** AI detekované téma/operace */
  topic?: string;
  /** Vygenerované příklady */
  examples: MathExample[];
  /** Počet příkladů k vygenerování */
  examplesCount: number;
  /** Počet sloupců (1, 2 nebo 3) */
  columns: 1 | 2 | 3;
  /** Typ označení (písmena, čísla, bez označení) */
  labelType: ExamplesLabelType;
  /** Řadit od jednoduchého ke složitému */
  difficultyProgression: boolean;
  /** Zobrazit barevné podbarvení podle obtížnosti */
  showDifficultyColors: boolean;
  /** Styl pole pro odpovědi (blok, linka, žádný) */
  answerBoxStyle: AnswerBoxStyle;
  /** Rozestupy mezi řádky v px */
  rowSpacing?: number;
  /** Velikost fontu v px */
  fontSize?: number;
}

/**
 * Typ zpětné vazby pro patičku
 */
export type FeedbackType = 'smileys' | 'hearts' | 'stars' | 'none';

/**
 * Obsah bloku s QR kódem
 */
export interface QRCodeContent {
  /** URL nebo text pro QR kód */
  url: string;
  /** Popisek k QR kódu */
  caption: string;
  /** Pozice popisku (under nebo left) */
  captionPosition: 'under' | 'left';
  /** Velikost QR kódu v px */
  size?: number;
}

/**
 * Obsah bloku hlavička/patička
 */
export interface HeaderFooterContent {
  /** Typ: hlavička nebo patička */
  variant: 'header' | 'footer';
  /** Rozložení: 1 nebo 2 sloupce */
  columns: 1 | 2;
  
  // === HLAVIČKA ===
  /** Zobrazit pole pro jméno */
  showName?: boolean;
  /** Zobrazit pole pro příjmení */
  showSurname?: boolean;
  /** Zobrazit pole pro třídu */
  showClass?: boolean;
  /** Zobrazit pole pro známku */
  showGrade?: boolean;
  /** Vlastní label pro jméno */
  nameLabel?: string;
  /** Vlastní label pro příjmení */
  surnameLabel?: string;
  /** Vlastní label pro třídu */
  classLabel?: string;
  /** Vlastní label pro známku */
  gradeLabel?: string;
  /** Další vlastní info text */
  customInfo?: string;
  
  // === PATIČKA ===
  /** Zobrazit text zpětné vazby */
  showFeedback?: boolean;
  /** Text zpětné vazby */
  feedbackText?: string;
  /** Typ zpětné vazby */
  feedbackType?: FeedbackType;
  /** Počet možností zpětné vazby (např. 5 smajlíků) */
  feedbackCount?: number;
  /** Zobrazit doplňující info v patičce */
  showFooterInfo?: boolean;
  /** Další info text v patičce */
  footerInfo?: string;
  
  // === QR KÓD (pro hlavičku i patičku) ===
  /** URL pro QR kód */
  qrCodeUrl?: string;
  /** Zobrazit QR kód */
  showQrCode?: boolean;
  
  // === ČÍSLO STRÁNKY (pro hlavičku i patičku) ===
  /** Zobrazit číslo stránky */
  showPageNumber?: boolean;
}

// ============================================
// VOLNÉ PLÁTNO - TYPY OBJEKTŮ
// ============================================

/**
 * Typy objektů na volném plátně
 */
export type CanvasObjectType = 'rectangle' | 'ellipse' | 'line' | 'text' | 'image' | 'arrow' | 'group';

/**
 * Základní objekt na plátně
 */
export interface CanvasObjectBase {
  /** Unikátní ID objektu */
  id: string;
  /** Typ objektu */
  type: CanvasObjectType;
  /** X pozice */
  x: number;
  /** Y pozice */
  y: number;
  /** Šířka */
  width: number;
  /** Výška */
  height: number;
  /** Rotace ve stupních */
  rotation?: number;
  /** Z-index pro vrstvení */
  zIndex: number;
  /** Je objekt zamčený? */
  locked?: boolean;
}

/**
 * Obdélník na plátně
 */
export interface CanvasRectangle extends CanvasObjectBase {
  type: 'rectangle';
  /** Barva výplně */
  fill?: string;
  /** Barva ohraničení */
  stroke?: string;
  /** Tloušťka ohraničení */
  strokeWidth?: number;
  /** Zaoblení rohů */
  borderRadius?: number;
}

/**
 * Elipsa/kruh na plátně
 */
export interface CanvasEllipse extends CanvasObjectBase {
  type: 'ellipse';
  /** Barva výplně */
  fill?: string;
  /** Barva ohraničení */
  stroke?: string;
  /** Tloušťka ohraničení */
  strokeWidth?: number;
}

/**
 * Čára na plátně
 */
export interface CanvasLine extends CanvasObjectBase {
  type: 'line';
  /** Barva čáry */
  stroke: string;
  /** Tloušťka čáry */
  strokeWidth: number;
  /** Styl čáry */
  strokeStyle?: 'solid' | 'dashed' | 'dotted';
  /** Koncové body (relativní k x,y) */
  points: { x: number; y: number }[];
}

/**
 * Šipka na plátně
 */
export interface CanvasArrow extends CanvasObjectBase {
  type: 'arrow';
  /** Barva šipky */
  stroke: string;
  /** Tloušťka čáry */
  strokeWidth: number;
  /** Typ šipky (na začátku, na konci, obě) */
  arrowType: 'end' | 'start' | 'both';
}

/**
 * Text na plátně
 */
export interface CanvasText extends CanvasObjectBase {
  type: 'text';
  /** Obsah textu */
  text: string;
  /** Velikost písma */
  fontSize: number;
  /** Rodina písma */
  fontFamily?: string;
  /** Barva textu */
  fill: string;
  /** Tučné */
  bold?: boolean;
  /** Kurzíva */
  italic?: boolean;
  /** Zarovnání */
  align?: 'left' | 'center' | 'right';
}

/**
 * Obrázek na plátně
 */
export interface CanvasImage extends CanvasObjectBase {
  type: 'image';
  /** URL obrázku */
  url: string;
  /** Alternativní text */
  alt?: string;
  /** Způsob vyplnění */
  objectFit?: 'contain' | 'cover' | 'fill';
}

/**
 * Skupina objektů na plátně
 */
export interface CanvasGroup extends CanvasObjectBase {
  type: 'group';
  /** ID objektů ve skupině */
  children: string[];
}

/**
 * Union type pro všechny objekty na plátně
 */
export type CanvasObject = 
  | CanvasRectangle 
  | CanvasEllipse 
  | CanvasLine 
  | CanvasArrow 
  | CanvasText 
  | CanvasImage
  | CanvasGroup;

/**
 * Obsah bloku s volným plátnem
 */
export interface FreeCanvasContent {
  /** Zadání aktivity */
  instruction?: string;
  /** Objekty na plátně */
  objects: CanvasObject[];
  /** Barva pozadí plátna */
  backgroundColor?: string;
  /** Šířka plátna v px (default = šířka bloku) */
  canvasWidth?: number;
  /** Výška plátna v px */
  canvasHeight: number;
  /** Zobrazit mřížku */
  showGrid?: boolean;
  /** Velikost mřížky v px */
  gridSize?: number;
  /** Styl kroužku s číslem */
  circleColor?: string;
  circleSize?: number;
}

// ============================================
// BLOKY
// ============================================

/**
 * Šířka bloku v layoutu (legacy)
 */
export type BlockWidth = 'full' | 'half';

/**
 * PRO: Počet sloupců gridu
 */
export type GridColumns = 1 | 2 | 3 | 6 | 12;

/**
 * PRO: Mezera mezi sloupci gridu
 */
export type GridGap = 'none' | 'small' | 'medium' | 'large';

/**
 * PRO: Hodnoty mezer v pixelech
 */
export const GRID_GAP_VALUES: Record<GridGap, number> = {
  none: 0,
  small: 8,
  medium: 16,
  large: 24,
};

/**
 * Vizuální styly aplikovatelné na jakýkoliv blok
 */
/** Preset zobrazení bloku */
export type DisplayPreset = 'normal' | 'infobox' | 'highlight' | 'custom';

export interface BlockVisualStyles {
  /** Preset zobrazení (normal, infobox, highlight, custom) */
  displayPreset?: DisplayPreset;
  /** Barva pozadí */
  backgroundColor?: string;
  /** Barva ohraničení */
  borderColor?: string;
  /** Šířka ohraničení v pixelech */
  borderWidth?: number;
  /** Styl ohraničení */
  borderStyle?: 'solid' | 'dashed' | 'dotted';
  /** Zaoblení rohů v pixelech */
  borderRadius?: number;
  /** Stín (none, small, medium, large) */
  shadow?: 'none' | 'small' | 'medium' | 'large';
}

/**
 * Základní vlastnosti společné pro všechny bloky
 */
interface BaseBlock {
  /** Unikátní ID bloku */
  id: string;
  /** Pořadí bloku v pracovním listu */
  order: number;
  /** Šířka bloku (plná nebo poloviční) - legacy */
  width: BlockWidth;
  /** Procentuální šířka při half-width (10-90, default 50) - legacy */
  widthPercent?: number;
  /** PRO: Kolik sloupců gridu blok zabírá (1-12) */
  gridSpan?: number;
  /** PRO: Na kterém sloupci gridu blok začíná (1-12) */
  gridStart?: number;
  
  // ========== FREEFORM CANVAS PROPERTIES ==========
  /** Freeform: X position on canvas in pixels */
  posX?: number;
  /** Freeform: Y position on canvas in pixels */
  posY?: number;
  /** Freeform: Width of block in pixels (null = auto based on content) */
  blockWidth?: number;
  /** Freeform: Height of block in pixels (null = auto based on content) */
  blockHeight?: number;
  /** Freeform: Which page this block belongs to (0-indexed) */
  pageIndex?: number;
  /** Freeform: Z-index for layering */
  zIndex?: number;
  
  /** Spodní odsazení v pixelech */
  marginBottom?: number;
  /** Styl spodního odsazení */
  marginStyle?: SpacerStyle;
  /** Vnitřní odsazení bloku v pixelech */
  padding?: number;
  /** Volitelný obrázek připojený k bloku */
  image?: BlockImage;
  /** Vizuální styly bloku */
  visualStyles?: BlockVisualStyles;
}

/**
 * Blok s nadpisem
 */
export interface HeadingBlock extends BaseBlock {
  type: 'heading';
  content: HeadingContent;
}

/**
 * Blok s odstavcem
 */
export interface ParagraphBlock extends BaseBlock {
  type: 'paragraph';
  content: ParagraphContent;
}

/**
 * Blok s infoboxem
 */
export interface InfoboxBlock extends BaseBlock {
  type: 'infobox';
  content: InfoboxContent;
}

/**
 * Blok s multiple-choice otázkou
 */
export interface MultipleChoiceBlock extends BaseBlock {
  type: 'multiple-choice';
  content: MultipleChoiceContent;
}

/**
 * Blok s doplňováním do textu
 */
export interface FillBlankBlock extends BaseBlock {
  type: 'fill-blank';
  content: FillBlankContent;
}

/**
 * Blok s volnou odpovědí
 */
export interface FreeAnswerBlock extends BaseBlock {
  type: 'free-answer';
  content: FreeAnswerContent;
}

/**
 * Blok s volným prostorem
 */
export interface SpacerBlock extends BaseBlock {
  type: 'spacer';
  content: SpacerContent;
}

/**
 * Blok s příklady (matematika)
 */
export interface ExamplesBlock extends BaseBlock {
  type: 'examples';
  content: ExamplesContent;
}

/**
 * Blok s obrázkem
 */
export interface ImageBlock extends BaseBlock {
  type: 'image';
  content: ImageContent;
}

/**
 * Blok s tabulkou
 */
export interface TableBlock extends BaseBlock {
  type: 'table';
  content: TableContent;
}

/**
 * Blok se spojovačkou (Connect Pairs)
 */
export interface ConnectPairsBlock extends BaseBlock {
  type: 'connect-pairs';
  content: ConnectPairsContent;
}

/**
 * Blok s poznávačkou (Image Hotspots)
 */
export interface ImageHotspotsBlock extends BaseBlock {
  type: 'image-hotspots';
  content: ImageHotspotsContent;
}

/**
 * Blok s video kvízem
 */
export interface VideoQuizBlock extends BaseBlock {
  type: 'video-quiz';
  content: VideoQuizContent;
}

/**
 * Blok s QR kódem
 */
export interface QRCodeBlock extends BaseBlock {
  type: 'qr-code';
  content: QRCodeContent;
}

/**
 * Blok s hlavičkou/patičkou
 */
export interface HeaderFooterBlock extends BaseBlock {
  type: 'header-footer';
  content: HeaderFooterContent;
}

/**
 * Blok s volným plátnem (mini Figma canvas)
 */
export interface FreeCanvasBlock extends BaseBlock {
  type: 'free-canvas';
  content: FreeCanvasContent;
}

/**
 * Union type pro všechny typy bloků
 */
export type WorksheetBlock = 
  | HeadingBlock
  | ParagraphBlock
  | InfoboxBlock
  | MultipleChoiceBlock
  | FillBlankBlock
  | FreeAnswerBlock
  | SpacerBlock
  | ExamplesBlock
  | ImageBlock
  | TableBlock
  | ConnectPairsBlock
  | ImageHotspotsBlock
  | VideoQuizBlock
  | QRCodeBlock
  | HeaderFooterBlock
  | FreeCanvasBlock;

// ============================================
// METADATA A PRACOVNÍ LIST
// ============================================

/**
 * Počet sloupců na stránce
 */
export type ColumnCount = 1 | 2;

/**
 * Metadata pracovního listu
 */
/**
 * Globální velikost písma
 */
export type GlobalFontSize = 'small' | 'normal' | 'large';

export interface WorksheetMetadata {
  /** Předmět */
  subject: Subject;
  /** Ročník (1-9) */
  grade: Grade;
  /** Odhadovaná časová náročnost v minutách */
  estimatedTime?: number;
  /** Klíčová slova pro vyhledávání */
  keywords?: string[];
  /** Téma/kapitola */
  topic?: string;
  /** Počet sloupců (1 nebo 2) - legacy */
  columns?: ColumnCount;
  /** Globální velikost písma */
  globalFontSize?: GlobalFontSize;
  
  // === PRO GRID SYSTEM ===
  /** PRO: Počet sloupců gridu (default: 12) */
  gridColumns?: GridColumns;
  /** PRO: Mezera mezi sloupci */
  gridGap?: GridGap;
  
  // === PRO LAYOUT MODE ===
  /** PRO: Režim layoutu - grid (pro AI) nebo freeform (pro ruční úpravy) */
  layoutMode?: 'grid' | 'freeform';
  
  // === PRO PAGE STYLING ===
  /** PRO: Barva pozadí stránky (default: bílá) */
  pageBackgroundColor?: string;
}

/**
 * Hlavní typ pro pracovní list
 */
export interface Worksheet {
  /** Unikátní ID pracovního listu */
  id: string;
  /** Název pracovního listu */
  title: string;
  /** Popis pracovního listu (volitelný) */
  description?: string;
  /** Seznam bloků */
  blocks: WorksheetBlock[];
  /** Metadata */
  metadata: WorksheetMetadata;
  /** Datum vytvoření (ISO string) */
  createdAt: string;
  /** Datum poslední úpravy (ISO string) */
  updatedAt: string;
  /** ID autora (pro budoucí použití) */
  authorId?: string;
  /** Stav publikace */
  status: 'draft' | 'published';
  /** Náhledový obrázek (URL) */
  thumbnailUrl?: string;
}

// ============================================
// POMOCNÉ TYPY
// ============================================

/**
 * Typ pro vytvoření nového bloku (bez id a order)
 */
export type NewBlockContent<T extends WorksheetBlock> = T['content'];

/**
 * Extrahuje content type podle block type
 */
export type BlockContentByType = {
  'heading': HeadingContent;
  'paragraph': ParagraphContent;
  'infobox': InfoboxContent;
  'multiple-choice': MultipleChoiceContent;
  'fill-blank': FillBlankContent;
  'free-answer': FreeAnswerContent;
  'spacer': SpacerContent;
  'examples': ExamplesContent;
  'image': ImageContent;
  'table': TableContent;
  'connect-pairs': ConnectPairsContent;
  'image-hotspots': ImageHotspotsContent;
  'video-quiz': VideoQuizContent;
  'qr-code': QRCodeContent;
  'free-canvas': FreeCanvasContent;
};

// ============================================
// WORKSHEET DATA (pro WorksheetView - zobrazení importovaných PL)
// ============================================

/**
 * Odkaz na procvičování s úrovní obtížnosti
 */
export interface PracticeLink {
  id: string;
  label: string;
  url: string;
  level: 1 | 2 | 3;
}

/**
 * Obecný odkaz (pro testy, písemky, bonusy atd.)
 */
export interface LinkItem {
  id: string;
  label: string;
  url: string;
  type?: 'pdf' | 'link' | 'interactive';
}

/**
 * Data pro zobrazení pracovního listu (WorksheetView)
 * Používá se pro importované pracovní listy z legacy API
 */
export interface WorksheetData {
  /** URL náhledového obrázku */
  previewImageUrl?: string;
  /** URL náhledového obrázku (alias pro zpětnou kompatibilitu) */
  previewUrl?: string;
  /** URL hlavního PDF pracovního listu */
  pdfUrl?: string;
  /** URL řešení (PDF) */
  solutionPdfUrl?: string;
  /** URL učebního textu */
  textbookUrl?: string;
  /** URL metodiky */
  methodologyUrl?: string;
  /** Interaktivní pracovní listy (VividBoard) */
  interactiveWorksheets?: LinkItem[];
  /** Interaktivní řešení */
  interactiveSolutions?: LinkItem[];
  /** Seznam procvičování */
  exercises?: PracticeLink[];
  /** Seznam miniher */
  minigames?: LinkItem[];
  /** Seznam testů */
  tests?: LinkItem[];
  /** Seznam písemek */
  exams?: LinkItem[];
  /** Seznam bonusů a příloh */
  bonuses?: LinkItem[];
}

/**
 * Výchozí hodnoty pro nový pracovní list
 */
export const DEFAULT_WORKSHEET_METADATA: WorksheetMetadata = {
  subject: 'fyzika',
  grade: 6,
  estimatedTime: 15,
  keywords: [],
  globalFontSize: 'small',
  // PRO defaults
  gridColumns: 12,
  gridGap: 'medium',
};

/**
 * Výchozí data pro worksheet view (prázdný worksheet s placeholder bloky)
 */
export const DEFAULT_WORKSHEET_DATA: Worksheet = {
  id: 'default',
  title: 'Nový pracovní list',
  description: '',
  blocks: [
    {
      id: 'default-header',
      type: 'header-footer',
      order: 0,
      width: 'full',
      content: {
        variant: 'header',
        columns: 1,
        showName: true,
        showSurname: true,
        showClass: true,
        showGrade: true,
        showPageNumber: false,
        showQrCode: false,
        nameLabel: 'Jméno',
        surnameLabel: 'Příjmení',
        classLabel: 'Třída',
        gradeLabel: 'Známka',
        showFeedback: false,
        showFooterInfo: false,
      },
    },
    {
      id: 'default-h1',
      type: 'heading',
      order: 1,
      width: 'full',
      content: { text: 'Nadpis pracovního listu', level: 'h1', align: 'left' }
    },
    {
      id: 'default-p1',
      type: 'paragraph',
      order: 2,
      width: 'half',
      widthPercent: 50,
      content: { html: '<p>Zde začněte psát text k tématu...</p>' }
    },
    {
      id: 'default-q1',
      type: 'multiple-choice',
      order: 3,
      width: 'half',
      widthPercent: 50,
      content: {
        question: 'Zde zadejte otázku k textu...',
        options: [
          { id: 'opt-1', text: 'Možnost A' },
          { id: 'opt-2', text: 'Možnost B' },
        ],
        correctAnswers: [],
        allowMultiple: false,
      }
    }
  ],
  metadata: DEFAULT_WORKSHEET_METADATA,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  status: 'draft',
};

/**
 * Vytvoří prázdný pracovní list s výchozími placeholder bloky
 */
export function createEmptyWorksheet(id: string): Worksheet {
  const now = new Date().toISOString();
  
  // Create default placeholder blocks
  const blocks: WorksheetBlock[] = [
    {
      id: generateBlockId(),
      type: 'header-footer',
      order: 0,
      width: 'full',
      content: {
        variant: 'header',
        columns: 1,
        showName: true,
        showSurname: true,
        showClass: true,
        showGrade: true,
        showPageNumber: false,
        showQrCode: false,
        nameLabel: 'Jméno',
        surnameLabel: 'Příjmení',
        classLabel: 'Třída',
        gradeLabel: 'Známka',
        showFeedback: false,
        showFooterInfo: false,
      },
    },
    {
      id: generateBlockId(),
      type: 'heading',
      order: 1,
      width: 'full',
      content: { 
        text: 'Nadpis pracovního listu', 
        level: 'h1',
        align: 'left'
      }
    },
    {
      id: generateBlockId(),
      type: 'paragraph',
      order: 2,
      width: 'half',
      widthPercent: 50,
      content: { 
        html: '<p>Zde začněte psát text k tématu. Tento blok je nastaven na polovinu šířky stránky, aby mohl být vedle něj další obsah.</p>' 
      }
    },
    {
      id: generateBlockId(),
      type: 'multiple-choice',
      order: 3,
      width: 'half',
      widthPercent: 50,
      content: {
        question: 'Zde zadejte otázku, která se vztahuje k textu vlevo...',
        options: [
          { id: generateBlockId() + '-opt1', text: 'Možnost A' },
          { id: generateBlockId() + '-opt2', text: 'Možnost B' },
        ],
        correctAnswers: [],
        allowMultiple: false,
      }
    }
  ];

  return {
    id,
    title: 'Nový pracovní list',
    description: '',
    blocks,
    metadata: { ...DEFAULT_WORKSHEET_METADATA },
    createdAt: now,
    updatedAt: now,
    status: 'draft',
  };
}

/**
 * Generuje unikátní ID pro blok
 */
export function generateBlockId(): string {
  return `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Vytvoří nový blok daného typu s výchozím obsahem
 */
export function createEmptyBlock(type: BlockType, order: number): WorksheetBlock {
  const id = generateBlockId();
  
  switch (type) {
    case 'heading':
      return {
        id,
        type: 'heading',
        order,
        width: 'full',
        content: { text: '', level: 'h1' },
      };
    case 'paragraph':
      return {
        id,
        type: 'paragraph',
        order,
        width: 'full',
        content: { html: '' },
      };
    case 'infobox':
      // Infobox is now a paragraph with displayPreset 'infobox'
      return {
        id,
        type: 'paragraph',
        order,
        width: 'full',
        content: { html: '' },
        visualStyles: {
          displayPreset: 'infobox',
          backgroundColor: '#dbeafe',
          borderColor: '#3b82f6',
          borderRadius: 12,
          shadow: 'none',
        },
      };
    case 'multiple-choice':
      return {
        id,
        type: 'multiple-choice',
        order,
        width: 'full',
        content: {
          question: '',
          options: [
            { id: 'opt-1', text: '' },
            { id: 'opt-2', text: '' },
          ],
          correctAnswers: [],
          allowMultiple: false,
          variant: 'text',
          gridColumns: 4,
        },
      };
    case 'fill-blank':
      return {
        id,
        type: 'fill-blank',
        order,
        width: 'full',
        content: {
          segments: [{ type: 'text', content: '' }],
        },
      };
    case 'free-answer':
      return {
        id,
        type: 'free-answer',
        order,
        width: 'full',
        content: {
          question: '',
          lines: 3,
        },
      };
    case 'spacer':
      return {
        id,
        type: 'spacer',
        order,
        width: 'full',
        content: {
          height: 100,
          style: 'dotted',
        },
      };
    case 'examples':
      return {
        id,
        type: 'examples',
        order,
        width: 'full',
        content: {
          sampleExample: '',
          examples: [],
          examplesCount: 15,
          columns: 3,
          labelType: 'none',
          difficultyProgression: true,
          showDifficultyColors: true,
          answerBoxStyle: 'block',
        },
      };
    case 'image':
      return {
        id,
        type: 'image',
        order,
        width: 'full',
        content: {
          url: '',
          alt: '',
          caption: '',
          size: 100,
          alignment: 'center',
        },
      };
    case 'table':
      return {
        id,
        type: 'table',
        order,
        width: 'full',
        content: {
          html: '<table><thead><tr><th></th><th></th><th></th></tr></thead><tbody><tr><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td></tr></tbody></table>',
          rows: 3,
          columns: 3,
          hasHeader: true,
          hasBorder: true,
          hasRoundedCorners: true,
        },
      };
    case 'connect-pairs':
      return {
        id,
        type: 'connect-pairs',
        order,
        width: 'full',
        content: {
          instruction: 'Spoj správné dvojice',
          pairs: [
            {
              id: 'pair-1',
              left: { id: 'left-1', type: 'text', content: '' },
              right: { id: 'right-1', type: 'text', content: '' },
            },
            {
              id: 'pair-2',
              left: { id: 'left-2', type: 'text', content: '' },
              right: { id: 'right-2', type: 'text', content: '' },
            },
          ],
          shuffleSides: true,
        },
      };
    case 'image-hotspots':
      return {
        id,
        type: 'image-hotspots',
        order,
        width: 'full',
        content: {
          instruction: 'Označ správné místo na obrázku',
          imageUrl: '',
          hotspots: [],
          markerStyle: 'circle',
          markerSize: 100,
          answerType: 'text',
          layout: 'stacked',
        },
      };
    case 'video-quiz':
      return {
        id,
        type: 'video-quiz',
        order,
        width: 'full',
        content: {
          instruction: 'Sleduj video a odpověz na otázky',
          videoUrl: '',
          questions: [],
        },
      };
    case 'qr-code':
      return {
        id,
        type: 'qr-code',
        order,
        width: 'full',
        content: {
          url: '',
          caption: '',
          captionPosition: 'under',
          size: 150,
        },
      };
    case 'header-footer':
      return {
        id,
        type: 'header-footer',
        order,
        width: 'full',
        content: {
          variant: 'header',
          columns: 1,
          showName: true,
          showSurname: true,
          showClass: true,
          showGrade: true,
          showPageNumber: false,
          showQrCode: false,
          nameLabel: 'Jméno',
          surnameLabel: 'Příjmení',
          classLabel: 'Třída',
          gradeLabel: 'Známka',
          showFeedback: true,
          feedbackType: 'smileys',
          feedbackCount: 5,
          feedbackText: 'Tento pracovní list se mi vyplňoval:',
          showFooterInfo: true,
        },
      };
    case 'free-canvas':
      return {
        id,
        type: 'free-canvas',
        order,
        width: 'full',
        content: {
          instruction: '',
          objects: [],
          canvasWidth: 750,  // A4 width minus margins
          canvasHeight: 400,
          backgroundColor: '#ffffff',
          showGrid: true,
          gridSize: 20,
          circleColor: '#1e293b',
          circleSize: 21,
        },
      };
  }
}
