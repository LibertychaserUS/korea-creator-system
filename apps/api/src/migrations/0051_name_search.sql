-- Fuzzy nickname search for Chinese, Korean and Latin names without pg_bigm
-- and independent of the database locale: every name becomes a set of short
-- "grams" (generated column, so every writer gets it), and a query matches by
-- how many of its grams a name contains.
--
--   c:  character bigrams of the normalised name (NFKC, lower case, no spaces
--       or punctuation), Latin letters and lone jamo left to r: / i: — the
--       pg_bigm idea, good for 2–3 character CJK names;
--   j:  bigrams of the Hangul jamo (청담 → ㅊㅓㅇㄷㅏㅁ), so a missing or wrong
--       final consonant, or a syllable still being typed, still matches;
--   i:  bigrams of the initial consonants (청담 → ㅊㄷ); a query of consonants
--       only (ㅊㄷ) is 초성 search and matches on these alone;
--   r:  bigrams of a loose romanisation (청담 → cheongdam → conktam), with the
--       same folding applied to Latin text, so "Jisoo" finds 지수.
-- Chinese pinyin is not covered (needs a dictionary); Chinese matches on c:.

CREATE OR REPLACE FUNCTION kcs_name_norm(name text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT regexp_replace(
    lower(normalize(coalesce(name, ''), NFKC)),
    '[[:space:][:punct:]　。，、！？：；（）【】《》〈〉「」『』“”‘’…—～·・♡♥★☆※|]+', '', 'g')
$$;

CREATE OR REPLACE FUNCTION kcs_hangul_parts(name text, OUT jamo text, OUT initials text, OUT roman text)
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE AS $$
DECLARE
  l_jamo text[] := ARRAY['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  v_jamo text[] := ARRAY['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
  t_jamo text[] := ARRAY['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  l_rom text[] := ARRAY['g','kk','n','d','tt','r','m','b','pp','s','ss','','j','jj','ch','k','t','p','h'];
  v_rom text[] := ARRAY['a','ae','ya','yae','eo','e','yeo','ye','o','wa','wae','oe','yo','u','wo','we','wi','yu','eu','ui','i'];
  t_rom text[] := ARRAY['','k','k','k','n','n','n','t','l','k','m','l','l','l','p','l','m','p','p','t','t','ng','t','t','k','t','p','t'];
  ch text;
  code int;
  s int;
BEGIN
  jamo := ''; initials := ''; roman := '';
  FOREACH ch IN ARRAY regexp_split_to_array(coalesce(name, ''), '') LOOP
    code := ascii(ch);
    IF code BETWEEN 44032 AND 55203 THEN            -- 가..힣
      s := code - 44032;
      jamo := jamo || l_jamo[s / 588 + 1] || v_jamo[(s % 588) / 28 + 1] || t_jamo[s % 28 + 1];
      initials := initials || l_jamo[s / 588 + 1];
      roman := roman || l_rom[s / 588 + 1] || v_rom[(s % 588) / 28 + 1] || t_rom[s % 28 + 1];
    ELSIF code BETWEEN 12593 AND 12622 THEN         -- ㄱ..ㅎ typed on their own
      jamo := jamo || ch;
      initials := initials || ch;
    ELSIF code BETWEEN 12623 AND 12643 THEN         -- ㅏ..ㅣ
      jamo := jamo || ch;
    ELSIF code BETWEEN 4352 AND 4370 THEN           -- NFKC turns a lone ㄱ into ᄀ (U+1100..)
      jamo := jamo || l_jamo[code - 4352 + 1];
      initials := initials || l_jamo[code - 4352 + 1];
    ELSIF code BETWEEN 4449 AND 4469 THEN           -- ᅡ..ᅵ
      jamo := jamo || v_jamo[code - 4449 + 1];
    ELSIF code BETWEEN 4520 AND 4546 THEN           -- ᆨ..ᇂ (final consonants)
      jamo := jamo || t_jamo[code - 4520 + 2];
    ELSIF ch ~ '^[a-z0-9]$' THEN
      roman := roman || ch;
    END IF;
  END LOOP;
END
$$;

-- Spelling-tolerant Latin: Jisoo / Jisu / 지수 all fold to "cisu".
CREATE OR REPLACE FUNCTION kcs_roman_fold(text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT regexp_replace(
    translate(
      replace(replace(replace(replace(replace(replace(replace(replace(replace(
        regexp_replace(lower(coalesce($1, '')), '[^a-z0-9]', '', 'g'),
        'oo', 'u'), 'ee', 'i'), 'eo', 'o'), 'eu', 'u'), 'ae', 'e'), 'ou', 'u'), 'ui', 'i'),
        'ch', 'c'), 'sh', 's'),
      'jgdbr', 'cktpl'),
    '(.)\1+', '\1', 'g')
$$;

CREATE OR REPLACE FUNCTION kcs_bigrams(prefix text, s text) RETURNS text[]
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE
    WHEN s IS NULL OR s = '' THEN '{}'::text[]
    WHEN char_length(s) = 1 THEN ARRAY[prefix || s]
    ELSE ARRAY(SELECT DISTINCT prefix || substr(s, i, 2) FROM generate_series(1, char_length(s) - 1) AS i)
  END
$$;

CREATE OR REPLACE FUNCTION kcs_name_grams(name text) RETURNS text[]
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT ARRAY(SELECT DISTINCT g FROM unnest(
      kcs_bigrams('c:', regexp_replace(n, '[a-z0-9\u1100-\u11ff\u3131-\u318e]', '', 'g'))
      || CASE WHEN (p).jamo ~ '[ㅏ-ㅣ]' THEN kcs_bigrams('j:', (p).jamo) ELSE '{}'::text[] END
      || kcs_bigrams('i:', (p).initials)
      || kcs_bigrams('r:', kcs_roman_fold((p).roman))) AS g
    ORDER BY g)
  FROM (SELECT kcs_name_norm(name) AS n, kcs_hangul_parts(kcs_name_norm(name)) AS p) parts
$$;

-- Share of the query's grams that the name has (1 = every piece of the query
-- is in the name). The romanised grams also count on their own (× 0.9) so a
-- Hangul query finds a Latin spelling; only with ≥ 3 of them, so a one-syllable
-- query cannot match every name that sounds a bit alike.
CREATE OR REPLACE FUNCTION kcs_name_score(grams text[], query text[]) RETURNS float8
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE WHEN cardinality(query) = 0 THEN 0::float8 ELSE GREATEST(
    count(*) FILTER (WHERE hit)::float8 / cardinality(query),
    CASE WHEN count(*) FILTER (WHERE roman) >= 3
      THEN 0.9 * count(*) FILTER (WHERE roman AND hit)::float8 / count(*) FILTER (WHERE roman)
      ELSE 0 END)
  END
  FROM (SELECT q = ANY(grams) AS hit, q LIKE 'r:%' AS roman FROM unnest(query) AS q) AS pieces
$$;

ALTER TABLE creators ADD COLUMN IF NOT EXISTS name_norm text
  GENERATED ALWAYS AS (kcs_name_norm(display_name)) STORED;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS name_grams text[]
  GENERATED ALWAYS AS (kcs_name_grams(display_name)) STORED;
CREATE INDEX IF NOT EXISTS creators_name_grams_idx ON creators USING gin (name_grams);
