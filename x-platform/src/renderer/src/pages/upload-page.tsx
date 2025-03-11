import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, File, X, UploadCloud, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Card } from '@/components/ui/card'
import useStore from '@/stores/appStore'
import { toast } from 'sonner'

// Add a custom interface for Electron file objects
interface ElectronFile {
  name: string
  type: string
  path: string
  size: number
  lastModified: number
}

// Define our UI file type
interface UIFile {
  id: string
  file: ElectronFile | File
  documentId?: string
  progress: number
  status: 'idle' | 'uploading' | 'success' | 'error'
  error?: string
}

const UploadPage = () => {
  const [files, setFiles] = useState<UIFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const navigate = useNavigate()
  const progressListenerCleanupRef = useRef<(() => void) | null>(null)

  // Use the Zustand store
  const { uploadDocuments, processingProgress, isProcessingDocument } = useStore((state) => ({
    uploadDocuments: state.uploadDocuments,
    processingProgress: state.processingProgress,
    isProcessingDocument: state.isProcessingDocument
  }))

  // Clean up progress listener when component unmounts
  useEffect(() => {
    return () => {
      if (progressListenerCleanupRef.current) {
        progressListenerCleanupRef.current()
        progressListenerCleanupRef.current = null
      }
    }
  }, [])

  // Calculate and update file progress based on Zustand store's processing progress
  useEffect(() => {
    if (!processingProgress) return

    setFiles((prevFiles) => {
      return prevFiles.map((file) => {
        // Match either by documentId or if we're still in loading stage
        if (file.documentId && file.documentId === processingProgress.documentId) {
          // Calculate overall progress based on stage
          let progress = 0
          if (processingProgress.stage === 'loading') {
            progress = processingProgress.progress * 0.2 // Loading = 0-20%
          } else if (processingProgress.stage === 'splitting') {
            progress = 20 + processingProgress.progress * 0.3 // Splitting = 20-50%
          } else if (processingProgress.stage === 'indexing') {
            progress = 50 + processingProgress.progress * 0.5 // Indexing = 50-100%
          }

          const updatedProgress = Math.round(progress)
          // If progress reaches 100%, mark as success
          const updatedStatus = updatedProgress >= 100 ? 'success' : file.status

          return {
            ...file,
            progress: updatedProgress,
            status: updatedStatus
          }
        } else if (
          processingProgress.documentId === 'loading' &&
          file.status === 'uploading' &&
          processingProgress.currentFile === file.file.name
        ) {
          // Handle loading stage for files without document ID yet
          const progress = Math.round(processingProgress.progress * 0.2) // Loading = 0-20%

          return {
            ...file,
            progress
          }
        }
        return file
      })
    })
  }, [processingProgress])

  // Check completion status when processing state changes
  useEffect(() => {
    // Only run when processing is complete
    if (!isProcessingDocument) {
      const uploadingFiles = files.filter((f) => f.status === 'uploading')

      // If there were uploading files and processing is complete, check if they're done
      if (uploadingFiles.length > 0) {
        // Mark all files with high progress as success
        setFiles((prev) =>
          prev.map((f) =>
            f.status === 'uploading' && f.progress >= 95
              ? { ...f, status: 'success', progress: 100 }
              : f
          )
        )

        // Count successful uploads
        const successCount = files.filter(
          (f) => f.status === 'success' || (f.status === 'uploading' && f.progress >= 95)
        ).length

        if (successCount > 0) {
          toast.success(`Successfully processed ${successCount} of ${files.length} files.`)

          // Redirect to library after successful uploads
          setTimeout(() => navigate('/library'), 1500)
        }
      }
    }
  }, [isProcessingDocument, files, navigate])

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

      const newFiles = supportedFiles.map((file) => ({
        id: Math.random().toString(36).substring(2),
        file,
        progress: 0,
        status: 'idle' as const
      }))

      if (selectedFiles.length !== supportedFiles.length) {
        toast.error('Only PDF, DOCX, TXT and MD files are supported.')
      }

      setFiles((prev) => [...prev, ...newFiles])
    },
    [isFileSupported]
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

  const handleRemoveFile = (id: string) => {
    setFiles(files.filter((file) => file.id !== id))
  }

  const getFilePath = (file: File | ElectronFile): string | null => {
    // For ElectronFile objects, the path is directly accessible
    if ('path' in file && typeof file.path === 'string') {
      return file.path
    }

    // For regular File objects from drag & drop, we can't get the path
    return null
  }

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.warning('Please select at least one file to upload.')
      return
    }

    // Update all idle files to uploading status
    setFiles((prev) =>
      prev.map((file) => ({
        ...file,
        status: file.status === 'idle' ? 'uploading' : file.status
      }))
    )

    // Group files by status and process only the uploading ones
    for (const fileData of files.filter((f) => f.status === 'uploading')) {
      try {
        // Get the file path
        const filePath = getFilePath(fileData.file)

        if (!filePath) {
          throw new Error(
            'File path not available. This application only supports selecting files through the file browser.'
          )
        }

        const tags: string[] = [] // In a real app, get these from user input

        // Process document - the store's uploadDocuments handles progress tracking
        await uploadDocuments([filePath], tags)

        // Note: documentId will be assigned through the progress events
      } catch (error) {
        console.error('Error uploading file:', error)
        // Handle errors by updating the file status
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileData.id
              ? {
                  ...f,
                  status: 'error',
                  error: error instanceof Error ? error.message : 'Upload failed'
                }
              : f
          )
        )
      }
    }
  }

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
      {files.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Selected Files</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFiles([])}
              disabled={isProcessingDocument || files.some((f) => f.status === 'uploading')}
            >
              Clear all
            </Button>
          </div>

          <AnimatePresence>
            {files.map((fileData) => (
              <motion.div
                key={fileData.id}
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
                        <p className="font-medium truncate max-w-md">{fileData.file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {fileData.file.size > 0
                            ? `${(fileData.file.size / 1024 / 1024).toFixed(2)} MB`
                            : getFilePath(fileData.file) || 'Unknown path'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {fileData.status === 'success' && (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      )}
                      {fileData.status === 'error' && (
                        <AlertCircle className="h-5 w-5 text-red-500" />
                      )}

                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={fileData.status === 'uploading'}
                        onClick={() => handleRemoveFile(fileData.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {(fileData.status === 'uploading' || fileData.status === 'success') && (
                    <div className="mt-2">
                      <Progress value={fileData.progress} className="h-2" />
                      {fileData.status === 'uploading' && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Uploading: {Math.round(fileData.progress)}%
                        </p>
                      )}
                    </div>
                  )}

                  {fileData.status === 'error' && (
                    <p className="text-xs text-red-500 mt-1">{fileData.error || 'Upload failed'}</p>
                  )}
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>

          <div className="flex justify-end">
            <Button
              onClick={handleUpload}
              disabled={
                files.filter((f) => f.status === 'idle').length === 0 || isProcessingDocument
              }
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Files
            </Button>
          </div>
        </div>
      )}
    </motion.div>
  )
}

export default UploadPage
