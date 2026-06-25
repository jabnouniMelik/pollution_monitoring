import { Table, type TableColumn } from '@/components/ui/Table/Table'
import { Badge } from '@/components/ui/Badge/Badge'
import { formatNumber } from '@/lib/utils/formatters'
import { statusFromLimit } from '@/lib/utils/colorUtils'

export interface ComplianceRow {
  pollutant: string
  label: string
  value: number
  regulatoryLimit: number
  siteLimit?: number
  unit: string
  reference?: string
}

interface ComplianceTableProps {
  rows: ComplianceRow[]
}

export function ComplianceTable({ rows }: ComplianceTableProps) {
  const columns: TableColumn<ComplianceRow>[] = [
    {
      key: 'pollutant',
      header: 'Polluant',
      accessor: (r) => <span className="font-semibold">{r.label}</span>,
    },
    {
      key: 'value',
      header: 'Mesure',
      align: 'right',
      accessor: (r) => `${formatNumber(r.value, 1)} ${r.unit}`,
    },
    {
      key: 'limit',
      header: 'Limite',
      align: 'right',
      accessor: (r) => `${formatNumber(r.siteLimit ?? r.regulatoryLimit, 0)} ${r.unit}`,
    },
    {
      key: 'ratio',
      header: '% Limite',
      align: 'right',
      accessor: (r) => {
        const limit = r.siteLimit ?? r.regulatoryLimit
        const pct = limit > 0 ? (r.value / limit) * 100 : 0
        return `${formatNumber(pct, 0)} %`
      },
    },
    {
      key: 'status',
      header: 'Statut',
      accessor: (r) => {
        const status = statusFromLimit(r.value, r.siteLimit ?? r.regulatoryLimit)
        const label =
          status === 'danger' ? 'Dépassement' : status === 'warning' ? 'Alerte' : 'Conforme'
        const variant = status === 'neutral' ? 'neutral' : status
        return <Badge variant={variant}>{label}</Badge>
      },
    },
    {
      key: 'ref',
      header: 'Référence',
      accessor: (r) => <span className="text-xs text-text-secondary">{r.reference ?? '—'}</span>,
    },
  ]

  return (
    <Table<ComplianceRow>
      columns={columns}
      data={rows}
      getRowKey={(r) => r.pollutant}
      caption="Conformité des polluants — Décret n° 2018-928, Annexe 1 (valeurs générales, toutes sources fixes)"
      emptyMessage="Aucun polluant configuré"
    />
  )
}
