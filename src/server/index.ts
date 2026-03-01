import Fastify from 'fastify'
import cors from '@fastify/cors'
import websocket from '@fastify/websocket'
import { loadConfig } from './config.js'
import { healthRoutes } from './routes/health.js'
import { createWsRoutes } from './routes/ws.js'
import { ClaudeService } from './services/claude.js'
import { VoicevoxService } from './services/voicevox.js'
import { YouTubeChatService } from './services/youtube-chat.js'
import { Pipeline } from './services/pipeline.js'

const config = loadConfig()

const app = Fastify({ logger: true })

await app.register(cors)
await app.register(websocket)
await app.register(healthRoutes)

// Services
const claude = new ClaudeService(config.anthropicApiKey, config.systemPrompt)
const voicevox = new VoicevoxService(config.voicevoxUrl, config.voicevoxSpeaker)
const pipeline = new Pipeline(claude, voicevox)

pipeline.on('error', (err) => {
  app.log.error(err, 'Pipeline error')
})

await app.register(createWsRoutes(pipeline))

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

// VOICEVOX health check
const voicevoxOk = await voicevox.healthCheck()
if (voicevoxOk) {
  app.log.info('VOICEVOX connected')
} else {
  app.log.warn('VOICEVOX not available at ' + config.voicevoxUrl)
}

await app.listen({ port: config.port, host: '0.0.0.0' })
