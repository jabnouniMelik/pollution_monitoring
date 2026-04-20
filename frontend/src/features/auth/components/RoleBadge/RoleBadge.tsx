import { ROLE_LABELS, type Role } from '@/lib/constants/roles'
import { cn } from '@/lib/utils/cn'

interface RoleBadgeProps {
  role: Role
  className?: string
}

const ROLE_STYLES: Record<Role, string> = {
  SUPER_ADMIN: 'bg-navy text-white',
  HEAD_SUPERVISOR: 'bg-accent text-white',
  SITE_SUPERVISOR: 'bg-info-light text-info',
  AUDITOR: 'bg-warning-light text-warning',
  OPERATOR: 'bg-success-light text-success',
}

export function RoleBadge({ role, className }: RoleBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-semibold',
        ROLE_STYLES[role],
        className,
      )}
    >
      {ROLE_LABELS[role]}
    </span>
  )
}
