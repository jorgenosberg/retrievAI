/* eslint-disable @typescript-eslint/no-explicit-any */
import { Document, Chat, ChatMessage } from '@/types'

// App initialization slice
export interface AppContextType {
  appStatus: 'initializing' | 'ready' | 'error'
  initializationError: string | null
  servicesReady: boolean
  initializeApp: () => void
}

// File upload progress tracking
export interface UploadFileProgress {
  fileId: string
  fileName: string
  filePath: string
  documentId?: string
  progress: number
  stage: 'idle' | 'loading' | 'splitting' | 'indexing' | 'complete' | 'error'
  error?: string
}

// Document state slice
export interface DocumentContextType {
  documents: Document[]
  documentCount: number
  currentPage: number
  pageSize: number
  isProcessingDocument: boolean
  processingProgress: {
    documentId: string
    stage: 'loading' | 'splitting' | 'indexing'
    progress: number
    currentFile?: string
  } | null
  fileUploads: Record<string, UploadFileProgress>
  loadDocuments: (
    page?: number,
    limit?: number
  ) => Promise<{ documents: Document[]; count: number }>
  loadNextPage: () => Promise<{ documents: Document[]; count: number }>
  loadPreviousPage: () => Promise<{ documents: Document[]; count: number }>
  initializeUpload: (files: Array<{ id: string; name: string; path: string }>) => string[]
  clearFileUploads: () => boolean
  removeFileUpload: (fileId: string) => boolean
  uploadDocuments: (fileIds: string[], tags: string[]) => Promise<any[] | undefined>
  deleteDocument: (id: string) => Promise<void>
}

// Chat state slice
export interface ChatContextType {
  chats: Chat[]
  chatCount: number
  currentPage: number
  pageSize: number
  currentChatId: string | null
  messages: Record<string, ChatMessage[]>
  isGeneratingResponse: boolean
  loadChats: (page?: number, limit?: number) => Promise<{ chats: Chat[]; count: number }>
  loadNextPage: () => Promise<{ chats: Chat[]; count: number }>
  loadPreviousPage: () => Promise<{ chats: Chat[]; count: number }>
  createChat: (title: string) => Promise<string>
  loadMessages: (chatId: string) => Promise<void>
  sendMessage: (chatId: string, content: string, documentIds: string[]) => Promise<void>
  deleteChat: (id: string) => Promise<void>
}

// Settings state slice
export interface SettingsContextType {
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
  updateSettings: (settings: Partial<SettingsContextType['settings']>) => Promise<void>
  setApiKey: (provider: string, key: string) => Promise<void>
}
