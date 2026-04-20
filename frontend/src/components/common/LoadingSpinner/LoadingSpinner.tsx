import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface LoadingSpinnerProps {
  fullScreen?: boolean
  label?: string
  className?: string
}

export function LoadingSpinner({ fullScreen, label = 'Chargement…', className }: LoadingSpinnerProps) {
  const content = (
    <div
      role="status"
      aria-live="polite"
      className={cn('flex items-center gap-2 text-text-secondary', className)}
    >
      <Loader2 className="h-5 w-5 animate-spin text-accent" aria-hidden="true" />
      <span className="text-sm">{label}</span>
    </div>
  )

  if (!fullScreen) return content

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      {content}
    </div>
  )
}
