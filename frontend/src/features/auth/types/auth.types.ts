import type { Role } from '@/lib/constants/roles'

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
