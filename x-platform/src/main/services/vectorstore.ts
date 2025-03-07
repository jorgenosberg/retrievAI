import { ChromaClient, Collection } from 'chromadb';
import { app } from 'electron';
import { join } from 'path';
import fs from 'fs';
import { Document } from './db';

export interface EmbeddingModel {
  name: string;
  embed: (texts: string[]) => Promise<number[][]>;
  dimensions: number;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  text: string;
  metadata: {
    documentId: string;
    chunkIndex: number;
    source: string;
    [key: string]: any;
  };
}

class VectorStoreService {
  private client: ChromaClient;
  private collections: Map<string, Collection> = new Map();
  private embeddingModel: EmbeddingModel | null = null;
  private readonly persistDirectory: string;
  
  constructor() {
    const userDataPath = app.getPath('userData');
    this.persistDirectory = join(userDataPath, 'chromadb');
    
    // Ensure directory exists
    fs.mkdirSync(this.persistDirectory, { recursive: true });
    
    this.client = new ChromaClient({
      path: this.persistDirectory
    });
  }
  
  async setEmbeddingModel(model: EmbeddingModel): Promise<void> {
    this.embeddingModel = model;
  }
  
  async getOrCreateCollection(name: string): Promise<Collection> {
    if (this.collections.has(name)) {
      return this.collections.get(name)!;
    }
    
    const collection = await this.client.getOrCreateCollection({
      name,
      metadata: { 
        'hnsw:space': 'cosine'
      }
    });
    
    this.collections.set(name, collection);
    return collection;
  }
  
  async addDocumentChunks(collectionName: string, chunks: DocumentChunk[]): Promise<void> {
    if (!this.embeddingModel) {
      throw new Error('Embedding model not set');
    }
    
    const collection = await this.getOrCreateCollection(collectionName);
    
    // Group chunks into batches of 100 to avoid overloading the embedding model
    const batchSize = 100;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      
      const ids = batch.map(chunk => chunk.id);
      const texts = batch.map(chunk => chunk.text);
      const metadatas = batch.map(chunk => chunk.metadata);
      
      const embeddings = await this.embeddingModel.embed(texts);
      
      await collection.add({
        ids,
        embeddings,
        metadatas,
        documents: texts
      });
    }
  }
  
  async similaritySearch(
    collectionName: string,
    query: string,
    k: number = 5,
    filter?: { [key: string]: any }
  ): Promise<{
    documentChunks: DocumentChunk[];
    similarities: number[];
  }> {
    if (!this.embeddingModel) {
      throw new Error('Embedding model not set');
    }
    
    const collection = await this.getOrCreateCollection(collectionName);
    const queryEmbedding = await this.embeddingModel.embed([query]);
    
    const results = await collection.query({
      queryEmbeddings: queryEmbedding,
      nResults: k,
      where: filter
    });
    
    const documentChunks: DocumentChunk[] = [];
    
    if (results.ids[0] && results.documents && results.metadatas && results.distances) {
      for (let i = 0; i < results.ids[0].length; i++) {
        documentChunks.push({
          id: results.ids[0][i],
          documentId: results.metadatas![0][i].documentId,
          text: results.documents[0][i],
          metadata: results.metadatas![0][i]
        });
      }
      
      return {
        documentChunks,
        similarities: results.distances![0].map(d => 1 - d) // Convert distance to similarity
      };
    }
    
    return { documentChunks: [], similarities: [] };
  }
  
  async deleteDocumentChunks(collectionName: string, documentId: string): Promise<void> {
    const collection = await this.getOrCreateCollection(collectionName);
    
    await collection.delete({
      where: {
        documentId
      }
    });
  }
  
  async listCollections(): Promise<string[]> {
    const collections = await this.client.listCollections();
    return collections.map(c => c.name);
  }
}

const vectorStoreService = new VectorStoreService();
export default vectorStoreService;