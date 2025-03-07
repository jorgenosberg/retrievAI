import { ipcMain, dialog } from 'electron';
import databaseService from './services/db';
import documentProcessorService from './services/document-processor';
import vectorStoreService from './services/vectorstore';
import embeddingsService from './services/embeddings';
import llmService from './services/llm';
import ragService from './services/rag';

export function setupIpcHandlers(): void {
  // Document management
  ipcMain.handle('document:upload', async (_, filePaths: string[], tags: string[]) => {
    try {
      const results = [];
      
      for (const filePath of filePaths) {
        const processedDoc = await documentProcessorService.processFile(filePath, tags);
        if (processedDoc) {
          // Save document to database
          const savedDoc = databaseService.addDocument({
            title: processedDoc.document.title,
            path: processedDoc.document.path,
            tags: processedDoc.document.tags
          });
          
          // Get the active embedding model
          const embeddingModel = embeddingsService.getActiveModel();
          if (!embeddingModel) {
            throw new Error('No embedding model available');
          }
          
          // Set the active embedding model
          await vectorStoreService.setEmbeddingModel(embeddingModel);
          
          // Add document chunks to vector store
          await vectorStoreService.addDocumentChunks('documents', processedDoc.chunks);
          
          results.push(savedDoc);
        }
      }
      
      return { success: true, documents: results };
    } catch (error) {
      console.error('Error uploading documents:', error);
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('document:select', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Documents', extensions: ['txt', 'md', 'pdf', 'docx'] }
      ]
    });
    
    if (canceled || filePaths.length === 0) {
      return { success: false, filePaths: [] };
    }
    
    return { success: true, filePaths };
  });
  
  ipcMain.handle('document:getAll', () => {
    const documents = databaseService.getDocuments();
    return { success: true, documents };
  });
  
  ipcMain.handle('document:delete', async (_, documentId: string) => {
    try {
      // Delete document chunks from vector store
      await vectorStoreService.deleteDocumentChunks('documents', documentId);
      
      // Delete document from database
      // Note: This would need to be implemented in db.ts
      // databaseService.deleteDocument(documentId);
      
      return { success: true };
    } catch (error) {
      console.error('Error deleting document:', error);
      return { success: false, error: error.message };
    }
  });
  
  // Chat/RAG
  ipcMain.handle('chat:query', async (_, chatId: string, query: string, documentIds: string[], config: any) => {
    try {
      // Process query using RAG
      const result = await ragService.processQuery(query, documentIds, config);
      
      // Add user message to chat
      const userMessage = databaseService.addMessage({
        role: 'user',
        content: query,
        chat_id: chatId
      });
      
      // Add assistant message to chat
      const assistantMessage = databaseService.addMessage({
        role: 'assistant',
        content: result.answer,
        chat_id: chatId
      });
      
      // Add citations for the assistant message
      const citations = result.citations.map(citation => ({
        ...citation,
        message_id: assistantMessage.id
      }));
      
      // Save citations
      const savedCitations = citations.map(citation => databaseService.addCitation(citation));
      
      return {
        success: true,
        result: {
          ...result,
          userMessageId: userMessage.id,
          assistantMessageId: assistantMessage.id,
          citations: savedCitations
        }
      };
    } catch (error) {
      console.error('Error processing chat query:', error);
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('chat:create', (_, title: string) => {
    try {
      const chat = databaseService.createChat(title);
      return { success: true, chat };
    } catch (error) {
      console.error('Error creating chat:', error);
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('chat:getAll', () => {
    try {
      const chats = databaseService.getChats();
      return { success: true, chats };
    } catch (error) {
      console.error('Error getting chats:', error);
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('chat:getMessages', (_, chatId: string) => {
    try {
      const messages = databaseService.getMessagesByChatId(chatId);
      
      // Get citations for assistant messages
      const messagesWithCitations = messages.map(message => {
        if (message.role === 'assistant') {
          const citations = databaseService.getCitationsByMessageId(message.id);
          return { ...message, citations };
        }
        return message;
      });
      
      return { success: true, messages: messagesWithCitations };
    } catch (error) {
      console.error('Error getting chat messages:', error);
      return { success: false, error: error.message };
    }
  });
  
  // Settings
  ipcMain.handle('settings:setApiKey', async (_, provider: string, apiKey: string) => {
    try {
      await llmService.setAPIKey(provider as any, apiKey);
      return { success: true };
    } catch (error) {
      console.error('Error setting API key:', error);
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('settings:getModel', () => {
    try {
      const models = llmService.getAvailableModels();
      return { success: true, models };
    } catch (error) {
      console.error('Error getting available models:', error);
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('settings:setModel', async (_, modelConfig: any) => {
    try {
      await llmService.setDefaultModel(modelConfig);
      return { success: true };
    } catch (error) {
      console.error('Error setting default model:', error);
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('settings:setEmbeddingModel', async (_, provider: string) => {
    try {
      if (provider === 'openai') {
        embeddingsService.setOpenAIEmbeddingModel();
      } else if (provider === 'anthropic') {
        embeddingsService.setAnthropicEmbeddingModel();
      } else {
        throw new Error(`Unsupported embedding model provider: ${provider}`);
      }
      
      // Update the vector store with the new embedding model
      const embeddingModel = embeddingsService.getActiveModel();
      if (embeddingModel) {
        await vectorStoreService.setEmbeddingModel(embeddingModel);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error setting embedding model:', error);
      return { success: false, error: error.message };
    }
  });
}