-- Undo merges made by the old identity rules:
--   * a vendor record without a 小红书号 used its vendor id as xhs_id, and
--   * creator_key was `xhs:<vendor id>` for every source,
-- so 千瓜 10001 and 新红 10001 (two strangers) landed on one creator, and a
-- vendor refresh could overwrite a real 小红书号 with its own id.
--
-- A link's identity is the 小红书号 found in its newest raw payload (蒲公英
-- `redId`; vendors `小红书号` / `xhs_id` / `red_id` / `redId`). Links of one
-- creator that do not share an identity are split: the cluster holding the
-- earliest link keeps the creator (and everything ops did to it); every other
-- cluster becomes a new draft carrying its own links, raw payloads and
-- history, with name and numbers restored from its newest raw / snapshot.
-- Re-running finds nothing left to split.

CREATE TEMP TABLE kcs_link_identity ON COMMIT DROP AS
SELECT
  s.creator_id,
  s.source,
  s.external_id,
  s.first_seen_at,
  (
    SELECT NULLIF(lower(btrim(CASE WHEN r.source = 'pugongying'
      THEN r.payload->>'redId'
      ELSE COALESCE(r.payload->>'小红书号', r.payload->>'xhs_id', r.payload->>'red_id', r.payload->>'redId')
    END)), '')
    FROM creator_raw r
    WHERE r.creator_id = s.creator_id AND r.source = s.source AND r.external_id = s.external_id
    ORDER BY r.fetched_at DESC, r.id DESC
    LIMIT 1
  ) AS real_xhs
FROM creator_sources s;

ALTER TABLE kcs_link_identity ADD COLUMN cluster text;
UPDATE kcs_link_identity
   SET cluster = COALESCE('xhs:' || real_xhs, 'link:' || source || ':' || external_id);

DO $$
DECLARE
  owner record;
  other record;
  new_id text;
  newest_raw record;
  newest_snapshot record;
  new_key text;
BEGIN
  FOR owner IN
    SELECT DISTINCT ON (creator_id) creator_id, cluster
    FROM kcs_link_identity
    WHERE creator_id IN (
      SELECT creator_id FROM kcs_link_identity GROUP BY creator_id HAVING count(DISTINCT cluster) > 1
    )
    ORDER BY creator_id, first_seen_at, source, external_id
  LOOP
    FOR other IN
      SELECT DISTINCT cluster FROM kcs_link_identity
      WHERE creator_id = owner.creator_id AND cluster <> owner.cluster
    LOOP
      new_id := gen_random_uuid()::text;

      SELECT r.* INTO newest_raw FROM creator_raw r
      JOIN kcs_link_identity l
        ON l.creator_id = r.creator_id AND l.source = r.source AND l.external_id = r.external_id
      WHERE l.creator_id = owner.creator_id AND l.cluster = other.cluster
      ORDER BY r.fetched_at DESC, r.id DESC LIMIT 1;

      SELECT h.* INTO newest_snapshot FROM creator_metrics_history h
      WHERE h.creator_id = owner.creator_id
        AND h.source IN (SELECT source FROM kcs_link_identity
                          WHERE creator_id = owner.creator_id AND cluster = other.cluster)
      ORDER BY h.fetched_at DESC, h.id DESC LIMIT 1;

      SELECT l.source || ':' || l.external_id INTO new_key FROM kcs_link_identity l
      WHERE l.creator_id = owner.creator_id AND l.cluster = other.cluster
      ORDER BY l.first_seen_at, l.source, l.external_id LIMIT 1;
      IF EXISTS (SELECT 1 FROM creators WHERE creator_key = new_key) THEN
        new_key := new_key || ':' || left(new_id, 8);
      END IF;

      INSERT INTO creators (
        id, creator_key, display_name, status, needs_review, followers, followers_unknown,
        xhs_id, metrics, metrics_window, source, external_id, metrics_fetched_at
      )
      SELECT
        new_id,
        new_key,
        COALESCE(NULLIF(btrim(COALESCE(
          newest_raw.payload->>'name', newest_raw.payload->>'昵称', newest_raw.payload->>'达人昵称',
          newest_raw.payload->>'nickname')), ''), c.display_name),
        'draft',
        true,
        CASE WHEN jsonb_typeof(newest_snapshot.metrics->'followers') = 'number'
          THEN round((newest_snapshot.metrics->>'followers')::numeric)::integer END,
        jsonb_typeof(newest_snapshot.metrics->'followers') IS DISTINCT FROM 'number',
        CASE WHEN other.cluster LIKE 'xhs:%' THEN substr(other.cluster, 5) END,
        newest_snapshot.metrics,
        newest_snapshot."window",
        newest_raw.source,
        newest_raw.external_id,
        COALESCE(newest_snapshot.fetched_at, newest_raw.fetched_at)
      FROM creators c WHERE c.id = owner.creator_id;

      UPDATE creator_raw r SET creator_id = new_id
      FROM kcs_link_identity l
      WHERE l.creator_id = owner.creator_id AND l.cluster = other.cluster
        AND r.creator_id = owner.creator_id AND r.source = l.source AND r.external_id = l.external_id;

      UPDATE creator_metrics_history h SET creator_id = new_id
      WHERE h.creator_id = owner.creator_id
        AND h.source IN (SELECT source FROM kcs_link_identity
                          WHERE creator_id = owner.creator_id AND cluster = other.cluster)
        AND h.source NOT IN (SELECT source FROM kcs_link_identity
                              WHERE creator_id = owner.creator_id AND cluster = owner.cluster);

      UPDATE creator_sources s SET creator_id = new_id
      FROM kcs_link_identity l
      WHERE l.creator_id = owner.creator_id AND l.cluster = other.cluster
        AND s.source = l.source AND s.external_id = l.external_id;
    END LOOP;

    -- The owner's own name / numbers were last written by whichever source
    -- came in last; put back the ones its remaining links measured.
    SELECT r.* INTO newest_raw FROM creator_raw r
    WHERE r.creator_id = owner.creator_id
    ORDER BY r.fetched_at DESC, r.id DESC LIMIT 1;
    SELECT h.* INTO newest_snapshot FROM creator_metrics_history h
    WHERE h.creator_id = owner.creator_id
    ORDER BY h.fetched_at DESC, h.id DESC LIMIT 1;
    UPDATE creators c SET
      display_name = COALESCE(NULLIF(btrim(COALESCE(
        newest_raw.payload->>'name', newest_raw.payload->>'昵称', newest_raw.payload->>'达人昵称',
        newest_raw.payload->>'nickname')), ''), c.display_name),
      metrics = COALESCE(newest_snapshot.metrics, c.metrics),
      metrics_window = COALESCE(newest_snapshot."window", c.metrics_window),
      followers = CASE WHEN jsonb_typeof(newest_snapshot.metrics->'followers') = 'number'
        THEN round((newest_snapshot.metrics->>'followers')::numeric)::integer ELSE c.followers END,
      xhs_id = CASE WHEN owner.cluster LIKE 'xhs:%' THEN substr(owner.cluster, 5) ELSE NULL END,
      source = COALESCE(newest_raw.source, c.source),
      external_id = COALESCE(newest_raw.external_id, c.external_id),
      metrics_fetched_at = COALESCE(newest_snapshot.fetched_at, c.metrics_fetched_at),
      needs_review = true,
      updated_at = now()
    WHERE c.id = owner.creator_id;
  END LOOP;
END
$$;

-- A vendor id that was stored as the 小红书号 of an unsplit creator: drop it
-- (or put back the real one its raw payloads carry).
UPDATE creators c SET xhs_id = (
    SELECT substr(l.cluster, 5) FROM kcs_link_identity l
    WHERE l.creator_id = c.id AND l.real_xhs IS NOT NULL
    ORDER BY l.first_seen_at DESC LIMIT 1
  ), updated_at = now()
WHERE c.xhs_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM kcs_link_identity l
              WHERE l.creator_id = c.id AND l.source IN ('qiangua', 'xinhong') AND l.external_id = c.xhs_id)
  AND NOT EXISTS (SELECT 1 FROM kcs_link_identity l
                  WHERE l.creator_id = c.id AND l.real_xhs = lower(btrim(c.xhs_id)));

-- Keys follow the source they came from.
UPDATE creators c SET creator_key = c.source || ':' || c.external_id
WHERE c.source IS NOT NULL AND c.external_id IS NOT NULL
  AND c.creator_key = 'xhs:' || c.external_id
  AND NOT EXISTS (SELECT 1 FROM creators o WHERE o.creator_key = c.source || ':' || c.external_id);
