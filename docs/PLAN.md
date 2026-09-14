# Local Gov Watch: pitch-readiness plan (v2, after adversarial review)

**Window:** Mon 2026-09-14 → pitching from **Mon 2026-10-12**
**Audience:** paying users first. **The investor pitch is the evidence from those pilots.** Lead region: North Bay.
**Current position / next step:** see `STATUS.md`. This file is the roadmap; it doesn't track daily state.

---

## 0. What changed from v1 (adversarial review, 2026-09-14; record in §11)

1. **Users start in week 1, not week 4.** Conversations gate the ICP, the price, and the design freeze.
2. **A 72-hour test decides the timeline:** real rows in Postgres plus one real alert email by Thu 9/17.
   **Plan tripwire:** if there are no correct rows by Fri 9/18, move the pitch date instead of compressing later weeks.
3. **One sentence of "done"** replaces the six-bar definition (§1).
4. **Minimal accounts:** magic link, `tracked_term.user_id`, one tested RLS policy. Lists and stances stay device-only.
5. **AI summaries are off for the pitch.** The Lovable-gateway swap leaves the critical path.
6. **Claude Design moves earlier as a research tool** (mockups to show in interviews). Implementation narrows to design tokens plus 3 screens.
   Both reviewers said to cut it; it's kept at David's request, re-scoped. See D7.
7. **The keyword-matching fix joins the critical path.** Substring matching ("bus" in "business") *is* alert quality.
8. **Concierge onboarding** for design partners, plus a first email that covers the last 30 days so no one gets silence.
9. **Paid pilot via a Stripe Payment Link.** No in-app billing.
10. **Added:** hours budget, recruiting pipeline, staging via branch previews, a legal minimum, and an answer to "why not Legistar's own alerts?"

## 1. Definition of done

> **A North Bay professional in the ICP got a non-spam email about a real item they care about, and paid
> (Stripe link) or committed in writing to pay to keep getting it.**

Supporting checks:
- **Users:** ≥3 design partners receive real alerts, and ≥1 has paid or committed in writing.
- **Data:** all 4 jurisdictions refresh every 6h. A freshness tripwire emails David when any connector is stale more than 24h or has 0 new items in 7 days. A 30-item sample checked against the source has 0 wrong dates, times, or statuses.
- **Email:** alerts land in the inbox in Gmail and Outlook tests, with a working unsubscribe.
- **Demo:** the live demo path works, a recorded 2-minute backup exists, and a rollback has been rehearsed (Cloudflare previous deployment).

**Not required by 10/12:** AI summaries, self-serve billing, the full redesign, saved lists or stances.

## 2. Decisions

**Made**

| Decision | Choice |
|---|---|
| Framing | Paying-user pilots are the product; the investor pitch presents their evidence |
| Region | North Bay: Sonoma County, Napa County, Santa Rosa, Napa (city) |
| Data | Legistar public Web API (done 2026-09-14) |
| Hosting | Cloudflare Pages (`main` auto-deploys; branch previews serve as staging) + Supabase |

**Open (David)**

| # | Decision | Recommendation | Needed by |
|---|---|---|---|
| D1 | Supabase: Pro, or pause a sibling project | **Pro.** A 15-minute decision | **Today** |
| D2 | Restore vs. rebuild | **Time-boxed:** open the dashboard. If Restore isn't one click, rebuild from migrations now | **Today** |
| D8 | Hours per week available through 10/12 | Needed to size the plan. Well under half-time means only the core loop, and the redesign moves past the pitch | **Today** |
| D4 | ICP | Professionals who must track local decisions (advocacy orgs, land-use attorneys, developers, local journalists). **Test: can you name 10 North Bay people in it?** If not, it's the wrong ICP | Wed 9/16 |
| D7 | Redesign scope | **Re-scoped** (§4): interview props now, tokens plus 3 screens by the pitch. Alternatives: the full 9 screens (v1), or cut until after the pitch (the reviewers' view) | Wed 9/16 |
| D6 | Sending domain | `localgovwatch.com` on Resend (SPF, DKIM, DMARC). The same domain sends magic links and alerts | Fri 9/18 |
| D5 | Pilot price | Set after ≥5 conversations and said out loud on the call, not the seeded $9.99. Collected with a Stripe Payment Link | Fri 9/25 |
| D3 | AI provider | Deferred to week 3 (optional); summaries stay off unless an eval passes | Week 3 |

## 3. Schedule

### Next 72 hours (by Thu 9/17): the whole company in one test
**Claude (after D1/D2):**
- Push the 41 migrations to the project and diff the schema against `types.ts`.
- Deploy the edge functions and secrets. Recreate the cron **as a committed migration** (pg_cron + pg_net).
- Run the 8 Legistar connectors. Verify the write path: row counts, no duplicates, cancellation labels, agenda items rendering in the existing UI.
- Send **one real alert email** for a real current item to David through Resend (a hardcoded term is fine).
- Draft two Claude Design mockups as interview props: the **alert email** and the **landing page**. No backend needed.

**David:**
- D1, D2, and D8 today.
- Email 10 North Bay professionals and book 3 conversations. Script:
  - What do you use now: Legistar "notify me", clerk listservs, colleagues?
  - What did you miss last quarter?
  - Would you pay for alert emails covering these four jurisdictions?

**Plan tripwire:** no correct rows by **Fri 9/18** → move the pitch date. Don't squeeze later weeks.

### Rest of week 1 (Fri 9/18 – Sun 9/20)
- Resend domain verified (D6); deliverability test to Gmail and Outlook.
- **Keyword matching:** word boundaries plus tests. This is alert precision.
- Small fixes: the `DocumentPreview.tsx` hooks bug; `.env` into `.gitignore` plus `git rm --cached`; visible version tag v0.1.0.
- Conversations 1–3 held.

### Week 2 (9/21–27): the alert loop for design partners
- **Accounts:**
  - Magic-link auth and a `profile` row.
  - A migration adding `tracked_term.user_id`, with **one RLS policy, tested so one user can't read another's terms**.
  - Tracked terms move to the DB (only that store).
  - Stances are hidden from nav; lists stay device-only.
- **Alert pipeline:** new item → match → Resend email → unsubscribe. The **first email includes the last 30 days of matches**, so a new user never gets silence.
- **Concierge:** onboard 2–3 design partners on calls and configure their terms for them.
- Guard `/admin/*` with `user_roles`.
- Conversations 4–7, then set the pilot price (D5).
- **Claude Design:** the full canvas for the §4 screens, informed by the conversations. **Freeze Sun 9/27.**

### Week 3 (9/28 – 10/4): trust and presentation
- 30-item accuracy sample against the source; fix what it finds.
- Freshness tripwire emailing David.
- **Implement the design:** tokens app-wide, plus the Landing page (with a live item from this week), the alert email, and one detail template (legislation and meeting).
- **Legal minimum:**
  - Terms and privacy pages.
  - A "not an official record; verify with the clerk" disclaimer.
  - Unsubscribe link and postal address in the email footer.
- Stripe Payment Link for the pilot.
- **Merge `pitch-prep` → `main`** after the loop is verified on the branch preview (David's go; this is a production deploy).
- **Record the 2-minute demo this week**, not after the polish.
- *Optional if ahead:* AI provider swap and a 30-item eval. Summaries stay off unless ≥90% are rated accurate with 0 fabricated facts.

### Week 4 (10/5–11): partners → pitch
- Fix what partners hit, daily. Ask each one for payment or a written commitment.
- Quotes, a metrics snapshot, and a one-pager: *N partners on real alerts, miss rate vs. source, who paid.*
- Rehearse a rollback (Cloudflare previous deployment).
- **Code freeze Fri 10/9.** Pitch from Mon 10/12.

## 4. Redesign (Claude Design): re-scoped per D7

The canvas is cheap because Claude drafts it with no backend. Implementation is the expensive part, so it's kept narrow.

1. **Week 1 (interview props):** alert email and landing page. Shown to prospects before anything is built.
2. **Week 2 (canvas, freeze 9/27):** Landing, alert email, legislation detail, meeting detail, and a light onboarding.
   Informed by 5+ conversations. David refines in the canvas editor; if editing isn't enabled on the account,
   the canvas is view/export only and feedback comes through chat.
3. **Week 3 (implement):** design tokens (color, type, spacing) across the whole app, plus Landing, the alert email,
   and one detail template. The other artboards get implemented after the pitch.

**Out before the pitch:** mobile artboards (responsive defaults instead), pricing page (the Stripe link replaces it),
feed redesign, alerts-manager redesign.

## 5. Critical path
D1/D2 → rows in Postgres (9/17) → one alert email (9/17) → accounts + tracked terms (W2) → design partners on real
alerts (W2–3) → payment ask (W3–4) → pitch.
Conversations run in parallel from day 1. They gate D4, D5, and the canvas freeze.

## 6. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Founder hours are too thin for this scope | **High** | D8 today; cut to the core loop if needed |
| Restore/rebuild archaeology eats weeks 1–2 | **High** | Time-box D2; rebuild immediately; the 9/18 tripwire moves the date |
| Lovable-era migrations have drifted or don't apply cleanly | Med–High | First task after D1: push to the project and diff against `types.ts` |
| Recruiting fails (no conversations, no partners) | **High** | Start day 1; 10 names by Wed; concierge onboarding |
| Keyword false positives spam partners | High until fixed | Word-boundary fix plus tests in week 1 |
| A new user gets silence (sparse civic calendar) | Medium | 30-day backfill in the first email; concierge-chosen terms |
| Alerts land in spam | Medium | SPF/DKIM/DMARC, plain layout, low volume, Gmail + Outlook tests |
| An RLS mistake exposes data or blocks reads | Medium | One policy, a cross-user denial test, verified on the branch preview before merge |
| Status quo is good enough (Legistar notify, clerk lists) | Medium | Ask it in every conversation. Pitch answer: every body across 4 jurisdictions, topic matching, one email |
| The live demo fails in the room | Medium | Recorded demo from week 3 |

## 7. Cut list
**Already cut vs. v1:** AI summaries on the pitch path, 6 of 9 artboards plus mobile, lists and stances persistence,
in-app billing, pricing page, weekly digest, bundle code-split, frontend error tracking.

**If still behind, cut in this order:** (1) the redesigned detail template (keep the tokens), (2) the Landing redesign
(new copy plus a live item on the existing UI), (3) the version tag.

**Never cut:** correct rows plus the freshness tripwire, the alert email loop, the keyword fix, the admin guard,
conversations and design partners, the payment ask, the recorded demo.

## 8. Out of scope before the pitch
Marin / San Rafael / Petaluma scrapers, San Mateo, Austin/Texas, native apps, public API, semantic search,
AI summaries (unless the week 3 optional eval passes), Stripe integration beyond a Payment Link, and the full lint cleanup.

## 9. Pitch metrics
Design partners on real alerts; alerts delivered, opened, and clicked; **alert precision** (share rated relevant by partners);
miss rate against the source sample; median freshness; paid pilots or written commitments, at what price; 3+ quotes.

## 10. Cost to run (verify at each signup)
Supabase Pro (D1), Resend (alert volume), Stripe (per-transaction), Cloudflare Pages (free tier today). AI only if D3 happens.

## 11. Adversarial review record (2026-09-14)
- **Reviewers:** v1 of this plan was reviewed via the brains-trust skill (devil's-advocate framing) by **Gemini 3.1 Pro** and **Grok 4.6**.
  Raw responses: `docs/reviews/2026-09-14-plan-adversarial/`.
- **Both agreed, and it was adopted:**
  - Users were scheduled too late.
  - Weeks 2–3 had too much scope; accounts were cut to a minimum.
  - AI summaries were a liability for the pitch.
  - The backend is the entire critical path, so it gets the 72-hour test and the 9/18 tripwire.
  - Dual-audience framing, resolved as "pilots first."
- **Adopted from one reviewer:**
  - Hours budget, recruiting pipeline, empty-alert handling, keyword fix on the critical path, staging, legal minimum, and the competition question (Grok).
  - Email mockups as interview props, and a payment link over invoices (Gemini).
- **Adapted:** both said to cut the Claude Design redesign entirely. It's kept because David asked for it, but re-scoped
  (props in week 1, tokens plus 3 screens by the pitch) and made an explicit decision (D7) rather than a default.
- **Rejected:** warming up the domain through Google Workspace (Gemini). At design-partner volume, correct SPF/DKIM/DMARC
  plus inbox tests are enough.
