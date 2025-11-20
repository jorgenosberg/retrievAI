import { getItem, removeItem, setItem } from '@/lib/storage'
import type { UserPreferences } from '@/types/preferences'

export const PREFERENCES_STORAGE_KEY = 'retrievai:prefs'

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  theme: 'system',
  auto_send: false,
  show_sources: true,
  default_chat_model: 'gpt-4o-mini',
  use_personal_api_key: false,
}

type StoredPreferences = {
  data: UserPreferences
  updatedAt: number
}

function readSnapshot(): StoredPreferences {
  try {
    const raw = getItem(PREFERENCES_STORAGE_KEY)
    if (!raw) {
      return { data: DEFAULT_USER_PREFERENCES, updatedAt: 0 }
    }
    const parsed = JSON.parse(raw) as StoredPreferences
    if (!parsed?.data) {
      return { data: DEFAULT_USER_PREFERENCES, updatedAt: 0 }
    }
    return parsed
  } catch {
    return { data: DEFAULT_USER_PREFERENCES, updatedAt: 0 }
  }
}

function writeSnapshot(snapshot: StoredPreferences) {
  setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(snapshot))
}

export function getStoredPreferences(): UserPreferences {
  return readSnapshot().data
}

export function getPreferencesUpdatedAt(): number {
  return readSnapshot().updatedAt
}

export function setStoredPreferences(preferences: UserPreferences) {
  writeSnapshot({ data: preferences, updatedAt: Date.now() })
}

export function updateStoredPreferences(
  partial: Partial<UserPreferences>
): UserPreferences {
  const current = getStoredPreferences()
  const next = { ...current, ...partial }
  setStoredPreferences(next)
  return next
}

export function clearStoredPreferences() {
  removeItem(PREFERENCES_STORAGE_KEY)
}
