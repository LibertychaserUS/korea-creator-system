# 路线图

> 项目：`korea-creator-system`。产品显示名：听潮。
> 实现面：**tinyship + forge + overlay** 绿地（三件套 Now 必用，见 [`STACK.md`](./STACK.md)）。
> 旧 FastAPI Demo **冻结在 `archive/`**（含墓碑），不在 Now/Next 施工列。
> `docs/` **留下**：历史口径与产品意图的权威处（编号文档 + `product/` + `pm/`）。
> 细则：[`../product/TINYSHIP-REBUILD.md`](../product/TINYSHIP-REBUILD.md)。工单：[`BACKLOG.md`](./BACKLOG.md)。

## Now

- 产品 / PM 文档留在 `docs/product/`、`docs/pm/`（不要搬进 archive）。
- 旧 Demo 由另一代理迁入 `archive/` + 墓碑；本文档按「根上已无施工用 `app/`」书写。
- `TINYSHIP-REBUILD.md` 已写清三件套来源与组装。脚手架等用户批准该文件 §9。
- 编号文档 `v8a-dashboard` 只当历史快照。

不做：Stage 8B、在 archive 里扩 V2、删除或搬迁 `docs/`、未批准就 rsync TinyShip、把 forge/overlay 或三语推到 Later、先做中文-only 宿主。

## Next（绿地 MVP = V1 闭环）

在 **新应用** 上按顺序交付，对应 `KCS-TS-*`：

1. **三件套 + 三语第一刀**：tinyship 能跑 + forge 已接入 + overlay 已接入 + `zh-CN` / `en` / `ko` 可切换（`KCS-TS-01` / `01F` / `01O` / `01I`）。缺一则停。
2. Excel 导入 + 清洗去重。
3. 规则排序（六维 + 风险 + 等级 + 榜单）。
4. Top50 风险复核 + fallback。
5. 人工确认（四态，不改分）。
6. 时间戳导出。
7. 六个轻量面（控制台 / 榜单 / 详情 / 规则只读 / 人工复核 / 导出）。每个面三语 chrome 同步交付，不是「中文先闭环」。

## Later

- 同一新栈：更多 Excel 批次、Top50 全量真实 DeepSeek、规则可编辑 + 回放。
- 迁 V2 **意图**（不是旧 JSON 文件）：联系跟进、报价三档、规则复盘、批次对比。
- IMOK / V3 三角色平台：另一产品线，不在本 MVP 路线上排期。
- 三语不在 Later：已升为第一刀 `KCS-TS-01I`（计划书 V1.1 时间表作废）。

## 明确停掉的旧路线

| 旧说法 | 现说法 |
|--------|--------|
| 第八阶段 B 补四个空页 | 取消。那些页若要存在，在 tinyship 重做 |
| 把未发布 V2 补进编号文档并在 archive UI 收尾 | `docs/` 保持旧快照；V2 意图变成 Later 票 |
| 仓库根继续当 FastAPI 工程 | 代码在 `archive/`；新工作只进 tinyship + forge + overlay |
| 先搭 tinyship、forge/overlay 以后再说 | 取消。第一刀就必须三件套 |
| 计划书「V1 中文、V1.1 语言包」/ 中文先闭环 | 取消。第一刀就要 `zh-CN` / `en` / `ko` 切换 |
| 计划书阶段 1「FastAPI + SQLite 骨架」 | 骨架改三件套；存储听 `TINYSHIP-REBUILD.md` |
