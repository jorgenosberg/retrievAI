import { getItem, removeItem, setItem } from '@/lib/storage'
import type { ChatMessage } from '@/types/chat'

export const CHAT_CACHE_KEY = 'retrievai:chat-sessions'
const CHAT_CACHE_VERSION = 1
const CHAT_SESSION_TTL = 1000 * 60 * 60 * 24 * 30 // 30 days
const CHAT_SESSION_LIMIT = 20

export type StoredChatSession = {
  id: string
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
  conversationId?: string
}

type ChatCachePayload = {
  version: number
  sessions: StoredChatSession[]
}

const emptyCache = (): ChatCachePayload => ({
  version: CHAT_CACHE_VERSION,
  sessions: [],
})

type Listener = () => void
const sessionListeners = new Set<Listener>()

const notifySessionListeners = () => {
  sessionListeners.forEach((listener) => {
    try {
      listener()
    } catch {
      // Ignore subscriber errors
    }
  })
}

function pruneSessions(sessions: StoredChatSession[]) {
  const cutoff = Date.now() - CHAT_SESSION_TTL
  return sessions.filter((session) => {
    if (!session.updatedAt || typeof session.updatedAt !== 'number') {
      return false // Remove sessions without valid timestamps
    }
    return session.updatedAt > cutoff
  })
}

function readCache(): ChatCachePayload {
  try {
    const raw = getItem(CHAT_CACHE_KEY)
    if (!raw) {
      return emptyCache()
    }
    const parsed = JSON.parse(raw) as ChatCachePayload
    if (parsed.version !== CHAT_CACHE_VERSION || !Array.isArray(parsed.sessions)) {
      return emptyCache()
    }
    // Validate session structure
    const validSessions = parsed.sessions.filter((session) => {
      return (
        session &&
        typeof session === 'object' &&
        typeof session.id === 'string' &&
        Array.isArray(session.messages)
      )
    })
    return {
      version: CHAT_CACHE_VERSION,
      sessions: pruneSessions(validSessions),
    }
  } catch {
    return emptyCache()
  }
}

function writeCache(cache: ChatCachePayload) {
  setItem(
    CHAT_CACHE_KEY,
    JSON.stringify({
      ...cache,
      sessions: cache.sessions.slice(0, CHAT_SESSION_LIMIT),
    })
  )
  notifySessionListeners()
}

export function loadChatSession(sessionId: string): ChatMessage[] {
  const cache = readCache()
  return (
    cache.sessions.find((session) => session.id === sessionId)?.messages ?? []
  )
}

export function persistChatSession(
  sessionId: string,
  messages: ChatMessage[],
  conversationId?: string | null
) {
  // Don't persist the default session or empty sessions
  if (sessionId === 'default' || messages.length === 0) {
    return
  }

  const cache = readCache()
  const remaining = cache.sessions.filter((session) => session.id !== sessionId)
  const existingSession = cache.sessions.find((session) => session.id === sessionId)
  const resolvedConversationId =
    conversationId === undefined
      ? existingSession?.conversationId
      : conversationId || undefined

  const now = Date.now()
  const nextSessions = [
    {
      id: sessionId,
      messages,
      createdAt: existingSession?.createdAt ?? now,
      updatedAt: now,
      conversationId: resolvedConversationId,
    },
    ...remaining,
  ]

  writeCache({
    version: CHAT_CACHE_VERSION,
    sessions: nextSessions,
  })
}

export function deleteChatSession(sessionId: string) {
  const cache = readCache()
  const remaining = cache.sessions.filter((session) => session.id !== sessionId)
  writeCache({
    version: CHAT_CACHE_VERSION,
    sessions: remaining,
  })
}

export function clearChatSessions() {
  removeItem(CHAT_CACHE_KEY)
  notifySessionListeners()
}

export function getChatCacheStats() {
  const cache = readCache()
  const sessionCount = cache.sessions.length
  const messageCount = cache.sessions.reduce(
    (total, session) => total + session.messages.length,
    0
  )
  const lastUpdated = cache.sessions[0]?.updatedAt ?? 0

  return {
    sessionCount,
    messageCount,
    lastUpdated,
  }
}

// Cache the last result to avoid infinite loops in useSyncExternalStore
let cachedSessions: StoredChatSession[] = []
let lastCacheRead = ''

export function listChatSessions(): StoredChatSession[] {
  try {
    const cache = readCache()
    const sessions = cache.sessions
    if (!Array.isArray(sessions)) {
      return cachedSessions.length === 0 ? cachedSessions : (cachedSessions = [])
    }

    // Create a cache key from the session data
    const cacheKey = JSON.stringify(sessions.map(s => ({ id: s.id, updatedAt: s.updatedAt })))

    // Return cached result if data hasn't changed
    if (cacheKey === lastCacheRead && cachedSessions.length === sessions.length) {
      return cachedSessions
    }

    lastCacheRead = cacheKey
    cachedSessions = sessions.map((session) => ({
      ...session,
      messages: Array.isArray(session.messages) ? session.messages : [],
      createdAt: typeof session.createdAt === 'number' ? session.createdAt : session.updatedAt ?? Date.now(),
      updatedAt: typeof session.updatedAt === 'number' ? session.updatedAt : Date.now(),
      conversationId:
        typeof session.conversationId === 'string' && session.conversationId.length > 0
          ? session.conversationId
          : undefined,
    }))

    return cachedSessions
  } catch (error) {
    console.error('Error listing chat sessions:', error)
    return cachedSessions.length === 0 ? cachedSessions : (cachedSessions = [])
  }
}

export function getSessionConversationId(sessionId: string): string | undefined {
  const cache = readCache()
  return cache.sessions.find((session) => session.id === sessionId)?.conversationId
}

export function subscribeToChatSessions(listener: () => void) {
  sessionListeners.add(listener)
  return () => {
    sessionListeners.delete(listener)
  }
}

export function generateChatSessionId() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }
  return `session-${Date.now()}`
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === CHAT_CACHE_KEY) {
      notifySessionListeners()
    }
  })
}
