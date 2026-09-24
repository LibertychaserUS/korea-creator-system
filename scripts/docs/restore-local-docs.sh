#!/usr/bin/env bash
# Restore the project docs that live only locally (ignored by .gitignore) into the working tree.
#
#   scripts/docs/restore-local-docs.sh [--source <commit>] [--force] [--dry-run]
#   scripts/docs/restore-local-docs.sh --from-archive <file.7z> [--force] [--dry-run]
#
# Git mode (default): the file list is every path in <commit> that the current .gitignore ignores
# (git ls-tree + git check-ignore), so no file names are kept in the repo. Files are written with
# `git restore --source=<commit> --worktree` and the index is left alone.
# Archive mode: decrypts the 7z package (passphrase read from the terminal, never from argv),
# checks it against the MANIFEST.txt inside, and copies only paths .gitignore ignores.
#
# Existing files are skipped unless --force is given.
set -euo pipefail

DEFAULT_SOURCE=6ba423228f20d19deb85c0c3a687a01e175e9806

usage() {
  sed -n '2,13s/^# \{0,1\}//p' "$0"
  exit "${1:-0}"
}

source_commit=$DEFAULT_SOURCE
archive=
force=0
dry_run=0

while [ $# -gt 0 ]; do
  case "$1" in
    --source) [ $# -ge 2 ] || usage 2; source_commit=$2; shift 2 ;;
    --source=*) source_commit=${1#--source=}; shift ;;
    --from-archive) [ $# -ge 2 ] || usage 2; archive=$2; shift 2 ;;
    --from-archive=*) archive=${1#--from-archive=}; shift ;;
    --force) force=1; shift ;;
    --dry-run) dry_run=1; shift ;;
    -h|--help) usage 0 ;;
    *) echo "未知参数：$1" >&2; usage 2 ;;
  esac
done

if [ -n "$archive" ]; then
  archive=$(cd "$(dirname "$archive")" && pwd)/$(basename "$archive")
fi

root=$(git rev-parse --show-toplevel)
cd "$root"

list=
todo=
tmp=
restored=0
skipped=0
skipped_changed=0
refused=0

# Prints NUL-separated paths from stdin that the current .gitignore ignores and git does not track.
ignored_only() {
  git check-ignore --stdin -z || [ $? -eq 1 ]
}

restore_from_git() {
  if ! git cat-file -e "${source_commit}^{commit}" 2>/dev/null; then
    git fetch --quiet origin "$source_commit" 2>/dev/null || true
  fi
  if ! git cat-file -e "${source_commit}^{commit}" 2>/dev/null; then
    echo "找不到源提交 $source_commit。浅克隆请先 git fetch --unshallow，或用 --source 指定别的提交。" >&2
    exit 1
  fi

  local path
  list=$(mktemp)
  todo=$(mktemp)
  trap 'rm -f "$list" "$todo"' EXIT

  git ls-tree -r -z --name-only "$source_commit" | ignored_only >"$list"

  while IFS= read -r -d '' path; do
    if [ -e "$path" ] && [ "$force" -eq 0 ]; then
      skipped=$((skipped + 1))
      if [ "$(git hash-object -- "$path")" != "$(git rev-parse "${source_commit}:${path}")" ]; then
        skipped_changed=$((skipped_changed + 1))
      fi
      continue
    fi
    printf '%s\0' "$path" >>"$todo"
    restored=$((restored + 1))
  done <"$list"

  if [ "$restored" -gt 0 ] && [ "$dry_run" -eq 0 ]; then
    git --literal-pathspecs restore --source="$source_commit" --worktree \
      --pathspec-from-file="$todo" --pathspec-file-nul
  fi
}

restore_from_archive() {
  [ -f "$archive" ] || { echo "加密包不存在：$archive" >&2; exit 1; }
  local sevenzip
  sevenzip=$(command -v 7zz || command -v 7z || true)
  [ -n "$sevenzip" ] || { echo "需要 7-Zip（7z 或 7zz）。" >&2; exit 1; }
  [ -r /dev/tty ] || { echo "从加密包恢复需要在终端里交互输入口令。" >&2; exit 1; }

  local pass
  tmp=$(mktemp -d)
  chmod 700 "$tmp"
  trap 'rm -rf "$tmp"' EXIT

  printf '加密包口令（不回显）：' >/dev/tty
  IFS= read -rs pass </dev/tty
  printf '\n' >/dev/tty
  # printf is a builtin: the passphrase reaches 7z through a pipe, never through argv.
  if ! printf '%s\n' "$pass" | "$sevenzip" x -y -bso0 -bsp0 -o"$tmp/out" "$archive" >/dev/null; then
    pass=
    echo "解包失败：口令不对或包已损坏。" >&2
    exit 1
  fi
  pass=

  if [ -f "$tmp/out/MANIFEST.txt" ]; then
    (cd "$tmp/out" && grep -v '^#' MANIFEST.txt | awk -F '\t' 'NF >= 3 { print $3 "  " $1 }' | sha256sum --quiet -c -) || {
      echo "包内文件与 MANIFEST.txt 的 sha256 不一致，未恢复任何文件。" >&2
      exit 1
    }
  else
    echo "提示：包里没有 MANIFEST.txt，跳过 sha256 核对。" >&2
  fi

  local path
  while IFS= read -r -d '' path; do
    path=${path#./}
    if ! git check-ignore -q -- "$path"; then
      echo "不恢复（不在 .gitignore 忽略范围内）：$path" >&2
      refused=$((refused + 1))
      continue
    fi
    if [ -e "$path" ] && [ "$force" -eq 0 ]; then
      skipped=$((skipped + 1))
      cmp -s -- "$tmp/out/$path" "$path" || skipped_changed=$((skipped_changed + 1))
      continue
    fi
    restored=$((restored + 1))
    [ "$dry_run" -eq 1 ] && continue
    mkdir -p -- "$(dirname -- "$path")"
    cp -p -- "$tmp/out/$path" "$path"
  done < <(cd "$tmp/out" && find . -type f -print0)
}

if [ -n "$archive" ]; then
  restore_from_archive
  from="加密包 $(basename "$archive")"
else
  restore_from_git
  from="git 提交 $(git rev-parse --short "$source_commit")"
fi

verb=恢复
[ "$dry_run" -eq 1 ] && verb=将恢复
echo "来源：$from"
echo "${verb} ${restored} 个，跳过 ${skipped} 个（已存在；其中 ${skipped_changed} 个与来源不同，可能是本地更新，用 --force 才覆盖）。"
[ "$refused" -gt 0 ] && echo "另有 ${refused} 个不在忽略范围内的文件未恢复。"
exit 0
