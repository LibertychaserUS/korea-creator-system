-- 小红书号 is one identity whatever the case or padding: "Cheongdam_Skin " and
-- "cheongdam_skin" are the same account. From here on every write stores the
-- trimmed, NFKC-folded, lower-case form (trigger below), and one account maps
-- to one creator (unique index below).
--
-- Creators that already collide are merged into one: the released one (else
-- the one with a publish snapshot, else the oldest) keeps its row; every row
-- in any table that points at the others moves over. Nothing is thrown away:
-- the merged creator row, and any row that could not move because the target
-- already had an equal one (a category both carried, a project both were on),
-- are kept verbatim in `creator_merges`.

CREATE OR REPLACE FUNCTION kcs_normalize_xhs_id(value text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT nullif(lower(regexp_replace(normalize(value, NFKC), '^\s+|\s+$', '', 'g')), '')
$$;

CREATE TABLE IF NOT EXISTS creator_merges (
  id bigserial PRIMARY KEY,
  merged_id text NOT NULL,
  into_id text NOT NULL,
  reason text NOT NULL,
  merged_row jsonb NOT NULL,
  conflicts jsonb NOT NULL DEFAULT '[]'::jsonb,
  merged_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS creator_merges_into_idx ON creator_merges (into_id);
CREATE INDEX IF NOT EXISTS creator_merges_merged_idx ON creator_merges (merged_id);

DO $$
DECLARE
  grp record;
  dup text;
  fk record;
  moving record;
  leftovers jsonb;
  row_json jsonb;
BEGIN
  FOR grp IN
    SELECT kcs_normalize_xhs_id(xhs_id) AS xhs,
           array_agg(id ORDER BY (status = 'released') DESC, (metrics_locked_at IS NOT NULL) DESC, created_at, id) AS ids
      FROM creators
     WHERE kcs_normalize_xhs_id(xhs_id) IS NOT NULL
     GROUP BY 1
    HAVING count(*) > 1
  LOOP
    FOREACH dup IN ARRAY grp.ids[2:] LOOP
      leftovers := '[]'::jsonb;
      -- The pool row is derived: never move it onto the survivor. Deleting it
      -- marks the group dirty; startup `refreshPublished` rebuilds and re-ranks.
      IF to_regclass('creator_published') IS NOT NULL THEN
        DELETE FROM creator_published WHERE creator_id = dup;
      END IF;
      FOR fk IN
        SELECT cl.relname AS tbl, att.attname AS col
          FROM pg_constraint con
          JOIN pg_class cl ON cl.oid = con.conrelid
          JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
         WHERE con.contype = 'f' AND con.confrelid = 'creators'::regclass AND cardinality(con.conkey) = 1
      LOOP
        FOR moving IN EXECUTE format('SELECT ctid AS tid, to_jsonb(t) AS body FROM %I t WHERE %I = $1', fk.tbl, fk.col) USING dup
        LOOP
          BEGIN
            EXECUTE format('UPDATE %I SET %I = $1 WHERE ctid = $2', fk.tbl, fk.col) USING grp.ids[1], moving.tid;
          EXCEPTION WHEN unique_violation THEN
            leftovers := leftovers || jsonb_build_array(jsonb_build_object('table', fk.tbl, 'row', moving.body));
            EXECUTE format('DELETE FROM %I WHERE ctid = $1', fk.tbl) USING moving.tid;
          END;
        END LOOP;
      END LOOP;

      SELECT to_jsonb(c) INTO row_json FROM creators c WHERE c.id = dup;
      INSERT INTO creator_merges (merged_id, into_id, reason, merged_row, conflicts)
      VALUES (dup, grp.ids[1], 'xhs_id:' || grp.xhs, row_json, leftovers);
      DELETE FROM creators WHERE id = dup;
    END LOOP;
  END LOOP;
END
$$;

UPDATE creators SET xhs_id = kcs_normalize_xhs_id(xhs_id)
 WHERE xhs_id IS DISTINCT FROM kcs_normalize_xhs_id(xhs_id);

CREATE OR REPLACE FUNCTION kcs_creators_normalize_xhs() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.xhs_id := kcs_normalize_xhs_id(NEW.xhs_id);
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS creators_normalize_xhs ON creators;
CREATE TRIGGER creators_normalize_xhs
  BEFORE INSERT OR UPDATE OF xhs_id ON creators
  FOR EACH ROW EXECUTE FUNCTION kcs_creators_normalize_xhs();

CREATE UNIQUE INDEX IF NOT EXISTS creators_xhs_id_key ON creators (xhs_id) WHERE xhs_id IS NOT NULL;
