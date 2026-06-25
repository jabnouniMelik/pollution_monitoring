import type { WSConnectionStatus, WSMessage } from '@/@types/websocket'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const WS_URL =
  import.meta.env.VITE_WS_URL ||
  `${API_URL.replace(/^http(s?):\/\//, (_, s) => `ws${s}://`)}/ws`

const MAX_RECONNECT_DELAY = 30_000
const INITIAL_RECONNECT_DELAY = 1_000
const HEARTBEAT_INTERVAL = 30_000

interface AuthPayload {
  userId: string
  role: string
  email: string
  industryId?: string | null
}

type MessageHandler = (message: WSMessage) => void
type StatusHandler = (status: WSConnectionStatus) => void

export class WebSocketClient {
  private ws: WebSocket | null = null
  private reconnectDelay = INITIAL_RECONNECT_DELAY
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private messageHandlers = new Set<MessageHandler>()
  private statusHandlers = new Set<StatusHandler>()
  private subscribedTopics = new Set<string>()
  private authenticated = false
  private authData: AuthPayload | null = null
  private manuallyClosed = false

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return
    if (this.ws?.readyState === WebSocket.CONNECTING) return

    this.manuallyClosed = false

    try {
      const ws = new WebSocket(WS_URL)
      this.ws = ws

      ws.onopen = () => {
        this.reconnectDelay = INITIAL_RECONNECT_DELAY
        this.notifyStatus('connected')
        if (this.authData) this.authenticate(this.authData)
        this.startHeartbeat()
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WSMessage

          if (message.type === 'authenticated') {
            this.authenticated = true
            if (this.subscribedTopics.size > 0) {
              this.sendRaw({
                type: 'subscribe',
                payload: { topics: Array.from(this.subscribedTopics) },
              })
            }
          }

          this.messageHandlers.forEach((h) => h(message))
        } catch (err) {
          console.error('[WS] parse error:', err)
        }
      }

      ws.onerror = () => {
        // Browsers fire an opaque Event here, not a real Error. Log it as a
        // warning so it's distinguishable from actionable failures. The
        // `onclose` handler below will trigger the reconnect flow.
        console.warn('[WS] connection error — will attempt to reconnect')
      }

      ws.onclose = () => {
        this.authenticated = false
        this.stopHeartbeat()
        if (this.manuallyClosed) {
          this.notifyStatus('disconnected')
        } else {
          this.notifyStatus('reconnecting')
          this.scheduleReconnect()
        }
      }
    } catch (err) {
      console.error('[WS] connect failed:', err)
      this.scheduleReconnect()
    }
  }

  disconnect() {
    this.manuallyClosed = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.stopHeartbeat()

    const ws = this.ws
    if (ws) {
      // Calling close() while the socket is still CONNECTING produces the
      // browser warning "WebSocket is closed before the connection is
      // established" (very common under React 18 StrictMode, which mounts and
      // immediately unmounts effects in dev). Defer the close to the open
      // event in that case so the handshake can finish cleanly.
      if (ws.readyState === WebSocket.CONNECTING) {
        ws.addEventListener(
          'open',
          () => {
            try {
              ws.close()
            } catch {
              /* noop */
            }
          },
          { once: true },
        )
      } else if (ws.readyState === WebSocket.OPEN) {
        ws.close()
      }
    }
    this.ws = null
    this.authenticated = false
  }

  authenticate(payload: AuthPayload) {
    this.authData = payload
    this.sendRaw({ type: 'authenticate', payload })
  }

  subscribe(topics: string[]) {
    topics.forEach((t) => this.subscribedTopics.add(t))
    if (!this.authenticated) return
    this.sendRaw({ type: 'subscribe', payload: { topics } })
  }

  unsubscribe(topics: string[]) {
    topics.forEach((t) => this.subscribedTopics.delete(t))
    if (!this.authenticated) return
    this.sendRaw({ type: 'unsubscribe', payload: { topics } })
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler)
    return () => this.messageHandlers.delete(handler)
  }

  onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler)
    return () => this.statusHandlers.delete(handler)
  }

  private sendRaw(payload: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload))
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_DELAY)
      this.connect()
    }, this.reconnectDelay)
  }

  private startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      this.sendRaw({ type: 'ping' })
    }, HEARTBEAT_INTERVAL)
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private notifyStatus(status: WSConnectionStatus) {
    this.statusHandlers.forEach((h) => h(status))
  }
}

export const wsClient = new WebSocketClient()
