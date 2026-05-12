import { useState } from 'react'
import { Modal } from '@/components/ui/Modal/Modal'
import { Button } from '@/components/ui/Button/Button'
import { Input } from '@/components/ui/Input/Input'
import { Card } from '@/components/ui/Card/Card'
import { useCreateZone } from '@/features/zones/hooks/useZones'
import { useSites } from '@/features/sites/hooks/useSites'
import { POLLUTANTS, POLLUTANT_CODES, type PollutantCode } from '@/lib/constants/pollutants'
import type { CreateZoneInput } from '@/features/zones'

interface ZoneCreateModalProps {
  /** Pre-selected siteId when opened from the Zones page */
  siteId?: string
  onClose: () => void
}

export function ZoneCreateModal({ siteId: initialSiteId, onClose }: ZoneCreateModalProps) {
  const [formData, setFormData] = useState<CreateZoneInput>({
    nom: '',
    siteId: initialSiteId || '',
    pollutants: [],
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const createZone = useCreateZone()

  // Load available sites for the selector (only shown when no siteId pre-selected)
  const { data: sitesData, isLoading: sitesLoading } = useSites(
    { pageSize: 100 },
  )
  const sites = sitesData?.sites || []

  const togglePollutant = (code: PollutantCode) => {
    setFormData((prev) => ({
      ...prev,
      pollutants: prev.pollutants.includes(code)
        ? prev.pollutants.filter((p) => p !== code)
        : [...prev.pollutants, code],
    }))
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!formData.nom.trim()) newErrors.nom = 'Requis'
    if (!formData.siteId) newErrors.siteId = 'Sélectionnez un site'
    if (formData.pollutants.length === 0) newErrors.pollutants = 'Sélectionnez au moins un polluant'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    createZone.mutate(formData, { onSuccess: () => onClose() })
  }

  const selectedSite = sites.find((s) => s.id === formData.siteId)

  return (
    <Modal
      open
      onClose={onClose}
      title="Créer une zone"
      description="Remplissez les informations ci-dessous"
    >
      <Card className="space-y-4 p-6">
        {/* Site selector — hidden when siteId is pre-selected */}
        {!initialSiteId ? (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">
              Site
              {errors.siteId && (
                <span className="ml-2 text-xs font-normal text-danger">{errors.siteId}</span>
              )}
            </label>
            {sitesLoading ? (
              <div className="h-10 animate-pulse rounded-lg bg-bg" />
            ) : (
              <select
                value={formData.siteId}
                onChange={(e) => setFormData((prev) => ({ ...prev, siteId: e.target.value }))}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="">— Choisir un site —</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.nom}
                    {site.localisation?.ville ? ` · ${site.localisation.ville}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
        ) : (
          /* Read-only site display when pre-selected */
          selectedSite || initialSiteId ? (
            <div className="rounded-lg border border-border bg-bg px-3 py-2">
              <p className="text-xs text-text-secondary">Site</p>
              <p className="text-sm font-medium text-text-primary">
                {selectedSite?.nom || initialSiteId}
              </p>
              {selectedSite?.localisation?.ville && (
                <p className="text-xs text-text-tertiary">{selectedSite.localisation.ville}</p>
              )}
            </div>
          ) : null
        )}

        {/* Zone name */}
        <Input
          label="Nom de la zone"
          placeholder="ex: Zone B — Concassage"
          value={formData.nom}
          onChange={(e) => setFormData((prev) => ({ ...prev, nom: e.target.value }))}
          error={errors.nom}
        />

        {/* Location info — inherited from site */}
        <div className="rounded-lg border border-border bg-bg px-3 py-2 text-xs text-text-secondary">
          📍 La localisation de la zone sera identique à celle du site sélectionné.
        </div>

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
              {formData.pollutants.length} polluant{formData.pollutants.length > 1 ? 's' : ''} sélectionné{formData.pollutants.length > 1 ? 's' : ''}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" loading={createZone.isPending} onClick={handleSubmit}>
            Créer
          </Button>
        </div>
      </Card>
    </Modal>
  )
}
