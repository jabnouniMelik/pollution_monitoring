import type { ReactNode } from 'react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { hasAllPermissions, hasAnyPermission } from '@/lib/rbac/checkPermission'
import type { Permission } from '@/lib/constants/roles'

interface PermissionGateProps {
  permission?: Permission
  anyOf?: Permission[]
  allOf?: Permission[]
  children: ReactNode
  fallback?: ReactNode
}

/**
 * Renders children only when the current user holds the required permission(s).
 * Provide exactly one of `permission`, `anyOf`, or `allOf`.
 */
export function PermissionGate({
  permission,
  anyOf,
  allOf,
  children,
  fallback = null,
}: PermissionGateProps) {
  const { user } = useAuth()

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
