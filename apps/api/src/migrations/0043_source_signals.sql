-- What a source says beyond the shared metrics (health level, 低活跃, platform
-- ranks, 3-second read rate, …) — see `SourceSignals` in the contract. The
-- latest source's copy sits on the creator; each snapshot keeps its own.
ALTER TABLE creators ADD COLUMN IF NOT EXISTS source_signals jsonb;
ALTER TABLE creator_metrics_history ADD COLUMN IF NOT EXISTS signals jsonb;

-- 健康等级 has two levels (健康 / 异常); 「优秀」 was never one. Live numbers and
-- history are relabelled; publish snapshots stay exactly as they were published.
UPDATE creators SET metrics = jsonb_set(metrics, '{health}', '"normal"')
 WHERE metrics->>'health' = 'excellent';
UPDATE creator_metrics_history SET metrics = jsonb_set(metrics, '{health}', '"normal"')
 WHERE metrics->>'health' = 'excellent';
