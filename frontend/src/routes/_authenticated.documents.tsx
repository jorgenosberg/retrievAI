import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { DocumentStats } from '@/components/DocumentStats'
import { UploadZone } from '@/components/UploadZone'
import { DocumentList } from '@/components/DocumentList'
import type { Document } from '@/types/document'

export const Route = createFileRoute('/_authenticated/documents')({
  component: DocumentsPage,
})

function DocumentsPage() {
  const [showUpload, setShowUpload] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)

  const handleDocumentClick = (document: Document) => {
    setSelectedDocument(document)
  }

  const handleCloseDetails = () => {
    setSelectedDocument(null)
  }

  return (
    <div className="min-h-full bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Documents</h1>
              <p className="mt-1 text-sm text-gray-500">
                Manage your document library and upload new files
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <Link
                to="/chat"
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
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
                Chat
              </Link>
              <button
                onClick={() => setShowUpload(!showUpload)}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
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
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                {showUpload ? 'Hide Upload' : 'Upload Files'}
              </button>
            </div>
          </div>
        </div>

        {/* Statistics */}
        <DocumentStats />

        {/* Upload Zone */}
        {showUpload && (
          <div className="mb-6">
            <UploadZone />
          </div>
        )}

        {/* Document List */}
        <DocumentList onDocumentClick={handleDocumentClick} />

        {/* Document Details Modal */}
        {selectedDocument && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              {/* Background overlay */}
              <div
                className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
                onClick={handleCloseDetails}
              ></div>

              {/* Modal panel */}
              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      Document Details
                    </h3>
                    <button
                      onClick={handleCloseDetails}
                      className="text-gray-400 hover:text-gray-500"
                    >
                      <svg
                        className="w-6 h-6"
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

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Filename
                      </label>
                      <p className="mt-1 text-sm text-gray-900">
                        {selectedDocument.filename}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          File Size
                        </label>
                        <p className="mt-1 text-sm text-gray-900">
                          {selectedDocument.file_size
                            ? `${(selectedDocument.file_size / 1024 / 1024).toFixed(2)} MB`
                            : 'Unknown'}
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          MIME Type
                        </label>
                        <p className="mt-1 text-sm text-gray-900">
                          {selectedDocument.mime_type || 'Unknown'}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Status
                        </label>
                        <p className="mt-1 text-sm text-gray-900 capitalize">
                          {selectedDocument.status}
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Chunks
                        </label>
                        <p className="mt-1 text-sm text-gray-900">
                          {selectedDocument.chunk_count}
                        </p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        File Hash
                      </label>
                      <p className="mt-1 text-sm text-gray-900 font-mono break-all">
                        {selectedDocument.file_hash}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Created
                        </label>
                        <p className="mt-1 text-sm text-gray-900">
                          {new Date(selectedDocument.created_at).toLocaleString()}
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Updated
                        </label>
                        <p className="mt-1 text-sm text-gray-900">
                          {new Date(selectedDocument.updated_at).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {selectedDocument.error_message && (
                      <div>
                        <label className="block text-sm font-medium text-red-700">
                          Error Message
                        </label>
                        <div className="mt-1 text-sm text-red-600 bg-red-50 rounded p-3">
                          {selectedDocument.error_message}
                        </div>
                      </div>
                    )}

                    {selectedDocument.doc_metadata && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Metadata
                        </label>
                        <pre className="text-xs text-gray-900 bg-gray-50 rounded p-3 overflow-x-auto">
                          {JSON.stringify(
                            selectedDocument.doc_metadata,
                            null,
                            2
                          )}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    onClick={handleCloseDetails}
                    className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
