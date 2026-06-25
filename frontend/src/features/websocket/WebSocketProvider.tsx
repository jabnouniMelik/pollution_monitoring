import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { wsClient } from './websocketClient'
import { applyWSMessage } from './applyWSMessage'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { queryClient } from '@/lib/api/queryClient'
import type { WSConnectionStatus, WSMessage } from '@/@types/websocket'

interface WebSocketContextValue {
  status: WSConnectionStatus
  subscribe: (topics: string[]) => void
  unsubscribe: (topics: string[]) => void
  onMessage: (handler: (message: WSMessage) => void) => () => void
  lastMessage: WSMessage | null
  lastUpdate: Date | null
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null)

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth()
  const [status, setStatus] = useState<WSConnectionStatus>('disconnected')
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const connectedOnce = useRef(false)

  useEffect(() => {
    if (!isAuthenticated) {
      // Ensure we're not keeping a zombie socket open after logout / session loss.
      if (connectedOnce.current) {
        wsClient.disconnect()
        connectedOnce.current = false
        setStatus('disconnected')
      }
      return
    }

    if (!connectedOnce.current) {
      wsClient.connect()
      connectedOnce.current = true
    }

    const offStatus = wsClient.onStatus(setStatus)
    const offMessage = wsClient.onMessage((msg) => {
      setLastMessage(msg)
      setLastUpdate(new Date())
      applyWSMessage(queryClient, msg)
    })

    return () => {
      offStatus()
      offMessage()
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (user && status === 'connected') {
      const industryId =
        typeof user.industryId === 'string'
          ? user.industryId
          : user.industryId?._id ?? null
      wsClient.authenticate({
        userId: user.userId || user._id || '',
        role: user.role,
        email: user.email,
        industryId,
      })
    }
  }, [user, status])

  useEffect(() => {
    return () => {
      wsClient.disconnect()
      connectedOnce.current = false
    }
  }, [])

  const value: WebSocketContextValue = {
    status,
    subscribe: (topics) => wsClient.subscribe(topics),
    unsubscribe: (topics) => wsClient.unsubscribe(topics),
    onMessage: (handler) => wsClient.onMessage(handler),
    lastMessage,
    lastUpdate,
  }

  return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>
}

export function useWebSocket(): WebSocketContextValue {
  const ctx = useContext(WebSocketContext)
  if (!ctx) throw new Error('useWebSocket must be used within WebSocketProvider')
  return ctx
}
