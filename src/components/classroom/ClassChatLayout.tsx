import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Hash, 
  Send, 
  Smile, 
  MoreHorizontal, 
  Pin, 
  Trash2, 
  Reply,
  ArrowLeft,
  Users,
  Circle,
  X,
  MessageSquare,
  PanelLeftClose,
  Menu,
  Plus,
  FileText,
  BookOpen,
  LayoutGrid,
  ClipboardList,
  ExternalLink,
  ChevronRight,
  Folder,
  FolderOpen,
  Search
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { cs } from 'date-fns/locale';
import { useStudentAuth, AvatarConfig } from '../../contexts/StudentAuthContext';
import { AvatarDisplay } from '../student/SimpleAvatarCreator';
import { getClasses } from '../../utils/supabase/classes';
import { supabase } from '../../utils/supabase/client';
import { ToolsMenu } from '../ToolsMenu';
import { ToolsDropdown } from '../ToolsDropdown';
import VividLogo from '../../imports/Group70';
import {
  ChatMessage,
  OnlineUser,
  SharedContent,
  sendChatMessage,
  subscribeToChatMessages,
  subscribeToOnlineUsers,
  updateOnlinePresence,
  addReaction,
  removeReaction,
  deleteMessage,
  togglePinMessage,
  // Direct Messages
  DirectMessage,
  DMConversation,
  getOrCreateDMConversation,
  sendDirectMessage,
  subscribeToDMMessages,
  subscribeToDMConversations,
  markDMAsRead,
} from '../../utils/class-chat';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { DOCUMENT_TYPES } from '../../types/document-types';

// Content categories for sharing
type ContentCategory = 'knihovna' | 'pracovni-listy' | 'muj-obsah';

// Available subjects for library
const LIBRARY_SUBJECTS = [
  { id: 'fyzika', label: 'Fyzika', color: '#7c3aed' },
  { id: 'chemie', label: 'Chemie', color: '#ef4444' },
  { id: 'prirodopis', label: 'Přírodopis', color: '#22c55e' },
  { id: 'matematika', label: 'Matematika', color: '#3b82f6' },
  { id: 'dejepis', label: 'Dějepis', color: '#d97706' },
];

interface LibraryMenuItem {
  id: string;
  label?: string;
  title?: string;
  name?: string;
  slug?: string;
  type?: string;
  icon?: string;
  children?: LibraryMenuItem[];
}

// Helper to check if item is a folder (has children or is explicitly a folder/group type)
const isFolder = (item: LibraryMenuItem): boolean => {
  return !!(item.children && item.children.length > 0) || 
         item.type === 'folder' || 
         item.type === 'group';
};

// Normalize item type for display
const getItemType = (item: LibraryMenuItem): string => {
  let type = item.type || '';
  const icon = item.icon || '';
  
  if (type === 'workbook' || icon === 'book' || icon === 'workbook') return 'workbook';
  if (type === 'worksheet' || icon === 'file-edit') return 'worksheet';
  if (type === 'textbook') return 'textbook';
  if (type === 'experiment') return 'experiment';
  if (type === 'methodology') return 'methodology';
  if (type === 'test') return 'test';
  if (type === 'exam') return 'exam';
  if (type === 'practice' || type === 'exercise') return 'practice';
  if (type === 'guide') return 'guide';
  if (type === '3d-model') return '3d-model';
  if (type === 'minigame') return 'minigame';
  return 'lesson'; // Default to lesson
};

interface ContentItem {
  id: string;
  type: 'document' | 'worksheet' | 'quiz' | 'board' | 'lesson' | 'folder';
  title: string;
  description?: string;
  thumbnail?: string;
  category: ContentCategory;
  url?: string;
}

// Common emoji reactions
const EMOJI_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '👏'];

interface ClassInfo {
  id: string;
  name: string;
}

export default function ClassChatLayout() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const { student, loading: studentLoading } = useStudentAuth();
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [showMessageMenu, setShowMessageMenu] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [isTeacher, setIsTeacher] = useState(false);
  const [userTypeChecked, setUserTypeChecked] = useState(false);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [teacherName, setTeacherName] = useState<string>('Učitel');
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [classMembers, setClassMembers] = useState<{id: string; name: string; type: 'student' | 'teacher'; avatar?: AvatarConfig; color?: string; initials?: string}[]>([]);
  
  // Content sharing sidebar state (replaces modal)
  const [showContentSidebar, setShowContentSidebar] = useState(false);
  const [shareStep, setShareStep] = useState<'select' | 'vividbooks' | 'mycontent'>('select');
  const [selectedCategory, setSelectedCategory] = useState<ContentCategory>('knihovna');
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentSearch, setContentSearch] = useState('');
  const [selectedContent, setSelectedContent] = useState<SharedContent | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [libraryMenu, setLibraryMenu] = useState<LibraryMenuItem[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  
  // Direct Messages state
  const [dmConversations, setDmConversations] = useState<DMConversation[]>([]);
  const [activeDM, setActiveDM] = useState<DMConversation | null>(null);
  const [dmMessages, setDmMessages] = useState<DirectMessage[]>([]);
  const [showNewDMModal, setShowNewDMModal] = useState(false);
  const [chatMode, setChatMode] = useState<'class' | 'dm'>('class');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Determine if user is teacher or student
  useEffect(() => {
    const checkUserType = async () => {
      // Wait for student auth to complete before making any decisions
      if (studentLoading) {
        console.log('[ClassChat] Waiting for student auth to complete...');
        return;
      }
      
      // Check if we have a student logged in
      if (student) {
        console.log('[ClassChat] User is student:', student.name);
        setIsTeacher(false);
        setUserTypeChecked(true);
        return;
      }
      
      // Otherwise check for teacher session via Supabase
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          console.log('[ClassChat] User is teacher:', session.user.email);
          setIsTeacher(true);
          setTeacherId(session.user.id);
          setTeacherName(session.user.email?.split('@')[0] || 'Učitel');
        } else {
          console.log('[ClassChat] No session found');
        }
      } catch (error) {
        console.error('[ClassChat] Error checking auth:', error);
      }
      setUserTypeChecked(true);
    };
    checkUserType();
  }, [student, studentLoading]);

  // Load classes for teacher or get student's class
  useEffect(() => {
    const loadClasses = async () => {
      // Wait for student auth to complete
      if (studentLoading) {
        console.log('[ClassChat] Waiting for student auth...');
        return;
      }
      
      console.log('[ClassChat] loadClasses called, student:', student?.name, 'class_id:', student?.class_id, 'isTeacher:', isTeacher);
      
      if (student && student.class_id) {
        // Student sees only their class
        const studentClass = { id: student.class_id, name: student.class_name || 'Moje třída' };
        console.log('[ClassChat] Setting student class:', studentClass);
        setClasses([studentClass]);
        setClassInfo(studentClass); // Set classInfo directly
        setIsLoading(false);
        
        if (!classId) {
          // Auto-navigate to student's class
          console.log('[ClassChat] Auto-navigating to:', student.class_id);
          navigate(`/class-chat/${student.class_id}`, { replace: true });
        }
      } else if (isTeacher) {
        // Teacher sees all their classes
        const teacherClasses = await getClasses();
        console.log('[ClassChat] Loaded teacher classes:', teacherClasses.length);
        setClasses(teacherClasses.map(c => ({ id: c.id, name: c.name })));
        setIsLoading(false);
      } else {
        // No user found, still set loading to false
        setIsLoading(false);
      }
    };
    loadClasses();
  }, [student, studentLoading, isTeacher, classId, navigate]);

  // Get current class info (for teacher switching between classes)
  useEffect(() => {
    if (classId && classes.length > 0) {
      const currentClass = classes.find(c => c.id === classId);
      if (currentClass) {
        console.log('[ClassChat] Setting classInfo from classes:', currentClass);
        setClassInfo(currentClass);
      }
    }
  }, [classId, classes]);

  // Subscribe to messages
  useEffect(() => {
    if (!classId) {
      console.log('[ClassChat] No classId, skipping message subscription');
      return;
    }

    console.log('[ClassChat] Subscribing to messages for class:', classId);
    const unsubscribe = subscribeToChatMessages(classId, (msgs) => {
      console.log('[ClassChat] Received messages:', msgs.length);
      setMessages(msgs);
    });

    return () => {
      console.log('[ClassChat] Unsubscribing from messages');
      unsubscribe();
    };
  }, [classId]);

  // Subscribe to online users
  useEffect(() => {
    if (!classId) return;

    const unsubscribe = subscribeToOnlineUsers(classId, (users) => {
      setOnlineUsers(users);
    });

    return () => unsubscribe();
  }, [classId]);
  
  // Load all class members (students + teacher)
  useEffect(() => {
    const loadClassMembers = async () => {
      if (!classId) return;
      
      try {
        const members: {id: string; name: string; type: 'student' | 'teacher'; avatar?: AvatarConfig; color?: string; initials?: string}[] = [];
        
        // Load class to get teacher info
        const { data: classData, error: classError } = await supabase
          .from('classes')
          .select('teacher_id, name')
          .eq('id', classId)
          .single();
        
        if (classError) {
          console.error('[ClassChat] Error loading class:', classError);
        }
        
        // Load teacher name from teachers table
        if (classData?.teacher_id) {
          const { data: teacherData, error: teacherError } = await supabase
            .from('teachers')
            .select('name')
            .eq('id', classData.teacher_id)
            .single();
          
          if (teacherError) {
            console.error('[ClassChat] Error loading teacher:', teacherError);
          }
          
          members.push({
            id: classData.teacher_id,
            name: teacherData?.name || 'Učitel',
            type: 'teacher'
          });
        }
        
        // Load students in this class - use 'students' table, not 'student_profiles'
        // Include avatar, color, and initials for display
        const { data: students, error: studentsError } = await supabase
          .from('students')
          .select('id, name, avatar, color, initials')
          .eq('class_id', classId)
          .order('name');
        
        if (studentsError) {
          console.error('[ClassChat] Error loading students:', studentsError);
        }
        
        // Add students with their avatar info
        if (students && students.length > 0) {
          students.forEach(s => {
            members.push({
              id: s.id,
              name: s.name || 'Student',
              type: 'student',
              avatar: s.avatar as AvatarConfig | undefined,
              color: s.color,
              initials: s.initials
            });
          });
        }
        
        console.log('[ClassChat] Loaded class members:', members.length, members);
        setClassMembers(members);
      } catch (error) {
        console.error('[ClassChat] Error loading class members:', error);
      }
    };
    
    loadClassMembers();
  }, [classId]);

  // Update online presence
  useEffect(() => {
    if (!classId) return;

    const userId = student?.id || teacherId;
    const userName = student?.name || teacherName;
    const userType = student ? 'student' : 'teacher';

    if (!userId) return;

    // Set online
    updateOnlinePresence(classId, userId, userType, userName, true);

    // Set offline on unmount
    return () => {
      updateOnlinePresence(classId, userId, userType, userName, false);
    };
  }, [classId, student, teacherId, teacherName]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, dmMessages]);

  // Subscribe to DM conversations
  useEffect(() => {
    const userId = student?.id || teacherId;
    if (!userId) return;

    const unsubscribe = subscribeToDMConversations(userId, (conversations) => {
      setDmConversations(conversations);
    });

    return () => unsubscribe();
  }, [student?.id, teacherId]);

  // Subscribe to DM messages when a DM is active
  useEffect(() => {
    if (!activeDM) {
      setDmMessages([]);
      return;
    }

    const unsubscribe = subscribeToDMMessages(activeDM.id, (msgs) => {
      setDmMessages(msgs);
    });

    // Mark messages as read
    const userId = student?.id || teacherId;
    if (userId) {
      markDMAsRead(activeDM.id, userId);
    }

    return () => unsubscribe();
  }, [activeDM, student?.id, teacherId]);

  // Start a new DM conversation
  const startDMConversation = async (recipient: { id: string; name: string; type: 'student' | 'teacher' }) => {
    const userId = student?.id || teacherId;
    const userName = student?.name || teacherName;
    const userType: 'student' | 'teacher' = student ? 'student' : 'teacher';

    if (!userId || !classId) return;

    const conversationId = await getOrCreateDMConversation(
      classId,
      { id: userId, name: userName, type: userType },
      recipient
    );

    if (conversationId) {
      // Find or create the conversation object
      const existingConv = dmConversations.find(c => c.id === conversationId);
      if (existingConv) {
        setActiveDM(existingConv);
      } else {
        // Create a temporary conversation object
        setActiveDM({
          id: conversationId,
          participants: [
            { id: userId, name: userName, type: userType },
            recipient
          ],
          classId,
          createdAt: new Date().toISOString()
        });
      }
      setChatMode('dm');
      setShowNewDMModal(false);
    }
  };

  // Send message
  const handleSendMessage = async () => {
    console.log('[ClassChat] handleSendMessage called', { newMessage: newMessage.trim(), classId, sending, selectedContent, chatMode });
    
    // Allow sending if there's either text or shared content
    if ((!newMessage.trim() && !selectedContent) || sending) {
      console.log('[ClassChat] Skipping send - missing data');
      return;
    }

    const userId = student?.id || teacherId;
    const userName = student?.name || teacherName;
    const userType: 'student' | 'teacher' = student ? 'student' : 'teacher';

    console.log('[ClassChat] Sending message as:', { userId, userName, userType });

    if (!userId) {
      console.log('[ClassChat] No userId, skipping');
      return;
    }

    setSending(true);
    try {
      // If no text but has content, add a default message
      const messageText = newMessage.trim() || (selectedContent ? `Sdílím: ${selectedContent.title}` : '');
      
      if (chatMode === 'dm' && activeDM) {
        // Send direct message
        const messageId = await sendDirectMessage(
          activeDM.id,
          userId,
          userName,
          userType,
          messageText
        );
        console.log('[DM] Message sent with ID:', messageId);
      } else if (classId) {
        // Send class message
        const messageId = await sendChatMessage(
          classId,
          userId,
          userType,
          userName,
          messageText,
          replyingTo?.id,
          selectedContent || undefined
        );
        console.log('[ClassChat] Message sent with ID:', messageId);
      }
      
      setNewMessage('');
      setReplyingTo(null);
      setSelectedContent(null); // Clear selected content after sending
      inputRef.current?.focus();
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Toggle reaction
  const handleToggleReaction = async (messageId: string, emoji: string) => {
    if (!classId) return;

    const userId = student?.id || teacherId;
    const userName = student?.name || teacherName;
    const userType: 'student' | 'teacher' = student ? 'student' : 'teacher';

    if (!userId) return;

    const message = messages.find(m => m.id === messageId);
    const reactions = message?.reactions || {};
    const existingReaction = Object.values(reactions).flat().find(
      r => r.userId === userId && r.emoji === emoji
    );

    if (existingReaction) {
      await removeReaction(classId, messageId, userId, emoji);
    } else {
      await addReaction(classId, messageId, userId, userType, userName, emoji);
    }
    setShowEmojiPicker(null);
  };

  // Delete message
  const handleDeleteMessage = async (messageId: string) => {
    if (!classId) return;
    await deleteMessage(classId, messageId);
    setShowMessageMenu(null);
  };

  // Pin message
  const handlePinMessage = async (message: ChatMessage) => {
    if (!classId || !isTeacher) return;
    await togglePinMessage(classId, message.id, !message.isPinned);
    setShowMessageMenu(null);
  };

  // Flatten library menu into content items
  const flattenLibraryMenu = (items: LibraryMenuItem[], subjectId: string): ContentItem[] => {
    const result: ContentItem[] = [];
    
    const processItem = (item: LibraryMenuItem) => {
      const title = item.label || item.title || item.name || 'Bez názvu';
      const slug = item.slug || item.id;
      
      // Add the item if it has a slug
      if (slug && !item.children?.length) {
        result.push({
          id: item.id || slug,
          type: 'lesson' as const,
          title: title,
          description: item.type || 'Lekce',
          category: 'knihovna' as ContentCategory,
          url: `/docs/${subjectId}/${slug}`
        });
      }
      
      // Process children recursively
      if (item.children && item.children.length > 0) {
        item.children.forEach(processItem);
      }
    };
    
    items.forEach(processItem);
    return result;
  };

  // Fetch library menu for a subject
  const fetchLibraryMenu = useCallback(async (subjectId: string) => {
    setContentLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/menu?category=${subjectId}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        console.log('[ClassChat] Loaded library menu:', data.menu?.length, 'items');
        setLibraryMenu(data.menu || []);
        
        // Flatten the menu into content items
        const items = flattenLibraryMenu(data.menu || [], subjectId);
        setContentItems(items);
      }
    } catch (err) {
      console.error('[ClassChat] Error loading library menu:', err);
    } finally {
      setContentLoading(false);
    }
  }, []);

  // Load content items based on category
  const loadContentItems = useCallback(async (category: ContentCategory) => {
    setContentLoading(true);
    setContentItems([]);
    
    try {
      if (category === 'knihovna') {
        // For library, we show subject selection first
        // If no subject selected, don't load anything yet
        if (!selectedSubject) {
          setContentItems([]);
          setContentLoading(false);
          return;
        }
        
        // Load from library API
        await fetchLibraryMenu(selectedSubject);
        return; // fetchLibraryMenu handles loading state
      } else if (category === 'pracovni-listy') {
        // Load worksheets from storage
        const savedWorksheets = localStorage.getItem('vivid-worksheets');
        const worksheets = savedWorksheets ? JSON.parse(savedWorksheets) : [];
        
        const items: ContentItem[] = worksheets.map((ws: any) => ({
          id: ws.id,
          type: 'worksheet' as const,
          title: ws.name || ws.title || 'Pracovní list',
          description: `${ws.slides?.length || 0} stránek`,
          category: 'pracovni-listy' as ContentCategory,
          url: `/worksheet-editor/${ws.id}`
        }));
        
        setContentItems(items);
      } else if (category === 'muj-obsah') {
        // Load from teacher's "Můj obsah"
        const savedFolders = localStorage.getItem('vivid-my-folders');
        const folders = savedFolders ? JSON.parse(savedFolders) : [];
        
        // Get quizzes
        const savedQuizzes = localStorage.getItem('vivid-quizzes');
        const quizzes = savedQuizzes ? JSON.parse(savedQuizzes) : [];
        
        const items: ContentItem[] = [
          ...folders.map((f: any) => ({
            id: f.id,
            type: f.type as 'folder' | 'document' | 'board',
            title: f.name,
            description: f.type === 'folder' ? 'Složka' : f.type === 'board' ? 'Nástěnka' : 'Dokument',
            category: 'muj-obsah' as ContentCategory,
            url: f.type === 'document' ? `/docs/share/${f.id}` : f.type === 'board' ? `/board/${f.id}` : undefined
          })),
          ...quizzes.map((q: any) => ({
            id: q.id,
            type: 'quiz' as const,
            title: q.name || 'Quiz',
            description: `${q.questions?.length || 0} otázek`,
            category: 'muj-obsah' as ContentCategory,
            url: `/quiz/${q.id}`
          }))
        ];
        
        setContentItems(items);
      }
    } catch (error) {
      console.error('[ClassChat] Error loading content:', error);
    } finally {
      setContentLoading(false);
    }
  }, [selectedSubject, fetchLibraryMenu]);
  
  // Load content when sidebar opens or category/subject changes
  useEffect(() => {
    if (showContentSidebar) {
      if (shareStep === 'vividbooks' && selectedSubject) {
        // Load library content for selected subject
        fetchLibraryMenu(selectedSubject);
      } else if (shareStep === 'mycontent') {
        // Load my content
        loadContentItems('muj-obsah');
      }
    }
  }, [showContentSidebar, shareStep, selectedSubject, loadContentItems, fetchLibraryMenu]);
  
  // Select content for sharing
  const handleSelectContent = (item: ContentItem) => {
    const sharedContent: SharedContent = {
      id: item.id,
      type: item.type === 'folder' ? 'document' : item.type,
      title: item.title,
      description: item.description,
      thumbnail: item.thumbnail,
      url: item.url,
      category: item.category
    };
    setSelectedContent(sharedContent);
    setShowContentSidebar(false);
    setSelectedSubject(null);
    setSelectedCategory('knihovna');
  };
  
  // Close content sidebar
  const handleCloseContentSidebar = () => {
    setShowContentSidebar(false);
    setShareStep('select');
    setSelectedSubject(null);
    setSelectedCategory('knihovna');
    setContentSearch('');
    setSelectedDocs(new Set());
    setExpandedFolders(new Set());
  };
  
  // Handle back in share sidebar
  const handleShareBack = () => {
    if (shareStep === 'vividbooks' && selectedSubject) {
      setSelectedSubject(null);
    } else if (shareStep === 'vividbooks' || shareStep === 'mycontent') {
      setShareStep('select');
      setSelectedSubject(null);
      setSelectedDocs(new Set());
    } else {
      handleCloseContentSidebar();
    }
  };
  
  // Toggle folder expansion
  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };
  
  // Toggle document selection
  const toggleDocSelection = (docId: string, item: LibraryMenuItem) => {
    // For sharing, we only allow one selection at a time
    const sharedContent: SharedContent = {
      id: item.id || docId,
      type: 'lesson',
      title: item.label || item.title || item.name || 'Dokument',
      description: item.type || '',
      url: `/docs/${selectedSubject}/${item.slug || docId}`
    };
    setSelectedContent(sharedContent);
    setShowContentSidebar(false);
    setShareStep('select');
    setSelectedSubject(null);
    setSelectedDocs(new Set());
  };
  
  // Render library item recursively with proper icons
  const renderLibraryItem = (item: LibraryMenuItem, depth: number): React.ReactNode => {
    const itemIsFolder = isFolder(item);
    const isExpanded = expandedFolders.has(item.id);
    const itemType = getItemType(item);
    
    // Skip workbooks
    if (itemType === 'workbook') return null;
    
    // Get the icon for this document type
    const docType = DOCUMENT_TYPES.find(t => t.id === itemType);
    const IconComponent = docType?.icon;
    
    return (
      <div key={item.id}>
        <div 
          className="flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => {
            if (itemIsFolder) {
              toggleFolder(item.id);
            } else {
              toggleDocSelection(item.id, item);
            }
          }}
        >
          {/* Expand/collapse arrow for folders */}
          {itemIsFolder ? (
            <ChevronRight 
              className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
            />
          ) : (
            <div className="w-4 shrink-0" />
          )}
          
          {/* Icon */}
          <div className="shrink-0">
            {itemIsFolder ? (
              isExpanded ? (
                <FolderOpen className="w-4 h-4 text-amber-500" />
              ) : (
                <Folder className="w-4 h-4 text-slate-400" />
              )
            ) : IconComponent ? (
              <IconComponent className={`w-4 h-4 ${docType?.color || 'text-slate-500'}`} />
            ) : (
              <FileText className="w-4 h-4 text-slate-400" />
            )}
          </div>
          
          {/* Label */}
          <span className={`text-sm truncate ${itemIsFolder ? 'font-medium text-slate-700' : 'text-slate-600'}`}>
            {item.label || item.title || item.name}
          </span>
        </div>
        
        {/* Children */}
        {itemIsFolder && isExpanded && item.children && (
          <div>
            {item.children.map(child => renderLibraryItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };
  
  // Filter content by search
  const filteredContent = contentItems.filter(item => 
    item.title.toLowerCase().includes(contentSearch.toLowerCase()) ||
    item.description?.toLowerCase().includes(contentSearch.toLowerCase())
  );

  // Format message date
  const formatMessageDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) {
      return `Dnes v ${format(date, 'HH:mm')}`;
    } else if (isYesterday(date)) {
      return `Včera v ${format(date, 'HH:mm')}`;
    }
    return format(date, 'd. M. yyyy HH:mm', { locale: cs });
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    const date = format(new Date(message.createdAt), 'yyyy-MM-dd');
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {} as Record<string, ChatMessage[]>);

  // Format date divider
  const formatDateDivider = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return 'Dnes';
    if (isYesterday(date)) return 'Včera';
    return format(date, 'd. MMMM yyyy', { locale: cs });
  };

  // Get pinned messages
  const pinnedMessages = messages.filter(m => m.isPinned);

  // Loading state - wait for user type check to complete before rendering
  if (isLoading || studentLoading || !userTypeChecked) {
    return (
      <div className="h-screen w-full flex items-center justify-center" style={{ backgroundColor: '#0f172a' }}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p style={{ color: '#94a3b8' }}>Načítání chatu...</p>
        </div>
      </div>
    );
  }

  if (!classId && classes.length > 0) {
    // Show class selector with same sidebar
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="flex">
          {/* Left Sidebar */}
          <aside 
            className={`
              top-0 h-screen shrink-0 flex flex-col 
              transition-all duration-300 ease-in-out
              fixed left-0 z-30 w-[294px]
              ${sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
              lg:sticky lg:translate-x-0 lg:shadow-none lg:w-[312px]
              print:hidden
            `}
            style={{ backgroundColor: '#1e40af' }}
          >
            <div 
              className="w-[294px] lg:w-[312px] h-full flex flex-col min-w-[294px] lg:min-w-[312px]"
              style={{ backgroundColor: toolsOpen ? '#4E5871' : '#1e40af' }}
            >
              {/* Header */}
              <div className="p-4" style={{ backgroundColor: toolsOpen ? '#4E5871' : undefined }}>
                {toolsOpen ? (
                  <div className="flex items-center justify-between min-h-[40px] animate-in fade-in duration-200">
                    <span className="text-white/90 font-bold text-[12px] uppercase tracking-wider pl-1">
                      Naše produkty
                    </span>
                    <button
                      onClick={() => setToolsOpen(false)}
                      className="p-1.5 rounded-md hover:bg-white/10 transition-colors text-white/90"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <div className="flex items-center justify-center min-h-[40px] w-20">
                        <Link to="/docs/knihovna-vividbooks/introduction" className="flex items-center">
                          <div className="w-20 h-10 text-white">
                            <VividLogo />
                          </div>
                        </Link>
                      </div>
                      <ToolsDropdown 
                        isOpen={toolsOpen} 
                        onToggle={() => setToolsOpen(!toolsOpen)} 
                        label="Zprávy"
                        variant="blue"
                      />
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setSidebarOpen(false)}
                        className="lg:hidden p-1.5 rounded-md transition-colors text-white/70 hover:text-white hover:bg-white/10"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Navigation Content */}
              <div className="flex-1 overflow-hidden text-white flex flex-col">
                {toolsOpen ? (
                  <div className="h-full" style={{ backgroundColor: '#4E5871' }}>
                    <ToolsMenu 
                      activeItem="messages"
                      onItemClick={() => {
                        setToolsOpen(false);
                        setSidebarOpen(false);
                      }}
                      isStudentMode={!isTeacher}
                    />
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto p-4">
                    <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
                      Vyberte kanál
                    </h3>
                    <div className="space-y-2">
                      {classes.map(c => (
                        <button
                          key={c.id}
                          onClick={() => {
                            setChatMode('class');
                            setActiveDM(null);
                            navigate(`/class-chat/${c.id}`);
                          }}
                          className="w-full flex items-center gap-3 p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
                        >
                          <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                            <Hash className="w-5 h-5 text-white" />
                          </div>
                          <span className="text-lg text-white font-medium">{c.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </aside>

          {/* Mobile sidebar overlay */}
          {sidebarOpen && (
            <div 
              className="fixed inset-0 bg-black/50 z-20 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Main content area */}
          <div className="flex-1 flex flex-col min-h-screen" style={{ backgroundColor: '#0f172a' }}>
            {/* Header */}
            <div className="h-14 px-4 flex items-center shrink-0" style={{ backgroundColor: '#1e293b', borderBottom: '1px solid #334155' }}>
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg mr-3"
              >
                <Menu className="w-5 h-5" />
              </button>
              <MessageSquare className="w-5 h-5 text-slate-400 mr-2" />
              <h1 className="text-lg font-semibold text-white">Vyberte třídu</h1>
            </div>

            {/* Content */}
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center">
                <MessageSquare className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-white mb-2">Vyberte třídu z menu</h2>
                <p className="text-slate-400">Pro zahájení konverzace vyberte třídu v levém panelu</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex">
        {/* Left Sidebar */}
        <aside 
          className={`
            top-0 h-screen shrink-0 flex flex-col 
            transition-all duration-300 ease-in-out
            fixed left-0 z-30 w-[294px]
            ${sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
            lg:sticky lg:translate-x-0 lg:shadow-none
            ${!sidebarVisible 
              ? 'lg:w-0 lg:overflow-hidden lg:border-r-0' 
              : 'lg:w-[312px]'
            }
            print:hidden
          `}
          style={{ backgroundColor: '#1e40af' }}
        >
          <div 
            className="w-[294px] lg:w-[312px] h-full flex flex-col min-w-[294px] lg:min-w-[312px]"
            style={{ backgroundColor: (showContentSidebar && isTeacher) ? '#ffffff' : toolsOpen ? '#4E5871' : '#1e40af' }}
          >
            {/* Header - hide when content sharing sidebar is open */}
            {!(showContentSidebar && isTeacher) && (
              <div className="p-4" style={{ backgroundColor: toolsOpen ? '#4E5871' : undefined }}>
                {toolsOpen ? (
                  <div className="flex items-center justify-between min-h-[40px] animate-in fade-in duration-200">
                    <span className="text-white/90 font-bold text-[12px] uppercase tracking-wider pl-1">
                      Naše produkty
                    </span>
                    <button
                      onClick={() => setToolsOpen(false)}
                      className="p-1.5 rounded-md hover:bg-white/10 transition-colors text-white/90"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <div className="flex items-center justify-center min-h-[40px] w-20">
                        <Link to="/docs/knihovna-vividbooks/introduction" className="flex items-center">
                          <div className="w-20 h-10 text-white">
                            <VividLogo />
                          </div>
                        </Link>
                      </div>
                      <ToolsDropdown 
                        isOpen={toolsOpen} 
                        onToggle={() => setToolsOpen(!toolsOpen)} 
                        label="Zprávy"
                        variant="blue"
                      />
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setSidebarOpen(false)}
                        className="lg:hidden p-1.5 rounded-md transition-colors text-white/70 hover:text-white hover:bg-white/10"
                      >
                        <X className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => setSidebarVisible(false)}
                        className="hidden lg:block p-1.5 rounded-md transition-colors text-white/70 hover:text-white hover:bg-white/10"
                        title="Skrýt menu"
                      >
                        <PanelLeftClose className="h-[23px] w-[23px]" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

{/* Navigation Content */}
            <div className="flex-1 overflow-hidden text-white flex flex-col">
              {toolsOpen ? (
                <div className="h-full" style={{ backgroundColor: '#4E5871' }}>
                  <ToolsMenu 
                    activeItem="messages"
                    onItemClick={() => {
                      setToolsOpen(false);
                      setSidebarOpen(false);
                    }}
                    isStudentMode={!isTeacher}
                  />
                </div>
              ) : showContentSidebar && isTeacher ? (
                /* Content sharing sidebar - white theme like AI panel */
                <div className="flex-1 flex flex-col overflow-hidden bg-white border-r border-slate-200">
                  {shareStep === 'select' ? (
                    /* Step 1: Select source - compact */
                    <div className="flex-1 flex flex-col p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-medium text-slate-700">Co chcete sdílet?</h3>
                        <button
                          onClick={() => setShowContentSidebar(false)}
                          className="p-1 rounded-md hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                      
                      <div className="space-y-2">
                        <button
                          onClick={() => setShareStep('vividbooks')}
                          className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-amber-200 bg-amber-50 hover:bg-amber-100 hover:border-amber-300 transition-all text-left"
                        >
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#f59e0b' }}>
                            <BookOpen className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-800">Z Vividbooks</p>
                            <p className="text-xs text-slate-500">Z dokumentů knihovny</p>
                          </div>
                        </button>

                        <button
                          onClick={() => setShareStep('mycontent')}
                          className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-green-200 bg-green-50 hover:bg-green-100 hover:border-green-300 transition-all text-left"
                        >
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#10b981' }}>
                            <Folder className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-800">Z mého obsahu</p>
                            <p className="text-xs text-slate-500">Vlastní soubory a odkazy</p>
                          </div>
                        </button>
                      </div>
                    </div>
                  ) : shareStep === 'vividbooks' ? (
                    /* Step 2: Vividbooks - Subject selection or folder tree */
                    !selectedSubject ? (
                      /* Subject list - no header */
                      <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        <button
                          onClick={handleShareBack}
                          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 mb-2"
                        >
                          <ArrowLeft className="h-4 w-4" />
                          Zpět
                        </button>
                        {LIBRARY_SUBJECTS.map(subject => (
                          <button
                            key={subject.id}
                            onClick={() => setSelectedSubject(subject.id)}
                            className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 transition-all text-left"
                          >
                            <div 
                              className="w-10 h-10 rounded-lg flex items-center justify-center"
                              style={{ backgroundColor: subject.color }}
                            >
                              <BookOpen className="h-5 w-5 text-white" />
                            </div>
                            <span className="font-medium text-slate-800">{subject.label}</span>
                            <ChevronRight className="h-5 w-5 text-slate-400 ml-auto" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      /* Subject selected - show folder tree - no header */
                      <div className="flex-1 overflow-y-auto p-2">
                        <button
                          onClick={handleShareBack}
                          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 mb-2 ml-2"
                        >
                          <ArrowLeft className="h-4 w-4" />
                          Zpět
                        </button>
                        {contentLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                          </div>
                        ) : libraryMenu.length > 0 ? (
                          <div className="space-y-0.5">
                            {libraryMenu.map(item => renderLibraryItem(item, 0))}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-500 text-center py-8">Žádný obsah</p>
                        )}
                      </div>
                    )
                  ) : (
                    /* Step 2: My content - no header */
                    <div className="flex-1 overflow-y-auto p-3">
                        <button
                          onClick={handleShareBack}
                          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 mb-2"
                        >
                          <ArrowLeft className="h-4 w-4" />
                          Zpět
                        </button>
                        {contentLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                          </div>
                        ) : filteredContent.length === 0 ? (
                          <div className="text-center py-8 text-slate-400">
                            <Folder className="w-10 h-10 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">Žádný obsah</p>
                            <p className="text-xs mt-1">Přidejte obsah v sekci Můj obsah</p>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {filteredContent.map(item => (
                              <button
                                key={item.id}
                                onClick={() => handleSelectContent(item)}
                                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100 transition-colors text-left group"
                              >
                                <div className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                                  item.type === 'worksheet' ? 'bg-green-100' :
                                  item.type === 'quiz' ? 'bg-amber-100' :
                                  item.type === 'board' ? 'bg-purple-100' :
                                  item.type === 'folder' ? 'bg-amber-100' :
                                  'bg-blue-100'
                                }`}>
                                  {item.type === 'worksheet' && <ClipboardList className="w-5 h-5 text-green-600" />}
                                  {item.type === 'quiz' && <FileText className="w-5 h-5 text-amber-600" />}
                                  {item.type === 'board' && <LayoutGrid className="w-5 h-5 text-purple-600" />}
                                  {item.type === 'folder' && <Folder className="w-5 h-5 text-amber-600" />}
                                  {item.type === 'document' && <FileText className="w-5 h-5 text-blue-600" />}
                                  {item.type === 'lesson' && <BookOpen className="w-5 h-5 text-indigo-600" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-slate-800 truncate group-hover:text-blue-600 transition-colors">
                                    {item.title}
                                  </p>
                                  {item.description && (
                                    <p className="text-xs text-slate-500 truncate">{item.description}</p>
                                  )}
                                </div>
                                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto p-3">
                  {/* Class channels */}
                  <div className="mb-4">
                    <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2 px-2">
                      Kanály
                    </h3>
                    {classes.length > 0 ? (
                      classes.map(c => (
                        <button
                          key={c.id}
                          onClick={() => {
                            setChatMode('class');
                            setActiveDM(null);
                            navigate(`/class-chat/${c.id}`);
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                            c.id === classId && chatMode === 'class'
                              ? 'bg-white/20 text-white' 
                              : 'text-white/70 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <Hash className="w-4 h-4" />
                          <span className="truncate">{c.name}</span>
                        </button>
                      ))
                    ) : classInfo ? (
                      <button
                        onClick={() => {
                          setChatMode('class');
                          setActiveDM(null);
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                          chatMode === 'class' ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <Hash className="w-4 h-4" />
                        <span className="truncate">{classInfo.name}</span>
                      </button>
                    ) : (
                      <div className="px-3 py-2 text-white/50 text-sm">
                        Žádné kanály
                      </div>
                    )}
                  </div>

                  {/* Direct Messages */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between px-2 mb-2">
                      <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        Přímé zprávy
                      </h3>
                      <button
                        onClick={() => setShowNewDMModal(true)}
                        className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                        title="Nová zpráva"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="space-y-0.5">
                      {dmConversations.length === 0 ? (
                        <div className="px-3 py-2 text-white/40 text-xs">
                          Zatím žádné konverzace
                        </div>
                      ) : (
                        dmConversations.map(conv => {
                          const userId = student?.id || teacherId;
                          const otherParticipant = conv.participants?.find(p => p.id !== userId);
                          const isActive = activeDM?.id === conv.id;
                          
                          return (
                            <button
                              key={conv.id}
                              onClick={() => {
                                setActiveDM(conv);
                                setChatMode('dm');
                              }}
                              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                                isActive 
                                  ? 'bg-white/20 text-white' 
                                  : 'text-white/70 hover:bg-white/10 hover:text-white'
                              }`}
                            >
                              <div 
                                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium"
                                style={{ 
                                  backgroundColor: otherParticipant?.type === 'teacher' ? '#d97706' : '#4f46e5',
                                  color: 'white'
                                }}
                              >
                                {otherParticipant?.name?.charAt(0).toUpperCase() || '?'}
                              </div>
                              <div className="flex-1 min-w-0 text-left">
                                <div className="text-sm truncate">{otherParticipant?.name || 'Neznámý'}</div>
                                {conv.lastMessage && (
                                  <div className="text-xs text-white/40 truncate">{conv.lastMessage}</div>
                                )}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* All class members - clickable for DM */}
                  <div>
                    <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2 px-2 flex items-center gap-2">
                      <Users className="w-3 h-3" />
                      Členové třídy — {classMembers.length}
                    </h3>
                    <div className="space-y-1">
                      {classMembers.length === 0 ? (
                        <div className="px-3 py-2 text-white/40 text-sm">
                          Načítám členy...
                        </div>
                      ) : (
                        classMembers.map(member => {
                          const isOnline = onlineUsers.some(u => u.id === member.id && u.isOnline);
                          const currentUserId = student?.id || teacherId;
                          const isCurrentUser = member.id === currentUserId;
                          
                          return (
                            <button 
                              key={member.id}
                              onClick={() => !isCurrentUser && startDMConversation(member)}
                              disabled={isCurrentUser}
                              className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
                                isCurrentUser 
                                  ? 'cursor-default' 
                                  : 'hover:bg-white/10 cursor-pointer'
                              } ${isOnline ? 'text-white/90' : 'text-white/50'}`}
                            >
                              <div className="relative">
                                {member.avatar && member.type === 'student' ? (
                                  <div style={{ opacity: isOnline ? 1 : 0.6 }}>
                                    <AvatarDisplay avatar={member.avatar} size={32} />
                                  </div>
                                ) : (
                                  <div 
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium"
                                    style={{ 
                                      backgroundColor: member.type === 'teacher' ? '#d97706' : (member.color || '#4f46e5'),
                                      color: 'white',
                                      opacity: isOnline ? 1 : 0.6
                                    }}
                                  >
                                    {member.initials || member.name.charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <div 
                                  className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#2D3546]"
                                  style={{ 
                                    backgroundColor: isOnline ? '#22c55e' : '#64748b'
                                  }}
                                />
                              </div>
                              <span className="text-sm truncate flex-1 text-left">{member.name}</span>
                              {member.type === 'teacher' && (
                                <span 
                                  className="text-xs px-1.5 py-0.5 rounded"
                                  style={{
                                    backgroundColor: isOnline ? 'rgba(217, 119, 6, 0.3)' : 'rgba(217, 119, 6, 0.2)',
                                    color: isOnline ? '#fbbf24' : 'rgba(245, 158, 11, 0.6)'
                                  }}
                                >
                                  Učitel
                                </span>
                              )}
                              {isCurrentUser && (
                                <span className="text-xs text-white/30">(ty)</span>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main chat area - Light theme */}
        <div className="flex-1 flex flex-col min-w-0 bg-white">
          {/* Channel header */}
          <div className="h-14 px-4 flex items-center justify-between shrink-0 bg-white border-b border-slate-200">
            <div className="flex items-center gap-3">
              {/* Mobile menu button */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
              >
                <Menu className="w-5 h-5" />
              </button>
              {/* Desktop sidebar toggle when hidden */}
              {!sidebarVisible && (
                <button
                  onClick={() => setSidebarVisible(true)}
                  className="hidden lg:block p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                  title="Zobrazit menu"
                >
                  <Menu className="w-5 h-5" />
                </button>
              )}
              
              {chatMode === 'dm' && activeDM ? (
                (() => {
                  const otherParticipant = activeDM.participants?.find(p => p.id !== (student?.id || teacherId));
                  return (
                    <>
                      <button
                        onClick={() => {
                          setChatMode('class');
                          setActiveDM(null);
                        }}
                        className="p-1 hover:bg-slate-100 rounded-md text-slate-500"
                      >
                        <ArrowLeft className="w-5 h-5" />
                      </button>
                      <div 
                        className="shrink-0 rounded-full flex items-center justify-center text-sm font-medium"
                        style={{ 
                          width: '32px',
                          height: '32px',
                          minWidth: '32px',
                          minHeight: '32px',
                          backgroundColor: otherParticipant?.type === 'teacher' ? '#d97706' : '#4f46e5',
                          color: 'white'
                        }}
                      >
                        {otherParticipant?.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <h1 className="text-lg font-semibold text-slate-800">
                        {otherParticipant?.name || 'Konverzace'}
                      </h1>
                    </>
                  );
                })()
              ) : (
                <>
                  <Hash className="w-5 h-5 text-indigo-500" />
                  <h1 className="text-lg font-semibold text-slate-800">
                    {classInfo?.name || student?.class_name || 'Zprávy'}
                  </h1>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 text-slate-500">
              {chatMode === 'class' && (
                <>
                  <Users className="w-4 h-4" />
                  <span className="text-sm">{onlineUsers.filter(u => u.isOnline).length} online</span>
                </>
              )}
            </div>
          </div>

        {/* Pinned messages - Light theme */}
        {pinnedMessages.length > 0 && (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-200">
            <div className="flex items-center gap-2 text-amber-600 text-sm">
              <Pin className="w-4 h-4" />
              <span className="font-medium">Připnuté zprávy:</span>
            </div>
            <div className="mt-1 space-y-1">
              {pinnedMessages.map(msg => (
                <div key={msg.id} className="text-sm text-amber-800 truncate">
                  <span className="font-medium">{msg.authorName}:</span> {msg.content}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Messages area - Light theme */}
        <div className="flex-1 overflow-y-auto px-4 py-4 bg-slate-50">
          {chatMode === 'dm' && activeDM ? (
            /* DM Messages */
            <>
              {dmMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <MessageSquare className="w-12 h-12 text-slate-300 mb-3" />
                  <p className="text-slate-500">Zatím žádné zprávy</p>
                  <p className="text-sm text-slate-400 mt-1">Napište první zprávu a začněte konverzaci</p>
                </div>
              ) : (
                dmMessages.map((msg, idx) => {
                  const isOwnMessage = msg.senderId === (student?.id || teacherId);
                  const showAuthor = idx === 0 || dmMessages[idx - 1].senderId !== msg.senderId;
                  
                  return (
                    <div
                      key={msg.id}
                      className={`group relative ${showAuthor ? 'mt-4' : 'mt-0.5'} hover:bg-slate-100 px-2 py-1 -mx-2 rounded-lg`}
                    >
                      <div className="flex items-start gap-3">
                        {showAuthor ? (
                          (() => {
                            // Find member to get their avatar
                            const member = classMembers.find(m => m.id === msg.senderId);
                            if (member?.avatar && msg.senderType === 'student') {
                              return <AvatarDisplay avatar={member.avatar} size={36} />;
                            }
                            return (
                              <div 
                                className="shrink-0 rounded-full flex items-center justify-center text-sm font-semibold"
                                style={{ 
                                  width: '36px',
                                  height: '36px',
                                  minWidth: '36px',
                                  minHeight: '36px',
                                  backgroundColor: msg.senderType === 'teacher' ? '#d97706' : (member?.color || '#4f46e5'),
                                  color: 'white'
                                }}
                              >
                                {member?.initials || msg.senderName?.charAt(0)?.toUpperCase() || '?'}
                              </div>
                            );
                          })()
                        ) : (
                          <div style={{ width: '36px', minWidth: '36px' }} />
                        )}
                        <div className="flex-1 min-w-0">
                          {showAuthor && (
                            <div className="flex items-baseline gap-2 mb-0.5">
                              <span 
                                className="font-semibold text-sm"
                                style={{ color: msg.senderType === 'teacher' ? '#d97706' : '#4f46e5' }}
                              >
                                {msg.senderName}
                              </span>
                              <span className="text-xs text-slate-400">
                                {format(new Date(msg.createdAt), 'HH:mm')}
                              </span>
                            </div>
                          )}
                          <p className="text-slate-700 break-words whitespace-pre-wrap">
                            {msg.content}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </>
          ) : (
            /* Class Messages */
            <>
          {Object.entries(groupedMessages).map(([date, dayMessages]) => (
            <div key={date}>
              {/* Date divider */}
              <div className="flex items-center gap-4 my-4">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs font-medium text-slate-400 bg-slate-50 px-2">
                  {formatDateDivider(date)}
                </span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              {/* Messages for this day */}
              {dayMessages.map((message, idx) => {
                const isOwnMessage = message.authorId === (student?.id || teacherId);
                const showAuthor = idx === 0 || dayMessages[idx - 1].authorId !== message.authorId;
                const reactions = message.reactions ? Object.values(message.reactions).flat() : [];
                const groupedReactions = reactions.reduce((acc, r) => {
                  if (!acc[r.emoji]) acc[r.emoji] = [];
                  acc[r.emoji].push(r);
                  return acc;
                }, {} as Record<string, typeof reactions>);

                return (
                  <div
                    key={message.id}
                    className={`group relative ${showAuthor ? 'mt-4' : 'mt-0.5'} hover:bg-slate-100 px-2 py-1 -mx-2 rounded-lg`}
                  >
                    {/* Reply indicator */}
                    {message.parentId && (
                      <div className="flex items-center gap-2 text-xs text-slate-500 mb-1 ml-12">
                        <Reply className="w-3 h-3 rotate-180" />
                        <span>Odpověď na zprávu</span>
                      </div>
                    )}

                    <div className="flex gap-3">
                      {/* Avatar */}
                      {showAuthor ? (
                        (() => {
                          // Find member to get their avatar
                          const member = classMembers.find(m => m.id === message.authorId);
                          if (member?.avatar && message.authorType === 'student') {
                            return <AvatarDisplay avatar={member.avatar} size={40} />;
                          }
                          return (
                            <div 
                              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium shrink-0"
                              style={{ 
                                backgroundColor: message.authorType === 'teacher' ? '#d97706' : (member?.color || '#4f46e5'),
                                color: 'white' 
                              }}
                            >
                              {member?.initials || message.authorName.charAt(0).toUpperCase()}
                            </div>
                          );
                        })()
                      ) : (
                        <div className="w-10 shrink-0" />
                      )}

                      {/* Message content */}
                      <div className="flex-1 min-w-0">
                        {showAuthor && (
                          <div className="flex items-baseline gap-2 mb-0.5">
                            <span className={`font-semibold ${
                              message.authorType === 'teacher' ? 'text-amber-600' : 'text-slate-800'
                            }`}>
                              {message.authorName}
                            </span>
                            {message.authorType === 'teacher' && (
                              <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                                Učitel
                              </span>
                            )}
                            <span className="text-xs text-slate-400">
                              {formatMessageDate(message.createdAt)}
                            </span>
                            {message.isPinned && (
                              <Pin className="w-3 h-3 text-amber-500" />
                            )}
                          </div>
                        )}
                        
                        <p className="text-slate-700 whitespace-pre-wrap break-words">
                          {message.content}
                        </p>
                        
                        {/* Shared content preview in message */}
                        {message.sharedContent && (
                          <Link
                            to={message.sharedContent.url || '#'}
                            className="mt-3 flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 hover:border-indigo-300 hover:shadow-sm transition-all group"
                          >
                            <div className={`shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${
                              message.sharedContent.type === 'lesson' ? 'bg-indigo-100' :
                              message.sharedContent.type === 'worksheet' ? 'bg-green-100' :
                              message.sharedContent.type === 'quiz' ? 'bg-amber-100' :
                              message.sharedContent.type === 'board' ? 'bg-purple-100' :
                              'bg-blue-100'
                            }`}>
                              {message.sharedContent.type === 'lesson' && <BookOpen className="w-6 h-6 text-indigo-600" />}
                              {message.sharedContent.type === 'worksheet' && <ClipboardList className="w-6 h-6 text-green-600" />}
                              {message.sharedContent.type === 'quiz' && <FileText className="w-6 h-6 text-amber-600" />}
                              {message.sharedContent.type === 'board' && <LayoutGrid className="w-6 h-6 text-purple-600" />}
                              {message.sharedContent.type === 'document' && <FileText className="w-6 h-6 text-blue-600" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-800 group-hover:text-indigo-600 transition-colors truncate">
                                {message.sharedContent.title}
                              </p>
                              {message.sharedContent.description && (
                                <p className="text-sm text-slate-500 truncate">{message.sharedContent.description}</p>
                              )}
                            </div>
                            <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                          </Link>
                        )}

                        {/* Reactions */}
                        {Object.keys(groupedReactions).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {Object.entries(groupedReactions).map(([emoji, users]) => {
                              const hasReacted = users.some(u => u.userId === (student?.id || teacherId));
                              return (
                                <button
                                  key={emoji}
                                  onClick={() => handleToggleReaction(message.id, emoji)}
                                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-sm transition-colors ${
                                    hasReacted 
                                      ? 'bg-indigo-100 border border-indigo-300' 
                                      : 'bg-slate-100 hover:bg-slate-200 border border-slate-200'
                                  }`}
                                  title={users.map(u => u.userName).join(', ')}
                                >
                                  <span>{emoji}</span>
                                  <span className="text-slate-600">{users.length}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Message actions */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-start gap-1">
                        {/* Emoji picker */}
                        <div className="relative">
                          <button
                            onClick={() => setShowEmojiPicker(showEmojiPicker === message.id ? null : message.id)}
                            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded"
                          >
                            <Smile className="w-4 h-4" />
                          </button>
                          {showEmojiPicker === message.id && (
                            <div className="absolute right-0 top-8 bg-white rounded-lg shadow-xl border border-slate-200 p-2 flex gap-1 z-10">
                              {EMOJI_REACTIONS.map(emoji => (
                                <button
                                  key={emoji}
                                  onClick={() => handleToggleReaction(message.id, emoji)}
                                  className="p-1.5 hover:bg-slate-100 rounded text-lg"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Reply */}
                        <button
                          onClick={() => {
                            setReplyingTo(message);
                            inputRef.current?.focus();
                          }}
                          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded"
                        >
                          <Reply className="w-4 h-4" />
                        </button>

                        {/* More options */}
                        {(isOwnMessage || isTeacher) && (
                          <div className="relative">
                            <button
                              onClick={() => setShowMessageMenu(showMessageMenu === message.id ? null : message.id)}
                              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                            {showMessageMenu === message.id && (
                              <div className="absolute right-0 top-8 bg-white rounded-lg shadow-xl border border-slate-200 py-1 min-w-[140px] z-10">
                                {isTeacher && (
                                  <button
                                    onClick={() => handlePinMessage(message)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                                  >
                                    <Pin className="w-4 h-4" />
                                    {message.isPinned ? 'Odepnout' : 'Připnout'}
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteMessage(message.id)}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Smazat
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Reply indicator - Light theme */}
        {replyingTo && (
          <div className="px-4 py-2 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Reply className="w-4 h-4" />
              <span>Odpovídáte na:</span>
              <span className="text-slate-800 font-medium">{replyingTo.authorName}</span>
              <span className="text-slate-400 truncate max-w-[200px]">{replyingTo.content}</span>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="p-1 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Selected content preview - Light theme */}
        {selectedContent && (
          <div className="px-4 py-3 bg-white border-t border-slate-200">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200">
              <div className={`shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${
                selectedContent.type === 'lesson' ? 'bg-indigo-100' :
                selectedContent.type === 'worksheet' ? 'bg-green-100' :
                selectedContent.type === 'quiz' ? 'bg-amber-100' :
                selectedContent.type === 'board' ? 'bg-purple-100' :
                'bg-blue-100'
              }`}>
                {selectedContent.type === 'lesson' && <BookOpen className="w-6 h-6 text-indigo-600" />}
                {selectedContent.type === 'worksheet' && <ClipboardList className="w-6 h-6 text-green-600" />}
                {selectedContent.type === 'quiz' && <FileText className="w-6 h-6 text-amber-600" />}
                {selectedContent.type === 'board' && <LayoutGrid className="w-6 h-6 text-purple-600" />}
                {selectedContent.type === 'document' && <FileText className="w-6 h-6 text-blue-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-800 truncate">{selectedContent.title}</p>
                {selectedContent.description && (
                  <p className="text-sm text-slate-500 truncate">{selectedContent.description}</p>
                )}
              </div>
              <button
                onClick={() => setSelectedContent(null)}
                className="shrink-0 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Message input - Light theme */}
        <div className="p-4 bg-white border-t border-slate-200">
          {/* Teacher notice - only in class chat, not DM */}
          {isTeacher && chatMode === 'class' && (
            <p className="text-xs text-slate-500 mb-2 text-center">
              Vaše zpráva se zobrazí v třídním chatu a na zdi žáků.
            </p>
          )}
          <div className="flex items-end gap-3 rounded-xl px-4 py-3 bg-slate-100 border border-slate-200">
            {/* Add content button - only for teachers */}
            {isTeacher && (
              <button
                onClick={() => {
                  setShowContentSidebar(true);
                  setSidebarOpen(true);
                }}
                className={`shrink-0 p-2 rounded-lg transition-colors ${
                  showContentSidebar 
                    ? 'text-indigo-600 bg-indigo-100' 
                    : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'
                }`}
                title="Sdílet obsah"
              >
                <Plus className="w-5 h-5" />
              </button>
            )}
            
            <textarea
              ref={inputRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={chatMode === 'dm' && activeDM 
                ? `Napište zprávu pro ${activeDM.participants?.find(p => p.id !== (student?.id || teacherId))?.name || 'uživatele'}...`
                : `Napište zprávu do #${classInfo?.name || 'chat'}...`}
              className="flex-1 bg-transparent text-slate-800 placeholder-slate-400 resize-none focus:outline-none max-h-32 min-w-0"
              rows={1}
              style={{ minHeight: '24px' }}
            />
            <button
              onClick={handleSendMessage}
              disabled={(!newMessage.trim() && !selectedContent) || sending}
              className={`p-2 rounded-lg transition-colors shrink-0 ${
                (newMessage.trim() || selectedContent) && !sending 
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                  : 'bg-slate-200 text-slate-400'
              }`}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
        </div>
      </div>

      {/* New DM Modal */}
      {showNewDMModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">Nová zpráva</h2>
              <button
                onClick={() => setShowNewDMModal(false)}
                className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto">
              <p className="text-sm text-slate-500 mb-4">Vyberte komu chcete napsat:</p>
              <div className="space-y-2">
                {classMembers
                  .filter(m => m.id !== (student?.id || teacherId))
                  .map(member => {
                    const isOnline = onlineUsers.some(u => u.id === member.id && u.isOnline);
                    return (
                      <button
                        key={member.id}
                        onClick={() => startDMConversation(member)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-100 transition-colors text-left"
                      >
                        <div className="relative">
                          <div 
                            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium"
                            style={{ 
                              backgroundColor: member.type === 'teacher' ? '#d97706' : '#4f46e5',
                              color: 'white'
                            }}
                          >
                            {member.name.charAt(0).toUpperCase()}
                          </div>
                          <div 
                            className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white"
                            style={{ 
                              backgroundColor: isOnline ? '#22c55e' : '#94a3b8'
                            }}
                          />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-slate-800">{member.name}</div>
                          <div className="text-sm text-slate-500">
                            {member.type === 'teacher' ? 'Učitel' : 'Spolužák'}
                            {isOnline ? ' • Online' : ''}
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300" />
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

