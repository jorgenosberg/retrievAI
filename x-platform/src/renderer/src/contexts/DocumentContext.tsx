/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { createContext, useState, useContext, useCallback, ReactNode } from 'react'
import { Document } from '@/types'
import { DocumentContextType, UploadFileProgress } from './types'

// Create the context with a default undefined value
const DocumentContext = createContext<DocumentContextType | undefined>(undefined)

// Provider component
export const DocumentProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // State
  const [documents, setDocuments] = useState<Document[]>([])
  const [documentCount, setDocumentCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [isProcessingDocument, setIsProcessingDocument] = useState(false)
  const [processingProgress, setProcessingProgress] = useState<{
    documentId: string
    stage: 'loading' | 'splitting' | 'indexing'
    progress: number
    currentFile?: string
  } | null>(null)
  const [fileUploads, setFileUploads] = useState<Record<string, UploadFileProgress>>({})

  // Actions
  const loadDocuments = useCallback(async (page = 0, limit = 20) => {
    try {
      const offset = page * limit
      // Only load documents we need for the current page
      const [docs, count] = await Promise.all([
        window.electronAPI.documents.getPage(limit, offset),
        window.electronAPI.documents.getCount()
      ])

      setDocuments(docs)
      setDocumentCount(count)
      setCurrentPage(page)
      setPageSize(limit)

      return { documents: docs, count }
    } catch (error) {
      console.error('Failed to load documents:', error)
      return { documents: [], count: 0 }
    }
  }, [])

  // Load next page of documents
  const loadNextPage = useCallback(async () => {
    if (currentPage * pageSize + documents.length < documentCount) {
      return loadDocuments(currentPage + 1, pageSize)
    }
    return { documents, count: documentCount }
  }, [currentPage, pageSize, documents, documentCount, loadDocuments])

  // Load previous page of documents
  const loadPreviousPage = useCallback(async () => {
    if (currentPage > 0) {
      return loadDocuments(currentPage - 1, pageSize)
    }
    return { documents, count: documentCount }
  }, [currentPage, pageSize, documents, documentCount, loadDocuments])

  // Initialize file upload tracking
  const initializeUpload = useCallback(
    (files: Array<{ id: string; name: string; path: string }>) => {
      const fileIds: string[] = []

      setFileUploads((prevUploads) => {
        const newUploads = { ...prevUploads }

        files.forEach((file) => {
          fileIds.push(file.id)
          newUploads[file.id] = {
            fileId: file.id,
            fileName: file.name,
            filePath: file.path,
            progress: 0,
            stage: 'idle'
          }
        })

        return newUploads
      })

      return fileIds
    },
    []
  )

  // Clear all file uploads
  const clearFileUploads = useCallback(() => {
    setFileUploads({})
    return true
  }, [])

  // Remove a single file upload
  const removeFileUpload = useCallback((fileId: string) => {
    setFileUploads((prevUploads) => {
      const newUploads = { ...prevUploads }
      delete newUploads[fileId]
      return newUploads
    })
    return true
  }, [])

  // Upload documents to the backend
  const uploadDocuments = useCallback(
    async (fileIds: string[], tags: string[]) => {
      setIsProcessingDocument(true)

      try {
        // Get file paths from the upload tracking state
        const filePaths = fileIds.map((id) => {
          const fileUpload = fileUploads[id]
          if (!fileUpload) throw new Error(`File ${id} not found in uploads`)
          return fileUpload.filePath
        })

        // Update file statuses to loading
        setFileUploads((prevUploads) => {
          const newUploads = { ...prevUploads }
          fileIds.forEach((id) => {
            newUploads[id] = {
              ...newUploads[id],
              stage: 'loading',
              progress: 10
            }
          })
          return newUploads
        })

        // Register for progress updates
        window.electronAPI.documents.onProcessingProgress((event: any) => {
          const { documentId, stage, progress, currentFile } = event

          setProcessingProgress({
            documentId,
            stage,
            progress,
            currentFile
          })

          // Update individual file progress if we can match the file
          setFileUploads((prevUploads) => {
            const newUploads = { ...prevUploads }

            // Find the file by documentId first (more reliable) or by path
            Object.keys(newUploads).forEach((fileId) => {
              const upload = newUploads[fileId]
              if (
                (documentId && upload.documentId === documentId) ||
                (currentFile && upload.filePath === currentFile)
              ) {
                newUploads[fileId] = {
                  ...upload,
                  stage,
                  progress: progress, // Use the actual progress value
                  documentId: documentId || upload.documentId
                }
              }
            })

            return newUploads
          })
        })

        // Send the files for processing
        const results = await window.electronAPI.documents.process(filePaths, tags)

        // Update file statuses to complete
        setFileUploads((prevUploads) => {
          const newUploads = { ...prevUploads }
          fileIds.forEach((id, index) => {
            const result = results[index]
            newUploads[id] = {
              ...newUploads[id],
              stage: 'complete',
              progress: 100,
              documentId: result.id
            }
          })
          return newUploads
        })

        // Add the new documents to the state
        setDocuments((prevDocs) => [...results, ...prevDocs])
        setDocumentCount((prevCount) => prevCount + results.length)

        return results
      } catch (error) {
        console.error('Failed to upload documents:', error)

        // Update file statuses to error
        setFileUploads((prevUploads) => {
          const newUploads = { ...prevUploads }
          fileIds.forEach((id) => {
            newUploads[id] = {
              ...newUploads[id],
              stage: 'error',
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          })
          return newUploads
        })

        return undefined
      } finally {
        setIsProcessingDocument(false)
        setProcessingProgress(null)
      }
    },
    [fileUploads]
  )

  // Delete a document
  const deleteDocument = useCallback(async (id: string) => {
    try {
      await window.electronAPI.documents.delete(id)

      // Remove from local state
      setDocuments((prev) => prev.filter((doc) => doc.id !== id))
      setDocumentCount((prev) => prev - 1)
    } catch (error) {
      console.error(`Failed to delete document ${id}:`, error)
      throw error
    }
  }, [])

  // Combine state and actions
  const contextValue: DocumentContextType = {
    documents,
    documentCount,
    currentPage,
    pageSize,
    isProcessingDocument,
    processingProgress,
    fileUploads,
    loadDocuments,
    loadNextPage,
    loadPreviousPage,
    initializeUpload,
    clearFileUploads,
    removeFileUpload,
    uploadDocuments,
    deleteDocument
  }

  return <DocumentContext.Provider value={contextValue}>{children}</DocumentContext.Provider>
}

// Custom hook to use the context
export const useDocumentContext = () => {
  const context = useContext(DocumentContext)
  if (context === undefined) {
    throw new Error('useDocumentContext must be used within a DocumentProvider')
  }
  return context
}
