/* eslint-disable @typescript-eslint/no-explicit-any */
import { DatabaseService } from './database'

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

export class SettingsService {
  private db: DatabaseService
  private defaultModelConfig: ModelConfig = {
    provider: 'openai',
    model: 'gpt-4o-mini',
    temperature: 0.0,
    maxTokens: 2000
  }
  private embeddingConfig: EmbeddingConfig = {
    provider: 'openai',
    model: 'text-embedding-3-small'
  }
  private ragConfig = {
    chunkSize: 1000,
    chunkOverlap: 200,
    similarityThreshold: 0.7,
    maxSources: 5
  }
  private apiKeys: Record<string, string> = {
    openai: '',
    anthropic: ''
  }

  constructor(db: DatabaseService) {
    this.db = db
  }

  async initialize(): Promise<void> {
    // Load configs from database if they exist
    const defaultModelSetting = this.db.getSetting('defaultModel')
    if (defaultModelSetting) {
      this.defaultModelConfig = JSON.parse(defaultModelSetting)
    } else {
      // Save default to DB
      this.db.setSetting('defaultModel', JSON.stringify(this.defaultModelConfig))
    }

    const embeddingSetting = this.db.getSetting('embeddingModel')
    if (embeddingSetting) {
      this.embeddingConfig = JSON.parse(embeddingSetting)
    } else {
      // Save default to DB
      this.db.setSetting('embeddingModel', JSON.stringify(this.embeddingConfig))
    }

    const ragSetting = this.db.getSetting('ragConfig')
    if (ragSetting) {
      this.ragConfig = JSON.parse(ragSetting)
    } else {
      // Save default to DB
      this.db.setSetting('ragConfig', JSON.stringify(this.ragConfig))
    }

    // Load API keys
    const openaiApiKey = this.db.getSetting('apiKey_openai')
    if (openaiApiKey) {
      this.apiKeys['openai'] = openaiApiKey
    }

    const anthropicApiKey = this.db.getSetting('apiKey_anthropic')
    if (anthropicApiKey) {
      this.apiKeys['anthropic'] = anthropicApiKey
    }
  }

  // API Key management
  async setApiKey(provider: string, apiKey: string): Promise<void> {
    this.apiKeys[provider] = apiKey
    this.db.setSetting(`apiKey_${provider}`, apiKey)
  }

  getApiKey(provider: string): string | null {
    return this.apiKeys[provider] || null
  }

  // Model management
  async getAvailableModels(): Promise<{ provider: string; models: string[] }[]> {
    const models = [
      {
        provider: 'openai',
        models: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo', 'gpt-4o', 'gpt-4o-mini']
      },
      {
        provider: 'anthropic',
        models: ['claude-3-haiku-20240307', 'claude-3-sonnet-20240229', 'claude-3-opus-20240229']
      }
    ]

    return models
  }

  async setDefaultModel(modelConfig: ModelConfig): Promise<void> {
    this.defaultModelConfig = modelConfig
    this.db.setSetting('defaultModel', JSON.stringify(modelConfig))
  }

  getDefaultModel(): ModelConfig {
    return this.defaultModelConfig
  }

  // Embedding model
  async setEmbeddingModel(provider: 'openai' | 'huggingface'): Promise<void> {
    let model = 'text-embedding-3-small'
    if (provider === 'huggingface') {
      model = 'BAAI/bge-small-en-v1.5'
    }

    this.embeddingConfig = { provider, model }
    this.db.setSetting('embeddingModel', JSON.stringify(this.embeddingConfig))
  }

  getEmbeddingModel(): EmbeddingConfig {
    return this.embeddingConfig
  }

  // RAG settings
  async setRagConfig(config: typeof this.ragConfig): Promise<void> {
    this.ragConfig = config
    this.db.setSetting('ragConfig', JSON.stringify(config))
  }

  getRagConfig(): typeof this.ragConfig {
    return this.ragConfig
  }

  // App settings
  async setAppSetting(key: string, value: any): Promise<void> {
    this.db.setSetting(key, JSON.stringify(value))
  }

  getAppSetting<T>(key: string, defaultValue: T): T {
    const setting = this.db.getSetting(key)
    return setting ? JSON.parse(setting) : defaultValue
  }

  getAllSettings(): Record<string, any> {
    const settings = this.db.getAllSettings()
    const result: Record<string, any> = {}

    for (const setting of settings) {
      // Don't include API keys in the result
      if (!setting.key.startsWith('apiKey_')) {
        try {
          result[setting.key] = JSON.parse(setting.value)
        } catch {
          result[setting.key] = setting.value
        }
      }
    }

    return result
  }
}
