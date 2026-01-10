/**
 * Generate a deterministic ID from a URL and title.
 * Uses a simple hash to create a short, unique identifier.
 */
export function generateArticleId(prefix: string, url: string, title: string): string {
  const str = `${url}-${title}`
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return `${prefix}-${Math.abs(hash).toString(36)}`
}
