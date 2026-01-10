import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/bun'
import { initializeDatabase, getArticles, markAsRead, markAsUnread, getArticleById, updateEngagement, type SortOrder } from './db/schema'
import { fetchEngagementForArticle } from './services/engagement'

import feedsRoutes from './routes/feeds'
import podcastsRoutes from './routes/podcasts'
import redditRoutes from './routes/reddit'
import hackernewsRoutes from './routes/hackernews'
import youtubeRoutes from './routes/youtube'
import summarizeRoutes from './routes/summarize'

initializeDatabase()

const app = new Hono()

app.use('*', cors())

app.route('/api/feeds', feedsRoutes)
app.route('/api/podcasts', podcastsRoutes)
app.route('/api/reddit', redditRoutes)
app.route('/api/hackernews', hackernewsRoutes)
app.route('/api/youtube', youtubeRoutes)
app.route('/api/summarize', summarizeRoutes)

app.get('/api/articles', (c) => {
  const source = c.req.query('source')
  const limit = parseInt(c.req.query('limit') || '100')
  const offset = parseInt(c.req.query('offset') || '0')
  const sort = (c.req.query('sort') || 'recent') as SortOrder
  const articles = getArticles(source, limit, offset, sort)
  return c.json(articles)
})

app.post('/api/articles/:id/read', (c) => {
  const id = c.req.param('id')
  markAsRead(id)
  return c.json({ success: true })
})

app.post('/api/articles/:id/unread', (c) => {
  const id = c.req.param('id')
  markAsUnread(id)
  return c.json({ success: true })
})

app.post('/api/articles/:id/fetch-engagement', async (c) => {
  const id = c.req.param('id')
  const article = getArticleById(id)

  if (!article) {
    return c.json({ error: 'Article not found' }, 404)
  }

  // Return cached engagement if recently fetched (within 1 hour)
  if (article.engagement_fetched_at) {
    const fetchedAt = new Date(article.engagement_fetched_at)
    if (Date.now() - fetchedAt.getTime() < 3600000) {
      return c.json({
        engagement_score: article.engagement_score,
        engagement_raw: article.engagement_raw,
        engagement_type: article.engagement_type,
        cached: true
      })
    }
  }

  try {
    const engagement = await fetchEngagementForArticle(article.url, article.source_type)
    if (engagement) {
      updateEngagement(id, engagement.score, engagement.raw, engagement.type)
      return c.json({
        engagement_score: engagement.score,
        engagement_raw: engagement.raw,
        engagement_type: engagement.type,
        cached: false
      })
    }
    return c.json({ engagement_score: null, cached: false })
  } catch (error) {
    console.error('Error fetching engagement:', error)
    return c.json({ error: 'Failed to fetch engagement' }, 500)
  }
})

app.post('/api/refresh-all', async (c) => {
  const results: Record<string, unknown> = {}

  const sources = [
    { name: 'feeds', route: feedsRoutes },
    { name: 'podcasts', route: podcastsRoutes },
    { name: 'reddit', route: redditRoutes },
    { name: 'hackernews', route: hackernewsRoutes },
    { name: 'youtube', route: youtubeRoutes }
  ]

  for (const source of sources) {
    try {
      const req = new Request('http://localhost/refresh', { method: 'POST' })
      const res = await source.route.fetch(req)
      results[source.name] = await res.json()
    } catch (error) {
      results[source.name] = { error: String(error) }
    }
  }

  return c.json(results)
})

app.use('/*', serveStatic({ root: './dist/client' }))

const port = parseInt(process.env.PORT || '3000')

console.log(`Starting AI News Dashboard server on http://localhost:${port}`)

export default {
  port,
  fetch: app.fetch,
  idleTimeout: 120 // 120 seconds for slow Ollama requests
}
