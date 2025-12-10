# Uploading Documents

## Supported Formats

RetrievAI supports the following document types:

- **PDF** (`.pdf`)
- **Word** (`.docx`)
- **Plain Text** (`.txt`)
- **Markdown** (`.md`)

## Upload Process

1. Navigate to the **Documents** section
2. Click **Upload** or drag and drop files
3. Wait for processing to complete

## Processing Pipeline

When you upload a document, it goes through:

1. **Extraction** — Text is extracted from the document
2. **Chunking** — Content is split into semantic chunks
3. **Embedding** — Each chunk is converted to a vector embedding
4. **Indexing** — Embeddings are stored in ChromaDB for retrieval

!!! info "Processing Time"
    Large documents may take a few minutes to process. You can monitor progress in the Documents view.

## Document Management

### Viewing Documents

The Documents page shows all uploaded documents with:

- File name and type
- Upload date
- Processing status
- Chunk count

### Deleting Documents

To delete a document:

1. Select the document
2. Click the delete icon
3. Confirm deletion

!!! warning
    Deleting a document removes all associated chunks and embeddings. This cannot be undone.
