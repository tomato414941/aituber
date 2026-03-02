# aituber

VTuber AI 配信システム（Vite + React フロントエンド / Fastify バックエンド）

## Tech Stack

- Frontend: React 19 + Vite 7 + PixiJS + Live2D (lip-sync)
- Backend: Fastify 5 + TypeScript
- AI: Claude API (claude-sonnet-4-6)
- TTS: Kokoro (default) / VOICEVOX (pluggable)
- Package Manager: pnpm

## Secrets

- `.env` に API キーを設定（命名規約はグローバル AGENTS.md に従う）
- `ANTHROPIC_API_KEY`: Claude API key
- `YOUTUBE_STREAM_KEY`: YouTube RTMP stream key
- `YOUTUBE_CHANNEL_ID`: YouTube channel ID

## Development

```bash
pnpm install
docker compose up kokoro -d    # Start TTS engine (port 8880)
pnpm dev                       # Start dev server (backend:3001 + frontend:5173)
```

### Manual chat test (without YouTube)

```bash
curl -X POST http://localhost:3001/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"userName":"テスト","message":"こんにちは！"}'
```

## YouTube Live Streaming

### Prerequisites

- Xvfb, ffmpeg, PulseAudio (`apt install xvfb ffmpeg pulseaudio pulseaudio-utils`)
- Playwright (`pip install playwright && playwright install chromium`)
- Kokoro TTS running (`docker compose up kokoro -d`)
- `.env` に `YOUTUBE_STREAM_KEY` を設定

### Start streaming

```bash
pnpm stream              # YouTube Live
pnpm stream:local        # Local recording (for testing)
```

### Streaming flow

1. PulseAudio null sink を作成（音声キャプチャ用）
2. `SERVER_AUDIO=true` で dev server を起動（音声をサーバーサイドで再生）
3. Xvfb を :99 で起動（仮想ディスプレイ）
4. Playwright headed mode でブラウザを起動（SwiftShader WebGL）
5. ffmpeg で x11grab + PulseAudio → RTMP 配信

### YouTube Studio setup

- YouTube Studio > ライブ配信 > 管理 でストリームキーを取得
- **「自動開始を有効にする」を ON** にすると RTMP 受信時に自動でライブ開始される
  - この設定は「予約配信」で表示される（通常の配信では表示されない）
  - OFF の場合は YouTube Studio で手動で「ライブ配信を開始」を押す必要あり

### Troubleshooting

- `thread_queue_size` 警告: ffmpeg の入力バッファ不足。`-thread_queue_size 64` で対策済み
- YouTube プレビュー表示まで 10-30 秒かかる。すぐに止めないこと
- Kokoro TTS が落ちている場合: `docker start kokoro-tts` で再起動
- Pipeline がハングした場合: dev server を再起動する（processing フラグのリセット）

## Architecture

```
YouTube Live Comments → ChatQueue → Claude → Kokoro TTS → WebSocket → Browser (Live2D lip-sync)
                                                        ↘ PulseAudio → ffmpeg → YouTube RTMP
```
