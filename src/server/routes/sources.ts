import { Hono } from 'hono'
import {
  getSources,
  getAllSourcesByType,
  getSourceById,
  addSource,
  updateSource,
  deleteSource,
  toggleSource,
  type SourceType,
  type SourceInput
} from '../db/schema'

const app = new Hono()

app.get('/', (c) => {
  const sources = getSources()
  // Group by type for easier frontend consumption
  const grouped = sources.reduce((acc, source) => {
    if (!acc[source.type]) {
      acc[source.type] = []
    }
    acc[source.type].push(source)
    return acc
  }, {} as Record<string, typeof sources>)
  return c.json(grouped)
})

app.get('/:type', (c) => {
  const type = c.req.param('type') as SourceType
  const sources = getAllSourcesByType(type)
  return c.json(sources)
})

app.post('/', async (c) => {
  const body = await c.req.json() as SourceInput

  if (!body.type || !body.name || !body.value) {
    return c.json({ error: 'type, name, and value are required' }, 400)
  }

  const validTypes: SourceType[] = ['rss', 'podcast', 'reddit', 'youtube', 'hackernews']
  if (!validTypes.includes(body.type)) {
    return c.json({ error: 'Invalid source type' }, 400)
  }

  const id = addSource(body)
  return c.json({ id, success: true })
})

app.put('/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  const body = await c.req.json() as Partial<SourceInput>

  if (isNaN(id)) {
    return c.json({ error: 'Invalid ID' }, 400)
  }

  const success = updateSource(id, body)
  if (!success) {
    return c.json({ error: 'Source not found' }, 404)
  }

  return c.json({ success: true })
})

app.delete('/:id', (c) => {
  const id = parseInt(c.req.param('id'))

  if (isNaN(id)) {
    return c.json({ error: 'Invalid ID' }, 400)
  }

  const success = deleteSource(id)
  if (!success) {
    return c.json({ error: 'Source not found' }, 404)
  }

  return c.json({ success: true })
})

app.patch('/:id/toggle', (c) => {
  const id = parseInt(c.req.param('id'))

  if (isNaN(id)) {
    return c.json({ error: 'Invalid ID' }, 400)
  }

  const success = toggleSource(id)
  if (!success) {
    return c.json({ error: 'Source not found' }, 404)
  }

  const source = getSourceById(id)
  return c.json({ success: true, enabled: source?.enabled })
})

export default app
