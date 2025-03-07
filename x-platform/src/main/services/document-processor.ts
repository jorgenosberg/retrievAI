import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Document } from './db';
import { DocumentChunk } from './vectorstore';

export interface ProcessedDocument {
  document: Document;
  chunks: DocumentChunk[];
}

class DocumentProcessorService {
  private supportedExtensions = ['.txt', '.md', '.pdf', '.docx'];
  
  async processFile(filePath: string, tags: string[] = []): Promise<ProcessedDocument | null> {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }
    
    // Check if extension is supported
    const extension = path.extname(filePath).toLowerCase();
    if (!this.supportedExtensions.includes(extension)) {
      throw new Error(`Unsupported file extension: ${extension}`);
    }
    
    try {
      // Extract text based on file type
      const text = await this.extractText(filePath, extension);
      if (!text) {
        throw new Error(`Failed to extract text from ${filePath}`);
      }
      
      // Create document metadata
      const fileName = path.basename(filePath);
      const document: Document = {
        id: crypto.randomUUID(),
        title: fileName,
        path: filePath,
        tags,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      // Create chunks from text
      const chunks = this.createChunks(document, text);
      
      return {
        document,
        chunks
      };
    } catch (error) {
      console.error(`Error processing file ${filePath}:`, error);
      return null;
    }
  }
  
  private async extractText(filePath: string, extension: string): Promise<string> {
    // For now, we'll just implement basic text and markdown extraction
    // In a real implementation, you'd add PDF and DOCX parsing libraries
    
    if (extension === '.txt' || extension === '.md') {
      return fs.readFileSync(filePath, 'utf-8');
    }
    
    if (extension === '.pdf') {
      // Placeholder for PDF extraction
      // In a real implementation, you'd use a library like pdf-parse
      throw new Error('PDF parsing not yet implemented');
    }
    
    if (extension === '.docx') {
      // Placeholder for DOCX extraction
      // In a real implementation, you'd use a library like mammoth
      throw new Error('DOCX parsing not yet implemented');
    }
    
    throw new Error(`Unsupported file extension: ${extension}`);
  }
  
  private createChunks(document: Document, text: string): DocumentChunk[] {
    // Configure chunking parameters
    const chunkSize = 1000; // Approximately 1000 characters per chunk
    const chunkOverlap = 200; // 200 characters overlap between chunks
    
    const chunks: DocumentChunk[] = [];
    const paragraphs = text.split(/\n\s*\n/); // Split by blank lines
    
    let currentChunk = '';
    let chunkIndex = 0;
    
    for (const paragraph of paragraphs) {
      // Skip empty paragraphs
      if (!paragraph.trim()) continue;
      
      // If adding this paragraph would exceed chunk size, create a new chunk
      if (currentChunk.length + paragraph.length > chunkSize && currentChunk.length > 0) {
        chunks.push(this.createChunk(document.id, currentChunk, chunkIndex));
        
        // Start new chunk with overlap from previous chunk
        const overlapText = currentChunk.slice(-chunkOverlap);
        currentChunk = overlapText + paragraph;
        chunkIndex++;
      } else {
        // Add paragraph to current chunk
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      }
    }
    
    // Add the last chunk if it's not empty
    if (currentChunk.trim()) {
      chunks.push(this.createChunk(document.id, currentChunk, chunkIndex));
    }
    
    return chunks;
  }
  
  private createChunk(documentId: string, text: string, chunkIndex: number): DocumentChunk {
    return {
      id: `${documentId}_chunk_${chunkIndex}`,
      documentId,
      text,
      metadata: {
        documentId,
        chunkIndex,
        source: 'document_processor',
        textLength: text.length,
        chunkIndex
      }
    };
  }
}

const documentProcessorService = new DocumentProcessorService();
export default documentProcessorService;