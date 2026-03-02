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

# 3. Start Playwright video recording + audio capture + ffmpeg mux
echo "[stream] Starting browser + streaming pipeline..."

if [ "$MODE" = "youtube" ]; then
  python3 "${SCRIPT_DIR}/stream_worker.py" --rtmp "${RTMP_URL}" --sink "${AUDIO_SINK}" --url "${FRONTEND_URL}" &
  PIDS+=($!)
  echo "[stream] Live on YouTube! Press Ctrl+C to stop."
else
  DURATION="${2:-30}"
  python3 "${SCRIPT_DIR}/stream_worker.py" --local "${DURATION}" --sink "${AUDIO_SINK}" --url "${FRONTEND_URL}" &
  PIDS+=($!)
  echo "[stream] Recording ${DURATION}s..."
fi

wait
