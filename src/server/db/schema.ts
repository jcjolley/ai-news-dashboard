import { Database } from 'bun:sqlite'
import { join } from 'path'

const DB_PATH = join(import.meta.dir, '../../../data/news.db')

export const db = new Database(DB_PATH, { create: true })

export function initializeDatabase() {
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
      summary TEXT
    )
  `)

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_articles_source ON articles(source_type, source_name)
  `)

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at DESC)
  `)

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_articles_read ON articles(is_read)
  `)

  // Migration: Add engagement columns if they don't exist
  const columns = db.query("PRAGMA table_info(articles)").all() as { name: string }[]
  const columnNames = columns.map(c => c.name)

  if (!columnNames.includes('engagement_score')) {
    db.run('ALTER TABLE articles ADD COLUMN engagement_score INTEGER')
  }
  if (!columnNames.includes('engagement_raw')) {
    db.run('ALTER TABLE articles ADD COLUMN engagement_raw TEXT')
  }
  if (!columnNames.includes('engagement_type')) {
    db.run('ALTER TABLE articles ADD COLUMN engagement_type TEXT')
  }
  if (!columnNames.includes('engagement_fetched_at')) {
    db.run('ALTER TABLE articles ADD COLUMN engagement_fetched_at TEXT')
  }

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_articles_engagement ON articles(engagement_score DESC)
  `)

  console.log('Database initialized')
}

export interface Article {
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

export type SortOrder = 'recent' | 'top'
export type TimePeriod = 'day' | 'week' | 'month' | 'year' | 'all'

function getTimePeriodFilter(period: TimePeriod): string {
  const now = new Date()
  switch (period) {
    case 'day':
      now.setDate(now.getDate() - 1)
      return `AND published_at >= '${now.toISOString()}'`
    case 'week':
      now.setDate(now.getDate() - 7)
      return `AND published_at >= '${now.toISOString()}'`
    case 'month':
      now.setMonth(now.getMonth() - 1)
      return `AND published_at >= '${now.toISOString()}'`
    case 'year':
      now.setFullYear(now.getFullYear() - 1)
      return `AND published_at >= '${now.toISOString()}'`
    case 'all':
    default:
      return ''
  }
}

export interface ArticleInput {
  id: string
  source_type: string
  source_name: string
  title: string
  url: string
  content: string | null
  author: string | null
  published_at: string | null
  fetched_at: string
  engagement_score?: number | null
  engagement_raw?: string | null
  engagement_type?: string | null
  engagement_fetched_at?: string | null
}

export function insertArticle(article: ArticleInput) {
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
    article.content,
    article.author,
    article.published_at,
    article.fetched_at,
    article.engagement_score ?? null,
    article.engagement_raw ?? null,
    article.engagement_type ?? null,
    article.engagement_fetched_at ?? null
  )
}

export function getArticles(sourceType?: string, limit = 100, offset = 0, sort: SortOrder = 'recent', timePeriod: TimePeriod = 'all'): Article[] {
  const orderBy = sort === 'top'
    ? 'ORDER BY COALESCE(engagement_score, 0) DESC, published_at DESC'
    : 'ORDER BY published_at DESC'

  const timeFilter = sort === 'top' ? getTimePeriodFilter(timePeriod) : ''

  if (sourceType) {
    return db.query(`
      SELECT * FROM articles
      WHERE source_type = ? ${timeFilter}
      ${orderBy}
      LIMIT ? OFFSET ?
    `).all(sourceType, limit, offset) as Article[]
  }
  return db.query(`
    SELECT * FROM articles
    WHERE 1=1 ${timeFilter}
    ${orderBy}
    LIMIT ? OFFSET ?
  `).all(limit, offset) as Article[]
}

export function markAsRead(id: string) {
  db.run('UPDATE articles SET is_read = 1 WHERE id = ?', [id])
}

export function markAsUnread(id: string) {
  db.run('UPDATE articles SET is_read = 0 WHERE id = ?', [id])
}

export function saveSummary(id: string, summary: string) {
  db.run('UPDATE articles SET summary = ? WHERE id = ?', [summary, id])
}

export function getArticleById(id: string): Article | null {
  return db.query('SELECT * FROM articles WHERE id = ?').get(id) as Article | null
}

export function updateEngagement(
  id: string,
  score: number,
  raw: string,
  type: string
) {
  db.run(
    `UPDATE articles SET engagement_score = ?, engagement_raw = ?, engagement_type = ?, engagement_fetched_at = ? WHERE id = ?`,
    [score, raw, type, new Date().toISOString(), id]
  )
}

// Sources table and functions

export type SourceType = 'rss' | 'podcast' | 'reddit' | 'youtube' | 'hackernews'

export interface Source {
  id: number
  type: SourceType
  name: string
  value: string
  enabled: number
  created_at: string
  updated_at: string
}

export interface SourceInput {
  type: SourceType
  name: string
  value: string
  enabled?: number
}

export function initializeSources() {
  db.run(`
    CREATE TABLE IF NOT EXISTS sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      value TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  db.run(`CREATE INDEX IF NOT EXISTS idx_sources_type ON sources(type)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_sources_enabled ON sources(enabled)`)

  // Migrate from sources.json if table is empty
  const count = db.query('SELECT COUNT(*) as count FROM sources').get() as { count: number }
  if (count.count === 0) {
    migrateSourcesFromJson()
  }
}

function migrateSourcesFromJson() {
  try {
    const sourcesPath = new URL('../../../config/sources.json', import.meta.url).pathname
    // On Windows, remove leading slash from path like /C:/...
    const normalizedPath = process.platform === 'win32' && sourcesPath.startsWith('/')
      ? sourcesPath.slice(1)
      : sourcesPath
    const sourcesJson = JSON.parse(require('fs').readFileSync(normalizedPath, 'utf-8'))
    const now = new Date().toISOString()

    // Migrate RSS feeds
    for (const feed of sourcesJson.rss || []) {
      addSource({ type: 'rss', name: feed.name, value: feed.url })
    }

    // Migrate podcasts
    for (const podcast of sourcesJson.podcasts || []) {
      addSource({ type: 'podcast', name: podcast.name, value: podcast.url })
    }

    // Migrate Reddit subreddits
    for (const subreddit of sourcesJson.reddit || []) {
      addSource({ type: 'reddit', name: `r/${subreddit}`, value: subreddit })
    }

    // Migrate YouTube channels
    for (const channel of sourcesJson.youtube || []) {
      addSource({ type: 'youtube', name: channel.name, value: channel.channelId })
    }

    // Migrate HackerNews keywords
    for (const keyword of sourcesJson.hackernews?.keywords || []) {
      addSource({ type: 'hackernews', name: keyword, value: keyword })
    }

    console.log('Migrated sources from JSON to database')
  } catch (error) {
    console.error('Failed to migrate sources from JSON:', error)
  }
}

export function getSources(): Source[] {
  return db.query('SELECT * FROM sources ORDER BY type, name').all() as Source[]
}

export function getSourcesByType(type: SourceType): Source[] {
  return db.query('SELECT * FROM sources WHERE type = ? AND enabled = 1 ORDER BY name').all(type) as Source[]
}

export function getAllSourcesByType(type: SourceType): Source[] {
  return db.query('SELECT * FROM sources WHERE type = ? ORDER BY name').all(type) as Source[]
}

export function getSourceById(id: number): Source | null {
  return db.query('SELECT * FROM sources WHERE id = ?').get(id) as Source | null
}

export function addSource(source: SourceInput): number {
  const now = new Date().toISOString()
  const stmt = db.prepare(`
    INSERT INTO sources (type, name, value, enabled, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  const result = stmt.run(source.type, source.name, source.value, source.enabled ?? 1, now, now)
  return Number(result.lastInsertRowid)
}

export function updateSource(id: number, updates: Partial<SourceInput>): boolean {
  const source = getSourceById(id)
  if (!source) return false

  const now = new Date().toISOString()
  db.run(`
    UPDATE sources SET
      name = ?,
      value = ?,
      enabled = ?,
      updated_at = ?
    WHERE id = ?
  `, [
    updates.name ?? source.name,
    updates.value ?? source.value,
    updates.enabled ?? source.enabled,
    now,
    id
  ])
  return true
}

export function deleteSource(id: number): boolean {
  const result = db.run('DELETE FROM sources WHERE id = ?', [id])
  return result.changes > 0
}

export function toggleSource(id: number): boolean {
  const source = getSourceById(id)
  if (!source) return false

  const now = new Date().toISOString()
  db.run('UPDATE sources SET enabled = ?, updated_at = ? WHERE id = ?', [
    source.enabled === 1 ? 0 : 1,
    now,
    id
  ])
  return true
}
