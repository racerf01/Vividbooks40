import { BrowserRouter as Router, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { Toaster } from './components/ui/sonner';
import { DocumentationLayout } from './components/DocumentationLayout';
import { NewAdminLayout } from './components/NewAdminLayout';
import { AdminEditor } from './components/AdminEditor';
import { WelcomePage } from './components/WelcomePage';
import { MyContentLayout } from './components/MyContentLayout';
import { MyContentEditor } from './components/MyContentEditor';
import { MyClassesLayout } from './components/MyClassesLayout';
import { WorksheetEditorLayout } from './components/WorksheetEditorLayout';
import { ProEditorLayout } from './components/worksheet-editor-pro';
import { WorkbookProLayout } from './components/workbook-editor-pro';
import { PaperTestPage } from './components/worksheet-editor/PaperTestPage';
import { PaperTestUploadPage } from './components/worksheet-editor/PaperTestUploadPage';
import { QuizEditorLayout } from './components/quiz/QuizEditorLayout';
import { QuizViewPage } from './components/quiz/QuizViewPage';
import { QuizJoinPage } from './components/quiz/QuizJoinPage';
import { QuizResultsPage } from './components/quiz/QuizResultsPage';
import { QuizStudentView } from './components/quiz/QuizStudentView';
import { QuizSelfStudyPage } from './components/quiz/QuizSelfStudyPage';
import { PublicBoardViewer } from './components/quiz/PublicBoardViewer';
import { BoardCopyPage } from './components/quiz/BoardCopyPage';
import { ProfilePageLayout, LicenseAdminPage } from './components/profile';
import { StudentWallLayout } from './components/StudentWallLayout';
import { SharedFolderView } from './components/SharedFolderView';
import { PracticeLayout } from './components/PracticeLayout';
import { ViewModeProvider } from './contexts/ViewModeContext';
import { ClassroomShareProvider } from './contexts/ClassroomShareContext';
import { StudentAuthProvider } from './contexts/StudentAuthContext';
import { FirebaseStudentView } from './components/classroom';
import { JoinSession } from './components/classroom/JoinSession';
import { CustomerSuccess } from './components/admin/CustomerSuccess';
import { MigrationAgent } from './components/admin/MigrationAgent';
import { RAGBulkUpload } from './components/admin/RAGBulkUpload';
import { CurriculumFactory } from './components/admin/CurriculumFactory';
import { DataSetCreator } from './components/admin/DataSetCreator';
import { StudentProfilePage } from './components/classroom/StudentProfilePage';
import ClassChatLayout from './components/classroom/ClassChatLayout';
import { StudentLoginPage, StudentSetupPassword, StudentDashboard, LiveSessionNotification } from './components/student';
import { StudentWorkspace } from './components/student/StudentWorkspace';
import { StudentContentLayout } from './components/student/StudentContentLayout';
import { StudentAssignmentEditor } from './components/student/StudentAssignmentEditor';
import { TeacherLoginPage } from './components/teacher/TeacherLoginPage';
import { AuthCallback } from './components/auth/AuthCallback';
import { LogoutPage } from './components/auth/LogoutPage';
import { LibraryLandingPage } from './components/library/LibraryLandingPage';
import { supabase } from './utils/supabase/client';
import { projectId, publicAnonKey } from './utils/supabase/info.tsx';
import { fetchWithRetry } from './utils/supabase/fetch-helper';
import { syncFromSupabase as syncQuizzes, migrateToSupabase as migrateQuizzes } from './utils/quiz-storage';
import { syncFromSupabase as syncFolders, migrateToSupabase as migrateFolders } from './utils/folder-storage';
import { syncLinksFromSupabase, migrateLinksToSupabase } from './utils/link-storage';
import { syncFromSupabase as syncDocuments, migrateToSupabase as migrateDocuments } from './utils/document-storage';
import { syncFromSupabase as syncWorksheets, migrateToSupabase as migrateWorksheets } from './utils/worksheet-storage';
import { syncFromSupabase as syncFiles, migrateToSupabase as migrateFiles } from './utils/file-storage';

// Helper component to redirect /quiz/new while preserving URL params
function QuizNewRedirect() {
  const [searchParams] = useSearchParams();
  const newId = Date.now().toString();
  // Preserve all URL params
  const paramsString = searchParams.toString();
  const targetUrl = `/quiz/edit/${newId}${paramsString ? `?${paramsString}` : ''}`;
  return <Navigate to={targetUrl} replace />;
}

// OFFLINE MODE: Skip Supabase auth when ?offline=1 in URL or localStorage 'vividbooks-offline-mode' is set
const isOfflineMode = () => {
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('offline') === '1') {
      localStorage.setItem('vividbooks-offline-mode', 'true');
      return true;
    }
    return localStorage.getItem('vividbooks-offline-mode') === 'true';
  }
  return false;
};

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [offlineMode] = useState(isOfflineMode);

  useEffect(() => {
    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    }

    // OFFLINE MODE: Skip auth check entirely
    if (offlineMode) {
      console.log('[App] 🔌 OFFLINE MODE - skipping Supabase auth');
      setIsCheckingAuth(false);
      setIsAuthenticated(true); // Pretend we're authenticated for admin routes
      return;
    }

    // Check for existing session
    checkAuth();
    
    // Listen for auth state changes (login/logout) - skip in offline mode
    if (offlineMode) {
      return; // No cleanup needed
    }
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[App] Auth state change:', event, session?.user?.email);
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
        console.log('[App] Setting isAuthenticated=true');
        setIsAuthenticated(true);
        // Pass user and access token directly to avoid re-fetching session
        syncUserData(session.user, session.access_token);
      } else if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false);
      }
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, [offlineMode]);

  // Track if sync is already running
  const syncInProgress = useRef(false);
  
  const syncUserData = async (userFromEvent?: { id: string; email?: string }, accessToken?: string) => {
    // Prevent multiple parallel syncs
    if (syncInProgress.current) {
      console.log('[App] Sync already in progress, skipping');
      return;
    }
    syncInProgress.current = true;
    
    try {
      console.log('[App] Syncing user data... VERSION 10.0 (student detection)');
      
      // Skip teacher content sync for students
      // Students have a record in the 'students' table with auth_id = current user
      if (userFromEvent?.id) {
        try {
          const studentCheckRes = await fetchWithRetry(
            `https://${projectId}.supabase.co/rest/v1/students?auth_id=eq.${userFromEvent.id}&select=id`,
            { timeout: 5000, retries: 1 }
          );
          if (studentCheckRes.ok) {
            const students = await studentCheckRes.json();
            if (students && students.length > 0) {
              console.log('[App] User is a STUDENT, skipping teacher content sync');
              syncInProgress.current = false;
              return;
            }
          }
        } catch (e) {
          console.warn('[App] Failed to check if user is student:', e);
          // Continue with sync - assume teacher if check fails
        }
      }
      
      // Skip teacher content sync for admin users (they don't have teacher profiles)
      const isAdminUser = userFromEvent?.email?.endsWith('@admin.cz') || userFromEvent?.email === '123456@gmail.com';
      if (isAdminUser) {
        console.log('[App] User is an ADMIN, skipping teacher content sync');
        syncInProgress.current = false;
        return;
      }
      
      console.log('[App] User is not a student or admin, proceeding with teacher content sync');
      
      // Ensure School Code is present (Fix for "forgetting school code")
      if (userFromEvent?.id) {
        const storedSchoolId = localStorage.getItem('vivid-teacher-school');
        if (!storedSchoolId) {
          console.log('[App] School code missing in localStorage, attempting to restore from profile...');
          try {
            // Find teacher record by user_id to get school_id
            const teacherRes = await fetchWithRetry(
              `https://${projectId}.supabase.co/rest/v1/teachers?user_id=eq.${userFromEvent.id}&select=school_id`,
              { timeout: 5000, retries: 1 }
            );
            
            if (teacherRes.ok) {
              const teachers = await teacherRes.json();
              if (teachers && teachers.length > 0 && teachers[0].school_id) {
                console.log('[App] ✅ Found school_id in teacher profile:', teachers[0].school_id);
                
                // Fetch full school details
                try {
                  const schoolRes = await fetchWithRetry(
                    `https://${projectId}.supabase.co/rest/v1/schools?id=eq.${teachers[0].school_id}`,
                    { timeout: 5000, retries: 1 }
                  );
                  
                  if (schoolRes.ok) {
                    const schools = await schoolRes.json();
                    if (schools && schools.length > 0) {
                      console.log('[App] ✅ Restored school:', schools[0].name);
                      localStorage.setItem('vivid-teacher-school', JSON.stringify(schools[0]));
                    }
                  }
                } catch (e) {
                  console.warn('[App] Failed to restore school:', e);
                }
              } else {
                console.log('[App] No school_id found in teacher profile');
              }
            }
          } catch (err) {
            console.warn('[App] Failed to restore school code:', err);
          }
        }
      }

      // 1. Test Supabase connectivity first (using robust fetch)
      const testStart = Date.now();
      let supabaseConnected = false;
      try {
        // Simple ping to check if Supabase is alive/woken up
        const testResponse = await fetchWithRetry(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/`, {
          method: 'HEAD',
          headers: { 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY },
          timeout: 8000,
          retries: 1
        });
        
        supabaseConnected = testResponse.ok;
        console.log('[App] Supabase connectivity test:', testResponse.ok ? 'OK' : 'FAIL', `(${Date.now() - testStart}ms)`);
      } catch (testErr: any) {
        console.error('[App] ⚠️ Supabase connectivity FAILED:', testErr?.message, `(${Date.now() - testStart}ms)`);
        console.log('[App] Sync may not work properly - using local data only');
        // Show a warning to the user
        const toast = await import('sonner').then(m => m.toast);
        toast.warning('Nepodařilo se připojit k serveru. Data budou dostupná pouze lokálně.', {
          duration: 8000,
        });
      }
      
      // Use user from event directly if available (avoids getSession timeout)
      if (userFromEvent) {
        console.log('[App] User from auth event:', userFromEvent.email);
      } else {
        console.log('[App] No user from event, skipping sync (will retry on next auth event)');
        syncInProgress.current = false;
        return;
      }
      
      // Check if this is first sync (no data from Supabase yet)
      const hasSynced = localStorage.getItem('supabase-synced');
      
      if (!hasSynced) {
        // First time: migrate localStorage to Supabase IN BACKGROUND (don't block sync)
        console.log('[App] First sync - starting migration in background...');
        Promise.allSettled([
          migrateQuizzes(),
          migrateFolders(),
          migrateLinksToSupabase(),
          migrateDocuments(),
          migrateWorksheets(),
          migrateFiles(),
        ]).then(results => {
          console.log('[App] Migration results:', results);
          localStorage.setItem('supabase-synced', 'true');
        }).catch(migrationError => {
          console.error('[App] Migration error:', migrationError);
        });
      }
      
      // Always sync from Supabase to get latest data (DON'T WAIT for migration)
      console.log('[App] Syncing from Supabase... VERSION 7.0 (direct fetch in all sync)');
      try {
        // Get a fresh token with timeout to avoid hanging
        let freshToken = accessToken; // Use token from event first
        
        if (!freshToken) {
          try {
            const sessionPromise = supabase.auth.getSession();
            const timeoutPromise = new Promise<null>((resolve) => 
              setTimeout(() => resolve(null), 2000)
            );
            const result = await Promise.race([sessionPromise, timeoutPromise]);
            if (result && 'data' in result) {
              freshToken = result.data.session?.access_token;
            }
          } catch (e) {
            console.warn('[App] getSession failed, will try without token');
          }
        }
        
        const userId = userFromEvent.id;
        
        if (!freshToken) {
          console.error('[App] ❌ NO ACCESS TOKEN - sync will fail!');
          console.error('[App] This means quizzes/files will NOT sync to Supabase');
          syncInProgress.current = false;
          return;
        }

        // Wrap each sync in a timeout to prevent hanging
        const withTimeout = <T,>(promise: Promise<T>, name: string, timeoutMs: number = 20000): Promise<T | null> => {
          return new Promise<T | null>((resolve, reject) => {
            const timer = window.setTimeout(() => {
              console.warn(`[App] ${name} timed out after ${timeoutMs}ms`);
              resolve(null);
            }, timeoutMs);

            promise
              .then((value) => {
                window.clearTimeout(timer);
                resolve(value);
              })
              .catch((err) => {
                window.clearTimeout(timer);
                reject(err);
              });
          });
        };

        console.log('[App] ✅ Using access token for sync (length:', freshToken.length, ')');
        const syncStart = Date.now();
        
        // Run critical syncs first (parallel)
        const syncResults = await Promise.allSettled([
          withTimeout(syncQuizzes(userId, freshToken), 'syncQuizzes'),
          withTimeout(syncFolders(userId, freshToken), 'syncFolders'),
          withTimeout(syncWorksheets(userId, freshToken), 'syncWorksheets'),
        ]);
        
        // Notify components early - critical content is ready
        window.dispatchEvent(new CustomEvent('content-updated'));
        console.log('[App] Dispatched content-updated after critical syncs');
        
        // Run secondary syncs (parallel)
        const secondaryResults = await Promise.allSettled([
          withTimeout(syncLinksFromSupabase(userId, freshToken), 'syncLinks'),
          withTimeout(syncDocuments(userId, freshToken), 'syncDocuments'),
          withTimeout(syncFiles(userId, freshToken), 'syncFiles'),
        ]);

        const syncDuration = Date.now() - syncStart;
        console.log('[App] Sync results:', [...syncResults, ...secondaryResults], `(${syncDuration}ms)`);
        
        // Notify all components again after secondary content is ready
        window.dispatchEvent(new CustomEvent('content-updated'));
        console.log('[App] Dispatched content-updated event (final)');
      } catch (syncError) {
        console.error('[App] Sync error:', syncError);
      }
      
      console.log('[App] User data synced successfully');
    } catch (error) {
      console.error('[App] Error syncing user data:', error);
    } finally {
      syncInProgress.current = false;
    }
  };

  const checkAuth = async () => {
    // Add timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      console.log('[App] Auth check timeout, continuing...');
      setIsCheckingAuth(false);
    }, 5000); // Increased timeout for slower connections
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session?.access_token);
    } catch (error) {
      console.error('Auth check error:', error);
      setIsAuthenticated(false);
    } finally {
      clearTimeout(timeout);
      setIsCheckingAuth(false);
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  if (isCheckingAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <ViewModeProvider>
    <ClassroomShareProvider>
    <StudentAuthProvider>
    <Router basename={import.meta.env.PROD ? "/Vividbooks40" : ""}>
      {/* Toast notifications */}
      <Toaster position="top-center" richColors />
      
      {/* Firebase-based student view - for students when teacher is sharing */}
      <FirebaseStudentView />
      
      {/* Live session notification for logged-in students */}
      <LiveSessionNotification />
      
      <Routes>
        {/* Student routes */}
        <Route path="/student/login" element={<StudentLoginPage />} />
        <Route path="/student/setup/:token" element={<StudentSetupPassword />} />
        <Route path="/student/dashboard" element={<StudentDashboard />} />
        <Route path="/student/workspace" element={<StudentContentLayout theme={theme} toggleTheme={toggleTheme} />} />
        <Route path="/student/my-content" element={<StudentContentLayout theme={theme} toggleTheme={toggleTheme} />} />
        <Route path="/student/assignment/:assignmentId" element={<StudentAssignmentEditor theme={theme} toggleTheme={toggleTheme} />} />
        
        {/* Teacher routes */}
        <Route path="/teacher/login" element={<TeacherLoginPage />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/logout" element={<LogoutPage />} />
        <Route 
          path="/" 
          element={<WelcomePage theme={theme} toggleTheme={toggleTheme} />} 
        />
        
        <Route 
          path="/join/:sessionId" 
          element={<JoinSession />} 
        />
        
        <Route 
          path="/docs" 
          element={<Navigate to="/docs/knihovna-vividbooks" replace />} 
        />
        
        <Route 
          path="/docs/:category" 
          element={<DocumentationLayout theme={theme} toggleTheme={toggleTheme} />} 
        />
        
        <Route 
          path="/docs/:category/*" 
          element={<DocumentationLayout theme={theme} toggleTheme={toggleTheme} />} 
        />
        
        <Route 
          path="/library/my-content" 
          element={<MyContentLayout theme={theme} toggleTheme={toggleTheme} />} 
        />
        
        <Route 
          path="/library/my-content/view/:id" 
          element={<DocumentationLayout theme={theme} toggleTheme={toggleTheme} />} 
        />
        
        <Route 
          path="/library/my-content/edit/:id" 
          element={<MyContentEditor theme={theme} toggleTheme={toggleTheme} />} 
        />
        
        <Route 
          path="/library/my-library" 
          element={<MyContentLayout theme={theme} toggleTheme={toggleTheme} />} 
        />
        
        <Route 
          path="/library/my-classes" 
          element={<MyClassesLayout theme={theme} toggleTheme={toggleTheme} />} 
        />
        <Route 
          path="/library/student/:studentId" 
          element={<StudentProfilePage />} 
        />
        
        <Route 
          path="/library/student-wall" 
          element={<StudentWallLayout theme={theme} toggleTheme={toggleTheme} />} 
        />
        
        <Route path="/class-chat" element={<ClassChatLayout />} />
        <Route path="/class-chat/:classId" element={<ClassChatLayout />} />
        
        <Route 
          path="/library/student-wall/folder/:folderId" 
          element={<SharedFolderView theme={theme} toggleTheme={toggleTheme} />} 
        />

        <Route 
          path="/library/practice" 
          element={<PracticeLayout theme={theme} toggleTheme={toggleTheme} />} 
        />
        
        <Route 
          path="/library/profile" 
          element={<ProfilePageLayout theme={theme} toggleTheme={toggleTheme} />} 
        />
        
        <Route 
          path="/admin/licence" 
          element={
            isAuthenticated ? (
              <LicenseAdminPage />
            ) : (
              <Navigate to="/admin/login" replace />
            )
          } 
        />
        
        <Route 
          path="/admin/customer-success" 
          element={
            isAuthenticated ? (
              <CustomerSuccess />
            ) : (
              <Navigate to="/admin/login" replace />
            )
          } 
        />
        
        {/* Worksheet Editor Pro - Advanced internal editor */}
        <Route 
          path="/admin/worksheet-pro/:id" 
          element={
            isAuthenticated || isOfflineMode() ? (
              <ProEditorLayout theme={theme} toggleTheme={toggleTheme} />
            ) : (
              <Navigate to="/admin/login" replace />
            )
          } 
        />
        
        {/* Worksheet Editor Pro - New worksheet */}
        <Route 
          path="/admin/worksheet-pro" 
          element={
            isAuthenticated || isOfflineMode() ? (
              <Navigate to={`/admin/worksheet-pro/${Date.now()}`} replace />
            ) : (
              <Navigate to="/admin/login" replace />
            )
          } 
        />
        
        {/* Workbook Editor Pro - Figma-style workbook editor */}
        <Route 
          path="/admin/workbook-pro/:id" 
          element={
            isAuthenticated || isOfflineMode() ? (
              <WorkbookProLayout theme={theme} toggleTheme={toggleTheme} />
            ) : (
              <Navigate to="/admin/login" replace />
            )
          } 
        />
        
        {/* Workbook Editor Pro - New workbook */}
        <Route 
          path="/admin/workbook-pro" 
          element={
            isAuthenticated || isOfflineMode() ? (
              <Navigate to={`/admin/workbook-pro/${Date.now()}`} replace />
            ) : (
              <Navigate to="/admin/login" replace />
            )
          } 
        />
        
        <Route 
          path="/library/my-content/worksheet-editor/:id" 
          element={<WorksheetEditorLayout theme={theme} toggleTheme={toggleTheme} />} 
        />
        
        {/* Paper Test with AI Grading */}
        <Route 
          path="/worksheet/paper-test/:worksheetId" 
          element={<PaperTestPage theme={theme} />} 
        />
        
        {/* Paper Test Upload Page */}
        <Route 
          path="/paper-test/upload/:assignmentId" 
          element={<PaperTestUploadPage theme={theme} />} 
        />
        
        
        {/* Quiz Editor */}
        <Route 
          path="/quiz/new" 
          element={<QuizNewRedirect />} 
        />
        <Route 
          path="/quiz/edit/:id" 
          element={<QuizEditorLayout theme={theme} />} 
        />
        <Route 
          path="/quiz/view/:id" 
          element={<QuizViewPage />} 
        />
        <Route 
          path="/quiz/join" 
          element={<QuizJoinPage />} 
        />
        <Route 
          path="/quiz/join/:code" 
          element={<QuizJoinPage />} 
        />
        {/* Short URL for joining - redirects to /quiz/join/:code */}
        <Route 
          path="/go/:code" 
          element={<QuizJoinPage />} 
        />
        <Route 
          path="/quiz/results/:sessionId" 
          element={<QuizResultsPage />} 
        />
        <Route 
          path="/quiz/student/:shareId" 
          element={<QuizStudentView />} 
        />
        <Route 
          path="/quiz/practice/:id" 
          element={<QuizSelfStudyPage />} 
        />
        <Route 
          path="/quiz/public/:boardId" 
          element={<PublicBoardViewer />} 
        />
        <Route 
          path="/quiz/copy/:boardId" 
          element={<BoardCopyPage />} 
        />
        
        <Route 
          path="/admin"  
          element={
            isAuthenticated ? (
              <Navigate to="/admin/knihovna-vividbooks" replace />
            ) : (
              <Navigate to="/admin/login" replace />
            )
          } 
        />
        
        <Route 
          path="/admin/login" 
          element={
            isAuthenticated ? (
              <Navigate to="/admin" replace />
            ) : (
              <LoginPage onLogin={() => setIsAuthenticated(true)} theme={theme} />
            )
          } 
        />
        
        <Route 
          path="/admin/migration" 
          element={
            isAuthenticated ? (
              <MigrationAgent />
            ) : (
              <Navigate to="/admin/login" replace />
            )
          } 
        />
        
        <Route 
          path="/admin/curriculum-factory" 
          element={
            isAuthenticated ? (
              <CurriculumFactory />
            ) : (
              <Navigate to="/admin/login" replace />
            )
          } 
        />
        
        <Route 
          path="/admin/data-sets" 
          element={
            isAuthenticated ? (
              <DataSetCreator />
            ) : (
              <Navigate to="/admin/login" replace />
            )
          } 
        />
        
        <Route 
          path="/admin/rag-upload" 
          element={
            isAuthenticated ? (
              <RAGBulkUpload />
            ) : (
              <Navigate to="/admin/login" replace />
            )
          } 
        />
        
        <Route 
          path="/admin/:category" 
          element={
            isAuthenticated ? (
              <NewAdminLayout 
                theme={theme} 
                toggleTheme={toggleTheme}
                onLogout={() => setIsAuthenticated(false)}
              />
            ) : (
              <Navigate to="/admin/login" replace />
            )
          } 
        />
        
        <Route 
          path="/admin/:category/*" 
          element={
            isAuthenticated ? (
              <AdminEditor 
                theme={theme} 
                toggleTheme={toggleTheme}
                onLogout={() => setIsAuthenticated(false)}
              />
            ) : (
              <Navigate to="/admin/login" replace />
            )
          } 
        />
      </Routes>
    </Router>
    </StudentAuthProvider>
    </ClassroomShareProvider>
    </ViewModeProvider>
  );
}

function LoginPage({ onLogin, theme }: { onLogin: () => void; theme: 'light' | 'dark' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        // Sign up via server
        const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/signup`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({ email, password, name })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Sign up failed');
        }

        // After successful signup, sign in
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (signInError) throw signInError;
        
        if (signInData.session?.access_token) {
          onLogin();
        }
      } else {
        // Sign in
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (signInError) throw signInError;
        
        if (data.session?.access_token) {
          onLogin();
        }
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-lg p-8 shadow-sm">
          <h1 className="mb-6 text-center">{isSignUp ? 'Create Admin Account' : 'Admin Login'}</h1>
          
          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded text-destructive">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label htmlFor="name" className="block mb-2">Name</label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-input-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Your name"
                />
              </div>
            )}
            
            <div>
              <label htmlFor="email" className="block mb-2">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 bg-input-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="admin@example.com"
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block mb-2">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 bg-input-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="••••••••"
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground py-2 px-4 rounded hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? 'Please wait...' : isSignUp ? 'Sign Up' : 'Sign In'}
            </button>
          </form>
          
          <div className="mt-4 text-center">
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError('');
              }}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {isSignUp ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
