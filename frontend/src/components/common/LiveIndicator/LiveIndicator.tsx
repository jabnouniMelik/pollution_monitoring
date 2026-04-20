import { useWebSocket } from '@/features/websocket/WebSocketProvider'
import { cn } from '@/lib/utils/cn'
import { formatRelative } from '@/lib/utils/formatters'

const STATUS_META = {
  connected: {
    label: 'En direct',
    dot: 'bg-success',
    text: 'text-success',
    ring: 'ring-success/30',
  },
  reconnecting: {
    label: 'Reconnexion…',
    dot: 'bg-warning',
    text: 'text-warning',
    ring: 'ring-warning/30',
  },
  disconnected: {
    label: 'Hors ligne',
    dot: 'bg-danger',
    text: 'text-danger',
    ring: 'ring-danger/30',
  },
} as const

export function LiveIndicator({ className }: { className?: string }) {
  const { status, lastUpdate } = useWebSocket()
  const meta = STATUS_META[status]

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-pill bg-white px-3 py-1.5 text-xs font-semibold shadow-card ring-1',
        meta.ring,
        meta.text,
        className,
      )}
      role="status"
      aria-live="polite"
      title={lastUpdate ? `Dernière mise à jour ${formatRelative(lastUpdate)}` : undefined}
    >
      <span className="relative inline-flex h-2 w-2">
        <span
          className={cn(
            'absolute inline-flex h-full w-full rounded-full opacity-75',
            meta.dot,
            status === 'connected' && 'animate-pulse-slow',
          )}
        />
        <span className={cn('relative inline-flex h-2 w-2 rounded-full', meta.dot)} />
      </span>
      {meta.label}
    </div>
  )
}
