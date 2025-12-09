export interface ChunkMetadata {
  source: string
  page?: number
  file_hash?: string
  title?: string
}

export interface Chunk {
  content: string
  metadata: ChunkMetadata
}

export interface ChunkListResponse {
  chunks: Chunk[]
  total: number
  limit: number
  offset: number
  has_more: boolean
}
