import { Menu } from 'lucide-react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { LiveIndicator } from '@/components/common/LiveIndicator/LiveIndicator'
import { NotificationsDropdown } from '../NotificationsDropdown/NotificationsDropdown'
import { UserProfileDropdown } from '../UserProfileDropdown/UserProfileDropdown'
import { useUIStore } from '@/store/uiStore'

export function Topbar() {
  const { user } = useAuth()
  const toggleMobileMenu = useUIStore((s) => s.toggleMobileMenu)

  if (!user) return null

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-border bg-white/90 px-4 backdrop-blur">
      {/* Bouton hamburger mobile */}
      <button
        type="button"
        onClick={toggleMobileMenu}
        aria-label="Ouvrir le menu"
        className="rounded-md p-2 text-text-secondary hover:bg-bg md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Spacer pour pousser les éléments à droite */}
      <div className="flex-1" />

      <div className="flex items-center gap-3">
        <LiveIndicator />
        <NotificationsDropdown />
        <div className="h-6 w-px bg-border" />
        <UserProfileDropdown />
      </div>
    </header>
  )
}
