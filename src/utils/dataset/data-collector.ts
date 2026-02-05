/**
 * Data Collector - shromáždí všechna data pro téma
 */

import { TopicDataSet, RvpInfo, TargetGroupInfo, ContentInfo, MediaInfo, ValidatedImage, KeyTerm, TimelineEvent, Personality } from '../../types/topic-dataset';
import { chatWithAIProxy } from '../ai-chat-proxy';
import { supabase } from '../supabase/client';

const AI_MODEL_PRO = 'gemini-3-pro';
const AI_MODEL_FLASH = 'gemini-3-flash';

/**
 * Helper pro volání AI s jedním promptem
 */
async function callAI(prompt: string, model: string): Promise<string> {
  return chatWithAIProxy([{ role: 'user', content: prompt }], model);
}

type ProgressCallback = (message: string) => void;

/**
 * Hlavní funkce pro sběr dat k tématu
 */
export async function collectTopicData(
  topic: string,
  subjectCode: string,
  grade: number,
  onProgress?: ProgressCallback
): Promise<TopicDataSet> {
  const id = crypto.randomUUID();
  
  onProgress?.(`📚 Sbírám data pro: "${topic}"`);
  
  // Paralelně spustit sběr různých typů dat
  const [rvpInfo, targetGroup, content, media] = await Promise.all([
    collectRvpInfo(topic, subjectCode, grade, onProgress),
    collectTargetGroupInfo(grade, onProgress),
    collectContentInfo(topic, subjectCode, grade, onProgress),
    collectMediaInfo(topic, subjectCode, onProgress),
  ]);
  
  onProgress?.('✅ Všechna data shromážděna!');
  
  return {
    id,
    topic,
    subjectCode,
    grade,
    status: 'ready',
    rvp: rvpInfo,
    targetGroup,
    content,
    media,
    generatedMaterials: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Sbírá RVP informace pro téma
 */
async function collectRvpInfo(
  topic: string,
  subjectCode: string,
  grade: number,
  onProgress?: ProgressCallback
): Promise<RvpInfo> {
  onProgress?.('📋 Analyzuji RVP očekávané výstupy...');
  
  const subjectNames: Record<string, string> = {
    dejepis: 'Dějepis',
    zemepis: 'Zeměpis',
    anglictina: 'Anglický jazyk',
    cestina: 'Český jazyk',
  };
  
  const prompt = `Jsi expert na český Rámcový vzdělávací program (RVP ZV).

Analyzuj téma "${topic}" pro předmět ${subjectNames[subjectCode] || subjectCode}, ${grade}. třída ZŠ.

Vrať JSON s těmito informacemi:
{
  "thematicArea": "Název tematického okruhu podle RVP",
  "expectedOutcomes": ["3-5 očekávaných výstupů z RVP relevantních k tomuto tématu"],
  "competencies": ["2-3 klíčové kompetence, které téma rozvíjí"],
  "hoursAllocated": <odhadovaný počet vyučovacích hodin pro toto téma>,
  "crossCurricular": ["1-2 průřezová témata nebo mezipředmětové vztahy"]
}

Vrať POUZE validní JSON, nic jiného.`;

  try {
    const response = await callAI(prompt, AI_MODEL_PRO);
    const parsed = parseJsonFromResponse(response);
    return {
      thematicArea: parsed.thematicArea || '',
      expectedOutcomes: parsed.expectedOutcomes || [],
      competencies: parsed.competencies || [],
      hoursAllocated: parsed.hoursAllocated || 4,
      crossCurricular: parsed.crossCurricular || [],
    };
  } catch (err) {
    console.error('RVP collection error:', err);
    return {
      thematicArea: topic,
      expectedOutcomes: [],
      competencies: [],
      hoursAllocated: 4,
      crossCurricular: [],
    };
  }
}

/**
 * Sbírá informace o cílové skupině
 */
async function collectTargetGroupInfo(
  grade: number,
  onProgress?: ProgressCallback
): Promise<TargetGroupInfo> {
  onProgress?.('👥 Definuji cílovou skupinu...');
  
  // Předdefinované info podle ročníku
  const gradeInfo: Record<number, TargetGroupInfo> = {
    6: {
      ageRange: '11-12 let',
      gradeLevel: '6. třída ZŠ',
      cognitiveLevel: 'Přechod od konkrétních k formálním operacím',
      priorKnowledge: ['Základy pravěku z 1. stupně', 'Čtení mapy', 'Práce s časovou osou'],
    },
    7: {
      ageRange: '12-13 let',
      gradeLevel: '7. třída ZŠ',
      cognitiveLevel: 'Formální operace, abstraktní myšlení',
      priorKnowledge: ['Starověk', 'Základy středověku', 'Orientace v mapě'],
    },
    8: {
      ageRange: '13-14 let',
      gradeLevel: '8. třída ZŠ',
      cognitiveLevel: 'Rozvinuté formální operace',
      priorKnowledge: ['Středověk', 'Raný novověk', 'Historické souvislosti'],
    },
    9: {
      ageRange: '14-15 let',
      gradeLevel: '9. třída ZŠ',
      cognitiveLevel: 'Pokročilé abstraktní myšlení, kritické hodnocení',
      priorKnowledge: ['Novověk do 19. století', 'Průmyslová revoluce', 'Národní obrození'],
    },
  };
  
  return gradeInfo[grade] || gradeInfo[6];
}

/**
 * Sbírá obsahové informace - pojmy, fakta, časovou osu
 */
async function collectContentInfo(
  topic: string,
  subjectCode: string,
  grade: number,
  onProgress?: ProgressCallback
): Promise<ContentInfo> {
  onProgress?.('📖 Sbírám klíčové pojmy a fakta...');
  
  const prompt = `Jsi učitel ${subjectCode === 'dejepis' ? 'dějepisu' : subjectCode} na ZŠ.

Připrav podrobné obsahové informace k tématu "${topic}" pro ${grade}. třídu.

Vrať JSON s těmito daty:
{
  "keyTerms": [
    {
      "term": "název pojmu",
      "definition": "stručná definice vhodná pro žáky ${grade}. třídy",
      "emoji": "relevantní emoji"
    }
  ],
  "keyFacts": ["8-12 klíčových faktů, které by žáci měli znát"],
  "timeline": [
    {
      "date": "datum nebo období",
      "event": "co se stalo",
      "importance": "high/medium/low"
    }
  ],
  "personalities": [
    {
      "name": "jméno osobnosti",
      "role": "role/povolání",
      "description": "krátký popis významu"
    }
  ],
  "modernConnections": ["2-3 propojení s dnešní dobou"],
  "funFacts": ["3-4 zajímavosti pro motivaci žáků"],
  "sources": ["doporučené zdroje pro hlubší studium"]
}

Obsah přizpůsob věku a úrovni ${grade}. třídy ZŠ.
Vrať POUZE validní JSON.`;

  try {
    const response = await callAI(prompt, AI_MODEL_PRO);
    const parsed = parseJsonFromResponse(response);
    
    return {
      keyTerms: (parsed.keyTerms || []).map((t: any) => ({
        term: t.term || '',
        definition: t.definition || '',
        emoji: t.emoji || '',
      })),
      keyFacts: parsed.keyFacts || [],
      timeline: (parsed.timeline || []).map((e: any) => ({
        date: e.date || '',
        event: e.event || '',
        importance: e.importance || 'medium',
      })),
      personalities: (parsed.personalities || []).map((p: any) => ({
        name: p.name || '',
        role: p.role || '',
        description: p.description || '',
      })),
      modernConnections: parsed.modernConnections || [],
      funFacts: parsed.funFacts || [],
      sources: parsed.sources || [],
    };
  } catch (err) {
    console.error('Content collection error:', err);
    return {
      keyTerms: [],
      keyFacts: [],
      timeline: [],
      personalities: [],
      modernConnections: [],
      funFacts: [],
      sources: [],
    };
  }
}

/**
 * Sbírá média - obrázky, emoji, barvy
 */
async function collectMediaInfo(
  topic: string,
  subjectCode: string,
  onProgress?: ProgressCallback
): Promise<MediaInfo> {
  onProgress?.('🖼️ Hledám relevantní obrázky...');
  
  // 1. Získat klíčová slova pro vyhledávání
  const keywordsPrompt = `Pro téma "${topic}" (předmět: ${subjectCode}) vygeneruj:
{
  "searchKeywords": ["5-8 klíčových slov pro vyhledávání obrázků v angličtině"],
  "emojis": ["5-8 relevantních emoji pro toto téma"],
  "themeColors": ["3-4 hex barvy vhodné pro vizuální styl tohoto tématu"]
}
Vrať POUZE JSON.`;

  let keywords: string[] = [];
  let emojis: string[] = [];
  let themeColors: string[] = [];
  
  try {
    const kwResponse = await callAI(keywordsPrompt, AI_MODEL_FLASH);
    const kwParsed = parseJsonFromResponse(kwResponse);
    keywords = kwParsed.searchKeywords || [];
    emojis = kwParsed.emojis || [];
    themeColors = kwParsed.themeColors || [];
  } catch (err) {
    console.error('Keywords error:', err);
    keywords = [topic.toLowerCase().replace(/\s+/g, ' ')];
    emojis = ['📚', '🎓'];
    themeColors = ['#8B4513', '#D4A574'];
  }
  
  onProgress?.(`🔍 Hledám obrázky pro: ${keywords.slice(0, 3).join(', ')}...`);
  
  // 2. Vyhledat obrázky z různých zdrojů
  const images = await searchImages(keywords, topic, subjectCode, onProgress);
  
  onProgress?.(`✅ Nalezeno ${images.length} obrázků`);
  
  return {
    images,
    emojis,
    themeColors,
  };
}

/**
 * Vyhledá obrázky z Wikimedia Commons (nepotřebuje API klíč)
 */
async function searchImages(
  keywords: string[],
  topic: string,
  subjectCode: string,
  onProgress?: ProgressCallback
): Promise<ValidatedImage[]> {
  const images: ValidatedImage[] = [];
  
  try {
    // Použít pouze Wikimedia Commons - nepotřebuje API klíč
    const wikimediaImages = await searchWikimediaImages(keywords, topic);
    images.push(...wikimediaImages);
  } catch (err) {
    console.error('Image search error:', err);
  }
  
  // Deduplikovat a seřadit podle relevance
  const uniqueImages = deduplicateImages(images);
  const sortedImages = uniqueImages.sort((a, b) => b.relevanceScore - a.relevanceScore);
  
  // Vrátit max 15 nejlepších
  return sortedImages.slice(0, 15);
}

/**
 * Wikimedia Commons search
 */
async function searchWikimediaImages(keywords: string[], topic: string): Promise<ValidatedImage[]> {
  const images: ValidatedImage[] = [];
  
  for (const keyword of keywords.slice(0, 3)) {
    try {
      const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(keyword)}&srnamespace=6&srlimit=5&format=json&origin=*`;
      
      const response = await fetch(searchUrl);
      if (!response.ok) continue;
      
      const data = await response.json();
      const searchResults = data.query?.search || [];
      
      for (const result of searchResults) {
        const title = result.title;
        
        // Získat URL obrázku
        const imageInfoUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url|extmetadata&format=json&origin=*`;
        
        const imgResponse = await fetch(imageInfoUrl);
        if (!imgResponse.ok) continue;
        
        const imgData = await imgResponse.json();
        const pages = imgData.query?.pages || {};
        const page = Object.values(pages)[0] as any;
        const imageInfo = page?.imageinfo?.[0];
        
        if (imageInfo?.url) {
          images.push({
            id: crypto.randomUUID(),
            url: imageInfo.url,
            thumbnailUrl: imageInfo.url.replace('/commons/', '/commons/thumb/') + '/400px-' + title.replace('File:', ''),
            title: title.replace('File:', '').replace(/\.[^/.]+$/, ''),
            description: imageInfo.extmetadata?.ImageDescription?.value || '',
            source: 'Wikimedia Commons',
            license: imageInfo.extmetadata?.LicenseShortName?.value || 'CC',
            relevanceScore: calculateRelevance(title, topic, keyword),
            keywords: [keyword],
          });
        }
      }
    } catch (err) {
      console.error('Wikimedia search error:', err);
    }
  }
  
  return images;
}

// Pixabay a Pexels odstraněny - vyžadují platné API klíče
// Používáme pouze Wikimedia Commons, která je zdarma

/**
 * Vypočítá relevanci obrázku
 */
function calculateRelevance(text: string, topic: string, keyword: string): number {
  const lowerText = text.toLowerCase();
  const lowerTopic = topic.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  
  let score = 50; // Base score
  
  // Bonus za shodu s tématem
  if (lowerText.includes(lowerTopic)) score += 30;
  
  // Bonus za klíčové slovo
  if (lowerText.includes(lowerKeyword)) score += 15;
  
  // Bonus za slova z tématu
  const topicWords = lowerTopic.split(/\s+/);
  for (const word of topicWords) {
    if (word.length > 3 && lowerText.includes(word)) {
      score += 5;
    }
  }
  
  return Math.min(100, score);
}

/**
 * Deduplikuje obrázky podle URL
 */
function deduplicateImages(images: ValidatedImage[]): ValidatedImage[] {
  const seen = new Set<string>();
  return images.filter(img => {
    if (seen.has(img.url)) return false;
    seen.add(img.url);
    return true;
  });
}

/**
 * Parsuje JSON z AI odpovědi
 */
function parseJsonFromResponse(response: string): any {
  try {
    // Pokus o přímé parsování
    return JSON.parse(response);
  } catch {
    // Zkusit extrahovat JSON z markdown
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1].trim());
    }
    
    // Zkusit najít { ... }
    const braceMatch = response.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      return JSON.parse(braceMatch[0]);
    }
    
    throw new Error('Could not parse JSON from response');
  }
}

// =====================================================
// CURRICULUM FACTORY INTEGRATION
// =====================================================

/**
 * Import typů z curriculum modulu
 */
interface WeeklyPlanInput {
  id: string;
  weekNumber: number;
  topicTitle: string;
  topicDescription?: string;
  learningGoals?: string[];
  vocabulary?: string[];
  hoursAllocated?: number;
}

interface RvpDataInput {
  thematicArea?: string;
  expectedOutcomes?: string[];
  keyCompetencies?: string[];
  crossCurricularTopics?: string[];
}

/**
 * Vytvoří DataSet z týdenního plánu (pro Curriculum Factory)
 * 
 * Tato funkce je volána z Agent 3 v Curriculum Factory.
 * Využívá existující RVP data + learning goals z týdenního plánu.
 */
export async function createDataSetFromWeeklyPlan(
  weeklyPlan: WeeklyPlanInput,
  rvpData: RvpDataInput | null,
  subjectCode: string,
  grade: number,
  onProgress?: ProgressCallback
): Promise<TopicDataSet> {
  const id = crypto.randomUUID();
  const topic = weeklyPlan.topicTitle;
  
  onProgress?.(`📚 Vytvářím DataSet pro týden ${weeklyPlan.weekNumber}: "${topic}"`);
  
  // RVP info - kombinovat z existujících dat + nového sběru
  const rvpInfo: RvpInfo = {
    thematicArea: rvpData?.thematicArea || topic,
    expectedOutcomes: rvpData?.expectedOutcomes || [],
    competencies: rvpData?.keyCompetencies || [],
    hoursAllocated: weeklyPlan.hoursAllocated || 2,
    crossCurricular: rvpData?.crossCurricularTopics || [],
  };
  
  // Target group z předdefinovaných hodnot
  const targetGroup = await collectTargetGroupInfo(grade);
  
  // Paralelní sběr obsahu a médií
  onProgress?.(`📖 Sbírám obsahová data...`);
  
  const [content, media] = await Promise.all([
    collectContentInfoFromPlan(topic, subjectCode, grade, weeklyPlan, onProgress),
    collectMediaInfo(topic, subjectCode, onProgress),
  ]);
  
  onProgress?.(`✅ DataSet pro "${topic}" vytvořen!`);
  
  return {
    id,
    topic,
    subjectCode,
    grade,
    status: 'ready',
    rvp: rvpInfo,
    targetGroup,
    content,
    media,
    generatedMaterials: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Sbírá obsahové informace s využitím dat z týdenního plánu
 */
async function collectContentInfoFromPlan(
  topic: string,
  subjectCode: string,
  grade: number,
  weeklyPlan: WeeklyPlanInput,
  onProgress?: ProgressCallback
): Promise<ContentInfo> {
  
  // Pokud máme vocabulary z plánu, použijeme jako základ pro pojmy
  const existingTerms = (weeklyPlan.vocabulary || []).join(', ');
  const existingGoals = (weeklyPlan.learningGoals || []).join('; ');
  
  const prompt = `Jsi učitel ${subjectCode === 'dejepis' ? 'dějepisu' : subjectCode} na ZŠ.

Připrav podrobné obsahové informace k tématu "${topic}" pro ${grade}. třídu.

${existingTerms ? `Klíčové pojmy k zahrnutí: ${existingTerms}` : ''}
${existingGoals ? `Učební cíle: ${existingGoals}` : ''}
${weeklyPlan.topicDescription ? `Popis tématu: ${weeklyPlan.topicDescription}` : ''}

Vrať JSON s těmito daty:
{
  "keyTerms": [
    {
      "term": "název pojmu",
      "definition": "stručná definice vhodná pro žáky ${grade}. třídy",
      "emoji": "relevantní emoji"
    }
  ],
  "keyFacts": ["8-12 klíčových faktů, které by žáci měli znát"],
  "timeline": [
    {
      "date": "datum nebo období",
      "event": "co se stalo",
      "importance": "high/medium/low"
    }
  ],
  "personalities": [
    {
      "name": "jméno osobnosti",
      "role": "role/povolání",
      "description": "krátký popis významu"
    }
  ],
  "modernConnections": ["2-3 propojení s dnešní dobou"],
  "funFacts": ["3-4 zajímavosti pro motivaci žáků"],
  "sources": ["doporučené zdroje pro hlubší studium"]
}

Obsah přizpůsob věku a úrovni ${grade}. třídy ZŠ.
Vrať POUZE validní JSON.`;

  try {
    const response = await callAI(prompt, AI_MODEL_PRO);
    const parsed = parseJsonFromResponse(response);
    
    return {
      keyTerms: (parsed.keyTerms || []).map((t: any) => ({
        term: t.term || '',
        definition: t.definition || '',
        emoji: t.emoji || '',
      })),
      keyFacts: parsed.keyFacts || [],
      timeline: (parsed.timeline || []).map((e: any) => ({
        date: e.date || '',
        event: e.event || '',
        importance: e.importance || 'medium',
      })),
      personalities: (parsed.personalities || []).map((p: any) => ({
        name: p.name || '',
        role: p.role || '',
        description: p.description || '',
      })),
      modernConnections: parsed.modernConnections || [],
      funFacts: parsed.funFacts || [],
      sources: parsed.sources || [],
    };
  } catch (err) {
    console.error('Content collection from plan error:', err);
    
    // Fallback - vytvořit základní strukturu z vocabulary
    return {
      keyTerms: (weeklyPlan.vocabulary || []).map(term => ({
        term,
        definition: '',
        emoji: '📖',
      })),
      keyFacts: [],
      timeline: [],
      personalities: [],
      modernConnections: [],
      funFacts: [],
      sources: [],
    };
  }
}

/**
 * Hromadně vytvoří DataSety z pole týdenních plánů
 */
export async function createDataSetsFromWeeklyPlans(
  weeklyPlans: WeeklyPlanInput[],
  rvpDataMap: Map<string, RvpDataInput>,
  subjectCode: string,
  grade: number,
  onProgress?: ProgressCallback,
  saveToDb: boolean = true
): Promise<TopicDataSet[]> {
  const dataSets: TopicDataSet[] = [];
  
  onProgress?.(`📦 Vytvářím ${weeklyPlans.length} DataSetů...`);
  
  for (let i = 0; i < weeklyPlans.length; i++) {
    const plan = weeklyPlans[i];
    const rvpData = rvpDataMap.get(plan.id) || null;
    
    onProgress?.(`[${i + 1}/${weeklyPlans.length}] ${plan.topicTitle}`);
    
    try {
      const dataSet = await createDataSetFromWeeklyPlan(
        plan,
        rvpData,
        subjectCode,
        grade,
        onProgress
      );
      
      // Uložit do databáze
      if (saveToDb) {
        const { data: user } = await supabase.auth.getUser();
        
        onProgress?.(`💾 Ukládám DataSet do databáze...`);
        
        // Připravit čistá JSONB data
        const cleanRvp = {
          thematicArea: String(dataSet.rvp?.thematicArea || ''),
          expectedOutcomes: Array.isArray(dataSet.rvp?.expectedOutcomes) ? dataSet.rvp.expectedOutcomes : [],
          competencies: Array.isArray(dataSet.rvp?.competencies) ? dataSet.rvp.competencies : [],
          hoursAllocated: Number(dataSet.rvp?.hoursAllocated) || 2,
          crossCurricular: Array.isArray(dataSet.rvp?.crossCurricular) ? dataSet.rvp.crossCurricular : [],
        };
        
        const cleanTargetGroup = {
          ageRange: String(dataSet.targetGroup?.ageRange || ''),
          gradeLevel: String(dataSet.targetGroup?.gradeLevel || ''),
          cognitiveLevel: String(dataSet.targetGroup?.cognitiveLevel || ''),
          priorKnowledge: Array.isArray(dataSet.targetGroup?.priorKnowledge) ? dataSet.targetGroup.priorKnowledge : [],
          specialNeeds: dataSet.targetGroup?.specialNeeds || null,
        };
        
        const cleanContent = {
          keyTerms: Array.isArray(dataSet.content?.keyTerms) ? dataSet.content.keyTerms : [],
          keyFacts: Array.isArray(dataSet.content?.keyFacts) ? dataSet.content.keyFacts : [],
          facts: Array.isArray(dataSet.content?.facts) ? dataSet.content.facts : [],
          timeline: Array.isArray(dataSet.content?.timeline) ? dataSet.content.timeline : [],
          personalities: Array.isArray(dataSet.content?.personalities) ? dataSet.content.personalities : [],
          modernConnections: Array.isArray(dataSet.content?.modernConnections) ? dataSet.content.modernConnections : [],
          funFacts: Array.isArray(dataSet.content?.funFacts) ? dataSet.content.funFacts : [],
          sources: Array.isArray(dataSet.content?.sources) ? dataSet.content.sources : [],
        };
        
        const cleanMedia = {
          images: Array.isArray(dataSet.media?.images) ? dataSet.media.images : [],
          emojis: Array.isArray(dataSet.media?.emojis) ? dataSet.media.emojis : [],
          themeColors: Array.isArray(dataSet.media?.themeColors) ? dataSet.media.themeColors : [],
        };
        
        const insertData: Record<string, any> = {
          topic: String(dataSet.topic),
          subject_code: String(dataSet.subjectCode),
          grade: Number(dataSet.grade),
          status: 'ready',
          rvp: cleanRvp,
          target_group: cleanTargetGroup,
          content: cleanContent,
          media: cleanMedia,
          generated_materials: [],
        };
        
        // Přidat created_by jen pokud existuje
        if (user.user?.id) {
          insertData.created_by = user.user.id;
        }
        
        // Přidat weekly_plan_id pokud je validní UUID
        if (plan.id && typeof plan.id === 'string' && plan.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
          insertData.weekly_plan_id = plan.id;
        }
        
        console.log('[DataCollector] Inserting DataSet:', JSON.stringify(insertData, null, 2));
        
        const { data: inserted, error } = await supabase
          .from('topic_data_sets')
          .insert(insertData)
          .select('id')
          .single();
        
        if (error) {
          console.error(`[DataCollector] Error saving DataSet:`, error);
          console.error(`[DataCollector] Insert data was:`, JSON.stringify(insertData, null, 2));
          onProgress?.(`❌ Chyba ukládání: ${error.message} (code: ${error.code}, details: ${error.details}, hint: ${error.hint})`);
        } else {
          // Aktualizovat ID v dataSet objektu
          if (inserted?.id) {
            dataSet.id = inserted.id;
          }
          onProgress?.(`✅ DataSet "${plan.topicTitle}" uložen (ID: ${inserted?.id})`);
        }
      }
      
      dataSets.push(dataSet);
      
    } catch (err) {
      console.error(`Error creating DataSet for ${plan.topicTitle}:`, err);
      onProgress?.(`❌ Chyba pro "${plan.topicTitle}": ${err}`);
    }
  }
  
  onProgress?.(`✅ Vytvořeno ${dataSets.length}/${weeklyPlans.length} DataSetů`);
  
  return dataSets;
}

/**
 * RVP topic input interface
 */
interface RvpTopicInput {
  id: string;
  thematicArea: string;
  topic?: string; // Konkrétní téma (např. "Doba bronzová a železná")
  expectedOutcomes: string[];
  keyCompetencies: string[];
  crossCurricularTopics: string[];
  hoursAllocated?: number;
}

/**
 * Weekly plan input for RVP-based DataSets
 */
interface WeeklyPlanForRvp {
  id: string;
  weekNumber: number;
  topicTitle: string;
  topicDescription?: string;
  learningGoals: string[];
  vocabulary: string[];
  hoursAllocated: number;
}

/**
 * Vytváří DataSety z RVP témat (ne z týdenních plánů)
 * 
 * Každé RVP téma = 1 DataSet, i když má více týdenních plánů
 * Týdenní plány se použijí pro:
 * - Celkovou hodinovou dotaci
 * - Slovní zásobu a cíle ze všech týdnů
 */
export async function createDataSetsFromRvpTopics(
  rvpTopics: RvpTopicInput[],
  rvpToWeeklyPlans: Map<string, WeeklyPlanForRvp[]>,
  subjectCode: string,
  grade: number,
  onProgress?: ProgressCallback,
  saveToDb: boolean = true
): Promise<TopicDataSet[]> {
  const dataSets: TopicDataSet[] = [];
  
  onProgress?.(`📦 Vytvářím ${rvpTopics.length} DataSetů z RVP témat...`);
  
  for (let i = 0; i < rvpTopics.length; i++) {
    const rvp = rvpTopics[i];
    const relatedPlans = rvpToWeeklyPlans.get(rvp.id) || [];
    
    // Použít konkrétní topic pokud existuje, jinak thematicArea
    const topicName = rvp.topic || rvp.thematicArea;
    
    onProgress?.(`[${i + 1}/${rvpTopics.length}] ${topicName}`);
    
    try {
      // Sloučit data ze všech týdenních plánů
      const allVocabulary = new Set<string>();
      const allGoals = new Set<string>();
      let totalHours = 0;
      const weekNumbers: number[] = [];
      
      for (const plan of relatedPlans) {
        plan.vocabulary?.forEach(v => allVocabulary.add(v));
        plan.learningGoals?.forEach(g => allGoals.add(g));
        totalHours += plan.hoursAllocated || 2;
        weekNumbers.push(plan.weekNumber);
      }
      
      onProgress?.(`  📅 ${relatedPlans.length} týdnů, ${totalHours} hodin`);
      
      // RVP info
      const rvpInfo: RvpInfo = {
        thematicArea: rvp.thematicArea,
        expectedOutcomes: rvp.expectedOutcomes || [],
        competencies: rvp.keyCompetencies || [],
        hoursAllocated: totalHours || rvp.hoursAllocated || 2,
        crossCurricular: rvp.crossCurricularTopics || [],
      };
      
      // Target group
      const targetGroup = await collectTargetGroupInfo(grade);
      
      // Sbírat obsahová data a média paralelně
      onProgress?.(`  📖 Sbírám obsahová data...`);
      
      // Vytvořit syntetický plán pro sběr dat
      const syntheticPlan: WeeklyPlanInput = {
        id: rvp.id,
        weekNumber: weekNumbers[0] || 1,
        topicTitle: topicName,
        topicDescription: rvp.expectedOutcomes.join('. '),
        learningGoals: Array.from(allGoals),
        vocabulary: Array.from(allVocabulary),
        hoursAllocated: totalHours,
      };
      
      const [content, media] = await Promise.all([
        collectContentInfoFromPlanInternal(topicName, subjectCode, grade, syntheticPlan, onProgress),
        collectMediaInfo(topicName, subjectCode, onProgress),
      ]);
      
      const dataSet: TopicDataSet = {
        id: crypto.randomUUID(),
        topic: topicName,
        subjectCode,
        grade,
        status: 'ready',
        rvp: rvpInfo,
        targetGroup,
        content,
        media,
        generatedMaterials: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      onProgress?.(`✅ DataSet pro "${topicName}" vytvořen!`);
      
      // Uložit do databáze
      if (saveToDb) {
        const { data: user } = await supabase.auth.getUser();
        
        onProgress?.(`💾 Ukládám DataSet do databáze...`);
        
        // Připravit čistá JSONB data
        const cleanRvp = {
          thematicArea: String(dataSet.rvp?.thematicArea || ''),
          expectedOutcomes: Array.isArray(dataSet.rvp?.expectedOutcomes) ? dataSet.rvp.expectedOutcomes : [],
          competencies: Array.isArray(dataSet.rvp?.competencies) ? dataSet.rvp.competencies : [],
          hoursAllocated: Number(dataSet.rvp?.hoursAllocated) || 2,
          crossCurricular: Array.isArray(dataSet.rvp?.crossCurricular) ? dataSet.rvp.crossCurricular : [],
        };
        
        const cleanTargetGroup = {
          ageRange: String(dataSet.targetGroup?.ageRange || ''),
          gradeLevel: String(dataSet.targetGroup?.gradeLevel || ''),
          cognitiveLevel: String(dataSet.targetGroup?.cognitiveLevel || ''),
          priorKnowledge: Array.isArray(dataSet.targetGroup?.priorKnowledge) ? dataSet.targetGroup.priorKnowledge : [],
          specialNeeds: dataSet.targetGroup?.specialNeeds || null,
        };
        
        const cleanContent = {
          keyTerms: Array.isArray(dataSet.content?.keyTerms) ? dataSet.content.keyTerms : [],
          keyFacts: Array.isArray(dataSet.content?.keyFacts) ? dataSet.content.keyFacts : [],
          facts: Array.isArray(dataSet.content?.facts) ? dataSet.content.facts : [],
          timeline: Array.isArray(dataSet.content?.timeline) ? dataSet.content.timeline : [],
          personalities: Array.isArray(dataSet.content?.personalities) ? dataSet.content.personalities : [],
          modernConnections: Array.isArray(dataSet.content?.modernConnections) ? dataSet.content.modernConnections : [],
          funFacts: Array.isArray(dataSet.content?.funFacts) ? dataSet.content.funFacts : [],
          sources: Array.isArray(dataSet.content?.sources) ? dataSet.content.sources : [],
        };
        
        const cleanMedia = {
          images: Array.isArray(dataSet.media?.images) ? dataSet.media.images : [],
          emojis: Array.isArray(dataSet.media?.emojis) ? dataSet.media.emojis : [],
          themeColors: Array.isArray(dataSet.media?.themeColors) ? dataSet.media.themeColors : [],
        };
        
        const insertData: Record<string, any> = {
          topic: String(dataSet.topic),
          subject_code: String(dataSet.subjectCode),
          grade: Number(dataSet.grade),
          status: 'ready',
          rvp: cleanRvp,
          target_group: cleanTargetGroup,
          content: cleanContent,
          media: cleanMedia,
          generated_materials: [],
        };
        
        if (user.user?.id) {
          insertData.created_by = user.user.id;
        }
        
        console.log('[DataCollector] Inserting RVP DataSet:', insertData.topic);
        
        const { data: inserted, error } = await supabase
          .from('topic_data_sets')
          .insert(insertData)
          .select('id')
          .single();
        
        if (error) {
          console.error(`[DataCollector] Error saving DataSet:`, error);
          onProgress?.(`❌ Chyba ukládání: ${error.message}`);
        } else {
          if (inserted?.id) {
            dataSet.id = inserted.id;
          }
          onProgress?.(`✅ DataSet "${topicName}" uložen (ID: ${inserted?.id})`);
        }
      }
      
      dataSets.push(dataSet);
      
    } catch (err) {
      console.error(`Error creating DataSet for ${topicName}:`, err);
      onProgress?.(`❌ Chyba pro "${topicName}": ${err}`);
    }
  }
  
  onProgress?.(`✅ Vytvořeno ${dataSets.length}/${rvpTopics.length} DataSetů z RVP`);
  
  return dataSets;
}

/**
 * Interní verze collectContentInfoFromPlan pro použití v createDataSetsFromRvpTopics
 */
async function collectContentInfoFromPlanInternal(
  topic: string,
  subjectCode: string,
  grade: number,
  weeklyPlan: WeeklyPlanInput,
  onProgress?: ProgressCallback
): Promise<ContentInfo> {
  
  const existingTerms = (weeklyPlan.vocabulary || []).join(', ');
  const existingGoals = (weeklyPlan.learningGoals || []).join('; ');
  
  const prompt = `Jsi učitel ${subjectCode === 'dejepis' ? 'dějepisu' : subjectCode} na ZŠ.

Připrav podrobné obsahové informace k tématu "${topic}" pro ${grade}. třídu.

${existingTerms ? `Klíčové pojmy k zahrnutí: ${existingTerms}` : ''}
${existingGoals ? `Učební cíle: ${existingGoals}` : ''}
${weeklyPlan.topicDescription ? `Popis tématu: ${weeklyPlan.topicDescription}` : ''}

Vrať JSON s těmito daty:
{
  "keyTerms": [
    {
      "term": "název pojmu",
      "definition": "stručná definice vhodná pro žáky ${grade}. třídy",
      "emoji": "relevantní emoji"
    }
  ],
  "keyFacts": ["8-12 klíčových faktů, které by žáci měli znát"],
  "timeline": [
    {
      "date": "datum nebo období",
      "event": "co se stalo",
      "importance": "high/medium/low"
    }
  ],
  "personalities": [
    {
      "name": "jméno osobnosti",
      "role": "role/povolání",
      "description": "krátký popis významu"
    }
  ],
  "modernConnections": ["2-3 propojení s dnešní dobou"],
  "funFacts": ["3-4 zajímavosti pro motivaci žáků"],
  "sources": ["doporučené zdroje pro hlubší studium"]
}

Obsah přizpůsob věku a úrovni ${grade}. třídy ZŠ.
Vrať POUZE validní JSON.`;

  try {
    const response = await callAI(prompt, AI_MODEL_PRO);
    const parsed = parseJsonFromResponse(response);
    
    return {
      keyTerms: (parsed.keyTerms || []).map((t: any) => ({
        term: t.term || '',
        definition: t.definition || '',
        emoji: t.emoji || '',
      })),
      keyFacts: parsed.keyFacts || [],
      facts: parsed.keyFacts || [],
      timeline: (parsed.timeline || []).map((t: any) => ({
        date: t.date || '',
        event: t.event || '',
        importance: t.importance || 'medium',
      })),
      personalities: (parsed.personalities || []).map((p: any) => ({
        name: p.name || '',
        role: p.role || '',
        description: p.description || '',
      })),
      modernConnections: parsed.modernConnections || [],
      funFacts: parsed.funFacts || [],
      sources: parsed.sources || [],
    };
  } catch (err) {
    console.error('Error collecting content info:', err);
    return {
      keyTerms: weeklyPlan.vocabulary?.map(v => ({ term: v, definition: '', emoji: '' })) || [],
      keyFacts: weeklyPlan.learningGoals || [],
      facts: weeklyPlan.learningGoals || [],
      timeline: [],
      personalities: [],
      modernConnections: [],
      funFacts: [],
      sources: [],
    };
  }
}

// =====================================================
// VEŘEJNÁ FUNKCE PRO VYHLEDÁVÁNÍ OBRÁZKŮ
// =====================================================

/**
 * Vyhledá obrázky na základě zadaného výrazu (z Wikimedia Commons)
 * Exportovaná funkce pro použití v UI
 */
export async function searchImagesForTopic(
  query: string,
  maxResults: number = 6
): Promise<ValidatedImage[]> {
  console.log('[ImageSearch] Searching for:', query);
  
  const images: ValidatedImage[] = [];
  
  try {
    // Hledat na Wikimedia Commons
    const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srnamespace=6&srlimit=${maxResults * 2}&format=json&origin=*`;
    
    const response = await fetch(searchUrl);
    if (!response.ok) {
      throw new Error(`Wikimedia search failed: ${response.status}`);
    }
    
    const data = await response.json();
    const searchResults = data.query?.search || [];
    
    for (const result of searchResults.slice(0, maxResults)) {
      try {
        // Získat info o souboru
        const fileName = result.title.replace('File:', '');
        const infoUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(result.title)}&prop=imageinfo&iiprop=url|size|mime&format=json&origin=*`;
        
        const infoResponse = await fetch(infoUrl);
        if (!infoResponse.ok) continue;
        
        const infoData = await infoResponse.json();
        const pages = infoData.query?.pages;
        
        if (!pages) continue;
        
        const pageId = Object.keys(pages)[0];
        const imageInfo = pages[pageId]?.imageinfo?.[0];
        
        if (!imageInfo?.url) continue;
        
        // Filtrovat pouze obrázky
        const mime = imageInfo.mime || '';
        if (!mime.startsWith('image/') || mime.includes('svg') || mime.includes('gif')) continue;
        
        images.push({
          url: imageInfo.url,
          thumbnailUrl: imageInfo.url.replace(/\/commons\//, '/commons/thumb/') + '/300px-' + encodeURIComponent(fileName),
          title: fileName.replace(/_/g, ' ').replace(/\.\w+$/, ''),
          source: 'wikimedia',
          license: 'cc',
          width: imageInfo.width || 0,
          height: imageInfo.height || 0,
          relevanceScore: 1 - (searchResults.indexOf(result) / searchResults.length),
        });
      } catch (err) {
        console.error('Error processing search result:', err);
      }
    }
  } catch (err) {
    console.error('[ImageSearch] Error:', err);
  }
  
  console.log('[ImageSearch] Found:', images.length, 'images');
  return images.slice(0, maxResults);
}
