import { Hono } from 'hono'
import { XMLParser } from 'fast-xml-parser'
import { insertArticle, getArticles, getSourcesByType } from '../db/schema'
import { generateArticleId } from '../utils/hash'

const app = new Hono()
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_'
})

interface RSSItem {
  title: string
  link: string
  description?: string
  pubDate?: string
  'dc:creator'?: string
  author?: string
}

interface RSSFeed {
  rss?: {
    channel: {
      item: RSSItem | RSSItem[]
    }
  }
  feed?: {
    entry: RSSItem | RSSItem[]
  }
}

async function fetchRSSFeed(url: string, name: string) {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'AI-News-Dashboard/1.0' }
    })

    if (!response.ok) {
      console.error(`Failed to fetch ${name}: ${response.status}`)
      return []
    }

    const xml = await response.text()
    const parsed = parser.parse(xml) as RSSFeed

    let items: RSSItem[] = []

    if (parsed.rss?.channel?.item) {
      items = Array.isArray(parsed.rss.channel.item)
        ? parsed.rss.channel.item
        : [parsed.rss.channel.item]
    } else if (parsed.feed?.entry) {
      items = Array.isArray(parsed.feed.entry)
        ? parsed.feed.entry
        : [parsed.feed.entry]
    }

    const now = new Date().toISOString()

    return items.slice(0, 20).map(item => ({
      id: generateArticleId('rss', item.link, item.title),
      source_type: 'rss',
      source_name: name,
      title: item.title || 'Untitled',
      url: item.link,
      content: item.description || null,
      author: item['dc:creator'] || item.author || null,
      published_at: item.pubDate ? new Date(item.pubDate).toISOString() : null,
      fetched_at: now
    }))
  } catch (error) {
    console.error(`Error fetching RSS feed ${name}:`, error)
    return []
  }
}

app.post('/refresh', async (c) => {
  const results: { source: string; count: number; error?: string }[] = []
  const feeds = getSourcesByType('rss')

  for (const feed of feeds) {
    try {
      const articles = await fetchRSSFeed(feed.value, feed.name)
      for (const article of articles) {
        insertArticle(article)
      }
      results.push({ source: feed.name, count: articles.length })
    } catch (error) {
      results.push({ source: feed.name, count: 0, error: String(error) })
    }
  }

  return c.json({ success: true, results })
})

app.get('/', (c) => {
  const articles = getArticles('rss')
  return c.json(articles)
})

export default app
