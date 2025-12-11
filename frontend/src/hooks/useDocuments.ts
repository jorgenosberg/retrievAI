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
  BatchDeleteResponse,
  SupportedTypes,
  SearchResult,
} from '@/types/document'

export interface DocumentFilters {
  statusFilter?: string
  search?: string
  fileType?: string
  uploadedBy?: number
  dateFrom?: string
  dateTo?: string
  minSize?: number
  maxSize?: number
  minChunks?: number
  maxChunks?: number
}

// Query keys
export const documentKeys = {
  all: ['documents'] as const,
  lists: () => [...documentKeys.all, 'list'] as const,
  list: (page: number, pageSize: number, filters?: DocumentFilters) =>
    [...documentKeys.lists(), { page, pageSize, ...filters }] as const,
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
  filters?: DocumentFilters
) {
  return useQuery<Document[]>({
    queryKey: documentKeys.list(page, pageSize, filters),
    queryFn: () => apiClient.getDocuments(page, pageSize, filters),
    staleTime: 1000 * 60 * 30, // 30 minutes
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnMount: 'always', // Always refetch when navigating to page (shows cached data while fetching)
    placeholderData: (previousData) => previousData,
  })
}

const DOCUMENT_STATS_TTL = 1000 * 60 * 30 // 30 minutes

// Fetch document statistics (lazily enabled)
export function useDocumentStats(enabled = true) {
  return useQuery<DocumentStats>({
    queryKey: documentKeys.stats(),
    queryFn: () => apiClient.getDocumentStats(),
    refetchOnWindowFocus: false,
    staleTime: DOCUMENT_STATS_TTL,
    gcTime: DOCUMENT_STATS_TTL * 2,
    enabled,
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
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (!status) {
        return 2000
      }
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

// Batch delete documents mutation
export function useBatchDeleteDocuments() {
  const queryClient = useQueryClient()

  return useMutation<BatchDeleteResponse, Error, number[]>({
    mutationFn: (ids) => apiClient.batchDeleteDocuments(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() })
      queryClient.invalidateQueries({ queryKey: documentKeys.stats() })
    },
  })
}
