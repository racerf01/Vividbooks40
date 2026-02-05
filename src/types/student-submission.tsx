/**
 * Types and utilities for student submissions
 * 
 * Covers:
 * - Submission status tracking
 * - Paste event detection for AI suspicion
 * - Teacher grading and inline comments
 */

// =============================================
// SUBMISSION STATUS
// =============================================

export type SubmissionStatus = 'not_started' | 'writing' | 'submitted' | 'graded';

export type AiSuspicionLevel = 'none' | 'low' | 'medium' | 'high';

// =============================================
// PASTE EVENTS (for AI detection)
// =============================================

export interface PasteEvent {
  /** Unique ID for this paste event */
  id: string;
  /** When the paste occurred */
  timestamp: string;
  /** Number of words pasted */
  wordCount: number;
  /** Optional source URL provided by student */
  sourceUrl?: string;
  /** Whether the student dismissed the dialog without providing a source */
  dismissedWithoutSource: boolean;
  /** Preview of the pasted text (first ~100 chars) */
  textPreview: string;
}

// =============================================
// INLINE COMMENTS (for teacher review)
// =============================================

export interface TextSelection {
  /** Start offset in the document */
  startOffset: number;
  /** End offset in the document */
  endOffset: number;
  /** The selected text */
  text: string;
  /** XPath or identifier for the element containing the selection */
  elementPath?: string;
}

export interface InlineComment {
  /** Unique comment ID */
  id: string;
  /** When the comment was created */
  createdAt: string;
  /** Whether the student has read this comment */
  isRead: boolean;
  /** Teacher's user ID */
  teacherId: string;
  /** Teacher's display name */
  teacherName: string;
  /** The text selection this comment refers to */
  selection: TextSelection;
  /** The comment content */
  text: string;
}

// =============================================
// GRADING
// =============================================

export interface SubmissionGrade {
  /** Percentage grade (0-100) */
  percentage: number;
  /** Teacher's final comment */
  comment?: string;
  /** When the grade was given */
  gradedAt: string;
  /** Teacher who graded */
  gradedBy: {
    id: string;
    name: string;
  };
}

// =============================================
// STUDENT SUBMISSION
// =============================================

export interface SubmissionSettings {
  /** Whether AI assistant is enabled for this assignment */
  aiAssistantEnabled: boolean;
  /** Whether there's a specific assignment/task description */
  hasAssignment: boolean;
  /** The assignment description text */
  assignmentDescription?: string;
  /** Due date for the submission */
  dueDate?: string;
}

export interface StudentSubmission {
  /** Unique submission ID */
  id: string;
  /** Assignment/worksheet ID */
  assignmentId: string;
  /** Assignment title */
  assignmentTitle: string;
  /** Type of assignment */
  assignmentType: 'worksheet' | 'document' | 'board';
  /** Student's user ID */
  studentId: string;
  /** Student's display name */
  studentName: string;
  /** Class ID */
  classId: string;
  /** Class name */
  className: string;
  /** Current submission status */
  status: SubmissionStatus;
  /** Assignment settings */
  settings: SubmissionSettings;
  /** When the student started working */
  startedAt?: string;
  /** Last edit timestamp */
  lastEditedAt?: string;
  /** When the work was submitted */
  submittedAt?: string;
  /** When the work was graded */
  gradedAt?: string;
  /** All paste events recorded */
  pasteEvents: PasteEvent[];
  /** Calculated AI suspicion level */
  aiSuspicionLevel: AiSuspicionLevel;
  /** Inline comments from teacher */
  inlineComments: InlineComment[];
  /** Grade (if graded) */
  grade?: SubmissionGrade;
  /** Document content (HTML) */
  content?: string;
}

// =============================================
// UTILITY FUNCTIONS
// =============================================

/**
 * Calculate AI suspicion level based on paste events
 */
export function calculateAiSuspicion(pasteEvents: PasteEvent[]): AiSuspicionLevel {
  if (pasteEvents.length === 0) {
    return 'none';
  }

  // Count events without sources
  const eventsWithoutSource = pasteEvents.filter(e => e.dismissedWithoutSource);
  const totalWords = pasteEvents.reduce((sum, e) => sum + e.wordCount, 0);
  const wordsWithoutSource = eventsWithoutSource.reduce((sum, e) => sum + e.wordCount, 0);

  // High suspicion: many paste events without sources or large amount of text
  if (eventsWithoutSource.length >= 5 || wordsWithoutSource >= 200) {
    return 'high';
  }

  // Medium suspicion: some paste events without sources
  if (eventsWithoutSource.length >= 2 || wordsWithoutSource >= 50) {
    return 'medium';
  }

  // Low suspicion: at least one paste without source
  if (eventsWithoutSource.length >= 1) {
    return 'low';
  }

  // All pastes have sources
  return 'none';
}

/**
 * Create an empty submission for a new assignment
 */
export function createEmptySubmission(
  assignmentId: string,
  assignmentTitle: string,
  assignmentType: 'worksheet' | 'document' | 'board',
  studentId: string,
  studentName: string,
  classId: string,
  className: string,
  settings: Partial<SubmissionSettings> = {}
): StudentSubmission {
  return {
    id: `submission-${assignmentId}-${studentId}-${Date.now()}`,
    assignmentId,
    assignmentTitle,
    assignmentType,
    studentId,
    studentName,
    classId,
    className,
    status: 'not_started',
    settings: {
      aiAssistantEnabled: settings.aiAssistantEnabled ?? true,
      hasAssignment: settings.hasAssignment ?? false,
      assignmentDescription: settings.assignmentDescription,
      dueDate: settings.dueDate,
    },
    pasteEvents: [],
    aiSuspicionLevel: 'none',
    inlineComments: [],
  };
}

/**
 * Get human-readable status label (in Czech)
 */
export function getStatusLabel(status: SubmissionStatus): string {
  switch (status) {
    case 'not_started':
      return 'Nezahájeno';
    case 'writing':
      return 'Rozpracováno';
    case 'submitted':
      return 'Odevzdáno';
    case 'graded':
      return 'Ohodnoceno';
    default:
      return 'Neznámý stav';
  }
}

/**
 * Get status color class for UI
 */
export function getStatusColor(status: SubmissionStatus): string {
  switch (status) {
    case 'not_started':
      return 'text-slate-500 bg-slate-100';
    case 'writing':
      return 'text-blue-600 bg-blue-100';
    case 'submitted':
      return 'text-amber-600 bg-amber-100';
    case 'graded':
      return 'text-green-600 bg-green-100';
    default:
      return 'text-slate-500 bg-slate-100';
  }
}











