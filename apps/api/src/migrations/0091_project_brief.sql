-- 选人任务的 brief：随项目保存的数字化需求说明（品类 / 人数 / 预算 /
-- 目标 / 截止日期，白名单字段由 API 校验）。NULL = 还没填需求。
ALTER TABLE projects ADD COLUMN IF NOT EXISTS brief jsonb;
