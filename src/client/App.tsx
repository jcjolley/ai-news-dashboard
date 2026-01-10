import { useEffect, useState } from 'react'
import { useNews, Article } from './hooks/useNews'
import { useAutoSummarize } from './hooks/useAutoSummarize'
import Dashboard from './components/Dashboard'

const SOURCE_TYPES = [
  { key: '', label: 'All Sources' },
  { key: 'rss', label: 'RSS Feeds' },
  { key: 'reddit', label: 'Reddit' },
  { key: 'hackernews', label: 'Hacker News' },
  { key: 'youtube', label: 'YouTube' }
]

export default function App() {
  const {
    articles,
    loading,
    refreshing,
    error,
    fetchArticles,
    refreshAll,
    markAsRead,
    summarize
  } = useNews()

  const [selectedSource, setSelectedSource] = useState('')
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)
  const [summarizing, setSummarizing] = useState<string | null>(null)
  const [summaryError, setSummaryError] = useState<string | null>(null)

  useEffect(() => {
    fetchArticles(selectedSource || undefined)
  }, [fetchArticles, selectedSource])

  const filteredArticles = showUnreadOnly
    ? articles.filter(a => a.is_read === 0)
    : articles

  const {
    registerRef,
    isAutoSummarizing,
    currentArticleId: autoSummarizingId,
    progress: autoSummarizeProgress
  } = useAutoSummarize(filteredArticles, summarize)

  const handleSummarize = async (article: Article) => {
    setSummarizing(article.id)
    setSummaryError(null)
    try {
      await summarize(article.id)
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : 'Failed to summarize')
    } finally {
      setSummarizing(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              AI News Dashboard
            </h1>
            <div className="flex items-center gap-4">
              {isAutoSummarizing && (
                <span className="text-sm text-purple-600 dark:text-purple-400">
                  Summarizing {autoSummarizeProgress.current + 1}/{autoSummarizeProgress.total}...
                </span>
              )}
              <button
                onClick={refreshAll}
                disabled={refreshing}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {refreshing ? 'Refreshing...' : 'Refresh All'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-4 p-4 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-lg">
            {error}
          </div>
        )}

        {summaryError && (
          <div className="mb-4 p-4 bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-200 rounded-lg">
            {summaryError}
          </div>
        )}

        <div className="mb-6 flex flex-wrap gap-4 items-center">
          <div className="flex gap-2 flex-wrap">
            {SOURCE_TYPES.map(source => (
              <button
                key={source.key}
                onClick={() => setSelectedSource(source.key)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selectedSource === source.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {source.label}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={showUnreadOnly}
              onChange={e => setShowUnreadOnly(e.target.checked)}
              className="rounded"
            />
            Unread only
          </label>
        </div>

        <Dashboard
          articles={filteredArticles}
          loading={loading}
          onMarkAsRead={markAsRead}
          onSummarize={handleSummarize}
          summarizing={summarizing}
          autoSummarizingId={autoSummarizingId}
          registerRef={registerRef}
        />
      </main>
    </div>
  )
}
