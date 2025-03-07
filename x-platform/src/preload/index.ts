import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  // Document management
  uploadDocuments: (filePaths: string[], tags: string[]) => 
    ipcRenderer.invoke('document:upload', filePaths, tags),
  
  selectDocuments: () => 
    ipcRenderer.invoke('document:select'),
  
  getAllDocuments: () => 
    ipcRenderer.invoke('document:getAll'),
  
  deleteDocument: (documentId: string) => 
    ipcRenderer.invoke('document:delete', documentId),
  
  // Chat/RAG
  createChat: (title: string) => 
    ipcRenderer.invoke('chat:create', title),
  
  getAllChats: () => 
    ipcRenderer.invoke('chat:getAll'),
  
  getChatMessages: (chatId: string) => 
    ipcRenderer.invoke('chat:getMessages', chatId),
  
  sendQuery: (chatId: string, query: string, documentIds: string[], config: any = {}) => 
    ipcRenderer.invoke('chat:query', chatId, query, documentIds, config),
  
  // Settings
  setApiKey: (provider: string, apiKey: string) => 
    ipcRenderer.invoke('settings:setApiKey', provider, apiKey),
  
  getAvailableModels: () => 
    ipcRenderer.invoke('settings:getModel'),
  
  setDefaultModel: (modelConfig: any) => 
    ipcRenderer.invoke('settings:setModel', modelConfig),
  
  setEmbeddingModel: (provider: string) => 
    ipcRenderer.invoke('settings:setEmbeddingModel', provider)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
