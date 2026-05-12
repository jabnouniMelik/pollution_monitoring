import { useState } from 'react'
import { Modal } from '@/components/ui/Modal/Modal'
import { Button } from '@/components/ui/Button/Button'
import { Input } from '@/components/ui/Input/Input'
import { Card } from '@/components/ui/Card/Card'
import { useCreateSite } from '@/features/sites/hooks/useSites'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { POLLUTANTS, POLLUTANT_CODES, type PollutantCode } from '@/lib/constants/pollutants'
import type { CreateSiteInput } from '@/features/sites'
import type { Industry } from '@/features/auth/types/auth.types'

interface SiteCreateModalProps {
  onClose: () => void
}

export function SiteCreateModal({ onClose }: SiteCreateModalProps) {
  const { user } = useAuth()
  // industryId can be a populated object (from /me) or a plain string ID
  const industry = user?.industryId && typeof user.industryId === 'object'
    ? user.industryId as Industry
    : null
  const hasIndustry = !!user?.industryId
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  const [formData, setFormData] = useState<CreateSiteInput>({
    nom: '',
    zoneName: '',
    pollutants: [],
    localisation: { type: 'Point', coordinates: [0, 0], ville: '', adresse: '' },
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const createSite = useCreateSite()

  const togglePollutant = (code: PollutantCode) => {
    setFormData((prev) => ({
      ...prev,
      pollutants: prev.pollutants.includes(code)
        ? prev.pollutants.filter((p) => p !== code)
        : [...prev.pollutants, code],
    }))
  }

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!formData.nom.trim()) errs.nom = 'Requis'
    if (!formData.zoneName.trim()) errs.zoneName = 'Requis'
    if (formData.pollutants.length === 0) errs.pollutants = 'Sélectionnez au moins un polluant'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = () => {
    if (!validate()) return
    createSite.mutate(formData, {
      onSuccess: () => {
        if (isSuperAdmin) {
          onClose()   // SUPER_ADMIN: close immediately, site is live
        } else {
          setSubmitted(true)  // Others: show pending confirmation
        }
      },
    })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Créer un site"
      description="Remplissez les informations ci-dessous"
    >
      {/* ── Pending confirmation screen ───────────────────────── */}
      {submitted ? (
        <Card className="space-y-4 p-6">
          <div className="space-y-4 py-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-warning-light text-warning">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-text-primary">Demande envoyée</p>
              <p className="mt-1 text-sm text-text-secondary">
                La création du site <strong>{formData.nom}</strong> est en attente de validation
                par le <strong>Super Admin</strong>.
              </p>
              <p className="mt-2 text-xs text-text-tertiary">
                Le site et sa zone initiale seront activés après approbation.
              </p>
            </div>
            <Button variant="primary" onClick={onClose} className="mx-auto">
              Fermer
            </Button>
          </div>
        </Card>
      ) : (
        /* ── Form ─────────────────────────────────────────────── */
        <Card className="space-y-4 p-6">
          {/* Approval notice for non-SUPER_ADMIN */}
          {!isSuperAdmin && (
            <div className="flex items-start gap-2 rounded-lg border border-warning-light bg-warning-light/30 px-3 py-2.5 text-xs text-warning-dark">
              <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <span>
                La création du site sera soumise à la validation du <strong>Super Admin</strong> avant
                d'être activée.
              </span>
            </div>
          )}

          {/* Industry — read-only */}
          {(industry || hasIndustry) && (
            <div className="rounded-lg border border-border bg-bg px-3 py-2">
              <p className="text-xs text-text-secondary">Industrie</p>
              <p className="text-sm font-medium text-text-primary">
                {industry ? industry.nom : 'Industrie assignée'}
              </p>
              {industry?.secteur && (
                <p className="text-xs text-text-tertiary">{industry.secteur}</p>
              )}
            </div>
          )}

          {/* Site name */}
          <Input
            label="Nom du site"
            placeholder="ex: Cimenterie Sfax"
            value={formData.nom}
            onChange={(e) => setFormData((prev) => ({ ...prev, nom: e.target.value }))}
            error={errors.nom}
          />

          {/* Location */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Adresse"
              placeholder="ex: Route de Tunis km 5"
              value={formData.localisation?.adresse || ''}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  localisation: {
                    ...(prev.localisation || { type: 'Point', coordinates: [0, 0] }),
                    adresse: e.target.value,
                  },
                }))
              }
            />
            <Input
              label="Ville"
              placeholder="ex: Sfax"
              value={formData.localisation?.ville || ''}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  localisation: {
                    ...(prev.localisation || { type: 'Point', coordinates: [0, 0] }),
                    ville: e.target.value,
                  },
                }))
              }
            />
          </div>

          {/* Zone section divider */}
          <div className="border-t border-border pt-2">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
              Zone initiale (obligatoire)
            </p>
            <p className="mb-3 text-xs text-text-secondary">
              Un site doit contenir au moins une zone de surveillance.
            </p>
          </div>

          {/* Zone name */}
          <Input
            label="Nom de la zone"
            placeholder="ex: Zone A — Fours"
            value={formData.zoneName}
            onChange={(e) => setFormData((prev) => ({ ...prev, zoneName: e.target.value }))}
            error={errors.zoneName}
          />

          {/* Pollutants picker */}
          <div>
            <p className="mb-2 text-sm font-medium text-text-primary">
              Polluants surveillés
              {errors.pollutants && (
                <span className="ml-2 text-xs font-normal text-danger">{errors.pollutants}</span>
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              {POLLUTANT_CODES.map((code) => {
                const p = POLLUTANTS[code]
                const selected = formData.pollutants.includes(code)
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => togglePollutant(code)}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      selected
                        ? 'border-transparent text-white'
                        : 'border-border bg-white text-text-secondary hover:border-accent hover:text-accent'
                    }`}
                    style={selected ? { backgroundColor: p.color, borderColor: p.color } : {}}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: selected ? 'white' : p.color }}
                    />
                    {p.label}
                  </button>
                )
              })}
            </div>
            {formData.pollutants.length > 0 && (
              <p className="mt-1.5 text-xs text-text-secondary">
                {formData.pollutants.length} polluant{formData.pollutants.length > 1 ? 's' : ''}{' '}
                sélectionné{formData.pollutants.length > 1 ? 's' : ''}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={onClose}>
              Annuler
            </Button>
            <Button variant="primary" loading={createSite.isPending} onClick={handleSubmit}>
              {isSuperAdmin ? 'Créer' : 'Soumettre pour validation'}
            </Button>
          </div>
        </Card>
      )}
    </Modal>
  )
}
