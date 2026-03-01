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

// Services
const claude = new ClaudeService(config.anthropicApiKey, config.systemPrompt)
const pipeline = new Pipeline(claude, tts)

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
