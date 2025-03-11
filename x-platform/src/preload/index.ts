/* eslint-disable @typescript-eslint/no-explicit-any */
// preload.ts
import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Document operations
  documents: {
    getAll: () => ipcRenderer.invoke('documents:getAll'),
    getById: (id: string) => ipcRenderer.invoke('documents:getById', id),
    process: (filePaths: string[], tags: string[]) =>
      ipcRenderer.invoke('documents:process', filePaths, tags),
    delete: (id: string) => ipcRenderer.invoke('documents:delete', id),
    onProcessingProgress: (callback: (progress: any) => void) => {
      const listener = (_event: any, progress: any) => callback(progress)
      ipcRenderer.on('document:processingProgress', listener)
      return () => {
        ipcRenderer.removeListener('document:processingProgress', listener)
      }
    }
  },

  // Chat operations
  chats: {
    getAll: () => ipcRenderer.invoke('chats:getAll'),
    create: (title: string) => ipcRenderer.invoke('chats:create', title),
    getMessages: (chatId: string) => ipcRenderer.invoke('chats:getMessages', chatId),
    sendQuery: (chatId: string, query: string, documentIds: string[], config: any = {}) =>
      ipcRenderer.invoke('chats:sendQuery', chatId, query, documentIds, config),
    delete: (id: string) => ipcRenderer.invoke('chats:delete', id)
  },

  // Settings operations
  settings: {
    getAll: () => ipcRenderer.invoke('settings:getAll'),
    update: (settings: any) => ipcRenderer.invoke('settings:update', settings),
    setApiKey: (provider: string, key: string) =>
      ipcRenderer.invoke('settings:setApiKey', provider, key)
  },

  // Dialog operations
  dialog: {
    openFileDialog: (options: any) => ipcRenderer.invoke('dialog:openFile', options)
  },

  app: {
    onReady: (callback: () => any) => ipcRenderer.on('app:ready', callback)
  }
})
