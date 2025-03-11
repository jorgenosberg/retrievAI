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
      // Start measuring time
      const startTime = Date.now()

      // Initialize database (optimized version now initializes in background)
      await this.db.initialize()

      // Wait only for database since settings depends on it
      console.log(`Database initialized in ${Date.now() - startTime}ms`)

      // Initialize settings synchronously, important for app function
      await this.settings.initialize()
      console.log(`Settings initialized in ${Date.now() - startTime}ms`)

      // Start vectorstore initialization in background
      await this.vectorstore.initialize().catch((err) => {
        console.warn('Background vectorstore initialization error:', err)
      })

      console.log(`Vectorstore initialized in ${Date.now() - startTime}ms`)

      console.log(`Essential services initialized in ${Date.now() - startTime}ms`)
      this.initialized = true

      return
    } catch (error) {
      console.error('Failed to initialize essential services:', error)
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
