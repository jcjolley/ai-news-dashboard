import { describe, test, expect } from 'bun:test'

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
 */
function normalizeEngagement(raw: number, sourceType: string): number {
  if (raw <= 0) return 0

  const scale = NORMALIZATION_SCALES[sourceType] || 1000

  // Use logarithmic scaling to handle wide range of values
  const logRaw = Math.log10(raw + 1)
  const logScale = Math.log10(scale + 1)

  // Normalize to 0-100 range
  const normalized = (logRaw / logScale) * 100

  return Math.min(100, Math.round(normalized))
}

/**
 * Parse a human-readable number string (e.g., "1.2M", "15K", "1,234")
 */
function parseEngagementNumber(str: string): number {
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

describe('Engagement Normalization', () => {
  describe('normalizeEngagement', () => {
    test('should return 0 for zero or negative values', () => {
      expect(normalizeEngagement(0, 'reddit')).toBe(0)
      expect(normalizeEngagement(-5, 'reddit')).toBe(0)
      expect(normalizeEngagement(-100, 'hackernews')).toBe(0)
    })

    test('should handle small values (not round to 0)', () => {
      // This was a bug we fixed - small values should still get meaningful scores
      expect(normalizeEngagement(1, 'reddit')).toBeGreaterThan(0)
      expect(normalizeEngagement(5, 'reddit')).toBeGreaterThan(0)
      expect(normalizeEngagement(10, 'hackernews')).toBeGreaterThan(0)
    })

    test('should scale Reddit upvotes appropriately', () => {
      // Reddit: 10k = 100
      const score1 = normalizeEngagement(1, 'reddit')
      const score100 = normalizeEngagement(100, 'reddit')
      const score1000 = normalizeEngagement(1000, 'reddit')
      const score10000 = normalizeEngagement(10000, 'reddit')

      // Should increase with value
      expect(score100).toBeGreaterThan(score1)
      expect(score1000).toBeGreaterThan(score100)
      expect(score10000).toBeGreaterThan(score1000)

      // 10k should be close to 100
      expect(score10000).toBe(100)
    })

    test('should scale Hacker News points appropriately', () => {
      // HN: 500 = 100
      const score1 = normalizeEngagement(1, 'hackernews')
      const score50 = normalizeEngagement(50, 'hackernews')
      const score500 = normalizeEngagement(500, 'hackernews')

      expect(score50).toBeGreaterThan(score1)
      expect(score500).toBeGreaterThan(score50)
      expect(score500).toBe(100)
    })

    test('should scale YouTube views appropriately', () => {
      // YouTube: 1M = 100
      const score1000 = normalizeEngagement(1000, 'youtube')
      const score100000 = normalizeEngagement(100000, 'youtube')
      const score1000000 = normalizeEngagement(1000000, 'youtube')

      expect(score100000).toBeGreaterThan(score1000)
      expect(score1000000).toBeGreaterThan(score100000)
      expect(score1000000).toBe(100)
    })

    test('should cap at 100 for values above scale', () => {
      expect(normalizeEngagement(50000, 'reddit')).toBe(100)
      expect(normalizeEngagement(2000, 'hackernews')).toBe(100)
      expect(normalizeEngagement(5000000, 'youtube')).toBe(100)
    })

    test('should use default scale for unknown source types', () => {
      const score = normalizeEngagement(1000, 'unknown_source')
      expect(score).toBe(100) // Default scale is 1000
    })

    test('should produce consistent results (deterministic)', () => {
      const score1 = normalizeEngagement(500, 'reddit')
      const score2 = normalizeEngagement(500, 'reddit')
      const score3 = normalizeEngagement(500, 'reddit')

      expect(score1).toBe(score2)
      expect(score2).toBe(score3)
    })
  })

  describe('parseEngagementNumber', () => {
    test('should parse plain integers', () => {
      expect(parseEngagementNumber('123')).toBe(123)
      expect(parseEngagementNumber('0')).toBe(0)
      expect(parseEngagementNumber('999999')).toBe(999999)
    })

    test('should handle comma-separated numbers', () => {
      expect(parseEngagementNumber('1,234')).toBe(1234)
      expect(parseEngagementNumber('1,234,567')).toBe(1234567)
      expect(parseEngagementNumber('10,000')).toBe(10000)
    })

    test('should parse K suffix', () => {
      expect(parseEngagementNumber('1k')).toBe(1000)
      expect(parseEngagementNumber('1K')).toBe(1000)
      expect(parseEngagementNumber('1.5k')).toBe(1500)
      expect(parseEngagementNumber('15K')).toBe(15000)
      expect(parseEngagementNumber('2.5K')).toBe(2500)
    })

    test('should parse M suffix', () => {
      expect(parseEngagementNumber('1m')).toBe(1000000)
      expect(parseEngagementNumber('1M')).toBe(1000000)
      expect(parseEngagementNumber('1.2M')).toBe(1200000)
      expect(parseEngagementNumber('2.5m')).toBe(2500000)
    })

    test('should parse B suffix', () => {
      expect(parseEngagementNumber('1b')).toBe(1000000000)
      expect(parseEngagementNumber('1B')).toBe(1000000000)
      expect(parseEngagementNumber('1.5B')).toBe(1500000000)
    })

    test('should handle whitespace', () => {
      expect(parseEngagementNumber('  123  ')).toBe(123)
      expect(parseEngagementNumber(' 1.5k ')).toBe(1500)
    })

    test('should return 0 for invalid input', () => {
      expect(parseEngagementNumber('')).toBe(0)
      expect(parseEngagementNumber('abc')).toBe(0)
      expect(parseEngagementNumber('not a number')).toBe(0)
    })
  })

  describe('Integration: parse then normalize', () => {
    test('should correctly process typical Reddit engagement', () => {
      const raw = parseEngagementNumber('5.2k')
      const score = normalizeEngagement(raw, 'reddit')

      expect(raw).toBe(5200)
      expect(score).toBeGreaterThan(80)
      expect(score).toBeLessThanOrEqual(100)
    })

    test('should correctly process typical YouTube engagement', () => {
      const raw = parseEngagementNumber('1.2M')
      const score = normalizeEngagement(raw, 'youtube')

      expect(raw).toBe(1200000)
      expect(score).toBe(100) // Over scale
    })

    test('should correctly process typical HN engagement', () => {
      const raw = parseEngagementNumber('342')
      const score = normalizeEngagement(raw, 'hackernews')

      expect(raw).toBe(342)
      expect(score).toBeGreaterThan(80)
      expect(score).toBeLessThan(100)
    })
  })
})

describe('Engagement Sorting Behavior', () => {
  test('should rank higher engagement above lower engagement', () => {
    const articles = [
      { id: '1', engagement_score: 50 },
      { id: '2', engagement_score: 90 },
      { id: '3', engagement_score: 10 },
      { id: '4', engagement_score: 75 },
    ]

    const sorted = [...articles].sort((a, b) =>
      (b.engagement_score ?? 0) - (a.engagement_score ?? 0)
    )

    expect(sorted[0].id).toBe('2') // 90
    expect(sorted[1].id).toBe('4') // 75
    expect(sorted[2].id).toBe('1') // 50
    expect(sorted[3].id).toBe('3') // 10
  })

  test('should handle null engagement scores', () => {
    const articles = [
      { id: '1', engagement_score: null },
      { id: '2', engagement_score: 50 },
      { id: '3', engagement_score: null },
      { id: '4', engagement_score: 25 },
    ]

    const sorted = [...articles].sort((a, b) =>
      (b.engagement_score ?? 0) - (a.engagement_score ?? 0)
    )

    // Null scores should be treated as 0 and come last
    expect(sorted[0].id).toBe('2') // 50
    expect(sorted[1].id).toBe('4') // 25
    // Null items should be at the end
    expect(sorted[2].engagement_score).toBeNull()
    expect(sorted[3].engagement_score).toBeNull()
  })
})
