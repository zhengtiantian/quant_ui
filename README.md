# quant_ui

React + TypeScript frontend dashboard for the AI-Driven Equity Signal Platform.

## Overview

Single-page application that displays daily equity signals, portfolio positions, news articles, and connects to the quant_ai assistant for natural language stock analysis.

## Features

- **Signal Dashboard** — daily composite scores and signal rankings for 100 US stocks
- **Portfolio Tracker** — open positions, entry price, unrealized P&L, exit alerts
- **News Feed** — labeled articles with sentiment scores per symbol
- **Script Runner** — trigger and monitor quant_data pipeline scripts from the browser
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
├── api/              # API client modules (signals, news, portfolio)
├── components/       # Shared UI components (LoginRegister, NewsList)
├── pages/            # Page-level components (Dashboard, ScriptRunner)
└── App.tsx           # Router + JWT guard
```
