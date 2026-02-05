/**
 * Curriculum Factory
 * 
 * Systém pro automatickou tvorbu vzdělávacích materiálů podle RVP.
 * Orchestruje 6 specializovaných AI agentů v pipeline.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  BookOpen,
  Calendar,
  FileText,
  Image as ImageIcon,
  Package,
  ChevronRight,
  ChevronDown,
  Settings,
  Eye,
  Download,
  Sparkles,
  Search,
  Filter,
  BarChart3,
  Scroll,
  GraduationCap,
  Target,
  Layers,
  Bot,
  Zap,
  X,
  Check
} from 'lucide-react';
import { supabase } from '../../utils/supabase/client';
import { toast } from 'sonner';
import {
  runAgent1,
  runAgent2,
  runAgent3,
  runAgent4,
  runAgent5,
  runAgent6,
  runAgent7,
  // NEW: DataSet-based agents
  runAgent3DataSet,
  runAgent4DataSet,
  runAgent6DataSet,
  runDataSetPipeline
} from '../../utils/curriculum/agents';
import {
  CurriculumSubject,
  RvpData,
  WeeklyPlan,
  ContentSpec,
  PipelineRun,
  SubjectCode,
  Grade,
  AgentStatus,
  SUBJECT_NAMES,
  GRADE_NAMES,
  CONTENT_TYPE_NAMES,
  DIFFICULTY_NAMES,
  WEEK_TO_MONTH
} from '../../types/curriculum';

// =====================================================
// AGENT DEFINITIONS
// =====================================================

interface AgentDefinition {
  id: number;
  name: string;
  icon: React.ReactNode;
  description: string;
  color: string;
}

const AGENTS: AgentDefinition[] = [
  {
    id: 1,
    name: 'RVP Scout',
    icon: <Search className="w-4 h-4" />,
    description: 'Stáhne RVP témata, výstupy a kompetence',
    color: '#3B82F6' // blue
  },
  {
    id: 2,
    name: 'Planner',
    icon: <Calendar className="w-4 h-4" />,
    description: 'Rozloží učivo do týdenních plánů',
    color: '#8B5CF6' // purple
  },
  {
    id: 3,
    name: 'Data Collector',
    icon: <Layers className="w-4 h-4" />,
    description: 'Vytvoří DataSety z RVP témat (pojmy, fakta, obrázky)',
    color: '#EC4899' // pink
  },
  {
    id: 4,
    name: 'Creator',
    icon: <Sparkles className="w-4 h-4" />,
    description: 'Generuje materiály z DataSetů (texty, testy, lekce)',
    color: '#F59E0B' // amber
  },
  {
    id: 5,
    name: 'Publisher',
    icon: <Package className="w-4 h-4" />,
    description: 'Ukládá materiály do admin knihovny',
    color: '#6366F1' // indigo
  }
];

// =====================================================
// COMPONENT
// =====================================================

export function CurriculumFactory() {
  const navigate = useNavigate();
  
  // State
  const [subjects, setSubjects] = useState<CurriculumSubject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<SubjectCode | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<Grade | null>(null);
  const [rvpData, setRvpData] = useState<RvpData[]>([]);
  const [weeklyPlans, setWeeklyPlans] = useState<WeeklyPlan[]>([]);
  const [contentSpecs, setContentSpecs] = useState<ContentSpec[]>([]);
  
  // Pipeline state
  const [currentRun, setCurrentRun] = useState<PipelineRun | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  // Demo mód = omezený běh pro testování (1 téma, 5 materiálů)
  const [demoMode, setDemoMode] = useState(false);
  const [demoTopic, setDemoTopic] = useState('Starověké Řecko'); // Téma pro demo mód
  // Nový DataSet-based flow (doporučeno)
  const [useDataSetFlow, setUseDataSetFlow] = useState(true);
  
  // UI state
  const [activeTab, setActiveTab] = useState<'overview' | 'rvp' | 'planner' | 'datasets'>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set());
  
  // DataSety
  const [dataSets, setDataSets] = useState<any[]>([]);
  const [dataSetsLoading, setDataSetsLoading] = useState(false);
  const [generatingDataSetId, setGeneratingDataSetId] = useState<string | null>(null);
  const [selectedDataSet, setSelectedDataSet] = useState<any | null>(null);
  
  // Výběr RVP témat pro generování
  const [selectedRvpIds, setSelectedRvpIds] = useState<Set<string>>(new Set());
  const [showRvpSelectionModal, setShowRvpSelectionModal] = useState(false);
  
  // Chatbot pro DataSet feedback
  const [dataSetFeedback, setDataSetFeedback] = useState<Record<string, string>>({});
  const [savingDataSetId, setSavingDataSetId] = useState<string | null>(null);
  
  // Vyhledávání obrázků pro DataSet
  const [imageSearchQuery, setImageSearchQuery] = useState<Record<string, string>>({});
  const [imageSearchResults, setImageSearchResults] = useState<Record<string, any[]>>({});
  const [searchingImages, setSearchingImages] = useState<string | null>(null);
  
  // Debounce pro ukládání změn obrázků
  const pendingImageChanges = useRef<Map<string, { images?: any[]; illustrations?: any[] }>>(new Map());
  const saveTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());
  
  /**
   * Toggle excluded stav obrázku/ilustrace s debounce a race-condition fix
   */
  const toggleMediaExclusion = useCallback((
    dataSetId: string,
    type: 'image' | 'illustration',
    index: number
  ) => {
    // 1. Okamžitý optimistický update lokálního stavu
    setDataSets(prev => prev.map(ds => {
      if (ds.id !== dataSetId) return ds;
      
      if (type === 'image') {
        const updatedImages = ds.media.images.map((img: any, idx: number) =>
          idx === index ? { ...img, excluded: !img.excluded } : img
        );
        
        // Uložit pending změnu
        const pending = pendingImageChanges.current.get(dataSetId) || {};
        pending.images = updatedImages;
        pendingImageChanges.current.set(dataSetId, pending);
        
        return { ...ds, media: { ...ds.media, images: updatedImages } };
      } else {
        const updatedIllustrations = ds.media.generatedIllustrations.map((ill: any, idx: number) =>
          idx === index ? { ...ill, excluded: !ill.excluded } : ill
        );
        
        // Uložit pending změnu
        const pending = pendingImageChanges.current.get(dataSetId) || {};
        pending.illustrations = updatedIllustrations;
        pendingImageChanges.current.set(dataSetId, pending);
        
        return { ...ds, media: { ...ds.media, generatedIllustrations: updatedIllustrations } };
      }
    }));
    
    // 2. Debounce uložení do databáze (500ms)
    const existingTimeout = saveTimeouts.current.get(dataSetId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    const timeout = setTimeout(async () => {
      const pending = pendingImageChanges.current.get(dataSetId);
      if (!pending) return;
      
      try {
        // Načíst aktuální stav z DB
        const { data: currentDS, error: fetchError } = await supabase
          .from('topic_data_sets')
          .select('media')
          .eq('id', dataSetId)
          .single();
        
        if (fetchError || !currentDS) {
          console.error('Failed to fetch current DataSet:', fetchError);
          return;
        }
        
        // Aplikovat pending změny na aktuální stav
        const updatedMedia = { ...currentDS.media };
        if (pending.images) {
          updatedMedia.images = pending.images;
        }
        if (pending.illustrations) {
          updatedMedia.generatedIllustrations = pending.illustrations;
        }
        
        // Uložit do DB
        const { error } = await supabase
          .from('topic_data_sets')
          .update({ media: updatedMedia })
          .eq('id', dataSetId);
        
        if (error) {
          console.error('Failed to save media changes:', error);
        } else {
          console.log('[CurriculumFactory] Media changes saved for', dataSetId);
        }
        
        // Vyčistit pending
        pendingImageChanges.current.delete(dataSetId);
        saveTimeouts.current.delete(dataSetId);
        
      } catch (err) {
        console.error('Error saving media changes:', err);
      }
    }, 500);
    
    saveTimeouts.current.set(dataSetId, timeout);
  }, []);
  
  /**
   * Smazat všechny materiály DataSetu
   */
  const deleteDataSetMaterials = async (dataSet: any) => {
    if (!confirm(`Opravdu smazat všech ${(dataSet.generated_materials || []).length} materiálů pro "${dataSet.topic}"?`)) {
      return;
    }
    
    setGeneratingDataSetId(dataSet.id);
    addProgressMessage(`🗑️ Mažu materiály "${dataSet.topic}"...`);
    
    try {
      const materials = dataSet.generated_materials || [];
      let deleted = 0;
      
      for (const mat of materials) {
        if (!mat.id) continue;
        
        const table = mat.type === 'text' || mat.type === 'methodology' 
          ? 'teacher_documents'
          : mat.type === 'worksheet'
          ? 'teacher_worksheets'
          : 'teacher_boards';
        
        const { error } = await supabase
          .from(table)
          .delete()
          .eq('id', mat.id);
        
        if (!error) deleted++;
      }
      
      // Vyčistit generated_materials v DataSetu
      await supabase
        .from('topic_data_sets')
        .update({ 
          generated_materials: [], 
          status: 'ready',
          updated_at: new Date().toISOString() 
        })
        .eq('id', dataSet.id);
      
      addProgressMessage(`✅ Smazáno ${deleted} materiálů`);
      toast.success(`Smazáno ${deleted} materiálů`);
      await loadDataSets();
      
    } catch (err: any) {
      console.error('Delete error:', err);
      addProgressMessage(`❌ Chyba: ${err.message}`);
      toast.error('Mazání selhalo');
    } finally {
      setGeneratingDataSetId(null);
    }
  };

  /**
   * Smazat celý DataSet (včetně materiálů)
   */
  const deleteDataSet = async (dataSet: any) => {
    if (!confirm(`Opravdu smazat CELÝ DataSet "${dataSet.topic}" včetně všech materiálů? Tato akce je nevratná!`)) {
      return;
    }
    
    setGeneratingDataSetId(dataSet.id);
    addProgressMessage(`🗑️ Mažu DataSet "${dataSet.topic}"...`);
    
    try {
      // Nejdřív smazat materiály
      const materials = dataSet.generated_materials || [];
      let deleted = 0;
      
      for (const mat of materials) {
        if (!mat.id) continue;
        
        const table = mat.type === 'text' || mat.type === 'methodology' 
          ? 'teacher_documents'
          : mat.type === 'worksheet'
          ? 'teacher_worksheets'
          : 'teacher_boards';
        
        const { error } = await supabase
          .from(table)
          .delete()
          .eq('id', mat.id);
        
        if (!error) deleted++;
      }
      
      // Smazat DataSet z databáze
      const { error: dsError } = await supabase
        .from('topic_data_sets')
        .delete()
        .eq('id', dataSet.id);
      
      if (dsError) {
        throw new Error(`Nelze smazat DataSet: ${dsError.message}`);
      }
      
      addProgressMessage(`✅ DataSet "${dataSet.topic}" smazán (+ ${deleted} materiálů)`);
      toast.success(`DataSet smazán`);
      
      await loadDataSets();
      
    } catch (err: any) {
      console.error('Delete DataSet error:', err);
      addProgressMessage(`❌ Chyba: ${err.message}`);
      toast.error('Mazání DataSetu selhalo');
    } finally {
      setGeneratingDataSetId(null);
    }
  };

  /**
   * Uložit materiály DataSetu do admin knihovny (menu struktury)
   */
  const saveDataSetToLibrary = async (dataSet: any) => {
    setSavingDataSetId(dataSet.id);
    addProgressMessage(`💾 Ukládám materiály "${dataSet.topic}" do admin knihovny...`);
    
    try {
      const materials = dataSet.generated_materials || [];
      const category = selectedSubject; // e.g. 'dejepis'
      
      // 1. Získat session pro API call
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Nejste přihlášeni');
      }
      
      // 2. Načíst aktuální menu strukturu
      addProgressMessage(`📂 Načítám strukturu knihovny...`);
      const menuResp = await fetch(`https://njbtqmsxbyvpwigfceke.supabase.co/functions/v1/make-server-46c8107b/menu/${category}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      
      let menuStructure: any[] = [];
      if (menuResp.ok) {
        const data = await menuResp.json();
        menuStructure = data.menu || [];
        console.log('[SaveToLibrary] Loaded menu structure:', JSON.stringify(menuStructure, null, 2));
        console.log('[SaveToLibrary] Menu has', menuStructure.length, 'top-level items');
      } else {
        console.error('[SaveToLibrary] Failed to load menu:', menuResp.status, await menuResp.text());
      }
      
      // 3. Najít nebo vytvořit složku ročníku
      const gradeName = `${selectedGrade}. ročník`;
      let gradeFolder = menuStructure.find((f: any) => f.label === gradeName);
      console.log('[SaveToLibrary] Looking for grade folder:', gradeName, 'Found:', !!gradeFolder);
      
      if (!gradeFolder) {
        gradeFolder = {
          id: `folder-${Date.now()}-grade${selectedGrade}`,
          label: gradeName,
          slug: `${selectedGrade}-rocnik`,
          type: 'folder',
          icon: 'folder',
          children: [],
        };
        menuStructure.push(gradeFolder);
        addProgressMessage(`📁 Vytvořena složka "${gradeName}"`);
      }
      
      // 4. Najít nebo vytvořit složku tématu
      console.log('[SaveToLibrary] Grade folder children:', gradeFolder.children?.length || 0, 'items');
      console.log('[SaveToLibrary] Existing topics:', gradeFolder.children?.map((c: any) => c.label) || []);
      
      let topicFolder = (gradeFolder.children || []).find((f: any) => f.label === dataSet.topic);
      console.log('[SaveToLibrary] Looking for topic folder:', dataSet.topic, 'Found:', !!topicFolder);
      
      if (!topicFolder) {
        topicFolder = {
          id: `folder-${Date.now()}-${dataSet.topic.toLowerCase().replace(/\s+/g, '-')}`,
          label: dataSet.topic,
          slug: dataSet.topic.toLowerCase().replace(/\s+/g, '-'),
          type: 'folder',
          icon: 'folder',
          children: [],
        };
        gradeFolder.children = gradeFolder.children || [];
        gradeFolder.children.push(topicFolder);
        addProgressMessage(`📁 Vytvořena složka "${dataSet.topic}"`);
      }
      
      // 5. Přidat/aktualizovat materiály do složky tématu
      let added = 0;
      let updated = 0;
      
      // Mapování typů na hezké názvy
      const getDisplayName = (type: string, topic: string): string => {
        switch (type) {
          case 'text': return `${topic} - Učební text`;
          case 'board-easy': return `${topic} - Procvičování (úroveň 1)`;
          case 'board-hard': return `${topic} - Procvičování (úroveň 2)`;
          case 'worksheet': return `${topic} - Pracovní list`;
          case 'test': return `${topic} - Písemka`;
          case 'lesson': return `${topic} - Interaktivní lekce`;
          case 'lessons': return `${topic} - Badatelské lekce (sada)`;
          case 'methodology': return `${topic} - Metodická inspirace`;
          default: return `${topic} - ${type}`;
        }
      };
      
      // Určit typ pro menu
      const getMenuType = (matType: string): string => {
        if (matType === 'worksheet') return 'worksheet';
        if (matType === 'test') return 'test';
        if (matType === 'methodology') return 'methodology';
        if (matType === 'lesson') return 'interactive';
        if (matType.includes('board')) return 'practice';
        if (matType === 'text') return 'ucebni-text';
        return 'lesson';
      };
      
      topicFolder.children = topicFolder.children || [];
      
      for (const mat of materials) {
        if (!mat.id) continue;
        
        const menuType = getMenuType(mat.type);
        const displayName = getDisplayName(mat.type, dataSet.topic);
        
        // Hledat existující položku podle typu (ne podle ID - ID se mění při přegenerování)
        const existingIndex = topicFolder.children.findIndex(
          (item: any) => item.type === menuType && item.label === displayName
        );
        
        const menuItem = {
          id: mat.id,
          label: displayName,
          slug: mat.id,
          type: menuType,
          icon: menuType,
        };
        
        if (existingIndex >= 0) {
          // Přepsat existující
          topicFolder.children[existingIndex] = menuItem;
          updated++;
        } else {
          // Přidat nový
          topicFolder.children.push(menuItem);
          added++;
        }
      }
      
      // 6. Validace - musí být alespoň něco k uložení
      if (added === 0 && updated === 0) {
        throw new Error('Žádné materiály k uložení - nejprve vygenerujte materiály');
      }
      
      // 7. Uložit menu strukturu zpět
      console.log('[SaveToLibrary] Final grade folder children:', gradeFolder.children?.length, 'topics');
      console.log('[SaveToLibrary] Final topics:', gradeFolder.children?.map((c: any) => c.label));
      console.log('[SaveToLibrary] Saving menu structure with', menuStructure.length, 'top-level items');
      
      addProgressMessage(`💾 Ukládám do knihovny (${added} nových, ${updated} aktualizovaných)...`);
      const saveResp = await fetch(`https://njbtqmsxbyvpwigfceke.supabase.co/functions/v1/make-server-46c8107b/menu`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ menu: menuStructure, category }),
      });
      
      const responseBody = await saveResp.text();
      console.log('[SaveToLibrary] API response:', saveResp.status, responseBody);
      
      if (!saveResp.ok) {
        throw new Error(`Chyba ukládání menu: ${responseBody}`);
      }
      
      // 8. Označit DataSet jako published - AŽ po úspěšném uložení
      await supabase
        .from('topic_data_sets')
        .update({ status: 'published', updated_at: new Date().toISOString() })
        .eq('id', dataSet.id);
      
      const message = updated > 0 
        ? `✅ Aktualizováno ${updated}, přidáno ${added} položek do "${dataSet.topic}"`
        : `✅ Přidáno ${added} položek do "${dataSet.topic}"`;
      addProgressMessage(message);
      toast.success(updated > 0 ? `Aktualizováno ${updated}, přidáno ${added}` : `Uloženo ${added} materiálů`);
      await loadDataSets();
      
    } catch (err: any) {
      console.error('Save error:', err);
      addProgressMessage(`❌ Chyba: ${err.message}`);
      toast.error('Ukládání selhalo');
    } finally {
      setSavingDataSetId(null);
    }
  };
  
  /**
   * Přegenerovat materiály s feedbackem
   */
  const regenerateWithFeedback = async (dataSet: any, materialType: string) => {
    const feedback = dataSetFeedback[`${dataSet.id}-${materialType}`] || '';
    if (!feedback.trim()) {
      toast.error('Napište feedback před přegenerováním');
      return;
    }
    
    setGeneratingDataSetId(dataSet.id);
    addProgressMessage(`🔄 Přegenerovávám ${materialType} s feedbackem...`);
    
    try {
      // Uložit feedback do DataSetu
      const existingFeedback = dataSet.feedback || {};
      existingFeedback[materialType] = [
        ...(existingFeedback[materialType] || []),
        { text: feedback, timestamp: new Date().toISOString() }
      ];
      
      await supabase
        .from('topic_data_sets')
        .update({ feedback: existingFeedback })
        .eq('id', dataSet.id);
      
      // Přegenerovat s feedbackem
      const { generateFromDataSet } = await import('../../utils/dataset/material-generators');
      
      const topicDataSet = {
        id: dataSet.id,
        topic: dataSet.topic,
        subjectCode: dataSet.subject_code,
        grade: dataSet.grade,
        status: dataSet.status,
        rvp: dataSet.rvp || {},
        targetGroup: dataSet.target_group || {},
        content: dataSet.content || {},
        media: dataSet.media || { images: [], emojis: [], themeColors: [] },
        generatedMaterials: dataSet.generated_materials || [],
        feedback: existingFeedback,
        createdAt: dataSet.created_at,
        updatedAt: dataSet.updated_at,
      };
      
      const result = await generateFromDataSet(topicDataSet, materialType);
      
      if (result.success) {
        addProgressMessage(`✅ ${materialType} přegenerován`);
        toast.success('Materiál přegenerován');
        // Clear feedback input
        setDataSetFeedback(prev => {
          const next = { ...prev };
          delete next[`${dataSet.id}-${materialType}`];
          return next;
        });
        await loadDataSets();
      } else {
        addProgressMessage(`⚠️ ${result.error}`);
        toast.error(result.error || 'Chyba');
      }
    } catch (err: any) {
      console.error('Regenerate error:', err);
      addProgressMessage(`❌ Chyba: ${err.message}`);
      toast.error('Přegenerování selhalo');
    } finally {
      setGeneratingDataSetId(null);
    }
  };
  
  // Inicializovat výběr RVP témat když se načtou
  useEffect(() => {
    if (rvpData.length > 0 && selectedRvpIds.size === 0) {
      setSelectedRvpIds(new Set(rvpData.map(r => r.id)));
    }
  }, [rvpData]);
  
  // Toggle jednotlivého RVP tématu
  const toggleRvpSelection = (rvpId: string) => {
    setSelectedRvpIds(prev => {
      const next = new Set(prev);
      if (next.has(rvpId)) {
        next.delete(rvpId);
      } else {
        next.add(rvpId);
      }
      return next;
    });
  };
  
  // Vybrat/odebrat všechny RVP
  const toggleAllRvp = () => {
    if (selectedRvpIds.size === rvpData.length) {
      setSelectedRvpIds(new Set());
    } else {
      setSelectedRvpIds(new Set(rvpData.map(r => r.id)));
    }
  };
  
  // Statistics
  const [draftsCount, setDraftsCount] = useState(0);
  const [publishedCount, setPublishedCount] = useState(0);
  const [publishedBoards, setPublishedBoards] = useState<any[]>([]);
  const [publishedWorksheets, setPublishedWorksheets] = useState<any[]>([]);
  const [publishedDocs, setPublishedDocs] = useState<any[]>([]);
  const [mediaItems, setMediaItems] = useState<any[]>([]);
  
  // Raw data pro zobrazení v přehledu
  const [rawDrafts, setRawDrafts] = useState<any[]>([]);
  const [showRawData, setShowRawData] = useState(false);
  
  // =====================================================
  // DATA LOADING
  // =====================================================
  
  // Načíst DataSety
  const loadDataSets = useCallback(async () => {
    if (!selectedSubject || !selectedGrade) return;
    
    console.log('[loadDataSets] Loading for:', selectedSubject, selectedGrade);
    setDataSetsLoading(true);
    try {
      const { data, error } = await supabase
        .from('topic_data_sets')
        .select('*')
        .eq('subject_code', selectedSubject)
        .eq('grade', selectedGrade)
        .order('created_at', { ascending: false });
      
      console.log('[loadDataSets] Result:', { count: data?.length, error });
      
      if (error) throw error;
      setDataSets(data || []);
    } catch (err) {
      console.error('Error loading DataSets:', err);
    } finally {
      setDataSetsLoading(false);
    }
  }, [selectedSubject, selectedGrade]);
  
  const loadSubjects = useCallback(async () => {
    console.log('[CurriculumFactory] loadSubjects starting...');
    try {
      const { data, error } = await supabase
        .from('curriculum_subjects')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      console.log('[CurriculumFactory] loadSubjects result:', { count: data?.length, error });
      
      if (error) throw error;
      
      // Map from snake_case to camelCase
      const mapped = (data || []).map(s => ({
        id: s.id,
        code: s.code as SubjectCode,
        name: s.name,
        description: s.description,
        icon: s.icon,
        color: s.color,
        hoursPerWeekDefault: s.hours_per_week_default,
        grades: s.grades,
        isActive: s.is_active,
        createdAt: s.created_at,
        updatedAt: s.updated_at
      }));
      
      setSubjects(mapped);
      
      // Auto-select Dějepis if available
      const dejepis = mapped.find(s => s.code === 'dejepis');
      if (dejepis && !selectedSubject) {
        setSelectedSubject('dejepis');
        setSelectedGrade(6);
      }
    } catch (err) {
      console.error('Error loading subjects:', err);
      toast.error('Nepodařilo se načíst předměty');
    }
  }, [selectedSubject]);
  
  const loadRvpData = useCallback(async () => {
    if (!selectedSubject) return;
    
    try {
      let query = supabase
        .from('curriculum_rvp_data')
        .select('*')
        .eq('subject_code', selectedSubject)
        .order('grade')
        .order('order_index');
      
      if (selectedGrade) {
        query = query.eq('grade', selectedGrade);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      const mapped = (data || []).map(r => ({
        id: r.id,
        subjectCode: r.subject_code as SubjectCode,
        grade: r.grade as Grade,
        thematicArea: r.thematic_area,
        topic: r.topic,
        expectedOutcomes: r.expected_outcomes || [],
        keyCompetencies: r.key_competencies || [],
        crossCurricularTopics: r.cross_curricular_topics || [],
        recommendedHours: r.recommended_hours,
        difficultyLevel: r.difficulty_level,
        prerequisites: r.prerequisites || [],
        sourceDocument: r.source_document,
        rvpRevision: r.rvp_revision,
        orderIndex: r.order_index,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }));
      
      setRvpData(mapped);
    } catch (err) {
      console.error('Error loading RVP data:', err);
    }
  }, [selectedSubject, selectedGrade]);
  
  const loadWeeklyPlans = useCallback(async () => {
    if (!selectedSubject || !selectedGrade) return;
    
    try {
      const { data, error } = await supabase
        .from('curriculum_weekly_plans')
        .select('*')
        .eq('subject_code', selectedSubject)
        .eq('grade', selectedGrade)
        .order('week_number');
      
      if (error) throw error;
      
      const mapped = (data || []).map(w => ({
        id: w.id,
        subjectCode: w.subject_code as SubjectCode,
        grade: w.grade as Grade,
        schoolYear: w.school_year,
        weekNumber: w.week_number,
        monthName: w.month_name,
        topicTitle: w.topic_title,
        topicDescription: w.topic_description,
        rvpDataId: w.rvp_data_id,
        learningGoals: w.learning_goals || [],
        vocabulary: w.vocabulary || [],
        activitiesPlanned: w.activities_planned || [],
        hoursAllocated: w.hours_allocated,
        status: w.status,
        createdAt: w.created_at,
        updatedAt: w.updated_at
      }));
      
      setWeeklyPlans(mapped);
    } catch (err) {
      console.error('Error loading weekly plans:', err);
    }
  }, [selectedSubject, selectedGrade]);
  
  // Initial load with timeout fallback
  useEffect(() => {
    setIsLoading(true);
    
    // Timeout fallback - pokud loadSubjects trvá déle než 10s, pokračuj
    const timeout = setTimeout(() => {
      console.warn('[CurriculumFactory] loadSubjects timeout, forcing loading=false');
      setIsLoading(false);
    }, 10000);
    
    loadSubjects().finally(() => {
      clearTimeout(timeout);
      setIsLoading(false);
    });
    
    return () => clearTimeout(timeout);
  }, [loadSubjects]);
  
  // Load data when subject/grade changes
  useEffect(() => {
    if (selectedSubject) {
      loadRvpData();
    }
  }, [selectedSubject, selectedGrade, loadRvpData]);
  
  useEffect(() => {
    if (selectedSubject && selectedGrade) {
      loadWeeklyPlans();
    }
  }, [selectedSubject, selectedGrade, loadWeeklyPlans]);
  
  // Load statistics and published content
  const loadStatistics = useCallback(async () => {
    if (!selectedSubject || !selectedGrade) return;
    
    try {
      // Count drafts
      const { count: drafts } = await supabase
        .from('curriculum_content_drafts')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'draft');
      setDraftsCount(drafts || 0);
      
      // Load published boards
      const { data: boards } = await supabase
        .from('teacher_boards')
        .select('id, title, subject, grade, created_at, slides_count')
        .eq('copied_from', 'curriculum-factory')
        .eq('subject', SUBJECT_NAMES[selectedSubject])
        .eq('grade', selectedGrade)
        .order('created_at', { ascending: false });
      setPublishedBoards(boards || []);
      
      // Load published worksheets
      const { data: worksheets } = await supabase
        .from('teacher_worksheets')
        .select('id, name, worksheet_type, created_at')
        .eq('copied_from', 'curriculum-factory')
        .order('created_at', { ascending: false });
      setPublishedWorksheets(worksheets || []);
      
      // Load published documents
      const { data: docs } = await supabase
        .from('teacher_documents')
        .select('id, title, document_type, created_at')
        .eq('copied_from', 'curriculum-factory')
        .order('created_at', { ascending: false });
      setPublishedDocs(docs || []);
      
      // Total published
      setPublishedCount((boards?.length || 0) + (worksheets?.length || 0) + (docs?.length || 0));
      
      // Load media
      const { data: media } = await supabase
        .from('curriculum_media_library')
        .select('*')
        .contains('subject_tags', [selectedSubject])
        .order('created_at', { ascending: false })
        .limit(50);
      setMediaItems(media || []);
      
      // Load raw drafts for preview
      const { data: draftsData } = await supabase
        .from('curriculum_content_drafts')
        .select('*, curriculum_content_specs(title, content_type, content_subtype)')
        .order('created_at', { ascending: false })
        .limit(10);
      setRawDrafts(draftsData || []);
      
    } catch (err) {
      console.error('Error loading statistics:', err);
    }
  }, [selectedSubject, selectedGrade]);
  
  useEffect(() => {
    if (selectedSubject && selectedGrade) {
      // Paralelní načítání pro rychlejší odezvu
      Promise.all([
        loadStatistics(),
        loadDataSets()
      ]);
    }
  }, [selectedSubject, selectedGrade, loadStatistics, loadDataSets]);
  
  // =====================================================
  // DATASET SINGLE GENERATION
  // =====================================================
  
  /**
   * Generovat materiály z jednotlivého DataSetu
   */
  const generateFromSingleDataSet = async (dataSet: any, materialTypes: string[]) => {
    setGeneratingDataSetId(dataSet.id);
    addProgressMessage(`🚀 Generuji materiály pro "${dataSet.topic}"...`);
    
    try {
      const { generateFromDataSet } = await import('../../utils/dataset/material-generators');
      
      // Mapovat DB row na TopicDataSet
      // Filtrovat vyloučené obrázky a přidat vygenerované ilustrace
      const activeImages = (dataSet.media?.images || []).filter((img: any) => !img.excluded);
      const activeIllustrations = (dataSet.media?.generatedIllustrations || []).filter((ill: any) => !ill.excluded);
      
      console.log('[CurriculumFactory] Preparing DataSet for generation:', {
        topic: dataSet.topic,
        activeImages: activeImages.length,
        excludedImages: (dataSet.media?.images || []).length - activeImages.length,
        activeIllustrations: activeIllustrations.length,
        illustrationNames: activeIllustrations.map((i: any) => i.name)
      });
      
      const topicDataSet = {
        id: dataSet.id,
        topic: dataSet.topic,
        subjectCode: dataSet.subject_code,
        grade: dataSet.grade,
        status: dataSet.status,
        rvp: dataSet.rvp || {},
        targetGroup: dataSet.target_group || {},
        content: dataSet.content || {},
        media: {
          ...dataSet.media,
          images: activeImages,
          generatedIllustrations: activeIllustrations,
        },
        generatedMaterials: dataSet.generated_materials || [],
        createdAt: dataSet.created_at,
        updatedAt: dataSet.updated_at,
      };
      
      let generated = 0;
      const results: { type: string; success: boolean; id?: string; error?: string }[] = [];
      
      for (const type of materialTypes) {
        addProgressMessage(`  📝 Generuji ${type}...`);
        try {
          const result = await generateFromDataSet(topicDataSet, type);
          
          // Log save status for debugging
          if (result.success) {
            const saveStatus = [];
            if (result.savedToLocalStorage) saveStatus.push('localStorage');
            if (result.savedToSupabase) saveStatus.push('Supabase');
            if (saveStatus.length === 0) saveStatus.push('⚠️ NEULOŽENO!');
            addProgressMessage(`  💾 Uloženo do: ${saveStatus.join(', ')}`);
          }
          
          // Pro 'lessons' získat všechny lekce z localStorage
          if (type === 'lessons' && result.success) {
            const lessonsData = localStorage.getItem(`lessons-${dataSet.id}`);
            if (lessonsData) {
              const allLessons = JSON.parse(lessonsData);
              // Přidat každou lekci jako samostatný materiál
              for (const lesson of allLessons) {
                results.push({ 
                  type: 'lesson', // Uložit jako 'lesson' ne 'lessons'
                  success: true, 
                  id: lesson.id 
                });
                generated++;
              }
              addProgressMessage(`  ✅ ${allLessons.length} lekcí vygenerováno`);
            } else {
              results.push({ type, success: result.success, id: result.id, error: result.error });
              generated++;
              addProgressMessage(`  ✅ ${type} vygenerován`);
            }
          } else {
            results.push({ type, success: result.success, id: result.id, error: result.error });
            
            if (result.success) {
              generated++;
              addProgressMessage(`  ✅ ${type} vygenerován`);
            } else {
              addProgressMessage(`  ⚠️ ${type}: ${result.error}`);
            }
          }
        } catch (err: any) {
          results.push({ type, success: false, error: err.message });
          addProgressMessage(`  ❌ ${type} selhal: ${err.message}`);
        }
      }
      
      // Aktualizovat generated_materials v DataSetu
      // NAHRADIT existující materiály stejného typu (ne duplikovat!)
      const newMaterials = results
        .filter(r => r.success && r.id)
        .map(r => ({
          type: r.type,
          id: r.id,
          title: `${dataSet.topic} - ${r.type}`,
          status: 'draft',
          createdAt: new Date().toISOString()
        }));
      
      if (newMaterials.length > 0) {
        // DŮLEŽITÉ: Načíst aktuální stav z DB aby nedošlo k race condition!
        const { data: currentDataSet } = await supabase
          .from('topic_data_sets')
          .select('generated_materials')
          .eq('id', dataSet.id)
          .single();
        
        const currentMaterials = currentDataSet?.generated_materials || [];
        
        // Odebrat staré materiály stejných typů, které jsme právě vygenerovali
        const generatedTypes = new Set(newMaterials.map(m => m.type));
        const existingMaterials = currentMaterials.filter(
          (m: any) => !generatedTypes.has(m.type)
        );
        
        // Sloučit: staré (bez duplikátů) + nové
        const mergedMaterials = [...existingMaterials, ...newMaterials];
        
        console.log('[GenerateSingle] Merging materials:', {
          existing: currentMaterials.length,
          removed: currentMaterials.length - existingMaterials.length,
          new: newMaterials.length,
          final: mergedMaterials.length,
          types: mergedMaterials.map((m: any) => m.type)
        });
        
        await supabase
          .from('topic_data_sets')
          .update({
            generated_materials: mergedMaterials,
            updated_at: new Date().toISOString()
          })
          .eq('id', dataSet.id);
      }
      
      addProgressMessage(`✅ Hotovo: ${generated}/${materialTypes.length} materiálů pro "${dataSet.topic}"`);
      toast.success(`Vygenerováno ${generated} materiálů`);
      
      // Reload
      await loadDataSets();
      await loadStatistics();
      
    } catch (err: any) {
      console.error('[GenerateSingle] Error:', err);
      addProgressMessage(`❌ Chyba: ${err.message}`);
      toast.error('Generování selhalo');
    } finally {
      setGeneratingDataSetId(null);
    }
  };
  
  // =====================================================
  // PIPELINE CONTROL
  // =====================================================
  
  const startPipeline = async () => {
    if (!selectedSubject) {
      toast.error('Vyberte předmět');
      return;
    }
    
    setIsRunning(true);
    setIsPaused(false);
    
    // Create new pipeline run
    const newRun: PipelineRun = {
      id: crypto.randomUUID(),
      subjectCode: selectedSubject,
      grade: selectedGrade || undefined,
      runType: selectedGrade ? 'partial' : 'full',
      agent1Status: 'pending',
      agent2Status: 'pending',
      agent3Status: 'pending',
      agent4Status: 'pending',
      agent5Status: 'pending',
      agent6Status: 'pending',
      overallStatus: 'running',
      startedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    setCurrentRun(newRun);
    
    toast.success('Pipeline spuštěna', {
      description: `${SUBJECT_NAMES[selectedSubject]}${selectedGrade ? ` - ${GRADE_NAMES[selectedGrade]}` : ''}`
    });
    
    // Run agents sequentially
    try {
      if (useDataSetFlow) {
        // NOVÝ DATASET FLOW
        addProgressMessage(`📦 DataSet Flow aktivní`);
        
        if (demoMode) {
          // Demo mód s DataSety
          addProgressMessage(`🎯 DEMO: Téma "${demoTopic}"`);
          await executeDemoDataSet(newRun);
        } else {
          // Plný DataSet flow
          await executeAgent1(newRun);
          await executeAgent2(newRun);
          await executeDataSetPipeline(newRun);
        }
        
        await executeAgent7(newRun);
        
      } else if (demoMode) {
        // STARÝ FLOW - DEMO MÓD: Přeskočit Agent 1 a 2, rovnou vytvořit specifikace pro téma
        addProgressMessage(`🎯 DEMO MÓD: Téma "${demoTopic}"`);
        addProgressMessage(`⏭️ Přeskakuji Agent 1 a 2...`);
        
        // Vytvořit demo specifikace přímo
        await executeDemoSpecs(newRun);
        await executeAgent4(newRun);
        await executeAgent5(newRun);
        await executeAgent6(newRun);
        await executeAgent7(newRun);
      } else {
        // STARÝ FLOW - PLNÝ MÓD: Všechny agenty
        await executeAgent1(newRun);
        await executeAgent2(newRun);
        await executeAgent3(newRun);
        await executeAgent4(newRun);
        await executeAgent5(newRun);
        await executeAgent6(newRun);
        await executeAgent7(newRun);
      }
      
      setCurrentRun(prev => prev ? { ...prev, overallStatus: 'completed', completedAt: new Date().toISOString() } : null);
      toast.success('Pipeline dokončena!');
      
      // Reload statistics to show new content
      await loadStatistics();
    } catch (err) {
      console.error('Pipeline error:', err);
      setCurrentRun(prev => prev ? { ...prev, overallStatus: 'failed', errorMessage: String(err) } : null);
      toast.error('Pipeline selhala', { description: String(err) });
    } finally {
      setIsRunning(false);
    }
  };
  
  // DEMO: Vytvořit specifikace přímo pro zadané téma (přeskočí Agent 1, 2, 3)
  const executeDemoSpecs = async (run: PipelineRun) => {
    if (!selectedSubject || !selectedGrade) return;
    
    addProgressMessage(`📝 Vytvářím 5 specifikací pro "${demoTopic}"...`);
    setCurrentRun(prev => prev ? { ...prev, agent3Status: 'running', agent3StartedAt: new Date().toISOString() } : null);
    
    try {
      // Vytvořit demo specifikace přímo v DB
      // 6 materiálů: 1 text, 2 procvičování (lehké+těžké), 1 pracovní list, 1 písemka, 1 lekce E-U-R
      const demoSpecs = [
        {
          id: crypto.randomUUID(),
          weekly_plan_id: null,
          subject_code: selectedSubject,
          grade: selectedGrade,
          content_type: 'text',
          content_subtype: 'ucebni_text',
          title: `${demoTopic} - Výkladový text`,
          description: `Stručný učební text s infoboxy o tématu ${demoTopic}`,
          difficulty: 'medium',
          priority: 1,
          status: 'pending',
          learning_objectives: ['Žák popíše hlavní charakteristiky tématu', 'Žák vysvětlí klíčové pojmy'],
          bloom_level: 'porozumeni'
        },
        {
          id: crypto.randomUUID(),
          weekly_plan_id: null,
          subject_code: selectedSubject,
          grade: selectedGrade,
          content_type: 'board',
          content_subtype: 'procvicovani',
          title: `${demoTopic} - Procvičování (lehké)`,
          description: `Snadné procvičování pro zopakování základů`,
          difficulty: 'easy',
          priority: 2,
          status: 'pending',
          question_types: ['abc'],
          question_count: 6
        },
        {
          id: crypto.randomUUID(),
          weekly_plan_id: null,
          subject_code: selectedSubject,
          grade: selectedGrade,
          content_type: 'board',
          content_subtype: 'procvicovani',
          title: `${demoTopic} - Procvičování (těžké)`,
          description: `Náročnější procvičování pro pokročilé`,
          difficulty: 'hard',
          priority: 3,
          status: 'pending',
          question_types: ['abc', 'open'],
          question_count: 8
        },
        {
          id: crypto.randomUUID(),
          weekly_plan_id: null,
          subject_code: selectedSubject,
          grade: selectedGrade,
          content_type: 'worksheet',
          content_subtype: 'pracovni_list',
          title: `${demoTopic} - Pracovní list`,
          description: `Pracovní list k tématu ${demoTopic}`,
          difficulty: 'medium',
          priority: 4,
          status: 'pending',
          question_types: ['fill-blank', 'free-answer', 'multiple-choice'],
          question_count: 6
        },
        {
          id: crypto.randomUUID(),
          weekly_plan_id: null,
          subject_code: selectedSubject,
          grade: selectedGrade,
          content_type: 'board',
          content_subtype: 'pisemka',
          title: `${demoTopic} - Písemka`,
          description: `Ověření znalostí - otevřené otázky`,
          difficulty: 'medium',
          priority: 5,
          status: 'pending',
          question_types: ['open', 'abc'],
          question_count: 8
        },
        {
          id: crypto.randomUUID(),
          weekly_plan_id: null,
          subject_code: selectedSubject,
          grade: selectedGrade,
          content_type: 'board',
          content_subtype: 'lekce',
          title: `${demoTopic} - Interaktivní lekce`,
          description: `Konstruktivistická lekce E-U-R: Evokace, Uvědomění, Reflexe. Společné budování znalostí přes nástěnku a hlasování.`,
          difficulty: 'medium',
          priority: 6,
          status: 'pending',
          question_types: ['board', 'voting'],
          question_count: 10
        }
      ];
      
      // Vložit do DB
      const { error } = await supabase
        .from('curriculum_content_specs')
        .insert(demoSpecs);
      
      if (error) {
        console.error('[Demo] Specs insert error:', error);
        throw error;
      }
      
      addProgressMessage(`✅ Vytvořeno 6 specifikací pro "${demoTopic}"`);
      setCurrentRun(prev => prev ? { 
        ...prev, 
        agent3Status: 'completed', 
        agent3CompletedAt: new Date().toISOString(),
        agent3Output: { 
          contentSpecsCreated: 6, 
          specIds: demoSpecs.map(s => s.id),
          byType: { board: 4, worksheet: 1, text: 1, quiz: 0 }
        }
      } : null);
      
    } catch (err) {
      console.error('[Demo] Error creating specs:', err);
      setCurrentRun(prev => prev ? { ...prev, agent3Status: 'failed' } : null);
      throw err;
    }
  };
  
  const pausePipeline = () => {
    setIsPaused(true);
    toast.info('Pipeline pozastavena');
  };
  
  const resumePipeline = () => {
    setIsPaused(false);
    toast.info('Pipeline obnovena');
  };
  
  const resetPipeline = () => {
    setCurrentRun(null);
    setIsRunning(false);
    setIsPaused(false);
    toast.info('Pipeline resetována');
  };
  
  // DEBUG: Kontrola dat v databázi
  const debugDatabase = async () => {
    console.log('=== DATABASE DEBUG ===');
    console.log('Selected:', { selectedSubject, selectedGrade });
    
    // 1. Check RVP data
    const { data: rvp, error: rvpErr } = await supabase
      .from('curriculum_rvp_data')
      .select('id, topic, grade')
      .eq('subject_code', selectedSubject)
      .eq('grade', selectedGrade)
      .limit(5);
    console.log('RVP data:', rvp?.length || 0, rvpErr ? rvpErr : '', rvp?.slice(0, 2));
    
    // 2. Check weekly plans
    const { data: plans, error: plansErr } = await supabase
      .from('curriculum_weekly_plans')
      .select('id, week_number, topic_title')
      .eq('subject_code', selectedSubject)
      .eq('grade', selectedGrade)
      .limit(5);
    console.log('Weekly plans:', plans?.length || 0, plansErr ? plansErr : '', plans?.slice(0, 2));
    
    // 3. Check content specs
    const planIds = plans?.map(p => p.id) || [];
    if (planIds.length > 0) {
      const { data: specs, error: specsErr } = await supabase
        .from('curriculum_content_specs')
        .select('id, title, content_type, status')
        .in('weekly_plan_id', planIds)
        .limit(5);
      console.log('Content specs:', specs?.length || 0, specsErr ? specsErr : '', specs?.slice(0, 2));
      
      // 4. Check drafts
      if (specs && specs.length > 0) {
        const specIds = specs.map(s => s.id);
        const { data: drafts, error: draftsErr } = await supabase
          .from('curriculum_content_drafts')
          .select('id, spec_id, status, content_json')
          .in('spec_id', specIds)
          .limit(5);
        console.log('Content drafts:', drafts?.length || 0, draftsErr ? draftsErr : '', drafts?.slice(0, 2));
      }
    }
    
    // 5. Check media
    const { data: media, error: mediaErr } = await supabase
      .from('curriculum_media_library')
      .select('id, file_name, ai_description')
      .contains('subject_tags', [selectedSubject])
      .limit(5);
    console.log('Media library:', media?.length || 0, mediaErr ? mediaErr : '', media?.slice(0, 2));
    
    // 6. Check published content
    const { data: boards, error: boardsErr } = await supabase
      .from('teacher_boards')
      .select('id, title, subject, grade')
      .eq('copied_from', 'curriculum-factory')
      .limit(5);
    console.log('Published boards:', boards?.length || 0, boardsErr ? boardsErr : '', boards?.slice(0, 2));
    
    const { data: worksheets, error: worksheetsErr } = await supabase
      .from('teacher_worksheets')
      .select('id, name')
      .eq('copied_from', 'curriculum-factory')
      .limit(5);
    console.log('Published worksheets:', worksheets?.length || 0, worksheetsErr ? worksheetsErr : '', worksheets?.slice(0, 2));
    
    const { data: docs, error: docsErr } = await supabase
      .from('teacher_documents')
      .select('id, title')
      .eq('copied_from', 'curriculum-factory')
      .limit(5);
    console.log('Published documents:', docs?.length || 0, docsErr ? docsErr : '', docs?.slice(0, 2));
    
    console.log('=== END DEBUG ===');
    toast.info('Debug info v konzoli');
  };
  
  // RESET: Smazat týdenní plány, publikované materiály a media library
  const resetCurriculumData = async () => {
    if (!selectedSubject || !selectedGrade) {
      toast.error('Vyber předmět a ročník');
      return;
    }
    
    const confirmed = window.confirm(
      `Opravdu chceš smazat VŠECHNA data pro ${SUBJECT_NAMES[selectedSubject]} ${selectedGrade}. třídu?\n\n- Týdenní plány\n- Specifikace\n- Drafty\n- Publikované boardy, worksheety, dokumenty\n- Obrázky z media library\n\nToto nelze vrátit zpět!`
    );
    
    if (!confirmed) return;
    
    toast.loading('Mažu všechna data...');
    
    try {
      // 1. Smazat publikované materiály z teacher_* tabulek
      console.log('[Reset] Deleting published materials...');
      
      const { error: boardsErr } = await supabase
        .from('teacher_boards')
        .delete()
        .ilike('copied_from', 'curriculum-factory%');
      if (boardsErr) console.error('[Reset] Boards delete error:', boardsErr);
      else console.log('[Reset] Deleted boards');
      
      const { error: worksheetsErr } = await supabase
        .from('teacher_worksheets')
        .delete()
        .ilike('copied_from', 'curriculum-factory%');
      if (worksheetsErr) console.error('[Reset] Worksheets delete error:', worksheetsErr);
      else console.log('[Reset] Deleted worksheets');
      
      const { error: docsErr } = await supabase
        .from('teacher_documents')
        .delete()
        .ilike('copied_from', 'curriculum-factory%');
      if (docsErr) console.error('[Reset] Documents delete error:', docsErr);
      else console.log('[Reset] Deleted documents');
      
      // 2. Smazat media library pro tento předmět
      console.log('[Reset] Deleting media library...');
      const { error: mediaErr } = await supabase
        .from('curriculum_media_library')
        .delete()
        .contains('subject_tags', [selectedSubject]);
      if (mediaErr) console.error('[Reset] Media delete error:', mediaErr);
      else console.log('[Reset] Deleted media library');
      
      // 3. Smazat VŠECHNY weekly plans pro tento předmět/ročník (bez hledání)
      console.log('[Reset] Deleting all weekly plans...');
      
      // Nejprve smazat specs a drafty které závisí na weekly plans
      const { data: plans } = await supabase
        .from('curriculum_weekly_plans')
        .select('id')
        .eq('subject_code', selectedSubject)
        .eq('grade', selectedGrade);
      
      const planIds = plans?.map(p => p.id) || [];
      console.log('[Reset] Found', planIds.length, 'weekly plans');
      
      // Smazat specs a drafty v batches
      if (planIds.length > 0) {
        // 4. Najít všechny specs navázané na tyto plány
        const { data: specs } = await supabase
          .from('curriculum_content_specs')
          .select('id')
          .in('weekly_plan_id', planIds);
        
        const specIds = specs?.map(s => s.id) || [];
        console.log('[Reset] Found', specIds.length, 'specs to delete');
        
        if (specIds.length > 0) {
          // 5. Smazat drafty
          const { error: draftsErr } = await supabase
            .from('curriculum_content_drafts')
            .delete()
            .in('spec_id', specIds);
          
          if (draftsErr) console.error('[Reset] Drafts delete error:', draftsErr);
          
          // 6. Smazat specs
          const { error: specsErr } = await supabase
            .from('curriculum_content_specs')
            .delete()
            .in('weekly_plan_id', planIds);
          
          if (specsErr) console.error('[Reset] Specs delete error:', specsErr);
        }
        
        // 7. Smazat weekly plans
        const { error: plansErr } = await supabase
          .from('curriculum_weekly_plans')
          .delete()
          .eq('subject_code', selectedSubject)
          .eq('grade', selectedGrade);
        
        if (plansErr) console.error('[Reset] Plans delete error:', plansErr);
      }
      
      // 8. Vyčistit localStorage - smazat všechny vivid-doc a worksheet klíče
      console.log('[Reset] Cleaning localStorage...');
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('vivid-doc-') || key.startsWith('vividbooks_worksheet_') || key.startsWith('vividbooks_quiz_'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      console.log('[Reset] Removed', keysToRemove.length, 'localStorage items');
      
      // 9. Aktualizovat statistiky
      await loadStatistics();
      
      toast.dismiss();
      toast.success(`Všechna data pro ${SUBJECT_NAMES[selectedSubject]} ${selectedGrade}. třídu smazána!`);
      
    } catch (err) {
      console.error('[Reset] Error:', err);
      toast.dismiss();
      toast.error('Chyba při mazání dat');
    }
  };
  
  // Vytvořit strukturu menu pro Dějepis v Knihovně
  const createDejepisLibraryStructure = async () => {
    const projectId = 'njbtqmsxbyvpwigfceke';
    
    const dejepisMenu = [
      {
        id: 'dejepis-6-rocnik',
        label: '6. ročník',
        icon: 'graduation-cap',
        color: '#d97706',
        children: [
          {
            id: 'dejepis-6-starovek',
            label: 'Starověk',
            icon: 'pyramid',
            children: [
              { id: 'dejepis-6-uvod', label: 'Úvod do studia dějepisu', slug: 'dejepis-6-uvod', type: 'folder' },
              { id: 'dejepis-6-egypt', label: 'Starověký Egypt', slug: 'dejepis-6-egypt', type: 'folder' },
              { id: 'dejepis-6-mezopotamie', label: 'Mezopotámie', slug: 'dejepis-6-mezopotamie', type: 'folder' },
              { id: 'dejepis-6-recko', label: 'Starověké Řecko', slug: 'dejepis-6-recko', type: 'folder' },
              { id: 'dejepis-6-rim', label: 'Starověký Řím', slug: 'dejepis-6-rim', type: 'folder' }
            ]
          }
        ]
      },
      {
        id: 'dejepis-7-rocnik',
        label: '7. ročník',
        icon: 'graduation-cap',
        color: '#d97706',
        children: [
          {
            id: 'dejepis-7-stredovek',
            label: 'Středověk',
            icon: 'castle',
            children: [
              { id: 'dejepis-7-francie', label: 'Francká říše', slug: 'dejepis-7-francie', type: 'folder' },
              { id: 'dejepis-7-cechy', label: 'České země ve středověku', slug: 'dejepis-7-cechy', type: 'folder' },
              { id: 'dejepis-7-husitske', label: 'Husitské hnutí', slug: 'dejepis-7-husitske', type: 'folder' }
            ]
          }
        ]
      },
      {
        id: 'dejepis-8-rocnik',
        label: '8. ročník',
        icon: 'graduation-cap',
        color: '#d97706',
        children: [
          {
            id: 'dejepis-8-novovek',
            label: 'Novověk',
            icon: 'globe',
            children: [
              { id: 'dejepis-8-objevy', label: 'Zámořské objevy', slug: 'dejepis-8-objevy', type: 'folder' },
              { id: 'dejepis-8-reformace', label: 'Reformace', slug: 'dejepis-8-reformace', type: 'folder' },
              { id: 'dejepis-8-revoluce', label: 'Velká francouzská revoluce', slug: 'dejepis-8-revoluce', type: 'folder' }
            ]
          }
        ]
      },
      {
        id: 'dejepis-9-rocnik',
        label: '9. ročník',
        icon: 'graduation-cap',
        color: '#d97706',
        children: [
          {
            id: 'dejepis-9-moderni',
            label: 'Moderní dějiny',
            icon: 'clock',
            children: [
              { id: 'dejepis-9-ww1', label: 'První světová válka', slug: 'dejepis-9-ww1', type: 'folder' },
              { id: 'dejepis-9-csr', label: 'Vznik Československa', slug: 'dejepis-9-csr', type: 'folder' },
              { id: 'dejepis-9-ww2', label: 'Druhá světová válka', slug: 'dejepis-9-ww2', type: 'folder' },
              { id: 'dejepis-9-sametova', label: 'Sametová revoluce', slug: 'dejepis-9-sametova', type: 'folder' }
            ]
          }
        ]
      }
    ];
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/menu`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({
            category: 'dejepis',
            menu: dejepisMenu
          })
        }
      );
      
      if (response.ok) {
        toast.success('Struktura Dějepisu vytvořena!', {
          description: 'Jděte do Admin → Dějepis pro zobrazení'
        });
      } else {
        const error = await response.json();
        toast.error('Nepodařilo se vytvořit strukturu', { description: error.error });
      }
    } catch (err) {
      console.error('Error creating Dejepis structure:', err);
      toast.error('Chyba při vytváření struktury');
    }
  };
  
  // =====================================================
  // AGENT RUNNERS (Placeholder - to be implemented)
  // =====================================================
  
  // Progress messages state
  const [progressMessages, setProgressMessages] = useState<string[]>([]);
  
  const addProgressMessage = (message: string) => {
    setProgressMessages(prev => [...prev.slice(-50), message]); // Keep last 50 messages
  };
  
  const executeAgent1 = async (run: PipelineRun) => {
    if (!selectedSubject) return;
    
    console.log('[Pipeline] Starting Agent 1...');
    setCurrentRun(prev => prev ? { ...prev, agent1Status: 'running', agent1StartedAt: new Date().toISOString() } : null);
    
    try {
      const result = await runAgent1(selectedSubject, selectedGrade || undefined, addProgressMessage);
      console.log('[Pipeline] Agent 1 completed:', result);
      
      setCurrentRun(prev => prev ? { 
        ...prev, 
        agent1Status: 'completed', 
        agent1CompletedAt: new Date().toISOString(),
        agent1Output: result
      } : null);
      
      // Reload RVP data
      await loadRvpData();
    } catch (err) {
      console.error('[Pipeline] Agent 1 failed:', err);
      setCurrentRun(prev => prev ? { ...prev, agent1Status: 'failed' } : null);
      throw err;
    }
  };
  
  const executeAgent2 = async (run: PipelineRun) => {
    if (!selectedSubject || !selectedGrade) {
      console.log('[Pipeline] Agent 2 skipped - no subject/grade');
      return;
    }
    
    console.log('[Pipeline] Starting Agent 2...', { rvpData: rvpData.length });
    setCurrentRun(prev => prev ? { ...prev, agent2Status: 'running', agent2StartedAt: new Date().toISOString() } : null);
    
    try {
      // V demo módu - pouze "Starověké Řecko", jinak všechna témata
      let rvpToProcess = rvpData;
      if (demoMode) {
        // Preferujeme "Starověké Řecko" pro demo
        const demoTopic = rvpData.find(r => r.topic.toLowerCase().includes('řecko') || r.topic.toLowerCase().includes('recko'));
        rvpToProcess = demoTopic ? [demoTopic] : rvpData.slice(0, 1);
        console.log('[Pipeline] Demo topic:', rvpToProcess[0]?.topic);
        addProgressMessage(`🎯 DEMO: Pouze téma "${rvpToProcess[0]?.topic}"`);
      }
      console.log('[Pipeline] Agent 2 processing', rvpToProcess.length, 'RVP topics');
      addProgressMessage(demoMode ? `🎯 DEMO: ${rvpToProcess[0]?.topic || 'první téma'}` : `📚 Zpracovávám ${rvpData.length} témat`);
      
      const result = await runAgent2(selectedSubject, selectedGrade, rvpToProcess, addProgressMessage);
      console.log('[Pipeline] Agent 2 completed:', result);
      
      setCurrentRun(prev => prev ? { 
        ...prev, 
        agent2Status: 'completed', 
        agent2CompletedAt: new Date().toISOString(),
        agent2Output: result
      } : null);
      
      // Reload weekly plans
      await loadWeeklyPlans();
    } catch (err) {
      console.error('[Pipeline] Agent 2 failed:', err);
      setCurrentRun(prev => prev ? { ...prev, agent2Status: 'failed' } : null);
      throw err;
    }
  };
  
  const executeAgent3 = async (run: PipelineRun) => {
    if (!selectedSubject || !selectedGrade) {
      console.log('[Pipeline] Agent 3 skipped - no subject/grade');
      return;
    }
    
    console.log('[Pipeline] Starting Agent 3...', { weeklyPlans: weeklyPlans.length });
    setCurrentRun(prev => prev ? { ...prev, agent3Status: 'running', agent3StartedAt: new Date().toISOString() } : null);
    
    try {
      // V demo módu pouze první týden, jinak všechny plány
      const plansToProcess = demoMode ? weeklyPlans.slice(0, 1) : weeklyPlans;
      console.log('[Pipeline] Agent 3 processing', plansToProcess.length, 'weekly plans, demoMode:', demoMode);
      addProgressMessage(demoMode 
        ? `🎯 DEMO: Vytvářím 5 specifických materiálů` 
        : `📅 Zpracovávám ${weeklyPlans.length} plánů`
      );
      
      const result = await runAgent3(selectedSubject, selectedGrade, plansToProcess, addProgressMessage, demoMode);
      console.log('[Pipeline] Agent 3 completed:', result);
      
      setCurrentRun(prev => prev ? { 
        ...prev, 
        agent3Status: 'completed', 
        agent3CompletedAt: new Date().toISOString(),
        agent3Output: result
      } : null);
    } catch (err) {
      console.error('[Pipeline] Agent 3 failed:', err);
      setCurrentRun(prev => prev ? { ...prev, agent3Status: 'failed' } : null);
      throw err;
    }
  };
  
  const executeAgent4 = async (run: PipelineRun) => {
    console.log('[Pipeline] Starting Agent 4...');
    setCurrentRun(prev => prev ? { ...prev, agent4Status: 'running', agent4StartedAt: new Date().toISOString() } : null);
    
    try {
      // Load content specs - v demo módu 5, jinak až 100
      const specsLimit = demoMode ? 5 : 100;
      
      // Filtrovat podle subject_code a grade aby se nemíchaly s jinými
      let query = supabase
        .from('curriculum_content_specs')
        .select('*')
        .eq('status', 'pending')
        .order('priority')
        .limit(specsLimit);
      
      if (selectedSubject) {
        query = query.eq('subject_code', selectedSubject);
      }
      if (selectedGrade) {
        query = query.eq('grade', selectedGrade);
      }
      
      const { data: specs, error: specsError } = await query;
      
      console.log('[Pipeline] Agent 4 found specs:', specs?.length || 0, specsError ? specsError : '');
      addProgressMessage(demoMode ? `🎯 DEMO: Generuji ${specs?.length || 0} materiálů` : `📝 Generuji ${specs?.length || 0} materiálů`);
      
      if (!specs || specs.length === 0) {
        addProgressMessage('ℹ️ Žádné specifikace k zpracování');
        setCurrentRun(prev => prev ? { ...prev, agent4Status: 'completed', agent4CompletedAt: new Date().toISOString() } : null);
        return;
      }
      
      const mappedSpecs = specs.map((s: any) => ({
        id: s.id,
        weeklyPlanId: s.weekly_plan_id,
        contentType: s.content_type,
        contentSubtype: s.content_subtype,
        title: s.title,
        description: s.description,
        difficulty: s.difficulty,
        targetDurationMinutes: s.target_duration_minutes,
        questionTypes: s.question_types,
        questionCount: s.question_count,
        specificRequirements: s.specific_requirements,
        learningObjectives: s.learning_objectives,
        bloomLevel: s.bloom_level,
        priority: s.priority,
        status: s.status,
        createdAt: s.created_at,
        updatedAt: s.updated_at
      }));
      
      const result = await runAgent4(mappedSpecs, addProgressMessage);
      
      setCurrentRun(prev => prev ? { 
        ...prev, 
        agent4Status: 'completed', 
        agent4CompletedAt: new Date().toISOString(),
        agent4Output: result
      } : null);
    } catch (err) {
      console.error('[Pipeline] Agent 4 failed:', err);
      setCurrentRun(prev => prev ? { ...prev, agent4Status: 'failed' } : null);
      throw err;
    }
  };
  
  const executeAgent5 = async (run: PipelineRun) => {
    if (!selectedSubject || !selectedGrade) {
      console.log('[Pipeline] Agent 5 skipped - no subject/grade');
      return;
    }
    
    console.log('[Pipeline] Starting Agent 5...');
    setCurrentRun(prev => prev ? { ...prev, agent5Status: 'running', agent5StartedAt: new Date().toISOString() } : null);
    
    try {
      // V demo módu použít demoTopic, jinak všechna RVP témata
      const topicsToProcess = demoMode ? [demoTopic] : rvpData.map(r => r.topic);
      console.log('[Pipeline] Agent 5 processing topics:', topicsToProcess);
      addProgressMessage(demoMode ? `🎯 DEMO: Hledám média pro "${demoTopic}"` : `🖼️ Hledám média pro ${rvpData.length} témat`);
      
      const result = await runAgent5(selectedSubject, selectedGrade, topicsToProcess, addProgressMessage);
      console.log('[Pipeline] Agent 5 completed:', result);
      
      setCurrentRun(prev => prev ? { 
        ...prev, 
        agent5Status: 'completed', 
        agent5CompletedAt: new Date().toISOString(),
        agent5Output: result
      } : null);
    } catch (err) {
      console.error('[Pipeline] Agent 5 failed:', err);
      setCurrentRun(prev => prev ? { ...prev, agent5Status: 'failed' } : null);
      throw err;
    }
  };
  
  const executeAgent6 = async (run: PipelineRun) => {
    console.log('[Pipeline] Starting Agent 6...', { selectedSubject, selectedGrade, demoMode });
    setCurrentRun(prev => prev ? { ...prev, agent6Status: 'running', agent6StartedAt: new Date().toISOString() } : null);
    addProgressMessage('📦 Načítám vygenerované materiály...');
    
    try {
      // V DEMO MÓDU: Načítat specs přímo podle subject_code a grade (bez weekly_plan_id)
      // V PLNÉM MÓDU: Načítat přes weekly_plans
      
      let allSpecs: any[] = [];
      
      if (demoMode) {
        // DEMO: Přímé načtení specs podle subject_code a grade
        const { data: specs, error: specsError } = await supabase
          .from('curriculum_content_specs')
          .select('id, weekly_plan_id, title, content_type, content_subtype, difficulty, target_duration_minutes, subject_code, grade')
          .eq('subject_code', selectedSubject)
          .eq('grade', selectedGrade);
        
        if (specsError) {
          console.error('[Agent6] Error loading specs:', specsError);
        }
        
        allSpecs = specs || [];
        console.log('[Agent6] DEMO - Specs loaded directly:', allSpecs.length);
      } else {
        // PLNÝ MÓD: Načíst přes weekly_plans
        let plansQuery = supabase
          .from('curriculum_weekly_plans')
          .select('id')
          .eq('subject_code', selectedSubject);
        
        if (selectedGrade) {
          plansQuery = plansQuery.eq('grade', selectedGrade);
        }
        
        const { data: plans, error: plansError } = await plansQuery;
        
        console.log('[Agent6] Plans loaded:', plans?.length || 0, plansError ? plansError : '');
        
        if (plansError) {
          console.error('[Agent6] Error loading plans:', plansError);
        }
        
        const planIds = plans?.map(p => p.id) || [];
        
        if (planIds.length === 0) {
          addProgressMessage('⚠️ Žádné týdenní plány pro tento předmět/ročník');
          setCurrentRun(prev => prev ? { 
            ...prev, 
            agent6Status: 'completed', 
            agent6CompletedAt: new Date().toISOString(),
            agent6Output: { boardIds: [], worksheetIds: [], textIds: [], contentPublished: 0 }
          } : null);
          return;
        }
        
        // Load specs for these plans (batch by 30)
        for (let i = 0; i < planIds.length; i += 30) {
          const batchPlanIds = planIds.slice(i, i + 30);
          const { data: batchSpecs } = await supabase
            .from('curriculum_content_specs')
            .select('id, weekly_plan_id, title, content_type, content_subtype, difficulty, target_duration_minutes')
            .in('weekly_plan_id', batchPlanIds);
          
          if (batchSpecs) {
            allSpecs.push(...batchSpecs);
          }
        }
      }
      
      console.log('[Agent6] Total specs:', allSpecs.length);
      const specMap = new Map(allSpecs.map(s => [s.id, { ...s, subject_code: selectedSubject, grade: selectedGrade }]));
      const specIds = allSpecs.map(s => s.id);
      
      if (specIds.length === 0) {
        console.log('[Agent6] No specs found - skipping');
        addProgressMessage('⚠️ Žádné specifikace pro tento předmět/ročník');
        setCurrentRun(prev => prev ? { 
          ...prev, 
          agent6Status: 'completed', 
          agent6CompletedAt: new Date().toISOString(),
          agent6Output: { boardIds: [], worksheetIds: [], textIds: [], contentPublished: 0 }
        } : null);
        return;
      }
      
      addProgressMessage(`📊 Nalezeno ${specIds.length} specifikací`);
      
      // 3. Load drafts that match these specs (batch by 50)
      const allFilteredDrafts: any[] = [];
      
      for (let i = 0; i < specIds.length; i += 50) {
        const batchIds = specIds.slice(i, i + 50);
        const { data: batchDrafts } = await supabase
          .from('curriculum_content_drafts')
          .select('*')
          .eq('status', 'draft')
          .in('spec_id', batchIds);
        
        if (batchDrafts) {
          allFilteredDrafts.push(...batchDrafts.map(d => ({
            ...d,
            spec: specMap.get(d.spec_id)
          })));
        }
      }
      
      console.log('[Agent6] Drafts loaded:', allFilteredDrafts.length, 'with specs:', allFilteredDrafts.map(d => d.spec_id).slice(0, 5));
      addProgressMessage(`📋 Nalezeno ${allFilteredDrafts.length} draftů k publikaci`);
      
      if (allFilteredDrafts.length === 0) {
        console.log('[Agent6] No drafts to publish!');
        setCurrentRun(prev => prev ? { 
          ...prev, 
          agent6Status: 'completed', 
          agent6CompletedAt: new Date().toISOString(),
          agent6Output: { boardIds: [], worksheetIds: [], textIds: [], contentPublished: 0 }
        } : null);
        return;
      }
      
      const result = await runAgent6(
        allFilteredDrafts, 
        selectedSubject!, 
        selectedGrade!, 
        undefined, // folderId - bude vytvořena automaticky
        addProgressMessage
      );
      
      setCurrentRun(prev => prev ? { 
        ...prev, 
        agent6Status: 'completed', 
        agent6CompletedAt: new Date().toISOString(),
        agent6Output: result
      } : null);
    } catch (err) {
      console.error('[Pipeline] Agent 6 failed:', err);
      setCurrentRun(prev => prev ? { ...prev, agent6Status: 'failed' } : null);
      throw err;
    }
  };
  
  const executeAgent7 = async (run: PipelineRun) => {
    console.log('[Pipeline] Starting Agent 7 (QA Supervisor)...');
    addProgressMessage('🔍 Agent 7: Kontroluji kvalitu výsledků...');
    
    try {
      const result = await runAgent7(selectedSubject!, selectedGrade!, addProgressMessage);
      
      console.log('[Pipeline] Agent 7 completed:', result);
      
      if (result.passed) {
        addProgressMessage(`✅ QA prošlo: ${result.totalChecked} položek zkontrolováno`);
        toast.success('Kontrola kvality prošla!');
      } else {
        const errors = result.issues.filter(i => i.severity === 'error');
        addProgressMessage(`⚠️ QA nalezlo ${errors.length} problémů`);
        toast.warning(`Kontrola kvality: ${errors.length} problémů`, {
          description: errors.map(e => e.message).join(', ')
        });
      }
      
    } catch (err) {
      console.error('[Agent7] Error:', err);
      addProgressMessage(`❌ Agent 7 selhal: ${err}`);
    }
  };
  
  // =====================================================
  // DATASET FLOW EXECUTORS
  // =====================================================
  
  /**
   * Demo mód s DataSet flow - vytvoří DataSet pro demoTopic a vygeneruje materiály
   */
  const executeDemoDataSet = async (run: PipelineRun) => {
    if (!selectedSubject || !selectedGrade) return;
    
    addProgressMessage(`📦 Vytvářím DataSet pro "${demoTopic}"...`);
    setCurrentRun(prev => prev ? { ...prev, agent3Status: 'running', agent3StartedAt: new Date().toISOString() } : null);
    
    try {
      // Importovat collector přímo
      const { collectTopicData } = await import('../../utils/dataset/data-collector');
      const { generateFromDataSet } = await import('../../utils/dataset/material-generators');
      
      // 1. Vytvořit DataSet
      const dataSet = await collectTopicData(
        demoTopic,
        selectedSubject,
        selectedGrade,
        addProgressMessage
      );
      
      // 2. Uložit do databáze
      const { data: user } = await supabase.auth.getUser();
      const { data: savedDs, error: saveError } = await supabase
        .from('topic_data_sets')
        .insert({
          id: dataSet.id,
          topic: dataSet.topic,
          subject_code: dataSet.subjectCode,
          grade: dataSet.grade,
          status: 'ready',
          rvp: dataSet.rvp,
          target_group: dataSet.targetGroup,
          content: dataSet.content,
          media: dataSet.media,
          generated_materials: [],
          created_by: user.user?.id,
        })
        .select()
        .single();
      
      if (saveError) {
        console.error('[DemoDataSet] Save error:', saveError);
        throw saveError;
      }
      
      addProgressMessage(`✅ DataSet "${demoTopic}" vytvořen`);
      setCurrentRun(prev => prev ? { 
        ...prev, 
        agent3Status: 'completed', 
        agent3CompletedAt: new Date().toISOString() 
      } : null);
      
      // 3. Generovat materiály
      setCurrentRun(prev => prev ? { ...prev, agent4Status: 'running', agent4StartedAt: new Date().toISOString() } : null);
      addProgressMessage('✏️ Generuji materiály z DataSetu...');
      
      const materialTypes = ['text', 'board-easy', 'board-hard', 'worksheet', 'test', 'lessons', 'methodology'];
      let generated = 0;
      
      for (const type of materialTypes) {
        addProgressMessage(`  📝 Generuji ${type}...`);
        try {
          const result = await generateFromDataSet(dataSet, type);
          if (result.success) {
            generated++;
            addProgressMessage(`  ✅ ${type} vygenerován`);
          } else {
            addProgressMessage(`  ⚠️ ${type}: ${result.error}`);
          }
        } catch (err) {
          addProgressMessage(`  ❌ ${type} selhal: ${err}`);
        }
      }
      
      addProgressMessage(`✅ Vygenerováno ${generated}/${materialTypes.length} materiálů`);
      setCurrentRun(prev => prev ? { 
        ...prev, 
        agent4Status: 'completed', 
        agent4CompletedAt: new Date().toISOString(),
        agent5Status: 'completed',
        agent6Status: 'completed'
      } : null);
      
    } catch (err) {
      console.error('[DemoDataSet] Error:', err);
      addProgressMessage(`❌ Chyba: ${err}`);
      setCurrentRun(prev => prev ? { ...prev, agent3Status: 'failed' } : null);
      throw err;
    }
  };
  
  /**
   * Plný DataSet pipeline - vytvoří DataSety z weekly plans a vygeneruje materiály
   */
  const executeDataSetPipeline = async (run: PipelineRun) => {
    if (!selectedSubject || !selectedGrade) return;
    
    addProgressMessage('📦 Spouštím DataSet pipeline...');
    setCurrentRun(prev => prev ? { ...prev, agent3Status: 'running', agent3StartedAt: new Date().toISOString() } : null);
    
    try {
      // Načíst čerstvé plány z databáze (Agent 2 je právě vytvořil)
      addProgressMessage('📂 Načítám čerstvé týdenní plány...');
      const { data: freshPlans, error: plansError } = await supabase
        .from('curriculum_weekly_plans')
        .select('*')
        .eq('subject_code', selectedSubject)
        .eq('grade', selectedGrade)
        .order('week_number');
      
      if (plansError) {
        throw new Error(`Chyba načítání plánů: ${plansError.message}`);
      }
      
      // Mapovat na WeeklyPlan typ
      const mappedPlans: WeeklyPlan[] = (freshPlans || []).map(w => ({
        id: w.id,
        subjectCode: w.subject_code as SubjectCode,
        grade: w.grade as Grade,
        schoolYear: w.school_year,
        weekNumber: w.week_number,
        monthName: w.month_name,
        topicTitle: w.topic_title,
        topicDescription: w.topic_description,
        rvpDataId: w.rvp_data_id,
        learningGoals: w.learning_goals || [],
        vocabulary: w.vocabulary || [],
        activitiesPlanned: w.activities_planned || [],
        hoursAllocated: w.hours_allocated,
        status: w.status,
        createdAt: w.created_at,
        updatedAt: w.updated_at
      }));
      
      addProgressMessage(`📊 Načteno ${mappedPlans.length} týdenních plánů`);
      
      // Načíst čerstvá RVP data
      const { data: freshRvp } = await supabase
        .from('curriculum_rvp_data')
        .select('*')
        .eq('subject_code', selectedSubject)
        .eq('grade', selectedGrade);
      
      const mappedRvp: RvpData[] = (freshRvp || []).map(r => ({
        id: r.id,
        subjectCode: r.subject_code as SubjectCode,
        grade: r.grade as Grade,
        thematicArea: r.thematic_area,
        topic: r.topic,
        expectedOutcomes: r.expected_outcomes || [],
        keyCompetencies: r.key_competencies || [],
        crossCurricularTopics: r.cross_curricular_topics || [],
        recommendedHours: r.recommended_hours,
        difficultyLevel: r.difficulty_level,
        prerequisites: r.prerequisites || [],
        sourceDocument: r.source_document,
        rvpRevision: r.rvp_revision,
        orderIndex: r.order_index,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }));
      
      const result = await runDataSetPipeline(
        selectedSubject,
        selectedGrade,
        mappedPlans,
        mappedRvp,
        ['text', 'board-easy', 'board-hard', 'worksheet', 'test', 'lesson', 'methodology'],
        addProgressMessage,
        demoMode
      );
      
      addProgressMessage(`✅ DataSet pipeline dokončena:`);
      addProgressMessage(`  📦 ${result.dataSetsCreated} DataSetů`);
      addProgressMessage(`  📝 ${result.materialsGenerated} materiálů`);
      addProgressMessage(`  📤 ${result.published} publikováno`);
      
      if (result.errors.length > 0) {
        addProgressMessage(`  ⚠️ ${result.errors.length} chyb`);
      }
      
      setCurrentRun(prev => prev ? { 
        ...prev, 
        agent3Status: 'completed',
        agent4Status: 'completed',
        agent5Status: 'completed',
        agent6Status: 'completed',
        agent3CompletedAt: new Date().toISOString(),
        agent4CompletedAt: new Date().toISOString(),
        agent5CompletedAt: new Date().toISOString(),
        agent6CompletedAt: new Date().toISOString()
      } : null);
      
    } catch (err) {
      console.error('[DataSetPipeline] Error:', err);
      addProgressMessage(`❌ DataSet pipeline selhala: ${err}`);
      setCurrentRun(prev => prev ? { ...prev, agent3Status: 'failed' } : null);
      throw err;
    }
  };
  
  // =====================================================
  // HELPERS
  // =====================================================
  
  const getAgentStatusIcon = (status: AgentStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'running':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'skipped':
        return <Clock className="w-5 h-5 text-gray-400" />;
      default:
        return <Clock className="w-5 h-5 text-gray-300" />;
    }
  };
  
  const getAgentProgress = (agentId: number): number => {
    if (!currentRun) return 0;
    const statusKey = `agent${agentId}Status` as keyof PipelineRun;
    const status = currentRun[statusKey] as AgentStatus;
    return status === 'completed' ? 100 : status === 'running' ? 50 : 0;
  };
  
  const toggleWeekExpanded = (weekNumber: number) => {
    setExpandedWeeks(prev => {
      const next = new Set(prev);
      if (next.has(weekNumber)) {
        next.delete(weekNumber);
      } else {
        next.add(weekNumber);
      }
      return next;
    });
  };
  
  // =====================================================
  // RENDER
  // =====================================================
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/admin')}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-slate-900">Curriculum Factory</h1>
                  <p className="text-xs text-slate-500">Automatická tvorba vzdělávacích materiálů</p>
                </div>
              </div>
            </div>
            
            {/* Subject & Grade Selector */}
            <div className="flex items-center gap-3">
              <select
                value={selectedSubject || ''}
                onChange={(e) => setSelectedSubject(e.target.value as SubjectCode)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Vyberte předmět</option>
                {subjects.map(s => (
                  <option key={s.code} value={s.code}>{s.name}</option>
                ))}
              </select>
              
              <select
                value={selectedGrade || ''}
                onChange={(e) => setSelectedGrade(e.target.value ? Number(e.target.value) as Grade : null)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Všechny ročníky</option>
                {[6, 7, 8, 9].map(g => (
                  <option key={g} value={g}>{g}. třída</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-12 gap-8">
          {/* Left Column - Pipeline Status */}
          <div className="col-span-4">
            {/* Pipeline Control Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-slate-900">Pipeline</h2>
                <div className="flex items-center gap-3">
                  {/* Setup Library Structure */}
                  <button
                    onClick={createDejepisLibraryStructure}
                    className="px-3 py-1.5 text-xs bg-amber-100 text-amber-700 rounded hover:bg-amber-200"
                  >
                    📚 Vytvořit strukturu
                  </button>
                  
                  {/* Reset Data Button */}
                  <button
                    onClick={resetCurriculumData}
                    className="px-3 py-1.5 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100"
                    title="Smazat týdenní plány a data pro nové generování"
                  >
                    🗑️ Reset dat
                  </button>
                  
                  {/* Debug Button */}
                  <button
                    onClick={debugDatabase}
                    className="px-3 py-1.5 text-xs bg-slate-100 text-slate-600 rounded hover:bg-slate-200"
                  >
                    🔍 Debug
                  </button>
                  
                  {/* DataSet Flow Toggle */}
                  <label className="flex items-center gap-2 cursor-pointer" title="Nový DataSet-based flow (doporučeno)">
                    <input
                      type="checkbox"
                      checked={useDataSetFlow}
                      onChange={(e) => setUseDataSetFlow(e.target.checked)}
                      className="w-4 h-4 text-amber-500 rounded border-slate-300 focus:ring-amber-500"
                    />
                    <span className="text-sm text-slate-600">📦 DataSet</span>
                  </label>
                  
                  {/* Test Mode Toggle */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={demoMode}
                      onChange={(e) => setDemoMode(e.target.checked)}
                      className="w-4 h-4 text-green-500 rounded border-slate-300 focus:ring-green-500"
                    />
                    <span className="text-sm text-slate-600">🎯 Demo</span>
                  </label>
                  
                  {demoMode && (
                    <input
                      type="text"
                      value={demoTopic}
                      onChange={(e) => setDemoTopic(e.target.value)}
                      placeholder="Téma (např. Starověké Řecko)"
                      className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg w-48 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  )}
                  
                  {!isRunning ? (
                    <button
                      onClick={startPipeline}
                      disabled={!selectedSubject}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Play className="w-4 h-4" />
                      <span>{demoMode ? 'Demo' : 'Spustit'}</span>
                    </button>
                  ) : (
                    <>
                      {!isPaused ? (
                        <button
                          onClick={pausePipeline}
                          className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
                        >
                          <Pause className="w-4 h-4" />
                          <span>Pozastavit</span>
                        </button>
                      ) : (
                        <button
                          onClick={resumePipeline}
                          className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                        >
                          <Play className="w-4 h-4" />
                          <span>Pokračovat</span>
                        </button>
                      )}
                    </>
                  )}
                  {currentRun && (
                    <button
                      onClick={resetPipeline}
                      className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Reset"
                    >
                      <RotateCcw className="w-4 h-4 text-slate-600" />
                    </button>
                  )}
                </div>
              </div>
              
              {/* Agent List */}
              <div className="space-y-3">
                {AGENTS.map((agent) => {
                  const statusKey = `agent${agent.id}Status` as keyof PipelineRun;
                  const status = currentRun?.[statusKey] as AgentStatus || 'pending';
                  const progress = getAgentProgress(agent.id);
                  
                  return (
                    <div 
                      key={agent.id}
                      className={`p-4 rounded-xl border transition-all ${
                        status === 'running' 
                          ? 'border-blue-200 bg-blue-50' 
                          : status === 'completed'
                          ? 'border-green-200 bg-green-50'
                          : status === 'failed'
                          ? 'border-red-200 bg-red-50'
                          : 'border-slate-100 bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
                            style={{ backgroundColor: agent.color }}
                          >
                            {agent.icon}
                          </div>
                          <div>
                            <div className="font-medium text-slate-900 text-sm">
                              Agent {agent.id}: {agent.name}
                            </div>
                            <div className="text-xs text-slate-500">{agent.description}</div>
                          </div>
                        </div>
                        {getAgentStatusIcon(status)}
                      </div>
                      
                      {/* Progress bar */}
                      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full transition-all duration-500"
                          style={{ 
                            width: `${progress}%`,
                            backgroundColor: agent.color
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Progress Messages - zobrazit i po dokončení */}
              {progressMessages.length > 0 && (
                <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-medium text-slate-500">Průběh:</div>
                    {!isRunning && (
                      <button 
                        onClick={() => setProgressMessages([])}
                        className="text-xs text-slate-400 hover:text-slate-600"
                      >
                        ✕ Vymazat
                      </button>
                    )}
                  </div>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {progressMessages.map((msg, i) => (
                      <div key={i} className="text-xs text-slate-600 font-mono">
                        {msg}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Stats Card */}
            {currentRun && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900 mb-4">Statistiky</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{rvpData.length}</div>
                    <div className="text-xs text-blue-600">RVP témat</div>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">{weeklyPlans.length}</div>
                    <div className="text-xs text-purple-600">Týdenních plánů</div>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-lg">
                    <div className="text-2xl font-bold text-amber-600">{draftsCount}</div>
                    <div className="text-xs text-amber-600">Materiálů</div>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{publishedCount}</div>
                    <div className="text-xs text-green-600">Publikováno</div>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Right Column - Content Tabs */}
          <div className="col-span-8">
            {/* Tabs */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="border-b border-slate-200">
                <nav className="flex">
                  {[
                    { id: 'overview', label: 'Přehled', icon: <BarChart3 className="w-4 h-4" /> },
                    { id: 'rvp', label: 'RVP Data', icon: <Scroll className="w-4 h-4" /> },
                    { id: 'planner', label: 'Týdenní plány', icon: <Calendar className="w-4 h-4" /> },
                    { id: 'datasets', label: `DataSety (${dataSets.length})`, icon: <Package className="w-4 h-4" /> }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === tab.id
                          ? 'border-indigo-600 text-indigo-600'
                          : 'border-transparent text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  ))}
                </nav>
              </div>
              
              {/* Tab Content */}
              <div className="p-6">
                {activeTab === 'overview' && (
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">
                      {selectedSubject ? SUBJECT_NAMES[selectedSubject] : 'Vyberte předmět'}
                      {selectedGrade && ` - ${GRADE_NAMES[selectedGrade]}`}
                    </h3>
                    
                    {!selectedSubject ? (
                      <div className="text-center py-12">
                        <GraduationCap className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500">Vyberte předmět pro zobrazení obsahu</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <p className="text-slate-600">
                          Curriculum Factory automaticky vytvoří vzdělávací materiály podle RVP ZV.
                        </p>
                        
                        <div className="grid grid-cols-3 gap-4">
                          <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl">
                            <Target className="w-6 h-6 text-blue-600 mb-2" />
                            <div className="font-semibold text-blue-900">Očekávané výstupy</div>
                            <div className="text-sm text-blue-700 mt-1">
                              {rvpData.reduce((acc, r) => acc + r.expectedOutcomes.length, 0)} výstupů
                            </div>
                          </div>
                          
                          <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl">
                            <BookOpen className="w-6 h-6 text-purple-600 mb-2" />
                            <div className="font-semibold text-purple-900">Tematické celky</div>
                            <div className="text-sm text-purple-700 mt-1">
                              {new Set(rvpData.map(r => r.thematicArea)).size} oblastí
                            </div>
                          </div>
                          
                          <div className="p-4 bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl">
                            <Zap className="w-6 h-6 text-amber-600 mb-2" />
                            <div className="font-semibold text-amber-900">Hodinová dotace</div>
                            <div className="text-sm text-amber-700 mt-1">
                              {rvpData.reduce((acc, r) => acc + (r.recommendedHours || 0), 0)} hodin
                            </div>
                          </div>
                        </div>
                        
                        {/* RAW DATA SEKCE */}
                        <div className="border-t border-slate-200 pt-6">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-md font-semibold text-slate-800 flex items-center gap-2">
                              <Eye className="w-5 h-5" />
                              Surová data ({rawDrafts.length} draftů)
                            </h4>
                            <button
                              onClick={() => setShowRawData(!showRawData)}
                              className="text-sm text-indigo-600 hover:text-indigo-800"
                            >
                              {showRawData ? 'Skrýt' : 'Zobrazit'}
                            </button>
                          </div>
                          
                          {showRawData && rawDrafts.length > 0 && (
                            <div className="space-y-4 max-h-[600px] overflow-y-auto">
                              {rawDrafts.map((draft, idx) => {
                                const spec = draft.curriculum_content_specs;
                                const content = draft.content_json as any;
                                return (
                                  <div key={draft.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs font-medium rounded">
                                        {spec?.content_type || 'unknown'}
                                      </span>
                                      <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">
                                        {spec?.content_subtype || '-'}
                                      </span>
                                      <span className="text-xs text-slate-400">
                                        {draft.status}
                                      </span>
                                    </div>
                                    <h5 className="font-semibold text-slate-900 mb-2">
                                      {spec?.title || content?.title || 'Bez názvu'}
                                    </h5>
                                    
                                    {/* Content preview based on type */}
                                    {spec?.content_type === 'board' && content?.slides && (
                                      <div className="text-sm text-slate-600">
                                        <p className="font-medium">📊 {content.slides.length} slidů:</p>
                                        <ul className="ml-4 mt-1 space-y-1">
                                          {content.slides.slice(0, 5).map((slide: any, i: number) => (
                                            <li key={i} className="text-xs">
                                              <span className="font-mono bg-slate-200 px-1 rounded">{slide.type}</span>
                                              {slide.activityType && <span className="ml-1 text-indigo-600">[{slide.activityType}]</span>}
                                              {' '}{slide.title || slide.question?.substring(0, 50) || ''}
                                            </li>
                                          ))}
                                          {content.slides.length > 5 && (
                                            <li className="text-xs text-slate-400">+{content.slides.length - 5} dalších...</li>
                                          )}
                                        </ul>
                                      </div>
                                    )}
                                    
                                    {spec?.content_type === 'worksheet' && content?.blocks && (
                                      <div className="text-sm text-slate-600">
                                        <p className="font-medium">📝 {content.blocks.length} bloků:</p>
                                        <ul className="ml-4 mt-1 space-y-1">
                                          {content.blocks.slice(0, 5).map((block: any, i: number) => (
                                            <li key={i} className="text-xs">
                                              <span className="font-mono bg-slate-200 px-1 rounded">{block.type}</span>
                                              {' '}{block.content?.text || block.content?.question || block.content?.html?.substring(0, 40) || ''}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                    
                                    {spec?.content_type === 'text' && (
                                      <div className="text-sm text-slate-600">
                                        <p className="font-medium">📖 Učební text:</p>
                                        <div 
                                          className="mt-2 p-3 bg-white rounded border text-xs max-h-40 overflow-y-auto prose prose-sm"
                                          dangerouslySetInnerHTML={{ 
                                            __html: content?.content?.substring(0, 1000) || '<em>Prázdný obsah</em>' 
                                          }}
                                        />
                                        {content?.content?.length > 1000 && (
                                          <p className="text-xs text-slate-400 mt-1">
                                            ... +{content.content.length - 1000} znaků
                                          </p>
                                        )}
                                      </div>
                                    )}
                                    
                                    {/* Akce */}
                                    <div className="mt-3 flex items-center gap-2">
                                      {spec?.content_type === 'board' && draft.published_id && (
                                        <a 
                                          href={`/quiz/view/${draft.published_id}`}
                                          target="_blank"
                                          className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200"
                                        >
                                          📊 Otevřít Board
                                        </a>
                                      )}
                                      {spec?.content_type === 'worksheet' && draft.published_id && (
                                        <a 
                                          href={`/library/my-content/worksheet-editor/${draft.published_id}`}
                                          target="_blank"
                                          className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                                        >
                                          📝 Otevřít Worksheet
                                        </a>
                                      )}
                                      {spec?.content_type === 'text' && draft.published_id && (
                                        <a 
                                          href={`/library/my-content/view/${draft.published_id}`}
                                          target="_blank"
                                          className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200"
                                        >
                                          📖 Otevřít Text
                                        </a>
                                      )}
                                      <details className="flex-1">
                                        <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600">
                                          Zobrazit raw JSON
                                        </summary>
                                        <pre className="mt-2 p-2 bg-slate-900 text-green-400 text-xs rounded overflow-x-auto max-h-40">
                                          {JSON.stringify(content, null, 2)}
                                        </pre>
                                      </details>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          
                          {showRawData && rawDrafts.length === 0 && (
                            <p className="text-sm text-slate-500 text-center py-4">
                              Zatím žádná vygenerovaná data. Spusťte pipeline.
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {activeTab === 'rvp' && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-slate-900">RVP Témata</h3>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-slate-500">
                          {selectedRvpIds.size}/{rvpData.length} vybráno
                        </span>
                        <button
                          onClick={toggleAllRvp}
                          className="px-3 py-1 text-xs bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200"
                        >
                          {selectedRvpIds.size === rvpData.length ? 'Odebrat vše' : 'Vybrat vše'}
                        </button>
                      </div>
                    </div>
                    
                    {rvpData.length > 0 && (
                      <div className="mb-4 p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-amber-900">
                              📦 Generovat DataSety z vybraných RVP témat
                            </div>
                            <div className="text-sm text-amber-700">
                              Vybráno {selectedRvpIds.size} témat pro vytvoření materiálů
                            </div>
                          </div>
                          <button
                            onClick={() => setShowRvpSelectionModal(true)}
                            disabled={selectedRvpIds.size === 0 || isRunning}
                            style={{ backgroundColor: '#f59e0b' }}
                            className="px-4 py-2 text-white rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                          >
                            ✨ Pokračovat
                          </button>
                        </div>
                      </div>
                    )}
                    
                    <div className="space-y-3">
                      {rvpData.map((item) => (
                        <div 
                          key={item.id}
                          className={`p-4 border rounded-xl transition-colors cursor-pointer ${
                            selectedRvpIds.has(item.id)
                              ? 'border-amber-300 bg-amber-50/30'
                              : 'border-slate-200 hover:border-indigo-200'
                          }`}
                          onClick={() => toggleRvpSelection(item.id)}
                        >
                          <div className="flex items-start gap-3">
                            {/* Checkbox */}
                            <div className="pt-1">
                              <input
                                type="checkbox"
                                checked={selectedRvpIds.has(item.id)}
                                onChange={() => toggleRvpSelection(item.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                              />
                            </div>
                            
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full">
                                  {item.grade}. třída
                                </span>
                                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-600 text-xs rounded-full">
                                  {item.thematicArea}
                                </span>
                              </div>
                              <h4 className="font-medium text-slate-900">{item.topic}</h4>
                              <p className="text-sm text-slate-500 mt-1">
                                {item.recommendedHours} hodin • {item.expectedOutcomes.length} výstupů
                              </p>
                              
                              {item.expectedOutcomes.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-slate-100">
                                  <div className="text-xs font-medium text-slate-500 mb-2">Očekávané výstupy:</div>
                                  <ul className="text-sm text-slate-600 space-y-1">
                                    {item.expectedOutcomes.slice(0, 2).map((outcome, i) => (
                                      <li key={i} className="flex items-start gap-2">
                                        <span className="text-green-500 mt-1">•</span>
                                        {outcome}
                                      </li>
                                    ))}
                                    {item.expectedOutcomes.length > 2 && (
                                      <li className="text-slate-400">
                                        +{item.expectedOutcomes.length - 2} dalších...
                                      </li>
                                    )}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {rvpData.length === 0 && (
                        <div className="text-center py-12">
                          <Scroll className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                          <p className="text-slate-500">Žádná RVP data pro tento výběr</p>
                          <p className="text-sm text-slate-400 mt-1">
                            Spusťte pipeline pro načtení dat z RVP
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {activeTab === 'planner' && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-slate-900">Týdenní plány</h3>
                      <div className="text-sm text-slate-500">
                        {weeklyPlans.length} týdnů v rozvrhu
                      </div>
                    </div>
                    
                    <div className="mb-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
                      <div className="text-sm text-blue-700">
                        ℹ️ Týdenní plány slouží pro přehled rozložení učiva. 
                        Pro generování materiálů přejděte do záložky <strong>RVP Data</strong> a vyberte témata.
                      </div>
                    </div>
                    
                    {weeklyPlans.length > 0 ? (
                      <>
                        <div className="space-y-2">
                          {weeklyPlans.map((week) => (
                            <div 
                              key={week.id}
                              className="border border-slate-200 rounded-lg overflow-hidden"
                            >
                              <button
                                onClick={() => toggleWeekExpanded(week.weekNumber)}
                                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                              >
                                <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                                    <span className="font-bold text-indigo-600">{week.weekNumber}</span>
                                  </div>
                                  <div className="text-left">
                                    <div className="font-medium text-slate-900">{week.topicTitle}</div>
                                    <div className="text-sm text-slate-500">
                                      {WEEK_TO_MONTH[week.weekNumber]} • {week.hoursAllocated} hodiny
                                    </div>
                                  </div>
                                </div>
                                {expandedWeeks.has(week.weekNumber) ? (
                                  <ChevronDown className="w-5 h-5 text-slate-400" />
                                ) : (
                                  <ChevronRight className="w-5 h-5 text-slate-400" />
                                )}
                              </button>
                              
                              {expandedWeeks.has(week.weekNumber) && (
                                <div className="px-4 pb-4 border-t border-slate-100 bg-slate-50">
                                  <div className="pt-4 space-y-3">
                                    {week.learningGoals && week.learningGoals.length > 0 && (
                                      <div>
                                        <div className="text-xs font-medium text-slate-500 mb-1">Cíle:</div>
                                        <ul className="text-sm text-slate-600 space-y-1">
                                          {week.learningGoals.map((goal, i) => (
                                            <li key={i}>• {goal}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                    
                                    {week.vocabulary && week.vocabulary.length > 0 && (
                                      <div>
                                        <div className="text-xs font-medium text-slate-500 mb-1">Klíčové pojmy:</div>
                                        <div className="flex flex-wrap gap-1">
                                          {week.vocabulary.map((word, i) => (
                                            <span key={i} className="px-2 py-0.5 bg-white border border-slate-200 text-slate-600 text-xs rounded-full">
                                              {word}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-12">
                        <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500">Žádné týdenní plány</p>
                        <p className="text-sm text-slate-400 mt-1">
                          Spusťte Agent 2 (Planner) pro vytvoření plánů
                        </p>
                      </div>
                    )}
                  </div>
                )}
                
                {activeTab === 'datasets' && (
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold text-slate-900">
                        DataSety ({dataSets.length})
                        {dataSetsLoading && <span className="ml-2 text-sm text-slate-400">načítám...</span>}
                      </h3>
                      <button
                        onClick={loadDataSets}
                        disabled={dataSetsLoading}
                        className="px-3 py-1.5 text-sm bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 disabled:opacity-50"
                      >
                        {dataSetsLoading ? '⏳ Načítám...' : '🔄 Obnovit'}
                      </button>
                    </div>
                    
                    {dataSetsLoading && dataSets.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4" />
                        <p className="text-slate-500">Načítám DataSety...</p>
                      </div>
                    ) : dataSets.length === 0 ? (
                      <div className="text-center py-12">
                        <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500">Zatím žádné DataSety</p>
                        <p className="text-sm text-slate-400 mt-2">
                          Spusťte pipeline s aktivním DataSet flow pro vytvoření
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        {dataSets.map((ds) => {
                          const materialsCount = (ds.generated_materials || []).length;
                          const imagesCount = (ds.media?.images || []).length;
                          const termsCount = (ds.content?.keyTerms || []).length;
                          const isGenerating = generatingDataSetId === ds.id;
                          const isSelected = selectedDataSet?.id === ds.id;
                          
                          return (
                            <div
                              key={ds.id}
                              onClick={() => setSelectedDataSet(isSelected ? null : ds)}
                              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                isSelected 
                                  ? 'border-amber-500 bg-amber-50' 
                                  : 'border-slate-200 bg-white hover:border-amber-200'
                              }`}
                            >
                              <div className="flex items-start justify-between mb-3">
                                <div>
                                  <h4 className="font-semibold text-slate-900">{ds.topic}</h4>
                                  <p className="text-sm text-slate-500">
                                    {ds.rvp?.thematicArea || 'Bez tematického okruhu'}
                                  </p>
                                </div>
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  ds.status === 'published' 
                                    ? 'bg-green-100 text-green-700'
                                    : ds.status === 'ready'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {ds.status === 'published' ? '✓ Publikováno' : ds.status === 'ready' ? 'Připraven' : 'Draft'}
                                </span>
                              </div>
                              
                              {/* Stats */}
                              <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
                                <span className="flex items-center gap-1">
                                  <ImageIcon className="w-3 h-3" />
                                  {imagesCount} obr.
                                </span>
                                <span className="flex items-center gap-1">
                                  <BookOpen className="w-3 h-3" />
                                  {termsCount} pojmů
                                </span>
                                <span className="flex items-center gap-1">
                                  <FileText className="w-3 h-3" />
                                  {materialsCount} mat.
                                </span>
                              </div>
                              
                              {/* Expanded detail when selected */}
                              {isSelected && (
                                <div className="mt-4 pt-4 border-t border-amber-200">
                                  
                                  {/* PODKLADY - RVP, Pojmy, Obrázky */}
                                  <div className="mb-4 space-y-3">
                                    {/* RVP Info */}
                                    {ds.rvp && (
                                      <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                                        <div className="text-xs font-semibold text-indigo-700 mb-2">📋 RVP Podklady</div>
                                        <div className="text-xs text-slate-600 space-y-1">
                                          <div><span className="font-medium">Tematický okruh:</span> {ds.rvp.thematicArea}</div>
                                          {ds.rvp.expectedOutcomes?.length > 0 && (
                                            <div><span className="font-medium">Očekávané výstupy:</span> {ds.rvp.expectedOutcomes.slice(0, 2).join(', ')}{ds.rvp.expectedOutcomes.length > 2 ? '...' : ''}</div>
                                          )}
                                          {ds.rvp.competencies?.length > 0 && (
                                            <div><span className="font-medium">Kompetence:</span> {ds.rvp.competencies.slice(0, 3).join(', ')}</div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* Klíčové pojmy */}
                                    {ds.content?.keyTerms?.length > 0 && (
                                      <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                                        <div className="text-xs font-semibold text-emerald-700 mb-2">📚 Klíčové pojmy ({ds.content.keyTerms.length})</div>
                                        <div className="flex flex-wrap gap-1">
                                          {ds.content.keyTerms.slice(0, 10).map((term: any, idx: number) => (
                                            <span key={idx} className="px-2 py-0.5 bg-white border border-emerald-200 text-emerald-700 text-xs rounded-full">
                                              {typeof term === 'string' ? term : term.term}
                                            </span>
                                          ))}
                                          {ds.content.keyTerms.length > 10 && (
                                            <span className="text-xs text-emerald-500">+{ds.content.keyTerms.length - 10} dalších</span>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* Vyhledávání nových obrázků */}
                                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 mb-4">
                                      <div className="text-sm font-semibold text-slate-700 mb-2">🔍 Přidat obrázky z webu</div>
                                      <div className="flex gap-2">
                                        <input
                                          type="text"
                                          placeholder="Hledat obrázky (např. řecká helma, Parthenon...)"
                                          value={imageSearchQuery[ds.id] || ''}
                                          onChange={(e) => setImageSearchQuery(prev => ({ ...prev, [ds.id]: e.target.value }))}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              e.preventDefault();
                                              // Trigger search
                                              (async () => {
                                                const query = imageSearchQuery[ds.id];
                                                if (!query?.trim()) return;
                                                
                                                setSearchingImages(ds.id);
                                                try {
                                            const dataCollector = await import('../../utils/dataset/data-collector');
                                            const results = await (dataCollector as any).searchImagesForTopic(query, 6);
                                                  setImageSearchResults(prev => ({ ...prev, [ds.id]: results }));
                                                } catch (err) {
                                                  console.error('Image search error:', err);
                                                  toast.error('Hledání selhalo');
                                                } finally {
                                                  setSearchingImages(null);
                                                }
                                              })();
                                            }
                                          }}
                                          onClick={(e) => e.stopPropagation()}
                                          className="flex-1 px-3 py-2 text-sm border rounded-lg"
                                        />
                                        <button
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            const query = imageSearchQuery[ds.id];
                                            if (!query?.trim()) return;
                                            
                                            setSearchingImages(ds.id);
                                            try {
                                              const dataCollector = await import('../../utils/dataset/data-collector');
                                              const results = await (dataCollector as any).searchImagesForTopic(query, 6);
                                              setImageSearchResults(prev => ({ ...prev, [ds.id]: results }));
                                            } catch (err) {
                                              console.error('Image search error:', err);
                                              toast.error('Hledání selhalo');
                                            } finally {
                                              setSearchingImages(null);
                                            }
                                          }}
                                          disabled={searchingImages === ds.id}
                                          style={{ backgroundColor: '#3b82f6', color: 'white', padding: '8px 16px', borderRadius: '8px', border: 'none', fontSize: '12px' }}
                                        >
                                          {searchingImages === ds.id ? '⏳' : '🔍 Hledat'}
                                        </button>
                                      </div>
                                      
                                      {/* Výsledky hledání */}
                                      {imageSearchResults[ds.id]?.length > 0 && (
                                        <div className="mt-3">
                                          <div className="text-xs text-slate-500 mb-2">Klikni pro přidání do DataSetu:</div>
                                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                                            {imageSearchResults[ds.id].map((img: any, idx: number) => (
                                              <div 
                                                key={idx}
                                                onClick={async (e) => {
                                                  e.stopPropagation();
                                                  // Přidat obrázek do datasetu
                                                  const newImage = {
                                                    url: img.url,
                                                    thumbnailUrl: img.thumbnailUrl || img.url,
                                                    title: img.title || `Obrázek ${(ds.media?.images?.length || 0) + 1}`,
                                                    source: img.source || 'web',
                                                    excluded: false
                                                  };
                                                  
                                                  const updatedImages = [...(ds.media?.images || []), newImage];
                                                  
                                                  const { error } = await supabase
                                                    .from('topic_data_sets')
                                                    .update({ media: { ...ds.media, images: updatedImages } })
                                                    .eq('id', ds.id);
                                                  
                                                  if (!error) {
                                                    setDataSets(prev => prev.map(d => 
                                                      d.id === ds.id 
                                                        ? { ...d, media: { ...d.media, images: updatedImages } }
                                                        : d
                                                    ));
                                                    // Odstranit z výsledků
                                                    setImageSearchResults(prev => ({
                                                      ...prev,
                                                      [ds.id]: prev[ds.id].filter((_, i) => i !== idx)
                                                    }));
                                                    toast.success(`Přidán: ${newImage.title}`);
                                                  }
                                                }}
                                                style={{
                                                  cursor: 'pointer',
                                                  borderRadius: '6px',
                                                  overflow: 'hidden',
                                                  border: '2px solid #e2e8f0',
                                                  transition: 'all 0.2s'
                                                }}
                                                className="hover:border-blue-500 hover:shadow-md"
                                              >
                                                <img 
                                                  src={img.thumbnailUrl || img.url}
                                                  alt={img.title}
                                                  style={{ width: '100%', height: '60px', objectFit: 'cover' }}
                                                />
                                                <div style={{ padding: '4px', fontSize: '10px', textAlign: 'center', background: '#f8fafc' }}>
                                                  + Přidat
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    
                                    {/* Obrázky - 3 sloupce s možností odznačit */}
                                    {ds.media?.images?.length > 0 && (
                                      <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                                        <div className="flex items-center justify-between mb-3">
                                          <div className="text-sm font-semibold text-amber-700">
                                            🖼️ Dostupné obrázky ({ds.media.images.filter((img: any) => !img.excluded).length}/{ds.media.images.length})
                                          </div>
                                          <div className="text-xs text-amber-600">
                                            ✅ = použít | ❌ = vyloučit
                                          </div>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                                          {ds.media.images.map((img: any, idx: number) => (
                                            <div 
                                              key={idx}
                                              style={{
                                                position: 'relative',
                                                borderRadius: '8px',
                                                overflow: 'hidden',
                                                border: img.excluded ? '3px solid #ef4444' : '3px solid #10b981',
                                                opacity: img.excluded ? 0.5 : 1,
                                                background: img.excluded ? '#fee2e2' : '#d1fae5'
                                              }}
                                            >
                                              <img 
                                                src={img.thumbnailUrl || img.url} 
                                                alt={img.title || `Obrázek ${idx + 1}`}
                                                style={{ width: '100%', height: '100px', objectFit: 'cover' }}
                                              />
                                              {/* Status badge */}
                                              <div style={{
                                                position: 'absolute',
                                                top: '4px',
                                                left: '4px',
                                                padding: '2px 6px',
                                                borderRadius: '4px',
                                                fontSize: '10px',
                                                fontWeight: 'bold',
                                                color: 'white',
                                                background: img.excluded ? '#ef4444' : '#10b981'
                                              }}>
                                                {img.excluded ? '❌ VYLOUČENO' : '✅ AKTIVNÍ'}
                                              </div>
                                              {/* Title */}
                                              <div style={{
                                                padding: '4px 8px',
                                                background: 'rgba(0,0,0,0.7)',
                                                color: 'white',
                                                fontSize: '11px',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis'
                                              }}>
                                                {img.title || `Obrázek ${idx + 1}`}
                                              </div>
                                              {/* Action buttons */}
                                              <div style={{ 
                                                display: 'flex', 
                                                gap: '4px', 
                                                padding: '6px',
                                                background: '#f8fafc'
                                              }}>
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleMediaExclusion(ds.id, 'image', idx);
                                                  }}
                                                  style={{
                                                    flex: 1,
                                                    padding: '6px',
                                                    borderRadius: '4px',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    fontSize: '11px',
                                                    fontWeight: 'bold',
                                                    background: img.excluded ? '#10b981' : '#ef4444',
                                                    color: 'white'
                                                  }}
                                                >
                                                  {img.excluded ? '✅ Obnovit' : '❌ Vyloučit'}
                                                </button>
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    // Otevřít obrázek v novém okně
                                                    window.open(img.url, '_blank');
                                                  }}
                                                  style={{
                                                    padding: '6px 10px',
                                                    borderRadius: '4px',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    fontSize: '11px',
                                                    fontWeight: 'bold',
                                                    background: '#3b82f6',
                                                    color: 'white'
                                                  }}
                                                >
                                                  👁️
                                                </button>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* Ilustrace - generování přes Gemini 3 Pro */}
                                    <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                                      <div className="flex items-center justify-between mb-3">
                                        <div className="text-sm font-semibold text-indigo-700">
                                          🎨 Generované ilustrace ({(ds.media?.generatedIllustrations || []).length})
                                        </div>
                                        <button
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            setGeneratingDataSetId(ds.id);
                                            addProgressMessage(`🎨 Generuji prompty pro ilustrace...`);
                                            
                                            try {
                                              const { generateIllustrationPrompts } = await import('../../utils/dataset/material-generators');
                                              const prompts = await generateIllustrationPrompts({
                                                id: ds.id,
                                                topic: ds.topic,
                                                subjectCode: ds.subject_code,
                                                grade: ds.grade,
                                                status: ds.status,
                                                rvp: ds.rvp || {},
                                                targetGroup: ds.target_group || {},
                                                content: ds.content || {},
                                                media: ds.media || {},
                                                generatedMaterials: ds.generated_materials || [],
                                                createdAt: ds.created_at,
                                                updatedAt: ds.updated_at,
                                              });
                                              
                                              // Uložit prompty do datasetu
                                              const { error } = await supabase
                                                .from('topic_data_sets')
                                                .update({ 
                                                  media: { 
                                                    ...ds.media, 
                                                    illustrationPrompts: prompts 
                                                  } 
                                                })
                                                .eq('id', ds.id);
                                              
                                              if (!error) {
                                                setDataSets(prev => prev.map(d => 
                                                  d.id === ds.id 
                                                    ? { ...d, media: { ...d.media, illustrationPrompts: prompts } }
                                                    : d
                                                ));
                                                addProgressMessage(`✅ Vygenerováno ${prompts.length} promptů`);
                                                toast.success(`${prompts.length} promptů připraveno`);
                                              }
                                            } catch (err: any) {
                                              addProgressMessage(`❌ Chyba: ${err.message}`);
                                              toast.error('Chyba při generování promptů');
                                            } finally {
                                              setGeneratingDataSetId(null);
                                            }
                                          }}
                                          disabled={generatingDataSetId === ds.id}
                                          style={{ backgroundColor: '#6366f1', color: 'white', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', border: 'none', cursor: 'pointer' }}
                                        >
                                          {generatingDataSetId === ds.id ? '⏳ Generuji...' : '✨ Generovat prompty'}
                                        </button>
                                      </div>
                                      
                                      {/* Prompty */}
                                      {ds.media?.illustrationPrompts?.length > 0 && (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
                                          {ds.media.illustrationPrompts.map((prompt: any, idx: number) => (
                                            <div 
                                              key={prompt.id || idx}
                                              style={{
                                                background: 'white',
                                                borderRadius: '8px',
                                                border: prompt.generatedUrl ? '2px solid #10b981' : '2px solid #e2e8f0',
                                                overflow: 'hidden'
                                              }}
                                            >
                                              {/* Vygenerovaný obrázek nebo placeholder */}
                                              {prompt.generatedUrl ? (
                                                <img 
                                                  src={prompt.generatedUrl} 
                                                  alt={prompt.name}
                                                  style={{ width: '100%', height: '80px', objectFit: 'cover' }}
                                                />
                                              ) : (
                                                <div style={{ 
                                                  height: '80px', 
                                                  background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'center',
                                                  color: '#6366f1',
                                                  fontSize: '24px'
                                                }}>
                                                  🎨
                                                </div>
                                              )}
                                              {/* Info */}
                                              <div style={{ padding: '8px' }}>
                                                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#1e293b', marginBottom: '4px' }}>
                                                  {prompt.name}
                                                </div>
                                                <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '6px' }}>
                                                  {prompt.category} • {prompt.keywords?.slice(0, 2).join(', ')}
                                                </div>
                                                {/* Tlačítka */}
                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                  {!prompt.generatedUrl ? (
                                                    <button
                                                      onClick={async (e) => {
                                                        e.stopPropagation();
                                                        
                                                        // Uložit ID promptu pro stabilní identifikaci (ne index!)
                                                        const promptId = prompt.id;
                                                        
                                                        // Aktualizovat stav promptu na "generating" - hledat podle ID
                                                        const updatedPrompts = ds.media.illustrationPrompts.map((p: any) => 
                                                          p.id === promptId ? { ...p, status: 'generating' } : p
                                                        );
                                                        setDataSets(prev => prev.map(d => 
                                                          d.id === ds.id 
                                                            ? { ...d, media: { ...d.media, illustrationPrompts: updatedPrompts } }
                                                            : d
                                                        ));
                                                        
                                                        try {
                                                          const { generateImageWithImagen } = await import('../../utils/ai-chat-proxy');
                                                          
                                                          addProgressMessage(`🎨 Generuji: ${prompt.name}...`);
                                                          
                                                          console.log('[DEBUG] Calling generateImageWithImagen with:', {
                                                            prompt: prompt.prompt.substring(0, 100) + '...',
                                                            dataSetId: ds.id,
                                                            illustrationName: prompt.name
                                                          });
                                                          
                                                          const result = await generateImageWithImagen(
                                                            prompt.prompt,
                                                            { 
                                                              aspectRatio: '1:1',
                                                              dataSetId: ds.id,
                                                              illustrationName: prompt.name
                                                            }
                                                          );
                                                          
                                                          console.log('[DEBUG] generateImageWithImagen result:', {
                                                            success: result.success,
                                                            hasUrl: !!result.url,
                                                            url: result.url,
                                                            hasImages: !!result.images,
                                                            imagesCount: result.images?.length,
                                                            error: result.error
                                                          });
                                                          
                                                          // Pokud máme success a buď URL nebo base64 obrázek
                                                          if (result.success && (result.url || result.images?.[0]?.base64)) {
                                                            // Import upload utility
                                                            const { processImageUrl } = await import('../../utils/supabase/upload-image');
                                                            
                                                            // Pokud nemáme URL ale máme base64, NAHRAJEME do Storage (ne do DB!)
                                                            let rawImageUrl = result.url || `data:${result.images?.[0]?.mimeType || 'image/png'};base64,${result.images?.[0]?.base64}`;
                                                            
                                                            // Upload do Storage a získej skutečné URL
                                                            const imageUrl = await processImageUrl(
                                                              rawImageUrl,
                                                              `${ds.id}-${promptId}`,
                                                              'illustrations'
                                                            );
                                                            console.log('[DEBUG] Using imageUrl:', imageUrl.substring(0, 100) + '...');
                                                            
                                                            // Nová ilustrace
                                                            const newIllustration = {
                                                              id: promptId,
                                                              name: prompt.name,
                                                              url: imageUrl,
                                                              category: prompt.category,
                                                              keywords: prompt.keywords
                                                            };
                                                            
                                                            // ATOMICKÁ OPERACE: Použít RPC funkci pro bezpečné přidání
                                                            const { data: updatedMedia, error: rpcError } = await supabase
                                                              .rpc('add_illustration_to_dataset', {
                                                                p_dataset_id: ds.id,
                                                                p_prompt_id: promptId,
                                                                p_illustration: newIllustration
                                                              });
                                                            
                                                            if (rpcError) {
                                                              console.error('[DEBUG] RPC error:', rpcError);
                                                              // Fallback na původní logiku pokud RPC neexistuje
                                                              const { data: currentDs } = await supabase
                                                                .from('topic_data_sets')
                                                                .select('media')
                                                                .eq('id', ds.id)
                                                                .single();
                                                              
                                                              const currentMedia = currentDs?.media || ds.media;
                                                              const finalPrompts = (currentMedia.illustrationPrompts || []).map((p: any) => 
                                                                p.id === promptId ? { ...p, generatedUrl: imageUrl, status: 'completed' } : p
                                                              );
                                                              const existingIllustrations = (currentMedia.generatedIllustrations || []).filter(
                                                                (ill: any) => ill.id !== promptId
                                                              );
                                                              const fallbackMedia = {
                                                                ...currentMedia,
                                                                illustrationPrompts: finalPrompts,
                                                                generatedIllustrations: [...existingIllustrations, newIllustration]
                                                              };
                                                              
                                                              await supabase
                                                                .from('topic_data_sets')
                                                                .update({ media: fallbackMedia })
                                                                .eq('id', ds.id);
                                                              
                                                              setDataSets(prev => prev.map(d => 
                                                                d.id === ds.id ? { ...d, media: fallbackMedia } : d
                                                              ));
                                                            } else {
                                                              // RPC úspěch - použít vrácený media objekt
                                                              console.log('[DEBUG] RPC success, updatedMedia:', updatedMedia);
                                                              setDataSets(prev => prev.map(d => 
                                                                d.id === ds.id ? { ...d, media: updatedMedia } : d
                                                              ));
                                                            }
                                                            
                                                            addProgressMessage(`✅ Ilustrace "${prompt.name}" vygenerována!`);
                                                            toast.success('Ilustrace vygenerována');
                                                          } else {
                                                            throw new Error(result.error || 'Generování selhalo');
                                                          }
                                                        } catch (err: any) {
                                                          // Reset stavu - hledat podle ID
                                                          const resetPrompts = ds.media.illustrationPrompts.map((p: any) => 
                                                            p.id === promptId ? { ...p, status: 'error' } : p
                                                          );
                                                          setDataSets(prev => prev.map(d => 
                                                            d.id === ds.id 
                                                              ? { ...d, media: { ...d.media, illustrationPrompts: resetPrompts } }
                                                              : d
                                                          ));
                                                          addProgressMessage(`❌ Chyba: ${err.message}`);
                                                          toast.error(err.message);
                                                        }
                                                      }}
                                                      disabled={prompt.status === 'generating'}
                                                      style={{ 
                                                        flex: 1, 
                                                        padding: '4px 8px', 
                                                        borderRadius: '4px', 
                                                        border: 'none', 
                                                        cursor: 'pointer',
                                                        fontSize: '10px',
                                                        fontWeight: 'bold',
                                                        background: prompt.status === 'generating' ? '#94a3b8' : '#6366f1',
                                                        color: 'white'
                                                      }}
                                                    >
                                                      {prompt.status === 'generating' ? '⏳...' : '🎨 Generovat'}
                                                    </button>
                                                  ) : (
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        window.open(prompt.generatedUrl, '_blank');
                                                      }}
                                                      style={{ 
                                                        flex: 1, 
                                                        padding: '4px 8px', 
                                                        borderRadius: '4px', 
                                                        border: 'none', 
                                                        cursor: 'pointer',
                                                        fontSize: '10px',
                                                        fontWeight: 'bold',
                                                        background: '#10b981',
                                                        color: 'white'
                                                      }}
                                                    >
                                                      👁️ Zobrazit
                                                    </button>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      
                                      {/* Vygenerované ilustrace s exclude/include */}
                                      {ds.media?.generatedIllustrations?.length > 0 && (
                                        <div>
                                          <div className="flex items-center justify-between mb-2">
                                            <div className="text-xs font-semibold text-green-700">
                                              ✅ Hotové ilustrace ({ds.media.generatedIllustrations.filter((ill: any) => !ill.excluded).length}/{ds.media.generatedIllustrations.length})
                                            </div>
                                            <div className="text-xs text-green-600">
                                              ✅ = použít | ❌ = vyloučit
                                            </div>
                                          </div>
                                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                                            {ds.media.generatedIllustrations.map((ill: any, idx: number) => (
                                              <div 
                                                key={idx}
                                                style={{
                                                  position: 'relative',
                                                  borderRadius: '8px',
                                                  overflow: 'hidden',
                                                  border: ill.excluded ? '3px solid #ef4444' : '3px solid #10b981',
                                                  opacity: ill.excluded ? 0.5 : 1,
                                                  background: ill.excluded ? '#fee2e2' : '#d1fae5'
                                                }}
                                              >
                                                <img 
                                                  src={ill.url}
                                                  alt={ill.name}
                                                  style={{ width: '100%', height: '80px', objectFit: 'cover' }}
                                                />
                                                {/* Status badge */}
                                                <div style={{
                                                  position: 'absolute',
                                                  top: '4px',
                                                  left: '4px',
                                                  padding: '2px 6px',
                                                  borderRadius: '4px',
                                                  fontSize: '9px',
                                                  fontWeight: 'bold',
                                                  color: 'white',
                                                  background: ill.excluded ? '#ef4444' : '#10b981'
                                                }}>
                                                  {ill.excluded ? '❌' : '✅'}
                                                </div>
                                                {/* Title */}
                                                <div style={{
                                                  padding: '4px 8px',
                                                  background: 'rgba(0,0,0,0.7)',
                                                  color: 'white',
                                                  fontSize: '10px',
                                                  whiteSpace: 'nowrap',
                                                  overflow: 'hidden',
                                                  textOverflow: 'ellipsis'
                                                }}>
                                                  {ill.name}
                                                </div>
                                                {/* Action buttons */}
                                                <div style={{ 
                                                  display: 'flex', 
                                                  gap: '4px', 
                                                  padding: '4px',
                                                  background: '#f8fafc'
                                                }}>
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      toggleMediaExclusion(ds.id, 'illustration', idx);
                                                    }}
                                                    style={{
                                                      flex: 1,
                                                      padding: '4px',
                                                      borderRadius: '4px',
                                                      border: 'none',
                                                      cursor: 'pointer',
                                                      fontSize: '10px',
                                                      fontWeight: 'bold',
                                                      background: ill.excluded ? '#10b981' : '#ef4444',
                                                      color: 'white'
                                                    }}
                                                  >
                                                    {ill.excluded ? '✅' : '❌'}
                                                  </button>
                                                  <button
                                                    onClick={async (e) => {
                                                      e.stopPropagation();
                                                      
                                                      // Najít odpovídající prompt
                                                      const prompt = ds.media?.illustrationPrompts?.find(
                                                        (p: any) => p.id === ill.id || p.name === ill.name
                                                      );
                                                      
                                                      if (!prompt) {
                                                        toast.error('Prompt pro ilustraci nenalezen');
                                                        return;
                                                      }
                                                      
                                                      setGeneratingDataSetId(ds.id);
                                                      addProgressMessage(`🔄 Přegenerovávám: ${ill.name}...`);
                                                      
                                                      try {
                                                        const { generateImageWithImagen } = await import('../../utils/ai-chat-proxy');
                                                        
                                                        const result = await generateImageWithImagen(
                                                          prompt.prompt,
                                                          { 
                                                            aspectRatio: '1:1',
                                                            dataSetId: ds.id,
                                                            illustrationName: ill.name
                                                          }
                                                        );
                                                        
                                                        if (result.success && (result.url || result.images?.[0]?.base64)) {
                                                          // Import upload utility
                                                          const { processImageUrl } = await import('../../utils/supabase/upload-image');
                                                          
                                                          // Upload do Storage místo ukládání base64 do DB
                                                          let rawImageUrl = result.url || `data:${result.images?.[0]?.mimeType || 'image/png'};base64,${result.images?.[0]?.base64}`;
                                                          const imageUrl = await processImageUrl(rawImageUrl, `${ds.id}-${ill.id}`, 'illustrations');
                                                          
                                                          // Načíst aktuální stav z DB
                                                          const { data: currentDs } = await supabase
                                                            .from('topic_data_sets')
                                                            .select('media')
                                                            .eq('id', ds.id)
                                                            .single();
                                                          
                                                          const currentMedia = currentDs?.media || ds.media;
                                                          
                                                          // Aktualizovat ilustraci
                                                          const updatedIllustrations = (currentMedia.generatedIllustrations || []).map(
                                                            (i: any) => i.id === ill.id || i.name === ill.name 
                                                              ? { ...i, url: imageUrl }
                                                              : i
                                                          );
                                                          
                                                          const updatedMedia = {
                                                            ...currentMedia,
                                                            generatedIllustrations: updatedIllustrations
                                                          };
                                                          
                                                          await supabase
                                                            .from('topic_data_sets')
                                                            .update({ media: updatedMedia })
                                                            .eq('id', ds.id);
                                                          
                                                          // Aktualizovat lokální stav
                                                          setDataSets(prev => prev.map(d => 
                                                            d.id === ds.id 
                                                              ? { ...d, media: updatedMedia }
                                                              : d
                                                          ));
                                                          
                                                          addProgressMessage(`✅ Ilustrace "${ill.name}" přegenerována`);
                                                          toast.success('Ilustrace přegenerována');
                                                        } else {
                                                          throw new Error(result.error || 'Generování selhalo');
                                                        }
                                                      } catch (err: any) {
                                                        console.error('Regenerate error:', err);
                                                        addProgressMessage(`❌ Chyba: ${err.message}`);
                                                        toast.error('Přegenerování selhalo');
                                                      } finally {
                                                        setGeneratingDataSetId(null);
                                                      }
                                                    }}
                                                    disabled={generatingDataSetId === ds.id}
                                                    style={{
                                                      padding: '4px 6px',
                                                      borderRadius: '4px',
                                                      border: 'none',
                                                      cursor: generatingDataSetId === ds.id ? 'wait' : 'pointer',
                                                      fontSize: '10px',
                                                      fontWeight: 'bold',
                                                      background: generatingDataSetId === ds.id ? '#9ca3af' : '#f59e0b',
                                                      color: 'white'
                                                    }}
                                                    title="Přegenerovat ilustraci"
                                                  >
                                                    🔄
                                                  </button>
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      window.open(ill.url, '_blank');
                                                    }}
                                                    style={{
                                                      padding: '4px 6px',
                                                      borderRadius: '4px',
                                                      border: 'none',
                                                      cursor: 'pointer',
                                                      fontSize: '10px',
                                                      fontWeight: 'bold',
                                                      background: '#3b82f6',
                                                      color: 'white'
                                                    }}
                                                  >
                                                    👁️
                                                  </button>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    
                                    {/* Fotorealistické fotky + historická selfie */}
                                    <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                                      <div className="flex items-center justify-between mb-3">
                                        <div className="text-sm font-semibold text-amber-700">
                                          📷 Fotorealistické fotky ({(ds.media?.generatedPhotos || []).length})
                                        </div>
                                        <button
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            setGeneratingDataSetId(ds.id);
                                            addProgressMessage(`📷 Generuji prompty pro fotky...`);
                                            
                                            try {
                                              const { generatePhotoPrompts } = await import('../../utils/dataset/material-generators');
                                              const prompts = await generatePhotoPrompts({
                                                id: ds.id,
                                                topic: ds.topic,
                                                subjectCode: ds.subject_code,
                                                grade: ds.grade,
                                                status: ds.status,
                                                rvp: ds.rvp || {},
                                                targetGroup: ds.target_group || {},
                                                content: ds.content || {},
                                                media: ds.media || {},
                                                generatedMaterials: ds.generated_materials || [],
                                                createdAt: ds.created_at,
                                                updatedAt: ds.updated_at,
                                              });
                                              
                                              // Uložit prompty do datasetu
                                              const { error } = await supabase
                                                .from('topic_data_sets')
                                                .update({ 
                                                  media: { 
                                                    ...ds.media, 
                                                    photoPrompts: prompts 
                                                  } 
                                                })
                                                .eq('id', ds.id);
                                              
                                              if (!error) {
                                                addProgressMessage(`✅ Vygenerováno ${prompts.length} promptů pro fotky (první je selfie!)`);
                                                toast.success(`${prompts.length} promptů pro fotky`);
                                                await loadDataSets();
                                              }
                                            } catch (err: any) {
                                              addProgressMessage(`❌ Chyba: ${err.message}`);
                                              toast.error(err.message);
                                            } finally {
                                              setGeneratingDataSetId(null);
                                            }
                                          }}
                                          disabled={generatingDataSetId === ds.id}
                                          style={{ backgroundColor: '#f59e0b', color: 'white', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', border: 'none', cursor: 'pointer' }}
                                        >
                                          {generatingDataSetId === ds.id ? '⏳ Generuji...' : '📷 Generovat prompty'}
                                        </button>
                                      </div>
                                      
                                      {/* Photo Prompty */}
                                      {ds.media?.photoPrompts?.length > 0 && (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
                                          {ds.media.photoPrompts.map((prompt: any, idx: number) => (
                                            <div 
                                              key={prompt.id || idx}
                                              style={{
                                                background: 'white',
                                                borderRadius: '8px',
                                                border: prompt.generatedUrl ? '2px solid #10b981' : '2px solid #fbbf24',
                                                padding: '8px',
                                                fontSize: '11px'
                                              }}
                                            >
                                              {prompt.generatedUrl ? (
                                                <img src={prompt.generatedUrl} alt={prompt.name} style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '4px', marginBottom: '6px' }} />
                                              ) : (
                                                <div style={{ 
                                                  width: '100%', 
                                                  height: '80px', 
                                                  background: prompt.category === 'selfie' ? '#fef3c7' : '#f1f5f9', 
                                                  borderRadius: '4px', 
                                                  marginBottom: '6px',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'center',
                                                  fontSize: '24px'
                                                }}>
                                                  {prompt.category === 'selfie' ? '🤳' : prompt.category === 'scene' ? '🏛️' : prompt.category === 'portrait' ? '👤' : prompt.category === 'artifact' ? '🏺' : '📍'}
                                                </div>
                                              )}
                                              <div style={{ fontWeight: 'bold', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                {prompt.category === 'selfie' && <span style={{ background: '#fef3c7', padding: '1px 4px', borderRadius: '4px', fontSize: '9px' }}>🤳 SELFIE</span>}
                                                {prompt.name}
                                              </div>
                                              <div style={{ color: '#64748b', fontSize: '10px', marginBottom: '4px' }}>{prompt.description?.substring(0, 60)}...</div>
                                              <div style={{ display: 'flex', gap: '4px' }}>
                                                {!prompt.generatedUrl ? (
                                                  <button
                                                    onClick={async (e) => {
                                                      e.stopPropagation();
                                                      const promptId = prompt.id;
                                                      
                                                      // Update status
                                                      const updatedPrompts = ds.media.photoPrompts.map((p: any) => 
                                                        p.id === promptId ? { ...p, status: 'generating' } : p
                                                      );
                                                      setDataSets(prev => prev.map(d => 
                                                        d.id === ds.id 
                                                          ? { ...d, media: { ...d.media, photoPrompts: updatedPrompts } }
                                                          : d
                                                      ));
                                                      
                                                      try {
                                                        const { generatePhoto } = await import('../../utils/dataset/material-generators');
                                                        
                                                        addProgressMessage(`📷 Generuji: ${prompt.name}...`);
                                                        
                                                        const imageUrl = await generatePhoto(prompt, {
                                                          id: ds.id,
                                                          topic: ds.topic,
                                                          subjectCode: ds.subject_code,
                                                          grade: ds.grade,
                                                          status: ds.status,
                                                          rvp: ds.rvp || {},
                                                          targetGroup: ds.target_group || {},
                                                          content: ds.content || {},
                                                          media: ds.media || {},
                                                          generatedMaterials: ds.generated_materials || [],
                                                          createdAt: ds.created_at,
                                                          updatedAt: ds.updated_at,
                                                        });
                                                        
                                                        if (imageUrl) {
                                                          // Nová fotka
                                                          const newPhoto = {
                                                            id: promptId,
                                                            name: prompt.name,
                                                            category: prompt.category,
                                                            url: imageUrl,
                                                            excluded: false
                                                          };
                                                          
                                                          // ATOMICKÁ OPERACE: Použít RPC funkci pro bezpečné přidání
                                                          const { data: updatedMedia, error: rpcError } = await supabase
                                                            .rpc('add_photo_to_dataset', {
                                                              p_dataset_id: ds.id,
                                                              p_prompt_id: promptId,
                                                              p_photo: newPhoto
                                                            });
                                                          
                                                          if (rpcError) {
                                                            console.error('[DEBUG] Photo RPC error:', rpcError);
                                                            // Fallback na původní logiku pokud RPC neexistuje
                                                            const { data: currentDs } = await supabase
                                                              .from('topic_data_sets')
                                                              .select('media')
                                                              .eq('id', ds.id)
                                                              .single();
                                                            
                                                            const currentMedia = currentDs?.media || ds.media;
                                                            const finalPrompts = (currentMedia.photoPrompts || []).map((p: any) => 
                                                              p.id === promptId ? { ...p, status: 'completed', generatedUrl: imageUrl } : p
                                                            );
                                                            const existingPhotos = (currentMedia.generatedPhotos || []).filter(
                                                              (p: any) => p.id !== promptId
                                                            );
                                                            const fallbackMedia = {
                                                              ...currentMedia,
                                                              photoPrompts: finalPrompts,
                                                              generatedPhotos: [...existingPhotos, newPhoto]
                                                            };
                                                            
                                                            await supabase
                                                              .from('topic_data_sets')
                                                              .update({ media: fallbackMedia })
                                                              .eq('id', ds.id);
                                                            
                                                            setDataSets(prev => prev.map(d => 
                                                              d.id === ds.id ? { ...d, media: fallbackMedia } : d
                                                            ));
                                                          } else if (updatedMedia) {
                                                            // Update lokálního stavu z výsledku RPC
                                                            setDataSets(prev => prev.map(d => 
                                                              d.id === ds.id ? { ...d, media: updatedMedia } : d
                                                            ));
                                                          }
                                                          
                                                          addProgressMessage(`✅ Fotka "${prompt.name}" vygenerována!`);
                                                          toast.success(prompt.category === 'selfie' ? '🤳 Historické selfie!' : 'Fotka vygenerována');
                                                        } else {
                                                          throw new Error('Generování selhalo');
                                                        }
                                                      } catch (err: any) {
                                                        const resetPrompts = ds.media.photoPrompts.map((p: any) => 
                                                          p.id === promptId ? { ...p, status: 'error' } : p
                                                        );
                                                        setDataSets(prev => prev.map(d => 
                                                          d.id === ds.id 
                                                            ? { ...d, media: { ...d.media, photoPrompts: resetPrompts } }
                                                            : d
                                                        ));
                                                        addProgressMessage(`❌ Chyba: ${err.message}`);
                                                        toast.error(err.message);
                                                      }
                                                    }}
                                                    disabled={prompt.status === 'generating'}
                                                    style={{ 
                                                      flex: 1, 
                                                      padding: '4px 8px', 
                                                      borderRadius: '4px', 
                                                      border: 'none', 
                                                      cursor: 'pointer',
                                                      fontSize: '10px',
                                                      fontWeight: 'bold',
                                                      background: prompt.status === 'generating' ? '#94a3b8' : '#f59e0b',
                                                      color: 'white'
                                                    }}
                                                  >
                                                    {prompt.status === 'generating' ? '⏳...' : '📷 Generovat'}
                                                  </button>
                                                ) : (
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      window.open(prompt.generatedUrl, '_blank');
                                                    }}
                                                    style={{ 
                                                      flex: 1, 
                                                      padding: '4px 8px', 
                                                      borderRadius: '4px', 
                                                      border: 'none', 
                                                      cursor: 'pointer',
                                                      fontSize: '10px',
                                                      fontWeight: 'bold',
                                                      background: '#10b981',
                                                      color: 'white'
                                                    }}
                                                  >
                                                    👁️ Zobrazit
                                                  </button>
                                                )}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      
                                      {/* Vygenerované fotky */}
                                      {ds.media?.generatedPhotos?.length > 0 && (
                                        <div>
                                          <div className="text-xs font-semibold text-green-700 mb-2">
                                            ✅ Hotové fotky ({ds.media.generatedPhotos.filter((p: any) => !p.excluded).length}/{ds.media.generatedPhotos.length})
                                          </div>
                                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                                            {ds.media.generatedPhotos.map((photo: any, idx: number) => (
                                              <div 
                                                key={idx}
                                                style={{
                                                  position: 'relative',
                                                  borderRadius: '8px',
                                                  overflow: 'hidden',
                                                  border: photo.excluded ? '3px solid #ef4444' : '3px solid #10b981',
                                                  opacity: photo.excluded ? 0.5 : 1
                                                }}
                                              >
                                                <img 
                                                  src={photo.url}
                                                  alt={photo.name}
                                                  style={{ width: '100%', height: '80px', objectFit: 'cover' }}
                                                />
                                                {photo.category === 'selfie' && (
                                                  <div style={{
                                                    position: 'absolute',
                                                    top: '4px',
                                                    left: '4px',
                                                    background: '#fef3c7',
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    fontSize: '9px',
                                                    fontWeight: 'bold'
                                                  }}>
                                                    🤳 SELFIE
                                                  </div>
                                                )}
                                                <div style={{
                                                  background: 'rgba(0,0,0,0.7)',
                                                  color: 'white',
                                                  padding: '4px 6px',
                                                  fontSize: '9px',
                                                  display: 'flex',
                                                  justifyContent: 'space-between',
                                                  alignItems: 'center'
                                                }}>
                                                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {photo.name?.substring(0, 20)}...
                                                  </span>
                                                </div>

                                                {/* Ovládací prvky pro hotovou fotku */}
                                                <div style={{ 
                                                  position: 'absolute', 
                                                  top: 0, 
                                                  right: 0, 
                                                  bottom: 0, 
                                                  left: 0, 
                                                  display: 'flex', 
                                                  justifyContent: 'center',
                                                  alignItems: 'center',
                                                  gap: '4px',
                                                  background: 'rgba(0,0,0,0.4)',
                                                  opacity: 0,
                                                  transition: 'opacity 0.2s'
                                                }}
                                                className="photo-hover-controls"
                                                >
                                                  <button
                                                    onClick={async (e) => {
                                                      e.stopPropagation();
                                                      const photoId = photo.id;
                                                      
                                                      // Optimistický update
                                                      setDataSets(prev => prev.map(d => {
                                                        if (d.id !== ds.id) return d;
                                                        const updatedPhotos = d.media.generatedPhotos.map((p: any) => 
                                                          p.id === photoId ? { ...p, excluded: !p.excluded } : p
                                                        );
                                                        return { ...d, media: { ...d.media, generatedPhotos: updatedPhotos } };
                                                      }));
                                                      
                                                      // Uložit do DB
                                                      const { data: currentDs } = await supabase
                                                        .from('topic_data_sets')
                                                        .select('media')
                                                        .eq('id', ds.id)
                                                        .single();
                                                      
                                                      const currentMedia = currentDs?.media || ds.media;
                                                      const updatedPhotos = (currentMedia.generatedPhotos || []).map((p: any) => 
                                                        p.id === photoId ? { ...p, excluded: !p.excluded } : p
                                                      );
                                                      
                                                      await supabase
                                                        .from('topic_data_sets')
                                                        .update({ media: { ...currentMedia, generatedPhotos: updatedPhotos } })
                                                        .eq('id', ds.id);
                                                    }}
                                                    title={photo.excluded ? "Použít fotku" : "Vyřadit z výběru"}
                                                    style={{ 
                                                      width: '24px', 
                                                      height: '24px', 
                                                      borderRadius: '4px', 
                                                      border: 'none', 
                                                      background: photo.excluded ? '#10b981' : '#ef4444', 
                                                      color: 'white',
                                                      cursor: 'pointer',
                                                      display: 'flex',
                                                      alignItems: 'center',
                                                      justifyContent: 'center'
                                                    }}
                                                  >
                                                    {photo.excluded ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                                                  </button>
                                                  
                                                  <button
                                                    onClick={async (e) => {
                                                      e.stopPropagation();
                                                      const photoId = photo.id;
                                                      const prompt = ds.media.photoPrompts.find((p: any) => p.id === photoId);
                                                      if (!prompt) return;
                                                      
                                                      try {
                                                        const { generatePhoto } = await import('../../utils/dataset/material-generators');
                                                        addProgressMessage(`🔄 Přegenerovávám: ${prompt.name}...`);
                                                        
                                                        const imageUrl = await generatePhoto(prompt, ds);
                                                        
                                                        if (imageUrl) {
                                                          const newPhoto = { ...photo, url: imageUrl, excluded: false };
                                                          await supabase.rpc('add_photo_to_dataset', {
                                                            p_dataset_id: ds.id,
                                                            p_prompt_id: photoId,
                                                            p_photo: newPhoto
                                                          });
                                                          await loadDataSets(); // Refresh
                                                          toast.success('Fotka přegenerována');
                                                        }
                                                      } catch (err: any) {
                                                        toast.error('Přegenerování selhalo');
                                                      }
                                                    }}
                                                    title="Přegenerovat"
                                                    style={{ 
                                                      width: '24px', 
                                                      height: '24px', 
                                                      borderRadius: '4px', 
                                                      border: 'none', 
                                                      background: '#f59e0b', 
                                                      color: 'white',
                                                      cursor: 'pointer',
                                                      display: 'flex',
                                                      alignItems: 'center',
                                                      justifyContent: 'center'
                                                    }}
                                                  >
                                                    <RotateCcw className="w-3 h-3" />
                                                  </button>
                                                  
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      window.open(photo.url, '_blank');
                                                    }}
                                                    title="Zobrazit originál"
                                                    style={{ 
                                                      width: '24px', 
                                                      height: '24px', 
                                                      borderRadius: '4px', 
                                                      border: 'none', 
                                                      background: '#3b82f6', 
                                                      color: 'white',
                                                      cursor: 'pointer',
                                                      display: 'flex',
                                                      alignItems: 'center',
                                                      justifyContent: 'center'
                                                    }}
                                                  >
                                                    <Eye className="w-3 h-3" />
                                                  </button>
                                                </div>
                                                <style>{`
                                                  .photo-hover-controls:hover { opacity: 1 !important; }
                                                `}</style>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    
                                    {/* Fakta */}
                                    {ds.content?.facts?.length > 0 && (
                                      <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                                        <div className="text-xs font-semibold text-purple-700 mb-2">💡 Fakta ({ds.content.facts.length})</div>
                                        <ul className="text-xs text-slate-600 space-y-1">
                                          {ds.content.facts.slice(0, 3).map((fact: string, idx: number) => (
                                            <li key={idx}>• {fact.length > 100 ? fact.substring(0, 100) + '...' : fact}</li>
                                          ))}
                                          {ds.content.facts.length > 3 && (
                                            <li className="text-purple-500">+{ds.content.facts.length - 3} dalších faktů</li>
                                          )}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* Quick generate buttons */}
                                  <div className="flex flex-wrap gap-2 mb-4">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        generateFromSingleDataSet(ds, ['text']);
                                      }}
                                      disabled={isGenerating}
                                      style={{ backgroundColor: '#10b981', color: 'white', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', border: 'none' }}
                                    >
                                      📖 Text
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        generateFromSingleDataSet(ds, ['board-easy', 'board-hard']);
                                      }}
                                      disabled={isGenerating}
                                      style={{ backgroundColor: '#6366f1', color: 'white', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', border: 'none' }}
                                    >
                                      🎯 Procvičování
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        generateFromSingleDataSet(ds, ['worksheet']);
                                      }}
                                      disabled={isGenerating}
                                      style={{ backgroundColor: '#f59e0b', color: 'white', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', border: 'none' }}
                                    >
                                      📝 Pracovní list
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        generateFromSingleDataSet(ds, ['test']);
                                      }}
                                      disabled={isGenerating}
                                      style={{ backgroundColor: '#ef4444', color: 'white', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', border: 'none' }}
                                    >
                                      📋 Písemka
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        generateFromSingleDataSet(ds, ['lesson']);
                                      }}
                                      disabled={isGenerating}
                                      style={{ backgroundColor: '#a855f7', color: 'white', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', border: 'none' }}
                                    >
                                      🎓 Lekce (1)
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        generateFromSingleDataSet(ds, ['lessons']);
                                      }}
                                      disabled={isGenerating}
                                      style={{ backgroundColor: '#7c3aed', color: 'white', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', border: 'none' }}
                                      title="Vygeneruje 2-3 lekce na různá podtémata"
                                    >
                                      🎓 Lekce (sada)
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        generateFromSingleDataSet(ds, ['methodology']);
                                      }}
                                      disabled={isGenerating}
                                      style={{ backgroundColor: '#475569', color: 'white', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', border: 'none' }}
                                    >
                                      📚 Metodika
                                    </button>
                                  </div>
                                  
                                  {/* Generate all + Save buttons */}
                                  <div className="flex gap-2 mb-4">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        generateFromSingleDataSet(ds, ['text', 'board-easy', 'board-hard', 'worksheet', 'test', 'lessons', 'methodology']);
                                      }}
                                      disabled={isGenerating}
                                      style={{ backgroundColor: '#f97316', color: 'white', padding: '12px 16px', borderRadius: '8px', fontWeight: 600, border: 'none', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                    >
                                      {isGenerating ? (
                                        <>
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                          Generuji...
                                        </>
                                      ) : (
                                        <>✨ Vygenerovat vše</>
                                      )}
                                    </button>
                                    
                                    {materialsCount > 0 && (
                                      <>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            saveDataSetToLibrary(ds);
                                          }}
                                          disabled={savingDataSetId === ds.id}
                                          title={ds.status === 'published' ? 'Klikni pro uložení znovu do knihovny' : 'Uloží materiály do admin knihovny'}
                                          style={{ 
                                            backgroundColor: ds.status === 'published' ? '#22c55e' : '#2563eb', 
                                            color: 'white', 
                                            padding: '12px 16px', 
                                            borderRadius: '8px', 
                                            fontWeight: 600, 
                                            border: 'none',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            cursor: savingDataSetId === ds.id ? 'wait' : 'pointer'
                                          }}
                                        >
                                          {savingDataSetId === ds.id ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                          ) : ds.status === 'published' ? (
                                            <>✅ Uloženo</>
                                          ) : (
                                            <>💾 Uložit</>
                                          )}
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            deleteDataSetMaterials(ds);
                                          }}
                                          disabled={isGenerating}
                                          style={{ 
                                            backgroundColor: '#dc2626', 
                                            color: 'white', 
                                            padding: '12px 16px', 
                                            borderRadius: '8px', 
                                            fontWeight: 600, 
                                            border: 'none',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px'
                                          }}
                                        >
                                          🗑️ Smazat materiály
                                        </button>
                                      </>
                                    )}
                                    
                                    {/* Tlačítko pro smazání celého DataSetu */}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteDataSet(ds);
                                      }}
                                      disabled={isGenerating}
                                      style={{ 
                                        backgroundColor: '#7f1d1d', 
                                        color: 'white', 
                                        padding: '12px 16px', 
                                        borderRadius: '8px', 
                                        fontWeight: 600, 
                                        border: 'none',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                      }}
                                    >
                                      ☠️ Smazat DataSet
                                    </button>
                                  </div>
                                  
                                  {/* Generated materials */}
                                  {materialsCount > 0 && (
                                    <div className="mb-4 p-3 bg-white rounded-lg border border-amber-200">
                                      <div className="text-xs font-medium text-slate-600 mb-2">Vygenerované materiály:</div>
                                      <div className="space-y-1">
                                        {(ds.generated_materials || []).map((mat: any, i: number) => (
                                          <div key={i} className="flex items-center justify-between text-xs">
                                            <span className="text-slate-700">
                                              {mat.type === 'text' && '📖 Učební text'}
                                              {mat.type === 'board-easy' && '🎯 Procvičování (úroveň 1)'}
                                              {mat.type === 'board-hard' && '🎯 Procvičování (úroveň 2)'}
                                              {mat.type === 'worksheet' && '📝 Pracovní list'}
                                              {mat.type === 'test' && '📋 Písemka'}
                                              {mat.type === 'lesson' && '🎓 Interaktivní lekce'}
                                              {mat.type === 'lessons' && '🎓 Badatelské lekce (sada)'}
                                              {mat.type === 'methodology' && '📚 Metodická inspirace'}
                                            </span>
                                            <div className="flex items-center gap-2">
                                              <a
                                                href={
                                                  mat.type === 'text' || mat.type === 'methodology'
                                                    ? `/library/my-content/view/${mat.id}`
                                                    : mat.type === 'worksheet'
                                                    ? `/library/my-content/worksheet-editor/${mat.id}`
                                                    : `/quiz/view/${mat.id}`
                                                }
                                                target="_blank"
                                                onClick={(e) => e.stopPropagation()}
                                                className="text-indigo-600 hover:text-indigo-800"
                                              >
                                                Otevřít →
                                              </a>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Feedback Chatbot */}
                                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                                    <div className="text-xs font-medium text-slate-600 mb-2 flex items-center gap-2">
                                      <Bot className="w-3 h-3" />
                                      Feedback pro přegenerování
                                    </div>
                                    <div className="flex gap-2">
                                      <input
                                        type="text"
                                        value={dataSetFeedback[`${ds.id}-all`] || ''}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          setDataSetFeedback(prev => ({
                                            ...prev,
                                            [`${ds.id}-all`]: e.target.value
                                          }));
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        placeholder="Napiš feedback..."
                                        className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                      />
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          regenerateWithFeedback(ds, 'all');
                                        }}
                                        disabled={!dataSetFeedback[`${ds.id}-all`]?.trim() || isGenerating}
                                        className="px-3 py-2 bg-slate-200 text-slate-700 text-xs rounded-lg hover:bg-slate-300 disabled:opacity-50"
                                      >
                                        🔄 Přegenerovat
                                      </button>
                                    </div>
                                    
                                    {/* Předchozí feedbacky */}
                                    {ds.feedback && Object.keys(ds.feedback).length > 0 && (
                                      <div className="mt-2 pt-2 border-t border-slate-200">
                                        <div className="text-xs text-slate-500">Předchozí:</div>
                                        <div className="space-y-1 mt-1">
                                          {Object.entries(ds.feedback).flatMap(([type, entries]: [string, any]) =>
                                            (entries || []).slice(-2).map((entry: any, i: number) => (
                                              <div key={`${type}-${i}`} className="text-xs text-slate-600 bg-white px-2 py-1 rounded">
                                                <span className="font-medium">{type}:</span> {entry.text}
                                              </div>
                                            ))
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* DataSet link */}
                                  <div className="mt-4 pt-4 border-t border-amber-200 text-center">
                                    <a
                                      href={`/admin/dataset-creator?id=${ds.id}`}
                                      onClick={(e) => e.stopPropagation()}
                                      className="text-xs text-slate-500 hover:text-amber-600"
                                    >
                                      Otevřít v DataSet Creator →
                                    </a>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
                
              </div>
            </div>
          </div>
        </div>
      </main>
      
      {/* RVP Selection Confirmation Modal */}
      {showRvpSelectionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">
                  📦 Potvrzení generování DataSetů
                </h2>
                <button
                  onClick={() => setShowRvpSelectionModal(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[50vh]">
              <div className="mb-4">
                <div className="text-sm text-slate-600 mb-2">
                  Budou vytvořeny DataSety a materiály pro následující RVP témata:
                </div>
                <div className="text-2xl font-bold text-amber-600">
                  {selectedRvpIds.size} témat
                </div>
              </div>
              
              <div className="space-y-2">
                {rvpData
                  .filter(r => selectedRvpIds.has(r.id))
                  .map(rvp => (
                    <div 
                      key={rvp.id}
                      className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200"
                    >
                      <div className="w-8 h-8 bg-amber-200 rounded-lg flex items-center justify-center">
                        <span className="font-bold text-amber-700 text-sm">📚</span>
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-slate-900 text-sm">{rvp.topic}</div>
                        <div className="text-xs text-slate-500">{rvp.recommendedHours} hodin • {rvp.expectedOutcomes.length} výstupů</div>
                      </div>
                      <button
                        onClick={() => toggleRvpSelection(rvp.id)}
                        className="p-1 hover:bg-amber-200 rounded"
                      >
                        <X className="w-4 h-4 text-amber-600" />
                      </button>
                    </div>
                  ))
                }
              </div>
              
              {selectedRvpIds.size === 0 && (
                <div className="text-center py-8 text-slate-500">
                  Nevybrali jste žádná RVP témata
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-slate-200 bg-slate-50">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-slate-600">
                  <span className="font-medium">Typy materiálů:</span> Text, Procvičování (2×), Pracovní list, Písemka, Lekce E-U-R, Metodika
                </div>
                <div className="text-sm text-slate-500">
                  Celkem: ~{selectedRvpIds.size * 7} materiálů
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowRvpSelectionModal(false)}
                  className="flex-1 px-4 py-3 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                >
                  Zpět k výběru
                </button>
                <button
                  onClick={async () => {
                    setShowRvpSelectionModal(false);
                    // Spustit generování jen pro vybraná RVP témata
                    const selectedRvpTopics = rvpData.filter(r => selectedRvpIds.has(r.id));
                    
                    addProgressMessage(`🚀 Spouštím generování pro ${selectedRvpTopics.length} RVP témat...`);
                    setIsRunning(true);
                    
                    try {
                      const { runDataSetPipeline } = await import('../../utils/curriculum/agents');
                      
                      await runDataSetPipeline(
                        selectedSubject as SubjectCode,
                        selectedGrade as Grade,
                        weeklyPlans, // Všechny plány (pro hodinovou dotaci)
                        selectedRvpTopics, // Jen vybraná RVP témata
                        ['text', 'board-easy', 'board-hard', 'worksheet', 'test', 'lesson', 'methodology'],
                        addProgressMessage,
                        demoMode
                      );
                      
                      addProgressMessage('✅ Generování dokončeno!');
                      toast.success('Materiály úspěšně vygenerovány');
                      await loadDataSets();
                      await loadStatistics();
                      setActiveTab('datasets');
                    } catch (err: any) {
                      console.error('Pipeline error:', err);
                      addProgressMessage(`❌ Chyba: ${err.message}`);
                      toast.error('Generování selhalo');
                    } finally {
                      setIsRunning(false);
                    }
                  }}
                  disabled={selectedRvpIds.size === 0}
                  style={{ backgroundColor: '#f59e0b' }}
                  className="flex-1 px-4 py-3 text-white rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  🚀 Spustit generování ({selectedRvpIds.size} témat)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CurriculumFactory;
