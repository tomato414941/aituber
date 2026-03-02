import { useState, useEffect, useCallback } from 'react'
import { Live2DCanvas } from './Live2DCanvas.js'
import { ChatOverlay } from './ChatOverlay.js'
import { McOverlay } from './McOverlay.js'
import { useWebSocket } from '../hooks/useWebSocket.js'
import { useAudioPlayer } from '../hooks/useAudioPlayer.js'
import type { Live2DModel } from 'pixi-live2d-display-lipsyncpatch/cubism4'
import type { SpeechEvent } from '../../shared/types.js'

// MC viewer URL injected via query param ?mc_viewer=http://...
const params = new URLSearchParams(location.search)
const MC_VIEWER_URL = params.get('mc_viewer')

interface Props {
  modelPath: string
}

export function ObsView({ modelPath }: Props) {
  const [model, setModel] = useState<Live2DModel | null>(null)
  const [currentEvent, setCurrentEvent] = useState<SpeechEvent | null>(null)
  const { lastEvent, gameState, sendPlaybackDone } = useWebSocket(
    `ws://${location.host}/ws`,
  )
  const { playAudio } = useAudioPlayer()

  const onModelReady = useCallback((m: Live2DModel) => {
    setModel(m)
  }, [])

  useEffect(() => {
    if (!lastEvent) return
    setCurrentEvent(lastEvent)
    playAudio(lastEvent.audioBase64, model, () => {
      sendPlaybackDone()
    })
  }, [lastEvent, model, playAudio, sendPlaybackDone])

  // MC mode: split layout with game view + Live2D avatar
  if (MC_VIEWER_URL) {
    return (
      <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', background: '#000' }}>
        {/* Minecraft game view (main area) */}
        <iframe
          src={MC_VIEWER_URL}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            border: 'none',
          }}
        />

        {/* Live2D avatar (bottom-right corner) */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 400,
            height: 400,
          }}
        >
          <Live2DCanvas
            modelPath={modelPath}
            width={400}
            height={400}
            onModelReady={onModelReady}
          />
        </div>

        {/* Game state overlay (top-left) */}
        {gameState && <McOverlay state={gameState} />}

        {/* Chat overlay (bottom-center) */}
        {currentEvent && (
          <ChatOverlay
            userName={currentEvent.userName}
            userMessage={currentEvent.userMessage}
            aiResponse={currentEvent.aiResponse}
          />
        )}
      </div>
    )
  }

  // Default mode: Live2D fullscreen
  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      <Live2DCanvas
        modelPath={modelPath}
        width={1920}
        height={1080}
        onModelReady={onModelReady}
      />
      {gameState && <McOverlay state={gameState} />}
      {currentEvent && (
        <ChatOverlay
          userName={currentEvent.userName}
          userMessage={currentEvent.userMessage}
          aiResponse={currentEvent.aiResponse}
        />
      )}
    </div>
  )
}
