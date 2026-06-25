import { AUDITOR_ALLOWED_PATHS, Role } from '@/lib/constants/roles'

export function isAuditorAllowedPath(pathname: string): boolean {
  return AUDITOR_ALLOWED_PATHS.some(
    (allowed) => pathname === allowed || pathname.startsWith(`${allowed}/`),
  )
}

export function defaultPathForRole(role: string | undefined): string {
  if (role === Role.SUPER_ADMIN) return '/industries'
  if (role === Role.AUDITOR) return '/reports'
  return '/overview'
}
