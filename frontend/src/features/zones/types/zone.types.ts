export interface ZoneLocation {
  type: 'Point'
  coordinates: [number, number] // [longitude, latitude]
}

export interface Zone {
  id: string
  code: string
  nom: string
  siteId: string
  industrieId: string
  description?: string
  localisation?: ZoneLocation
  operatorsAssigned: string[]
  pollutants: string[]
  actif: boolean
  sensorNodeCount: number
  createdAt: string
  updatedAt: string
}

export interface ZoneListResponse {
  zones: Zone[]
  total: number
  page: number
  pageSize: number
}

export interface ZoneFilters {
  page?: number
  pageSize?: number
  siteId?: string
  search?: string
  actif?: boolean
}

export interface CreateZoneInput {
  nom: string
  siteId: string
  industrieId?: string  // resolved automatically from site on backend
  code?: string         // auto-generated from nom if omitted
  description?: string
  pollutants: string[]  // pollutants to monitor
  localisation?: ZoneLocation
}

export interface UpdateZoneInput {
  code?: string
  nom?: string
  description?: string
  localisation?: ZoneLocation
  actif?: boolean
}

export interface AssignOperatorInput {
  operatorId: string
}
