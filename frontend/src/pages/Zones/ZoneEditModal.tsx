import { useState } from 'react'
import { Modal } from '@/components/ui/Modal/Modal'
import { Button } from '@/components/ui/Button/Button'
import { Input } from '@/components/ui/Input/Input'
import { Card } from '@/components/ui/Card/Card'
import { useUpdateZone } from '@/features/zones/hooks/useZones'
import type { Zone, UpdateZoneInput } from '@/features/zones'

interface ZoneEditModalProps {
  zone: Zone
  onClose: () => void
}

export function ZoneEditModal({ zone, onClose }: ZoneEditModalProps) {
  const [formData, setFormData] = useState<UpdateZoneInput>({
    nom: zone.nom,
    code: zone.code,
    description: zone.description,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const updateZone = useUpdateZone()

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.code?.trim()) newErrors.code = 'Requis'
    if (!formData.nom?.trim()) newErrors.nom = 'Requis'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return

    updateZone.mutate(
      { id: zone.id, input: formData },
      {
        onSuccess: () => {
          onClose()
        },
      },
    )
  }

  return (
    <Modal open onClose={onClose} title="Éditer la zone" description={`Mise à jour de ${zone.nom}`}>
      <Card className="space-y-4 p-6">
        <Input
          label="Code"
          placeholder="ex: ZONE_A1"
          value={formData.code || ''}
          onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value }))}
          error={errors.code}
        />

        <Input
          label="Nom"
          placeholder="ex: Zone de contrôle Nord"
          value={formData.nom || ''}
          onChange={(e) => setFormData((prev) => ({ ...prev, nom: e.target.value }))}
          error={errors.nom}
        />

        <Input
          label="Description"
          placeholder="Description de la zone"
          value={formData.description || ''}
          onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" loading={updateZone.isPending} onClick={handleSubmit}>
            Enregistrer
          </Button>
        </div>
      </Card>
    </Modal>
  )
}
