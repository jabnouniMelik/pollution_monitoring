import { useState, useRef, useEffect } from 'react'
import { ChevronDown, User, Lock, LogOut } from 'lucide-react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useLogout } from '@/features/auth/hooks/useLogout'
import { RoleBadge } from '@/features/auth/components/RoleBadge/RoleBadge'
import { ProfileModal } from './ProfileModal'
import { ChangePasswordModal } from './ChangePasswordModal'
import { cn } from '@/lib/utils/cn'

export function UserProfileDropdown() {
  const [isOpen, setIsOpen] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  const { user } = useAuth()
  const logout = useLogout()

  // Fermer au clic extérieur
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
    
    return undefined
  }, [isOpen])

  if (!user) return null

  const menuItems = [
    {
      icon: User,
      label: 'Mon profil',
      onClick: () => {
        setShowProfile(true)
        setIsOpen(false)
      },
    },
    {
      icon: Lock,
      label: 'Changer mot de passe',
      onClick: () => {
        setShowChangePassword(true)
        setIsOpen(false)
      },
    },
    {
      icon: LogOut,
      label: 'Se déconnecter',
      onClick: () => logout.mutate(),
      danger: true,
    },
  ]

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Menu utilisateur"
          aria-expanded={isOpen}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-text-secondary hover:bg-bg transition-colors"
        >
          <div className="hidden text-right sm:block">
            <div className="text-sm font-semibold text-text-primary">{user.username}</div>
            <div className="text-[10px] text-text-secondary">{user.email}</div>
          </div>
          <RoleBadge role={user.role} />
          <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
        </button>

        {isOpen && (
          <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-border bg-white shadow-elevated">
            <div className="border-b border-border px-4 py-3">
              <p className="text-sm font-semibold text-text-primary truncate">{user.username}</p>
              <p className="text-xs text-text-secondary truncate">{user.email}</p>
            </div>

            <ul className="py-1">
              {menuItems.map((item, index) => (
                <li key={index}>
                  <button
                    type="button"
                    onClick={item.onClick}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-2 text-sm transition-colors',
                      item.danger
                        ? 'text-danger hover:bg-danger-light'
                        : 'text-text-primary hover:bg-bg',
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <ProfileModal open={showProfile} onClose={() => setShowProfile(false)} />
      <ChangePasswordModal open={showChangePassword} onClose={() => setShowChangePassword(false)} />
    </>
  )
}
