export const QUERY_CACHE_STORAGE_KEY = 'retrievai:query-cache'

const QUERY_CACHE_PREFIX = 'retrievai:query-cache'

export const getQueryCacheKey = () => QUERY_CACHE_PREFIX

export function clearPersistedQueryCaches() {
  if (typeof window === 'undefined') return

  // Remove both legacy and user-scoped caches
  const prefixes = [QUERY_CACHE_STORAGE_KEY, QUERY_CACHE_PREFIX]

  for (let i = localStorage.length - 1; i >= 0; i -= 1) {
    const key = localStorage.key(i)
    if (!key) continue
    if (prefixes.some((prefix) => key.startsWith(prefix))) {
      localStorage.removeItem(key)
    }
  }
}
