import type { TtsService } from './tts.js'

export class VoicevoxService implements TtsService {
  private baseUrl: string
  private speaker: number

  constructor(baseUrl: string, speaker: number) {
    this.baseUrl = baseUrl
    this.speaker = speaker
  }

  async synthesize(text: string): Promise<Buffer> {
    const queryRes = await fetch(
      `${this.baseUrl}/audio_query?text=${encodeURIComponent(text)}&speaker=${this.speaker}`,
      { method: 'POST' },
    )
    if (!queryRes.ok) {
      throw new Error(`VOICEVOX audio_query failed: ${queryRes.status}`)
    }
    const query = await queryRes.json()

    query.speedScale = 1.2

    const synthRes = await fetch(
      `${this.baseUrl}/synthesis?speaker=${this.speaker}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(query),
      },
    )
    if (!synthRes.ok) {
      throw new Error(`VOICEVOX synthesis failed: ${synthRes.status}`)
    }

    return Buffer.from(await synthRes.arrayBuffer())
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/speakers`)
      return res.ok
    } catch {
      return false
    }
  }
}
