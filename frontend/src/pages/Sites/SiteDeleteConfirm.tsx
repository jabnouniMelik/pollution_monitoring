import { Modal } from '@/components/ui/Modal/Modal'
import { Button } from '@/components/ui/Button/Button'
import { Card } from '@/components/ui/Card/Card'
import { useDeleteSite } from '@/features/sites/hooks/useSites'

interface SiteDeleteConfirmProps {
  siteId: string
  onClose: () => void
}

export function SiteDeleteConfirm({ siteId, onClose }: SiteDeleteConfirmProps) {
  const deleteSite = useDeleteSite()

  const handleConfirm = () => {
    deleteSite.mutate(siteId, {
      onSuccess: () => {
        onClose()
      },
    })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Supprimer le site"
      description="Cette action est irréversible"
    >
      <Card className="space-y-4 p-6">
        <p className="text-sm text-text-secondary">
          Êtes-vous sûr de vouloir supprimer ce site ? Cette action ne peut pas être annulée.
        </p>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="danger" loading={deleteSite.isPending} onClick={handleConfirm}>
            Supprimer
          </Button>
        </div>
      </Card>
    </Modal>
  )
}
