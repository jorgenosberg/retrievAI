import { ChatSliceCreator } from '../types'

export const createChatSlice: ChatSliceCreator = (set, get) => ({
  // Initial state
  chats: [],
  currentChatId: null,
  messages: {},
  isGeneratingResponse: false,

  // Chat actions
  loadChats: async () => {
    try {
      const chats = await window.electronAPI.chats.getAll()
      set({ chats })
    } catch (error) {
      console.error('Failed to load chats:', error)
    }
  },

  createChat: async (title) => {
    try {
      const chat = await window.electronAPI.chats.create(title)
      set((state) => ({
        chats: [chat, ...state.chats],
        currentChatId: chat.id,
        messages: { ...state.messages, [chat.id]: [] }
      }))
      return chat.id
    } catch (error) {
      console.error('Failed to create chat:', error)
      return ''
    }
  },

  loadMessages: async (chatId) => {
    try {
      // Skip if we already have messages for this chat
      if (get().messages[chatId]?.length > 0) {
        set({ currentChatId: chatId })
        return
      }

      const messages = await window.electronAPI.chats.getMessages(chatId)
      set((state) => ({
        messages: { ...state.messages, [chatId]: messages },
        currentChatId: chatId
      }))
    } catch (error) {
      console.error('Failed to load messages:', error)
    }
  },

  sendMessage: async (chatId, content, documentIds) => {
    try {
      set({ isGeneratingResponse: true })

      // Create temporary user message with unique ID
      const tempUserMessage = {
        id: 'temp-user-' + Date.now(),
        chat_id: chatId,
        role: 'user' as const,
        content,
        created_at: new Date().toISOString()
      }

      // Add to UI immediately (optimistic update)
      set((state) => ({
        messages: {
          ...state.messages,
          [chatId]: [...(state.messages[chatId] || []), tempUserMessage]
        }
      }))

      // Send to backend and get response
      const result = await window.electronAPI.chats.sendQuery(chatId, content, documentIds)

      // Update with real messages from the backend
      set((state) => {
        // Find the messages we need to replace in the state
        const existingMessages = state.messages[chatId] || []
        const withoutTemp = existingMessages.filter((m) => m.id !== tempUserMessage.id)

        // Get the new messages from the result
        const userMessage = result.userMessage
        const assistantMessage = result.assistantMessage

        // Update state in one operation to reduce rerenders
        return {
          messages: {
            ...state.messages,
            [chatId]: [...withoutTemp, userMessage, assistantMessage]
          },
          isGeneratingResponse: false
        }
      })
    } catch (error) {
      console.error('Failed to send message:', error)
      set({ isGeneratingResponse: false })
    }
  },

  deleteChat: async (id) => {
    try {
      await window.electronAPI.chats.delete(id)

      // Remove the chat and its messages in a single state update
      set((state) => {
        // Create new objects to avoid reference issues
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [id]: _, ...remainingMessages } = state.messages

        return {
          chats: state.chats.filter((chat) => chat.id !== id),
          messages: remainingMessages,
          // Reset currentChatId if we're deleting the current chat
          ...(state.currentChatId === id ? { currentChatId: null } : {})
        }
      })
    } catch (error) {
      console.error('Failed to delete chat:', error)
    }
  }
})
