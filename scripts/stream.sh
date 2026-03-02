#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load .env
if [ -f "$PROJECT_DIR/.env" ]; then
  set -a
  source "$PROJECT_DIR/.env"
  set +a
fi

# Mode: "youtube" (default) or "local" (record to file for testing)
MODE="${1:-youtube}"

if [ "$MODE" = "youtube" ]; then
  STREAM_KEY="${YOUTUBE_STREAM_KEY:?YOUTUBE_STREAM_KEY is not set in .env}"
  RTMP_URL="rtmp://a.rtmp.youtube.com/live2/${STREAM_KEY}"
fi

# Configuration
DISPLAY_NUM=":99"
XVFB_RES="1920x1200"
FPS="30"
AUDIO_SINK="aituber_sink"
SERVER_PORT="${PORT:-3001}"
FRONTEND_URL="http://localhost:5173/stream"

# Cleanup on exit
PIDS=()
cleanup() {
  echo "[stream] Shutting down..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  pactl unload-module module-null-sink 2>/dev/null || true
  echo "[stream] Done."
}
trap cleanup EXIT INT TERM

# 1. PulseAudio
echo "[stream] Starting PulseAudio..."
pulseaudio --check 2>/dev/null || pulseaudio --start --exit-idle-time=-1
pactl unload-module module-null-sink 2>/dev/null || true
pactl load-module module-null-sink sink_name="${AUDIO_SINK}" \
  sink_properties=device.description="AITuber_Audio" > /dev/null
pactl set-default-sink "${AUDIO_SINK}"

# 2. Dev server (if not already running)
if ! curl -sf "http://localhost:${SERVER_PORT}/health" > /dev/null 2>&1; then
  echo "[stream] Starting dev server..."
  cd "$PROJECT_DIR"
  SERVER_AUDIO=true pnpm dev > /tmp/aituber-dev.log 2>&1 &
  PIDS+=($!)
  echo "[stream] Waiting for server..."
  for i in $(seq 1 30); do
    if curl -sf "http://localhost:${SERVER_PORT}/health" > /dev/null 2>&1; then
      echo "[stream] Server ready."
      break
    fi
    if [ "$i" = "30" ]; then
      echo "[stream] ERROR: Server did not start in 30s"
      exit 1
    fi
    sleep 1
  done
fi

if [ "$MODE" = "local" ]; then
  # Local mode: Playwright headless video + audio merge (clean, no browser UI)
  DURATION="${2:-30}"
  echo "[stream] Recording ${DURATION}s..."
  python3 "${SCRIPT_DIR}/stream_worker.py" --local "${DURATION}" --sink "${AUDIO_SINK}" --url "${FRONTEND_URL}"
  exit 0
fi

# YouTube mode: Xvfb + Playwright headed + x11grab (smooth 30fps)

# 3. Xvfb (taller to accommodate Chrome UI, cropped by ffmpeg)
echo "[stream] Starting Xvfb on ${DISPLAY_NUM}..."
Xvfb "${DISPLAY_NUM}" -screen 0 "${XVFB_RES}x24" -ac 2>/dev/null &
PIDS+=($!)
sleep 1

# 4. Chromium via Playwright headed mode (WebGL works on Xvfb)
echo "[stream] Starting browser..."
DISPLAY="${DISPLAY_NUM}" python3 -c "
from playwright.sync_api import sync_playwright
import time, os
os.environ['DISPLAY'] = '${DISPLAY_NUM}'
p = sync_playwright().start()
browser = p.chromium.launch(
    headless=False,
    args=[
        '--use-gl=swiftshader',
        '--autoplay-policy=no-user-gesture-required',
        '--disable-extensions',
        '--disable-translate',
        '--disable-infobars',
        '--disable-features=TranslateUI',
        '--no-first-run',
    ]
)
page = browser.new_page(viewport={'width': 1920, 'height': 1080})
page.goto('${FRONTEND_URL}')
page.wait_for_load_state('networkidle')
print('[stream] Browser loaded.', flush=True)
while True:
    time.sleep(60)
" 2>/dev/null &
PIDS+=($!)

echo "[stream] Waiting for browser to load..."
sleep 12

# 5. ffmpeg: capture Xvfb, crop Chrome UI (top ~90px), stream to YouTube RTMP
echo "[stream] Starting ffmpeg -> YouTube RTMP..."
DISPLAY="${DISPLAY_NUM}" ffmpeg -loglevel warning \
  -f x11grab -video_size "${XVFB_RES}" -framerate "${FPS}" -i "${DISPLAY_NUM}" \
  -f pulse -i "${AUDIO_SINK}.monitor" \
  -vf "crop=1920:1080:0:90" \
  -c:v libx264 -preset veryfast -maxrate 4500k -bufsize 9000k \
    -pix_fmt yuv420p -g $((FPS * 2)) \
  -c:a aac -b:a 128k -ar 44100 \
  -f flv \
  "${RTMP_URL}" &
PIDS+=($!)

echo "[stream] Live on YouTube! Press Ctrl+C to stop."
wait
