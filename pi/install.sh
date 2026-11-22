#!/usr/bin/env bash
# Home AI hub installer / updater for the Raspberry Pi.
# Usage:  curl -fsSL https://home-ai-ruby.vercel.app/pi/install.sh | bash -s -- https://home-ai-ruby.vercel.app
set -e
SITE="${1%/}"
if [ -z "$SITE" ]; then
  echo "Usage: curl -fsSL https://YOUR-APP.vercel.app/pi/install.sh | bash -s -- https://YOUR-APP.vercel.app"
  exit 1
fi
DIR="$HOME/home-ai-gateway"
USER_NAME="$(id -un)"

echo "==> Installing system packages"
sudo apt-get update -qq
sudo apt-get install -y -qq python3-venv python3-pip curl

echo "==> Downloading the hub"
mkdir -p "$DIR"
curl -fsSL "$SITE/pi/gateway.py" -o "$DIR/gateway.py"
curl -fsSL "$SITE/pi/voice-setup.sh" -o "$DIR/voice-setup.sh"
chmod +x "$DIR/voice-setup.sh"
if [ ! -f "$DIR/config.json" ]; then
  curl -fsSL "$SITE/pi/config.json" -o "$DIR/config.json"
  echo "    created config.json"
fi

echo "==> Python environment (aiohttp + push notifications)"
if [ ! -x "$DIR/venv/bin/python" ]; then
  python3 -m venv "$DIR/venv"
fi
"$DIR/venv/bin/pip" install -q --upgrade pip
"$DIR/venv/bin/pip" install -q "aiohttp>=3.9" "pywebpush>=2.0"

echo "==> Updating config (keeps your settings, adds new ones)"
"$DIR/venv/bin/python" - "$DIR/config.json" "$SITE" <<'PY'
import json, secrets, sys
path, site = sys.argv[1], sys.argv[2]
cfg = json.load(open(path))
defaults = {"device_port": 8090, "push_contact": site, "whisper_dir": "~/whisper.cpp", "whisper_model": "base"}
for k, v in defaults.items():
    cfg.setdefault(k, v)
cfg.pop("token", None); cfg.pop("fallback", None); cfg.pop("fallback_model", None)
cfg.pop("wake_timeout", None); cfg.pop("keep_awake_minutes", None)
if not cfg.get("device_key"):
    cfg["device_key"] = secrets.token_hex(8)
json.dump(cfg, open(path, "w"), indent=2)
print("    device key for your ESP32s:", cfg["device_key"])
PY

echo "==> Allowing the hub to shut the Pi down (for emergency shutdown only)"
echo "$USER_NAME ALL=(root) NOPASSWD: /usr/sbin/shutdown" | sudo tee /etc/sudoers.d/home-ai >/dev/null
sudo chmod 440 /etc/sudoers.d/home-ai
sudo visudo -cf /etc/sudoers.d/home-ai >/dev/null || { echo "    sudoers check failed - removing"; sudo rm -f /etc/sudoers.d/home-ai; }

echo "==> Background service"
sudo tee /etc/systemd/system/home-ai-gateway.service >/dev/null <<EOF
[Unit]
Description=Home AI hub (chats, wake-on-LAN, PC control, home devices)
After=network-online.target tailscaled.service
Wants=network-online.target

[Service]
User=$USER_NAME
WorkingDirectory=$DIR
ExecStart=$DIR/venv/bin/python $DIR/gateway.py
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable home-ai-gateway >/dev/null
sudo systemctl restart home-ai-gateway

echo "==> Publishing on your Tailscale network (HTTPS)"
sudo tailscale serve --bg 8080 >/dev/null

sleep 3
echo
echo "==> Checks"
if curl -fsS http://127.0.0.1:8080/hub/status >/dev/null; then
  echo "    hub: running ($(curl -fsS http://127.0.0.1:8080/hub/status | grep -o '"hub": *"[^"]*"' | head -1))"
else
  echo "    hub: NOT answering - run: journalctl -u home-ai-gateway -n 40"
fi
if curl -fsS http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then echo "    Ollama: running"; else echo "    Ollama: not running (Pi answers and smart routing need it)"; fi
if [ -x "$HOME/whisper.cpp/build/bin/whisper-cli" ]; then echo "    private voice: installed"; else echo "    private voice: not installed (optional: bash $DIR/voice-setup.sh)"; fi
IP=$(hostname -I | awk '{print $1}')
echo "    home devices: http://$IP:8090/home/report"
echo
echo "App address (Settings > Pi address):"
tailscale serve status 2>/dev/null | grep -o 'https://[^ ]*' | head -1
echo
echo "Done. Live logs: journalctl -u home-ai-gateway -f"
