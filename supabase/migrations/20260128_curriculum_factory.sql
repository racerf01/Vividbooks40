-- =====================================================
-- CURRICULUM FACTORY - Database Schema
-- =====================================================
-- Systém pro automatickou tvorbu vzdělávacích materiálů
-- podle RVP pro základní vzdělávání
-- =====================================================

-- 1. Předměty a jejich konfigurace
CREATE TABLE IF NOT EXISTS curriculum_subjects (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code text UNIQUE NOT NULL,           -- 'dejepis', 'zemepis', 'cj', 'aj'
  name text NOT NULL,                   -- 'Dějepis'
  description text,
  icon text,                            -- emoji nebo lucide icon name
  color text,                           -- hex barva pro UI
  hours_per_week_default integer DEFAULT 2,
  grades integer[] DEFAULT '{6,7,8,9}', -- ročníky kde se učí
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. RVP Data - očekávané výstupy a kompetence
CREATE TABLE IF NOT EXISTS curriculum_rvp_data (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_code text NOT NULL REFERENCES curriculum_subjects(code),
  grade integer NOT NULL,               -- 6, 7, 8, 9
  thematic_area text NOT NULL,          -- 'Pravěk', 'Starověk', 'Středověk'...
  topic text NOT NULL,                  -- 'Starověký Egypt'
  expected_outcomes text[],             -- očekávané výstupy z RVP
  key_competencies text[],              -- klíčové kompetence
  cross_curricular_topics text[],       -- průřezová témata
  recommended_hours integer,            -- doporučený počet hodin
  difficulty_level text DEFAULT 'medium', -- 'easy', 'medium', 'hard'
  prerequisites text[],                 -- předchozí znalosti
  source_document text,                 -- odkaz na RVP dokument
  rvp_revision text DEFAULT '2021',     -- verze RVP
  order_index integer DEFAULT 0,        -- pořadí v rámci ročníku
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Týdenní plány - rozložení učiva
CREATE TABLE IF NOT EXISTS curriculum_weekly_plans (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_code text NOT NULL REFERENCES curriculum_subjects(code),
  grade integer NOT NULL,
  school_year text,                     -- '2025/2026'
  week_number integer NOT NULL,         -- 1-40 (září = 1)
  month_name text,                      -- 'září', 'říjen'...
  topic_title text NOT NULL,
  topic_description text,
  rvp_data_id uuid REFERENCES curriculum_rvp_data(id),
  learning_goals text[],                -- cíle pro tento týden
  vocabulary text[],                    -- klíčové pojmy
  activities_planned jsonb,             -- plánované aktivity
  hours_allocated integer DEFAULT 2,
  status text DEFAULT 'draft',          -- 'draft', 'approved', 'completed'
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(subject_code, grade, school_year, week_number)
);

-- 4. Specifikace obsahu - zadání pro jednotlivé materiály
CREATE TABLE IF NOT EXISTS curriculum_content_specs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  weekly_plan_id uuid REFERENCES curriculum_weekly_plans(id) ON DELETE CASCADE,
  content_type text NOT NULL,           -- 'board', 'worksheet', 'text', 'quiz'
  content_subtype text,                 -- 'procvicovani', 'test', 'ucebni_text'
  title text NOT NULL,
  description text,
  difficulty text DEFAULT 'medium',     -- 'easy', 'medium', 'hard'
  target_duration_minutes integer,      -- cca délka aktivity
  question_types text[],                -- ['abc', 'fill-blank', 'open', 'matching']
  question_count integer,               -- počet otázek/úloh
  specific_requirements text,           -- speciální požadavky
  learning_objectives text[],           -- vzdělávací cíle
  bloom_level text,                     -- 'znalost', 'porozumění', 'aplikace'...
  priority integer DEFAULT 1,           -- 1 = highest
  status text DEFAULT 'pending',        -- 'pending', 'generating', 'draft', 'approved', 'published'
  assigned_to text,                     -- 'agent-4', 'manual'
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 5. Drafty obsahu - vygenerovaný obsah před finalizací
CREATE TABLE IF NOT EXISTS curriculum_content_drafts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  spec_id uuid REFERENCES curriculum_content_specs(id) ON DELETE CASCADE,
  version integer DEFAULT 1,
  content_json jsonb NOT NULL,          -- slides/blocks/questions
  metadata jsonb,                       -- info o generování
  quality_score integer,                -- 0-100 hodnocení kvality
  qa_notes text,                        -- poznámky z QA
  word_count integer,
  question_count integer,
  media_references text[],              -- odkazy na média
  status text DEFAULT 'draft',          -- 'draft', 'reviewed', 'approved', 'rejected'
  reviewed_by uuid,                     -- kdo schválil
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 6. Knihovna médií pro curriculum
CREATE TABLE IF NOT EXISTS curriculum_media_library (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  file_url text NOT NULL,
  thumbnail_url text,
  file_name text,
  file_type text,                       -- 'image', 'video', 'audio'
  mime_type text,
  file_size integer,
  -- Tagy a kategorizace
  subject_tags text[],                  -- ['dejepis', 'zemepis']
  topic_tags text[],                    -- ['starovek', 'egypt', 'pyramidy']
  grade_tags integer[],                 -- [6, 7]
  keyword_tags text[],                  -- ['faraon', 'nil', 'mumie']
  -- Metadata
  source_url text,                      -- odkud obrázek pochází
  source_name text,                     -- 'Wikipedia', 'Wikimedia Commons'
  license text,                         -- 'CC0', 'CC-BY', 'CC-BY-SA'
  license_url text,
  author text,
  ai_description text,                  -- popis od vision modelu
  ai_alt_text text,                     -- alt text pro přístupnost
  -- Status
  is_verified boolean DEFAULT false,
  is_appropriate boolean DEFAULT true,  -- vhodné pro školy
  usage_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 7. Pipeline runs - sledování běhů pipeline
CREATE TABLE IF NOT EXISTS curriculum_pipeline_runs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_code text NOT NULL REFERENCES curriculum_subjects(code),
  grade integer,
  run_type text NOT NULL,               -- 'full', 'partial', 'single_week'
  target_weeks integer[],               -- které týdny zpracovat
  -- Status jednotlivých agentů
  agent1_status text DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
  agent1_started_at timestamptz,
  agent1_completed_at timestamptz,
  agent1_output jsonb,
  agent2_status text DEFAULT 'pending',
  agent2_started_at timestamptz,
  agent2_completed_at timestamptz,
  agent2_output jsonb,
  agent3_status text DEFAULT 'pending',
  agent3_started_at timestamptz,
  agent3_completed_at timestamptz,
  agent3_output jsonb,
  agent4_status text DEFAULT 'pending',
  agent4_started_at timestamptz,
  agent4_completed_at timestamptz,
  agent4_output jsonb,
  agent5_status text DEFAULT 'pending',
  agent5_started_at timestamptz,
  agent5_completed_at timestamptz,
  agent5_output jsonb,
  agent6_status text DEFAULT 'pending',
  agent6_started_at timestamptz,
  agent6_completed_at timestamptz,
  agent6_output jsonb,
  -- Celkový status
  overall_status text DEFAULT 'pending',
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  started_by uuid,
  -- Statistiky
  stats jsonb,                          -- počty vygenerovaných materiálů atd.
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 8. Finální publikované materiály (link na teacher_boards/worksheets)
CREATE TABLE IF NOT EXISTS curriculum_published_content (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  draft_id uuid REFERENCES curriculum_content_drafts(id),
  spec_id uuid REFERENCES curriculum_content_specs(id),
  content_type text NOT NULL,
  -- Reference na finální obsah
  teacher_board_id text,                -- UUID boardu v teacher_boards
  teacher_worksheet_id text,            -- UUID worksheetu
  teacher_document_id text,             -- UUID dokumentu
  -- Metadata
  title text NOT NULL,
  subject_code text NOT NULL,
  grade integer NOT NULL,
  week_number integer,
  difficulty text,
  is_public boolean DEFAULT false,      -- dostupné pro všechny učitele
  is_premium boolean DEFAULT false,     -- placený obsah
  download_count integer DEFAULT 0,
  rating_average numeric(3,2),
  rating_count integer DEFAULT 0,
  published_at timestamptz DEFAULT now(),
  published_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =====================================================
-- INDEXY
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_rvp_data_subject_grade ON curriculum_rvp_data(subject_code, grade);
CREATE INDEX IF NOT EXISTS idx_weekly_plans_subject_grade ON curriculum_weekly_plans(subject_code, grade, school_year);
CREATE INDEX IF NOT EXISTS idx_content_specs_weekly_plan ON curriculum_content_specs(weekly_plan_id);
CREATE INDEX IF NOT EXISTS idx_content_drafts_spec ON curriculum_content_drafts(spec_id);
CREATE INDEX IF NOT EXISTS idx_media_subject_tags ON curriculum_media_library USING GIN(subject_tags);
CREATE INDEX IF NOT EXISTS idx_media_topic_tags ON curriculum_media_library USING GIN(topic_tags);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_subject ON curriculum_pipeline_runs(subject_code, grade);

-- =====================================================
-- SEED DATA - Dějepis
-- =====================================================

-- Vložit předmět Dějepis
INSERT INTO curriculum_subjects (code, name, description, icon, color, hours_per_week_default, grades)
VALUES (
  'dejepis',
  'Dějepis',
  'Historie a společenské vědy pro 2. stupeň ZŠ',
  'scroll',
  '#8B4513',
  2,
  '{6,7,8,9}'
) ON CONFLICT (code) DO NOTHING;

-- Vložit základní RVP data pro Dějepis - 6. třída
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index)
VALUES
  -- PRAVĚK
  ('dejepis', 6, 'Pravěk', 'Úvod do studia dějepisu', 
   ARRAY['Žák rozliší historické prameny', 'Žák vysvětlí význam studia historie', 'Žák orientuje se na časové ose'],
   ARRAY['kompetence k učení', 'kompetence komunikativní'],
   4, 1),
  ('dejepis', 6, 'Pravěk', 'Doba kamenná',
   ARRAY['Žák charakterizuje způsob života v paleolitu a neolitu', 'Žák vysvětlí význam neolitické revoluce'],
   ARRAY['kompetence k učení', 'kompetence občanské'],
   6, 2),
  ('dejepis', 6, 'Pravěk', 'Doba bronzová a železná',
   ARRAY['Žák popíše změny v životě lidí s příchodem kovů', 'Žák charakterizuje kultury doby bronzové na našem území'],
   ARRAY['kompetence k učení'],
   4, 3),
  -- STAROVĚK
  ('dejepis', 6, 'Starověk', 'Starověká Mezopotámie',
   ARRAY['Žák lokalizuje na mapě první civilizace', 'Žák vysvětlí význam písma a zákonů'],
   ARRAY['kompetence k učení', 'kompetence občanské'],
   6, 4),
  ('dejepis', 6, 'Starověk', 'Starověký Egypt',
   ARRAY['Žák charakterizuje egyptskou společnost', 'Žák popíše náboženství a kulturu starověkého Egypta', 'Žák vysvětlí význam Nilu'],
   ARRAY['kompetence k učení', 'kompetence komunikativní'],
   8, 5),
  ('dejepis', 6, 'Starověk', 'Starověké Řecko',
   ARRAY['Žák srovná athénskou demokracii a spartskou oligarchii', 'Žák charakterizuje řeckou kulturu a filozofii'],
   ARRAY['kompetence k učení', 'kompetence občanské', 'kompetence komunikativní'],
   10, 6),
  ('dejepis', 6, 'Starověk', 'Starověký Řím',
   ARRAY['Žák popíše vývoj římského státu', 'Žák charakterizuje římskou společnost a právo', 'Žák vysvětlí pád západořímské říše'],
   ARRAY['kompetence k učení', 'kompetence občanské'],
   10, 7)
ON CONFLICT DO NOTHING;

-- Vložit základní RVP data pro Dějepis - 7. třída
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index)
VALUES
  -- RANÝ STŘEDOVĚK
  ('dejepis', 7, 'Středověk', 'Stěhování národů a vznik nových států',
   ARRAY['Žák vysvětlí příčiny a důsledky stěhování národů', 'Žák charakterizuje vznik raně středověkých států'],
   ARRAY['kompetence k učení'],
   6, 1),
  ('dejepis', 7, 'Středověk', 'Byzantská říše a islám',
   ARRAY['Žák charakterizuje byzantskou kulturu', 'Žák vysvětlí vznik a šíření islámu'],
   ARRAY['kompetence k učení', 'kompetence občanské'],
   6, 2),
  ('dejepis', 7, 'Středověk', 'Francká říše a Sámova říše',
   ARRAY['Žák popíše vývoj francké říše', 'Žák vysvětlí význam Sámovy říše'],
   ARRAY['kompetence k učení'],
   4, 3),
  ('dejepis', 7, 'Středověk', 'Velká Morava',
   ARRAY['Žák charakterizuje Velkomoravskou říši', 'Žák vysvětlí význam mise Cyrila a Metoděje'],
   ARRAY['kompetence k učení', 'kompetence občanské'],
   6, 4),
  ('dejepis', 7, 'Středověk', 'Počátky českého státu - Přemyslovci',
   ARRAY['Žák popíše vznik českého státu', 'Žák charakterizuje vládu prvních Přemyslovců'],
   ARRAY['kompetence k učení', 'kompetence občanské'],
   8, 5),
  -- VRCHOLNÝ STŘEDOVĚK
  ('dejepis', 7, 'Středověk', 'Románská a gotická kultura',
   ARRAY['Žák rozliší románský a gotický sloh', 'Žák uvede příklady památek'],
   ARRAY['kompetence k učení', 'kompetence komunikativní'],
   4, 6),
  ('dejepis', 7, 'Středověk', 'Vláda Lucemburků',
   ARRAY['Žák charakterizuje vládu Karla IV.', 'Žák vysvětlí význam založení pražské univerzity'],
   ARRAY['kompetence k učení', 'kompetence občanské'],
   8, 7),
  -- HUSITSTVÍ
  ('dejepis', 7, 'Středověk', 'Jan Hus a předpoklady husitství',
   ARRAY['Žák vysvětlí příčiny husitského hnutí', 'Žák charakterizuje osobnost Jana Husa'],
   ARRAY['kompetence k učení', 'kompetence občanské'],
   6, 8),
  ('dejepis', 7, 'Středověk', 'Husitské války',
   ARRAY['Žák popíše průběh husitských válek', 'Žák vysvětlí význam husitství pro české dějiny'],
   ARRAY['kompetence k učení', 'kompetence občanské'],
   8, 9),
  ('dejepis', 7, 'Středověk', 'Jagellonci na českém trůnu',
   ARRAY['Žák charakterizuje období vlády Jagellonců', 'Žák vysvětlí nástup Habsburků'],
   ARRAY['kompetence k učení'],
   4, 10)
ON CONFLICT DO NOTHING;

-- Vložit základní RVP data pro Dějepis - 8. třída  
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index)
VALUES
  ('dejepis', 8, 'Novověk', 'Renesance a humanismus',
   ARRAY['Žák charakterizuje renesanční myšlení', 'Žák uvede příklady renesančního umění'],
   ARRAY['kompetence k učení', 'kompetence komunikativní'],
   6, 1),
  ('dejepis', 8, 'Novověk', 'Zámořské objevy',
   ARRAY['Žák vysvětlí příčiny a důsledky zámořských objevů', 'Žák zhodnotí dopady na domorodé obyvatelstvo'],
   ARRAY['kompetence k učení', 'kompetence občanské'],
   6, 2),
  ('dejepis', 8, 'Novověk', 'Reformace a protireformace',
   ARRAY['Žák vysvětlí příčiny reformace', 'Žák charakterizuje hlavní reformační proudy'],
   ARRAY['kompetence k učení', 'kompetence občanské'],
   6, 3),
  ('dejepis', 8, 'Novověk', 'Třicetiletá válka',
   ARRAY['Žák popíše příčiny a průběh třicetileté války', 'Žák vysvětlí důsledky pro české země'],
   ARRAY['kompetence k učení', 'kompetence občanské'],
   8, 4),
  ('dejepis', 8, 'Novověk', 'Osvícenství a revoluce',
   ARRAY['Žák charakterizuje osvícenské myšlení', 'Žák vysvětlí příčiny a průběh francouzské revoluce'],
   ARRAY['kompetence k učení', 'kompetence občanské'],
   8, 5),
  ('dejepis', 8, 'Novověk', 'Napoleonské války',
   ARRAY['Žák popíše napoleonské války', 'Žák vysvětlí dopad na Evropu'],
   ARRAY['kompetence k učení'],
   6, 6),
  ('dejepis', 8, 'Novověk', 'Průmyslová revoluce',
   ARRAY['Žák vysvětlí příčiny a důsledky průmyslové revoluce', 'Žák charakterizuje změny ve společnosti'],
   ARRAY['kompetence k učení', 'kompetence občanské'],
   8, 7),
  ('dejepis', 8, 'Novověk', 'Národní obrození',
   ARRAY['Žák charakterizuje české národní obrození', 'Žák uvede hlavní osobnosti a jejich dílo'],
   ARRAY['kompetence k učení', 'kompetence komunikativní'],
   8, 8)
ON CONFLICT DO NOTHING;

-- Vložit základní RVP data pro Dějepis - 9. třída
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index)
VALUES
  ('dejepis', 9, 'Moderní dějiny', 'Vznik Československa',
   ARRAY['Žák vysvětlí okolnosti vzniku ČSR', 'Žák charakterizuje první republiku'],
   ARRAY['kompetence k učení', 'kompetence občanské'],
   8, 1),
  ('dejepis', 9, 'Moderní dějiny', 'První světová válka',
   ARRAY['Žák vysvětlí příčiny a průběh 1. světové války', 'Žák popíše dopady na české země'],
   ARRAY['kompetence k učení', 'kompetence občanské'],
   8, 2),
  ('dejepis', 9, 'Moderní dějiny', 'Meziválečné období',
   ARRAY['Žák charakterizuje meziválečnou Evropu', 'Žák vysvětlí vzestup totalitních režimů'],
   ARRAY['kompetence k učení', 'kompetence občanské'],
   8, 3),
  ('dejepis', 9, 'Moderní dějiny', 'Druhá světová válka',
   ARRAY['Žák popíše příčiny, průběh a důsledky 2. světové války', 'Žák vysvětlí holokaust'],
   ARRAY['kompetence k učení', 'kompetence občanské'],
   10, 4),
  ('dejepis', 9, 'Moderní dějiny', 'Poválečné Československo',
   ARRAY['Žák charakterizuje poválečný vývoj', 'Žák vysvětlí únor 1948'],
   ARRAY['kompetence k učení', 'kompetence občanské'],
   6, 5),
  ('dejepis', 9, 'Moderní dějiny', 'Období komunismu',
   ARRAY['Žák charakterizuje totalitní režim v Československu', 'Žák vysvětlí události roku 1968'],
   ARRAY['kompetence k učení', 'kompetence občanské'],
   10, 6),
  ('dejepis', 9, 'Moderní dějiny', 'Sametová revoluce a současnost',
   ARRAY['Žák vysvětlí příčiny a průběh sametové revoluce', 'Žák charakterizuje transformaci po roce 1989'],
   ARRAY['kompetence k učení', 'kompetence občanské'],
   8, 7)
ON CONFLICT DO NOTHING;

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Povolit čtení pro všechny autentizované uživatele
ALTER TABLE curriculum_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_rvp_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_weekly_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_content_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_content_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_media_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_pipeline_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_published_content ENABLE ROW LEVEL SECURITY;

-- Read policies (všichni autentizovaní mohou číst)
CREATE POLICY "curriculum_subjects_read" ON curriculum_subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "curriculum_rvp_read" ON curriculum_rvp_data FOR SELECT TO authenticated USING (true);
CREATE POLICY "curriculum_weekly_read" ON curriculum_weekly_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "curriculum_specs_read" ON curriculum_content_specs FOR SELECT TO authenticated USING (true);
CREATE POLICY "curriculum_drafts_read" ON curriculum_content_drafts FOR SELECT TO authenticated USING (true);
CREATE POLICY "curriculum_media_read" ON curriculum_media_library FOR SELECT TO authenticated USING (true);
CREATE POLICY "curriculum_pipeline_read" ON curriculum_pipeline_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "curriculum_published_read" ON curriculum_published_content FOR SELECT TO authenticated USING (true);

-- Write policies (pouze service role / admin - bude řešeno přes Edge Functions)
CREATE POLICY "curriculum_subjects_write" ON curriculum_subjects FOR ALL TO service_role USING (true);
CREATE POLICY "curriculum_rvp_write" ON curriculum_rvp_data FOR ALL TO service_role USING (true);
CREATE POLICY "curriculum_weekly_write" ON curriculum_weekly_plans FOR ALL TO service_role USING (true);
CREATE POLICY "curriculum_specs_write" ON curriculum_content_specs FOR ALL TO service_role USING (true);
CREATE POLICY "curriculum_drafts_write" ON curriculum_content_drafts FOR ALL TO service_role USING (true);
CREATE POLICY "curriculum_media_write" ON curriculum_media_library FOR ALL TO service_role USING (true);
CREATE POLICY "curriculum_pipeline_write" ON curriculum_pipeline_runs FOR ALL TO service_role USING (true);
CREATE POLICY "curriculum_published_write" ON curriculum_published_content FOR ALL TO service_role USING (true);
