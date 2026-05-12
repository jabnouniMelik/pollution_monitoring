export interface SiteLocation {
  type: 'Point'
  coordinates: [number, number] // [longitude, latitude]
  ville?: string
  adresse?: string
}

export interface SiteContact {
  telephone?: string
  email?: string
  responsable?: string
}

export interface Site {
  id: string
  nom: string
  industrieId: string
  supervisorId?: string | null
  localisation?: SiteLocation
  contact?: SiteContact
  actif: boolean
  zoneCount: number
  description?: string
  createdAt: string
  updatedAt: string
}

export interface SiteListResponse {
  sites: Site[]
  total: number
  page: number
  pageSize: number
}

export interface SiteFilters {
  page?: number
  pageSize?: number
  industrieId?: string
  search?: string
  actif?: boolean
}

export interface CreateSiteInput {
  nom: string
  industrieId?: string  // optional — resolved from user profile on backend
  zoneName: string      // required — first zone is mandatory
  pollutants: string[]  // pollutants to monitor in the initial zone
  localisation?: SiteLocation
  contact?: SiteContact
  description?: string
}

export interface UpdateSiteInput {
  nom?: string
  localisation?: SiteLocation
  contact?: SiteContact
  description?: string
  actif?: boolean
}

export interface AssignSupervisorInput {
  supervisorId: string
}
