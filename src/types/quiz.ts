// =============================================
// VIVIDBOARD QUIZ/TEST TYPES
// =============================================

/**
 * Slide types in a quiz
 */
export type SlideType = 'info' | 'activity' | 'tools';

/**
 * Activity types for activity slides
 */
export type ActivityType = 
  | 'abc' 
  | 'open' 
  | 'example' 
  | 'true-false' 
  | 'matching' 
  | 'ordering' 
  | 'board' 
  | 'voting'
  | 'fill-blanks'      // Doplňování - drag and drop words into sentences
  | 'image-hotspots'   // Poznávačka - identify points on an image
  | 'connect-pairs'    // Spojovačka - connect matching pairs
  | 'video-quiz'       // Otázky ve videu - questions at specific video timestamps
  | 'form';            // Formulář - custom form with various field types

// =============================================
// BOARD (NÁSTĚNKA) TYPES
// =============================================

/**
 * Board type - determines the layout and features
 */
export type BoardType = 'text' | 'presentation' | 'pros-cons';

/**
 * A single post on the board
 */
export interface BoardPost {
  id: string;
  text: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'youtube';
  authorName: string;
  authorId: string;
  likes: string[]; // Array of user IDs who liked this post
  createdAt: number; // timestamp
  backgroundColor?: string; // Optional background color for the post
  column?: 'left' | 'right'; // For pros-cons board: which column the post belongs to
}

/**
 * Board activity slide - students can post and like
 */
export interface BoardActivitySlide extends BaseSlide {
  type: 'activity';
  activityType: 'board';
  boardType?: BoardType; // Type of board: text, presentation, or pros-cons
  question: string; // The prompt/question for the board
  questionImage?: string; // Optional image for the question
  allowMedia: boolean; // If true, posts can include images/videos (Padlet-like)
  allowAnonymous?: boolean; // If true, students can post anonymously
  maxPosts?: number; // Max posts per student (optional)
  posts?: BoardPost[]; // Posts are stored here in the quiz data, but live posts are in Firebase
  // For pros-cons board type:
  leftColumnLabel?: string; // Label for left column (default: "Pro")
  rightColumnLabel?: string; // Label for right column (default: "Proti")
}

/**
 * Base slide interface
 */
export interface BaseSlide {
  id: string;
  type: SlideType;
  order: number;
  backgroundColor?: string;
}

// =============================================
// BLOCK-BASED LAYOUT SYSTEM FOR INFO SLIDES
// =============================================

/**
 * Block content types
 */
export type SlideBlockType = 'text' | 'image' | 'link' | 'lottie';

/**
 * Background settings for blocks and slides
 */
export interface BackgroundSettings {
  type: 'color' | 'image';
  color?: string;
  imageUrl?: string;
  opacity?: number; // 0-100
  blur?: number; // 0-20
}

/**
 * Individual block in a slide layout
 */
export interface SlideBlock {
  id: string;
  type: SlideBlockType;
  content: string; // Text content, image URL, or link URL
  title?: string; // For links - display text
  background?: BackgroundSettings;
  textAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  fontSize?: 'xsmall' | 'small' | 'medium' | 'large' | 'xlarge' | 'xxlarge';
  fontFamily?: 'fenomen' | 'cooper' | 'space' | 'sora' | 'playfair' | 'itim' | 'sacramento' | 'lora' | 'oswald';
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline';
  textColor?: string; // Text color
  highlightColor?: string; // Background highlight color
  listType?: 'none' | 'bullet' | 'numbered' | 'checklist'; // List formatting
  // Text overflow settings
  textOverflow?: 'scroll' | 'fit'; // scroll = scrollable block, fit = auto-size text to fit 90% of block height
  // Image settings
  imageFit?: 'contain' | 'cover'; // contain = show slider, cover = fill block
  imageScale?: number; // 10-300, percentage of image size
  imagePositionX?: number; // 0-100, horizontal position for object-position (50 = center)
  imagePositionY?: number; // 0-100, vertical position for object-position (50 = center)
  imageCaption?: string; // Image description/caption
  imageLink?: string; // URL to open when image is clicked
  // Gallery settings
  gallery?: string[]; // Array of image URLs for gallery mode
  galleryIndex?: number; // Current gallery index
  galleryNavType?: 'dots-bottom' | 'dots-side' | 'arrows' | 'solution'; // Navigation type
  // Lottie animation settings
  lottieUrl?: string; // URL to Lottie JSON file
  lottieAutoplay?: boolean; // Auto-play animation
  lottieLoop?: boolean; // Loop animation
  lottieStepIndex?: number; // Current step index for multi-step animations
  // Link settings
  linkMode?: 'button' | 'embed' | 'video' | 'qr' | 'preview';
  linkTitle?: string; // For buttons or cards
  linkDescription?: string; // For cards
  linkThumbnail?: string; // For cards
  // Text padding (inner margins)
  textPadding?: number; // 0-48 - padding in pixels
  // Typography settings
  lineHeight?: number; // 1.0, 1.2, 1.4, 1.6, 1.8, 2.0 - line height multiplier
  letterSpacing?: number; // -2, -1, 0, 1, 2, 3, 4 - letter spacing in pixels
}

/**
 * Layout types for info slides
 * Desktop view - on mobile, blocks stack vertically
 */
export type SlideLayoutType = 
  | 'single'             // Single block taking full page
  | 'title-content'      // Title block + main content
  | 'title-2cols'        // Title + 2 columns
  | 'title-3cols'        // Title + 3 columns
  | '2cols'              // 2 columns only
  | '3cols'              // 3 columns only
  | 'left-large-right-split'  // Left column large, right split in half vertically
  | 'right-large-left-split' // Right column large, left split in half vertically
  | 'grid-2x2';          // 2x2 grid layout

/**
 * Layout configuration with block ratios
 */
export interface SlideLayout {
  type: SlideLayoutType;
  blocks: SlideBlock[];
  // Ratios for resizable areas (stored as percentages)
  titleHeight?: number;     // % height of title block (default 20)
  columnRatios?: number[];  // % widths of columns, e.g. [50, 50] or [33, 34, 33]
  splitRatio?: number;      // % for split layouts (how much of split area is top vs bottom)
}

// =============================================
// SLIDE TEMPLATES (FONTS & COLORS)
// =============================================

/**
 * Available font families for templates
 * Using Google Fonts compatible names
 */
export type TemplateFontFamily = 
  | 'Sora'
  | 'Space Grotesk'
  | 'Playfair Display'
  | 'Itim'
  | 'Sacramento'
  | 'Lora'
  | 'Oswald';

/**
 * Color scheme for a template
 */
export interface TemplateColorScheme {
  primary: string;      // Main background/accent color
  secondary: string;    // Secondary color for blocks
  tertiary?: string;    // Third color if needed
  text: string;         // Text color
  textLight?: string;   // Light text color
}

/**
 * Slide template definition
 */
export interface SlideTemplate {
  id: string;
  name: string;
  font: TemplateFontFamily;
  colors: TemplateColorScheme;
  blockColors?: string[]; // Optional specific colors for each block
  defaultGap?: number; // Default gap between blocks
  defaultRadius?: number; // Default border radius
}

/**
 * Predefined templates
 */
export const SLIDE_TEMPLATES: SlideTemplate[] = [
  {
    id: 'modern-blue',
    name: 'Moderní modrá',
    font: 'Sora',
    colors: {
      primary: '#3B82F6',
      secondary: '#DBEAFE',
      tertiary: '#EFF6FF',
      text: '#1E3A8A',
      textLight: '#60A5FA',
    },
    blockColors: ['#DBEAFE', '#BFDBFE', '#93C5FD'],
    defaultGap: 11,
    defaultRadius: 12,
  },
  {
    id: 'elegant-serif',
    name: 'Elegantní',
    font: 'Playfair Display',
    colors: {
      primary: '#7C3AED',
      secondary: '#EDE9FE',
      tertiary: '#F5F3FF',
      text: '#4C1D95',
      textLight: '#A78BFA',
    },
    blockColors: ['#EDE9FE', '#DDD6FE', '#C4B5FD'],
    defaultGap: 0,
    defaultRadius: 0,
  },
  {
    id: 'warm-creative',
    name: 'Kreativní',
    font: 'Itim',
    colors: {
      primary: '#F59E0B',
      secondary: '#FEF3C7',
      tertiary: '#FFFBEB',
      text: '#92400E',
      textLight: '#FBBF24',
    },
    blockColors: ['#FEF3C7', '#FDE68A', '#FCD34D'],
    defaultGap: 16,
    defaultRadius: 24,
  },
  {
    id: 'minimal-dark',
    name: 'Minimalistická',
    font: 'Space Grotesk',
    colors: {
      primary: '#1F2937',
      secondary: '#F3F4F6',
      tertiary: '#E5E7EB',
      text: '#111827',
      textLight: '#6B7280',
    },
    blockColors: ['#F3F4F6', '#E5E7EB', '#D1D5DB'],
    defaultGap: 4,
    defaultRadius: 4,
  },
];

/**
 * Get template by ID
 */
export function getTemplateById(templateId: string): SlideTemplate | undefined {
  return SLIDE_TEMPLATES.find(t => t.id === templateId);
}

/**
 * Information slide - displays content without interaction
 * Now supports block-based layouts
 */
export interface InfoSlide extends BaseSlide {
  type: 'info';
  templateId?: string; // Reference to template
  // Block styling options
  blockGap?: number; // Gap between blocks in pixels (0-40)
  blockRadius?: number; // Border radius of blocks in pixels (0-32)
  // Chapter and notes
  chapterName?: string; // Chapter name for navigation
  note?: string; // Private note for teacher
  // Legacy fields (for backwards compatibility)
  title: string;
  content: string; // HTML content
  media?: {
    type: 'image' | 'video' | 'lottie';
    url: string;
    caption?: string;
  };
  // New block-based layout system
  layout?: SlideLayout;
  slideBackground?: BackgroundSettings;
  // Saved blocks when switching to layout with fewer blocks
  savedBlocks?: SlideBlock[];
}

/**
 * ABC Question - Multiple choice with one or more correct answers
 */
export interface ABCOption {
  id: string;
  label: string; // A, B, C, D...
  content: string; // Can be text, math (LaTeX), or HTML
  isCorrect: boolean;
}

export interface ABCActivitySlide extends BaseSlide {
  type: 'activity';
  activityType: 'abc';
  question: string; // Can include LaTeX math
  options: ABCOption[];
  allowMultipleCorrect?: boolean; // If true, multiple options can be marked as correct and student can select multiple
  explanation?: string; // Shown after answering
  points: number;
  timeLimit?: number; // seconds, optional
  media?: {
    type: 'image' | 'video' | 'lottie';
    url: string;
  };
}

/**
 * Open Question - Text answer
 */
export interface OpenActivitySlide extends BaseSlide {
  type: 'activity';
  activityType: 'open';
  question: string;
  correctAnswers: string[]; // Multiple accepted answers
  caseSensitive: boolean;
  explanation?: string;
  points: number;
  timeLimit?: number;
  media?: {
    type: 'image' | 'video' | 'lottie';
    url: string;
  };
}

/**
 * Example slide - Shows worked example with steps
 */
export interface ExampleStep {
  id: string;
  content: string; // HTML/LaTeX content
  hint?: string;
}

export interface ExampleActivitySlide extends BaseSlide {
  type: 'activity';
  activityType: 'example';
  title: string;
  problem: string;
  steps: ExampleStep[];
  finalAnswer: string;
  media?: {
    type: 'image' | 'video' | 'lottie';
    url: string;
  };
  // Reaction images/GIFs for answer feedback
  correctAnswerMedia?: {
    type: 'image' | 'gif';
    url: string;
    name?: string;
  };
  wrongAnswerMedia?: {
    type: 'image' | 'gif';
    url: string;
    name?: string;
  };
}

/**
 * True/False Question
 */
export interface TrueFalseActivitySlide extends BaseSlide {
  type: 'activity';
  activityType: 'true-false';
  statement: string;
  isTrue: boolean;
  explanation?: string;
  points: number;
  timeLimit?: number;
}

// =============================================
// VOTING (HLASOVÁNÍ) TYPES
// =============================================

/**
 * Voting type - determines the UI and chart type
 */
export type VotingType = 'single' | 'multiple' | 'scale' | 'feedback';

/**
 * Feedback style for feedback voting type
 */
export type FeedbackStyle = 'emoji' | 'hearts';

/**
 * Voting option - similar to ABC but no correct/incorrect
 */
export interface VotingOption {
  id: string;
  label: string; // A, B, C, D... or number for scale
  content: string; // Text content for the option
  color?: string; // Optional color for the option in charts
  emoji?: string; // For feedback type with emoji
}

/**
 * Voting Activity - Students vote, teacher sees results in chart
 */
export interface VotingActivitySlide extends BaseSlide {
  type: 'activity';
  activityType: 'voting';
  votingType: VotingType; // Type of voting: single, multiple, scale, or feedback
  question: string;
  options: VotingOption[];
  allowMultiple: boolean; // Legacy: If true, students can select multiple options (bar chart)
  showResultsToStudents: boolean; // If true, students can see results after voting
  media?: {
    type: 'image' | 'video' | 'lottie';
    url: string;
  };
  // Scale (od-do) settings
  scaleMin?: number; // Minimum value (default: 1)
  scaleMax?: number; // Maximum value (default: 10)
  scaleMinLabel?: string; // Label for minimum (e.g., "Určitě ne")
  scaleMaxLabel?: string; // Label for maximum (e.g., "Určitě ano")
  // Feedback settings
  feedbackStyle?: FeedbackStyle; // 'emoji' or 'hearts'
}

/**
 * Tool types available
 */
export type ToolType = 'calculator' | 'drawing' | 'graph' | 'timer' | 'random' | 'certificate';

/**
 * Source for certificate fields - can be manual or from a form field
 */
export interface CertificateFieldSource {
  type: 'manual' | 'form-field' | 'auto';
  value?: string;          // For manual input
  slideId?: string;        // Reference to form slide
  fieldId?: string;        // Reference to form field
}

/**
 * Certificate column configuration
 */
export interface CertificateColumn {
  title: string;
  content: string;
}

/**
 * Position for custom template overlays
 */
export interface CustomPosition {
  top: string;
  left: string;
}

/**
 * Certificate tool configuration
 */
export interface CertificateConfig {
  title: string;                          // Main title e.g. "CERTIFIKÁT"
  subtitle?: string;                      // Optional subtitle e.g. "DVPP"
  organizationName?: string;              // e.g. "VIVIDBOOKS"
  nameSource: CertificateFieldSource;     // Source for participant name
  dateOfBirthSource?: CertificateFieldSource; // Source for date of birth
  issueDate?: CertificateFieldSource;     // Date of issue (can be auto = today)
  columns: CertificateColumn[];           // Bottom columns (typically 3)
  backgroundImage?: string;               // Custom background
  signatureImage?: string;                // Signature image
  logoImage?: string;                     // Logo image
  // Custom PDF template
  useCustomTemplate?: boolean;            // Whether to use custom PDF
  customPdfUrl?: string;                  // URL to custom PDF/image template
  customNamePosition?: CustomPosition;    // Position for name on custom template
  customDatePosition?: CustomPosition;    // Position for date on custom template
}

/**
 * Tools slide - Interactive tools (calculator, drawing, etc.)
 */
export interface ToolsSlide extends BaseSlide {
  type: 'tools';
  toolType: ToolType;
  config?: Record<string, unknown>;
  // Certificate specific
  certificateConfig?: CertificateConfig;
}

/**
 * Create a certificate slide
 */
export function createCertificateSlide(order: number): ToolsSlide {
  return {
    id: `slide-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'tools',
    toolType: 'certificate',
    order,
    certificateConfig: {
      title: 'CERTIFIKÁT',
      subtitle: '',
      organizationName: '',
      nameSource: { type: 'manual', value: '' },
      dateOfBirthSource: { type: 'manual', value: '' },
      issueDate: { type: 'auto' },
      columns: [
        { title: 'Popis programu', content: '' },
        { title: 'Podpis', content: '' },
        { title: 'Organizace', content: '' },
      ],
    },
  };
}

// =============================================
// MULTI-STEP ACTIVITY TYPES
// =============================================

/**
 * Blank item for fill-in-the-blanks activity
 */
export interface BlankItem {
  id: string;
  text: string; // The correct answer
  position: number; // Position in the sentence (character index)
}

/**
 * Fill-in-the-Blanks Activity (Doplňování)
 * Drag and drop words into sentences
 */
export interface FillBlanksActivitySlide extends BaseSlide {
  type: 'activity';
  activityType: 'fill-blanks';
  instruction?: string; // Optional instruction text
  sentences: {
    id: string;
    text: string; // Full text with blanks marked as [blank_id]
    blanks: BlankItem[];
  }[];
  distractors: string[]; // Wrong answer options
  countAsMultiple: boolean; // If true, each blank counts as 1 point
  shuffleOptions: boolean; // If true, shuffle the draggable options
}

/**
 * Hotspot marker style
 */
export type HotspotMarkerStyle = 
  | 'empty-square'      // Prázdný čtverec
  | 'circle-small'      // Malý kulatý bod
  | 'circle-medium'     // Střední kulatý bod  
  | 'circle-large'      // Velký kulatý bod
  | 'pin'               // Pin jako na mapě
  | 'question-mark';    // Bílý čtverec s fialovým otazníkem

/**
 * Single hotspot on an image
 */
export interface ImageHotspot {
  id: string;
  x: number; // Percentage position (0-100)
  y: number; // Percentage position (0-100)
  label: string; // The correct answer (e.g., "Praha", "Biceps")
  markerStyle: HotspotMarkerStyle;
}

/**
 * Image Hotspots Activity (Poznávačka)
 * Identify points on an image with ABC questions
 */
export interface ImageHotspotsActivitySlide extends BaseSlide {
  type: 'activity';
  activityType: 'image-hotspots';
  instruction?: string;
  imageUrl: string;
  hotspots: ImageHotspot[];
  countAsMultiple: boolean; // If true, each hotspot counts as 1 point
  randomizeOrder: boolean; // If true, ask about hotspots in random order
  showAllHotspots: boolean; // If true, show all hotspots at once, else show one at a time
  markerStyle: HotspotMarkerStyle; // Global marker style for all hotspots
  markerSize: number; // Size multiplier (0.5 to 2.0, default 1.0)
  answerType: 'abc' | 'numeric' | 'text'; // abc = multiple choice, numeric = number keypad, text = text input
}

/**
 * Connect Pairs Item (can be text or image)
 */
export interface ConnectPairItem {
  id: string;
  type: 'text' | 'image';
  content: string; // Text content or image URL
}

/**
 * A pair to connect
 */
export interface ConnectPair {
  id: string;
  left: ConnectPairItem;
  right: ConnectPairItem;
}

/**
 * Connect Pairs Activity (Spojovačka)
 * Connect matching pairs with lines
 */
export interface ConnectPairsActivitySlide extends BaseSlide {
  type: 'activity';
  activityType: 'connect-pairs';
  instruction?: string;
  pairs: ConnectPair[];
  countAsMultiple: boolean; // If true, each pair counts as 1 point
  shuffleSides: boolean; // If true, shuffle left and right sides independently
}

/**
 * Video question at a specific timestamp
 */
export interface VideoQuestion {
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
 * Video Quiz Activity (Otázky ve videu)
 * ABC questions at specific video timestamps
 */
export interface VideoQuizActivitySlide extends BaseSlide {
  type: 'activity';
  activityType: 'video-quiz';
  instruction?: string;
  videoUrl: string; // YouTube URL
  videoId?: string; // Extracted YouTube video ID
  questions: VideoQuestion[];
  countAsMultiple: boolean; // If true, each question counts as 1 point
  mustAnswerToProgress: boolean; // If true, video pauses until question is answered
}

// =============================================
// FORM (FORMULÁŘ) TYPES
// =============================================

/**
 * Form field types
 */
export type FormFieldType = 
  | 'short-text'   // Krátká odpověď - single line text input
  | 'long-text'    // Dlouhá odpověď - multi-line textarea
  | 'checkboxes'   // Checkboxy - multiple choice with checkboxes
  | 'radio'        // Radio buttons - single choice
  | 'dropdown';    // Rozbalovací seznam - dropdown select

/**
 * Single form field
 */
export interface FormField {
  id: string;
  type: FormFieldType;
  label: string; // Question/label for the field
  required: boolean; // Is this field required?
  placeholder?: string; // Placeholder text for text inputs
  options?: string[]; // Options for checkboxes, radio, dropdown
}

/**
 * Form Activity (Formulář)
 * Custom form with various field types
 */
export interface FormActivitySlide extends BaseSlide {
  type: 'activity';
  activityType: 'form';
  instruction?: string; // Optional instruction at the top
  fields: FormField[]; // Array of form fields
}

/**
 * Union type for all slide types
 */
export type QuizSlide = 
  | InfoSlide 
  | ABCActivitySlide 
  | OpenActivitySlide 
  | ExampleActivitySlide 
  | TrueFalseActivitySlide
  | BoardActivitySlide
  | VotingActivitySlide
  | FillBlanksActivitySlide
  | ImageHotspotsActivitySlide
  | ConnectPairsActivitySlide
  | VideoQuizActivitySlide
  | FormActivitySlide
  | ToolsSlide;

/**
 * Activity slides union
 */
export type ActivitySlide = 
  | ABCActivitySlide 
  | OpenActivitySlide 
  | ExampleActivitySlide 
  | TrueFalseActivitySlide
  | BoardActivitySlide
  | VotingActivitySlide
  | FillBlanksActivitySlide
  | ImageHotspotsActivitySlide
  | ConnectPairsActivitySlide
  | VideoQuizActivitySlide
  | FormActivitySlide;

/**
 * Quiz/Test definition
 */
export interface Quiz {
  id: string;
  title: string;
  description?: string;
  subject?: string;
  grade?: number;
  slides: QuizSlide[];
  settings: QuizSettings;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

/**
 * Quiz settings
 */
export interface QuizSettings {
  showProgress: boolean;
  showScore: boolean;
  allowSkip: boolean;
  allowBack: boolean;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showExplanations: 'immediately' | 'after-submit' | 'never';
  passingScore?: number; // percentage
  timeLimit?: number; // total time in minutes
}

// =============================================
// STUDENT RESPONSE TYPES
// =============================================

/**
 * Student's answer to a slide
 */
export interface SlideResponse {
  slideId: string;
  activityType: ActivityType;
  answer: string | string[]; // Selected option ID(s) or text answer
  isCorrect?: boolean;
  points?: number;
  answeredAt: string;
  timeSpent: number; // seconds
}

/**
 * Student's quiz session
 */
export interface QuizSession {
  id: string;
  quizId: string;
  
  // Student info
  studentId?: string;
  studentName?: string;
  
  // Progress
  currentSlideIndex: number;
  responses: SlideResponse[];
  
  // Scoring
  totalPoints: number;
  maxPoints: number;
  correctCount: number;
  incorrectCount: number;
  
  // Timing
  startedAt: string;
  completedAt?: string;
  
  // Status
  status: 'in-progress' | 'completed' | 'abandoned';
}

/**
 * Live session for classroom sharing (Firebase)
 */
export interface LiveQuizSession {
  id: string;
  quizId: string;
  teacherId: string;
  teacherName: string;
  
  // Session state
  isActive: boolean;
  currentSlideIndex: number;
  
  // Control
  isPaused: boolean;
  showResults: boolean;
  isLocked: boolean; // true = students follow teacher, false = students can navigate freely
  
  // Quiz data (stored in Firebase for students to load)
  quizData?: {
    id: string;
    title: string;
    slides: QuizSlide[];
  };
  
  // Connected students
  students?: {
    [studentId: string]: {
      name: string;
      joinedAt: string;
      currentSlide: number;
      responses: SlideResponse[];
      isOnline: boolean;
      isFocused?: boolean;
      lastSeen?: string;
      deviceId?: string;
    };
  };
  
  // Timestamps
  createdAt: string;
  endedAt?: string;
  
  // Settings for live session
  settings?: {
    showSolutionHints?: boolean;
  };
}

// =============================================
// STUDENT INDIVIDUAL WORK (Self-study mode)
// =============================================

/**
 * Record of a student's individual work session on a board
 */
export interface StudentWorkSession {
  id: string;
  
  // Board/Quiz info
  boardId: string;
  boardTitle: string;
  boardSource: 'user' | 'vividbooks'; // user-created or from library
  boardOwnerId?: string; // Teacher who owns the board (if user-created)
  
  // Student info
  studentId: string;
  studentName: string;
  studentEmail?: string;
  
  // Session data
  startedAt: string;
  completedAt?: string;
  totalTimeMs: number;
  
  // Results
  responses: {
    [slideId: string]: SlideResponse;
  };
  correctCount: number;
  totalQuestions: number;
  score: number; // percentage 0-100
  
  // Status
  status: 'in_progress' | 'completed' | 'abandoned';
}

/**
 * Student's work history (all their individual sessions)
 */
export interface StudentWorkHistory {
  studentId: string;
  studentName: string;
  studentEmail?: string;
  
  // All work sessions indexed by session ID
  sessions: {
    [sessionId: string]: StudentWorkSession;
  };
  
  // Stats
  totalSessionsCompleted: number;
  totalTimeSpentMs: number;
  lastActiveAt: string;
}

/**
 * Teacher's view of student work in their classroom
 */
export interface ClassroomStudentWork {
  // Indexed by board ID
  [boardId: string]: {
    boardTitle: string;
    students: {
      [studentId: string]: StudentWorkSession;
    };
  };
}

// =============================================
// HELPER FUNCTIONS
// =============================================

/**
 * Create empty quiz
 */
export function createEmptyQuiz(id: string): Quiz {
  return {
    id,
    title: 'Nový kvíz',
    slides: [
      createInfoSlide(0, 'title-content') // Start with a default info slide
    ],
    settings: {
      showProgress: true,
      showScore: true,
      allowSkip: false,
      allowBack: true,
      shuffleQuestions: false,
      shuffleOptions: false,
      showExplanations: 'immediately',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Create ABC question slide
 */
export function createABCSlide(order: number): ABCActivitySlide {
  return {
    id: `slide-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'activity',
    activityType: 'abc',
    order,
    question: '',
    options: [
      { id: 'a', label: 'A', content: '', isCorrect: true },
      { id: 'b', label: 'B', content: '', isCorrect: false },
      { id: 'c', label: 'C', content: '', isCorrect: false },
      { id: 'd', label: 'D', content: '', isCorrect: false },
    ],
    points: 1,
  };
}

/**
 * Create Open question slide
 */
export function createOpenSlide(order: number): OpenActivitySlide {
  return {
    id: `slide-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'activity',
    activityType: 'open',
    order,
    question: '',
    correctAnswers: [],
    caseSensitive: false,
    points: 1,
  };
}

/**
 * Create Example slide
 */
export function createExampleSlide(order: number): ExampleActivitySlide {
  return {
    id: `slide-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'activity',
    activityType: 'example',
    order,
    title: '',
    problem: '',
    steps: [],
    finalAnswer: '',
  };
}

/**
 * Create Board (Nástěnka) slide
 */
export function createBoardSlide(order: number): BoardActivitySlide {
  return {
    id: `slide-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'activity',
    activityType: 'board',
    order,
    question: '',
    allowMedia: false,
    allowAnonymous: false,
    posts: [],
  };
}

/**
 * Create Voting slide
 */
export function createVotingSlide(order: number, votingType: VotingType = 'single'): VotingActivitySlide {
  // Generate options based on voting type
  let options: VotingOption[] = [];
  
  if (votingType === 'scale') {
    // Generate 1-10 scale options
    options = Array.from({ length: 10 }, (_, i) => ({
      id: `scale-${i + 1}`,
      label: String(i + 1),
      content: String(i + 1),
      color: getScaleColor(i, 10),
    }));
  } else if (votingType === 'feedback') {
    // Default emoji feedback options
    options = [
      { id: 'feedback-1', label: '1', content: '😢', emoji: '😢' },
      { id: 'feedback-2', label: '2', content: '😟', emoji: '😟' },
      { id: 'feedback-3', label: '3', content: '😐', emoji: '😐' },
      { id: 'feedback-4', label: '4', content: '😊', emoji: '😊' },
      { id: 'feedback-5', label: '5', content: '🥳', emoji: '🥳' },
    ];
  } else {
    // Single or multiple choice - default ABC options
    options = [
      { id: 'a', label: 'A', content: '' },
      { id: 'b', label: 'B', content: '' },
      { id: 'c', label: 'C', content: '' },
    ];
  }
  
  return {
    id: `slide-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'activity',
    activityType: 'voting',
    votingType,
    order,
    question: '',
    options,
    allowMultiple: votingType === 'multiple',
    showResultsToStudents: true,
    // Scale defaults
    scaleMin: 1,
    scaleMax: 10,
    scaleMinLabel: 'Určitě ne',
    scaleMaxLabel: 'Určitě ano',
    // Feedback defaults
    feedbackStyle: 'emoji',
  };
}

/**
 * Generate color for scale based on position (orange to blue gradient)
 */
function getScaleColor(index: number, total: number): string {
  const colors = [
    '#f97316', // orange (1)
    '#f97316', // orange (2)
    '#c084fc', // purple-light (3)
    '#a855f7', // purple (4)
    '#8b5cf6', // violet (5)
    '#7c3aed', // violet-dark (6)
    '#6366f1', // indigo (7)
    '#4f46e5', // indigo-dark (8)
    '#4338ca', // indigo-darker (9)
    '#4f46e5', // indigo (10)
  ];
  return colors[index] || colors[0];
}

// =============================================
// MULTI-STEP ACTIVITY FACTORY FUNCTIONS
// =============================================

/**
 * Create Fill-in-the-Blanks slide (Doplňování)
 */
export function createFillBlanksSlide(order: number): FillBlanksActivitySlide {
  return {
    id: `slide-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'activity',
    activityType: 'fill-blanks',
    order,
    instruction: 'Doplň chybějící slova',
    sentences: [
      {
        id: 'sentence-1',
        text: '',
        blanks: [],
      },
    ],
    distractors: [],
    countAsMultiple: true,
    shuffleOptions: true,
  };
}

/**
 * Create Image Hotspots slide (Poznávačka)
 */
export function createImageHotspotsSlide(order: number): ImageHotspotsActivitySlide {
  return {
    id: `slide-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'activity',
    activityType: 'image-hotspots',
    order,
    instruction: 'Označ správné místo na obrázku',
    imageUrl: '',
    hotspots: [],
    countAsMultiple: true,
    randomizeOrder: true,
    showAllHotspots: true,
    markerStyle: 'circle-medium',
    markerSize: 1.0,
    answerType: 'abc',
  };
}

/**
 * Create Connect Pairs slide (Spojovačka)
 */
export function createConnectPairsSlide(order: number): ConnectPairsActivitySlide {
  return {
    id: `slide-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'activity',
    activityType: 'connect-pairs',
    order,
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
    countAsMultiple: true,
    shuffleSides: true,
  };
}

/**
 * Create Video Quiz slide (Otázky ve videu)
 */
export function createVideoQuizSlide(order: number): VideoQuizActivitySlide {
  return {
    id: `slide-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'activity',
    activityType: 'video-quiz',
    order,
    instruction: 'Sleduj video a odpovídej na otázky',
    videoUrl: '',
    questions: [],
    countAsMultiple: true,
    mustAnswerToProgress: true,
  };
}

/**
 * Create Form slide (Formulář)
 */
export function createFormSlide(order: number): FormActivitySlide {
  return {
    id: `slide-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'activity',
    activityType: 'form',
    order,
    instruction: '',
    fields: [],
  };
}

/**
 * Create a unique block ID
 */
function createBlockId(): string {
  return `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new block with defaults
 */
export function createSlideBlock(type: SlideBlockType = 'text'): SlideBlock {
  return {
    id: createBlockId(),
    type,
    content: '',
    textAlign: 'left',
    fontSize: 'medium',
    fontWeight: 'normal',
  };
}

/**
 * Create a layout with the specified type
 */
export function createSlideLayout(layoutType: SlideLayoutType): SlideLayout {
  switch (layoutType) {
    case 'single':
      return {
        type: layoutType,
        blocks: [
          createSlideBlock('text'), // Single full-page block
        ],
      };
    case 'title-content':
      return {
        type: layoutType,
        blocks: [
          { ...createSlideBlock('text'), fontSize: 'xlarge', fontWeight: 'bold' }, // Title
          createSlideBlock('text'), // Content
        ],
        titleHeight: 15,
      };
    case 'title-2cols':
      return {
        type: layoutType,
        blocks: [
          { ...createSlideBlock('text'), fontSize: 'xlarge', fontWeight: 'bold' }, // Title
          createSlideBlock('text'), // Left column
          createSlideBlock('text'), // Right column
        ],
        titleHeight: 15,
        columnRatios: [50, 50],
      };
    case 'title-3cols':
      return {
        type: layoutType,
        blocks: [
          { ...createSlideBlock('text'), fontSize: 'xlarge', fontWeight: 'bold' }, // Title
          createSlideBlock('text'), // Left column
          createSlideBlock('text'), // Middle column
          createSlideBlock('text'), // Right column
        ],
        titleHeight: 15,
        columnRatios: [33, 34, 33],
      };
    case '2cols':
      return {
        type: layoutType,
        blocks: [
          createSlideBlock('text'), // Left column
          createSlideBlock('text'), // Right column
        ],
        columnRatios: [50, 50],
      };
    case '3cols':
      return {
        type: layoutType,
        blocks: [
          createSlideBlock('text'), // Left column
          createSlideBlock('text'), // Middle column
          createSlideBlock('text'), // Right column
        ],
        columnRatios: [33, 34, 33],
      };
    case 'left-large-right-split':
      return {
        type: layoutType,
        blocks: [
          createSlideBlock('text'), // Left large
          createSlideBlock('text'), // Right top
          createSlideBlock('text'), // Right bottom
        ],
        columnRatios: [50, 50],
        splitRatio: 50,
      };
    case 'right-large-left-split':
      return {
        type: layoutType,
        blocks: [
          createSlideBlock('text'), // Left top
          createSlideBlock('text'), // Left bottom
          createSlideBlock('text'), // Right large
        ],
        columnRatios: [50, 50],
        splitRatio: 50,
      };
    case 'grid-2x2':
      return {
        type: layoutType,
        blocks: [
          createSlideBlock('text'), // Left top
          createSlideBlock('text'), // Right top
          createSlideBlock('text'), // Left bottom
          createSlideBlock('text'), // Right bottom
        ],
      };
    default:
      return {
        type: 'title-content',
        blocks: [
          { ...createSlideBlock('text'), fontSize: 'xlarge', fontWeight: 'bold' },
          createSlideBlock('text'),
        ],
        titleHeight: 15,
      };
  }
}

/**
 * Create Info slide with optional layout
 */
export function createInfoSlide(order: number, layoutType: SlideLayoutType = 'title-content'): InfoSlide {
  return {
    id: `slide-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'info',
    order,
    title: '',
    content: '',
    layout: createSlideLayout(layoutType),
  };
}

// =============================================
// SLIDE TYPE OPTIONS (UI)
// =============================================

export interface SlideTypeOption {
  id: string;
  type: SlideType;
  activityType?: ActivityType;
  label: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}

/**
 * Calculate quiz score
 */
export function calculateQuizScore(responses: SlideResponse[], slides: QuizSlide[]): {
  totalPoints: number;
  maxPoints: number;
  correctCount: number;
  incorrectCount: number;
  percentage: number;
} {
  let totalPoints = 0;
  let maxPoints = 0;
  let correctCount = 0;
  let incorrectCount = 0;

  for (const slide of slides) {
    if (slide.type === 'activity' && 'points' in slide) {
      maxPoints += slide.points;
      
      const response = responses.find(r => r.slideId === slide.id);
      if (response) {
        if (response.isCorrect) {
          totalPoints += response.points || slide.points;
          correctCount++;
        } else {
          incorrectCount++;
        }
      }
    }
  }

  return {
    totalPoints,
    maxPoints,
    correctCount,
    incorrectCount,
    percentage: maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 100) : 0,
  };
}

/**
 * Generate option labels (A, B, C, D, E, ...)
 */
export function getOptionLabel(index: number): string {
  return String.fromCharCode(65 + index); // A = 65
}

