import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/bun'
import { initializeDatabase, getArticles, markAsRead, markAsUnread, getArticleById, updateEngagement, type SortOrder, type TimePeriod } from './db/schema'
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
  const period = (c.req.query('period') || 'all') as TimePeriod
  const articles = getArticles(source, limit, offset, sort, period)
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
      // Skip engagement for YouTube to avoid timeout (YouTube blocks page scraping)
      const url = source.name === 'youtube'
        ? 'http://localhost/refresh?skip_engagement=true'
        : 'http://localhost/refresh'
      const req = new Request(url, { method: 'POST' })
      const res = await source.route.fetch(req)
      results[source.name] = await res.json()
    } catch (error) {
      results[source.name] = { error: String(error) }
    }
  }

  return c.json(results)
})

app.post('/api/refresh-all-stream', async (c) => {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const sources = [
        { name: 'feeds', label: 'RSS Feeds', route: feedsRoutes },
        { name: 'podcasts', label: 'Podcasts', route: podcastsRoutes },
        { name: 'reddit', label: 'Reddit', route: redditRoutes },
        { name: 'hackernews', label: 'Hacker News', route: hackernewsRoutes },
        { name: 'youtube', label: 'YouTube', route: youtubeRoutes }
      ]

      for (let i = 0; i < sources.length; i++) {
        const source = sources[i]

        // Send "starting" event
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({
            type: 'progress',
            source: source.label,
            status: 'fetching',
            index: i,
            total: sources.length
          })}\n\n`
        ))

        try {
          // Skip engagement for YouTube to avoid timeout (YouTube blocks page scraping)
          const url = source.name === 'youtube'
            ? 'http://localhost/refresh?skip_engagement=true'
            : 'http://localhost/refresh'
          const req = new Request(url, { method: 'POST' })
          const res = await source.route.fetch(req)
          const result = await res.json() as { results?: { count: number }[] }

          // Send "complete" event
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({
              type: 'complete',
              source: source.label,
              count: result.results?.reduce((a: number, r: { count: number }) => a + r.count, 0) || 0,
              index: i,
              total: sources.length
            })}\n\n`
          ))
        } catch (error) {
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({
              type: 'error',
              source: source.label,
              error: String(error),
              index: i,
              total: sources.length
            })}\n\n`
          ))
        }
      }

      // Send "calculating engagement" event
      controller.enqueue(encoder.encode(
        `data: ${JSON.stringify({
          type: 'engagement',
          status: 'calculating'
        })}\n\n`
      ))

      // Note: Engagement is already calculated during fetch for Reddit/HN
      // This is a placeholder for any additional engagement processing
      await new Promise(resolve => setTimeout(resolve, 500))

      // Send "engagement complete" event
      controller.enqueue(encoder.encode(
        `data: ${JSON.stringify({
          type: 'engagement',
          status: 'complete'
        })}\n\n`
      ))

      // Send "done" event
      controller.enqueue(encoder.encode(
        `data: ${JSON.stringify({ type: 'done' })}\n\n`
      ))
      controller.close()
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  })
})

app.use('/*', serveStatic({ root: './dist/client' }))

const port = parseInt(process.env.PORT || '3000')

console.log(`Starting AI News Dashboard server on http://localhost:${port}`)

export default {
  port,
  fetch: app.fetch,
  idleTimeout: 120 // 120 seconds for slow Ollama requests
}
