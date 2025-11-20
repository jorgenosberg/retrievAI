import { useState, useCallback, useRef, useEffect } from 'react'
import { apiClient } from '@/lib/api'
import type { ChatMessage, Source, SSEEvent } from '@/types/chat'
import {
  loadChatSession,
  persistChatSession,
  subscribeToChatSessions,
  getSessionConversationId,
} from '@/lib/chatStorage'

const areSourcesEqual = (a?: Source[], b?: Source[]) => {
  const listA = a ?? []
  const listB = b ?? []
  if (listA.length !== listB.length) {
    return false
  }
  return listA.every((source, index) => {
    const other = listB[index]
    if (!other) {
      return false
    }
    if (source.content !== other.content) {
      return false
    }
    const metaA = source.metadata ?? {}
    const metaB = other.metadata ?? {}
    return (
      metaA.source === metaB.source &&
      metaA.page === metaB.page &&
      metaA.file_hash === metaB.file_hash &&
      metaA.title === metaB.title &&
      metaA.doc_num === metaB.doc_num
    )
  })
}

const areMessagesEqual = (a: ChatMessage[], b: ChatMessage[]) => {
  if (a === b) {
    return true
  }
  if (a.length !== b.length) {
    return false
  }
  return a.every((message, index) => {
    const other = b[index]
    if (!other) {
      return false
    }
    return (
      message.role === other.role &&
      message.content === other.content &&
      message.isStreaming === other.isStreaming &&
      areSourcesEqual(message.sources, other.sources)
    )
  })
}

export function useChat(conversationId?: string) {
  const sessionId = conversationId ?? 'default'
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    loadChatSession(sessionId)
  )
  const [sessionConversationId, setSessionConversationId] = useState<string | null>(
    () => getSessionConversationId(sessionId) ?? null
  )
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingMessage, setStreamingMessage] = useState('')
  const [streamingSources, setStreamingSources] = useState<Source[]>([])
  const [statusMessage, setStatusMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const currentSessionIdRef = useRef(sessionId)
  const skipNextPersistRef = useRef(false)
  const latestMessagesRef = useRef(messages)

  useEffect(() => {
    latestMessagesRef.current = messages
  }, [messages])

  useEffect(() => {
    currentSessionIdRef.current = sessionId
    skipNextPersistRef.current = true
    setMessages(loadChatSession(sessionId))
    setSessionConversationId(getSessionConversationId(sessionId) ?? null)
  }, [sessionId])

  useEffect(() => {
    const unsubscribe = subscribeToChatSessions(() => {
      const latestMessages = loadChatSession(sessionId)
      setMessages((prev) =>
        areMessagesEqual(prev, latestMessages) ? prev : latestMessages
      )
      const storedConversationId = getSessionConversationId(sessionId) ?? null
      setSessionConversationId((prev) =>
        prev === storedConversationId ? prev : storedConversationId
      )
    })
    return unsubscribe
  }, [sessionId])

  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsStreaming(false)
    setStreamingMessage('')
    setStreamingSources([])
    setStatusMessage('')
    setError(null)
  }, [sessionId])

  useEffect(() => {
    // Skip the first run after a session switch so we don't clone the previous chat
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false
      return
    }
    // Only persist real sessions with messages that belong to the active view
    if (
      sessionId === 'default' ||
      messages.length === 0 ||
      currentSessionIdRef.current !== sessionId
    ) {
      return
    }
    persistChatSession(sessionId, messages, sessionConversationId)
  }, [messages, sessionId, sessionConversationId])

  const sendMessage = useCallback(
    async (message: string) => {
      if (!message.trim() || isStreaming) return

      const targetSessionId = sessionId
      let nextConversationId = sessionConversationId ?? null
      const isViewingTarget = () => currentSessionIdRef.current === targetSessionId

      let workingMessages = isViewingTarget()
        ? [...latestMessagesRef.current]
        : [...loadChatSession(targetSessionId)]

      const persistIfBackground = () => {
        if (!isViewingTarget()) {
          persistChatSession(targetSessionId, workingMessages, nextConversationId)
        }
      }

      const pushMessage = (chatMessage: ChatMessage) => {
        workingMessages = [...workingMessages, chatMessage]
        if (isViewingTarget()) {
          setMessages(workingMessages)
        }
        persistIfBackground()
      }

      // Add user message immediately
      const userMessage: ChatMessage = {
        role: 'user',
        content: message,
      }
      pushMessage(userMessage)

      // Reset streaming state (only for active session)
      if (isViewingTarget()) {
        setStreamingMessage('')
        setStreamingSources([])
        setStatusMessage('')
        setError(null)
      }
      setIsStreaming(true)

      // Create abort controller for this request
      abortControllerRef.current = new AbortController()

      // Use a ref to track sources in this specific request
      let currentSources: Source[] = []
      let currentAnswer = ''

      const stopStreamingForRequest = (status?: string) => {
        if (isViewingTarget()) {
          setStreamingMessage('')
          setStreamingSources([])
          setStatusMessage(status ?? '')
        }
        setIsStreaming(false)
      }

      try {
        await apiClient.streamChat(
          message,
          nextConversationId ?? undefined,
          (event: SSEEvent) => {
            switch (event.type) {
              case 'start':
                if (isViewingTarget()) {
                  setStatusMessage('Query received...')
                }
                break

              case 'retrieving':
                if (isViewingTarget()) {
                  setStatusMessage(event.content.message || 'Searching documents...')
                }
                break

              case 'sources':
                currentSources = event.content.sources || []
                if (isViewingTarget()) {
                  setStreamingSources(currentSources)
                  setStatusMessage('Generating response...')
                }
                break

              case 'thinking':
                if (isViewingTarget()) {
                  setStatusMessage('Generating response...')
                }
                break

              case 'token':
                currentAnswer += event.content
                if (isViewingTarget()) {
                  setStreamingMessage((prev) => prev + event.content)
                  setStatusMessage('')
                }
                break

              case 'done': {
                const assistantMessage: ChatMessage = {
                  role: 'assistant',
                  content: event.content.answer || currentAnswer,
                  sources: currentSources,
                }
                pushMessage(assistantMessage)
                stopStreamingForRequest('Response complete')
                break
              }

              case 'saved': {
                const savedConversationId = event.content?.conversation_id
                if (typeof savedConversationId === 'string') {
                  nextConversationId = savedConversationId
                  if (isViewingTarget()) {
                    setSessionConversationId((prev) =>
                      prev === savedConversationId ? prev : savedConversationId
                    )
                  } else {
                    persistChatSession(targetSessionId, workingMessages, nextConversationId)
                  }
                }
                break
              }

              case 'error':
                if (isViewingTarget()) {
                  setError(event.content.message || 'An error occurred')
                  setStatusMessage('')
                }
                break

              default:
                console.warn('Unknown event type:', event.type)
            }
          },
          (error: Error) => {
            console.error('Streaming error:', error)
            if (isViewingTarget()) {
              setError(error.message || 'Failed to stream response')
              setStreamingMessage('')
              setStatusMessage('')
            }
            setIsStreaming(false)
          },
          () => {
            stopStreamingForRequest('')
          }
        )
      } catch (err) {
        console.error('Error sending message:', err)
        if (isViewingTarget()) {
          setError(err instanceof Error ? err.message : 'Failed to send message')
          setStreamingMessage('')
          setStatusMessage('')
        }
        setIsStreaming(false)
      }
    },
    [isStreaming, sessionConversationId, sessionId]
  )

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsStreaming(false)
    setStreamingMessage('')
    setStatusMessage('')
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
    setStreamingMessage('')
    setStreamingSources([])
    setStatusMessage('')
    setError(null)
    persistChatSession(sessionId, [], sessionConversationId)
  }, [sessionId, sessionConversationId])

  return {
    messages,
    isStreaming,
    streamingMessage,
    streamingSources,
    statusMessage,
    error,
    sendMessage,
    stopStreaming,
    clearMessages,
    conversationId: sessionConversationId ?? undefined,
  }
}
