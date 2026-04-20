import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button/Button'

interface Props {
  children: ReactNode
  fallback?: (error: Error, reset: () => void) => ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info)
  }

  private reset = () => this.setState({ error: null })

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.state.error, this.reset)
      return (
        <div className="flex min-h-[60vh] items-center justify-center p-6">
          <div className="max-w-md rounded-card border border-danger/30 bg-danger-light p-5 text-danger">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              <h2 className="text-sm font-semibold">Une erreur est survenue</h2>
            </div>
            <p className="mt-2 text-sm">{this.state.error.message}</p>
            <Button
              variant="danger"
              size="sm"
              className="mt-4"
              leftIcon={<RefreshCw className="h-4 w-4" />}
              onClick={this.reset}
            >
              Réessayer
            </Button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
