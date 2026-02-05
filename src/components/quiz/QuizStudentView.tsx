/**
 * Quiz Student View (Shared Quiz)
 * 
 * Asynchronous quiz mode - students can access anytime via link
 * - Persistent student identity
 * - Auto-reconnect on page reload
 * - Progress saved to Firebase
 * - Same design as live session
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { ref, onValue, off, update, set, get } from 'firebase/database';
import { database } from '../../utils/firebase-config';
import {
  CheckCircle,
  HelpCircle,
  ArrowRight,
  ArrowLeft,
  Send,
  X,
  XCircle,
  RefreshCw,
  WifiOff,
  AlertCircle,
  Users,
  Play,
  Calculator,
} from 'lucide-react';
import { MathInputModal, MathDisplay } from '../math/MathKeyboard';
import { MathText } from '../math/MathText';
import { AutoScaleQuestion } from './AutoScaleQuestion';
import { 
  Quiz, 
  QuizSlide, 
  ABCActivitySlide, 
  OpenActivitySlide, 
  BoardActivitySlide,
  VotingActivitySlide,
  ConnectPairsActivitySlide,
  FillBlanksActivitySlide,
  ImageHotspotsActivitySlide,
  VideoQuizActivitySlide,
  SlideResponse,
  InfoSlide,
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

const QUIZ_SHARES_PATH = 'quiz_shares';
const STUDENT_SHARE_KEY = 'vivid-share-session';
const STUDENT_IDENTITY_KEY = 'vivid-student-identity';

// ============================================
// TYPES
// ============================================

interface ShareData {
  quizId: string;
  quizData: Quiz;
  sessionName: string;
  shareCode: string;
  settings: {
    anonymousAccess: boolean;
    showSolutionHints: boolean;
    showActivityResults: boolean;
    requireAnswerToProgress: boolean;
    showNotes: boolean;
  };
  createdAt: string;
  createdBy: string;
}

interface StudentShareData {
  studentId: string;
  studentName: string;
  schoolName?: string;
  joinedAt: string;
  lastActiveAt: string;
  currentSlide: number;
  isOnline: boolean;
  completedAt?: string;
  responses: Record<string, SlideResponse>;
  deviceId: string;
  // Time tracking
  startTime?: string;
  totalTimeMs?: number;
}

interface SavedShareSession {
  shareId: string;
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

function getDeviceId(): string {
  let deviceId = localStorage.getItem('vivid-device-id');
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('vivid-device-id', deviceId);
  }
  return deviceId;
}

function getStudentIdentity(name?: string): StudentIdentity {
  const saved = localStorage.getItem(STUDENT_IDENTITY_KEY);
  if (saved) {
    const identity = JSON.parse(saved) as StudentIdentity;
    if (name && name !== identity.name) {
      identity.name = name;
      localStorage.setItem(STUDENT_IDENTITY_KEY, JSON.stringify(identity));
    }
    return identity;
  }
  
  const newIdentity: StudentIdentity = {
    id: `student_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: name || '',
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(STUDENT_IDENTITY_KEY, JSON.stringify(newIdentity));
  return newIdentity;
}

function getSavedShareSession(shareId: string): SavedShareSession | null {
  const saved = localStorage.getItem(`${STUDENT_SHARE_KEY}_${shareId}`);
  return saved ? JSON.parse(saved) : null;
}

function saveShareSession(shareId: string, session: SavedShareSession): void {
  localStorage.setItem(`${STUDENT_SHARE_KEY}_${shareId}`, JSON.stringify(session));
}

function clearShareSession(shareId: string): void {
  localStorage.removeItem(`${STUDENT_SHARE_KEY}_${shareId}`);
}

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

export function QuizStudentView() {
  const { shareId } = useParams<{ shareId: string }>();
  
  // Connection state
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  
  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Loading state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Session state
  const [shareData, setShareData] = useState<ShareData | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [studentName, setStudentName] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [hasStarted, setHasStarted] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  
  // Quiz progress
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [prevSlideIndex, setPrevSlideIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [responses, setResponses] = useState<Record<string, SlideResponse>>({});
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [formAnswer, setFormAnswer] = useState<Record<string, string | string[]>>({});
  const [showMathKeyboard, setShowMathKeyboard] = useState(false);
  
  // Time tracking
  const [sessionStartTime] = useState<number>(Date.now());
  const [slideStartTime, setSlideStartTime] = useState<number>(Date.now());
  
  // Wiggle animation for answer button
  const [showWiggle, setShowWiggle] = useState(false);
  const answerButtonRef = useRef<HTMLButtonElement | null>(null);
  
  // Refs
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);

  // ============================================
  // NETWORK STATUS
  // ============================================
  
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setConnectionError(null);
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
  }, []);

  // ============================================
  // LOAD SHARE DATA & AUTO-RECONNECT
  // ============================================
  
  useEffect(() => {
    if (!shareId) {
      setLoading(false);
      setError('Chybí ID sdílení');
      return;
    }
    
    // Check for saved session
    const savedSession = getSavedShareSession(shareId);
    const identity = getStudentIdentity();
    
    // Pre-fill name from identity
    if (identity.name && !studentName) {
      setStudentName(identity.name);
    }
    
    // Load share data from Firebase
    const loadShareData = async () => {
      try {
        const shareRef = ref(database, `${QUIZ_SHARES_PATH}/${shareId}`);
        const snapshot = await get(shareRef);
        
        if (!snapshot.exists()) {
          setError('Kvíz nenalezen nebo odkaz vypršel');
          setLoading(false);
          return;
        }
        
        const data = snapshot.val() as ShareData;
        setShareData(data);
        setQuiz(data.quizData);
        
        // Try to reconnect if we have saved session
        if (savedSession) {
          console.log('Found saved share session, attempting reconnect:', savedSession);
          await attemptReconnect(data, savedSession);
        } else if (data.settings.anonymousAccess) {
          // Auto-start for anonymous access
          const newStudentId = identity.id;
          setStudentId(newStudentId);
          setStudentName('Anonymní');
          setHasStarted(true);
          
          // Register anonymous student
          await registerStudent(newStudentId, 'Anonymní');
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Failed to load share data:', err);
        setError('Nepodařilo se načíst kvíz');
        setLoading(false);
      }
    };
    
    loadShareData();
    
    // Listen for real-time updates
    const shareRef = ref(database, `${QUIZ_SHARES_PATH}/${shareId}`);
    const unsubscribe = onValue(shareRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setShareData(data as ShareData);
        if (data.quizData) {
          setQuiz(data.quizData);
        }
      }
    });
    
    return () => off(shareRef);
  }, [shareId]);

  // Attempt reconnect to saved session
  const attemptReconnect = async (shareData: ShareData, savedSession: SavedShareSession) => {
    setIsReconnecting(true);
    
    try {
      const studentRef = ref(database, `${QUIZ_SHARES_PATH}/${shareId}/responses/${savedSession.studentId}`);
      const snapshot = await get(studentRef);
      
      if (snapshot.exists()) {
        const studentData = snapshot.val() as StudentShareData;
        
        // Restore state
        setStudentId(savedSession.studentId);
        setStudentName(savedSession.studentName);
        setResponses(studentData.responses || {});
        setCurrentSlideIndex(studentData.currentSlide || 0);
        setHasStarted(true);
        
        // Check if already completed
        if (studentData.completedAt) {
          setIsCompleted(true);
        }
        
        // Update online status
        await update(studentRef, {
          isOnline: true,
          lastActiveAt: new Date().toISOString(),
          deviceId: getDeviceId(),
        });
        
        console.log('Successfully reconnected to share session');
      } else {
        // Student record doesn't exist, clear saved session
        clearShareSession(shareId!);
      }
    } catch (error) {
      console.error('Reconnect failed:', error);
      clearShareSession(shareId!);
    } finally {
      setIsReconnecting(false);
    }
  };

  // Register new student
  const registerStudent = async (newStudentId: string, name: string, school?: string) => {
    if (!shareId) return;
    
    const studentData: StudentShareData = {
      studentId: newStudentId,
      studentName: name,
      schoolName: school || '',
      joinedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      currentSlide: 0,
      isOnline: true,
      responses: {},
      deviceId: getDeviceId(),
      // Time tracking
      startTime: new Date().toISOString(),
      totalTimeMs: 0,
    };
    
    try {
      await retryOperation(() =>
        set(ref(database, `${QUIZ_SHARES_PATH}/${shareId}/responses/${newStudentId}`), studentData)
      );
      
      // Save to localStorage
      saveShareSession(shareId, {
        shareId,
        studentId: newStudentId,
        studentName: name,
        joinedAt: studentData.joinedAt,
      });
    } catch (error) {
      console.error('Failed to register student:', error);
      setConnectionError('Nepodařilo se zaregistrovat');
    }
  };

  // ============================================
  // HEARTBEAT
  // ============================================
  
  useEffect(() => {
    if (!shareId || !studentId || !hasStarted) return;
    
    const updateHeartbeat = async () => {
      try {
        await update(ref(database, `${QUIZ_SHARES_PATH}/${shareId}/responses/${studentId}`), {
          lastActiveAt: new Date().toISOString(),
          isOnline: true,
          currentSlide: currentSlideIndex,
        });
      } catch (error) {
        console.warn('Heartbeat failed:', error);
      }
    };
    
    updateHeartbeat();
    // Optimized: 45s heartbeat for better scalability with many students
    heartbeatInterval.current = setInterval(updateHeartbeat, 45000);
    
    return () => {
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }
    };
  }, [shareId, studentId, hasStarted, currentSlideIndex]);

  // ============================================
  // ONLINE STATUS
  // ============================================
  
  useEffect(() => {
    if (!shareId || !studentId) return;
    
    const handleBeforeUnload = () => {
      update(ref(database, `${QUIZ_SHARES_PATH}/${shareId}/responses/${studentId}`), { 
        isOnline: false 
      });
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      update(ref(database, `${QUIZ_SHARES_PATH}/${shareId}/responses/${studentId}`), { 
        isOnline: false 
      });
    };
  }, [shareId, studentId]);

  // ============================================
  // START SESSION
  // ============================================
  
  const startSession = async () => {
    if (!studentName.trim() || !shareId) return;
    
    const identity = getStudentIdentity(studentName);
    
    // Check if student with same name already exists
    try {
      const responsesRef = ref(database, `${QUIZ_SHARES_PATH}/${shareId}/responses`);
      const snapshot = await get(responsesRef);
      
      let existingStudentId: string | null = null;
      
      if (snapshot.exists()) {
        const responses = snapshot.val();
        const existing = Object.entries(responses).find(
          ([_, data]: [string, any]) => data.studentName?.toLowerCase() === studentName.toLowerCase()
        );
        if (existing) {
          existingStudentId = existing[0];
          console.log('Found existing student by name:', existingStudentId);
        }
      }
      
      const finalStudentId = existingStudentId || identity.id;
      
      if (existingStudentId) {
        // Reconnect to existing record
        const studentData = snapshot.val()[existingStudentId] as StudentShareData;
        setStudentId(finalStudentId);
        setResponses(studentData.responses || {});
        setCurrentSlideIndex(studentData.currentSlide || 0);
        
        if (studentData.completedAt) {
          setIsCompleted(true);
        }
        
        await update(ref(database, `${QUIZ_SHARES_PATH}/${shareId}/responses/${finalStudentId}`), {
          isOnline: true,
          lastActiveAt: new Date().toISOString(),
          deviceId: getDeviceId(),
        });
      } else {
        // Create new record
        setStudentId(finalStudentId);
        await registerStudent(finalStudentId, studentName, schoolName);
      }
      
      // Save session
      saveShareSession(shareId, {
        shareId,
        studentId: finalStudentId,
        studentName,
        joinedAt: new Date().toISOString(),
      });
      
      setHasStarted(true);
    } catch (error) {
      console.error('Failed to start session:', error);
      setConnectionError('Nepodařilo se připojit');
    }
  };

  // ============================================
  // ANSWER HANDLING
  // ============================================
  
  const submitAnswer = useCallback(async () => {
    if (!quiz || !shareId || !studentId) return;
    
    const currentSlide = quiz.slides[currentSlideIndex];
    if (!currentSlide || currentSlide.type !== 'activity') return;
    
    // Check if already answered
    if (responses[currentSlide.id]) return;
    
    let isCorrect = false;
    let answer: string = '';
    
    if ((currentSlide as any).activityType === 'abc') {
      const abcSlide = currentSlide as ABCActivitySlide;
      const correctOption = abcSlide.options.find(o => o.isCorrect);
      isCorrect = selectedOption === correctOption?.id;
      answer = selectedOption || '';
    } else if ((currentSlide as any).activityType === 'open') {
      const openSlide = currentSlide as OpenActivitySlide;
      // Use mathematical comparison for numeric answers
      isCorrect = checkMathAnswer(textAnswer, openSlide.correctAnswers);
      answer = textAnswer;
    } else if ((currentSlide as any).activityType === 'example') {
      const exampleSlide = currentSlide as ExampleActivitySlide;
      // Use mathematical comparison for example answers
      const correctAnswers = exampleSlide.finalAnswer ? [exampleSlide.finalAnswer] : [];
      isCorrect = checkMathAnswer(textAnswer, correctAnswers);
      answer = textAnswer;
    } else if ((currentSlide as any).activityType === 'form') {
      // Form answers are stored as JSON string
      answer = JSON.stringify(formAnswer);
      isCorrect = true; // Forms are not scored
    }
    
    // Calculate time spent on this slide in seconds
    const timeSpentSeconds = Math.round((Date.now() - slideStartTime) / 1000);
    
    const response: SlideResponse = {
      slideId: currentSlide.id,
      activityType: (currentSlide as any).activityType,
      answer,
      isCorrect,
      points: isCorrect ? ((currentSlide as any).points || 1) : 0,
      answeredAt: new Date().toISOString(),
      timeSpent: timeSpentSeconds,
    };
    
    const newResponses = { ...responses, [currentSlide.id]: response };
    setResponses(newResponses);
    
    // Calculate total session time
    const totalTimeMs = Date.now() - sessionStartTime;
    
    // Save to Firebase
    try {
      await retryOperation(() =>
        update(ref(database, `${QUIZ_SHARES_PATH}/${shareId}/responses/${studentId}`), {
          responses: newResponses,
          currentSlide: currentSlideIndex,
          lastActiveAt: new Date().toISOString(),
          totalTimeMs,
        })
      );
    } catch (error) {
      console.error('Failed to save answer:', error);
      setConnectionError('Odpověď se možná neuložila');
    }
  }, [quiz, shareId, studentId, currentSlideIndex, responses, selectedOption, textAnswer, formAnswer, slideStartTime, sessionStartTime]);

  // ============================================
  // NAVIGATION
  // ============================================
  
  const goToPrevSlide = () => {
    if (currentSlideIndex > 0 && !isAnimating) {
      setIsAnimating(true);
      setPrevSlideIndex(currentSlideIndex);
      setCurrentSlideIndex(prev => prev - 1);
      setSelectedOption(null);
      setTextAnswer('');
      setSlideStartTime(Date.now()); // Reset slide timer
      setTimeout(() => setIsAnimating(false), 450);
    }
  };
  
  const goToNextSlide = async () => {
    if (!quiz || !shareId || !studentId || isAnimating) return;
    
    const currentSlide = quiz.slides[currentSlideIndex];
    
    // Check if answer required
    if (shareData?.settings.requireAnswerToProgress && currentSlide.type === 'activity') {
      if (!responses[currentSlide.id]) {
        return;
      }
    }
    
    if (currentSlideIndex < quiz.slides.length - 1) {
      setIsAnimating(true);
      setPrevSlideIndex(currentSlideIndex);
      setCurrentSlideIndex(prev => prev + 1);
      setSelectedOption(null);
      setTextAnswer('');
      setSlideStartTime(Date.now()); // Reset slide timer
      setTimeout(() => setIsAnimating(false), 450);
      
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
      
      // Update progress
      await update(ref(database, `${QUIZ_SHARES_PATH}/${shareId}/responses/${studentId}`), {
        currentSlide: currentSlideIndex + 1,
        lastActiveAt: new Date().toISOString(),
      });
    } else {
      // Complete the quiz - save final total time
      const totalTimeMs = Date.now() - sessionStartTime;
      await update(ref(database, `${QUIZ_SHARES_PATH}/${shareId}/responses/${studentId}`), {
        completedAt: new Date().toISOString(),
        isOnline: false,
        totalTimeMs,
      });
      setIsCompleted(true);
    }
  };

  // ============================================
  // COMPUTED VALUES
  // ============================================
  
  const currentSlide = quiz && quiz.slides ? quiz.slides[currentSlideIndex] : undefined;
  const currentResponse = currentSlide && responses ? responses[currentSlide.id] : undefined;
  const hasAnswered = !!currentResponse;

  // Helper to collect form responses for certificate
  const collectFormResponses = useCallback((): Record<string, Record<string, string | string[]>> => {
    const formResponses: Record<string, Record<string, string | string[]>> = {};
    
    if (quiz) {
      quiz.slides.forEach(slide => {
        if (slide.type === 'activity' && (slide as any).activityType === 'form') {
          const response = responses[slide.id];
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
          
          // If formAnswer has data for this slide (user filled but maybe not saved yet, or saved with old code)
          // Check if any field ID in formAnswer matches this slide's fields
          const formSlide = slide as any;
          if (formSlide.fields && formSlide.fields.length > 0) {
            const slideFieldIds = formSlide.fields.map((f: any) => f.id);
            const hasDataForThisSlide = Object.keys(formAnswer).some(key => slideFieldIds.includes(key));
            
            if (hasDataForThisSlide && Object.keys(formAnswer).length > 0) {
              // Use formAnswer data for this slide
              formResponses[slide.id] = formAnswer;
            }
          }
        }
      });
    }
    
    return formResponses;
  }, [quiz, responses, formAnswer]);
  
  // Board posts for current slide (if it's a board activity)
  const boardPosts = useBoardPosts({
    sessionId: shareId || null,
    slideId: currentSlide?.id || '',
    currentUserId: studentId || undefined,
    currentUserName: studentName || undefined,
  });
  
  // Voting for current slide (if it's a voting activity)
  const voting = useVoting({
    sessionId: shareId || null,
    slideId: currentSlide?.id || '',
    currentUserId: studentId || undefined,
    currentUserName: studentName || undefined,
  });
  
  const responsesArray = responses ? Object.values(responses) : [];
  const correctCount = responsesArray.filter(function(r) { return r && r.isCorrect; }).length;
  const wrongCount = responsesArray.filter(function(r) { return r && !r.isCorrect; }).length;
  const totalQuestions = quiz && quiz.slides ? quiz.slides.filter(function(s) { return s.type === 'activity'; }).length : 0;
  
  const canProceed = () => {
    // If requireAnswerToProgress is disabled, always allow proceeding
    if (!shareData?.settings?.requireAnswerToProgress) return true;
    
    // Otherwise, require answer for activity slides before proceeding
    if (!currentSlide || currentSlide.type !== 'activity') return true;
    return !!responses[currentSlide.id]; // Must have submitted answer
  };

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
  // RENDER: CONNECTION BANNER
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
        ) : (
          <>
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium">{connectionError}</span>
          </>
        )}
      </div>
    );
  };

  // ============================================
  // RENDER: PROGRESS BAR
  // ============================================
  
  const renderProgressBar = () => {
    if (!quiz) return null;
    
    return (
      <>
        {currentSlideIndex >= 0 && (
          <div
            className="rounded-full"
            style={{ 
              height: '8px',
              backgroundColor: '#475569',
              flex: currentSlideIndex + 1
            }}
          />
        )}
        {quiz.slides.slice(currentSlideIndex + 1).map((_, idx) => (
          <div
            key={idx}
            className="flex-1 rounded-full"
            style={{ 
              height: '8px',
              backgroundColor: '#CBD5E1'
            }}
          />
        ))}
      </>
    );
  };

  // ============================================
  // RENDER: LOADING
  // ============================================
  
  if (loading || isReconnecting) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">
            {isReconnecting ? 'Obnovuji připojení...' : 'Načítám kvíz...'}
          </p>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: ERROR
  // ============================================
  
  if (error || !quiz || !shareData) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="text-center">
          <HelpCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-600 mb-2">Kvíz nenalezen</h1>
          <p className="text-slate-500">{error || 'Tento odkaz je neplatný nebo vypršel.'}</p>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: START SCREEN
  // ============================================
  
  if (!hasStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-700 flex items-center justify-center p-4">
        {renderConnectionBanner()}
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Připojte se do soutěže!</h1>
            <p className="text-slate-500 mt-1">{quiz.title}</p>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Jméno
              </label>
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Jan Novák"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-lg"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Jméno školy
              </label>
              <input
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="ZŠ Příklad"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-lg"
              />
            </div>
            
            <button
              onClick={startSession}
              disabled={!studentName.trim() || !isOnline}
              className="w-full py-4 rounded-2xl text-white font-bold text-lg transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#7C3AED' }}
            >
              {!isOnline ? (
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
            
            <p className="text-center text-sm text-slate-400">
              {quiz.slides.filter(s => s.type === 'activity').length} otázek
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: COMPLETED
  // ============================================
  
  if (isCompleted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          
          <h2 className="text-2xl font-bold text-slate-800 mb-2">
            Kvíz dokončen!
          </h2>
          
          {shareData.settings.showActivityResults && totalQuestions > 0 && (
            <div className="bg-slate-50 rounded-2xl p-6 my-6">
              <div className="text-5xl font-bold text-green-600 mb-2">
                {totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0}%
              </div>
              <p className="text-slate-600">
                {correctCount} z {totalQuestions} správně
              </p>
            </div>
          )}
          
          <p className="text-slate-500">Děkujeme za účast, {studentName}!</p>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: QUIZ VIEW
  // ============================================
  
  if (!currentSlide) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <p className="text-slate-500">Čekám na otázku...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen" style={{ backgroundColor: '#F0F1F8' }}>
      {renderConnectionBanner()}
      
      {/* Desktop: Top bar - height 40px to match margin requirement */}
      <div 
        className="hidden lg:flex items-end justify-center px-6" 
        style={{ 
          backgroundColor: '#F0F1F8', 
          height: 40,
          paddingBottom: 8,
        }}
      >
        {/* Center: Progress bar */}
        <div className="flex items-center gap-1.5" style={{ width: '50%', maxWidth: '600px' }}>
          {renderProgressBar()}
        </div>
      </div>
      
      {/* Mobile: Top navigation */}
      <div className="flex lg:hidden items-center gap-3 px-4 py-4" style={{ backgroundColor: '#F0F1F8' }}>
        <button
          onClick={goToPrevSlide}
          disabled={currentSlideIndex === 0}
          className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${currentSlideIndex === 0 ? 'opacity-30 cursor-not-allowed' : ''} bg-[#CBD5E1] text-slate-600`}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        
        <div className="flex-1 flex items-center gap-1.5">
          {renderProgressBar()}
        </div>
        
        <button
          onClick={() => canProceed() ? goToNextSlide() : triggerWiggle()}
          className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${!canProceed() ? 'bg-slate-300 text-slate-400' : 'text-white'}`}
          style={{ backgroundColor: canProceed() ? '#7C3AED' : undefined }}
        >
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
      
      {/* Main content */}
      <div 
        className="flex-1 flex flex-col overflow-hidden" 
        style={{ 
          backgroundColor: '#F0F1F8',
          minHeight: 0,
        }}
      >
        {/* Content with arrows - bottom padding */}
        <div className="flex-1 flex items-stretch overflow-hidden" style={{ minHeight: 0, paddingBottom: isMobile ? 8 : 5 }}>
          {/* Desktop: Left arrow */}
          <div className="hidden lg:flex flex-shrink-0 items-center justify-center" style={{ width: 65 }}>
            <button
              onClick={goToPrevSlide}
              disabled={currentSlideIndex === 0}
              className={`w-12 h-12 rounded-full bg-[#CBD5E1] flex items-center justify-center text-slate-600 transition-all duration-300 ease-out ${currentSlideIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:h-24'}`}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>
          
          {/* Slide card - fills remaining space */}
          <div 
            className="flex-1"
            style={{
              minHeight: 0,
              overflowY: isMobile ? 'auto' : 'hidden',
              overflowX: 'hidden',
              WebkitOverflowScrolling: 'touch',
              // Padding for shadow visibility
              padding: isMobile ? 8 : 16,
            }}
          >
            <div 
              className={`
                w-full rounded-3xl overflow-hidden flex flex-col
                ${currentSlide?.type === 'tools' && (currentSlide as ToolsSlide).toolType === 'certificate' && (currentSlide as ToolsSlide).certificateConfig?.customPdfUrl ? '' : 'bg-white shadow-md'}
                ${currentSlide?.type !== 'info' ? 'max-w-5xl mx-auto' : ''}
                ${currentSlideIndex > prevSlideIndex && isAnimating ? 'animate-slide-in' : ''}
                ${currentSlideIndex < prevSlideIndex && isAnimating ? 'animate-slide-in-left' : ''}
              `}
              style={{
                // Fill available space - on mobile, use minHeight to ensure background extends
                height: isMobile ? 'auto' : '100%',
                minHeight: isMobile ? 'calc(100vh - 140px)' : undefined,
              }}
              key={currentSlideIndex}
            >
              {/* Info slide with block layout - render ONLY BlockLayoutView */}
              {currentSlide.type === 'info' && (currentSlide as InfoSlide).layout && (currentSlide as InfoSlide).layout!.blocks.length > 0 ? (
                <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
                  <BlockLayoutView slide={currentSlide as InfoSlide} />
                </div>
              ) : (
                <>
                  {/* Question - only for activity slides (except those with their own display) */}
                  {currentSlide.type === 'activity' && currentSlide.activityType !== 'board' && currentSlide.activityType !== 'voting' && currentSlide.activityType !== 'connect-pairs' && currentSlide.activityType !== 'fill-blanks' && currentSlide.activityType !== 'image-hotspots' && currentSlide.activityType !== 'video-quiz' && currentSlide.activityType !== 'form' && (
                    <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
                      <AutoScaleQuestion>
                        {(currentSlide as any).question || (currentSlide as any).title || ''}
                      </AutoScaleQuestion>
                      
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
              {currentSlide.type === 'activity' && (currentSlide as any).activityType === 'abc' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 p-4 md:p-6 max-w-4xl mx-auto w-full">
                    {(currentSlide as ABCActivitySlide).options.map((option) => {
                      const isSelected = selectedOption === option.id;
                      const showResult = hasAnswered && shareData.settings.showActivityResults;
                      const isCorrect = showResult && option.isCorrect;
                      const wasSelected = currentResponse?.answer === option.id;
                      const isWrong = showResult && wasSelected && !option.isCorrect;
                      
                      return (
                        <button
                          key={option.id}
                          onClick={() => !hasAnswered && setSelectedOption(option.id)}
                          disabled={hasAnswered}
                          className={`
                            relative p-3 lg:p-4 rounded-2xl text-left transition-all border-2 flex items-center gap-3 lg:gap-4
                            ${isCorrect ? 'bg-green-50 border-green-500' : ''}
                            ${isWrong ? 'bg-red-50 border-red-500' : ''}
                            ${!hasAnswered && isSelected ? 'border-indigo-500 bg-indigo-50' : ''}
                            ${!hasAnswered && !isSelected ? 'bg-white border-slate-100 hover:border-indigo-200 hover:shadow-md' : ''}
                            ${showResult && !isCorrect && !isWrong ? 'bg-white border-slate-100 opacity-50' : ''}
                          `}
                        >
                          <span 
                            className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl flex items-center justify-center font-bold text-base lg:text-lg flex-shrink-0 transition-colors"
                            style={{
                              backgroundColor: isCorrect ? '#bbf7d0' 
                                : isWrong ? '#fecaca'
                                : !hasAnswered && isSelected ? '#c7d2fe' 
                                : '#E2E8F0',
                              color: isCorrect ? '#166534' 
                                : isWrong ? '#991b1b'
                                : !hasAnswered && isSelected ? '#3730a3' 
                                : '#475569',
                            }}
                          >
                            {option.label || option.id?.toUpperCase() || '?'}
                          </span>
                          <span className="text-base sm:text-lg lg:text-xl font-medium text-[#4E5871] flex-1 break-words overflow-hidden">
                            <MathText>{option.content || ''}</MathText>
                          </span>
                          
                          {isCorrect && <CheckCircle className="w-6 h-6 text-green-600" />}
                        </button>
                      );
                    })}
                  </div>
                  
                  {/* Show explanation/hint for ABC after answer */}
                  {shareData.settings.showSolutionHints && hasAnswered && (currentSlide as ABCActivitySlide).explanation && (
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
              {currentSlide.type === 'activity' && ((currentSlide as any).activityType === 'open' || (currentSlide as any).activityType === 'example') && (
                <div className="w-full max-w-2xl mx-auto px-6">
                  <div className="relative">
                    {/* Math icon for Example only */}
                    {(currentSlide as any).activityType === 'example' && !hasAnswered && (
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
                      disabled={hasAnswered}
                      placeholder="Napište svou odpověď..."
                      className={`
                        w-full px-6 py-4 rounded-2xl border-2 text-xl text-center outline-none transition-all
                        ${(currentSlide as any).activityType === 'example' && !hasAnswered ? 'pl-12' : ''}
                        ${hasAnswered && shareData.settings.showActivityResults
                          ? currentResponse?.isCorrect 
                            ? 'bg-green-50 border-green-500' 
                            : 'bg-red-50 border-red-500'
                          : 'border-slate-200 focus:border-indigo-400'
                        }
                      `}
                    />
                  </div>
                  
                  {/* Math preview - only when typing */}
                  {textAnswer.includes('$') && !hasAnswered && (
                    <div className="mt-3 p-3 bg-slate-50 rounded-xl text-center">
                      <span className="text-xs text-slate-400 block mb-1">Náhled:</span>
                      <div className="text-lg text-[#4E5871]">
                        <MathText>{textAnswer}</MathText>
                      </div>
                    </div>
                  )}
                  
                  {hasAnswered && shareData.settings.showActivityResults && (
                    <div className="mt-4 flex items-center justify-center gap-2">
                      {currentResponse?.isCorrect ? (
                        <>
                          <CheckCircle className="w-6 h-6 text-green-500" />
                          <span className="text-green-600 font-medium">Správně!</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-6 h-6 text-red-500" />
                          <span className="text-red-600">
                            Správně: <MathText>
                              {(currentSlide as any).activityType === 'example' 
                                ? (currentSlide as ExampleActivitySlide).finalAnswer 
                                : (currentSlide as OpenActivitySlide).correctAnswers?.[0] || ''}
                            </MathText>
                          </span>
                        </>
                      )}
                    </div>
                  )}
                  
                  {/* Show explanation/hint for open question after answer */}
                  {shareData.settings.showSolutionHints && hasAnswered && (currentSlide as any).explanation && (
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
                    currentUserName={studentName || undefined}
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
                      // Handle submission
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
                      // Handle submission
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
                      // Handle submission
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
                      // Handle submission
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
              
              {/* Submit button - only for activity slides (except board and voting which have their own buttons) */}
              {currentSlide.type === 'activity' && currentSlide.activityType !== 'board' && currentSlide.activityType !== 'voting' && (
              <div className="flex justify-center py-6 md:py-10">
                {!hasAnswered ? (
                  <button
                    ref={answerButtonRef}
                    onClick={submitAnswer}
                    disabled={
                      ((currentSlide as any).activityType === 'abc' && !selectedOption) ||
                      ((currentSlide as any).activityType === 'open' && !textAnswer.trim()) ||
                      ((currentSlide as any).activityType === 'example' && !textAnswer.trim()) ||
                      // Form: disabled if required fields are not filled
                      ((currentSlide as any).activityType === 'form' && 
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
                ) : currentSlideIndex < quiz.slides.length - 1 ? (
                  <button
                    onClick={goToNextSlide}
                    className="flex items-center gap-2 px-8 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
                  >
                    Další otázka
                    <ArrowRight className="w-5 h-5" />
                  </button>
                ) : (
                  <button
                    onClick={goToNextSlide}
                    className="flex items-center gap-2 px-8 py-3 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Dokončit kvíz
                  </button>
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
            <button
              onClick={() => canProceed() ? goToNextSlide() : triggerWiggle()}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ease-out ${!canProceed() ? 'bg-slate-300 text-slate-400' : 'text-white hover:h-24'}`}
              style={{ backgroundColor: canProceed() ? '#7C3AED' : undefined }}
            >
              <ArrowRight className="w-5 h-5" />
            </button>
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

export default QuizStudentView;
