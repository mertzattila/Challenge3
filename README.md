# SmartShift — INEC Challenge 3

A full-stack smart employee scheduling system. See [SPECIFICATION.md](./SPECIFICATION.md) for the complete spec, API contract, and task tracks.

## Quick start

Two separate npm projects: `/server` (Node + Express + better-sqlite3) and `/client` (React + Vite).

### Server
```bash
cd server
npm install
npm run dev        # starts API on http://localhost:3001
```

### Client
```bash
cd client
npm install
npm run dev        # starts Vite dev server on http://localhost:5173 (proxies /api -> 3001)
```

## Team split
- **Person A** — Backend APIs (branch `backend`)
- **Person B** — Frontend + Scheduler module (branch `frontend`)

Both start from `main` (this scaffold). See SPECIFICATION.md sections 7A / 7B.
