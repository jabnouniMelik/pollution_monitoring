import { Check, ChevronsUp, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/Button/Button'
import { PermissionGate } from '@/components/common/PermissionGate/PermissionGate'
import type { Alert } from '@/features/alerts/types/alert.types'
import {
  useAcknowledgeAlert,
  useEscalateAlert,
  useResolveAlert,
} from '@/features/alerts/hooks/useAlertActions'

interface AlertActionsProps {
  alert: Alert
  compact?: boolean
}

export function AlertActions({ alert, compact }: AlertActionsProps) {
  const ack = useAcknowledgeAlert()
  const esc = useEscalateAlert()
  const res = useResolveAlert()

  const size = compact ? 'sm' : 'md'

  return (
    <div className="flex flex-wrap items-center gap-1">
      {!alert.acknowledged && (
        <PermissionGate permission="ACKNOWLEDGE_ALERT">
          <Button
            variant="secondary"
            size={size}
            leftIcon={<Check className="h-3.5 w-3.5" />}
            loading={ack.isPending}
            onClick={(e) => {
              e.stopPropagation()
              ack.mutate(alert.id)
            }}
          >
            Acquitter
          </Button>
        </PermissionGate>
      )}
      <PermissionGate permission="ESCALATE_ALERT">
        <Button
          variant="ghost"
          size={size}
          leftIcon={<ChevronsUp className="h-3.5 w-3.5" />}
          loading={esc.isPending}
          onClick={(e) => {
            e.stopPropagation()
            esc.mutate({ id: alert.id })
          }}
        >
          Escalader
        </Button>
      </PermissionGate>
      <PermissionGate permission="RESOLVE_ALERT">
        <Button
          variant="primary"
          size={size}
          leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}
          loading={res.isPending}
          onClick={(e) => {
            e.stopPropagation()
            res.mutate({ id: alert.id })
          }}
        >
          Résoudre
        </Button>
      </PermissionGate>
    </div>
  )
}
