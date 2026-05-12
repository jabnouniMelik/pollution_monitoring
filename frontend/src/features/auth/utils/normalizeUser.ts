import type { User, Zone, Industry, Site } from '../types/auth.types'
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

  // zonesAssigned can be populated Zone objects or plain string IDs
  const rawZones = Array.isArray(u.zonesAssigned)
    ? u.zonesAssigned
    : Array.isArray(u.assignedZones)
      ? u.assignedZones
      : []

  // Keep populated Zone objects if they have _id + nom (came from /me or login)
  const zonesAssigned = rawZones.filter(
    (z): z is Zone => z !== null && typeof z === 'object' && '_id' in z && 'nom' in z
  ) as Zone[]

  // Flat string IDs for legacy consumers
  const assignedZones = rawZones.map((z) =>
    typeof z === 'string' ? z : (z as Record<string, unknown>)?._id?.toString?.() ?? ''
  ).filter(Boolean) as string[]

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
    industryId: (u.industryId as Industry | string | null | undefined) ?? null,
    sitesManaging: Array.isArray(u.sitesManaging)
      ? (u.sitesManaging as Site[])
      : [],
    zonesAssigned,
    assignedSites: Array.isArray(u.sitesManaging)
      ? (u.sitesManaging as string[])
      : Array.isArray(u.assignedSites)
        ? (u.assignedSites as string[])
        : [],
    assignedZones,
    createdAt: (u.createdAt as string | undefined) ?? undefined,
    lastLoginAt: (u.lastLogin as string | undefined) ?? (u.lastLoginAt as string | undefined),
  }
}
