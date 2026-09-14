# 全球达人情报系统

仓库名：`korea-creator-system`。Nuxt 全栈（tinyship 宿主）。规则排序，AI 看风险，人做确认。

## 怎么跑

需要 Node `>= 22`、pnpm `>= 9`。

```text
cp env.example .env
# 将 DB_DIALECT 设为 sqlite，并写好 BETTER_AUTH_SECRET
mkdir -p data
pnpm install
pnpm db:push:sqlite
pnpm dev:nuxt
```

打开：

- http://localhost:7001/zh-CN/
- http://localhost:7001/en/
- http://localhost:7001/ko/
- `?lang=ko` 会落到前缀路由
- http://localhost:7001/api/health
- http://localhost:7001/api/kcs/creators

语言 cookie：`NEXT_LOCALE`。外观：浅色 / 深色 / 跟随系统（`kcs-ui-theme-pref`）。

## 屏幕

- 总览 `/`
- 达人名单 `/creators`
- AI 复核 `/reviews`

## Forge / Overlay

针：`overlay-v2.0.0` + `forge-v1.1.1`（[LibertychaserUS/AIOps](https://github.com/LibertychaserUS/AIOps)）。

```text
git clone https://github.com/LibertychaserUS/AIOps.git /tmp/AIOps
git -C /tmp/AIOps checkout overlay-v2.0.0
python3 -m pip install -r /tmp/AIOps/requirements.txt
export PYTHONPATH=/tmp/AIOps
python3 -m overlay validate --root .
python3 -m overlay cover --root .
python3 -m forge check --root .
```

产品测试：`pnpm exec vitest run tests/kcs/score-immutability.test.ts`

规格黑盒（HTTP + Postgres，不是 Playwright）：见 [`tests/blackbox/README.md`](tests/blackbox/README.md)。
浏览器旅程（Playwright + Postgres + MinIO）：`pnpm test:e2e`，合同 [`e2e/CONTRACT.md`](e2e/CONTRACT.md)。

```text
docker compose up -d postgres
pnpm test:blackbox
```

## TinyShip 来源

见 [`docs/product/TINYSHIP-PIN.md`](docs/product/TINYSHIP-PIN.md)。官方仓 `TinyshipCN/tinyship` @ `v2.2.0` / `54ddc7a`。应用树里没有 Ascendia 产品代码。

`docs/` 未覆盖。旧 Python / FastAPI Demo 已从工作树删除；要考古看 git `f31c882`（`archive/v8a-dashboard/`）和 `docs/00_*`–`10_*`。
