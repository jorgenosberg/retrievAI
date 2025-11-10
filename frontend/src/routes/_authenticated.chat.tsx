import { createFileRoute } from '@tanstack/react-router'
import { useState, useRef, useEffect } from 'react'
import { useChat } from '@/hooks/useChat'
import { MessageContent } from '@/components/MessageContent'
import { SourceContextModal } from '@/components/SourceContextModal'
import type { Source } from '@/types/chat'

export const Route = createFileRoute('/_authenticated/chat')({
  component: ChatPage,
})

function SourceCard({ source, index, onExpand }: { source: Source; index: number; onExpand?: () => void }) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm">
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2 flex-1">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold">
            {index + 1}
          </span>
          <span className="font-medium text-blue-900">{source.metadata.title || source.metadata.source}</span>
        </div>
        <div className="flex items-center gap-2 ml-2">
          {source.metadata.page && (
            <span className="text-blue-600 text-xs">Page {source.metadata.page}</span>
          )}
          {onExpand && (
            <button
              onClick={onExpand}
              className="text-blue-600 hover:text-blue-800 hover:bg-blue-100 p-1 rounded transition-colors"
              title="View full context"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
          )}
        </div>
      </div>
      <p className="text-gray-700 text-xs mt-2 line-clamp-3">{source.content}</p>
    </div>
  )
}

function MessageUtilities({
  content,
  sources,
  onCopy,
  onExpandSource,
}: {
  content: string
  sources?: Source[]
  onCopy: () => void
  onExpandSource?: (source: Source) => void
}) {
  const [showSources, setShowSources] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    onCopy()
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-200">
      <div className="flex items-center gap-2">
        <button
          onClick={handleCopy}
          className="text-xs text-gray-600 hover:text-gray-900 flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
          title="Copy message"
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Copied!</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            className="text-xs text-gray-600 hover:text-gray-900 flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
            title="View sources"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <span>
              {showSources ? 'Hide' : 'Show'} sources ({sources.length})
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
              onExpand={onExpandSource ? () => onExpandSource(source) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ChatPage() {
  const [input, setInput] = useState('')
  const [expandedSource, setExpandedSource] = useState<Source | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const {
    messages,
    isStreaming,
    streamingMessage,
    streamingSources,
    statusMessage,
    error,
    sendMessage,
    clearMessages,
  } = useChat()

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingMessage])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isStreaming) return

    await sendMessage(input)
    setInput('')
  }

  const handleNewChat = () => {
    clearMessages()
  }

  return (
    <div className="flex min-h-full flex-col bg-gray-100">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Chat</h1>
            <p className="text-sm text-gray-500">Ask grounded questions about your uploaded corpus.</p>
          </div>
          <button
            onClick={handleNewChat}
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            New Chat
          </button>
        </div>

        <div className="space-y-4">
          {messages.length === 0 && !streamingMessage ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-gray-600">
              <h2 className="text-xl font-semibold text-gray-900">Welcome to RetrievAI</h2>
              <p className="mt-2 text-sm">
                Your assistant is ready. Start the conversation by asking anything about your documents.
              </p>
            </div>
          ) : (
            <>
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-3xl rounded-lg px-4 py-3 shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'border border-gray-200 bg-white text-gray-900'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    ) : (
                      <>
                        <MessageContent content={msg.content} sources={msg.sources} />
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
                  <div className="max-w-3xl rounded-lg border border-gray-200 bg-white px-4 py-3 text-gray-900 shadow-sm">
                    {statusMessage && !streamingMessage && (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <svg className="h-4 w-4 animate-spin text-blue-600" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
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
                      <div className="flex items-start">
                        <MessageContent content={streamingMessage} sources={streamingSources} />
                        <span className="ml-1 mt-1 inline-block h-4 w-1 animate-pulse rounded-full bg-blue-600" />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div ref={messagesEndRef} />
      </div>

      {error && (
        <div className="border-t border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          Error: {error}
        </div>
      )}

      <div className="border-t border-gray-200 bg-white p-4">
        <form onSubmit={handleSubmit} className="mx-auto flex max-w-4xl flex-col gap-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question..."
              disabled={isStreaming}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
            />
            <button
              type="submit"
              disabled={isStreaming || !input.trim()}
              className="rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {isStreaming ? 'Streaming...' : 'Send'}
            </button>
          </div>
          <p className="text-xs text-gray-500">Press Enter to send. Use Shift + Enter for a new line.</p>
        </form>
      </div>

      {expandedSource && (
        <SourceContextModal source={expandedSource} onClose={() => setExpandedSource(null)} />
      )}
    </div>
  )
}
