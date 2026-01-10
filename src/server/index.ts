import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/bun'
import { initializeDatabase, getArticles, markAsRead, markAsUnread } from './db/schema'

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
  const articles = getArticles(source, limit, offset)
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
