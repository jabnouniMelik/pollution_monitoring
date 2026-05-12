import type { ReactNode } from 'react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { hasAllPermissions, hasAnyPermission } from '@/lib/rbac/checkPermission'
import type { Permission, Role } from '@/lib/constants/roles'

interface PermissionGateProps {
  permission?: Permission
  anyOf?: Permission[]
  allOf?: Permission[]
  /** If set, user must have this exact role (combine with permission checks when both are set) */
  role?: Role
  children: ReactNode
  fallback?: ReactNode
}

/**
 * Renders children when the user matches `role` (if set) and holds the required permission(s).
 */
export function PermissionGate({
  permission,
  anyOf,
  allOf,
  role,
  children,
  fallback = null,
}: PermissionGateProps) {
  const { user } = useAuth()

  if (role !== undefined) {
    if (!user || user.role !== role) return <>{fallback}</>
    if (!permission && !anyOf && !allOf) return <>{children}</>
  }

  let allowed = false
  if (user) {
    if (permission) allowed = hasAnyPermission(user.role, [permission])
    else if (anyOf) allowed = hasAnyPermission(user.role, anyOf)
    else if (allOf) allowed = hasAllPermissions(user.role, allOf)
    else allowed = true
  }

  if (!allowed) return <>{fallback}</>
  return <>{children}</>
}
