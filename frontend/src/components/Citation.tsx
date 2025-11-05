import { useState } from 'react'
import type { Source } from '@/types/chat'

interface CitationProps {
  number: number
  source?: Source
}

export function Citation({ number, source }: CitationProps) {
  const [showTooltip, setShowTooltip] = useState(false)

  if (!source) {
    // Citation without a matching source - just show the number
    return (
      <sup className="text-blue-600 font-semibold cursor-not-allowed opacity-50">
        [{number}]
      </sup>
    )
  }

  return (
    <span className="relative inline-block">
      <sup
        className="text-blue-600 font-semibold cursor-help hover:bg-blue-100 px-0.5 rounded transition-colors"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        [{number}]
      </sup>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-80 max-w-sm">
          <div className="bg-gray-900 text-white text-xs rounded-lg shadow-lg p-3">
            {/* Arrow pointing down */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
              <div className="border-8 border-transparent border-t-gray-900"></div>
            </div>

            {/* Source info */}
            <div className="space-y-1.5">
              <div className="font-semibold text-blue-300">
                {source.metadata.title || source.metadata.source}
              </div>
              {source.metadata.page && (
                <div className="text-gray-400 text-xs">Page {source.metadata.page}</div>
              )}
              <div className="text-gray-200 leading-relaxed max-h-32 overflow-y-auto">
                {source.content.substring(0, 200)}
                {source.content.length > 200 && '...'}
              </div>
            </div>
          </div>
        </div>
      )}
    </span>
  )
}
