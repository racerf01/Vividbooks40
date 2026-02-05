/**
 * Curriculum Factory - TypeScript Types
 * 
 * Typy pro automatickou tvorbu vzdělávacích materiálů
 */

// =====================================================
// ZÁKLADNÍ TYPY
// =====================================================

export type SubjectCode = 
  // 2. stupeň
  | 'dejepis' | 'zemepis' | 'cestina' | 'anglictina' | 'nemcina' | 'francouzstina'
  | 'matematika' | 'prirodopis' | 'fyzika' | 'chemie'
  // 1. stupeň
  | 'cestina_1st' | 'matematika_1st' | 'anglictina_1st' 
  | 'prvouka' | 'prirodoveda' | 'vlastiveda'
  | 'hudebni_vychova' | 'vytvarna_vychova' | 'telesna_vychova' | 'pracovni_cinnosti';

export type Grade = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type Difficulty = 'easy' | 'medium' | 'hard';
export type ContentType = 'board' | 'worksheet' | 'text' | 'quiz';
export type AgentStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
export type ContentStatus = 'pending' | 'generating' | 'draft' | 'reviewed' | 'approved' | 'published' | 'rejected';
export type BloomLevel = 'znalost' | 'porozumeni' | 'aplikace' | 'analyza' | 'hodnoceni' | 'tvorba';

// =====================================================
// PŘEDMĚTY
// =====================================================

export interface CurriculumSubject {
  id: string;
  code: SubjectCode;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  hoursPerWeekDefault: number;
  grades: Grade[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// =====================================================
// RVP DATA
// =====================================================

export interface RvpData {
  id: string;
  subjectCode: SubjectCode;
  grade: Grade;
  thematicArea: string;
  topic: string;
  expectedOutcomes: string[];
  keyCompetencies: string[];
  crossCurricularTopics?: string[];
  recommendedHours?: number;
  difficultyLevel: Difficulty;
  prerequisites?: string[];
  sourceDocument?: string;
  rvpRevision: string;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
}

// =====================================================
// TÝDENNÍ PLÁNY
// =====================================================

export interface WeeklyPlan {
  id: string;
  subjectCode: SubjectCode;
  grade: Grade;
  schoolYear?: string;
  weekNumber: number; // 1-40
  monthName?: string;
  topicTitle: string;
  topicDescription?: string;
  rvpDataId?: string;
  rvpData?: RvpData;
  learningGoals?: string[];
  vocabulary?: string[];
  activitiesPlanned?: PlannedActivity[];
  hoursAllocated: number;
  status: 'draft' | 'approved' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export interface PlannedActivity {
  type: ContentType;
  title: string;
  difficulty: Difficulty;
  duration?: number;
}

// =====================================================
// SPECIFIKACE OBSAHU
// =====================================================

export interface ContentSpec {
  id: string;
  weeklyPlanId: string;
  weeklyPlan?: WeeklyPlan;
  contentType: ContentType;
  contentSubtype?: string;
  title: string;
  description?: string;
  difficulty: Difficulty;
  targetDurationMinutes?: number;
  questionTypes?: QuestionType[];
  questionCount?: number;
  specificRequirements?: string;
  learningObjectives?: string[];
  bloomLevel?: BloomLevel;
  priority: number;
  status: ContentStatus;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
}

export type QuestionType = 
  | 'abc'           // Multiple choice
  | 'fill-blank'    // Doplňování
  | 'open'          // Otevřená otázka
  | 'matching'      // Spojování
  | 'ordering'      // Řazení
  | 'true-false'    // Pravda/nepravda
  | 'image-label';  // Popisování obrázku

// =====================================================
// DRAFTY OBSAHU
// =====================================================

export interface ContentDraft {
  id: string;
  specId: string;
  spec?: ContentSpec;
  version: number;
  contentJson: any; // slides/blocks podle typu
  metadata?: DraftMetadata;
  qualityScore?: number;
  qaNotes?: string;
  wordCount?: number;
  questionCount?: number;
  mediaReferences?: string[];
  status: 'draft' | 'reviewed' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DraftMetadata {
  generatedBy: string; // 'agent-4', 'manual'
  modelUsed?: string;  // 'gemini-2.0-flash'
  tokensUsed?: number;
  generationTimeMs?: number;
  promptVersion?: string;
}

// =====================================================
// MÉDIA
// =====================================================

export interface CurriculumMedia {
  id: string;
  fileUrl: string;
  thumbnailUrl?: string;
  fileName?: string;
  fileType: 'image' | 'video' | 'audio';
  mimeType?: string;
  fileSize?: number;
  // Tagy
  subjectTags: SubjectCode[];
  topicTags: string[];
  gradeTags: Grade[];
  keywordTags: string[];
  // Metadata
  sourceUrl?: string;
  sourceName?: string;
  license?: string;
  licenseUrl?: string;
  author?: string;
  aiDescription?: string;
  aiAltText?: string;
  // Status
  isVerified: boolean;
  isAppropriate: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

// =====================================================
// PIPELINE
// =====================================================

export interface PipelineRun {
  id: string;
  subjectCode: SubjectCode;
  grade?: Grade;
  runType: 'full' | 'partial' | 'single_week';
  targetWeeks?: number[];
  // Status jednotlivých agentů
  agent1Status: AgentStatus;
  agent1StartedAt?: string;
  agent1CompletedAt?: string;
  agent1Output?: Agent1Output;
  agent2Status: AgentStatus;
  agent2StartedAt?: string;
  agent2CompletedAt?: string;
  agent2Output?: Agent2Output;
  agent3Status: AgentStatus;
  agent3StartedAt?: string;
  agent3CompletedAt?: string;
  agent3Output?: Agent3Output;
  agent4Status: AgentStatus;
  agent4StartedAt?: string;
  agent4CompletedAt?: string;
  agent4Output?: Agent4Output;
  agent5Status: AgentStatus;
  agent5StartedAt?: string;
  agent5CompletedAt?: string;
  agent5Output?: Agent5Output;
  agent6Status: AgentStatus;
  agent6StartedAt?: string;
  agent6CompletedAt?: string;
  agent6Output?: Agent6Output;
  // Celkový status
  overallStatus: AgentStatus;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  startedBy?: string;
  stats?: PipelineStats;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineStats {
  rvpTopicsProcessed: number;
  weeklyPlansCreated: number;
  contentSpecsCreated: number;
  draftsGenerated: number;
  mediaFound: number;
  contentPublished: number;
  errorsCount: number;
}

// =====================================================
// AGENT OUTPUTS
// =====================================================

export interface Agent1Output {
  // RVP Scout
  topicsFound: number;
  sourcesUsed: string[];
  rvpDataIds: string[];
}

export interface Agent2Output {
  // Planner
  weeklyPlansCreated: number;
  weeklyPlanIds: string[];
  hoursAllocated: number;
}

export interface Agent3Output {
  // Architect
  contentSpecsCreated: number;
  specIds: string[];
  byType: Record<ContentType, number>;
}

export interface Agent4Output {
  // Creator
  draftsGenerated: number;
  draftIds: string[];
  tokensUsed: number;
  averageQualityScore: number;
}

export interface Agent5Output {
  // Media Scout
  mediaFound: number;
  mediaIds: string[];
  bySource: Record<string, number>;
}

export interface Agent6Output {
  // Assembler
  contentPublished: number;
  boardIds: string[];
  worksheetIds: string[];
  textIds: string[];
}

// =====================================================
// PUBLISHED CONTENT
// =====================================================

export interface PublishedContent {
  id: string;
  draftId?: string;
  specId?: string;
  contentType: ContentType;
  // Reference
  teacherBoardId?: string;
  teacherWorksheetId?: string;
  teacherDocumentId?: string;
  // Metadata
  title: string;
  subjectCode: SubjectCode;
  grade: Grade;
  weekNumber?: number;
  difficulty?: Difficulty;
  isPublic: boolean;
  isPremium: boolean;
  downloadCount: number;
  ratingAverage?: number;
  ratingCount: number;
  publishedAt: string;
  publishedBy?: string;
  createdAt: string;
  updatedAt: string;
}

// =====================================================
// UI STATE
// =====================================================

export interface CurriculumFactoryState {
  // Výběr
  selectedSubject: SubjectCode | null;
  selectedGrade: Grade | null;
  selectedSchoolYear: string;
  // Data
  subjects: CurriculumSubject[];
  rvpData: RvpData[];
  weeklyPlans: WeeklyPlan[];
  contentSpecs: ContentSpec[];
  // Pipeline
  currentRun: PipelineRun | null;
  pastRuns: PipelineRun[];
  // UI
  activeTab: 'overview' | 'rvp' | 'planner' | 'specs' | 'drafts' | 'media' | 'published';
  isLoading: boolean;
  error: string | null;
}

// =====================================================
// API REQUESTS
// =====================================================

export interface StartPipelineRequest {
  subjectCode: SubjectCode;
  grade?: Grade;
  runType: 'full' | 'partial' | 'single_week';
  targetWeeks?: number[];
  options?: PipelineOptions;
}

export interface PipelineOptions {
  skipAgent1?: boolean; // Použít existující RVP data
  skipAgent5?: boolean; // Přeskočit hledání médií
  dryRun?: boolean;     // Jen simulovat, neukládat
  maxContentPerWeek?: number;
  preferredQuestionTypes?: QuestionType[];
}

// =====================================================
// KONSTANTY
// =====================================================

export const SUBJECT_NAMES: Record<SubjectCode, string> = {
  // 2. stupeň
  dejepis: 'Dějepis',
  zemepis: 'Zeměpis',
  cestina: 'Český jazyk',
  anglictina: 'Anglický jazyk',
  nemcina: 'Německý jazyk',
  francouzstina: 'Francouzský jazyk',
  matematika: 'Matematika',
  prirodopis: 'Přírodopis',
  fyzika: 'Fyzika',
  chemie: 'Chemie',
  // 1. stupeň
  cestina_1st: 'Český jazyk (1. st.)',
  matematika_1st: 'Matematika (1. st.)',
  anglictina_1st: 'Anglický jazyk (1. st.)',
  prvouka: 'Prvouka',
  prirodoveda: 'Přírodověda',
  vlastiveda: 'Vlastivěda',
  hudebni_vychova: 'Hudební výchova',
  vytvarna_vychova: 'Výtvarná výchova',
  telesna_vychova: 'Tělesná výchova',
  pracovni_cinnosti: 'Pracovní činnosti',
};

export const GRADE_NAMES: Record<Grade, string> = {
  // 1. stupeň
  1: '1. třída',
  2: '2. třída',
  3: '3. třída',
  4: '4. třída',
  5: '5. třída',
  // 2. stupeň
  6: '6. třída',
  7: '7. třída',
  8: '8. třída',
  9: '9. třída',
};

export const CONTENT_TYPE_NAMES: Record<ContentType, string> = {
  board: 'VividBoard',
  worksheet: 'Pracovní list',
  text: 'Učební text',
  quiz: 'Kvíz',
};

export const DIFFICULTY_NAMES: Record<Difficulty, string> = {
  easy: 'Lehká',
  medium: 'Střední',
  hard: 'Těžká',
};

export const BLOOM_LEVEL_NAMES: Record<BloomLevel, string> = {
  znalost: 'Znalost (zapamatování)',
  porozumeni: 'Porozumění',
  aplikace: 'Aplikace',
  analyza: 'Analýza',
  hodnoceni: 'Hodnocení',
  tvorba: 'Tvorba',
};

export const MONTHS_CZ = [
  'září', 'říjen', 'listopad', 'prosinec',
  'leden', 'únor', 'březen', 'duben', 'květen', 'červen'
];

export const WEEK_TO_MONTH: Record<number, string> = {
  1: 'září', 2: 'září', 3: 'září', 4: 'září',
  5: 'říjen', 6: 'říjen', 7: 'říjen', 8: 'říjen',
  9: 'listopad', 10: 'listopad', 11: 'listopad', 12: 'listopad',
  13: 'prosinec', 14: 'prosinec', 15: 'prosinec', 16: 'prosinec',
  17: 'leden', 18: 'leden', 19: 'leden', 20: 'leden',
  21: 'únor', 22: 'únor', 23: 'únor', 24: 'únor',
  25: 'březen', 26: 'březen', 27: 'březen', 28: 'březen',
  29: 'duben', 30: 'duben', 31: 'duben', 32: 'duben',
  33: 'květen', 34: 'květen', 35: 'květen', 36: 'květen',
  37: 'červen', 38: 'červen', 39: 'červen', 40: 'červen',
};
