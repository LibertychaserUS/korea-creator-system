-- Old metric keys gone from storage, so reads no longer carry a rename fallback:
-- `cpv` → `cpr`, `retentionRate` → `completionRate`.
-- 1. Metric records: 0021 renamed them once, but adapters kept writing the old
--    keys until they were aligned with the contract, so run the rename again.
-- 2. Saved queries and their revisions: column names and the keys of filters,
--    group filters, highlights and the sort. Free text (the search) is not touched.
-- Running it again changes nothing.
CREATE OR REPLACE FUNCTION pg_temp.kcs_rename_key(m jsonb, old_key text, new_key text) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN m IS NULL OR jsonb_typeof(m) <> 'object' OR NOT (m ? old_key) THEN m
    WHEN jsonb_typeof(m -> new_key) IS NULL OR jsonb_typeof(m -> new_key) = 'null'
      THEN (m - old_key) || jsonb_build_object(new_key, m -> old_key)
    ELSE m - old_key
  END
$$;

CREATE OR REPLACE FUNCTION pg_temp.kcs_metric_keys(m jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
  SELECT pg_temp.kcs_rename_key(pg_temp.kcs_rename_key(m, 'cpv', 'cpr'), 'retentionRate', 'completionRate')
$$;

UPDATE creators SET metrics = pg_temp.kcs_metric_keys(metrics)
 WHERE metrics ?| ARRAY['cpv', 'retentionRate'];

UPDATE creators SET metrics_locked = pg_temp.kcs_metric_keys(metrics_locked)
 WHERE metrics_locked ?| ARRAY['cpv', 'retentionRate'];

UPDATE creator_metrics_history SET metrics = pg_temp.kcs_metric_keys(metrics)
 WHERE metrics ?| ARRAY['cpv', 'retentionRate'];

CREATE OR REPLACE FUNCTION pg_temp.kcs_key(k jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE k #>> '{}' WHEN 'cpv' THEN '"cpr"'::jsonb WHEN 'retentionRate' THEN '"completionRate"'::jsonb ELSE k END
$$;

-- `[{ key, … }]` → each `key` renamed; anything else is left as it is.
CREATE OR REPLACE FUNCTION pg_temp.kcs_keyed(list jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN jsonb_typeof(list) = 'array' THEN COALESCE((
    SELECT jsonb_agg(CASE WHEN jsonb_typeof(e) = 'object' AND e ? 'key'
                          THEN jsonb_set(e, '{key}', pg_temp.kcs_key(e -> 'key')) ELSE e END ORDER BY i)
      FROM jsonb_array_elements(list) WITH ORDINALITY t(e, i)), '[]'::jsonb)
  ELSE list END
$$;

CREATE OR REPLACE FUNCTION pg_temp.kcs_spec_keys(spec jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF jsonb_typeof(spec) <> 'object' THEN
    RETURN spec;
  END IF;
  IF jsonb_typeof(spec -> 'columns') = 'array' THEN
    spec := jsonb_set(spec, '{columns}', COALESCE((
      SELECT jsonb_agg(pg_temp.kcs_key(e) ORDER BY i)
        FROM jsonb_array_elements(spec -> 'columns') WITH ORDINALITY t(e, i)), '[]'::jsonb));
  END IF;
  IF spec ? 'filters' THEN spec := jsonb_set(spec, '{filters}', pg_temp.kcs_keyed(spec -> 'filters')); END IF;
  IF spec ? 'highlights' THEN spec := jsonb_set(spec, '{highlights}', pg_temp.kcs_keyed(spec -> 'highlights')); END IF;
  IF jsonb_typeof(spec -> 'sort') = 'object' AND spec -> 'sort' ? 'key' THEN
    spec := jsonb_set(spec, '{sort,key}', pg_temp.kcs_key(spec #> '{sort,key}'));
  END IF;
  IF jsonb_typeof(spec -> 'groups') = 'array' THEN
    spec := jsonb_set(spec, '{groups}', COALESCE((
      SELECT jsonb_agg(CASE WHEN jsonb_typeof(g) = 'object' AND g ? 'filters'
                            THEN jsonb_set(g, '{filters}', pg_temp.kcs_keyed(g -> 'filters')) ELSE g END ORDER BY i)
        FROM jsonb_array_elements(spec -> 'groups') WITH ORDINALITY t(g, i)), '[]'::jsonb));
  END IF;
  RETURN spec;
END
$$;

UPDATE saved_queries SET spec = pg_temp.kcs_spec_keys(spec)
 WHERE spec::text ~ '"(cpv|retentionRate)"' AND pg_temp.kcs_spec_keys(spec) IS DISTINCT FROM spec;

UPDATE saved_query_revisions SET spec = pg_temp.kcs_spec_keys(spec)
 WHERE spec::text ~ '"(cpv|retentionRate)"' AND pg_temp.kcs_spec_keys(spec) IS DISTINCT FROM spec;
