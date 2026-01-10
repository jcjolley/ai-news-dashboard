import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test'
import { Hono } from 'hono'
import { Database } from 'bun:sqlite'

// Create a test app with in-memory database
let testDb: Database
let app: Hono

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
}

function insertArticle(db: Database, article: Partial<Article> & { id: string; source_type: string; source_name: string; title: string; url: string; fetched_at: string }) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO articles (id, source_type, source_name, title, url, content, author, published_at, fetched_at, is_read, summary, engagement_score, engagement_raw, engagement_type, engagement_fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    article.is_read ?? 0,
    article.summary ?? null,
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
    return db.query(`SELECT * FROM articles WHERE source_type = ? ${orderBy} LIMIT ? OFFSET ?`).all(sourceType, limit, offset) as Article[]
  }
  return db.query(`SELECT * FROM articles ${orderBy} LIMIT ? OFFSET ?`).all(limit, offset) as Article[]
}

function getArticleById(db: Database, id: string): Article | null {
  return db.query('SELECT * FROM articles WHERE id = ?').get(id) as Article | null
}

function markAsRead(db: Database, id: string) {
  db.run('UPDATE articles SET is_read = 1 WHERE id = ?', [id])
}

function markAsUnread(db: Database, id: string) {
  db.run('UPDATE articles SET is_read = 0 WHERE id = ?', [id])
}

function createTestApp(db: Database) {
  const testApp = new Hono()

  testApp.get('/api/articles', (c) => {
    const source = c.req.query('source')
    const limit = parseInt(c.req.query('limit') || '100')
    const offset = parseInt(c.req.query('offset') || '0')
    const sort = (c.req.query('sort') || 'recent') as 'recent' | 'engagement'
    const articles = getArticles(db, source, limit, offset, sort)
    return c.json(articles)
  })

  testApp.post('/api/articles/:id/read', (c) => {
    const id = c.req.param('id')
    markAsRead(db, id)
    return c.json({ success: true })
  })

  testApp.post('/api/articles/:id/unread', (c) => {
    const id = c.req.param('id')
    markAsUnread(db, id)
    return c.json({ success: true })
  })

  testApp.get('/api/articles/:id', (c) => {
    const id = c.req.param('id')
    const article = getArticleById(db, id)
    if (!article) {
      return c.json({ error: 'Article not found' }, 404)
    }
    return c.json(article)
  })

  return testApp
}

describe('API Endpoints', () => {
  beforeAll(() => {
    testDb = new Database(':memory:')
    initTestDatabase(testDb)
    app = createTestApp(testDb)
  })

  afterAll(() => {
    testDb.close()
  })

  beforeEach(() => {
    // Clear articles table before each test
    testDb.run('DELETE FROM articles')
  })

  describe('GET /api/articles', () => {
    test('should return empty array when no articles exist', async () => {
      const res = await app.request('/api/articles')
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data).toEqual([])
    })

    test('should return all articles', async () => {
      insertArticle(testDb, {
        id: 'test-1',
        source_type: 'reddit',
        source_name: 'r/test',
        title: 'Test Article 1',
        url: 'http://test1.com',
        published_at: '2024-01-15T10:00:00Z',
        fetched_at: '2024-01-15T12:00:00Z'
      })
      insertArticle(testDb, {
        id: 'test-2',
        source_type: 'hackernews',
        source_name: 'HN',
        title: 'Test Article 2',
        url: 'http://test2.com',
        published_at: '2024-01-15T11:00:00Z',
        fetched_at: '2024-01-15T12:00:00Z'
      })

      const res = await app.request('/api/articles')
      const data = await res.json() as Article[]

      expect(res.status).toBe(200)
      expect(data).toHaveLength(2)
    })

    test('should filter by source type', async () => {
      insertArticle(testDb, {
        id: 'reddit-1',
        source_type: 'reddit',
        source_name: 'r/test',
        title: 'Reddit Article',
        url: 'http://reddit.com/1',
        fetched_at: '2024-01-15T12:00:00Z'
      })
      insertArticle(testDb, {
        id: 'hn-1',
        source_type: 'hackernews',
        source_name: 'HN',
        title: 'HN Article',
        url: 'http://hn.com/1',
        fetched_at: '2024-01-15T12:00:00Z'
      })

      const res = await app.request('/api/articles?source=reddit')
      const data = await res.json() as Article[]

      expect(res.status).toBe(200)
      expect(data).toHaveLength(1)
      expect(data[0].source_type).toBe('reddit')
    })

    test('should sort by recent (default)', async () => {
      insertArticle(testDb, {
        id: 'old',
        source_type: 'reddit',
        source_name: 'r/test',
        title: 'Old Article',
        url: 'http://old.com',
        published_at: '2024-01-01T00:00:00Z',
        fetched_at: '2024-01-15T12:00:00Z'
      })
      insertArticle(testDb, {
        id: 'new',
        source_type: 'reddit',
        source_name: 'r/test',
        title: 'New Article',
        url: 'http://new.com',
        published_at: '2024-01-15T00:00:00Z',
        fetched_at: '2024-01-15T12:00:00Z'
      })

      const res = await app.request('/api/articles')
      const data = await res.json() as Article[]

      expect(data[0].id).toBe('new')
      expect(data[1].id).toBe('old')
    })

    test('should sort by engagement when requested', async () => {
      insertArticle(testDb, {
        id: 'low',
        source_type: 'reddit',
        source_name: 'r/test',
        title: 'Low Engagement',
        url: 'http://low.com',
        published_at: '2024-01-15T00:00:00Z',
        fetched_at: '2024-01-15T12:00:00Z',
        engagement_score: 10
      })
      insertArticle(testDb, {
        id: 'high',
        source_type: 'reddit',
        source_name: 'r/test',
        title: 'High Engagement',
        url: 'http://high.com',
        published_at: '2024-01-01T00:00:00Z',
        fetched_at: '2024-01-15T12:00:00Z',
        engagement_score: 90
      })

      const res = await app.request('/api/articles?sort=engagement')
      const data = await res.json() as Article[]

      expect(data[0].id).toBe('high')
      expect(data[1].id).toBe('low')
    })

    test('should respect limit parameter', async () => {
      for (let i = 0; i < 10; i++) {
        insertArticle(testDb, {
          id: `article-${i}`,
          source_type: 'reddit',
          source_name: 'r/test',
          title: `Article ${i}`,
          url: `http://test${i}.com`,
          fetched_at: '2024-01-15T12:00:00Z'
        })
      }

      const res = await app.request('/api/articles?limit=5')
      const data = await res.json() as Article[]

      expect(data).toHaveLength(5)
    })

    test('should respect offset parameter', async () => {
      for (let i = 0; i < 5; i++) {
        insertArticle(testDb, {
          id: `article-${i}`,
          source_type: 'reddit',
          source_name: 'r/test',
          title: `Article ${i}`,
          url: `http://test${i}.com`,
          published_at: `2024-01-${15 - i}T00:00:00Z`,
          fetched_at: '2024-01-15T12:00:00Z'
        })
      }

      const res = await app.request('/api/articles?limit=2&offset=2')
      const data = await res.json() as Article[]

      expect(data).toHaveLength(2)
      expect(data[0].id).toBe('article-2')
      expect(data[1].id).toBe('article-3')
    })
  })

  describe('POST /api/articles/:id/read', () => {
    test('should mark article as read', async () => {
      insertArticle(testDb, {
        id: 'mark-read',
        source_type: 'reddit',
        source_name: 'r/test',
        title: 'Mark as Read',
        url: 'http://read.com',
        fetched_at: '2024-01-15T12:00:00Z'
      })

      const before = getArticleById(testDb, 'mark-read')
      expect(before!.is_read).toBe(0)

      const res = await app.request('/api/articles/mark-read/read', { method: 'POST' })
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data).toEqual({ success: true })

      const after = getArticleById(testDb, 'mark-read')
      expect(after!.is_read).toBe(1)
    })

    test('should be idempotent', async () => {
      insertArticle(testDb, {
        id: 'idempotent',
        source_type: 'reddit',
        source_name: 'r/test',
        title: 'Idempotent Test',
        url: 'http://idempotent.com',
        fetched_at: '2024-01-15T12:00:00Z'
      })

      await app.request('/api/articles/idempotent/read', { method: 'POST' })
      await app.request('/api/articles/idempotent/read', { method: 'POST' })
      await app.request('/api/articles/idempotent/read', { method: 'POST' })

      const article = getArticleById(testDb, 'idempotent')
      expect(article!.is_read).toBe(1)
    })
  })

  describe('POST /api/articles/:id/unread', () => {
    test('should mark article as unread', async () => {
      insertArticle(testDb, {
        id: 'mark-unread',
        source_type: 'reddit',
        source_name: 'r/test',
        title: 'Mark as Unread',
        url: 'http://unread.com',
        fetched_at: '2024-01-15T12:00:00Z',
        is_read: 1
      })

      const before = getArticleById(testDb, 'mark-unread')
      expect(before!.is_read).toBe(1)

      const res = await app.request('/api/articles/mark-unread/unread', { method: 'POST' })
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data).toEqual({ success: true })

      const after = getArticleById(testDb, 'mark-unread')
      expect(after!.is_read).toBe(0)
    })
  })

  describe('GET /api/articles/:id', () => {
    test('should return article by id', async () => {
      insertArticle(testDb, {
        id: 'find-by-id',
        source_type: 'reddit',
        source_name: 'r/test',
        title: 'Find By ID',
        url: 'http://find.com',
        fetched_at: '2024-01-15T12:00:00Z'
      })

      const res = await app.request('/api/articles/find-by-id')
      const data = await res.json() as Article

      expect(res.status).toBe(200)
      expect(data.id).toBe('find-by-id')
      expect(data.title).toBe('Find By ID')
    })

    test('should return 404 for non-existent article', async () => {
      const res = await app.request('/api/articles/does-not-exist')
      const data = await res.json()

      expect(res.status).toBe(404)
      expect(data).toEqual({ error: 'Article not found' })
    })
  })
})

describe('API Response Format', () => {
  let testDb2: Database
  let app2: Hono

  beforeAll(() => {
    testDb2 = new Database(':memory:')
    initTestDatabase(testDb2)
    app2 = createTestApp(testDb2)
  })

  afterAll(() => {
    testDb2.close()
  })

  test('articles should have all required fields', async () => {
    insertArticle(testDb2, {
      id: 'complete-article',
      source_type: 'reddit',
      source_name: 'r/test',
      title: 'Complete Article',
      url: 'http://complete.com',
      content: 'Some content',
      author: 'testuser',
      published_at: '2024-01-15T10:00:00Z',
      fetched_at: '2024-01-15T12:00:00Z',
      engagement_score: 75,
      engagement_raw: '500',
      engagement_type: 'upvotes'
    })

    const res = await app2.request('/api/articles')
    const data = await res.json() as Article[]
    const article = data[0]

    // Required fields
    expect(article).toHaveProperty('id')
    expect(article).toHaveProperty('source_type')
    expect(article).toHaveProperty('source_name')
    expect(article).toHaveProperty('title')
    expect(article).toHaveProperty('url')
    expect(article).toHaveProperty('fetched_at')
    expect(article).toHaveProperty('is_read')

    // Optional fields
    expect(article).toHaveProperty('content')
    expect(article).toHaveProperty('author')
    expect(article).toHaveProperty('published_at')
    expect(article).toHaveProperty('summary')
    expect(article).toHaveProperty('engagement_score')
    expect(article).toHaveProperty('engagement_raw')
    expect(article).toHaveProperty('engagement_type')
  })
})
