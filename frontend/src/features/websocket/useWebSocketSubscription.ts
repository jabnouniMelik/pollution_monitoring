import { useEffect, useRef } from 'react'
import { useWebSocket } from './WebSocketProvider'
import type { WSMessage } from '@/@types/websocket'

/**
 * Subscribe to WS topics and receive matching messages.
 * Cleans up on unmount and when topics change.
 */
export function useWebSocketSubscription(
  topics: string[],
  onMessage?: (msg: WSMessage) => void,
) {
  const { status, subscribe, unsubscribe, onMessage: onAny } = useWebSocket()
  const topicsKey = topics.join('|')
  const handlerRef = useRef(onMessage)
  handlerRef.current = onMessage

  useEffect(() => {
    if (status !== 'connected') return
    if (topics.length === 0) return

    subscribe(topics)
    const off = onAny((msg) => {
      if (!handlerRef.current) return
      // Only forward when the topic matches
      const topic = (msg as { topic?: string }).topic
      if (topic && !topics.includes(topic)) return
      handlerRef.current(msg)
    })

    return () => {
      off()
      unsubscribe(topics)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, topicsKey])

  return status
}
