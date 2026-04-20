import { Link } from 'react-router-dom'
import { ArrowLeft, MapPin } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <MapPin className="mx-auto h-10 w-10 text-text-tertiary" aria-hidden="true" />
        <h1 className="mt-3 text-3xl font-semibold text-text-primary">404</h1>
        <p className="mt-1 text-sm text-text-secondary">La page demandée est introuvable.</p>
        <Link
          to="/"
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Retour au tableau de bord
        </Link>
      </div>
    </div>
  )
}
