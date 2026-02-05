/**
 * Document Comments Types
 * 
 * Types for inline commenting system (Google Docs style)
 * Used for teacher feedback on student assignments
 */

export interface DocumentComment {
  id: string;
  // Position in document
  startOffset: number;
  endOffset: number;
  highlightedText: string;
  // Comment content
  content: string;
  // Metadata
  authorId: string;
  authorName: string;
  authorRole: 'teacher' | 'student';
  createdAt: string;
  updatedAt?: string;
  // Status
  resolved?: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface DocumentCommentThread {
  id: string;
  comments: DocumentComment[];
  // The main/original comment
  mainComment: DocumentComment;
  // Position data for rendering
  position: {
    top: number;
    paragraphIndex: number;
  };
}

export interface SubmissionGrading {
  score: number; // 0-100 percentage
  maxScore: number; // Usually 100
  finalComment?: string;
  gradedAt: string;
  gradedBy: string;
  gradedByName: string;
}

