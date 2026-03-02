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

USE_API=false
BROADCAST_ID=""

if [ "$MODE" = "youtube" ]; then
  if [ -f "$HOME/.secrets/youtube" ]; then
    # API mode: create broadcast automatically
    echo "[stream] Creating YouTube broadcast via API..."
    BROADCAST_OUTPUT=$(cd "$PROJECT_DIR" && npx tsx scripts/broadcast.ts create)
    eval "$BROADCAST_OUTPUT"
    RTMP_URL="rtmp://a.rtmp.youtube.com/live2/${STREAM_KEY}"
    USE_API=true
    echo "[stream] Broadcast: ${BROADCAST_ID}"
    echo "[stream] Stream key obtained via API"
  else
    # Legacy mode: manual stream key from .env
    STREAM_KEY="${YOUTUBE_STREAM_KEY:?YOUTUBE_STREAM_KEY is not set. Run 'pnpm youtube:auth' or set YOUTUBE_STREAM_KEY in .env}"
    RTMP_URL="rtmp://a.rtmp.youtube.com/live2/${STREAM_KEY}"
    echo "[stream] Using manual stream key from .env"
  fi
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
  # End broadcast via API
  if [ "$USE_API" = "true" ] && [ -n "$BROADCAST_ID" ]; then
    echo "[stream] Ending broadcast..."
    cd "$PROJECT_DIR" && npx tsx scripts/broadcast.ts complete "$BROADCAST_ID" 2>/dev/null || true
  fi
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
  -thread_queue_size 64 \
  -f x11grab -video_size "${XVFB_RES}" -framerate "${FPS}" -i "${DISPLAY_NUM}" \
  -thread_queue_size 64 \
  -f pulse -i "${AUDIO_SINK}.monitor" \
  -vf "crop=1920:1080:0:90" \
  -c:v libx264 -preset veryfast -maxrate 4500k -bufsize 9000k \
    -pix_fmt yuv420p -g $((FPS * 2)) \
  -c:a aac -b:a 128k -ar 44100 \
  -f flv \
  "${RTMP_URL}" &
PIDS+=($!)

# 6. Transition broadcast to live (API mode only)
if [ "$USE_API" = "true" ]; then
  echo "[stream] Waiting for stream to become active, then going live..."
  cd "$PROJECT_DIR" && npx tsx scripts/broadcast.ts live "$BROADCAST_ID" &
  PIDS+=($!)
fi

echo "[stream] Live on YouTube! Press Ctrl+C to stop."
echo "[stream] Note: YouTube preview may take 10-30s to appear."
wait
