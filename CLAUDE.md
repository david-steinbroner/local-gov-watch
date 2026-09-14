# local-gov-watch

Standards: inherits ../engineering-standards.md. Overrides & project-specifics below.

Tracks and surfaces local government activity. Originally scaffolded via Lovable.

## Stack
- Vite + React + TypeScript
- shadcn/ui + Radix UI
- Tailwind
- Supabase backend
- Playwright e2e tests (`tests/`)

## Build & dev

```bash
npm run dev
npm run build
npm run lint
npm test            # vitest unit tests (recorded fixtures, no network)
npm run test:live   # Legistar mappers against the real API
npx -y deno@2 check --no-lock supabase/functions/run-connector/index.ts   # type-check edge functions
npm run deploy   # STALE: still targets gh-pages; real deploy is Cloudflare Pages on push
```

## Deploy
- Hosted on Cloudflare Pages at localgovwatch.com (GitHub Pages workflow removed in 3d21c53). Push to `main` ships.

## Resume doc
`STATUS.md` — the only place for current state / next step.

## Notes
- Repo was created in Lovable.
- North Bay setup: `NORTH_BAY_SETUP.md`.
- Connector re-run instructions: `CONNECTOR_RERUN_INSTRUCTIONS.md`.
