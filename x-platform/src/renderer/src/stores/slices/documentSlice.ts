import { DocumentSliceCreator } from '../types'

export const createDocumentSlice: DocumentSliceCreator = (set, get) => ({
  // Initial state
  documents: [],
  isProcessingDocument: false,
  processingProgress: null,

  // Document actions
  loadDocuments: async () => {
    try {
      const documents = await window.electronAPI.documents.getAll()
      set({ documents })
    } catch (error) {
      console.error('Failed to load documents:', error)
    }
  },

  uploadDocuments: async (filePaths, tags) => {
    try {
      set({ isProcessingDocument: true })

      window.electronAPI.documents.onProcessingProgress((progress) => {
        // Only update state when progress changes significantly (reduce rerenders)
        const currentProgress = get().processingProgress
        if (
          !currentProgress ||
          currentProgress.stage !== progress.stage ||
          progress.progress - currentProgress.progress >= 0.05
        ) {
          set({ processingProgress: progress })
        }
      })

      // Start processing
      const newDocuments = await window.electronAPI.documents.process(filePaths, tags)

      set((state) => ({
        documents: [...state.documents, ...newDocuments],
        isProcessingDocument: false,
        processingProgress: null
      }))

      return newDocuments
    } catch (error) {
      console.error('Failed to upload documents:', error)
      set({ isProcessingDocument: false, processingProgress: null })
      return undefined
    }
  },

  deleteDocument: async (id) => {
    try {
      await window.electronAPI.documents.delete(id)
      set((state) => ({
        documents: state.documents.filter((doc) => doc.id !== id)
      }))
    } catch (error) {
      console.error('Failed to delete document:', error)
    }
  }
})
