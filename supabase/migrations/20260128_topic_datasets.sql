-- =====================================================
-- TOPIC DATA SETS - shromážděná data pro generování materiálů
-- =====================================================

CREATE TABLE IF NOT EXISTS topic_data_sets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Základní info
  topic text NOT NULL,                    -- "Starověký Egypt"
  subject_code text NOT NULL,             -- "dejepis"
  grade integer NOT NULL,                 -- 6
  status text DEFAULT 'draft',            -- draft, ready, published
  
  -- RVP informace (JSONB)
  rvp jsonb NOT NULL DEFAULT '{
    "thematicArea": "",
    "expectedOutcomes": [],
    "competencies": [],
    "hoursAllocated": 0,
    "crossCurricular": []
  }'::jsonb,
  
  -- Cílová skupina (JSONB)
  target_group jsonb NOT NULL DEFAULT '{
    "ageRange": "",
    "gradeLevel": "",
    "cognitiveLevel": "",
    "priorKnowledge": [],
    "specialNeeds": null
  }'::jsonb,
  
  -- Obsahová data (JSONB)
  content jsonb NOT NULL DEFAULT '{
    "keyTerms": [],
    "keyFacts": [],
    "timeline": [],
    "personalities": [],
    "modernConnections": [],
    "funFacts": [],
    "sources": []
  }'::jsonb,
  
  -- Média (JSONB)
  media jsonb NOT NULL DEFAULT '{
    "images": [],
    "emojis": [],
    "themeColors": []
  }'::jsonb,
  
  -- Vygenerované materiály (JSONB array)
  generated_materials jsonb DEFAULT '[]'::jsonb,
  
  -- Metadata
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexy
CREATE INDEX IF NOT EXISTS idx_topic_datasets_subject ON topic_data_sets(subject_code);
CREATE INDEX IF NOT EXISTS idx_topic_datasets_grade ON topic_data_sets(grade);
CREATE INDEX IF NOT EXISTS idx_topic_datasets_status ON topic_data_sets(status);
CREATE INDEX IF NOT EXISTS idx_topic_datasets_topic ON topic_data_sets(topic);

-- RLS
ALTER TABLE topic_data_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "topic_datasets_select" ON topic_data_sets
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "topic_datasets_insert" ON topic_data_sets
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "topic_datasets_update" ON topic_data_sets
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "topic_datasets_delete" ON topic_data_sets
  FOR DELETE TO authenticated USING (true);

-- Trigger pro updated_at
CREATE OR REPLACE FUNCTION update_topic_datasets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS topic_datasets_updated_at ON topic_data_sets;
CREATE TRIGGER topic_datasets_updated_at
  BEFORE UPDATE ON topic_data_sets
  FOR EACH ROW
  EXECUTE FUNCTION update_topic_datasets_updated_at();

SELECT 'topic_data_sets table created!' as result;
