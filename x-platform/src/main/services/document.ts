import { DatabaseService, Document } from './database'
import { VectorstoreService } from './vectorstore'
import { SettingsService } from './settings'
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf'
import { TextLoader } from 'langchain/document_loaders/fs/text'
import { DocxLoader } from '@langchain/community/document_loaders/fs/docx'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { Document as LangChainDocument } from '@langchain/core/documents'
import { EventEmitter } from 'events'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import fs from 'fs'

export interface ProcessProgress {
  documentId: string
  stage: 'loading' | 'splitting' | 'indexing'
  progress: number
  currentFile?: string
}

export class DocumentService extends EventEmitter {
  private db: DatabaseService
  private vectorstore: VectorstoreService
  private settings: SettingsService

  constructor(db: DatabaseService, vectorstore: VectorstoreService, settings: SettingsService) {
    super()
    this.db = db
    this.vectorstore = vectorstore
    this.settings = settings

    // Listen for vectorstore events and relay them
    this.vectorstore.on('indexing-progress', (data) => {
      this.emit('processing-progress', {
        documentId: data.documentId,
        stage: 'indexing',
        progress: data.progress
      } as ProcessProgress)
    })
  }

  async processDocuments(filePaths: string[], tags: string[] = []): Promise<Document[]> {
    const documents: Document[] = []

    for (const filePath of filePaths) {
      try {
        // Generate a unique ID for the document
        const documentId = uuidv4()

        // Report loading progress
        this.emit('processing-progress', {
          documentId,
          stage: 'loading',
          progress: 0,
          currentFile: path.basename(filePath)
        } as ProcessProgress)

        // Get file stats
        const stats = fs.statSync(filePath)

        // Create document metadata
        const now = new Date().toISOString()
        const document: Document = {
          id: documentId,
          title: path.basename(filePath),
          path: filePath,
          tags,
          created_at: now,
          updated_at: now,
          file_size: stats.size,
          content_type: this.getContentType(filePath)
        }

        // Save document in the database
        this.db.addDocument(document)

        console.log(`Processing document ${documentId}: ${filePath}`)

        // Load and process document
        const chunks = await this.loadAndChunkDocument(filePath, documentId)

        console.log(
          `Document ${documentId} chunked into ${chunks.length} chunks, adding to vectorstore`
        )

        // Add chunks to vectorstore
        await this.vectorstore.addDocuments(chunks, documentId)

        // Ensure we send a final 100% progress event for indexing
        this.emit('processing-progress', {
          documentId,
          stage: 'indexing',
          progress: 100
        } as ProcessProgress)

        documents.push(document)
      } catch (error) {
        console.error(`Error processing document ${filePath}:`, error)
      }
    }

    return documents
  }

  private getContentType(filePath: string): string {
    const extension = path.extname(filePath).toLowerCase()
    switch (extension) {
      case '.pdf':
        return 'application/pdf'
      case '.txt':
        return 'text/plain'
      case '.md':
        return 'text/markdown'
      case '.docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      default:
        return 'application/octet-stream'
    }
  }

  private async loadAndChunkDocument(
    filePath: string,
    documentId: string
  ): Promise<LangChainDocument[]> {
    // Select the appropriate loader
    let loader
    const extension = path.extname(filePath).toLowerCase()

    switch (extension) {
      case '.pdf':
        loader = new PDFLoader(filePath)
        break
      case '.txt':
      case '.md':
        loader = new TextLoader(filePath)
        break
      case '.docx':
        loader = new DocxLoader(filePath)
        break
      default:
        throw new Error(`Unsupported file type: ${extension}`)
    }

    // Load document
    this.emit('processing-progress', {
      documentId,
      stage: 'loading',
      progress: 50,
      currentFile: path.basename(filePath)
    } as ProcessProgress)

    const rawDocuments = await loader.load()

    // Emit loading complete
    this.emit('processing-progress', {
      documentId,
      stage: 'loading',
      progress: 100,
      currentFile: path.basename(filePath)
    } as ProcessProgress)

    // Start splitting
    this.emit('processing-progress', {
      documentId,
      stage: 'splitting',
      progress: 0
    } as ProcessProgress)

    // Get chunk configuration
    const ragConfig = this.settings.getRagConfig()

    // Split document
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: ragConfig.chunkSize,
      chunkOverlap: ragConfig.chunkOverlap
    })

    const documents = await textSplitter.splitDocuments(rawDocuments)

    // Add source path to metadata
    documents.forEach((doc) => {
      doc.metadata.source = filePath
      doc.metadata.filename = path.basename(filePath)
    })

    // Emit splitting complete
    this.emit('processing-progress', {
      documentId,
      stage: 'splitting',
      progress: 100
    } as ProcessProgress)

    // Start indexing (progress will be reported by vectorstore)
    this.emit('processing-progress', {
      documentId,
      stage: 'indexing',
      progress: 0
    } as ProcessProgress)

    return documents
  }

  // Get documents with pagination for lazy loading
  async getDocuments(limit: number = 20, offset: number = 0): Promise<Document[]> {
    return this.db.getDocuments(limit, offset)
  }

  // Get total document count for pagination
  async getDocumentCount(): Promise<number> {
    return this.db.getDocumentCount()
  }

  async getDocumentById(id: string): Promise<Document | null> {
    return this.db.getDocumentById(id)
  }

  async deleteDocument(id: string): Promise<void> {
    // Delete from database
    this.db.deleteDocument(id)

    // Delete from vectorstore
    await this.vectorstore.removeDocuments(id)
  }
}
