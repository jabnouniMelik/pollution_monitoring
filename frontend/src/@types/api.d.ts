/**
 * Global API response shapes shared across features.
 * Backend returns `{ success, message?, data }` for successful calls
 * and `{ success: false, message, code? }` for errors.
 */

export {}

declare global {
  interface ApiSuccess<T> {
    success: true
    message?: string
    data: T
  }

  interface ApiError {
    success: false
    message: string
    code?: string
    details?: unknown
  }

  type ApiResponse<T> = ApiSuccess<T> | ApiError

  interface Paginated<T> {
    items: T[]
    total: number
    page: number
    pageSize: number
  }
}
