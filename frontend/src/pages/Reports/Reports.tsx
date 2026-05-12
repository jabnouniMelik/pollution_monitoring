import { useState } from 'react'
import { Download, FileText, Plus } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader/PageHeader'
import { Card } from '@/components/ui/Card/Card'
import { Button } from '@/components/ui/Button/Button'
import { Table, type TableColumn } from '@/components/ui/Table/Table'
import { Badge } from '@/components/ui/Badge/Badge'
import { QueryState } from '@/components/common/QueryState/QueryState'
import { ReportsSkeleton } from '@/components/ui/Skeleton/SkeletonBlocks'
import { Modal } from '@/components/ui/Modal/Modal'
import { Input } from '@/components/ui/Input/Input'
import { Select } from '@/components/ui/Select/Select'
import { PermissionGate } from '@/components/common/PermissionGate/PermissionGate'
import { useGenerateReport, useReports } from '@/features/reports/hooks/useReports'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { formatDateTime } from '@/lib/utils/formatters'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import type { GenerateReportPayload, Report } from '@/features/reports/types/report.types'
import type { Zone } from '@/features/auth/types/auth.types'
import { Role } from '@/lib/constants/roles'

export default function Reports() {
  const reports = useReports()
  const generate = useGenerateReport()
  const { user } = useAuth()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<GenerateReportPayload>({
    title: '',
    from: '',
    to: '',
    format: 'pdf',
    includeCompliance: true,
    includeAlerts: true,
    zoneId: undefined,
  })

  // Zones available to this user
  const zones: Zone[] = (user?.zonesAssigned ?? []) as Zone[]
  const showZonePicker = zones.length > 0

  const handleGenerate = async () => {
    if (!form.from || !form.to) {
      toast.error('Veuillez sélectionner une période')
      return
    }
    if (new Date(form.from) >= new Date(form.to)) {
      toast.error('La date de début doit être avant la date de fin')
      return
    }
    await generate.mutateAsync(form)
    setOpen(false)
    setForm({ title: '', from: '', to: '', format: 'pdf', includeCompliance: true, includeAlerts: true, zoneId: undefined })
  }

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
          {r.status === 'ready' ? 'Prêt' : r.status === 'pending' ? 'En cours' : r.status ?? 'Prêt'}
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
        <QueryState
          query={reports}
          loadingSkeleton={<ReportsSkeleton />}
          emptyTitle="Aucun rapport"
          emptyDescription="Générez votre premier rapport pour le soumettre à l'ANPE."
          errorTitle="Erreur de chargement"
          errorDescription="Impossible de charger la liste des rapports."
        >
          {(data) => (
            <Table<Report>
              columns={columns}
              data={data}
              getRowKey={(r) => r.id}
              emptyMessage="Aucun rapport"
            />
          )}
        </QueryState>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nouveau rapport"
        description="Configurez la période, la zone et le format du rapport."
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="primary"
              loading={generate.isPending}
              onClick={handleGenerate}
            >
              Générer
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="Titre (optionnel)"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Rapport trimestriel T1 2026"
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Date de début"
              type="date"
              value={form.from}
              onChange={(e) => setForm({ ...form, from: e.target.value })}
            />
            <Input
              label="Date de fin"
              type="date"
              value={form.to}
              onChange={(e) => setForm({ ...form, to: e.target.value })}
            />
          </div>

          {/* Zone picker — shown when user has zones */}
          {showZonePicker && (
            <Select
              label="Zone"
              value={form.zoneId ?? ''}
              onChange={(e) => setForm({ ...form, zoneId: e.target.value || undefined })}
              options={[
                { value: '', label: 'Toutes les zones' },
                ...zones.map((z) => ({ value: z._id, label: `${z.nom} (${z.code})` })),
              ]}
            />
          )}

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
