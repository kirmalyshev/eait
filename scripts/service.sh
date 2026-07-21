#!/bin/sh
# Manage eait as a persistent macOS launchd service (always-on, survives logout/reboot).
# The plist is generated at install time with resolved local paths, so nothing
# machine-specific is committed to the repo.
#   scripts/service.sh {install|start|stop|restart|status|logs|uninstall}
set -e

LABEL="com.eait.bot"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
BUN="$([ -x "$HOME/.bun/bin/bun" ] && echo "$HOME/.bun/bin/bun" || command -v bun)"
mkdir -p "$DIR/logs"

write_plist() {
  cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array>
    <string>$BUN</string><string>run</string><string>src/index.ts</string>
  </array>
  <key>WorkingDirectory</key><string>$DIR</string>
  <key>EnvironmentVariables</key><dict>
    <key>PATH</key><string>$HOME/.bun/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>$DIR/logs/eait.out.log</string>
  <key>StandardErrorPath</key><string>$DIR/logs/eait.err.log</string>
</dict></plist>
EOF
}

case "${1:-}" in
  install)
    write_plist
    launchctl unload "$PLIST" 2>/dev/null || true
    launchctl load "$PLIST"
    echo "eait service installed + loaded ($LABEL)"
    ;;
  start)   launchctl load "$PLIST"; echo "started" ;;
  stop)    launchctl unload "$PLIST" 2>/dev/null || true; echo "stopped" ;;
  restart) launchctl unload "$PLIST" 2>/dev/null || true; launchctl load "$PLIST"; echo "restarted" ;;
  status)  launchctl list | grep "$LABEL" || echo "not loaded" ;;
  logs)    tail -n 40 "$DIR/logs/eait.out.log" "$DIR/logs/eait.err.log" 2>/dev/null ;;
  uninstall) launchctl unload "$PLIST" 2>/dev/null || true; rm -f "$PLIST"; echo "uninstalled" ;;
  *) echo "usage: scripts/service.sh {install|start|stop|restart|status|logs|uninstall}"; exit 1 ;;
esac
