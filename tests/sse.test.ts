import { describe, test, expect } from 'bun:test'
import { Hono } from 'hono'

interface SSEEvent {
  type: string
  source?: string
  status?: string
  count?: number
  index?: number
  total?: number
  error?: string
}

// Parse SSE events from a text stream
function parseSSEEvents(text: string): SSEEvent[] {
  const events: SSEEvent[] = []
  const lines = text.split('\n')

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      try {
        const data = JSON.parse(line.slice(6))
        events.push(data)
      } catch {
        // Skip invalid JSON
      }
    }
  }

  return events
}

// Create a mock streaming endpoint that simulates the refresh-all-stream behavior
function createMockSSEApp() {
  const app = new Hono()

  app.post('/api/refresh-all-stream', async (c) => {
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        const sources = [
          { name: 'feeds', label: 'RSS Feeds' },
          { name: 'podcasts', label: 'Podcasts' },
          { name: 'reddit', label: 'Reddit' },
          { name: 'hackernews', label: 'Hacker News' },
          { name: 'youtube', label: 'YouTube' }
        ]

        for (let i = 0; i < sources.length; i++) {
          const source = sources[i]

          // Send "starting" event
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({
              type: 'progress',
              source: source.label,
              status: 'fetching',
              index: i,
              total: sources.length
            })}\n\n`
          ))

          // Simulate fetch completion
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({
              type: 'complete',
              source: source.label,
              count: (i + 1) * 10, // Mock article counts
              index: i,
              total: sources.length
            })}\n\n`
          ))
        }

        // Send engagement events
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({
            type: 'engagement',
            status: 'calculating'
          })}\n\n`
        ))

        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({
            type: 'engagement',
            status: 'complete'
          })}\n\n`
        ))

        // Send done event
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ type: 'done' })}\n\n`
        ))

        controller.close()
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    })
  })

  // Error simulation endpoint
  app.post('/api/refresh-with-error', async (c) => {
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        // Success
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({
            type: 'progress',
            source: 'RSS Feeds',
            status: 'fetching',
            index: 0,
            total: 2
          })}\n\n`
        ))

        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({
            type: 'complete',
            source: 'RSS Feeds',
            count: 50,
            index: 0,
            total: 2
          })}\n\n`
        ))

        // Error
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({
            type: 'progress',
            source: 'Podcasts',
            status: 'fetching',
            index: 1,
            total: 2
          })}\n\n`
        ))

        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({
            type: 'error',
            source: 'Podcasts',
            error: 'Network timeout',
            index: 1,
            total: 2
          })}\n\n`
        ))

        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ type: 'done' })}\n\n`
        ))

        controller.close()
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache'
      }
    })
  })

  return app
}

describe('SSE Streaming', () => {
  const app = createMockSSEApp()

  describe('refresh-all-stream endpoint', () => {
    test('should return correct content-type header', async () => {
      const res = await app.request('/api/refresh-all-stream', { method: 'POST' })

      expect(res.headers.get('Content-Type')).toBe('text/event-stream')
      expect(res.headers.get('Cache-Control')).toBe('no-cache')
    })

    test('should emit progress events for each source', async () => {
      const res = await app.request('/api/refresh-all-stream', { method: 'POST' })
      const text = await res.text()
      const events = parseSSEEvents(text)

      const progressEvents = events.filter(e => e.type === 'progress')

      expect(progressEvents).toHaveLength(5)
      expect(progressEvents.every(e => e.status === 'fetching')).toBe(true)
    })

    test('should emit complete events with article counts', async () => {
      const res = await app.request('/api/refresh-all-stream', { method: 'POST' })
      const text = await res.text()
      const events = parseSSEEvents(text)

      const completeEvents = events.filter(e => e.type === 'complete')

      expect(completeEvents).toHaveLength(5)
      expect(completeEvents.every(e => typeof e.count === 'number')).toBe(true)
      expect(completeEvents.every(e => e.count! > 0)).toBe(true)
    })

    test('should include source labels in events', async () => {
      const res = await app.request('/api/refresh-all-stream', { method: 'POST' })
      const text = await res.text()
      const events = parseSSEEvents(text)

      const sources = events
        .filter(e => e.type === 'complete')
        .map(e => e.source)

      expect(sources).toContain('RSS Feeds')
      expect(sources).toContain('Podcasts')
      expect(sources).toContain('Reddit')
      expect(sources).toContain('Hacker News')
      expect(sources).toContain('YouTube')
    })

    test('should include index and total in events', async () => {
      const res = await app.request('/api/refresh-all-stream', { method: 'POST' })
      const text = await res.text()
      const events = parseSSEEvents(text)

      const completeEvents = events.filter(e => e.type === 'complete')

      for (let i = 0; i < 5; i++) {
        expect(completeEvents[i].index).toBe(i)
        expect(completeEvents[i].total).toBe(5)
      }
    })

    test('should emit engagement calculation events', async () => {
      const res = await app.request('/api/refresh-all-stream', { method: 'POST' })
      const text = await res.text()
      const events = parseSSEEvents(text)

      const engagementEvents = events.filter(e => e.type === 'engagement')

      expect(engagementEvents).toHaveLength(2)
      expect(engagementEvents[0].status).toBe('calculating')
      expect(engagementEvents[1].status).toBe('complete')
    })

    test('should emit done event at the end', async () => {
      const res = await app.request('/api/refresh-all-stream', { method: 'POST' })
      const text = await res.text()
      const events = parseSSEEvents(text)

      const doneEvent = events.find(e => e.type === 'done')
      expect(doneEvent).toBeDefined()

      // Done should be the last event
      const lastEvent = events[events.length - 1]
      expect(lastEvent.type).toBe('done')
    })

    test('should emit events in correct order', async () => {
      const res = await app.request('/api/refresh-all-stream', { method: 'POST' })
      const text = await res.text()
      const events = parseSSEEvents(text)

      // Should be: progress, complete pairs for each source, then engagement events, then done
      const eventTypes = events.map(e => e.type)

      // First 10 should be alternating progress/complete
      for (let i = 0; i < 5; i++) {
        expect(eventTypes[i * 2]).toBe('progress')
        expect(eventTypes[i * 2 + 1]).toBe('complete')
      }

      // Then engagement events
      expect(eventTypes[10]).toBe('engagement')
      expect(eventTypes[11]).toBe('engagement')

      // Finally done
      expect(eventTypes[12]).toBe('done')
    })
  })

  describe('error handling', () => {
    test('should emit error events when source fails', async () => {
      const res = await app.request('/api/refresh-with-error', { method: 'POST' })
      const text = await res.text()
      const events = parseSSEEvents(text)

      const errorEvents = events.filter(e => e.type === 'error')

      expect(errorEvents).toHaveLength(1)
      expect(errorEvents[0].source).toBe('Podcasts')
      expect(errorEvents[0].error).toBe('Network timeout')
    })

    test('should continue after error and emit done', async () => {
      const res = await app.request('/api/refresh-with-error', { method: 'POST' })
      const text = await res.text()
      const events = parseSSEEvents(text)

      // Should have both success and error, plus done
      const completeEvents = events.filter(e => e.type === 'complete')
      const errorEvents = events.filter(e => e.type === 'error')
      const doneEvent = events.find(e => e.type === 'done')

      expect(completeEvents).toHaveLength(1)
      expect(errorEvents).toHaveLength(1)
      expect(doneEvent).toBeDefined()
    })
  })
})

describe('SSE Event Format', () => {
  test('progress event should have required fields', () => {
    const event: SSEEvent = {
      type: 'progress',
      source: 'RSS Feeds',
      status: 'fetching',
      index: 0,
      total: 5
    }

    expect(event.type).toBe('progress')
    expect(event.source).toBeDefined()
    expect(event.status).toBe('fetching')
    expect(typeof event.index).toBe('number')
    expect(typeof event.total).toBe('number')
  })

  test('complete event should have required fields', () => {
    const event: SSEEvent = {
      type: 'complete',
      source: 'Reddit',
      count: 42,
      index: 2,
      total: 5
    }

    expect(event.type).toBe('complete')
    expect(event.source).toBeDefined()
    expect(typeof event.count).toBe('number')
    expect(event.count).toBeGreaterThanOrEqual(0)
  })

  test('error event should have required fields', () => {
    const event: SSEEvent = {
      type: 'error',
      source: 'YouTube',
      error: 'API rate limited',
      index: 4,
      total: 5
    }

    expect(event.type).toBe('error')
    expect(event.source).toBeDefined()
    expect(event.error).toBeDefined()
    expect(typeof event.error).toBe('string')
  })

  test('engagement event should have status field', () => {
    const calculatingEvent: SSEEvent = {
      type: 'engagement',
      status: 'calculating'
    }

    const completeEvent: SSEEvent = {
      type: 'engagement',
      status: 'complete'
    }

    expect(calculatingEvent.status).toBe('calculating')
    expect(completeEvent.status).toBe('complete')
  })
})

describe('Client-side SSE parsing', () => {
  test('should correctly parse SSE data lines', () => {
    const sseText = `data: {"type":"progress","source":"RSS Feeds","index":0}

data: {"type":"complete","source":"RSS Feeds","count":50}

data: {"type":"done"}

`

    const events = parseSSEEvents(sseText)

    expect(events).toHaveLength(3)
    expect(events[0].type).toBe('progress')
    expect(events[1].type).toBe('complete')
    expect(events[2].type).toBe('done')
  })

  test('should handle empty lines and malformed data', () => {
    const sseText = `
data: {"type":"valid"}

data: not valid json

data: {"type":"also-valid"}

`

    const events = parseSSEEvents(sseText)

    expect(events).toHaveLength(2)
    expect(events[0].type).toBe('valid')
    expect(events[1].type).toBe('also-valid')
  })
})
