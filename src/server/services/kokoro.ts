import type { TtsService } from './tts.js'

export class KokoroService implements TtsService {
  private baseUrl: string
  private voice: string
  private speed: number

  constructor(baseUrl: string, voice = 'jf_alpha', speed = 1.0) {
    this.baseUrl = baseUrl
    this.voice = voice
    this.speed = speed
  }

  async synthesize(text: string): Promise<Buffer> {
    const res = await fetch(`${this.baseUrl}/v1/audio/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'kokoro',
        input: text,
        voice: this.voice,
        response_format: 'wav',
        speed: this.speed,
      }),
    })
    if (!res.ok) {
      throw new Error(`Kokoro synthesis failed: ${res.status}`)
    }
    return Buffer.from(await res.arrayBuffer())
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/v1/audio/voices`)
      return res.ok
    } catch {
      return false
    }
  }
}
