# SubastaCampo · Frontend

[![CI](https://github.com/UbeimarY/subastacampo-frontend/actions/workflows/ci.yml/badge.svg)](https://github.com/UbeimarY/subastacampo-frontend/actions/workflows/ci.yml)

Live harvest auctions for small farmers in Nariño, Colombia. Producers publish a harvest, get an
AI-suggested price and open an auction; buyers bid from their phones and every bid reaches every
screen in real time.

This is the Angular client. The API lives in
[`subastacampo-backend`](https://github.com/UbeimarY/subastacampo-backend).

## What you can do

- **Buyers** follow every lot live, bid with one tap, or set a **puja automática**: a private
  maximum the server bids up to, only what it takes to lead. When someone passes them, the room
  says so loudly (banner, vibration and, if they asked, a browser notification).
- **Producers** publish a harvest and get an AI price with a **calibrated range** ("8 in 10 final
  prices fell inside it") and **recent comparable sales**, then follow each bid with its risk
  score.
- **Everyone** can check **Precios del mercado**: the typical price per kilo each category reached,
  week by week.

## How it talks to the backend

The backend is defined **contract-first** with Protocol Buffers. This app does not hand-write any
request or response type: `buf generate` reads the backend's `.proto` files and produces a typed
TypeScript client (`src/app/gen`).

```
proto contract (backend repo) ──buf generate──▶ src/app/gen ──▶ Connect client ──HTTP──▶ API
```

- **Connect protocol over HTTP:** the browser calls the gRPC-compatible API directly, no proxy.
- **Server streaming:** `WatchAuction` keeps one HTTP response open and pushes every bid live.
- **Side-effect-free RPCs travel as GET**, so they are cacheable.
- **64-bit money** arrives as `bigint`: prices never lose precision in JavaScript.

CI regenerates the client and fails if it differs from the committed code, so the frontend can
never silently drift from the contract.

## Key design decisions

| Concern | Decision |
|---|---|
| Live room state | A pure reducer (`room-state.ts`): deduplicates bids by id and never moves the auction back to an older state, so duplicate events after a reconnection are harmless. |
| Reconnection | Exponential backoff with jitter (1 s → 30 s). The first message of every stream is a full snapshot, so nothing is lost. |
| Bidding on bad networks | One client-generated `request_id` per bid; retries reuse it, so the server never records a bid twice (idempotency). |
| Countdown accuracy | The app measures the offset between the phone's clock and the server's once, and every countdown uses server time. |
| Errors | The backend sends a language-neutral reason; the interface translates it into Spanish. |
| Security | Strict Content Security Policy, self-hosted fonts (no third-party requests), same-site-only redirects after login. |
| Accessibility | 48 px touch targets, a highly legible typeface (Atkinson Hyperlegible), visible focus, reduced motion respected, risk never conveyed by color alone. |

## Tech stack

Angular 21 (standalone components, signals, new control flow) · Connect-ES 2 · Protobuf-ES 2 ·
Buf · Vitest · Netlify.

## Run locally

Requirements: Node 22+ and the backend running on `http://localhost:8000`.

```bash
npm ci
npm start          # http://localhost:4200
npm run test:ci    # unit tests
npm run generate   # regenerate the client after the contract changes
```

## Deployment

Netlify builds with `netlify.toml`. Production talks to `https://subastacampo-api-ubeimar.fly.dev`
(`src/environments/environment.ts`); that origin must be listed in the backend's `CORS_ORIGINS`.

## Project status

Course project for *Programación Orientada a la Web*, Universidad Cooperativa de Colombia, Pasto.
