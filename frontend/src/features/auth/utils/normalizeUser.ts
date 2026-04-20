import type { User } from '../types/auth.types'
import { Role } from '@/lib/constants/roles'

/**
 * Backend may return the user under different shapes:
 *   { _id, username, email, role, zone, site }
 *   { id, username, email, role, … }
 *   { _id: ObjectId, sitesManaging: [], zonesAssigned: [], … }
 *
 * This helper normalizes whatever we receive into the canonical `User`
 * object the rest of the app depends on (with a guaranteed `userId`).
 */
export function normalizeUser(raw: unknown): User {
  const u = (raw ?? {}) as Record<string, unknown>

  const rawId =
    (u.userId as string | undefined) ??
    (u.id as string | undefined) ??
    (typeof u._id === 'string' ? (u._id as string) : undefined) ??
    (u._id as { toString?: () => string } | undefined)?.toString?.() ??
    ''

  const rawRole = typeof u.role === 'string' ? (u.role as string).toUpperCase() : ''
  const role = (Object.values(Role) as string[]).includes(rawRole)
    ? (rawRole as Role)
    : Role.OPERATOR

  return {
    userId: rawId,
    _id: typeof u._id === 'string' ? (u._id as string) : rawId,
    username:
      (u.username as string | undefined) ??
      (u.name as string | undefined) ??
      (u.email as string | undefined) ??
      '',
    email: (u.email as string | undefined) ?? '',
    role,
    site: (u.site as string | null | undefined) ?? null,
    zone: (u.zone as string | null | undefined) ?? null,
    assignedSites: Array.isArray(u.sitesManaging)
      ? (u.sitesManaging as string[])
      : Array.isArray(u.assignedSites)
        ? (u.assignedSites as string[])
        : [],
    assignedZones: Array.isArray(u.zonesAssigned)
      ? (u.zonesAssigned as string[])
      : Array.isArray(u.assignedZones)
        ? (u.assignedZones as string[])
        : [],
    createdAt: (u.createdAt as string | undefined) ?? undefined,
    lastLoginAt: (u.lastLogin as string | undefined) ?? (u.lastLoginAt as string | undefined),
  }
}
