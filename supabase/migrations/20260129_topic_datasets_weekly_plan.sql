-- =====================================================
-- ADD weekly_plan_id TO topic_data_sets
-- Pro propojení DataSetů s týdenními plány z Curriculum Factory
-- =====================================================

-- Přidat sloupec weekly_plan_id
ALTER TABLE topic_data_sets 
ADD COLUMN IF NOT EXISTS weekly_plan_id uuid REFERENCES curriculum_weekly_plans(id);

-- Index pro vyhledávání podle weekly_plan_id
CREATE INDEX IF NOT EXISTS idx_topic_datasets_weekly_plan ON topic_data_sets(weekly_plan_id);

SELECT 'topic_data_sets: weekly_plan_id added!' as result;
