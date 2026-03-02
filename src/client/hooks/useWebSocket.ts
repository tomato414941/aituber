import { useEffect, useRef, useState, useCallback } from 'react'
import type { SpeechEvent, McGameState } from '../../shared/types.js'

export function useWebSocket(url: string) {
  const wsRef = useRef<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const [lastEvent, setLastEvent] = useState<SpeechEvent | null>(null)
  const [gameState, setGameState] = useState<McGameState | null>(null)

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout>

    function connect() {
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => setConnected(true)
      ws.onclose = () => {
        setConnected(false)
        reconnectTimer = setTimeout(connect, 3000)
      }
      ws.onmessage = (e) => {
        const data = JSON.parse(e.data)
        if (data.type === 'speech') {
          setLastEvent(data as SpeechEvent)
        } else if (data.type === 'game_state') {
          setGameState(data.state as McGameState)
        }
      }
    }

    connect()

    return () => {
      clearTimeout(reconnectTimer)
      wsRef.current?.close()
    }
  }, [url])

  const sendPlaybackDone = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: 'playback_done' }))
  }, [])

  return { connected, lastEvent, gameState, sendPlaybackDone }
}
