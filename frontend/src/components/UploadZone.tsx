/**
 * Drag-and-drop file upload component with progress tracking
 */

import { useState, useRef, DragEvent, ChangeEvent } from 'react'
import { useUploadDocument, useSupportedTypes } from '@/hooks/useDocuments'

interface UploadItem {
  file: File
  progress: number
  status: 'uploading' | 'processing' | 'completed' | 'failed'
  fileHash?: string
  documentId?: number
  error?: string
}

export function UploadZone() {
  const [uploads, setUploads] = useState<Map<string, UploadItem>>(new Map())
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: supportedTypes } = useSupportedTypes()
  const uploadMutation = useUploadDocument()

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    handleFiles(files)
  }

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files)
      handleFiles(files)
    }
  }

  const handleFiles = async (files: File[]) => {
    for (const file of files) {
      const uploadId = `${file.name}-${Date.now()}`

      // Add to upload list
      setUploads((prev) => {
        const newMap = new Map(prev)
        newMap.set(uploadId, {
          file,
          progress: 0,
          status: 'uploading',
        })
        return newMap
      })

      try {
        // Start upload
        const response = await uploadMutation.mutateAsync({
          file,
          onProgress: (progress) => {
            setUploads((prev) => {
              const newMap = new Map(prev)
              const item = newMap.get(uploadId)
              if (item) {
                newMap.set(uploadId, { ...item, progress })
              }
              return newMap
            })
          },
        })

        // Upload complete, now processing
        setUploads((prev) => {
          const newMap = new Map(prev)
          const item = newMap.get(uploadId)
          if (item) {
            newMap.set(uploadId, {
              ...item,
              status: 'processing',
              progress: 100,
              fileHash: response.file_hash,
              documentId: response.document_id,
            })
          }
          return newMap
        })

        // Start polling for processing status
        pollProcessingStatus(uploadId, response.file_hash)
      } catch (error: any) {
        setUploads((prev) => {
          const newMap = new Map(prev)
          const item = newMap.get(uploadId)
          if (item) {
            newMap.set(uploadId, {
              ...item,
              status: 'failed',
              error: error.response?.data?.detail || error.message,
            })
          }
          return newMap
        })
      }
    }
  }

  const pollProcessingStatus = async (uploadId: string, fileHash: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/v1/upload/status/${fileHash}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('access_token')}`,
          },
        })

        if (!response.ok) {
          clearInterval(pollInterval)
          return
        }

        const status = await response.json()

        setUploads((prev) => {
          const newMap = new Map(prev)
          const item = newMap.get(uploadId)
          if (item && item.fileHash === fileHash) {
            // Update based on processing status
            if (status.status === 'completed') {
              newMap.set(uploadId, {
                ...item,
                status: 'completed',
              })
              clearInterval(pollInterval)
              // Auto-remove after 3 seconds
              setTimeout(() => {
                setUploads((prev) => {
                  const newMap = new Map(prev)
                  newMap.delete(uploadId)
                  return newMap
                })
              }, 3000)
            } else if (status.status === 'failed') {
              newMap.set(uploadId, {
                ...item,
                status: 'failed',
                error: status.error || status.message,
              })
              clearInterval(pollInterval)
            }
          }
          return newMap
        })
      } catch (error) {
        console.error('Failed to poll status:', error)
        clearInterval(pollInterval)
      }
    }, 2000)
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const removeUpload = (uploadId: string) => {
    setUploads((prev) => {
      const newMap = new Map(prev)
      newMap.delete(uploadId)
      return newMap
    })
  }

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging
            ? 'border-primary-500 bg-primary-50 dark:border-primary-400 dark:bg-primary-900/20'
            : 'border-gray-300 dark:border-zinc-600 hover:border-gray-400 dark:hover:border-zinc-500'
        }`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileInput}
          className="hidden"
          accept={supportedTypes?.extensions.map((ext) => `.${ext}`).join(',')}
        />

        <div className="flex flex-col items-center space-y-4">
          <div className="bg-primary-100 dark:bg-primary-900/30 rounded-full p-4">
            <svg
              className="w-8 h-8 text-primary-600 dark:text-primary-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>

          <div>
            <p className="text-lg font-medium text-gray-900 dark:text-white mb-1">
              Drop files here or{' '}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 underline cursor-pointer"
              >
                browse
              </button>
            </p>
            <p className="text-sm text-gray-500">
              {supportedTypes && (
                <>
                  Supported: {supportedTypes.extensions.join(', ')} (max{' '}
                  {supportedTypes.max_size_mb}MB)
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Upload Progress List */}
      {uploads.size > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow divide-y divide-gray-200 dark:divide-zinc-700">
          {Array.from(uploads.entries()).map(([uploadId, upload]) => (
            <div key={uploadId} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  {/* Status Icon */}
                  {upload.status === 'completed' && (
                    <div className="flex-shrink-0 w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-green-600 dark:text-green-400"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}
                  {upload.status === 'failed' && (
                    <div className="flex-shrink-0 w-8 h-8 bg-danger-100 dark:bg-danger-900/30 rounded-full flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-danger-600 dark:text-danger-400"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}
                  {(upload.status === 'uploading' ||
                    upload.status === 'processing') && (
                    <div className="flex-shrink-0 w-8 h-8 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-primary-600 dark:text-primary-400 animate-spin"
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
                    </div>
                  )}

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {upload.file.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-zinc-400">
                      {formatFileSize(upload.file.size)} •{' '}
                      {upload.status === 'uploading' && 'Uploading...'}
                      {upload.status === 'processing' && 'Processing...'}
                      {upload.status === 'completed' && 'Completed'}
                      {upload.status === 'failed' && 'Failed'}
                    </p>
                  </div>
                </div>

                {/* Remove Button */}
                <button
                  onClick={() => removeUpload(uploadId)}
                  className="ml-4 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>

              {/* Progress Bar */}
              {(upload.status === 'uploading' ||
                upload.status === 'processing') && (
                <div className="w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-2">
                  <div
                    className="bg-primary-600 dark:bg-primary-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${upload.progress}%` }}
                  ></div>
                </div>
              )}

              {/* Error Message */}
              {upload.status === 'failed' && upload.error && (
                <p className="text-xs text-danger-600 dark:text-danger-400 mt-1">{upload.error}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
