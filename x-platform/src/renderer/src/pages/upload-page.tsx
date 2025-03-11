import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, File, X, UploadCloud, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Card } from '@/components/ui/card'
import { useDocumentContext } from '@/contexts'
import { toast } from 'sonner'

// Add a custom interface for Electron file objects
interface ElectronFile {
  name: string
  type: string
  path: string
  size: number
  lastModified: number
}

const UploadPage = () => {
  const [isDragging, setIsDragging] = useState(false)
  const navigate = useNavigate()

  // Use this to prevent multiple redirects
  const hasRedirectedRef = useRef(false)

  // Use the document context for document-related state
  const {
    uploadDocuments,
    isProcessingDocument,
    fileUploads,
    initializeUpload,
    clearFileUploads,
    removeFileUpload
  } = useDocumentContext()

  // Track the processing state to detect changes
  const prevProcessingRef = useRef(isProcessingDocument)

  // Calculate summary stats from fileUploads
  const { pendingCount, successCount, errorCount, totalCount } = useMemo(() => {
    const uploads = Object.values(fileUploads)
    return {
      pendingCount: uploads.filter((f) => f.stage === 'idle').length,
      successCount: uploads.filter((f) => f.stage === 'complete').length,
      errorCount: uploads.filter((f) => f.stage === 'error').length,
      totalCount: uploads.length
    }
  }, [fileUploads])

  // Use a separate effect to handle changes in the processing state for navigation
  useEffect(() => {
    // Only run when processing changes from true to false (just completed)
    if (prevProcessingRef.current && !isProcessingDocument) {
      // Update the ref for next time
      prevProcessingRef.current = isProcessingDocument

      // Only show success message and redirect if we have any successful files
      if (successCount > 0 && !hasRedirectedRef.current) {
        hasRedirectedRef.current = true

        // Show appropriate toast based on outcome
        if (errorCount > 0) {
          toast.info(`Processed ${successCount} of ${totalCount} files.`)
        } else {
          toast.success(`Successfully processed ${successCount} files.`)
        }

        // Redirect to library after successful uploads
        setTimeout(() => navigate('/library'), 1500)
      }
    } else {
      // Just update the ref without any other actions
      prevProcessingRef.current = isProcessingDocument
    }
  }, [isProcessingDocument, navigate, successCount, errorCount, totalCount])

  // Determine if a file is supported based on extension or MIME type
  const isFileSupported = useCallback((file: File | ElectronFile): boolean => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/markdown'
    ]

    const allowedExtensions = ['pdf', 'docx', 'txt', 'md']

    // Check MIME type first
    if (allowedTypes.includes(file.type)) {
      return true
    }

    // If MIME type check fails, check extension
    const name = file.name
    const extension = name.split('.').pop()?.toLowerCase() || ''

    return allowedExtensions.includes(extension)
  }, [])

  // Helper to get MIME type from extension
  const getMimeTypeFromExtension = useCallback((filename: string): string => {
    const extension = filename.split('.').pop()?.toLowerCase() || ''

    switch (extension) {
      case 'pdf':
        return 'application/pdf'
      case 'docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      case 'md':
        return 'text/markdown'
      case 'txt':
      default:
        return 'text/plain'
    }
  }, [])

  const handleFileSelect = useCallback(
    (selectedFiles: (File | ElectronFile)[]) => {
      // Filter out unsupported files
      const supportedFiles = selectedFiles.filter(isFileSupported)

      if (selectedFiles.length !== supportedFiles.length) {
        toast.error('Only PDF, DOCX, TXT and MD files are supported.')
      }

      if (supportedFiles.length === 0) return

      // Convert to format needed for store
      const filesForStore = supportedFiles.map((file) => ({
        id: Math.random().toString(36).substring(2),
        name: file.name,
        path: 'path' in file ? file.path : '' // Empty string for browser File objects
      }))

      // Add to store and get IDs back
      initializeUpload(filesForStore)
    },
    [isFileSupported, initializeUpload]
  )

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragging(false)

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        // Convert the FileList to an array of File objects
        const droppedFiles = Array.from(e.dataTransfer.files)
        handleFileSelect(droppedFiles)
      }
    },
    [handleFileSelect]
  )

  const handleBrowseFiles = useCallback(async () => {
    try {
      // Use Electron's dialog through our preload API
      const filePaths = await window.electronAPI.dialog.openFileDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Documents', extensions: ['pdf', 'docx', 'txt', 'md'] }]
      })

      if (filePaths && filePaths.length > 0) {
        // Create ElectronFile objects from the file paths
        const selectedFiles = filePaths.map((filePath: string): ElectronFile => {
          const name = filePath.split('/').pop() || filePath.split('\\').pop() || filePath

          return {
            name,
            type: getMimeTypeFromExtension(name),
            path: filePath,
            size: 0, // Size will be determined by the backend
            lastModified: Date.now()
          }
        })

        handleFileSelect(selectedFiles)
      }
    } catch (error) {
      console.error('Error selecting files:', error)
      toast.error('Failed to select files')
    }
  }, [handleFileSelect, getMimeTypeFromExtension])

  // Use a ref to track if an upload is in progress to prevent multiple clicks
  const isUploadingRef = useRef(false)

  const handleUpload = useCallback(async () => {
    // Prevent multiple uploads
    if (isUploadingRef.current || isProcessingDocument) {
      return
    }

    try {
      isUploadingRef.current = true

      // Get all pending file IDs (with stage = idle)
      const pendingFileIds = Object.keys(fileUploads).filter(
        (id) => fileUploads[id].stage === 'idle'
      )

      if (pendingFileIds.length === 0) {
        toast.warning('Please select at least one file to upload.')
        return
      }

      // Process all documents at once - the store will handle progress updates
      const tags: string[] = [] // In a real app, get from user input

      try {
        // This uses our enhanced store method that tracks progress per file
        await uploadDocuments(pendingFileIds, tags)
        console.log('Upload completed')
      } catch (error) {
        console.error('Error during document upload:', error)
        toast.error('Failed to upload documents')
      }
    } finally {
      isUploadingRef.current = false
    }
  }, [fileUploads, uploadDocuments, isProcessingDocument])

  const handleClearFiles = useCallback(() => {
    // The store handles preventing clearing during processing
    const success = clearFileUploads()

    if (!success) {
      toast.warning('Cannot clear files while processing is in progress.')
    }
  }, [clearFileUploads])

  const handleRemoveFile = useCallback(
    (id: string) => {
      const success = removeFileUpload(id)

      if (!success) {
        toast.warning('Cannot remove a file that is currently being processed.')
      }
    },
    [removeFileUpload]
  )

  // Get stage display text
  const getStageText = useCallback((stage: string) => {
    switch (stage) {
      case 'idle':
        return 'Ready'
      case 'loading':
        return 'Loading'
      case 'splitting':
        return 'Splitting Text'
      case 'indexing':
        return 'Indexing'
      case 'complete':
        return 'Complete'
      case 'error':
        return 'Error'
      default:
        return stage
    }
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Upload Documents</h1>
      </div>

      <div
        className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/20 hover:border-primary/50'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <motion.div
          className="flex flex-col items-center justify-center gap-4"
          initial={{ scale: 0.9 }}
          animate={{ scale: isDragging ? 1.05 : 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 15 }}
        >
          <div className="bg-primary/10 p-4 rounded-full">
            <UploadCloud className="h-12 w-12 text-primary" />
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-medium">
              {isDragging ? 'Drop files here' : 'Drag & drop files'}
            </h3>
            <p className="text-sm text-muted-foreground">
              or{' '}
              <Button variant="link" className="p-0" onClick={handleBrowseFiles}>
                browse files
              </Button>
            </p>
            <p className="text-xs text-muted-foreground">Supports PDF, DOCX, TXT, and MD files</p>
          </div>
        </motion.div>
      </div>

      {/* File list */}
      {Object.keys(fileUploads).length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold">Selected Files</h2>
              {isProcessingDocument && (
                <div className="flex items-center text-primary gap-1 text-sm bg-primary/5 px-2 py-1 rounded">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                  Processing
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFiles}
              disabled={isProcessingDocument}
            >
              Clear all
            </Button>
          </div>

          <AnimatePresence>
            {Object.entries(fileUploads).map(([fileId, fileData]) => (
              <motion.div
                key={fileId}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <File className="h-8 w-8 text-muted-foreground" />
                      <div>
                        <p className="font-medium truncate max-w-md">{fileData.fileName}</p>
                        <p className="text-xs text-muted-foreground">
                          {fileData.filePath || 'Unknown path'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {fileData.stage === 'complete' && (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      )}
                      {fileData.stage === 'error' && (
                        <AlertCircle className="h-5 w-5 text-red-500" />
                      )}

                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={
                          fileData.stage === 'loading' ||
                          fileData.stage === 'splitting' ||
                          fileData.stage === 'indexing'
                        }
                        onClick={() => handleRemoveFile(fileId)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {fileData.stage !== 'idle' && fileData.stage !== 'error' && (
                    <div className="mt-2">
                      <Progress value={fileData.progress} className="h-2" />
                      <div className="flex justify-between">
                        <p className="text-xs text-muted-foreground mt-1">
                          {fileData.stage !== 'complete'
                            ? `Processing: ${Math.round(fileData.progress)}%`
                            : 'Complete'}
                        </p>
                        {fileData.stage !== 'complete' && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {getStageText(fileData.stage)}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {fileData.stage === 'error' && (
                    <p className="text-xs text-red-500 mt-1">{fileData.error || 'Upload failed'}</p>
                  )}
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>

          <div className="flex justify-end">
            <Button onClick={handleUpload} disabled={pendingCount === 0 || isProcessingDocument}>
              {isProcessingDocument ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload {pendingCount > 0 ? `(${pendingCount})` : 'Files'}
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </motion.div>
  )
}

export default UploadPage
