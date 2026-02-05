-- =====================================================
-- RESET CURRICULUM PLANS - Smaže staré týdenní plány
-- pro nové rovnoměrné rozložení učiva na celý rok
-- =====================================================

-- 1. Smazat týdenní plány pro Dějepis 6. třídu
DELETE FROM curriculum_weekly_plans 
WHERE subject_code = 'dejepis' AND grade = 6;

-- 2. Smazat content specs (navázané na weekly plans)
DELETE FROM curriculum_content_specs 
WHERE weekly_plan_id NOT IN (SELECT id FROM curriculum_weekly_plans);

-- 3. Smazat drafty (navázané na specs)
DELETE FROM curriculum_content_drafts 
WHERE spec_id NOT IN (SELECT id FROM curriculum_content_specs);

-- 4. Smazat media library pro dějepis (volitelné - pro nové obrázky)
-- DELETE FROM curriculum_media_library WHERE 'dejepis' = ANY(subject_tags);

-- 5. Zobrazit stav
SELECT 'curriculum_weekly_plans' as table_name, COUNT(*) as count FROM curriculum_weekly_plans WHERE subject_code = 'dejepis'
UNION ALL
SELECT 'curriculum_content_specs', COUNT(*) FROM curriculum_content_specs
UNION ALL  
SELECT 'curriculum_content_drafts', COUNT(*) FROM curriculum_content_drafts;
