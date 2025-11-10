/**
 * TanStack Query hooks for document operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api'
import type {
  Document,
  DocumentStats,
  UploadResponse,
  UploadStatus,
  DeleteDocumentResponse,
  SupportedTypes,
  SearchResult,
} from '@/types/document'

// Query keys
export const documentKeys = {
  all: ['documents'] as const,
  lists: () => [...documentKeys.all, 'list'] as const,
  list: (page: number, pageSize: number, statusFilter?: string) =>
    [...documentKeys.lists(), { page, pageSize, statusFilter }] as const,
  stats: () => [...documentKeys.all, 'stats'] as const,
  detail: (id: number) => [...documentKeys.all, 'detail', id] as const,
  uploadStatus: (fileHash: string) =>
    [...documentKeys.all, 'uploadStatus', fileHash] as const,
  supportedTypes: () => [...documentKeys.all, 'supportedTypes'] as const,
}

// Fetch documents list with pagination
export function useDocuments(
  page = 1,
  pageSize = 50,
  statusFilter?: string
) {
  return useQuery({
    queryKey: documentKeys.list(page, pageSize, statusFilter),
    queryFn: () => apiClient.getDocuments(page, pageSize, statusFilter),
  })
}

const DOCUMENT_STATS_CACHE_KEY = 'retrievai:documentStats'
const DOCUMENT_STATS_TTL = 1000 * 60 * 30 // 30 minutes

function getCachedStats(): DocumentStats | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const raw = window.localStorage.getItem(DOCUMENT_STATS_CACHE_KEY)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as { data: DocumentStats; cachedAt: number }
    if (!parsed?.data || !parsed?.cachedAt) return undefined
    if (Date.now() - parsed.cachedAt > DOCUMENT_STATS_TTL) return undefined
    return parsed.data
  } catch {
    return undefined
  }
}

function cacheStats(stats: DocumentStats) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      DOCUMENT_STATS_CACHE_KEY,
      JSON.stringify({ data: stats, cachedAt: Date.now() })
    )
  } catch {
    // Ignore storage errors (private mode, etc.)
  }
}

// Fetch document statistics (lazily enabled)
export function useDocumentStats(enabled = true) {
  return useQuery<DocumentStats>({
    queryKey: documentKeys.stats(),
    queryFn: async () => {
      const stats = await apiClient.getDocumentStats()
      cacheStats(stats)
      return stats
    },
    refetchOnWindowFocus: false,
    staleTime: DOCUMENT_STATS_TTL,
    gcTime: DOCUMENT_STATS_TTL * 2,
    enabled,
    initialData: () => getCachedStats(),
  })
}

// Fetch single document details
export function useDocument(id: number) {
  return useQuery<Document>({
    queryKey: documentKeys.detail(id),
    queryFn: () => apiClient.getDocument(id),
    enabled: !!id,
  })
}

// Fetch upload status (with polling)
export function useUploadStatus(fileHash: string, enabled = true) {
  return useQuery<UploadStatus>({
    queryKey: documentKeys.uploadStatus(fileHash),
    queryFn: () => apiClient.getUploadStatus(fileHash),
    enabled: enabled && !!fileHash,
    refetchInterval: (data) => {
      // Poll every 2 seconds while processing
      if (!data) return 2000
      const status = data.status
      if (status === 'queued' || status === 'running') {
        return 2000
      }
      // Stop polling when completed or failed
      return false
    },
  })
}

// Fetch supported file types
export function useSupportedTypes() {
  return useQuery<SupportedTypes>({
    queryKey: documentKeys.supportedTypes(),
    queryFn: () => apiClient.getSupportedTypes(),
    staleTime: Infinity, // This data rarely changes
  })
}

// Upload document mutation
export function useUploadDocument() {
  const queryClient = useQueryClient()

  return useMutation<
    UploadResponse,
    Error,
    { file: File; onProgress?: (progress: number) => void }
  >({
    mutationFn: ({ file, onProgress }) =>
      apiClient.uploadDocument(file, onProgress),
    onSuccess: () => {
      // Invalidate documents list and stats
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() })
      queryClient.invalidateQueries({ queryKey: documentKeys.stats() })
    },
  })
}

// Delete document mutation
export function useDeleteDocument() {
  const queryClient = useQueryClient()

  return useMutation<DeleteDocumentResponse, Error, number>({
    mutationFn: (id) => apiClient.deleteDocument(id),
    onSuccess: () => {
      // Invalidate documents list and stats
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() })
      queryClient.invalidateQueries({ queryKey: documentKeys.stats() })
    },
  })
}

// Search documents mutation
export function useSearchDocuments() {
  return useMutation<SearchResult, Error, { query: string; k?: number }>({
    mutationFn: ({ query, k = 10 }) => apiClient.searchDocuments(query, k),
  })
}
