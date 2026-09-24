# 上线手册：单台阿里云 ECS + docker compose

全球达人情报系统生产部署只有一种受支持的形态：**一台 ECS，`deploy/ecs/compose.prod.yml` 一把起**。
数据库可以在同一台机器上自建（`localdb`），也可以换成 RDS PostgreSQL；图片与备份可以放 OSS，
也可以先不接。下文所有域名都是 `example.com` 占位，换成你自己的。

```
                  ┌──────────────── ECS（docker compose，项目名 kcs）───────────────────┐
 浏览器 ─443/80─▶ │ caddy（或 nginx） ─┬─▶ marketing:3000  www.example.com             │
                  │  · 自动 / 自备证书 ├─▶ select:3000     select.example.com          │
                  │  · 覆盖 XFF        ├─▶ ops:3000        ops.example.com             │
                  │  · 安全头 / 缓存   ├─▶ dev:3000        dev.example.com             │
                  │                    └─▶ api:7100        api.example.com             │
                  │                                                                   │
                  │  init（一次性：迁移 + 身份库建表 + 首个管理员）  backup（每日 pg_dump）│
                  │  postgres:16（localdb，可选；只在 internal 网络，不出网）             │
                  └───────────────────────────────────────────────────────────────────┘
                         │ 可选                              │ 可选
                         ▼                                   ▼
                   RDS PostgreSQL 16               OSS 私有桶（图片 / 表格原件 / 备份）
```

- 只有代理对外发布端口（80 / 443，含 443/udp 给 HTTP/3）。API、四端、Postgres 都不对外。
- 登录在宣传站（`www.`），会话 cookie `kcs_session` 写在父域（`AUTH_COOKIE_DOMAIN=.example.com`），
  所以交接到 `select.` / `ops.` / `dev.` 不用再登，`api.` 也收得到。它是 **httpOnly + Secure + SameSite=Lax**，
  页面脚本读不到；API 对带 cookie 的写请求校验 `Origin` 必须是四端之一。
- 图片一律经 `https://api.example.com/api/assets/raw/<key>` 读出，桶保持私有。

目录：

| 路径 | 用途 |
|---|---|
| `deploy/ecs/compose.prod.yml` | 生产编排（全部服务、资源上限、日志轮转、健康检查） |
| `deploy/ecs/.env.example` | 全部变量，逐项注释【必填】/【选填】；复制成 `.env` |
| `deploy/ecs/Caddyfile` | 默认代理：自动 HTTPS |
| `deploy/ecs/nginx/*.template` | 等价的 nginx 配置（用阿里云 SSL 证书时） |
| `deploy/ecs/postgres/initdb/` | 自建库首次启动：建 `tinyship` 库、`monitoring` schema 与 `pg_stat_statements` |
| `deploy/ecs/compose.local.yml` | **只用于本机演练**：加 MinIO 冒充 OSS |
| `apps/api/Dockerfile`、`deploy/Dockerfile.workspace-app`、`deploy/Dockerfile.tools` | API、四端、工具镜像（init / 备份 / 恢复） |
| `deploy/tools/` | `init.ts`、`backup.sh`、`restore-drill.sh`、`restore.sh`、`backup-s3.ts` |

仓库根目录的 `docker-compose.yml` 是**本机开发用**（端口只绑 127.0.0.1、默认口令、灌演示数据），不要拿去上线。
`deploy/k8s/*.yaml` 是更早的样例，没有跟进本轮的跨子域会话、私有桶、init、备份改动，也从未在集群上验证过，仅供参考。

---

## 1. 上线前你要准备的东西

按顺序：

1. **地域**：推荐 **中国香港**（不用 ICP 备案，TikHub 直连 `api.tikhub.io`，Docker Hub 可直接拉）。
   选中国大陆地域时：域名必须先完成 **ICP 备案** 才能在 80/443 上访问；`.env` 里 `TIKHUB_BASE_URL=https://api.tikhub.dev`；
   Docker Hub 拉镜像不稳定，要配 ACR 镜像加速器或把基础镜像（`caddy`、`nginx`、`postgres`、`node`）推到自己的 ACR。
2. **域名**：一个父域下的五个主机名，例如 `www` / `select` / `ops` / `dev` / `api` `.example.com`。
   **建议用一个只给本系统用的父域或子域树**（如 `*.kcs.example.com`，`AUTH_COOKIE_DOMAIN=.kcs.example.com`）：
   会话 cookie 会发给这个父域下的**所有**主机，同一父域下若还有别人维护的站点，它们也能收到会话。
3. **ECS**：见 §2。
4. **（选）RDS PostgreSQL 16**：见 §8。
5. **（选）OSS**：两个私有桶 + 一个 RAM 子账号 AccessKey，见 §9。
6. **（选）证书**：用 Caddy 自动签发时不需要；想用阿里云 SSL 证书时每个主机下载一份「Nginx」格式，见 §7。
7. **密钥**：`BETTER_AUTH_SECRET`、`KCS_CURSOR_SECRET`、`POSTGRES_PASSWORD`（自建库时），各用 `openssl rand -hex 32` 生成；
   首个管理员邮箱与 ≥12 位的初始密码。
8. **（选）采集供应商**：`TIKHUB_API_KEY` 等。都不填时全部数据源是 fixture 演示模式，系统照样可用。
9. **（选）邮件**：`RESEND_API_KEY` + `EMAIL_DEFAULT_FROM`（忘记密码邮件）。

## 2. ECS

- **规格**：自建库时 4 vCPU / 8 GiB（通用型，如 g7 / g8i 系列）；用 RDS 时 2 vCPU / 4 GiB 也够，`.env` 里资源上限各项减半。
  `.env` 里的 `*_CPUS` / `*_MEMORY` 是上限，不是预留。
- **系统**：Ubuntu 22.04 / 24.04 或 Alibaba Cloud Linux 3，64 位。
- **磁盘**：系统盘 40 GiB；另挂一块 ESSD 数据盘（100 GiB 起）挂到 `/var/lib/docker`，Postgres 数据、备份卷、镜像都在上面。
  运维端「容量」页量的就是这块盘（经备份卷 `/var/backups/kcs`）。
- **公网**：绑定 EIP，按流量或固定带宽均可（`S3_READ_MODE=proxy` 时图片流量走 ECS）。
- **安全组**入方向：`80/tcp`、`443/tcp`、`443/udp`（HTTP/3，可不开）对 `0.0.0.0/0`；`22/tcp` 只对办公出口 IP。
  出方向放行（ACME 签证书、TikHub、OSS）。**Docker 发布的端口会绕过主机 ufw / firewalld，安全组才是真正的门。**

## 3. 装 Docker

装 Docker Engine 与 compose 插件（`docker compose version` ≥ 2.24）。香港地域直接按 Docker 官方文档；
大陆地域用阿里云镜像站 `https://mirrors.aliyun.com/docker-ce/` 的同名仓库。装完：

```bash
sudo systemctl enable --now docker
sudo usermod -aG docker $USER   # 重新登录后生效
docker compose version
```

## 4. DNS

五个主机名各加一条 A 记录指向 EIP。**Caddy 首次启动就会去签证书**，DNS 没生效时它会退避重试，
生效后自动成功，但最好先 `dig +short select.example.com` 确认。裸域 `example.com` 如果也要能打开，
在 DNS 服务商那里做 301 到 `www`（或把它加进 `MARKETING_HOST`，见 `.env.example` 注释）。

## 5. 代码与镜像

两种方式，任选：

**A. 在 ECS 上构建**（最简单；8 GiB 机器可以，4 GiB 容易在 Nuxt 构建时 OOM）：

```bash
sudo mkdir -p /opt/kcs && sudo chown $USER /opt/kcs
git clone <仓库地址> /opt/kcs && cd /opt/kcs/deploy/ecs
docker compose -f compose.prod.yml build
```

**B. 在别处构建，推到阿里云容器镜像服务（ACR）**，ECS 只拉：

```bash
# 构建机，仓库根目录
docker login --username=<阿里云账号> registry.cn-hongkong.aliyuncs.com
R=registry.cn-hongkong.aliyuncs.com/<命名空间>; T=2026.09.24-1
docker build -f apps/api/Dockerfile -t $R/api:$T .
docker build -f deploy/Dockerfile.tools -t $R/tools:$T .
for app in marketing select ops dev; do
  docker build -f deploy/Dockerfile.workspace-app --build-arg APP=$app -t $R/$app:$T .
done
for img in api tools marketing select ops dev; do docker push $R/$img:$T; done
# ECS：.env 里写 KCS_REGISTRY=$R、KCS_TAG=$T（同地域可用 VPC 地址 registry-vpc.cn-hongkong.aliyuncs.com，
# 以 ACR 控制台显示为准），然后
docker compose -f compose.prod.yml pull
```

五个镜像：`api`、`marketing`、`select`、`ops`、`dev`（各约 350 MB），外加 `tools`（约 2 GB，含 Postgres 16 客户端与 Node，
`init` 与 `backup` 共用）。镜像里不带任何域名、口令或连接串，换域名只改 `.env`。

下文 `dc` 指：

```bash
alias dc='docker compose -f /opt/kcs/deploy/ecs/compose.prod.yml'
```

## 6. `.env` 与首次启动

```bash
cd /opt/kcs/deploy/ecs
cp .env.example .env && chmod 600 .env
vi .env                         # 逐项填【必填】
dc config -q                    # 缺了必填项会直接报出变量名
dc up -d
dc logs -f init                 # 看到 "msg":"done" 即成功
dc ps                           # init 为 Exited (0)，其余 healthy
```

`init` 每次 `up` 都会先跑，四端 / API / 备份等它**成功退出**才启动。它做的事（可重复执行）：

1. 校验 `BETTER_AUTH_SECRET` ≥ 32 位、两个连接串带密码且指向不同的库；
2. 库不存在就建（RDS 普通账号没有建库权限时会提示去控制台建）；
3. 跑 KCS 迁移（`apps/api/src/migrations`，只进不退）；
4. 在两个库里把 `pg_stat_statements` 装进 `monitoring` schema；
5. 同步 TinyShip 身份库表结构，**若会删列 / 删表就拒绝并退出**；
6. `KCS_ADMIN_EMAIL` 这个账号不存在时创建为平台管理员（`platform_admin`）；已存在就不动。**不写任何演示数据。**

首次登录 `https://www.example.com`，用首个管理员登录后立刻改密码，然后把 `KCS_ADMIN_PASSWORD` 从 `.env` 删掉
（留着也不会覆盖已有账号）。其他人在运维端「账号」页开通。

## 7. 上线自检

```bash
# 1. 健康：db 应为 ok，version 应为 .env 里的 KCS_TAG
curl -sS https://api.example.com/api/health

# 2. http 跳 https；安全头齐全（HSTS、nosniff、X-Frame-Options DENY、CSP frame-ancestors、COOP）
curl -sI http://select.example.com/ | head -3
curl -sI https://select.example.com/en/login | grep -Ei 'strict-transport|x-frame|content-security|x-content-type'

# 3. 代理覆盖了客户端伪造的 X-Forwarded-For：同一 IP 连错 3 次后第 4 次起 429，
#    即使每次都换一个伪造的 XFF（透传的话会一直 401）
for i in 1 2 3 4 5 6; do
  curl -s -o /dev/null -w '%{http_code} ' -X POST https://select.example.com/api/auth/sign-in/email \
    -H 'content-type: application/json' -H 'origin: https://select.example.com' \
    -H "x-forwarded-for: 203.0.113.$i" -d '{"email":"nobody@example.com","password":"wrong-password-1"}'
done; echo            # 期望 401 401 401 429 429 429（换个出口 IP 或等一分钟后恢复）

# 4. 静态资源长缓存 + 预压缩
curl -sI -H 'accept-encoding: br' https://select.example.com/_nuxt/<任一文件>.js | grep -Ei 'cache-control|content-encoding'
```

浏览器里再走一遍：宣传站登录 → 自动落到本角色的工作端 → 开发者工具里 `kcs_session` 的 Domain 是 `.example.com`、
勾着 HttpOnly / Secure；运维端上传一个头像，图片地址是 `https://api.example.com/api/assets/raw/...`；
直接访问桶里的对象地址应为 403（桶私有）。接了 OSS 时再做一次 §10 的备份与恢复演练。

## 8. 证书

**Caddy（默认，`COMPOSE_PROFILES=caddy,...`）**：Let's Encrypt / ZeroSSL 自动签发与续期，需要 80、443 可达、DNS 已生效。
证书存在卷 `caddy_data` 里，别删。`ACME_EMAIL` 收到期提醒。支持 HTTP/3。

**nginx（`COMPOSE_PROFILES=nginx,...`，用阿里云 SSL 证书）**：

1. 阿里云「数字证书管理服务」为五个主机各申请 / 购买证书（或一张通配符证书复制成五份），下载「Nginx」格式；
2. 放到 `deploy/ecs/certs/`，文件名必须是 `<主机名>.pem` 与 `<主机名>.key`（如 `select.example.com.pem`），`chmod 600 *.key`；
3. `.env` 里 `COMPOSE_PROFILES=nginx,localdb`（或 `nginx`），`NGINX_CERT_DIR=./certs`；
4. `dc up -d`。续期 = 换文件后 `dc exec nginx nginx -s reload`。

nginx 版与 Caddy 版行为等价：80 → 301 https；未知 Host 在 TLS 握手阶段拒绝；同样的安全头与缓存头；
`X-Forwarded-For` / `X-Real-IP` 一律**覆盖**为 TCP 对端地址；API 请求体上限 25 MB（表格导入），四端 2 MB。
nginx 版没有 HTTP/3。

## 9. 数据库

### 自建（`localdb`，默认）

Postgres 16 跑在 compose 里，只接 `internal` 网络。数据在卷 `pgdata`。首次启动建 `kcs`（API）与 `tinyship`（身份）两个库，
预加载 `pg_stat_statements`。调参在 `.env` 的 `PG_*`（默认按 8 GiB 机器），慢查询阈值 `PG_LOG_MIN_DURATION_MS`。

### RDS PostgreSQL

1. 在**与 ECS 同地域、同 VPC** 建 RDS PostgreSQL **16**（大版本要与 tools 镜像里的 `pg_dump` 一致或更低；
   用 17 时构建 tools 镜像加 `--build-arg PG_MAJOR=17`：`dc build --build-arg PG_MAJOR=17 init`）；
2. 白名单加 ECS 的**私网 IP**（或安全组）；
3. 控制台建普通账号 `kcs`，建库 `kcs` 与 `tinyship`，属主都是 `kcs`；
4. 参数设置里确认 `shared_preload_libraries` 含 `pg_stat_statements`（改了要重启实例）；
5. `.env`：`COMPOSE_PROFILES` 去掉 `localdb`；填 `KCS_DATABASE_URL` / `IDENTITY_DATABASE_URL`（内网地址），
   `POSTGRES_PASSWORD` 留空；容量页改为 `KCS_CAPACITY_DATA_PATH=`（空）、`KCS_CAPACITY_DISK_BYTES=<RDS 存储字节数>`；
6. **SSL**：同 VPC 内网可以不开。要开时：RDS 控制台开启 SSL 并下载 CA，放到 ECS 上（如 `/opt/kcs/deploy/ecs/rds-ca.pem`），
   `.env` 写 `PG_CA_FILE=./rds-ca.pem`，两个连接串末尾加 `?sslmode=verify-full&sslrootcert=/etc/kcs/pg-ca.pem`
   （API、四端、init、备份都挂载了这个文件）。**不要写 `sslmode=require`**：Node 的 pg 驱动把它当 `verify-full`，
   又不认 RDS 的 CA，会连不上。受保护地址（证书里的主机名）要和连接串里的主机名一致。
7. 首次 `up` 后看 `dc logs init`：若提示 `pg_stat_statements unavailable`，用高权限账号在两个库各执行一次
   `CREATE SCHEMA IF NOT EXISTS monitoring; CREATE EXTENSION IF NOT EXISTS pg_stat_statements SCHEMA monitoring;`

RDS 自带的自动备份照开；本系统的每日 `pg_dump`（§11）是第二份、可跨实例恢复的逻辑备份。

### 慢查询

```bash
dc exec postgres psql -U kcs -d kcs -c "SELECT calls, round(mean_exec_time) AS ms, left(query, 120) FROM monitoring.pg_stat_statements ORDER BY total_exec_time DESC LIMIT 20"
```

（RDS 用任一 psql 客户端连进去执行同一句。）注意是 `monitoring.pg_stat_statements`，不在 `public` 里。

## 10. 对象存储（OSS）

不接 OSS 时图片字节存进 Postgres，备份只留在 ECS 磁盘上——能用，但磁盘坏了就全没了。正式上线建议接。

1. 与 ECS **同地域**建两个桶，读写权限都选**私有**，例如 `kcs-assets`（图片、表格导入原件 `batches/`）、`kcs-backups`（备份）；
2. `kcs-backups` 加一条生命周期规则：前缀 `backups/`，**15 天**后删除（比 `BACKUP_RETENTION_DAYS=14` 多一天，兜底）；
3. RAM 控制台建子用户（只开 OpenAPI 调用），生成 AccessKey，授权自定义策略：

```json
{
  "Version": "1",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["oss:PutObject", "oss:GetObject", "oss:DeleteObject"],
      "Resource": ["acs:oss:*:*:kcs-assets/*", "acs:oss:*:*:kcs-backups/*"]
    },
    {
      "Effect": "Allow",
      "Action": ["oss:ListObjects"],
      "Resource": ["acs:oss:*:*:kcs-backups"]
    }
  ]
}
```

4. `.env`：

```ini
S3_ENDPOINT=https://oss-cn-hongkong-internal.aliyuncs.com   # 同地域内网 endpoint，不收流量费
S3_REGION=oss-cn-hongkong
S3_BUCKET=kcs-assets
S3_ACCESS_KEY=<AccessKey ID>
S3_SECRET_KEY=<AccessKey Secret>
S3_FORCE_PATH_STYLE=false        # OSS 只认虚拟主机风格
S3_READ_MODE=proxy
BACKUP_S3_BUCKET=kcs-backups
```

   走的是 OSS 的 S3 兼容接口（已关掉 SDK 默认的 CRC32 校验尾，OSS 不认）。endpoint / region 的写法**以 OSS「S3 兼容」文档为准**，
   上线后用下面第 5 步验一次。大陆地域把 `cn-hongkong` 换成对应 Region ID。
5. 验证：

```bash
dc exec backup /repo/deploy/tools/entrypoint.sh backup          # 应看到 uploaded ×4 与 done
dc exec backup /repo/deploy/tools/entrypoint.sh backup-s3 list  # 列出刚才的时间戳
```

   再在运维端上传一个头像，能显示即图片桶可写可读。

**读图的两种方式**：`S3_READ_MODE=proxy`（默认）由 API 取字节再发给浏览器，响应头由 API 控制（`nosniff`、CSP、按字节重判类型）；
`S3_READ_MODE=redirect` 时 API 302 到 5 分钟有效的签名链接，省 ECS 流量，此时必须设 `S3_PUBLIC_ENDPOINT=https://oss-cn-hongkong.aliyuncs.com`
（外网 endpoint，只用来签名；API 自己仍走内网）。上传一律经 API（`PUT /api/assets/upload/<key>?token=…`，
15 分钟有效、一次性、≤ 5 MB、按字节判类型），浏览器从不直连桶。

## 11. 备份与恢复

`backup` 服务每天 `BACKUP_HOUR` 点（`TZ` 时区）：

1. `pg_dump -Fc` 两个库（`kcs.dump`、`identity.dump`），逐个 `pg_restore --list` 读回校验，写 `SHA256SUMS` 与 `manifest.json`；
2. 放到卷 `backups` 下 `/var/backups/kcs/<UTC 时间戳>/`，`LATEST` 指向最新；
3. 设了 `BACKUP_S3_BUCKET` 时上传到 `<桶>/<BACKUP_S3_PREFIX><时间戳>/`；
4. 本地与远端都删掉早于 `BACKUP_RETENTION_DAYS`（默认 14）天的，**远端最新一份永远不删**。

失败后每 60 分钟重试，直到成功；日志都是一行一个 JSON：`dc logs backup`（失败时有 `"msg":"backup failed, retrying later"`）。
首次上线可设 `BACKUP_ON_START=1` 让它一启动先备份一次，验证完改回 0。运维端「容量」页的备份占用量的就是这个卷。

```bash
# 立刻备份一次
dc exec backup /repo/deploy/tools/entrypoint.sh backup

# 恢复演练（不碰线上库）：把备份恢复进临时库 kcs_drill / tinyship_drill，比对关键表行数，报耗时，再删掉临时库
dc exec backup /repo/deploy/tools/entrypoint.sh restore-drill            # 最新的本地备份
dc exec backup /repo/deploy/tools/entrypoint.sh restore-drill latest --from-s3   # 从 OSS 拉最新一份（模拟整机丢失）
dc exec -e DRILL_KEEP=1 backup /repo/deploy/tools/entrypoint.sh restore-drill 20260924T030000Z   # 指定一份并保留临时库
```

演练需要建库权限：自建库没问题；RDS 普通账号没有，临时用高权限账号的连接串覆盖
（`dc exec -e KCS_DATABASE_URL=… -e IDENTITY_DATABASE_URL=… backup …`），或用 RDS 控制台「恢复到新实例」演练。
**建议每月做一次，并在上线当天做一次。**

**正式恢复**（覆盖线上两个库；先对同一份备份做过演练）：

```bash
dc stop api api-worker marketing select ops dev backup
dc run --rm --no-deps -e RESTORE_CONFIRM=<时间戳> backup restore <时间戳>            # 本地有这份
dc run --rm --no-deps -e RESTORE_CONFIRM=<时间戳> backup restore <时间戳> --from-s3  # 从 OSS 拉
dc up -d      # init 会把恢复出来的库补迁移到当前版本
```

`RESTORE_CONFIRM` 与参数不一致时直接退出、不动库。每个库在一个事务里恢复，中途出错整库回滚。
恢复后所有人的会话随身份库回到备份时刻，需要重新登录的属正常。

## 12. 升级与回滚

```bash
dc exec backup /repo/deploy/tools/entrypoint.sh backup     # 升级前手动备份一次
vi .env                                                     # KCS_TAG=<新版本>
dc pull        # 或 dc build（方式 A）
dc up -d       # init 先跑迁移；成功后才换 API 与四端
curl -sS https://api.example.com/api/health                 # version 应为新 KCS_TAG
```

**回滚**：迁移只进不退。新版本只是加表 / 加列时（绝大多数情况），把 `KCS_TAG` 改回旧值再 `dc up -d` 即可。
如果新版本改了身份库表结构，旧版 init 会因「要删列」拒绝启动——这种情况回滚 = 旧 `KCS_TAG` + 用升级前那份备份做 §11 的正式恢复。
改了选人池推导逻辑的版本，发版说明会要求上线时设一次 `KCS_PUBLISHED_FULL_REFRESH=1`（见 `docs/HANDOFF.md`）。

## 13. 运维速查

```bash
dc ps                                   # 状态
dc logs -f --tail=200 api               # API 日志（每请求一行 JSON，LOG_REQUESTS=0 关）
dc logs caddy | tail                    # 访问日志（JSON）
dc restart select                       # 重启单个服务
dc exec postgres psql -U kcs -d kcs     # 进自建库
```

- 日志轮转：每个容器 `LOG_MAX_SIZE` × `LOG_MAX_FILE`（默认 20 MB × 5）。
- 抓取压力大时拆出独立进程：`.env` 里 `API_INGEST_WORKER=0`，`COMPOSE_PROFILES` 加 `split-worker`，`dc up -d`。
- 改 `.env` 后 `dc up -d` 只会重建受影响的容器。
- 每日任务（刷新、分层、TikHub 余额）在 `DAILY_TASKS_HOUR` 点（`DAILY_TASKS_TZ`）。

## 14. 前面还有 SLB / CDN 时

代理把 `X-Forwarded-For` **覆盖**为 TCP 对端地址，所以前面再挂一层负载均衡时，登录限速会把所有人当成 SLB 的 IP。
最简单的做法是 SLB 用 **TCP（四层）监听** 透传 443，并开启「获取客户端真实 IP」的 Proxy Protocol——这需要改代理配置，
本仓库未提供、未验证。若用七层监听，按下面改，且只信任 SLB / CDN 的回源网段：

- Caddy：全局块加 `servers { trusted_proxies static <网段…> }`，并把 `(upstream)` 里的 `{remote_host}` 换成 `{client_ip}`；
- nginx：`kcs.conf.template` 顶部加 `set_real_ip_from <网段>;` 与 `real_ip_header X-Forwarded-For;`，其余不动
  （`$remote_addr` 会变成真实客户端，继续用它覆盖 XFF）。

## 15. 本机演练（生产配置）

在一台有 Docker 的开发机上，用占位域名把整条链路跑一遍（本仓库这次上线前就是这样验的）：

```bash
cd deploy/ecs
cp .env.example .env.local && chmod 600 .env.local
# .env.local 里至少改：
#   CADDY_EXTRA_GLOBAL=local_certs      Caddy 内部 CA 签证书
#   HTTP_PORT=8080  HTTPS_PORT=8443  PUBLIC_PORT_SUFFIX=:8443
#   HSTS_VALUE=max-age=60
#   S3_BUCKET=kcs-assets  BACKUP_S3_BUCKET=kcs-backups  LOCAL_MINIO_PASSWORD=<随机>
#   以及 BETTER_AUTH_SECRET / KCS_CURSOR_SECRET / POSTGRES_PASSWORD / KCS_ADMIN_PASSWORD
echo '127.0.0.1 www.example.com select.example.com ops.example.com dev.example.com api.example.com' | sudo tee -a /etc/hosts
docker compose -f compose.prod.yml -f compose.local.yml --env-file .env.local up -d --build
docker compose -f compose.prod.yml -f compose.local.yml --env-file .env.local cp caddy:/data/caddy/pki/authorities/local/root.crt ./caddy-root.crt
curl --cacert ./caddy-root.crt https://api.example.com:8443/api/health
```

浏览器打开 `https://www.example.com:8443`（信任 `caddy-root.crt`，或临时忽略证书错误）。`compose.local.yml` 加了 MinIO 当 OSS
（两个私有桶），API 与备份指向它；其余与生产完全相同。`.env.local` 已在 `.gitignore` 里。用完删掉 `/etc/hosts` 那一行，
`docker compose … down -v` 清掉卷。

## 16. 已知限制

- 单机：ECS 宕机期间全站不可用；数据安全靠 §11 的每日备份（RPO ≤ 24 小时）+ RDS 自动备份（若用 RDS）。
- 真实 OSS、RDS、阿里云 SSL 证书、ACR 这次都**没有**实连验证：OSS 用 MinIO 替身、RDS 的 SSL 用本地自签 CA 的 Postgres 替身、
  证书用 Caddy 内部 CA 与自签证书验过。上线时按 §7、§10 的自检各跑一遍。
- `S3_READ_MODE=redirect` 只有单元测试，没有对真实 OSS 验证签名链接。
- Kafka / Redpanda：抓取任务队列在 Postgres 里（顾问锁 + 租约），不需要消息队列。
