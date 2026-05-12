import { Modal } from '@/components/ui/Modal/Modal'
import { Button } from '@/components/ui/Button/Button'
import { Card } from '@/components/ui/Card/Card'
import { useDeleteUser } from '@/features/users/hooks/useUsers'

interface UserDeleteConfirmProps {
  userId: string
  onClose: () => void
}

export function UserDeleteConfirm({ userId, onClose }: UserDeleteConfirmProps) {
  const deleteUser = useDeleteUser()

  const handleConfirm = () => {
    deleteUser.mutate(userId, {
      onSuccess: () => {
        onClose()
      },
    })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Supprimer l'utilisateur"
      description="Cette action est irréversible"
    >
      <Card className="space-y-4 p-6">
        <p className="text-sm text-text-secondary">
          Êtes-vous sûr de vouloir supprimer cet utilisateur ? Cette action ne peut pas être
          annulée.
        </p>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="danger" loading={deleteUser.isPending} onClick={handleConfirm}>
            Supprimer
          </Button>
        </div>
      </Card>
    </Modal>
  )
}
