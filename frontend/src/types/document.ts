/**
 * Document-related TypeScript types
 * Matches backend SQLModel schemas
 */

export enum DocumentStatus {
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export interface Document {
  id: number;
  file_hash: string;
  filename: string;
  file_size: number | null;
  mime_type: string | null;
  chunk_count: number;
  status: DocumentStatus;
  error_message: string | null;
  doc_metadata: Record<string, any> | null;
  uploaded_by: number;
  created_at: string;
  updated_at: string;
}

export interface DocumentStats {
  total_documents: number;
  total_chunks: number;
  by_status: Record<string, number>;
  storage_used_bytes: number;
  storage_used_mb: number;
}

export interface UploadResponse {
  file_hash: string;
  document_id: number;
  job_id: string;
  status: string;
  message: string;
}

export interface UploadStatus {
  file_hash: string;
  document_id: number;
  status: "queued" | "running" | "completed" | "failed" | "unknown";
  progress: number;
  message: string;
  error: string | null;
  chunk_count: number;
  db_status: string;
}

export interface SupportedTypes {
  extensions: string[];
  max_size_bytes: number;
  max_size_mb: number;
}

export interface DeleteDocumentResponse {
  message: string;
  document_id: number;
  chunks_deleted: number;
}

export interface SearchResult {
  query: string;
  results: Array<{
    id: string;
    score: number;
    content: string;
    metadata: Record<string, any>;
  }>;
  count: number;
}
