import { useState, useCallback } from 'react'

export type SourceType = 'rss' | 'podcast' | 'reddit' | 'youtube' | 'hackernews'

export interface Source {
  id: number
  type: SourceType
  name: string
  value: string
  enabled: number
  created_at: string
  updated_at: string
}

export interface SourceInput {
  type: SourceType
  name: string
  value: string
}

export interface SourcesByType {
  rss?: Source[]
  podcast?: Source[]
  reddit?: Source[]
  youtube?: Source[]
  hackernews?: Source[]
}

export function useSettings() {
  const [sources, setSources] = useState<SourcesByType>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchSources = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/sources')
      if (!response.ok) throw new Error('Failed to fetch sources')
      const data = await response.json()
      setSources(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sources')
    } finally {
      setLoading(false)
    }
  }, [])

  const addSource = useCallback(async (source: SourceInput) => {
    setError(null)
    try {
      const response = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(source)
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to add source')
      }
      await fetchSources()
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add source')
      return false
    }
  }, [fetchSources])

  const updateSource = useCallback(async (id: number, updates: Partial<SourceInput>) => {
    setError(null)
    try {
      const response = await fetch(`/api/sources/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update source')
      }
      await fetchSources()
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update source')
      return false
    }
  }, [fetchSources])

  const deleteSource = useCallback(async (id: number) => {
    setError(null)
    try {
      const response = await fetch(`/api/sources/${id}`, {
        method: 'DELETE'
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete source')
      }
      await fetchSources()
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete source')
      return false
    }
  }, [fetchSources])

  const toggleSource = useCallback(async (id: number) => {
    setError(null)
    try {
      const response = await fetch(`/api/sources/${id}/toggle`, {
        method: 'PATCH'
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to toggle source')
      }
      await fetchSources()
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle source')
      return false
    }
  }, [fetchSources])

  return {
    sources,
    loading,
    error,
    fetchSources,
    addSource,
    updateSource,
    deleteSource,
    toggleSource
  }
}
