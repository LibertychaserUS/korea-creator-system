# AWS CloudShell：一次性 OIDC 引导

当前受支持的上线方式仍是 [`deploy/ecs/`](../ecs/) 里的阿里云 ECS。本目录不替换那套方案，这里也还没有把系统部署到 AWS。

这一步只在你的 AWS 账号里准备 GitHub Actions 要用的 IAM 身份：OIDC 提供方 `https://token.actions.githubusercontent.com`（受众 `sts.amazonaws.com`）和角色 `kcs-github-deploy`。脚本不创建 Lightsail 容器服务、数据库、S3 桶、ECR 仓库，也不申请证书或公网地址。IAM 角色和 OIDC 提供方不按个数计费。请不要在这一步去控制台新建那些资源。

## 1. 打开 CloudShell

1. 用有 IAM 写入权限的身份登录 AWS 控制台。
2. 点顶栏的 CloudShell，等到出现 shell 提示符。当前区域选哪个都可以：脚本只写全局 IAM，不写区域资源。
3. 不要把私钥、访问密钥或证书贴进终端。脚本不接受参数。

## 2. 粘贴

打开 `deploy/aws/cloudshell-oidc-bootstrap.sh`，从第一行到最后一行整段复制，贴进 CloudShell，回车。

可以重复运行。提供方或角色已经存在时，脚本会就地更新，不会另建一份。

## 3. 跑完会看到什么

成功时末尾有一段「请整段贴回对话」，里面是账号 ID、角色 ARN、变量名 `AWS_ROLE_ARN`、建议区域 `ap-northeast-2`（首尔）。前面还会打印当前调用身份，方便你确认跑在哪个账号上。

失败时以「错误：」开头，并带上 AWS CLI 的原文。脚本不会打印密钥。

## 4. 把哪几行贴回来

贴回「请整段贴回对话」和「以上结束」之间的四行：

- 账号 ID
- 角色 ARN
- GitHub Actions 变量名
- 建议区域

先不要创建 Lightsail、数据库或 S3。

## 5. 下一步（还不是部署）

1. 打开 GitHub 仓库 Settings → Secrets and variables → Actions → Variables，新建变量 `AWS_ROLE_ARN`，值填角色 ARN。这是变量，不是 Secret，也不要新建 IAM 访问密钥。
2. 在 **main** 上手动运行工作流「AWS OIDC 冒烟」。它只执行 `aws sts get-caller-identity`，不部署应用，也不创建资源。
3. 看到身份输出之后，再决定要不要在首尔（`ap-northeast-2`）创建 Lightsail、数据库和私有 S3。那一步不在本脚本里。

信任策略只接受这个仓库的两条主体：`main` 分支，以及名为 `production` 的 GitHub Environment。仓库创建于 2026-09-12，GitHub 签发的是带不可变 ID 的主体（`repo:LibertychaserUS@209117731/korea-creator-system@1367189203:...`），不是只写仓库名的旧格式。冒烟工作流不声明 Environment，所以必须在 main 上跑。`production` 那条留给以后的部署，并建议先给这个 Environment 加上保护规则。
