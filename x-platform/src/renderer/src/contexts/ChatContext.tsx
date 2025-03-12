import React, {
  createContext,
  useState,
  useContext,
  useCallback,
  ReactNode,
  useEffect
} from 'react'
import { Chat, ChatMessage } from '@/types'
import { ChatContextType } from './types'

// Create the context with a default undefined value
const ChatContext = createContext<ChatContextType | undefined>(undefined)

// Provider component
export const ChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // State
  const [chats, setChats] = useState<Chat[]>([])
  const [chatCount, setChatCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({})
  const [isGeneratingResponse, setIsGeneratingResponse] = useState(false)
  const [streamingEnabled, setStreamingEnabled] = useState(true)

  // Load streaming preference from settings on mount
  useEffect(() => {
    const loadStreamingPreference = async () => {
      try {
        const enabled = await window.electronAPI.settings.getStreamingEnabled()
        setStreamingEnabled(enabled)
      } catch (error) {
        console.error('Failed to load streaming preference:', error)
        // Default to enabled if there's an error
        setStreamingEnabled(true)
      }
    }

    loadStreamingPreference()
  }, [])

  // Set up streaming event listeners
  useEffect(() => {
    // Subscribe to streaming events
    const unsubStreamChunk = window.electronAPI.chats.onStreamChunk((data) => {
      const { chatId, messageId, chunk } = data

      setMessages((prev) => {
        const chatMessages = [...(prev[chatId] || [])]
        const messageIndex = chatMessages.findIndex((msg) => msg.id === messageId)

        if (messageIndex !== -1) {
          // Update the existing message with new content
          const updatedMessage = {
            ...chatMessages[messageIndex],
            content: chatMessages[messageIndex].content + chunk
          }

          chatMessages[messageIndex] = updatedMessage

          return {
            ...prev,
            [chatId]: chatMessages
          }
        }

        return prev
      })
    })

    // Handle stream completion
    const unsubStreamComplete = window.electronAPI.chats.onStreamComplete((data) => {
      const { chatId, messageId, citations } = data

      setMessages((prev) => {
        const chatMessages = [...(prev[chatId] || [])]
        const messageIndex = chatMessages.findIndex((msg) => msg.id === messageId)

        if (messageIndex !== -1) {
          // Update the message with citations
          const updatedMessage = {
            ...chatMessages[messageIndex],
            citations: citations
          }

          chatMessages[messageIndex] = updatedMessage

          return {
            ...prev,
            [chatId]: chatMessages
          }
        }

        return prev
      })

      setIsGeneratingResponse(false)
    })

    // Handle stream errors
    const unsubStreamError = window.electronAPI.chats.onStreamError((data) => {
      console.error('Streaming error:', data)
      setIsGeneratingResponse(false)
    })

    // Cleanup
    return () => {
      unsubStreamChunk()
      unsubStreamComplete()
      unsubStreamError()
    }
  }, [])

  // Actions
  const loadChats = useCallback(async (page = 0, limit = 20) => {
    try {
      const offset = page * limit
      // Only load chats we need for the current page
      const [loadedChats, count] = await Promise.all([
        window.electronAPI.chats.getPage(limit, offset),
        window.electronAPI.chats.getCount()
      ])

      setChats(loadedChats)
      setChatCount(count)
      setCurrentPage(page)
      setPageSize(limit)

      return { chats: loadedChats, count }
    } catch (error) {
      console.error('Failed to load chats:', error)
      return { chats: [], count: 0 }
    }
  }, [])

  // Toggle streaming
  const toggleStreaming = useCallback(() => {
    setStreamingEnabled((prev) => !prev)
  }, [])

  // Load next page of chats
  const loadNextPage = useCallback(async () => {
    return await loadChats(currentPage + 1, pageSize)
  }, [currentPage, pageSize, loadChats])

  // Load previous page of chats
  const loadPreviousPage = useCallback(async () => {
    if (currentPage > 0) {
      return await loadChats(currentPage - 1, pageSize)
    }
    return { chats, count: chatCount }
  }, [currentPage, pageSize, loadChats, chats, chatCount])

  // Create a new chat
  const createChat = useCallback(async (title: string) => {
    try {
      const chat = await window.electronAPI.chats.create(title)

      // Add to local state
      setChats((prev) => [chat, ...prev])
      setChatCount((prev) => prev + 1)
      setCurrentChatId(chat.id)

      // Initialize empty messages for this chat
      setMessages((prev) => ({
        ...prev,
        [chat.id]: []
      }))

      return chat.id
    } catch (error) {
      console.error('Failed to create chat:', error)
      throw error
    }
  }, [])

  // Load messages for a specific chat
  const loadMessages = useCallback(
    async (chatId: string) => {
      try {
        // Only fetch if we don't already have them
        if (!messages[chatId]) {
          const chatMessages = await window.electronAPI.chats.getMessages(chatId)

          setMessages((prev) => ({
            ...prev,
            [chatId]: chatMessages
          }))
        } else {
          // Just update the current chat ID
        }
      } catch (error) {
        console.error(`Failed to load messages for chat ${chatId}:`, error)
        throw error
      }
    },
    [messages]
  )

  // Send a new message
  const sendMessage = useCallback(
    async (chatId: string, content: string, documentIds: string[]) => {
      try {
        // Show loading indicator for AI response
        setIsGeneratingResponse(true)

        // Optimistically update UI with user message
        const userMessage: ChatMessage = {
          id: `temp-${Date.now()}`,
          chat_id: chatId,
          role: 'user',
          content,
          timestamp: new Date().toISOString(),
          sources: []
        }

        setMessages((prev) => ({
          ...prev,
          [chatId]: [...(prev[chatId] || []), userMessage]
        }))

        if (streamingEnabled) {
          // Streaming approach
          // Start the streaming process
          const { userMessageId, assistantMessageId } =
            await window.electronAPI.chats.sendQueryStreaming(chatId, content, documentIds)

          // Replace temp user message with actual message
          setMessages((prev) => {
            const chatMessages = [...(prev[chatId] || [])]
            const userIndex = chatMessages.findIndex((msg) => msg.id === userMessage.id)

            if (userIndex !== -1) {
              // Replace with real user message
              chatMessages[userIndex] = {
                id: userMessageId,
                chat_id: chatId,
                role: 'user',
                content,
                timestamp: new Date().toISOString(),
                sources: []
              }
            }

            // Add empty assistant message that will be streamed to
            chatMessages.push({
              id: assistantMessageId,
              chat_id: chatId,
              role: 'assistant',
              content: '',
              timestamp: new Date().toISOString(),
              sources: []
            })

            return {
              ...prev,
              [chatId]: chatMessages
            }
          })

          // Note: The actual content streaming is handled by the useEffect listeners
        } else {
          // Non-streaming approach
          // Send to backend
          const { userMessage: savedUserMessage, assistantMessage: savedAssistantMessage } =
            await window.electronAPI.chats.sendQuery(chatId, content, documentIds)

          // Update with real messages
          setMessages((prev) => {
            const chatMessages = [...(prev[chatId] || [])]
            // Replace temporary messages with saved ones
            const updatedMessages = chatMessages
              .filter((msg) => msg.id !== userMessage.id)
              .concat([savedUserMessage, savedAssistantMessage])

            return {
              ...prev,
              [chatId]: updatedMessages
            }
          })

          // Complete
          setIsGeneratingResponse(false)
        }
      } catch (error) {
        console.error(`Failed to send message to chat ${chatId}:`, error)
        setIsGeneratingResponse(false)
        throw error
      }
    },
    [streamingEnabled]
  )

  // Delete a chat
  const deleteChat = useCallback(
    async (id: string) => {
      try {
        await window.electronAPI.chats.delete(id)

        // Remove from local state
        setChats((prev) => prev.filter((chat) => chat.id !== id))
        setChatCount((prev) => prev - 1)

        // Clear messages
        setMessages((prev) => {
          const newMessages = { ...prev }
          delete newMessages[id]
          return newMessages
        })

        // Clear current chat if it was deleted
        if (currentChatId === id) {
          setCurrentChatId(null)
        }
      } catch (error) {
        console.error(`Failed to delete chat ${id}:`, error)
        throw error
      }
    },
    [currentChatId]
  )

  // Combine state and actions
  const contextValue: ChatContextType = {
    chats,
    chatCount,
    currentPage,
    pageSize,
    currentChatId,
    streamingEnabled,
    messages,
    isGeneratingResponse,
    toggleStreaming,
    loadChats,
    loadNextPage,
    loadPreviousPage,
    createChat,
    loadMessages,
    sendMessage,
    deleteChat
  }

  return <ChatContext.Provider value={contextValue}>{children}</ChatContext.Provider>
}

// Custom hook to use the context
export const useChatContext = () => {
  const context = useContext(ChatContext)
  if (context === undefined) {
    throw new Error('useChatContext must be used within a ChatProvider')
  }
  return context
}
