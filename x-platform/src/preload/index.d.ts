import { ElectronAPI } from '@electron-toolkit/preload'

interface Document {
  id: string;
  title: string;
  path: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  chat_id: string;
  created_at: string;
  citations?: Citation[];
}

interface Chat {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface Citation {
  id: string;
  message_id: string;
  document_id: string;
  text: string;
  confidence: number;
}

interface QueryResult {
  answer: string;
  citations: Citation[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  processTime: number;
  model: string;
  userMessageId: string;
  assistantMessageId: string;
}

interface ApiSuccess<T> {
  success: true;
  [key: string]: any;
}

interface ApiError {
  success: false;
  error: string;
}

type ApiResponse<T> = ApiSuccess<T> | ApiError;

interface DocumentAPI {
  uploadDocuments: (filePaths: string[], tags: string[]) => Promise<ApiResponse<{
    documents: Document[];
  }>>;
  selectDocuments: () => Promise<ApiResponse<{
    filePaths: string[];
  }>>;
  getAllDocuments: () => Promise<ApiResponse<{
    documents: Document[];
  }>>;
  deleteDocument: (documentId: string) => Promise<ApiResponse<void>>;
}

interface ChatAPI {
  createChat: (title: string) => Promise<ApiResponse<{
    chat: Chat;
  }>>;
  getAllChats: () => Promise<ApiResponse<{
    chats: Chat[];
  }>>;
  getChatMessages: (chatId: string) => Promise<ApiResponse<{
    messages: ChatMessage[];
  }>>;
  sendQuery: (
    chatId: string,
    query: string,
    documentIds: string[],
    config?: any
  ) => Promise<ApiResponse<{
    result: QueryResult;
  }>>;
}

interface SettingsAPI {
  setApiKey: (provider: string, apiKey: string) => Promise<ApiResponse<void>>;
  getAvailableModels: () => Promise<ApiResponse<{
    models: Array<{
      provider: string;
      models: string[];
    }>;
  }>>;
  setDefaultModel: (modelConfig: any) => Promise<ApiResponse<void>>;
  setEmbeddingModel: (provider: string) => Promise<ApiResponse<void>>;
}

interface API extends DocumentAPI, ChatAPI, SettingsAPI {}

declare global {
  interface Window {
    electron: ElectronAPI;
    api: API;
  }
}
