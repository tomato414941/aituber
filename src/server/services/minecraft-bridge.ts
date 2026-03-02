import { EventEmitter } from 'events'
import type { McGameState } from '../../shared/types.js'

export interface McGameEvent {
  type: string
  data: Record<string, unknown>
  timestamp: number
}

export interface McCommand {
  action: string
  params: Record<string, unknown>
}

export class MinecraftBridgeService extends EventEmitter {
  private baseUrl: string
  private state: McGameState | null = null
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private sseAbort: AbortController | null = null

  constructor(baseUrl: string) {
    super()
    this.baseUrl = baseUrl
  }

  async start(): Promise<boolean> {
    const ok = await this.healthCheck()
    if (!ok) return false

    this.pollTimer = setInterval(() => this.pollState(), 3000)
    this.connectEvents()
    return true
  }

  stop(): void {
    if (this.pollTimer) clearInterval(this.pollTimer)
    this.sseAbort?.abort()
  }

  get currentState(): McGameState | null {
    return this.state
  }

  formatStateContext(): string {
    const s = this.state
    if (!s) return 'Minecraft: ボットに接続中...'

    const lines = [
      `HP: ${s.health}/20 | 食料: ${s.food}/20`,
      `座標: (${s.position.x}, ${s.position.y}, ${s.position.z})`,
      `時間: ${s.time.isDay ? '昼' : '夜'} | 天気: ${s.isRaining ? '雨' : '晴れ'}`,
    ]

    if (s.inventory.length > 0) {
      const items = s.inventory.slice(0, 10).map((i) => `${i.name}x${i.count}`).join(', ')
      lines.push(`インベントリ: ${items}`)
    } else {
      lines.push('インベントリ: 空')
    }

    const hostiles = s.nearbyEntities.filter((e) => e.hostile)
    if (hostiles.length > 0) {
      lines.push(`⚠ 敵: ${hostiles.map((e) => `${e.name}(${e.distance}m)`).join(', ')}`)
    }

    return lines.join('\n')
  }

  async sendCommand(command: McCommand): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(command),
        signal: AbortSignal.timeout(5000),
      })
      return res.ok
    } catch {
      return false
    }
  }

  private async pollState(): Promise<void> {
    try {
      const res = await fetch(`${this.baseUrl}/api/state`, {
        signal: AbortSignal.timeout(3000),
      })
      if (!res.ok) return
      const data = await res.json()
      if (data.health !== undefined) {
        this.state = data as McGameState
        this.emit('state', this.state)
      }
    } catch {
      // ignore poll failures
    }
  }

  private connectEvents(): void {
    this.sseAbort = new AbortController()
    this.startSSE(this.sseAbort.signal)
  }

  private async startSSE(signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      try {
        const res = await fetch(`${this.baseUrl}/api/events`, { signal })
        if (!res.ok || !res.body) break

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          const lines = buffer.split('\n\n')
          buffer = lines.pop() ?? ''

          for (const chunk of lines) {
            const dataLine = chunk.split('\n').find((l) => l.startsWith('data: '))
            if (!dataLine) continue
            try {
              const event = JSON.parse(dataLine.slice(6)) as McGameEvent
              if (event.type !== 'connected') {
                this.emit('game-event', event)
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      } catch {
        if (signal.aborted) return
        // Reconnect after delay
        await new Promise((r) => setTimeout(r, 5000))
      }
    }
  }

  private async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(3000),
      })
      return res.ok
    } catch {
      return false
    }
  }
}
