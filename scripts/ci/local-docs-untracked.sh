#!/usr/bin/env bash
# Fails when a tracked file matches a .gitignore rule, e.g. a local-only doc added back with `git add -f`.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
tracked=$(git -c core.quotePath=false ls-files --cached --ignored --exclude-standard)

if [ -n "$tracked" ]; then
  echo "::error title=文档应在本地::以下被跟踪的文件命中 .gitignore 忽略规则。文档应在本地，请改为更新加密包（scripts/docs/pack-local-docs.sh），并用 git rm --cached 把它们移出仓库。"
  printf '%s\n' "$tracked"
  exit 1
fi
echo "没有被跟踪的本地文档。"
