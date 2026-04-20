import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { hasAnyPermission } from '@/lib/rbac/checkPermission'
import type { Permission } from '@/lib/constants/roles'
import { LoadingSpinner } from '../LoadingSpinner/LoadingSpinner'

interface ProtectedRouteProps {
  children: ReactNode
  /** If provided, user must have at least one of these permissions */
  requires?: Permission[]
}

export function ProtectedRoute({ children, requires }: ProtectedRouteProps) {
  const { user, isAuthenticated, isInitialized } = useAuth()
  const location = useLocation()

  if (!isInitialized) return <LoadingSpinner fullScreen />

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (requires && requires.length > 0 && !hasAnyPermission(user?.role, requires)) {
    return <Navigate to="/unauthorized" replace />
  }

  return <>{children}</>
}
