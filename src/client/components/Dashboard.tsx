import { Article } from '../hooks/useNews'
import ArticleItem from './ArticleItem'

interface DashboardProps {
  articles: Article[]
  loading: boolean
  onMarkAsRead: (id: string) => void
  onSummarize: (article: Article) => void
  summarizing: string | null
  autoSummarizingId?: string | null
  registerRef?: (id: string, element: HTMLElement | null) => void
}

export default function Dashboard({
  articles,
  loading,
  onMarkAsRead,
  onSummarize,
  summarizing,
  autoSummarizingId,
  registerRef
}: DashboardProps) {
  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (articles.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <p className="text-lg">No articles found</p>
        <p className="text-sm mt-2">Click "Refresh All" to fetch the latest news</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {articles.length} article{articles.length !== 1 ? 's' : ''}
      </p>
      <div className="grid gap-4">
        {articles.map(article => (
          <ArticleItem
            key={article.id}
            article={article}
            onMarkAsRead={onMarkAsRead}
            onSummarize={onSummarize}
            isSummarizing={summarizing === article.id}
            isAutoSummarizing={autoSummarizingId === article.id}
            registerRef={registerRef}
          />
        ))}
      </div>
    </div>
  )
}
