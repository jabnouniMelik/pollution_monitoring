import { useState, useRef, useEffect } from 'react'
import { Bell, CheckCheck, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAlerts } from '@/features/alerts/hooks/useAlerts'
import { useAcknowledgeAlert } from '@/features/alerts/hooks/useAlerts'
import { useAlertScope } from '@/features/alerts/hooks/useAlertScope'
import { Badge } from '@/components/ui/Badge/Badge'
import { formatRelative } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils/cn'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { hasPermission } from '@/lib/rbac/checkPermission'

export function NotificationsDropdown() {
  const { user } = useAuth()
  const canViewAlerts = hasPermission(user?.role, 'VIEW_ALERTS')
  const scope = useAlertScope()  // null for SUPER_ADMIN

  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fetch alerts scoped to the user's role + selected site/zone
  const { data } = useAlerts(
    { status: 'open', pageSize: 5, ...(scope ?? {}) },
    { enabled: canViewAlerts && scope !== null }
  )
  const acknowledge = useAcknowledgeAlert()

  const alerts = canViewAlerts ? (data?.items ?? []) : []
  const unreadCount = alerts.length

  // SUPER_ADMIN does not receive alert notifications
  if (!canViewAlerts) return null

  // Fermer au clic extérieur
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
    
    return undefined
  }, [isOpen])

  const handleAcknowledge = async (alertId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    await acknowledge.mutateAsync(alertId)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
        aria-expanded={isOpen}
        className="relative rounded-md p-2 text-text-secondary hover:bg-bg"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[10px] font-semibold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-border bg-white shadow-elevated">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Notifications</h3>
              {scope?.zoneId && (
                <p className="text-[10px] text-text-tertiary">Zone active</p>
              )}
              {scope?.siteId && !scope?.zoneId && (
                <p className="text-[10px] text-text-tertiary">Site actif</p>
              )}
            </div>
            {unreadCount > 0 && (
              <Badge variant="danger" className="text-[10px]">
                {unreadCount} nouvelle{unreadCount > 1 ? 's' : ''}
              </Badge>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="mx-auto h-8 w-8 text-text-tertiary" />
                <p className="mt-2 text-sm text-text-secondary">Aucune notification</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {alerts.map((alert) => (
                  <li key={alert.id}>
                    <Link
                      to="/alerts"
                      onClick={() => setIsOpen(false)}
                      className="block px-4 py-3 hover:bg-bg transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            'mt-0.5 h-2 w-2 rounded-full shrink-0',
                            alert.severity === 'critical' && 'bg-danger',
                            alert.severity === 'warning' && 'bg-warning',
                            alert.severity === 'info' && 'bg-info',
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">
                            {alert.pollutant}
                          </p>
                          <p className="text-xs text-text-secondary line-clamp-2 mt-0.5">
                            {alert.message}
                          </p>
                          <p className="text-[10px] text-text-tertiary mt-1">
                            {formatRelative(alert.timestamp)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleAcknowledge(alert.id, e)}
                          className="shrink-0 rounded p-1 text-text-tertiary hover:bg-surface-secondary hover:text-accent"
                          title="Marquer comme lu"
                        >
                          <CheckCheck className="h-4 w-4" />
                        </button>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {alerts.length > 0 && (
            <div className="border-t border-border px-4 py-2">
              <Link
                to="/alerts"
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-center gap-1 text-xs font-medium text-accent hover:underline"
              >
                Voir toutes les alertes
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
