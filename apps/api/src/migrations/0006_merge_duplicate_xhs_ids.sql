DO $$
DECLARE
  duplicate_row record;
BEGIN
  FOR duplicate_row IN
    SELECT id, canonical_id
    FROM (
      SELECT
        id,
        first_value(id) OVER (
          PARTITION BY xhs_id
          ORDER BY created_at, id
        ) AS canonical_id,
        row_number() OVER (
          PARTITION BY xhs_id
          ORDER BY created_at, id
        ) AS position
      FROM creators
      WHERE xhs_id IS NOT NULL AND xhs_id <> ''
    ) ranked
    WHERE position > 1
  LOOP
    INSERT INTO creator_categories (creator_id, category_slug)
    SELECT duplicate_row.canonical_id, category_slug
    FROM creator_categories
    WHERE creator_id = duplicate_row.id
    ON CONFLICT DO NOTHING;
    DELETE FROM creator_categories WHERE creator_id = duplicate_row.id;

    INSERT INTO assignments
      (id, project_id, creator_id, status, assigned_at, assigned_by, pool_gone, note)
    SELECT
      id, project_id, duplicate_row.canonical_id, status, assigned_at, assigned_by, pool_gone, note
    FROM assignments
    WHERE creator_id = duplicate_row.id
    ON CONFLICT (project_id, creator_id) DO NOTHING;
    DELETE FROM assignments WHERE creator_id = duplicate_row.id;

    INSERT INTO shortlist_items (org_id, creator_id, added_at)
    SELECT org_id, duplicate_row.canonical_id, added_at
    FROM shortlist_items
    WHERE creator_id = duplicate_row.id
    ON CONFLICT DO NOTHING;
    DELETE FROM shortlist_items WHERE creator_id = duplicate_row.id;

    UPDATE creator_sources SET creator_id = duplicate_row.canonical_id
    WHERE creator_id = duplicate_row.id;
    UPDATE creator_raw SET creator_id = duplicate_row.canonical_id
    WHERE creator_id = duplicate_row.id;
    UPDATE creator_metrics_history SET creator_id = duplicate_row.canonical_id
    WHERE creator_id = duplicate_row.id;
    UPDATE collaborations SET creator_id = duplicate_row.canonical_id
    WHERE creator_id = duplicate_row.id;
    UPDATE prices SET creator_id = duplicate_row.canonical_id
    WHERE creator_id = duplicate_row.id;
    UPDATE reviews SET creator_id = duplicate_row.canonical_id
    WHERE creator_id = duplicate_row.id;

    DELETE FROM creators WHERE id = duplicate_row.id;
  END LOOP;
END
$$;
