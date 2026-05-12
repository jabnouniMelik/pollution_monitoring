import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Modal } from '@/components/ui/Modal/Modal'
import { Button } from '@/components/ui/Button/Button'
import { Input } from '@/components/ui/Input/Input'
import { Card } from '@/components/ui/Card/Card'
import { useUpdateSite } from '@/features/sites/hooks/useSites'
import { useCreateZone } from '@/features/zones/hooks/useZones'
import { POLLUTANTS, POLLUTANT_CODES, type PollutantCode } from '@/lib/constants/pollutants'
import type { Site, UpdateSiteInput } from '@/features/sites'

type Tab = 'edit' | 'add-zone'

interface SiteEditModalProps {
  site: Site
  onClose: () => void
}

export function SiteEditModal({ site, onClose }: SiteEditModalProps) {
  const [tab, setTab] = useState<Tab>('edit')

  // ── Edit site state ──────────────────────────────────────────
  const [formData, setFormData] = useState<UpdateSiteInput>({
    nom: site.nom,
    description: site.description,
    localisation: site.localisation,
  })
  const [siteErrors, setSiteErrors] = useState<Record<string, string>>({})
  const updateSite = useUpdateSite()

  const validateSite = (): boolean => {
    const errs: Record<string, string> = {}
    if (!formData.nom?.trim()) errs.nom = 'Requis'
    setSiteErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSiteSubmit = () => {
    if (!validateSite()) return
    updateSite.mutate({ id: site.id, input: formData }, { onSuccess: onClose })
  }

  // ── Add zone state ───────────────────────────────────────────
  const [zoneName, setZoneName] = useState('')
  const [pollutants, setPollutants] = useState<PollutantCode[]>([])
  const [zoneErrors, setZoneErrors] = useState<Record<string, string>>({})
  const [zoneSent, setZoneSent] = useState(false)
  const createZone = useCreateZone()

  const togglePollutant = (code: PollutantCode) => {
    setPollutants((prev) =>
      prev.includes(code) ? prev.filter((p) => p !== code) : [...prev, code],
    )
  }

  const validateZone = (): boolean => {
    const errs: Record<string, string> = {}
    if (!zoneName.trim()) errs.zoneName = 'Requis'
    if (pollutants.length === 0) errs.pollutants = 'Sélectionnez au moins un polluant'
    setZoneErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleZoneSubmit = () => {
    if (!validateZone()) return
    createZone.mutate(
      { nom: zoneName, siteId: site.id, pollutants },
      {
        onSuccess: () => {
          setZoneSent(true)
        },
      },
    )
  }

  return (
    <Modal open onClose={onClose} title="Éditer le site" description={`Mise à jour de ${site.nom}`}>
      {/* Tab bar */}
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setTab('edit')}
          className={`px-5 py-2.5 text-sm font-medium transition-colors ${
            tab === 'edit'
              ? 'border-b-2 border-accent text-accent'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Informations
        </button>
        <button
          type="button"
          onClick={() => { setTab('add-zone'); setZoneSent(false) }}
          className={`flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium transition-colors ${
            tab === 'add-zone'
              ? 'border-b-2 border-accent text-accent'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          <Plus className="h-3.5 w-3.5" />
          Ajouter une zone
        </button>
      </div>

      {/* ── Tab: Edit site ─────────────────────────────────────── */}
      {tab === 'edit' && (
        <Card className="space-y-4 p-6">
          <Input
            label="Nom du site"
            placeholder="ex: Cimenterie Sfax"
            value={formData.nom || ''}
            onChange={(e) => setFormData((prev) => ({ ...prev, nom: e.target.value }))}
            error={siteErrors.nom}
          />

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

          <Input
            label="Description"
            placeholder="Description du site"
            value={formData.description || ''}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={onClose}>
              Annuler
            </Button>
            <Button variant="primary" loading={updateSite.isPending} onClick={handleSiteSubmit}>
              Enregistrer
            </Button>
          </div>
        </Card>
      )}

      {/* ── Tab: Add zone ──────────────────────────────────────── */}
      {tab === 'add-zone' && (
        <Card className="space-y-4 p-6">
          {zoneSent ? (
            /* Success state */
            <div className="space-y-4 py-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-light text-success">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-text-primary">Demande envoyée</p>
                <p className="mt-1 text-sm text-text-secondary">
                  La création de la zone <strong>{zoneName}</strong> est en attente de validation
                  par le Super Admin.
                </p>
              </div>
              <div className="flex justify-center gap-2 pt-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setZoneName('')
                    setPollutants([])
                    setZoneSent(false)
                  }}
                >
                  Ajouter une autre zone
                </Button>
                <Button variant="primary" onClick={onClose}>
                  Fermer
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Approval notice */}
              <div className="flex items-start gap-2 rounded-lg border border-warning-light bg-warning-light/30 px-3 py-2.5 text-xs text-warning-dark">
                <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                <span>
                  La nouvelle zone sera soumise à la validation du <strong>Super Admin</strong> avant
                  d'être activée.
                </span>
              </div>

              {/* Site — read-only */}
              <div className="rounded-lg border border-border bg-bg px-3 py-2">
                <p className="text-xs text-text-secondary">Site</p>
                <p className="text-sm font-medium text-text-primary">{site.nom}</p>
                {site.localisation?.ville && (
                  <p className="text-xs text-text-tertiary">{site.localisation.ville}</p>
                )}
              </div>

              {/* Zone name */}
              <Input
                label="Nom de la zone"
                placeholder="ex: Zone C — Stockage"
                value={zoneName}
                onChange={(e) => setZoneName(e.target.value)}
                error={zoneErrors.zoneName}
              />

              {/* Location note */}
              <div className="rounded-lg border border-border bg-bg px-3 py-2 text-xs text-text-secondary">
                📍 La localisation sera identique à celle du site.
              </div>

              {/* Pollutants picker */}
              <div>
                <p className="mb-2 text-sm font-medium text-text-primary">
                  Polluants surveillés
                  {zoneErrors.pollutants && (
                    <span className="ml-2 text-xs font-normal text-danger">
                      {zoneErrors.pollutants}
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap gap-2">
                  {POLLUTANT_CODES.map((code) => {
                    const p = POLLUTANTS[code]
                    const selected = pollutants.includes(code)
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
                {pollutants.length > 0 && (
                  <p className="mt-1.5 text-xs text-text-secondary">
                    {pollutants.length} polluant{pollutants.length > 1 ? 's' : ''} sélectionné
                    {pollutants.length > 1 ? 's' : ''}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={onClose}>
                  Annuler
                </Button>
                <Button
                  variant="primary"
                  loading={createZone.isPending}
                  onClick={handleZoneSubmit}
                >
                  Soumettre pour validation
                </Button>
              </div>
            </>
          )}
        </Card>
      )}
    </Modal>
  )
}
