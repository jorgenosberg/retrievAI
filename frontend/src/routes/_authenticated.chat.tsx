import { createFileRoute } from '@tanstack/react-router'
import { useState, useRef, useEffect } from 'react'
import { apiClient } from '@/lib/api'
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
    <div className="flex h-screen bg-gray-100">
      <div className="w-64 bg-white border-r border-gray-200 p-4 flex flex-col">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">RetrievAI</h1>
        </div>

        <button
          onClick={handleNewChat}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 mb-4"
        >
          New Chat
        </button>

        <nav className="space-y-1 flex-1">
          <a href="/chat" className="block px-3 py-2 text-gray-700 bg-gray-100 rounded-md">Chat</a>
          <a href="/documents" className="block px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-md">Documents</a>
          <a href="/settings" className="block px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-md">Settings</a>
        </nav>

        <button onClick={() => { apiClient.logout(); window.location.href = '/login' }} className="w-full text-red-600 hover:bg-red-50 py-2 px-4 rounded-md mt-4">
          Logout
        </button>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && !streamingMessage ? (
            <div className="h-full flex items-center justify-center text-gray-500">
              <div className="text-center">
                <h2 className="text-2xl font-semibold mb-2">Welcome to RetrievAI</h2>
                <p>Ask me anything about your documents!</p>
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-3xl ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white text-gray-900 border border-gray-200'} rounded-lg px-4 py-3`}>
                    {msg.role === 'user' ? (
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    ) : (
                      <MessageContent content={msg.content} sources={msg.sources} />
                    )}
                    {msg.role === 'assistant' && (
                      <MessageUtilities
                        content={msg.content}
                        sources={msg.sources}
                        onCopy={() => console.log('Copied message')}
                        onExpandSource={(source) => setExpandedSource(source)}
                      />
                    )}
                  </div>
                </div>
              ))}

              {/* Streaming message */}
              {(streamingMessage || statusMessage) && (
                <div className="flex justify-start">
                  <div className="max-w-3xl bg-white text-gray-900 border border-gray-200 rounded-lg px-4 py-3">
                    {statusMessage && !streamingMessage && (
                      <div className="text-sm text-gray-500 italic flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {statusMessage}
                      </div>
                    )}
                    {streamingMessage && (
                      <div className="flex items-start">
                        <MessageContent content={streamingMessage} sources={streamingSources} />
                        <span className="inline-block w-1 h-4 bg-blue-600 animate-pulse ml-1 mt-1"></span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {error && (
          <div className="bg-red-50 border-t border-red-200 px-4 py-2 text-sm text-red-700">
            Error: {error}
          </div>
        )}

        <div className="border-t border-gray-200 bg-white p-4">
          <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question..."
                disabled={isStreaming}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <button
                type="submit"
                disabled={isStreaming || !input.trim()}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isStreaming ? 'Streaming...' : 'Send'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Source Context Modal */}
      {expandedSource && (
        <SourceContextModal
          source={expandedSource}
          onClose={() => setExpandedSource(null)}
        />
      )}
    </div>
  )
}
