const OLLAMA_BASE_URL = process.env.OLLAMA_URL || 'http://localhost:11434'
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'llama3.2'

export interface EngagementResult {
  score: number        // Normalized 0-100
  raw: string          // Original value (e.g., "15234")
  type: string         // 'upvotes' | 'points' | 'views' | 'likes'
}

interface OllamaResponse {
  model: string
  response: string
  done: boolean
}

// Normalization scales for different source types
const NORMALIZATION_SCALES: Record<string, number> = {
  reddit: 10000,      // 10k upvotes = score of 100
  hackernews: 500,    // 500 points = score of 100
  youtube: 1000000,   // 1M views = score of 100
  rss: 1000,          // Generic scale for RSS
  podcast: 1000,      // Generic scale for podcasts
}

/**
 * Normalize a raw engagement value to a 0-100 scale using logarithmic scaling
 * This ensures small values (1-10) still get meaningful non-zero scores
 */
export function normalizeEngagement(raw: number, sourceType: string): number {
  if (raw <= 0) return 0

  const scale = NORMALIZATION_SCALES[sourceType] || 1000

  // Use logarithmic scaling to handle wide range of values
  // log10(1) = 0, log10(10) = 1, log10(100) = 2, log10(1000) = 3, etc.
  const logRaw = Math.log10(raw + 1)
  const logScale = Math.log10(scale + 1)

  // Normalize to 0-100 range
  const normalized = (logRaw / logScale) * 100

  return Math.min(100, Math.round(normalized))
}

/**
 * Parse a human-readable number string (e.g., "1.2M", "15K", "1,234")
 */
export function parseEngagementNumber(str: string): number {
  const cleaned = str.replace(/,/g, '').trim().toLowerCase()

  const multipliers: Record<string, number> = {
    k: 1000,
    m: 1000000,
    b: 1000000000,
  }

  for (const [suffix, multiplier] of Object.entries(multipliers)) {
    if (cleaned.endsWith(suffix)) {
      const num = parseFloat(cleaned.slice(0, -1))
      return Math.round(num * multiplier)
    }
  }

  return parseInt(cleaned, 10) || 0
}

/**
 * Scrape page content from a URL
 */
export async function scrapePageContent(url: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      console.error(`Failed to fetch ${url}: ${response.status}`)
      return null
    }

    const html = await response.text()

    // Basic HTML to text conversion - strip tags but keep text
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    return text.slice(0, 5000) // Limit to first 5000 chars
  } catch (error) {
    console.error(`Error scraping ${url}:`, error)
    return null
  }
}

/**
 * Extract engagement metrics from page content using LLM
 */
export async function extractEngagementWithLLM(
  content: string,
  sourceType: string,
  url: string
): Promise<EngagementResult | null> {
  const metricHints: Record<string, string> = {
    youtube: 'view count (e.g., "1.2M views", "15,234 views")',
    reddit: 'upvotes or score (e.g., "1.2k upvotes", "Score: 500")',
    hackernews: 'points (e.g., "342 points")',
    rss: 'any engagement metric like shares, comments, or views',
    podcast: 'listen count or downloads',
  }

  const lookFor = metricHints[sourceType] || 'any popularity or engagement metric'

  const prompt = `Extract the primary engagement metric from this webpage content.

Source type: ${sourceType}
URL: ${url}

Look for: ${lookFor}

Page content (excerpt):
${content.slice(0, 3000)}

IMPORTANT: Respond with ONLY a valid JSON object, no other text.
If you find an engagement metric, respond with:
{"raw": "the exact number as shown", "type": "views|upvotes|points|likes|comments|shares", "found": true}

If no engagement metric is found, respond with:
{"found": false}

JSON response:`

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        prompt,
        stream: false,
        options: {
          temperature: 0.1,
          num_predict: 100,
        },
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.status}`)
    }

    const data = (await response.json()) as OllamaResponse
    const responseText = data.response.trim()

    // Try to parse JSON from the response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('No JSON found in LLM response:', responseText)
      return null
    }

    const parsed = JSON.parse(jsonMatch[0])

    if (!parsed.found || !parsed.raw) {
      return null
    }

    const rawNumber = parseEngagementNumber(parsed.raw)
    if (rawNumber === 0) {
      return null
    }

    return {
      score: normalizeEngagement(rawNumber, sourceType),
      raw: parsed.raw,
      type: parsed.type || 'unknown',
    }
  } catch (error) {
    console.error('LLM engagement extraction error:', error)
    return null
  }
}

/**
 * Fetch engagement for an article by scraping its URL
 */
export async function fetchEngagementForArticle(
  url: string,
  sourceType: string
): Promise<EngagementResult | null> {
  const content = await scrapePageContent(url)
  if (!content) {
    return null
  }

  return extractEngagementWithLLM(content, sourceType, url)
}
