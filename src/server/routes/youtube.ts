import { Hono } from 'hono'
import { XMLParser } from 'fast-xml-parser'
import { insertArticle, getArticles, getSourcesByType } from '../db/schema'
import { extractYouTubeViews } from '../services/engagement'

const app = new Hono()
const parser = new XMLParser()

interface YouTubeEntry {
  'yt:videoId': string
  title: string
  link: { '@_href': string } | string
  published: string
  author?: { name: string }
  'media:group'?: {
    'media:description': string
  }
}

interface YouTubeFeed {
  feed?: {
    entry: YouTubeEntry | YouTubeEntry[]
  }
}

async function fetchYouTubeFeed(channelId: string, name: string) {
  try {
    const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
    const response = await fetch(url, {
      headers: { 'User-Agent': 'AI-News-Dashboard/1.0' }
    })

    if (!response.ok) {
      console.error(`Failed to fetch YouTube channel ${name}: ${response.status}`)
      return []
    }

    const xml = await response.text()
    const parsed = parser.parse(xml) as YouTubeFeed

    if (!parsed.feed?.entry) return []

    const entries = Array.isArray(parsed.feed.entry)
      ? parsed.feed.entry
      : [parsed.feed.entry]

    const now = new Date().toISOString()

    return entries.slice(0, 10).map(entry => ({
      id: `youtube-${entry['yt:videoId']}`,
      source_type: 'youtube',
      source_name: name,
      title: entry.title,
      url: `https://www.youtube.com/watch?v=${entry['yt:videoId']}`,
      content: entry['media:group']?.['media:description'] || null,
      author: entry.author?.name || name,
      published_at: entry.published ? new Date(entry.published).toISOString() : null,
      fetched_at: now,
      engagement_score: null as number | null,
      engagement_raw: null as string | null,
      engagement_type: null as string | null,
      engagement_fetched_at: null as string | null
    }))
  } catch (error) {
    console.error(`Error fetching YouTube channel ${name}:`, error)
    return []
  }
}

app.post('/refresh', async (c) => {
  const results: { source: string; count: number; error?: string }[] = []
  const skipEngagement = c.req.query('skip_engagement') === 'true'
  const channels = getSourcesByType('youtube')

  for (const channel of channels) {
    try {
      const articles = await fetchYouTubeFeed(channel.value, channel.name)

      for (const article of articles) {
        // Skip engagement fetching during refresh to avoid timeouts
        // Engagement can be fetched lazily via /api/articles/:id/fetch-engagement
        if (!skipEngagement) {
          try {
            const engagement = await extractYouTubeViews(article.url)
            if (engagement) {
              article.engagement_score = engagement.score
              article.engagement_raw = engagement.raw
              article.engagement_type = engagement.type
              article.engagement_fetched_at = new Date().toISOString()
            }
          } catch (err) {
            // Don't block on engagement errors, just log and continue
            console.error(`Failed to fetch engagement for ${article.url}:`, err)
          }
        }
        insertArticle(article)
      }

      results.push({ source: channel.name, count: articles.length })
    } catch (error) {
      results.push({ source: channel.name, count: 0, error: String(error) })
    }
  }

  return c.json({ success: true, results })
})

app.get('/', (c) => {
  const articles = getArticles('youtube')
  return c.json(articles)
})

// Resolve a YouTube channel URL to get the channel ID and name
app.post('/resolve', async (c) => {
  const { url } = await c.req.json() as { url: string }

  if (!url) {
    return c.json({ error: 'URL is required' }, 400)
  }

  try {
    // If it's already a channel ID (starts with UC), return it directly
    if (url.startsWith('UC') && url.length === 24) {
      return c.json({ channelId: url, name: null })
    }

    // Normalize the URL
    let channelUrl = url
    if (!url.startsWith('http')) {
      channelUrl = `https://www.youtube.com/${url.startsWith('@') ? url : '@' + url}`
    }

    const response = await fetch(channelUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    })

    if (!response.ok) {
      return c.json({ error: `Failed to fetch channel page: ${response.status}` }, 400)
    }

    const html = await response.text()

    // Extract channel ID from the page - look for various patterns
    // Pattern 1: "channelId":"UCxxxxxxx"
    let match = html.match(/"channelId":"(UC[a-zA-Z0-9_-]{22})"/)?.[1]

    // Pattern 2: /channel/UCxxxxxxx in canonical or other URLs
    if (!match) {
      match = html.match(/\/channel\/(UC[a-zA-Z0-9_-]{22})/)?.[1]
    }

    // Pattern 3: "externalId":"UCxxxxxxx"
    if (!match) {
      match = html.match(/"externalId":"(UC[a-zA-Z0-9_-]{22})"/)?.[1]
    }

    if (!match) {
      return c.json({ error: 'Could not find channel ID on page' }, 400)
    }

    // Try to extract channel name
    const nameMatch = html.match(/<meta property="og:title" content="([^"]+)"/)
      || html.match(/"author":"([^"]+)"/)
      || html.match(/<title>([^<]+)<\/title>/)

    let name = nameMatch?.[1] || null
    // Clean up the name (remove " - YouTube" suffix if present)
    if (name) {
      name = name.replace(/ - YouTube$/, '').trim()
    }

    return c.json({ channelId: match, name })
  } catch (error) {
    console.error('Error resolving YouTube channel:', error)
    return c.json({ error: String(error) }, 500)
  }
})

export default app
