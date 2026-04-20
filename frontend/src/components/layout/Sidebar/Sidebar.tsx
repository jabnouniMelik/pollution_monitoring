import { NavLink } from 'react-router-dom'
import {
  AlertTriangle,
  BarChart3,
  Bot,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Leaf,
  ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useUIStore } from '@/store/uiStore'
import { PermissionGate } from '@/components/common/PermissionGate/PermissionGate'
import type { Permission } from '@/lib/constants/roles'

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  requires?: Permission[]
  badge?: string
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Vue d’ensemble', icon: LayoutDashboard, requires: ['VIEW_KPI'] },
  { to: '/alerts', label: 'Alertes', icon: AlertTriangle, requires: ['VIEW_ALERTS'] },
  { to: '/history', label: 'Historique', icon: BarChart3, requires: ['VIEW_KPI'] },
  { to: '/compliance', label: 'Conformité', icon: ShieldCheck, requires: ['VIEW_KPI'] },
  { to: '/ai', label: 'Prédictions IA', icon: Bot, requires: ['VIEW_AI'] },
  { to: '/reports', label: 'Rapports', icon: FileText, requires: ['GENERATE_REPORT'] },
  { to: '/config', label: 'Configuration', icon: ClipboardList, requires: ['VIEW_CONFIG'] },
]

export function Sidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const toggle = useUIStore((s) => s.toggleSidebar)

  return (
    <aside
      className={cn(
        'sticky top-0 z-30 flex h-screen shrink-0 flex-col self-start border-r border-border bg-card transition-smooth',
        collapsed ? 'w-16' : 'w-64',
      )}
      aria-label="Navigation principale"
    >
      <div className="flex h-14 items-center gap-2 border-b border-border px-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-navy text-white">
          <Leaf className="h-4 w-4" aria-hidden="true" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-text-primary">EmissionsIQ</div>
            <div className="text-[10px] uppercase tracking-wider text-text-tertiary">
              Environnement
            </div>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin p-2">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => (
            <PermissionGate key={item.to} anyOf={item.requires}>
              <li>
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-smooth',
                      isActive
                        ? 'bg-[color:var(--ltblue)] text-accent'
                        : 'text-text-secondary hover:bg-bg hover:text-text-primary',
                    )
                  }
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {!collapsed && item.badge && (
                    <span className="ml-auto rounded-pill bg-danger-light px-1.5 py-0.5 text-[10px] font-semibold text-danger">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              </li>
            </PermissionGate>
          ))}
        </ul>
      </nav>

      <button
        type="button"
        onClick={toggle}
        aria-label={collapsed ? 'Déployer la barre latérale' : 'Réduire la barre latérale'}
        className="m-2 flex items-center justify-center gap-2 rounded-md border border-border bg-white px-2 py-1.5 text-xs text-text-secondary hover:bg-bg"
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        {!collapsed && 'Réduire'}
      </button>
    </aside>
  )
}
