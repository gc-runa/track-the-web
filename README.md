# Track the Web

Bloomberg-style terminal that runs an indefinite Hy3 agent swarm via OpenRouter. Agents collectively build a source-grounded digital map of suppliers, customers, competitors, products, markets, and more — streaming every action live.

## Local

```bash
npm install
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) (or 3000). Enter a company + mission. Use the **AGENTS** tab to watch live workers, **TAPE** for the tick log, and entity pages for **SOURCE DATA**.

## Render (free tier)

Service: [track-the-web.onrender.com](https://track-the-web.onrender.com)  
Dashboard: [Render service](https://dashboard.render.com/web/srv-d98ku657vvec739qkr7g)

Blueprint: `render.yaml`  
Free web services sleep after ~15 minutes idle — keep the terminal open (SSE) or hit `/api/health` to wake.

Required env vars on Render:

- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL=tencent/hy3:free`
- `SWARM_MAX_CONCURRENT=6` (keep low on free 512MB)
- `NEXT_PUBLIC_APP_URL=https://track-the-web.onrender.com`

## Notes

- Every entity carries structured sources (kind, publisher, title, excerpt, optional real URL).
- Inference without evidence is labeled — URLs are never invented.
- Concurrency and queue caps protect free-tier rate limits; the swarm still never idles.
