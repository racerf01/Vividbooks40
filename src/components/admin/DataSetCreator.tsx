import React, { useState, useEffect } from 'react';
import { ArrowLeft, Database, Loader2, Image, BookOpen, FileText, ClipboardCheck, GraduationCap, Sparkles, Check, Trash2, Eye, Plus, Send, MessageSquare, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../utils/supabase/client';
import { toast } from 'sonner';
import { TopicDataSet, ValidatedImage } from '../../types/topic-dataset';
import { collectTopicData } from '../../utils/dataset/data-collector';

// Mapování předmětů
const SUBJECTS = [
  { code: 'dejepis', label: 'Dějepis', icon: '🏛️', color: '#8B4513' },
  { code: 'zemepis', label: 'Zeměpis', icon: '🌍', color: '#22c55e' },
  { code: 'anglictina', label: 'Angličtina', icon: '🇬🇧', color: '#3b82f6' },
  { code: 'cestina', label: 'Český jazyk', icon: '📚', color: '#ef4444' },
];

const GRADES = [6, 7, 8, 9];

export function DataSetCreator() {
  const navigate = useNavigate();
  
  // Stav
  const [dataSets, setDataSets] = useState<TopicDataSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  
  // Formulář pro nový Data Set
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    topic: '',
    subjectCode: 'dejepis',
    grade: 6,
  });
  
  // Vybraný Data Set pro detail
  const [selectedDataSet, setSelectedDataSet] = useState<TopicDataSet | null>(null);
  
  // Progress při vytváření
  const [progress, setProgress] = useState<string[]>([]);
  
  // Načíst existující Data Sety
  useEffect(() => {
    loadDataSets();
  }, []);
  
  const loadDataSets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('topic_data_sets')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const mapped = (data || []).map(mapDbToDataSet);
      setDataSets(mapped);
    } catch (err) {
      console.error('Error loading data sets:', err);
      toast.error('Chyba při načítání');
    } finally {
      setLoading(false);
    }
  };
  
  const mapDbToDataSet = (row: any): TopicDataSet => ({
    id: row.id,
    topic: row.topic,
    subjectCode: row.subject_code,
    grade: row.grade,
    status: row.status,
    rvp: row.rvp || {},
    targetGroup: row.target_group || {},
    content: row.content || {},
    media: row.media || { images: [], emojis: [], themeColors: [] },
    generatedMaterials: row.generated_materials || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
  
  const handleCreateDataSet = async () => {
    if (!formData.topic.trim()) {
      toast.error('Zadej téma');
      return;
    }
    
    setCreating(true);
    setProgress([]);
    
    const addProgress = (msg: string) => {
      setProgress(prev => [...prev, msg]);
    };
    
    try {
      addProgress('🚀 Startuji sběr dat...');
      
      const dataSet = await collectTopicData(
        formData.topic,
        formData.subjectCode,
        formData.grade,
        addProgress
      );
      
      addProgress('💾 Ukládám do databáze...');
      
      const { data: user } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('topic_data_sets')
        .insert({
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
      
      if (error) throw error;
      
      addProgress('✅ Data Set vytvořen!');
      
      toast.success('Data Set vytvořen!');
      setShowForm(false);
      setFormData({ topic: '', subjectCode: 'dejepis', grade: 6 });
      
      await loadDataSets();
      setSelectedDataSet(mapDbToDataSet(data));
      
    } catch (err) {
      console.error('Error creating data set:', err);
      addProgress(`❌ Chyba: ${err}`);
      toast.error('Chyba při vytváření Data Setu');
    } finally {
      setCreating(false);
    }
  };
  
  const handleDeleteDataSet = async (id: string) => {
    if (!confirm('Opravdu smazat tento Data Set?')) return;
    
    try {
      const { error } = await supabase
        .from('topic_data_sets')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      toast.success('Smazáno');
      if (selectedDataSet?.id === id) {
        setSelectedDataSet(null);
      }
      await loadDataSets();
    } catch (err) {
      toast.error('Chyba při mazání');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/admin')}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(to bottom right, #f59e0b, #ea580c)' }}
              >
                <Database className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Data Set Creator</h1>
                <p className="text-sm text-slate-500">Shromáždi data, pak generuj materiály</p>
              </div>
            </div>
          </div>
          
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 text-white rounded-xl hover:opacity-90 transition-opacity font-medium shadow-lg"
            style={{ background: 'linear-gradient(to right, #f59e0b, #ea580c)' }}
          >
            <Plus className="w-4 h-4" />
            Nový Data Set
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-12 gap-6">
          {/* Seznam Data Setů */}
          <div className="col-span-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-200 bg-slate-50">
                <h2 className="text-lg font-semibold text-slate-900">Data Sety ({dataSets.length})</h2>
              </div>
              
              {loading ? (
                <div className="p-8 flex justify-center">
                  <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
                </div>
              ) : dataSets.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <Database className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">Zatím žádné Data Sety</p>
                  <p className="text-sm mt-1">Vytvoř první pomocí tlačítka nahoře</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {dataSets.map(ds => {
                    const subject = SUBJECTS.find(s => s.code === ds.subjectCode);
                    const isSelected = selectedDataSet?.id === ds.id;
                    
                    return (
                      <div
                        key={ds.id}
                        onClick={() => setSelectedDataSet(ds)}
                        className={`p-4 cursor-pointer transition-colors ${
                          isSelected ? 'bg-amber-50 border-l-4 border-amber-500' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{subject?.icon || '📚'}</span>
                            <div>
                              <h3 className="font-medium text-slate-900">{ds.topic}</h3>
                              <p className="text-sm text-slate-500">
                                {subject?.label} • {ds.grade}. třída
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              ds.status === 'ready' 
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}>
                              {ds.status === 'ready' ? '✓ Připraven' : 'Draft'}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteDataSet(ds.id);
                              }}
                              className="p-1.5 hover:bg-red-100 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
                          <span className="flex items-center gap-1">
                            <Image className="w-3 h-3" />
                            {ds.media?.images?.length || 0} obr.
                          </span>
                          <span className="flex items-center gap-1">
                            <BookOpen className="w-3 h-3" />
                            {ds.content?.keyTerms?.length || 0} pojmů
                          </span>
                          <span className="flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            {ds.generatedMaterials?.length || 0} mat.
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          
          {/* Detail Data Setu / Formulář */}
          <div className="col-span-8">
            {showForm ? (
              <FormPanel
                formData={formData}
                setFormData={setFormData}
                creating={creating}
                progress={progress}
                onCancel={() => setShowForm(false)}
                onCreate={handleCreateDataSet}
              />
            ) : selectedDataSet ? (
              <DataSetDetail
                dataSet={selectedDataSet}
                onRefresh={loadDataSets}
              />
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
                <Database className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                <h3 className="text-xl font-semibold text-slate-900 mb-2">Vyber Data Set</h3>
                <p className="text-slate-500 mb-6">
                  Klikni na Data Set vlevo nebo vytvoř nový
                </p>
                <button
                  onClick={() => setShowForm(true)}
                  className="px-6 py-3 text-white rounded-xl hover:opacity-90 transition-opacity font-medium shadow-lg"
                  style={{ background: 'linear-gradient(to right, #f59e0b, #ea580c)' }}
                >
                  <Plus className="w-4 h-4 inline mr-2" />
                  Vytvořit Data Set
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// FORMULÁŘ PRO NOVÝ DATA SET
// =====================================================

interface FormPanelProps {
  formData: { topic: string; subjectCode: string; grade: number };
  setFormData: React.Dispatch<React.SetStateAction<{ topic: string; subjectCode: string; grade: number }>>;
  creating: boolean;
  progress: string[];
  onCancel: () => void;
  onCreate: () => void;
}

function FormPanel({ formData, setFormData, creating, progress, onCancel, onCreate }: FormPanelProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-amber-50 to-orange-50">
        <h2 className="text-xl font-semibold text-slate-900">Nový Data Set</h2>
        <p className="text-slate-600 text-sm mt-1">
          Zadej téma a systém automaticky shromáždí všechna potřebná data
        </p>
      </div>
      
      <div className="p-6 space-y-6">
        {/* Téma */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Téma <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.topic}
            onChange={(e) => setFormData(prev => ({ ...prev, topic: e.target.value }))}
            placeholder="např. Starověký Egypt, Druhá světová válka..."
            className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            disabled={creating}
          />
        </div>
        
        {/* Předmět */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Předmět
          </label>
          <div className="grid grid-cols-2 gap-3">
            {SUBJECTS.map(subject => (
              <button
                key={subject.code}
                onClick={() => setFormData(prev => ({ ...prev, subjectCode: subject.code }))}
                disabled={creating}
                className={`p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${
                  formData.subjectCode === subject.code
                    ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-200'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span className="text-2xl">{subject.icon}</span>
                <span className="text-slate-900 font-medium">{subject.label}</span>
              </button>
            ))}
          </div>
        </div>
        
        {/* Ročník */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Ročník
          </label>
          <div className="flex gap-3">
            {GRADES.map(grade => (
              <button
                key={grade}
                onClick={() => setFormData(prev => ({ ...prev, grade }))}
                disabled={creating}
                className={`flex-1 py-3 rounded-xl border-2 transition-all font-medium ${
                  formData.grade === grade
                    ? 'bg-amber-50 border-amber-500 text-amber-700 ring-2 ring-amber-200'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {grade}. třída
              </button>
            ))}
          </div>
        </div>
        
        {/* Progress */}
        {creating && progress.length > 0 && (
          <div className="bg-slate-900 rounded-xl p-4 max-h-48 overflow-y-auto">
            {progress.map((msg, i) => (
              <div key={i} className="text-sm text-emerald-400 py-0.5 font-mono">
                {msg}
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="p-6 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
        <button
          onClick={onCancel}
          disabled={creating}
          className="px-6 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-medium"
        >
          Zrušit
        </button>
        <button
          onClick={onCreate}
          disabled={creating || !formData.topic.trim()}
          className="px-6 py-2.5 text-white rounded-xl hover:opacity-90 transition-opacity font-medium flex items-center gap-2 disabled:opacity-50 shadow-lg"
          style={{ background: 'linear-gradient(to right, #f59e0b, #ea580c)' }}
        >
          {creating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Sbírám data...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Vytvořit Data Set
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// =====================================================
// DETAIL DATA SETU
// =====================================================

interface DataSetDetailProps {
  dataSet: TopicDataSet;
  onRefresh: () => void;
}

function DataSetDetail({ dataSet, onRefresh }: DataSetDetailProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'content' | 'media' | 'generate'>('overview');
  
  const subject = SUBJECTS.find(s => s.code === dataSet.subjectCode);
  
  const tabs = [
    { id: 'overview', label: 'Přehled', icon: Eye },
    { id: 'content', label: 'Obsah', icon: BookOpen },
    { id: 'media', label: 'Média', icon: Image },
    { id: 'generate', label: 'Generovat', icon: Sparkles },
  ] as const;
  
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-amber-50 to-orange-50">
        <div className="flex items-center gap-4">
          <span className="text-4xl">{subject?.icon || '📚'}</span>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{dataSet.topic}</h2>
            <p className="text-slate-600">
              {subject?.label} • {dataSet.grade}. třída • {dataSet.rvp?.hoursAllocated || '?'} hodin
            </p>
          </div>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-slate-50">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-amber-600 border-b-2 border-amber-500 bg-white'
                : 'text-slate-500 hover:text-slate-700 hover:bg-white'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>
      
      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'overview' && <OverviewTab dataSet={dataSet} />}
        {activeTab === 'content' && <ContentTab dataSet={dataSet} />}
        {activeTab === 'media' && <MediaTab dataSet={dataSet} onRefresh={onRefresh} />}
        {activeTab === 'generate' && <GenerateTab dataSet={dataSet} onRefresh={onRefresh} />}
      </div>
    </div>
  );
}

// =====================================================
// TAB: PŘEHLED - DŮKLADNÉ RVP PROPOJENÍ
// =====================================================

function OverviewTab({ dataSet }: { dataSet: TopicDataSet }) {
  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={BookOpen} label="Pojmů" value={dataSet.content?.keyTerms?.length || 0} color="text-blue-500" bgColor="bg-blue-50" />
        <StatCard icon={Image} label="Obrázků" value={dataSet.media?.images?.length || 0} color="text-purple-500" bgColor="bg-purple-50" />
        <StatCard icon={FileText} label="Faktů" value={dataSet.content?.keyFacts?.length || 0} color="text-emerald-500" bgColor="bg-emerald-50" />
        <StatCard icon={ClipboardCheck} label="Materiálů" value={dataSet.generatedMaterials?.length || 0} color="text-amber-500" bgColor="bg-amber-50" />
      </div>

      {/* RVP SEKCE - DŮKLADNÉ ZOBRAZENÍ */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-200">
        <h3 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
          <GraduationCap className="w-5 h-5" />
          📋 RVP - Rámcový vzdělávací program
        </h3>
        
        <div className="grid grid-cols-2 gap-6">
          {/* Levý sloupec */}
          <div className="space-y-4">
            <div className="bg-white rounded-lg p-4 border border-blue-100">
              <h4 className="text-sm font-semibold text-blue-800 mb-2">🎯 Tematický okruh</h4>
              <p className="text-slate-900 font-medium text-lg">{dataSet.rvp?.thematicArea || '—'}</p>
            </div>
            
            <div className="bg-white rounded-lg p-4 border border-blue-100">
              <h4 className="text-sm font-semibold text-blue-800 mb-2">⏱️ Hodinová dotace</h4>
              <p className="text-slate-900 font-medium text-lg">{dataSet.rvp?.hoursAllocated || '—'} vyučovacích hodin</p>
            </div>
            
            {/* Průřezová témata */}
            {dataSet.rvp?.crossCurricular?.length > 0 && (
              <div className="bg-white rounded-lg p-4 border border-blue-100">
                <h4 className="text-sm font-semibold text-blue-800 mb-2">🔗 Průřezová témata</h4>
                <div className="flex flex-wrap gap-2">
                  {dataSet.rvp.crossCurricular.map((item: string, i: number) => (
                    <span key={i} className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* Pravý sloupec - Očekávané výstupy */}
          <div className="bg-white rounded-lg p-4 border border-blue-100">
            <h4 className="text-sm font-semibold text-blue-800 mb-3">✅ Očekávané výstupy žáka (RVP)</h4>
            {dataSet.rvp?.expectedOutcomes?.length > 0 ? (
              <ul className="space-y-2">
                {dataSet.rvp.expectedOutcomes.map((outcome: string, i: number) => (
                  <li key={i} className="text-sm text-slate-700 flex items-start gap-2 p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                    <Check className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <span>{outcome}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-400 italic">Očekávané výstupy nebyly načteny</p>
            )}
          </div>
        </div>
        
        {/* Klíčové kompetence */}
        {dataSet.rvp?.competencies?.length > 0 && (
          <div className="mt-4 bg-white rounded-lg p-4 border border-blue-100">
            <h4 className="text-sm font-semibold text-blue-800 mb-3">🧠 Rozvíjené klíčové kompetence</h4>
            <div className="flex flex-wrap gap-2">
              {dataSet.rvp.competencies.map((comp: string, i: number) => (
                <span key={i} className="px-3 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium flex items-center gap-1">
                  <span>💡</span> {comp}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Cílová skupina */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-5 border border-amber-200">
        <h3 className="text-lg font-bold text-amber-900 mb-4">👥 Cílová skupina</h3>
        
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg p-4 border border-amber-100 text-center">
            <div className="text-3xl mb-2">🎂</div>
            <p className="text-sm text-slate-500">Věk</p>
            <p className="text-lg font-bold text-slate-900">{dataSet.targetGroup?.ageRange || '—'}</p>
          </div>
          
          <div className="bg-white rounded-lg p-4 border border-amber-100 text-center">
            <div className="text-3xl mb-2">🎓</div>
            <p className="text-sm text-slate-500">Úroveň</p>
            <p className="text-lg font-bold text-slate-900">{dataSet.targetGroup?.gradeLevel || `${dataSet.grade}. třída ZŠ`}</p>
          </div>
          
          <div className="bg-white rounded-lg p-4 border border-amber-100 text-center">
            <div className="text-3xl mb-2">🧠</div>
            <p className="text-sm text-slate-500">Kognitivní vývoj</p>
            <p className="text-sm font-medium text-slate-700">{dataSet.targetGroup?.cognitiveLevel || '—'}</p>
          </div>
        </div>
        
        {/* Předchozí znalosti */}
        {dataSet.targetGroup?.priorKnowledge?.length > 0 && (
          <div className="mt-4 bg-white rounded-lg p-4 border border-amber-100">
            <h4 className="text-sm font-semibold text-amber-800 mb-2">📚 Předpokládané předchozí znalosti</h4>
            <div className="flex flex-wrap gap-2">
              {dataSet.targetGroup.priorKnowledge.map((k: string, i: number) => (
                <span key={i} className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm">
                  {k}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Knihovna faktů - Preview */}
      <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl p-5 border border-emerald-200">
        <h3 className="text-lg font-bold text-emerald-900 mb-4">📖 Knihovna faktů (náhled)</h3>
        
        {dataSet.content?.keyFacts?.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {dataSet.content.keyFacts.slice(0, 6).map((fact: string, i: number) => (
              <div key={i} className="bg-white rounded-lg p-3 border border-emerald-100 flex items-start gap-2">
                <span className="text-emerald-500 font-bold">{i + 1}.</span>
                <span className="text-sm text-slate-700">{fact}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-400 italic">Fakta nebyla načtena</p>
        )}
        
        {dataSet.content?.keyFacts?.length > 6 && (
          <p className="text-sm text-emerald-600 mt-3 text-center">
            + dalších {dataSet.content.keyFacts.length - 6} faktů (viz záložka "Obsah")
          </p>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, bgColor }: { icon: any; label: string; value: number; color: string; bgColor: string }) {
  return (
    <div className={`${bgColor} rounded-xl p-4 text-center border border-slate-200`}>
      <Icon className={`w-6 h-6 mx-auto mb-2 ${color}`} />
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-sm text-slate-500">{label}</div>
    </div>
  );
}

// =====================================================
// TAB: OBSAH - KOMPLETNÍ KNIHOVNA FAKTŮ
// =====================================================

function ContentTab({ dataSet }: { dataSet: TopicDataSet }) {
  return (
    <div className="space-y-8">
      {/* KLÍČOVÉ POJMY - SLOVNÍČEK */}
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-5 border border-blue-200">
        <h3 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
          📖 Slovníček pojmů ({dataSet.content?.keyTerms?.length || 0})
        </h3>
        {dataSet.content?.keyTerms?.length > 0 ? (
          <div className="grid grid-cols-1 gap-3">
            {dataSet.content.keyTerms.map((term: any, i: number) => (
              <div key={i} className="bg-white rounded-lg p-4 border border-blue-100 flex items-start gap-4">
                <div className="text-3xl flex-shrink-0">{term.emoji || '📌'}</div>
                <div className="flex-1">
                  <h4 className="font-bold text-slate-900 text-lg">{term.term}</h4>
                  <p className="text-slate-600 mt-1">{term.definition}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-400 italic text-center py-4">Slovníček pojmů nebyl načten</p>
        )}
      </div>
      
      {/* KLÍČOVÁ FAKTA - ČÍSLOVANÝ SEZNAM */}
      <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl p-5 border border-emerald-200">
        <h3 className="text-lg font-bold text-emerald-900 mb-4 flex items-center gap-2">
          📋 Klíčová fakta ({dataSet.content?.keyFacts?.length || 0})
        </h3>
        {dataSet.content?.keyFacts?.length > 0 ? (
          <div className="space-y-2">
            {dataSet.content.keyFacts.map((fact: string, i: number) => (
              <div key={i} className="bg-white rounded-lg p-3 border border-emerald-100 flex items-start gap-3">
                <span className="w-7 h-7 bg-emerald-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {i + 1}
                </span>
                <span className="text-slate-700 pt-0.5">{fact}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-400 italic text-center py-4">Fakta nebyla načtena</p>
        )}
      </div>
      
      {/* ČASOVÁ OSA */}
      {dataSet.content?.timeline?.length > 0 && (
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-5 border border-purple-200">
          <h3 className="text-lg font-bold text-purple-900 mb-4 flex items-center gap-2">
            📅 Časová osa ({dataSet.content.timeline.length} událostí)
          </h3>
          <div className="relative pl-6 border-l-4 border-purple-300 space-y-4">
            {dataSet.content.timeline.map((event: any, i: number) => (
              <div key={i} className="relative">
                <div className="absolute -left-8 w-4 h-4 bg-purple-500 rounded-full border-4 border-purple-100"></div>
                <div className="bg-white rounded-lg p-3 border border-purple-100 ml-2">
                  <div className="font-mono text-sm text-purple-600 font-bold">{event.date}</div>
                  <div className="text-slate-700 mt-1">{event.event}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* OSOBNOSTI */}
      {dataSet.content?.personalities?.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-5 border border-amber-200">
          <h3 className="text-lg font-bold text-amber-900 mb-4 flex items-center gap-2">
            👤 Důležité osobnosti ({dataSet.content.personalities.length})
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {dataSet.content.personalities.map((person: any, i: number) => (
              <div key={i} className="bg-white rounded-lg p-4 border border-amber-100">
                <h4 className="font-bold text-slate-900">{person.name}</h4>
                <p className="text-sm text-amber-600 font-medium">{person.role}</p>
                <p className="text-sm text-slate-600 mt-2">{person.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* ZAJÍMAVOSTI */}
      {dataSet.content?.funFacts?.length > 0 && (
        <div className="bg-gradient-to-r from-yellow-50 to-amber-50 rounded-xl p-5 border border-yellow-200">
          <h3 className="text-lg font-bold text-yellow-800 mb-4 flex items-center gap-2">
            💡 Zajímavosti pro motivaci ({dataSet.content.funFacts.length})
          </h3>
          <div className="grid grid-cols-1 gap-3">
            {dataSet.content.funFacts.map((fact: string, i: number) => (
              <div key={i} className="bg-white rounded-lg p-4 border border-yellow-200 flex items-start gap-3">
                <span className="text-2xl">💡</span>
                <span className="text-slate-700">{fact}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* PROPOJENÍ S DNEŠKEM */}
      {dataSet.content?.modernConnections?.length > 0 && (
        <div className="bg-gradient-to-r from-indigo-50 to-violet-50 rounded-xl p-5 border border-indigo-200">
          <h3 className="text-lg font-bold text-indigo-900 mb-4 flex items-center gap-2">
            🔗 Propojení s dnešní dobou
          </h3>
          <ul className="space-y-2">
            {dataSet.content.modernConnections.map((conn: string, i: number) => (
              <li key={i} className="bg-white rounded-lg p-3 border border-indigo-100 flex items-start gap-2">
                <span className="text-indigo-500">→</span>
                <span className="text-slate-700">{conn}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* ZDROJE */}
      {dataSet.content?.sources?.length > 0 && (
        <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">📚 Doporučené zdroje</h3>
          <ul className="space-y-1">
            {dataSet.content.sources.map((source: string, i: number) => (
              <li key={i} className="text-sm text-slate-600">• {source}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// =====================================================
// TAB: MÉDIA
// =====================================================

function MediaTab({ dataSet, onRefresh }: { dataSet: TopicDataSet; onRefresh: () => void }) {
  return (
    <div className="space-y-6">
      {/* Illustration Prompts Section - MOVED TO TOP */}
      <IllustrationPromptsSection dataSet={dataSet} onRefresh={onRefresh} />

      {/* Emojis */}
      {dataSet.media?.emojis?.length > 0 && (
        <div className="border-t border-slate-200 pt-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">😀 Emoji pro téma</h3>
          <div className="flex gap-3 text-3xl">
            {dataSet.media.emojis.map((emoji: string, i: number) => (
              <span key={i} className="p-2 bg-slate-50 border border-slate-200 rounded-lg">{emoji}</span>
            ))}
          </div>
        </div>
      )}
      
      {/* Images */}
      <div className="border-t border-slate-200 pt-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">
          🖼️ Obrázky z webu ({dataSet.media?.images?.length || 0})
        </h3>
        {dataSet.media?.images?.length > 0 ? (
          <div className="grid grid-cols-3 gap-4">
            {dataSet.media.images.map((img: ValidatedImage, i: number) => (
              <div key={i} className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden group">
                <div className="aspect-video relative">
                  <img
                    src={img.url}
                    alt={img.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-xs text-white px-2 py-1 bg-black/50 rounded">
                      Score: {img.relevanceScore}
                    </span>
                  </div>
                </div>
                <div className="p-3">
                  <p className="text-sm text-slate-900 font-medium line-clamp-1">{img.title}</p>
                  <p className="text-xs text-slate-500 mt-1">{img.source}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-400 text-sm">Žádné obrázky</p>
        )}
      </div>
    </div>
  );
}

// Sekce pro generování promptů ilustrací
function IllustrationPromptsSection({ dataSet, onRefresh }: { dataSet: TopicDataSet; onRefresh: () => void }) {
  const [generating, setGenerating] = useState(false);
  const [generatingImageId, setGeneratingImageId] = useState<string | null>(null);
  const [prompts, setPrompts] = useState<any[]>(dataSet.media?.illustrationPrompts || []);
  const [generatedImages, setGeneratedImages] = useState<Record<string, string>>(
    () => {
      // Načíst již vygenerované obrázky z dataSet
      const images: Record<string, string> = {};
      dataSet.media?.generatedIllustrations?.forEach((img: any) => {
        images[img.promptId] = img.url;
      });
      return images;
    }
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const handleGeneratePrompts = async () => {
    setGenerating(true);
    try {
      const { generateIllustrationPrompts } = await import('../../utils/dataset/material-generators');
      const newPrompts = await generateIllustrationPrompts(dataSet);
      setPrompts(newPrompts);
      
      // Uložit do dataSet
      const updatedDataSet = {
        ...dataSet,
        media: {
          ...dataSet.media,
          illustrationPrompts: newPrompts,
        },
      };
      localStorage.setItem(`topic-dataset-${dataSet.id}`, JSON.stringify(updatedDataSet));
      onRefresh();
    } catch (err) {
      console.error('Failed to generate prompts:', err);
    } finally {
      setGenerating(false);
    }
  };
  
  const handleGenerateImage = async (prompt: any) => {
    setGeneratingImageId(prompt.id);
    try {
      const { generateImageWithImagen } = await import('../../utils/ai-chat-proxy');
      const result = await generateImageWithImagen(prompt.prompt, { 
        aspectRatio: '1:1',
        dataSetId: dataSet.id,
        illustrationName: prompt.name
      });
      
      if (result.success && result.url) {
        const imageUrl = result.url;
        
        // Uložit obrázek do lokálního stavu
        setGeneratedImages(prev => ({ ...prev, [prompt.id]: imageUrl }));
        
        // Aktualizovat dataSet
        const existingIllustrations = dataSet.media?.generatedIllustrations || [];
        const newIllustration = {
          id: crypto.randomUUID(),
          promptId: prompt.id,
          url: imageUrl,
          name: prompt.name,
          generatedAt: new Date().toISOString(),
        };
        
        const updatedDataSet = {
          ...dataSet,
          media: {
            ...dataSet.media,
            generatedIllustrations: [...existingIllustrations.filter((i: any) => i.promptId !== prompt.id), newIllustration],
          },
        };
        
        // DŮLEŽITÉ: Uložit do localStorage a zavolat onRefresh pro aktualizaci celého DataSetu
        localStorage.setItem(`topic-dataset-${dataSet.id}`, JSON.stringify(updatedDataSet));
        
        // Počkat chvíli na uložení a pak refreshnout
        setTimeout(() => {
          onRefresh();
        }, 100);
      } else {
        alert(`Chyba: ${result.error || 'Generování selhalo'}`);
      }
    } catch (err: any) {
      console.error('Failed to generate image:', err);
      alert(`Chyba: ${err.message}`);
    } finally {
      setGeneratingImageId(null);
    }
  };
  
  const handleGenerateAllImages = async () => {
    for (const prompt of prompts) {
      if (!generatedImages[prompt.id]) {
        await handleGenerateImage(prompt);
        // Malá pauza mezi požadavky
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  };
  
  const copyPrompt = (prompt: any) => {
    navigator.clipboard.writeText(prompt.prompt);
    setCopiedId(prompt.id);
    setTimeout(() => setCopiedId(null), 2000);
  };
  
  const categoryIcons: Record<string, string> = {
    icon: '🔷',
    portrait: '👤',
    object: '🏺',
    scene: '🎭',
    map: '🗺️',
  };
  
  const categoryColors: Record<string, string> = {
    icon: '#3b82f6',
    portrait: '#8b5cf6',
    object: '#f59e0b',
    scene: '#10b981',
    map: '#6366f1',
  };
  
  const generatedCount = Object.keys(generatedImages).length;
  
  return (
    <div className="border-t border-slate-200 pt-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-700">
          🎨 Ilustrace ({generatedCount}/{prompts.length})
        </h3>
        <div className="flex gap-2">
          {prompts.length > 0 && generatedCount < prompts.length && (
            <button
              onClick={handleGenerateAllImages}
              disabled={generatingImageId !== null}
              className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-all"
              style={{ backgroundColor: generatingImageId ? '#94a3b8' : '#10b981' }}
            >
              {generatingImageId ? '⏳ Generuji...' : `🖼️ Generovat všechny (${prompts.length - generatedCount})`}
            </button>
          )}
          <button
            onClick={handleGeneratePrompts}
            disabled={generating}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-all"
            style={{ backgroundColor: generating ? '#94a3b8' : '#8b5cf6' }}
          >
            {generating ? '⏳ Generuji...' : '✨ Vygenerovat prompty'}
          </button>
        </div>
      </div>
      
      <p className="text-xs text-slate-500 mb-4">
        Ilustrace ve stylu Ligne Claire (čistá linka, ploché barvy, edukativní styl).
        Klikněte na "Generovat" u jednotlivých položek nebo "Generovat všechny".
      </p>
      
      {prompts.length > 0 ? (
        <div className="grid grid-cols-3 gap-4">
          {prompts.map((prompt) => (
            <div
              key={prompt.id}
              className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 transition-colors"
            >
              {/* Obrázek nebo placeholder */}
              <div className="aspect-square relative bg-slate-100">
                {generatedImages[prompt.id] ? (
                  <img 
                    src={generatedImages[prompt.id]} 
                    alt={prompt.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    {generatingImageId === prompt.id ? (
                      <div className="text-center">
                        <span className="text-4xl animate-pulse">🎨</span>
                        <p className="text-xs text-slate-500 mt-2">Generuji...</p>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleGenerateImage(prompt)}
                        className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm hover:bg-slate-50 transition-colors"
                      >
                        🖼️ Generovat
                      </button>
                    )}
                  </div>
                )}
                
                {/* Kategorie badge */}
                <span
                  className="absolute top-2 left-2 text-xs px-2 py-0.5 rounded-full text-white font-medium"
                  style={{ backgroundColor: categoryColors[prompt.category] || '#64748b' }}
                >
                  {categoryIcons[prompt.category] || '📷'} {prompt.category}
                </span>
              </div>
              
              <div className="p-3">
                <h4 className="font-medium text-slate-900 text-sm mb-1 line-clamp-1">{prompt.name}</h4>
                
                <div className="flex gap-1 mt-2">
                  <button
                    onClick={() => copyPrompt(prompt)}
                    className="flex-1 text-xs px-2 py-1 rounded bg-white border border-slate-200 hover:bg-slate-100 transition-colors"
                  >
                    {copiedId === prompt.id ? '✅' : '📋'} Prompt
                  </button>
                  {generatedImages[prompt.id] && (
                    <button
                      onClick={() => handleGenerateImage(prompt)}
                      disabled={generatingImageId === prompt.id}
                      className="flex-1 text-xs px-2 py-1 rounded bg-white border border-slate-200 hover:bg-slate-100 transition-colors"
                    >
                      🔄 Znovu
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
          <span className="text-4xl mb-2 block">🎨</span>
          <p className="text-slate-500 text-sm">
            Zatím žádné prompty. Klikněte na "Vygenerovat prompty" pro vytvoření návrhů ilustrací.
          </p>
        </div>
      )}
    </div>
  );
}

// =====================================================
// TAB: GENEROVAT
// =====================================================

function GenerateTab({ dataSet, onRefresh }: { dataSet: TopicDataSet; onRefresh: () => void }) {
  const navigate = useNavigate();
  const [generating, setGenerating] = useState<string | null>(null);
  const [justGenerated, setJustGenerated] = useState<{ type: string; id: string } | null>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({}); // Náhledy pro každý typ
  const [feedbackInputs, setFeedbackInputs] = useState<Record<string, string>>({}); // Feedback inputy
  const [feedbackHistory, setFeedbackHistory] = useState<Record<string, string[]>>(() => {
    // Načíst uložený feedback z localStorage
    const saved = localStorage.getItem('generator_feedback');
    return saved ? JSON.parse(saved) : {};
  });
  const [showContext, setShowContext] = useState(true); // Zobrazit podklady
  
  const generators = [
    { id: 'methodology', title: 'Metodická inspirace', description: 'Přehled pro učitele', icon: '👩‍🏫' },
    { id: 'text', title: 'Učební text', description: 'Výkladový text pro žáky', icon: '📖' },
    { id: 'board-easy', title: 'Procvičování (lehké)', description: 'Jednodušší kvíz', icon: '🎮' },
    { id: 'board-hard', title: 'Procvičování (těžké)', description: 'Náročnější kvíz', icon: '🎯' },
    { id: 'worksheet', title: 'Pracovní list', description: 'Tisknutelný pracovní list', icon: '📝' },
    { id: 'test', title: 'Písemka', description: 'Test pro ověření', icon: '✏️' },
    { id: 'lesson', title: 'Lekce E-U-R', description: 'Kompletní lekce', icon: '🎓' },
  ];
  
  // Barvy pro generátory - inline styly pro jistotu
  const getButtonColor = (id: string): string => {
    const colors: Record<string, string> = {
      'methodology': '#0ea5e9', // sky-500
      'text': '#3b82f6',        // blue-500
      'board-easy': '#10b981',  // emerald-500
      'board-hard': '#f59e0b',  // amber-500
      'worksheet': '#a855f7',   // purple-500
      'test': '#ef4444',        // red-500
      'lesson': '#6366f1',      // indigo-500
    };
    return colors[id] || '#64748b';
  };
  
  const handleGenerate = async (type: string) => {
    setGenerating(type);
    setJustGenerated(null);
    
    try {
      const { generateFromDataSet } = await import('../../utils/dataset/material-generators');
      const result = await generateFromDataSet(dataSet, type);
      
      if (result.success && result.id) {
        setJustGenerated({ type, id: result.id });
        // Uložit náhled
        if (result.preview) {
          setPreviews(prev => ({ ...prev, [type]: result.preview! }));
        }
        toast.success(`${generators.find(g => g.id === type)?.title} vygenerován!`);
        onRefresh();
      } else {
        throw new Error(result.error || 'Generování selhalo');
      }
    } catch (err) {
      console.error('Generate error:', err);
      toast.error(`Chyba: ${err}`);
    } finally {
      setGenerating(null);
    }
  };
  
  const handleOpenGenerated = (type: string, id: string) => {
    switch (type) {
      case 'text':
      case 'methodology':
        navigate(`/library/my-content/view/${id}`);
        break;
      case 'board-easy':
      case 'board-hard':
      case 'test':
      case 'lesson':
        navigate(`/quiz/view/${id}`);
        break;
      case 'worksheet':
        navigate(`/library/my-content/worksheet-editor/${id}`);
        break;
    }
  };
  
  const existingMaterials = dataSet.generatedMaterials || [];
  
  // Uložit feedback do localStorage
  const saveFeedback = (type: string, feedback: string) => {
    const newHistory = {
      ...feedbackHistory,
      [type]: [...(feedbackHistory[type] || []), feedback],
    };
    setFeedbackHistory(newHistory);
    localStorage.setItem('generator_feedback', JSON.stringify(newHistory));
    setFeedbackInputs(prev => ({ ...prev, [type]: '' }));
    toast.success('Feedback uložen! Bude použit při dalším generování.');
  };
  
  // Vytvořit textový kontext z DataSetu
  const buildContextText = () => {
    const parts: string[] = [];
    
    parts.push(`📌 TÉMA: ${dataSet.topic}`);
    parts.push(`🎓 ROČNÍK: ${dataSet.grade}. třída`);
    parts.push(`📚 PŘEDMĚT: ${dataSet.subjectCode}`);
    
    if (dataSet.rvp?.expectedOutcomes?.length > 0) {
      parts.push(`\n🎯 OČEKÁVANÉ VÝSTUPY RVP:\n${dataSet.rvp.expectedOutcomes.map(o => `• ${o}`).join('\n')}`);
    }
    
    if (dataSet.content?.keyTerms?.length > 0) {
      parts.push(`\n📖 KLÍČOVÉ POJMY:\n${dataSet.content.keyTerms.map(t => `• ${t.term} — ${t.definition}`).join('\n')}`);
    }
    
    if (dataSet.content?.keyFacts?.length > 0) {
      parts.push(`\n✓ KLÍČOVÁ FAKTA:\n${dataSet.content.keyFacts.map(f => `• ${f}`).join('\n')}`);
    }
    
    if (dataSet.content?.timeline?.length > 0) {
      parts.push(`\n📅 ČASOVÁ OSA:\n${dataSet.content.timeline.map(e => `• ${e.year || e.date}: ${e.event}`).join('\n')}`);
    }
    
    if (dataSet.content?.personalities?.length > 0) {
      parts.push(`\n👤 OSOBNOSTI:\n${dataSet.content.personalities.map(p => `• ${p.name} — ${p.description}`).join('\n')}`);
    }
    
    if (dataSet.media?.images?.length > 0) {
      parts.push(`\n🖼️ DOSTUPNÉ OBRÁZKY (${dataSet.media.images.length}):`);
      dataSet.media.images.forEach((img, i) => {
        parts.push(`  ${i + 1}. "${img.title}" - ${img.keywords?.join(', ') || 'bez klíčových slov'}`);
      });
    }
    
    return parts.join('\n');
  };
  
  return (
    <div className="space-y-4">
      {/* BLOK S PODKLADY */}
      <div className="bg-slate-900 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowContext(!showContext)}
          className="w-full flex items-center justify-between p-4 text-white hover:bg-slate-800 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-amber-400" />
            <span className="font-semibold">📋 Podklady pro generování</span>
          </div>
          <ChevronRight className={`w-5 h-5 transition-transform ${showContext ? 'rotate-90' : ''}`} />
        </button>
        
        {showContext && (
          <div className="p-4 pt-0">
            <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono leading-relaxed bg-slate-800/50 rounded-lg p-4 max-h-64 overflow-y-auto">
              {buildContextText()}
            </pre>
            <p className="text-xs text-slate-500 mt-2">
              ☝️ Tato data jsou použita jako kontext pro AI při generování všech materiálů.
            </p>
          </div>
        )}
      </div>
      
      {/* FEEDBACK HISTORIE */}
      {Object.keys(feedbackHistory).length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-purple-800 font-medium text-sm">🧠 Naučený feedback ({Object.values(feedbackHistory).flat().length} položek)</span>
            <button
              onClick={() => {
                localStorage.removeItem('generator_feedback');
                setFeedbackHistory({});
                toast.success('Feedback vymazán');
              }}
              className="text-xs text-purple-600 hover:text-purple-800"
            >
              Vymazat vše
            </button>
          </div>
          <p className="text-xs text-purple-600">
            Feedback je automaticky použit při generování pro zlepšení výstupů.
          </p>
        </div>
      )}
      
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-amber-800 text-sm">
          💡 Vyber typ materiálu k vygenerování. Po vygenerování můžeš přidat feedback pro zlepšení.
        </p>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        {generators.map(gen => {
          const isGenerating = generating === gen.id;
          const existing = existingMaterials.find((m: any) => m.type === gen.id);
          const wasJustGenerated = justGenerated?.type === gen.id;
          
          const preview = previews[gen.id];
          
          return (
            <div
              key={gen.id}
              className={`bg-white rounded-xl p-4 border-2 transition-all shadow-sm ${
                wasJustGenerated 
                  ? 'border-emerald-400 ring-2 ring-emerald-200' 
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-lg shrink-0"
                  style={{ backgroundColor: getButtonColor(gen.id) }}
                >
                  {gen.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-slate-900">{gen.title}</h4>
                  <p className="text-sm text-slate-500 mt-0.5">{gen.description}</p>
                </div>
              </div>
              
              {/* Náhled vygenerovaného textu */}
              {preview && (
                <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200 max-h-48 overflow-y-auto">
                  <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono leading-relaxed">
                    {preview}
                  </pre>
                </div>
              )}
              
              {/* Feedback chatbot - jen když je náhled */}
              {preview && (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="w-4 h-4 text-slate-400" />
                    <span className="text-xs text-slate-500 font-medium">Feedback pro zlepšení</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={feedbackInputs[gen.id] || ''}
                      onChange={(e) => setFeedbackInputs(prev => ({ ...prev, [gen.id]: e.target.value }))}
                      placeholder="Např: Přidej více otázek na osobnosti..."
                      className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && feedbackInputs[gen.id]?.trim()) {
                          saveFeedback(gen.id, feedbackInputs[gen.id].trim());
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        if (feedbackInputs[gen.id]?.trim()) {
                          saveFeedback(gen.id, feedbackInputs[gen.id].trim());
                        }
                      }}
                      disabled={!feedbackInputs[gen.id]?.trim()}
                      className="px-3 py-2 text-white rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundColor: '#a855f7' }}
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                  {/* Zobrazit historii feedbacku pro tento typ */}
                  {feedbackHistory[gen.id]?.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {feedbackHistory[gen.id].map((fb, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-1 group"
                        >
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded flex-1">
                            {fb}
                          </span>
                          <button
                            onClick={() => {
                              // Upravit - načíst do inputu
                              setFeedbackInputs(prev => ({ ...prev, [gen.id]: fb }));
                              // Smazat z historie
                              const newHistory = {
                                ...feedbackHistory,
                                [gen.id]: feedbackHistory[gen.id].filter((_, idx) => idx !== i),
                              };
                              setFeedbackHistory(newHistory);
                              localStorage.setItem('generator_feedback', JSON.stringify(newHistory));
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-blue-500 transition-all"
                            title="Upravit"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => {
                              const newHistory = {
                                ...feedbackHistory,
                                [gen.id]: feedbackHistory[gen.id].filter((_, idx) => idx !== i),
                              };
                              setFeedbackHistory(newHistory);
                              localStorage.setItem('generator_feedback', JSON.stringify(newHistory));
                              toast.success('Feedback smazán');
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-all"
                            title="Smazat"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      
                      {/* Tlačítko Přegenerovat */}
                      <button
                        onClick={() => handleGenerate(gen.id)}
                        disabled={isGenerating}
                        className="mt-2 w-full py-2 text-white rounded-lg text-sm transition-colors flex items-center justify-center gap-2 font-medium"
                        style={{ backgroundColor: '#7c3aed' }}
                      >
                        {isGenerating ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Generuji...
                          </>
                        ) : (
                          <>
                            🔄 Přegenerovat s feedbackem
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
              
              <div className="mt-4 flex items-center gap-2">
                {/* Právě vygenerováno - ukázat tlačítko Otevřít */}
                {wasJustGenerated && justGenerated?.id ? (
                  <button
                    onClick={() => handleOpenGenerated(gen.id, justGenerated.id)}
                    className="flex-1 py-2.5 text-white rounded-lg text-sm transition-colors flex items-center justify-center gap-2 font-semibold shadow-md"
                    style={{ backgroundColor: '#10b981' }}
                  >
                    <Eye className="w-4 h-4" />
                    ✓ Otevřít vygenerovaný materiál
                  </button>
                ) : existing ? (
                  <>
                    <button
                      onClick={() => handleOpenGenerated(gen.id, existing.id)}
                      className="flex-1 py-2.5 text-white rounded-lg text-sm transition-colors flex items-center justify-center gap-2 font-medium shadow-md"
                      style={{ backgroundColor: '#334155' }}
                    >
                      <Eye className="w-4 h-4" />
                      Otevřít
                    </button>
                    <button
                      onClick={() => handleGenerate(gen.id)}
                      disabled={isGenerating}
                      className="py-2.5 px-4 text-white rounded-lg text-sm transition-colors font-medium shadow-md"
                      style={{ backgroundColor: '#f59e0b' }}
                    >
                      {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : '↻'}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleGenerate(gen.id)}
                    disabled={isGenerating}
                    className="flex-1 py-2.5 text-white rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg hover:opacity-90"
                    style={{ backgroundColor: getButtonColor(gen.id) }}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generuji...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Generovat
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Existing materials */}
      {existingMaterials.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">📦 Vygenerované materiály</h3>
          <div className="space-y-2">
            {existingMaterials.map((mat: any) => (
              <div
                key={mat.id}
                className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">
                    {generators.find(g => g.id === mat.type)?.icon || '📄'}
                  </span>
                  <div>
                    <p className="text-slate-900 font-medium">{mat.title}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(mat.createdAt).toLocaleDateString('cs-CZ')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleOpenGenerated(mat.type, mat.id)}
                  className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-50 transition-colors font-medium"
                >
                  Otevřít
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default DataSetCreator;
