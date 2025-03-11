/* eslint-disable @typescript-eslint/no-explicit-any */
import { Document, Chat, ChatMessage } from '@/types'
import { StateCreator } from 'zustand'

// Combined app state type
export interface AppState extends AppSlice, DocumentSlice, ChatSlice, SettingsSlice {}

// App initialization slice
export interface AppSlice {
  appStatus: 'initializing' | 'ready' | 'error'
  initializationError: string | null
  initializeApp: () => void
}

// Document state slice
export interface DocumentSlice {
  documents: Document[]
  isProcessingDocument: boolean
  processingProgress: {
    documentId: string
    stage: 'loading' | 'splitting' | 'indexing'
    progress: number
    currentFile?: string
  } | null
  loadDocuments: () => Promise<void>
  uploadDocuments: (filePaths: string[], tags: string[]) => Promise<any[] | undefined>
  deleteDocument: (id: string) => Promise<void>
}

// Chat state slice
export interface ChatSlice {
  chats: Chat[]
  currentChatId: string | null
  messages: Record<string, ChatMessage[]>
  isGeneratingResponse: boolean
  loadChats: () => Promise<void>
  createChat: (title: string) => Promise<string>
  loadMessages: (chatId: string) => Promise<void>
  sendMessage: (chatId: string, content: string, documentIds: string[]) => Promise<void>
  deleteChat: (id: string) => Promise<void>
}

// Settings state slice
export interface SettingsSlice {
  settings: {
    defaultModel: {
      provider: 'openai' | 'anthropic'
      model: string
      temperature: number
      maxTokens: number
    }
    embeddingModel: {
      provider: 'openai' | 'huggingface'
      model: string
    }
    ragConfig: {
      chunkSize: number
      chunkOverlap: number
      similarityThreshold: number
      maxSources: number
    }
  }
  loadSettings: () => Promise<void>
  updateSettings: (settings: Partial<SettingsSlice['settings']>) => Promise<void>
  setApiKey: (provider: string, key: string) => Promise<void>
}

// Slice creator types
export type AppSliceCreator = StateCreator<AppState, [], [], AppSlice>

export type DocumentSliceCreator = StateCreator<AppState, [], [], DocumentSlice>

export type ChatSliceCreator = StateCreator<AppState, [], [], ChatSlice>

export type SettingsSliceCreator = StateCreator<AppState, [], [], SettingsSlice>
