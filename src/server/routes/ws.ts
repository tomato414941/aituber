import type { FastifyPluginAsync } from 'fastify'
import type { Pipeline } from '../services/pipeline.js'
import type { WsClientMessage } from '../../shared/types.js'

export function createWsRoutes(pipeline: Pipeline): FastifyPluginAsync {
  return async (app) => {
    app.get('/ws', { websocket: true }, (socket) => {
      app.log.info('WebSocket client connected')

      const onSpeech = (event: unknown) => {
        socket.send(JSON.stringify(event))
      }
      pipeline.on('speech', onSpeech)

      socket.on('message', (raw: Buffer) => {
        try {
          const msg = JSON.parse(raw.toString()) as WsClientMessage
          if (msg.type === 'playback_done') {
            pipeline.onPlaybackDone()
          }
        } catch {
          // ignore parse errors
        }
      })

      socket.on('close', () => {
        pipeline.off('speech', onSpeech)
      })
    })
  }
}
