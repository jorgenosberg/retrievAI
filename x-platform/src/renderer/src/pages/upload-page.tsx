import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, File, X, UploadCloud, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'

// Extend the File interface to include path property used in Electron
interface ElectronFile extends File {
  path?: string;
}

interface FileWithProgress {
  id: string
  file: ElectronFile
  progress: number
  status: 'idle' | 'uploading' | 'success' | 'error'
  error?: string
}

const UploadPage = () => {
  const [files, setFiles] = useState<FileWithProgress[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const navigate = useNavigate()

  const handleFileSelect = useCallback((selectedFiles: ElectronFile[]) => {
    // Filter out unsupported file types or check size limits here
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/markdown'
    ]
    
    // Allow files with path (from electron dialog) or matching types (from drag & drop)
    const newFiles = selectedFiles
      .filter((file) => file.path || allowedTypes.includes(file.type))
      .map((file) => ({
        id: Math.random().toString(36).substring(2),
        file,
        progress: 0,
        status: 'idle' as const
      }))

    if (selectedFiles.length !== newFiles.length) {
      toast.error('Only PDF, DOCX, TXT and MD files are supported.')
    }

    setFiles((prev) => [...prev, ...newFiles])
  }, [])

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
        // Convert the FileList to an array of ElectronFile objects
        const droppedFiles = Array.from(e.dataTransfer.files).map(file => {
          // Standard drag & drop file doesn't have a path, but we need to cast to our interface
          return file as ElectronFile
        })
        
        handleFileSelect(droppedFiles)
      }
    },
    [handleFileSelect]
  )

  const handleBrowseFiles = useCallback(async () => {
    try {
      // Use Electron's dialog through our preload API
      const result = await window.api.selectDocuments()
      
      if (result.success && result.filePaths.length > 0) {
        // Create File-like objects from the file paths
        const selectedFiles = result.filePaths.map(filePath => {
          const name = filePath.split('/').pop() || filePath.split('\\').pop() || filePath
          const extension = name.split('.').pop()?.toLowerCase() || ''
          
          // Map extension to MIME type
          let type = 'text/plain'
          if (extension === 'pdf') type = 'application/pdf'
          else if (extension === 'docx') type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          else if (extension === 'md') type = 'text/markdown'
          
          // Create a File-like object for UI rendering
          // In Electron, we use a custom object rather than the File constructor
          return {
            name,
            type,
            path: filePath,
            size: 0, // Size will be unknown until we read the file
            lastModified: Date.now()
          } as ElectronFile
        })
        
        handleFileSelect(selectedFiles)
      }
    } catch (error) {
      console.error('Error selecting files:', error)
      toast.error('Failed to select files')
    }
  }, [handleFileSelect])

  const handleRemoveFile = (id: string) => {
    setFiles(files.filter((file) => file.id !== id))
  }

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.warning('Please select at least one file to upload.')
      return
    }

    // Update all files to uploading status
    setFiles((prev) =>
      prev.map((file) => ({
        ...file,
        status: file.status === 'idle' ? 'uploading' : file.status
      }))
    )

    // Process uploads one by one
    for (const fileData of files.filter((f) => f.status === 'uploading')) {
      try {
        // Start progress indicator
        updateFileProgress(fileData.id, 10)
        
        // Get the file path
        if (!fileData.file.path) {
          throw new Error('File path not available. This application only supports selecting files through the file browser.')
        }
        
        const filePath = fileData.file.path
        
        // Update progress
        updateFileProgress(fileData.id, 30)
        
        // Tags - in a real app, you would get these from user input
        const tags: string[] = []
        
        // Call the upload API
        updateFileProgress(fileData.id, 50)
        const result = await window.api.uploadDocuments([filePath], tags)
        
        if (!result.success) {
          throw new Error(result.error || 'Upload failed')
        }
        
        // Mark file as success once done
        setFiles((prev) =>
          prev.map((f) => (f.id === fileData.id ? { ...f, status: 'success', progress: 100 } : f))
        )
      } catch (error) {
        console.error('Error uploading file:', error)
        // Handle errors
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileData.id ? { 
              ...f, 
              status: 'error', 
              error: error instanceof Error ? error.message : 'Upload failed' 
            } : f
          )
        )
      }
    }

    // Check if all files are processed
    const allDone = files.every((f) => f.status === 'success' || f.status === 'error')
    if (allDone) {
      const successCount = files.filter((f) => f.status === 'success').length

      if (successCount > 0) {
        toast.success(`Successfully processed ${successCount} of ${files.length} files.`)
      
        // Redirect to library after some time if at least one file was successful
        setTimeout(() => navigate('/library'), 1500)
      } else {
        toast.error('Failed to process any files.')
      }
    }
  }

  // Update progress for a specific file
  const updateFileProgress = (fileId: string, progress: number) => {
    setFiles((prev) => 
      prev.map((f) => (f.id === fileId ? { ...f, progress } : f))
    )
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
            <Button variant="ghost" size="sm" onClick={() => setFiles([])}>
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
                            : fileData.file.path}
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
              disabled={files.filter((f) => f.status === 'idle').length === 0}
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
