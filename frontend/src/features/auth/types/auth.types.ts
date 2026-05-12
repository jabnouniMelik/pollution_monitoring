import type { Role } from '@/lib/constants/roles'

export interface Zone {
  _id: string
  code: string
  nom: string
  siteId: string
  industrieId: string
}

export interface Industry {
  _id: string
  nom: string
  secteur: string
}

export interface Site {
  _id: string
  nom: string
  industrieId: string
}

export interface User {
  userId: string
  _id?: string
  username: string
  email: string
  role: Role
  site?: string | null
  zone?: string | null
  assignedSites?: string[]
  assignedZones?: string[]
  zonesAssigned?: Zone[]  // Populated zones
  industryId?: Industry | string | null  // Populated industry
  sitesManaging?: Site[]  // Populated sites
  createdAt?: string
  lastLoginAt?: string
}

export interface LoginPayload {
  email: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  user: User
}
