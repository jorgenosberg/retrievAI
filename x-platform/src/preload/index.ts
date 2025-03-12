/* eslint-disable @typescript-eslint/no-explicit-any */
// preload.ts
import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Document operations with pagination
  documents: {
    // Paginated document loading
    getPage: (limit: number = 20, offset: number = 0) =>
      ipcRenderer.invoke('documents:getPage', limit, offset),
    getCount: () => ipcRenderer.invoke('documents:getCount'),
    getById: (id: string) => ipcRenderer.invoke('documents:getById', id),
    process: (filePaths: string[], tags: string[]) =>
      ipcRenderer.invoke('documents:process', filePaths, tags),
    delete: (id: string) => ipcRenderer.invoke('documents:delete', id),
    onProcessingProgress: (callback: (progress: any) => void) => {
      // Debounce the processing progress events to reduce UI updates
      let lastUpdate = 0
      let lastProgress = -1

      const listener = (_event: any, progress: any) => {
        const now = Date.now()
        // Only update UI max once per 250ms or if progress is 100% (complete)
        if (
          now - lastUpdate > 150 ||
          progress.progress === 100 ||
          progress.progress !== lastProgress
        ) {
          lastUpdate = now
          lastProgress = progress.progress
          callback(progress)
        }
      }

      ipcRenderer.on('document:processingProgress', listener)
      return () => {
        ipcRenderer.off('document:processingProgress', listener)
      }
    }
  },

  // Chat operations with pagination
  chats: {
    // Paginated chat loading
    getPage: (limit: number = 20, offset: number = 0) =>
      ipcRenderer.invoke('chats:getPage', limit, offset),
    getCount: () => ipcRenderer.invoke('chats:getCount'),
    create: (title: string) => ipcRenderer.invoke('chats:create', title),
    getMessages: (chatId: string) => ipcRenderer.invoke('chats:getMessages', chatId),
    sendQuery: (chatId: string, query: string, documentIds: string[], config: any = {}) =>
      ipcRenderer.invoke('chats:sendQuery', chatId, query, documentIds, config),
    sendQueryStreaming: (chatId: string, query: string, documentIds: string[], config: any = {}) =>
      ipcRenderer.invoke('chats:sendQueryStreaming', chatId, query, documentIds, config),
    onStreamChunk: (callback: (data: any) => void) => {
      const listener = (_event: any, data: any) => {
        callback(data)
      }
      ipcRenderer.on('chat:streamChunk', listener)
      return () => {
        ipcRenderer.off('chat:streamChunk', listener)
      }
    },
    onStreamComplete: (callback: (data: any) => void) => {
      const listener = (_event: any, data: any) => {
        callback(data)
      }
      ipcRenderer.on('chat:streamComplete', listener)
      return () => {
        ipcRenderer.off('chat:streamComplete', listener)
      }
    },
    onStreamError: (callback: (data: any) => void) => {
      const listener = (_event: any, data: any) => {
        callback(data)
      }
      ipcRenderer.on('chat:streamError', listener)
      return () => {
        ipcRenderer.off('chat:streamError', listener)
      }
    },
    delete: (id: string) => ipcRenderer.invoke('chats:delete', id)
  },

  // Settings operations
  settings: {
    getAll: () => ipcRenderer.invoke('settings:getAll'),
    getStreamingEnabled: () => ipcRenderer.invoke('settings:getStreamingEnabled'),
    update: (settings: any) => ipcRenderer.invoke('settings:update', settings),
    setApiKey: (provider: string, key: string) =>
      ipcRenderer.invoke('settings:setApiKey', provider, key)
  },

  // Dialog operations
  dialog: {
    openFileDialog: (options: any) => ipcRenderer.invoke('dialog:openFile', options)
  },

  app: {
    onReady: (callback: () => any) => {
      ipcRenderer.on('app:ready', callback)
      return () => {
        // Clean up the event listener when component unmounts
        ipcRenderer.off('app:ready', callback)
      }
    },
    onServicesReady: (callback: () => any) => {
      ipcRenderer.on('services:ready', callback)
      return () => {
        // Clean up the event listener when component unmounts
        ipcRenderer.off('services:ready', callback)
      }
    }
  }
})
