import { useSyncExternalStore } from 'react'
import { listChatSessions, subscribeToChatSessions } from '@/lib/chatStorage'

// Server-side snapshot that always returns empty array
const getServerSnapshot = () => []

export function useChatSessions() {
  return useSyncExternalStore(
    subscribeToChatSessions,
    listChatSessions,
    getServerSnapshot
  )
}
