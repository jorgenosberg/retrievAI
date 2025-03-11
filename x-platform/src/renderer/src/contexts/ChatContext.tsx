import React, { createContext, useState, useContext, useCallback, ReactNode } from 'react'
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

        // Show loading indicator for AI response
        setIsGeneratingResponse(true)

        // Add a temp loading message
        const tempAiMessage: ChatMessage = {
          id: `temp-ai-${Date.now()}`,
          chat_id: chatId,
          role: 'assistant',
          content: '...',
          timestamp: new Date().toISOString(),
          sources: []
        }

        setMessages((prev) => ({
          ...prev,
          [chatId]: [...(prev[chatId] || []), tempAiMessage]
        }))

        // Send to backend
        const { userMessage: savedUserMessage, assistantMessage: savedAssistantMessage } =
          await window.electronAPI.chats.sendQuery(chatId, content, documentIds)

        // Update with real messages
        setMessages((prev) => {
          const chatMessages = [...(prev[chatId] || [])]
          // Replace temporary messages with saved ones
          const updatedMessages = chatMessages
            .filter((msg) => msg.id !== userMessage.id && msg.id !== tempAiMessage.id)
            .concat([savedUserMessage, savedAssistantMessage])

          return {
            ...prev,
            [chatId]: updatedMessages
          }
        })
      } catch (error) {
        console.error(`Failed to send message to chat ${chatId}:`, error)
        throw error
      } finally {
        setIsGeneratingResponse(false)
      }
    },
    []
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
    messages,
    isGeneratingResponse,
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
