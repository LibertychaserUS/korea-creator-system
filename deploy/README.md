# 听潮部署配置

## 四端镜像

四个 Nuxt workspace 共用 `deploy/Dockerfile.workspace-app`。从仓库根目录构建：

```bash
for app in marketing ops dev select; do
  docker build \
    -f deploy/Dockerfile.workspace-app \
    --build-arg "APP=${app}" \
    -t "kcs-${app}:local" .
done
```

## Kubernetes

`deploy/k8s/workspace-apps.yaml` 提供四端的 Deployment、Service 和共享公开环境变量。
`deploy/k8s/web.yaml` 保留 7001 遗留端。四端容器读取：

| 变量 | 来源 | 说明 |
| --- | --- | --- |
| `NITRO_PORT` | Deployment env | 每端监听端口（7000 / 7002 / 7003 / 7004） |
| `NUXT_PUBLIC_API_BASE`、`NUXT_PUBLIC_{MARKETING,OPS,DEV,SELECT}_URL` | ConfigMap `workspace-app-env` | 运行期覆盖 Nuxt public runtimeConfig。**`KCS_*_URL` 只在 build 时生效**，镜像里已固化为 localhost，运行期改它没用 |
| `DATABASE_URL`、`BETTER_AUTH_SECRET` | Secret `kcs-web` | 面板自己的库（会话 / 用户），与 API 的 `kcs` 库分开；样例在 `secret.example.yaml` |

应用清单顺序如下：

```bash
kubectl apply -f deploy/k8s/namespace.yaml
kubectl apply -f deploy/k8s/rbac.yaml
kubectl apply -f deploy/k8s/secret.example.yaml   # 改掉 change-me 后再 apply
kubectl apply -f deploy/k8s/workspace-apps.yaml
kubectl apply -f deploy/k8s/api.yaml
kubectl apply -f deploy/k8s/web.yaml
kubectl apply -f deploy/k8s/ingress.yaml
```

现有示例域名约定：

| 服务 | 域名 |
| --- | --- |
| marketing + `/api` | `kcs.example.com` |
| ops | `ops.kcs.example.com` |
| dev | `dev.kcs.example.com` |
| select | `select.kcs.example.com` |
| legacy | `legacy.kcs.example.com` |

上线前需统一替换 `deploy/k8s/api.yaml`、`deploy/k8s/workspace-apps.yaml`、
`deploy/k8s/ingress.yaml` 和 `deploy/nginx/kcs.conf` 中的示例域名，并由集群外部配置 DNS 与 TLS。

## docker-compose

`docker compose --profile full up --build` 会连同 API、遗留 web 一起把四端起在 7000 / 7002 / 7003 / 7004；
四端面板库走容器内 sqlite（`/data/panel.sqlite`，各自一个卷），API 仍用 Postgres。

## 未验证

本轮没有可用的 Docker / 集群环境，以下只做了 YAML 语法校验，没有真正跑过：
镜像构建（`pnpm install --filter` + 原生依赖 better-sqlite3 在容器内的安装）、K8s 清单 apply、nginx 配置 reload。

## 独立 nginx

`deploy/nginx/kcs.conf` 可放入 nginx 的 `http` 上下文（通常为 `conf.d/`），反代宿主机
7000–7004 与 7100 端口。该配置假设 TLS 在上游负载均衡器终止；若 nginx 自行终止 TLS，
需另外配置证书和 443 listener。

## Kafka / Redpanda

当前 API 的 ingest job 仍在请求进程内执行。队列 topic、投递幂等键、消费者重试和状态回写
协议尚未确定，因此这里不声明一个无法被应用消费的 Kafka/Redpanda 服务。
