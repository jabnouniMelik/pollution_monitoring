import { ReactNode } from 'react'
import { AlertCircle, Inbox, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button/Button'
import { Skeleton } from '@/components/ui/Skeleton/Skeleton'
import type { UseQueryResult } from '@tanstack/react-query'

interface QueryStateProps<T> {
  query: UseQueryResult<T, Error>
  loadingSkeleton?: ReactNode
  emptyState?: ReactNode
  emptyTitle?: string
  emptyDescription?: string
  errorTitle?: string
  errorDescription?: string
  onRetry?: () => void
  children: (data: T) => ReactNode
}

export function QueryState<T>({
  query,
  loadingSkeleton,
  emptyState,
  emptyTitle = 'Aucune donnée',
  emptyDescription = 'Aucune donnée disponible pour le moment.',
  errorTitle = 'Erreur de chargement',
  errorDescription = 'Une erreur est survenue lors du chargement des données.',
  onRetry,
  children,
}: QueryStateProps<T>) {
  const { data, isLoading, isError, error, refetch } = query

  // État de chargement
  if (isLoading) {
    if (loadingSkeleton) {
      return <>{loadingSkeleton}</>
    }
    return <DefaultLoadingSkeleton />
  }

  // État d'erreur
  if (isError) {
    return (
      <ErrorState
        title={errorTitle}
        description={errorDescription}
        error={error}
        onRetry={onRetry || refetch}
      />
    )
  }

  // État vide (pas de données)
  if (!data || (Array.isArray(data) && data.length === 0)) {
    if (emptyState) {
      return <>{emptyState}</>
    }
    return <EmptyState title={emptyTitle} description={emptyDescription} />
  }

  // Données disponibles
  return <>{children(data)}</>
}

function DefaultLoadingSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  )
}

interface EmptyStateProps {
  title: string
  description: string
  icon?: ReactNode
  action?: ReactNode
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-secondary text-text-tertiary mb-4">
        {icon || <Inbox className="h-8 w-8" />}
      </div>
      <h3 className="text-lg font-semibold text-text-primary mb-2">{title}</h3>
      <p className="text-sm text-text-secondary max-w-md mb-4">{description}</p>
      {action}
    </div>
  )
}

interface ErrorStateProps {
  title: string
  description: string
  error?: Error | null
  onRetry?: () => void
}

export function ErrorState({ title, description, error, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-danger-light text-danger mb-4">
        <AlertCircle className="h-8 w-8" />
      </div>
      <h3 className="text-lg font-semibold text-text-primary mb-2">{title}</h3>
      <p className="text-sm text-text-secondary max-w-md mb-2">{description}</p>
      {error && (
        <p className="text-xs text-text-tertiary bg-surface-secondary px-3 py-1 rounded-md mb-4 font-mono">
          {error.message}
        </p>
      )}
      {onRetry && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onRetry}
          leftIcon={<RefreshCw className="h-4 w-4" />}
        >
          Réessayer
        </Button>
      )}
    </div>
  )
}
