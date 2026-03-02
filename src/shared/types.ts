export interface SpeechEvent {
  type: 'speech'
  userName: string
  userMessage: string
  aiResponse: string
  audioBase64: string
}

export interface PlaybackDoneEvent {
  type: 'playback_done'
}

export interface McGameState {
  health: number
  food: number
  position: { x: number; y: number; z: number }
  time: { timeOfDay: number; isDay: boolean }
  inventory: { name: string; count: number }[]
  nearbyEntities: { name: string; type: string; distance: number; hostile: boolean }[]
  nearbyBlocks: string[]
  isRaining: boolean
  biome: string
}

export interface GameStateEvent {
  type: 'game_state'
  state: McGameState
}

export type WsClientMessage = PlaybackDoneEvent
export type WsServerMessage = SpeechEvent | GameStateEvent
