import { useState, useEffect, useRef } from 'react'
import { Article } from '../hooks/useNews'

interface ArticleItemProps {
  article: Article
  onMarkAsRead: (id: string) => void
  onSummarize: (article: Article) => void
  isSummarizing: boolean
  isAutoSummarizing?: boolean
  registerRef?: (id: string, element: HTMLElement | null) => void
}

const SOURCE_COLORS: Record<string, string> = {
  rss: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  podcast: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  reddit: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  hackernews: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  youtube: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200'
}

function formatDate(dateString: string | null): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(hours / 24)

  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}

export default function ArticleItem({
  article,
  onMarkAsRead,
  onSummarize,
  isSummarizing,
  isAutoSummarizing = false,
  registerRef
}: ArticleItemProps) {
  const [expanded, setExpanded] = useState(false)
  const elementRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (registerRef && elementRef.current) {
      registerRef(article.id, elementRef.current)
      return () => registerRef(article.id, null)
    }
  }, [article.id, registerRef])

  const handleClick = () => {
    if (article.is_read === 0) {
      onMarkAsRead(article.id)
    }
    window.open(article.url, '_blank')
  }

  const colorClass = SOURCE_COLORS[article.source_type] || 'bg-gray-100 text-gray-800'

  return (
    <div
      ref={elementRef}
      data-article-id={article.id}
      className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 transition-all ${
        article.is_read ? 'opacity-60' : ''
      }`}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
                {article.source_name}
              </span>
              {article.author && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  by {article.author}
                </span>
              )}
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {formatDate(article.published_at)}
              </span>
            </div>
            <h3
              onClick={handleClick}
              className="text-lg font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer line-clamp-2"
            >
              {article.title}
            </h3>
          </div>
        </div>

        {(article.content || article.summary) && (
          <div className="mt-2">
            {article.summary && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg mb-2">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>AI Summary:</strong> {article.summary}
                </p>
              </div>
            )}
            {article.content && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                {expanded ? 'Hide content' : 'Show content'}
              </button>
            )}
            {expanded && article.content && (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 line-clamp-6">
                {article.content.replace(/<[^>]*>/g, '')}
              </p>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={handleClick}
            className="text-sm px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Open
          </button>
          {!article.summary && (
            <button
              onClick={() => onSummarize(article)}
              disabled={isSummarizing || isAutoSummarizing}
              className="text-sm px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-200 dark:hover:bg-purple-800 disabled:opacity-50 transition-colors"
            >
              {isAutoSummarizing ? 'Auto-summarizing...' : isSummarizing ? 'Summarizing...' : 'Summarize'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
