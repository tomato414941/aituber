import Anthropic from '@anthropic-ai/sdk'

export interface McCommandParsed {
  action: string
  params: Record<string, unknown>
}

export interface ClaudeResponse {
  speech: string
  command?: McCommandParsed
}

export class ClaudeService {
  private client: Anthropic
  private systemPrompt: string
  private conversationHistory: Anthropic.MessageParam[] = []
  private maxHistory = 20

  constructor(apiKey: string, systemPrompt: string) {
    this.client = new Anthropic({ apiKey })
    this.systemPrompt = systemPrompt
  }

  async respond(userName: string, userMessage: string, gameContext?: string): Promise<ClaudeResponse> {
    const prompt = `${userName}さんからのコメント: ${userMessage}`

    this.conversationHistory.push({ role: 'user', content: prompt })

    if (this.conversationHistory.length > this.maxHistory) {
      this.conversationHistory = this.conversationHistory.slice(-this.maxHistory)
    }

    // Build system prompt with optional game context
    let system = this.systemPrompt
    if (gameContext) {
      system += `\n\n## 現在のゲーム状態\n${gameContext}`
    }

    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system,
      messages: this.conversationHistory,
    })

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')

    this.conversationHistory.push({ role: 'assistant', content: text })

    return parseClaudeResponse(text)
  }

  clearHistory(): void {
    this.conversationHistory = []
  }
}

function parseClaudeResponse(text: string): ClaudeResponse {
  // Try parsing as JSON (structured response with speech + command)
  try {
    let cleaned = text.trim()
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }
    const parsed = JSON.parse(cleaned)
    if (parsed.speech) {
      return {
        speech: parsed.speech,
        command: parsed.command ?? undefined,
      }
    }
  } catch {
    // Not JSON, treat as plain speech
  }
  return { speech: text }
}
