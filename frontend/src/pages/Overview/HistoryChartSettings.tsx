import { useEffect, useRef, useState } from 'react'
import { Settings2, Check } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { POLLUTANTS, POLLUTANT_CODES, type PollutantCode } from '@/lib/constants/pollutants'
import { ENVIRONMENT_PARAMS, ENV_PARAM_CODES, type EnvParamCode } from '@/lib/constants/environment'

interface HistoryChartSettingsProps {
  visiblePollutants: Set<PollutantCode>
  visibleEnv: Set<EnvParamCode>
  onTogglePollutant: (code: PollutantCode) => void
  onToggleEnv: (code: EnvParamCode) => void
  onSelectAll: () => void
  onReset: () => void
}

export function HistoryChartSettings({
  visiblePollutants,
  visibleEnv,
  onTogglePollutant,
  onToggleEnv,
  onSelectAll,
  onReset,
}: HistoryChartSettingsProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const totalVisible = visiblePollutants.size + visibleEnv.size
  const totalAll = POLLUTANT_CODES.length + ENV_PARAM_CODES.length

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium transition-colors',
          open
            ? 'bg-accent/10 text-accent'
            : 'text-text-secondary hover:bg-bg hover:text-text-primary',
        )}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Personnaliser les séries affichées"
      >
        <Settings2 className="h-3 w-3" />
        <span>
          Séries · {totalVisible}/{totalAll}
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-card border border-border bg-white shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-border bg-bg px-3 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
              Séries affichées
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={onSelectAll}
                className="rounded px-1.5 py-0.5 text-[10px] font-medium text-accent hover:bg-accent/10"
              >
                Tout
              </button>
              <button
                type="button"
                onClick={onReset}
                className="rounded px-1.5 py-0.5 text-[10px] font-medium text-text-secondary hover:bg-border/40"
              >
                Par défaut
              </button>
            </div>
          </div>

          <div className="px-2 py-2">
            <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
              Polluants
            </div>
            <ul className="space-y-0.5">
              {POLLUTANT_CODES.map((code) => {
                const active = visiblePollutants.has(code)
                const meta = POLLUTANTS[code]
                return (
                  <li key={code}>
                    <button
                      type="button"
                      role="menuitemcheckbox"
                      aria-checked={active}
                      onClick={() => onTogglePollutant(code)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-bg"
                    >
                      <CheckBox active={active} color={meta.color} />
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: meta.color }}
                        aria-hidden
                      />
                      <span className="flex-1 truncate text-text-primary">{meta.label}</span>
                      <span className="text-[10px] text-text-tertiary">{meta.unit}</span>
                    </button>
                  </li>
                )
              })}
            </ul>

            <div className="mt-2 px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
              Conditions environnementales
            </div>
            <ul className="space-y-0.5">
              {ENV_PARAM_CODES.map((code) => {
                const active = visibleEnv.has(code)
                const meta = ENVIRONMENT_PARAMS[code]
                return (
                  <li key={code}>
                    <button
                      type="button"
                      role="menuitemcheckbox"
                      aria-checked={active}
                      onClick={() => onToggleEnv(code)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-bg"
                    >
                      <CheckBox active={active} color={meta.color} />
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: meta.color }}
                        aria-hidden
                      />
                      <span className="flex-1 truncate text-text-primary">{meta.longLabel}</span>
                      <span className="text-[10px] text-text-tertiary">{meta.unit}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

function CheckBox({ active, color }: { active: boolean; color: string }) {
  return (
    <span
      className={cn(
        'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-colors',
        active ? 'border-transparent text-white' : 'border-border bg-white',
      )}
      style={active ? { backgroundColor: color } : undefined}
      aria-hidden
    >
      {active && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
    </span>
  )
}
