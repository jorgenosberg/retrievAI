/**
 * Document list component with pagination and filtering
 */

import { useState } from "react";
import { useDocuments, useDeleteDocument } from "@/hooks/useDocuments";
import { DocumentStatus, type Document } from "@/types/document";

interface DocumentListProps {
  onDocumentClick?: (document: Document) => void;
}

export function DocumentList({ onDocumentClick }: DocumentListProps) {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | "">("");

  const {
    data: documents = [],
    isLoading,
    isFetching,
    error,
  } = useDocuments(page, pageSize, statusFilter || undefined);
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

  if (isLoading && documents.length === 0) {
    return (
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
    );
  }

  if (error && documents.length === 0) {
    return (
      <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg p-4">
        <p className="text-danger-800 dark:text-danger-300 text-sm">
          Failed to load documents: {error.message}
        </p>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow p-12 text-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="bg-gray-100 dark:bg-zinc-800 rounded-full p-6">
            <svg
              className="w-12 h-12 text-gray-400"
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
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
              No documents yet
            </h3>
            <p className="text-sm text-gray-500 dark:text-zinc-400">
              Upload your first document to get started
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow p-4">
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-700 dark:text-zinc-300">
            Filter by status:
          </label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as DocumentStatus | "");
              setPage(1);
            }}
            className="rounded-md border-gray-300 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:focus:border-primary-400 dark:focus:ring-primary-400 text-sm"
          >
            <option value="">All</option>
            <option value={DocumentStatus.COMPLETED}>Completed</option>
            <option value={DocumentStatus.PROCESSING}>Processing</option>
            <option value={DocumentStatus.FAILED}>Failed</option>
          </select>

          <div className="flex-1"></div>

          <span className="text-sm text-gray-500 dark:text-zinc-400">
            {documents.length} document{documents.length !== 1 ? "s" : ""}
          </span>
          {isFetching && (
            <span className="inline-flex items-center text-xs text-gray-400 dark:text-zinc-500">
              <span className="mr-1 h-2.5 w-2.5 animate-spin rounded-full border-2 border-primary-400 dark:border-primary-500 border-t-transparent" />
              Updating
            </span>
          )}
        </div>
      </div>

      {error && documents.length > 0 && (
        <div className="rounded border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 p-3 text-xs text-yellow-800 dark:text-yellow-300">
          Showing cached results. Refresh to retry: {error.message}
        </div>
      )}

      {/* Document List */}
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

      {/* Pagination */}
      {documents.length === pageSize && (
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
