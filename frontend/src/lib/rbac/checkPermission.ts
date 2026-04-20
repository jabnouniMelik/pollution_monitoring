import {
  Permission,
  ROLE_LEVELS,
  ROLE_PERMISSIONS,
  type Role,
} from '../constants/roles'

export function hasPermission(userRole: Role | undefined, permission: Permission): boolean {
  if (!userRole) return false
  return ROLE_PERMISSIONS[userRole]?.includes(permission) ?? false
}

export function hasAnyPermission(userRole: Role | undefined, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(userRole, p))
}

export function hasAllPermissions(userRole: Role | undefined, permissions: Permission[]): boolean {
  return permissions.every((p) => hasPermission(userRole, p))
}

export function hasMinimumRole(userRole: Role | undefined, minimumRole: Role): boolean {
  if (!userRole) return false
  return ROLE_LEVELS[userRole] >= ROLE_LEVELS[minimumRole]
}

export interface ResourceDescriptor {
  site?: string
  zone?: string
  assignedUsers?: string[]
}

export interface UserScope {
  assignedSites?: string[]
  assignedZones?: string[]
}

/**
 * Determines whether a user (by role + scope) can access a given resource.
 * Mirrors backend RBAC rules — see BACKEND_RBAC_IMPLEMENTATION.md.
 */
export function canAccessResource(
  userRole: Role,
  resource: ResourceDescriptor,
  userScope: UserScope,
): boolean {
  if (userRole === 'SUPER_ADMIN' || userRole === 'AUDITOR') return true

  if (userRole === 'HEAD_SUPERVISOR') {
    if (resource.site && userScope.assignedSites?.includes(resource.site)) return true
    return false
  }

  if (userRole === 'SITE_SUPERVISOR') {
    if (resource.site && userScope.assignedSites?.includes(resource.site)) return true
    if (resource.zone && userScope.assignedZones?.includes(resource.zone)) return true
    return false
  }

  if (userRole === 'OPERATOR') {
    if (resource.zone && userScope.assignedZones?.includes(resource.zone)) return true
    return false
  }

  return false
}
