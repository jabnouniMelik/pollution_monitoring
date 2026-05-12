import { useState } from 'react'
import { Modal } from '@/components/ui/Modal/Modal'
import { Button } from '@/components/ui/Button/Button'
import { Input } from '@/components/ui/Input/Input'
import { Select } from '@/components/ui/Select/Select'
import { Card } from '@/components/ui/Card/Card'
import { useCreateUser } from '@/features/users/hooks/useUsers'
import { Role, ROLE_LABELS } from '@/lib/constants/roles'
import type { CreateUserInput } from '@/features/users'

interface UserCreateModalProps {
  onClose: () => void
}

export function UserCreateModal({ onClose }: UserCreateModalProps) {
  const [formData, setFormData] = useState<CreateUserInput>({
    username: '',
    email: '',
    password: '',
    role: Role.OPERATOR,
    industryId: null,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const createUser = useCreateUser()

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.username.trim()) newErrors.username = 'Requis'
    if (!formData.email.trim()) newErrors.email = 'Requis'
    if (!formData.password.trim()) newErrors.password = 'Requis'
    if (formData.password.length < 6) newErrors.password = 'Min 6 caractères'
    if (!formData.email.includes('@')) newErrors.email = 'Email invalide'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return

    createUser.mutate(formData, {
      onSuccess: () => {
        onClose()
      },
    })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Créer un utilisateur"
      description="Remplissez les informations ci-dessous"
    >
      <Card className="space-y-4 p-6">
        <Input
          label="Nom d'utilisateur"
          placeholder="john_doe"
          value={formData.username}
          onChange={(e) => setFormData((prev) => ({ ...prev, username: e.target.value }))}
          error={errors.username}
        />

        <Input
          label="Email"
          type="email"
          placeholder="john@example.com"
          value={formData.email}
          onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
          error={errors.email}
        />

        <Input
          label="Mot de passe"
          type="password"
          placeholder="••••••"
          value={formData.password}
          onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
          error={errors.password}
          hint="Min 6 caractères"
        />

        <Select
          label="Rôle"
          value={formData.role}
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
          <Button variant="primary" loading={createUser.isPending} onClick={handleSubmit}>
            Créer
          </Button>
        </div>
      </Card>
    </Modal>
  )
}
