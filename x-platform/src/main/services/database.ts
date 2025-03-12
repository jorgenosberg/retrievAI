/* eslint-disable @typescript-eslint/no-explicit-any */
import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'

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

export interface Citation {
  id: string
  message_id: string
  citation_number: number
  document_id: string
  document_title: string
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

export interface Chat {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export interface Setting {
  key: string
  value: string
}

export class DatabaseService {
  private db: Database.Database
  private dbPath: string

  private dbInitialized = false
  private dbInitPromise: Promise<void> | null = null

  constructor(appDataPath: string) {
    // Ensure directory exists
    if (!fs.existsSync(appDataPath)) {
      fs.mkdirSync(appDataPath, { recursive: true })
    }

    this.dbPath = path.join(appDataPath, 'retrievai.db')

    // Use minimal SQLite configuration with good defaults
    this.db = new Database(this.dbPath, {
      readonly: false,
      fileMustExist: false
    })

    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL')

    // Enable foreign keys for data integrity
    this.db.pragma('foreign_keys = ON')
  }

  async initialize(): Promise<void> {
    // Only initialize once
    if (this.dbInitialized) return

    // If already initializing, return the same promise
    if (this.dbInitPromise) return this.dbInitPromise

    console.log('Initializing database...')

    // Create an initialization promise but use setImmediate to yield to the event loop
    this.dbInitPromise = new Promise<void>((resolve, reject) => {
      // Use setImmediate to not block the main thread during startup
      setImmediate(() => {
        try {
          // Run large SQL operations in transaction for better performance
          this.db.transaction(() => {
            this.db.exec(`
              CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                path TEXT NOT NULL,
                tags TEXT, -- JSON array as string
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                content_type TEXT NOT NULL
              );

              CREATE TABLE IF NOT EXISTS chats (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
              );

              CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                chat_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (chat_id) REFERENCES chats (id) ON DELETE CASCADE
              );

              CREATE TABLE IF NOT EXISTS citations (
                id TEXT PRIMARY KEY,
                message_id TEXT NOT NULL,
                citation_number INTEGER NOT NULL,
                document_id TEXT NOT NULL,
                document_title TEXT NOT NULL,
                text TEXT NOT NULL,
                confidence REAL NOT NULL,
                FOREIGN KEY (message_id) REFERENCES messages (id) ON DELETE CASCADE,
                FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE
              );

              CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
              );
              
              -- Add indexes for better query performance
              CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
              CREATE INDEX IF NOT EXISTS idx_citations_message_id ON citations(message_id);
              CREATE INDEX IF NOT EXISTS idx_citations_document_id ON citations(document_id);
            `)
          })()

          console.log('Database initialized successfully')
          this.dbInitialized = true
          resolve()
        } catch (error) {
          console.error('Failed to initialize database:', error)
          reject(error)
        }
      })
    })

    return this.dbInitPromise
  }

  // Document operations
  addDocument(document: Document): void {
    const stmt = this.db.prepare(`
      INSERT INTO documents (id, title, path, tags, created_at, updated_at, file_size, content_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      document.id,
      document.title,
      document.path,
      JSON.stringify(document.tags),
      document.created_at,
      document.updated_at,
      document.file_size,
      document.content_type
    )
  }

  // Get document list with pagination for lazy loading
  getDocuments(limit: number = 20, offset: number = 0): Document[] {
    const stmt = this.db.prepare(
      'SELECT * FROM documents ORDER BY created_at DESC LIMIT ? OFFSET ?'
    )
    const rows = stmt.all(limit, offset) as any[]

    return rows.map((row) => ({
      ...row,
      tags: JSON.parse(row.tags || '[]')
    }))
  }

  // Get total document count for pagination
  getDocumentCount(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM documents')
    const result = stmt.get() as { count: number }
    return result.count
  }

  getDocumentById(id: string): Document | null {
    const stmt = this.db.prepare('SELECT * FROM documents WHERE id = ?')
    const row = stmt.get(id) as any

    if (!row) return null

    return {
      ...row,
      tags: JSON.parse(row.tags || '[]')
    }
  }

  getDocumentsByIds(ids: string[]): Document[] {
    if (ids.length === 0) return []

    const placeholders = ids.map(() => '?').join(',')
    const stmt = this.db.prepare(`SELECT * FROM documents WHERE id IN (${placeholders})`)
    const rows = stmt.all(...ids) as any[]

    return rows.map((row) => ({
      ...row,
      tags: JSON.parse(row.tags || '[]')
    }))
  }

  updateDocument(document: Partial<Document> & { id: string }): void {
    const { id, ...fields } = document

    // Build update string dynamically based on provided fields
    const updates = Object.keys(fields)
      .map((key) => `${key} = ?`)
      .join(', ')
    const values = Object.values(fields)

    if (updates.length === 0) return

    const stmt = this.db.prepare(`UPDATE documents SET ${updates} WHERE id = ?`)
    stmt.run(...values, id)
  }

  deleteDocument(id: string): void {
    const stmt = this.db.prepare('DELETE FROM documents WHERE id = ?')
    stmt.run(id)
  }

  // Chat operations
  createChat(chat: Chat): void {
    const stmt = this.db.prepare(`
      INSERT INTO chats (id, title, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `)

    stmt.run(chat.id, chat.title, chat.created_at, chat.updated_at)
  }

  // Get chats with pagination for lazy loading
  getChats(limit: number = 20, offset: number = 0): Chat[] {
    const stmt = this.db.prepare('SELECT * FROM chats ORDER BY updated_at DESC LIMIT ? OFFSET ?')
    return stmt.all(limit, offset) as Chat[]
  }

  // Get total chat count for pagination
  getChatCount(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM chats')
    const result = stmt.get() as { count: number }
    return result.count
  }

  getChatById(id: string): Chat | null {
    const stmt = this.db.prepare('SELECT * FROM chats WHERE id = ?')
    return stmt.get(id) as Chat | null
  }

  updateChat(chat: Partial<Chat> & { id: string }): void {
    const { id, ...fields } = chat

    // Build update string dynamically based on provided fields
    const updates = Object.keys(fields)
      .map((key) => `${key} = ?`)
      .join(', ')
    const values = Object.values(fields)

    if (updates.length === 0) return

    const stmt = this.db.prepare(`UPDATE chats SET ${updates} WHERE id = ?`)
    stmt.run(...values, id)
  }

  deleteChat(id: string): void {
    const stmt = this.db.prepare('DELETE FROM chats WHERE id = ?')
    stmt.run(id)
  }

  // Message operations
  addMessage(message: ChatMessage): void {
    const stmt = this.db.prepare(`
      INSERT INTO messages (id, chat_id, role, content, created_at)
      VALUES (?, ?, ?, ?, ?)
    `)

    stmt.run(message.id, message.chat_id, message.role, message.content, message.created_at)

    // Add citations if provided
    if (message.citations && message.citations.length > 0) {
      const citationStmt = this.db.prepare(`
        INSERT INTO citations (id, message_id, citation_number, document_id, document_title, text, confidence)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)

      const insertCitations = this.db.transaction((citations: Citation[]) => {
        for (const citation of citations) {
          citationStmt.run(
            citation.id,
            citation.message_id,
            citation.citation_number,
            citation.document_id,
            citation.document_title,
            citation.text,
            citation.confidence
          )
        }
      })

      insertCitations(message.citations)
    }
  }

  getMessagesByChatId(chatId: string): ChatMessage[] {
    const stmt = this.db.prepare(`
      SELECT m.*, json_group_array(
        json_object(
          'id', c.id,
          'message_id', c.message_id,
          'document_id', c.document_id,
          'text', c.text,
          'confidence', c.confidence
        )
      ) as citations_json
      FROM messages m
      LEFT JOIN citations c ON m.id = c.message_id
      WHERE m.chat_id = ?
      GROUP BY m.id
      ORDER BY m.created_at ASC
    `)

    const rows = stmt.all(chatId) as any[]

    return rows.map((row) => {
      const message: ChatMessage = {
        id: row.id,
        chat_id: row.chat_id,
        role: row.role,
        content: row.content,
        created_at: row.created_at
      }

      // Parse citations if they exist
      if (row.citations_json && row.citations_json !== '[null]') {
        const citations = JSON.parse(row.citations_json)
        message.citations = citations.filter((c: any) => c.id !== null)
      }

      return message
    })
  }

  getMessageById(id: string): ChatMessage | null {
    const stmt = this.db.prepare(`
      SELECT m.*, json_group_array(
        json_object(
          'id', c.id,
          'message_id', c.message_id,
          'document_id', c.document_id,
          'text', c.text,
          'confidence', c.confidence
        )
      ) as citations_json
      FROM messages m
      LEFT JOIN citations c ON m.id = c.message_id
      WHERE m.id = ?
      GROUP BY m.id
    `)

    const row = stmt.get(id) as any

    if (!row) return null

    const message: ChatMessage = {
      id: row.id,
      chat_id: row.chat_id,
      role: row.role,
      content: row.content,
      created_at: row.created_at
    }

    // Parse citations if they exist
    if (row.citations_json && row.citations_json !== '[null]') {
      const citations = JSON.parse(row.citations_json)
      message.citations = citations.filter((c: any) => c.id !== null)
    }

    return message
  }

  // Settings operations
  getSetting(key: string): string | null {
    const stmt = this.db.prepare('SELECT value FROM settings WHERE key = ?')
    const row = stmt.get(key) as { value: string } | undefined

    return row ? row.value : null
  }

  setSetting(key: string, value: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = ?
    `)

    stmt.run(key, value, value)
  }

  getAllSettings(): Setting[] {
    const stmt = this.db.prepare('SELECT * FROM settings')
    return stmt.all() as Setting[]
  }

  updateMessage(message: ChatMessage): void {
    const { id, content, citations } = message

    // Begin transaction
    this.db.transaction(() => {
      // Update the message content
      const updateStmt = this.db.prepare(`
      UPDATE messages
      SET content = ?
      WHERE id = ?
    `)
      updateStmt.run(content, id)

      // If there are citations, update them
      if (citations && citations.length > 0) {
        // First delete existing citations for this message
        const deleteStmt = this.db.prepare(`
        DELETE FROM citations
        WHERE message_id = ?
      `)
        deleteStmt.run(id)

        // Then insert the new citations
        const citationStmt = this.db.prepare(`
        INSERT INTO citations (id, message_id, citation_number, document_id, document_title, text, confidence)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)

        for (const citation of citations) {
          citationStmt.run(
            citation.id,
            citation.message_id,
            citation.citation_number,
            citation.document_id,
            citation.document_title,
            citation.text,
            citation.confidence
          )
        }
      }
    })()
  }

  // Transaction support
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)()
  }
}
