/**
 * Document list component with comprehensive search and filtering
 */

import { useState, useEffect } from "react";
import { useDocuments, useDeleteDocument, type DocumentFilters } from "@/hooks/useDocuments";
import { DocumentStatus, type Document } from "@/types/document";
import {
  FILE_TYPE_OPTIONS,
  DATE_RANGE_OPTIONS,
  SIZE_RANGE_OPTIONS,
  CHUNK_RANGE_OPTIONS,
  getExtensionsForCategory,
  getDateRange,
  parseSizeRange,
  parseChunkRange,
} from "@/lib/fileTypes";

interface DocumentListProps {
  onDocumentClick?: (document: Document) => void;
}

export function DocumentList({ onDocumentClick }: DocumentListProps) {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | "">("");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [fileTypeFilter, setFileTypeFilter] = useState("");
  const [dateRangeFilter, setDateRangeFilter] = useState("");
  const [sizeRangeFilter, setSizeRangeFilter] = useState("");
  const [chunkRangeFilter, setChunkRangeFilter] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Build filters object
  const filters: DocumentFilters = {};

  if (statusFilter) filters.statusFilter = statusFilter;
  if (debouncedSearch) filters.search = debouncedSearch;

  // File type filter - get first extension from category
  if (fileTypeFilter) {
    const extensions = getExtensionsForCategory(fileTypeFilter);
    if (extensions.length > 0) {
      filters.fileType = extensions[0]; // Backend will match any file with this extension
    }
  }

  // Date range filter
  if (dateRangeFilter && dateRangeFilter !== 'custom') {
    const { from, to } = getDateRange(dateRangeFilter);
    if (from) filters.dateFrom = from;
    if (to) filters.dateTo = to;
  }

  // Size range filter
  if (sizeRangeFilter) {
    const { min, max } = parseSizeRange(sizeRangeFilter);
    if (min !== undefined) filters.minSize = min;
    if (max !== undefined) filters.maxSize = max;
  }

  // Chunk range filter
  if (chunkRangeFilter) {
    const { min, max } = parseChunkRange(chunkRangeFilter);
    if (min !== undefined) filters.minChunks = min;
    if (max !== undefined) filters.maxChunks = max;
  }

  const {
    data: documents = [],
    isLoading,
    isFetching,
    error,
  } = useDocuments(page, pageSize, filters);

  const deleteMutation = useDeleteDocument();

  const handleDelete = async (id: number, filename: string) => {
    if (!confirm(`Are you sure you want to delete "${filename}"?`)) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(id);
    } catch (error: any) {
      alert(
        `Failed to delete document: ${
          error.response?.data?.detail || error.message
        }`
      );
    }
  };

  const clearFilters = () => {
    setStatusFilter("");
    setSearchQuery("");
    setFileTypeFilter("");
    setDateRangeFilter("");
    setSizeRangeFilter("");
    setChunkRangeFilter("");
    setPage(1);
  };

  const hasActiveFilters =
    statusFilter !== "" ||
    searchQuery !== "" ||
    fileTypeFilter !== "" ||
    dateRangeFilter !== "" ||
    sizeRangeFilter !== "" ||
    chunkRangeFilter !== "";

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return "Unknown";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStatusBadge = (status: DocumentStatus) => {
    const styles = {
      [DocumentStatus.COMPLETED]:
        "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400",
      [DocumentStatus.PROCESSING]:
        "bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-400",
      [DocumentStatus.FAILED]:
        "bg-danger-100 dark:bg-danger-900/30 text-danger-800 dark:text-danger-400",
    };

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          styles[status]
        }`}
      >
        {status}
      </span>
    );
  };

  // Show loading skeleton only on initial load
  if (isLoading && documents.length === 0 && !hasActiveFilters) {
    return (
      <div className="space-y-4">
        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow p-4">
          <div className="h-10 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse"></div>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow">
          <div className="p-6 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="flex items-center space-x-4">
                  <div className="h-12 w-12 bg-gray-200 dark:bg-zinc-700 rounded"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 dark:bg-zinc-700 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 dark:bg-zinc-700 rounded w-1/2"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Enhanced Filter Bar - Always visible */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow p-4">
        <div className="space-y-4">
          {/* Primary Filters Row */}
          <div className="flex flex-col lg:flex-row gap-3">
            {/* Search Input */}
            <div className="flex-1">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className="h-5 w-5 text-gray-400 dark:text-zinc-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by filename..."
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md leading-5 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-transparent text-sm"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Status Filter */}
            <div className="w-full lg:w-48">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as DocumentStatus | "");
                  setPage(1);
                }}
                className="block w-full h-[38px] px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-transparent text-sm"
              >
                <option value="">All Statuses</option>
                <option value={DocumentStatus.COMPLETED}>Completed</option>
                <option value={DocumentStatus.PROCESSING}>Processing</option>
                <option value={DocumentStatus.FAILED}>Failed</option>
              </select>
            </div>

            {/* File Type Filter */}
            <div className="w-full lg:w-48">
              <select
                value={fileTypeFilter}
                onChange={(e) => {
                  setFileTypeFilter(e.target.value);
                  setPage(1);
                }}
                className="block w-full h-[38px] px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-transparent text-sm"
              >
                {FILE_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Advanced Filters Toggle */}
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="h-[38px] px-4 py-2 text-sm font-medium text-gray-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 rounded-md hover:bg-gray-50 dark:hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <span className="flex items-center gap-2">
                <svg
                  className={`h-4 w-4 transition-transform ${
                    showAdvancedFilters ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
                Advanced
              </span>
            </button>
          </div>

          {/* Advanced Filters Row */}
          {showAdvancedFilters && (
            <div className="flex flex-col lg:flex-row gap-3 pt-2 border-t border-gray-200 dark:border-zinc-700">
              <div className="flex-1">
                <select
                  value={dateRangeFilter}
                  onChange={(e) => {
                    setDateRangeFilter(e.target.value);
                    setPage(1);
                  }}
                  className="block w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-transparent text-sm"
                >
                  {DATE_RANGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <select
                  value={sizeRangeFilter}
                  onChange={(e) => {
                    setSizeRangeFilter(e.target.value);
                    setPage(1);
                  }}
                  className="block w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-transparent text-sm"
                >
                  {SIZE_RANGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <select
                  value={chunkRangeFilter}
                  onChange={(e) => {
                    setChunkRangeFilter(e.target.value);
                    setPage(1);
                  }}
                  className="block w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-transparent text-sm"
                >
                  {CHUNK_RANGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Active Filters & Results Count Row */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Active filter chips */}
              {statusFilter && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-400 text-xs font-medium">
                  Status: {statusFilter}
                  <button
                    onClick={() => setStatusFilter("")}
                    className="hover:text-primary-900 dark:hover:text-primary-300"
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </span>
              )}
              {searchQuery && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-400 text-xs font-medium">
                  Search: "{searchQuery}"
                  <button
                    onClick={() => setSearchQuery("")}
                    className="hover:text-primary-900 dark:hover:text-primary-300"
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </span>
              )}
              {fileTypeFilter && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-400 text-xs font-medium">
                  Type: {FILE_TYPE_OPTIONS.find((o) => o.value === fileTypeFilter)?.label}
                  <button
                    onClick={() => setFileTypeFilter("")}
                    className="hover:text-primary-900 dark:hover:text-primary-300"
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </span>
              )}
              {dateRangeFilter && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-400 text-xs font-medium">
                  Date: {DATE_RANGE_OPTIONS.find((o) => o.value === dateRangeFilter)?.label}
                  <button
                    onClick={() => setDateRangeFilter("")}
                    className="hover:text-primary-900 dark:hover:text-primary-300"
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </span>
              )}
              {sizeRangeFilter && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-400 text-xs font-medium">
                  Size: {SIZE_RANGE_OPTIONS.find((o) => o.value === sizeRangeFilter)?.label}
                  <button
                    onClick={() => setSizeRangeFilter("")}
                    className="hover:text-primary-900 dark:hover:text-primary-300"
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </span>
              )}
              {chunkRangeFilter && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-400 text-xs font-medium">
                  Length: {CHUNK_RANGE_OPTIONS.find((o) => o.value === chunkRangeFilter)?.label}
                  <button
                    onClick={() => setChunkRangeFilter("")}
                    className="hover:text-primary-900 dark:hover:text-primary-300"
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </span>
              )}
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Results count and loading indicator */}
            <div className="flex items-center gap-3">
              <span className="text-gray-600 dark:text-zinc-400">
                {documents.length} result{documents.length !== 1 ? "s" : ""}
              </span>
              {isFetching && (
                <span className="inline-flex items-center text-xs text-gray-400 dark:text-zinc-500">
                  <span className="mr-1 h-2.5 w-2.5 animate-spin rounded-full border-2 border-primary-400 dark:border-primary-500 border-t-transparent" />
                  Updating
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && documents.length === 0 && (
        <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg p-4">
          <p className="text-danger-800 dark:text-danger-300 text-sm">
            Failed to load documents: {error.message}
          </p>
        </div>
      )}

      {error && documents.length > 0 && (
        <div className="rounded border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 p-3 text-xs text-yellow-800 dark:text-yellow-300">
          Showing cached results. Refresh to retry: {error.message}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && documents.length === 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow p-12 text-center">
          <div className="flex flex-col items-center space-y-4">
            <div className="bg-gray-100 dark:bg-zinc-800 rounded-full p-6">
              <svg
                className="w-12 h-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {hasActiveFilters ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                )}
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
                {hasActiveFilters ? "No documents found" : "No documents yet"}
              </h3>
              <p className="text-sm text-gray-500 dark:text-zinc-400">
                {hasActiveFilters
                  ? "Try adjusting your filters or search query"
                  : "Upload your first document to get started"}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="mt-3 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
                >
                  Clear all filters
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Document List */}
      {documents.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow overflow-hidden">
          <div className="divide-y divide-gray-200 dark:divide-zinc-700">
            {documents.map((doc: Document) => (
              <div
                key={doc.id}
                className="p-4 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  {/* File Icon */}
                  <div className="shrink-0">
                    <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-primary-600 dark:text-primary-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>
                  </div>

                  {/* Document Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <button
                          onClick={() => onDocumentClick?.(doc)}
                          className="text-sm font-medium text-gray-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400 truncate block cursor-pointer"
                        >
                          {doc.filename}
                        </button>
                        <div className="flex items-center space-x-3 mt-1 text-xs text-gray-500 dark:text-zinc-400">
                          <span>{formatFileSize(doc.file_size)}</span>
                          <span>•</span>
                          <span>{doc.chunk_count} chunks</span>
                          <span>•</span>
                          <span>{formatDate(doc.created_at)}</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 ml-4">
                        {getStatusBadge(doc.status)}

                        {/* Delete Button */}
                        <button
                          onClick={() => handleDelete(doc.id, doc.filename)}
                          disabled={deleteMutation.isPending}
                          className={`text-gray-400 hover:text-danger-600 dark:hover:text-danger-400 disabled:opacity-50 ${deleteMutation.isPending ? "cursor-progress" : "cursor-pointer"} disabled:cursor-not-allowed`}
                          title="Delete document"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Error Message */}
                    {doc.status === DocumentStatus.FAILED &&
                      doc.error_message && (
                        <div className="mt-2 text-xs text-danger-600 dark:text-danger-400 bg-danger-50 dark:bg-danger-900/20 rounded px-2 py-1">
                          {doc.error_message}
                        </div>
                      )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pagination */}
      {(documents.length > 0 && (page > 1 || documents.length === pageSize)) && (
        <div className="flex items-center justify-between bg-white dark:bg-zinc-900 rounded-lg shadow px-4 py-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 rounded-md hover:bg-gray-50 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            Previous
          </button>

          <span className="text-sm text-gray-700 dark:text-zinc-300">
            Page {page}
          </span>

          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={documents.length < pageSize}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 rounded-md hover:bg-gray-50 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
