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

export type WsClientMessage = PlaybackDoneEvent
export type WsServerMessage = SpeechEvent
