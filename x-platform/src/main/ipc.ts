import { ipcMain, dialog, BrowserWindow } from 'electron'
import { DocumentService } from './services/document'
import { ChatService } from './services/chat'
import { SettingsService } from './services/settings'

export function setupIpcHandlers(
  documentService: DocumentService,
  chatService: ChatService,
  settingsService: SettingsService,
  mainWindow: BrowserWindow
) {
  // Document operations
  ipcMain.handle('documents:getAll', async () => {
    return await documentService.getAllDocuments()
  })

  ipcMain.handle('documents:getById', async (_event, id) => {
    return await documentService.getDocumentById(id)
  })

  ipcMain.handle('documents:process', async (_event, filePaths, tags) => {
    // Forward progress events to renderer
    documentService.on('processing-progress', (progress) => {
      mainWindow.webContents.send('document:processingProgress', progress)
    })

    const result = await documentService.processDocuments(filePaths, tags)
    return result
  })

  ipcMain.handle('documents:delete', async (_event, id) => {
    return await documentService.deleteDocument(id)
  })

  // Chat operations
  ipcMain.handle('chats:getAll', async () => {
    return await chatService.getAllChats()
  })

  ipcMain.handle('chats:create', async (_event, title) => {
    return await chatService.createChat(title)
  })

  ipcMain.handle('chats:getMessages', async (_event, chatId) => {
    return await chatService.getChatMessages(chatId)
  })

  ipcMain.handle('chats:sendQuery', async (_event, chatId, query, documentIds, config) => {
    const result = await chatService.sendQuery(chatId, query, documentIds, config)

    // Return both user and assistant messages for the frontend to update
    return {
      userMessage: {
        id: result.userMessageId,
        chat_id: chatId,
        role: 'user',
        content: query,
        created_at: new Date().toISOString()
      },
      assistantMessage: {
        id: result.assistantMessageId,
        chat_id: chatId,
        role: 'assistant',
        content: result.answer,
        created_at: new Date().toISOString(),
        citations: result.citations
      },
      usage: result.usage,
      model: result.model
    }
  })

  ipcMain.handle('chats:delete', async (_event, id) => {
    return await chatService.deleteChat(id)
  })

  // Settings operations
  ipcMain.handle('settings:getAll', async () => {
    return settingsService.getAllSettings()
  })

  ipcMain.handle('settings:update', async (_event, newSettings) => {
    if (newSettings.defaultModel) {
      await settingsService.setDefaultModel(newSettings.defaultModel)
    }

    if (newSettings.embeddingModel) {
      await settingsService.setEmbeddingModel(newSettings.embeddingModel.provider)
    }

    if (newSettings.ragConfig) {
      await settingsService.setRagConfig(newSettings.ragConfig)
    }

    return true
  })

  ipcMain.handle('settings:setApiKey', async (_event, provider, key) => {
    await settingsService.setApiKey(provider, key)
    return true
  })

  // Dialog operations
  ipcMain.handle('dialog:openFile', async (_event, options) => {
    const { filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Documents', extensions: ['pdf', 'txt', 'md', 'docx'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      ...options
    })
    return filePaths
  })
}
