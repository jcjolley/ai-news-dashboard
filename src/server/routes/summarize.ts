import { Hono } from 'hono'
import { getArticleById, saveSummary } from '../db/schema'
import { summarizeText, checkOllamaHealth, listModels } from '../services/ollama'

const app = new Hono()

app.get('/health', async (c) => {
  const healthy = await checkOllamaHealth()
  const models = healthy ? await listModels() : []
  return c.json({
    healthy,
    models,
    message: healthy ? 'Ollama is running' : 'Ollama is not available'
  })
})

app.post('/:id', async (c) => {
  const id = c.req.param('id')
  const article = getArticleById(id)

  if (!article) {
    return c.json({ error: 'Article not found' }, 404)
  }

  if (article.summary) {
    return c.json({ summary: article.summary, cached: true })
  }

  const textToSummarize = article.content || article.title

  try {
    const summary = await summarizeText(textToSummarize, article.title)
    saveSummary(id, summary)
    return c.json({ summary, cached: false })
  } catch (error) {
    return c.json({ error: String(error) }, 500)
  }
})

export default app
