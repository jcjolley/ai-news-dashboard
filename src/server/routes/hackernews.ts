import { Hono } from 'hono'
import { insertArticle, getArticles } from '../db/schema'
import { normalizeEngagement } from '../services/engagement'
import sources from '../../../config/sources.json'

const app = new Hono()

const HN_API = 'https://hacker-news.firebaseio.com/v0'

interface HNItem {
  id: number
  title: string
  url?: string
  text?: string
  by: string
  time: number
  type: string
  score?: number
  descendants?: number
}

async function fetchItem(id: number): Promise<HNItem | null> {
  try {
    const response = await fetch(`${HN_API}/item/${id}.json`)
    if (!response.ok) return null
    return await response.json() as HNItem
  } catch {
    return null
  }
}

function matchesKeywords(title: string, keywords: string[]): boolean {
  const lowerTitle = title.toLowerCase()
  return keywords.some(kw => lowerTitle.includes(kw.toLowerCase()))
}

app.post('/refresh', async (c) => {
  try {
    const response = await fetch(`${HN_API}/topstories.json`)
    if (!response.ok) {
      return c.json({ success: false, error: 'Failed to fetch top stories' })
    }

    const storyIds = await response.json() as number[]
    const keywords = sources.hackernews.keywords
    const now = new Date().toISOString()

    let count = 0
    const topIds = storyIds.slice(0, 100)

    const items = await Promise.all(
      topIds.map(id => fetchItem(id))
    )

    for (const item of items) {
      if (!item || item.type !== 'story' || !item.title) continue

      if (!matchesKeywords(item.title, keywords)) continue

      const score = item.score || 0
      const article = {
        id: `hn-${item.id}`,
        source_type: 'hackernews',
        source_name: 'Hacker News',
        title: item.title,
        url: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
        content: item.text || null,
        author: item.by,
        published_at: new Date(item.time * 1000).toISOString(),
        fetched_at: now,
        engagement_score: normalizeEngagement(score, 'hackernews'),
        engagement_raw: String(score),
        engagement_type: 'points',
        engagement_fetched_at: now
      }

      insertArticle(article)
      count++
    }

    return c.json({ success: true, results: [{ source: 'Hacker News', count }] })
  } catch (error) {
    console.error('Error fetching Hacker News:', error)
    return c.json({ success: false, error: String(error) })
  }
})

app.get('/', (c) => {
  const articles = getArticles('hackernews')
  return c.json(articles)
})

export default app
