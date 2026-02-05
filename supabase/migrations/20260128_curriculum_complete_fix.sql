-- =====================================================
-- KOMPLETNÍ OPRAVA CURRICULUM FACTORY TABULEK
-- Spusťte v Supabase Dashboard → SQL Editor
-- =====================================================

-- 1. Přidání chybějících sloupců do curriculum_content_drafts
ALTER TABLE curriculum_content_drafts 
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_id text;

-- 2. Přidání sloupců pro subject/grade do curriculum_content_specs (pro jednodušší dotazy)
ALTER TABLE curriculum_content_specs
  ADD COLUMN IF NOT EXISTS subject_code text,
  ADD COLUMN IF NOT EXISTS grade integer;

-- 3. Aktualizovat subject_code a grade v specs z weekly_plans
UPDATE curriculum_content_specs cs
SET 
  subject_code = wp.subject_code,
  grade = wp.grade
FROM curriculum_weekly_plans wp
WHERE cs.weekly_plan_id = wp.id
AND (cs.subject_code IS NULL OR cs.grade IS NULL);

-- 4. RLS Policies - DROP ALL existing policies first
DO $$ 
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname, tablename 
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename IN (
      'curriculum_subjects',
      'curriculum_rvp_data', 
      'curriculum_weekly_plans',
      'curriculum_content_specs',
      'curriculum_content_drafts',
      'curriculum_media_library',
      'curriculum_pipeline_runs',
      'curriculum_published_content',
      'teacher_folders',
      'teacher_boards',
      'teacher_worksheets', 
      'teacher_documents'
    )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- 5. Create new permissive policies for all curriculum tables
CREATE POLICY "allow_all_curriculum_subjects" ON curriculum_subjects FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_curriculum_rvp" ON curriculum_rvp_data FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_curriculum_weekly" ON curriculum_weekly_plans FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_curriculum_specs" ON curriculum_content_specs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_curriculum_drafts" ON curriculum_content_drafts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_curriculum_media" ON curriculum_media_library FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_curriculum_pipeline" ON curriculum_pipeline_runs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Check if curriculum_published_content exists before adding policy
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'curriculum_published_content') THEN
    EXECUTE 'CREATE POLICY "allow_all_curriculum_published" ON curriculum_published_content FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- 6. Teacher tables policies
CREATE POLICY "allow_all_teacher_folders" ON teacher_folders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_teacher_boards" ON teacher_boards FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_teacher_worksheets" ON teacher_worksheets FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_teacher_documents" ON teacher_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7. Vyčistit staré drafty bez spec_id
DELETE FROM curriculum_content_drafts WHERE spec_id IS NULL;

-- 8. Indexy pro rychlejší dotazy
CREATE INDEX IF NOT EXISTS idx_specs_subject_grade ON curriculum_content_specs(subject_code, grade);
CREATE INDEX IF NOT EXISTS idx_drafts_status ON curriculum_content_drafts(status);
CREATE INDEX IF NOT EXISTS idx_drafts_spec_id ON curriculum_content_drafts(spec_id);

-- Hotovo!
SELECT 'Curriculum Factory database fix completed!' as result;
