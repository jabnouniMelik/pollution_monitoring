import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Leaf, ShieldCheck } from 'lucide-react'
import { LoginForm } from '@/features/auth/components/LoginForm/LoginForm'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { LoadingSpinner } from '@/components/common/LoadingSpinner/LoadingSpinner'

export default function Login() {
  const { isAuthenticated, isInitialized } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/'

  if (!isInitialized) return <LoadingSpinner fullScreen />
  if (isAuthenticated) return <Navigate to={from} replace />

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#EBF3FB] to-[#F8FAFC]">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4 py-8">
        <div className="grid w-full gap-6 overflow-hidden rounded-card bg-white shadow-elevated md:grid-cols-2">
          <div className="relative hidden flex-col justify-between bg-navy p-8 text-white md:flex">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white/10">
                  <Leaf className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="text-lg font-semibold">EmissionsIQ</div>
              </div>
              <h2 className="mt-8 text-2xl font-semibold leading-snug">
                Surveillance environnementale pour l’industrie tunisienne
              </h2>
              <p className="mt-3 text-sm text-white/80">
                Conformité en temps réel avec le Décret n° 2018-928 — suivi des émissions, alertes
                réglementaires et rapports pour l’ANPE.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-white/70">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              <span>Authentification chiffrée · Audit trail conforme</span>
            </div>
          </div>

          <div className="p-6 md:p-8">
            <h1 className="text-lg font-semibold text-text-primary">Connexion</h1>
            <p className="mt-1 text-sm text-text-secondary">
              Identifiez-vous pour accéder au tableau de bord.
            </p>
            <div className="mt-6">
              <LoginForm onSuccess={() => navigate(from, { replace: true })} />
            </div>
            <div className="mt-6 border-t border-border pt-4 text-center">
              <p className="text-xs text-text-secondary">
                Nouvelle industrie ?{' '}
                <a href="/register" className="font-medium text-accent hover:underline">
                  Soumettre une demande d'inscription
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
