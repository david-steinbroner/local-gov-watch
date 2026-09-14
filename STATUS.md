# local-gov-watch — status (resume here)

> The single resume doc for this project (declared in `CLAUDE.md`). Update in the same commit as any checkpoint.

**State:** Frontend live but **non-functional** — backend is gone. Audit done 2026-09-14; no code changes yet.
**Next step:** Blocked on (1) confirming Supabase project status in the dashboard, (2) choosing the pitch audience, which sets the 4-week plan.
**Goal:** Pitch-ready by ~2026-10-14.
**Last touched (last commit):** 2026-09-14 (this audit). Real dev ran Oct–Dec 2025 (153 of 166 commits in Oct 2025).

## Audit findings (2026-09-14)

### Blockers
- **Backend unreachable.** `localgovwatch.com` serves on Cloudflare Pages (200), but the bundle calls
  Supabase `dznqgfttchinijhgbxfe`, which returns **NXDOMAIN**. The prior project `dizlzsmsfdtfubopnolf` is NXDOMAIN too.
  Likely deleted, or paused past the restore window. Every data query on the live site fails.
  - Schema is recoverable: 41 migrations and 18 edge functions are in `supabase/`. The data isn't, but it comes from connectors, so re-running them repopulates it.
  - Cron is **not** in migrations (no `cron.schedule`). The "every 6 hours" schedule was set outside the repo and needs rebuilding.
- **Lovable lock-in.** AI summaries go through `ai.gateway.lovable.dev` (`LOVABLE_API_KEY`, `google/gemini-2.5-flash`)
  in `supabase/functions/_shared/ai.ts`. Needs a direct provider.

### Data layer
- Legislation scraping never worked: NORTH_BAY_SETUP.md reports "18 meetings, 0 legislation." The parser scrapes `Legislation.aspx` HTML.
- **Fix found:** the Legistar public Web API (`webapi.legistar.com/v1/{client}/events|matters`) returns current JSON with no token
  for all 5 covered clients: `sonoma-county`, `napa`, `santa-rosa`, `napacity`, `austintexas` (verified 2026-09-14).
- README coverage claims don't match reality. It lists San Mateo County, but no connector exists. Marin, San Rafael, and Petaluma are unimplemented.

### Product gaps
- Lists, tracked terms, and stances are stored in **sessionStorage** (`src/lib/*Storage.ts`), so they're lost when the tab closes.
  README promises "customizable alerts"; digest email needs `RESEND_API_KEY` re-set.
- `/admin/connectors` has no route guard in `src/App.tsx`.
- No visible version; `package.json` is `0.0.0`.

### Code health
- `npm run build` passes (one 1 MB chunk). `tsc --noEmit` is clean.
- `npm run lint`: 75 errors, including 65 `no-explicit-any` and **4 `react-hooks/rules-of-hooks`**, which are real bugs worth fixing.
- Tests: one Playwright spec (calendar layout).

### Housekeeping
- `.env` is tracked in git. It holds only the publishable anon key, which is public by design, but add it to `.gitignore` anyway.
  Working copy has an uncommitted `.env` change pointing at the new (dead) project.
- `npm run deploy` still targets gh-pages; real hosting is Cloudflare Pages.
- `.constellation/architecture.json` says `localgov.watch`, which doesn't resolve. The canonical domain is `localgovwatch.com`.

## Open questions
- Supabase dashboard: does either project still exist / is it restorable?
- Who is the pitch for? (sets scope: demo polish vs. real alerts/accounts vs. coverage)
