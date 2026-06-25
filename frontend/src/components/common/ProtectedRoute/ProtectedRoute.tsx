import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { hasAnyPermission } from '@/lib/rbac/checkPermission'
import { isAuditorAllowedPath, defaultPathForRole } from '@/lib/rbac/auditorAccess'
import { Role, type Permission } from '@/lib/constants/roles'
import { LoadingSpinner } from '../LoadingSpinner/LoadingSpinner'

interface ProtectedRouteProps {
  children: ReactNode
  /** If provided, user must have at least one of these permissions */
  requires?: Permission[]
  /** If provided, only this role may access (e.g. SUPER_ADMIN for Configuration) */
  role?: Role
}

export function ProtectedRoute({ children, requires, role }: ProtectedRouteProps) {
  const { user, isAuthenticated, isInitialized } = useAuth()
  const location = useLocation()

  if (!isInitialized) return <LoadingSpinner fullScreen />

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (user?.role === Role.AUDITOR && !isAuditorAllowedPath(location.pathname)) {
    return <Navigate to={defaultPathForRole(Role.AUDITOR)} replace />
  }

  if (role !== undefined && user?.role !== role) {
    return <Navigate to="/unauthorized" replace />
  }

  if (requires && requires.length > 0 && !hasAnyPermission(user?.role, requires)) {
    return <Navigate to="/unauthorized" replace />
  }

  return <>{children}</>
}
