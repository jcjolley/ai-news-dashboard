const OLLAMA_BASE_URL = process.env.OLLAMA_URL || 'http://localhost:11434'
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'llama3.2'

interface OllamaResponse {
  model: string
  response: string
  done: boolean
}

export async function summarizeText(text: string, title: string): Promise<string> {
  const prompt = `Summarize this AI/ML news article in 2-3 sentences. Focus on key findings, announcements, or insights.

IMPORTANT: Output ONLY the summary text. Do NOT include any preamble like "Here is a summary" or "This article discusses". Do NOT say "Unfortunately" or comment on the content quality. Just write the summary directly.

Title: ${title}

Content:
${text.slice(0, 4000)}

Summary:`

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000) // 60 second timeout

    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        prompt,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 200
        }
      }),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.status}`)
    }

    const data = await response.json() as OllamaResponse
    return data.response.trim()
  } catch (error) {
    console.error('Ollama summarization error:', error)
    throw new Error('Failed to generate summary. Make sure Ollama is running.')
  }
}

export async function checkOllamaHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`)
    return response.ok
  } catch {
    return false
  }
}
