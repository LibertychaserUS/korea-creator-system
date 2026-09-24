#!/usr/bin/env bash
# Re-pack the local-only project docs into an encrypted 7z package under docs-archive/.
#
#   scripts/docs/pack-local-docs.sh [--password-file <file>] [--out <file.7z>] [--update-readme]
#
# Packs only files that .gitignore ignores AND sit under the doc paths below (never code, never
# node_modules / build output), writes MANIFEST.txt (path, bytes, sha256), and encrypts with
# 7z AES-256 with encrypted file names (-mhe=on). The passphrase is read from the terminal
# (asked twice) or from the first line of --password-file; it never appears on a command line.
# The default name is docs-archive/kcs-docs-<UTC date>.7z, with -2, -3 … when that day's name is taken.
# --update-readme rewrites the package name, date, file count, size and sha256 in docs-archive/README.md.
set -euo pipefail

DOC_PATHSPECS=(
  'docs'
  ':(glob)tests/**/*.md'
  ':(glob)e2e/**/*.md'
  ':(glob)libs/**/*.md'
  ':(glob)apps/**/*.md'
  ':(exclude,glob)**/node_modules/**'
  ':(exclude,glob)**/.nuxt/**'
  ':(exclude,glob)**/.output/**'
  ':(exclude,glob)**/dist/**'
  ':(exclude,glob)**/.turbo/**'
  ':(exclude,glob)**/test-results/**'
  ':(exclude,glob)**/playwright-report/**'
)

usage() {
  sed -n '2,11s/^# \{0,1\}//p' "$0"
  exit "${1:-0}"
}

password_file=
out=
update_readme=0

while [ $# -gt 0 ]; do
  case "$1" in
    --password-file) [ $# -ge 2 ] || usage 2; password_file=$2; shift 2 ;;
    --password-file=*) password_file=${1#--password-file=}; shift ;;
    --out) [ $# -ge 2 ] || usage 2; out=$2; shift 2 ;;
    --out=*) out=${1#--out=}; shift ;;
    --update-readme) update_readme=1; shift ;;
    -h|--help) usage 0 ;;
    *) echo "未知参数：$1" >&2; usage 2 ;;
  esac
done

if [ -n "$password_file" ]; then
  password_file=$(cd "$(dirname "$password_file")" && pwd)/$(basename "$password_file")
fi
if [ -n "$out" ]; then
  out=$(cd "$(dirname "$out")" && pwd)/$(basename "$out")
fi

root=$(git rev-parse --show-toplevel)
cd "$root"

sevenzip=$(command -v 7zz || command -v 7z || true)
[ -n "$sevenzip" ] || { echo "需要 7-Zip（7z 或 7zz）。" >&2; exit 1; }

today=$(date -u +%Y-%m-%d)
if [ -z "$out" ]; then
  stem=$root/docs-archive/kcs-docs-$(date -u +%Y%m%d)
  out=$stem.7z
  n=2
  while [ -e "$out" ]; do
    out=$stem-$n.7z
    n=$((n + 1))
  done
fi
if [ -e "$out" ]; then
  echo "$out 已存在（7z 会往旧包里追加）。先删掉它或用 --out 指定新文件名。" >&2
  exit 1
fi

list=$(mktemp)
trap 'rm -f "$list"' EXIT
git ls-files -z --others --ignored --exclude-standard -- "${DOC_PATHSPECS[@]}" \
  | LC_ALL=C sort -z >"$list"
count=$(tr -cd '\0' <"$list" | wc -c)
[ "$count" -gt 0 ] || { echo "没有找到本地文档。先运行 scripts/docs/restore-local-docs.sh。" >&2; exit 1; }
if tr '\0' '\n' <"$list" | grep -q '^MANIFEST\.txt$'; then
  echo "MANIFEST.txt 不应在文档路径里。" >&2
  exit 1
fi

{
  printf '# KCS 本地文档备份 — 生成于 %s（UTC），仓库 %s @ %s\n' \
    "$today" "$(git rev-parse --abbrev-ref HEAD)" "$(git rev-parse --short HEAD)"
  printf '# 路径\t字节数\tsha256\n'
  while IFS= read -r -d '' path; do
    printf '%s\t%s\t%s\n' "$path" "$(wc -c <"$path" | tr -d ' ')" "$(sha256sum -- "$path" | cut -d' ' -f1)"
  done <"$list"
} >MANIFEST.txt

if [ -n "$password_file" ]; then
  [ -f "$password_file" ] || { echo "口令文件不存在：$password_file" >&2; exit 1; }
  if [ -n "$(find "$password_file" -perm /077)" ]; then
    echo "提示：口令文件对其他用户可读，建议 chmod 600。" >&2
  fi
  IFS= read -r pass <"$password_file" || true
  pass=${pass%$'\r'}
else
  [ -r /dev/tty ] || { echo "没有终端：请用 --password-file 提供口令。" >&2; exit 1; }
  printf '新包口令（不回显）：' >/dev/tty
  IFS= read -rs pass </dev/tty
  printf '\n再输一次：' >/dev/tty
  IFS= read -rs pass2 </dev/tty
  printf '\n' >/dev/tty
  [ "$pass" = "$pass2" ] || { pass=; pass2=; echo "两次口令不一致。" >&2; exit 1; }
  pass2=
fi
[ -n "$pass" ] || { echo "口令不能为空。" >&2; exit 1; }

# printf is a builtin: the passphrase reaches 7z through a pipe, never through argv.
tr '\0' '\n' <"$list" >"$list.txt"
trap 'rm -f "$list" "$list.txt"' EXIT
mkdir -p "$(dirname "$out")"
printf '%s\n' "$pass" | "$sevenzip" a -t7z -mhe=on -mx=9 -scsUTF-8 -bso0 -bsp0 -p \
  "$out" MANIFEST.txt "@$list.txt" >/dev/null
pass=

size=$(wc -c <"$out" | tr -d ' ')
sha=$(sha256sum "$out" | cut -d' ' -f1)
name=$(basename "$out")
size_fmt=$(printf '%s' "$size" | sed -E ':a;s/([0-9])([0-9]{3})($|,)/\1,\2\3/;ta')

echo "已打包 ${count} 个文档（另附 MANIFEST.txt）→ ${out#"$root"/}"
echo "大小：${size_fmt} 字节"
echo "sha256：${sha}"

readme=$root/docs-archive/README.md
if [ "$update_readme" -eq 1 ] && [ -f "$readme" ]; then
  sed -i -E \
    -e "s/kcs-docs-[0-9]{8}(-[0-9]+)?\.7z/${name}/g" \
    -e "s/^- 生成时间：.*/- 生成时间：${today}（UTC）/" \
    -e "s/^- 大小：.*/- 大小：${size_fmt} 字节/" \
    -e "s/^- sha256：.*/- sha256：\`${sha}\`/" \
    -e "s/^共 [0-9]+ 个文件/共 ${count} 个文件/" \
    "$readme"
  echo "已更新 docs-archive/README.md（包名、生成时间、文件数、大小、sha256；目录汇总表请人工核对）。"
else
  echo "下一步：更新 docs-archive/README.md 里的包名、生成时间、文件数、大小和 sha256（或加 --update-readme 自动替换）。"
fi
echo "然后删除旧包（git rm docs-archive/<旧包>.7z），git add 新包与 README 并提交。不要提交 MANIFEST.txt 或任何明文文档。"
