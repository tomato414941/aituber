export interface TtsService {
  synthesize(text: string): Promise<Buffer>
  healthCheck(): Promise<boolean>
}
