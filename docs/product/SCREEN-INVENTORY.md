# 屏幕清单 — 挑好人 · 分到项目

> 给 **AI 出图** 和 **逐页领取** 用。规格：[`PRD.md`](./PRD.md)。
> 路由套 `/{locale}`，`locale ∈ zh-CN|en|ko`。
> 共 **34** 屏。`m1=yes` = Milestone 1 必做。其余先出图，实现可「未做」空态。
> 主操作 = 该屏唯一主按钮。

---

## 总表

| id | 工作区 | 名称 | 目的（一行） | 主操作 | m1 |
|----|--------|------|--------------|--------|----|
| AUTH-LOGIN | 共用 | 登录 | 三种角色进自己的工作区 | 登录 | yes |
| AUTH-DENIED | 共用 | 无权限 | 越权不露未发布数据 | 回我的工作区 | yes |
| SEL-HOME | 前台选人 | 选人首页 | 看见项目进度和可去库里挑人 | 去人才库 | no |
| SEL-LIBRARY | 前台选人 | 人才库 | 从已发布的人里方便筛选 | 打开详情 / 加入项目 | yes |
| SEL-TALENT | 前台选人 | 人才详情 | 决定要不要放进项目 | 加入项目 | yes |
| SEL-PROJECT-LIST | 前台选人 | 项目列表 | 找到本组织的项目 | 打开项目 | no |
| SEL-PROJECT-NEW | 前台选人 | 新建项目 | 建一个选人容器 | 创建 | yes |
| SEL-PROJECT | 前台选人 | 项目短名单 | 分配、改三态、移出 | 保存状态 / 移出 | yes |
| SEL-ASSIGN | 前台选人 | 确认加入 | 把库里勾选的人放进项目 | 确认加入 | yes |
| SEL-PROJECT-EXPORT | 前台选人 | 导出短名单 | 带走当前项目名单 | 下载 | no |
| SEL-COMPARE | 前台选人 | 对比 | 后期并排看 2–3 人 | 加入项目 | no |
| OPS-HOME | 后台录入 | 录入首页 | 下手录、导入或开一条 Job | 录人 / 开任务 | yes |
| OPS-TALENT-LIST | 后台录入 | 后台人才 | 看草稿/可发布/已发布 | 打开发布或校对 | yes |
| OPS-TALENT-NEW | 后台录入 | 手工录人 | 登记一个人 | 保存为草稿 | yes |
| OPS-TALENT-EDIT | 后台录入 | 校对补全 | 把草稿变成可发布 | 保存 | yes |
| OPS-TALENT-DETAIL | 后台录入 | 作业详情 | 看出处、源、Job、发布态 | 发布或撤回 | no |
| OPS-IMPORT | 后台录入 | 文件导入 | 选文件 Source 开导入 Job | 确认导入 | yes |
| OPS-IMPORT-DETAIL | 后台录入 | 导入结果 | 看本批写入/跳过/错误行 | 去校对 | no |
| OPS-PUBLISH | 后台录入 | 确认发布 | 把 ready 的人推到前台 | 确认发布 | yes |
| OPS-UNPUBLISH | 后台录入 | 确认撤回 | 人前台不可见（项目里已分配保持只读提示） | 确认撤回 | no |
| OPS-SOURCE-LIST | 后台录入 | 数据源 | 看已配置源（只读+启用态） | 选源去开 Job | no |
| OPS-JOB-NEW | 后台录入 | 开自动任务 | 对已配置源确认拉数 | 确认开跑 | yes |
| OPS-REVIEW | 后台录入 | 质检队列 | 后期：标记质量问题 | 标记 | no |
| OPS-ORG | 后台录入 | 组织 | 后期：多家选人公司 | 保存 | no |
| DEV-HEALTH | 后台监测 | 健康 | 服务与最近 Job 是否正常 | 查看失败 | yes |
| DEV-JOBS | 后台监测 | 任务列表 | 所有 Job 状态 | 打开失败项 | yes |
| DEV-JOB-DETAIL | 后台监测 | 任务详情 | 一段 Job 的审计与错误 | 确认重试 | no |
| DEV-SOURCES | 后台监测 | 源健康 | 源启用、限速、最近失败 | 打开任务 | no |
| DEV-PIPELINE | 后台监测 | 管道 | 入库各段是否卡住 | 打开卡住的 Job | no |
| DEV-QUEUE | 后台监测 | 队列 | 积压与最老等待 | 刷新 | no |
| DEV-LOGS | 后台监测 | 错误日志 | 排障（无密钥） | 复制摘要 | no |
| DEV-AUDIT | 后台监测 | 审计 | 谁开了哪条 Job | 筛选操作者 | no |
| DEV-GATES | 后台监测 | 门 | forge/overlay 是否绿 | 只读 | no |
| DEV-KEYS | 后台监测 | 配置布尔 | 必要密钥是否存在 | 只读 | no |

M1 = **16** 屏。其余 18 屏出图，实现后做。

---

## 空态 / 错态（M1 屏必须画进 mockup）

| id | 空 | 错 |
|----|----|----|
| AUTH-LOGIN | — | 账号或密码错 |
| AUTH-DENIED | 无业务行 | — |
| SEL-LIBRARY | 还没有已发布的人 | 加载失败，重试 |
| SEL-TALENT | 未发布 id → 当 404 | — |
| SEL-PROJECT-NEW | — | 名称为空 |
| SEL-PROJECT | 名单 0 人，主按钮去库里选 | 保存失败保留勾选 |
| SEL-ASSIGN | 未勾选则主按钮禁用 | 此人已在本项目 |
| OPS-HOME | 库空，主按钮录第一人或开任务 | 上次 Job 失败条跳监测 |
| OPS-TALENT-LIST | 还没有人 | — |
| OPS-TALENT-NEW | 空表单 | 缺显示名或键 |
| OPS-TALENT-EDIT | — | 保存失败保留输入 |
| OPS-IMPORT | 未选文件禁用确认 | 空文件 / 非表 |
| OPS-PUBLISH | 没有 ready 人，主按钮回列表 | — |
| OPS-JOB-NEW | 无已启用源：引导去找运维配源（M1 可用文件源） | 源未启用 |
| DEV-HEALTH | 从未跑过 Job | 服务不健康 |
| DEV-JOBS | 无任务 | 失败行可点 |

---

## 出图（批准后才做）

1. M1 十六屏：浅色 + 深色各 1（32 张）。
2. 其余十八屏：浅色 1（18 张）。约 50 张。
3. `SEL-LIBRARY`、`OPS-HOME` 各补 `en` / `ko` chrome 各 1。
4. 图上必须能分清：前台无草稿、无 Job 栈；`/dev` 无「加入项目」。
5. 出现 TinyShip 定价/口号 → 废图。
6. 图注写 `id` + 工作区 + 主题 + 语言。

## 逐页领取（批准后）

一次一个 id（AUTH-LOGIN 可与 AUTH-DENIED 同领）。对照 mockup + 主操作 + 上表空/错。先红测：未发布前台 404/空；越权 403；分配不改 Talent 身份键。合入前 `forge check`。
