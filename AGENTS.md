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
- `YOUTUBE_STREAM_KEY`: YouTube RTMP stream key（API モード未設定時のフォールバック）
- `YOUTUBE_CHANNEL_ID`: YouTube channel ID
- `~/.secrets/youtube`: YouTube OAuth2 credentials（API モード用、chmod 600）

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

### YouTube API automation (recommended)

CLI から完全自動で配信開始・終了できる。初回のみセットアップが必要:

1. Google Cloud Console でプロジェクト作成
2. YouTube Data API v3 を有効化
3. OAuth 同意画面設定（テストユーザーに自分を追加）
4. OAuth2 クライアント ID 作成（Web アプリ、リダイレクト URI: `http://localhost:8085/callback`）
5. `pnpm youtube:auth` で認証 → `~/.secrets/youtube` に保存

セットアップ後は `pnpm stream` だけで broadcast 作成 → RTMP 送信 → ライブ遷移 → 終了時に complete が自動実行される。

### Legacy mode (YouTube Studio manual)

`~/.secrets/youtube` がない場合は `.env` の `YOUTUBE_STREAM_KEY` を使う従来モード。
YouTube Studio で手動で「ライブ配信を開始」を押す必要あり。

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
