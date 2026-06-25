import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Leaf, Building2, MapPin, User, Plus, Trash2, ChevronRight, ChevronLeft, CheckCircle, FlaskConical } from 'lucide-react'
import { Button } from '@/components/ui/Button/Button'
import { Input } from '@/components/ui/Input/Input'
import { api } from '@/lib/api/axios'
import { endpoints } from '@/lib/api/endpoints'
import { POLLUTANTS, POLLUTANT_CODES, type PollutantCode } from '@/lib/constants/pollutants'

// ── Tunisian gouvernorats ─────────────────────────────────────
const GOUVERNORATS = [
  'Ariana','Béja','Ben Arous','Bizerte','Gabès','Gafsa','Jendouba',
  'Kairouan','Kasserine','Kébili','Kef','Mahdia','Manouba','Médenine',
  'Monastir','Nabeul','Sfax','Sidi Bouzid','Siliana','Sousse',
  'Tataouine','Tozeur','Tunis','Zaghouan',
]

const SECTEURS = [
  'Ciment','Chimie','Raffinerie','Sidérurgie','Papier / Cellulose',
  'Agroalimentaire','Textile','Céramique / Verre',
  'Énergie / Centrale électrique','Mines / Extraction',
  'Traitement des déchets','Autre',
]

// ── Types ─────────────────────────────────────────────────────
interface ZoneForm {
  nom: string
  description: string
  pollutants: PollutantCode[]
}

interface SiteForm {
  nom: string
  description: string
  ville: string
  adresse: string
  zones: ZoneForm[]
}

interface FormData {
  // Step 1 — Industrie
  nom: string
  secteur: string
  gouvernorat: string
  ville: string
  adresse: string
  telephone: string
  email: string
  responsable: string
  matriculeFiscal: string
  autorisationAnpe: string
  // Step 2 — Superviseur
  superviseurNom: string
  superviseurEmail: string
  // Step 3 — Sites & Zones
  sites: SiteForm[]
  messageInscription: string
}

const emptyZone = (): ZoneForm => ({ nom: '', description: '', pollutants: [] })
const emptySite = (): SiteForm => ({
  nom: '', description: '', ville: '', adresse: '',
  zones: [emptyZone()],
})

const STEPS = [
  { id: 1, label: 'Industrie', icon: Building2 },
  { id: 2, label: 'Superviseur', icon: User },
  { id: 3, label: 'Sites & Zones', icon: MapPin },
  { id: 4, label: 'Confirmation', icon: CheckCircle },
]

// ── Pollutant picker ──────────────────────────────────────────
function PollutantPicker({
  selected, onChange,
}: { selected: PollutantCode[]; onChange: (codes: PollutantCode[]) => void }) {
  const toggle = (code: PollutantCode) => {
    onChange(selected.includes(code) ? selected.filter(c => c !== code) : [...selected, code])
  }
  return (
    <div className="flex flex-wrap gap-2">
      {POLLUTANT_CODES.map(code => {
        const p = POLLUTANTS[code]
        const active = selected.includes(code)
        return (
          <button
            key={code} type="button" onClick={() => toggle(code)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              active ? 'border-transparent text-white' : 'border-border bg-white text-text-secondary hover:border-accent hover:text-accent'
            }`}
            style={active ? { backgroundColor: p.color, borderColor: p.color } : {}}
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: active ? 'white' : p.color }} />
            {p.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Step indicator ────────────────────────────────────────────
function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {STEPS.map((step, i) => {
        const done = current > step.id
        const active = current === step.id
        return (
          <div key={step.id} className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${
              done ? 'bg-success text-white' : active ? 'bg-accent text-white' : 'bg-border text-text-tertiary'
            }`}>
              {done ? '✓' : step.id}
            </div>
            <span className={`hidden text-xs sm:block ${active ? 'font-semibold text-accent' : 'text-text-tertiary'}`}>
              {step.label}
            </span>
            {i < STEPS.length - 1 && <ChevronRight className="h-3 w-3 text-border" />}
          </div>
        )
      })}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────
export default function Register() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [form, setForm] = useState<FormData>({
    nom: '', secteur: '', gouvernorat: '', ville: '', adresse: '',
    telephone: '', email: '', responsable: '',
    matriculeFiscal: '', autorisationAnpe: '',
    superviseurNom: '', superviseurEmail: '',
    sites: [emptySite()],
    messageInscription: '',
  })

  const set = (field: keyof FormData, value: unknown) =>
    setForm(prev => ({ ...prev, [field]: value }))

  // ── Validation per step ───────────────────────────────────
  const validateStep = (s: number): boolean => {
    const errs: Record<string, string> = {}
    if (s === 1) {
      if (!form.nom.trim()) errs.nom = 'Requis'
      if (!form.secteur) errs.secteur = 'Requis'
      if (!form.gouvernorat) errs.gouvernorat = 'Requis'
    }
    if (s === 2) {
      if (!form.superviseurNom.trim()) errs.superviseurNom = 'Requis'
      if (!form.superviseurEmail.trim()) errs.superviseurEmail = 'Requis'
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.superviseurEmail))
        errs.superviseurEmail = 'Email invalide'
    }
    if (s === 3) {
      form.sites.forEach((site, si) => {
        if (!site.nom.trim()) errs[`site_${si}_nom`] = 'Requis'
        site.zones.forEach((zone, zi) => {
          if (!zone.nom.trim()) errs[`site_${si}_zone_${zi}_nom`] = 'Requis'
          if (zone.pollutants.length === 0) errs[`site_${si}_zone_${zi}_pollutants`] = 'Sélectionnez au moins un polluant'
        })
      })
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const next = () => { if (validateStep(step)) setStep(s => s + 1) }
  const back = () => setStep(s => s - 1)

  // ── Site / Zone helpers ───────────────────────────────────
  const addSite = () => set('sites', [...form.sites, emptySite()])
  const removeSite = (i: number) => set('sites', form.sites.filter((_, idx) => idx !== i))
  const updateSite = (i: number, patch: Partial<SiteForm>) =>
    set('sites', form.sites.map((s, idx) => idx === i ? { ...s, ...patch } : s))

  const addZone = (si: number) =>
    updateSite(si, { zones: [...form.sites[si].zones, emptyZone()] })
  const removeZone = (si: number, zi: number) =>
    updateSite(si, { zones: form.sites[si].zones.filter((_, idx) => idx !== zi) })
  const updateZone = (si: number, zi: number, patch: Partial<ZoneForm>) =>
    updateSite(si, {
      zones: form.sites[si].zones.map((z, idx) => idx === zi ? { ...z, ...patch } : z),
    })

  // ── Submit ────────────────────────────────────────────────
  const handleSubmit = async () => {
    setLoading(true)
    try {
      await api.post(endpoints.industries.register, {
        nom: form.nom,
        secteur: form.secteur,
        localisation: {
          gouvernorat: form.gouvernorat,
          ville: form.ville,
          adresse: form.adresse,
        },
        contact: {
          telephone: form.telephone,
          email: form.email,
          responsable: form.responsable,
        },
        matriculeFiscal: form.matriculeFiscal || null,
        autorisationAnpe: form.autorisationAnpe || null,
        superviseurNom: form.superviseurNom,
        superviseurEmail: form.superviseurEmail,
        requestedSites: form.sites.map(site => ({
          nom: site.nom,
          description: site.description || null,
          localisation: { ville: site.ville, adresse: site.adresse },
          zones: site.zones.map(zone => ({
            nom: zone.nom,
            description: zone.description || null,
            pollutants: zone.pollutants,
          })),
        })),
        messageInscription: form.messageInscription || null,
      })
      setSubmitted(true)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setErrors({ submit: msg || 'Une erreur est survenue. Veuillez réessayer.' })
    } finally {
      setLoading(false)
    }
  }

  // ── Success screen ────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#EBF3FB] to-[#F8FAFC] flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-card bg-white p-8 shadow-elevated text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success">
            <CheckCircle className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-semibold text-text-primary">Demande envoyée</h2>
          <p className="text-sm text-text-secondary">
            Votre demande d'inscription pour <strong>{form.nom}</strong> a été soumise avec succès.
          </p>
          <p className="text-sm text-text-secondary">
            Le Super Administrateur examinera votre dossier et vous contactera à l'adresse{' '}
            <strong>{form.superviseurEmail}</strong> avec vos identifiants de connexion.
          </p>
          <p className="text-xs text-text-tertiary">
            Délai de traitement habituel : 2 à 5 jours ouvrables.
          </p>
          <Button variant="primary" onClick={() => navigate('/login')} className="w-full">
            Retour à la connexion
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#EBF3FB] to-[#F8FAFC]">
      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-navy text-white">
            <Leaf className="h-5 w-5" />
          </div>
          <div>
            <div className="text-lg font-semibold text-navy">EmissionsIQ</div>
            <div className="text-xs text-text-secondary">Inscription d'une nouvelle industrie</div>
          </div>
        </div>

        <div className="rounded-card bg-white shadow-elevated p-6 md:p-8">
          <StepIndicator current={step} />

          {/* ── Step 1 : Industrie ─────────────────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
                <Building2 className="h-4 w-4 text-accent" /> Informations de l'industrie
              </h2>

              <Input label="Nom de l'industrie *" placeholder="ex: Cimenterie de Gabès"
                value={form.nom} onChange={e => set('nom', e.target.value)} error={errors.nom} />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text-primary">
                    Secteur d'activité *
                    {errors.secteur && <span className="ml-2 text-xs font-normal text-danger">{errors.secteur}</span>}
                  </label>
                  <select value={form.secteur} onChange={e => set('secteur', e.target.value)}
                    className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent">
                    <option value="">— Choisir —</option>
                    {SECTEURS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text-primary">
                    Gouvernorat *
                    {errors.gouvernorat && <span className="ml-2 text-xs font-normal text-danger">{errors.gouvernorat}</span>}
                  </label>
                  <select value={form.gouvernorat} onChange={e => set('gouvernorat', e.target.value)}
                    className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent">
                    <option value="">— Choisir —</option>
                    {GOUVERNORATS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input label="Ville" placeholder="ex: Gabès"
                  value={form.ville} onChange={e => set('ville', e.target.value)} />
                <Input label="Adresse" placeholder="ex: Route de Sfax km 12"
                  value={form.adresse} onChange={e => set('adresse', e.target.value)} />
              </div>

              <div className="border-t border-border pt-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-tertiary">Contact</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Input label="Téléphone" placeholder="ex: +216 74 000 000"
                    value={form.telephone} onChange={e => set('telephone', e.target.value)} />
                  <Input label="Email de contact" placeholder="contact@industrie.tn"
                    value={form.email} onChange={e => set('email', e.target.value)} />
                  <Input label="Responsable" placeholder="Nom du responsable"
                    value={form.responsable} onChange={e => set('responsable', e.target.value)} />
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                  Documents réglementaires (optionnel)
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input label="Matricule fiscal" placeholder="ex: 1234567/A/M/000"
                    value={form.matriculeFiscal} onChange={e => set('matriculeFiscal', e.target.value)} />
                  <Input label="N° autorisation ANPE" placeholder="ex: ANPE/2024/0123"
                    value={form.autorisationAnpe} onChange={e => set('autorisationAnpe', e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2 : Superviseur ───────────────────────── */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
                <User className="h-4 w-4 text-accent" /> Superviseur principal (HEAD_SUPERVISOR)
              </h2>
              <div className="rounded-lg border border-info-light bg-info-light/20 px-4 py-3 text-xs text-info-dark">
                Un compte <strong>Responsable Industrie</strong> sera créé automatiquement lors de l'approbation.
                Les identifiants de connexion seront envoyés à l'adresse email fournie.
              </div>
              <Input label="Nom complet *" placeholder="ex: Mohamed Ben Ali"
                value={form.superviseurNom} onChange={e => set('superviseurNom', e.target.value)}
                error={errors.superviseurNom} />
              <Input label="Email professionnel *" placeholder="ex: m.benali@industrie.tn"
                type="email" value={form.superviseurEmail}
                onChange={e => set('superviseurEmail', e.target.value)}
                error={errors.superviseurEmail} />
            </div>
          )}

          {/* ── Step 3 : Sites & Zones ─────────────────────── */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-accent" /> Sites et zones de surveillance
                </h2>
                <Button variant="secondary" size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={addSite}>
                  Ajouter un site
                </Button>
              </div>

              <div className="rounded-lg border border-border bg-bg px-4 py-3 text-xs text-text-secondary">
                Définissez vos sites industriels et les zones de surveillance au sein de chaque site.
                Chaque zone nécessitera un nœud capteur physique (ESP32) installé sur place.
              </div>

              {form.sites.map((site, si) => (
                <div key={si} className="rounded-lg border border-border p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-text-primary">Site {si + 1}</span>
                    {form.sites.length > 1 && (
                      <button onClick={() => removeSite(si)} className="text-danger hover:text-danger/80">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <Input label="Nom du site *" placeholder="ex: Usine principale"
                    value={site.nom} onChange={e => updateSite(si, { nom: e.target.value })}
                    error={errors[`site_${si}_nom`]} />

                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Ville" placeholder="ex: Sfax"
                      value={site.ville} onChange={e => updateSite(si, { ville: e.target.value })} />
                    <Input label="Adresse" placeholder="ex: Zone industrielle"
                      value={site.adresse} onChange={e => updateSite(si, { adresse: e.target.value })} />
                  </div>

                  {/* Zones */}
                  <div className="space-y-3 border-t border-border pt-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary flex items-center gap-1.5">
                        <FlaskConical className="h-3.5 w-3.5" /> Zones de surveillance
                      </p>
                      <button onClick={() => addZone(si)}
                        className="flex items-center gap-1 text-xs text-accent hover:underline">
                        <Plus className="h-3 w-3" /> Ajouter une zone
                      </button>
                    </div>

                    {site.zones.map((zone, zi) => (
                      <div key={zi} className="rounded-lg border border-border/60 bg-bg p-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-text-secondary">Zone {zi + 1}</span>
                          {site.zones.length > 1 && (
                            <button onClick={() => removeZone(si, zi)} className="text-danger/70 hover:text-danger">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>

                        <Input label="Nom de la zone *" placeholder="ex: Zone A — Fours de calcination"
                          value={zone.nom} onChange={e => updateZone(si, zi, { nom: e.target.value })}
                          error={errors[`site_${si}_zone_${zi}_nom`]} />

                        <div>
                          <p className="mb-2 text-xs font-medium text-text-primary">
                            Polluants à surveiller *
                            {errors[`site_${si}_zone_${zi}_pollutants`] && (
                              <span className="ml-2 text-xs font-normal text-danger">
                                {errors[`site_${si}_zone_${zi}_pollutants`]}
                              </span>
                            )}
                          </p>
                          <PollutantPicker
                            selected={zone.pollutants}
                            onChange={codes => updateZone(si, zi, { pollutants: codes })}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-primary">
                  Message (optionnel)
                </label>
                <textarea
                  rows={3}
                  placeholder="Informations complémentaires pour le Super Administrateur…"
                  value={form.messageInscription}
                  onChange={e => set('messageInscription', e.target.value)}
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                />
              </div>
            </div>
          )}

          {/* ── Step 4 : Récapitulatif ─────────────────────── */}
          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-accent" /> Récapitulatif de la demande
              </h2>

              <div className="rounded-lg border border-border divide-y divide-border text-sm">
                <div className="px-4 py-3 grid grid-cols-2 gap-2">
                  <span className="text-text-secondary">Industrie</span>
                  <span className="font-medium">{form.nom}</span>
                  <span className="text-text-secondary">Secteur</span>
                  <span>{form.secteur}</span>
                  <span className="text-text-secondary">Gouvernorat</span>
                  <span>{form.gouvernorat}{form.ville ? ` · ${form.ville}` : ''}</span>
                </div>
                <div className="px-4 py-3 grid grid-cols-2 gap-2">
                  <span className="text-text-secondary">Superviseur</span>
                  <span className="font-medium">{form.superviseurNom}</span>
                  <span className="text-text-secondary">Email</span>
                  <span>{form.superviseurEmail}</span>
                </div>
                <div className="px-4 py-3">
                  <p className="mb-2 text-text-secondary">{form.sites.length} site(s) demandé(s)</p>
                  {form.sites.map((site, si) => (
                    <div key={si} className="mb-2">
                      <p className="font-medium">{site.nom}</p>
                      {site.zones.map((zone, zi) => (
                        <div key={zi} className="ml-4 mt-1 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                          <span>↳ {zone.nom}</span>
                          <div className="flex gap-1">
                            {zone.pollutants.map(code => (
                              <span key={code} className="rounded-full px-2 py-0.5 text-white text-[10px]"
                                style={{ backgroundColor: POLLUTANTS[code]?.color }}>
                                {POLLUTANTS[code]?.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {errors.submit && (
                <div className="rounded-lg border border-danger-light bg-danger-light/20 px-4 py-3 text-sm text-danger">
                  {errors.submit}
                </div>
              )}

              <div className="rounded-lg border border-warning-light bg-warning-light/20 px-4 py-3 text-xs text-warning-dark">
                En soumettant cette demande, vous acceptez que vos données soient traitées par
                l'équipe EmissionsIQ dans le cadre de la mise en conformité avec le Décret n° 2018-928.
              </div>
            </div>
          )}

          {/* ── Navigation ────────────────────────────────── */}
          <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
            <div>
              {step > 1 && (
                <Button variant="secondary" leftIcon={<ChevronLeft className="h-4 w-4" />} onClick={back}>
                  Précédent
                </Button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Link to="/login" className="text-xs text-text-secondary hover:text-accent">
                Déjà inscrit ? Se connecter
              </Link>
              {step < 4 ? (
                <Button variant="primary" rightIcon={<ChevronRight className="h-4 w-4" />} onClick={next}>
                  Suivant
                </Button>
              ) : (
                <Button variant="primary" loading={loading} onClick={handleSubmit}>
                  Soumettre la demande
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
