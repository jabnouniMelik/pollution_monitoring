import type { Role } from '@/lib/constants/roles'

export type UserStatus = 'active' | 'inactive'

export interface PopulatedIndustry {
  _id: string
  nom: string
  secteur: string
}

export interface PopulatedSite {
  _id: string
  nom: string
  localisation?: { ville?: string; adresse?: string }
}

export interface PopulatedZone {
  _id: string
  code: string
  nom: string
  siteId?: { _id: string; nom: string } | string  // populated or plain ID
}

export interface User {
  id: string
  username: string
  email: string
  role: Role
  industryId?: PopulatedIndustry | string | null
  sitesManaging?: PopulatedSite[] | string[]
  zonesAssigned?: PopulatedZone[] | string[]
  isActive: boolean
  lastLogin?: string | null
  createdAt: string
  updatedAt: string
}

export interface UserListResponse {
  users: User[]
  total: number
  page: number
  pageSize: number
}

export interface UserFilters {
  page?: number
  pageSize?: number
  role?: Role
  search?: string
  status?: UserStatus
}

export interface CreateUserInput {
  username: string
  email: string
  password: string
  role: Role
  industryId?: string | null
  sitesManaging?: string[]
  zonesAssigned?: string[]
}

export interface UpdateUserInput {
  username?: string
  email?: string
  role?: Role
  industryId?: string | null
  sitesManaging?: string[]
  zonesAssigned?: string[]
}

export interface ActivateUserInput {
  isActive: boolean
}
}
