-- A platform's own category / region values, so the fetch form offers exactly
-- what the platform accepts (a value off by one character returns 0 rows and
-- no error). Filled from the platform's filter-options endpoints, or pasted
-- by ops; a replace swaps the whole list for one (source, kind).
--   kind  = 'category' | 'region'
--   value = the string sent to the platform
--   grp   = parent level (first-level category, province), shown as a group
CREATE TABLE IF NOT EXISTS source_dictionaries (
  source_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('category', 'region')),
  value text NOT NULL,
  grp text,
  position integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_id, kind, value)
);
