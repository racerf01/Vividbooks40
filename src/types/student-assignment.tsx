/**
 * Student Assignment Types
 * 
 * Types for the student assignment system where teachers can assign
 * document, presentation, or test tasks to students.
 */

// =============================================
// ASSIGNMENT TYPES
// =============================================

/**
 * Type of work the student needs to create
 */
export type StudentAssignmentType = 'document' | 'presentation' | 'test';

/**
 * Status of a student's submission
 */
export type SubmissionStatus = 'not_started' | 'draft' | 'submitted' | 'graded';

/**
 * AI detection flag
 */
export interface AIDetectionFlag {
  id: string;
  timestamp: string;
  type: 'paste' | 'generation' | 'pattern';
  confidence: number; // 0-1
  textSnippet: string; // First 100 chars of flagged text
  details?: string;
}

/**
 * Assignment created by teacher for students
 */
export interface StudentAssignment {
  id: string;
  class_id: string;
  title: string;
  description: string; // Task instructions
  type: StudentAssignmentType;
  allow_ai: boolean;
  due_date?: string;
  created_by: string; // Teacher ID
  created_at: string;
  updated_at?: string;
  // Optional settings
  max_points?: number;
  subject?: string;
}

/**
 * Student's submission/work on an assignment
 */
export interface StudentSubmission {
  id: string;
  student_id: string;
  assignment_id: string;
  // Reference to the created content
  content_type: 'document' | 'board' | 'worksheet';
  content_id: string; // ID in localStorage (worksheet/board/document)
  // Status
  status: SubmissionStatus;
  started_at: string;
  submitted_at?: string;
  // AI detection
  ai_flags: AIDetectionFlag[];
  ai_warning_shown: boolean;
  // Grading
  score?: number;
  max_score?: number;
  teacher_comment?: string;
  graded_at?: string;
  graded_by?: string;
}

/**
 * Assignment with class info for display
 */
export interface StudentAssignmentWithClass extends StudentAssignment {
  class_name?: string;
  teacher_name?: string;
  submission?: StudentSubmission;
}

// =============================================
// CONSTANTS
// =============================================

export const ASSIGNMENT_TYPE_LABELS: Record<StudentAssignmentType, string> = {
  document: 'Dokument',
  presentation: 'Prezentace',
  test: 'Test',
};

export const ASSIGNMENT_TYPE_ICONS: Record<StudentAssignmentType, string> = {
  document: 'FileText',
  presentation: 'Presentation',
  test: 'ClipboardCheck',
};

export const SUBMISSION_STATUS_LABELS: Record<SubmissionStatus, string> = {
  not_started: 'Nezahájeno',
  draft: 'Rozpracováno',
  submitted: 'Odevzdáno',
  graded: 'Ohodnoceno',
};

export const SUBMISSION_STATUS_COLORS: Record<SubmissionStatus, { bg: string; text: string }> = {
  not_started: { bg: '#F3F4F6', text: '#6B7280' },
  draft: { bg: '#FEF3C7', text: '#92400E' },
  submitted: { bg: '#DBEAFE', text: '#1E40AF' },
  graded: { bg: '#D1FAE5', text: '#065F46' },
};


