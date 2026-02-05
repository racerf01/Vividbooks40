// =============================================
// CLASSROOM SHARING TYPES
// =============================================

export interface ConnectedStudent {
  id: string;
  name: string;
  isActive: boolean;          // Currently viewing the shared content
  lastSeen: number;           // Timestamp of last activity
  joinedAt: number;           // Timestamp when joined
}

export interface ClassroomShareSession {
  id: string;
  classId: string;
  className: string;
  teacherId: string;
  teacherName: string;
  
  // Current state
  isActive: boolean;
  startedAt: string;
  lastHeartbeat?: number;         // Timestamp of last teacher heartbeat
  
  // What's being shared
  documentPath: string;           // URL path of the document
  documentTitle: string;
  scrollPosition: number;         // Scroll Y position
  currentSection?: string;        // Current section/chapter ID
  
  // Connected students
  connectedStudents: ConnectedStudent[];    // Array of connected students with details
}

export interface ClassroomShareState {
  // For teachers
  isSharing: boolean;
  currentSession: ClassroomShareSession | null;
  
  // For students  
  isLocked: boolean;
  activeSession: ClassroomShareSession | null;
}

export interface ShareInClassPayload {
  classId: string;
  className: string;
  documentPath: string;
  documentTitle: string;
}

// Mock classes for demo
export const MOCK_CLASSES = [
  { id: 'class-6a', name: '6.A', studentCount: 24 },
  { id: 'class-6b', name: '6.B', studentCount: 22 },
  { id: 'class-7a', name: '7.A', studentCount: 26 },
  { id: 'class-7b', name: '7.B', studentCount: 23 },
];

