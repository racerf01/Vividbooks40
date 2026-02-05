/**
 * Curriculum Factory - AI Agents
 * 
 * Implementace 6 specializovaných agentů pro automatickou tvorbu
 * vzdělávacích materiálů podle RVP.
 * 
 * NOVÝ FLOW (DataSet-based):
 * Agent 1: RVP Scout (beze změny)
 * Agent 2: Planner (beze změny)
 * Agent 3: DataSet Creator - vytváří DataSety z týdenních plánů
 * Agent 4: Material Generator - generuje materiály z DataSetů
 * Agent 5: Media Scout (beze změny)
 * Agent 6: Assembler - ukládá do admin složek
 * Agent 7: QA Supervisor (beze změny)
 */

import { supabase } from '../supabase/client';
import { chatWithAIProxy } from '../ai-chat-proxy';
import {
  SubjectCode,
  Grade,
  RvpData,
  WeeklyPlan,
  ContentSpec,
  ContentDraft,
  PipelineRun,
  ContentType,
  Difficulty,
  QuestionType,
  WEEK_TO_MONTH,
  SUBJECT_NAMES,
  GRADE_NAMES
} from '../../types/curriculum';

// DataSet imports for new flow
import { TopicDataSet } from '../../types/topic-dataset';
import { createDataSetsFromWeeklyPlans, createDataSetsFromRvpTopics } from '../dataset/data-collector';
import { generateFromDataSet, GenerateResult } from '../dataset/material-generators';

// =====================================================
// CONFIGURATION
// =====================================================

// Používáme Supabase Edge Function proxy - API klíč je v Supabase secrets
// Gemini 3 Pro - pro komplexní reasoning (generování obsahu, plánování)
// Gemini 3 Flash - pro rychlé jednoduché tasky (tagování, assemblování)
const AI_MODEL_PRO = 'gemini-3-pro';     // Pro Agent 1, 2, 3, 4 (komplexní)
const AI_MODEL_FLASH = 'gemini-3-flash'; // Pro Agent 5, 6 (rychlé)

// Hodinová dotace pro dějepis: 2 hodiny týdně × 40 týdnů = 80 hodin/rok
const HOURS_PER_WEEK: Record<SubjectCode, number> = {
  dejepis: 2,
  zemepis: 2,
  cj: 4,
  aj: 3,
  matematika: 4,
  prirodopis: 2,
  fyzika: 2,
  chemie: 2
};

// Počet týdnů ve školním roce (září - červen)
const SCHOOL_WEEKS = 40;

// API Configuration for Vividbooks Library
const PROJECT_ID = 'njbtqmsxbyvpwigfceke';
const API_BASE = `https://${PROJECT_ID}.supabase.co/functions/v1/make-server-46c8107b`;

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Volá Gemini AI přes Supabase Edge Function proxy.
 * API klíč je bezpečně uložen v Supabase secrets (GEMINI_API_KEY_RAG).
 * 
 * @param prompt - User prompt
 * @param systemPrompt - System instructions
 * @param useProModel - true = Gemini 3 Pro (komplexní), false = Gemini 3 Flash (rychlé)
 */
async function callGemini(
  prompt: string, 
  systemPrompt?: string, 
  useProModel: boolean = true
): Promise<string> {
  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [];
  
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  
  messages.push({ role: 'user', content: prompt });
  
  const model = useProModel ? AI_MODEL_PRO : AI_MODEL_FLASH;
  
  try {
    console.log(`[Gemini] Calling ${model}...`);
    const response = await chatWithAIProxy(messages, model, {
      temperature: 0.7,
      max_tokens: 8192
    });
    
    return response;
  } catch (error: any) {
    console.error(`[Gemini ${model}] Error:`, error.message || error);
    throw new Error(`Gemini API error: ${error.message || 'Unknown error'}`);
  }
}

function parseJsonFromResponse(text: string): any {
  // Remove markdown code blocks if present
  let cleaned = text.trim();
  
  // Remove various markdown wrappers
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  // Try to find JSON object/array
  const jsonMatch = cleaned.match(/[\[{][\s\S]*[\]}]/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('[parseJson] Failed to parse:', cleaned.substring(0, 500));
    
    // Try to fix common issues
    // 1. Remove trailing commas before } or ]
    cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
    
    // 2. Try again
    try {
      return JSON.parse(cleaned);
    } catch (e2) {
      // 3. Try to extract just the object
      const objectMatch = cleaned.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        try {
          return JSON.parse(objectMatch[0]);
        } catch (e3) {
          console.error('[parseJson] All parse attempts failed');
        }
      }
      throw new Error('Failed to parse JSON from response');
    }
  }
}

function generateSchoolYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  // School year starts in September (month 8)
  if (month >= 8) {
    return `${year}/${year + 1}`;
  }
  return `${year - 1}/${year}`;
}

// =====================================================
// AGENT 1: RVP SCOUT
// =====================================================

export interface Agent1Result {
  topicsFound: number;
  sourcesUsed: string[];
  rvpDataIds: string[];
  newTopicsAdded: number;
}

/**
 * Agent 1: RVP Scout
 * 
 * Analyzuje RVP a vytváří/aktualizuje tabulku curriculum_rvp_data.
 * Pro dějepis máme základní seed data, ale agent může doplnit detaily.
 */
export async function runAgent1(
  subjectCode: SubjectCode,
  grade?: Grade,
  onProgress?: (message: string) => void
): Promise<Agent1Result> {
  onProgress?.('🔍 Načítám existující RVP data...');
  
  // 1. Load existing RVP data
  let query = supabase
    .from('curriculum_rvp_data')
    .select('*')
    .eq('subject_code', subjectCode)
    .order('grade')
    .order('order_index');
  
  if (grade) {
    query = query.eq('grade', grade);
  }
  
  const { data: existingData, error } = await query;
  
  if (error) {
    console.error('[Agent1] Error loading RVP data:', error);
    throw error;
  }
  
  const rvpDataIds = (existingData || []).map(d => d.id);
  
  onProgress?.(`📚 Nalezeno ${existingData?.length || 0} témat v databázi`);
  
  // 2. If we have data, enrich it with AI (add more details to expected outcomes)
  if (existingData && existingData.length > 0) {
    onProgress?.('🤖 Obohacuji RVP data pomocí AI...');
    
    // For each topic, check if expected_outcomes are detailed enough
    let enrichedCount = 0;
    
    for (const topic of existingData) {
      if (topic.expected_outcomes && topic.expected_outcomes.length >= 3) {
        continue; // Already has enough outcomes
      }
      
      try {
        const enrichedOutcomes = await enrichRvpTopic(
          subjectCode,
          topic.grade,
          topic.thematic_area,
          topic.topic,
          topic.expected_outcomes || []
        );
        
        if (enrichedOutcomes.length > (topic.expected_outcomes?.length || 0)) {
          // Update in database
          await supabase
            .from('curriculum_rvp_data')
            .update({
              expected_outcomes: enrichedOutcomes,
              updated_at: new Date().toISOString()
            })
            .eq('id', topic.id);
          
          enrichedCount++;
          onProgress?.(`✨ Obohaceno téma: ${topic.topic}`);
        }
      } catch (err) {
        console.error('[Agent1] Error enriching topic:', topic.topic, err);
      }
    }
    
    onProgress?.(`✅ Agent 1 dokončen: ${existingData.length} témat, ${enrichedCount} obohaceno`);
    
    return {
      topicsFound: existingData.length,
      sourcesUsed: ['RVP ZV 2021', 'Seed data', 'Gemini AI'],
      rvpDataIds,
      newTopicsAdded: 0
    };
  }
  
  // 3. If no data exists, generate base RVP structure using AI
  onProgress?.('🤖 Generuji RVP strukturu pomocí AI...');
  
  const grades = grade ? [grade] : [6, 7, 8, 9] as Grade[];
  let totalAdded = 0;
  
  for (const g of grades) {
    onProgress?.(`📝 Generuji témata pro ${g}. třídu...`);
    
    const topics = await generateRvpTopics(subjectCode, g);
    
    for (const topic of topics) {
      const { error: insertError } = await supabase
        .from('curriculum_rvp_data')
        .insert({
          subject_code: subjectCode,
          grade: g,
          thematic_area: topic.thematicArea,
          topic: topic.topic,
          expected_outcomes: topic.expectedOutcomes,
          key_competencies: topic.keyCompetencies,
          recommended_hours: topic.recommendedHours,
          order_index: topic.orderIndex,
          rvp_revision: '2021'
        });
      
      if (!insertError) {
        totalAdded++;
        rvpDataIds.push(topic.id || '');
      }
    }
  }
  
  onProgress?.(`✅ Agent 1 dokončen: ${totalAdded} nových témat přidáno`);
  
  return {
    topicsFound: totalAdded,
    sourcesUsed: ['RVP ZV 2021', 'Gemini AI'],
    rvpDataIds,
    newTopicsAdded: totalAdded
  };
}

async function enrichRvpTopic(
  subjectCode: SubjectCode,
  grade: number,
  thematicArea: string,
  topic: string,
  existingOutcomes: string[]
): Promise<string[]> {
  const prompt = `Pro předmět ${SUBJECT_NAMES[subjectCode]}, ${grade}. třída ZŠ, tematický celek "${thematicArea}", téma "${topic}":

Existující očekávané výstupy:
${existingOutcomes.map((o, i) => `${i + 1}. ${o}`).join('\n') || 'Žádné'}

Doplň další konkrétní očekávané výstupy podle RVP ZV. Každý výstup by měl začínat "Žák..." a být měřitelný.

Odpověz jako JSON pole stringů, například:
["Žák popíše...", "Žák vysvětlí...", "Žák rozliší..."]`;

  const systemPrompt = `Jsi expert na RVP ZV (Rámcový vzdělávací program pro základní vzdělávání) v České republice. 
Generuješ přesné a relevantní očekávané výstupy pro jednotlivá témata.
Odpovídej POUZE validním JSON polem.`;

  try {
    const response = await callGemini(prompt, systemPrompt);
    const outcomes = parseJsonFromResponse(response);
    
    if (Array.isArray(outcomes)) {
      // Combine existing and new, remove duplicates
      const combined = [...existingOutcomes, ...outcomes];
      return [...new Set(combined)].slice(0, 6); // Max 6 outcomes
    }
  } catch (err) {
    console.error('[Agent1] Error parsing enriched outcomes:', err);
  }
  
  return existingOutcomes;
}

interface GeneratedRvpTopic {
  id?: string;
  thematicArea: string;
  topic: string;
  expectedOutcomes: string[];
  keyCompetencies: string[];
  recommendedHours: number;
  orderIndex: number;
}

async function generateRvpTopics(
  subjectCode: SubjectCode,
  grade: Grade
): Promise<GeneratedRvpTopic[]> {
  const prompt = `Vytvoř strukturu učiva pro předmět ${SUBJECT_NAMES[subjectCode]}, ${grade}. třída ZŠ.

Hodinová dotace: ${HOURS_PER_WEEK[subjectCode]} hodiny týdně = cca ${HOURS_PER_WEEK[subjectCode] * 40} hodin ročně.

Pro každé téma uveď:
1. Tematický celek (např. "Pravěk", "Starověk")
2. Konkrétní téma (např. "Starověký Egypt")
3. Očekávané výstupy (3-5, začínají "Žák...")
4. Klíčové kompetence (z RVP)
5. Doporučený počet hodin
6. Pořadí v ročníku

Odpověz jako JSON pole:
[{
  "thematicArea": "...",
  "topic": "...",
  "expectedOutcomes": ["Žák...", "Žák..."],
  "keyCompetencies": ["kompetence k učení", "kompetence komunikativní"],
  "recommendedHours": 6,
  "orderIndex": 1
}]`;

  const systemPrompt = `Jsi expert na RVP ZV. Generuješ strukturu učiva odpovídající českému vzdělávacímu systému.
Odpovídej POUZE validním JSON polem.`;

  try {
    const response = await callGemini(prompt, systemPrompt);
    const topics = parseJsonFromResponse(response);
    
    if (Array.isArray(topics)) {
      return topics;
    }
  } catch (err) {
    console.error('[Agent1] Error generating topics:', err);
  }
  
  return [];
}

// =====================================================
// AGENT 2: PLANNER
// =====================================================

export interface Agent2Result {
  weeklyPlansCreated: number;
  weeklyPlanIds: string[];
  hoursAllocated: number;
}

/**
 * Agent 2: Planner
 * 
 * Vytváří týdenní plány rozložením RVP témat do 40 týdnů školního roku.
 */
export async function runAgent2(
  subjectCode: SubjectCode,
  grade: Grade,
  rvpData: RvpData[],
  onProgress?: (message: string) => void
): Promise<Agent2Result> {
  onProgress?.('📅 Načítám existující týdenní plány...');
  
  const schoolYear = generateSchoolYear();
  
  // Check for existing plans
  const { data: existingPlans, error: checkError } = await supabase
    .from('curriculum_weekly_plans')
    .select('*')
    .eq('subject_code', subjectCode)
    .eq('grade', grade)
    .eq('school_year', schoolYear);
  
  if (checkError) {
    console.error('[Agent2] Error checking existing plans:', checkError);
    throw checkError;
  }
  
  if (existingPlans && existingPlans.length >= 35) {
    onProgress?.(`📅 Již existuje ${existingPlans.length} týdenních plánů pro tento rok`);
    return {
      weeklyPlansCreated: existingPlans.length,
      weeklyPlanIds: existingPlans.map(p => p.id),
      hoursAllocated: existingPlans.reduce((sum, p) => sum + (p.hours_allocated || 0), 0)
    };
  }
  
  // Delete partial plans if any
  if (existingPlans && existingPlans.length > 0) {
    await supabase
      .from('curriculum_weekly_plans')
      .delete()
      .eq('subject_code', subjectCode)
      .eq('grade', grade)
      .eq('school_year', schoolYear);
  }
  
  onProgress?.('🤖 Generuji rozložení učiva do týdnů...');
  
  // Calculate total hours needed
  const totalHours = rvpData.reduce((sum, r) => sum + (r.recommendedHours || 4), 0);
  const hoursPerWeek = HOURS_PER_WEEK[subjectCode];
  
  onProgress?.(`📊 Celkem ${totalHours} hodin učiva, ${hoursPerWeek} hodiny/týden`);
  
  // Generate weekly distribution using AI
  const weeklyPlans = await generateWeeklyDistribution(
    subjectCode,
    grade,
    rvpData,
    schoolYear,
    onProgress
  );
  
  // Insert plans to database
  const planIds: string[] = [];
  let totalHoursAllocated = 0;
  
  for (const plan of weeklyPlans) {
    const { data: inserted, error: insertError } = await supabase
      .from('curriculum_weekly_plans')
      .insert({
        subject_code: subjectCode,
        grade,
        school_year: schoolYear,
        week_number: plan.weekNumber,
        month_name: WEEK_TO_MONTH[plan.weekNumber] || 'září',
        topic_title: plan.topicTitle,
        topic_description: plan.topicDescription,
        rvp_data_id: plan.rvpDataId,
        learning_goals: plan.learningGoals,
        vocabulary: plan.vocabulary,
        activities_planned: plan.activitiesPlanned,
        hours_allocated: plan.hoursAllocated,
        status: 'draft'
      })
      .select()
      .single();
    
    if (!insertError && inserted) {
      planIds.push(inserted.id);
      totalHoursAllocated += plan.hoursAllocated;
      
      if (plan.weekNumber % 10 === 0) {
        onProgress?.(`📝 Vytvořeno ${plan.weekNumber}/40 týdenních plánů`);
      }
    }
  }
  
  onProgress?.(`✅ Agent 2 dokončen: ${planIds.length} týdenních plánů, ${totalHoursAllocated} hodin`);
  
  return {
    weeklyPlansCreated: planIds.length,
    weeklyPlanIds: planIds,
    hoursAllocated: totalHoursAllocated
  };
}

interface GeneratedWeeklyPlan {
  weekNumber: number;
  topicTitle: string;
  topicDescription?: string;
  rvpDataId?: string;
  learningGoals: string[];
  vocabulary: string[];
  activitiesPlanned: any[];
  hoursAllocated: number;
}

async function generateWeeklyDistribution(
  subjectCode: SubjectCode,
  grade: Grade,
  rvpData: RvpData[],
  schoolYear: string,
  onProgress?: (message: string) => void
): Promise<GeneratedWeeklyPlan[]> {
  
  const hoursPerWeek = HOURS_PER_WEEK[subjectCode];
  const plans: GeneratedWeeklyPlan[] = [];
  
  // Výukové týdny - opakování pouze na konci semestrů (týden 16 a 40)
  const REVIEW_WEEKS = new Set([16, 40]);
  const TEACHING_WEEKS = SCHOOL_WEEKS - REVIEW_WEEKS.size; // 38 týdnů výuky
  
  // Celkový počet hodin RVP
  const totalRvpHours = rvpData.reduce((sum, r) => sum + (r.recommendedHours || 4), 0);
  const totalTeachingHours = TEACHING_WEEKS * hoursPerWeek;
  
  // Poměr pro "natažení" témat na celý rok
  const stretchFactor = Math.max(1, totalTeachingHours / totalRvpHours);
  
  onProgress?.(`📊 Rozkládám ${rvpData.length} témat rovnoměrně na ${TEACHING_WEEKS} týdnů (faktor ${stretchFactor.toFixed(2)}×)`);
  
  // Vypočítat kolik týdnů zabere každé téma
  const topicsWithWeeks = rvpData.map(topic => {
    const originalHours = topic.recommendedHours || 4;
    const stretchedHours = originalHours * stretchFactor;
    const weeksNeeded = Math.max(1, Math.round(stretchedHours / hoursPerWeek));
    return { topic, weeksNeeded };
  });
  
  // Rozložit témata do týdnů
  let currentWeek = 1;
  
  for (const { topic, weeksNeeded } of topicsWithWeeks) {
    for (let weekInTopic = 0; weekInTopic < weeksNeeded && currentWeek <= SCHOOL_WEEKS; weekInTopic++) {
      // Přeskočit týdny s opakováním
      while (REVIEW_WEEKS.has(currentWeek) && currentWeek <= SCHOOL_WEEKS) {
        const isFirstSemester = currentWeek === 16;
        plans.push({
          weekNumber: currentWeek,
          topicTitle: isFirstSemester ? 'Pololetní opakování a test' : 'Závěrečné opakování a test',
          topicDescription: isFirstSemester 
            ? 'Shrnutí učiva 1. pololetí, opakování klíčových témat, pololetní test'
            : 'Shrnutí učiva celého roku, závěrečný test',
          rvpDataId: undefined,
          learningGoals: ['Žák zopakuje probrané učivo', 'Žák prokáže znalosti v testu'],
          vocabulary: [],
          activitiesPlanned: [],
          hoursAllocated: hoursPerWeek
        });
        currentWeek++;
      }
      
      if (currentWeek > SCHOOL_WEEKS) break;
      
      // Název podle pozice v tématu
      let weekTitle = topic.topic;
      if (weeksNeeded > 1) {
        if (weekInTopic === 0) {
          weekTitle = `${topic.topic} - Úvod`;
        } else if (weekInTopic === weeksNeeded - 1) {
          weekTitle = `${topic.topic} - Shrnutí`;
        } else {
          weekTitle = `${topic.topic} (${weekInTopic + 1}/${weeksNeeded})`;
        }
      }
      
      // Rozdělit learning goals napříč týdny tématu
      const goalsPerWeek = Math.ceil((topic.expectedOutcomes?.length || 0) / weeksNeeded);
      const startGoal = weekInTopic * goalsPerWeek;
      const endGoal = Math.min(startGoal + goalsPerWeek, topic.expectedOutcomes?.length || 0);
      
      plans.push({
        weekNumber: currentWeek,
        topicTitle: weekTitle,
        topicDescription: `${topic.thematicArea} - ${topic.topic}`,
        rvpDataId: topic.id,
        learningGoals: topic.expectedOutcomes?.slice(startGoal, endGoal) || [],
        vocabulary: [],
        activitiesPlanned: [],
        hoursAllocated: hoursPerWeek
      });
      
      currentWeek++;
    }
  }
  
  // Doplnit zbývající týdny (pokud nějaké) projekty nebo rozšiřujícím učivem
  while (currentWeek <= SCHOOL_WEEKS) {
    if (REVIEW_WEEKS.has(currentWeek)) {
      const isFirstSemester = currentWeek === 16;
      plans.push({
        weekNumber: currentWeek,
        topicTitle: isFirstSemester ? 'Pololetní opakování a test' : 'Závěrečné opakování a test',
        topicDescription: 'Shrnutí učiva, opakování, test',
        rvpDataId: undefined,
        learningGoals: ['Žák zopakuje probrané učivo'],
        vocabulary: [],
        activitiesPlanned: [],
        hoursAllocated: hoursPerWeek
      });
    } else {
      const month = WEEK_TO_MONTH[currentWeek];
      plans.push({
        weekNumber: currentWeek,
        topicTitle: `Projektová práce / Rozšíření (${month})`,
        topicDescription: 'Projektová práce, mezipředmětové vztahy, rozšíření učiva',
        rvpDataId: undefined,
        learningGoals: ['Žák aplikuje naučené znalosti v projektu'],
        vocabulary: [],
        activitiesPlanned: [],
        hoursAllocated: hoursPerWeek
      });
    }
    currentWeek++;
  }
  
  // Now enrich with AI - add vocabulary and refine
  onProgress?.('🤖 Obohacuji týdenní plány klíčovými pojmy...');
  
  // Process in batches of 10 weeks
  for (let i = 0; i < plans.length; i += 10) {
    const batch = plans.slice(i, i + 10);
    
    try {
      const enrichedBatch = await enrichWeeklyPlansBatch(
        subjectCode,
        grade,
        batch
      );
      
      for (let j = 0; j < enrichedBatch.length && i + j < plans.length; j++) {
        if (enrichedBatch[j].vocabulary?.length > 0) {
          plans[i + j].vocabulary = enrichedBatch[j].vocabulary;
        }
      }
    } catch (err) {
      console.error('[Agent2] Error enriching batch:', err);
    }
    
    onProgress?.(`📚 Obohaceno ${Math.min(i + 10, plans.length)}/${plans.length} týdnů`);
  }
  
  return plans;
}

async function enrichWeeklyPlansBatch(
  subjectCode: SubjectCode,
  grade: Grade,
  plans: GeneratedWeeklyPlan[]
): Promise<GeneratedWeeklyPlan[]> {
  const plansSummary = plans.map(p => ({
    week: p.weekNumber,
    topic: p.topicTitle
  }));
  
  const prompt = `Pro předmět ${SUBJECT_NAMES[subjectCode]}, ${grade}. třída ZŠ, tyto týdny:

${JSON.stringify(plansSummary, null, 2)}

Pro každý týden vygeneruj 5-8 klíčových pojmů (vocabulary), které by žáci měli znát.

Odpověz jako JSON pole:
[
  { "week": 1, "vocabulary": ["pojem1", "pojem2", ...] },
  ...
]`;

  const systemPrompt = `Jsi expert na vzdělávání. Generuješ relevantní klíčové pojmy pro jednotlivá témata.
Pojmy musí být přiměřené věku žáků ${grade}. třídy ZŠ.
Odpovídej POUZE validním JSON.`;

  try {
    const response = await callGemini(prompt, systemPrompt);
    const enriched = parseJsonFromResponse(response);
    
    if (Array.isArray(enriched)) {
      for (const item of enriched) {
        const planIndex = plans.findIndex(p => p.weekNumber === item.week);
        if (planIndex >= 0 && Array.isArray(item.vocabulary)) {
          plans[planIndex].vocabulary = item.vocabulary;
        }
      }
    }
  } catch (err) {
    console.error('[Agent2] Error parsing enriched plans:', err);
  }
  
  return plans;
}

// =====================================================
// AGENT 3: ARCHITECT
// =====================================================

export interface Agent3Result {
  contentSpecsCreated: number;
  specIds: string[];
  byType: Record<ContentType, number>;
}

/**
 * Agent 3: Architect
 * 
 * Vytváří specifikace pro jednotlivé materiály na základě týdenních plánů.
 */
export async function runAgent3(
  subjectCode: SubjectCode,
  grade: Grade,
  weeklyPlans: WeeklyPlan[],
  onProgress?: (message: string) => void,
  demoMode: boolean = false
): Promise<Agent3Result> {
  onProgress?.('📐 Vytvářím specifikace materiálů...');
  
  const specIds: string[] = [];
  const byType: Record<ContentType, number> = {
    board: 0,
    worksheet: 0,
    text: 0,
    quiz: 0
  };
  
  for (const week of weeklyPlans) {
    // Skip review weeks for now
    if (week.topicTitle.includes('opakování') || week.topicTitle.includes('Opakování')) {
      continue;
    }
    
    onProgress?.(`📝 Týden ${week.weekNumber}: ${week.topicTitle}`);
    
    // Generate specs for this week (demo mode = 5 specific materials)
    const specs = await generateContentSpecs(subjectCode, grade, week, demoMode);
    
    for (const spec of specs) {
      const { data: inserted, error } = await supabase
        .from('curriculum_content_specs')
        .insert({
          weekly_plan_id: week.id,
          content_type: spec.contentType,
          content_subtype: spec.contentSubtype,
          title: spec.title,
          description: spec.description,
          difficulty: spec.difficulty,
          target_duration_minutes: spec.targetDurationMinutes,
          question_types: spec.questionTypes,
          question_count: spec.questionCount,
          specific_requirements: spec.specificRequirements,
          learning_objectives: spec.learningObjectives,
          bloom_level: spec.bloomLevel,
          priority: spec.priority,
          status: 'pending',
          assigned_to: 'agent-4'
        })
        .select()
        .single();
      
      if (!error && inserted) {
        specIds.push(inserted.id);
        byType[spec.contentType as ContentType]++;
      }
    }
  }
  
  onProgress?.(`✅ Agent 3 dokončen: ${specIds.length} specifikací vytvořeno`);
  
  return {
    contentSpecsCreated: specIds.length,
    specIds,
    byType
  };
}

interface GeneratedContentSpec {
  contentType: ContentType;
  contentSubtype?: string;
  title: string;
  description?: string;
  difficulty: Difficulty;
  targetDurationMinutes: number;
  questionTypes?: QuestionType[];
  questionCount?: number;
  specificRequirements?: string;
  learningObjectives: string[];
  bloomLevel?: string;
  priority: number;
}

async function generateContentSpecs(
  subjectCode: SubjectCode,
  grade: Grade,
  week: WeeklyPlan,
  demoMode: boolean = false
): Promise<GeneratedContentSpec[]> {
  const specs: GeneratedContentSpec[] = [];
  
  // DEMO MODE: 5 materiálů pro Starověké Řecko
  if (demoMode) {
    const isGreece = week.topicTitle.toLowerCase().includes('řecko') || week.topicTitle.toLowerCase().includes('recko');
    const topicName = isGreece ? 'Starověké Řecko' : week.topicTitle;
    
    // 1. Výkladový text - Řecké městské státy
    specs.push({
      contentType: 'text',
      contentSubtype: 'ucebni_text',
      title: `${topicName} - Řecké městské státy (polis)`,
      description: `Učební text o vzniku řeckých městských států, Athénách a Spartě, řecké demokracii`,
      difficulty: 'medium',
      targetDurationMinutes: 12,
      learningObjectives: [
        'Žák vysvětlí pojem polis a její význam',
        'Žák porovná Athény a Spartu',
        'Žák popíše vznik athénské demokracie'
      ],
      bloomLevel: 'porozumeni',
      priority: 1,
      specificRequirements: `Klíčové pojmy: polis, agora, akropole, Athény, Sparta, demokracie, Periklés, oligarchie. Doplnit obrázky: mapa starověkého Řecka, Parthenón, řecký amfiteátr.`
    });
    
    // 2. Procvičování (VividBoard) - Řečtí bohové a mytologie
    specs.push({
      contentType: 'board',
      contentSubtype: 'procvicovani',
      title: `${topicName} - Procvičování: Řečtí bohové a mytologie`,
      description: `Interaktivní procvičování o řeckých bozích, hrdinech a mytologických příbězích`,
      difficulty: 'medium',
      targetDurationMinutes: 10,
      questionTypes: ['abc', 'open'],
      questionCount: 8,
      learningObjectives: [
        'Žák vyjmenuje hlavní olympské bohy',
        'Žák přiřadí atributy k jednotlivým bohům',
        'Žák převypráví řecký mýtus'
      ],
      bloomLevel: 'aplikace',
      priority: 2,
      specificRequirements: 'Zahrnout otázky: Zeus, Poseidón, Athéna, Apollón, Héra, Hádes, Olymp, Héraklés, Odysseus'
    });
    
    // 3. Pracovní list - Řecko-perské války
    specs.push({
      contentType: 'worksheet',
      contentSubtype: 'pracovni_list',
      title: `${topicName} - Pracovní list: Řecko-perské války`,
      description: `Pracovní list o konfliktu Řeků s Persií, bitvách u Marathónu a Thermopyl`,
      difficulty: 'medium',
      targetDurationMinutes: 15,
      questionTypes: ['fill-blank', 'free-answer', 'multiple-choice'],
      questionCount: 6,
      learningObjectives: [
        'Žák vysvětlí příčiny řecko-perských válek',
        'Žák popíše průběh bitvy u Marathónu',
        'Žák zhodnotí význam bitvy u Thermopyl'
      ],
      bloomLevel: 'aplikace',
      priority: 3,
      specificRequirements: 'Zahrnout: Dareios, Xerxés, Marathón (490 př.n.l.), Thermopyly, Leonidas, 300 Sparťanů, Salamis, Themistoklés'
    });
    
    // 4. Písemka/Test - Alexandr Veliký
    specs.push({
      contentType: 'board',
      contentSubtype: 'pisemka',
      title: `${topicName} - Písemka: Alexandr Veliký a helénismus`,
      description: `Test znalostí o Makedonii, Alexandrovi Velikém a šíření řecké kultury`,
      difficulty: 'medium',
      targetDurationMinutes: 15,
      questionTypes: ['open', 'abc'],
      questionCount: 8,
      learningObjectives: [
        'Žák vysvětlí vzestup Makedonie',
        'Žák charakterizuje osobnost Alexandra Velikého',
        'Žák popíše rozsah Alexandrovy říše a helénismus'
      ],
      bloomLevel: 'hodnoceni',
      priority: 4,
      specificRequirements: 'Většina otázek musí být OTEVŘENÉ. Témata: Filip II. Makedonský, Alexandr, bitva u Gaugamel, Persepolis, Egypt, Alexandrie, diadochové, helénismus'
    });
    
    // 5. Interaktivní lekce - Život ve starověkém Řecku
    specs.push({
      contentType: 'board',
      contentSubtype: 'lekce',
      title: `${topicName} - Interaktivní lekce: Život v Řecku`,
      description: `Kompletní lekce o každodenním životě Řeků - společnost, vzdělání, olympijské hry, filozofie`,
      difficulty: 'medium',
      targetDurationMinutes: 25,
      questionTypes: ['abc', 'board', 'voting', 'matching'],
      questionCount: 12,
      learningObjectives: [
        'Žák popíše strukturu řecké společnosti',
        'Žák vysvětlí význam olympijských her',
        'Žák charakterizuje řecké divadlo a filozofii',
        'Žák popíše řecké vzdělávání'
      ],
      bloomLevel: 'synteza',
      priority: 5,
      specificRequirements: 'Kombinace výkladu s interaktivními prvky. Témata: občané/metoikové/otroci, gymnázium, Olympie, Sokrates/Platón/Aristoteles, tragédie/komedie. Hlasování: "Chtěl bys žít v Athénách nebo ve Spartě?"'
    });
    
    return specs;
  }
  
  // STANDARD MODE: Full set per week
  // - 3x procvičování (board) v různých úrovních
  // - 1x učební text
  // - 2x pracovní list
  
  // 1. Easy procvičování
  specs.push({
    contentType: 'board',
    contentSubtype: 'procvicovani',
    title: `${week.topicTitle} - Procvičování (lehké)`,
    description: `Základní procvičování tématu ${week.topicTitle} pro slabší žáky`,
    difficulty: 'easy',
    targetDurationMinutes: 10,
    questionTypes: ['abc', 'true-false'],
    questionCount: 8,
    learningObjectives: week.learningGoals?.slice(0, 2) || [],
    bloomLevel: 'znalost',
    priority: 1
  });
  
  // 2. Medium procvičování
  specs.push({
    contentType: 'board',
    contentSubtype: 'procvicovani',
    title: `${week.topicTitle} - Procvičování (střední)`,
    description: `Standardní procvičování tématu ${week.topicTitle}`,
    difficulty: 'medium',
    targetDurationMinutes: 15,
    questionTypes: ['abc', 'fill-blank', 'matching'],
    questionCount: 10,
    learningObjectives: week.learningGoals?.slice(0, 3) || [],
    bloomLevel: 'porozumeni',
    priority: 2
  });
  
  // 3. Hard procvičování
  specs.push({
    contentType: 'board',
    contentSubtype: 'procvicovani',
    title: `${week.topicTitle} - Procvičování (těžké)`,
    description: `Náročné procvičování tématu ${week.topicTitle} pro pokročilé žáky`,
    difficulty: 'hard',
    targetDurationMinutes: 20,
    questionTypes: ['abc', 'fill-blank', 'open', 'ordering'],
    questionCount: 12,
    learningObjectives: week.learningGoals || [],
    bloomLevel: 'aplikace',
    priority: 3
  });
  
  // 4. Učební text
  specs.push({
    contentType: 'text',
    contentSubtype: 'ucebni_text',
    title: `${week.topicTitle} - Výkladový text`,
    description: `Hlavní učební text k tématu ${week.topicTitle}`,
    difficulty: 'medium',
    targetDurationMinutes: 15,
    learningObjectives: week.learningGoals || [],
    bloomLevel: 'porozumeni',
    priority: 1,
    specificRequirements: `Klíčové pojmy: ${week.vocabulary?.join(', ') || 'dle tématu'}`
  });
  
  // 5. Pracovní list - základ
  specs.push({
    contentType: 'worksheet',
    contentSubtype: 'pracovni_list',
    title: `${week.topicTitle} - Pracovní list`,
    description: `Pracovní list k tématu ${week.topicTitle}`,
    difficulty: 'medium',
    targetDurationMinutes: 20,
    questionTypes: ['fill-blank', 'open', 'matching'],
    questionCount: 8,
    learningObjectives: week.learningGoals?.slice(0, 2) || [],
    bloomLevel: 'aplikace',
    priority: 2
  });
  
  // 6. Pracovní list - rozšířený
  specs.push({
    contentType: 'worksheet',
    contentSubtype: 'pracovni_list_rozsireny',
    title: `${week.topicTitle} - Rozšířený pracovní list`,
    description: `Rozšířený pracovní list pro náročnější práci s tématem`,
    difficulty: 'hard',
    targetDurationMinutes: 30,
    questionTypes: ['open', 'ordering', 'image-label'],
    questionCount: 10,
    learningObjectives: week.learningGoals || [],
    bloomLevel: 'analyza',
    priority: 3
  });
  
  return specs;
}

// =====================================================
// AGENT 4: CREATOR (Placeholder - most complex)
// =====================================================

export interface Agent4Result {
  draftsGenerated: number;
  draftIds: string[];
  tokensUsed: number;
  averageQualityScore: number;
}

/**
 * Agent 4: Creator
 * 
 * Generuje samotný obsah materiálů podle specifikací.
 * Toto je nejkomplexnější agent - bude implementován postupně.
 */
export async function runAgent4(
  contentSpecs: ContentSpec[],
  onProgress?: (message: string) => void
): Promise<Agent4Result> {
  onProgress?.('✏️ Generuji obsah materiálů...');
  
  const draftIds: string[] = [];
  let totalTokens = 0;
  let totalQuality = 0;
  
  // Process specs in order of priority
  const sortedSpecs = [...contentSpecs].sort((a, b) => a.priority - b.priority);
  
  for (let i = 0; i < sortedSpecs.length; i++) {
    const spec = sortedSpecs[i];
    
    onProgress?.(`📝 Generuji ${i + 1}/${sortedSpecs.length}: ${spec.title}`);
    
    try {
      // Update spec status
      await supabase
        .from('curriculum_content_specs')
        .update({ status: 'generating' })
        .eq('id', spec.id);
      
      // Generate content based on type and subtype
      let content: any;
      let tokensUsed = 0;
      
      switch (spec.contentType) {
        case 'board':
          // Check for special subtypes
          if (spec.contentSubtype === 'lekce') {
            const lessonResult = await generateInteractiveLessonContent(spec);
            content = lessonResult.content;
            tokensUsed = lessonResult.tokensUsed || 0;
          } else if (spec.contentSubtype === 'pisemka') {
            const testResult = await generateTestContent(spec);
            content = testResult.content;
            tokensUsed = testResult.tokensUsed || 0;
          } else {
            const boardResult = await generateBoardContent(spec);
            content = boardResult.content;
            tokensUsed = boardResult.tokensUsed || 0;
          }
          break;
        case 'worksheet':
          const worksheetResult = await generateWorksheetContent(spec);
          content = worksheetResult.content;
          tokensUsed = worksheetResult.tokensUsed || 0;
          break;
        case 'text':
          const textResult = await generateTextContent(spec);
          content = textResult.content;
          tokensUsed = textResult.tokensUsed || 0;
          break;
        default:
          continue;
      }
      
      // VALIDACE: Přeskočit prázdný content
      let isValid = true;
      if (spec.contentType === 'board') {
        if (!content?.slides || content.slides.length === 0) {
          console.error('[Agent4] ❌ Board nemá slidy:', spec.title);
          isValid = false;
        }
      } else if (spec.contentType === 'worksheet') {
        if (!content?.blocks || content.blocks.length === 0) {
          console.error('[Agent4] ❌ Worksheet nemá bloky:', spec.title);
          isValid = false;
        }
      } else if (spec.contentType === 'text') {
        if (!content?.content || content.content.length < 50) {
          console.error('[Agent4] ❌ Text je příliš krátký:', spec.title, content?.content?.length || 0);
          isValid = false;
        }
      }
      
      if (!isValid) {
        onProgress?.(`⚠️ ${spec.title}: Generování selhalo, zkouším znovu...`);
        console.log(`[Agent4] ⚠️ Content invalid for ${spec.title}, retrying...`);
        console.log(`[Agent4] Invalid content was:`, JSON.stringify(content).substring(0, 500));
        
        // RETRY: Zkusit znovu s větším důrazem
        let retryContent = null;
        for (let retry = 0; retry < 2; retry++) {
          try {
            console.log(`[Agent4] Retry ${retry + 1}/2 for ${spec.title}`);
            // Wait a bit before retry
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            if (spec.contentType === 'board') {
              const result = await generateBoardContent(spec);
              console.log(`[Agent4] Retry result - slides:`, result.content?.slides?.length || 0);
              if (result.content?.slides?.length > 0) {
                retryContent = result.content;
                break;
              }
            } else if (spec.contentType === 'worksheet') {
              const result = await generateWorksheetContent(spec);
              console.log(`[Agent4] Retry result - blocks:`, result.content?.blocks?.length || 0);
              if (result.content?.blocks?.length > 0) {
                retryContent = result.content;
                break;
              }
            } else if (spec.contentType === 'text') {
              const result = await generateTextContent(spec);
              console.log(`[Agent4] Retry result - content length:`, result.content?.content?.length || 0);
              if (result.content?.content?.length > 50) {
                retryContent = result.content;
                break;
              }
            }
          } catch (retryErr: any) {
            console.error(`[Agent4] Retry ${retry + 1} failed:`, retryErr.message || retryErr);
          }
        }
        
        if (retryContent) {
          content = retryContent;
          console.log('[Agent4] ✅ Retry succeeded for:', spec.title);
          onProgress?.(`✅ ${spec.title}: Retry úspěšný`);
        } else {
          console.error('[Agent4] ❌ Všechny pokusy selhaly pro:', spec.title);
          onProgress?.(`❌ ${spec.title}: Všechny pokusy selhaly`);
          await supabase
            .from('curriculum_content_specs')
            .update({ status: 'failed' })
            .eq('id', spec.id);
          continue; // Skip this spec
        }
      }
      
      // Calculate quality score (simple heuristic)
      const qualityScore = calculateQualityScore(content, spec);
      
      // Save draft
      const { data: draft, error } = await supabase
        .from('curriculum_content_drafts')
        .insert({
          spec_id: spec.id,
          version: 1,
          content_json: content,
          metadata: {
            generatedBy: 'agent-4',
            modelUsed: 'gemini-3-pro',
            tokensUsed,
            generationTimeMs: Date.now()
          },
          quality_score: qualityScore,
          status: 'draft'
        })
        .select()
        .single();
      
      if (!error && draft) {
        draftIds.push(draft.id);
        totalTokens += tokensUsed;
        totalQuality += qualityScore;
        console.log('[Agent4] ✅ Draft saved:', spec.title);
        
        // Update spec status
        await supabase
          .from('curriculum_content_specs')
          .update({ status: 'draft' })
          .eq('id', spec.id);
      } else {
        console.error('[Agent4] ❌ Draft save failed:', error?.message);
      }
    } catch (err) {
      console.error('[Agent4] Error generating content for spec:', spec.id, err);
      
      await supabase
        .from('curriculum_content_specs')
        .update({ status: 'pending' })
        .eq('id', spec.id);
    }
  }
  
  const avgQuality = draftIds.length > 0 ? Math.round(totalQuality / draftIds.length) : 0;
  
  onProgress?.(`✅ Agent 4 dokončen: ${draftIds.length} materiálů vygenerováno`);
  
  return {
    draftsGenerated: draftIds.length,
    draftIds,
    tokensUsed: totalTokens,
    averageQualityScore: avgQuality
  };
}

async function generateBoardContent(spec: ContentSpec): Promise<{ content: any; tokensUsed?: number }> {
  const questionCount = spec.questionCount || 8;
  
  const prompt = `Vytvoř interaktivní VividBoard (prezentaci s kvízy) na téma: "${spec.title}"

Specifikace:
- Obtížnost: ${spec.difficulty}
- Doba trvání: ${spec.targetDurationMinutes} minut
- Počet otázek: ${questionCount}
- Vzdělávací cíle: ${spec.learningObjectives?.join('; ') || 'dle tématu'}

DŮLEŽITÉ - přesná struktura slidů:

1. INFO SLIDE (úvodní/závěrečný):
{
  "id": "slide-1",
  "type": "info",
  "order": 0,
  "title": "Nadpis slidu",
  "content": "<p>HTML obsah slidu...</p>"
}

2. ABC ACTIVITY slide (výběr z možností):
{
  "id": "slide-2",
  "type": "activity",
  "activityType": "abc",
  "order": 1,
  "question": "Kdy byl založen Řím?",
  "points": 1,
  "options": [
    { "id": "a", "label": "A", "content": "753 př. n. l.", "isCorrect": true },
    { "id": "b", "label": "B", "content": "509 př. n. l.", "isCorrect": false },
    { "id": "c", "label": "C", "content": "476 n. l.", "isCorrect": false },
    { "id": "d", "label": "D", "content": "27 př. n. l.", "isCorrect": false }
  ],
  "explanation": "Řím byl podle legendy založen roku 753 př. n. l."
}

3. OPEN ACTIVITY slide (otevřená otázka):
{
  "id": "slide-3",
  "type": "activity",
  "activityType": "open",
  "order": 2,
  "question": "Jak se jmenoval první římský císař?",
  "points": 1,
  "correctAnswers": ["Augustus", "Octavianus", "Gaius Octavius"],
  "caseSensitive": false,
  "explanation": "První římský císař byl Augustus (Octavianus)."
}

Vytvoř ${questionCount + 2} slidů:
- 1 info (úvod s názvem tématu)
- ${questionCount} activity (střídej abc a open, většinou abc)
- 1 info (závěr/shrnutí)

ODPOVĚZ POUZE VALIDNÍM JSON:
{
  "title": "Název boardu",
  "slides": [...]
}`;

  const systemPrompt = `Jsi expert na tvorbu vzdělávacích materiálů pro ZŠ.
Tvořiš interaktivní prezentace s kvízy.
Obsah musí být fakticky správný a přiměřený věku žáků.
VŽDY použij přesně tu strukturu, která je v zadání.
Info slidy mají title a content (HTML).
Activity slidy mají question, options/correctAnswers, explanation.
Odpovídej POUZE validním JSON bez markdown.`;

  // Retry up to 3 times
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`[Agent4] Board attempt ${attempt}/3 for "${spec.title}"`);
      const response = await callGemini(prompt, systemPrompt);
      console.log('[Agent4] Board response length:', response.length);
      console.log('[Agent4] Board response preview:', response.substring(0, 500));
      
      const content = parseJsonFromResponse(response);
      console.log('[Agent4] Board parsed:', { 
        title: content.title, 
        slidesCount: content.slides?.length || 0,
        firstSlide: content.slides?.[0] ? { type: content.slides[0].type, id: content.slides[0].id } : null
      });
      
      if (!content.slides || content.slides.length === 0) {
        console.error('[Agent4] Board has no slides! Response:', response.substring(0, 1000));
        if (attempt < 3) {
          console.log('[Agent4] Retrying...');
          continue;
        }
        throw new Error('Generated board has no slides after 3 attempts');
      }
      
      return { content, tokensUsed: response.length };
    } catch (err: any) {
      console.error(`[Agent4] Error generating board (attempt ${attempt}):`, err.message || err);
      if (attempt >= 3) {
        console.error('[Agent4] Board spec was:', spec.title);
        // Return empty but log the error
        return { content: { title: spec.title, slides: [] } };
      }
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  return { content: { title: spec.title, slides: [] } };
}

async function generateWorksheetContent(spec: ContentSpec): Promise<{ content: any; tokensUsed?: number }> {
  const questionCount = spec.questionCount || 5;
  
  const prompt = `Vytvoř PRACOVNÍ LIST na téma: "${spec.title}"

Pracovní list má ${questionCount + 2} bloků. Odpověz PŘESNĚ v tomto formátu:

{
  "title": "${spec.title}",
  "description": "Pracovní list k tématu",
  "blocks": [
    {"id": "b1", "type": "heading", "order": 0, "width": "full", "content": {"text": "${spec.title}", "level": "h1"}},
    {"id": "b2", "type": "paragraph", "order": 1, "width": "full", "content": {"html": "<p>Vyplň následující úlohy:</p>"}},
    {"id": "b3", "type": "free-answer", "order": 2, "width": "full", "content": {"question": "Otázka 1...", "lines": 3, "sampleAnswer": "Vzorová odpověď..."}},
    {"id": "b4", "type": "free-answer", "order": 3, "width": "full", "content": {"question": "Otázka 2...", "lines": 3, "sampleAnswer": "Vzorová odpověď..."}},
    {"id": "b5", "type": "multiple-choice", "order": 4, "width": "full", "content": {"question": "Otázka 3...", "options": [{"id": "a", "text": "Možnost A", "isCorrect": true}, {"id": "b", "text": "Možnost B", "isCorrect": false}]}},
    {"id": "b6", "type": "free-answer", "order": 5, "width": "full", "content": {"question": "Otázka 4...", "lines": 4, "sampleAnswer": "..."}},
    {"id": "b7", "type": "paragraph", "order": 6, "width": "full", "content": {"html": "<p><strong>Shrnutí:</strong> Co ses naučil/a?</p>"}}
  ]
}

TYPY BLOKŮ:
- heading: {"text": "...", "level": "h1"}
- paragraph: {"html": "<p>...</p>"}
- free-answer: {"question": "...", "lines": 3, "sampleAnswer": "..."}
- multiple-choice: {"question": "...", "options": [{"id": "a", "text": "...", "isCorrect": true/false}, ...]}

Téma: ${spec.title}
Cíle: ${spec.learningObjectives?.join('; ') || 'dle tématu'}

VYTVOŘ ${questionCount + 2} BLOKŮ s reálným obsahem pro toto téma!
ODPOVĚZ POUZE VALIDNÍM JSON!`;

  const systemPrompt = `Jsi expert na tvorbu pracovních listů pro ZŠ.
Obsah musí být fakticky správný a přiměřený věku žáků.
VŽDY použij přesně tu strukturu bloků, která je v zadání.
Každý blok musí mít id, type, order, width a content.
Odpovídej POUZE validním JSON bez markdown.`;

  try {
    const response = await callGemini(prompt, systemPrompt);
    console.log('[Agent4] Worksheet response length:', response.length);
    console.log('[Agent4] Worksheet response preview:', response.substring(0, 800));
    
    const content = parseJsonFromResponse(response);
    console.log('[Agent4] Worksheet parsed:', { 
      title: content.title, 
      blocksCount: content.blocks?.length || 0,
      firstBlock: content.blocks?.[0] 
    });
    
    if (!content.blocks || content.blocks.length === 0) {
      console.error('[Agent4] Worksheet has no blocks! Full response:', response);
      
      // Retry once with simpler prompt
      console.log('[Agent4] Retrying worksheet generation...');
      const retryPrompt = `Vytvoř pracovní list "${spec.title}" s 5 bloky.
Odpověz POUZE tímto JSON (doplň skutečný obsah):
{"title":"${spec.title}","blocks":[
{"id":"b1","type":"heading","order":0,"width":"full","content":{"text":"${spec.title}","level":"h1"}},
{"id":"b2","type":"paragraph","order":1,"width":"full","content":{"html":"<p>Úvodní text...</p>"}},
{"id":"b3","type":"free-answer","order":2,"width":"full","content":{"question":"Otázka 1?","lines":3,"sampleAnswer":"Odpověď..."}},
{"id":"b4","type":"free-answer","order":3,"width":"full","content":{"question":"Otázka 2?","lines":3,"sampleAnswer":"Odpověď..."}},
{"id":"b5","type":"multiple-choice","order":4,"width":"full","content":{"question":"Otázka 3?","options":[{"id":"a","text":"Možnost A","isCorrect":true},{"id":"b","text":"Možnost B","isCorrect":false}]}}
]}`;
      const retryResponse = await callGemini(retryPrompt, 'Odpověz POUZE validním JSON.');
      const retryContent = parseJsonFromResponse(retryResponse);
      
      if (retryContent.blocks && retryContent.blocks.length > 0) {
        console.log('[Agent4] Retry successful:', retryContent.blocks.length, 'blocks');
        return { content: retryContent, tokensUsed: response.length + retryResponse.length };
      }
      
      throw new Error('Generated worksheet has no blocks');
    }
    
    return { content, tokensUsed: response.length };
  } catch (err: any) {
    console.error('[Agent4] Error generating worksheet:', err.message || err);
    console.error('[Agent4] Worksheet spec was:', spec.title);
    return { content: { title: spec.title, blocks: [] } };
  }
}

async function generateTextContent(spec: ContentSpec): Promise<{ content: any; tokensUsed?: number }> {
  // Extrahovat téma z titulku (např. "Starověké Řecko - Výkladový text" -> "Starověké Řecko")
  const topicName = spec.title.split(' - ')[0].trim();
  
  const prompt = `Vytvoř STRUČNÝ učební text na téma: "${topicName}"

Vzdělávací cíle: ${spec.learningObjectives?.join('; ') || 'dle tématu'}
${spec.specificRequirements ? `Klíčové pojmy: ${spec.specificRequirements}` : ''}

STRUKTURA (krátká a přehledná):
1. Úvod (1 odstavec, max 3 věty)
2. Hlavní obsah (2-3 sekce, každá max 2 odstavce)
3. Infobox "Věděl jsi?" (3-4 zajímavosti v bodech)
4. Infobox "Klíčové pojmy" (5-7 pojmů s definicemi)

FORMÁT - použij tyto HTML elementy:
- <h2> pro nadpisy sekcí
- <p> pro odstavce (max 4-5 vět)
- <div class="infobox info"> pro "Věděl jsi?"
- <div class="infobox warning"> pro "Pozor!" nebo důležité informace
- <div class="infobox success"> pro "Klíčové pojmy"
- <ul><li> pro seznamy

PŘÍKLAD struktury:
<h2>Úvod</h2>
<p>Krátký úvodní odstavec...</p>

<h2>První sekce</h2>
<p>Text sekce...</p>

<div class="infobox info">
<strong>💡 Věděl jsi?</strong>
<ul>
<li>Zajímavost 1</li>
<li>Zajímavost 2</li>
</ul>
</div>

<h2>Druhá sekce</h2>
<p>Text...</p>

<div class="infobox success">
<strong>📚 Klíčové pojmy</strong>
<ul>
<li><strong>Pojem</strong> - definice</li>
</ul>
</div>

Odpověz jako JSON:
{
  "title": "${topicName}",
  "description": "Krátký popis (1 věta)",
  "content": "<h2>...</h2><p>...</p>..."
}

PRAVIDLA:
- Text má být STRUČNÝ ale INFORMATIVNÍ (cca 250-350 slov)
- Používej jednoduché věty vhodné pro žáky ZŠ
- Fakta musí být PŘESNÁ a RELEVANTNÍ k tématu "${topicName}"
- Odpověz POUZE validním JSON`;

  const systemPrompt = `Jsi expert na stručné učební texty pro ZŠ.
Tvořiš KRÁTKÉ, přehledné texty s infoboxy a seznamy.
Text je vždy RELEVANTNÍ k zadanému tématu.
Používáš jednoduché věty a správnou terminologii.
Odpovídej POUZE validním JSON.`;

  try {
    console.log('[Agent4] Generating text for:', spec.title);
    const response = await callGemini(prompt, systemPrompt);
    console.log('[Agent4] Text response length:', response.length);
    console.log('[Agent4] Text response preview:', response.substring(0, 500));
    
    const content = parseJsonFromResponse(response);
    console.log('[Agent4] Text parsed:', { 
      title: content.title, 
      contentLength: content.content?.length || 0,
      preview: content.content?.substring(0, 200)
    });
    
    if (!content.content || content.content.length < 100) {
      console.error('[Agent4] Text content too short! Response was:', response.substring(0, 1000));
      throw new Error('Generated text is too short');
    }
    
    return { content, tokensUsed: response.length };
  } catch (err: any) {
    console.error('[Agent4] Error generating text:', err.message || err);
    console.error('[Agent4] Spec was:', spec.title);
    // Vrátit prázdný content místo pádu - validace v runAgent4 to zachytí
    return { content: { title: spec.title, content: '', description: '' } };
  }
}

/**
 * Generuje interaktivní lekci podle metody E-U-R (Evokace-Uvědomění-Reflexe)
 * Konstruktivistický přístup - žáci si znalosti budují společně
 */
async function generateInteractiveLessonContent(spec: ContentSpec): Promise<{ content: any; tokensUsed?: number }> {
  const topicName = spec.title.split(' - ')[0].trim();
  
  const prompt = `Vytvoř KONSTRUKTIVISTICKOU lekci na téma: "${topicName}"

PEDAGOGICKÝ PŘÍSTUP: Metoda E-U-R (Evokace - Uvědomění - Reflexe)
- Žáci si znalosti budují SPOLEČNĚ, ne je jen přijímají
- Důraz na diskuzi, sdílení a vlastní objevování
- NE ověřování znalostí, ale SPOLEČNÉ budování porozumění

Vzdělávací cíle: ${spec.learningObjectives?.join('; ') || 'dle tématu'}

STRUKTURA LEKCE (10 slidů):

=== FÁZE 1: EVOKACE (Co už víme? Co nás zajímá?) ===
1. INFO - "🤔 Co už víte o ${topicName}?" (motivační úvod, emoji)
2. BOARD - Brainstorming: "Napište vše, co vás napadne k tématu ${topicName}"
3. VOTING - "Která oblast vás zajímá nejvíce?" (možnosti z tématu)

=== FÁZE 2: UVĚDOMĚNÍ (Objevujeme nové) ===
4. INFO - Klíčová informace 1 (krátký výklad s emoji 📚)
5. INFO - Klíčová informace 2 (krátký výklad s emoji 🔍)
6. BOARD - "Co vás na tom překvapilo? Co je pro vás nové?"
7. INFO - Zajímavost nebo propojení s dneškem (emoji 💡)

=== FÁZE 3: REFLEXE (Co jsme se naučili?) ===
8. VOTING - Reflexní hlasování: "Která informace pro vás byla nejzajímavější?"
9. BOARD - "Co byste chtěli vědět víc? Jaké máte otázky?"
10. INFO - Shrnutí s emoji 🎯 a otázka na příště

STRUKTURY SLIDŮ:

INFO slide:
{ "id": "slide-1", "type": "info", "order": 0, "title": "🤔 Nadpis s emoji", "content": "<p>Krátký text (2-3 věty)...</p>" }

VOTING ACTIVITY:
{ "id": "slide-3", "type": "activity", "activityType": "voting", "order": 2, "question": "Otázka pro hlasování?", "votingType": "single", "options": [{"id": "v1", "label": "A", "content": "Možnost 1"}, {"id": "v2", "label": "B", "content": "Možnost 2"}, {"id": "v3", "label": "C", "content": "Možnost 3"}] }

BOARD ACTIVITY:
{ "id": "slide-2", "type": "activity", "activityType": "board", "order": 1, "question": "Otevřená otázka pro diskuzi...", "boardType": "text", "allowMedia": false }

PRAVIDLA:
- Používej EMOJI v nadpisech (🤔 📚 🔍 💡 🎯 ⭐)
- INFO slidy mají být KRÁTKÉ (max 3 věty)
- BOARD a VOTING jsou pro SDÍLENÍ, ne testování
- Atmosféra je zvídavá a bezpečná

ODPOVĚZ POUZE VALIDNÍM JSON:
{
  "title": "${topicName} - Interaktivní lekce",
  "slides": [...]
}`;

  const systemPrompt = `Jsi expert na konstruktivistickou pedagogiku a metodu E-U-R.
Vytváříš lekce kde žáci OBJEVUJÍ a SDÍLEJÍ, ne jen pasivně přijímají.
Používáš emoji pro vizuální přitažlivost.
Otázky jsou otevřené a zvou k přemýšlení.
Odpovídej POUZE validním JSON.`;

  try {
    const response = await callGemini(prompt, systemPrompt);
    console.log('[Agent4] Lesson response length:', response.length);
    const content = parseJsonFromResponse(response);
    console.log('[Agent4] Lesson parsed:', { title: content.title, slidesCount: content.slides?.length || 0 });
    
    if (!content.slides || content.slides.length === 0) {
      throw new Error('Lesson has no slides');
    }
    return { content, tokensUsed: response.length };
  } catch (err: any) {
    console.error('[Agent4] Error generating lesson:', err.message || err);
    return { content: { title: spec.title, slides: [] } };
  }
}

/**
 * Generuje písemku/test - DŮRAZ na otevřené otázky kde žáci formulují své názory
 */
async function generateTestContent(spec: ContentSpec): Promise<{ content: any; tokensUsed?: number }> {
  const questionCount = spec.questionCount || 8;
  
  const prompt = `Vytvoř PÍSEMKU na téma: "${spec.title}"

DŮLEŽITÉ: Písemka má testovat POROZUMĚNÍ a schopnost FORMULOVAT VLASTNÍ NÁZORY.
Většina otázek musí být OTEVŘENÉ (open) kde žáci píší odpovědi vlastními slovy!

Specifikace:
- Počet otázek: ${questionCount}
- Typ otázek: 70% otevřené (open), 30% ABC
- Vzdělávací cíle: ${spec.learningObjectives?.join('; ') || 'dle tématu'}

Struktura písemky (${questionCount + 2} slidů):
1. INFO slide - Nadpis písemky + instrukce
2-${questionCount + 1}: ACTIVITY slides - většina OPEN otázek!
${questionCount + 2}. INFO slide - Konec písemky

TYPY OTÁZEK:

1. OPEN (otevřená - žák píše odpověď):
{
  "id": "slide-2",
  "type": "activity",
  "activityType": "open",
  "order": 1,
  "question": "Vysvětli vlastními slovy, proč byl starověký Egypt závislý na řece Nil.",
  "points": 3,
  "correctAnswers": ["nil přinášel vodu", "záplavy", "zavlažování", "úrodná půda"],
  "caseSensitive": false,
  "explanation": "Nil byl zdrojem života - přinášel vodu, záplavy přinášely úrodnou půdu, umožňoval zavlažování polí."
}

2. ABC (pouze pro rychlou kontrolu faktů):
{
  "id": "slide-5",
  "type": "activity",
  "activityType": "abc",
  "order": 4,
  "question": "Ve kterém roce byl založen Řím podle legendy?",
  "points": 1,
  "options": [
    {"id": "a", "label": "A", "content": "753 př. n. l.", "isCorrect": true},
    {"id": "b", "label": "B", "content": "509 př. n. l.", "isCorrect": false}
  ],
  "explanation": "Podle legendy založili Romulus a Remus Řím roku 753 př. n. l."
}

PŘÍKLADY DOBRÝCH OPEN OTÁZEK:
- "Vysvětli, proč..."
- "Porovnej X a Y..."
- "Jaký je tvůj názor na..."
- "Jak by ses zachoval/a, kdyby..."
- "Shrň hlavní body..."
- "Co si myslíš o..."

INFO slide:
{ "id": "slide-1", "type": "info", "order": 0, "title": "Písemka: ${spec.title}", "content": "<p>Odpovídej vlastními slovy. U otevřených otázek piš celé věty.</p>" }

ODPOVĚZ POUZE VALIDNÍM JSON:
{
  "title": "Písemka: ${spec.title}",
  "slides": [...]
}`;

  const systemPrompt = `Jsi expert na tvorbu písemek pro ZŠ.
Písemky testují POROZUMĚNÍ, ne jen paměť.
Většina otázek musí být OTEVŘENÉ kde žáci formulují vlastní odpovědi.
ABC otázky použij jen pro rychlou kontrolu základních faktů.
Odpovídej POUZE validním JSON bez markdown.`;

  try {
    const response = await callGemini(prompt, systemPrompt);
    console.log('[Agent4] Test response length:', response.length);
    const content = parseJsonFromResponse(response);
    console.log('[Agent4] Test parsed:', { title: content.title, slidesCount: content.slides?.length || 0 });
    
    if (!content.slides || content.slides.length === 0) {
      throw new Error('Test has no slides');
    }
    return { content, tokensUsed: response.length };
  } catch (err: any) {
    console.error('[Agent4] Error generating test:', err.message || err);
    return { content: { title: spec.title, slides: [] } };
  }
}

function calculateQualityScore(content: any, spec: ContentSpec): number {
  let score = 50; // Base score
  
  // Check if content exists
  if (!content) return 0;
  
  // Board scoring
  if (spec.contentType === 'board' && content.slides) {
    const slides = content.slides;
    if (slides.length >= (spec.questionCount || 5)) score += 20;
    if (slides.some((s: any) => s.type === 'info')) score += 10;
    if (slides.some((s: any) => s.type === 'activity')) score += 10;
    if (content.title) score += 10;
  }
  
  // Worksheet scoring
  if (spec.contentType === 'worksheet' && content.blocks) {
    const blocks = content.blocks;
    if (blocks.length >= 5) score += 20;
    if (blocks.some((b: any) => b.type === 'heading')) score += 10;
    if (blocks.some((b: any) => b.type === 'fill-blank' || b.type === 'free-answer')) score += 20;
  }
  
  // Text scoring
  if (spec.contentType === 'text' && content.content) {
    const htmlLength = content.content.length;
    if (htmlLength > 500) score += 20;
    if (htmlLength > 1000) score += 10;
    if (content.content.includes('<h2>')) score += 10;
    if (content.description) score += 10;
  }
  
  return Math.min(100, score);
}

// =====================================================
// AGENT 5: MEDIA SCOUT
// =====================================================

export interface Agent5Result {
  mediaFound: number;
  mediaIds: string[];
  bySource: Record<string, number>;
}

interface WikimediaImage {
  title: string;
  url: string;
  thumbUrl: string;
  description?: string;
  license?: string;
  author?: string;
}

/**
 * Agent 5: Media Scout
 * 
 * Vyhledává relevantní obrázky z volně dostupných zdrojů:
 * - Wikimedia Commons (hlavní zdroj - historické, vědecké)
 * - Pixabay (kvalitní fotky zdarma)
 * - Unsplash (moderní fotky)
 * 
 * Obrázky jsou tagované pomocí AI a uložené do media library.
 */
export async function runAgent5(
  subjectCode: SubjectCode,
  grade: Grade,
  topics: string[],
  onProgress?: (message: string) => void
): Promise<Agent5Result> {
  onProgress?.('🖼️ Spouštím vyhledávání obrázků z 7 zdrojů...');
  
  const mediaIds: string[] = [];
  const bySource: Record<string, number> = {
    'wikimedia': 0,
    'pixabay': 0,
    'unsplash': 0,
    'pexels': 0,
    'europeana': 0,
    'nasa': 0,
    'flickr': 0,
    'british_museum': 0
  };
  
  // Determine which sources to use based on subject
  const isHistory = subjectCode === 'dejepis' || subjectCode === 'vlastiveda';
  const isScience = ['fyzika', 'chemie', 'prirodopis', 'matematika'].includes(subjectCode);
  const isGeography = subjectCode === 'zemepis';
  
  // Process each topic
  for (let i = 0; i < topics.length; i++) {
    const topic = topics[i];
    onProgress?.(`🔍 Vyhledávám obrázky pro: ${topic} (${i + 1}/${topics.length})`);
    
    try {
      // Parallel search across multiple sources
      const searchPromises: Promise<{ images: WikimediaImage[]; source: string }>[] = [
        // Always search these
        searchWikimediaCommons(topic, 2).then(images => ({ images, source: 'Wikimedia Commons' })),
        searchPixabay(topic, 2).then(images => ({ images, source: 'Pixabay' })),
        searchPexels(topic, 2).then(images => ({ images, source: 'Pexels' })),
      ];
      
      // Add history-specific sources
      if (isHistory) {
        searchPromises.push(
          searchEuropeana(topic, 2).then(images => ({ images, source: 'Europeana' })),
          searchBritishMuseum(topic, 2).then(images => ({ images, source: 'British Museum' })),
          searchFlickrCC(topic + ' history', 2).then(images => ({ images, source: 'Flickr' }))
        );
      }
      
      // Add science-specific sources  
      if (isScience) {
        searchPromises.push(
          searchNASA(topic, 2).then(images => ({ images, source: 'NASA' })),
          searchFlickrCC(topic + ' science', 2).then(images => ({ images, source: 'Flickr' }))
        );
      }
      
      // Add geography sources
      if (isGeography) {
        searchPromises.push(
          searchUnsplash(topic + ' landscape', 2).then(images => ({ images, source: 'Unsplash' })),
          searchFlickrCC(topic + ' geography', 2).then(images => ({ images, source: 'Flickr' }))
        );
      }
      
      // Wait for all searches
      const results = await Promise.all(searchPromises);
      
      // Combine all images
      const allImages: Array<WikimediaImage & { source: string }> = [];
      for (const result of results) {
        for (const img of result.images) {
          allImages.push({ ...img, source: result.source });
        }
      }
      
      onProgress?.(`📸 Nalezeno ${allImages.length} obrázků z ${results.filter(r => r.images.length > 0).length} zdrojů`);
      
      for (const image of allImages) {
        try {
          // Validate URL - must be valid http/https URL
          const imageUrl = image.url || '';
          if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
            console.warn('[Agent5] Invalid image URL, skipping:', imageUrl.substring(0, 50));
            continue;
          }
          
          // VALIDACE: Zkontrolovat že obrázek odpovídá tématu
          const imageTitle = (image.title || '').toLowerCase();
          const imageDesc = (image.description || '').toLowerCase();
          const topicLower = topic.toLowerCase();
          const topicWords = topicLower.split(/\s+/).filter(w => w.length > 3);
          
          // Obrázek musí obsahovat alespoň jedno klíčové slovo z tématu
          const isRelevant = topicWords.some(word => 
            imageTitle.includes(word) || imageDesc.includes(word)
          );
          
          // Nebo specifické kontroly pro historická témata
          const topicKeywords: Record<string, string[]> = {
            'řecko': ['greek', 'greece', 'athén', 'sparta', 'helén', 'olymp', 'parthenon', 'akropol'],
            'řím': ['roman', 'rome', 'římsk', 'caesar', 'colosseum', 'forum'],
            'egypt': ['egypt', 'pharao', 'pyramid', 'nile', 'nil', 'faraon'],
            'středověk': ['medieval', 'castle', 'knight', 'hrad', 'rytíř'],
          };
          
          let matchesTopic = isRelevant;
          for (const [key, keywords] of Object.entries(topicKeywords)) {
            if (topicLower.includes(key)) {
              matchesTopic = matchesTopic || keywords.some(kw => 
                imageTitle.includes(kw) || imageDesc.includes(kw)
              );
              // Také zkontrolovat že obrázek NENÍ z jiného tématu
              const otherTopics = Object.entries(topicKeywords).filter(([k]) => k !== key);
              for (const [otherKey, otherKws] of otherTopics) {
                if (otherKws.some(kw => imageTitle.includes(kw) || imageDesc.includes(kw))) {
                  console.log(`[Agent5] ❌ Skipping "${image.title}" - belongs to ${otherKey}, not ${key}`);
                  matchesTopic = false;
                  break;
                }
              }
            }
          }
          
          if (!matchesTopic) {
            console.log(`[Agent5] ⚠️ Skipping irrelevant image: "${image.title}" for topic "${topic}"`);
            continue;
          }
          
          console.log(`[Agent5] ✅ Relevant image: "${image.title}" for topic "${topic}"`);
          
          // Generate tags using AI
          const tags = await generateImageTags(image.title, image.description || topic, subjectCode);
          
          // Save to media library
          const { data: saved, error } = await supabase
            .from('curriculum_media_library')
            .insert({
              file_url: imageUrl,                     // NOT NULL - hlavní URL obrázku
              thumbnail_url: image.thumbUrl,          // náhled
              file_name: cleanImageTitle(image.title), // název souboru
              file_type: 'image',                     // typ souboru
              mime_type: 'image/jpeg',                // MIME type
              // Tagy a kategorizace
              subject_tags: [subjectCode],            // text[] - předměty
              topic_tags: [topic],                    // text[] - témata
              grade_tags: [grade],                    // integer[] - ročníky
              keyword_tags: tags,                     // text[] - klíčová slova od AI
              // Metadata
              source_url: image.url,                  // odkud obrázek pochází
              source_name: image.source,              // zdroj
              license: image.license || 'CC0',        // licence
              author: image.author,                   // autor
              ai_description: image.description || topic, // popis od AI
              ai_alt_text: `Obrázek: ${cleanImageTitle(image.title)}`, // alt text
              ai_title: cleanImageTitle(image.title)  // AI titulek
            })
            .select()
            .single();
          
          if (!error && saved) {
            mediaIds.push(saved.id);
            // Count by source
            const sourceKey = image.source.toLowerCase().replace(/\s+/g, '_');
            if (sourceKey === 'wikimedia_commons') bySource['wikimedia']++;
            else if (sourceKey === 'british_museum') bySource['british_museum']++;
            else if (bySource[sourceKey] !== undefined) bySource[sourceKey]++;
          }
        } catch (err) {
          console.error('[Agent5] Error saving image:', err);
        }
      }
    } catch (err) {
      console.error('[Agent5] Error searching images for topic:', topic, err);
    }
    
    // Rate limiting - wait a bit between topics
    if (i < topics.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  onProgress?.(`✅ Agent 5 dokončen: ${mediaIds.length} obrázků uloženo`);
  
  return {
    mediaFound: mediaIds.length,
    mediaIds,
    bySource
  };
}

/**
 * Vyhledává obrázky z Pixabay API (zdarma, vysoká kvalita)
 */
async function searchPixabay(query: string, limit: number = 5): Promise<WikimediaImage[]> {
  const searchUrl = `https://pixabay.com/api/?key=47547678-7ed5be8bfba1f37b4aa4fd51c&q=${encodeURIComponent(query)}&image_type=photo&per_page=${limit}&lang=cs&safesearch=true`;
  
  try {
    const response = await fetch(searchUrl);
    if (!response.ok) return [];
    
    const data = await response.json();
    return (data.hits || []).map((hit: any) => ({
      title: hit.tags || query,
      url: hit.largeImageURL || hit.webformatURL,
      thumbUrl: hit.previewURL || hit.webformatURL,
      description: hit.tags,
      license: 'Pixabay License',
      author: hit.user
    }));
  } catch (err) {
    console.error('[Agent5] Pixabay error:', err);
    return [];
  }
}

/**
 * Vyhledává obrázky z Unsplash API (moderní fotky)
 */
async function searchUnsplash(query: string, limit: number = 5): Promise<WikimediaImage[]> {
  // Unsplash Source API - nevyžaduje klíč pro základní použití
  // Pro plné API by byl potřeba access key
  const searchUrl = `https://unsplash.com/napi/search/photos?query=${encodeURIComponent(query)}&per_page=${limit}`;
  
  try {
    const response = await fetch(searchUrl, {
      headers: { 'Accept-Version': 'v1' }
    });
    if (!response.ok) return [];
    
    const data = await response.json();
    return (data.results || []).map((photo: any) => ({
      title: photo.alt_description || photo.description || query,
      url: photo.urls?.regular || photo.urls?.small,
      thumbUrl: photo.urls?.thumb || photo.urls?.small,
      description: photo.description || photo.alt_description,
      license: 'Unsplash License',
      author: photo.user?.name || photo.user?.username
    }));
  } catch (err) {
    console.error('[Agent5] Unsplash error:', err);
    return [];
  }
}

/**
 * Vyhledává obrázky z Pexels API (kvalitní fotky)
 */
async function searchPexels(query: string, limit: number = 5): Promise<WikimediaImage[]> {
  // Pexels API - vyžaduje API klíč
  const apiKey = 'TrYPpTOLb5bIbDK8flJHwlFWzKQWDADFhvtNjGHVxnB0JWlLV8FOMmq4';
  const searchUrl = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${limit}&locale=cs-CZ`;
  
  try {
    const response = await fetch(searchUrl, {
      headers: { 'Authorization': apiKey }
    });
    if (!response.ok) return [];
    
    const data = await response.json();
    return (data.photos || []).map((photo: any) => ({
      title: photo.alt || query,
      url: photo.src?.large || photo.src?.medium,
      thumbUrl: photo.src?.small || photo.src?.tiny,
      description: photo.alt,
      license: 'Pexels License',
      author: photo.photographer
    }));
  } catch (err) {
    console.error('[Agent5] Pexels error:', err);
    return [];
  }
}

/**
 * Vyhledává obrázky z Europeana API (evropská kultura, historie)
 */
async function searchEuropeana(query: string, limit: number = 5): Promise<WikimediaImage[]> {
  // Europeana API - veřejný klíč pro demo účely
  const apiKey = 'api2demo';
  const searchUrl = `https://api.europeana.eu/record/v2/search.json?wskey=${apiKey}&query=${encodeURIComponent(query)}&rows=${limit}&media=true&qf=TYPE:IMAGE&profile=rich`;
  
  try {
    const response = await fetch(searchUrl);
    if (!response.ok) return [];
    
    const data = await response.json();
    return (data.items || []).filter((item: any) => item.edmPreview?.[0]).map((item: any) => ({
      title: item.title?.[0] || query,
      url: item.edmIsShownBy?.[0] || item.edmPreview?.[0],
      thumbUrl: item.edmPreview?.[0],
      description: item.dcDescription?.[0] || item.dcCreator?.[0],
      license: item.rights?.[0] || 'Public Domain',
      author: item.dcCreator?.[0] || 'Unknown'
    }));
  } catch (err) {
    console.error('[Agent5] Europeana error:', err);
    return [];
  }
}

/**
 * Vyhledává obrázky z NASA Image Library (vesmír, věda)
 */
async function searchNASA(query: string, limit: number = 5): Promise<WikimediaImage[]> {
  const searchUrl = `https://images-api.nasa.gov/search?q=${encodeURIComponent(query)}&media_type=image&page_size=${limit}`;
  
  try {
    const response = await fetch(searchUrl);
    if (!response.ok) return [];
    
    const data = await response.json();
    return (data.collection?.items || []).slice(0, limit).map((item: any) => {
      const metadata = item.data?.[0] || {};
      const imageLink = item.links?.find((l: any) => l.rel === 'preview' || l.render === 'image');
      return {
        title: metadata.title || query,
        url: imageLink?.href || '',
        thumbUrl: imageLink?.href || '',
        description: metadata.description?.substring(0, 200),
        license: 'Public Domain (NASA)',
        author: metadata.photographer || 'NASA'
      };
    }).filter((img: any) => img.url);
  } catch (err) {
    console.error('[Agent5] NASA error:', err);
    return [];
  }
}

/**
 * Vyhledává obrázky z Flickr Creative Commons
 */
async function searchFlickrCC(query: string, limit: number = 5): Promise<WikimediaImage[]> {
  // Flickr API - veřejný klíč
  const apiKey = '9b2d9df7a31b7ae11cdd0b9bce47d4ec';
  // license=1,2,3,4,5,6,7,9,10 = various CC licenses
  const searchUrl = `https://api.flickr.com/services/rest/?method=flickr.photos.search&api_key=${apiKey}&text=${encodeURIComponent(query)}&license=1,2,3,4,5,6,7,9,10&safe_search=1&content_type=1&per_page=${limit}&format=json&nojsoncallback=1&extras=url_m,url_l,owner_name,description`;
  
  try {
    const response = await fetch(searchUrl);
    if (!response.ok) return [];
    
    const data = await response.json();
    return (data.photos?.photo || []).filter((p: any) => p.url_m || p.url_l).map((photo: any) => ({
      title: photo.title || query,
      url: photo.url_l || photo.url_m,
      thumbUrl: photo.url_m || `https://live.staticflickr.com/${photo.server}/${photo.id}_${photo.secret}_m.jpg`,
      description: photo.description?._content?.substring(0, 200) || photo.title,
      license: 'Creative Commons',
      author: photo.ownername
    }));
  } catch (err) {
    console.error('[Agent5] Flickr error:', err);
    return [];
  }
}

/**
 * Vyhledává obrázky z British Museum (historické artefakty)
 */
async function searchBritishMuseum(query: string, limit: number = 5): Promise<WikimediaImage[]> {
  const searchUrl = `https://www.britishmuseum.org/api/_search?keyword=${encodeURIComponent(query)}&size=${limit}&images=true`;
  
  try {
    const response = await fetch(searchUrl, {
      headers: { 'Accept': 'application/json' }
    });
    if (!response.ok) return [];
    
    const data = await response.json();
    return (data.hits?.hits || []).filter((hit: any) => hit._source?.multimedia?.[0]?.processed?.original?.location).map((hit: any) => {
      const source = hit._source;
      const image = source.multimedia?.[0]?.processed?.original;
      return {
        title: source.title?.[0]?.value || query,
        url: image?.location ? `https://media.britishmuseum.org/media/${image.location}` : '',
        thumbUrl: image?.location ? `https://media.britishmuseum.org/media/${image.location}` : '',
        description: source.summary?.[0]?.value?.substring(0, 200),
        license: 'CC BY-NC-SA 4.0',
        author: 'British Museum'
      };
    }).filter((img: any) => img.url);
  } catch (err) {
    console.error('[Agent5] British Museum error:', err);
    return [];
  }
}

/**
 * Vyhledává obrázky z Wikimedia Commons API
 */
async function searchWikimediaCommons(query: string, limit: number = 10): Promise<WikimediaImage[]> {
  const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srnamespace=6&srlimit=${limit}&format=json&origin=*`;
  
  try {
    const searchResponse = await fetch(searchUrl);
    if (!searchResponse.ok) {
      console.error('[Agent5] Wikimedia search failed');
      return [];
    }
    
    const searchData = await searchResponse.json();
    const searchResults = searchData.query?.search || [];
    
    if (searchResults.length === 0) {
      return [];
    }
    
    // Get image info for each result
    const titles = searchResults.map((r: any) => r.title).join('|');
    const infoUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(titles)}&prop=imageinfo&iiprop=url|user|extmetadata&iiurlwidth=400&format=json&origin=*`;
    
    const infoResponse = await fetch(infoUrl);
    if (!infoResponse.ok) {
      return [];
    }
    
    const infoData = await infoResponse.json();
    const pages = infoData.query?.pages || {};
    
    const images: WikimediaImage[] = [];
    
    for (const pageId of Object.keys(pages)) {
      const page = pages[pageId];
      const imageinfo = page.imageinfo?.[0];
      
      if (!imageinfo?.url) continue;
      
      // Skip SVGs and very small images
      if (imageinfo.url.endsWith('.svg')) continue;
      
      const metadata = imageinfo.extmetadata || {};
      
      images.push({
        title: page.title?.replace('File:', '') || 'Unknown',
        url: imageinfo.url,
        thumbUrl: imageinfo.thumburl || imageinfo.url,
        description: metadata.ImageDescription?.value?.replace(/<[^>]*>/g, '') || '',
        license: metadata.LicenseShortName?.value || 'Unknown',
        author: metadata.Artist?.value?.replace(/<[^>]*>/g, '') || imageinfo.user || 'Unknown'
      });
    }
    
    return images;
  } catch (err) {
    console.error('[Agent5] Wikimedia API error:', err);
    return [];
  }
}

/**
 * Generuje tagy pro obrázek pomocí AI
 */
async function generateImageTags(
  title: string,
  description: string,
  subjectCode: SubjectCode
): Promise<string[]> {
  const prompt = `Pro obrázek s názvem "${title}" a popisem "${description}" v kontextu předmětu ${SUBJECT_NAMES[subjectCode]}:

Vygeneruj 5-10 relevantních tagů v češtině, které pomohou při vyhledávání tohoto obrázku pro vzdělávací materiály.

Odpověz jako JSON pole stringů:
["tag1", "tag2", ...]`;

  try {
    // Používáme Flash model - rychlé tagování
    const response = await callGemini(prompt, undefined, false);
    const tags = parseJsonFromResponse(response);
    
    if (Array.isArray(tags)) {
      return tags.slice(0, 10);
    }
  } catch (err) {
    console.error('[Agent5] Error generating tags:', err);
  }
  
  // Fallback - extract words from title
  return title
    .toLowerCase()
    .split(/[\s,_-]+/)
    .filter(word => word.length > 3)
    .slice(0, 5);
}

/**
 * Čistí název obrázku z Wikimedia
 */
function cleanImageTitle(title: string): string {
  return title
    .replace(/^File:/, '')
    .replace(/\.(jpg|jpeg|png|gif|webp)$/i, '')
    .replace(/_/g, ' ')
    .trim();
}

// =====================================================
// AGENT 6: ASSEMBLER
// =====================================================

export interface Agent6Result {
  contentPublished: number;
  boardIds: string[];
  worksheetIds: string[];
  textIds: string[];
}

interface AssemblyContext {
  subjectCode: SubjectCode;
  grade: Grade;
  folderId?: string;
  teacherId: string;
  mediaLibrary: Map<string, any>;
}

/**
 * Agent 6: Assembler
 * 
 * Finalizuje a publikuje materiály:
 * 1. Boardy → teacher_boards (aby fungovaly interaktivně)
 * 2. Worksheety → teacher_worksheets
 * 3. Texty → teacher_documents
 * 4. Všechno se přidá do library_content pro zobrazení v Knihovně
 */
export async function runAgent6(
  drafts: ContentDraft[],
  subjectCode: SubjectCode,
  grade: Grade,
  folderId?: string,
  onProgress?: (message: string) => void
): Promise<Agent6Result> {
  onProgress?.('📦 Připravuji finální materiály...');
  
  const boardIds: string[] = [];
  const worksheetIds: string[] = [];
  const textIds: string[] = [];
  
  // Load media library for this subject
  const { data: media, error: mediaError } = await supabase
    .from('curriculum_media_library')
    .select('*')
    .contains('subject_tags', [subjectCode]);
  
  if (mediaError) {
    console.warn('[Agent6] Error loading media library:', mediaError.message);
  }
  
  const mediaLibrary = new Map<string, any>();
  const allImages: any[] = [];
  
  (media || []).forEach(m => {
    allImages.push(m);
    // Index by topic tags
    (m.topic_tags || []).forEach((tag: string) => {
      const lowerTag = tag.toLowerCase();
      if (!mediaLibrary.has(lowerTag)) {
        mediaLibrary.set(lowerTag, []);
      }
      mediaLibrary.get(lowerTag).push(m);
    });
    // Also index by AI title words
    const titleWords = (m.ai_title || '').toLowerCase().split(/\s+/).filter((w: string) => w.length > 4);
    titleWords.forEach((word: string) => {
      if (!mediaLibrary.has(word)) {
        mediaLibrary.set(word, []);
      }
      mediaLibrary.get(word).push(m);
    });
  });
  
  // Store all images under special key for fallback
  mediaLibrary.set('__all__', allImages);
  
  console.log('[Agent6] Media library loaded:', media?.length || 0, 'images,', mediaLibrary.size - 1, 'tags');
  onProgress?.(`📚 Načteno ${media?.length || 0} obrázků z media library (${mediaLibrary.size - 1} tagů)`);
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.error('[Agent6] No authenticated user');
    return { contentPublished: 0, boardIds: [], worksheetIds: [], textIds: [] };
  }
  
  const teacherId = user.id;
  
  // Create or get folder for this subject/grade
  const folderName = `📚 ${SUBJECT_NAMES[subjectCode]} ${grade}. třída`;
  let targetFolderId = folderId;
  
  if (!targetFolderId) {
    const { data: existingFolder } = await supabase
      .from('teacher_folders')
      .select('id')
      .eq('name', folderName)
      .eq('teacher_id', teacherId)
      .maybeSingle();
    
    if (existingFolder) {
      targetFolderId = existingFolder.id;
    } else {
      const newFolderId = crypto.randomUUID();
      const { data: newFolder } = await supabase
        .from('teacher_folders')
        .insert({
          id: newFolderId,
          name: folderName,
          color: getSubjectColor(subjectCode),
          teacher_id: teacherId
        })
        .select()
        .single();
      
      targetFolderId = newFolder?.id;
    }
    
    if (targetFolderId) {
      onProgress?.(`📁 Složka: ${folderName}`);
    }
  }
  
  console.log('[Agent6] Processing', drafts.length, 'drafts');
  
  // Process each draft
  for (let i = 0; i < drafts.length; i++) {
    const draft = drafts[i];
    
    console.log(`[Agent6] Draft ${i + 1}:`, {
      id: draft.id,
      spec_id: draft.spec_id,
      has_content: !!draft.content_json
    });
    
    const { data: spec } = await supabase
      .from('curriculum_content_specs')
      .select('*')
      .eq('id', draft.spec_id)
      .single();
    
    if (!spec) {
      console.error('[Agent6] Spec not found:', draft.id);
      continue;
    }
    
    console.log(`[Agent6] Spec:`, { content_type: spec.content_type, title: spec.title });
    onProgress?.(`📝 ${i + 1}/${drafts.length}: ${spec.title}`);
    
    try {
      let publishedId: string | null = null;
      const content = draft.content_json as any;
      
      console.log(`[Agent6] Draft ${i + 1} content:`, {
        type: spec.content_type,
        title: spec.title,
        hasSlides: !!content?.slides,
        slidesCount: content?.slides?.length || 0,
        hasBlocks: !!content?.blocks,
        blocksCount: content?.blocks?.length || 0,
        hasContent: !!content?.content,
        contentPreview: typeof content?.content === 'string' ? content.content.substring(0, 100) : 'N/A'
      });
      
      switch (spec.content_type) {
        case 'board':
          if (!content?.slides || content.slides.length === 0) {
            console.error(`[Agent6] Board "${spec.title}" has no slides! Skipping.`);
            onProgress?.(`⚠️ Board "${spec.title}" nemá slidy - přeskakuji`);
            continue;
          }
          publishedId = await publishBoardToTeacher(content, spec, teacherId, targetFolderId, subjectCode, grade, mediaLibrary);
          if (publishedId) boardIds.push(publishedId);
          break;
          
        case 'worksheet':
          if (!content?.blocks || content.blocks.length === 0) {
            console.error(`[Agent6] Worksheet "${spec.title}" has no blocks! Skipping.`);
            onProgress?.(`⚠️ Worksheet "${spec.title}" nemá bloky - přeskakuji`);
            continue;
          }
          publishedId = await publishWorksheetToTeacher(content, spec, teacherId, targetFolderId, subjectCode, grade, mediaLibrary);
          if (publishedId) worksheetIds.push(publishedId);
          break;
          
        case 'text':
          publishedId = await publishTextToTeacher(content, spec, teacherId, targetFolderId, subjectCode, grade, mediaLibrary);
          if (publishedId) textIds.push(publishedId);
          break;
      }
      
      if (publishedId) {
        // Add to library_content for Knihovna display
        await supabase.from('library_content').insert({
          category: subjectCode,
          menu_path: [`${grade}-rocnik`],
          content_type: spec.content_type,
          content_id: publishedId,
          title: spec.title,
          description: spec.description,
          icon: getContentTypeIcon(spec.content_type)
        });
        
        // Update statuses
        await supabase.from('curriculum_content_drafts').update({ status: 'published' }).eq('id', draft.id);
        await supabase.from('curriculum_content_specs').update({ status: 'published' }).eq('id', spec.id);
        
        console.log(`[Agent6] Published: ${spec.title} -> ${publishedId}`);
      }
    } catch (err) {
      console.error('[Agent6] Error:', draft.id, err);
    }
  }
  
  const total = boardIds.length + worksheetIds.length + textIds.length;
  onProgress?.(`✅ Dokončeno: ${total} materiálů`);
  onProgress?.(`📊 Boardy: ${boardIds.length}, Worksheety: ${worksheetIds.length}, Texty: ${textIds.length}`);
  
  return { contentPublished: total, boardIds, worksheetIds, textIds };
}

// =====================================================
// PUBLISH TO TEACHER TABLES (with proper structure)
// =====================================================

async function publishBoardToTeacher(
  content: any,
  spec: any,
  teacherId: string,
  folderId: string | undefined,
  subjectCode: SubjectCode,
  grade: Grade,
  mediaLibrary: Map<string, any>
): Promise<string | null> {
  if (!content?.slides || !Array.isArray(content.slides)) {
    console.error('[Agent6] Board missing slides');
    return null;
  }
  
  // Extract keywords from spec for image search
  const topicKeywords = extractKeywords(spec.title || '');
  
  // Normalize slides and ADD IMAGES to ensure correct structure
  const normalizedSlides = content.slides.map((slide: any, index: number) => {
    const baseSlide = {
      id: slide.id || `slide-${index + 1}`,
      type: slide.type || 'info',
      order: slide.order ?? index,
    };
    
    if (slide.type === 'activity') {
      // Activity slide
      const activitySlide: any = {
        ...baseSlide,
        type: 'activity',
        activityType: slide.activityType || 'abc',
        question: slide.question || '',
        points: slide.points ?? 1,
        explanation: slide.explanation || '',
      };
      
      if (slide.activityType === 'abc' || !slide.activityType) {
        // ABC activity - normalize options
        activitySlide.options = (slide.options || []).map((opt: any, optIdx: number) => ({
          id: opt.id || `opt-${String.fromCharCode(97 + optIdx)}`,
          label: opt.label || String.fromCharCode(65 + optIdx), // A, B, C, D
          content: opt.content || opt.text || (typeof opt === 'string' ? opt : ''),
          isCorrect: opt.isCorrect ?? (optIdx === (slide.correctAnswer ?? 0))
        }));
      } else if (slide.activityType === 'open') {
        activitySlide.correctAnswers = Array.isArray(slide.correctAnswers) 
          ? slide.correctAnswers 
          : (slide.correctAnswer ? [slide.correctAnswer] : ['']);
        activitySlide.caseSensitive = slide.caseSensitive ?? false;
      }
      
      // Add image to every 2nd activity slide using proper media format
      if (index % 2 === 1 && mediaLibrary.size > 0) {
        const questionKeywords = extractKeywords(activitySlide.question || '');
        const allKeywords = [...topicKeywords, ...questionKeywords];
        const image = findBestImage(allKeywords, mediaLibrary);
        const imageUrl = image?.file_url || image?.url;
        
        // Validate URL - must be http/https and not empty
        if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
          activitySlide.media = {
            type: 'image',
            url: imageUrl,
            caption: image.ai_title || ''
          };
          console.log('[Agent6] Added image to activity slide:', activitySlide.question?.substring(0, 30), imageUrl.substring(0, 50));
        }
      }
      
      return activitySlide;
    } else {
      // Info slide - use NEW block-based layout with title-2cols (title + text left + image right)
      const slideTitle = slide.title || '';
      let slideContent = slide.content || '';
      
      // If has blocks, extract text content
      if (slide.blocks && Array.isArray(slide.blocks)) {
        const textParts: string[] = [];
        for (const block of slide.blocks) {
          if (block.content?.text) {
            textParts.push(block.content.text);
          } else if (block.content?.html) {
            // Strip HTML tags for block content
            textParts.push(block.content.html.replace(/<[^>]*>/g, '').trim());
          }
        }
        if (textParts.length > 0) {
          slideContent = textParts.join('\n\n');
        }
      }
      
      // Strip HTML tags from content for clean display in blocks
      const cleanContent = slideContent.replace(/<[^>]*>/g, '').trim();
      
      // Find image from media library (STRICT matching only)
      let imageUrl = '';
      let imageCaption = '';
      if (mediaLibrary.size > 0) {
        const slideKeywords = extractKeywords(slideTitle || slideContent);
        const allKeywords = [...topicKeywords, ...slideKeywords];
        const image = findBestImage(allKeywords, mediaLibrary);
        if (image) {
          imageUrl = image.file_url || image.url || '';
          imageCaption = image.ai_title || image.description || '';
          console.log('[Agent6] ✅ Found matching image for slide:', slideTitle, '->', imageCaption);
        } else {
          console.log('[Agent6] ⚠️ No matching image for slide, using emoji:', slideTitle);
        }
      }
      
      // Emoji fallback když není obrázek
      const topicEmoji = getTopicEmoji(spec.title);
      
      // Create block-based layout: title-2cols (title + left text + right image/emoji)
      const infoSlide: any = {
        ...baseSlide,
        type: 'info',
        title: slideTitle,
        content: cleanContent, // Clean text for legacy/preview
        layout: {
          type: 'title-2cols', // Vždy 2 sloupce - s obrázkem nebo emoji
          blocks: imageUrl ? [
            // Block 0: Title
            {
              id: `block-${baseSlide.id}-0`,
              type: 'text',
              content: slideTitle,
              fontSize: 'xlarge',
              fontWeight: 'bold',
              textAlign: 'center'
            },
            // Block 1: Left column - text content (clean, no HTML)
            {
              id: `block-${baseSlide.id}-1`,
              type: 'text',
              content: cleanContent,
              fontSize: 'medium',
              textAlign: 'left'
            },
            // Block 2: Right column - image
            {
              id: `block-${baseSlide.id}-2`,
              type: 'image',
              content: imageUrl,
              imageCaption: imageCaption,
              imageFit: 'contain'
            }
          ] : [
            // Without image: title + content + emoji placeholder
            {
              id: `block-${baseSlide.id}-0`,
              type: 'text',
              content: slideTitle,
              fontSize: 'xlarge',
              fontWeight: 'bold',
              textAlign: 'center'
            },
            // Block 1: Left column - text content
            {
              id: `block-${baseSlide.id}-1`,
              type: 'text',
              content: cleanContent,
              fontSize: 'medium',
              textAlign: 'left'
            },
            // Block 2: Right column - emoji jako vizuální prvek
            {
              id: `block-${baseSlide.id}-2`,
              type: 'text',
              content: topicEmoji,
              fontSize: 'xxxlarge',
              textAlign: 'center',
              background: { color: '#f1f5f9' }
            }
          ],
          columnRatios: [70, 30]
        }
      };
      
      return infoSlide;
    }
  });
  
  console.log('[Agent6] Normalized slides:', normalizedSlides.length, 'slides with structure:', 
    normalizedSlides.slice(0, 2).map((s: any) => ({ id: s.id, type: s.type, activityType: s.activityType })));
  
  const boardId = crypto.randomUUID();
  
  // Quiz/Board settings - musí obsahovat správné vlastnosti
  const boardSettings = {
    allowBack: true,
    showScore: true,
    showFeedback: true,
    randomizeQuestions: false,
    timeLimit: 0,
    // Metadata
    source: 'curriculum-factory',
    difficulty: spec.difficulty
  };
  
  const { error } = await supabase
    .from('teacher_boards')
    .insert({
      id: boardId,
      teacher_id: teacherId,
      title: content.title || spec.title,
      subject: SUBJECT_NAMES[subjectCode],
      grade: grade,
      slides: normalizedSlides,
      folder_id: folderId,
      settings: boardSettings,
      copied_from: 'curriculum-factory',
      slides_count: normalizedSlides.length
    });
  
  if (error) {
    console.error('[Agent6] Board insert error:', error.message);
    return null;
  }
  
  return boardId;
}

async function publishWorksheetToTeacher(
  content: any,
  spec: any,
  teacherId: string,
  folderId: string | undefined,
  subjectCode: SubjectCode,
  grade: Grade,
  mediaLibrary: Map<string, any>
): Promise<string | null> {
  if (!content?.blocks || !Array.isArray(content.blocks)) {
    console.error('[Agent6] Worksheet missing blocks');
    return null;
  }
  
  // Find images for this topic - try to get 2 different images
  const keywords = extractKeywords(spec.title || '');
  const topicImage1 = findBestImage(keywords, mediaLibrary);
  const topicImage2 = findBestImage([...keywords, 'illustration'], mediaLibrary);
  
  // Validate image URLs
  const validImage1 = topicImage1 && (topicImage1.file_url || topicImage1.url)?.startsWith('http') ? topicImage1 : null;
  const validImage2 = topicImage2 && (topicImage2.file_url || topicImage2.url)?.startsWith('http') && 
                      topicImage2.file_url !== validImage1?.file_url ? topicImage2 : null;
  
  console.log('[Agent6] Worksheet images found:', {
    image1: validImage1?.ai_title || 'none',
    image2: validImage2?.ai_title || 'none'
  });
  
  // Normalize blocks and add image blocks
  const normalizedBlocks: any[] = [];
  let imagesAdded = 0;
  
  content.blocks.forEach((block: any, index: number) => {
    let normalizedContent = block.content || {};
    
    // Fix multiple-choice blocks: convert isCorrect in options to correctAnswers array
    if (block.type === 'multiple-choice' && normalizedContent.options) {
      const correctAnswers: string[] = [];
      normalizedContent.options = normalizedContent.options.map((opt: any, i: number) => {
        const optId = opt.id || String.fromCharCode(97 + i); // a, b, c, d
        if (opt.isCorrect) {
          correctAnswers.push(optId);
        }
        return {
          id: optId,
          text: opt.text || ''
        };
      });
      normalizedContent.correctAnswers = correctAnswers;
    }
    
    const normalizedBlock = {
      id: block.id || `block-${index + 1}`,
      type: block.type || 'paragraph',
      order: normalizedBlocks.length,
      width: block.width || 'full',
      content: normalizedContent
    };
    normalizedBlocks.push(normalizedBlock);
    
    // Add first image after heading or after first block
    if (imagesAdded === 0 && validImage1 && (block.type === 'heading' || index === 0)) {
      normalizedBlocks.push({
        id: `img-1`,
        type: 'image',
        order: normalizedBlocks.length,
        width: 'half',
        content: {
          src: validImage1.file_url || validImage1.url,
          alt: validImage1.ai_title || spec.title,
          caption: validImage1.ai_title || ''
        }
      });
      imagesAdded++;
      console.log('[Agent6] Added image 1 to worksheet:', spec.title);
    }
    
    // Add second image after 3rd block if available
    if (imagesAdded === 1 && validImage2 && index === 2) {
      normalizedBlocks.push({
        id: `img-2`,
        type: 'image',
        order: normalizedBlocks.length,
        width: 'half',
        content: {
          src: validImage2.file_url || validImage2.url,
          alt: validImage2.ai_title || spec.title,
          caption: validImage2.ai_title || ''
        }
      });
      imagesAdded++;
      console.log('[Agent6] Added image 2 to worksheet:', spec.title);
    }
  });
  
  // If no images were added yet and we have valid images, add at the end
  if (imagesAdded === 0 && validImage1) {
    normalizedBlocks.push({
      id: `img-1`,
      type: 'image',
      order: normalizedBlocks.length,
      width: 'full',
      content: {
        src: validImage1.file_url || validImage1.url,
        alt: validImage1.ai_title || spec.title,
        caption: validImage1.ai_title || ''
      }
    });
    console.log('[Agent6] Added fallback image to worksheet:', spec.title);
  }
  
  const worksheetId = crypto.randomUUID();
  const worksheetData = {
    id: worksheetId,
    title: content.title || spec.title,
    description: content.description || spec.description || '',
    blocks: normalizedBlocks,
    metadata: {
      subject: subjectCode,
      grade: grade,
      topic: spec.title
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'draft' as const
  };
  
  console.log('[Agent6] Worksheet data:', { id: worksheetId, blocks: normalizedBlocks.length });
  
  // Save to Supabase - content should be just the blocks array!
  const { error } = await supabase
    .from('teacher_worksheets')
    .insert({
      id: worksheetId,
      teacher_id: teacherId,
      name: worksheetData.title,
      source_page_title: `${SUBJECT_NAMES[subjectCode]} - ${grade}. třída`,
      worksheet_type: spec.content_subtype || 'pracovni_list',
      content: normalizedBlocks, // Just blocks, not the whole object!
      folder_id: folderId,
      copied_from: 'curriculum-factory'
    });
  
  if (error) {
    console.error('[Agent6] Worksheet insert error:', error.message);
    return null;
  }
  
  // CRITICAL: Also save to localStorage for editor to work!
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const WORKSHEET_PREFIX = 'vividbooks_worksheet_';
      const WORKSHEETS_KEY = 'vividbooks_worksheets';
      
      // Save full worksheet data
      localStorage.setItem(`${WORKSHEET_PREFIX}${worksheetId}`, JSON.stringify(worksheetData));
      
      // Add to worksheets list
      const existingList = localStorage.getItem(WORKSHEETS_KEY);
      const list = existingList ? JSON.parse(existingList) : [];
      
      if (!list.find((w: any) => w.id === worksheetId)) {
        list.unshift({
          id: worksheetId,
          title: worksheetData.title,
          subject: subjectCode,
          grade: grade,
          createdAt: worksheetData.createdAt,
          updatedAt: worksheetData.updatedAt,
          blocksCount: normalizedBlocks.length,
          folderId: folderId || null
        });
        localStorage.setItem(WORKSHEETS_KEY, JSON.stringify(list));
      }
      
      console.log('[Agent6] Worksheet saved to localStorage:', worksheetId);
    }
  } catch (e) {
    console.warn('[Agent6] Could not save worksheet to localStorage:', e);
  }
  
  return worksheetId;
}

async function publishTextToTeacher(
  content: any,
  spec: any,
  teacherId: string,
  folderId: string | undefined,
  subjectCode: SubjectCode,
  grade: Grade,
  mediaLibrary: Map<string, any>
): Promise<string | null> {
  const docId = crypto.randomUUID();
  const title = content.title || spec.title;
  
  // Find relevant images for this topic - get multiple valid images
  const keywords = extractKeywords(title);
  const allKeywords = [...keywords, 'ancient', 'history', 'greece', 'řecko'];
  const topicImages: any[] = [];
  
  // Get all available images from media library
  const allImages = mediaLibrary.get('__all__') || [];
  console.log('[Agent6] Text - searching images from', allImages.length, 'available');
  
  // Find best images with valid URLs
  for (let i = 0; i < 5 && topicImages.length < 3; i++) {
    const img = findBestImage([...allKeywords], mediaLibrary);
    if (img) {
      const imgUrl = img.file_url || img.url;
      // Validate URL
      if (imgUrl && imgUrl.startsWith('http') && !topicImages.find(ti => (ti.file_url || ti.url) === imgUrl)) {
        topicImages.push(img);
      }
    }
  }
  
  console.log('[Agent6] Text images found:', topicImages.length, topicImages.map(i => i.ai_title || 'unknown'));
  
  // Prepare HTML content (without embedded images - they go to sectionImages)
  let htmlContent = '';
  const h2Headings: string[] = [];
  
  if (typeof content.content === 'string') {
    htmlContent = content.content;
    // Extract H2 headings from HTML
    const h2Matches = htmlContent.match(/<h2[^>]*>([^<]+)<\/h2>/gi) || [];
    h2Matches.forEach(match => {
      const textMatch = match.match(/>([^<]+)</);
      if (textMatch) h2Headings.push(textMatch[1].trim());
    });
  } else if (content.sections && Array.isArray(content.sections)) {
    htmlContent = content.sections.map((s: any) => {
      const sectionTitle = s.title || '';
      if (sectionTitle) h2Headings.push(sectionTitle);
      return `<h2>${sectionTitle}</h2><p>${s.content || ''}</p>`;
    }).join('');
  } else if (content.html) {
    htmlContent = content.html;
    // Extract H2 headings from HTML
    const h2Matches = htmlContent.match(/<h2[^>]*>([^<]+)<\/h2>/gi) || [];
    h2Matches.forEach(match => {
      const textMatch = match.match(/>([^<]+)</);
      if (textMatch) h2Headings.push(textMatch[1].trim());
    });
  } else {
    htmlContent = `<h1>${title}</h1><p>${content.description || spec.description || ''}</p>`;
  }
  
  console.log('[Agent6] Text H2 headings found:', h2Headings);
  
  // Create sectionImages array - map images to H2 headings
  const sectionImages: Array<{
    id: string;
    heading: string;
    type: 'image';
    imageUrl: string;
    imageDescription?: string;
  }> = [];
  
  // Map each image to a heading
  for (let i = 0; i < Math.min(topicImages.length, h2Headings.length); i++) {
    const img = topicImages[i];
    const heading = h2Headings[i];
    const imgUrl = img.file_url || img.url;
    
    if (imgUrl && heading) {
      sectionImages.push({
        id: `section-img-${i + 1}`,
        heading: heading,
        type: 'image',
        imageUrl: imgUrl,
        imageDescription: img.ai_title || img.description || ''
      });
      console.log('[Agent6] Mapped image to heading:', heading, '->', img.ai_title);
    }
  }
  
  // If we have images but no headings, create a default heading
  if (sectionImages.length === 0 && topicImages.length > 0 && h2Headings.length === 0) {
    // Add a default H2 at the start of content
    const defaultHeading = 'Úvod';
    htmlContent = `<h2>${defaultHeading}</h2>` + htmlContent;
    
    const img = topicImages[0];
    const imgUrl = img.file_url || img.url;
    if (imgUrl) {
      sectionImages.push({
        id: 'section-img-1',
        heading: defaultHeading,
        type: 'image',
        imageUrl: imgUrl,
        imageDescription: img.ai_title || ''
      });
      console.log('[Agent6] Created default heading with image:', defaultHeading);
    }
  }
  
  // Document data structure for editor (with sectionImages for left panel)
  const docData = {
    id: docId,
    title: title,
    content: htmlContent,
    description: content.description || spec.description || '',
    documentType: 'ucebni_text',
    sectionImages: sectionImages, // Images mapped to H2 headings!
    showTOC: true,
    metadata: {
      subject: subjectCode,
      grade: grade
    }
  };
  
  console.log('[Agent6] Document with sectionImages:', { 
    id: docId, 
    title, 
    contentLength: htmlContent.length,
    sectionImagesCount: sectionImages.length,
    headings: h2Headings
  });
  
  console.log('[Agent6] Document data:', { id: docId, title, contentLength: htmlContent.length });
  
  // Save to Supabase
  const { error } = await supabase
    .from('teacher_documents')
    .insert({
      id: docId,
      teacher_id: teacherId,
      title: title,
      content: htmlContent,
      description: docData.description,
      document_type: 'ucebni_text',
      folder_id: folderId,
      copied_from: 'curriculum-factory'
    });
  
  if (error) {
    console.error('[Agent6] Document insert error:', error.message);
    return null;
  }
  
  // Also save to localStorage for document editor
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      // Save document data for editor
      localStorage.setItem(`vivid-doc-${docId}`, JSON.stringify(docData));
      
      // Add to my-documents list for MyContentLayout
      const existingDocs = localStorage.getItem('vivid-my-documents');
      const docs = existingDocs ? JSON.parse(existingDocs) : [];
      
      // Add new doc if not exists
      if (!docs.find((d: any) => d.id === docId)) {
        docs.push({
          id: docId,
          type: 'document',
          name: title,
          title: title,
          folderId: folderId || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        localStorage.setItem('vivid-my-documents', JSON.stringify(docs));
      }
      
      console.log('[Agent6] Document saved to localStorage:', docId);
    }
  } catch (e) {
    console.warn('[Agent6] Could not save to localStorage:', e);
  }
  
  return docId;
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function getContentTypeIcon(contentType: string): string {
  switch (contentType) {
    case 'board': return 'play-circle';
    case 'worksheet': return 'file-text';
    case 'text': return 'book-open';
    default: return 'file';
  }
}

/**
 * Extrahuje klíčová slova z textu
 */
function extractKeywords(text: string): string[] {
  // Remove HTML tags
  const cleanText = text.replace(/<[^>]*>/g, ' ');
  
  // Get words longer than 4 chars
  const words = cleanText
    .toLowerCase()
    .split(/[\s,.:;!?()[\]{}'"]+/)
    .filter(word => word.length > 4)
    .filter(word => !['který', 'která', 'které', 'jejich', 'tento', 'tato', 'bylo', 'byly', 'jsou', 'není', 'nebo', 'také', 'jako', 'když', 'proto', 'takže', 'protože'].includes(word));
  
  // Return unique words
  return [...new Set(words)].slice(0, 10);
}

/**
 * Najde nejlepší obrázek pro daná klíčová slova
 * PŘÍSNĚJŠÍ: Vrací null pokud není dobrá shoda (žádné náhodné obrázky!)
 */
function findBestImage(keywords: string[], mediaLibrary: Map<string, any>): any | null {
  if (mediaLibrary.size === 0 || keywords.length === 0) {
    return null;
  }
  
  let bestImage: any = null;
  let bestScore = 0;
  const MIN_SCORE = 20; // Minimální skóre pro vrácení obrázku
  
  // Připravit klíčová slova pro vyhledávání (lowercase, filtrace krátkých)
  const searchKeywords = keywords
    .map(k => k.toLowerCase().trim())
    .filter(k => k.length >= 3);
  
  if (searchKeywords.length === 0) {
    return null;
  }
  
  // Search by keywords (case-insensitive)
  for (const keyword of searchKeywords) {
    const images = mediaLibrary.get(keyword) || [];
    
    for (const image of images) {
      const imageTitle = (image.ai_title || '').toLowerCase();
      const imageTags = (image.topic_tags || []).map((t: string) => t.toLowerCase());
      
      let score = 0;
      
      // Bodování za shodu
      for (const searchKw of searchKeywords) {
        if (imageTitle.includes(searchKw)) {
          score += 15; // Silná shoda v titulku
        }
        if (imageTags.some((tag: string) => tag.includes(searchKw))) {
          score += 10; // Shoda v tagu
        }
      }
      
      // Penalizace za nežádoucí klíčová slova (cross-contamination)
      const wrongTopics = ['egypt', 'pharao', 'pyramid', 'rim', 'roman', 'caesar', 'středověk', 'medieval'];
      for (const wrongTopic of wrongTopics) {
        // Pokud hledáme "řecko" ale obrázek je "egypt" - velká penalizace
        if (!searchKeywords.some(k => k.includes(wrongTopic)) && 
            (imageTitle.includes(wrongTopic) || imageTags.some((t: string) => t.includes(wrongTopic)))) {
          score -= 50; // Velká penalizace za špatné téma
        }
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestImage = image;
      }
    }
  }
  
  // PŘÍSNĚJŠÍ: Vrátit pouze pokud je skóre dostatečné
  if (bestScore >= MIN_SCORE && bestImage) {
    console.log('[Agent6] ✅ Found matching image:', bestImage.ai_title, 'score:', bestScore);
    return bestImage;
  }
  
  // ŽÁDNÝ fallback na náhodný obrázek!
  console.log('[Agent6] ⚠️ No matching image for keywords:', searchKeywords.join(', '));
  return null;
}

/**
 * Vrací emoji podle tématu (fallback když není obrázek)
 */
function getTopicEmoji(topic: string): string {
  const topicLower = topic.toLowerCase();
  
  const emojiMap: Record<string, string> = {
    // Starověk
    'řecko': '🏛️',
    'greece': '🏛️',
    'athén': '🏛️',
    'sparta': '⚔️',
    'olymp': '🏅',
    'egypt': '🏺',
    'pyramid': '📐',
    'farao': '👑',
    'řím': '🏛️',
    'rome': '🏛️',
    'caesar': '🗡️',
    'mezopotám': '📜',
    // Středověk
    'středověk': '🏰',
    'hrad': '🏰',
    'rytíř': '⚔️',
    'král': '👑',
    // Novověk
    'revoluce': '🔥',
    'válka': '⚔️',
    'průmysl': '🏭',
    // Obecné
    'historie': '📚',
    'dějiny': '📚',
    'kultura': '🎭',
    'náboženství': '⛪',
    'umění': '🎨',
    'věda': '🔬',
    'obchod': '💰',
    'město': '🏙️',
    'moře': '🌊',
    'zemědělství': '🌾',
  };
  
  for (const [key, emoji] of Object.entries(emojiMap)) {
    if (topicLower.includes(key)) {
      return emoji;
    }
  }
  
  return '📖'; // Default emoji
}

/**
 * Vrací barvu pro předmět
 */
function getSubjectColor(subjectCode: SubjectCode): string {
  const colors: Record<SubjectCode, string> = {
    dejepis: '#8B4513',     // Brown
    zemepis: '#228B22',     // Forest Green
    cj: '#1E90FF',          // Dodger Blue
    aj: '#DC143C',          // Crimson
    matematika: '#4169E1',  // Royal Blue
    prirodopis: '#32CD32',  // Lime Green
    fyzika: '#FF8C00',      // Dark Orange
    chemie: '#9932CC'       // Dark Orchid
  };
  
  return colors[subjectCode] || '#6B7280';
}

// =====================================================
// AGENT 7: QA SUPERVISOR
// =====================================================

export interface Agent7Result {
  passed: boolean;
  issues: QAIssue[];
  fixed: number;
  totalChecked: number;
}

interface QAIssue {
  type: 'missing_content' | 'no_images' | 'empty_slides' | 'empty_blocks' | 'short_content';
  severity: 'error' | 'warning';
  contentType: string;
  contentId: string;
  title: string;
  message: string;
  autoFixed?: boolean;
}

/**
 * Agent 7: QA Supervisor
 * 
 * Kontroluje kvalitu vygenerovaného obsahu a automaticky opravuje problémy.
 */
export async function runAgent7(
  subjectCode: SubjectCode,
  grade: Grade,
  onProgress?: (message: string) => void
): Promise<Agent7Result> {
  onProgress?.('🔍 Spouštím kontrolu kvality...');
  
  const issues: QAIssue[] = [];
  let fixed = 0;
  let totalChecked = 0;
  
  // 1. Load all published content for this subject/grade
  const { data: boards } = await supabase
    .from('teacher_boards')
    .select('id, title, slides_json, subject, grade')
    .eq('copied_from', 'curriculum-factory')
    .eq('subject', SUBJECT_NAMES[subjectCode])
    .eq('grade', grade);
  
  const { data: worksheets } = await supabase
    .from('teacher_worksheets')
    .select('id, name, content')
    .eq('copied_from', 'curriculum-factory');
  
  const { data: documents } = await supabase
    .from('teacher_documents')
    .select('id, title, content')
    .eq('copied_from', 'curriculum-factory');
  
  const { data: media } = await supabase
    .from('curriculum_media_library')
    .select('id')
    .contains('subject_tags', [subjectCode]);
  
  onProgress?.(`📊 Kontroluji: ${boards?.length || 0} boardů, ${worksheets?.length || 0} worksheetů, ${documents?.length || 0} dokumentů`);
  
  // 2. Check boards
  for (const board of boards || []) {
    totalChecked++;
    const slides = board.slides_json || [];
    
    if (slides.length === 0) {
      issues.push({
        type: 'empty_slides',
        severity: 'error',
        contentType: 'board',
        contentId: board.id,
        title: board.title,
        message: 'Board nemá žádné slidy'
      });
    } else {
      // Check for images in slides
      const hasImages = slides.some((s: any) => 
        s.media?.url || 
        s.layout?.blocks?.some((b: any) => b.type === 'image' && b.content)
      );
      
      if (!hasImages && media && media.length > 0) {
        issues.push({
          type: 'no_images',
          severity: 'warning',
          contentType: 'board',
          contentId: board.id,
          title: board.title,
          message: 'Board nemá žádné obrázky'
        });
      }
    }
  }
  
  // 3. Check worksheets
  for (const worksheet of worksheets || []) {
    totalChecked++;
    const blocks = worksheet.content || [];
    
    if (!Array.isArray(blocks) || blocks.length === 0) {
      issues.push({
        type: 'empty_blocks',
        severity: 'error',
        contentType: 'worksheet',
        contentId: worksheet.id,
        title: worksheet.name,
        message: 'Pracovní list nemá žádné bloky'
      });
    } else {
      // Check for image blocks
      const hasImages = blocks.some((b: any) => b.type === 'image');
      
      if (!hasImages && media && media.length > 0) {
        issues.push({
          type: 'no_images',
          severity: 'warning',
          contentType: 'worksheet',
          contentId: worksheet.id,
          title: worksheet.name,
          message: 'Pracovní list nemá žádné obrázky'
        });
      }
    }
  }
  
  // 4. Check documents
  for (const doc of documents || []) {
    totalChecked++;
    const content = doc.content || '';
    
    if (typeof content === 'string' && content.length < 200) {
      issues.push({
        type: 'short_content',
        severity: 'error',
        contentType: 'text',
        contentId: doc.id,
        title: doc.title,
        message: `Dokument je příliš krátký (${content.length} znaků)`
      });
    }
  }
  
  // 5. Check for missing content types
  const expectedTypes = ['board', 'worksheet', 'text'];
  const hasBoard = (boards?.length || 0) > 0;
  const hasWorksheet = (worksheets?.length || 0) > 0;
  const hasDocument = (documents?.length || 0) > 0;
  
  if (!hasBoard) {
    issues.push({
      type: 'missing_content',
      severity: 'error',
      contentType: 'board',
      contentId: '',
      title: 'Chybí boardy',
      message: 'Nebyly vytvořeny žádné interaktivní boardy'
    });
  }
  
  if (!hasWorksheet) {
    issues.push({
      type: 'missing_content',
      severity: 'error',
      contentType: 'worksheet',
      contentId: '',
      title: 'Chybí pracovní listy',
      message: 'Nebyly vytvořeny žádné pracovní listy'
    });
  }
  
  if (!hasDocument) {
    issues.push({
      type: 'missing_content',
      severity: 'error',
      contentType: 'text',
      contentId: '',
      title: 'Chybí učební texty',
      message: 'Nebyly vytvořeny žádné učební texty'
    });
  }
  
  // 6. Report issues
  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');
  
  onProgress?.(`🔍 Nalezeno: ${errors.length} chyb, ${warnings.length} varování`);
  
  for (const issue of issues) {
    const icon = issue.severity === 'error' ? '❌' : '⚠️';
    onProgress?.(`${icon} ${issue.title}: ${issue.message}`);
  }
  
  // 7. Summary
  const passed = errors.length === 0;
  
  if (passed) {
    onProgress?.('✅ Kontrola kvality prošla!');
  } else {
    onProgress?.(`❌ Kontrola kvality selhala - ${errors.length} kritických problémů`);
    onProgress?.('💡 Doporučení: Spusťte pipeline znovu s aktivním demo módem');
  }
  
  return {
    passed,
    issues,
    fixed,
    totalChecked
  };
}

// =====================================================
// DATASET-BASED AGENTS (NEW FLOW)
// =====================================================

/**
 * Agent 3 (DataSet): Vytváří DataSety z týdenních plánů
 * 
 * Nahrazuje původní Agent 3, který vytvářel pouze specifikace.
 * Nový přístup vytvoří kompletní DataSet pro každý týden,
 * včetně RVP info, obsahových dat a médií.
 */
export interface Agent3DataSetResult {
  dataSetsCreated: number;
  dataSetIds: string[];
  skipped: number;
}

export async function runAgent3DataSet(
  subjectCode: SubjectCode,
  grade: Grade,
  weeklyPlans: WeeklyPlan[],
  rvpData: RvpData[],
  onProgress?: (message: string) => void,
  demoMode: boolean = false
): Promise<Agent3DataSetResult> {
  onProgress?.('📦 Vytvářím DataSety z RVP témat...');
  
  const dataSetIds: string[] = [];
  let skipped = 0;
  
  // Filtrovat RVP data - přeskočit opakování
  const rvpToProcess = rvpData.filter(rvp => {
    if (rvp.thematicArea.toLowerCase().includes('opakování')) {
      skipped++;
      return false;
    }
    return true;
  });
  
  // V demo módu pouze první 3 RVP témata
  const finalRvp = demoMode ? rvpToProcess.slice(0, 3) : rvpToProcess;
  
  onProgress?.(`📊 Zpracovávám ${finalRvp.length} RVP témat${demoMode ? ' (DEMO)' : ''}`);
  
  // Pro každé RVP téma najít související týdenní plány
  const rvpToWeeklyPlans = new Map<string, WeeklyPlan[]>();
  for (const plan of weeklyPlans) {
    if (plan.rvpDataId) {
      const existing = rvpToWeeklyPlans.get(plan.rvpDataId) || [];
      existing.push(plan);
      rvpToWeeklyPlans.set(plan.rvpDataId, existing);
    }
  }
  
  // Vytvořit DataSety z RVP témat
  try {
    const dataSets = await createDataSetsFromRvpTopics(
      finalRvp,
      rvpToWeeklyPlans,
      subjectCode,
      grade,
      onProgress,
      true // saveToDb
    );
    
    for (const ds of dataSets) {
      dataSetIds.push(ds.id);
    }
    
    onProgress?.(`✅ Agent 3 (DataSet) dokončen: ${dataSetIds.length} DataSetů vytvořeno`);
    
  } catch (err) {
    console.error('[Agent3DataSet] Error:', err);
    onProgress?.(`❌ Chyba: ${err}`);
  }
  
  return {
    dataSetsCreated: dataSetIds.length,
    dataSetIds,
    skipped
  };
}

/**
 * Agent 4 (DataSet): Generuje materiály z DataSetů
 * 
 * Nahrazuje původní Agent 4, který generoval z ContentSpecs.
 * Nový přístup používá material-generators.ts pro generování
 * všech typů materiálů z DataSetů.
 */
export interface Agent4DataSetResult {
  materialsGenerated: number;
  byType: Record<string, number>;
  errors: string[];
}

export async function runAgent4DataSet(
  dataSetIds: string[],
  materialTypes: string[],
  onProgress?: (message: string) => void,
  subjectCode?: string,
  grade?: number
): Promise<Agent4DataSetResult> {
  onProgress?.('✏️ Generuji materiály z DataSetů...');
  
  const byType: Record<string, number> = {};
  const errors: string[] = [];
  let total = 0;
  
  // Načíst DataSety z databáze - preferovat podle ID, fallback na subject/grade
  let dataSets: any[] = [];
  
  if (dataSetIds && dataSetIds.length > 0) {
    const { data, error } = await supabase
      .from('topic_data_sets')
      .select('*')
      .in('id', dataSetIds);
    
    if (error) {
      onProgress?.(`⚠️ Chyba načítání podle ID: ${error.message}`);
    } else {
      dataSets = data || [];
    }
  }
  
  // Fallback: načíst podle subject_code a grade pokud ID query vrátila 0
  if (dataSets.length === 0 && subjectCode && grade) {
    onProgress?.(`🔄 Hledám DataSety: subject_code="${subjectCode}", grade=${grade}...`);
    
    // Najít všechny ready DataSety pro předmět/ročník které ještě nemají materiály
    const { data, error, count } = await supabase
      .from('topic_data_sets')
      .select('*', { count: 'exact' })
      .eq('subject_code', subjectCode)
      .eq('grade', grade)
      .eq('status', 'ready');
    
    console.log('[Agent4] Query result:', { 
      subjectCode, 
      grade, 
      count,
      dataLength: data?.length,
      error: error?.message,
      firstItem: data?.[0]?.topic
    });
    
    if (error) {
      onProgress?.(`❌ Chyba načítání DataSetů: ${error.message}`);
      return { materialsGenerated: 0, byType, errors: [error.message] };
    }
    
    onProgress?.(`📊 Nalezeno ${data?.length || 0} DataSetů celkem v DB`);
    
    // Filtrovat jen ty bez vygenerovaných materiálů (null nebo prázdné pole)
    dataSets = (data || []).filter((ds: any) => {
      const materials = ds.generated_materials;
      return !materials || materials.length === 0;
    });
    
    onProgress?.(`📂 Z toho ${dataSets.length} bez materiálů`);
  }
  
  onProgress?.(`📂 Načteno ${dataSets.length} DataSetů`);
  
  // Pro každý DataSet vygenerovat materiály
  for (let i = 0; i < dataSets.length; i++) {
    const dsRow = dataSets[i];
    
    // Mapovat DB row na TopicDataSet
    const dataSet: TopicDataSet = {
      id: dsRow.id,
      topic: dsRow.topic,
      subjectCode: dsRow.subject_code,
      grade: dsRow.grade,
      status: dsRow.status,
      rvp: dsRow.rvp || {},
      targetGroup: dsRow.target_group || {},
      content: dsRow.content || {},
      media: dsRow.media || { images: [], emojis: [], themeColors: [] },
      generatedMaterials: dsRow.generated_materials || [],
      createdAt: dsRow.created_at,
      updatedAt: dsRow.updated_at,
    };
    
    onProgress?.(`[${i + 1}/${dataSets.length}] ${dataSet.topic}`);
    
    // Držet lokální kopii generated_materials pro tento DataSet
    let currentMaterials = [...(dsRow.generated_materials || [])];
    
    // Generovat každý typ materiálu
    for (const materialType of materialTypes) {
      onProgress?.(`  📝 Generuji ${materialType}...`);
      
      try {
        // Vyfiltrovat vyloučené obrázky a přidat vygenerované ilustrace
        const activeImages = (dataSet.media?.images || []).filter((img: any) => !img.excluded);
        const generatedIllustrations = dataSet.media?.generatedIllustrations || [];
        
        const filteredDataSet = {
          ...dataSet,
          media: {
            ...dataSet.media,
            images: activeImages,
            generatedIllustrations: generatedIllustrations
          }
        };
        
        const result = await generateFromDataSet(filteredDataSet, materialType);
        
        if (result.success) {
          byType[materialType] = (byType[materialType] || 0) + 1;
          total++;
          onProgress?.(`  ✅ ${materialType} vygenerován`);
          
          // Přidat do lokální kopie
          currentMaterials.push({
            type: materialType,
            id: result.id,
            title: dataSet.topic + ' - ' + (
              materialType === 'text' ? 'Učební text' : 
              materialType === 'methodology' ? 'Metodika' : materialType
            ),
            status: 'draft',
            createdAt: new Date().toISOString()
          });
            
        } else {
          errors.push(`${dataSet.topic} - ${materialType}: ${result.error}`);
          onProgress?.(`  ❌ ${materialType} selhal: ${result.error}`);
        }
        
      } catch (err: any) {
        errors.push(`${dataSet.topic} - ${materialType}: ${err.message}`);
        onProgress?.(`  ❌ ${materialType} error: ${err.message}`);
      }
    }
    
    // Uložit všechny materiály najednou po dokončení všech typů
    if (currentMaterials.length > 0) {
      await supabase
        .from('topic_data_sets')
        .update({
          generated_materials: currentMaterials,
          updated_at: new Date().toISOString()
        })
        .eq('id', dataSet.id);
      
      onProgress?.(`  💾 Uloženo ${currentMaterials.length} materiálů do DataSetu`);
    }
  }
  
  onProgress?.(`✅ Agent 4 (DataSet) dokončen: ${total} materiálů vygenerováno`);
  
  return {
    materialsGenerated: total,
    byType,
    errors
  };
}

/**
 * Agent 6 (DataSet): Ukládá vygenerované materiály do admin složek
 * 
 * Bere materiály z topic_data_sets.generated_materials a
 * publikuje je do správných složek v admin struktuře.
 */
export interface Agent6DataSetResult {
  published: number;
  byFolder: Record<string, number>;
}

export async function runAgent6DataSet(
  dataSetIds: string[],
  subjectCode: SubjectCode,
  grade: Grade,
  onProgress?: (message: string) => void
): Promise<Agent6DataSetResult> {
  onProgress?.('📦 Publikuji materiály do admin složek...');
  
  const byFolder: Record<string, number> = {};
  let published = 0;
  
  // Načíst DataSety s vygenerovanými materiály
  let dataSets: any[] = [];
  
  if (dataSetIds && dataSetIds.length > 0) {
    const { data, error } = await supabase
      .from('topic_data_sets')
      .select('*')
      .in('id', dataSetIds);
    
    if (!error && data) {
      dataSets = data;
    }
  }
  
  // Fallback: načíst podle subject_code a grade
  if (dataSets.length === 0) {
    const { data, error } = await supabase
      .from('topic_data_sets')
      .select('*')
      .eq('subject_code', subjectCode)
      .eq('grade', grade)
      .neq('status', 'published');
    
    if (error) {
      onProgress?.(`❌ Chyba: ${error.message}`);
      return { published: 0, byFolder };
    }
    dataSets = data || [];
  }
  
  // Pro každý DataSet zpracovat materiály
  for (const ds of dataSets) {
    const materials = ds.generated_materials || [];
    const folderSlug = `${subjectCode}-${grade}-${ds.topic.toLowerCase().replace(/\s+/g, '-')}`;
    
    onProgress?.(`📁 ${ds.topic}: ${materials.length} materiálů`);
    
    for (const material of materials) {
      if (material.status === 'published') continue;
      
      try {
        // Podle typu materiálu aktualizovat správnou tabulku
        let tableName = '';
        let updateData: any = { copied_from: 'curriculum-factory-dataset' };
        
        switch (material.type) {
          case 'text':
          case 'methodology':
            tableName = 'teacher_documents';
            updateData.subject = SUBJECT_NAMES[subjectCode];
            updateData.grade = grade;
            break;
          case 'board-easy':
          case 'board-hard':
          case 'test':
          case 'lesson':
            tableName = 'teacher_boards';
            updateData.subject = SUBJECT_NAMES[subjectCode];
            updateData.grade = grade;
            break;
          case 'worksheet':
            tableName = 'teacher_worksheets';
            break;
        }
        
        if (tableName && material.id) {
          const { error: updateError } = await supabase
            .from(tableName)
            .update(updateData)
            .eq('id', material.id);
          
          if (!updateError) {
            published++;
            byFolder[folderSlug] = (byFolder[folderSlug] || 0) + 1;
            
            // Označit materiál jako publikovaný
            material.status = 'published';
          }
        }
        
      } catch (err) {
        console.error(`[Agent6DataSet] Error publishing ${material.type}:`, err);
      }
    }
    
    // Aktualizovat DataSet s novými statusy materiálů
    await supabase
      .from('topic_data_sets')
      .update({
        generated_materials: materials,
        status: 'published',
        updated_at: new Date().toISOString()
      })
      .eq('id', ds.id);
  }
  
  onProgress?.(`✅ Agent 6 (DataSet) dokončen: ${published} materiálů publikováno`);
  
  return { published, byFolder };
}

/**
 * Helper: Spustí celý DataSet-based pipeline
 * 
 * Toto je hlavní funkce pro nový flow:
 * 1. Vytvoří DataSety z týdenních plánů (Agent 3)
 * 2. Vygeneruje materiály z DataSetů (Agent 4)
 * 3. Publikuje do admin složek (Agent 6)
 */
export interface DataSetPipelineResult {
  dataSetsCreated: number;
  materialsGenerated: number;
  published: number;
  errors: string[];
}

export async function runDataSetPipeline(
  subjectCode: SubjectCode,
  grade: Grade,
  weeklyPlans: WeeklyPlan[],
  rvpData: RvpData[],
  materialTypes: string[] = ['text', 'board-easy', 'board-hard', 'worksheet', 'test', 'lessons', 'methodology'],
  onProgress?: (message: string) => void,
  demoMode: boolean = false,
  onlyCreateDataSets: boolean = true // NOVÝ parametr - defaultně jen vytvořit DataSety
): Promise<DataSetPipelineResult> {
  const errors: string[] = [];
  
  onProgress?.('🚀 Spouštím DataSet pipeline...');
  
  // 1. Vytvořit DataSety
  const agent3Result = await runAgent3DataSet(
    subjectCode,
    grade,
    weeklyPlans,
    rvpData,
    onProgress,
    demoMode
  );
  
  if (agent3Result.dataSetsCreated === 0) {
    errors.push('Žádné DataSety nebyly vytvořeny');
    return {
      dataSetsCreated: 0,
      materialsGenerated: 0,
      published: 0,
      errors
    };
  }
  
  // Pokud jen vytváříme DataSety, končíme zde
  if (onlyCreateDataSets) {
    onProgress?.('🎉 DataSety vytvořeny! Materiály můžete generovat ručně v detailu DataSetu.');
    return {
      dataSetsCreated: agent3Result.dataSetsCreated,
      materialsGenerated: 0,
      published: 0,
      errors
    };
  }
  
  // 2. Vygenerovat materiály (jen pokud onlyCreateDataSets = false)
  const agent4Result = await runAgent4DataSet(
    agent3Result.dataSetIds,
    materialTypes,
    onProgress,
    subjectCode,
    grade
  );
  
  errors.push(...agent4Result.errors);
  
  // 3. Publikovat
  const agent6Result = await runAgent6DataSet(
    agent3Result.dataSetIds,
    subjectCode,
    grade,
    onProgress
  );
  
  onProgress?.('🎉 DataSet pipeline dokončena!');
  
  return {
    dataSetsCreated: agent3Result.dataSetsCreated,
    materialsGenerated: agent4Result.materialsGenerated,
    published: agent6Result.published,
    errors
  };
}
