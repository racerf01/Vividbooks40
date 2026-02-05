-- =====================================================
-- VIVIDBOOKS DISK IO OPTIMALIZACE
-- Pro Supabase PostgreSQL - Senior DB Engineer Guide
-- =====================================================

-- =====================================================
-- 1) DIAGNOSTIKA - NAJDI PROBLÉMY
-- =====================================================

-- 1.1 TOP 10 NEJVĚTŠÍCH TABULEK (řádky + velikost)
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) as total_size,
    pg_size_pretty(pg_relation_size(schemaname || '.' || tablename)) as table_size,
    pg_size_pretty(pg_indexes_size(schemaname || '.' || tablename)) as indexes_size,
    n_live_tup as row_count,
    n_dead_tup as dead_rows,
    ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) as dead_row_pct
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC
LIMIT 20;

-- 1.2 SEKVENČNÍ SCANY (FULL TABLE SCANS) - HLAVNÍ ZDROJ DISK IO!
SELECT 
    schemaname,
    relname as table_name,
    seq_scan,
    seq_tup_read,
    idx_scan,
    idx_tup_fetch,
    CASE 
        WHEN seq_scan + idx_scan > 0 
        THEN ROUND(100.0 * seq_scan / (seq_scan + idx_scan), 2)
        ELSE 0 
    END as seq_scan_pct,
    CASE 
        WHEN seq_scan > 0 AND idx_scan < seq_scan * 0.1 
        THEN '❌ PROBLÉM - potřebuje index'
        WHEN seq_scan > 0 AND seq_tup_read / seq_scan > 1000
        THEN '⚠️ VAROVÁNÍ - velké sekvenční čtení'
        ELSE '✅ OK'
    END as status
FROM pg_stat_user_tables
WHERE seq_scan > 10
ORDER BY seq_tup_read DESC
LIMIT 20;

-- 1.3 CHYBĚJÍCÍ INDEXY - dotazy které by profitovaly z indexu
-- (Vyžaduje pg_stat_statements extension - na Supabase je většinou zapnutá)
SELECT 
    query,
    calls,
    total_exec_time::numeric(12,2) as total_ms,
    mean_exec_time::numeric(12,2) as avg_ms,
    rows
FROM pg_stat_statements
WHERE query ILIKE '%WHERE%'
  AND query NOT ILIKE '%pg_%'
  AND mean_exec_time > 100  -- dotazy pomalejší než 100ms
ORDER BY total_exec_time DESC
LIMIT 20;

-- 1.4 NEPOUŽITÉ INDEXY (zbytečně zabírají místo a zpomalují zápisy)
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(schemaname || '.' || indexname)) as index_size,
    idx_scan as times_used
FROM pg_stat_user_indexes
WHERE idx_scan < 10
  AND indexname NOT LIKE 'pg_%'
ORDER BY pg_relation_size(schemaname || '.' || indexname) DESC;

-- 1.5 TABULKY S VELKÝM BLOATEM (dead rows potřebují VACUUM)
SELECT 
    relname as table_name,
    n_dead_tup as dead_rows,
    n_live_tup as live_rows,
    ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) as bloat_pct,
    last_vacuum,
    last_autovacuum,
    CASE 
        WHEN n_dead_tup > 10000 THEN '❌ POTŘEBUJE VACUUM'
        WHEN n_dead_tup > 1000 THEN '⚠️ ZKONTROLOVAT'
        ELSE '✅ OK'
    END as status
FROM pg_stat_user_tables
WHERE n_dead_tup > 100
ORDER BY n_dead_tup DESC;

-- 1.6 BUFFER CACHE HIT RATIO (pod 95% = problém)
SELECT 
    'Buffer Cache Hit Ratio' as metric,
    ROUND(100.0 * sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0), 2) as hit_ratio_pct,
    CASE 
        WHEN sum(heap_blks_hit)::float / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0) > 0.99 THEN '✅ EXCELLENT'
        WHEN sum(heap_blks_hit)::float / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0) > 0.95 THEN '✅ GOOD'
        WHEN sum(heap_blks_hit)::float / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0) > 0.90 THEN '⚠️ NEEDS ATTENTION'
        ELSE '❌ CRITICAL - vysoké Disk IO'
    END as status
FROM pg_statio_user_tables;


-- =====================================================
-- 2) KONKRÉTNÍ INDEXY PRO VIVIDBOOKS
-- =====================================================

-- 2.1 USER_EVENTS - nejčastější zápisy, potřebuje lepší indexy
-- Composite index pro filtrování podle user + času (nejčastější dotaz)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_events_user_time 
ON user_events(user_id, created_at DESC);

-- Partial index pro nedávné události (posledních 7 dní)
-- Dramaticky zmenší velikost indexu
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_events_recent 
ON user_events(user_id, event_type, created_at DESC)
WHERE created_at > NOW() - INTERVAL '7 days';

-- 2.2 TEACHER_BOARDS - velké JSON objekty
-- Index pro rychlé vyhledávání boardů učitele
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_teacher_boards_teacher_updated 
ON teacher_boards(teacher_id, updated_at DESC);

-- Partial index pro veřejné boardy
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_teacher_boards_public_active
ON teacher_boards(is_public, updated_at DESC)
WHERE is_public = true AND is_deleted = false;

-- 2.3 TEACHER_DOCUMENTS - časté dotazy
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_teacher_documents_teacher_folder_updated
ON teacher_documents(teacher_id, folder_id, updated_at DESC);

-- 2.4 TOPIC_DATA_SETS - velké JSONB
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_topic_datasets_lookup
ON topic_data_sets(subject_code, grade, weekly_plan_id);

-- GIN index pro vyhledávání v JSONB (jen pokud potřebuješ)
-- POZOR: GIN indexy jsou velké a zpomalují INSERT
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_topic_datasets_content_gin
-- ON topic_data_sets USING GIN(content jsonb_path_ops);

-- 2.5 RESULTS - časté agregace
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_results_assignment_completed
ON results(assignment_id, completed_at DESC)
WHERE completed_at IS NOT NULL;

-- 2.6 STUDENTS - vyhledávání podle třídy
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_students_class_name
ON students(class_id, name);


-- =====================================================
-- 3) SNÍŽENÍ ZÁPISŮ - USER_EVENTS PARTITIONING
-- =====================================================

-- 3.1 Vytvořit partitioned tabulku pro user_events
-- Starší data se automaticky přesunou do "cold storage"

-- Krok 1: Vytvoř novou partitioned tabulku
CREATE TABLE IF NOT EXISTS user_events_partitioned (
    id UUID DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    school_id UUID,
    event_type TEXT NOT NULL,
    event_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Krok 2: Vytvoř partice pro každý měsíc
CREATE TABLE IF NOT EXISTS user_events_2026_01 
    PARTITION OF user_events_partitioned
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE IF NOT EXISTS user_events_2026_02 
    PARTITION OF user_events_partitioned
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

CREATE TABLE IF NOT EXISTS user_events_2026_03 
    PARTITION OF user_events_partitioned
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

-- Vytvoř default partici pro budoucí data
CREATE TABLE IF NOT EXISTS user_events_default 
    PARTITION OF user_events_partitioned
    DEFAULT;

-- Krok 3: Indexy pro partice
CREATE INDEX IF NOT EXISTS idx_user_events_part_user_time 
ON user_events_partitioned(user_id, created_at DESC);


-- =====================================================
-- 4) RETENTION POLICY - AUTOMATICKÉ MAZÁNÍ STARÝCH DAT
-- =====================================================

-- 4.1 Smazat eventy starší než 90 dní (batch mazání)
-- SPOUŠTĚJ TO JAKO CRON JOB, NE JAKO JEDEN VELKÝ DELETE!

-- Funkce pro batch mazání
CREATE OR REPLACE FUNCTION delete_old_events_batch(
    batch_size INTEGER DEFAULT 1000,
    retention_days INTEGER DEFAULT 90
)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    WITH deleted AS (
        DELETE FROM user_events
        WHERE id IN (
            SELECT id FROM user_events
            WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL
            LIMIT batch_size
        )
        RETURNING id
    )
    SELECT COUNT(*) INTO deleted_count FROM deleted;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Volání: SELECT delete_old_events_batch(1000, 90);
-- Opakuj dokud nevrátí 0


-- =====================================================
-- 5) MATERIALIZED VIEWS PRO STATISTIKY
-- =====================================================

-- 5.1 Denní statistiky uživatelů (místo opakovaných agregací)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_user_stats AS
SELECT 
    DATE(created_at) as date,
    user_id,
    school_id,
    COUNT(*) as event_count,
    COUNT(DISTINCT event_type) as unique_event_types,
    jsonb_object_agg(
        event_type, 
        event_count
    ) FILTER (WHERE rn = 1) as events_by_type
FROM (
    SELECT 
        *,
        ROW_NUMBER() OVER (PARTITION BY user_id, DATE(created_at), event_type ORDER BY created_at) as rn,
        COUNT(*) OVER (PARTITION BY user_id, DATE(created_at), event_type) as event_count
    FROM user_events
    WHERE created_at > NOW() - INTERVAL '30 days'
) sub
GROUP BY DATE(created_at), user_id, school_id
WITH DATA;

-- Index pro MV
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_daily_user_stats_pk 
ON mv_daily_user_stats(date, user_id);

-- Refresh (spouštěj každou hodinu z cron jobu)
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_user_stats;


-- 5.2 Aktivní učitelé za posledních 7 dní
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_active_teachers_7d AS
SELECT 
    school_id,
    COUNT(DISTINCT user_id) as active_teachers,
    COUNT(*) as total_events,
    MAX(created_at) as last_activity
FROM user_events
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY school_id
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_active_teachers_school 
ON mv_active_teachers_7d(school_id);


-- =====================================================
-- 6) VACUUM A ANALYZE
-- =====================================================

-- 6.1 Ruční VACUUM pro problémové tabulky
-- VACUUM VERBOSE ANALYZE user_events;
-- VACUUM VERBOSE ANALYZE teacher_boards;
-- VACUUM VERBOSE ANALYZE topic_data_sets;

-- 6.2 Agresivnější autovacuum pro časté zápisy
ALTER TABLE user_events SET (
    autovacuum_vacuum_scale_factor = 0.05,  -- vacuum po 5% změn (default 20%)
    autovacuum_analyze_scale_factor = 0.02, -- analyze po 2% změn
    autovacuum_vacuum_cost_delay = 10       -- méně agresivní (šetří IO)
);

ALTER TABLE teacher_boards SET (
    autovacuum_vacuum_scale_factor = 0.1,
    autovacuum_analyze_scale_factor = 0.05
);


-- =====================================================
-- 7) OPTIMALIZACE DOTAZŮ - PŘÍKLADY
-- =====================================================

-- 7.1 ŠPATNĚ: SELECT * bez limitu
-- SELECT * FROM teacher_boards WHERE teacher_id = 'xxx';

-- SPRÁVNĚ: Jen potřebné sloupce + limit + offset
SELECT id, name, updated_at 
FROM teacher_boards 
WHERE teacher_id = 'xxx'
ORDER BY updated_at DESC
LIMIT 20 OFFSET 0;

-- 7.2 ŠPATNĚ: N+1 dotazy v aplikaci
-- for each class: SELECT * FROM students WHERE class_id = class.id

-- SPRÁVNĚ: Jeden JOIN dotaz
SELECT 
    c.id as class_id,
    c.name as class_name,
    s.id as student_id,
    s.name as student_name
FROM classes c
LEFT JOIN students s ON s.class_id = c.id
WHERE c.teacher_id = 'xxx'
ORDER BY c.name, s.name;

-- 7.3 ŠPATNĚ: Agregace bez indexu
-- SELECT COUNT(*) FROM user_events WHERE user_id = 'xxx' AND created_at > '2026-01-01';

-- SPRÁVNĚ: S indexem + materialized view pro statistiky
SELECT event_count 
FROM mv_daily_user_stats 
WHERE user_id = 'xxx' AND date >= '2026-01-01';


-- =====================================================
-- 8) MONITORING QUERIES
-- =====================================================

-- 8.1 Aktuálně běžící pomalé dotazy
SELECT 
    pid,
    NOW() - pg_stat_activity.query_start AS duration,
    query,
    state
FROM pg_stat_activity
WHERE (NOW() - pg_stat_activity.query_start) > INTERVAL '5 seconds'
  AND state != 'idle'
ORDER BY duration DESC;

-- 8.2 Počet aktivních spojení
SELECT 
    COUNT(*) as total_connections,
    COUNT(*) FILTER (WHERE state = 'active') as active,
    COUNT(*) FILTER (WHERE state = 'idle') as idle,
    COUNT(*) FILTER (WHERE state = 'idle in transaction') as idle_in_tx
FROM pg_stat_activity
WHERE datname = current_database();

-- 8.3 Disk IO per tabulka za poslední hodinu (přibližně)
SELECT 
    relname as table_name,
    heap_blks_read as disk_reads,
    heap_blks_hit as cache_hits,
    ROUND(100.0 * heap_blks_hit / NULLIF(heap_blks_hit + heap_blks_read, 0), 2) as cache_hit_pct
FROM pg_statio_user_tables
ORDER BY heap_blks_read DESC
LIMIT 10;


-- =====================================================
-- 9) SHRNUTÍ - CO UDĚLAT HNED
-- =====================================================

/*
PRIORITA 1 (hned):
1. Spusť diagnostické dotazy (sekce 1)
2. Vytvoř chybějící indexy (sekce 2)
3. Nastav retention policy pro user_events (sekce 4)

PRIORITA 2 (tento týden):
4. Vytvoř materialized views pro statistiky (sekce 5)
5. Nastav autovacuum parametry (sekce 6)
6. Zkontroluj N+1 dotazy v aplikaci

PRIORITA 3 (plánovaně):
7. Partitioning pro user_events (sekce 3)
8. Oddělení read/write (read replicas)

ROZHODNUTÍ O UPGRADE:
- Buffer cache hit < 90% = upgrade compute
- IOPS > 80% limitu = upgrade compute nebo storage
- Průměrná latence > 100ms = optimalizace nebo upgrade
*/
