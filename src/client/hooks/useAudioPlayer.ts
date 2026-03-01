import { useCallback } from 'react'
import type { Live2DModel } from 'pixi-live2d-display-lipsyncpatch'

export function useAudioPlayer() {
  const playAudio = useCallback(
    (base64Audio: string, model: Live2DModel | null, onDone: () => void) => {
      const binaryStr = atob(base64Audio)
      const bytes = new Uint8Array(binaryStr.length)
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i)
      }

      const blob = new Blob([bytes.buffer], { type: 'audio/wav' })
      const url = URL.createObjectURL(blob)

      if (model) {
        model.speak(url, {
          volume: 0.8,
          onFinish: () => {
            URL.revokeObjectURL(url)
            onDone()
          },
          onError: () => {
            URL.revokeObjectURL(url)
            onDone()
          },
        })
      } else {
        const audio = new Audio(url)
        audio.onended = () => {
          URL.revokeObjectURL(url)
          onDone()
        }
        audio.play()
      }
    },
    [],
  )

  return { playAudio }
}
