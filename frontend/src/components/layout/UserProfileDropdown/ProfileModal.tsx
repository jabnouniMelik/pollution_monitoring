import { User, Mail, Shield } from 'lucide-react'
import { Modal } from '@/components/ui/Modal/Modal'
import { Button } from '@/components/ui/Button/Button'
import { RoleBadge } from '@/features/auth/components/RoleBadge/RoleBadge'
import { useAuth } from '@/features/auth/hooks/useAuth'

interface ProfileModalProps {
  open: boolean
  onClose: () => void
}

export function ProfileModal({ open, onClose }: ProfileModalProps) {
  const { user } = useAuth()

  if (!user) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Mon profil"
      size="md"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Fermer
        </Button>
      }
    >
      <div className="space-y-4">
        {/* Informations utilisateur */}
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-light text-accent">
              <User className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-text-tertiary">Nom d'utilisateur</p>
              <p className="text-sm font-medium text-text-primary">{user.username}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-info-light text-info">
              <Mail className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-text-tertiary">Email</p>
              <p className="text-sm font-medium text-text-primary">{user.email}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-navy-light text-navy">
              <Shield className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-text-tertiary">Rôle</p>
              <div className="mt-1">
                <RoleBadge role={user.role} />
              </div>
            </div>
          </div>
        </div>

        {/* Sites assignés */}
        {user.assignedSites && user.assignedSites.length > 0 && (
          <div className="rounded-lg border border-border bg-surface-secondary p-4">
            <h4 className="text-sm font-semibold text-text-primary mb-2">Sites assignés</h4>
            <ul className="space-y-1">
              {user.assignedSites.map((site: any, index: number) => (
                <li key={index} className="text-sm text-text-secondary">
                  • {typeof site === 'string' ? site : site?.name || site?._id || 'Site inconnu'}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Zones assignées */}
        {user.assignedZones && user.assignedZones.length > 0 && (
          <div className="rounded-lg border border-border bg-surface-secondary p-4">
            <h4 className="text-sm font-semibold text-text-primary mb-2">Zones assignées</h4>
            <ul className="space-y-1">
              {user.assignedZones.map((zone: any, index: number) => (
                <li key={index} className="text-sm text-text-secondary">
                  • {typeof zone === 'string' ? zone : zone?.name || zone?._id || 'Zone inconnue'}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  )
}
