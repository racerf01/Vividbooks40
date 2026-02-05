-- =====================================================
-- FIX: RLS Policies pro Curriculum Factory
-- Povolí INSERT/UPDATE/DELETE pro authenticated uživatele
-- =====================================================

-- Drop staré restrictivní policies
DROP POLICY IF EXISTS "curriculum_subjects_write" ON curriculum_subjects;
DROP POLICY IF EXISTS "curriculum_rvp_write" ON curriculum_rvp_data;
DROP POLICY IF EXISTS "curriculum_weekly_write" ON curriculum_weekly_plans;
DROP POLICY IF EXISTS "curriculum_specs_write" ON curriculum_content_specs;
DROP POLICY IF EXISTS "curriculum_drafts_write" ON curriculum_content_drafts;
DROP POLICY IF EXISTS "curriculum_media_write" ON curriculum_media_library;
DROP POLICY IF EXISTS "curriculum_pipeline_write" ON curriculum_pipeline_runs;
DROP POLICY IF EXISTS "curriculum_published_write" ON curriculum_published_content;

-- Nové policies - povolí všechny operace pro authenticated uživatele
CREATE POLICY "curriculum_subjects_all" ON curriculum_subjects 
  FOR ALL TO authenticated 
  USING (true) 
  WITH CHECK (true);

CREATE POLICY "curriculum_rvp_all" ON curriculum_rvp_data 
  FOR ALL TO authenticated 
  USING (true) 
  WITH CHECK (true);

CREATE POLICY "curriculum_weekly_all" ON curriculum_weekly_plans 
  FOR ALL TO authenticated 
  USING (true) 
  WITH CHECK (true);

CREATE POLICY "curriculum_specs_all" ON curriculum_content_specs 
  FOR ALL TO authenticated 
  USING (true) 
  WITH CHECK (true);

CREATE POLICY "curriculum_drafts_all" ON curriculum_content_drafts 
  FOR ALL TO authenticated 
  USING (true) 
  WITH CHECK (true);

CREATE POLICY "curriculum_media_all" ON curriculum_media_library 
  FOR ALL TO authenticated 
  USING (true) 
  WITH CHECK (true);

CREATE POLICY "curriculum_pipeline_all" ON curriculum_pipeline_runs 
  FOR ALL TO authenticated 
  USING (true) 
  WITH CHECK (true);

CREATE POLICY "curriculum_published_all" ON curriculum_published_content 
  FOR ALL TO authenticated 
  USING (true) 
  WITH CHECK (true);
