import type { QueryClient } from '@tanstack/react-query'
import type { WSMessage } from '@/@types/websocket'

/**
 * Applies a WebSocket payload to the React Query cache: invalidates affected queries
 * so open views refetch fresh KPI / readings / alerts without a full reload.
 */
export function applyWSMessage(queryClient: QueryClient, message: WSMessage): void {
  if (message.type === 'kpi_update') {
    void queryClient.invalidateQueries({ queryKey: ['kpi', 'summary'] })
    void queryClient.invalidateQueries({ queryKey: ['readings'] })
    return
  }

  if (message.type === 'alert') {
    void queryClient.invalidateQueries({ queryKey: ['alerts'] })
    return
  }

  if (message.type === 'report_update') {
    void queryClient.invalidateQueries({ queryKey: ['reports'] })
  }
}
