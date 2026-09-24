-- Rows every install needs, with or without demo data: the platform org every
-- mirrored profile belongs to, the built-in categories (coop_history is a mutex
-- group the API enforces) and the four registered sources the queue writes
-- against. DO NOTHING: whatever ops renamed or disabled later stays as they left it.
INSERT INTO orgs (id, name) VALUES ('org_platform', '全球达人情报')
ON CONFLICT (id) DO NOTHING;

INSERT INTO categories (slug, name_zh, name_en, name_ko, builtin, enabled, group_name, frontend_visible) VALUES
  ('collaborated', '合作过的', 'Collaborated', '협업함', true, true, 'coop_history', true),
  ('never_collaborated', '没合作过的', 'Never collaborated', '협업 없음', true, true, 'coop_history', true),
  ('intending', '意向中', 'Intending', '의향', true, true, NULL, true),
  ('blacklist', '黑名单', 'Blacklist', '블랙리스트', true, true, NULL, false),
  ('stale', '待更新', 'Stale', '업데이트 필요', true, true, NULL, true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO ingest_sources (id, name, adapter_type, enabled, rate_limit, quota, owner) VALUES
  ('file-drop', '文件投递', 'file_drop', true, 60, 1000, 'ops'),
  ('pugongying', '蒲公英 OpenAPI', 'pugongying', true, 60, 1000, 'ops'),
  ('qiangua', '千瓜', 'qiangua', true, 60, 1000, 'ops'),
  ('xinhong', '新红', 'xinhong', true, 60, 1000, 'ops')
ON CONFLICT (id) DO NOTHING;
