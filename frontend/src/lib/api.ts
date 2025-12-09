import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios'
import { resetAuthCache } from '@/lib/authSession'
import type { ChunkListResponse } from '@/types/chunk'

export interface AuthTokens {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface User {
  id: number
  email: string
  full_name: string | null
  role: string
  is_active: boolean
  created_at: string
}

class ApiClient {
  private client: AxiosInstance
  private accessToken: string | null = null
  private refreshToken: string | null = null
  private refreshPromise: Promise<AuthTokens> | null = null
  private refreshTimeoutId: number | null = null

  constructor() {
    this.client = axios.create({
      baseURL: '/api/v1',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Load tokens from localStorage on init
    this.loadTokens()

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        if (this.accessToken && config.headers) {
          config.headers.Authorization = `Bearer ${this.accessToken}`
        }
        return config
      },
      (error) => Promise.reject(error)
    )

    // Response interceptor for 401 errors with refresh logic
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config

        // If 401 and we have a refresh token and haven't already retried
        if (error.response?.status === 401 && this.refreshToken && !originalRequest._retry) {
          originalRequest._retry = true

          try {
            // Attempt to refresh the token
            const tokens = await this.performTokenRefresh()

            // Update the authorization header and retry
            originalRequest.headers.Authorization = `Bearer ${tokens.access_token}`
            return this.client(originalRequest)
          } catch (refreshError) {
            // Refresh failed, clear tokens and redirect to login
            this.clearTokens()
            window.location.href = '/login'
            return Promise.reject(refreshError)
          }
        }

        // If 401 without refresh token, redirect to login
        if (error.response?.status === 401) {
          this.clearTokens()
          window.location.href = '/login'
        }

        return Promise.reject(error)
      }
    )
  }

  private loadTokens() {
    const accessToken = localStorage.getItem('access_token')
    const refreshToken = localStorage.getItem('refresh_token')

    if (accessToken) {
      this.accessToken = accessToken
    }
    if (refreshToken) {
      this.refreshToken = refreshToken
      // Schedule auto-refresh when tokens are loaded
      this.scheduleTokenRefresh()
    }
  }

  private async performTokenRefresh(): Promise<AuthTokens> {
    // Prevent multiple simultaneous refresh requests
    if (this.refreshPromise) {
      return this.refreshPromise
    }

    if (!this.refreshToken) {
      throw new Error('No refresh token available')
    }

    this.refreshPromise = this.client
      .post<AuthTokens>('/auth/refresh', {
        refresh_token: this.refreshToken,
      })
      .then((response) => {
        this.setTokens(response.data.access_token, response.data.refresh_token)
        return response.data
      })
      .finally(() => {
        this.refreshPromise = null
      })

    return this.refreshPromise
  }

  private scheduleTokenRefresh() {
    // Clear any existing timeout
    if (this.refreshTimeoutId !== null) {
      clearTimeout(this.refreshTimeoutId)
    }

    // Refresh 5 minutes before expiration (access token expires in 30 mins)
    const refreshIn = (30 - 5) * 60 * 1000 // 25 minutes in milliseconds

    this.refreshTimeoutId = window.setTimeout(() => {
      this.performTokenRefresh().catch((error) => {
        console.error('Auto token refresh failed:', error)
        this.clearTokens()
        window.location.href = '/login'
      })
    }, refreshIn)
  }

  setTokens(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken
    this.refreshToken = refreshToken
    localStorage.setItem('access_token', accessToken)
    localStorage.setItem('refresh_token', refreshToken)

    // Schedule next refresh
    this.scheduleTokenRefresh()
  }

  setToken(token: string) {
    // For backwards compatibility - you should use setTokens instead
    this.accessToken = token
    localStorage.setItem('access_token', token)
  }

  clearTokens() {
    this.accessToken = null
    this.refreshToken = null
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    resetAuthCache()

    // Clear refresh timeout
    if (this.refreshTimeoutId !== null) {
      clearTimeout(this.refreshTimeoutId)
      this.refreshTimeoutId = null
    }
  }

  clearToken() {
    // For backwards compatibility
    this.clearTokens()
  }

  getToken(): string | null {
    return this.accessToken
  }

  getRefreshToken(): string | null {
    return this.refreshToken
  }

  // Auth endpoints
  async register(email: string, password: string, fullName?: string) {
    const response = await this.client.post<User>('/auth/register', {
      email,
      password,
      full_name: fullName,
    })
    return response.data
  }

  async login(email: string, password: string) {
    const response = await this.client.post<AuthTokens>('/auth/login', {
      email,
      password,
    })

    this.setTokens(response.data.access_token, response.data.refresh_token)
    return response.data
  }

  async getCurrentUser() {
    const response = await this.client.get<User>('/auth/me')
    return response.data
  }

  logout() {
    this.clearTokens()
  }

  // Documents endpoints
  async getDocuments(
    page = 1,
    pageSize = 50,
    filters?: {
      statusFilter?: string
      search?: string
      fileType?: string
      uploadedBy?: number
      dateFrom?: string
      dateTo?: string
      minSize?: number
      maxSize?: number
      minChunks?: number
      maxChunks?: number
    }
  ) {
    const response = await this.client.get('/documents/', {
      params: {
        page,
        page_size: pageSize,
        status_filter: filters?.statusFilter,
        search: filters?.search || undefined,
        file_type: filters?.fileType || undefined,
        uploaded_by: filters?.uploadedBy,
        date_from: filters?.dateFrom || undefined,
        date_to: filters?.dateTo || undefined,
        min_size: filters?.minSize,
        max_size: filters?.maxSize,
        min_chunks: filters?.minChunks,
        max_chunks: filters?.maxChunks,
      },
    })
    return response.data
  }

  async getDocumentStats() {
    const response = await this.client.get('/documents/stats')
    return response.data
  }

  async getDocument(id: number) {
    const response = await this.client.get(`/documents/${id}`)
    return response.data
  }

  async deleteDocument(id: number) {
    const response = await this.client.delete(`/documents/${id}`)
    return response.data
  }

  async searchDocuments(query: string, k = 10) {
    const response = await this.client.post('/documents/search', null, {
      params: { query, k },
    })
    return response.data
  }

  // Upload endpoints
  async uploadDocument(file: File, onProgress?: (progress: number) => void) {
    const formData = new FormData()
    formData.append('file', file)

    const response = await this.client.post('/upload/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          )
          onProgress(percentCompleted)
        }
      },
    })
    return response.data
  }

  async getUploadStatus(fileHash: string) {
    const response = await this.client.get(`/upload/status/${fileHash}`)
    return response.data
  }

  async getSupportedTypes() {
    const response = await this.client.get('/upload/supported-types')
    return response.data
  }

  // Chat endpoints
  async getChatHistory(page = 1, limit = 20) {
    const response = await this.client.get('/chat/conversations', {
      params: { page, limit },
    })
    return response.data
  }

  async getConversation(id: number) {
    const response = await this.client.get(`/chat/conversations/${id}`)
    return response.data
  }

  async deleteConversation(id: number) {
    await this.client.delete(`/chat/conversations/${id}`)
  }

  // Stream chat with SSE
  async streamChat(
    message: string,
    conversationId: string | undefined,
    onEvent: (event: any) => void,
    onError?: (error: Error) => void,
    onComplete?: () => void
  ): Promise<void> {
    // Use relative URL to leverage Vite proxy
    const url = '/api/v1/chat/'
    const token = this.getToken()

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        message,
        conversation_id: conversationId,
        stream: true,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Chat request failed:', response.status, errorText)
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`)
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    if (!reader) {
      throw new Error('No response body')
    }

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6) // Remove 'data: ' prefix
              const event = JSON.parse(jsonStr)
              onEvent(event)
            } catch (e) {
              console.error('Error parsing SSE event:', e)
            }
          }
        }
      }
      onComplete?.()
    } catch (error) {
      onError?.(error as Error)
    } finally {
      reader.releaseLock()
    }
  }

  // Settings endpoints
  async getSettings() {
    const response = await this.client.get('/settings/')
    return response.data
  }

  async updateSettings(settings: Record<string, unknown>) {
    const response = await this.client.put('/settings/', settings)
    return response.data
  }

  async resetSettings() {
    const response = await this.client.post('/settings/reset')
    return response.data
  }

  async getUserSettings() {
    const response = await this.client.get('/settings/me')
    return response.data
  }

  async updateUserPreferences(preferences: Record<string, unknown>) {
    const response = await this.client.put('/settings/me', preferences)
    return response.data
  }

  async setPersonalApiKey(apiKey: string) {
    const response = await this.client.post('/settings/me/api-key', { api_key: apiKey })
    return response.data
  }

  async deletePersonalApiKey() {
    const response = await this.client.delete('/settings/me/api-key')
    return response.data
  }

  async getGlobalApiKeyInfo() {
    const response = await this.client.get('/settings/openai-key')
    return response.data
  }

  async setGlobalApiKey(apiKey: string) {
    const response = await this.client.post('/settings/openai-key', { api_key: apiKey })
    return response.data
  }

  async clearGlobalApiKey() {
    const response = await this.client.delete('/settings/openai-key')
    return response.data
  }

  // Admin endpoints
  async getUsers() {
    const response = await this.client.get('/admin/users')
    return response.data
  }

  async createUser(payload: Record<string, unknown>) {
    const response = await this.client.post('/admin/users', payload)
    return response.data
  }

  async updateUser(userId: number, payload: Record<string, unknown>) {
    const response = await this.client.put(`/admin/users/${userId}`, payload)
    return response.data
  }

  async deleteUser(userId: number) {
    const response = await this.client.delete(`/admin/users/${userId}`)
    return response.data
  }

  async getSystemStats() {
    const response = await this.client.get('/admin/system/stats')
    return response.data
  }

  // Get raw axios instance for custom requests
  getClient(): AxiosInstance {
    return this.client
  }

  // Chunks endpoints
  async getChunkContext(fileHash: string, chunkContent: string, contextSize: number = 2) {
    const response = await this.client.post('/chunks/context', {
      file_hash: fileHash,
      chunk_content: chunkContent,
      context_size: contextSize,
    })
    return response.data
  }

  async getDocumentChunks(
    fileHash: string,
    params?: { limit?: number; offset?: number; search?: string }
  ): Promise<ChunkListResponse> {
    const response = await this.client.get(`/chunks/by-file/${fileHash}`, {
      params: {
        limit: params?.limit,
        offset: params?.offset,
        search: params?.search,
      },
    })
    return response.data
  }
}

export const apiClient = new ApiClient()
