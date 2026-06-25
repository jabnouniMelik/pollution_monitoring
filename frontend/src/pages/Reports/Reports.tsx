import { useMemo, useState } from 'react'
import {
  Check,
  Download,
  FileText,
  Plus,
  Send,
  Trash2,
  X,
} from 'lucide-react'
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
import {
  useApproveReport,
  useDeleteReport,
  useGenerateReport,
  useRejectReport,
  useReports,
  useSubmitReport,
} from '@/features/reports/hooks/useReports'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useWebSocketSubscription } from '@/features/websocket/useWebSocketSubscription'
import { formatDateTime } from '@/lib/utils/formatters'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import type { GenerateReportPayload, Report, ReportWorkflowStatus } from '@/features/reports/types/report.types'
import type { Zone } from '@/features/auth/types/auth.types'
import { Role } from '@/lib/constants/roles'
import { hasPermission } from '@/lib/rbac/checkPermission'

const STATUS_LABELS: Record<ReportWorkflowStatus, string> = {
  DRAFT: 'Brouillon',
  SUBMITTED: 'En attente',
  APPROVED: 'Approuvé',
  REJECTED: 'Refusé',
}

const STATUS_VARIANT: Record<
  ReportWorkflowStatus,
  'neutral' | 'info' | 'warning' | 'success' | 'danger'
> = {
  DRAFT: 'info',
  SUBMITTED: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
}

type StatusFilter = 'all' | ReportWorkflowStatus

function resolveUserId(user: { userId?: string; _id?: string } | null): string {
  return user?.userId || user?._id || ''
}

export default function Reports() {
  const { user } = useAuth()
  const toast = useToast()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [open, setOpen] = useState(false)
  const [rejectTarget, setRejectTarget] = useState<Report | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [form, setForm] = useState<GenerateReportPayload>({
    title: '',
    from: '',
    to: '',
    format: 'pdf',
    includeCompliance: true,
    includeAlerts: true,
    zoneId: undefined,
  })

  const listParams = useMemo(
    () => (statusFilter === 'all' ? {} : { status: statusFilter }),
    [statusFilter],
  )

  const reports = useReports(listParams)
  const generate = useGenerateReport()
  const submit = useSubmitReport()
  const approve = useApproveReport()
  const reject = useRejectReport()
  const remove = useDeleteReport()

  useWebSocketSubscription(['reports:all'])

  const zones: Zone[] = (user?.zonesAssigned ?? []) as Zone[]
  const showZonePicker = zones.length > 0
  const isAuditor = user?.role === Role.AUDITOR
  const currentUserId = resolveUserId(user)

  const pendingCount = useMemo(() => {
    const data = reports.data ?? []
    return data.filter((r) => r.workflowStatus === 'SUBMITTED').length
  }, [reports.data])

  const handleGenerate = async () => {
    if (!form.from || !form.to) {
      toast.error('Veuillez sélectionner une période')
      return
    }
    if (new Date(form.from) >= new Date(form.to)) {
      toast.error('La date de début doit être avant la date de fin')
      return
    }
    try {
      await generate.mutateAsync(form)
      setOpen(false)
      setForm({
        title: '',
        from: '',
        to: '',
        format: 'pdf',
        includeCompliance: true,
        includeAlerts: true,
        zoneId: undefined,
      })
    } catch {
      // toast handled by mutation
    }
  }

  const handleReject = async () => {
    if (!rejectTarget) return
    if (!rejectReason.trim()) {
      toast.error('Indiquez un motif de refus')
      return
    }
    try {
      await reject.mutateAsync({ id: rejectTarget.id, reason: rejectReason.trim() })
      setRejectTarget(null)
      setRejectReason('')
    } catch {
      // toast handled by mutation
    }
  }

  const filterTabs: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'Tous' },
    { key: 'DRAFT', label: 'Brouillons' },
    {
      key: 'SUBMITTED',
      label: isAuditor ? `À valider${pendingCount ? ` (${pendingCount})` : ''}` : 'En attente',
    },
    { key: 'APPROVED', label: 'Approuvés' },
    { key: 'REJECTED', label: 'Refusés' },
  ]

  const columns: TableColumn<Report>[] = [
    {
      key: 'title',
      header: 'Titre',
      accessor: (r) => (
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-text-tertiary" aria-hidden="true" />
          <div>
            <span className="font-semibold">{r.title}</span>
            {r.rejectionReason && r.workflowStatus === 'REJECTED' && (
              <p className="mt-0.5 text-[11px] text-danger">{r.rejectionReason}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'author',
      header: 'Auteur',
      accessor: (r) => r.generatedByName ?? '—',
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
        <Badge variant={STATUS_VARIANT[r.workflowStatus]}>
          {STATUS_LABELS[r.workflowStatus]}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      accessor: (r) => {
        const isAuthor = r.generatedById === currentUserId

        return (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {r.url && (
              <a
                href={r.url}
                className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                download
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" /> Télécharger
              </a>
            )}

            {r.workflowStatus === 'DRAFT' && hasPermission(user?.role, 'SUBMIT_REPORT') && (
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Send className="h-3.5 w-3.5" />}
                loading={submit.isPending}
                onClick={() => submit.mutate(r.id)}
              >
                Soumettre
              </Button>
            )}

            {r.workflowStatus === 'SUBMITTED' && isAuditor && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Check className="h-3.5 w-3.5" />}
                  loading={approve.isPending}
                  onClick={() => approve.mutate({ id: r.id })}
                >
                  Approuver
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<X className="h-3.5 w-3.5" />}
                  onClick={() => {
                    setRejectTarget(r)
                    setRejectReason('')
                  }}
                >
                  Refuser
                </Button>
              </>
            )}

            {r.workflowStatus === 'DRAFT' && (isAuthor || !isAuditor) && (
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                loading={remove.isPending}
                onClick={() => remove.mutate(r.id)}
              >
                Supprimer
              </Button>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Rapports"
        subtitle={
          isAuditor
            ? 'Génération, validation et suivi des rapports réglementaires de votre industrie'
            : 'Génération de rapports réglementaires (ANPE) et opérationnels'
        }
        actions={
          <PermissionGate permission="GENERATE_REPORT">
            <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>
              Nouveau rapport
            </Button>
          </PermissionGate>
        }
      />

      <div className="flex flex-wrap gap-2">
        {filterTabs.map((tab) => (
          <Button
            key={tab.key}
            variant={statusFilter === tab.key ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setStatusFilter(tab.key)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <Card padded={false}>
        <QueryState
          query={reports}
          loadingSkeleton={<ReportsSkeleton />}
          emptyTitle="Aucun rapport"
          emptyDescription={
            isAuditor
              ? 'Aucun rapport dans cette catégorie pour votre industrie.'
              : 'Générez votre premier rapport puis soumettez-le à l’auditeur.'
          }
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
            <Button variant="primary" loading={generate.isPending} onClick={handleGenerate}>
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

          {isAuditor && (
            <p className="text-xs text-text-secondary">
              Les rapports générés par l’auditeur sont automatiquement validés.
            </p>
          )}
        </div>
      </Modal>

      <Modal
        open={Boolean(rejectTarget)}
        onClose={() => {
          setRejectTarget(null)
          setRejectReason('')
        }}
        title="Refuser le rapport"
        description={`Indiquez le motif de refus pour « ${rejectTarget?.title ?? ''} ».`}
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setRejectTarget(null)
                setRejectReason('')
              }}
            >
              Annuler
            </Button>
            <Button variant="danger" loading={reject.isPending} onClick={handleReject}>
              Confirmer le refus
            </Button>
          </>
        }
      >
        <Input
          label="Motif de refus"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="Données incomplètes, période incorrecte…"
        />
      </Modal>
    </div>
  )
}
