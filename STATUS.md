# local-gov-watch — status (resume here)

> The single resume doc for this project (declared in `CLAUDE.md`). Update in the same commit as any checkpoint.

**Goal:** Pitch-ready by **Mon 2026-10-12**. Paying-user pilots come first, and the investor pitch presents their evidence. **North Bay** is the lead region.
**Roadmap:** `docs/PLAN.md` (v2, after adversarial review: schedule, decisions D1–D8, cut list). This file holds only current position.
**State (2026-09-14):** Branch `pitch-prep` is pushed to origin as a backup (not merged; `main` untouched). The Legistar
connectors are rewritten on the public API and verified against it, but **not deployed**: the backend is still paused.
**Next step:** The **72-hour test** (`docs/PLAN.md` §3): real connector rows in Postgres plus one real alert email by **Thu 9/17**.
It's blocked on David's decisions below. Plan tripwire: no correct rows by Fri 9/18 → move the pitch date.
**Last touched (last commit):** 2026-09-14.

## Blockers (need David; details in `docs/PLAN.md` §2)
1. **D1 (today):** org "skunk labs" is at the 2-active-project free cap. Upgrade to Pro (recommended) or pause story-mode or marketlark-dev.
2. **D2 (today):** Supabase project `dznqgfttchinijhgbxfe` ("Local Gov Watch") is **paused, not deleted**, and likely past the
   90-day restore window. Open the dashboard. If Restore isn't one click, rebuild from migrations right away.
3. **D8 (today):** hours per week through 10/12. This sizes the plan.
4. **D4 + D7 (Wed 9/16):** the ICP (can you name 10 North Bay people in it?) and the redesign scope.
5. **Outreach (David, starting now):** email 10 North Bay professionals and book 3 conversations this week.

## Plan
See `docs/PLAN.md`. Current position: **the 72-hour test, day 1**. The connector rewrite is done; the backend is
blocked on D1/D2. AI summaries are off for the pitch, so the AI provider choice is deferred to week 3.

## Done
- **2026-09-14: audit** (findings below).
- **2026-09-14: Legistar connectors rewritten on the public Web API.** HTML scraping never returned legislation.
  - Mapping is in `supabase/functions/_shared/parsers/legistarApi.ts` (runtime-agnostic). DB access is in `legistarStore.ts`.
    The connectors are `legistarMeetings.ts` and `legistarLegislation.ts`; run-connector and the connector rows are unchanged.
  - Covers meetings with correct Pacific→UTC times, structured agenda items, and legislation with full staff-report text,
    PDF links, and official record links (`gateway.aspx?M=L&ID=`).
  - Skips hidden staff-only events. Cancelled meetings are labeled on existing rows and never newly inserted (Santa Rosa cancels about a third).
  - Skips procedural matters: minutes, closed session, proclamations.
  - Verified: `npm test` (28 unit tests on recorded fixtures), `npm run test:live` (8 tests on all 4 North Bay clients),
    and `npx deno check supabase/functions/run-connector/index.ts` are all clean.
  - **Not yet exercised:** the DB write path (lookups, inserts, updates, tracked-term calls). It needs the backend back.
  - New optional settings: `LEGISTAR_MATTER_LIST_LIMIT` (default 500) and `LEGISLATION_DETAIL_LIMIT` (default 60 detail fetches per run).
    The old `LEGISLATION_PAGE_LIMIT` is intentionally no longer read by Legistar.
  - External IDs are now `legistar-{client}-event-{id}` / `legistar-{client}-matter-{id}`. If the old backup is restored, its
    ~18 scraped Legistar meetings will duplicate; delete rows from those sources whose `external_id NOT LIKE 'legistar-%'` after the first run.

## Follow-ups noticed
- `extractKeywordTags` (`helpers.ts`) matches substrings ("bus" in "business", "rate" in "separate"), so topic tags are noisy. Switch it to word boundaries.

## Audit findings (2026-09-14)

### Blockers
- **Backend unreachable.** `localgovwatch.com` serves on Cloudflare Pages, but its Supabase project is paused (NXDOMAIN), so every data query fails.
  The earlier Lovable-era project `dizlzsmsfdtfubopnolf` is gone.
  - Schema is recoverable: 41 migrations and 18 edge functions are in `supabase/`. The data comes from connectors, so re-running them refills it.
  - Cron is **not** in the migrations (no `cron.schedule`); it was set up outside the repo.
- **Lovable lock-in.** AI goes through `ai.gateway.lovable.dev` (`LOVABLE_API_KEY`).

### Product gaps
- Lists, tracked terms, and stances live in **sessionStorage** (`src/lib/*Storage.ts`), so they're lost when the tab closes.
- The README claims San Mateo County coverage, but no connector exists. Marin, San Rafael, and Petaluma are unimplemented.
- `/admin/connectors` has no route guard in `src/App.tsx`.
- No visible version; `package.json` is `0.0.0`.

### Code health
- `npm run build` passes (one 1 MB chunk). `tsc --noEmit` is clean.
- `npm run lint`: 75 pre-existing errors, including 65 `no-explicit-any` and **4 `react-hooks/rules-of-hooks` in `DocumentPreview.tsx`**, which are real bugs.

### Housekeeping
- `.env` is tracked in git (publishable anon key only). Add it to `.gitignore`. The working copy has an uncommitted `.env` change.
- `npm run deploy` still targets gh-pages; real hosting is Cloudflare Pages.
- `.constellation/architecture.json` says `localgov.watch` (doesn't resolve). The canonical domain is `localgovwatch.com`.
