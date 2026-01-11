# AI News Dashboard

A self-hosted news aggregator that collects AI-related content from multiple sources and provides AI-powered summaries using local Ollama.

## Features

- **Multi-source aggregation**: RSS feeds, podcasts, Reddit, YouTube, and Hacker News
- **AI-powered summaries**: Automatic article summarization using local Ollama (no API keys required)
- **Engagement tracking**: View counts, upvotes, and scores from each platform
- **Configurable sources**: Add, edit, and toggle sources through the settings UI
- **Dark mode**: Toggle between light and dark themes
- **Filtering & sorting**: Filter by source type, sort by recent or top (with time periods)
- **Read tracking**: Mark articles as read, filter to show unread only

## Quick Start with Docker

```bash
docker run -p 3000:3000 \
  -v ./data:/app/data \
  -e OLLAMA_URL=http://host.docker.internal:11434 \
  --add-host=host.docker.internal:host-gateway \
  jolleyboy/ai-news-dashboard:latest
```

Then open http://localhost:3000

## Docker Compose

```yaml
services:
  app:
    image: jolleyboy/ai-news-dashboard:latest
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    environment:
      - OLLAMA_URL=http://host.docker.internal:11434
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

## Local Development

### Prerequisites

- [Bun](https://bun.sh/) runtime
- [Ollama](https://ollama.ai/) (optional, for AI summaries)

### Setup

```bash
# Install dependencies
bun install

# Start development server
bun run dev
```

The app runs at http://localhost:3000

### Build for Production

```bash
bun run build
bun run start
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_URL` | `http://localhost:11434` | Ollama API endpoint |
| `OLLAMA_MODEL` | `llama3.2` | Model to use for summarization |

### Managing Sources

Click the gear icon in the header to open Settings. From there you can:

- **RSS Feeds**: Add any RSS/Atom feed URL
- **Podcasts**: Add podcast RSS feed URLs
- **Reddit**: Add subreddit names (e.g., `MachineLearning`)
- **YouTube**: Add channel URLs (e.g., `https://youtube.com/@channel`) or channel IDs
- **HN Keywords**: Add keywords to filter Hacker News stories

Each source can be enabled/disabled without deleting it.

## Architecture

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Hono.js (lightweight web framework)
- **Database**: SQLite (via bun:sqlite)
- **Runtime**: Bun

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/articles` | GET | List all articles |
| `/api/articles/:id/read` | POST | Mark article as read |
| `/api/articles/:id/summarize` | POST | Generate AI summary |
| `/api/refresh` | POST | Refresh all sources |
| `/api/sources` | GET | List all sources |
| `/api/sources` | POST | Add new source |
| `/api/sources/:id` | PUT | Update source |
| `/api/sources/:id` | DELETE | Delete source |
| `/api/sources/:id/toggle` | PATCH | Toggle source enabled/disabled |

## Data Storage

- SQLite database stored in `./data/news.db`
- Mount the `/app/data` volume in Docker to persist data

## License

MIT
