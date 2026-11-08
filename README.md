# quant_ui

React + TypeScript frontend dashboard for the AI-Driven Equity Signal Platform.

## Overview

Single-page application that displays daily equity signals, portfolio positions, news articles, and connects to the quant_ai assistant for natural language stock analysis.

## Features

- **Quant Model** — the ranking model's backtest against SPY, then today's composite scores and ranks
- **My Holdings** — holdings from the trade log, the daily action per holding (English / Chinese), indices, catalysts, lot manager
- **Market Briefs** — daily market summary and outlook
- **Positions** — the paper portfolio the signal tracker opens from the daily top ranks, with exit alerts
- **Task Monitor** — every scheduled pipeline, today's and tomorrow's runs, logs
- **Keywords** — review the weekly keyword proposals for the news-matching rules
- **News Feed** — labeled articles with sentiment scores per symbol
- **AI Chat** — browser-direct calls to `quant_ai` for natural language Q&A (e.g., "What's the sentiment trend for NVDA?")
- **Keycloak auth** — JWT login/register with auto-refresh token

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Build tool | Vite |
| Auth | Keycloak (OpenID Connect) |
| Routing | React Router v6 |

## Development

```bash
npm install
npm run dev        # dev server at http://localhost:5173
npm run build      # production build → dist/
npm run lint
```

## Docker

The CI workflow (`.github/workflows/docker-build.yml`) builds a multi-arch image on every push to `main` and opens a PR in `ai-equity-signal-platform` to update the image tag.

```bash
docker build -t xiz001/quant_ui:local .
```

## Environment

The app is served by Nginx in production. API calls use relative `/api/*` paths proxied to `quant_api` (port 8081). AI calls go directly to `http://localhost:18000` (the `quant_ai` host process) to bypass Docker VPNKit limitations.

## Project Structure

```
src/
├── api/              # API clients (signals, performance, portfolio, holdings, markets, news)
├── components/       # Panels (Quant Model, positions, task monitor) and markets/ widgets
├── pages/            # Dashboard (tabs), Holdings, Briefs, Keywords
└── App.tsx           # Router + JWT guard
```
