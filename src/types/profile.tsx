// =============================================
// PROFILE & LICENSE SYSTEM TYPES
// =============================================

// =============================================
// USER ROLES
// =============================================

/**
 * User role in the system
 */
export type UserRole = 'teacher' | 'student' | 'admin';

// =============================================
// SUBJECT TYPES
// =============================================

/**
 * Available subjects in the system
 */
export type Subject = 
  | 'fyzika'
  | 'chemie'
  | 'prirodopis'
  | 'matematika-1'
  | 'matematika-2'
  | 'prvouka'
  | 'zemepis'
  | 'dejepis';

/**
 * Feature tier levels for licenses
 * 
 * Hierarchy (each tier includes all features of lower tiers):
 * 1. vividbooks-sesity   - Základní digitální přístup (pracovní sešity)
 * 2. vividbooks-knihovna - Rozšířený digitální přístup (složky + celá knihovna)
 * 3. vividbooks-tvurce   - Tvorba a sdílení (boardy, dokumenty, pracovní listy, výsledky boardů)
 * 4. vividbooks-tridni   - Management třídy (Moje třídy, studenti, hodnocení)
 * 
 * Legacy mapping:
 * - 'workbooks' → 'vividbooks-sesity'
 * - 'digital-library' → 'vividbooks-knihovna'
 */
export type FeatureTier = 
  | 'vividbooks-sesity'    // Základní - pracovní sešity
  | 'vividbooks-knihovna'  // Rozšířený - celá knihovna
  | 'vividbooks-tvurce'    // Tvorba - boardy, dokumenty, pracovní listy
  | 'vividbooks-tridni'    // Třídní - management tříd
  // Legacy tiers (for backward compatibility)
  | 'workbooks'            // → maps to vividbooks-sesity
  | 'digital-library';     // → maps to vividbooks-knihovna

/**
 * Normalize legacy tier to new tier
 */
export function normalizeTier(tier: FeatureTier | string | undefined): FeatureTier {
  if (!tier) return 'vividbooks-knihovna'; // Default to full library access
  
  switch (tier) {
    case 'workbooks': return 'vividbooks-sesity';
    case 'digital-library': return 'vividbooks-knihovna';
    default: return tier as FeatureTier;
  }
}

/**
 * Check if a tier has access to a specific feature level
 */
export function tierHasAccess(userTier: FeatureTier, requiredTier: FeatureTier): boolean {
  const tierOrder: FeatureTier[] = [
    'vividbooks-sesity',
    'vividbooks-knihovna', 
    'vividbooks-tvurce',
    'vividbooks-tridni'
  ];
  
  const userLevel = tierOrder.indexOf(normalizeTier(userTier));
  const requiredLevel = tierOrder.indexOf(normalizeTier(requiredTier));
  
  return userLevel >= requiredLevel;
}

// =============================================
// SCHOOL & USER TYPES
// =============================================

/**
 * School entity
 */
export interface School {
  id: string;
  code: string;
  name: string;
  address: string;
  city: string;
  createdAt: string;
}

/**
 * User profile
 */
export interface UserProfile {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: 'teacher' | 'admin' | 'student';
  schoolId?: string;
  avatarUrl?: string;
  createdAt: string;
  lastActiveAt?: string;
}

/**
 * Colleague in the same school
 */
export interface Colleague {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  lastActiveAt?: string;
  usageStats?: {
    totalSessions: number;
    lastWeekSessions: number;
  };
}

// =============================================
// STUDENT-SPECIFIC TYPES
// =============================================

/**
 * Student profile with class information and stats
 */
export interface StudentProfile {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: 'student';
  schoolId: string;
  classId: string;
  className: string;
  grade: number;
  avatarUrl?: string;
  createdAt: string;
  lastActiveAt?: string;
  stats: {
    completedLessons: number;
    totalLessons: number;
    averageScore: number;
    lastActivity: string;
    streakDays: number;
  };
}

/**
 * Assignment given to a student
 */
export interface StudentAssignment {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  assignedAt: string;
  assignedBy: string;
  subjectId: string;
  subjectName: string;
  type: 'lesson' | 'worksheet' | 'material' | 'test';
  completed: boolean;
  completedAt?: string;
}

/**
 * Test result for a student
 */
export interface StudentTestResult {
  id: string;
  testName: string;
  subjectName: string;
  score: number;
  maxScore: number;
  percentage: number;
  completedAt: string;
  teacherComment?: string;
  grade?: string;
}

/**
 * Teacher evaluation/feedback for a student
 */
export interface TeacherEvaluation {
  id: string;
  date: string;
  teacherName: string;
  subjectName: string;
  type: 'praise' | 'note' | 'warning';
  message: string;
}

/**
 * Student activity record
 */
export interface StudentActivity {
  id: string;
  type: 'lesson_completed' | 'test_completed' | 'material_viewed' | 'assignment_submitted' | 'exercise_completed';
  title: string;
  subjectName: string;
  timestamp: string;
  details?: string;
}

// =============================================
// LICENSE TYPES
// =============================================

/**
 * Feature license (for specific features like vividboard, ecosystem)
 */
export interface FeatureLicense {
  active: boolean;
  validFrom: string;
  validUntil: string;
}

/**
 * License for a specific subject
 */
export interface SubjectLicense {
  id: string;
  subject: Subject;
  tier: FeatureTier;
  validFrom: string;
  validUntil: string;
  isFree?: boolean;
  workbookCount?: number;
}

/**
 * School-wide license containing all subject licenses
 */
export interface SchoolLicense {
  id: string;
  schoolId: string;
  subjects: SubjectLicense[];
  features: {
    vividboardWall?: boolean;
    ecosystemVividbooks?: boolean | FeatureLicense;
    vividboard?: boolean | FeatureLicense;
  };
  updatedAt: string;
}

// =============================================
// METADATA TYPES
// =============================================

/**
 * Subject metadata for display
 */
export interface SubjectMeta {
  id: Subject;
  label: string;
  icon: string;
  grade: 1 | 2; // 1. stupeň or 2. stupeň
}

/**
 * Feature tier metadata for display
 */
export interface FeatureTierMeta {
  id: FeatureTier;
  label: string;
  description: string;
}

// =============================================
// CONSTANTS
// =============================================

/**
 * All available subjects with metadata
 */
export const SUBJECTS: SubjectMeta[] = [
  // 2. stupeň
  { id: 'fyzika', label: 'Fyzika', icon: '⚡', grade: 2 },
  { id: 'chemie', label: 'Chemie', icon: '🧪', grade: 2 },
  { id: 'prirodopis', label: 'Přírodopis', icon: '🌿', grade: 2 },
  { id: 'matematika-2', label: 'Matematika', icon: '📐', grade: 2 },
  { id: 'zemepis', label: 'Zeměpis', icon: '🌍', grade: 2 },
  { id: 'dejepis', label: 'Dějepis', icon: '📜', grade: 2 },
  // 1. stupeň
  { id: 'matematika-1', label: 'Matematika', icon: '🔢', grade: 1 },
  { id: 'prvouka', label: 'Prvouka', icon: '🏠', grade: 1 },
];

/**
 * Feature tier options
 */
export const FEATURE_TIERS: FeatureTierMeta[] = [
  { 
    id: 'vividbooks-sesity', 
    label: 'Vividbooks Sešity', 
    description: 'Základní digitální přístup – pracovní sešity' 
  },
  { 
    id: 'vividbooks-knihovna', 
    label: 'Vividbooks Knihovna', 
    description: 'Rozšířený digitální přístup – celá knihovna včetně složek' 
  },
  { 
    id: 'vividbooks-tvurce', 
    label: 'Vividbooks Tvůrce', 
    description: 'Tvorba a sdílení vlastních materiálů (boardy, dokumenty, pracovní listy)' 
  },
  { 
    id: 'vividbooks-tridni', 
    label: 'Vividbooks Třídní', 
    description: 'Management třídy – Moje třídy, studenti, hodnocení' 
  },
  // Legacy tiers (for backward compatibility in admin UI)
  { 
    id: 'workbooks', 
    label: 'Pracovní sešity (legacy)', 
    description: 'Přístup k pracovním sešitům' 
  },
  { 
    id: 'digital-library', 
    label: 'Digitální knihovna (legacy)', 
    description: 'Plný přístup k digitální knihovně včetně složek' 
  },
];

// =============================================
// HELPER FUNCTIONS
// =============================================

/**
 * Check if a subject license is currently active
 */
export function isLicenseActive(license: SubjectLicense): boolean {
  const now = new Date();
  const validFrom = new Date(license.validFrom);
  const validUntil = new Date(license.validUntil);
  return now >= validFrom && now <= validUntil;
}

/**
 * Check if a feature license is currently active
 */
export function isFeatureLicenseActive(license: FeatureLicense | boolean | undefined): boolean {
  if (license === undefined) return false;
  if (typeof license === 'boolean') return license;
  
  const now = new Date();
  const validFrom = new Date(license.validFrom);
  const validUntil = new Date(license.validUntil);
  return license.active && now >= validFrom && now <= validUntil;
}

/**
 * Format a license date for display
 */
export function formatLicenseDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Get subject metadata by ID
 */
export function getSubjectMeta(id: Subject): SubjectMeta | undefined {
  return SUBJECTS.find(s => s.id === id);
}

/**
 * Get tier metadata by ID
 */
export function getTierMeta(id: FeatureTier): FeatureTierMeta | undefined {
  return FEATURE_TIERS.find(t => t.id === id);
}

// =============================================
// PRACTICE / GAMIFICATION TYPES
// =============================================

/**
 * Exercise status in the practice system
 */
export type ExerciseStatus = 'mastered' | 'completed' | 'in_progress' | 'available' | 'locked';

/**
 * Single exercise in a topic
 */
export interface Exercise {
  id: string;
  title: string;
  difficulty: 1 | 2 | 3;
  xpReward: number;
  status: ExerciseStatus;
  bestScore?: number;
  attempts: number;
  lastAttemptAt?: string;
}

/**
 * Alias for Exercise (used in some components)
 */
export type PracticeExercise = Exercise;

/**
 * Topic containing exercises
 */
export interface PracticeTopic {
  id: string;
  title: string;
  totalXp: number;
  earnedXp: number;
  progress: number;
  exercises: Exercise[];
}

/**
 * Chapter containing topics
 */
export interface PracticeChapter {
  id: string;
  title: string;
  isExpanded: boolean;
  topics: PracticeTopic[];
}

/**
 * Practice subject with all chapters and progress
 */
export interface PracticeSubject {
  id: string;
  subject: Subject;
  subjectName: string;
  grade: number;
  totalXp: number;
  earnedXp: number;
  chapters: PracticeChapter[];
}

/**
 * Player's overall progress
 */
export interface PlayerProgress {
  totalXp: number;
  weeklyXp: number;
  currentLevel: number;
  currentStreak: number;
  longestStreak: number;
  lastPracticeDate: string;
  exercisesCompleted: number;
  perfectScores: number;
  achievements: string[];
  subjectProgress: Record<string, number>;
}

/**
 * Leaderboard entry
 */
export interface LeaderboardEntry {
  rank: number;
  name: string;
  xp: number;
  level: number;
  streak: number;
  avatarUrl?: string;
  isCurrentUser?: boolean;
}

/**
 * Achievement definition
 */
export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  xpReward?: number;
}

/**
 * All available achievements
 */
export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-exercise', title: 'První krok', description: 'Dokončil jsi své první cvičení', icon: '🎯', xpReward: 10 },
  { id: 'streak-3', title: 'Na vlně', description: '3 dny v řadě', icon: '🔥', xpReward: 25 },
  { id: 'streak-7', title: 'Týdenní šampion', description: '7 dní v řadě', icon: '🏆', xpReward: 50 },
  { id: 'streak-14', title: 'Vytrvalec', description: '14 dní v řadě', icon: '💪', xpReward: 100 },
  { id: 'streak-30', title: 'Měsíční legenda', description: '30 dní v řadě', icon: '👑', xpReward: 200 },
  { id: 'xp-100', title: 'Začátečník', description: 'Získal jsi 100 XP', icon: '⭐', xpReward: 10 },
  { id: 'xp-500', title: 'Pokročilý', description: 'Získal jsi 500 XP', icon: '🌟', xpReward: 25 },
  { id: 'xp-1000', title: 'Expert', description: 'Získal jsi 1000 XP', icon: '💫', xpReward: 50 },
  { id: 'xp-5000', title: 'Mistr', description: 'Získal jsi 5000 XP', icon: '🎖️', xpReward: 100 },
  { id: 'ex-10', title: 'Desetka', description: 'Dokončil jsi 10 cvičení', icon: '📚', xpReward: 25 },
  { id: 'ex-50', title: 'Padesátka', description: 'Dokončil jsi 50 cvičení', icon: '📖', xpReward: 50 },
  { id: 'ex-100', title: 'Stovka', description: 'Dokončil jsi 100 cvičení', icon: '🏅', xpReward: 100 },
  { id: 'perfect-5', title: 'Perfekcionista', description: '5 cvičení na 100%', icon: '💯', xpReward: 50 },
  { id: 'perfect-20', title: 'Bezchybný', description: '20 cvičení na 100%', icon: '🎯', xpReward: 100 },
];

// =============================================
// PLAYER LEVEL SYSTEM
// =============================================

/**
 * Player level definition
 */
export interface PlayerLevel {
  level: number;
  name: string;
  minXp: number;
  maxXp: number;
  icon: string;
}

/**
 * All player levels
 */
export const PLAYER_LEVELS: PlayerLevel[] = [
  { level: 1, name: 'Nováček', minXp: 0, maxXp: 100, icon: '🌱' },
  { level: 2, name: 'Učeň', minXp: 100, maxXp: 250, icon: '📚' },
  { level: 3, name: 'Student', minXp: 250, maxXp: 500, icon: '✏️' },
  { level: 4, name: 'Badatel', minXp: 500, maxXp: 1000, icon: '🔍' },
  { level: 5, name: 'Znalec', minXp: 1000, maxXp: 2000, icon: '🎓' },
  { level: 6, name: 'Expert', minXp: 2000, maxXp: 3500, icon: '⭐' },
  { level: 7, name: 'Mistr', minXp: 3500, maxXp: 5500, icon: '🏆' },
  { level: 8, name: 'Velmistr', minXp: 5500, maxXp: 8000, icon: '👑' },
  { level: 9, name: 'Génius', minXp: 8000, maxXp: 12000, icon: '🧠' },
  { level: 10, name: 'Legenda', minXp: 12000, maxXp: Infinity, icon: '🌟' },
];

/**
 * Get player level based on XP
 */
export function getPlayerLevel(xp: number): PlayerLevel {
  for (let i = PLAYER_LEVELS.length - 1; i >= 0; i--) {
    if (xp >= PLAYER_LEVELS[i].minXp) {
      return PLAYER_LEVELS[i];
    }
  }
  return PLAYER_LEVELS[0];
}

/**
 * Get XP progress to next level (0-100)
 */
export function getXpProgress(xp: number): number {
  const currentLevel = getPlayerLevel(xp);
  if (currentLevel.maxXp === Infinity) return 100;
  
  const levelXp = xp - currentLevel.minXp;
  const levelRange = currentLevel.maxXp - currentLevel.minXp;
  return Math.min(100, Math.round((levelXp / levelRange) * 100));
}
