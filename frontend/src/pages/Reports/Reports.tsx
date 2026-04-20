import { useState } from 'react'
import { Download, FileText, Plus } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader/PageHeader'
import { Card } from '@/components/ui/Card/Card'
import { Button } from '@/components/ui/Button/Button'
import { Table, type TableColumn } from '@/components/ui/Table/Table'
import { Badge } from '@/components/ui/Badge/Badge'
import { EmptyState } from '@/components/common/EmptyState/EmptyState'
import { Modal } from '@/components/ui/Modal/Modal'
import { Input } from '@/components/ui/Input/Input'
import { Select } from '@/components/ui/Select/Select'
import { PermissionGate } from '@/components/common/PermissionGate/PermissionGate'
import { useGenerateReport, useReports } from '@/features/reports/hooks/useReports'
import { formatDateTime } from '@/lib/utils/formatters'
import type { GenerateReportPayload, Report } from '@/features/reports/types/report.types'

export default function Reports() {
  const reports = useReports()
  const generate = useGenerateReport()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<GenerateReportPayload>({
    title: '',
    from: '',
    to: '',
    format: 'pdf',
    includeCompliance: true,
    includeAlerts: true,
  })

  const columns: TableColumn<Report>[] = [
    {
      key: 'title',
      header: 'Titre',
      accessor: (r) => (
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-text-tertiary" aria-hidden="true" />
          <span className="font-semibold">{r.title}</span>
        </div>
      ),
    },
    { key: 'period', header: 'Période', accessor: (r) => r.period ?? '—' },
    { key: 'format', header: 'Format', accessor: (r) => (r.format ?? 'pdf').toUpperCase() },
    {
      key: 'generatedAt',
      header: 'Généré',
      accessor: (r) => (r.generatedAt ? formatDateTime(r.generatedAt) : '—'),
    },
    {
      key: 'status',
      header: 'Statut',
      accessor: (r) => (
        <Badge variant={r.status === 'ready' ? 'success' : r.status === 'failed' ? 'danger' : 'info'}>
          {r.status ?? 'ready'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      accessor: (r) =>
        r.url ? (
          <a
            href={r.url}
            className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
            download
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" /> Télécharger
          </a>
        ) : (
          '—'
        ),
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Rapports"
        subtitle="Génération de rapports réglementaires (ANPE) et opérationnels"
        actions={
          <PermissionGate permission="GENERATE_REPORT">
            <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>
              Nouveau rapport
            </Button>
          </PermissionGate>
        }
      />

      <Card padded={false}>
        {reports.data && reports.data.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<FileText className="h-8 w-8" />}
              title="Aucun rapport"
              description="Générez votre premier rapport pour le soumettre à l’ANPE."
            />
          </div>
        ) : (
          <Table<Report>
            columns={columns}
            data={reports.data ?? []}
            getRowKey={(r) => r.id}
            emptyMessage={reports.isLoading ? 'Chargement…' : 'Aucun rapport'}
          />
        )}
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nouveau rapport"
        description="Configurez la période et le format du rapport à générer."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="primary"
              loading={generate.isPending}
              onClick={async () => {
                await generate.mutateAsync(form)
                setOpen(false)
              }}
            >
              Générer
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="Titre"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Rapport trimestriel T1 2026"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Début"
              type="date"
              value={form.from}
              onChange={(e) => setForm({ ...form, from: e.target.value })}
            />
            <Input
              label="Fin"
              type="date"
              value={form.to}
              onChange={(e) => setForm({ ...form, to: e.target.value })}
            />
          </div>
          <Select
            label="Format"
            options={[
              { value: 'pdf', label: 'PDF' },
              { value: 'csv', label: 'CSV' },
              { value: 'xlsx', label: 'Excel' },
            ]}
            value={form.format}
            onChange={(e) => setForm({ ...form, format: e.target.value as GenerateReportPayload['format'] })}
          />
        </div>
      </Modal>
    </div>
  )
}
