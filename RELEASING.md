# 发布与版本约定

## 版本号：日历版本（CalVer）

- 格式：`kcs-YYYY.MM.DD`（例：`kcs-2026.10.01`），**一天一个版本，当天第二次发布加后缀 `-2`**。
- 版本号就是 git annotated tag、GHCR 镜像 tag、GitHub Release 名，以及 `/api/health` 返回的 `version`——四处永远同值。
- 平时提交不打 tag；**决定上线时才打 tag**，tag 一旦推送不可复用（推错了用 `-2` 后缀重发）。

## 发布流水线（打 tag 即发布）

1. 本地提交全部改动（提交信息简洁中文，不带密钥、.env、日志）。
2. 打 annotated tag 并推送：

   ```bash
   git tag -a kcs-YYYY.MM.DD -m "kcs-YYYY.MM.DD"
   git push origin main --follow-tags
   ```

3. `release.yml` 自动构建 6 个 arm64 镜像（api / marketing / select / ops / dev / tools）推到 `ghcr.io/<owner>/kcs/<service>:<版本号>`，并创建 GitHub Release（自动从提交生成说明）。
4. CI（`ci.yml`）在每次推送/PR 跑契约、API、前端单元测试与类型检查；发布 tag 时不重复跑。

## 服务器部署与回滚

部署目录 `/opt/kcs/deploy/ecs`，镜像来源由 `.env` 两个变量决定：

```bash
KCS_REGISTRY=ghcr.io/libertychaserus/kcs   # 或本地 kcs（本机构建时）
KCS_TAG=kcs-2026.10.01                     # 要上的版本
```

上线：`git pull`（部署文件）→ 改 `.env` 的 `KCS_TAG` → `docker compose -f compose.prod.yml pull && up -d`。
回滚：把 `KCS_TAG` 改回旧版本再 `up -d`，无需重新构建。

## 纪律

- 仓库里永不出现：密钥、`.env`、数据库、日志、构建产物。口令只存在服务器的 `.env` 与密码管理器。
- 文档密包（`docs-archive/*.7z`）口令由仓库负责人保管，不进仓库。
- 提交信息：简洁中文，一行说清「改了什么、为什么」。
