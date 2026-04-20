import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { queryClient } from '@/lib/api/queryClient'
import { ToastProvider } from '@/components/ui/Toast/ToastProvider'
import { WebSocketProvider } from '@/features/websocket/WebSocketProvider'
import { AppRoutes } from '@/routes'
import { ErrorBoundary } from '@/components/common/ErrorBoundary/ErrorBoundary'

const enableDevtools = import.meta.env.VITE_ENABLE_DEVTOOLS === 'true'

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <BrowserRouter
            future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
          >
            <WebSocketProvider>
              <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:text-white"
              >
                Aller au contenu principal
              </a>
              <AppRoutes />
            </WebSocketProvider>
          </BrowserRouter>
        </ToastProvider>
        {enableDevtools && <ReactQueryDevtools buttonPosition="bottom-left" />}
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
