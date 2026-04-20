import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { MainLayout } from '@/components/layout/MainLayout/MainLayout'
import { ProtectedRoute } from '@/components/common/ProtectedRoute/ProtectedRoute'
import { LoadingSpinner } from '@/components/common/LoadingSpinner/LoadingSpinner'

const Login = lazy(() => import('@/pages/Login'))
const Overview = lazy(() => import('@/pages/Overview'))
const Alerts = lazy(() => import('@/pages/Alerts'))
const History = lazy(() => import('@/pages/History'))
const Compliance = lazy(() => import('@/pages/Compliance'))
const AIPredictions = lazy(() => import('@/pages/AIPredictions'))
const Reports = lazy(() => import('@/pages/Reports'))
const Config = lazy(() => import('@/pages/Config'))
const NotFound = lazy(() => import('@/pages/NotFound'))
const Unauthorized = lazy(() => import('@/pages/Unauthorized'))

export function AppRoutes() {
  return (
    <Suspense fallback={<LoadingSpinner fullScreen />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/unauthorized" element={<Unauthorized />} />

        <Route
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route
            index
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
              <ProtectedRoute requires={['VIEW_KPI']}>
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
              <ProtectedRoute requires={['VIEW_CONFIG']}>
                <Config />
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
