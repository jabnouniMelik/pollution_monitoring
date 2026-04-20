import { Link } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'

export default function Unauthorized() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-warning" aria-hidden="true" />
        <h1 className="mt-3 text-3xl font-semibold text-text-primary">Accès refusé</h1>
        <p className="mt-1 max-w-md text-sm text-text-secondary">
          Vous n’avez pas les permissions nécessaires pour accéder à cette section. Contactez votre
          administrateur si vous pensez qu’il s’agit d’une erreur.
        </p>
        <Link
          to="/"
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline"
        >
          Retour au tableau de bord
        </Link>
      </div>
    </div>
  )
}
