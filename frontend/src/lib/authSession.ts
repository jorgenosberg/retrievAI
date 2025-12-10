import type { User } from '@/lib/api'

const AUTH_CACHE_TTL = 1000 * 60 * 5 // 5 minutes (much less than token expiry)
const CURRENT_USER_ID_KEY = 'retrievai:current-user-id'

let cachedUser: User | null = null
let lastValidated = 0
let pendingValidation: Promise<User> | null = null

export const getStoredToken = () => {
  if (typeof window === 'undefined') {
    return null
  }
  return localStorage.getItem('access_token')
}

export const getStoredRefreshToken = () => {
  if (typeof window === 'undefined') {
    return null
  }
  return localStorage.getItem('refresh_token')
}

export function getCurrentUserId(): number | null {
  if (typeof window === 'undefined') {
    return null
  }
  const stored = localStorage.getItem(CURRENT_USER_ID_KEY)
  if (!stored) return null
  const parsed = parseInt(stored, 10)
  return Number.isNaN(parsed) ? null : parsed
}

function setCurrentUserId(userId: number) {
  if (typeof window === 'undefined') return
  localStorage.setItem(CURRENT_USER_ID_KEY, String(userId))
}

function clearCurrentUserId() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(CURRENT_USER_ID_KEY)
}

export function resetAuthCache() {
  cachedUser = null
  lastValidated = 0
  clearCurrentUserId()
}

export function getCachedUser(): User | null {
  if (cachedUser && Date.now() - lastValidated < AUTH_CACHE_TTL) {
    return cachedUser
  }
  return null
}

export function setCachedUser(user: User) {
  cachedUser = user
  lastValidated = Date.now()
  setCurrentUserId(user.id)
}

export async function ensureCurrentUser(
  fetcher: () => Promise<User>,
  skipCache = false
): Promise<User> {
  // Return cached user if valid and not forcing refresh
  if (!skipCache && cachedUser && Date.now() - lastValidated < AUTH_CACHE_TTL) {
    return cachedUser
  }

  // Return pending validation if already in progress
  if (!pendingValidation) {
    pendingValidation = fetcher()
      .then((user) => {
        cachedUser = user
        lastValidated = Date.now()
        setCurrentUserId(user.id)
        return user
      })
      .finally(() => {
        pendingValidation = null
      })
  }

  return pendingValidation
}
