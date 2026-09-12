# 必选技术栈

> 项目：`korea-creator-system`。
> 三件套都是**技术名**，不是产品品牌，也 **不是** Harness.io。
> 细则 SSOT：[`../product/TINYSHIP-REBUILD.md`](../product/TINYSHIP-REBUILD.md)（已落地）。不要在本文件另写一套命令。

## 必选（Now / Next，不是 Later）

| 名称 | 本仓库怎么用 |
|------|----------------|
| **tinyship** | 应用宿主。TinyShipCN 模板落在**仓库根**（`pnpm dev:nuxt`）。官方仓 404 时用本机 `v2.2.0` / `54ddc7a`。 |
| **forge** | LibertychaserUS/AIOps 的 GitHub 落地门：`python -m forge check` / `submit`。薄 `forge.yaml`。不 vendor、不 live-apply、不合入。 |
| **overlay** | 同一 AIOps 仓的用例门：`python -m overlay validate|cover|run`。薄 `overlay.yaml` + `inbox/` + `suites/` + `invariants.yaml`。CI 只跑 `active`。 |
| **i18n** | TinyShip 自带：`config.app.i18n` + `libs/i18n` + Nuxt `@nuxtjs/i18n`（`strategy: 'prefix'`，cookie `NEXT_LOCALE`）。模板只有 `en` / `zh-CN`；本产品必须扩 `ko`。第一刀就要语言切换。细则 `TINYSHIP-REBUILD.md` §5.1。 |

缺三件套任一，或宿主只有中文，`KCS-TS-01` 及其依赖票视为失败。不要用手写 FastAPI 顶替这三件套，不要另写一套 i18n。

## 不在此列

- 旧 Python Demo：已从工作树删除（历史 git `f31c882`）。仓库根没有可施工的 `app/`，也不要把它加回来。
- `docs/`：留下，历史 + 产品意图。
- Harness.io、`docs/pm/HARNESS.md`。

## 代理怎么读

1. 本文件：三件套是硬约束。
2. `TINYSHIP-REBUILD.md`：怎么装、怎么跑、目录在哪。
3. `BACKLOG.md` 的 `KCS-TS-01` / `KCS-TS-01F` / `KCS-TS-01O` / `KCS-TS-01I`：第一刀必须同时用到三件套 **和** 中英韩切换。
