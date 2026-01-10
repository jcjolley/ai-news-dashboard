import { Hono } from 'hono'
import { insertArticle, getArticles } from '../db/schema'
import { normalizeEngagement } from '../services/engagement'
import sources from '../../../config/sources.json'

const app = new Hono()

interface RedditPost {
  data: {
    id: string
    title: string
    url: string
    selftext: string
    author: string
    created_utc: number
    permalink: string
    subreddit: string
    score: number
    num_comments: number
  }
}

interface RedditResponse {
  data: {
    children: RedditPost[]
  }
}

async function fetchSubreddit(subreddit: string) {
  try {
    const response = await fetch(
      `https://www.reddit.com/r/${subreddit}/hot.json?limit=25`,
      {
        headers: {
          'User-Agent': 'AI-News-Dashboard/1.0'
        }
      }
    )

    if (!response.ok) {
      console.error(`Failed to fetch r/${subreddit}: ${response.status}`)
      return []
    }

    const data = await response.json() as RedditResponse
    const now = new Date().toISOString()

    return data.data.children.map(post => ({
      id: `reddit-${post.data.id}`,
      source_type: 'reddit',
      source_name: `r/${post.data.subreddit}`,
      title: post.data.title,
      url: post.data.url.startsWith('/r/')
        ? `https://reddit.com${post.data.url}`
        : post.data.url,
      content: post.data.selftext || null,
      author: post.data.author,
      published_at: new Date(post.data.created_utc * 1000).toISOString(),
      fetched_at: now,
      engagement_score: normalizeEngagement(post.data.score, 'reddit'),
      engagement_raw: String(post.data.score),
      engagement_type: 'upvotes',
      engagement_fetched_at: now
    }))
  } catch (error) {
    console.error(`Error fetching r/${subreddit}:`, error)
    return []
  }
}

app.post('/refresh', async (c) => {
  const results: { source: string; count: number; error?: string }[] = []

  for (const subreddit of sources.reddit) {
    try {
      const articles = await fetchSubreddit(subreddit)
      for (const article of articles) {
        insertArticle(article)
      }
      results.push({ source: `r/${subreddit}`, count: articles.length })
    } catch (error) {
      results.push({ source: `r/${subreddit}`, count: 0, error: String(error) })
    }
  }

  return c.json({ success: true, results })
})

app.get('/', (c) => {
  const articles = getArticles('reddit')
  return c.json(articles)
})

export default app
