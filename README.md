# 听潮

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

## 端口

四个独立听潮应用（共享 `libs/panel` 层）加遗留 TinyShip 面板：

| 端口 | 应用 | 说明 |
|------|------|------|
| 7000 | `apps/marketing` | 宣传页 + 登录宿主（`pnpm --filter @kcs/app-marketing dev`） |
| 7001 | `apps/nuxt-app` | 遗留 TinyShip 面板，e2e 合同宿主（`pnpm dev:nuxt`） |
| 7002 | `apps/ops` | 后台录入（`pnpm --filter @kcs/app-ops dev`） |
| 7003 | `apps/dev` | 监控面板（`pnpm --filter @kcs/app-dev dev`） |
| 7004 | `apps/select` | 前台选人（`pnpm --filter @kcs/app-select dev`） |
| 7100 | `apps/api` | Hono API（`pnpm dev:api`） |

`apps/web`（纸面台账）已退役，不要再起。登录走 marketing（7000）的 `/{locale}/login`，按角色落到 select/ops/dev。

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

`docs/` 与 `archive/` 未覆盖。
