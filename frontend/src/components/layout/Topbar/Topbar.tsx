import { Bell, LogOut, Search } from 'lucide-react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useLogout } from '@/features/auth/hooks/useLogout'
import { RoleBadge } from '@/features/auth/components/RoleBadge/RoleBadge'
import { LiveIndicator } from '@/components/common/LiveIndicator/LiveIndicator'

export function Topbar() {
  const { user } = useAuth()
  const logout = useLogout()

  if (!user) return null

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-border bg-white/90 px-4 backdrop-blur">
      <div className="relative hidden min-w-[240px] flex-1 md:block">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary"
          aria-hidden="true"
        />
        <input
          type="search"
          placeholder="Rechercher (sites, alertes, rapports)…"
          aria-label="Rechercher"
          className="input pl-9"
        />
      </div>

      <div className="flex items-center gap-3 md:ml-auto">
        <LiveIndicator />
        <button
          type="button"
          aria-label="Notifications"
          className="relative rounded-md p-2 text-text-secondary hover:bg-bg"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger" aria-hidden="true" />
        </button>

        <div className="flex items-center gap-3 border-l border-border pl-3">
          <div className="hidden text-right sm:block">
            <div className="text-sm font-semibold text-text-primary">{user.username}</div>
            <div className="text-[10px] text-text-secondary">{user.email}</div>
          </div>
          <RoleBadge role={user.role} />
          <button
            type="button"
            aria-label="Se déconnecter"
            onClick={() => logout.mutate()}
            className="rounded-md p-2 text-text-secondary hover:bg-bg"
            title="Se déconnecter"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
