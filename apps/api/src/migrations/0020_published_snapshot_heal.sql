-- Released rows always carry a snapshot, so the select read paths never have
-- to write one. The startup heal (`ensurePublishedSnapshots`) folds followers /
-- price in and derives ratios; this is the SQL floor for rows it has not seen yet.
UPDATE creators SET metrics_locked = metrics
 WHERE status = 'released' AND metrics_locked IS NULL AND metrics IS NOT NULL;

UPDATE creators SET metrics_locked = jsonb_build_object('window', COALESCE(metrics_window, 30), 'followers', followers)
 WHERE status = 'released' AND metrics_locked IS NULL;

UPDATE creators SET metrics_locked_at = COALESCE(metrics_fetched_at, updated_at)
 WHERE metrics_locked IS NOT NULL AND metrics_locked_at IS NULL;
