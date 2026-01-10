import { useEffect, useState } from 'react'
import { useNews, Article, type SortOrder, type TimePeriod } from './hooks/useNews'
import { useAutoSummarize } from './hooks/useAutoSummarize'
import Dashboard from './components/Dashboard'
import RefreshModal from './components/RefreshModal'

const SOURCE_TYPES = [
  { key: '', label: 'All Sources' },
  { key: 'rss', label: 'RSS Feeds' },
  { key: 'podcast', label: 'Podcasts' },
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
    refreshAllWithProgress,
    refreshProgress,
    closeRefreshModal,
    markAsRead,
    summarize
  } = useNews()

  const [selectedSource, setSelectedSource] = useState('')
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)
  const [sortOrder, setSortOrder] = useState<SortOrder>('recent')
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('week')
  const [showTimePeriodDropdown, setShowTimePeriodDropdown] = useState(false)
  const [summarizing, setSummarizing] = useState<string | null>(null)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('darkMode')
      if (saved !== null) return saved === 'true'
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return false
  })

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('darkMode', String(darkMode))
  }, [darkMode])

  useEffect(() => {
    fetchArticles(selectedSource || undefined, sortOrder, timePeriod)
  }, [fetchArticles, selectedSource, sortOrder, timePeriod])

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
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {darkMode ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>
              <button
                onClick={refreshAllWithProgress}
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

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Sort:</span>
            <button
              onClick={() => {
                setSortOrder('recent')
                setShowTimePeriodDropdown(false)
              }}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                sortOrder === 'recent'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              New
            </button>
            <div className="relative">
              <button
                onClick={() => {
                  if (sortOrder !== 'top') {
                    setSortOrder('top')
                  }
                  setShowTimePeriodDropdown(!showTimePeriodDropdown)
                }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1 ${
                  sortOrder === 'top'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                Top
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showTimePeriodDropdown && (
                <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10 min-w-[120px]">
                  {[
                    { value: 'day', label: 'Today' },
                    { value: 'week', label: 'This Week' },
                    { value: 'month', label: 'This Month' },
                    { value: 'year', label: 'This Year' },
                    { value: 'all', label: 'All Time' }
                  ].map(option => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setTimePeriod(option.value as TimePeriod)
                        setShowTimePeriodDropdown(false)
                      }}
                      className={`w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                        timePeriod === option.value
                          ? 'text-blue-600 dark:text-blue-400 font-medium'
                          : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {sortOrder === 'top' && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                ({timePeriod === 'day' ? 'Today' : timePeriod === 'week' ? 'This Week' : timePeriod === 'month' ? 'This Month' : timePeriod === 'year' ? 'This Year' : 'All Time'})
              </span>
            )}
          </div>
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

      <RefreshModal
        isOpen={refreshProgress.isOpen}
        progress={refreshProgress}
        onClose={closeRefreshModal}
      />
    </div>
  )
}
