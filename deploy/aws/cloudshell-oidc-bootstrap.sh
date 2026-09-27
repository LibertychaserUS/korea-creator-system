#!/usr/bin/env bash
# 全球达人情报系统 — AWS CloudShell 一次性引导（只写 IAM，不创建付费资源）
#
# 用法：整段粘贴进 CloudShell 后回车。不要传参数，不要把私钥、访问密钥或证书贴进来。
# 可以重复运行：OIDC 提供方或角色已存在就更新，不另建一份。
#
# 编写时已用 git remote origin 核对仓库为 LibertychaserUS/korea-creator-system
# （https://github.com/LibertychaserUS/korea-creator-system）。若当前目录有 origin，
# 脚本会再核对一次，且不会打印原始 URL（避免 remote 里嵌了凭证）。
# CloudShell 家目录通常没有克隆，这时使用下面写死的、已经核对过的仓库。
#
# 主体（sub）不用 repo:LibertychaserUS/korea-creator-system:... 这种只含名字的旧格式。
# 2026-09-26 查询 GitHub：
#   created_at = 2026-09-12（晚于 2026-07-15 的不可变主体生效日）
#   GET /repos/LibertychaserUS/korea-creator-system/actions/oidc/customization/sub
#   → use_default=true, use_immutable_subject=true
#   → sub_claim_prefix=repo:LibertychaserUS@209117731/korea-creator-system@1367189203
# 官方说明（GitHub Changelog 2026-04-23，2026-06-10 起分隔符为 @；
# docs.github.com OpenID Connect reference）：2026-07-15 之后新建的仓库，
# 默认 sub 是 repo:OWNER@OWNER-ID/REPO@REPO-ID:ref:... 或 :environment:...。
# 再信任不带 ID 的旧主体，会把「仓库改名后被别人占用同名」的洞重新打开，所以这里不写。
# 两条都是精确相等，没有 repo:* 。
#   repo:LibertychaserUS@209117731/korea-creator-system@1367189203:ref:refs/heads/main
#   repo:LibertychaserUS@209117731/korea-creator-system@1367189203:environment:production
# aud 固定 sts.amazonaws.com。
#
# Thumbprint（2026-09 核对，以 AWS 现行文档为准）：
#   IAM CreateOpenIDConnectProvider：AWS 用受信根 CA 校验 OIDC 的 JWKS TLS 证书。
#   只有 IdP 证书不是这些受信 CA 签发时，才回退到配置里的 thumbprint。
#   ThumbprintList 可选；省略时 IAM 自己取顶层中间 CA 的指纹。
#   https://docs.aws.amazon.com/IAM/latest/APIReference/API_CreateOpenIDConnectProvider.html
#   GitHub Changelog 2023-07-13：github.com 上的 Actions OIDC 不再需要钉死中间证书。
# 下面两枚仍是更换根 CA 校验之前，GitHub Actions / AWS 示例里长期列出的 SHA-1，
# 任务要求至少带上。它们不再参与 token.actions.githubusercontent.com 的证书校验，
# 但 API 接受（最多 5 枚）。本脚本幂等写入这两枚，不从网上现算指纹，也不覆盖成别的值
# 除非现有列表里缺了其中一枚（缺了就取并集；超过 5 枚则失败）。
#   6938fd4d98bab03faadb97b34396831e3780aea1
#   1c58a3a8518e8759bf075b76b750d4f2df264fcd
#
# 权限对齐 deploy/ecs/compose.prod.yml 与 .env.example，不替代现有阿里云 ECS 方案：
#   容器：marketing、select、ops、dev、api，外加反代（Caddy 或 nginx）和 tools
#         （init / 备份）。镜像仓库名用 kcs-api、kcs-marketing、kcs-select、kcs-ops、
#         kcs-dev、kcs-tools 这类 kcs-* 。先推 ECR，再经
#         CreateContainerServiceRegistryLogin 推进 Lightsail 自己的镜像仓库
#         （Lightsail 容器服务不直接拉私有 ECR），然后 CreateContainerServiceDeployment。
#   Postgres：Lightsail 关系数据库，对应 compose 的 localdb / RDS。本角色不能读主密码，
#         避免工作流把口令打出来；以后的口令放 GitHub Environment secret。
#   对象存储：私有 S3，桶名 kcs-*（对应现在的 kcs-assets、kcs-backups），不是 Lightsail 桶。
# 没有 AdministratorAccess，也没有 iam:CreateUser / iam:CreateAccessKey / organizations:* / account:*
# （这四项是显式 Deny）。
#
# Lightsail 为什么是 Resource "*"：
#   AWS 文档写明，一部分 Lightsail API 不支持资源级权限，Resource 只能是 "*"
#   （https://docs.aws.amazon.com/lightsail/latest/userguide/security_iam_service-with-iam.html）。
#   支持资源级权限的动作，ARN 后缀也是创建后才有的 UUID，不是资源名字
#   （用户指南示例 Instance/244ad76f-...），所以写不出 kcs-* 这种名字前缀。
#   Lightsail 没有按资源名限制的条件键。这里只列出容器服务、证书（五个主机名）、
#   关系数据库和异步操作查询，不用 lightsail:*；并用 aws:RequestedRegion=ap-northeast-2
#   把这些调用限制在首尔。名字仍约定以 kcs- 开头，IAM 表达不了这条，靠以后的部署脚本遵守。
# ECR GetAuthorizationToken 官方不支持资源级权限，所以这一条单独是 Resource "*"，
#   区域同样限制在 ap-northeast-2。其余 ECR 动作限制在 repository/kcs-*。
# S3 没有用 "*"：桶 arn:aws:s3:::kcs-* ，对象 arn:aws:s3:::kcs-*/* 。
#   不授予 PutBucketAcl / PutObjectAcl。
#
# 本脚本不调用 lightsail / s3 / ecr / rds 的创建 API，不打印密钥，不创建区域资源。
# IAM 是全局的。建议以后的区域资源放在 ap-northeast-2，但那一步不要现在做。

set +x
set -euo pipefail
umask 077
export AWS_PAGER=""

die() {
  printf '错误：%s\n' "$*" >&2
  exit 1
}

if [[ "$#" -ne 0 ]]; then
  die "此脚本不接受任何参数，也不会读取私钥、访问密钥或证书。请整段粘贴后直接回车。"
fi

for cmd in aws jq python3; do
  command -v "$cmd" >/dev/null 2>&1 || die "找不到命令 ${cmd}。请在 AWS CloudShell 里运行本脚本。"
done

GITHUB_OWNER="LibertychaserUS"
GITHUB_REPO="korea-creator-system"
GITHUB_OWNER_ID="209117731"
GITHUB_REPO_ID="1367189203"
ROLE_NAME="kcs-github-deploy"
POLICY_NAME="kcs-deploy"
OIDC_URL="https://token.actions.githubusercontent.com"
OIDC_HOST="token.actions.githubusercontent.com"
OIDC_CLIENT="sts.amazonaws.com"
TP1="6938fd4d98bab03faadb97b34396831e3780aea1"
TP2="1c58a3a8518e8759bf075b76b750d4f2df264fcd"
AWS_REGION_SUGGESTED="ap-northeast-2"

[[ "$GITHUB_OWNER_ID" =~ ^[0-9]+$ && "$GITHUB_REPO_ID" =~ ^[0-9]+$ ]] || die "仓库 ID 常量不是数字。"
[[ "$TP1" =~ ^[0-9a-f]{40}$ && "$TP2" =~ ^[0-9a-f]{40}$ ]] || die "thumbprint 常量格式不对。"

SUB_PREFIX="repo:${GITHUB_OWNER}@${GITHUB_OWNER_ID}/${GITHUB_REPO}@${GITHUB_REPO_ID}"
SUB_MAIN="${SUB_PREFIX}:ref:refs/heads/main"
SUB_PRODUCTION="${SUB_PREFIX}:environment:production"
case "${SUB_MAIN}${SUB_PRODUCTION}" in
  *'*'*) die "信任主体里出现了通配符，已中止。" ;;
esac

confirm_git_remote() {
  local url slug
  if ! url="$(git remote get-url origin 2>/dev/null)"; then
    printf '当前目录没有 git origin，使用已核对的仓库 %s/%s。\n' "$GITHUB_OWNER" "$GITHUB_REPO"
    return 0
  fi
  url="${url#*://}"
  url="${url#*@}"
  url="${url%.git}"
  url="${url%/}"
  if [[ "$url" =~ github.com[:/]([^/]+)/([^/]+)$ ]]; then
    slug="${BASH_REMATCH[1]}/${BASH_REMATCH[2]}"
  else
    die "origin 不是 GitHub 仓库地址，无法确认 owner/repo。本脚本不打印原始 remote，以免带上凭证。"
  fi
  if [[ "$slug" != "${GITHUB_OWNER}/${GITHUB_REPO}" ]]; then
    die "origin 指向 ${slug}，与本脚本锁定的 ${GITHUB_OWNER}/${GITHUB_REPO} 不一致。"
  fi
  printf '已用 git remote origin 核对仓库：%s。\n' "$slug"
}

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

capture_aws() {
  local desc="$1"
  shift
  local err out
  err="$(mktemp)"
  if ! out="$(aws "$@" 2>"$err")"; then
    cat "$err" >&2 || true
    rm -f "$err"
    die "$desc"
  fi
  rm -f "$err"
  printf '%s\n' "$out"
}

retry_iam() {
  local desc="$1"
  shift
  local i err
  err="$(mktemp)"
  for i in 1 2 3 4 5; do
    if aws "$@" >"$WORKDIR/retry-out.json" 2>"$err"; then
      rm -f "$err"
      return 0
    fi
    if grep -Eq 'NoSuchEntity|NotFound' "$err" && [[ "$i" -lt 5 ]]; then
      sleep "$i"
      continue
    fi
    cat "$err" >&2 || true
    rm -f "$err"
    die "$desc"
  done
}

confirm_git_remote

printf '正在确认当前调用身份……\n'
identity="$(capture_aws "sts get-caller-identity 失败。请确认 CloudShell 已登录，且没有把密钥贴进命令。" sts get-caller-identity --output json)"
ACCOUNT_ID="$(jq -er '.Account' <<<"$identity")" || die "sts 返回里没有 Account。"
CALLER_ARN="$(jq -er '.Arn' <<<"$identity")" || die "sts 返回里没有 Arn。"
[[ "$ACCOUNT_ID" =~ ^[0-9]{12}$ ]] || die "账号 ID 不是 12 位数字：${ACCOUNT_ID}"
printf '当前调用身份：%s\n' "$CALLER_ARN"
printf '账号 ID：%s\n' "$ACCOUNT_ID"
case "$CALLER_ARN" in
  *:root) printf '注意：当前是根用户。脚本仍只改 IAM，但根用户权限过大，用完请退出。\n' ;;
esac

PROVIDER_ARN="arn:aws:iam::${ACCOUNT_ID}:oidc-provider/${OIDC_HOST}"
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

ensure_oidc() {
  local err json thumbs client joined count
  err="$(mktemp)"
  if json="$(aws iam get-open-id-connect-provider --open-id-connect-provider-arn "$PROVIDER_ARN" --output json 2>"$err")"; then
    rm -f "$err"
    local url
    url="$(jq -er '.Url' <<<"$json")" || die "读不到已有 OIDC 提供方的 Url。"
    [[ "$url" == "$OIDC_URL" || "$url" == "$OIDC_HOST" ]] || die "已有 OIDC 提供方 URL 是 ${url}，不是 ${OIDC_URL}。请人工检查，本脚本不会改掉别的提供方。"
    thumbs="$(jq -r '.ThumbprintList[]? | ascii_downcase' <<<"$json" | sort -u)"
    client="$(jq -r '.ClientIDList[]?' <<<"$json")"
    local need_tp=0
    grep -qx "$TP1" <<<"$thumbs" || need_tp=1
    grep -qx "$TP2" <<<"$thumbs" || need_tp=1
    if [[ "$need_tp" -eq 0 ]]; then
      printf 'OIDC 提供方已存在，且两枚 thumbprint 都在，跳过指纹更新。\n'
    else
      joined="$(printf '%s\n%s\n%s\n' "$thumbs" "$TP1" "$TP2" | awk 'NF && !seen[$0]++')"
      count="$(wc -l <<<"$joined" | tr -d ' ')"
      [[ "$count" -le 5 ]] || die "OIDC thumbprint 并集有 ${count} 枚，超过 IAM 上限 5。请人工清理后再运行。"
      local -a tp_args=()
      local tp
      while IFS= read -r tp; do
        [[ -n "$tp" ]] && tp_args+=("$tp")
      done <<<"$joined"
      retry_iam "更新 OIDC thumbprint 失败。" \
        iam update-open-id-connect-provider-thumbprint \
        --open-id-connect-provider-arn "$PROVIDER_ARN" \
        --thumbprint-list "${tp_args[@]}"
      printf 'OIDC 提供方已存在，已补上缺失的 thumbprint。\n'
    fi
    if grep -qx "$OIDC_CLIENT" <<<"$client"; then
      printf 'OIDC 客户端 %s 已在列表中。\n' "$OIDC_CLIENT"
    else
      aws iam add-client-id-to-open-id-connect-provider \
        --open-id-connect-provider-arn "$PROVIDER_ARN" \
        --client-id "$OIDC_CLIENT" \
        >/dev/null \
        || die "为 OIDC 提供方添加客户端 ${OIDC_CLIENT} 失败。"
      printf '已为 OIDC 提供方添加客户端 %s。\n' "$OIDC_CLIENT"
    fi
    return 0
  fi
  if grep -q 'NoSuchEntity' "$err"; then
    rm -f "$err"
    if ! retry_iam "创建 OIDC 提供方失败。" \
      iam create-open-id-connect-provider \
      --url "$OIDC_URL" \
      --client-id-list "$OIDC_CLIENT" \
      --thumbprint-list "$TP1" "$TP2"; then
      die "创建 OIDC 提供方失败。"
    fi
    printf '已创建 OIDC 提供方 %s。\n' "$PROVIDER_ARN"
    return 0
  fi
  cat "$err" >&2 || true
  rm -f "$err"
  die "查询 OIDC 提供方失败。"
}

write_policies() {
  cat >"$WORKDIR/trust.json" <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "GitHubActionsThisRepoOnly",
      "Effect": "Allow",
      "Principal": {
        "Federated": "${PROVIDER_ARN}"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": [
            "${SUB_MAIN}",
            "${SUB_PRODUCTION}"
          ]
        }
      }
    }
  ]
}
EOF

  cat >"$WORKDIR/perm.json" <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyIdentityAndOrgTakeover",
      "Effect": "Deny",
      "Action": [
        "iam:CreateUser",
        "iam:CreateAccessKey",
        "organizations:*",
        "account:*"
      ],
      "Resource": "*"
    },
    {
      "Sid": "LightsailContainerDatabaseSeoul",
      "Effect": "Allow",
      "Action": [
        "lightsail:CreateContainerService",
        "lightsail:UpdateContainerService",
        "lightsail:DeleteContainerService",
        "lightsail:CreateContainerServiceDeployment",
        "lightsail:CreateContainerServiceRegistryLogin",
        "lightsail:RegisterContainerImage",
        "lightsail:DeleteContainerImage",
        "lightsail:GetContainerServices",
        "lightsail:GetContainerServiceDeployments",
        "lightsail:GetContainerServicePowers",
        "lightsail:GetContainerServiceMetricData",
        "lightsail:GetContainerImages",
        "lightsail:GetContainerLog",
        "lightsail:GetContainerAPIMetadata",
        "lightsail:CreateCertificate",
        "lightsail:DeleteCertificate",
        "lightsail:GetCertificates",
        "lightsail:CreateRelationalDatabase",
        "lightsail:UpdateRelationalDatabase",
        "lightsail:DeleteRelationalDatabase",
        "lightsail:RebootRelationalDatabase",
        "lightsail:StartRelationalDatabase",
        "lightsail:StopRelationalDatabase",
        "lightsail:UpdateRelationalDatabaseParameters",
        "lightsail:CreateRelationalDatabaseSnapshot",
        "lightsail:DeleteRelationalDatabaseSnapshot",
        "lightsail:CreateRelationalDatabaseFromSnapshot",
        "lightsail:GetRelationalDatabase",
        "lightsail:GetRelationalDatabases",
        "lightsail:GetRelationalDatabaseBlueprints",
        "lightsail:GetRelationalDatabaseBundles",
        "lightsail:GetRelationalDatabaseParameters",
        "lightsail:GetRelationalDatabaseEvents",
        "lightsail:GetRelationalDatabaseLogEvents",
        "lightsail:GetRelationalDatabaseLogStreams",
        "lightsail:GetRelationalDatabaseMetricData",
        "lightsail:GetRelationalDatabaseSnapshot",
        "lightsail:GetRelationalDatabaseSnapshots",
        "lightsail:GetOperation",
        "lightsail:GetOperations",
        "lightsail:GetOperationsForResource",
        "lightsail:GetActiveNames",
        "lightsail:GetRegions",
        "lightsail:TagResource",
        "lightsail:UntagResource"
      ],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "aws:RequestedRegion": "${AWS_REGION_SUGGESTED}"
        }
      }
    },
    {
      "Sid": "EcrAuthTokenSeoul",
      "Effect": "Allow",
      "Action": "ecr:GetAuthorizationToken",
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "aws:RequestedRegion": "${AWS_REGION_SUGGESTED}"
        }
      }
    },
    {
      "Sid": "EcrKcsRepositories",
      "Effect": "Allow",
      "Action": [
        "ecr:CreateRepository",
        "ecr:DeleteRepository",
        "ecr:DescribeRepositories",
        "ecr:ListTagsForResource",
        "ecr:TagResource",
        "ecr:PutImage",
        "ecr:BatchCheckLayerAvailability",
        "ecr:CompleteLayerUpload",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:BatchGetImage",
        "ecr:GetDownloadUrlForLayer",
        "ecr:DescribeImages",
        "ecr:ListImages",
        "ecr:BatchDeleteImage",
        "ecr:PutLifecyclePolicy",
        "ecr:GetLifecyclePolicy",
        "ecr:PutImageScanningConfiguration"
      ],
      "Resource": "arn:aws:ecr:${AWS_REGION_SUGGESTED}:${ACCOUNT_ID}:repository/kcs-*"
    },
    {
      "Sid": "S3KcsBuckets",
      "Effect": "Allow",
      "Action": [
        "s3:CreateBucket",
        "s3:DeleteBucket",
        "s3:ListBucket",
        "s3:ListBucketVersions",
        "s3:ListBucketMultipartUploads",
        "s3:GetBucketLocation",
        "s3:GetBucketVersioning",
        "s3:PutBucketVersioning",
        "s3:GetEncryptionConfiguration",
        "s3:PutEncryptionConfiguration",
        "s3:GetBucketPublicAccessBlock",
        "s3:PutBucketPublicAccessBlock",
        "s3:GetLifecycleConfiguration",
        "s3:PutLifecycleConfiguration",
        "s3:GetBucketTagging",
        "s3:PutBucketTagging",
        "s3:GetBucketOwnershipControls",
        "s3:PutBucketOwnershipControls",
        "s3:GetBucketPolicy",
        "s3:PutBucketPolicy",
        "s3:DeleteBucketPolicy"
      ],
      "Resource": "arn:aws:s3:::kcs-*"
    },
    {
      "Sid": "S3KcsObjects",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:GetObjectVersion",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:DeleteObjectVersion",
        "s3:AbortMultipartUpload",
        "s3:ListMultipartUploadParts"
      ],
      "Resource": "arn:aws:s3:::kcs-*/*"
    }
  ]
}
EOF
}

assert_policies() {
  python3 - "$WORKDIR/trust.json" "$WORKDIR/perm.json" "$SUB_MAIN" "$SUB_PRODUCTION" "$PROVIDER_ARN" "$ACCOUNT_ID" "$AWS_REGION_SUGGESTED" <<'PY'
import json, sys
trust_path, perm_path, sub_main, sub_prod, provider_arn, account_id, region = sys.argv[1:8]
trust = json.load(open(trust_path, encoding="utf-8"))
perm = json.load(open(perm_path, encoding="utf-8"))
stmts = trust["Statement"]
assert len(stmts) == 1, "信任策略只能有一条"
st = stmts[0]
assert st["Action"] == "sts:AssumeRoleWithWebIdentity"
assert st["Principal"]["Federated"] == provider_arn
cond = st["Condition"]["StringEquals"]
assert cond["token.actions.githubusercontent.com:aud"] == "sts.amazonaws.com"
subs = cond["token.actions.githubusercontent.com:sub"]
assert subs == [sub_main, sub_prod], subs
assert "*" not in sub_main and "*" not in sub_prod
assert "StringLike" not in st["Condition"]
blob = json.dumps(perm)
assert "AdministratorAccess" not in blob
deny = [s for s in perm["Statement"] if s["Effect"] == "Deny"]
assert len(deny) == 1
denied = set(deny[0]["Action"])
for action in ("iam:CreateUser", "iam:CreateAccessKey", "organizations:*", "account:*"):
    assert action in denied, action
for s in perm["Statement"]:
    if s["Effect"] != "Allow":
        continue
    actions = s["Action"] if isinstance(s["Action"], list) else [s["Action"]]
    assert not any(a in ("iam:CreateUser", "iam:CreateAccessKey") or a.endswith(":*") or a in ("lightsail:*", "s3:*", "ecr:*", "iam:*") for a in actions), actions
    resources = s["Resource"] if isinstance(s["Resource"], list) else [s["Resource"]]
    sid = s["Sid"]
    if sid == "LightsailContainerDatabaseSeoul":
        assert resources == ["*"]
        assert s["Condition"]["StringEquals"]["aws:RequestedRegion"] == region
        assert "lightsail:GetRelationalDatabaseMasterUserPassword" not in actions
        assert not any(a.startswith("lightsail:CreateInstance") or a.startswith("lightsail:Allocate") for a in actions)
    elif sid == "EcrAuthTokenSeoul":
        assert actions == ["ecr:GetAuthorizationToken"]
        assert resources == ["*"]
        assert s["Condition"]["StringEquals"]["aws:RequestedRegion"] == region
    elif sid == "EcrKcsRepositories":
        assert resources == [f"arn:aws:ecr:{region}:{account_id}:repository/kcs-*"]
        assert "ecr:GetAuthorizationToken" not in actions
    elif sid == "S3KcsBuckets":
        assert resources == ["arn:aws:s3:::kcs-*"]
        assert "s3:PutBucketAcl" not in actions
    elif sid == "S3KcsObjects":
        assert resources == ["arn:aws:s3:::kcs-*/*"]
        assert "s3:PutObjectAcl" not in actions
    else:
        raise SystemExit(f"未识别的 Allow Sid: {sid}")
print("policy-ok")
PY
}

ensure_role() {
  local err
  err="$(mktemp)"
  if aws iam get-role --role-name "$ROLE_NAME" --output json >"$WORKDIR/role.json" 2>"$err"; then
    rm -f "$err"
    retry_iam "更新角色信任策略失败。" \
      iam update-assume-role-policy \
      --role-name "$ROLE_NAME" \
      --policy-document "file://${WORKDIR}/trust.json"
    printf '角色 %s 已存在，已更新信任策略。\n' "$ROLE_NAME"
  else
    if grep -q 'NoSuchEntity' "$err"; then
      rm -f "$err"
      if ! retry_iam "创建角色 ${ROLE_NAME} 失败。" \
        iam create-role \
        --role-name "$ROLE_NAME" \
        --assume-role-policy-document "file://${WORKDIR}/trust.json" \
        --description "GitHub Actions OIDC for ${GITHUB_OWNER}/${GITHUB_REPO} main and production. Lightsail, private S3, ECR. No admin." \
        --max-session-duration 3600; then
        die "创建角色 ${ROLE_NAME} 失败。"
      fi
      printf '已创建角色 %s。\n' "$ROLE_ARN"
    elif grep -q 'EntityAlreadyExists' "$err"; then
      rm -f "$err"
      retry_iam "更新角色信任策略失败。" \
        iam update-assume-role-policy \
        --role-name "$ROLE_NAME" \
        --policy-document "file://${WORKDIR}/trust.json"
      printf '角色 %s 刚被创建，已更新信任策略。\n' "$ROLE_NAME"
    else
      cat "$err" >&2 || true
      rm -f "$err"
      die "查询角色 ${ROLE_NAME} 失败。"
    fi
  fi
  retry_iam "更新角色描述失败。" \
    iam update-role \
    --role-name "$ROLE_NAME" \
    --description "GitHub Actions OIDC for ${GITHUB_OWNER}/${GITHUB_REPO} main and production. Lightsail, private S3, ECR. No admin." \
    --max-session-duration 3600
  retry_iam "给角色打标签失败。" \
    iam tag-role \
    --role-name "$ROLE_NAME" \
    --tags Key=Project,Value=kcs Key=Purpose,Value=github-actions-oidc
  retry_iam "写入内联策略 ${POLICY_NAME} 失败。" \
    iam put-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-name "$POLICY_NAME" \
    --policy-document "file://${WORKDIR}/perm.json"
  printf '已写入内联策略 %s（只覆盖这一份，不删除角色上的其他策略）。\n' "$POLICY_NAME"

  local inline attached
  inline="$(aws iam list-role-policies --role-name "$ROLE_NAME" --output json)" || die "列出内联策略失败。"
  attached="$(aws iam list-attached-role-policies --role-name "$ROLE_NAME" --output json)" || die "列出托管策略失败。"
  local extra
  extra="$(jq -r --arg keep "$POLICY_NAME" '.PolicyNames[]? | select(. != $keep)' <<<"$inline")"
  if [[ -n "$extra" ]]; then
    printf '注意：角色上还有其他内联策略，本脚本没有删除：\n%s\n' "$extra"
  fi
  if jq -e '.AttachedPolicies | length > 0' <<<"$attached" >/dev/null; then
    printf '注意：角色上还挂着托管策略，本脚本没有拆掉。请确认其中没有 AdministratorAccess：\n'
    jq -r '.AttachedPolicies[] | "\(.PolicyName) \(.PolicyArn)"' <<<"$attached"
  fi
}

write_policies
bytes="$(wc -c <"$WORKDIR/perm.json" | tr -d ' ')"
[[ "$bytes" -le 10240 ]] || die "内联策略有 ${bytes} 字节，超过 IAM 上限 10240。"
assert_policies >/dev/null || die "策略自检没有通过，没有改动 IAM。"
ensure_oidc
ensure_role

cat <<EOF

======== 请整段贴回对话 ========
账号 ID: ${ACCOUNT_ID}
角色 ARN: ${ROLE_ARN}
GitHub Actions 变量名: AWS_ROLE_ARN
建议区域: ${AWS_REGION_SUGGESTED}
======== 以上结束 ========
本脚本只创建或更新了 IAM OIDC 提供方和角色 ${ROLE_NAME}，没有创建 Lightsail、数据库、S3、ECR 或其他按量计费资源。
IAM 是全局的。建议以后的区域资源放在首尔 ${AWS_REGION_SUGGESTED}，但本脚本没有创建任何区域资源。
请先不要创建 Lightsail、数据库或 S3。把上面四行贴回对话后，再把角色 ARN 填到 GitHub 仓库变量 AWS_ROLE_ARN。
EOF
