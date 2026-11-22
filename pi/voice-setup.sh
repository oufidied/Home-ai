#!/usr/bin/env bash
# Private voice for Home AI: builds whisper.cpp on the Pi so your voice never leaves your home.
# Takes about 10 minutes on a Raspberry Pi 4. Run:  bash ~/home-ai-gateway/voice-setup.sh
set -e
MODEL="${1:-base}"   # tiny = fastest, base = better (default), small = best but slow on a Pi 4

echo "==> Installing build tools and ffmpeg"
sudo apt-get update -qq
sudo apt-get install -y -qq git cmake build-essential ffmpeg

cd "$HOME"
if [ -d whisper.cpp ]; then
  echo "==> Updating whisper.cpp"
  cd whisper.cpp && git pull --ff-only || true
else
  echo "==> Downloading whisper.cpp"
  git clone --depth 1 https://github.com/ggml-org/whisper.cpp
  cd whisper.cpp
fi

echo "==> Building (this is the slow part)"
cmake -B build -DCMAKE_BUILD_TYPE=Release >/dev/null
cmake --build build -j4 --config Release

echo "==> Downloading the '$MODEL' speech model"
bash ./models/download-ggml-model.sh "$MODEL"

if [ "$MODEL" != "base" ]; then
  python3 - "$HOME/home-ai-gateway/config.json" "$MODEL" <<'PY'
import json, sys
p, m = sys.argv[1], sys.argv[2]
c = json.load(open(p)); c["whisper_model"] = m; json.dump(c, open(p, "w"), indent=2)
PY
fi

echo "==> Quick test"
./build/bin/whisper-cli -m "models/ggml-$MODEL.bin" -f samples/jfk.wav -nt -np -t 4 || true

sudo systemctl restart home-ai-gateway
echo
echo "Private voice is ready. In the app: Settings > Voice input > Private (on your Pi)."
