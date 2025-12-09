import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/api";
import type { Document } from "@/types/document";
import type { Chunk } from "@/types/chunk";

interface DocumentViewerProps {
  document: Document;
  onClose: () => void;
  onStartChat?: () => void;
}

const DEFAULT_LIMIT = 200;

export function DocumentViewer({
  document,
  onClose,
  onStartChat,
}: DocumentViewerProps) {
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    // Reset state when switching documents
    setChunks([]);
    setTotal(0);
    setOffset(0);
    setHasMore(false);
    setSelectedIndex(0);
    setError(null);
    loadChunks(true, debouncedSearch);
  }, [document.file_hash, debouncedSearch]);

  const loadChunks = async (reset = false, search?: string) => {
    try {
      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      const nextOffset = reset ? 0 : offset + DEFAULT_LIMIT;
      const response = await apiClient.getDocumentChunks(document.file_hash, {
        limit: DEFAULT_LIMIT,
        offset: nextOffset,
        search: search || undefined,
      });
      setTotal(response.total);
      setHasMore(response.has_more);
      setOffset(response.offset + response.chunks.length);
      setChunks((prev) =>
        reset ? response.chunks : [...prev, ...response.chunks]
      );
      setError(null);
      if (reset) {
        setSelectedIndex(0);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load chunks";
      setError(message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleSelect = (index: number) => {
    setSelectedIndex(index);
  };

  const handlePrev = () => {
    setSelectedIndex((idx) => Math.max(0, idx - 1));
  };

  const handleNext = () => {
    setSelectedIndex((idx) => Math.min(chunks.length - 1, idx + 1));
  };

  const activeChunk = chunks[selectedIndex] || null;

  const nearbyChunks = useMemo(() => {
    if (!chunks.length || !activeChunk) return [];
    const start = Math.max(0, selectedIndex - 2);
    const end = Math.min(chunks.length, selectedIndex + 3);
    return chunks.slice(start, end).map((chunk, idx) => ({
      chunk,
      isActive: start + idx === selectedIndex,
      index: start + idx,
    }));
  }, [chunks, selectedIndex, activeChunk]);

  const renderChunkBadge = (chunk: Chunk) => {
    if (chunk.metadata.page !== undefined) {
      return `Page ${chunk.metadata.page}`;
    }
    return chunk.metadata.source || "Chunk";
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 dark:bg-black dark:bg-opacity-70 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-gray-200 dark:border-zinc-800">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-zinc-400">
              Document
            </p>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-zinc-100">
              {document.filename}
            </h2>
            <p className="text-xs text-gray-500 dark:text-zinc-400">
              {document.chunk_count} chunks •{" "}
              {document.file_size
                ? `${(document.file_size / (1024 * 1024)).toFixed(2)} MB`
                : "Unknown size"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onStartChat && (
              <button
                onClick={onStartChat}
                className="inline-flex items-center px-3 py-2 rounded-md bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-400 cursor-pointer"
              >
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                  />
                </svg>
                Open in Chat
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 cursor-pointer"
              aria-label="Close viewer"
            >
              <svg
                className="w-5 h-5"
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
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Chunk list / filters */}
          <div className="w-80 border-r border-gray-200 dark:border-zinc-800 flex flex-col">
            <div className="p-4 space-y-3">
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search within chunks..."
                  className="w-full rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <svg
                  className="w-4 h-4 absolute right-3 top-3 text-gray-400 dark:text-zinc-500"
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
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                Showing {chunks.length} of {total || document.chunk_count} chunks
              </p>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading && (
                <div className="p-4 text-sm text-gray-500 dark:text-zinc-400">
                  Loading chunks...
                </div>
              )}
              {error && (
                <div className="p-4 text-sm text-danger-600 dark:text-danger-400">
                  {error}
                </div>
              )}
              {!loading && !error && chunks.length === 0 && (
                <div className="p-4 text-sm text-gray-500 dark:text-zinc-400">
                  No chunks found for this document.
                </div>
              )}
              <div className="divide-y divide-gray-200 dark:divide-zinc-800">
                {chunks.map((chunk, idx) => (
                  <button
                    key={`${chunk.metadata.file_hash}-${idx}`}
                    onClick={() => handleSelect(idx)}
                    className={`w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer ${
                      idx === selectedIndex
                        ? "bg-primary-50 dark:bg-primary-900/20"
                        : ""
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-zinc-400 mb-1">
                      <span className="font-medium text-gray-700 dark:text-zinc-200">
                        {renderChunkBadge(chunk)}
                      </span>
                      <span className="text-[11px]">
                        Chunk {idx + 1}
                      </span>
                    </div>
                    <p className="text-sm text-gray-800 dark:text-zinc-100 line-clamp-3">
                      {chunk.content}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {hasMore && (
              <div className="p-3 border-t border-gray-200 dark:border-zinc-800">
                <button
                  onClick={() => loadChunks(false, debouncedSearch)}
                  disabled={loadingMore}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 dark:border-zinc-700 px-3 py-2 text-sm font-medium text-gray-700 dark:text-zinc-100 bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-50 cursor-pointer"
                >
                  {loadingMore && (
                    <svg
                      className="w-4 h-4 animate-spin text-primary-600"
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
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                  )}
                  Load more chunks
                </button>
              </div>
            )}
          </div>

          {/* Active chunk viewer */}
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-zinc-800">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
                  {activeChunk ? renderChunkBadge(activeChunk) : "No chunk"}
                </p>
                {activeChunk?.metadata.title && (
                  <p className="text-xs text-gray-500 dark:text-zinc-400">
                    {activeChunk.metadata.title}
                  </p>
                )}
                <p className="text-xs text-gray-500 dark:text-zinc-400">
                  Chunk {selectedIndex + 1} of {total || document.chunk_count}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrev}
                  disabled={selectedIndex === 0}
                  className="inline-flex items-center gap-2 rounded-md border border-gray-300 dark:border-zinc-700 px-3 py-1.5 text-sm text-gray-700 dark:text-zinc-100 bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                  Previous
                </button>
                <button
                  onClick={handleNext}
                  disabled={selectedIndex >= chunks.length - 1}
                  className="inline-flex items-center gap-2 rounded-md border border-gray-300 dark:border-zinc-700 px-3 py-1.5 text-sm text-gray-700 dark:text-zinc-100 bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  Next
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loading && (
                <div className="flex items-center justify-center h-full">
                  <svg
                    className="animate-spin h-8 w-8 text-primary-600"
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
              {!loading && error && (
                <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg p-4 text-danger-700 dark:text-danger-300">
                  {error}
                </div>
              )}
              {!loading && !error && activeChunk && (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800">
                    <p className="whitespace-pre-wrap text-gray-900 dark:text-zinc-100 leading-relaxed">
                      {activeChunk.content}
                    </p>
                  </div>

                  {nearbyChunks.length > 1 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase">
                        Nearby context
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {nearbyChunks
                          .filter((item) => !item.isActive)
                          .map((item) => (
                            <div
                              key={`context-${item.index}`}
                              className="p-3 rounded-md border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900"
                            >
                              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-zinc-400 mb-1">
                                <span className="font-medium text-gray-700 dark:text-zinc-200">
                                  {renderChunkBadge(item.chunk)}
                                </span>
                                <span>Chunk {item.index + 1}</span>
                              </div>
                              <p className="text-sm text-gray-800 dark:text-zinc-200 line-clamp-3">
                                {item.chunk.content}
                              </p>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
