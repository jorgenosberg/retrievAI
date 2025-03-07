import Anthropic from '@anthropic-ai/sdk';
import { OpenAI } from 'openai';
import databaseService from './db';

export interface LLMResult {
  content: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
  processTime: number;
}

export type ModelType = 'anthropic' | 'openai';
export type AvailableModel = 
  | 'gpt-4o' 
  | 'gpt-3.5-turbo' 
  | 'claude-3-opus-20240229' 
  | 'claude-3-sonnet-20240229' 
  | 'claude-3-haiku-20240307';

export interface ModelConfig {
  provider: ModelType;
  model: AvailableModel;
  apiKey: string;
  temperature: number;
  maxTokens: number;
}

class LLMService {
  private anthropicClient: Anthropic | null = null;
  private openaiClient: OpenAI | null = null;
  private defaultConfig: ModelConfig = {
    provider: 'anthropic',
    model: 'claude-3-sonnet-20240229',
    apiKey: '',
    temperature: 0.7,
    maxTokens: 4000
  };
  
  constructor() {
    this.initializeFromSettings();
  }
  
  private async initializeFromSettings(): Promise<void> {
    try {
      const apiKeyAnthropicSetting = databaseService.getSetting('anthropic_api_key');
      const apiKeyOpenAISetting = databaseService.getSetting('openai_api_key');
      const defaultModelSetting = databaseService.getSetting('default_model');
      
      if (apiKeyAnthropicSetting) {
        this.anthropicClient = new Anthropic({
          apiKey: apiKeyAnthropicSetting
        });
        this.defaultConfig.apiKey = apiKeyAnthropicSetting;
      }
      
      if (apiKeyOpenAISetting) {
        this.openaiClient = new OpenAI({
          apiKey: apiKeyOpenAISetting
        });
        
        if (!apiKeyAnthropicSetting) {
          this.defaultConfig.provider = 'openai';
          this.defaultConfig.model = 'gpt-4o';
          this.defaultConfig.apiKey = apiKeyOpenAISetting;
        }
      }
      
      if (defaultModelSetting) {
        try {
          const modelConfig = JSON.parse(defaultModelSetting);
          this.defaultConfig = { ...this.defaultConfig, ...modelConfig };
        } catch (e) {
          console.error('Failed to parse default model config:', e);
        }
      }
    } catch (error) {
      console.error('Failed to initialize LLM service from settings:', error);
    }
  }
  
  async setAPIKey(provider: ModelType, apiKey: string): Promise<void> {
    if (provider === 'anthropic') {
      this.anthropicClient = new Anthropic({
        apiKey
      });
      databaseService.setSetting('anthropic_api_key', apiKey);
    } else if (provider === 'openai') {
      this.openaiClient = new OpenAI({
        apiKey
      });
      databaseService.setSetting('openai_api_key', apiKey);
    }
  }
  
  async setDefaultModel(config: Partial<ModelConfig>): Promise<void> {
    this.defaultConfig = { ...this.defaultConfig, ...config };
    databaseService.setSetting('default_model', JSON.stringify(this.defaultConfig));
  }
  
  getAvailableModels(): { provider: ModelType; models: AvailableModel[] }[] {
    const result = [];
    
    if (this.anthropicClient) {
      result.push({
        provider: 'anthropic',
        models: [
          'claude-3-opus-20240229',
          'claude-3-sonnet-20240229',
          'claude-3-haiku-20240307'
        ]
      });
    }
    
    if (this.openaiClient) {
      result.push({
        provider: 'openai',
        models: [
          'gpt-4o',
          'gpt-3.5-turbo'
        ]
      });
    }
    
    return result;
  }
  
  async generateResponse(
    prompt: string,
    config: Partial<ModelConfig> = {}
  ): Promise<LLMResult> {
    const mergedConfig = { ...this.defaultConfig, ...config };
    const startTime = Date.now();
    
    if (mergedConfig.provider === 'anthropic') {
      return this.generateWithAnthropic(prompt, mergedConfig, startTime);
    } else if (mergedConfig.provider === 'openai') {
      return this.generateWithOpenAI(prompt, mergedConfig, startTime);
    } else {
      throw new Error(`Unsupported provider: ${mergedConfig.provider}`);
    }
  }
  
  private async generateWithAnthropic(
    prompt: string,
    config: ModelConfig,
    startTime: number
  ): Promise<LLMResult> {
    if (!this.anthropicClient) {
      throw new Error('Anthropic client not initialized');
    }
    
    const response = await this.anthropicClient.messages.create({
      model: config.model as Anthropic.MessageParam['model'],
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      messages: [
        { role: 'user', content: prompt }
      ],
    });
    
    return {
      content: response.content[0].text,
      usage: {
        prompt_tokens: response.usage.input_tokens,
        completion_tokens: response.usage.output_tokens,
        total_tokens: response.usage.input_tokens + response.usage.output_tokens
      },
      model: config.model,
      processTime: Date.now() - startTime
    };
  }
  
  private async generateWithOpenAI(
    prompt: string,
    config: ModelConfig,
    startTime: number
  ): Promise<LLMResult> {
    if (!this.openaiClient) {
      throw new Error('OpenAI client not initialized');
    }
    
    const response = await this.openaiClient.chat.completions.create({
      model: config.model,
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      messages: [
        { role: 'user', content: prompt }
      ]
    });
    
    return {
      content: response.choices[0].message.content || '',
      usage: {
        prompt_tokens: response.usage?.prompt_tokens || 0,
        completion_tokens: response.usage?.completion_tokens || 0,
        total_tokens: response.usage?.total_tokens || 0
      },
      model: config.model,
      processTime: Date.now() - startTime
    };
  }
}

const llmService = new LLMService();
export default llmService;