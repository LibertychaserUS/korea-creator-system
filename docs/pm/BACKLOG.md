# Backlog

> 项目：`korea-creator-system`。工单前缀：`KCS-`。
> **For agentic workers:** 实现前读 [`STACK.md`](./STACK.md)、[`../product/PRD.md`](../product/PRD.md)、[`../product/TINYSHIP-REBUILD.md`](../product/TINYSHIP-REBUILD.md)。旧 Demo 在 `archive/`，不要默认仓库根还有 `app/`。
> 已取消：旧仪表盘 Stage 8B；以及「先 tinyship、forge/overlay 以后再说」。

全局约束（每张票默认带上）：

- 技术名 `korea-creator-system`；UI 显示「全球达人情报系统」。
- 新栈必用 **tinyship + forge + overlay**。命令与目录只抄 `TINYSHIP-REBUILD.md`，不要发明 API。
- **规则排序 / 风险复核 / 人工确认**；AI 与人工不改 `score` / `grade` / `rank`。
- 不改 `archive/` 冻结代码，除非票面写明「只读对照」。不搬 `docs/`。
- 不引入 Harness.io。harness = `AGENTS.md` + superpowers + writing-for-agents + writing-plans。

---

## 已取消（不要做）

| id | 原标题 | 原因 |
|----|--------|------|
| 8B-01～8B-04 | 旧 SPA 人工复核 / 邮件 / 导出 / 规则空页 | 用户判定旧代码与逻辑大体不可用 |
| V2-DOC-CLOSE | 把 `/api/v2/*` 收进旧编号文档并在旧页收尾 | 文档可引用意图；实现面已换成绿地 |

---

## Now — 文档与研究（本轮）

### KCS-DOC-01 产品与 PM 初始化

- **why:** 代理需要一份不指向旧 8B 的施工图。
- **acceptance:**
  - [x] `docs/product/{VISION,PRD,DOMAIN,ARCHITECTURE,UX-FLOWS}.md` 存在
  - [x] `docs/pm/{ROADMAP,BACKLOG,WORKING-AGREEMENT}.md` 存在
  - [x] 工单前缀 `KCS-`；产品显示名与项目标识分开
  - [x] 无 `docs/pm/HARNESS.md`、无 Harness.io 配置
  - [x] `docs/pm/STACK.md` 写明 tinyship + forge + overlay 为硬约束
  - [ ] `TINYSHIP-REBUILD.md` 落地后，本 backlog 的 TS 票仍能对上（若冲突，改本文件）
- **deps:** 无

### KCS-TS-00 阅读三件套重建说明

- **why:** 脚手架、forge、overlay 的真实命令只以研究代理那份为准。
- **acceptance:**
  - [ ] `docs/product/TINYSHIP-REBUILD.md` 已存在
  - [ ] 该文件写明 tinyship / forge / overlay **各自角色、初始化命令、落盘目录**
  - [ ] 未在本仓库擅自另起框架脚手架
- **deps:** 研究代理

---

## Next — 绿地 MVP（`KCS-TS-*`）

实现必须落在 tinyship + forge + overlay 新树，路径以 `TINYSHIP-REBUILD.md` 为准。下列是产品切片，不是 `archive/` 里的旧模块。

### KCS-TS-01 三件套宿主能跑

- **why:** 没有同时装上三件套的宿主，后面每张票都会焊回旧 FastAPI 或只剩空 tinyship。
- **acceptance:**
  - [ ] 按 `TINYSHIP-REBUILD.md` 启动 tinyship 应用；健康检查或首页 200
  - [ ] 同一棵活树上能指出 forge 产物或配置（路径写进 `docs/01_开发日志.md`）
  - [ ] 同一棵活树上能指出 overlay 产物或配置（路径写进开发日志）
  - [ ] 缺 forge 或 overlay 则本票失败，不得标完成
  - [ ] 未把 `archive/` 里的进程当运行入口
- **deps:** KCS-TS-00, KCS-TS-01F, KCS-TS-01O

### KCS-TS-01F forge 接入（必做）

- **why:** 用户要求第一刀就用 forge，不是可选项。
- **acceptance:**
  - [ ] 只使用 `TINYSHIP-REBUILD.md` 里的 forge 命令 / 约定（不发明 CLI）
  - [ ] 仓库中出现该文件列出的 forge 落盘（目录或配置文件）
  - [ ] `docs/01_开发日志.md` 记下一句：用了哪条命令、产物在哪
  - [ ] 没有「先跳过 forge」的分支或 TODO
- **deps:** KCS-TS-00

### KCS-TS-01O overlay 接入（必做）

- **why:** 用户要求第一刀就用 overlay，不是可选项。
- **acceptance:**
  - [ ] 只使用 `TINYSHIP-REBUILD.md` 里的 overlay 命令 / 约定
  - [ ] 仓库中出现该文件列出的 overlay 落盘，且被宿主加载（按该文件的验收方式）
  - [ ] `docs/01_开发日志.md` 记下一句：用了哪条命令、产物在哪
  - [ ] 没有「先跳过 overlay」的分支或 TODO
- **deps:** KCS-TS-00

### KCS-TS-02 导入清洗去重

- **why:** V1 计划第一步：0201 → 稳定 Creator 集合。
- **acceptance:**
  - [ ] 读 0201 或 `data/input/current.xlsx`
  - [ ] `creator_key` 规则与 [`../product/DOMAIN.md`](../product/DOMAIN.md) 一致
  - [ ] 输出可数的原始行 / 去重人数 / 缺主键行
  - [ ] 缺文件时失败信息明确，不写空名单冒充成功
- **deps:** KCS-TS-01, KCS-TS-01F, KCS-TS-01O

### KCS-TS-03 规则排序

- **why:** 排序是产品核心；AI 不得碰。
- **acceptance:**
  - [ ] 六维 + 风险扣分 + 最终分 + 等级 + 排名
  - [ ] 权重默认沿用 V1：25/15/25/20/10/5
  - [ ] 每条有命中词与 `risk_reasons`
  - [ ] Top10 / Top50 / 全量可切
  - [ ] 单元测试：同一输入两次分数一致
- **deps:** KCS-TS-02

### KCS-TS-04 Top50 风险复核

- **why:** V1：AI 是解释层；无 Key 也要能演示。
- **acceptance:**
  - [ ] 只对 Top50 调用
  - [ ] 写出 `recommend|cautious|reject` + 文本
  - [ ] 无 Key / 超时 → fallback 模板
  - [ ] 调用前后 Score 三元组不变
  - [ ] 不把 fallback 算进真实冲突率
- **deps:** KCS-TS-03

### KCS-TS-05 人工确认

- **why:** 人做决定；计划书四态。
- **acceptance:**
  - [ ] 推荐 / 不推荐 / 待确认 / 已复核
  - [ ] 键为 `creator_key`（+ 当前 run），不用 rank
  - [ ] 保存后再读：标注变、分数不变
  - [ ] 导出能带上标注
- **deps:** KCS-TS-03

### KCS-TS-06 时间戳导出

- **why:** 计划书验收：带走 Excel/CSV。
- **acceptance:**
  - [ ] Top10 / Top50 / 全量；含分与标注
  - [ ] 文件名含年月日时分
  - [ ] 不发邮件
- **deps:** KCS-TS-03, KCS-TS-05

### KCS-TS-07 六个轻量面

- **why:** 计划书页面清单；没有 UI 不能演示。
- **acceptance:**
  - [ ] 控制台 / 榜单 / 详情 / 规则只读 / 人工复核 / 导出 可点通
  - [ ] 图表：Top10 条形、六维雷达、等级分布、关键词排行
  - [ ] 无 Key 走完主路径（见 `UX-FLOWS.md`）
  - [ ] 中文先可用
- **deps:** KCS-TS-04, KCS-TS-05, KCS-TS-06

### KCS-TS-08 规则只读页

- **why:** 计划书有规则配置；MVP 先避免在线改权重造成不可复现。
- **acceptance:**
  - [ ] 展示当前权重与扣分口径
  - [ ] 无保存即改分的入口
  - [ ] 文案写明「可编辑 = 中期」
- **deps:** KCS-TS-03；可与 KCS-TS-07 同做

---

## Later — 仍在新栈

### KCS-MID-01 Top50 全量真实 DeepSeek

- **why:** 旧 Demo 仅 10 条 success，讲解时 fallback 过多。
- **acceptance:** 50 条 `success` 或每条有记录在案的失败原因；分数仍不变。
- **deps:** KCS-TS-04；有效 Key

### KCS-MID-02 多批次 Excel

- **why:** V1 单文件；V2 意图是批次。在新栈做，不接旧 `v2_batches.json`。
- **acceptance:** 能导入第二张表为新 run；`creator_key` 可对齐；旧 run 不被覆盖。
- **deps:** KCS-TS-02, KCS-TS-03

### KCS-MID-03 联系跟进与报价

- **why:** V2 计划模块 6；旧页叫「邮件触达」实际是联系记录。
- **acceptance:** 状态 / 渠道 / 参考·询价·最终报价；**无 SMTP**；不改分。
- **deps:** KCS-TS-07

### KCS-MID-04 规则复盘

- **why:** 人工分歧沉淀为下一版规则，而不是改当前分。
- **acceptance:** 复核日志、分歧统计、建议列表；启用新规则 = 新 RuleVersion + 重跑，不是 patch 旧分。
- **deps:** KCS-TS-05, KCS-TS-08

### KCS-LATER-01 三语

- **why:** 计划书 V1.1；旧 Demo 已做过一轮，新栈按需重做。
- **acceptance:** zh-CN / en / ko 覆盖六个面；豁免原文四类。
- **deps:** KCS-TS-07

### KCS-LATER-02 平台化（不排期）

- **why:** 会议纪要 / V3 三角色。避免混进本 MVP。
- **acceptance:** 单独产品决策后再开仓库或目录；本 backlog 不拆实施步骤。
- **deps:** 用户明示
