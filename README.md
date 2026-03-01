# AITuber

YouTube Live のコメントに AI が応答する VTuber システム。
Claude（会話生成）+ Kokoro TTS（音声合成）+ Live2D（アバター）で構成。

## アーキテクチャ

```
YouTube Live コメント
    ↓
Fastify サーバー → Claude API → Kokoro TTS → WebSocket
                                                  ↓
                                        ブラウザ (Vite + React)
                                        Live2D + リップシンク + 字幕
                                                  ↓
                                            OBS → YouTube Live
```

## セットアップ

```bash
# 依存インストール
pnpm install

# 環境変数
cp .env.example .env
# .env を編集: ANTHROPIC_API_KEY を設定

# TTS エンジン起動
docker compose up kokoro -d

# 開発サーバー起動
pnpm dev
```

ブラウザで http://localhost:5173 を開き、Start をクリック。

## テスト用チャット

YouTube Live がなくても API でテストできる:

```bash
curl -X POST http://localhost:3001/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"userName":"テスト","message":"こんにちは！"}'
```

## YouTube Live 連携

`.env` に YouTube チャンネル ID を設定:

```
YOUTUBE_CHANNEL_ID=UCxxxxxx
```

配信中のライブチャットを自動取得してAIが応答する。API Key は不要。

## OBS 設定

1. OBS で「ブラウザソース」を追加
2. URL: `http://localhost:5173`
3. 幅: 1920、高さ: 1080

## TTS エンジン

環境変数 `TTS_ENGINE` で切り替え:

| エンジン | 特徴 | 設定 |
|---|---|---|
| **Kokoro** (デフォルト) | CPU で高速（~1.4秒）、82M パラメータ | `TTS_ENGINE=kokoro` |
| **VOICEVOX** | 高品質、GPU 推奨 | `TTS_ENGINE=voicevox` |

## 技術スタック

- **バックエンド**: Fastify + WebSocket
- **フロントエンド**: Vite + React
- **AI 会話**: Claude (claude-sonnet-4-20250514)
- **音声合成**: Kokoro TTS / VOICEVOX (Docker)
- **アバター**: PixiJS v7 + pixi-live2d-display (Cubism 4)
- **チャット取得**: youtube-chat

## ロードマップ

- [x] 雑談配信 — コメント応答の基本パイプライン
- [ ] 画面実況 — Claude Vision でスクリーンショットを認識し実況
- [ ] ゲーム実況（観戦） — ゲーム画面をキャプチャして AI がリアクション
- [ ] ゲームプレイ — AI がターン制ゲームを操作
