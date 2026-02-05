-- =====================================================
-- DISK IO OPTIMIZATION MIGRATION
-- 2026-02-01
-- Řeší vysoké Disk IO na Supabase
-- =====================================================

-- =====================================================
-- 1. KRITICKÉ INDEXY PRO USER_EVENTS
-- =====================================================

-- Composite index pro nejčastější dotaz (user + čas)
CREATE INDEX IF NOT EXISTS idx_user_events_user_time 
ON user_events(user_id, created_at DESC);

-- Index pro event_type filtrování
CREATE INDEX IF NOT EXISTS idx_user_events_type_time
ON user_events(event_type, created_at DESC);

-- Partial index pro nedávné události (dramaticky zmenší IO)
-- POZNÁMKA: Datum je statické - pravidelně aktualizuj nebo smaž a vytvoř znovu
CREATE INDEX IF NOT EXISTS idx_user_events_recent_30d
ON user_events(user_id, event_type)
WHERE created_at > '2026-01-01'::timestamptz;

-- =====================================================
-- 2. INDEXY PRO TEACHER CONTENT
-- =====================================================

-- Boards - nejčastější dotazy
CREATE INDEX IF NOT EXISTS idx_teacher_boards_teacher_updated 
ON teacher_boards(teacher_id, updated_at DESC);

-- Documents
CREATE INDEX IF NOT EXISTS idx_teacher_documents_teacher_updated
ON teacher_documents(teacher_id, updated_at DESC);

-- Worksheets
CREATE INDEX IF NOT EXISTS idx_teacher_worksheets_teacher_updated
ON teacher_worksheets(teacher_id, updated_at DESC);

-- =====================================================
-- 3. INDEXY PRO TOPIC_DATA_SETS
-- =====================================================

-- Composite pro lookup
CREATE INDEX IF NOT EXISTS idx_topic_datasets_subject_grade_plan
ON topic_data_sets(subject_code, grade, weekly_plan_id);

-- =====================================================
-- 4. INDEXY PRO CLASSES & STUDENTS
-- =====================================================

-- Students by class (N+1 prevence)
CREATE INDEX IF NOT EXISTS idx_students_class_created
ON students(class_id, created_at DESC);

-- Results by assignment
CREATE INDEX IF NOT EXISTS idx_results_assignment_student
ON results(assignment_id, student_id);

-- =====================================================
-- 5. AUTOVACUUM TUNING
-- =====================================================

-- user_events - častější vacuum (velký počet zápisů)
ALTER TABLE user_events SET (
    autovacuum_vacuum_scale_factor = 0.05,
    autovacuum_analyze_scale_factor = 0.02,
    autovacuum_vacuum_cost_delay = 10
);

-- teacher_boards - střední frekvence
ALTER TABLE teacher_boards SET (
    autovacuum_vacuum_scale_factor = 0.1,
    autovacuum_analyze_scale_factor = 0.05
);

-- topic_data_sets - velké řádky
ALTER TABLE topic_data_sets SET (
    autovacuum_vacuum_scale_factor = 0.1,
    autovacuum_analyze_scale_factor = 0.05
);

-- =====================================================
-- 6. RETENTION POLICY FUNKCE
-- =====================================================

-- Funkce pro batch mazání starých eventů
CREATE OR REPLACE FUNCTION delete_old_events_batch(
    p_batch_size INTEGER DEFAULT 1000,
    p_retention_days INTEGER DEFAULT 90
)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    WITH deleted AS (
        DELETE FROM user_events
        WHERE id IN (
            SELECT id FROM user_events
            WHERE created_at < NOW() - (p_retention_days || ' days')::INTERVAL
            LIMIT p_batch_size
        )
        RETURNING id
    )
    SELECT COUNT(*) INTO deleted_count FROM deleted;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. MATERIALIZED VIEW PRO STATISTIKY
-- =====================================================

-- Denní agregované statistiky (místo opakovaných dotazů)
DROP MATERIALIZED VIEW IF EXISTS mv_daily_user_activity;
CREATE MATERIALIZED VIEW mv_daily_user_activity AS
SELECT 
    DATE(created_at) as activity_date,
    user_id,
    school_id,
    COUNT(*) as event_count,
    COUNT(DISTINCT event_type) as unique_events,
    MIN(created_at) as first_activity,
    MAX(created_at) as last_activity
FROM user_events
WHERE created_at > '2026-01-01'::timestamptz
GROUP BY DATE(created_at), user_id, school_id
WITH DATA;

-- Unique index pro REFRESH CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_daily_user_pk 
ON mv_daily_user_activity(activity_date, user_id);

-- Index pro rychlé dotazy
CREATE INDEX IF NOT EXISTS idx_mv_daily_user_school
ON mv_daily_user_activity(school_id, activity_date DESC);

-- =====================================================
-- 8. MONITORING VIEW
-- =====================================================

-- View pro sledování problémových tabulek
CREATE OR REPLACE VIEW v_table_io_stats AS
SELECT 
    schemaname,
    relname as table_name,
    seq_scan,
    seq_tup_read,
    idx_scan,
    idx_tup_fetch,
    n_live_tup as live_rows,
    n_dead_tup as dead_rows,
    CASE 
        WHEN seq_scan + idx_scan > 0 
        THEN ROUND(100.0 * idx_scan / (seq_scan + idx_scan), 1)
        ELSE 0 
    END as idx_usage_pct,
    pg_size_pretty(pg_total_relation_size(schemaname || '.' || relname)) as total_size
FROM pg_stat_user_tables
ORDER BY seq_tup_read DESC;

-- =====================================================
-- HOTOVO! ✅
-- =====================================================
-- Vytvořeno:
-- - 11 nových indexů
-- - Autovacuum tuning pro 3 tabulky
-- - Retention policy funkce
-- - Materialized view pro statistiky
-- - Monitoring view
--
-- DALŠÍ KROKY:
-- 1. Spusť: SELECT * FROM v_table_io_stats;
-- 2. Nastav cron job pro REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_user_activity;
-- 3. Nastav cron job pro SELECT delete_old_events_batch(1000, 90);
