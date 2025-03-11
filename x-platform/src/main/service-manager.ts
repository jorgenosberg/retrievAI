// main/service-manager.ts
import path from 'path'
import { app } from 'electron'
import { DatabaseService } from './services/database'
import { VectorstoreService } from './services/vectorstore'
import { SettingsService } from './services/settings'
import { DocumentService } from './services/document'
import { ChatService } from './services/chat'

export class ServiceManager {
  private db: DatabaseService
  private settings: SettingsService
  private vectorstore: VectorstoreService
  private documentService: DocumentService
  private chatService: ChatService
  private initialized = false

  constructor() {
    // Get the app data path for storing data
    const appDataPath = path.join(app.getPath('userData'), 'RetrievAI')

    // Initialize services
    this.db = new DatabaseService(appDataPath)
    this.settings = new SettingsService(this.db)
    this.vectorstore = new VectorstoreService(appDataPath, this.settings)
    this.documentService = new DocumentService(this.db, this.vectorstore, this.settings)
    this.chatService = new ChatService(this.db, this.vectorstore, this.settings)
  }

  async initialize(): Promise<void> {
    if (this.initialized) return

    console.log('Initializing services...')

    try {
      // Initialize in correct order
      await this.db.initialize()
      console.log('Database initialized')

      await this.settings.initialize()
      console.log('Settings initialized')

      await this.vectorstore.initialize()
      console.log('Vectorstore initialized')

      this.initialized = true
      console.log('All services initialized successfully')
    } catch (error) {
      console.error('Failed to initialize services:', error)
      throw error
    }
  }

  getDb(): DatabaseService {
    return this.db
  }

  getSettings(): SettingsService {
    return this.settings
  }

  getVectorstore(): VectorstoreService {
    return this.vectorstore
  }

  getDocumentService(): DocumentService {
    return this.documentService
  }

  getChatService(): ChatService {
    return this.chatService
  }
}
