-- pg_restore rebuilds creators.name_grams with search_path = '', so the helpers
-- this function calls must be schema-qualified or the restore stops at
-- CREATE TABLE creators. Qualified names keep the SQL function inlinable
-- (a SET search_path clause would not). Same body as 0051 otherwise.

CREATE OR REPLACE FUNCTION kcs_name_grams(name text) RETURNS text[]
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT ARRAY(SELECT DISTINCT g FROM unnest(
      public.kcs_bigrams('c:', regexp_replace(n, '[a-z0-9\u1100-\u11ff\u3131-\u318e]', '', 'g'))
      || CASE WHEN (p).jamo ~ '[ㅏ-ㅣ]' THEN public.kcs_bigrams('j:', (p).jamo) ELSE '{}'::text[] END
      || public.kcs_bigrams('i:', (p).initials)
      || public.kcs_bigrams('r:', public.kcs_roman_fold((p).roman))) AS g
    ORDER BY g)
  FROM (SELECT public.kcs_name_norm(name) AS n, public.kcs_hangul_parts(public.kcs_name_norm(name)) AS p) parts
$$;
