-- The select pool as a narrow table: one row per published, rankable creator,
-- metrics as typed columns and percentiles precomputed at publish / take-down
-- (apps/api/src/http/published.ts, contract cohort.ts). The pool reads only
-- this table. It is a projection of `creators` + meta tables: every row can be
-- rebuilt from them (`refreshPublished`), so dropping a row loses nothing.
--
-- Meta that ops edit after publish (name, regions, categories, collaborations,
-- quotes) is kept in step by triggers; a blacklist change or a removed row also
-- marks the group for a percentile recompute (`cohort_dirty_groups`).
-- When the numbers in the publish snapshot were fetched (not when they were
-- published): the snapshot goes stale 60 days after this. Older snapshots get
-- the best estimate — the fetch time if it was before publishing, else the
-- publish time.
ALTER TABLE creators ADD COLUMN IF NOT EXISTS metrics_locked_fetched_at timestamptz;
UPDATE creators
   SET metrics_locked_fetched_at = LEAST(COALESCE(metrics_fetched_at, metrics_locked_at), metrics_locked_at)
 WHERE metrics_locked_fetched_at IS NULL AND metrics_locked_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS creator_published (
  creator_id text PRIMARY KEY REFERENCES creators(id) ON DELETE CASCADE,
  group_key text NOT NULL,
  source text,
  "window" integer NOT NULL,
  content_form text,
  tier text NOT NULL,
  health text,
  low_active boolean,
  display_name text NOT NULL,
  creator_key text NOT NULL,
  xhs_id text,
  avatar_key text,
  external_id text,
  followers_unknown boolean NOT NULL DEFAULT false,
  regions text[] NOT NULL DEFAULT '{}',
  verticals text[] NOT NULL DEFAULT '{}',
  categories text[] NOT NULL DEFAULT '{}',
  blacklisted boolean NOT NULL DEFAULT false,
  collab_count integer NOT NULL DEFAULT 0,
  collab_brands text[] NOT NULL DEFAULT '{}',
  coop_brands text[] NOT NULL DEFAULT '{}',
  price_currency text,
  price_min_minor bigint,
  price_max_minor bigint,
  price_fx numeric(20, 10),
  price_unit text,
  metrics jsonb NOT NULL,
  ranks jsonb NOT NULL DEFAULT '{}'::jsonb,
  fetched_at timestamptz,
  latest_fetched_at timestamptz,
  published_at timestamptz NOT NULL,
  ranked_at timestamptz
) WITH (fillfactor = 85);

ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS m_followers float8;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS m_follower_growth float8;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS m_follower_growth_rate float8;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS m_read_fan_ratio float8;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS m_active_fan_ratio float8;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS m_engaged_fan_ratio float8;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS m_fan_interaction_ratio float8;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS m_impression_median float8;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS m_read_median float8;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS m_interaction_median float8;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS m_like_median float8;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS m_collect_median float8;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS m_comment_median float8;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS m_coop_read_median float8;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS m_coop_interaction_median float8;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS m_engagement_rate float8;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS m_completion_rate float8;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS m_read3s_rate float8;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS m_note_count float8;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS m_viral_count float8;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS m_viral_rate float8;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS m_price_image float8;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS m_price_video float8;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS m_cpr float8;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS m_cpe float8;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS m_cpe_video float8;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS m_cpm float8;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS m_cpm_read float8;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS m_collect_like_ratio float8;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS m_purchase_intent_comment_ratio float8;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS m_traffic_search_ratio float8;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS m_traffic_recommend_ratio float8;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS m_traffic_follow_ratio float8;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS m_read_to_follower_ratio float8;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS m_store_visit_uv_median float8;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS m_store_visit_unit_price float8;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS m_authenticity float8;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS m_coop_note_count float8;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS p_follower_growth smallint;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS p_follower_growth_rate smallint;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS p_active_fan_ratio smallint;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS p_engaged_fan_ratio smallint;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS p_impression_median smallint;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS p_read_median smallint;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS p_interaction_median smallint;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS p_like_median smallint;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS p_collect_median smallint;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS p_comment_median smallint;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS p_coop_read_median smallint;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS p_coop_interaction_median smallint;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS p_engagement_rate smallint;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS p_completion_rate smallint;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS p_read3s_rate smallint;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS p_viral_count smallint;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS p_viral_rate smallint;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS p_cpr smallint;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS p_cpe smallint;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS p_cpe_video smallint;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS p_cpm smallint;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS p_cpm_read smallint;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS p_collect_like_ratio smallint;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS p_read_to_follower_ratio smallint;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS p_store_visit_uv_median smallint;
ALTER TABLE creator_published ADD COLUMN IF NOT EXISTS p_authenticity smallint;

CREATE INDEX IF NOT EXISTS creator_published_group_idx ON creator_published (group_key);
CREATE INDEX IF NOT EXISTS creator_published_source_tier_idx ON creator_published (source, tier) WHERE NOT blacklisted;
CREATE INDEX IF NOT EXISTS creator_published_followers_desc_idx ON creator_published (m_followers DESC NULLS LAST, creator_id COLLATE "C") WHERE NOT blacklisted;
CREATE INDEX IF NOT EXISTS creator_published_followers_asc_idx ON creator_published (m_followers ASC NULLS LAST, creator_id COLLATE "C") WHERE NOT blacklisted;
CREATE INDEX IF NOT EXISTS creator_published_cpe_desc_idx ON creator_published (m_cpe DESC NULLS LAST, creator_id COLLATE "C") WHERE NOT blacklisted;
CREATE INDEX IF NOT EXISTS creator_published_cpe_asc_idx ON creator_published (m_cpe ASC NULLS LAST, creator_id COLLATE "C") WHERE NOT blacklisted;
CREATE INDEX IF NOT EXISTS creator_published_read_median_desc_idx ON creator_published (m_read_median DESC NULLS LAST, creator_id COLLATE "C") WHERE NOT blacklisted;
CREATE INDEX IF NOT EXISTS creator_published_read_median_asc_idx ON creator_published (m_read_median ASC NULLS LAST, creator_id COLLATE "C") WHERE NOT blacklisted;
CREATE INDEX IF NOT EXISTS creator_published_interaction_median_desc_idx ON creator_published (m_interaction_median DESC NULLS LAST, creator_id COLLATE "C") WHERE NOT blacklisted;
CREATE INDEX IF NOT EXISTS creator_published_interaction_median_asc_idx ON creator_published (m_interaction_median ASC NULLS LAST, creator_id COLLATE "C") WHERE NOT blacklisted;
CREATE INDEX IF NOT EXISTS creator_published_engagement_rate_desc_idx ON creator_published (m_engagement_rate DESC NULLS LAST, creator_id COLLATE "C") WHERE NOT blacklisted;
CREATE INDEX IF NOT EXISTS creator_published_engagement_rate_asc_idx ON creator_published (m_engagement_rate ASC NULLS LAST, creator_id COLLATE "C") WHERE NOT blacklisted;
CREATE INDEX IF NOT EXISTS creator_published_cpr_desc_idx ON creator_published (m_cpr DESC NULLS LAST, creator_id COLLATE "C") WHERE NOT blacklisted;
CREATE INDEX IF NOT EXISTS creator_published_cpr_asc_idx ON creator_published (m_cpr ASC NULLS LAST, creator_id COLLATE "C") WHERE NOT blacklisted;
CREATE INDEX IF NOT EXISTS creator_published_price_image_desc_idx ON creator_published (m_price_image DESC NULLS LAST, creator_id COLLATE "C") WHERE NOT blacklisted;
CREATE INDEX IF NOT EXISTS creator_published_price_image_asc_idx ON creator_published (m_price_image ASC NULLS LAST, creator_id COLLATE "C") WHERE NOT blacklisted;

CREATE TABLE IF NOT EXISTS cohort_dirty_groups (
  group_key text PRIMARY KEY,
  marked_at timestamptz NOT NULL DEFAULT now()
);

-- Per source: how many comparable creators a percentile aims for, and why (bootstrap).
CREATE TABLE IF NOT EXISTS cohort_calibration (
  source_key text PRIMARY KEY,
  target integer NOT NULL,
  required integer,
  method text NOT NULL,
  pool_size integer NOT NULL,
  basis jsonb NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now()
);

-- 25 / 50 / 75 分位 per group × tier × metric (only with ≥ 30 current values).
CREATE TABLE IF NOT EXISTS cohort_reference_lines (
  group_key text NOT NULL,
  tier text NOT NULL,
  metric text NOT NULL,
  n integer NOT NULL,
  p25 float8 NOT NULL,
  p50 float8 NOT NULL,
  p75 float8 NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_key, tier, metric)
);

CREATE OR REPLACE FUNCTION kcs_published_sync_meta(cid text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  was_blacklisted boolean;
  now_blacklisted boolean;
  grp text;
BEGIN
  SELECT blacklisted, group_key INTO was_blacklisted, grp FROM creator_published WHERE creator_id = cid;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  UPDATE creator_published p SET
    display_name = c.display_name,
    creator_key = c.creator_key,
    xhs_id = c.xhs_id,
    avatar_key = c.avatar_key,
    external_id = c.external_id,
    followers_unknown = COALESCE(c.followers_unknown, false),
    regions = COALESCE(c.regions, '{}'),
    verticals = COALESCE(c.verticals, '{}'),
    latest_fetched_at = c.metrics_fetched_at,
    categories = COALESCE((SELECT array_agg(cc.category_slug ORDER BY cc.category_slug)
                             FROM creator_categories cc WHERE cc.creator_id = cid), '{}'),
    blacklisted = EXISTS (SELECT 1 FROM creator_categories cc
                           WHERE cc.creator_id = cid AND cc.category_slug = 'blacklist'),
    collab_count = (SELECT count(*)::int FROM collaborations col WHERE col.creator_id = cid),
    collab_brands = COALESCE((SELECT array_agg(col.brand ORDER BY col.id)
                                FROM collaborations col WHERE col.creator_id = cid), '{}'),
    price_currency = pr.currency,
    price_min_minor = pr.amount_min_minor,
    price_max_minor = pr.amount_max_minor,
    price_fx = pr.fx_to_cny,
    price_unit = pr.unit
  FROM creators c
  LEFT JOIN LATERAL (
    SELECT currency, amount_min_minor, amount_max_minor, fx_to_cny, unit
      FROM prices WHERE creator_id = cid ORDER BY id LIMIT 1
  ) pr ON true
  WHERE p.creator_id = cid AND c.id = cid
  RETURNING p.blacklisted INTO now_blacklisted;
  IF now_blacklisted IS DISTINCT FROM was_blacklisted THEN
    INSERT INTO cohort_dirty_groups (group_key) VALUES (grp) ON CONFLICT (group_key) DO NOTHING;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION kcs_published_meta_trigger() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'creators' THEN
    PERFORM kcs_published_sync_meta(NEW.id);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM kcs_published_sync_meta(OLD.creator_id);
  ELSE
    PERFORM kcs_published_sync_meta(NEW.creator_id);
    IF TG_OP = 'UPDATE' AND OLD.creator_id IS DISTINCT FROM NEW.creator_id THEN
      PERFORM kcs_published_sync_meta(OLD.creator_id);
    END IF;
  END IF;
  RETURN NULL;
END
$$;

CREATE OR REPLACE FUNCTION kcs_published_removed_trigger() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO cohort_dirty_groups (group_key) VALUES (OLD.group_key) ON CONFLICT (group_key) DO NOTHING;
  RETURN NULL;
END
$$;

DROP TRIGGER IF EXISTS creators_published_meta ON creators;
CREATE TRIGGER creators_published_meta
  AFTER UPDATE OF display_name, creator_key, xhs_id, avatar_key, external_id, followers_unknown, regions, verticals, metrics_fetched_at
  ON creators FOR EACH ROW EXECUTE FUNCTION kcs_published_meta_trigger();

DROP TRIGGER IF EXISTS creator_categories_published_meta ON creator_categories;
CREATE TRIGGER creator_categories_published_meta
  AFTER INSERT OR UPDATE OR DELETE ON creator_categories
  FOR EACH ROW EXECUTE FUNCTION kcs_published_meta_trigger();

DROP TRIGGER IF EXISTS collaborations_published_meta ON collaborations;
CREATE TRIGGER collaborations_published_meta
  AFTER INSERT OR UPDATE OR DELETE ON collaborations
  FOR EACH ROW EXECUTE FUNCTION kcs_published_meta_trigger();

DROP TRIGGER IF EXISTS prices_published_meta ON prices;
CREATE TRIGGER prices_published_meta
  AFTER INSERT OR UPDATE OR DELETE ON prices
  FOR EACH ROW EXECUTE FUNCTION kcs_published_meta_trigger();

DROP TRIGGER IF EXISTS creator_published_removed ON creator_published;
CREATE TRIGGER creator_published_removed
  AFTER DELETE ON creator_published
  FOR EACH ROW EXECUTE FUNCTION kcs_published_removed_trigger();
