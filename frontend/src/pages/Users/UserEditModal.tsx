import { useState } from 'react'
import { Modal } from '@/components/ui/Modal/Modal'
import { Button } from '@/components/ui/Button/Button'
import { Input } from '@/components/ui/Input/Input'
import { Select } from '@/components/ui/Select/Select'
import { Card } from '@/components/ui/Card/Card'
import { useUpdateUser, useChangeUserRole } from '@/features/users/hooks/useUsers'
import { Role, ROLE_LABELS } from '@/lib/constants/roles'
import type { User, UpdateUserInput } from '@/features/users'

interface UserEditModalProps {
  user: User
  onClose: () => void
}

export function UserEditModal({ user, onClose }: UserEditModalProps) {
  const [formData, setFormData] = useState<UpdateUserInput>({
    username: user.username,
    email: user.email,
    role: user.role,
    industryId: user.industryId,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const updateUser = useUpdateUser()
  const changeRole = useChangeUserRole()

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.username?.trim()) newErrors.username = 'Requis'
    if (!formData.email?.trim()) newErrors.email = 'Requis'
    if (formData.email && !formData.email.includes('@')) newErrors.email = 'Email invalide'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return

    const hasRoleChange = formData.role !== user.role

    if (hasRoleChange && formData.role) {
      changeRole.mutate(
        { id: user.id, role: formData.role },
        {
          onSuccess: () => {
            onClose()
          },
        },
      )
    } else {
      updateUser.mutate(
        { id: user.id, input: formData },
        {
          onSuccess: () => {
            onClose()
          },
        },
      )
    }
  }

  const isLoading = updateUser.isPending || changeRole.isPending

  return (
    <Modal
      open
      onClose={onClose}
      title="Éditer l'utilisateur"
      description={`Mise à jour de ${user.email}`}
    >
      <Card className="space-y-4 p-6">
        <Input
          label="Nom d'utilisateur"
          placeholder="john_doe"
          value={formData.username || ''}
          onChange={(e) => setFormData((prev) => ({ ...prev, username: e.target.value }))}
          error={errors.username}
        />

        <Input
          label="Email"
          type="email"
          placeholder="john@example.com"
          value={formData.email || ''}
          onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
          error={errors.email}
        />

        <Select
          label="Rôle"
          value={formData.role || ''}
          onChange={(e) => setFormData((prev) => ({ ...prev, role: e.target.value as any }))}
          options={Object.values(Role).map((role) => ({
            label: ROLE_LABELS[role],
            value: role,
          }))}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" loading={isLoading} onClick={handleSubmit}>
            Enregistrer
          </Button>
        </div>
      </Card>
    </Modal>
  )
}
