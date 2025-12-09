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
  const [selectedChunkIndex, setSelectedChunkIndex] = useState(0);
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);
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
    setSelectedChunkIndex(0);
    setSelectedPageIndex(0);
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
        setSelectedChunkIndex(0);
        setSelectedPageIndex(0);
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

  const handleSelectChunk = (index: number) => {
    setSelectedChunkIndex(index);
    const pageIdx = pages.findIndex((page) =>
      page.chunks.some((chunk) => chunk.globalIndex === index)
    );
    if (pageIdx >= 0) {
      setSelectedPageIndex(pageIdx);
    }
  };

  const handlePrev = () => {
    setSelectedChunkIndex((idx) => {
      const nextIdx = Math.max(0, idx - 1);
      const pageIdx = findPageIndexForChunk(nextIdx);
      if (pageIdx >= 0) setSelectedPageIndex(pageIdx);
      return nextIdx;
    });
  };

  const handleNext = () => {
    setSelectedChunkIndex((idx) => {
      const nextIdx = Math.min(chunks.length - 1, idx + 1);
      const pageIdx = findPageIndexForChunk(nextIdx);
      if (pageIdx >= 0) setSelectedPageIndex(pageIdx);
      return nextIdx;
    });
  };

  const pages = useMemo(() => {
    if (!chunks.length) return [];
    const groups: Array<{
      page: number | null;
      title?: string;
      chunks: Array<{ chunk: Chunk; globalIndex: number }>;
    }> = [];
    const byPage = new Map<number | null, Array<{ chunk: Chunk; globalIndex: number }>>();

    chunks.forEach((chunk, idx) => {
      const page = chunk.metadata.page ?? null;
      if (!byPage.has(page)) {
        byPage.set(page, []);
      }
      byPage.get(page)?.push({ chunk, globalIndex: idx });
    });

    const sortedPages = Array.from(byPage.keys()).sort((a, b) => {
      if (a === null) return 1;
      if (b === null) return -1;
      return a - b;
    });

    sortedPages.forEach((page) => {
      groups.push({
        page,
        chunks: byPage.get(page) || [],
      });
    });

    return groups;
  }, [chunks]);

  const findPageIndexForChunk = (chunkIndex: number) => {
    return pages.findIndex((page) =>
      page.chunks.some((chunk) => chunk.globalIndex === chunkIndex)
    );
  };

  const activeChunk = chunks[selectedChunkIndex] || null;
  const activePage = pages[selectedPageIndex] || null;

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
          {/* Page list / filters */}
          <div className="w-72 border-r border-gray-200 dark:border-zinc-800 flex flex-col">
            <div className="p-4 space-y-3">
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search within pages..."
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
                {pages.length} page{pages.length === 1 ? "" : "s"} • {chunks.length} chunks
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
              {!loading && !error && pages.length === 0 && (
                <div className="p-4 text-sm text-gray-500 dark:text-zinc-400">
                  No pages found for this document.
                </div>
              )}
              <div className="divide-y divide-gray-200 dark:divide-zinc-800">
                {pages.map((page, idx) => (
                  <button
                    key={`page-${page.page ?? "unknown"}`}
                    onClick={() => {
                      setSelectedPageIndex(idx);
                      if (page.chunks[0]) {
                        handleSelectChunk(page.chunks[0].globalIndex);
                      }
                    }}
                    className={`w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer ${
                      idx === selectedPageIndex
                        ? "bg-primary-50 dark:bg-primary-900/20"
                        : ""
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-zinc-400 mb-1">
                      <span className="font-medium text-gray-700 dark:text-zinc-200">
                        Page {page.page ?? "?"}
                      </span>
                      <span className="text-[11px]">
                        {page.chunks.length} chunk{page.chunks.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-zinc-300 line-clamp-2">
                      {page.chunks[0]?.chunk.content || "Document page"}
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
                  Chunk {selectedChunkIndex + 1} of {total || document.chunk_count} • Page{" "}
                  {activeChunk?.metadata.page ?? "?"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setSelectedPageIndex((idx) => Math.max(0, idx - 1))
                  }
                  disabled={selectedPageIndex <= 0}
                  className="inline-flex items-center gap-2 rounded-md border border-gray-300 dark:border-zinc-700 px-3 py-1.5 text-sm text-gray-700 dark:text-zinc-100 bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  Prev page
                </button>
                <button
                  onClick={() =>
                    setSelectedPageIndex((idx) =>
                      Math.min(pages.length - 1, idx + 1)
                    )
                  }
                  disabled={selectedPageIndex >= pages.length - 1}
                  className="inline-flex items-center gap-2 rounded-md border border-gray-300 dark:border-zinc-700 px-3 py-1.5 text-sm text-gray-700 dark:text-zinc-100 bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  Next page
                </button>
                <button
                  onClick={handlePrev}
                  disabled={selectedChunkIndex === 0}
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
                  disabled={selectedChunkIndex >= chunks.length - 1}
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
              {!loading && !error && activePage && (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-zinc-300">
                    <span className="font-semibold">
                      Page {activePage.page ?? "?"}
                    </span>
                    <span>•</span>
                    <span>
                      {activePage.chunks.length} chunk
                      {activePage.chunks.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {activePage.chunks.map(({ chunk, globalIndex }) => (
                      <div
                        key={`chunk-${globalIndex}`}
                        className={`p-4 rounded-lg border ${
                          globalIndex === selectedChunkIndex
                            ? "bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800"
                            : "bg-gray-50 dark:bg-zinc-900 border-gray-200 dark:border-zinc-800"
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-zinc-400 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-full bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-[11px] text-gray-700 dark:text-zinc-200">
                              Chunk {globalIndex + 1}
                            </span>
                            {chunk.metadata.page !== undefined && (
                              <span className="text-[11px]">
                                Page {chunk.metadata.page}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => handleSelectChunk(globalIndex)}
                            className="text-[11px] text-primary-600 dark:text-primary-400 hover:underline cursor-pointer"
                          >
                            Focus
                          </button>
                        </div>
                        <p className="whitespace-pre-wrap text-gray-900 dark:text-zinc-100 leading-relaxed">
                          {chunk.content}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
