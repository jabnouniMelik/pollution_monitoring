import { useState } from 'react'
import { Modal } from '@/components/ui/Modal/Modal'
import { Button } from '@/components/ui/Button/Button'
import { Input } from '@/components/ui/Input/Input'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { api } from '@/lib/api/axios'

interface ChangePasswordModalProps {
  open: boolean
  onClose: () => void
}

export function ChangePasswordModal({ open, onClose }: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const toast = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Tous les champs sont requis')
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas')
      return
    }

    if (newPassword.length < 8) {
      toast.error('Le mot de passe doit contenir au moins 8 caractères')
      return
    }

    setIsLoading(true)

    try {
      await api.post('/api/auth/change-password', {
        currentPassword,
        newPassword,
      })

      toast.success('Mot de passe modifié avec succès')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      onClose()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors du changement de mot de passe')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Changer le mot de passe"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={isLoading}>
            Annuler
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={isLoading}>
            Modifier
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Mot de passe actuel"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Entrez votre mot de passe actuel"
          required
        />

        <Input
          label="Nouveau mot de passe"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Minimum 8 caractères"
          required
        />

        <Input
          label="Confirmer le nouveau mot de passe"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Retapez le nouveau mot de passe"
          required
        />

        <div className="rounded-lg bg-info-light p-3 text-xs text-info">
          <p className="font-semibold mb-1">Conseils de sécurité :</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Utilisez au moins 8 caractères</li>
            <li>Mélangez majuscules, minuscules et chiffres</li>
            <li>Incluez des caractères spéciaux (@, #, $, etc.)</li>
          </ul>
        </div>
      </form>
    </Modal>
  )
}
