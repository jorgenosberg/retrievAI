import { DatabaseService, ChatMessage, Chat, Citation } from './database'
import { VectorstoreService } from './vectorstore'
import { SettingsService, ModelConfig } from './settings'
import { v4 as uuidv4 } from 'uuid'
import { ChatOpenAI } from '@langchain/openai'
import { ChatAnthropic } from '@langchain/anthropic'
import { RunnableSequence } from '@langchain/core/runnables'
import { StringOutputParser } from '@langchain/core/output_parsers'
import { Document as LangChainDocument } from '@langchain/core/documents'
import { PromptTemplate } from '@langchain/core/prompts'
import EventEmitter from 'events'

interface QueryResult {
  answer: string
  citations: Citation[]
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  processTime: number
  model: string
  userMessageId: string
  assistantMessageId: string
}

export class ChatService extends EventEmitter {
  private db: DatabaseService
  private vectorstore: VectorstoreService
  private settings: SettingsService

  constructor(db: DatabaseService, vectorstore: VectorstoreService, settings: SettingsService) {
    super()
    this.db = db
    this.vectorstore = vectorstore
    this.settings = settings
  }

  async createChat(title: string): Promise<Chat> {
    const now = new Date().toISOString()
    const chat: Chat = {
      id: uuidv4(),
      title,
      created_at: now,
      updated_at: now
    }

    this.db.createChat(chat)
    return chat
  }

  // Get chats with pagination
  async getChats(limit: number = 20, offset: number = 0): Promise<Chat[]> {
    return this.db.getChats(limit, offset)
  }

  // Get total chat count for pagination
  async getChatCount(): Promise<number> {
    return this.db.getChatCount()
  }

  async getChatMessages(chatId: string): Promise<ChatMessage[]> {
    return this.db.getMessagesByChatId(chatId)
  }

  async sendQuery(
    chatId: string,
    query: string,
    documentIds: string[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config: any = {}
  ): Promise<QueryResult> {
    const startTime = Date.now()

    // Create user message
    const userMessageId = uuidv4()
    const userMessage: ChatMessage = {
      id: userMessageId,
      chat_id: chatId,
      role: 'user',
      content: query,
      created_at: new Date().toISOString()
    }

    // Save user message
    this.db.addMessage(userMessage)

    try {
      // Get relevant documents from vectorstore
      const relevantDocs = await this.vectorstore.similaritySearch(query, documentIds, {
        similarityThreshold: config.similarityThreshold,
        maxSources: config.maxSources
      })

      // Create model instance
      const modelConfig = config.modelConfig || this.settings.getDefaultModel()
      const model = this.createModel(modelConfig)

      // Create prompt template
      const prompt = PromptTemplate.fromTemplate(`
        Answer the question based on the following context:
        
        Context:
        {context}
        
        Question: {question}
        
        Instructions:
        - Answer the question based only on the provided context
        - If the context doesn't contain relevant information, say "I don't have enough information to answer that"
        - Cite your sources with [number] format when providing information from the context (example: "According to the document [1], ...")
        - Each context piece is numbered - use the number when citing
        - IMPORTANT: Use numbered citations like [1], [2], etc. for each fact from the context
        - Keep citations accurate - only cite what's actually in the context
        - Be concise and direct in your answer
      `)

      // Create chain
      const chain = RunnableSequence.from([
        {
          // Format documents with numbers for better citation
          context: (input) => {
            return input.docs.map((doc, i) => `[${i + 1}] ${doc.pageContent}`).join('\n\n')
          },
          question: (input) => input.question
        },
        prompt,
        model,
        new StringOutputParser()
      ])

      // Execute chain
      const answer = await chain.invoke({
        docs: relevantDocs,
        question: query
      })

      // Extract citations from the answer and relevant docs
      const { formattedAnswer, citations } = this.extractCitations(answer, relevantDocs)

      // Create assistant message
      const assistantMessageId = uuidv4()
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        chat_id: chatId,
        role: 'assistant',
        content: formattedAnswer,
        created_at: new Date().toISOString(),
        citations: citations.map((citation) => ({
          ...citation,
          message_id: assistantMessageId
        }))
      }

      // Save assistant message
      this.db.addMessage(assistantMessage)

      // Calculate process time
      const processTime = Date.now() - startTime

      // Estimate token usage (rough approximation)
      const promptTokens =
        query.length / 4 +
        relevantDocs.reduce((sum, doc) => sum + doc.pageContent.length / 4, 0) +
        200 // Context and prompt template
      const completionTokens = formattedAnswer.length / 4

      return {
        answer: formattedAnswer,
        citations: citations,
        usage: {
          prompt_tokens: Math.ceil(promptTokens),
          completion_tokens: Math.ceil(completionTokens),
          total_tokens: Math.ceil(promptTokens + completionTokens)
        },
        processTime,
        model: modelConfig.model,
        userMessageId,
        assistantMessageId
      }
    } catch (error) {
      console.error('Error in RAG query:', error)

      // Create error message
      const assistantMessageId = uuidv4()
      const errorMessage: ChatMessage = {
        id: assistantMessageId,
        chat_id: chatId,
        role: 'assistant',
        content: `Error: ${(error as Error).message}`,
        created_at: new Date().toISOString()
      }

      // Save error message
      this.db.addMessage(errorMessage)

      throw error
    }
  }

  private createModel(config: ModelConfig) {
    const { provider, model, temperature = 0.7, maxTokens = 2000 } = config

    if (provider === 'openai') {
      const apiKey = this.settings.getApiKey('openai')
      if (!apiKey) {
        throw new Error('OpenAI API key not found')
      }

      return new ChatOpenAI({
        openAIApiKey: apiKey,
        modelName: model,
        temperature,
        maxTokens
      })
    } else if (provider === 'anthropic') {
      const apiKey = this.settings.getApiKey('anthropic')
      if (!apiKey) {
        throw new Error('Anthropic API key not found')
      }

      return new ChatAnthropic({
        anthropicApiKey: apiKey,
        modelName: model,
        temperature,
        maxTokens
      })
    } else {
      throw new Error(`Unsupported provider: ${provider}`)
    }
  }

  private extractCitations(
    answer: string,
    relevantDocs: LangChainDocument[]
  ): { formattedAnswer: string; citations: Citation[] } {
    const citationRegex = /\[(\d+)\]/g
    const matches = [...answer.matchAll(citationRegex)]
    const citations: Citation[] = []

    // Map to track which documents have been cited
    const citedDocuments = new Map<number, string>()

    // Extract citation numbers and replace with formatted citations
    for (const match of matches) {
      const citationNumber = parseInt(match[1])

      // Skip invalid citation numbers
      if (isNaN(citationNumber) || citationNumber < 1 || citationNumber > relevantDocs.length) {
        continue
      }

      // Get the document for this citation
      const docIndex = citationNumber - 1
      const document = relevantDocs[docIndex]

      // Extract document ID from metadata
      const documentId = document.metadata.document_id

      if (!documentId) {
        console.warn('Document without ID found in citation extraction', document.metadata)
        continue
      }

      // Add to cited documents map if not already present
      if (!citedDocuments.has(citationNumber)) {
        citedDocuments.set(citationNumber, documentId)

        // Create a citation
        citations.push({
          id: uuidv4(),
          message_id: '', // Will be filled later
          citation_number: citationNumber,
          document_id: documentId,
          document_title: document.metadata.title ?? document.metadata.filename,
          text: document.pageContent.substring(0, 200) + '...',
          confidence: document.metadata._distance ? 1 - document.metadata._distance : 0.9 // Use distance if available
        })
      }
    }

    // If no citations were found but we have relevant docs, add them as implicit citations
    if (citations.length === 0 && relevantDocs.length > 0) {
      for (const [i, doc] of relevantDocs.slice(0, 3).entries()) {
        // Limit to top 3 docs
        if (doc.metadata.document_id) {
          citations.push({
            id: uuidv4(),
            message_id: '', // Will be filled later
            citation_number: i + 1,
            document_id: doc.metadata.document_id,
            document_title: doc.metadata.title ?? doc.metadata.filename,
            text: doc.pageContent.substring(0, 200) + '...',
            confidence: doc.metadata._distance ? 1 - doc.metadata._distance : 0.8
          })
        }
      }
    }

    return {
      formattedAnswer: answer,
      citations
    }
  }

  async deleteChat(chatId: string): Promise<void> {
    this.db.deleteChat(chatId)
  }

  async sendQueryStreaming(
    chatId: string,
    query: string,
    documentIds: string[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config: any = {}
  ): Promise<{
    userMessageId: string
    assistantMessageId: string
    streamingComplete: Promise<QueryResult>
  }> {
    const startTime = Date.now()

    // Create user message
    const userMessageId = uuidv4()
    const userMessage: ChatMessage = {
      id: userMessageId,
      chat_id: chatId,
      role: 'user',
      content: query,
      created_at: new Date().toISOString()
    }

    // Create assistant message with empty content (will be updated during streaming)
    const assistantMessageId = uuidv4()
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      chat_id: chatId,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
      citations: []
    }

    // Save messages
    this.db.addMessage(userMessage)
    this.db.addMessage(assistantMessage)

    // eslint-disable-next-line no-async-promise-executor
    const streamingCompletePromise = new Promise<QueryResult>(async (resolve, reject) => {
      try {
        // Get relevant documents from vectorstore
        const relevantDocs = await this.vectorstore.similaritySearch(query, documentIds, {
          similarityThreshold: config.similarityThreshold,
          maxSources: config.maxSources
        })

        // Create model instance
        const modelConfig = config.modelConfig || this.settings.getDefaultModel()

        // Enable streaming in the model config
        modelConfig.streaming = true
        const model = this.createModel(modelConfig)

        // Create prompt template
        const prompt = PromptTemplate.fromTemplate(`
          Answer the question based on the following context:
          
          Context:
          {context}
          
          Question: {question}
          
          Instructions:
          - Answer the question based only on the provided context
          - If the context doesn't contain relevant information, say "I don't have enough information to answer that"
          - Cite your sources with [number] format when providing information from the context (example: "According to the document [1], ...")
          - Each context piece is numbered - use the number when citing
          - IMPORTANT: Use numbered citations like [1], [2], etc. for each fact from the context
          - Keep citations accurate - only cite what's actually in the context
          - Be concise and direct in your answer
        `)

        // Create chain
        const chain = RunnableSequence.from([
          {
            // Format documents with numbers for better citation
            context: (input) => {
              return input.docs.map((doc, i) => `[${i + 1}] ${doc.pageContent}`).join('\n\n')
            },
            question: (input) => input.question
          },
          prompt,
          model
        ])

        // Store complete response text
        let completeResponseText = ''

        // Execute chain with streaming
        const stream = await chain.stream({
          docs: relevantDocs,
          question: query
        })

        // Process stream
        for await (const chunk of stream) {
          if (chunk.content) {
            completeResponseText += chunk.content

            // Update the message in the database periodically (can be optimized to reduce DB writes)
            // For now, we'll emit an event with the new chunk for the frontend
            this.emit('streamChunk', {
              chatId,
              messageId: assistantMessageId,
              chunk: chunk.content
            })
          }
        }

        // Extract citations from the answer and relevant docs
        const { formattedAnswer, citations } = this.extractCitations(
          completeResponseText,
          relevantDocs
        )

        // Update assistant message with complete content and citations
        const updatedAssistantMessage: ChatMessage = {
          id: assistantMessageId,
          chat_id: chatId,
          role: 'assistant',
          content: formattedAnswer,
          created_at: new Date().toISOString(),
          citations: citations.map((citation) => ({
            ...citation,
            message_id: assistantMessageId
          }))
        }

        // Update the message in the database
        this.db.updateMessage(updatedAssistantMessage)

        // Calculate process time
        const processTime = Date.now() - startTime

        // Estimate token usage (rough approximation)
        const promptTokens =
          query.length / 4 +
          relevantDocs.reduce((sum, doc) => sum + doc.pageContent.length / 4, 0) +
          200 // Context and prompt template
        const completionTokens = formattedAnswer.length / 4

        // Emit a "streamComplete" event
        this.emit('streamComplete', {
          chatId,
          messageId: assistantMessageId,
          citations
        })

        // Resolve with the final result
        resolve({
          answer: formattedAnswer,
          citations,
          usage: {
            prompt_tokens: Math.ceil(promptTokens),
            completion_tokens: Math.ceil(completionTokens),
            total_tokens: Math.ceil(promptTokens + completionTokens)
          },
          processTime,
          model: modelConfig.model,
          userMessageId,
          assistantMessageId
        })
      } catch (error) {
        console.error('Error in streaming RAG query:', error)

        // Update assistant message with error
        const errorMessage: ChatMessage = {
          id: assistantMessageId,
          chat_id: chatId,
          role: 'assistant',
          content: `Error: ${(error as Error).message}`,
          created_at: new Date().toISOString()
        }

        // Save error message
        this.db.updateMessage(errorMessage)

        // Emit error event
        this.emit('streamError', {
          chatId,
          messageId: assistantMessageId,
          error: (error as Error).message
        })

        reject(error)
      }
    })

    return {
      userMessageId,
      assistantMessageId,
      streamingComplete: streamingCompletePromise
    }
  }
}
