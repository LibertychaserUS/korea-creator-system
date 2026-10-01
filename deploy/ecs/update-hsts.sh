#!/bin/bash
# Align Caddy's Strict-Transport-Security max-age with the remaining
# lifetime of the Let's Encrypt IP certificate for 16.61.33.34.
#
# Stock caddy:2.10.2 does not register events.handlers.exec
# (caddy adapt: module not registered: events.handlers.exec), so
# cert_obtained cannot run a command. This script is the alignment:
# it reads NotAfter from the certificate Caddy stored, floors the
# remaining lifetime to a whole hour (or keeps the exact seconds in
# the final hour), rewrites that one header, and reloads Caddy.
# --watch repeats the check so a renewal is picked up without a person.
#
# Idempotent and non-interactive. --not-after is refused for the live
# Caddyfile so a drill cannot publish a fake lifetime.

set -euo pipefail

DEFAULT_CADDYFILE=/opt/kcs/deploy/ecs/Caddyfile
CADDYFILE=${KCS_CADDYFILE:-$DEFAULT_CADDYFILE}
CONTAINER=${KCS_CADDY_CONTAINER:-kcs-caddy-1}
PUBLIC_IP=${KCS_PUBLIC_IP:-$(grep -E "^KCS_PUBLIC_IP=" "$(dirname "$0")/.env" 2>/dev/null | tail -1 | cut -d= -f2-)}
[ -n "$PUBLIC_IP" ] || { echo "KCS_PUBLIC_IP unset (env or .env)" >&2; exit 2; }
export PUBLIC_IP
CERT=${KCS_CADDY_CERT:-/data/caddy/certificates/acme-v02.api.letsencrypt.org-directory/${PUBLIC_IP}/${PUBLIC_IP}.crt}
# Not under /tmp: that directory is sticky, and a root service cannot open
# a lock file created by admin (fs.protected_regular).
LOCK=${KCS_HSTS_LOCK:-/opt/kcs/deploy/ecs/.update-hsts.lock}
INTERVAL=${KCS_HSTS_INTERVAL:-60}

DRY=0
WATCH=0
NO_RELOAD=0
NOT_AFTER=""

usage() {
  echo "usage: update-hsts.sh [--dry-run] [--watch] [--no-reload] [--not-after DATE]" >&2
  exit 2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY=1 ;;
    --watch) WATCH=1 ;;
    --no-reload) NO_RELOAD=1 ;;
    --not-after)
      shift
      [[ $# -gt 0 ]] || usage
      NOT_AFTER=$1
      ;;
    -h|--help) usage ;;
    *) echo "unknown argument: $1" >&2; usage ;;
  esac
  shift
done

if [[ "$WATCH" -eq 1 && ( "$DRY" -eq 1 || "$NO_RELOAD" -eq 1 || -n "$NOT_AFTER" ) ]]; then
  echo "--watch cannot be combined with --dry-run, --no-reload, or --not-after" >&2
  exit 2
fi

if [[ -n "$NOT_AFTER" && "$DRY" -ne 1 ]]; then
  live=$(readlink -f "$DEFAULT_CADDYFILE")
  target=$(readlink -f "$CADDYFILE")
  if [[ "$NO_RELOAD" -ne 1 || "$target" == "$live" ]]; then
    echo "--not-after is only allowed with --dry-run, or with --no-reload on a non-live Caddyfile" >&2
    exit 2
  fi
fi

if ! [[ "$INTERVAL" =~ ^[1-9][0-9]*$ ]]; then
  echo "invalid KCS_HSTS_INTERVAL: $INTERVAL" >&2
  exit 2
fi

read_not_after() {
  if [[ -n "$NOT_AFTER" ]]; then
    printf '%s\n' "$NOT_AFTER"
    return 0
  fi
  local tmp rc=0
  tmp=$(mktemp)
  if ! docker exec "$CONTAINER" cat "$CERT" >"$tmp"; then
    rc=1
  elif [[ ! -s "$tmp" ]]; then
    echo "certificate file is empty: ${CONTAINER}:${CERT}" >&2
    rc=1
  fi
  if [[ "$rc" -ne 0 ]]; then
    rm -f "$tmp"
    echo "failed to read certificate from ${CONTAINER}:${CERT}" >&2
    return 1
  fi
  local line
  if ! line=$(openssl x509 -in "$tmp" -noout -enddate); then
    rm -f "$tmp"
    echo "openssl could not parse the certificate" >&2
    return 1
  fi
  rm -f "$tmp"
  line=${line#notAfter=}
  line=${line%$'\r'}
  printf '%s\n' "$line"
}

restore_caddyfile() {
  python3 - "$CADDYFILE" "$1" << 'PY'
import os, sys
dst, src = sys.argv[1], sys.argv[2]
data = open(src, "rb").read()
with open(dst, "r+b") as fh:
    fh.seek(0)
    fh.write(data)
    fh.truncate()
    fh.flush()
    os.fsync(fh.fileno())
PY
}

edit_caddyfile() {
  local max_age=$1
  python3 - "$CADDYFILE" "$max_age" << 'PY'
import os, re, sys

path, max_age = sys.argv[1], sys.argv[2]
if not re.fullmatch(r"[0-9]+", max_age) or int(max_age) <= 0:
    sys.stderr.write(f"refusing max-age {max_age!r}\n")
    sys.exit(1)

with open(path, encoding="utf-8") as fh:
    original = fh.read()

sts = re.compile(
    r'^[ \t]*Strict-Transport-Security[ \t]+"(?:max-age=\d+|\{\$HSTS_VALUE\})"[ \t]*$',
    re.M,
)
found = list(sts.finditer(original))
if len(found) != 1:
    sys.stderr.write(f"expected exactly one Strict-Transport-Security line, found {len(found)}\n")
    sys.exit(1)

match = found[0]
indent = re.match(r"[ \t]*", match.group(0)).group(0)
text = original

marker = "events.handlers.exec is not registered in caddy:2.10.2"
needle = None
if os.environ.get("KCS_PUBLIC_IP"):
    needle = f"\tdefault_sni {os.environ['KCS_PUBLIC_IP']}\n"
if marker not in text and needle and needle in text:
    # 仅在能定位 default_sni 原文时补注释；default_sni 经 env 注入（{$CADDY_EXTRA_GLOBAL}）时跳过
    text = text.replace(
        needle,
        needle
        + "\t# events.handlers.exec is not registered in caddy:2.10.2;\n"
        + "\t# update-hsts.sh rewrites Strict-Transport-Security from the certificate NotAfter.\n",
        1,
    )
    match = sts.search(text)
    if match is None:
        sys.stderr.write("Strict-Transport-Security line disappeared while inserting the note\n")
        sys.exit(1)

head = text[: match.start()]
tail = text[match.end() :]
comment_re = re.compile(
    r"[ \t]*# (?:"
    r"6 days:.*"
    r"|Remaining lifetime of the current IP certificate, floored to hours\. Rewritten by update-hsts\.sh\."
    r")\n$"
)
while True:
    head, removed = comment_re.subn("", head, count=1)
    if removed == 0:
        break

comment = (
    f"{indent}# Remaining lifetime of the current IP certificate, floored to hours. "
    "Rewritten by update-hsts.sh.\n"
)
line = f'{indent}Strict-Transport-Security "max-age={max_age}"'
updated = head + comment + line + tail

def normalize(body: str) -> str:
    body = re.sub(r"(?m)^[ \t]*# 6 days:.*\n", "", body)
    body = re.sub(
        r"(?m)^[ \t]*# Remaining lifetime of the current IP certificate, floored to hours\. Rewritten by update-hsts\.sh\.\n",
        "",
        body,
    )
    body = re.sub(
        r"(?m)^[ \t]*# events\.handlers\.exec is not registered in caddy:2\.10\.2;\n",
        "",
        body,
    )
    body = re.sub(
        r"(?m)^[ \t]*# update-hsts\.sh rewrites Strict-Transport-Security from the certificate NotAfter\.\n",
        "",
        body,
    )
    body = re.sub(
        r'(?m)^([ \t]*)Strict-Transport-Security "(?:max-age=\d+|\{\$HSTS_VALUE\})"[ \t]*$',
        r'\1Strict-Transport-Security "max-age=*"',
        body,
    )
    return body

if normalize(original) != normalize(updated):
    sys.stderr.write("refusing to write: edit would change more than the HSTS max-age and its notes\n")
    import difflib
    sys.stderr.write(
        "".join(
            difflib.unified_diff(
                normalize(original).splitlines(True),
                normalize(updated).splitlines(True),
                fromfile="normalized-before",
                tofile="normalized-after",
            )
        )
    )
    sys.exit(1)

if "includeSubDomains" in line or "preload" in line:
    sys.stderr.write("refusing HSTS flags includeSubDomains or preload\n")
    sys.exit(1)
# 拓扑抽象：安全 token 可能在 import 的 caddy-sites/<拓扑>.caddy 里，一并检查
search_text = updated
site_dir = os.path.join(os.path.dirname(path), "caddy-sites")
topo = os.environ.get("KCS_TOPOLOGY")
if not topo:
    envfile = os.path.join(os.path.dirname(path), ".env")
    if os.path.exists(envfile):
        for ln in open(envfile):
            if ln.startswith("KCS_TOPOLOGY="):
                topo = ln.split("=", 1)[1].strip()
if topo and os.path.isdir(site_dir):
    site_file = os.path.join(site_dir, topo + ".caddy")
    if os.path.exists(site_file):
        with open(site_file, encoding="utf-8") as sf:
            search_text += "\n" + sf.read()

for token in (
    "disable_tlsalpn_challenge",
    "issuer acme",
    "profile shortlived",
):
    if token not in search_text:
        sys.stderr.write(f"refusing to write: missing {token}\n")
        sys.exit(1)
# marketing 上游证据：单文件直写 / (upstream) 片段 / (app) 片段三种形态等价
if not any(s in search_text for s in (
    "reverse_proxy marketing:3000",
    "import upstream marketing:3000",
    "import app marketing:3000",
)):
    sys.stderr.write("refusing to write: missing marketing upstream\n")
    sys.exit(1)
if re.search(r"(?m)^[ \t]*auto_https[ \t]+(off|disable_redirects)\b", search_text):
    sys.stderr.write("refusing to write: automatic HTTPS redirect would be disabled\n")
    sys.exit(1)

# Write into the existing inode. Docker bind-mounts this file by inode;
# renaming it would leave Caddy reading a deleted mount.
tmp = path + ".tmp"
try:
    with open(tmp, "w", encoding="utf-8") as fh:
        fh.write(updated)
        fh.flush()
        os.fsync(fh.fileno())
    data = open(tmp, encoding="utf-8").read()
    if data != updated:
        sys.stderr.write("temporary copy mismatch\n")
        sys.exit(1)
    with open(path, "r+", encoding="utf-8") as fh:
        fh.seek(0)
        fh.write(data)
        fh.truncate()
        fh.flush()
        os.fsync(fh.fileno())
finally:
    if os.path.exists(tmp):
        os.remove(tmp)
PY
}

align() {
  local na end now remaining max_age iso current seen ver bak
  na=$(read_not_after)
  end=$(date -u -d "$na" +%s)
  now=$(date -u +%s)
  remaining=$((end - now))
  if (( remaining <= 0 )); then
    echo "certificate notAfter is not in the future: ${na}" >&2
    return 1
  fi
  max_age=$((remaining / 3600 * 3600))
  if (( max_age == 0 )); then
    max_age=$remaining
  fi
  if (( max_age <= 0 || max_age > remaining )); then
    echo "computed max-age ${max_age} is outside remaining ${remaining}" >&2
    return 1
  fi
  iso=$(date -u -d "@${end}" +%Y-%m-%dT%H:%M:%SZ)

  if [[ "$DRY" -eq 1 ]]; then
    echo "not_after=${iso}"
    echo "not_after_raw=${na}"
    echo "now=$(date -u -d "@${now}" +%Y-%m-%dT%H:%M:%SZ)"
    echo "remaining_seconds=${remaining}"
    echo "max_age=${max_age}"
    echo "header=Strict-Transport-Security: max-age=${max_age}"
    return 0
  fi

  current=$(sed -n 's/.*Strict-Transport-Security "max-age=\([0-9][0-9]*\)".*/\1/p' "$CADDYFILE" | head -n 1)
  if [[ "$current" == "$max_age" ]]; then
    if [[ "$WATCH" -eq 0 ]]; then
      echo "update-hsts: max-age already ${max_age} remaining=${remaining} not_after=${iso}"
    fi
    return 0
  fi

  bak=$(mktemp)
  cp -a "$CADDYFILE" "$bak"
  if ! edit_caddyfile "$max_age"; then
    restore_caddyfile "$bak"
    rm -f "$bak" "${CADDYFILE}.tmp"
    return 1
  fi

  if [[ "$NO_RELOAD" -eq 1 ]]; then
    rm -f "$bak"
    echo "update-hsts: wrote max-age=${max_age} remaining=${remaining} not_after=${iso} (no reload)"
    return 0
  fi

  host_ino=$(stat -c '%i' "$CADDYFILE")
  ctr_ino=$(docker exec "$CONTAINER" stat -c '%i' /etc/caddy/Caddyfile)
  if [[ "$host_ino" != "$ctr_ino" ]]; then
    echo "Caddyfile inode mismatch host=${host_ino} container=${ctr_ino}; bind mount is stale" >&2
    restore_caddyfile "$bak"
    rm -f "$bak"
    return 1
  fi
  seen=$(docker exec "$CONTAINER" sed -n 's/.*Strict-Transport-Security "max-age=\([0-9][0-9]*\)".*/\1/p' /etc/caddy/Caddyfile | head -n 1 || true)
  if [[ "$seen" != "$max_age" ]]; then
    echo "container does not see updated Caddyfile (saw ${seen:-nothing}, want ${max_age})" >&2
    restore_caddyfile "$bak"
    rm -f "$bak"
    return 1
  fi

  ver=$(docker exec "$CONTAINER" caddy version)
  if [[ "$ver" != v2.10.* ]]; then
    echo "unexpected caddy version: ${ver}" >&2
    restore_caddyfile "$bak"
    rm -f "$bak"
    return 1
  fi

  if ! timeout 30 docker exec "$CONTAINER" caddy adapt --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null; then
    echo "caddy adapt failed; restored Caddyfile" >&2
    restore_caddyfile "$bak"
    rm -f "$bak"
    return 1
  fi

  if ! timeout 30 docker exec "$CONTAINER" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile; then
    echo "caddy reload failed; restoring Caddyfile" >&2
    restore_caddyfile "$bak"
    timeout 30 docker exec "$CONTAINER" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile || true
    rm -f "$bak"
    return 1
  fi

  rm -f "$bak"
  echo "update-hsts: max-age ${current:-none} -> ${max_age} remaining=${remaining} not_after=${iso}"
}

once() {
  (
    flock -w 60 9
    align
  ) 9>"$LOCK"
}

if [[ "$WATCH" -eq 1 ]]; then
  echo "update-hsts: watch every ${INTERVAL}s"
  while true; do
    if ! once; then
      echo "update-hsts: alignment failed" >&2
    fi
    sleep "$INTERVAL"
  done
fi

once
