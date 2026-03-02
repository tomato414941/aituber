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
RESOLUTION="1920x1080"
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

# 2. Xvfb
echo "[stream] Starting Xvfb on ${DISPLAY_NUM}..."
Xvfb "${DISPLAY_NUM}" -screen 0 "${RESOLUTION}x24" -ac 2>/dev/null &
PIDS+=($!)
sleep 1

# 3. Dev server (if not already running)
if ! curl -sf "http://localhost:${SERVER_PORT}/health" > /dev/null 2>&1; then
  echo "[stream] Starting dev server..."
  cd "$PROJECT_DIR"
  pnpm dev > /tmp/aituber-dev.log 2>&1 &
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

# 4. Chromium via Playwright (headed mode on Xvfb for WebGL support)
echo "[stream] Starting browser via Playwright..."
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
import time as _t; _t.sleep(3)
# Enter fullscreen via CDP
cdp = page.context.new_cdp_session(page)
wid = cdp.send('Browser.getWindowForTarget')['windowId']
cdp.send('Browser.setWindowBounds', {'windowId': wid, 'bounds': {'windowState': 'fullscreen'}})
_t.sleep(1)
print('[stream] Browser loaded (fullscreen).')
while True:
    time.sleep(60)
" > /dev/null 2>&1 &
PIDS+=($!)

echo "[stream] Waiting for browser to load..."
sleep 10

# 5. ffmpeg
if [ "$MODE" = "youtube" ]; then
  echo "[stream] Starting ffmpeg -> YouTube RTMP..."
  DISPLAY="${DISPLAY_NUM}" ffmpeg -loglevel warning \
    -f x11grab -video_size "${RESOLUTION}" -framerate "${FPS}" -i "${DISPLAY_NUM}" \
    -f pulse -i "${AUDIO_SINK}.monitor" \
    -c:v libx264 -preset veryfast -maxrate 4500k -bufsize 9000k \
      -pix_fmt yuv420p -g $((FPS * 2)) \
    -c:a aac -b:a 128k -ar 44100 \
    -f flv \
    "${RTMP_URL}" &
  PIDS+=($!)
  echo "[stream] Live on YouTube! Press Ctrl+C to stop."
else
  OUTPUT="/tmp/test_stream.mp4"
  DURATION="${2:-30}"
  echo "[stream] Recording ${DURATION}s to ${OUTPUT}..."
  DISPLAY="${DISPLAY_NUM}" ffmpeg -loglevel warning \
    -f x11grab -video_size "${RESOLUTION}" -framerate "${FPS}" -i "${DISPLAY_NUM}" \
    -f pulse -i "${AUDIO_SINK}.monitor" \
    -c:v libx264 -preset veryfast -pix_fmt yuv420p \
    -c:a aac -b:a 128k -ar 44100 \
    -t "${DURATION}" \
    "${OUTPUT}" -y
  echo "[stream] Recording saved to ${OUTPUT}"
  exit 0
fi

wait
