import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { MainLayout } from '@/components/layout/MainLayout/MainLayout'
import { ProtectedRoute } from '@/components/common/ProtectedRoute/ProtectedRoute'
import { LoadingSpinner } from '@/components/common/LoadingSpinner/LoadingSpinner'
import { Role } from '@/lib/constants/roles'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { defaultPathForRole } from '@/lib/rbac/auditorAccess'

function HomeRedirect() {
  const { user } = useAuth()
  return <Navigate to={defaultPathForRole(user?.role)} replace />
}

const Login = lazy(() => import('@/pages/Login'))
const Register = lazy(() => import('@/pages/Register'))
const Overview = lazy(() => import('@/pages/Overview'))
const Alerts = lazy(() => import('@/pages/Alerts'))
const History = lazy(() => import('@/pages/History'))
const Compliance = lazy(() => import('@/pages/Compliance'))
const AIPredictions = lazy(() => import('@/pages/AIPredictions'))
const Reports = lazy(() => import('@/pages/Reports'))
const Config = lazy(() => import('@/pages/Config'))
const Users = lazy(() => import('@/pages/Users'))
const Approvals = lazy(() => import('@/pages/Approvals'))
const Industries = lazy(() => import('@/pages/Industries'))
const NotFound = lazy(() => import('@/pages/NotFound'))
const Unauthorized = lazy(() => import('@/pages/Unauthorized'))

export function AppRoutes() {
  return (
    <Suspense fallback={<LoadingSpinner fullScreen />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/unauthorized" element={<Unauthorized />} />

        <Route
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<HomeRedirect />} />
          <Route
            path="overview"
            element={
              <ProtectedRoute requires={['VIEW_KPI']}>
                <Overview />
              </ProtectedRoute>
            }
          />
          <Route
            path="alerts"
            element={
              <ProtectedRoute requires={['VIEW_ALERTS']}>
                <Alerts />
              </ProtectedRoute>
            }
          />
          <Route
            path="history"
            element={
              <ProtectedRoute requires={['VIEW_KPI']}>
                <History />
              </ProtectedRoute>
            }
          />
          <Route
            path="compliance"
            element={
              <ProtectedRoute requires={['VIEW_COMPLIANCE']}>
                <Compliance />
              </ProtectedRoute>
            }
          />
          <Route
            path="ai"
            element={
              <ProtectedRoute requires={['VIEW_AI']}>
                <AIPredictions />
              </ProtectedRoute>
            }
          />
          <Route
            path="reports"
            element={
              <ProtectedRoute requires={['GENERATE_REPORT']}>
                <Reports />
              </ProtectedRoute>
            }
          />
          <Route
            path="config"
            element={
              <ProtectedRoute role={Role.SUPER_ADMIN}>
                <Config />
              </ProtectedRoute>
            }
          />
          <Route
            path="users"
            element={
              <ProtectedRoute requires={['VIEW_ALL_USERS']}>
                <Users />
              </ProtectedRoute>
            }
          />
          <Route
            path="approvals"
            element={
              <ProtectedRoute role={Role.SUPER_ADMIN}>
                <Approvals />
              </ProtectedRoute>
            }
          />
          <Route
            path="industries"
            element={
              <ProtectedRoute requires={['VIEW_ALL_SITES']}>
                <Industries />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route path="/404" element={<NotFound />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </Suspense>
  )
}
