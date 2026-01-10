import { useEffect, useState } from 'react'
import { useSettings, type Source, type SourceType, type SourceInput } from '../hooks/useSettings'

interface SettingsProps {
  isOpen: boolean
  onClose: () => void
}

const TABS: { type: SourceType; label: string; namePlaceholder: string; valuePlaceholder: string; valueLabel: string }[] = [
  { type: 'rss', label: 'RSS Feeds', namePlaceholder: 'Feed name', valuePlaceholder: 'https://example.com/feed.xml', valueLabel: 'URL' },
  { type: 'podcast', label: 'Podcasts', namePlaceholder: 'Podcast name', valuePlaceholder: 'https://example.com/podcast.rss', valueLabel: 'URL' },
  { type: 'reddit', label: 'Reddit', namePlaceholder: 'Display name', valuePlaceholder: 'MachineLearning', valueLabel: 'Subreddit' },
  { type: 'youtube', label: 'YouTube', namePlaceholder: 'Channel name (optional)', valuePlaceholder: 'https://youtube.com/@channel or UCxxxxxxxx', valueLabel: 'Channel URL or ID' },
  { type: 'hackernews', label: 'HN Keywords', namePlaceholder: 'Keyword', valuePlaceholder: 'GPT', valueLabel: 'Keyword' }
]

export default function Settings({ isOpen, onClose }: SettingsProps) {
  const { sources, loading, error, fetchSources, addSource, updateSource, deleteSource, toggleSource } = useSettings()
  const [activeTab, setActiveTab] = useState<SourceType>('rss')
  const [newName, setNewName] = useState('')
  const [newValue, setNewValue] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editValue, setEditValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [resolveError, setResolveError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      fetchSources()
    }
  }, [isOpen, fetchSources])

  // Resolve YouTube channel URL to get channel ID
  const resolveYouTubeChannel = async (url: string): Promise<{ channelId: string; name: string | null } | null> => {
    try {
      const response = await fetch('/api/youtube/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to resolve channel')
      }
      return data
    } catch (err) {
      throw err
    }
  }

  const handleAdd = async () => {
    // For YouTube, only value is required (name is optional)
    if (activeTab === 'youtube') {
      if (!newValue.trim()) return
    } else {
      if (!newName.trim() || !newValue.trim()) return
    }

    setSubmitting(true)
    setResolveError(null)

    try {
      let name = newName.trim()
      let value = newValue.trim()

      // For YouTube, resolve the URL to get channel ID
      if (activeTab === 'youtube' && !value.startsWith('UC')) {
        const resolved = await resolveYouTubeChannel(value)
        if (!resolved) {
          setResolveError('Could not resolve YouTube channel')
          setSubmitting(false)
          return
        }
        value = resolved.channelId
        // Use resolved name if user didn't provide one
        if (!name && resolved.name) {
          name = resolved.name
        }
      }

      // For YouTube, ensure we have a name
      if (activeTab === 'youtube' && !name) {
        name = value // Use channel ID as fallback name
      }

      const success = await addSource({
        type: activeTab,
        name,
        value
      })
      if (success) {
        setNewName('')
        setNewValue('')
      }
    } catch (err) {
      setResolveError(err instanceof Error ? err.message : 'Failed to add source')
    }
    setSubmitting(false)
  }

  const handleEdit = (source: Source) => {
    setEditingId(source.id)
    setEditName(source.name)
    setEditValue(source.value)
  }

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim() || !editValue.trim()) return

    setSubmitting(true)
    const success = await updateSource(editingId, {
      name: editName.trim(),
      value: editValue.trim()
    })
    if (success) {
      setEditingId(null)
      setEditName('')
      setEditValue('')
    }
    setSubmitting(false)
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditName('')
    setEditValue('')
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this source?')) return
    await deleteSource(id)
  }

  const handleToggle = async (id: number) => {
    await toggleSource(id)
  }

  if (!isOpen) return null

  const currentTab = TABS.find(t => t.type === activeTab)!
  const currentSources = sources[activeTab] || []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 px-6 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.type}
              onClick={() => setActiveTab(tab.type)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.type
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {(error || resolveError) && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-lg text-sm">
              {error || resolveError}
            </div>
          )}

          {/* Add new source form */}
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Add {currentTab.label.replace(/s$/, '')}
            </h3>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder={currentTab.namePlaceholder}
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder={currentTab.valuePlaceholder}
                value={newValue}
                onChange={e => setNewValue(e.target.value)}
                className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleAdd}
                disabled={submitting || !newValue.trim() || (activeTab !== 'youtube' && !newName.trim())}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting && activeTab === 'youtube' ? 'Resolving...' : 'Add'}
              </button>
            </div>
          </div>

          {/* Sources list */}
          {loading ? (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">Loading...</div>
          ) : currentSources.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              No {currentTab.label.toLowerCase()} configured
            </div>
          ) : (
            <div className="space-y-2">
              {currentSources.map(source => (
                <div
                  key={source.id}
                  className={`p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg ${
                    source.enabled === 0 ? 'opacity-60' : ''
                  }`}
                >
                  {editingId === source.id ? (
                    <div className="flex flex-col gap-3">
                      <div className="flex gap-3">
                        <input
                          type="text"
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="text"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={handleCancelEdit}
                          className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveEdit}
                          disabled={submitting}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleToggle(source.id)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          source.enabled === 1
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}
                      >
                        {source.enabled === 1 && (
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 dark:text-white truncate">
                          {source.name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {source.value}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(source)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(source.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
          {currentSources.length} {currentSources.length === 1 ? 'source' : 'sources'} configured
        </div>
      </div>
    </div>
  )
}
