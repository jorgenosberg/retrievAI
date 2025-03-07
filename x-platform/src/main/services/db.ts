import Database from 'better-sqlite3';
import { app } from 'electron';
import { join } from 'path';
import fs from 'fs';

export interface Document {
  id: string;
  title: string;
  path: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  chat_id: string;
  created_at: string;
}

export interface Chat {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Citation {
  id: string;
  message_id: string;
  document_id: string;
  text: string;
  confidence: number;
}

class DatabaseService {
  private db: Database.Database;
  
  constructor() {
    const userDataPath = app.getPath('userData');
    const dbPath = join(userDataPath, 'retrievai.db');
    
    // Ensure directory exists
    fs.mkdirSync(userDataPath, { recursive: true });
    
    this.db = new Database(dbPath);
    this.initDatabase();
  }
  
  private initDatabase(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        path TEXT NOT NULL,
        tags TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS chats (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        chat_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (chat_id) REFERENCES chats(id)
      );
      
      CREATE TABLE IF NOT EXISTS citations (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        document_id TEXT NOT NULL,
        text TEXT NOT NULL,
        confidence REAL NOT NULL,
        FOREIGN KEY (message_id) REFERENCES messages(id),
        FOREIGN KEY (document_id) REFERENCES documents(id)
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }
  
  // Document methods
  addDocument(doc: Omit<Document, 'id' | 'created_at' | 'updated_at'>): Document {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    
    const document: Document = {
      id,
      ...doc,
      tags: doc.tags || [],
      created_at: now,
      updated_at: now
    };
    
    const stmt = this.db.prepare(`
      INSERT INTO documents (id, title, path, tags, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      document.id,
      document.title,
      document.path,
      JSON.stringify(document.tags),
      document.created_at,
      document.updated_at
    );
    
    return document;
  }
  
  getDocuments(): Document[] {
    const stmt = this.db.prepare('SELECT * FROM documents ORDER BY updated_at DESC');
    const rows = stmt.all();
    
    return rows.map(row => ({
      ...row,
      tags: JSON.parse(row.tags || '[]')
    }));
  }
  
  getDocumentsByIds(ids: string[]): Document[] {
    if (ids.length === 0) return [];
    
    const placeholders = ids.map(() => '?').join(',');
    const stmt = this.db.prepare(`SELECT * FROM documents WHERE id IN (${placeholders})`);
    const rows = stmt.all(...ids);
    
    return rows.map(row => ({
      ...row,
      tags: JSON.parse(row.tags || '[]')
    }));
  }
  
  // Chat methods
  createChat(title: string): Chat {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    
    const chat: Chat = {
      id,
      title,
      created_at: now,
      updated_at: now
    };
    
    const stmt = this.db.prepare(`
      INSERT INTO chats (id, title, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `);
    
    stmt.run(
      chat.id,
      chat.title,
      chat.created_at,
      chat.updated_at
    );
    
    return chat;
  }
  
  getChats(): Chat[] {
    const stmt = this.db.prepare('SELECT * FROM chats ORDER BY updated_at DESC');
    return stmt.all();
  }
  
  // Message methods
  addMessage(message: Omit<ChatMessage, 'id' | 'created_at'>): ChatMessage {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    
    const chatMessage: ChatMessage = {
      id,
      ...message,
      created_at: now
    };
    
    const stmt = this.db.prepare(`
      INSERT INTO messages (id, role, content, chat_id, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      chatMessage.id,
      chatMessage.role,
      chatMessage.content,
      chatMessage.chat_id,
      chatMessage.created_at
    );
    
    // Update the chat's updated_at timestamp
    this.db.prepare('UPDATE chats SET updated_at = ? WHERE id = ?')
      .run(now, chatMessage.chat_id);
    
    return chatMessage;
  }
  
  getMessagesByChatId(chatId: string): ChatMessage[] {
    const stmt = this.db.prepare('SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC');
    return stmt.all(chatId);
  }
  
  // Citation methods
  addCitation(citation: Omit<Citation, 'id'>): Citation {
    const id = crypto.randomUUID();
    
    const newCitation: Citation = {
      id,
      ...citation
    };
    
    const stmt = this.db.prepare(`
      INSERT INTO citations (id, message_id, document_id, text, confidence)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      newCitation.id,
      newCitation.message_id,
      newCitation.document_id,
      newCitation.text,
      newCitation.confidence
    );
    
    return newCitation;
  }
  
  getCitationsByMessageId(messageId: string): Citation[] {
    const stmt = this.db.prepare('SELECT * FROM citations WHERE message_id = ?');
    return stmt.all(messageId);
  }
  
  // Settings methods
  setSetting(key: string, value: string): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO settings (key, value)
      VALUES (?, ?)
    `);
    
    stmt.run(key, value);
  }
  
  getSetting(key: string): string | null {
    const stmt = this.db.prepare('SELECT value FROM settings WHERE key = ?');
    const row = stmt.get(key);
    return row ? row.value : null;
  }
}

const databaseService = new DatabaseService();
export default databaseService;