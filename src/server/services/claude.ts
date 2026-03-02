import Anthropic from '@anthropic-ai/sdk'

export class ClaudeService {
  private client: Anthropic
  private systemPrompt: string
  private conversationHistory: Anthropic.MessageParam[] = []
  private maxHistory = 20

  constructor(apiKey: string, systemPrompt: string) {
    this.client = new Anthropic({ apiKey })
    this.systemPrompt = systemPrompt
  }

  async respond(userName: string, userMessage: string): Promise<string> {
    const prompt = `${userName}さんからのコメント: ${userMessage}`

    this.conversationHistory.push({ role: 'user', content: prompt })

    if (this.conversationHistory.length > this.maxHistory) {
      this.conversationHistory = this.conversationHistory.slice(-this.maxHistory)
    }

    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system: this.systemPrompt,
      messages: this.conversationHistory,
    })

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')

    this.conversationHistory.push({ role: 'assistant', content: text })

    return text
  }

  clearHistory(): void {
    this.conversationHistory = []
  }
}
