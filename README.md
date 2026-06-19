# Safe Scan

Bubblemaps-powered token distribution dashboard.

## Run Locally

```bash
npm install
cp .env.example .env
npm run dev
```

Add `BUBBLEMAPS_API_KEY` to `.env` before running live scans. The browser never receives provider keys. The Vite app talks to the local API, and the API talks to Bubblemaps.

## Scope

- Bubblemaps token metadata
- Bubblemaps score, Gini index, HHI, and Nakamoto coefficient
- Supply exposure for CEX, DEX, contracts, fresh wallets, top 10 adjusted supply, and bundles
- Top holder table with wallet metadata
- Cluster concentration and member lists
- Custom relationship graph from Bubblemaps nodes, clusters, and grouped transfers

## Commands

```bash
npm run dev
npm run build
npm test
```

## Netlify

Deploy from GitHub with the existing `netlify.toml`. Add this server-side environment variable in Netlify:

```bash
BUBBLEMAPS_API_KEY=
```

The browser calls `/api/bubblemaps/*`, and Netlify routes those requests to `netlify/functions/bubblemaps.ts`.

## Environment

Use server-only keys without a `VITE_` prefix:

```bash
BUBBLEMAPS_API_KEY=
BUBBLEMAPS_API_BASE_URL=https://api.bubblemaps.io
API_PORT=3101
```
