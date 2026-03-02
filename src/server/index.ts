import Fastify from 'fastify'
import cors from '@fastify/cors'
import websocket from '@fastify/websocket'
import { loadConfig } from './config.js'
import { healthRoutes } from './routes/health.js'
import { createWsRoutes } from './routes/ws.js'
import { createChatRoutes } from './routes/chat.js'
import { ClaudeService } from './services/claude.js'
import { KokoroService } from './services/kokoro.js'
import { VoicevoxService } from './services/voicevox.js'
import { YouTubeChatService } from './services/youtube-chat.js'
import { MinecraftBridgeService } from './services/minecraft-bridge.js'
import { Pipeline } from './services/pipeline.js'
import type { TtsService } from './services/tts.js'

const config = loadConfig()

const app = Fastify({ logger: true })

await app.register(cors)
await app.register(websocket)
await app.register(healthRoutes)

// TTS engine selection
let tts: TtsService
if (config.ttsEngine === 'kokoro') {
  tts = new KokoroService(config.kokoroUrl, config.kokoroVoice)
  app.log.info(`TTS engine: Kokoro (${config.kokoroUrl}, voice: ${config.kokoroVoice})`)
} else {
  tts = new VoicevoxService(config.voicevoxUrl, config.voicevoxSpeaker)
  app.log.info(`TTS engine: VOICEVOX (${config.voicevoxUrl}, speaker: ${config.voicevoxSpeaker})`)
}

// System prompt: switch to MC mode if MC_BOT_URL is set
const mcMode = !!config.mcBotUrl
const systemPrompt = mcMode
  ? `あなたは元気で明るいVTuberの「あいちゃん」です。
今、Minecraftをプレイしながら YouTube Live で配信しています。

## あなたにできること
視聴者のコメントに返答しつつ、必要に応じてゲーム内で行動できます。

利用可能なアクション:
- gather: 素材集め (target: ブロック名, count: 数)
- craft: クラフト (target: アイテム名, count: 数)
- eat: 食事 (target: 食べ物名)
- combat: 戦闘 (target: モブ名, mode: "fight"/"flee")
- shelter: シェルター建設
- explore: 探索 (direction: 方角, count: 距離)

## 応答形式
必ず以下の JSON で返してください:
{"speech": "視聴者に話す内容", "command": {"action": "...", "params": {...}}}
command は不要な場合は省略してください。
短く元気に、1-2文で返してください。`
  : config.systemPrompt

// Services
const claude = new ClaudeService(config.anthropicApiKey, systemPrompt)
const serverAudio = process.env.SERVER_AUDIO === 'true'
const pipeline = new Pipeline(claude, tts, serverAudio)
if (serverAudio) {
  app.log.info('Server-side audio playback enabled (PulseAudio)')
}

// Minecraft integration (optional)
if (config.mcBotUrl) {
  const mcBridge = new MinecraftBridgeService(config.mcBotUrl)
  pipeline.setMcBridge(mcBridge)

  const EVENT_MESSAGES: Record<string, (data: Record<string, unknown>) => string> = {
    death: () => '[ゲーム] ボットが死亡しました！リスポーン中...',
    low_health: (d) => `[ゲーム] HPが低い！(${d.health}/20)`,
    low_food: (d) => `[ゲーム] お腹が空いてきた！(${d.food}/20)`,
    combat_win: (d) => `[ゲーム] ${d.target ?? 'モブ'}を倒しました！`,
  }

  mcBridge.on('game-event', (event: { type: string; data: Record<string, unknown> }) => {
    const formatter = EVENT_MESSAGES[event.type]
    if (formatter) {
      pipeline.enqueue('[MC]', formatter(event.data))
    }
  })

  mcBridge.on('state', () => {
    pipeline.emit('game-state', mcBridge.currentState)
  })

  const mcOk = await mcBridge.start()
  if (mcOk) {
    app.log.info(`Minecraft bridge connected (${config.mcBotUrl})`)
  } else {
    app.log.warn(`Minecraft bridge failed to connect (${config.mcBotUrl})`)
  }
} else {
  app.log.info('MC_BOT_URL not set, Minecraft integration disabled')
}

pipeline.on('error', (err) => {
  app.log.error(err, 'Pipeline error')
})

await app.register(createWsRoutes(pipeline))
await app.register(createChatRoutes(pipeline))

// YouTube Chat (optional: only starts if channelId is set)
if (config.youtubeChannelId) {
  const ytChat = new YouTubeChatService(config.youtubeChannelId)
  ytChat.on('message', (msg) => {
    app.log.info({ userName: msg.userName, message: msg.message }, 'YouTube chat')
    pipeline.enqueue(msg.userName, msg.message)
  })
  ytChat.on('error', (err) => {
    app.log.error(err, 'YouTube chat error')
  })
  const ok = await ytChat.start()
  if (ok) {
    app.log.info('YouTube chat connected')
  } else {
    app.log.warn('YouTube chat failed to start (no active stream?)')
  }
} else {
  app.log.info('YOUTUBE_CHANNEL_ID not set, YouTube chat disabled')
}

// TTS health check
const ttsOk = await tts.healthCheck()
if (ttsOk) {
  app.log.info('TTS engine connected')
} else {
  app.log.warn('TTS engine not available')
}

await app.listen({ port: config.port, host: '0.0.0.0' })
