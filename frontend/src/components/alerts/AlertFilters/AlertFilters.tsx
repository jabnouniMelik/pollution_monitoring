import { Search } from 'lucide-react'
import { Select, type SelectOption } from '@/components/ui/Select/Select'
import type { AlertFilters, AlertSeverity, AlertStatus } from '@/features/alerts/types/alert.types'
import { POLLUTANT_CODES, POLLUTANTS } from '@/lib/constants/pollutants'

interface AlertFiltersBarProps {
  value: AlertFilters
  onChange: (next: AlertFilters) => void
}

const SEVERITY_OPTIONS: SelectOption<AlertSeverity | ''>[] = [
  { value: '', label: 'Toutes sévérités' },
  { value: 'critical', label: 'Critique' },
  { value: 'warning', label: 'Alerte' },
  { value: 'info', label: 'Info' },
]

const STATUS_OPTIONS: SelectOption<AlertStatus | ''>[] = [
  { value: '', label: 'Tous statuts' },
  { value: 'open', label: 'Ouvertes' },
  { value: 'acknowledged', label: 'Acquittées' },
  { value: 'escalated', label: 'Escaladées' },
  { value: 'resolved', label: 'Résolues' },
]

const POLLUTANT_OPTIONS: SelectOption[] = [
  { value: '', label: 'Tous polluants' },
  ...POLLUTANT_CODES.map((code) => ({ value: code, label: POLLUTANTS[code].label })),
]

export function AlertFiltersBar({ value, onChange }: AlertFiltersBarProps) {
  const patch = <K extends keyof AlertFilters>(key: K, v: AlertFilters[K] | '') =>
    onChange({ ...value, [key]: (v === '' ? undefined : v) as AlertFilters[K] })

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="relative min-w-[220px] flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary"
          aria-hidden="true"
        />
        <input
          type="search"
          aria-label="Rechercher une alerte"
          placeholder="Rechercher…"
          className="input pl-9"
          value={value.search ?? ''}
          onChange={(e) => onChange({ ...value, search: e.target.value || undefined })}
        />
      </div>
      <Select
        aria-label="Filtrer par sévérité"
        options={SEVERITY_OPTIONS as SelectOption[]}
        value={value.severity ?? ''}
        onChange={(e) => patch('severity', e.target.value as AlertSeverity | '')}
      />
      <Select
        aria-label="Filtrer par statut"
        options={STATUS_OPTIONS as SelectOption[]}
        value={value.status ?? ''}
        onChange={(e) => patch('status', e.target.value as AlertStatus | '')}
      />
      <Select
        aria-label="Filtrer par polluant"
        options={POLLUTANT_OPTIONS}
        value={value.pollutant ?? ''}
        onChange={(e) => patch('pollutant', e.target.value)}
      />
    </div>
  )
}
