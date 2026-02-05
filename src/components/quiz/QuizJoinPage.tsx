/**
 * Quiz Join Page
 * 
 * Robust student session management:
 * - Persistent student identity across sessions
 * - Auto-reconnect on page reload/return
 * - Works across devices (wifi/data)
 * - Results tied to student name
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import { ref, onValue, off, set, update, get } from 'firebase/database';
import { database } from '../../utils/firebase-config';
import {
  Play,
  RefreshCw,
  CheckCircle,
  XCircle,
  Pause,
  ChevronRight,
  Send,
  Users,
  ArrowLeft,
  ArrowRight,
  WifiOff,
  AlertCircle,
  Calculator,
  HelpCircle,
} from 'lucide-react';
import { MathInputModal, MathDisplay } from '../math/MathKeyboard';
import { MathText } from '../math/MathText';
import {
  Quiz,
  QuizSlide,
  ABCActivitySlide,
  OpenActivitySlide,
  BoardActivitySlide,
  VotingActivitySlide,
  SlideResponse,
  LiveQuizSession,
  InfoSlide,
  ConnectPairsActivitySlide,
  FillBlanksActivitySlide,
  ImageHotspotsActivitySlide,
  VideoQuizActivitySlide,
  ToolsSlide,
} from '../../types/quiz';
import { BlockLayoutView } from './QuizPreview';
import { BoardSlideView } from './slides/BoardSlideView';
import { VotingSlideView } from './slides/VotingSlideView';
import { ConnectPairsView } from './slides/ConnectPairsView';
import { FillBlanksView } from './slides/FillBlanksView';
import { ImageHotspotsView } from './slides/ImageHotspotsView';
import { VideoQuizView } from './slides/VideoQuizView';
import { FormView } from './slides/FormView';
import { CertificateView } from './slides/CertificateView';
import { useBoardPosts } from '../../hooks/useBoardPosts';
import { useVoting } from '../../hooks/useVoting';
import { checkMathAnswer } from '../../utils/math-compare';

// ============================================
// CONSTANTS
// ============================================

const QUIZ_SESSIONS_PATH = 'quiz_sessions';
const STUDENT_SESSION_KEY = 'vivid-student-session';
const STUDENT_IDENTITY_KEY = 'vivid-student-identity';

// ============================================
// TYPES
// ============================================

interface StudentData {
  name: string;
  schoolName?: string;
  joinedAt: string;
  currentSlide: number;
  responses: SlideResponse[];
  isOnline: boolean;
  isFocused?: boolean;
  lastSeen: string;
  deviceId: string;
  // Time tracking
  startTime?: string;
  totalTimeMs?: number;
}

interface SavedSession {
  sessionId: string;
  sessionCode: string;
  studentId: string;
  studentName: string;
  joinedAt: string;
}

interface StudentIdentity {
  id: string;
  name: string;
  createdAt: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

// Generate a unique device ID
function getDeviceId(): string {
  let deviceId = localStorage.getItem('vivid-device-id');
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('vivid-device-id', deviceId);
  }
  return deviceId;
}

// Get or create student identity
function getStudentIdentity(name?: string): StudentIdentity {
  const saved = localStorage.getItem(STUDENT_IDENTITY_KEY);
  if (saved) {
    const identity = JSON.parse(saved) as StudentIdentity;
    // Update name if provided and different
    if (name && name !== identity.name) {
      identity.name = name;
      localStorage.setItem(STUDENT_IDENTITY_KEY, JSON.stringify(identity));
    }
    return identity;
  }
  
  // Create new identity
  const newIdentity: StudentIdentity = {
    id: `student_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: name || '',
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(STUDENT_IDENTITY_KEY, JSON.stringify(newIdentity));
  return newIdentity;
}

// Save active session
function saveActiveSession(session: SavedSession): void {
  localStorage.setItem(STUDENT_SESSION_KEY, JSON.stringify(session));
}

// Get saved session
function getSavedSession(): SavedSession | null {
  const saved = localStorage.getItem(STUDENT_SESSION_KEY);
  return saved ? JSON.parse(saved) : null;
}

// Clear saved session
function clearSavedSession(): void {
  localStorage.removeItem(STUDENT_SESSION_KEY);
}

// Retry wrapper for Firebase operations
async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      console.warn(`Operation failed (attempt ${attempt + 1}/${maxRetries}):`, error);
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
      }
    }
  }
  
  throw lastError;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function QuizJoinPage() {
  const [searchParams] = useSearchParams();
  const { code: urlCode } = useParams<{ code?: string }>();
  const initialCode = urlCode || searchParams.get('code') || '';
  
  // Connection state
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  
  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mobileScrollRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Join state
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState('');
  const [school, setSchool] = useState('');
  const [error, setError] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [boardTitle, setBoardTitle] = useState<string | null>(null);
  const [isLookingUpBoard, setIsLookingUpBoard] = useState(false);
  
  // Session state
  const [isJoined, setIsJoined] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [session, setSession] = useState<LiveQuizSession | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  
  // Track scrolling for floating nav visibility (must be after isJoined is defined)
  useEffect(() => {
    if (!isJoined || !isMobile) return;
    
    // Wait a bit for ref to be set after render
    const timeout = setTimeout(() => {
      const scrollEl = mobileScrollRef.current;
      if (!scrollEl) return;
      
      const handleScroll = () => {
        setIsScrolling(true);
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }
        scrollTimeoutRef.current = setTimeout(() => {
          setIsScrolling(false);
        }, 2000);
      };
      
      scrollEl.addEventListener('scroll', handleScroll, { passive: true });
      
      // Cleanup stored for outer effect
      (scrollEl as any)._scrollHandler = handleScroll;
    }, 100);
    
    return () => {
      clearTimeout(timeout);
      const scrollEl = mobileScrollRef.current;
      if (scrollEl && (scrollEl as any)._scrollHandler) {
        scrollEl.removeEventListener('scroll', (scrollEl as any)._scrollHandler);
      }
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [isMobile, isJoined]);
  
  // Quiz progress
  const [responses, setResponses] = useState<SlideResponse[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [formAnswer, setFormAnswer] = useState<Record<string, string | string[]>>({});
  const [showResult, setShowResult] = useState(false);
  const [showMathKeyboard, setShowMathKeyboard] = useState(false);
  
  // Local slide index for unlocked mode
  const [localSlideIndex, setLocalSlideIndex] = useState(0);
  const [prevSlideIndex, setPrevSlideIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Time tracking
  const [sessionStartTime] = useState<number>(Date.now());
  const [slideStartTime, setSlideStartTime] = useState<number>(Date.now());
  
  // Wiggle animation for answer button
  const [showWiggle, setShowWiggle] = useState(false);
  const answerButtonRef = useRef<HTMLButtonElement | null>(null);
  
  // Refs for cleanup and state tracking
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);
  const sessionUnsubscribe = useRef<(() => void) | null>(null);
  const responsesRef = useRef<SlideResponse[]>(responses);
  
  // Keep ref in sync with state
  useEffect(() => {
    responsesRef.current = responses;
  }, [responses]);

  // ============================================
  // COMPUTED: ONLINE STUDENTS COUNT
  // ============================================
  
  const onlineStudentsCount = session?.students 
    ? Object.values(session.students).filter((s: any) => s.isOnline).length 
    : 0;

  // ============================================
  // NETWORK STATUS MONITORING
  // ============================================
  
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setConnectionError(null);
      // Trigger reconnect if we were in a session
      if (sessionId && studentId) {
        reconnectToSession();
      }
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setConnectionError('Ztráta připojení k internetu');
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [sessionId, studentId]);

  // ============================================
  // LIVE BOARD TITLE LOOKUP
  // ============================================
  
  useEffect(() => {
    // Only lookup when code is complete (6 chars)
    if (code.length !== 6) {
      setBoardTitle(null);
      return;
    }
    
    const lookupBoardTitle = async () => {
      setIsLookingUpBoard(true);
      try {
        // Try lookup table first
        const codeUpper = code.toUpperCase();
        const lookupRef = ref(database, `session_codes/${codeUpper}`);
        const lookupSnapshot = await get(lookupRef);
        
        if (lookupSnapshot.exists()) {
          const sessionId = lookupSnapshot.val() as string;
          const quizDataRef = ref(database, `${QUIZ_SESSIONS_PATH}/${sessionId}/quizData/title`);
          const titleSnapshot = await get(quizDataRef);
          if (titleSnapshot.exists()) {
            setBoardTitle(titleSnapshot.val() as string);
            setIsLookingUpBoard(false);
            return;
          }
        }
        
        // Fallback: search all sessions (slower)
        const sessionsRef = ref(database, QUIZ_SESSIONS_PATH);
        const snapshot = await get(sessionsRef);
        if (snapshot.exists()) {
          const sessions = snapshot.val();
          const entry = Object.entries(sessions).find(([id]) => 
            id.includes(`quiz_${codeUpper}_`)
          );
          if (entry) {
            const [, sessionData] = entry as [string, any];
            if (sessionData?.quizData?.title) {
              setBoardTitle(sessionData.quizData.title);
            }
          }
        }
      } catch (e) {
        console.log('Board title lookup failed:', e);
      } finally {
        setIsLookingUpBoard(false);
      }
    };
    
    lookupBoardTitle();
  }, [code]);

  // ============================================
  // AUTO-RECONNECT ON PAGE LOAD
  // ============================================
  
  useEffect(() => {
    const savedSession = getSavedSession();
    const identity = getStudentIdentity();
    
    // Pre-fill name from identity
    if (identity.name && !name) {
      setName(identity.name);
    }
    
    // If URL has a code, check if it matches the saved session
    if (initialCode && savedSession) {
      // Extract session code from saved session ID (format: quiz_XXXXXX_timestamp)
      const savedCodeMatch = savedSession.sessionId.match(/quiz_([A-Z0-9]+)_/);
      const savedCode = savedCodeMatch ? savedCodeMatch[1] : null;
      
      if (savedCode && savedCode.toUpperCase() !== initialCode.toUpperCase()) {
        // URL code is different from saved session - clear saved and use URL code
        console.log('URL code differs from saved session, clearing saved session');
        clearSavedSession();
        return; // Don't auto-reconnect, let user join with URL code
      }
    }
    
    // Try to reconnect to saved session (only if no URL code or URL matches saved)
    if (savedSession) {
      console.log('Found saved session, attempting reconnect:', savedSession);
      attemptReconnect(savedSession);
    }
  }, [initialCode]);

  // Attempt to reconnect to a saved session
  const attemptReconnect = async (savedSession: SavedSession) => {
    setIsReconnecting(true);
    setError('');
    
    try {
      // Check if session still exists and is active
      const sessionRef = ref(database, `${QUIZ_SESSIONS_PATH}/${savedSession.sessionId}`);
      const snapshot = await get(sessionRef);
      
      if (!snapshot.exists()) {
        console.log('Session no longer exists');
        clearSavedSession();
        setIsReconnecting(false);
        return;
      }
      
      const sessionData = snapshot.val() as LiveQuizSession;
      
      if (!sessionData.isActive) {
        console.log('Session has ended');
        // Show results if session ended
        setSession(sessionData);
        if (sessionData.quizData) {
          setQuiz(sessionData.quizData as Quiz);
        }
        // Restore student data
        const studentData = sessionData.students?.[savedSession.studentId];
        if (studentData) {
          setResponses(studentData.responses || []);
          setLocalSlideIndex(studentData.currentSlide || 0);
          setName(savedSession.studentName);
        }
        setSessionId(savedSession.sessionId);
        setStudentId(savedSession.studentId);
        setIsJoined(true);
        setIsReconnecting(false);
        return;
      }
      
      // Check if student record still exists
      const studentData = sessionData.students?.[savedSession.studentId];
      
      if (studentData) {
        console.log('Reconnecting to existing student record');
        // Restore state from Firebase
        setResponses(studentData.responses || []);
        setLocalSlideIndex(studentData.currentSlide || 0);
        setName(savedSession.studentName);
        
        // Update online status
        await retryOperation(() => 
          update(ref(database, `${QUIZ_SESSIONS_PATH}/${savedSession.sessionId}/students/${savedSession.studentId}`), {
            isOnline: true,
            isFocused: true,
            lastSeen: new Date().toISOString(),
            deviceId: getDeviceId(),
          })
        );
        
        // Set session state
        setSessionId(savedSession.sessionId);
        setStudentId(savedSession.studentId);
        setSession(sessionData);
        if (sessionData.quizData) {
          setQuiz(sessionData.quizData as Quiz);
        }
        setIsJoined(true);
      } else {
        console.log('Student record not found, clearing saved session');
        clearSavedSession();
      }
    } catch (error) {
      console.error('Reconnect failed:', error);
      setConnectionError('Nepodařilo se obnovit připojení');
      clearSavedSession();
    } finally {
      setIsReconnecting(false);
    }
  };

  // Manual reconnect
  const reconnectToSession = async () => {
    if (!sessionId || !studentId) return;
    
    setIsReconnecting(true);
    try {
      await retryOperation(() =>
        update(ref(database, `${QUIZ_SESSIONS_PATH}/${sessionId}/students/${studentId}`), {
          isOnline: true,
          isFocused: document.visibilityState === 'visible',
          lastSeen: new Date().toISOString(),
        })
      );
      setConnectionError(null);
    } catch (error) {
      console.error('Reconnect failed:', error);
      setConnectionError('Nepodařilo se obnovit připojení');
    } finally {
      setIsReconnecting(false);
    }
  };

  // ============================================
  // SESSION LISTENER
  // ============================================
  
  useEffect(() => {
    if (!sessionId) return;
    
    const sessionRef = ref(database, `${QUIZ_SESSIONS_PATH}/${sessionId}`);
    
    const unsubscribe = onValue(sessionRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setSession(data as LiveQuizSession);
        setConnectionError(null);
        
        // Load quiz from Firebase session data
        if (data.quizData && !quiz) {
          console.log('Loading quiz from Firebase:', data.quizData);
          setQuiz(data.quizData as Quiz);
        }
        
        // Sync responses from server (in case of multi-device or teacher evaluation)
        if (studentId && data.students?.[studentId]) {
          const serverResponses = data.students[studentId].responses || [];
          const currentResponses = responsesRef.current;
          // Update if server has more responses OR if any isCorrect value has changed (teacher evaluated)
          const hasNewResponses = serverResponses.length > currentResponses.length;
          const hasEvaluationChanged = serverResponses.some((sr: any, idx: number) => {
            const localResponse = currentResponses[idx];
            return localResponse && sr.isCorrect !== localResponse.isCorrect;
          });
          if (hasNewResponses || hasEvaluationChanged) {
            setResponses(serverResponses);
          }
        }
      }
    }, (error) => {
      console.error('Session listener error:', error);
      setConnectionError('Ztráta spojení se serverem');
    });
    
    sessionUnsubscribe.current = () => off(sessionRef);
    
    return () => {
      off(sessionRef);
      sessionUnsubscribe.current = null;
    };
  }, [sessionId, studentId, quiz]);

  // ============================================
  // HEARTBEAT - Keep online status updated
  // ============================================
  
  useEffect(() => {
    if (!sessionId || !studentId) return;
    
    const updateHeartbeat = async () => {
      try {
        await update(ref(database, `${QUIZ_SESSIONS_PATH}/${sessionId}/students/${studentId}`), {
          lastSeen: new Date().toISOString(),
          isOnline: true,
        });
      } catch (error) {
        console.warn('Heartbeat failed:', error);
      }
    };
    
    // Update immediately
    updateHeartbeat();
    
    // Optimized: 45s heartbeat for better scalability with many students
    heartbeatInterval.current = setInterval(updateHeartbeat, 45000);
    
    return () => {
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
        heartbeatInterval.current = null;
      }
    };
  }, [sessionId, studentId]);

  // ============================================
  // ONLINE/FOCUS STATUS
  // ============================================
  
  useEffect(() => {
    if (!sessionId || !studentId) return;
    
    const studentRef = ref(database, `${QUIZ_SESSIONS_PATH}/${sessionId}/students/${studentId}`);
    
    const handleBeforeUnload = () => {
      // Use sendBeacon for reliable offline update (if supported)
      const url = 'https://' + (process.env.REACT_APP_FIREBASE_PROJECT_ID || 'your-project') + '.firebaseio.com/' + QUIZ_SESSIONS_PATH + '/' + sessionId + '/students/' + studentId + '.json';
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, JSON.stringify({ isOnline: false }));
      }
      update(studentRef, { isOnline: false });
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      update(studentRef, { isOnline: false });
    };
  }, [sessionId, studentId]);
  
  // Track focus/visibility
  useEffect(() => {
    if (!sessionId || !studentId) return;
    
    const studentRef = ref(database, `${QUIZ_SESSIONS_PATH}/${sessionId}/students/${studentId}`);
    
    const handleVisibilityChange = () => {
      const isFocused = document.visibilityState === 'visible';
      update(studentRef, { isFocused, lastSeen: new Date().toISOString() });
    };
    
    const handleBlur = () => {
      update(studentRef, { isFocused: false, lastSeen: new Date().toISOString() });
    };
    
    const handleFocus = () => {
      update(studentRef, { isFocused: true, lastSeen: new Date().toISOString() });
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [sessionId, studentId]);

  // ============================================
  // SYNC SLIDE INDEX
  // ============================================
  
  useEffect(() => {
    if (session?.isLocked !== false && session?.currentSlideIndex !== undefined) {
      // Trigger animation when teacher changes slide
      if (session.currentSlideIndex !== localSlideIndex) {
        setPrevSlideIndex(localSlideIndex);
        setIsAnimating(true);
        setTimeout(() => setIsAnimating(false), 300);
      }
      
      setLocalSlideIndex(session.currentSlideIndex);
      
      if (sessionId && studentId) {
        update(ref(database, `${QUIZ_SESSIONS_PATH}/${sessionId}/students/${studentId}`), {
          currentSlide: session.currentSlideIndex,
        });
      }
    }
  }, [session?.currentSlideIndex, session?.isLocked, sessionId, studentId]);
  
  // Reset selection and start time when slide changes
  const effectiveSlideIndex = session?.isLocked === false ? localSlideIndex : (session?.currentSlideIndex || 0);
  useEffect(() => {
    setSelectedOption(null);
    setTextAnswer('');
    setShowResult(false);
    setSlideStartTime(Date.now()); // Reset slide timer
  }, [effectiveSlideIndex]);

  // ============================================
  // JOIN SESSION
  // ============================================
  
  const joinSession = async () => {
    if (!code || !name) {
      setError('Vyplň kód a jméno');
      return;
    }
    
    // Clear any saved session that doesn't match the code being joined
    const savedSession = getSavedSession();
    if (savedSession) {
      const savedCodeMatch = savedSession.sessionId.match(/quiz_([A-Z0-9]+)_/);
      const savedCode = savedCodeMatch ? savedCodeMatch[1] : null;
      if (!savedCode || savedCode.toUpperCase() !== code.toUpperCase()) {
        console.log('Clearing old session before joining new one');
        clearSavedSession();
      }
    }
    
    setIsJoining(true);
    setError('');
    
    try {
      // Get or create student identity
      const identity = getStudentIdentity(name);
      
      // OPTIMIZED: First try to find session via lookup table
      const codeUpper = code.toUpperCase();
      const lookupRef = ref(database, `session_codes/${codeUpper}`);
      const lookupSnapshot = await get(lookupRef);
      
      let foundSessionId: string | null = null;
      let sessionData: LiveQuizSession | null = null;
      
      if (lookupSnapshot.exists()) {
        // Fast path: Use lookup table
        foundSessionId = lookupSnapshot.val() as string;
        const sessionRef = ref(database, `${QUIZ_SESSIONS_PATH}/${foundSessionId}`);
        const sessionSnapshot = await get(sessionRef);
        if (sessionSnapshot.exists()) {
          sessionData = sessionSnapshot.val() as LiveQuizSession;
        }
      }
      
      // Fallback: Search by session ID prefix (for older sessions without lookup)
      if (!foundSessionId || !sessionData) {
        console.log('[QuizJoin] Lookup not found, using prefix search...');
        const sessionsRef = ref(database, QUIZ_SESSIONS_PATH);
        const snapshot = await get(sessionsRef);
        
        if (snapshot.exists()) {
          const sessions = snapshot.val();
          const sessionEntry = Object.entries(sessions).find(([id, _]) => 
            id.includes(`quiz_${codeUpper}_`)
          );
          
          if (sessionEntry) {
            [foundSessionId, sessionData] = sessionEntry as [string, LiveQuizSession];
          }
        }
      }
      
      if (!foundSessionId || !sessionData) {
        setError('Neplatný kód');
        setIsJoining(false);
        return;
      }
      
      if (!sessionData.isActive) {
        setError('Session již skončila');
        setIsJoining(false);
        return;
      }
      
      // Check if student already exists in this session (by name)
      let existingStudentId: string | null = null;
      if (sessionData.students) {
        const existingEntry = Object.entries(sessionData.students).find(
          ([_, student]) => student.name.toLowerCase() === name.toLowerCase()
        );
        if (existingEntry) {
          existingStudentId = existingEntry[0];
          console.log('Found existing student record by name:', existingStudentId);
        }
      }
      
      const finalStudentId = existingStudentId || identity.id;
      
      // Prepare student data
      const studentData: StudentData = {
        name,
        schoolName: school || '',
        joinedAt: existingStudentId 
          ? (sessionData.students![existingStudentId].joinedAt || new Date().toISOString())
          : new Date().toISOString(),
        currentSlide: existingStudentId 
          ? (sessionData.students![existingStudentId].currentSlide || 0)
          : 0,
        responses: existingStudentId 
          ? (sessionData.students![existingStudentId].responses || [])
          : [],
        isOnline: true,
        isFocused: true,
        lastSeen: new Date().toISOString(),
        deviceId: getDeviceId(),
        // Time tracking - preserve existing startTime or set new one
        startTime: existingStudentId
          ? ((sessionData.students![existingStudentId] as any).startTime || new Date().toISOString())
          : new Date().toISOString(),
        totalTimeMs: existingStudentId
          ? ((sessionData.students![existingStudentId] as any).totalTimeMs || 0)
          : 0,
      };
      
      // Save/update student in Firebase
      await retryOperation(() =>
        set(ref(database, `${QUIZ_SESSIONS_PATH}/${foundSessionId}/students/${finalStudentId}`), studentData)
      );
      
      // Save session to localStorage for reconnect
      saveActiveSession({
        sessionId: foundSessionId,
        sessionCode: code.toUpperCase(),
        studentId: finalStudentId,
        studentName: name,
        joinedAt: studentData.joinedAt,
      });
      
      // Load quiz from Firebase session
      if ((sessionData as any).quizData) {
        setQuiz((sessionData as any).quizData as Quiz);
      }
      
      // Restore responses if reconnecting
      if (existingStudentId && studentData.responses.length > 0) {
        setResponses(studentData.responses);
        setLocalSlideIndex(studentData.currentSlide);
      }
      
      setSessionId(foundSessionId);
      setStudentId(finalStudentId);
      setIsJoined(true);
      setIsJoining(false);
      
    } catch (err) {
      console.error('Join error:', err);
      setError('Nepodařilo se připojit. Zkus to znovu.');
      setIsJoining(false);
    }
  };

  // ============================================
  // SUBMIT ANSWER
  // ============================================
  
  const submitAnswer = useCallback(async () => {
    if (!session || !quiz || !sessionId || !studentId) return;
    
    const slideIndex = session.isLocked === false ? localSlideIndex : session.currentSlideIndex;
    const currentSlideForAnswer = quiz.slides[slideIndex];
    if (!currentSlideForAnswer || currentSlideForAnswer.type !== 'activity') return;
    
    // Check if already answered
    if (responses.some(r => r.slideId === currentSlideForAnswer.id)) {
      setShowResult(true);
      return;
    }
    
    let isCorrect = false;
    let answer: string = '';
    
    if (currentSlideForAnswer.activityType === 'abc') {
      const abcSlide = currentSlideForAnswer as ABCActivitySlide;
      const correctOption = abcSlide.options.find(o => o.isCorrect);
      isCorrect = selectedOption === correctOption?.id;
      answer = selectedOption || '';
    } else if (currentSlideForAnswer.activityType === 'open') {
      const openSlide = currentSlideForAnswer as OpenActivitySlide;
      // Use mathematical comparison for numeric answers
      isCorrect = checkMathAnswer(textAnswer, openSlide.correctAnswers);
      answer = textAnswer;
    } else if (currentSlideForAnswer.activityType === 'example') {
      const exampleSlide = currentSlideForAnswer as ExampleActivitySlide;
      // Use mathematical comparison for example answers
      const correctAnswers = exampleSlide.finalAnswer ? [exampleSlide.finalAnswer] : [];
      isCorrect = checkMathAnswer(textAnswer, correctAnswers);
      answer = textAnswer;
    } else if (currentSlideForAnswer.activityType === 'form') {
      // Form answers are stored as JSON string
      answer = JSON.stringify(formAnswer);
      isCorrect = true; // Forms are not scored
    }
    
    // Calculate time spent on this slide in seconds
    const timeSpentSeconds = Math.round((Date.now() - slideStartTime) / 1000);
    
    // If showSolutionHints is enabled, set isCorrect immediately
    // Otherwise, let the teacher evaluate via "Vyhodnotit" button
    const shouldShowImmediateResult = session?.settings?.showSolutionHints === true;
    
    const response: SlideResponse = {
      slideId: currentSlideForAnswer.id,
      activityType: currentSlideForAnswer.activityType,
      answer,
      // Set isCorrect immediately if showSolutionHints is enabled, otherwise null until teacher evaluates
      isCorrect: shouldShowImmediateResult ? isCorrect : (null as any),
      points: shouldShowImmediateResult && isCorrect ? 1 : 0,
      answeredAt: new Date().toISOString(),
      timeSpent: timeSpentSeconds,
    };
    
    const newResponses = [...responses, response];
    setResponses(newResponses);
    setShowResult(true);
    
    // Calculate total session time
    const totalTimeMs = Date.now() - sessionStartTime;
    
    // Save to Firebase with retry
    try {
      await retryOperation(() =>
        update(ref(database, `${QUIZ_SESSIONS_PATH}/${sessionId}/students/${studentId}`), {
          responses: newResponses,
          currentSlide: slideIndex,
          lastSeen: new Date().toISOString(),
          totalTimeMs,
        })
      );
    } catch (error) {
      console.error('Failed to save answer:', error);
      setConnectionError('Odpověď se možná neuložila. Zkontroluj připojení.');
    }
  }, [session, quiz, sessionId, studentId, localSlideIndex, responses, selectedOption, textAnswer, formAnswer, slideStartTime, sessionStartTime]);

  // ============================================
  // NAVIGATION
  // ============================================
  
  const goToPrevSlide = async () => {
    if (!quiz || localSlideIndex <= 0 || isAnimating) return;
    
    setPrevSlideIndex(localSlideIndex);
    setIsAnimating(true);
    
    const newIndex = localSlideIndex - 1;
    setLocalSlideIndex(newIndex);
    
    // Reset animation after it completes
    setTimeout(() => setIsAnimating(false), 300);
    
    if (sessionId && studentId) {
      await update(ref(database, `${QUIZ_SESSIONS_PATH}/${sessionId}/students/${studentId}`), {
        currentSlide: newIndex,
        lastSeen: new Date().toISOString(),
      });
    }
  };
  
  const goToNextSlide = async () => {
    if (!quiz || localSlideIndex >= quiz.slides.length - 1 || isAnimating) return;
    
    setPrevSlideIndex(localSlideIndex);
    setIsAnimating(true);
    
    const newIndex = localSlideIndex + 1;
    setLocalSlideIndex(newIndex);
    
    // Reset animation after it completes
    setTimeout(() => setIsAnimating(false), 300);
    
    // Scroll to top on mobile - with fallback for older browsers
    try {
      if ('scrollBehavior' in document.documentElement.style) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        window.scrollTo(0, 0);
      }
    } catch (e) {
      window.scrollTo(0, 0);
    }
    
    if (sessionId && studentId) {
      await update(ref(database, `${QUIZ_SESSIONS_PATH}/${sessionId}/students/${studentId}`), {
        currentSlide: newIndex,
        lastSeen: new Date().toISOString(),
      });
    }
  };

  // ============================================
  // COMPUTED VALUES
  // ============================================
  
  const currentSlideIndex = session && session.isLocked === false ? localSlideIndex : (session && session.currentSlideIndex ? session.currentSlideIndex : 0);
  const currentSlide = quiz && quiz.slides ? quiz.slides[currentSlideIndex] : undefined;
  const currentSlideId = currentSlide ? currentSlide.id : '';
  const hasAnswered = responses.some(function(r) { return r.slideId === currentSlideId; });

  // Helper to collect form responses for certificate
  const collectFormResponses = useCallback((): Record<string, Record<string, string | string[]>> => {
    const formResponses: Record<string, Record<string, string | string[]>> = {};
    
    if (quiz) {
      quiz.slides.forEach(slide => {
        if (slide.type === 'activity' && (slide as any).activityType === 'form') {
          const response = responses.find(r => r.slideId === slide.id);
          // Try to parse saved response
          if (response?.answer && typeof response.answer === 'string' && response.answer.trim()) {
            try {
              const parsed = JSON.parse(response.answer);
              if (parsed && typeof parsed === 'object') {
                formResponses[slide.id] = parsed;
              }
            } catch {
              // If not valid JSON, skip
            }
          }
          
          // If formAnswer has data for this slide
          const formSlide = slide as any;
          if (formSlide.fields && formSlide.fields.length > 0) {
            const slideFieldIds = formSlide.fields.map((f: any) => f.id);
            const hasDataForThisSlide = Object.keys(formAnswer).some(key => slideFieldIds.includes(key));
            
            if (hasDataForThisSlide && Object.keys(formAnswer).length > 0) {
              formResponses[slide.id] = formAnswer;
            }
          }
        }
      });
    }
    
    return formResponses;
  }, [quiz, responses, formAnswer]);
  const currentResponse = responses.find(function(r) { return r.slideId === currentSlideId; });
  
  // Board posts for current slide (if it's a board activity)
  const boardPosts = useBoardPosts({
    sessionId: sessionId,
    slideId: currentSlideId,
    currentUserId: studentId || undefined,
    currentUserName: name || undefined,
  });
  
  // Voting for current slide (if it's a voting activity)
  const voting = useVoting({
    sessionId: sessionId,
    slideId: currentSlideId,
    currentUserId: studentId || undefined,
    currentUserName: name || undefined,
  });
  
  // Only count responses where isCorrect has been set by teacher (not null/undefined)
  const correctCount = responses.filter(function(r) { return r.isCorrect === true; }).length;
  const wrongCount = responses.filter(function(r) { return r.isCorrect === false; }).length;
  // Count of answers submitted but not yet evaluated
  const pendingCount = responses.filter(function(r) { return r.isCorrect === null || r.isCorrect === undefined; }).length;
  const canNavigate = session && session.isLocked === false;
  
  // Require answer to proceed (for activity slides)
  const canProceed = !currentSlide || currentSlide.type !== 'activity' || hasAnswered;

  // Preload adjacent slides (previous and next) for faster navigation
  useEffect(() => {
    if (!quiz?.slides) return;
    
    const preloadSlideImages = (slide: QuizSlide | undefined) => {
      if (!slide) return;
      
      const imageUrls: string[] = [];
      
      // Check for media on activity slides
      if ((slide as any).media?.url && (slide as any).media?.type === 'image') {
        imageUrls.push((slide as any).media.url);
      }
      
      // Check for block-based layouts (info slides)
      if (slide.type === 'info') {
        const infoSlide = slide as InfoSlide;
        if (infoSlide.layout?.blocks) {
          infoSlide.layout.blocks.forEach(block => {
            if (block.type === 'image' && block.content) {
              imageUrls.push(block.content);
              if (block.gallery) {
                block.gallery.forEach(url => imageUrls.push(url));
              }
            }
          });
        }
        if (infoSlide.imageUrl) {
          imageUrls.push(infoSlide.imageUrl);
        }
      }
      
      // Check for slide background image
      if ((slide as any).slideBackground?.type === 'image' && (slide as any).slideBackground?.imageUrl) {
        imageUrls.push((slide as any).slideBackground.imageUrl);
      }
      
      // Preload each image
      imageUrls.forEach(url => {
        if (url && url.startsWith('http')) {
          const img = new Image();
          img.src = url;
        }
      });
    };
    
    // Preload previous slide
    if (currentSlideIndex > 0) {
      preloadSlideImages(quiz.slides[currentSlideIndex - 1]);
    }
    
    // Preload next slide
    if (currentSlideIndex < quiz.slides.length - 1) {
      preloadSlideImages(quiz.slides[currentSlideIndex + 1]);
    }
  }, [currentSlideIndex, quiz?.slides]);

  // ============================================
  // WIGGLE ANIMATION - triggers when clicking disabled arrow
  // ============================================
  
  const triggerWiggle = () => {
    // Scroll to the answer button and wiggle it
    try {
      if (answerButtonRef.current) {
        // Try smooth scroll, fall back to instant scroll for older browsers
        if ('scrollBehavior' in document.documentElement.style) {
          answerButtonRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          answerButtonRef.current.scrollIntoView(true);
        }
      }
    } catch (e) {
      // Ignore scroll errors on old browsers
    }
    setShowWiggle(true);
    setTimeout(function() { setShowWiggle(false); }, 800);
  };

  // ============================================
  // RENDER: CONNECTION ERROR BANNER
  // ============================================
  
  const renderConnectionBanner = () => {
    if (!connectionError && isOnline) return null;
    
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white px-4 py-2 flex items-center justify-center gap-2">
        {!isOnline ? (
          <>
            <WifiOff className="w-4 h-4" />
            <span className="text-sm font-medium">Offline - čekám na připojení...</span>
          </>
        ) : connectionError ? (
          <>
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium">{connectionError}</span>
            <button 
              onClick={reconnectToSession}
              className="ml-2 px-2 py-1 bg-white/20 rounded text-xs hover:bg-white/30"
            >
              Zkusit znovu
            </button>
          </>
        ) : null}
      </div>
    );
  };

  // ============================================
  // RENDER: RECONNECTING
  // ============================================
  
  if (isReconnecting) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Obnovuji připojení...</p>
          <p className="text-slate-400 text-sm mt-2">Chvilku strpení</p>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: JOIN SCREEN
  // ============================================
  
  if (!isJoined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-700 flex items-center justify-center p-4">
        {renderConnectionBanner()}
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">
              {boardTitle ? (
                <>Připojte se do: <span className="text-indigo-600">{boardTitle}</span></>
              ) : (
                'Připojte se'
              )}
            </h1>
            {!code && (
              <p className="text-slate-500 mt-1">Zadej kód od učitele</p>
            )}
            {isLookingUpBoard && code.length === 6 && (
              <p className="text-slate-400 mt-1 text-sm flex items-center justify-center gap-2">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Hledám relaci...
              </p>
            )}
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Kód relace
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABCD12"
                maxLength={6}
                className="w-full px-4 py-4 text-center text-3xl font-mono font-bold rounded-2xl border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none uppercase tracking-[0.5em] transition-all"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Jméno
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jan Novák"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-lg"
              />
            </div>
            
            {error && (
              <div className="p-3 rounded-xl bg-red-50 text-red-600 text-sm text-center flex items-center justify-center gap-2">
                <XCircle className="w-4 h-4" />
                {error}
              </div>
            )}
            
            <button
              onClick={joinSession}
              disabled={isJoining || !code || !name || !isOnline}
              className="w-full py-4 rounded-2xl text-white font-bold text-lg transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#7C3AED' }}
            >
              {isJoining ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : !isOnline ? (
                <>
                  <WifiOff className="w-5 h-5" />
                  Čekám na připojení
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Připojit se
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: WAITING FOR QUIZ DATA
  // ============================================
  
  if (!quiz || !session) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        {renderConnectionBanner()}
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-slate-600">Načítám kvíz...</p>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: SESSION ENDED
  // ============================================
  
  if (!session.isActive) {
    const totalQuestions = quiz.slides.filter(s => s.type === 'activity').length;
    
    // Clear saved session when it ends
    clearSavedSession();
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          
          <h2 className="text-2xl font-bold text-slate-800 mb-2">
            Kvíz dokončen!
          </h2>
          
          <div className="bg-slate-50 rounded-2xl p-6 my-6">
            <div className="text-5xl font-bold text-green-600 mb-2">
              {totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0}%
            </div>
            <p className="text-slate-600">
              {correctCount} z {totalQuestions} správně
            </p>
          </div>
          
          <p className="text-slate-500">Děkujeme za účast, {name}!</p>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: PAUSED
  // ============================================
  
  if (session.isPaused) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center p-4">
        {renderConnectionBanner()}
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <Pause className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">
            Kvíz pozastaven
          </h2>
          <p className="text-slate-500">Čekej na pokračování od učitele...</p>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: WAITING FOR SLIDE
  // ============================================
  
  if (!currentSlide) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        {renderConnectionBanner()}
        <p className="text-slate-500">Čekám na další otázku...</p>
      </div>
    );
  }

  // ============================================
  // RENDER: PROGRESS BAR
  // ============================================
  
  const renderProgressBar = () => {
    const totalSlides = quiz.slides.length;
    const progressPercent = totalSlides > 0 ? ((currentSlideIndex + 1) / totalSlides) * 100 : 0;
    
    // For more than 30 slides, show a simple continuous progress bar
    if (totalSlides > 30) {
      return (
        <div 
          className="flex-1 h-full rounded-full overflow-hidden"
          style={{ backgroundColor: '#CBD5E1' }}
        >
          <div 
            className="h-full rounded-full transition-all duration-300 ease-out"
            style={{ 
              width: `${progressPercent}%`,
              backgroundColor: '#475569'
            }}
          />
        </div>
      );
    }
    
    // For 30 or fewer slides, show individual segments
    return (
      <>
        {currentSlideIndex >= 0 && (
          <div
            className="rounded-full h-full"
            style={{ 
              backgroundColor: '#475569',
              flex: currentSlideIndex + 1
            }}
          />
        )}
        {quiz.slides.slice(currentSlideIndex + 1).map((_, idx) => {
          const actualIndex = currentSlideIndex + 1 + idx;
          return (
            <div
              key={actualIndex}
              className="flex-1 rounded-full h-full"
              style={{ 
                backgroundColor: '#CBD5E1'
              }}
            />
          );
        })}
      </>
    );
  };

  // ============================================
  // RENDER: QUIZ VIEW
  // ============================================
  
  return (
    <div className="flex flex-col h-screen" style={{ backgroundColor: '#F0F1F8' }}>
      {renderConnectionBanner()}
      
      {/* Progress bar header - height 40px on desktop only */}
      <div 
        className="hidden lg:flex items-center justify-center px-4" 
        style={{ 
          backgroundColor: '#F0F1F8',
          height: 40,
        }}
      >
        {/* Progress bar - centered with max width */}
        <div className="flex items-center gap-1.5" style={{ width: '50%', maxWidth: '600px', height: '8px' }}>
          {renderProgressBar()}
        </div>
      </div>
      
      {/* Main content area */}
      <div 
        className="flex-1 flex flex-col overflow-hidden" 
        style={{ 
          minHeight: 0,
        }}
      >
        {/* Content with arrows - bottom padding 5px */}
        <div className="flex-1 flex items-stretch overflow-hidden" style={{ minHeight: 0, paddingBottom: isMobile ? 16 : 5 }}>
          {/* Desktop: Left arrow */}
          <div className="hidden lg:flex flex-shrink-0 items-center justify-center" style={{ width: 65 }}>
            {canNavigate && (
              <button
                onClick={goToPrevSlide}
                disabled={currentSlideIndex === 0}
                className={`w-12 h-12 rounded-full bg-[#CBD5E1] flex items-center justify-center text-slate-600 transition-all duration-300 ease-out ${currentSlideIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:h-24'}`}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
          </div>
          
          {/* Slide card - fills remaining space */}
          <div 
            ref={mobileScrollRef}
            className="flex-1 relative"
            style={{
              minHeight: 0,
              overflowY: isMobile ? 'auto' : 'hidden',
              overflowX: 'hidden',
              WebkitOverflowScrolling: 'touch',
              // Padding - top for nav (smaller if locked mode), sides for shadow
              padding: isMobile ? (canNavigate ? '75px 8px 8px 8px' : '50px 8px 8px 8px') : 16,
            }}
          >
            {/* Mobile: Fixed top navigation */}
            {isMobile && (
              <div 
                className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-3 pb-2"
              >
                {/* Locked mode: only progress bar */}
                {!canNavigate ? (
                  <div 
                    className={`rounded-full px-6 py-3 transition-all duration-300 ${isScrolling ? 'bg-white shadow-lg' : ''}`}
                  >
                    <div className="flex items-center gap-0.5" style={{ height: '8px', width: '150px' }}>
                      {renderProgressBar()}
                    </div>
                  </div>
                ) : (
                  /* Unlocked mode: buttons + progress bar */
                  <div 
                    className={`flex items-center gap-3 rounded-full px-4 py-2 transition-all duration-300 ${isScrolling ? 'bg-white shadow-lg' : ''}`}
                  >
                    <button
                      onClick={goToPrevSlide}
                      disabled={currentSlideIndex === 0}
                      className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${currentSlideIndex === 0 ? 'opacity-30 cursor-not-allowed' : ''} bg-[#E2E8F0] text-slate-500`}
                    >
                      <ArrowLeft className="w-6 h-6" />
                    </button>
                    <div className="flex items-center gap-0.5" style={{ height: '8px', width: '120px' }}>
                      {renderProgressBar()}
                    </div>
                    <button
                      onClick={() => (currentSlideIndex < quiz.slides.length - 1 && canProceed) ? goToNextSlide() : (!canProceed ? triggerWiggle() : null)}
                      className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${(currentSlideIndex === quiz.slides.length - 1 || !canProceed) ? 'bg-slate-300 text-slate-400' : 'text-white'}`}
                      style={{ backgroundColor: (currentSlideIndex < quiz.slides.length - 1 && canProceed) ? '#7C3AED' : undefined }}
                    >
                      <ArrowRight className="w-6 h-6" />
                    </button>
                  </div>
                )}
              </div>
            )}
            <div 
              className={`
                w-full rounded-3xl overflow-hidden flex flex-col
                ${currentSlide?.type === 'tools' && (currentSlide as ToolsSlide).toolType === 'certificate' && (currentSlide as ToolsSlide).certificateConfig?.customPdfUrl ? '' : 'bg-white shadow-md'}
                ${currentSlide?.type !== 'info' ? 'max-w-5xl mx-auto' : ''}
                ${currentSlideIndex > prevSlideIndex && isAnimating ? 'animate-slide-in' : ''}
                ${currentSlideIndex < prevSlideIndex && isAnimating ? 'animate-slide-in-left' : ''}
              `}
              style={{
                // Mobile: min height to ensure background extends to viewport
                // Desktop: fill available space
                height: isMobile ? 'auto' : '100%',
                minHeight: isMobile ? 'calc(100vh - 140px)' : undefined,
              }}
              key={currentSlideIndex}
            >
              {/* Info slide with block layout - render ONLY BlockLayoutView */}
              {currentSlide.type === 'info' && (currentSlide as InfoSlide).layout && (currentSlide as InfoSlide).layout!.blocks.length > 0 ? (
                <div className="flex-1 flex flex-col" style={{ minHeight: isMobile ? '100%' : 0, height: '100%' }}>
                  <BlockLayoutView slide={currentSlide as InfoSlide} />
                </div>
              ) : (
                <>
                  {/* Question - only for activity slides (except those with their own display) */}
                  {currentSlide.type === 'activity' && currentSlide.activityType !== 'board' && currentSlide.activityType !== 'voting' && currentSlide.activityType !== 'connect-pairs' && currentSlide.activityType !== 'fill-blanks' && currentSlide.activityType !== 'image-hotspots' && currentSlide.activityType !== 'video-quiz' && currentSlide.activityType !== 'form' && (
                    <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
                      <h1 className="text-xl sm:text-2xl md:text-4xl lg:text-5xl font-bold text-[#4E5871] text-center leading-tight break-words max-w-full overflow-hidden">
                        <MathText>{(currentSlide as any).question || (currentSlide as any).title || 'Otázka'}</MathText>
                      </h1>
                      
                      {/* Question image */}
                      {(currentSlide as any).media?.url && (currentSlide as any).media?.type === 'image' && (
                        <img 
                          src={(currentSlide as any).media.url} 
                          alt="Obrázek k otázce"
                          className="mt-4 max-w-full max-h-48 md:max-h-64 rounded-xl shadow-lg object-contain"
                        />
                      )}
                    </div>
                  )}
              
              {/* ABC Options */}
              {currentSlide.type === 'activity' && currentSlide.activityType === 'abc' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 p-4 md:p-6 max-w-4xl mx-auto w-full">
                    {(() => {
                      const isEvaluated = session?.showResults === true || (currentResponse?.isCorrect !== null && currentResponse?.isCorrect !== undefined);
                      const showCorrectness = isEvaluated;
                      
                      return (currentSlide as ABCActivitySlide).options.map((option) => {
                        const isSelected = selectedOption === option.id;
                        const isCorrectOption = option.isCorrect;
                        const wasSelected = currentResponse?.answer === option.id;
                        
                        return (
                          <button
                            key={option.id}
                            onClick={() => !hasAnswered && !showResult && setSelectedOption(option.id)}
                            disabled={hasAnswered || showResult}
                            className={`
                              relative p-3 lg:p-4 rounded-2xl text-left transition-all border-2 flex items-center gap-3 lg:gap-4
                              ${showCorrectness && isCorrectOption ? 'bg-green-50 border-green-500' : ''}
                              ${showCorrectness && wasSelected && !isCorrectOption ? 'bg-red-50 border-red-500' : ''}
                              ${!showCorrectness && (hasAnswered || showResult) && wasSelected ? 'border-indigo-500 bg-indigo-50' : ''}
                              ${!showCorrectness && !hasAnswered && !showResult && isSelected ? 'border-indigo-500 bg-indigo-50' : ''}
                              ${!showCorrectness && !hasAnswered && !showResult && !isSelected ? 'bg-white border-slate-100 hover:border-indigo-200 hover:shadow-md' : ''}
                              ${!showCorrectness && (hasAnswered || showResult) && !wasSelected ? 'bg-white border-slate-100 opacity-50' : ''}
                              ${showCorrectness && !isCorrectOption && !wasSelected ? 'bg-white border-slate-100 opacity-50' : ''}
                            `}
                          >
                            <span 
                              className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl flex items-center justify-center font-bold text-base lg:text-lg flex-shrink-0 transition-colors"
                              style={{
                                backgroundColor: showCorrectness && isCorrectOption ? '#bbf7d0' 
                                  : showCorrectness && wasSelected && !isCorrectOption ? '#fecaca'
                                  : (hasAnswered || showResult || isSelected) && wasSelected ? '#c7d2fe'
                                  : !hasAnswered && !showResult && isSelected ? '#c7d2fe' 
                                  : '#E2E8F0',
                                color: showCorrectness && isCorrectOption ? '#166534' 
                                  : showCorrectness && wasSelected && !isCorrectOption ? '#991b1b'
                                  : (hasAnswered || showResult || isSelected) && wasSelected ? '#3730a3'
                                  : !hasAnswered && !showResult && isSelected ? '#3730a3' 
                                  : '#475569',
                              }}
                            >
                              {option.label || option.id?.toUpperCase() || '?'}
                            </span>
                            <span className="text-base sm:text-lg lg:text-xl font-medium text-[#4E5871] flex-1 break-words overflow-hidden">
                              <MathText>{option.content || ''}</MathText>
                            </span>
                            
                            {showCorrectness && isCorrectOption && (
                              <CheckCircle className="w-6 h-6 text-green-600" />
                            )}
                            {hasAnswered && !showCorrectness && wasSelected && (
                              <span className="text-xs px-2 py-1 rounded bg-indigo-100 text-indigo-600 font-medium">Odesláno</span>
                            )}
                          </button>
                        );
                      });
                    })()}
                  </div>
                  
                  {/* Show explanation/hint for ABC after answer is evaluated */}
                  {session?.settings?.showSolutionHints && hasAnswered && (currentResponse?.isCorrect !== null && currentResponse?.isCorrect !== undefined) && (currentSlide as ABCActivitySlide).explanation && (
                    <div className="mt-4 mx-6 p-4 rounded-xl bg-amber-50 border border-amber-200">
                      <div className="flex items-center gap-2 text-amber-700 font-medium mb-2">
                        <HelpCircle className="w-5 h-5" />
                        <span>Vysvětlení:</span>
                      </div>
                      <p className="text-slate-700">
                        <MathText>{(currentSlide as ABCActivitySlide).explanation || ''}</MathText>
                      </p>
                    </div>
                  )}
                </>
              )}
              
              {/* Open question or Example */}
              {currentSlide.type === 'activity' && (currentSlide.activityType === 'open' || currentSlide.activityType === 'example') && (
                <div className="w-full max-w-2xl mx-auto px-6">
                  {(() => {
                    const isEvaluated = session?.showResults === true || (currentResponse?.isCorrect !== null && currentResponse?.isCorrect !== undefined);
                    return (
                      <div className="relative">
                        {/* Math icon for Example only */}
                        {currentSlide.activityType === 'example' && !hasAnswered && (
                          <button
                            onClick={() => setShowMathKeyboard(true)}
                            className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-lg text-indigo-600 hover:bg-indigo-50 z-10"
                            title="Otevřít matematickou klávesnici"
                          >
                            <Calculator className="w-5 h-5" />
                          </button>
                        )}
                        <input
                          type="text"
                          value={hasAnswered ? (currentResponse?.answer as string) : textAnswer}
                          onChange={(e) => setTextAnswer(e.target.value)}
                          disabled={hasAnswered || showResult}
                          placeholder="Napište svou odpověď..."
                          className={`
                            w-full px-6 py-4 rounded-2xl border-2 text-xl text-center outline-none transition-all
                            ${currentSlide.activityType === 'example' && !hasAnswered ? 'pl-12' : ''}
                            ${isEvaluated
                              ? currentResponse?.isCorrect 
                                ? 'bg-green-50 border-green-500' 
                                : 'bg-red-50 border-red-500'
                              : hasAnswered
                                ? 'bg-indigo-50 border-indigo-500'
                                : 'border-slate-200 focus:border-indigo-400 focus:ring-0'
                            }
                          `}
                        />
                        {hasAnswered && !isEvaluated && (
                          <p className="text-center text-sm text-indigo-600 mt-2 font-medium">✓ Odpověď odeslána, čekám na vyhodnocení</p>
                        )}
                      </div>
                    );
                  })()}
                  
                  {/* Math preview */}
                  {textAnswer.includes('$') && !hasAnswered && !showResult && (
                    <div className="mt-3 p-3 bg-slate-50 rounded-xl text-center">
                      <span className="text-xs text-slate-400 block mb-1">Náhled:</span>
                      <div className="text-lg text-[#4E5871]">
                        <MathText>{textAnswer}</MathText>
                      </div>
                    </div>
                  )}
                  
                  {/* Only show result after teacher evaluation */}
                  {currentResponse?.isCorrect !== undefined && currentResponse?.isCorrect !== null && (
                    <div className="mt-4 flex items-center justify-center gap-2">
                      {currentResponse.isCorrect ? (
                        <>
                          <CheckCircle className="w-6 h-6 text-green-500" />
                          <span className="text-green-600 font-medium">Správně!</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-6 h-6 text-red-500" />
                          <span className="text-red-600">
                            Správně: <MathText>
                              {currentSlide.activityType === 'example' 
                                ? (currentSlide as ExampleActivitySlide).finalAnswer 
                                : (currentSlide as OpenActivitySlide).correctAnswers?.[0] || ''}
                            </MathText>
                          </span>
                        </>
                      )}
                    </div>
                  )}
                  
                  {/* Show explanation/hint after answer is evaluated */}
                  {session?.settings?.showSolutionHints && hasAnswered && currentResponse?.isCorrect !== undefined && (currentSlide as any).explanation && (
                    <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200">
                      <div className="flex items-center gap-2 text-amber-700 font-medium mb-2">
                        <HelpCircle className="w-5 h-5" />
                        <span>Vysvětlení:</span>
                      </div>
                      <p className="text-slate-700">
                        <MathText>{(currentSlide as any).explanation || ''}</MathText>
                      </p>
                    </div>
                  )}
                </div>
              )}
              
              {/* Board activity */}
              {currentSlide.type === 'activity' && currentSlide.activityType === 'board' && (
                <div className="flex-1 overflow-hidden">
                  <BoardSlideView 
                    slide={currentSlide as BoardActivitySlide}
                    posts={boardPosts.posts}
                    currentUserId={studentId || undefined}
                    currentUserName={name || undefined}
                    isTeacher={false}
                    onAddPost={boardPosts.addPost}
                    onLikePost={boardPosts.likePost}
                    onDeletePost={boardPosts.deletePost}
                    readOnly={false}
                  />
                </div>
              )}
              
              {/* Voting activity */}
              {currentSlide.type === 'activity' && currentSlide.activityType === 'voting' && (
                <div className="flex-1 overflow-hidden">
                  <VotingSlideView 
                    slide={currentSlide as VotingActivitySlide}
                    isTeacher={false}
                    hasVoted={voting.hasVoted}
                    myVote={voting.myVote}
                    voteCounts={voting.getVoteCounts()}
                    totalVoters={voting.getTotalVotes()}
                    onVote={voting.vote}
                    readOnly={false}
                  />
                </div>
              )}
              
              {/* Connect Pairs activity */}
              {currentSlide.type === 'activity' && currentSlide.activityType === 'connect-pairs' && (
                <div className="flex-1 overflow-hidden">
                  <ConnectPairsView 
                    slide={currentSlide as ConnectPairsActivitySlide}
                    isTeacher={false}
                    readOnly={false}
                    onSubmit={(result) => {
                      // Save answer and navigate
                      submitAnswer();
                    }}
                  />
                </div>
              )}
              
              {/* Fill Blanks activity */}
              {currentSlide.type === 'activity' && currentSlide.activityType === 'fill-blanks' && (
                <div className="flex-1 overflow-hidden">
                  <FillBlanksView 
                    slide={currentSlide as FillBlanksActivitySlide}
                    isTeacher={false}
                    readOnly={false}
                    onSubmit={(result) => {
                      // Save answer and navigate
                      submitAnswer();
                    }}
                  />
                </div>
              )}
              
              {/* Image Hotspots activity */}
              {currentSlide.type === 'activity' && currentSlide.activityType === 'image-hotspots' && (
                <div className="flex-1 overflow-hidden">
                  <ImageHotspotsView 
                    slide={currentSlide as ImageHotspotsActivitySlide}
                    isTeacher={false}
                    readOnly={false}
                    onSubmit={(result) => {
                      // Save answer and navigate
                      submitAnswer();
                    }}
                  />
                </div>
              )}
              
              {/* Video Quiz activity */}
              {currentSlide.type === 'activity' && currentSlide.activityType === 'video-quiz' && (
                <div className="flex-1 overflow-hidden">
                  <VideoQuizView 
                    slide={currentSlide as VideoQuizActivitySlide}
                    isTeacher={false}
                    readOnly={false}
                    onSubmit={(result) => {
                      // Save answer and navigate
                      submitAnswer();
                    }}
                  />
                </div>
              )}
              
              {/* Form activity */}
              {currentSlide.type === 'activity' && currentSlide.activityType === 'form' && (
                <div className="flex-1 overflow-y-auto">
                  <FormView 
                    slide={currentSlide as any}
                    answer={formAnswer}
                    onAnswerChange={(answer) => {
                      setFormAnswer(answer);
                      setTextAnswer(JSON.stringify(answer));
                    }}
                    isReadOnly={false}
                  />
                </div>
              )}

              {/* Tools slide - Certificate */}
              {currentSlide.type === 'tools' && (currentSlide as ToolsSlide).toolType === 'certificate' && (
                <div className="flex-1 overflow-y-auto">
                  <CertificateView 
                    slide={currentSlide as ToolsSlide}
                    quiz={quiz}
                    formResponses={collectFormResponses()}
                    isPreview={false}
                  />
                </div>
              )}
              
              {/* Legacy info slide (without block layout) */}
              {currentSlide.type === 'info' && (!(currentSlide as InfoSlide).layout || (currentSlide as InfoSlide).layout!.blocks.length === 0) && (
                <div className="flex-1 flex items-center justify-center p-8">
                  {(currentSlide as any).content && (
                    <div 
                      className="prose prose-lg max-w-3xl text-center text-slate-600"
                      dangerouslySetInnerHTML={{ __html: (currentSlide as any).content }}
                    />
                  )}
                </div>
              )}
              
              {/* Submit button or waiting indicator - only for activity slides (except those with their own buttons) */}
              {currentSlide.type === 'activity' && currentSlide.activityType !== 'board' && currentSlide.activityType !== 'voting' && currentSlide.activityType !== 'connect-pairs' && currentSlide.activityType !== 'fill-blanks' && currentSlide.activityType !== 'image-hotspots' && currentSlide.activityType !== 'video-quiz' && (
              <div className="flex justify-center py-6 md:py-10">
                {!hasAnswered && !showResult && currentSlide.type === 'activity' ? (
                  <button
                    ref={answerButtonRef}
                    onClick={submitAnswer}
                    disabled={
                      (currentSlide.activityType === 'abc' && !selectedOption) ||
                      (currentSlide.activityType === 'open' && !textAnswer.trim()) ||
                      (currentSlide.activityType === 'example' && !textAnswer.trim()) ||
                      // Form: disabled if required fields are not filled
                      (currentSlide.activityType === 'form' && 
                        ((currentSlide as any).fields || []).some((field: any) => 
                          field.required && (
                            !formAnswer[field.id] || 
                            (Array.isArray(formAnswer[field.id]) && (formAnswer[field.id] as string[]).length === 0) ||
                            (typeof formAnswer[field.id] === 'string' && !(formAnswer[field.id] as string).trim())
                          )
                        )
                      )
                    }
                    className={`flex items-center gap-2 px-8 py-4 rounded-xl text-white font-semibold text-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all ${showWiggle ? 'animate-wiggle' : ''}`}
                    style={{ 
                      backgroundColor: '#4F46E5', 
                      boxShadow: '0 10px 15px -3px rgba(99, 102, 241, 0.25)',
                    }}
                  >
                    <Send className="w-5 h-5" />
                    {currentSlide.activityType === 'form' ? 'Odeslat formulář' : 'Odpovědět'}
                  </button>
                ) : canNavigate ? (
                  <div className="flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-100 text-slate-500">
                    <ArrowRight className="w-5 h-5" />
                    <span>Použij šipky pro další otázku</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-100 text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Čekám na další otázku...</span>
                  </div>
                )}
              </div>
              )}
              </>
              )}
            </div>
            
            {/* Mobile: Extra space at bottom for scrolling */}
            {isMobile && (
              <div style={{ height: '120px', flexShrink: 0 }} />
            )}
          </div>
          
          {/* Desktop: Right arrow */}
          <div className="hidden lg:flex flex-shrink-0 items-center justify-center" style={{ width: 65 }}>
            {canNavigate && (
              <button
                onClick={() => (currentSlideIndex < quiz.slides.length - 1 && canProceed) ? goToNextSlide() : (!canProceed ? triggerWiggle() : null)}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ease-out ${(currentSlideIndex === quiz.slides.length - 1 || !canProceed) ? 'bg-slate-300 text-slate-400' : 'text-white hover:h-24'}`}
                style={{ backgroundColor: (currentSlideIndex < quiz.slides.length - 1 && canProceed) ? '#7C3AED' : undefined }}
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Math Input Modal */}
      <MathInputModal
        isOpen={showMathKeyboard}
        onClose={() => setShowMathKeyboard(false)}
        onSubmit={(latex) => {
          setTextAnswer(prev => prev + `$${latex}$`);
          setShowMathKeyboard(false);
        }}
        title="Vložit matematiku"
      />
    </div>
  );
}

export default QuizJoinPage;
