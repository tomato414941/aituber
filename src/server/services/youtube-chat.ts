import { LiveChat } from 'youtube-chat'
import { EventEmitter } from 'events'

export interface ChatMessage {
  id: string
  userName: string
  message: string
  timestamp: number
}

export class YouTubeChatService extends EventEmitter {
  private liveChat: LiveChat | null = null
  private channelId: string

  constructor(channelId: string) {
    super()
    this.channelId = channelId
  }

  async start(): Promise<boolean> {
    this.liveChat = new LiveChat({ channelId: this.channelId })

    this.liveChat.on('chat', (chatItem) => {
      const msg: ChatMessage = {
        id: chatItem.id,
        userName: chatItem.author.name,
        message: chatItem.message
          .map((m) => ('text' in m ? m.text : ''))
          .join(''),
        timestamp: Date.now(),
      }
      if (msg.message.trim()) {
        this.emit('message', msg)
      }
    })

    this.liveChat.on('error', (err) => {
      this.emit('error', err)
    })

    return this.liveChat.start()
  }

  stop(): void {
    this.liveChat?.stop()
  }
}
