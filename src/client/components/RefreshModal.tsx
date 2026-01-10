import { useState } from 'react'

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
  const [isMinimized, setIsMinimized] = useState(false)

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
  const isFullyComplete = allSourcesComplete && progress.engagementStatus === 'complete'

  // Minimized view - just a small progress indicator
  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 px-4 py-2 hover:shadow-xl transition-shadow"
        >
          <div className="relative w-5 h-5">
            <svg className="w-5 h-5 text-blue-600 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {completedCount}/{progress.totalSources}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {totalArticles} articles
          </span>
        </button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-72">
      {/* Floating Panel */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Refreshing Sources
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimized(true)}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              title="Minimize"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              title="Close"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="px-3 pt-2">
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span>{completedCount}/{progress.totalSources} sources</span>
            <span>{totalArticles} articles</span>
          </div>
          <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ease-out ${
                isFullyComplete ? 'bg-green-500' : 'bg-blue-600'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Source List */}
        <div className="px-3 py-2 space-y-1 max-h-48 overflow-y-auto">
          {SOURCE_ORDER.map(sourceName => {
            const status = getSourceStatus(sourceName)
            const count = getSourceCount(sourceName)
            const error = getSourceError(sourceName)

            return (
              <div
                key={sourceName}
                className="flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-4 text-center">
                    {status === 'complete' && (
                      <span className="text-green-600 dark:text-green-400">&#10003;</span>
                    )}
                    {status === 'fetching' && (
                      <span className="text-blue-600 dark:text-blue-400 animate-pulse">&#8987;</span>
                    )}
                    {status === 'pending' && (
                      <span className="text-gray-300 dark:text-gray-600">&#9675;</span>
                    )}
                    {status === 'error' && (
                      <span className="text-red-600 dark:text-red-400">&#10007;</span>
                    )}
                  </span>
                  <span className={`${
                    status === 'pending'
                      ? 'text-gray-400 dark:text-gray-500'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}>
                    {sourceName}
                  </span>
                </div>
                <span className="text-gray-400 dark:text-gray-500">
                  {status === 'fetching' && (
                    <span className="animate-pulse">...</span>
                  )}
                  {status === 'complete' && count}
                  {status === 'error' && (
                    <span className="text-red-500 dark:text-red-400" title={error || 'error'}>err</span>
                  )}
                </span>
              </div>
            )
          })}
        </div>

        {/* Engagement Status */}
        {allSourcesComplete && progress.engagementStatus !== 'pending' && (
          <div className="px-3 pb-2">
            <div className="flex items-center gap-1.5 text-xs py-1.5 px-2 rounded bg-purple-50 dark:bg-purple-900/30">
              {progress.engagementStatus === 'calculating' && (
                <>
                  <span className="text-purple-600 dark:text-purple-400 animate-pulse">&#8987;</span>
                  <span className="text-purple-700 dark:text-purple-300">
                    Calculating engagement...
                  </span>
                </>
              )}
              {progress.engagementStatus === 'complete' && (
                <>
                  <span className="text-purple-600 dark:text-purple-400">&#10003;</span>
                  <span className="text-purple-700 dark:text-purple-300">
                    Engagement updated
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Done state */}
        {isFullyComplete && (
          <div className="px-3 pb-3">
            <button
              onClick={onClose}
              className="w-full text-xs py-1.5 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
            >
              Done — {totalArticles} articles fetched
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
