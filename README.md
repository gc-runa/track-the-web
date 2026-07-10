# Track the Web

Notion-like workspace that runs an indefinite Hy3 agent swarm via OpenRouter to map a company's suppliers, customers, competitors, products, markets, and more — streaming entities, links, and a live agent log as it works.

## Setup

1. Copy `.env.local` (already created) or set:

```bash
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=tencent/hy3:free
SWARM_MAX_CONCURRENT=16
SWARM_MIN_RUNTIME_MS=3600000
```

2. Run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), enter a company + task, and watch the map populate.

## Notes

- Agents run concurrently and spawn follow-up agents continuously (queue capped for safety).
- Free-tier rate limits may slow bursts; the orchestrator retries with backoff and never idles.
- Keep the API key server-side only (`.env.local` is gitignored).
