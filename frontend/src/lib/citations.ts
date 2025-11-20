import type { Source } from '@/types/chat'

export interface ParsedContent {
  type: 'text' | 'citation'
  content: string
  citationNumber?: number
}

/**
 * Parse message content to extract inline citations like [1], [2], etc.
 * Returns an array of text segments and citation markers.
 */
export function parseMessageWithCitations(content: string): ParsedContent[] {
  const parts: ParsedContent[] = []
  const citationRegex = /\[(\d+)\]/g

  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = citationRegex.exec(content)) !== null) {
    // Add text before citation if any
    if (match.index > lastIndex) {
      const textContent = content.substring(lastIndex, match.index)
      if (textContent) {
        parts.push({
          type: 'text',
          content: textContent,
        })
      }
    }

    // Add citation
    parts.push({
      type: 'citation',
      content: match[0], // e.g., "[1]"
      citationNumber: parseInt(match[1], 10), // e.g., 1
    })

    lastIndex = match.index + match[0].length
  }

  // Add remaining text after last citation
  if (lastIndex < content.length) {
    parts.push({
      type: 'text',
      content: content.substring(lastIndex),
    })
  }

  // If no citations found, return entire content as single text part
  if (parts.length === 0) {
    parts.push({
      type: 'text',
      content,
    })
  }

  return parts
}

/**
 * Get source by citation number (1-indexed)
 */
export function getSourceByCitation(sources: Source[], citationNumber: number): Source | undefined {
  // Try to find by doc_num first (if available)
  const byDocNum = sources.find(s => s.metadata.doc_num === citationNumber)
  if (byDocNum) return byDocNum

  // Fallback to array index (0-indexed, so subtract 1)
  return sources[citationNumber - 1]
}
