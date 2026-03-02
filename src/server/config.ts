import 'dotenv/config'

export function loadConfig() {
  return {
    port: parseInt(process.env.PORT || '3001', 10),
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    youtubeChannelId: process.env.YOUTUBE_CHANNEL_ID || '',
    ttsEngine: (process.env.TTS_ENGINE || 'kokoro') as 'kokoro' | 'voicevox',
    // Kokoro
    kokoroUrl: process.env.KOKORO_URL || 'http://localhost:8880',
    kokoroVoice: process.env.KOKORO_VOICE || 'jf_alpha',
    // VOICEVOX
    voicevoxUrl: process.env.VOICEVOX_URL || 'http://localhost:50021',
    voicevoxSpeaker: parseInt(process.env.VOICEVOX_SPEAKER || '1', 10),
    // Minecraft integration
    mcBotUrl: process.env.MC_BOT_URL || '',
    mcViewerUrl: process.env.MC_VIEWER_URL || 'http://localhost:3000',
    // Character
    systemPrompt:
      process.env.SYSTEM_PROMPT ||
      'あなたは元気で明るいVTuberの「あいちゃん」です。視聴者のコメントに楽しく返答してください。短い文で、1-2文程度で返してください。',
  }
}

export type Config = ReturnType<typeof loadConfig>
