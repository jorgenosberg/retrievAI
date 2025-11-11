import { useState, useCallback, useRef, useEffect } from 'react'
import { apiClient } from '@/lib/api'
import type { ChatMessage, Source, SSEEvent } from '@/types/chat'
import { loadChatSession, persistChatSession } from '@/lib/chatStorage'

export function useChat(conversationId?: string) {
  const sessionId = conversationId ?? 'default'
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    loadChatSession(sessionId)
  )
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingMessage, setStreamingMessage] = useState('')
  const [streamingSources, setStreamingSources] = useState<Source[]>([])
  const [statusMessage, setStatusMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setMessages(loadChatSession(sessionId))
  }, [sessionId])

  useEffect(() => {
    persistChatSession(sessionId, messages)
  }, [messages, sessionId])

  const sendMessage = useCallback(
    async (message: string) => {
      if (!message.trim() || isStreaming) return

      // Add user message immediately
      const userMessage: ChatMessage = {
        role: 'user',
        content: message,
      }
      setMessages((prev) => [...prev, userMessage])

      // Reset streaming state
      setStreamingMessage('')
      setStreamingSources([])
      setStatusMessage('')
      setError(null)
      setIsStreaming(true)

      // Create abort controller for this request
      abortControllerRef.current = new AbortController()

      // Use a ref to track sources in this specific request
      let currentSources: Source[] = []
      let currentAnswer = ''

      try {
        await apiClient.streamChat(
          message,
          conversationId,
          (event: SSEEvent) => {
            switch (event.type) {
              case 'start':
                setStatusMessage('Query received...')
                break

              case 'retrieving':
                setStatusMessage(event.content.message || 'Searching documents...')
                break

              case 'sources':
                // Store sources locally for this request
                currentSources = event.content.sources || []
                setStreamingSources(currentSources)
                // Don't show count message, just quietly store sources
                setStatusMessage('Generating response...')
                break

              case 'thinking':
                setStatusMessage('Generating response...')
                break

              case 'token':
                // Append token to streaming message
                currentAnswer += event.content
                setStreamingMessage((prev) => prev + event.content)
                setStatusMessage('') // Clear status when streaming starts
                break

              case 'done':
                // Finalize the assistant message using the locally tracked values
                const assistantMessage: ChatMessage = {
                  role: 'assistant',
                  content: event.content.answer || currentAnswer,
                  sources: currentSources,
                }
                setMessages((prev) => [...prev, assistantMessage])
                setStreamingMessage('')
                setStreamingSources([])
                setStatusMessage('Response complete')
                break

              case 'saved':
                // Message saved to database
                console.log('Message saved:', event.content)
                break

              case 'error':
                setError(event.content.message || 'An error occurred')
                setStatusMessage('')
                break

              default:
                console.warn('Unknown event type:', event.type)
            }
          },
          (error: Error) => {
            console.error('Streaming error:', error)
            setError(error.message || 'Failed to stream response')
            setIsStreaming(false)
            setStreamingMessage('')
            setStatusMessage('')
          },
          () => {
            // Streaming complete
            setIsStreaming(false)
            setStatusMessage('')
          }
        )
      } catch (err) {
        console.error('Error sending message:', err)
        setError(err instanceof Error ? err.message : 'Failed to send message')
        setIsStreaming(false)
        setStreamingMessage('')
        setStatusMessage('')
      }
    },
    [conversationId, isStreaming]
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
    persistChatSession(sessionId, [])
  }, [sessionId])

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
  }
}
