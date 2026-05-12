import { Modal } from '@/components/ui/Modal/Modal'
import { Button } from '@/components/ui/Button/Button'
import { Card } from '@/components/ui/Card/Card'
import { useDeleteZone } from '@/features/zones/hooks/useZones'

interface ZoneDeleteConfirmProps {
  zoneId: string
  onClose: () => void
}

export function ZoneDeleteConfirm({ zoneId, onClose }: ZoneDeleteConfirmProps) {
  const deleteZone = useDeleteZone()

  const handleConfirm = () => {
    deleteZone.mutate(zoneId, {
      onSuccess: () => {
        onClose()
      },
    })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Supprimer la zone"
      description="Cette action est irréversible"
    >
      <Card className="space-y-4 p-6">
        <p className="text-sm text-text-secondary">
          Êtes-vous sûr de vouloir supprimer cette zone ? Cette action ne peut pas être annulée.
        </p>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="danger" loading={deleteZone.isPending} onClick={handleConfirm}>
            Supprimer
          </Button>
        </div>
      </Card>
    </Modal>
  )
}
