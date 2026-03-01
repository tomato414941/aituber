import { useState, useEffect, useCallback } from 'react'
import { Live2DCanvas } from './components/Live2DCanvas.js'
import { ChatOverlay } from './components/ChatOverlay.js'
import { useWebSocket } from './hooks/useWebSocket.js'
import { useAudioPlayer } from './hooks/useAudioPlayer.js'
import type { Live2DModel } from 'pixi-live2d-display-lipsyncpatch'
import type { SpeechEvent } from '../shared/types.js'

const MODEL_PATH = '/models/hiyori/hiyori_pro_t10.model3.json'

export function App() {
  const [model, setModel] = useState<Live2DModel | null>(null)
  const [currentEvent, setCurrentEvent] = useState<SpeechEvent | null>(null)
  const [started, setStarted] = useState(false)
  const { connected, lastEvent, sendPlaybackDone } = useWebSocket(
    `ws://${location.host}/ws`,
  )
  const { playAudio } = useAudioPlayer()

  const onModelReady = useCallback((m: Live2DModel) => {
    setModel(m)
  }, [])

  useEffect(() => {
    if (!lastEvent || !started) return
    setCurrentEvent(lastEvent)
    playAudio(lastEvent.audioBase64, model, () => {
      sendPlaybackDone()
    })
  }, [lastEvent, model, started, playAudio, sendPlaybackDone])

  if (!started) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
        }}
      >
        <h1 style={{ fontSize: 48 }}>AITuber</h1>
        <p style={{ color: connected ? '#6f6' : '#f66' }}>
          Server: {connected ? 'Connected' : 'Disconnected'}
        </p>
        <button
          onClick={() => setStarted(true)}
          style={{
            padding: '16px 48px',
            fontSize: 20,
            borderRadius: 12,
            border: 'none',
            background: '#4f46e5',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          Start
        </button>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Live2DCanvas
        modelPath={MODEL_PATH}
        width={window.innerWidth}
        height={window.innerHeight}
        onModelReady={onModelReady}
      />
      {currentEvent && (
        <ChatOverlay
          userName={currentEvent.userName}
          userMessage={currentEvent.userMessage}
          aiResponse={currentEvent.aiResponse}
        />
      )}
      <div
        style={{
          position: 'absolute',
          top: 8,
          right: 12,
          fontSize: 12,
          color: connected ? '#6f6' : '#f66',
        }}
      >
        {connected ? 'Connected' : 'Disconnected'}
      </div>
    </div>
  )
}
