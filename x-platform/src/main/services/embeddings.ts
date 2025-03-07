import Anthropic from '@anthropic-ai/sdk';
import { OpenAI } from 'openai';
import databaseService from './db';
import { EmbeddingModel } from './vectorstore';

class EmbeddingsService {
  private anthropicClient: Anthropic | null = null;
  private openaiClient: OpenAI | null = null;
  private activeModel: EmbeddingModel | null = null;
  
  constructor() {
    this.initializeFromSettings();
  }
  
  private async initializeFromSettings(): Promise<void> {
    try {
      const apiKeyAnthropicSetting = databaseService.getSetting('anthropic_api_key');
      const apiKeyOpenAISetting = databaseService.getSetting('openai_api_key');
      const embeddingModelSetting = databaseService.getSetting('embedding_model');
      
      if (apiKeyAnthropicSetting) {
        this.anthropicClient = new Anthropic({
          apiKey: apiKeyAnthropicSetting
        });
      }
      
      if (apiKeyOpenAISetting) {
        this.openaiClient = new OpenAI({
          apiKey: apiKeyOpenAISetting
        });
      }
      
      // Set default embedding model
      if (this.openaiClient) {
        this.setOpenAIEmbeddingModel();
      } else if (this.anthropicClient) {
        this.setAnthropicEmbeddingModel();
      }
      
      // Override with user preference if set
      if (embeddingModelSetting) {
        const model = embeddingModelSetting.toLowerCase();
        if (model === 'openai' && this.openaiClient) {
          this.setOpenAIEmbeddingModel();
        } else if (model === 'anthropic' && this.anthropicClient) {
          this.setAnthropicEmbeddingModel();
        }
      }
    } catch (error) {
      console.error('Failed to initialize embeddings service:', error);
    }
  }
  
  getActiveModel(): EmbeddingModel | null {
    return this.activeModel;
  }
  
  setOpenAIEmbeddingModel(): void {
    if (!this.openaiClient) {
      throw new Error('OpenAI client not initialized');
    }
    
    this.activeModel = {
      name: 'openai:text-embedding-3-small',
      dimensions: 1536,
      embed: async (texts: string[]): Promise<number[][]> => {
        const response = await this.openaiClient!.embeddings.create({
          model: 'text-embedding-3-small',
          input: texts
        });
        
        return response.data.map(item => item.embedding);
      }
    };
    
    databaseService.setSetting('embedding_model', 'openai');
  }
  
  setAnthropicEmbeddingModel(): void {
    if (!this.anthropicClient) {
      throw new Error('Anthropic client not initialized');
    }
    
    this.activeModel = {
      name: 'anthropic:claude-3',
      dimensions: 1536,
      embed: async (texts: string[]): Promise<number[][]> => {
        // Process texts in batches since Anthropic API accepts one text at a time
        const embeddings: number[][] = [];
        
        for (const text of texts) {
          const response = await this.anthropicClient!.embeddings.create({
            model: 'claude-3-sonnet-20240229',
            input: text
          });
          
          embeddings.push(response.embedding);
        }
        
        return embeddings;
      }
    };
    
    databaseService.setSetting('embedding_model', 'anthropic');
  }
}

const embeddingsService = new EmbeddingsService();
export default embeddingsService;