#!/usr/bin/env bash
# Home AI gateway installer for the Raspberry Pi.
# Usage:  curl -fsSL https://YOUR-APP.vercel.app/pi/install.sh | bash -s -- https://YOUR-APP.vercel.app
set -e
SITE="${1%/}"
if [ -z "$SITE" ]; then
  echo "Usage: curl -fsSL https://YOUR-APP.vercel.app/pi/install.sh | bash -s -- https://YOUR-APP.vercel.app"
  exit 1
fi
DIR="$HOME/home-ai-gateway"
USER_NAME="$(id -un)"

echo "==> Installing Python web library"
sudo apt-get update -qq
sudo apt-get install -y -qq python3-aiohttp curl

echo "==> Downloading gateway"
mkdir -p "$DIR"
curl -fsSL "$SITE/pi/gateway.py" -o "$DIR/gateway.py"
if [ ! -f "$DIR/config.json" ]; then
  curl -fsSL "$SITE/pi/config.json" -o "$DIR/config.json"
  echo "    created $DIR/config.json"
else
  echo "    kept your existing $DIR/config.json"
fi

echo "==> Creating background service"
sudo tee /etc/systemd/system/home-ai-gateway.service >/dev/null <<EOF
[Unit]
Description=Home AI gateway (phone app -> PC, wake-on-LAN, Pi fallback)
After=network-online.target tailscaled.service
Wants=network-online.target

[Service]
User=$USER_NAME
WorkingDirectory=$DIR
ExecStart=/usr/bin/python3 $DIR/gateway.py
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now home-ai-gateway
sudo systemctl restart home-ai-gateway

echo "==> Publishing it on your Tailscale network (HTTPS)"
sudo tailscale serve --bg 8080

sleep 2
echo
echo "==> Checks"
if curl -fsS http://127.0.0.1:8080/gw/status >/dev/null; then
  echo "    gateway: running"
else
  echo "    gateway: NOT answering - run: journalctl -u home-ai-gateway -n 30"
fi
if curl -sS -o /dev/null -w "%{http_code}" --max-time 4 https://arthur-pc.taild9cfe3.ts.net/v1/models | grep -qE "^(200|401|403)$"; then
  echo "    PC: reachable (awake)"
else
  echo "    PC: not reachable right now (asleep or off - that's fine)"
fi
echo
echo "Your app address (put this in the app's Settings):"
tailscale serve status 2>/dev/null | grep -o 'https://[^ ]*' | head -1
echo
echo "Done. Logs: journalctl -u home-ai-gateway -f"
