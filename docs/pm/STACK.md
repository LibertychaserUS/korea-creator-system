# 必选技术栈

> 项目：`korea-creator-system`。
> 三件套都是**技术名**，不是产品品牌，也 **不是** Harness.io。
> 细则（目录、初始化命令、三者如何组装）只写在 [`../product/TINYSHIP-REBUILD.md`](../product/TINYSHIP-REBUILD.md)。那份文件由研究代理落地；未落地前不要另起一套栈故事。

## 必选（Now / Next，不是 Later）

| 名称 | 本仓库怎么用 |
|------|----------------|
| **tinyship** | 绿地应用宿主 / 交付框架。新 UI 与运行入口只落在 tinyship 树上。 |
| **forge** | 必须接入第一刀。脚手架、生成或仓库约定以 `TINYSHIP-REBUILD.md` 为准；禁止「以后再加」。 |
| **overlay** | 必须接入第一刀。覆盖层/扩展层以 `TINYSHIP-REBUILD.md` 为准；禁止「以后再加」。 |

缺任一，`KCS-TS-01` 及其依赖票视为失败。不要用手写 FastAPI 顶替这三件套。

## 不在此列

- 旧 Demo：只在 `archive/`（墓碑）。仓库根没有可施工的 `app/`。
- `docs/`：留下，历史 + 产品意图。
- Harness.io、`docs/pm/HARNESS.md`。

## 代理怎么读

1. 本文件：三件套是硬约束。
2. `TINYSHIP-REBUILD.md`：怎么装、怎么跑、目录在哪。
3. `BACKLOG.md` 的 `KCS-TS-01` / `KCS-TS-01F` / `KCS-TS-01O`：第一刀必须同时用到三者。
