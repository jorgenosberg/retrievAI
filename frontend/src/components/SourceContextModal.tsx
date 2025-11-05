import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api'
import type { Source } from '@/types/chat'

interface ChunkData {
  content: string
  metadata: {
    source: string
    page?: number
    file_hash?: string
    title?: string
  }
}

interface ChunkContextData {
  current_chunk: ChunkData
  previous_chunks: ChunkData[]
  next_chunks: ChunkData[]
  total_chunks: number
  current_index: number
}

interface SourceContextModalProps {
  source: Source
  onClose: () => void
}

export function SourceContextModal({ source, onClose }: SourceContextModalProps) {
  const [contextData, setContextData] = useState<ChunkContextData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentView, setCurrentView] = useState<'current' | 'prev' | 'next'>('current')
  const [viewIndex, setViewIndex] = useState(0)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (!cancelled) {
        await loadContext()
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  const loadContext = async () => {
    if (!source.metadata.file_hash) {
      setError('No file hash available for this source')
      setLoading(false)
      return
    }

    console.log('Loading context for source:', {
      file_hash: source.metadata.file_hash,
      content_preview: source.content.substring(0, 100),
      metadata: source.metadata
    })

    try {
      setLoading(true)
      const data = await apiClient.getChunkContext(
        source.metadata.file_hash,
        source.content,
        2 // Get 2 chunks before and after
      )
      setContextData(data)
      setError(null)
    } catch (err) {
      console.error('Error loading chunk context:', err)
      console.error('Source data:', source)
      setError(err instanceof Error ? err.message : 'Failed to load context')
    } finally {
      setLoading(false)
    }
  }

  const getCurrentChunk = (): ChunkData | null => {
    if (!contextData) return null

    if (currentView === 'current') {
      return contextData.current_chunk
    } else if (currentView === 'prev') {
      return contextData.previous_chunks[viewIndex] || null
    } else if (currentView === 'next') {
      return contextData.next_chunks[viewIndex] || null
    }
    return null
  }

  const canGoPrevious = (): boolean => {
    if (!contextData) return false
    if (currentView === 'prev') {
      return viewIndex < contextData.previous_chunks.length - 1
    } else if (currentView === 'current') {
      return contextData.previous_chunks.length > 0
    } else {
      return viewIndex > 0
    }
  }

  const canGoNext = (): boolean => {
    if (!contextData) return false
    if (currentView === 'prev') {
      return viewIndex > 0
    } else if (currentView === 'current') {
      return contextData.next_chunks.length > 0
    } else {
      return viewIndex < contextData.next_chunks.length - 1
    }
  }

  const handlePrevious = () => {
    if (!contextData) return

    if (currentView === 'prev') {
      setViewIndex(viewIndex + 1)
    } else if (currentView === 'current') {
      setCurrentView('prev')
      setViewIndex(0)
    } else if (currentView === 'next' && viewIndex > 0) {
      setViewIndex(viewIndex - 1)
    } else if (currentView === 'next' && viewIndex === 0) {
      setCurrentView('current')
      setViewIndex(0)
    }
  }

  const handleNext = () => {
    if (!contextData) return

    if (currentView === 'prev' && viewIndex > 0) {
      setViewIndex(viewIndex - 1)
    } else if (currentView === 'prev' && viewIndex === 0) {
      setCurrentView('current')
      setViewIndex(0)
    } else if (currentView === 'current') {
      setCurrentView('next')
      setViewIndex(0)
    } else if (currentView === 'next') {
      setViewIndex(viewIndex + 1)
    }
  }

  const getPositionLabel = (): string => {
    if (!contextData) return ''

    let absoluteIndex = contextData.current_index
    if (currentView === 'prev') {
      absoluteIndex -= (viewIndex + 1)
    } else if (currentView === 'next') {
      absoluteIndex += (viewIndex + 1)
    }

    return `Chunk ${absoluteIndex + 1} of ${contextData.total_chunks}`
  }

  const currentChunk = getCurrentChunk()

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-200">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900">
              {source.metadata.title || source.metadata.source}
            </h2>
            {source.metadata.page && (
              <p className="text-sm text-gray-500 mt-1">Page {source.metadata.page}</p>
            )}
            {contextData && (
              <p className="text-sm text-blue-600 mt-1">{getPositionLabel()}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors ml-4"
            title="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
              <p className="font-semibold">Error loading context</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          )}

          {!loading && !error && currentChunk && (
            <div className="prose prose-sm max-w-none">
              <div className={`p-4 rounded-lg ${currentView === 'current' ? 'bg-blue-50 border-2 border-blue-300' : 'bg-gray-50'}`}>
                <p className="whitespace-pre-wrap leading-relaxed text-gray-800">
                  {currentChunk.content}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer with navigation */}
        {!loading && !error && contextData && (
          <div className="border-t border-gray-200 p-4 bg-gray-50">
            <div className="flex items-center justify-between">
              <button
                onClick={handlePrevious}
                disabled={!canGoPrevious()}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="font-medium">Previous</span>
              </button>

              <div className="text-sm text-gray-600">
                {currentView === 'current' && (
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-medium">
                    Current Chunk
                  </span>
                )}
                {currentView !== 'current' && (
                  <span className="text-gray-500">
                    {currentView === 'prev' ? 'Before' : 'After'} current chunk
                  </span>
                )}
              </div>

              <button
                onClick={handleNext}
                disabled={!canGoNext()}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <span className="font-medium">Next</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
