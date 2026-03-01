import { EventEmitter } from 'events'
import { ClaudeService } from './claude.js'
import { VoicevoxService } from './voicevox.js'
import { ChatQueue } from '../queue/chat-queue.js'
import type { SpeechEvent } from '../../shared/types.js'

export class Pipeline extends EventEmitter {
  private claude: ClaudeService
  private voicevox: VoicevoxService
  private queue: ChatQueue
  private processing = false

  constructor(claude: ClaudeService, voicevox: VoicevoxService) {
    super()
    this.claude = claude
    this.voicevox = voicevox
    this.queue = new ChatQueue()
  }

  enqueue(userName: string, message: string): void {
    this.queue.add({ userName, message, timestamp: Date.now() })
    if (!this.processing) {
      this.processNext()
    }
  }

  private async processNext(): Promise<void> {
    const item = this.queue.dequeue()
    if (!item) {
      this.processing = false
      return
    }

    this.processing = true

    try {
      const aiResponse = await this.claude.respond(item.userName, item.message)

      const audioBuffer = await this.voicevox.synthesize(aiResponse)
      const audioBase64 = audioBuffer.toString('base64')

      const event: SpeechEvent = {
        type: 'speech',
        userName: item.userName,
        userMessage: item.message,
        aiResponse,
        audioBase64,
      }

      this.emit('speech', event)
    } catch (err) {
      this.emit('error', err)
    }
  }

  onPlaybackDone(): void {
    this.processNext()
  }

  get queueLength(): number {
    return this.queue.length
  }
}
