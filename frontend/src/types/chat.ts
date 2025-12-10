// Chat-related types

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  isStreaming?: boolean;
  timestamp?: number;
}

export interface Source {
  content: string;
  metadata: {
    source: string;
    page?: number;
    file_hash?: string;
    title?: string;
    doc_num?: number;
  };
}

// SSE Event types from backend
export interface SSEEvent {
  type:
    | "start"
    | "retrieving"
    | "sources"
    | "thinking"
    | "token"
    | "done"
    | "saved"
    | "error";
  content: any;
}

export interface StartEvent {
  type: "start";
  content: {
    query: string;
    timestamp: string;
  };
}

export interface RetrievingEvent {
  type: "retrieving";
  content: {
    message: string;
  };
}

export interface SourcesEvent {
  type: "sources";
  content: {
    sources: Source[];
    count: number;
  };
}

export interface ThinkingEvent {
  type: "thinking";
  content: {
    message: string;
  };
}

export interface TokenEvent {
  type: "token";
  content: string;
}

export interface DoneEvent {
  type: "done";
  content: {
    answer: string;
    token_count: number;
    sources_retrieved: number;
    timestamp: string;
  };
}

export interface SavedEvent {
  type: "saved";
  content: {
    message_id: number;
    conversation_id: string;
  };
}

export interface ErrorEvent {
  type: "error";
  content: {
    message: string;
    error_type: string;
  };
}

export interface Conversation {
  id: string;
  user_id: number;
  title?: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationWithMessages {
  conversation: Conversation;
  messages: {
    id: number;
    conversation_id: string;
    role: "user" | "assistant";
    content: string;
    sources?: { sources: Source[] };
    created_at: string;
  }[];
}
