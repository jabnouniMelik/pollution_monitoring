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
  Users,
  Building2,
  Bell,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useUIStore } from '@/store/uiStore'
import { PermissionGate } from '@/components/common/PermissionGate/PermissionGate'
import { ZoneSwitcher } from '@/components/common/ZoneSwitcher'
import { UserInfo } from '@/components/common/UserInfo'
import { Role, type Permission } from '@/lib/constants/roles'
import { useQuery } from '@tanstack/react-query'
import { api, unwrap } from '@/lib/api/axios'
import { endpoints } from '@/lib/api/endpoints'
import { useAuth } from '@/features/auth/hooks/useAuth'

function usePendingCount() {
  const { user } = useAuth()
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'
  return useQuery({
    queryKey: ['approvals', 'count'],
    queryFn: async () => {
      const [s, z] = await Promise.all([
        api.get<ApiSuccess<any[]>>(endpoints.sites.pending),
        api.get<ApiSuccess<any[]>>(endpoints.zones.pending),
      ])
      return (unwrap(s.data)?.length ?? 0) + (unwrap(z.data)?.length ?? 0)
    },
    enabled: isSuperAdmin,
    refetchInterval: isSuperAdmin ? 30_000 : false,
    staleTime: 0,
  })
}

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  requires?: Permission[]
  role?: Role
  hideFor?: Role
  badge?: string
}

const NAV_ITEMS: NavItem[] = [
  { to: '/overview', label: 'Vue d\u2019ensemble', icon: LayoutDashboard, requires: ['VIEW_KPI'], hideFor: Role.SUPER_ADMIN },
  { to: '/alerts', label: 'Alertes', icon: AlertTriangle, requires: ['VIEW_ALERTS'], hideFor: Role.SUPER_ADMIN },
  { to: '/history', label: 'Historique', icon: BarChart3, requires: ['VIEW_KPI'], hideFor: Role.SUPER_ADMIN },
  { to: '/compliance', label: 'Conformit\u00e9', icon: ShieldCheck, requires: ['VIEW_KPI'], hideFor: Role.SUPER_ADMIN },
  { to: '/ai', label: 'Pr\u00e9dictions IA', icon: Bot, requires: ['VIEW_AI'], hideFor: Role.SUPER_ADMIN },
  { to: '/reports', label: 'Rapports', icon: FileText, requires: ['GENERATE_REPORT'], hideFor: Role.SUPER_ADMIN },
  { to: '/config', label: 'Configuration', icon: ClipboardList, role: Role.SUPER_ADMIN },
  { to: '/approvals', label: 'Approbations', icon: Bell, role: Role.SUPER_ADMIN },
  { to: '/users', label: 'Gestion Utilisateurs', icon: Users, requires: ['VIEW_ALL_USERS'] },
  { to: '/industries', label: 'Sites & Zones', icon: Building2, requires: ['VIEW_ALL_SITES'] },
]

export function Sidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const mobileMenuOpen = useUIStore((s) => s.mobileMenuOpen)
  const toggle = useUIStore((s) => s.toggleSidebar)
  const closeMobileMenu = useUIStore((s) => s.closeMobileMenu)
  const { data: pendingCount = 0 } = usePendingCount()
  const { user } = useAuth()
  const currentRole = user?.role

  return (
    <>
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={closeMobileMenu}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'transition-smooth z-50 flex h-screen shrink-0 flex-col border-r border-border bg-card',
          'md:sticky md:top-0 md:self-start',
          'fixed inset-y-0 left-0 transform md:transform-none',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
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
              <div className="text-[10px] uppercase tracking-wider text-text-tertiary">Environnement</div>
            </div>
          )}
        </div>

        <nav className="scrollbar-thin flex-1 overflow-y-auto p-2">
          <ul className="space-y-1">
            {NAV_ITEMS.filter(item => !item.hideFor || item.hideFor !== currentRole).map((item) => (
              <PermissionGate key={item.to} anyOf={item.requires} role={item.role}>
                <li>
                  <NavLink
                    to={item.to}
                    end={item.to === '/overview'}
                    onClick={closeMobileMenu}
                    className={({ isActive }) =>
                      cn(
                        'transition-smooth group flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium',
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
                    {!collapsed && item.to === '/approvals' && pendingCount > 0 && (
                      <span className="ml-auto rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {pendingCount}
                      </span>
                    )}
                  </NavLink>
                </li>
              </PermissionGate>
            ))}
          </ul>
        </nav>

        {!collapsed && (
          <div className="border-t border-border p-3 space-y-3">
            <UserInfo />
            <ZoneSwitcher />
          </div>
        )}

        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? 'D\u00e9ployer la barre lat\u00e9rale' : 'R\u00e9duire la barre lat\u00e9rale'}
          className="m-2 hidden items-center justify-center gap-2 rounded-md border border-border bg-white px-2 py-1.5 text-xs text-text-secondary hover:bg-bg md:flex"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {!collapsed && 'R\u00e9duire'}
        </button>
      </aside>
    </>
  )
}
