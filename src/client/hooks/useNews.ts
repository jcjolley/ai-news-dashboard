import { useState, useCallback } from 'react'

export interface Article {
  id: string
  source_type: string
  source_name: string
  title: string
  url: string
  content: string | null
  author: string | null
  published_at: string | null
  fetched_at: string
  is_read: number
  summary: string | null
  engagement_score: number | null
  engagement_raw: string | null
  engagement_type: string | null
  engagement_fetched_at: string | null
}

export type SortOrder = 'recent' | 'top'
export type TimePeriod = 'day' | 'week' | 'month' | 'year' | 'all'

export interface RefreshProgress {
  isOpen: boolean
  currentSource: string
  completedSources: { name: string; count: number; error?: string }[]
  totalSources: number
  engagementStatus: 'pending' | 'calculating' | 'complete'
}

export function useNews() {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshProgress, setRefreshProgress] = useState<RefreshProgress>({
    isOpen: false,
    currentSource: '',
    completedSources: [],
    totalSources: 5,
    engagementStatus: 'pending'
  })

  const fetchArticles = useCallback(async (sourceType?: string, sort: SortOrder = 'recent', period: TimePeriod = 'all') => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (sourceType) params.set('source', sourceType)
      params.set('sort', sort)
      if (sort === 'top') params.set('period', period)
      const url = `/api/articles?${params.toString()}`
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch articles')
      const data = await response.json()
      setArticles(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshAllWithProgress = useCallback(async () => {
    setRefreshing(true)
    setError(null)
    setRefreshProgress({
      isOpen: true,
      currentSource: '',
      completedSources: [],
      totalSources: 5,
      engagementStatus: 'pending'
    })

    try {
      const response = await fetch('/api/refresh-all-stream', { method: 'POST' })
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No response body')
      }

      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))

              if (data.type === 'progress') {
                setRefreshProgress(prev => ({
                  ...prev,
                  currentSource: data.source
                }))
              } else if (data.type === 'complete') {
                setRefreshProgress(prev => ({
                  ...prev,
                  currentSource: '',
                  completedSources: [
                    ...prev.completedSources,
                    { name: data.source, count: data.count }
                  ]
                }))
              } else if (data.type === 'error') {
                setRefreshProgress(prev => ({
                  ...prev,
                  currentSource: '',
                  completedSources: [
                    ...prev.completedSources,
                    { name: data.source, count: 0, error: data.error }
                  ]
                }))
              } else if (data.type === 'engagement') {
                setRefreshProgress(prev => ({
                  ...prev,
                  engagementStatus: data.status
                }))
              }
            } catch {
              // Ignore JSON parse errors
            }
          }
        }
      }

      await fetchArticles()

      // Auto-close modal after delay
      setTimeout(() => {
        setRefreshProgress(prev => ({ ...prev, isOpen: false }))
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setRefreshProgress(prev => ({ ...prev, isOpen: false }))
    } finally {
      setRefreshing(false)
    }
  }, [fetchArticles])

  const closeRefreshModal = useCallback(() => {
    setRefreshProgress(prev => ({ ...prev, isOpen: false }))
  }, [])

  const markAsRead = useCallback(async (id: string) => {
    try {
      await fetch(`/api/articles/${id}/read`, { method: 'POST' })
      setArticles(prev =>
        prev.map(a => (a.id === id ? { ...a, is_read: 1 } : a))
      )
    } catch (err) {
      console.error('Failed to mark as read:', err)
    }
  }, [])

  const summarize = useCallback(async (id: string): Promise<string | null> => {
    try {
      const response = await fetch(`/api/summarize/${id}`, { method: 'POST' })

      const text = await response.text()
      if (!text) {
        throw new Error('Empty response from server - Ollama may have timed out')
      }

      let data
      try {
        data = JSON.parse(text)
      } catch {
        throw new Error('Invalid response from server')
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to summarize')
      }

      setArticles(prev =>
        prev.map(a => (a.id === id ? { ...a, summary: data.summary } : a))
      )
      return data.summary
    } catch (err) {
      console.error('Failed to summarize:', err)
      throw err
    }
  }, [])

  return {
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
  }
}
