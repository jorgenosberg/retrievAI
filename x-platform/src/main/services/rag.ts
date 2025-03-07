import databaseService, { Document, Citation } from './db';
import vectorStoreService, { DocumentChunk } from './vectorstore';
import llmService, { ModelConfig } from './llm';

export interface QueryResult {
  answer: string;
  citations: Citation[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  processTime: number;
  model: string;
}

export interface RAGConfig {
  topK: number;
  similarityThreshold: number;
  systemPrompt: string;
  modelConfig: Partial<ModelConfig>;
}

class RAGService {
  private defaultConfig: RAGConfig = {
    topK: 5,
    similarityThreshold: 0.7,
    systemPrompt: `You are RetrievAI, a helpful AI assistant that answers questions based on the provided context. 
When responding:
1. Only use information from the provided context
2. If the context doesn't contain the answer, say "I don't have enough information to answer that question"
3. Cite your sources using the citation numbers provided in the context [1], [2], etc.
4. Focus on providing accurate, helpful information
5. Keep your answers concise and to the point`,
    modelConfig: {}
  };
  
  async processQuery(
    query: string,
    documentIds: string[] = [],
    config: Partial<RAGConfig> = {}
  ): Promise<QueryResult> {
    const startTime = Date.now();
    const mergedConfig = { ...this.defaultConfig, ...config };
    
    try {
      // Get documents to search
      let documents: Document[] = [];
      if (documentIds.length > 0) {
        documents = databaseService.getDocumentsByIds(documentIds);
      } else {
        documents = databaseService.getDocuments();
      }
      
      if (documents.length === 0) {
        return this.generateSimpleResponse(
          "I don't have any documents to search. Please upload some documents first.",
          mergedConfig,
          startTime
        );
      }
      
      // Get relevant chunks for the query
      const relevantChunks = await this.getRelevantChunks(
        query,
        documents.map(doc => doc.id),
        mergedConfig.topK,
        mergedConfig.similarityThreshold
      );
      
      if (relevantChunks.chunks.length === 0) {
        return this.generateSimpleResponse(
          "I couldn't find any relevant information in the documents to answer your question.",
          mergedConfig,
          startTime
        );
      }
      
      // Generate prompt with context
      const prompt = this.generatePromptWithContext(query, relevantChunks.chunks);
      
      // Generate response using LLM
      const llmResponse = await llmService.generateResponse(prompt, mergedConfig.modelConfig);
      
      // Extract and create citations
      const citations = this.extractAndCreateCitations(llmResponse.content, relevantChunks.chunks);
      
      return {
        answer: llmResponse.content,
        citations,
        usage: llmResponse.usage,
        processTime: Date.now() - startTime,
        model: llmResponse.model
      };
    } catch (error) {
      console.error('RAG query processing error:', error);
      return this.generateSimpleResponse(
        `I encountered an error while processing your query: ${error.message}`,
        mergedConfig,
        startTime
      );
    }
  }
  
  private async getRelevantChunks(
    query: string,
    documentIds: string[],
    topK: number,
    similarityThreshold: number
  ): Promise<{
    chunks: Array<DocumentChunk & { index: number }>;
    similarities: number[];
  }> {
    // Create a filter based on documentIds if provided
    const filter = documentIds.length > 0 ? { 
      documentId: { $in: documentIds } 
    } : undefined;
    
    // Search for similar chunks
    const results = await vectorStoreService.similaritySearch(
      'documents',
      query,
      topK,
      filter
    );
    
    // Filter by similarity threshold and add index for citation
    const filteredChunks = results.documentChunks
      .map((chunk, index) => ({ ...chunk, index: index + 1 }))
      .filter((_, index) => results.similarities[index] >= similarityThreshold);
    
    const filteredSimilarities = results.similarities.filter(
      similarity => similarity >= similarityThreshold
    );
    
    return {
      chunks: filteredChunks,
      similarities: filteredSimilarities
    };
  }
  
  private generatePromptWithContext(query: string, chunks: Array<DocumentChunk & { index: number }>): string {
    const contextString = chunks
      .map(chunk => `[${chunk.index}] ${chunk.text}`)
      .join('\n\n');
    
    return `${this.defaultConfig.systemPrompt}

CONTEXT:
${contextString}

USER QUERY:
${query}`;
  }
  
  private extractAndCreateCitations(
    answer: string,
    chunks: Array<DocumentChunk & { index: number }>
  ): Citation[] {
    const citations: Citation[] = [];
    const citationRegex = /\[(\d+)\]/g;
    let match;
    
    // Find all citation references in the answer
    const referencedIndices = new Set<number>();
    while ((match = citationRegex.exec(answer)) !== null) {
      const index = parseInt(match[1], 10);
      if (!isNaN(index)) {
        referencedIndices.add(index);
      }
    }
    
    // Create citation objects for each referenced chunk
    for (const chunk of chunks) {
      if (referencedIndices.has(chunk.index)) {
        citations.push({
          id: crypto.randomUUID(),
          message_id: '', // This will be set later when the message is created
          document_id: chunk.documentId,
          text: chunk.text,
          confidence: 0.9 // This is a placeholder, would be calculated based on similarity
        });
      }
    }
    
    return citations;
  }
  
  private async generateSimpleResponse(
    message: string,
    config: RAGConfig,
    startTime: number
  ): Promise<QueryResult> {
    // Generate a simple response for cases where we can't do normal RAG
    return {
      answer: message,
      citations: [],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      },
      processTime: Date.now() - startTime,
      model: 'none'
    };
  }
}

const ragService = new RAGService();
export default ragService;