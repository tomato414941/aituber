import type { FastifyPluginAsync } from 'fastify'
import type { Pipeline } from '../services/pipeline.js'

export function createChatRoutes(pipeline: Pipeline): FastifyPluginAsync {
  return async (app) => {
    app.post<{ Body: { userName?: string; message: string } }>(
      '/api/chat',
      async (req, reply) => {
        const { userName = 'テスト', message } = req.body
        if (!message) {
          return reply.status(400).send({ error: 'message is required' })
        }
        pipeline.enqueue(userName, message)
        return { ok: true, queueLength: pipeline.queueLength }
      },
    )
  }
}
