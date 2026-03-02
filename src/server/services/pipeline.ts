import { EventEmitter } from 'events'
import { execFile } from 'child_process'
import { writeFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { ClaudeService } from './claude.js'
import type { TtsService } from './tts.js'
import type { MinecraftBridgeService } from './minecraft-bridge.js'
import { ChatQueue } from '../queue/chat-queue.js'
import type { SpeechEvent } from '../../shared/types.js'

export class Pipeline extends EventEmitter {
  private claude: ClaudeService
  private tts: TtsService
  private queue: ChatQueue
  private processing = false
  private serverAudio: boolean
  private mcBridge: MinecraftBridgeService | null = null

  constructor(claude: ClaudeService, tts: TtsService, serverAudio = false) {
    super()
    this.claude = claude
    this.tts = tts
    this.queue = new ChatQueue()
    this.serverAudio = serverAudio
  }

  setMcBridge(bridge: MinecraftBridgeService): void {
    this.mcBridge = bridge
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
      const gameContext = this.mcBridge?.formatStateContext()
      const claudeResponse = await this.claude.respond(item.userName, item.message, gameContext)

      // Send game command if Claude decided to act
      if (claudeResponse.command && this.mcBridge) {
        this.mcBridge.sendCommand(claudeResponse.command).catch(() => {})
      }

      const audioBuffer = await this.tts.synthesize(claudeResponse.speech)
      const audioBase64 = audioBuffer.toString('base64')

      const event: SpeechEvent = {
        type: 'speech',
        userName: item.userName,
        userMessage: item.message,
        aiResponse: claudeResponse.speech,
        audioBase64,
      }

      // Play audio server-side for streaming (PulseAudio capture)
      if (this.serverAudio) {
        this.playAudioServerSide(audioBuffer)
      }

      this.emit('speech', event)
    } catch (err) {
      this.emit('error', err)
    }
  }

  onPlaybackDone(): void {
    this.processNext()
  }

  private playAudioServerSide(audioBuffer: Buffer): void {
    const wavPath = join(tmpdir(), `aituber_${Date.now()}.wav`)
    writeFile(wavPath, audioBuffer).then(() => {
      execFile('paplay', [wavPath], (err) => {
        unlink(wavPath).catch(() => {})
        if (err) console.error('[pipeline] paplay error:', err.message)
      })
    })
  }

  get queueLength(): number {
    return this.queue.length
  }
}
