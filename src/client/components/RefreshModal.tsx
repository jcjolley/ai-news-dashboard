export interface RefreshProgress {
  isOpen: boolean
  currentSource: string
  completedSources: { name: string; count: number; error?: string }[]
  totalSources: number
  engagementStatus: 'pending' | 'calculating' | 'complete'
}

const SOURCE_ORDER = ['RSS Feeds', 'Podcasts', 'Reddit', 'Hacker News', 'YouTube']

interface RefreshModalProps {
  isOpen: boolean
  progress: RefreshProgress
  onClose: () => void
}

export default function RefreshModal({ isOpen, progress, onClose }: RefreshModalProps) {
  if (!isOpen) return null

  const completedCount = progress.completedSources.length
  const progressPercent = (completedCount / progress.totalSources) * 100
  const totalArticles = progress.completedSources.reduce((sum, s) => sum + s.count, 0)

  const getSourceStatus = (sourceName: string) => {
    const completed = progress.completedSources.find(s => s.name === sourceName)
    if (completed) {
      return completed.error ? 'error' : 'complete'
    }
    if (progress.currentSource === sourceName) {
      return 'fetching'
    }
    return 'pending'
  }

  const getSourceCount = (sourceName: string) => {
    const completed = progress.completedSources.find(s => s.name === sourceName)
    return completed?.count ?? null
  }

  const getSourceError = (sourceName: string) => {
    const completed = progress.completedSources.find(s => s.name === sourceName)
    return completed?.error ?? null
  }

  const allSourcesComplete = completedCount === progress.totalSources

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 dark:bg-black/70"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 text-center">
          Refreshing Sources
        </h2>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
            <span>Progress</span>
            <span>{completedCount}/{progress.totalSources} sources</span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Source List */}
        <div className="space-y-2 mb-4">
          {SOURCE_ORDER.map(sourceName => {
            const status = getSourceStatus(sourceName)
            const count = getSourceCount(sourceName)
            const error = getSourceError(sourceName)

            return (
              <div
                key={sourceName}
                className="flex items-center justify-between py-1.5 px-2 rounded bg-gray-50 dark:bg-gray-700/50"
              >
                <div className="flex items-center gap-2">
                  <span className="w-5 text-center">
                    {status === 'complete' && (
                      <span className="text-green-600 dark:text-green-400">&#10003;</span>
                    )}
                    {status === 'fetching' && (
                      <span className="text-blue-600 dark:text-blue-400 animate-pulse">&#8987;</span>
                    )}
                    {status === 'pending' && (
                      <span className="text-gray-400 dark:text-gray-500">&#9675;</span>
                    )}
                    {status === 'error' && (
                      <span className="text-red-600 dark:text-red-400">&#10007;</span>
                    )}
                  </span>
                  <span className={`text-sm ${
                    status === 'pending'
                      ? 'text-gray-400 dark:text-gray-500'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}>
                    {sourceName}
                  </span>
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {status === 'fetching' && 'fetching...'}
                  {status === 'pending' && 'pending'}
                  {status === 'complete' && `${count} articles`}
                  {status === 'error' && (
                    <span className="text-red-600 dark:text-red-400 text-xs">{error || 'error'}</span>
                  )}
                </span>
              </div>
            )
          })}
        </div>

        {/* Engagement Status */}
        {allSourcesComplete && progress.engagementStatus !== 'pending' && (
          <div className="flex items-center gap-2 py-2 px-3 rounded bg-purple-50 dark:bg-purple-900/30 mb-4">
            {progress.engagementStatus === 'calculating' && (
              <>
                <span className="text-purple-600 dark:text-purple-400 animate-pulse">&#8987;</span>
                <span className="text-sm text-purple-700 dark:text-purple-300">
                  Calculating engagement scores...
                </span>
              </>
            )}
            {progress.engagementStatus === 'complete' && (
              <>
                <span className="text-purple-600 dark:text-purple-400">&#10003;</span>
                <span className="text-sm text-purple-700 dark:text-purple-300">
                  Engagement scores updated
                </span>
              </>
            )}
          </div>
        )}

        {/* Total */}
        <div className="flex justify-between items-center pt-3 border-t border-gray-200 dark:border-gray-700">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Total: {totalArticles} articles
          </span>
          <button
            onClick={onClose}
            className="text-sm px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
