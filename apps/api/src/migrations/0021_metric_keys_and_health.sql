-- Stored metric records in today's vocabulary (docs/03 口径, contract `normalizeMetrics`):
-- - `cpv` → `cpr` (每次阅读成本); `retentionRate` held 视频完播率 → `completionRate`;
-- - 「CPM」 outside 蒲公英 is per read → `cpmRead` (千次阅读成本); `cpm` keeps 千次曝光 only;
-- - health: two grades (healthy / abnormal) plus a separate `lowActive` flag. 蒲公英's old
--   value was really 低活跃, so it becomes `lowActive` and the grade is unknown.
-- Rows already in the new shape are left alone, so the migration can run twice.
CREATE OR REPLACE FUNCTION pg_temp.kcs_rename_key(m jsonb, old_key text, new_key text) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN NOT (m ? old_key) THEN m
    WHEN jsonb_typeof(m -> new_key) IS NULL OR jsonb_typeof(m -> new_key) = 'null'
      THEN (m - old_key) || jsonb_build_object(new_key, m -> old_key)
    ELSE m - old_key
  END
$$;

CREATE OR REPLACE FUNCTION pg_temp.kcs_normalize_metrics(m jsonb, src text) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  grade text;
BEGIN
  IF m IS NULL OR jsonb_typeof(m) <> 'object' THEN
    RETURN m;
  END IF;
  m := pg_temp.kcs_rename_key(m, 'cpv', 'cpr');
  m := pg_temp.kcs_rename_key(m, 'retentionRate', 'completionRate');
  IF src IS DISTINCT FROM 'pugongying' AND jsonb_typeof(m -> 'cpm') = 'number' THEN
    m := pg_temp.kcs_rename_key(m, 'cpm', 'cpmRead');
  END IF;
  grade := m ->> 'health';
  IF grade IN ('excellent', 'normal', 'abnormal') AND NOT (m ? 'lowActive') THEN
    IF src = 'pugongying' THEN
      m := m || jsonb_build_object('health', NULL, 'lowActive', grade = 'abnormal');
    ELSE
      m := m || jsonb_build_object('health', CASE WHEN grade = 'abnormal' THEN 'abnormal' ELSE 'healthy' END);
    END IF;
  ELSIF grade IN ('excellent', 'normal') THEN
    m := m || jsonb_build_object('health', 'healthy');
  END IF;
  RETURN m;
END
$$;

UPDATE creators SET metrics = pg_temp.kcs_normalize_metrics(metrics, source)
 WHERE metrics IS NOT NULL AND pg_temp.kcs_normalize_metrics(metrics, source) IS DISTINCT FROM metrics;

UPDATE creators SET metrics_locked = pg_temp.kcs_normalize_metrics(metrics_locked, source)
 WHERE metrics_locked IS NOT NULL
   AND pg_temp.kcs_normalize_metrics(metrics_locked, source) IS DISTINCT FROM metrics_locked;

UPDATE creator_metrics_history SET metrics = pg_temp.kcs_normalize_metrics(metrics, source)
 WHERE metrics IS NOT NULL AND pg_temp.kcs_normalize_metrics(metrics, source) IS DISTINCT FROM metrics;
