import React from 'react'
import ReactMarkdown from 'react-markdown'

interface CitationReferenceProps {
  id: string
  index: number
  onClick: (id: string) => void
}

const CitationReference = ({ id, index, onClick }: CitationReferenceProps) => {
  return (
    <button
      onClick={() => onClick(id)}
      className="hover:cursor-pointer inline-flex items-center justify-center text-xs font-medium h-5 ml-1 px-1.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
      aria-label={`Citation ${index + 1}`}
    >
      {index + 1}
    </button>
  )
}

interface MessageContentProps {
  content: string
  citations?: Array<{ id: string; document_title: string; text: string; confidence: number }>
  onCitationClick: (id: string | null) => void
}

const MessageContent: React.FC<MessageContentProps> = ({
  content,
  citations = [],
  onCitationClick
}) => {
  // This regex will match citation references like [1], [2], etc.
  const citationRegex = /\[(\d+)\]/g

  // Process the content to replace citation references with components
  const processContent = () => {
    if (!citations.length) return content

    // Map of citation index to citation id
    const citationIndexMap = citations.reduce(
      (acc, citation, index) => {
        acc[index + 1] = citation.id
        return acc
      },
      {} as Record<number, string>
    )

    // Split content by citation references
    const parts = content.split(citationRegex)

    if (parts.length <= 1) return content

    const result: React.ReactNode[] = []

    // Rebuild content with citation components
    for (let i = 0; i < parts.length; i++) {
      // Add text part
      result.push(parts[i])

      // If there's a citation index after this part
      if (i < parts.length - 1 && !isNaN(Number(parts[i + 1]))) {
        const citationIndex = Number(parts[i + 1])
        const citationId = citationIndexMap[citationIndex]

        if (citationId) {
          result.push(
            <CitationReference
              key={`citation-${citationIndex}`}
              id={citationId}
              index={citationIndex - 1}
              onClick={onCitationClick}
            />
          )
        }

        // Skip the citation index part
        i++
      }
    }

    return result
  }

  // Custom renderer components for markdown with proper typings
  const components: React.ComponentProps<typeof ReactMarkdown>['components'] = {
    p: ({ children }) => <p className="mb-4 last:mb-0">{children}</p>,
    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    ul: ({ children }) => <ul className="list-disc pl-6 mb-4 last:mb-0">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal pl-6 mb-4 last:mb-0">{children}</ol>,
    li: ({ children }) => <li className="mb-1 last:mb-0">{children}</li>,
    a: ({ href, children, ...props }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline hover:text-primary/80 transition-colors"
        {...props}
      >
        {children}
      </a>
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    code: ({ inline, children, ...props }: any) => {
      return inline ? (
        <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
          {children}
        </code>
      ) : (
        <pre className="bg-muted p-3 rounded-md overflow-x-auto mb-4 last:mb-0">
          <code className="text-sm font-mono" {...props}>
            {children}
          </code>
        </pre>
      )
    },
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-muted-foreground/20 pl-4 italic mb-4 last:mb-0">
        {children}
      </blockquote>
    )
  }

  // For simple content without citations, use ReactMarkdown directly
  if (!citations.length) {
    return (
      <div className="whitespace-pre-wrap break-words">
        <ReactMarkdown components={components}>{content}</ReactMarkdown>
      </div>
    )
  }

  // For content with citations, process the content first
  const processedContent = processContent()

  if (typeof processedContent === 'string') {
    return (
      <div className="whitespace-pre-wrap break-words">
        <ReactMarkdown components={components}>{processedContent}</ReactMarkdown>
      </div>
    )
  }

  // If we have React nodes after processing
  return <div className="whitespace-pre-wrap break-words">{processedContent}</div>
}

export default MessageContent
