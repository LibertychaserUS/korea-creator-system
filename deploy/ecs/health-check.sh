#!/bin/bash
# 听潮每日体检：容器 / 磁盘 / 证书 / 备份 / 抓取开关。退出码非 0 = 有问题。
PUBLIC_IP=${KCS_PUBLIC_IP:-$(grep -E "^KCS_PUBLIC_IP=" "$(dirname "$0")/.env" 2>/dev/null | tail -1 | cut -d= -f2-)}
[ -n "$PUBLIC_IP" ] || { echo "KCS_PUBLIC_IP unset" >&2; exit 2; }
LOG=/var/log/kcs-health.log
issues=""
ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)

for c in kcs-caddy-1 kcs-api-1 kcs-postgres-1 kcs-marketing-1 kcs-select-1 kcs-ops-1 kcs-dev-1 kcs-backup-1; do
  st=$(docker inspect -f '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}' "$c" 2>/dev/null || echo missing)
  case "$st" in
    running\ healthy|running\ *) : ;;
    *) issues="$issues container:$c=$st;" ;;
  esac
done

used=$(df -P / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')
[ "$used" -ge 90 ] && issues="$issues disk=${used}%;"

end=$(echo | openssl s_client -connect ${PUBLIC_IP}:443 -servername ${PUBLIC_IP} 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
if [ -n "$end" ]; then
  days=$(( ( $(date -u -d "$end" +%s) - $(date -u +%s) ) / 86400 ))
  [ "$days" -lt 3 ] && issues="$issues cert_days=$days;"
else
  issues="$issues cert=unreadable;"
fi

latest=$(docker exec kcs-backup-1 cat /var/backups/kcs/LATEST 2>/dev/null)
[ -z "$latest" ] && issues="$issues backup=none;"
last_stamp=$(echo "$latest" | grep -oE '^[0-9]{8}T[0-9]{6}Z' | head -1)
if [ -n "$last_stamp" ]; then
  last_epoch=$(date -u -d "$(printf "%s-%s-%s %s:%s:%s" "${last_stamp:0:4}" "${last_stamp:4:2}" "${last_stamp:6:2}" "${last_stamp:9:2}" "${last_stamp:11:2}" "${last_stamp:13:2}")" +%s 2>/dev/null || echo 0)
  age_h=$(( ( $(date -u +%s) - last_epoch ) / 3600 ))
  [ "$age_h" -gt 30 ] && issues="$issues backup_age=${age_h}h;"
fi

[ "$(systemctl is-active kcs-hsts.service)" = "active" ] || issues="$issues hsts=inactive;"

flags=$(docker exec kcs-api-1 printenv INGEST_SCHEDULER 2>/dev/null)
case "$flags" in 0|1) : ;; *) issues="$issues ingest_scheduler=$flags;" ;; esac

if [ -n "$issues" ]; then
  echo "$ts ISSUES:$issues" >> "$LOG"
  echo "ISSUES:$issues"
  exit 1
fi
echo "$ts ok disk=${used}% cert_days=${days} backup=$last_stamp" >> "$LOG"
echo "ok disk=${used}% cert_days=${days} backup=$last_stamp"
