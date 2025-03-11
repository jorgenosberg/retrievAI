/* eslint-disable @typescript-eslint/no-explicit-any */
// types/index.ts
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

export interface Chat {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export interface ChatMessage {
  id: string
  chat_id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  sources: any[]
  citations?: Citation[]
}

export interface Citation {
  id: string
  message_id: string
  citation_number: number
  document_id: string
  document_title: string
  text: string
  confidence: number
}

export interface ProcessingProgress {
  documentId: string
  stage: 'loading' | 'splitting' | 'indexing'
  progress: number
  currentFile?: string
}

export interface UploadFileProgress {
  fileId: string
  fileName: string
  filePath: string
  documentId?: string
  progress: number
  stage: 'idle' | 'loading' | 'splitting' | 'indexing' | 'complete' | 'error'
  error?: string
}

// Settings types
export interface ModelConfig {
  provider: 'openai' | 'anthropic'
  model: string
  temperature: number
  maxTokens: number
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

export interface Settings {
  defaultModel: ModelConfig
  embeddingModel: EmbeddingConfig
  ragConfig: RagConfig
}

// Electron API interface to match preload.ts
export interface ElectronAPI {
  documents: {
    getPage: (limit?: number, offset?: number) => Promise<Document[]>
    getCount: () => Promise<number>
    getById: (id: string) => Promise<Document | null>
    process: (filePaths: string[], tags: string[]) => Promise<Document[]>
    delete: (id: string) => Promise<void>
    onProcessingProgress: (callback: (progress: ProcessingProgress) => void) => () => void
  }
  chats: {
    getPage: (limit?: number, offset?: number) => Promise<Chat[]>
    getCount: () => Promise<number>
    create: (title: string) => Promise<Chat>
    getMessages: (chatId: string) => Promise<ChatMessage[]>
    sendQuery: (
      chatId: string,
      query: string,
      documentIds: string[],
      config?: any
    ) => Promise<{
      userMessage: ChatMessage
      assistantMessage: ChatMessage
      usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
      model: string
    }>
    delete: (id: string) => Promise<void>
  }
  settings: {
    getAll: () => Promise<Settings>
    update: (settings: Partial<Settings>) => Promise<boolean>
    setApiKey: (provider: string, key: string) => Promise<boolean>
  }
  dialog: {
    openFileDialog: (options: any) => Promise<string[]>
  }
  app: {
    onReady: (callback: () => void) => () => void
    onServicesReady: (callback: () => void) => () => void
  }
}

// Extend the Window interface
declare global {
  interface Window {
    electronAPI: ElectronAPI
    fs: {
      readFile: (path: string, options?: { encoding?: string }) => Promise<Uint8Array | string>
    }
  }
}
