#!/bin/sh
# Backup for a selfhost-stack instance (docker-compose.selfhost.yml): pg_dump through
# `docker compose exec`, so no Postgres tools are needed on the host. Dumps land in
# ./backups (gitignored) and the newest KEEP are retained.
#
#   sh scripts/backup.sh run         # one dump + prune (this is what the schedule calls)
#   sh scripts/backup.sh install     # macOS: launchd job, daily at 03:30
#   sh scripts/backup.sh status
#   sh scripts/backup.sh uninstall
#
# A local docker-compose.prod.yml overlay (untracked) is included automatically when present.
# Linux: call `sh scripts/backup.sh run` from cron/systemd-timer; install/status/uninstall
# are launchd-only.
set -eu

DIR="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="com.eait.backup"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
BACKUP_DIR="$DIR/backups"
KEEP=14

FILES="-f $DIR/docker-compose.selfhost.yml"
[ -f "$DIR/docker-compose.prod.yml" ] && FILES="$FILES -f $DIR/docker-compose.prod.yml"

run_backup() {
  mkdir -p "$BACKUP_DIR"
  OUT="$BACKUP_DIR/eait-$(date +%Y%m%d-%H%M%S).sql"
  # $FILES is intentionally word-split
  # shellcheck disable=SC2086
  docker compose $FILES exec -T db pg_dump -U eait eait > "$OUT"
  [ -s "$OUT" ] || { echo "backup produced an empty file: $OUT" >&2; rm -f "$OUT"; exit 1; }
  echo "wrote $OUT ($(wc -c < "$OUT" | tr -d ' ') bytes)"
  # Filenames are self-generated (no spaces), so line-based pruning is safe here.
  # shellcheck disable=SC2012
  ls -1t "$BACKUP_DIR"/eait-*.sql 2>/dev/null | tail -n +$((KEEP + 1)) | while IFS= read -r f; do
    rm -f "$f"
    echo "pruned $f"
  done
}

case "${1:-}" in
  run)
    run_backup
    ;;
  install)
    mkdir -p "$HOME/Library/LaunchAgents" "$DIR/logs"
    cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/sh</string>
    <string>$DIR/scripts/backup.sh</string>
    <string>run</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string></dict>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>3</integer><key>Minute</key><integer>30</integer></dict>
  <key>StandardOutPath</key><string>$DIR/logs/backup.log</string>
  <key>StandardErrorPath</key><string>$DIR/logs/backup.err.log</string>
</dict>
</plist>
EOF
    launchctl unload "$PLIST" 2>/dev/null || true
    launchctl load "$PLIST"
    echo "installed $LABEL — daily at 03:30, dumps in $BACKUP_DIR, keeps $KEEP"
    ;;
  status)
    launchctl list | grep "$LABEL" || echo "$LABEL not loaded"
    # shellcheck disable=SC2012
    ls -1t "$BACKUP_DIR"/eait-*.sql 2>/dev/null | head -3 || true
    ;;
  uninstall)
    launchctl unload "$PLIST" 2>/dev/null || true
    rm -f "$PLIST"
    echo "uninstalled $LABEL"
    ;;
  *)
    echo "usage: sh scripts/backup.sh {run|install|status|uninstall}" >&2
    exit 1
    ;;
esac
