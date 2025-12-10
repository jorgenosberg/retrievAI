import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useChat } from "@/hooks/useChat";
import { MessageContent } from "@/components/MessageContent";
import { SourceContextModal } from "@/components/SourceContextModal";
import type { Source } from "@/types/chat";
import { generateChatSessionId } from "@/lib/chatStorage";
import { getStoredPreferences } from "@/lib/preferencesStorage";

export const Route = createFileRoute("/_authenticated/chat")({
  validateSearch: (search) => ({
    sessionId:
      typeof search.sessionId === "string" && search.sessionId.trim().length > 0
        ? search.sessionId
        : "default",
  }),
  component: ChatPage,
});

function SourceCard({
  source,
  index,
  onExpand,
}: {
  source: Source;
  index: number;
  onExpand?: () => void;
}) {
  return (
    <div className="rounded-md border border-primary-200 bg-primary-50 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-800">
      <div className="mb-1 flex items-start gap-2">
        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white dark:bg-primary-500">
          {index + 1}
        </span>
        <span className="min-w-0 flex-1 truncate font-medium text-primary-900 dark:text-primary-100">
          {source.metadata.title || source.metadata.source}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          {source.metadata.page && (
            <span className="whitespace-nowrap text-xs text-primary-600 dark:text-primary-200">
              Page {source.metadata.page}
            </span>
          )}
          {onExpand && (
            <button
              onClick={onExpand}
              className="rounded p-1 text-primary-600 transition-colors hover:bg-primary-100 hover:text-primary-800 dark:text-primary-200 dark:hover:bg-zinc-700 dark:hover:text-primary-100 cursor-pointer"
              title="View full context"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
      <p className="mt-2 line-clamp-3 text-xs text-gray-700 dark:text-zinc-300">
        {source.content}
      </p>
    </div>
  );
}

function MessageUtilities({
  content,
  sources,
  onCopy,
  onExpandSource,
}: {
  content: string;
  sources?: Source[];
  onCopy: () => void;
  onExpandSource?: (source: Source) => void;
}) {
  const [showSources, setShowSources] = useState(
    () => getStoredPreferences().show_sources
  );
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    onCopy();
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-3 border-t border-gray-200 pt-3 dark:border-zinc-700">
      <div className="flex items-center gap-2">
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white cursor-pointer"
          title="Copy message"
        >
          {copied ? (
            <>
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span>Copied!</span>
            </>
          ) : (
            <>
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              <span>Copy</span>
            </>
          )}
        </button>
        {sources && sources.length > 0 && (
          <button
            onClick={() => setShowSources(!showSources)}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white cursor-pointer"
            title="View sources"
          >
            <svg
              className="w-3.5 h-3.5"
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
            <span>
              {showSources ? "Hide" : "Show"} sources ({sources.length})
            </span>
          </button>
        )}
      </div>
      {showSources && sources && sources.length > 0 && (
        <div className="mt-3 space-y-2 animate-in slide-in-from-top-2 duration-200">
          {sources.map((source, idx) => (
            <SourceCard
              key={idx}
              source={source}
              index={idx}
              onExpand={
                onExpandSource ? () => onExpandSource(source) : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ChatPage() {
  const [input, setInput] = useState("");
  const [expandedSource, setExpandedSource] = useState<Source | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pendingMessageRef = useRef<string | null>(null);
  const { sessionId } = Route.useSearch();
  const navigate = Route.useNavigate();
  const {
    messages,
    isStreaming,
    streamingMessage,
    streamingSources,
    statusMessage,
    error,
    sendMessage,
  } = useChat(sessionId);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingMessage]);

  // Autofocus input when page loads or session changes
  useEffect(() => {
    inputRef.current?.focus();
  }, [sessionId]);

  // Auto-resize textarea as user types
  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [input]);

  // Detect scroll position to show/hide scroll-to-bottom button
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(
        !isNearBottom && (messages.length > 0 || !!streamingMessage)
      );
    };

    container.addEventListener("scroll", handleScroll);
    handleScroll(); // Check initial state

    return () => container.removeEventListener("scroll", handleScroll);
  }, [messages.length, streamingMessage]);

  // Clear pending message when sessionId changes (except when transitioning from default)
  const previousSessionIdRef = useRef(sessionId);
  useEffect(() => {
    const previousSessionId = previousSessionIdRef.current;
    previousSessionIdRef.current = sessionId;

    // If we're navigating from a non-default session to another session, clear pending message
    if (previousSessionId !== "default" && previousSessionId !== sessionId) {
      pendingMessageRef.current = null;
    }
  }, [sessionId]);

  // Handle sending pending message after navigation from default to new session
  useEffect(() => {
    if (
      sessionId !== "default" &&
      messages.length === 0 &&
      pendingMessageRef.current
    ) {
      const message = pendingMessageRef.current;
      pendingMessageRef.current = null;
      // Use setTimeout to avoid dependency on sendMessage
      setTimeout(() => sendMessage(message), 0);
    }
  }, [sessionId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    // If this is the default session and the first message, create a new session
    if (sessionId === "default" && messages.length === 0) {
      pendingMessageRef.current = input.trim();
      setInput("");
      const newSessionId = generateChatSessionId();
      navigate({
        to: "/chat",
        search: { sessionId: newSessionId },
        replace: true,
      });
      return;
    }

    const messageToSend = input;
    setInput(""); // Clear input immediately for better UX
    await sendMessage(messageToSend);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter") return;

    const { auto_send } = getStoredPreferences();
    if (auto_send && !e.shiftKey) {
      // Auto-send enabled: Enter sends, Shift+Enter is newline
      e.preventDefault();
      handleSubmit(e);
    }
    // Auto-send disabled: Enter is newline (default), button sends
  };

  const handleNewChat = () => {
    const nextSessionId = generateChatSessionId();
    navigate({
      to: "/chat",
      search: { sessionId: nextSessionId },
    });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="relative flex h-full flex-col bg-gray-100 text-gray-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div
        ref={messagesContainerRef}
        className={`flex-1 overflow-y-auto pb-0 ${messages.length === 0 && !streamingMessage ? "p-6" : "px-6 pt-4"}`}
      >
        {messages.length === 0 && !streamingMessage && (
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-zinc-100">
                Chat
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-zinc-500">
                Ask grounded questions about your uploaded corpus.
              </p>
            </div>
            <button
              onClick={handleNewChat}
              className="inline-flex items-center justify-center rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-400 cursor-pointer"
            >
              New Chat
            </button>
          </div>
        )}

        <div className="space-y-4 pb-6">
          {messages.length === 0 && !streamingMessage ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-gray-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Welcome to RetrievAI
              </h2>
              <p className="mt-2 text-sm text-gray-600 dark:text-zinc-400">
                Your assistant is ready. Start the conversation by asking
                anything about your documents.
              </p>
            </div>
          ) : (
            <>
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-3xl rounded-lg px-4 py-3 shadow-sm ${
                      msg.role === "user"
                        ? "bg-primary-600 text-white dark:bg-primary-500"
                        : "border border-gray-200 bg-white text-gray-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    ) : (
                      <>
                        <MessageContent
                          content={msg.content}
                          sources={msg.sources}
                        />
                        <MessageUtilities
                          content={msg.content}
                          sources={msg.sources}
                          onCopy={() => {}}
                          onExpandSource={(source) => setExpandedSource(source)}
                        />
                      </>
                    )}
                  </div>
                </div>
              ))}

              {(streamingMessage || statusMessage) && (
                <div className="flex justify-start">
                  <div className="max-w-3xl rounded-lg border border-gray-200 bg-white px-4 py-3 text-gray-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
                    {statusMessage && !streamingMessage && (
                      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-zinc-400">
                        <svg
                          className="h-4 w-4 animate-spin text-primary-600 dark:text-primary-400"
                          viewBox="0 0 24 24"
                          fill="none"
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
                          />
                        </svg>
                        {statusMessage}
                      </div>
                    )}
                    {streamingMessage && (
                      <MessageContent
                        content={streamingMessage}
                        sources={streamingSources}
                        showCursor
                      />
                    )}
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Scroll to bottom button - positioned above the input area */}
      {showScrollButton && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-24 right-6 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg transition-all hover:bg-primary-700 hover:shadow-xl dark:bg-primary-500 dark:hover:bg-primary-400 cursor-pointer"
          title="Scroll to bottom"
          aria-label="Scroll to bottom"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        </button>
      )}

      <div className="shrink-0">
        {error && (
          <div className="border-t border-danger-200 bg-danger-50 px-4 py-2 text-sm text-danger-700 dark:border-danger-500/40 dark:bg-danger-500/10 dark:text-danger-200">
            Error: {error}
          </div>
        )}

        <div className="border-t border-gray-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <form
            onSubmit={handleSubmit}
            className="mx-auto flex max-w-4xl flex-col gap-3"
          >
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question..."
                disabled={isStreaming}
                rows={1}
                className="flex-1 resize-none rounded-lg border border-gray-300 px-4 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed disabled:bg-gray-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-primary-400 dark:focus:ring-primary-400 dark:disabled:bg-zinc-800"
                style={{ minHeight: "42px", maxHeight: "200px" }}
              />
              <button
                type="submit"
                disabled={isStreaming || !input.trim()}
                className={`shrink-0 rounded-lg bg-primary-600 px-6 py-2 font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-400 dark:bg-primary-500 dark:hover:bg-primary-400 dark:disabled:bg-zinc-700 ${isStreaming ? "cursor-progress" : "cursor-pointer"}`}
              >
                {isStreaming ? "Streaming..." : "Send"}
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-zinc-400">
              {getStoredPreferences().auto_send
                ? "Enter to send, Shift + Enter for new line."
                : "Enter for new line, click Send to submit."}
            </p>
          </form>
        </div>
      </div>

      {expandedSource && (
        <SourceContextModal
          source={expandedSource}
          onClose={() => setExpandedSource(null)}
        />
      )}
    </div>
  );
}
