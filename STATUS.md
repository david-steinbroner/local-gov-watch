# local-gov-watch — status (resume here)

> The single resume doc for this project (declared in `CLAUDE.md`). Update in the same commit as any checkpoint.

**Goal:** Pitch-ready by ~2026-10-14 for **investors and paying users**. **North Bay** is the lead region.
**State (2026-09-14):** On branch `pitch-prep`, not pushed. The Legistar connectors are rewritten on the public API and verified against it, but **not deployed**: the backend is still paused.
**Next step:** Waiting on David for the three blockers below. Then bring the backend back and run the new connectors for real.
**Last touched (last commit):** 2026-09-14.

## Blockers (need David)
1. **Supabase project `dznqgfttchinijhgbxfe` ("Local Gov Watch") is INACTIVE (paused), not deleted.**
   It was likely paused around Dec 2025, which is past the 90-day free-plan restore window, so the dashboard probably
   offers only a backup download. Check the dashboard: Restore, or download the backup.
2. **Org "skunk labs" is at the 2-active-project free cap** (story-mode and marketlark-dev are active).
   Either upgrade to Pro (recommended: paid projects never pause, daily backups) or pause one of them.
3. **AI provider** for summaries: Gemini 2.5 Flash direct (today's model) or Claude Haiku 4.5, plus the key.
   This replaces the Lovable gateway in `supabase/functions/_shared/ai.ts`.

## 4-week plan
- **Week 1:** Backend back up (restore, or new project from `supabase/migrations`). Redeploy functions and secrets. Recreate cron (it isn't in the migrations). Swap the AI provider. Run the new Legistar connectors. *(Connector rewrite done.)*
- **Week 2:** The paying-user loop.
  - Real accounts.
  - Tracked terms, lists, and stances saved to the DB. The tables already exist (`tracked_term`, `watchlist`, `digest_subscription`, `plan`, `subscription`); the frontend uses sessionStorage today.
  - Alert emails (Resend).
  - Guard `/admin/connectors`.
  - Fix the `DocumentPreview.tsx` hooks bug.
- **Week 3:**
  - Data-accuracy pass.
  - Fix the README coverage claims.
  - Visible version tag. The first version bump is deliberately deferred to land with it.
  - Connector freshness monitor.
- **Week 4:** 5–10 target users hands-on, fix what they hit, then pitch.

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
