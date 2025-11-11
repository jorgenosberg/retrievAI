import { type SVGProps } from 'react'
import { useDocumentStats } from '@/hooks/useDocuments'
import { DocumentStatus } from '@/types/document'

const skeletonCards = [...Array(4)]

export function DocumentStats() {
  const {
    data: stats,
    isLoading,
    error,
    isFetching,
    refetch,
  } = useDocumentStats()

  const showSkeleton = !stats && isLoading

  if (showSkeleton) {
    return (
      <div className="mb-6">
        <div className="mb-2 h-4 w-32 rounded bg-gray-200" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {skeletonCards.map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg bg-white p-6 shadow">
              <div className="mb-3 h-4 w-1/2 rounded bg-gray-200" />
              <div className="h-8 w-3/4 rounded bg-gray-200" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error && !stats) {
    return (
      <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-red-800">
            Failed to load statistics: {error.message}
          </p>
          <button
            onClick={() => refetch()}
            className="rounded-md border border-red-300 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!stats) {
    return null
  }

  const statusColors = {
    [DocumentStatus.COMPLETED]: 'text-green-600',
    [DocumentStatus.PROCESSING]: 'text-blue-600',
    [DocumentStatus.FAILED]: 'text-red-600',
  }

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-700">Repository stats</p>
          <p className="text-xs text-gray-500">
            Snapshot refreshed every 30 minutes unless you update it manually.
          </p>
          {error && (
            <p className="text-xs text-red-600">
              Showing cached data. Refresh to try loading the latest snapshot.
            </p>
          )}
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isFetching ? (
            <>
              <span className="mr-2 h-3 w-3 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              Updating...
            </>
          ) : (
            <>
              <RefreshIcon className="mr-2 h-3.5 w-3.5" />
              Refresh
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {/* Total Documents */}
        <div className="rounded-lg bg-white p-6 shadow transition-shadow hover:shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Documents</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">
                {stats.total_documents}
              </p>
            </div>
            <div className="rounded-full bg-blue-100 p-3">
              <svg
                className="h-6 w-6 text-blue-600"
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
        </div>

        {/* Total Chunks */}
        <div className="rounded-lg bg-white p-6 shadow transition-shadow hover:shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Chunks</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">
                {stats.total_chunks.toLocaleString()}
              </p>
            </div>
            <div className="rounded-full bg-purple-100 p-3">
              <svg
                className="h-6 w-6 text-purple-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Storage Used */}
        <div className="rounded-lg bg-white p-6 shadow transition-shadow hover:shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Storage Used</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">
                {stats.storage_used_mb.toFixed(1)}
                <span className="ml-1 text-lg text-gray-500">MB</span>
              </p>
            </div>
            <div className="rounded-full bg-green-100 p-3">
              <svg
                className="h-6 w-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Status Breakdown */}
        <div className="rounded-lg bg-white p-6 shadow transition-shadow hover:shadow-md">
          <p className="mb-3 text-sm font-medium text-gray-600">By Status</p>
          <div className="space-y-2">
            {Object.entries(stats.by_status).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span
                  className={`text-xs font-medium capitalize ${
                    statusColors[status as DocumentStatus] ?? 'text-gray-600'
                  }`}
                >
                  {status}
                </span>
                <span className="text-sm font-semibold text-gray-900">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function RefreshIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0114.13-3.36L23 10M1 14l5.37 5.37A9 9 0 0020.49 15" />
    </svg>
  )
}
