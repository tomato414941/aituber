import { useState, useEffect, useCallback } from 'react'
import { Live2DCanvas } from './Live2DCanvas.js'
import { ChatOverlay } from './ChatOverlay.js'
import { useWebSocket } from '../hooks/useWebSocket.js'
import { useAudioPlayer } from '../hooks/useAudioPlayer.js'
import type { Live2DModel } from 'pixi-live2d-display-lipsyncpatch/cubism4'
import type { SpeechEvent } from '../../shared/types.js'

interface Props {
  modelPath: string
}

export function ObsView({ modelPath }: Props) {
  const [model, setModel] = useState<Live2DModel | null>(null)
  const [currentEvent, setCurrentEvent] = useState<SpeechEvent | null>(null)
  const { lastEvent, sendPlaybackDone } = useWebSocket(
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

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      <Live2DCanvas
        modelPath={modelPath}
        width={1920}
        height={1080}
        onModelReady={onModelReady}
      />
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
