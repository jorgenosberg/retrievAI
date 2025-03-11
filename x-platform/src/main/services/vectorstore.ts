/* eslint-disable @typescript-eslint/no-unused-vars */
import { Chroma } from '@langchain/community/vectorstores/chroma'
import { OpenAIEmbeddings } from '@langchain/openai'
import { HuggingFaceTransformersEmbeddings } from '@langchain/community/embeddings/huggingface_transformers'
import { Document as LangChainDocument } from '@langchain/core/documents'
import { SettingsService } from './settings'
import { EventEmitter } from 'events'
import path from 'path'
import fs from 'fs'

export class VectorstoreService extends EventEmitter {
  private vectorstore: Chroma | null = null
  private settings: SettingsService
  private storePath: string
  private initialized = false

  constructor(appDataPath: string, settings: SettingsService) {
    super()
    this.settings = settings
    this.storePath = path.join(appDataPath, 'vectorstore')

    // Ensure directory exists
    if (!fs.existsSync(this.storePath)) {
      fs.mkdirSync(this.storePath, { recursive: true })
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      await this.createVectorstore()
    } catch (error) {
      console.warn('Failed to initialize vectorstore, will initialize on demand:', error)
    }
    this.initialized = true
  }

  async createVectorstore(): Promise<void> {
    const embeddingConfig = this.settings.getEmbeddingModel()
    let embeddings

    if (embeddingConfig.provider === 'openai') {
      const apiKey = this.settings.getApiKey('openai')
      if (!apiKey) {
        console.warn(
          'OpenAI API key not found. Vectorstore will be initialized when API key is set.'
        )
        return
      }

      embeddings = new OpenAIEmbeddings({
        openAIApiKey: apiKey,
        modelName: embeddingConfig.model
      })
    } else {
      // HuggingFace embeddings
      embeddings = new HuggingFaceTransformersEmbeddings({
        model: embeddingConfig.model
      })
    }

    // Create or load existing Chroma store
    this.vectorstore = await Chroma.fromExistingCollection(embeddings, {
      collectionName: 'retrievai_documents',
      url: `file://${this.storePath}`
    })

    // If the collection doesn't exist yet, it will be created when adding documents
  }

  async addDocuments(documents: LangChainDocument[], documentId: string): Promise<void> {
    if (!this.vectorstore) {
      try {
        console.log(`Creating vectorstore for document ${documentId}`)
        await this.createVectorstore()
      } catch (error) {
        console.error('Failed to create vectorstore:', error)
        throw new Error(
          'Document processing requires API key configuration. Please go to Settings to configure API keys.'
        )
      }
    }

    if (!this.vectorstore) {
      throw new Error(
        'Document processing requires API key configuration. Please go to Settings to configure API keys.'
      )
    }

    console.log(`Adding ${documents.length} chunks for document ${documentId} to vectorstore`)

    // Add document ID as metadata to each chunk for retrieval
    const documentsWithMetadata = documents.map((doc) => {
      return new LangChainDocument({
        pageContent: doc.pageContent,
        metadata: {
          ...doc.metadata,
          document_id: documentId
        }
      })
    })

    // Report progress
    const totalChunks = documentsWithMetadata.length
    let processedChunks = 0

    console.log(`Processing ${totalChunks} chunks in batches for document ${documentId}`)

    // Process in batches of 10 for better performance and progress reporting
    const batchSize = 10
    for (let i = 0; i < documentsWithMetadata.length; i += batchSize) {
      const batch = documentsWithMetadata.slice(i, i + batchSize)
      await this.vectorstore.addDocuments(batch)

      processedChunks += batch.length
      const progress = Math.min(Math.round((processedChunks / totalChunks) * 100), 100)

      console.log(
        `Document ${documentId} indexing progress: ${progress}% (${processedChunks}/${totalChunks})`
      )

      this.emit('indexing-progress', {
        documentId,
        progress,
        processedChunks,
        totalChunks
      })
    }

    console.log(`Document ${documentId} indexing complete`)
    this.emit('indexing-complete', { documentId })
  }

  async removeDocuments(documentId: string): Promise<void> {
    if (!this.vectorstore) {
      try {
        await this.createVectorstore()
      } catch (error) {
        console.warn('Cannot remove documents from vectorstore, not initialized:', error)
        return
      }
    }

    if (!this.vectorstore) {
      console.warn('Cannot remove documents, vectorstore not initialized')
      return
    }

    // Filter by document ID in metadata
    await this.vectorstore.delete({
      filter: { document_id: documentId }
    })
  }

  async similaritySearch(
    query: string,
    documentIds: string[] = [],
    config?: { similarityThreshold?: number; maxSources?: number }
  ): Promise<LangChainDocument[]> {
    if (!this.vectorstore) {
      try {
        await this.createVectorstore()
      } catch (error) {
        console.error('Failed to create vectorstore for similarity search:', error)
        throw new Error(
          'Searching requires API key configuration. Please go to Settings to configure API keys.'
        )
      }
    }

    if (!this.vectorstore) {
      throw new Error(
        'Searching requires API key configuration. Please go to Settings to configure API keys.'
      )
    }

    const ragConfig = this.settings.getRagConfig()
    const similarityThreshold = config?.similarityThreshold ?? ragConfig.similarityThreshold
    const maxSources = config?.maxSources ?? ragConfig.maxSources

    let filter = {}

    // Filter by document IDs if provided
    if (documentIds.length > 0) {
      // For ChromaDB, we need to use the where filter properly
      // This ensures that only documents with matching IDs are returned
      filter = {
        document_id: { $in: documentIds }
      }

      console.log(`Filtering search by document IDs: ${documentIds.join(', ')}`)
    } else {
      console.log('No document filter applied, searching all documents')
    }

    // Get more results than needed to filter by score later
    const searchResults = await this.vectorstore.similaritySearchWithScore(
      query,
      maxSources * 2,
      filter
    )

    // Filter results by similarity threshold
    return searchResults
      .filter(([_, score]) => score >= similarityThreshold)
      .slice(0, maxSources)
      .map(([doc, _]) => doc)
  }
}
