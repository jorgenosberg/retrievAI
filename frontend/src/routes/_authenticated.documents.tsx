import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { DocumentStats } from "@/components/DocumentStats";
import { UploadZone } from "@/components/UploadZone";
import { DocumentList } from "@/components/DocumentList";
import { DocumentViewer } from "@/components/DocumentViewer";
import type { Document } from "@/types/document";
import { generateChatSessionId } from "@/lib/chatStorage";
import { useBatchDeleteDocuments } from "@/hooks/useDocuments";

export const Route = createFileRoute("/_authenticated/documents")({
  component: DocumentsPage,
});

function DocumentsPage() {
  const navigate = Route.useNavigate();
  const [showUpload, setShowUpload] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(
    null
  );
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const batchDeleteMutation = useBatchDeleteDocuments();

  const handleDocumentClick = (document: Document) => {
    setSelectedDocument(document);
  };

  const handleCloseDetails = () => {
    setSelectedDocument(null);
  };

  const handleStartNewChat = () => {
    const sessionId = generateChatSessionId();
    navigate({ to: "/chat", search: { sessionId } });
  };

  const handleToggleSelectionMode = () => {
    setSelectionMode((prev) => !prev);
    setSelectedIds(new Set());
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;

    const count = selectedIds.size;
    if (!confirm(`Are you sure you want to delete ${count} document${count > 1 ? "s" : ""}?`)) {
      return;
    }

    try {
      const result = await batchDeleteMutation.mutateAsync(Array.from(selectedIds));
      setSelectedIds(new Set());
      setSelectionMode(false);

      if (result.failed.length > 0) {
        alert(`Deleted ${result.deleted.length} document(s). ${result.failed.length} failed.`);
      }
    } catch (error: any) {
      alert(`Failed to delete documents: ${error.message}`);
    }
  };

  return (
    <div className="min-h-full bg-gray-50 dark:bg-zinc-950">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-zinc-100">
                Documents
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-zinc-500">
                Manage your document library and upload new files
              </p>
            </div>
            <div className="flex items-center space-x-3">
              {/* Selection Mode Controls */}
              {selectionMode ? (
                <>
                  <button
                    onClick={handleBatchDelete}
                    disabled={selectedIds.size === 0 || batchDeleteMutation.isPending}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-danger-600 hover:bg-danger-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <svg
                      className="w-4 h-4 mr-2"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {batchDeleteMutation.isPending
                      ? "Deleting..."
                      : `Delete${selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}`}
                  </button>
                  <button
                    onClick={handleToggleSelectionMode}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-zinc-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleToggleSelectionMode}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-zinc-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer"
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
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                      />
                    </svg>
                    Select
                  </button>
                  <button
                    onClick={handleStartNewChat}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-zinc-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer"
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
                    New Chat
                  </button>
                  <button
                    onClick={() => setShowUpload(!showUpload)}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-400 cursor-pointer"
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
                    {showUpload ? "Hide Upload" : "Upload Files"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Statistics */}
        <DocumentStats />

        {/* Upload Zone */}
        <div className={`mb-6 ${showUpload ? "" : "hidden"}`}>
          <UploadZone />
        </div>

        {/* Document List */}
        <DocumentList
          onDocumentClick={handleDocumentClick}
          selectionMode={selectionMode}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />

        {selectedDocument && (
          <DocumentViewer
            document={selectedDocument}
            onClose={handleCloseDetails}
            onStartChat={handleStartNewChat}
          />
        )}
      </div>
    </div>
  );
}
