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
}

export function insertArticle(article: Omit<Article, 'is_read' | 'summary'>) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO articles (id, source_type, source_name, title, url, content, author, published_at, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    article.fetched_at
  )
}

export function getArticles(sourceType?: string, limit = 100, offset = 0): Article[] {
  if (sourceType) {
    return db.query(`
      SELECT * FROM articles
      WHERE source_type = ?
      ORDER BY published_at DESC
      LIMIT ? OFFSET ?
    `).all(sourceType, limit, offset) as Article[]
  }
  return db.query(`
    SELECT * FROM articles
    ORDER BY published_at DESC
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
