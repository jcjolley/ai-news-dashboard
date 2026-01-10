import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'

// Test database setup - uses in-memory database
let testDb: Database

interface Article {
  id: string
  source_type: string
  source_name: string
  title: string
  url: string
  content: string | null
  author: string | null
  published_at: string | null
  fetched_at: string
  is_read: number
  summary: string | null
  engagement_score: number | null
  engagement_raw: string | null
  engagement_type: string | null
  engagement_fetched_at: string | null
}

function initTestDatabase(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS articles (
      id TEXT PRIMARY KEY,
      source_type TEXT NOT NULL,
      source_name TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      content TEXT,
      author TEXT,
      published_at TEXT,
      fetched_at TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      summary TEXT,
      engagement_score INTEGER,
      engagement_raw TEXT,
      engagement_type TEXT,
      engagement_fetched_at TEXT
    )
  `)

  db.run(`CREATE INDEX IF NOT EXISTS idx_articles_source ON articles(source_type, source_name)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at DESC)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_articles_read ON articles(is_read)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_articles_engagement ON articles(engagement_score DESC)`)
}

function insertArticle(db: Database, article: Partial<Article> & { id: string; source_type: string; source_name: string; title: string; url: string; fetched_at: string }) {
  const stmt = db.prepare(`
    INSERT INTO articles (id, source_type, source_name, title, url, content, author, published_at, fetched_at, engagement_score, engagement_raw, engagement_type, engagement_fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      engagement_score = excluded.engagement_score,
      engagement_raw = excluded.engagement_raw,
      engagement_type = excluded.engagement_type,
      engagement_fetched_at = excluded.engagement_fetched_at
  `)
  stmt.run(
    article.id,
    article.source_type,
    article.source_name,
    article.title,
    article.url,
    article.content ?? null,
    article.author ?? null,
    article.published_at ?? null,
    article.fetched_at,
    article.engagement_score ?? null,
    article.engagement_raw ?? null,
    article.engagement_type ?? null,
    article.engagement_fetched_at ?? null
  )
}

function getArticles(db: Database, sourceType?: string, limit = 100, offset = 0, sort: 'recent' | 'engagement' = 'recent'): Article[] {
  const orderBy = sort === 'engagement'
    ? 'ORDER BY COALESCE(engagement_score, 0) DESC, published_at DESC'
    : 'ORDER BY published_at DESC'

  if (sourceType) {
    return db.query(`
      SELECT * FROM articles
      WHERE source_type = ?
      ${orderBy}
      LIMIT ? OFFSET ?
    `).all(sourceType, limit, offset) as Article[]
  }
  return db.query(`
    SELECT * FROM articles
    ${orderBy}
    LIMIT ? OFFSET ?
  `).all(limit, offset) as Article[]
}

function markAsRead(db: Database, id: string) {
  db.run('UPDATE articles SET is_read = 1 WHERE id = ?', [id])
}

function markAsUnread(db: Database, id: string) {
  db.run('UPDATE articles SET is_read = 0 WHERE id = ?', [id])
}

function saveSummary(db: Database, id: string, summary: string) {
  db.run('UPDATE articles SET summary = ? WHERE id = ?', [summary, id])
}

function getArticleById(db: Database, id: string): Article | null {
  return db.query('SELECT * FROM articles WHERE id = ?').get(id) as Article | null
}

function updateEngagement(db: Database, id: string, score: number, raw: string, type: string) {
  db.run(
    `UPDATE articles SET engagement_score = ?, engagement_raw = ?, engagement_type = ?, engagement_fetched_at = ? WHERE id = ?`,
    [score, raw, type, new Date().toISOString(), id]
  )
}

describe('Database Operations', () => {
  beforeEach(() => {
    testDb = new Database(':memory:')
    initTestDatabase(testDb)
  })

  afterEach(() => {
    testDb.close()
  })

  describe('Article CRUD', () => {
    test('should insert a new article', () => {
      const article = {
        id: 'test-1',
        source_type: 'reddit',
        source_name: 'r/technology',
        title: 'Test Article',
        url: 'https://example.com/test',
        content: 'Test content',
        author: 'testuser',
        published_at: '2024-01-15T10:00:00Z',
        fetched_at: '2024-01-15T12:00:00Z'
      }

      insertArticle(testDb, article)
      const result = getArticleById(testDb, 'test-1')

      expect(result).not.toBeNull()
      expect(result!.id).toBe('test-1')
      expect(result!.title).toBe('Test Article')
      expect(result!.source_type).toBe('reddit')
      expect(result!.is_read).toBe(0)
    })

    test('should update engagement on conflict (upsert)', () => {
      const article = {
        id: 'test-1',
        source_type: 'reddit',
        source_name: 'r/technology',
        title: 'Test Article',
        url: 'https://example.com/test',
        fetched_at: '2024-01-15T12:00:00Z',
        engagement_score: 50,
        engagement_raw: '100',
        engagement_type: 'upvotes'
      }

      insertArticle(testDb, article)

      // Insert again with different engagement
      const updatedArticle = {
        ...article,
        engagement_score: 75,
        engagement_raw: '500',
        engagement_fetched_at: '2024-01-15T14:00:00Z'
      }

      insertArticle(testDb, updatedArticle)
      const result = getArticleById(testDb, 'test-1')

      expect(result!.engagement_score).toBe(75)
      expect(result!.engagement_raw).toBe('500')
    })

    test('should retrieve article by id', () => {
      insertArticle(testDb, {
        id: 'find-me',
        source_type: 'hackernews',
        source_name: 'Hacker News',
        title: 'Find Me',
        url: 'https://example.com/find',
        fetched_at: new Date().toISOString()
      })

      const found = getArticleById(testDb, 'find-me')
      const notFound = getArticleById(testDb, 'does-not-exist')

      expect(found).not.toBeNull()
      expect(found!.title).toBe('Find Me')
      expect(notFound).toBeNull()
    })
  })

  describe('Article Listing', () => {
    beforeEach(() => {
      // Insert test articles with different dates and engagement
      const articles = [
        { id: '1', source_type: 'reddit', source_name: 'r/tech', title: 'Old Low', url: 'http://1.com', published_at: '2024-01-01T00:00:00Z', fetched_at: '2024-01-15T00:00:00Z', engagement_score: 10 },
        { id: '2', source_type: 'reddit', source_name: 'r/tech', title: 'Old High', url: 'http://2.com', published_at: '2024-01-02T00:00:00Z', fetched_at: '2024-01-15T00:00:00Z', engagement_score: 90 },
        { id: '3', source_type: 'hackernews', source_name: 'HN', title: 'New Low', url: 'http://3.com', published_at: '2024-01-10T00:00:00Z', fetched_at: '2024-01-15T00:00:00Z', engagement_score: 20 },
        { id: '4', source_type: 'hackernews', source_name: 'HN', title: 'New High', url: 'http://4.com', published_at: '2024-01-11T00:00:00Z', fetched_at: '2024-01-15T00:00:00Z', engagement_score: 80 },
      ]

      for (const a of articles) {
        insertArticle(testDb, a)
      }
    })

    test('should list all articles sorted by recent first', () => {
      const articles = getArticles(testDb, undefined, 100, 0, 'recent')

      expect(articles).toHaveLength(4)
      expect(articles[0].id).toBe('4') // Most recent
      expect(articles[3].id).toBe('1') // Oldest
    })

    test('should list articles sorted by engagement', () => {
      const articles = getArticles(testDb, undefined, 100, 0, 'engagement')

      expect(articles).toHaveLength(4)
      expect(articles[0].id).toBe('2') // Highest engagement (90)
      expect(articles[1].id).toBe('4') // Second highest (80)
    })

    test('should filter by source type', () => {
      const redditArticles = getArticles(testDb, 'reddit')
      const hnArticles = getArticles(testDb, 'hackernews')

      expect(redditArticles).toHaveLength(2)
      expect(hnArticles).toHaveLength(2)
      expect(redditArticles.every(a => a.source_type === 'reddit')).toBe(true)
      expect(hnArticles.every(a => a.source_type === 'hackernews')).toBe(true)
    })

    test('should respect limit and offset', () => {
      const firstTwo = getArticles(testDb, undefined, 2, 0, 'recent')
      const lastTwo = getArticles(testDb, undefined, 2, 2, 'recent')

      expect(firstTwo).toHaveLength(2)
      expect(lastTwo).toHaveLength(2)
      expect(firstTwo[0].id).toBe('4')
      expect(lastTwo[0].id).toBe('2')
    })
  })

  describe('Read Status', () => {
    beforeEach(() => {
      insertArticle(testDb, {
        id: 'read-test',
        source_type: 'rss',
        source_name: 'Test Feed',
        title: 'Read Test Article',
        url: 'https://example.com/read',
        fetched_at: new Date().toISOString()
      })
    })

    test('should mark article as read', () => {
      const before = getArticleById(testDb, 'read-test')
      expect(before!.is_read).toBe(0)

      markAsRead(testDb, 'read-test')

      const after = getArticleById(testDb, 'read-test')
      expect(after!.is_read).toBe(1)
    })

    test('should mark article as unread', () => {
      markAsRead(testDb, 'read-test')
      expect(getArticleById(testDb, 'read-test')!.is_read).toBe(1)

      markAsUnread(testDb, 'read-test')
      expect(getArticleById(testDb, 'read-test')!.is_read).toBe(0)
    })
  })

  describe('Summary', () => {
    test('should save summary to article', () => {
      insertArticle(testDb, {
        id: 'summary-test',
        source_type: 'rss',
        source_name: 'Test Feed',
        title: 'Summary Test',
        url: 'https://example.com/summary',
        fetched_at: new Date().toISOString()
      })

      const before = getArticleById(testDb, 'summary-test')
      expect(before!.summary).toBeNull()

      saveSummary(testDb, 'summary-test', 'This is a test summary.')

      const after = getArticleById(testDb, 'summary-test')
      expect(after!.summary).toBe('This is a test summary.')
    })
  })

  describe('Engagement', () => {
    test('should update engagement metrics', () => {
      insertArticle(testDb, {
        id: 'engagement-test',
        source_type: 'youtube',
        source_name: 'Test Channel',
        title: 'Engagement Test',
        url: 'https://youtube.com/test',
        fetched_at: new Date().toISOString()
      })

      const before = getArticleById(testDb, 'engagement-test')
      expect(before!.engagement_score).toBeNull()

      updateEngagement(testDb, 'engagement-test', 85, '1000000', 'views')

      const after = getArticleById(testDb, 'engagement-test')
      expect(after!.engagement_score).toBe(85)
      expect(after!.engagement_raw).toBe('1000000')
      expect(after!.engagement_type).toBe('views')
      expect(after!.engagement_fetched_at).not.toBeNull()
    })
  })
})
