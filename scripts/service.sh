#!/bin/sh
# Run eait as a persistent service. macOS (launchd) and Linux (systemd user unit) both
# supported; the unit file is generated at install time with resolved local paths, so nothing
# machine-specific is ever committed.
#
#   scripts/service.sh {install|start|stop|restart|status|logs|uninstall}
#
# Linux note: this installs a *user* unit, so no root is needed. Lingering is enabled so the
# bot survives logout — without it systemd stops user services when the last session ends.
set -e

LABEL="com.eait.bot"
UNIT="eait"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
if [ -x "$HOME/.bun/bin/bun" ]; then
  BUN="$HOME/.bun/bin/bun"
else
  BUN="$(command -v bun || true)"
fi
mkdir -p "$DIR/logs"

if [ -z "$BUN" ]; then
  echo "bun not found on PATH. Install it: curl -fsSL https://bun.sh/install | bash" >&2
  exit 1
fi

OS="$(uname -s)"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
SYSTEMD_DIR="$HOME/.config/systemd/user"
SERVICE="$SYSTEMD_DIR/$UNIT.service"

# ---------- macOS ----------

write_plist() {
  mkdir -p "$(dirname "$PLIST")"
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

# ---------- Linux ----------

write_unit() {
  mkdir -p "$SYSTEMD_DIR"
  cat > "$SERVICE" <<EOF
[Unit]
Description=eait — food-photo Telegram bot
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$DIR
ExecStart=$BUN run src/index.ts
Restart=always
RestartSec=15
StandardOutput=append:$DIR/logs/eait.out.log
StandardError=append:$DIR/logs/eait.err.log

[Install]
WantedBy=default.target
EOF
  systemctl --user daemon-reload
}

# ---------- dispatch ----------

case "$OS" in
  Darwin)
    case "${1:-}" in
      install)
        write_plist
        launchctl unload "$PLIST" 2>/dev/null || true
        launchctl load "$PLIST"
        echo "eait installed + loaded (launchd: $LABEL)"
        ;;
      start)   launchctl load "$PLIST"; echo "started" ;;
      stop)    launchctl unload "$PLIST" 2>/dev/null || true; echo "stopped" ;;
      # kickstart -k kills before restarting: two pollers on one bot token means 409 Conflict.
      restart) launchctl kickstart -k "gui/$(id -u)/$LABEL" >/dev/null && echo "restarted" ;;
      status)  launchctl list | grep "$LABEL" || echo "not loaded" ;;
      logs)    tail -n 40 "$DIR/logs/eait.out.log" "$DIR/logs/eait.err.log" 2>/dev/null ;;
      uninstall) launchctl unload "$PLIST" 2>/dev/null || true; rm -f "$PLIST"; echo "uninstalled" ;;
      *) echo "usage: scripts/service.sh {install|start|stop|restart|status|logs|uninstall}"; exit 1 ;;
    esac
    ;;
  Linux)
    case "${1:-}" in
      install)
        write_unit
        # Survive logout; harmless (and non-fatal) if the system disallows it.
        loginctl enable-linger "$(id -un)" 2>/dev/null || \
          echo "note: could not enable lingering — the bot may stop when you log out"
        systemctl --user enable --now "$UNIT"
        echo "eait installed + started (systemd user unit: $UNIT)"
        ;;
      start)   systemctl --user start "$UNIT"; echo "started" ;;
      stop)    systemctl --user stop "$UNIT"; echo "stopped" ;;
      restart) systemctl --user restart "$UNIT"; echo "restarted" ;;
      status)  systemctl --user --no-pager status "$UNIT" || true ;;
      logs)    journalctl --user -u "$UNIT" -n 40 --no-pager 2>/dev/null || \
                 tail -n 40 "$DIR/logs/eait.out.log" "$DIR/logs/eait.err.log" 2>/dev/null ;;
      uninstall)
        systemctl --user disable --now "$UNIT" 2>/dev/null || true
        rm -f "$SERVICE"; systemctl --user daemon-reload
        echo "uninstalled"
        ;;
      *) echo "usage: scripts/service.sh {install|start|stop|restart|status|logs|uninstall}"; exit 1 ;;
    esac
    ;;
  *)
    echo "unsupported OS: $OS (macOS and Linux only). Run 'bun run start' directly." >&2
    exit 1
    ;;
esac
