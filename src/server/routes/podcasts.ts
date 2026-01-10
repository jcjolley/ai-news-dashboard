import { Hono } from 'hono'
import { XMLParser } from 'fast-xml-parser'
import { insertArticle, getArticles } from '../db/schema'
import { generateArticleId } from '../utils/hash'
import sources from '../../../config/sources.json'

const app = new Hono()
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_'
})

interface PodcastItem {
  title: string
  link?: string
  guid?: string | { '#text': string }
  description?: string
  pubDate?: string
  'itunes:author'?: string
  'itunes:duration'?: string
  enclosure?: {
    '@_url': string
  }
}

interface PodcastFeed {
  rss?: {
    channel: {
      title: string
      item: PodcastItem | PodcastItem[]
    }
  }
}

async function fetchPodcastFeed(url: string, name: string) {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'AI-News-Dashboard/1.0' }
    })

    if (!response.ok) {
      console.error(`Failed to fetch podcast ${name}: ${response.status}`)
      return []
    }

    const xml = await response.text()
    const parsed = parser.parse(xml) as PodcastFeed

    if (!parsed.rss?.channel?.item) {
      return []
    }

    const items = Array.isArray(parsed.rss.channel.item)
      ? parsed.rss.channel.item
      : [parsed.rss.channel.item]

    const now = new Date().toISOString()

    return items.slice(0, 15).map(item => {
      const guid = typeof item.guid === 'object' ? item.guid['#text'] : item.guid
      const episodeUrl = item.link || item.enclosure?.['@_url'] || guid || ''

      return {
        id: generateArticleId('podcast', episodeUrl, item.title),
        source_type: 'podcast',
        source_name: name,
        title: item.title || 'Untitled Episode',
        url: episodeUrl,
        content: item.description?.replace(/<[^>]*>/g, '').slice(0, 1000) || null,
        author: item['itunes:author'] || null,
        published_at: item.pubDate ? new Date(item.pubDate).toISOString() : null,
        fetched_at: now
      }
    })
  } catch (error) {
    console.error(`Error fetching podcast ${name}:`, error)
    return []
  }
}

app.post('/refresh', async (c) => {
  const results: { source: string; count: number; error?: string }[] = []
  const podcasts = (sources as any).podcasts || []

  for (const podcast of podcasts) {
    try {
      const articles = await fetchPodcastFeed(podcast.url, podcast.name)
      for (const article of articles) {
        insertArticle(article)
      }
      results.push({ source: podcast.name, count: articles.length })
    } catch (error) {
      results.push({ source: podcast.name, count: 0, error: String(error) })
    }
  }

  return c.json({ success: true, results })
})

app.get('/', (c) => {
  const articles = getArticles('podcast')
  return c.json(articles)
})

export default app
