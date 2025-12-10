import { Citation } from './Citation'
import { parseMessageWithCitations, getSourceByCitation } from '@/lib/citations'
import type { Source } from '@/types/chat'

interface MessageContentProps {
  content: string
  sources?: Source[]
  showCursor?: boolean
}

const StreamingCursor = () => (
  <span className="ml-0.5 inline-block h-4 w-1 animate-pulse rounded-full bg-primary-600 align-middle dark:bg-primary-400" />
)

export function MessageContent({ content, sources, showCursor }: MessageContentProps) {
  // If no sources, just render plain text
  if (!sources || sources.length === 0) {
    return (
      <div className="whitespace-pre-wrap">
        {content}
        {showCursor && <StreamingCursor />}
      </div>
    )
  }

  // Parse content to extract citations
  const parts = parseMessageWithCitations(content)

  return (
    <div className="whitespace-pre-wrap">
      {parts.map((part, idx) => {
        if (part.type === 'text') {
          return <span key={idx}>{part.content}</span>
        } else if (part.type === 'citation' && part.citationNumber) {
          const source = getSourceByCitation(sources, part.citationNumber)
          return <Citation key={idx} number={part.citationNumber} source={source} />
        }
        return null
      })}
      {showCursor && <StreamingCursor />}
    </div>
  )
}
