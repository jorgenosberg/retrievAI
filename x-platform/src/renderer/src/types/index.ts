/* eslint-disable @typescript-eslint/no-explicit-any */
// Document types
export interface Document {
  id: string
  title: string
  path: string
  tags: string[]
  created_at: string
  updated_at: string
  file_size: number
  content_type: string
}

export interface FileWithProgress {
  id: string
  file: {
    name: string
    type: string
    path: string
    size: number
    lastModified: Date
  }
  progress: number
  status: 'idle' | 'uploading' | 'success' | 'error'
  error?: string
  documentId?: string
}

export interface ProcessProgress {
  documentId: string
  stage: 'loading' | 'splitting' | 'indexing'
  progress: number
  currentFile?: string
  processedChunks?: number
  totalChunks?: number
}

// Chat types
export interface Chat {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export interface Citation {
  id: string
  message_id: string
  document_id: string
  text: string
  confidence: number
}

export interface ChatMessage {
  id: string
  chat_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
  citations?: Citation[]
}

export interface QueryResult {
  answer: string
  citations: Citation[]
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  processTime: number
  model: string
  userMessageId: string
  assistantMessageId: string
}

// Settings types
export interface ModelConfig {
  provider: 'openai' | 'anthropic'
  model: string
  temperature?: number
  maxTokens?: number
}

export interface EmbeddingConfig {
  provider: 'openai' | 'huggingface'
  model: string
}

export interface RagConfig {
  chunkSize: number
  chunkOverlap: number
  similarityThreshold: number
  maxSources: number
}

// UI types
export interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
}

declare global {
  interface Window {
    electronAPI: {
      documents: {
        getAll: () => Promise<any[]>
        getById: (id: string) => Promise<any>
        process: (filePaths: string[], tags: string[]) => Promise<any[]>
        delete: (id: string) => Promise<void>
        onProcessingProgress: (callback: (progress: any) => void) => void
      }
      chats: {
        getAll: () => Promise<any[]>
        create: (title: string) => Promise<any>
        getMessages: (chatId: string) => Promise<any[]>
        sendQuery: (
          chatId: string,
          query: string,
          documentIds: string[],
          config?: any
        ) => Promise<any>
        delete: (id: string) => Promise<void>
      }
      settings: {
        getAll: () => Promise<any>
        update: (settings: any) => Promise<void>
        setApiKey: (provider: string, key: string) => Promise<void>
      }
      dialog: {
        openFileDialog: (options: any) => Promise<any>
      }
      app: {
        onReady: (callback: () => any) => Promise<void>
      }
    }
  }
}
