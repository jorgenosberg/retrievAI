/**
 * Document statistics display component
 */

import { useDocumentStats } from '@/hooks/useDocuments'
import { DocumentStatus } from '@/types/document'

export function DocumentStats() {
  const { data: stats, isLoading, error } = useDocumentStats()

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-3"></div>
            <div className="h-8 bg-gray-200 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
        <p className="text-red-800 text-sm">
          Failed to load statistics: {error.message}
        </p>
      </div>
    )
  }

  if (!stats) return null

  const statusColors = {
    [DocumentStatus.COMPLETED]: 'text-green-600',
    [DocumentStatus.PROCESSING]: 'text-blue-600',
    [DocumentStatus.FAILED]: 'text-red-600',
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      {/* Total Documents */}
      <div className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Total Documents</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">
              {stats.total_documents}
            </p>
          </div>
          <div className="bg-blue-100 rounded-full p-3">
            <svg
              className="w-6 h-6 text-blue-600"
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
      <div className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Total Chunks</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">
              {stats.total_chunks.toLocaleString()}
            </p>
          </div>
          <div className="bg-purple-100 rounded-full p-3">
            <svg
              className="w-6 h-6 text-purple-600"
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
      <div className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Storage Used</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">
              {stats.storage_used_mb.toFixed(1)}
              <span className="text-lg text-gray-500 ml-1">MB</span>
            </p>
          </div>
          <div className="bg-green-100 rounded-full p-3">
            <svg
              className="w-6 h-6 text-green-600"
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
      <div className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
        <p className="text-sm font-medium text-gray-600 mb-3">By Status</p>
        <div className="space-y-2">
          {Object.entries(stats.by_status).map(([status, count]) => (
            <div key={status} className="flex items-center justify-between">
              <span
                className={`text-xs font-medium capitalize ${
                  statusColors[status as DocumentStatus]
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
  )
}
