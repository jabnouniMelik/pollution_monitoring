export interface Site {
  id: string
  _id?: string
  name: string
  code?: string
  industryId?: string
  industryName?: string
  supervisorId?: string
  supervisorName?: string
  location?: { lat: number; lng: number }
  zoneCount?: number
  createdAt?: string
  updatedAt?: string
}

export interface CreateSitePayload {
  name: string
  industryId: string
  code?: string
  supervisorId?: string
  location?: { lat: number; lng: number }
}
