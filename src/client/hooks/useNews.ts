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
}

export interface RefreshResult {
  source: string
  count: number
  error?: string
}

export function useNews() {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchArticles = useCallback(async (sourceType?: string) => {
    setLoading(true)
    setError(null)
    try {
      const url = sourceType
        ? `/api/articles?source=${sourceType}`
        : '/api/articles'
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

  const refreshAll = useCallback(async () => {
    setRefreshing(true)
    setError(null)
    try {
      const response = await fetch('/api/refresh-all', { method: 'POST' })
      if (!response.ok) throw new Error('Failed to refresh')
      await fetchArticles()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setRefreshing(false)
    }
  }, [fetchArticles])

  const refreshSource = useCallback(async (source: string) => {
    setRefreshing(true)
    try {
      const response = await fetch(`/api/${source}/refresh`, { method: 'POST' })
      if (!response.ok) throw new Error(`Failed to refresh ${source}`)
      await fetchArticles()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setRefreshing(false)
    }
  }, [fetchArticles])

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
    refreshAll,
    refreshSource,
    markAsRead,
    summarize
  }
}
