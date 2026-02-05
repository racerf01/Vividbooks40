/**
 * Analytics Hook - Complete tracking for Vividbooks platform
 * Tracks all user interactions and syncs with Supabase
 */

import { useCallback, useRef, useEffect, useState } from 'react';
import { supabase } from '../utils/supabase/client';
import { storage } from '../utils/profile-storage';

// ============================================
// TYPES
// ============================================

export type EventCategory = 
  | 'navigation'
  | 'document'
  | 'worksheet'
  | 'vividboard'
  | 'ai'
  | 'class'
  | 'student'
  | 'sharing'
  | 'cs_dashboard'
  | 'session';

export interface AnalyticsEvent {
  event_name: string;
  category: EventCategory;
  properties?: Record<string, unknown>;
  user_id?: string;
  school_id?: string;
  timestamp?: string;
}

export interface UserStats {
  total_time_minutes: number;
  documents_opened: number;
  worksheets_opened: number;
  vividboards_opened: number;
  custom_documents_created: number;
  edited_documents: number;
  custom_worksheets_created: number;
  edited_worksheets: number;
  custom_vividboards_created: number;
  edited_vividboards: number;
  ai_teach_me_sessions: number;
  ai_creation_percentage: number;
  connect_students_sessions: number;
  share_links_created: number;
  files_uploaded: number;
  storage_used_mb: number;
  classes_count: number;
  tests_assigned_monthly: number;
  ai_tokens_used: number;
  ai_cost_cents: number;
}

export interface StudentStats {
  student_id: string;
  time_spent_minutes: number;
  documents_viewed: number;
  worksheets_completed: number;
  tests_completed: number;
  last_active: string;
}

// ============================================
// EVENT QUEUE FOR BATCHING - OPTIMIZED FOR DISK IO
// ============================================

const eventQueue: AnalyticsEvent[] = [];
let flushTimeout: NodeJS.Timeout | null = null;

// DISK IO OPTIMIZATION: Zvýšený interval a velikost batch
const FLUSH_INTERVAL = 30000; // Flush every 30 seconds (was 5s)
const MAX_QUEUE_SIZE = 50; // Or when queue reaches 50 events (was 20)

// Sampling - některé události trackujeme jen občas
const SAMPLING_RATES: Record<string, number> = {
  'page_viewed': 1.0,        // 100% - důležité
  'document_opened': 1.0,    // 100% - důležité  
  'session_started': 1.0,    // 100% - důležité
  'session_ended': 1.0,      // 100% - důležité
  'ai_generation_completed': 1.0, // 100% - sledujeme náklady
  'document_time_spent': 0.2, // 20% sampling - high volume
  'student_time_spent': 0.2,  // 20% sampling - high volume
  'filter_applied': 0.1,      // 10% sampling - very high volume
};

// Check if event should be tracked based on sampling
const shouldTrackEvent = (eventName: string): boolean => {
  const rate = SAMPLING_RATES[eventName] ?? 1.0; // Default: track all
  return Math.random() < rate;
};

// ============================================
// HELPER FUNCTIONS
// ============================================

const generateSessionId = (): string => {
  const stored = sessionStorage.getItem('vb_session_id');
  if (stored) return stored;
  
  const newId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  sessionStorage.setItem('vb_session_id', newId);
  return newId;
};

const getDeviceInfo = () => ({
  userAgent: navigator.userAgent,
  language: navigator.language,
  screenWidth: window.screen.width,
  screenHeight: window.screen.height,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
});

// ============================================
// FLUSH EVENTS TO SUPABASE
// ============================================

// Helper to check if a string is a valid UUID
const isValidUUID = (str: string | undefined | null): boolean => {
  if (!str) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

const flushEvents = async () => {
  if (eventQueue.length === 0) return;
  
  const eventsToSend = [...eventQueue];
  eventQueue.length = 0; // Clear queue
  
  try {
    const rows = eventsToSend.map(event => ({
      // Support both column names (event_type and event_name) depending on schema
      event_type: event.event_name,
      event_name: event.event_name,
      event_data: {
        category: event.category,
        // Store school_id in event_data if it's not a valid UUID
        school_id_text: !isValidUUID(event.school_id) ? event.school_id : undefined,
        ...event.properties,
      },
      user_id: isValidUUID(event.user_id) ? event.user_id : null,
      // Only send school_id if it's a valid UUID
      school_id: isValidUUID(event.school_id) ? event.school_id : null,
      created_at: event.timestamp || new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('user_events')
      .insert(rows);

    if (error) {
      console.warn('[Analytics] Failed to send events to Supabase:', error);
      // Re-add failed events to queue
      eventQueue.push(...eventsToSend);
    } else if (import.meta.env.DEV) {
      console.log(`[Analytics] Flushed ${rows.length} events to Supabase`);
    }
  } catch (err) {
    console.warn('[Analytics] Error flushing events:', err);
    // Re-add failed events to queue
    eventQueue.push(...eventsToSend);
  }
};

// ============================================
// MAIN HOOK
// ============================================

export function useAnalytics(providedUserId?: string, providedSchoolId?: string) {
  const sessionId = useRef(generateSessionId());
  const sessionStartTime = useRef(Date.now());
  const pageStartTime = useRef(Date.now());
  
  // Auto-detect userId and schoolId from profile and auth
  const [autoUserId, setAutoUserId] = useState<string | undefined>(providedUserId);
  const [autoSchoolId, setAutoSchoolId] = useState<string | undefined>(providedSchoolId);
  
  // Effect to get user info from Supabase auth and profile
  useEffect(() => {
    const getUserInfo = async () => {
      // First try to get from local profile (most reliable)
      const profile = storage.getCurrentUserProfile();
      if (profile?.userId && !providedUserId) {
        setAutoUserId(profile.userId);
      }
      if (profile?.schoolId && !providedSchoolId) {
        setAutoSchoolId(profile.schoolId);
      }
      
      // If no profile userId, try Supabase auth
      if (!profile?.userId && !providedUserId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          setAutoUserId(user.id);
        }
      }
    };
    
    getUserInfo();
  }, [providedUserId, providedSchoolId]);
  
  // Use provided values or auto-detected values
  const userId = providedUserId || autoUserId;
  const schoolId = providedSchoolId || autoSchoolId;

  // Schedule flush
  const scheduleFlush = useCallback(() => {
    if (flushTimeout) clearTimeout(flushTimeout);
    
    if (eventQueue.length >= MAX_QUEUE_SIZE) {
      flushEvents();
    } else {
      flushTimeout = setTimeout(flushEvents, FLUSH_INTERVAL);
    }
  }, []);

  // Core tracking function with sampling support
  const trackEvent = useCallback((
    eventName: string,
    category: EventCategory,
    properties?: Record<string, unknown>
  ) => {
    // DISK IO OPTIMIZATION: Check sampling rate
    if (!shouldTrackEvent(eventName)) {
      if (import.meta.env.DEV) {
        console.log('[Analytics] Sampled out:', eventName);
      }
      return;
    }

    const event: AnalyticsEvent = {
      event_name: eventName,
      category,
      properties: {
        ...properties,
        session_id: sessionId.current,
        // DISK IO OPTIMIZATION: Neposílat device info u každé události
        // Device info posíláme jen u session_started
      },
      user_id: userId,
      school_id: schoolId,
      timestamp: new Date().toISOString(),
    };

    // Add to queue
    eventQueue.push(event);
    
    // Log in dev (but not too verbose)
    if (import.meta.env.DEV && eventQueue.length <= 3) {
      console.log('[Analytics]', eventName, { userId, schoolId });
    }

    scheduleFlush();
  }, [userId, schoolId, scheduleFlush]);

  // ==========================================
  // SESSION TRACKING
  // ==========================================

  const trackSessionStart = useCallback(() => {
    trackEvent('session_started', 'session', {
      device: getDeviceInfo(),
      referrer: document.referrer,
      url: window.location.href,
    });
  }, [trackEvent]);

  const trackSessionEnd = useCallback(() => {
    const duration = Math.round((Date.now() - sessionStartTime.current) / 1000 / 60);
    trackEvent('session_ended', 'session', {
      duration_minutes: duration,
    });
    flushEvents(); // Immediate flush on session end
  }, [trackEvent]);

  // ==========================================
  // NAVIGATION TRACKING
  // ==========================================

  const trackPageView = useCallback((pageName: string, properties?: Record<string, unknown>) => {
    const timeOnPreviousPage = Math.round((Date.now() - pageStartTime.current) / 1000);
    pageStartTime.current = Date.now();
    
    trackEvent('page_viewed', 'navigation', {
      page_name: pageName,
      time_on_previous_page_seconds: timeOnPreviousPage,
      ...properties,
    });
  }, [trackEvent]);

  // ==========================================
  // SUBJECT ACCESS TRACKING
  // ==========================================

  const trackSubjectAccessed = useCallback((
    subjectId: string,
    subjectLabel: string,
    context: 'navigation' | 'ai_panel' | 'link_picker' | 'worksheet_ai',
    grade?: number
  ) => {
    trackEvent('subject_accessed', 'navigation', {
      subject_id: subjectId,
      subject_label: subjectLabel,
      access_context: context,
      grade,
    });
  }, [trackEvent]);

  // ==========================================
  // DOCUMENT TRACKING
  // ==========================================

  const trackDocumentOpened = useCallback((
    docId: string,
    docType: 'vividbooks' | 'custom' | 'edited',
    subject?: string
  ) => {
    trackEvent('document_opened', 'document', {
      document_id: docId,
      document_type: docType,
      subject,
    });
  }, [trackEvent]);

  const trackDocumentTimeSpent = useCallback((
    docId: string,
    minutes: number,
    scrollDepth?: number
  ) => {
    trackEvent('document_time_spent', 'document', {
      document_id: docId,
      time_spent_minutes: minutes,
      scroll_depth_percent: scrollDepth,
    });
  }, [trackEvent]);

  const trackDocumentCreated = useCallback((
    docType: 'custom' | 'edited',
    subject?: string,
    aiAssisted?: boolean
  ) => {
    trackEvent('document_created', 'document', {
      document_type: docType,
      subject,
      ai_assisted: aiAssisted,
    });
  }, [trackEvent]);

  // ==========================================
  // WORKSHEET TRACKING
  // ==========================================

  const trackWorksheetOpened = useCallback((worksheetId: string, subject?: string) => {
    trackEvent('worksheet_opened', 'worksheet', {
      worksheet_id: worksheetId,
      subject,
    });
  }, [trackEvent]);

  const trackWorksheetCreated = useCallback((
    isCustom: boolean,
    subject?: string,
    aiAssisted?: boolean
  ) => {
    trackEvent('worksheet_created', 'worksheet', {
      is_custom: isCustom,
      subject,
      ai_assisted: aiAssisted,
    });
  }, [trackEvent]);

  const trackWorksheetCompleted = useCallback((
    worksheetId: string,
    score?: number,
    timeSpentMinutes?: number
  ) => {
    trackEvent('worksheet_completed', 'worksheet', {
      worksheet_id: worksheetId,
      score,
      time_spent_minutes: timeSpentMinutes,
    });
  }, [trackEvent]);

  // ==========================================
  // VIVIDBOARD TRACKING
  // ==========================================

  const trackVividboardOpened = useCallback((boardId: string, subject?: string) => {
    trackEvent('vividboard_opened', 'vividboard', {
      board_id: boardId,
      subject,
    });
  }, [trackEvent]);

  const trackVividboardCreated = useCallback((
    isCustom: boolean,
    subject?: string,
    slideCount?: number
  ) => {
    trackEvent('vividboard_created', 'vividboard', {
      is_custom: isCustom,
      subject,
      slide_count: slideCount,
    });
  }, [trackEvent]);

  // ==========================================
  // AI FEATURE TRACKING
  // ==========================================

  const trackAITeachMeUsed = useCallback((
    subject?: string,
    questionType?: string,
    tokensUsed?: number
  ) => {
    trackEvent('ai_teach_me_used', 'ai', {
      subject,
      question_type: questionType,
      tokens_used: tokensUsed,
    });
  }, [trackEvent]);

  const trackAIGeneration = useCallback((
    generationType: 'document' | 'worksheet' | 'question' | 'email' | 'alert',
    tokensUsed: number,
    costCents: number,
    durationMs?: number
  ) => {
    trackEvent('ai_generation_completed', 'ai', {
      generation_type: generationType,
      tokens_used: tokensUsed,
      cost_cents: costCents,
      duration_ms: durationMs,
    });
  }, [trackEvent]);

  // ==========================================
  // CLASS & STUDENT TRACKING
  // ==========================================

  const trackClassCreated = useCallback((className: string, studentCount: number) => {
    trackEvent('class_created', 'class', {
      class_name: className,
      student_count: studentCount,
    });
  }, [trackEvent]);

  const trackConnectStudentsSession = useCallback((
    classId: string,
    studentCount: number,
    durationMinutes?: number
  ) => {
    trackEvent('connect_students_session', 'class', {
      class_id: classId,
      student_count: studentCount,
      duration_minutes: durationMinutes,
    });
  }, [trackEvent]);

  const trackTestAssigned = useCallback((
    testId: string,
    classId: string,
    studentCount: number
  ) => {
    trackEvent('test_assigned', 'class', {
      test_id: testId,
      class_id: classId,
      student_count: studentCount,
    });
  }, [trackEvent]);

  // Student-specific tracking
  const trackStudentActivity = useCallback((
    studentId: string,
    activityType: 'document_viewed' | 'worksheet_started' | 'worksheet_completed' | 'test_started' | 'test_completed',
    properties?: Record<string, unknown>
  ) => {
    trackEvent(`student_${activityType}`, 'student', {
      student_id: studentId,
      ...properties,
    });
  }, [trackEvent]);

  const trackStudentTimeSpent = useCallback((
    studentId: string,
    minutes: number,
    contentType?: string,
    contentId?: string
  ) => {
    trackEvent('student_time_spent', 'student', {
      student_id: studentId,
      time_spent_minutes: minutes,
      content_type: contentType,
      content_id: contentId,
    });
  }, [trackEvent]);

  // ==========================================
  // SHARING TRACKING
  // ==========================================

  const trackShareLinkCreated = useCallback((
    contentType: 'document' | 'worksheet' | 'vividboard' | 'class',
    contentId: string
  ) => {
    trackEvent('share_link_created', 'sharing', {
      content_type: contentType,
      content_id: contentId,
    });
  }, [trackEvent]);

  const trackQRCodeGenerated = useCallback((contentType: string, contentId: string) => {
    trackEvent('qr_code_generated', 'sharing', {
      content_type: contentType,
      content_id: contentId,
    });
  }, [trackEvent]);

  const trackFileUploaded = useCallback((
    fileType: string,
    fileSizeMb: number
  ) => {
    trackEvent('file_uploaded', 'sharing', {
      file_type: fileType,
      file_size_mb: fileSizeMb,
    });
  }, [trackEvent]);

  // ==========================================
  // CS DASHBOARD TRACKING
  // ==========================================

  const trackCSViewChanged = useCallback((
    viewName: 'prehled' | 'skoly' | 'ucitele' | 'upozorneni'
  ) => {
    trackEvent('cs_view_changed', 'cs_dashboard', {
      view_name: viewName,
    });
  }, [trackEvent]);

  const trackSchoolSelected = useCallback((
    schoolId: string,
    schoolName: string,
    healthScore: number
  ) => {
    trackEvent('school_selected', 'cs_dashboard', {
      selected_school_id: schoolId,
      school_name: schoolName,
      health_score: healthScore,
    });
  }, [trackEvent]);

  const trackAlertViewed = useCallback((
    alertId: string,
    alertType: string,
    severity: string
  ) => {
    trackEvent('alert_viewed', 'cs_dashboard', {
      alert_id: alertId,
      alert_type: alertType,
      severity,
    });
  }, [trackEvent]);

  const trackAlertResolved = useCallback((
    alertId: string,
    alertType: string,
    resolutionTimeMinutes?: number
  ) => {
    trackEvent('alert_resolved', 'cs_dashboard', {
      alert_id: alertId,
      alert_type: alertType,
      resolution_time_minutes: resolutionTimeMinutes,
    });
  }, [trackEvent]);

  const trackAIAlertsGenerated = useCallback((
    count: number,
    schoolsAnalyzed: number,
    tokensUsed?: number
  ) => {
    trackEvent('ai_alerts_generated', 'cs_dashboard', {
      alerts_count: count,
      schools_analyzed: schoolsAnalyzed,
      tokens_used: tokensUsed,
    });
  }, [trackEvent]);

  const trackAIEmailGenerated = useCallback((
    alertId: string,
    tone: string,
    schoolId: string
  ) => {
    trackEvent('ai_email_generated', 'cs_dashboard', {
      alert_id: alertId,
      tone,
      school_id: schoolId,
    });
  }, [trackEvent]);

  const trackTeacherSelected = useCallback((
    teacherId: string,
    teacherName: string,
    schoolId: string
  ) => {
    trackEvent('teacher_selected', 'cs_dashboard', {
      teacher_id: teacherId,
      teacher_name: teacherName,
      school_id: schoolId,
    });
  }, [trackEvent]);

  const trackFilterApplied = useCallback((
    filterType: string,
    filterValue: unknown
  ) => {
    trackEvent('filter_applied', 'cs_dashboard', {
      filter_type: filterType,
      filter_value: filterValue,
    });
  }, [trackEvent]);

  // ==========================================
  // LIFECYCLE
  // ==========================================

  // Track if session was already started (prevent duplicates)
  const sessionTrackedRef = useRef(false);

  useEffect(() => {
    // Only track session start ONCE per browser session
    const sessionKey = `vb_session_tracked_${sessionId.current}`;
    if (!sessionTrackedRef.current && !sessionStorage.getItem(sessionKey)) {
      sessionTrackedRef.current = true;
      sessionStorage.setItem(sessionKey, 'true');
      trackSessionStart();
    }

    // Flush on page unload
    const handleBeforeUnload = () => {
      trackSessionEnd();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (flushTimeout) clearTimeout(flushTimeout);
      flushEvents(); // Final flush
    };
  }, [trackSessionStart, trackSessionEnd]);

  // ==========================================
  // RETURN ALL TRACKING FUNCTIONS
  // ==========================================

  return {
    // Core
    trackEvent,
    
    // Session
    trackSessionStart,
    trackSessionEnd,
    
    // Navigation
    trackPageView,
    trackSubjectAccessed,
    
    // Documents
    trackDocumentOpened,
    trackDocumentTimeSpent,
    trackDocumentCreated,
    
    // Worksheets
    trackWorksheetOpened,
    trackWorksheetCreated,
    trackWorksheetCompleted,
    
    // Vividboards
    trackVividboardOpened,
    trackVividboardCreated,
    
    // AI
    trackAITeachMeUsed,
    trackAIGeneration,
    
    // Classes & Students
    trackClassCreated,
    trackConnectStudentsSession,
    trackTestAssigned,
    trackStudentActivity,
    trackStudentTimeSpent,
    
    // Sharing
    trackShareLinkCreated,
    trackQRCodeGenerated,
    trackFileUploaded,
    
    // CS Dashboard
    trackCSViewChanged,
    trackSchoolSelected,
    trackAlertViewed,
    trackAlertResolved,
    trackAIAlertsGenerated,
    trackAIEmailGenerated,
    trackTeacherSelected,
    trackFilterApplied,
    
    // Utils
    flushEvents,
    sessionId: sessionId.current,
  };
}

export default useAnalytics;
