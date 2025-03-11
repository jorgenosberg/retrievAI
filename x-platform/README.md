# RetrievAI - Cross-Platform RAG Application

A cross-platform electron application for document retrieval and querying using RAG (Retrieval Augmented Generation).

## Features
- Document ingestion with support for multiple file types (txt, md, pdf, docx)
- Embedding generation using OpenAI or HuggingFace models
- Vector storage using ChromaDB
- RAG-based document query system with citation support
- Chat history and document management
- Live progress updates for document processing
- SQLite database for metadata and settings
- Zustand-based UI state management

## Technical Architecture

### Backend Services

#### Database Service
- Uses better-sqlite3 for fast and reliable data storage
- Stores document metadata, chat history, and application settings
- Manages relations between chats, messages, and citations

#### Document Processing
- Uses LangChain's document loaders for parsing different file types
- Implements RecursiveCharacterTextSplitter for effective text chunking
- Reports real-time progress of document processing stages (loading, splitting, indexing)
- Manages document metadata and tags

#### Vector Store Service
- Uses Chroma from LangChain for vector storage
- Provides methods for document indexing and similarity search
- Supports filtering by document ID for targeted searches
- Configurable similarity threshold and result limits

#### Settings Service
- Manages API keys for LLM providers
- Handles configuration for models, embeddings, and RAG parameters
- Provides defaults and persistence for user preferences

#### Chat Service
- Manages conversation history and message persistence
- Implements RAG-based query execution with LangChain
- Supports different LLM providers (OpenAI, Anthropic)
- Extracts and manages citations from responses

## Project Setup

### Install

```bash
$ npm install
```

### Development

```bash
$ npm run dev
```

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```

## Frontend & IPC Communication

The frontend uses React with a robust IPC communication layer to interact with the Electron main process. Key aspects include:

1. **Preload API**: Exposes a well-defined API for the renderer process to interact with main process services
2. **Progress Updates**: Real-time progress updates for long-running tasks like document processing
3. **Error Handling**: Consistent error handling pattern across all API calls
4. **Type Safety**: Full TypeScript interfaces for all API communication

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Design Choices

The key design choices in this implementation include:

1. **Modular Service Architecture**: Each major component (database, documents, vectorstore, chat, settings) is implemented as a separate service with a clear API
2. **Real-time Progress Updates**: Document processing provides granular progress updates to improve user experience
3. **Separation of Embedding and LLM Models**: Documents are indexed with embedding models separate from the chat models, allowing flexibility in model selection
4. **Citation Tracking**: The system tracks citations from RAG responses and links them to source documents
5. **Persistent Storage**: All data is persistently stored in SQLite and Chroma vectorstore

The application is designed to be cross-platform, with a clean separation between the frontend UI components and the backend services. This allows for future extension with minimal changes to the core architecture.
