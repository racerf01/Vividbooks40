/**
 * Topic Data Set - shromážděná data pro generování vzdělávacích materiálů
 */

export interface TopicDataSet {
  id: string;
  
  // Základní info
  topic: string;              // "Starověký Egypt"
  subjectCode: string;        // "dejepis"
  grade: number;              // 6
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'ready' | 'published';
  
  // RVP informace
  rvp: RvpInfo;
  
  // Cílová skupina
  targetGroup: TargetGroupInfo;
  
  // Obsahová data
  content: ContentInfo;
  
  // Média a vizuály
  media: MediaInfo;
  
  // Vygenerované materiály (reference)
  generatedMaterials: GeneratedMaterialRef[];
}

export interface RvpInfo {
  thematicArea: string;           // "Starověk"
  expectedOutcomes: string[];     // ["Žák charakterizuje...", ...]
  competencies: string[];         // ["kompetence k učení", ...]
  hoursAllocated: number;         // 6
  crossCurricular: string[];      // ["Výchova k občanství", ...]
}

export interface TargetGroupInfo {
  ageRange: string;               // "11-12 let"
  gradeLevel: string;             // "6. třída ZŠ"
  cognitiveLevel: string;         // "konkrétní operace → formální operace"
  priorKnowledge: string[];       // ["základy pravěku", "čtení mapy"]
  specialNeeds?: string;          // poznámky k diferenciaci
}

export interface ContentInfo {
  // Klíčové pojmy s definicemi
  keyTerms: KeyTerm[];
  
  // Hlavní fakta a informace
  keyFacts: string[];
  
  // Časová osa (pokud relevantní)
  timeline?: TimelineEvent[];
  
  // Osobnosti
  personalities?: Personality[];
  
  // Propojení s dneškem
  modernConnections: string[];
  
  // Zajímavosti pro motivaci
  funFacts: string[];
  
  // Zdroje a reference
  sources: string[];
}

export interface KeyTerm {
  term: string;                   // "faraon"
  definition: string;             // "panovník starověkého Egypta"
  emoji?: string;                 // "👑"
}

export interface TimelineEvent {
  date: string;                   // "3000 př.n.l."
  event: string;                  // "sjednocení Egypta"
  importance: 'high' | 'medium' | 'low';
}

export interface Personality {
  name: string;                   // "Cheops"
  role: string;                   // "faraon"
  description: string;            // "nechal postavit největší pyramidu"
}

export interface MediaInfo {
  // Validované obrázky
  images: ValidatedImage[];
  
  // Emoji pro téma
  emojis: string[];               // ["🏺", "📜", "👑", "🐫"]
  
  // Doporučené barvy
  themeColors: string[];          // ["#D4A574", "#8B4513"]
  
  // Prompty pro generování ilustrací
  illustrationPrompts?: IllustrationPrompt[];
  
  // Vygenerované ilustrace
  generatedIllustrations?: GeneratedIllustration[];
}

export interface IllustrationPrompt {
  id: string;
  name: string;                   // "Řecký válečník"
  prompt: string;                 // Full prompt pro AI
  category: 'icon' | 'scene' | 'portrait' | 'object' | 'map';
  keywords: string[];             // ["hoplít", "helma", "štít"]
  status: 'pending' | 'generating' | 'done' | 'error';
}

export interface GeneratedIllustration {
  id: string;
  promptId: string;
  url: string;
  thumbnailUrl?: string;
  name: string;
  generatedAt: string;
}

export interface ValidatedImage {
  id: string;
  url: string;
  thumbnailUrl?: string;
  title: string;
  description?: string;
  source: string;                 // "Wikimedia Commons"
  license: string;                // "CC BY-SA"
  relevanceScore: number;         // 0-100
  keywords: string[];
}

export interface GeneratedMaterialRef {
  type: 'text' | 'board' | 'worksheet' | 'test' | 'lesson';
  id: string;
  title: string;
  status: 'draft' | 'published';
  createdAt: string;
}

// =====================================================
// FORMÁT SPECIFIKACE PRO JEDNOTLIVÉ GENERÁTORY
// =====================================================

export interface TextGeneratorInput {
  dataSet: TopicDataSet;
  options: {
    length: 'short' | 'medium' | 'long';  // 200/400/600 slov
    includeInfoboxes: boolean;
    includeTimeline: boolean;
    includeKeyTerms: boolean;
  };
}

export interface BoardGeneratorInput {
  dataSet: TopicDataSet;
  options: {
    type: 'procvicovani' | 'pisemka' | 'lekce';
    difficulty: 'easy' | 'medium' | 'hard';
    questionCount: number;
    questionTypes: ('abc' | 'open' | 'voting' | 'board')[];
    useEUR?: boolean;  // pro lekce - E-U-R metoda
  };
}

export interface WorksheetGeneratorInput {
  dataSet: TopicDataSet;
  options: {
    blockCount: number;
    blockTypes: ('heading' | 'paragraph' | 'fill-blank' | 'multiple-choice' | 'free-answer' | 'image')[];
    difficulty: 'easy' | 'medium' | 'hard';
  };
}
