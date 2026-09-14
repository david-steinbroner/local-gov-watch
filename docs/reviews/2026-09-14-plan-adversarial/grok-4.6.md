**The plan will not make Local Gov Watch pitch-ready for investors and paying users by 2026-10-12.** It is a four-track product rewrite (backend archaeology, identity, AI, visual redesign) plus recruiting, scheduled as if a full-time engineer exists. The founder is a PM with other projects, working in Claude Code sessions. `STATUS.md` already describes a smaller plan than `PLAN.md`. The redesign track was piled on top. Treat that as evidence the scope is already inflating in the document, not in the product.

---

## 1. Five strongest objections (ranked by likelihood of killing the 10/12 pitch)

### 1. Founder capacity vs. the definition of done — near-certain miss

**Failure:** On 10/12 you demo a half-wired site: backend maybe up, login flaky, alerts unproven on a stranger’s inbox, UI mid-redesign, no named users, no pilot. Investors see a restored Lovable scaffold. “Paying users” are a pricing page.

**Evidence:** DoD has six independent bars (stranger loop, live data+tripwire, AI eval, 9-screen redesign shipped, 5–10 sessions+quotes, rehearsed rollback). Week 1 alone is restore-or-rebuild 41 Lovable migrations, 18 edge functions, secrets, cron that is **not in the repo**, untested DB writes, AI provider swap, 30-item eval set, hooks bug, git hygiene, ICP decision, design brief, 9 artboards, freeze Sunday. Week 2 is Auth + `user_id` on `tracked_term` + RLS on every user table + replace three sessionStorage stores + Resend domain + Gmail/Outlook deliverability + admin guards + design system + Landing/Onboarding/Feed. The founder is not a full-time engineer. Other projects are active. Claude Design output still has to be implemented in React. The cut list still “never cuts” alerts, tripwire, demo path, rollback, **and** user sessions — i.e. it refuses to cut the things that slip.

**Change:** Rewrite DoD to one sentence: *a stranger in the ICP received a non-spam email about a real North Bay item they care about, and said they would pay for that to continue.* Cap the 4 weeks to that loop plus 5 conversations. Everything else is optional decoration.

### 2. Users in week 4, design freeze 9/20 — you will pitch with zero evidence

**Failure:** Dual audience (“investors and paying users”) arrives with no activated professionals, no quotes, no pilot commitments. Metrics snapshot is signups of yourself. The investor story is “we redesigned 9 screens.” The user story is “please imagine customers.”

**Evidence:** D4 (ICP) is due **Wed 9/16** and still open. Design freeze is **Sun 9/20** — four days later — so the canvas is drawn before anyone has used the restored product. Sessions are **Oct 5–11**, after implementation, with code freeze **Fri 10/9**. ICP is “advocacy orgs, land-use attorneys, developers, local journalists.” Those people do not book 5–10 live sessions in the last week of a 4-week sprint. Recruiting is not a line in week 1. STATUS.md’s 4-week plan does not even mention the redesign or the sessions-as-design-input. PLAN.md §10 wants signups, activation, open/click, freshness, **pilot commitments**, 3+ quotes — all of which require users who do not exist in the schedule until it is too late to change the product.

**Change:** Recruit starting today. Book 10 conversations in week 1, 3 design partners on the ugly loop in week 2. Freeze nothing on 9/20. If you cannot name 10 North Bay professionals by Wednesday, you do not have an ICP, and the canvas is fiction.

### 3. Week 2 is an identity-platform rewrite colliding with a visual rewrite

**Failure:** Definition of done #1 (“the loop works for a stranger”) fails. Magic link doesn’t land, RLS blocks reads, tracked terms still die with the tab, alert email is spam or never fires, unsubscribe 404s. Live demo in the room is a sessionStorage ghost with a new landing page.

**Evidence:** Login is fake (`useDemoUser` / sessionStorage). `tracked_term` has `email` and **no `user_id`**. Lists, terms, stances are sessionStorage; tables exist but are unwired. Same week: magic link, real profiles, migration, **RLS on every user-owned table**, repository layer replacing three stores, `check-tracked-terms` → Resend, verified domain (D6, Fri 9/18), Gmail **and** Outlook tests, `/admin` guards, Tailwind tokens, **and** implement Landing, Onboarding, Feed. Auth + RLS is where Claude Code sessions produce confident, broken policies. Magic-link email needs the same sending domain as alerts; that domain is an open decision. Browsing-public + save-requires-account is a second product, not a checkbox.

**Change:** One path: magic link, `user_id` on `tracked_term` only, one RLS policy, one alert email, no repository abstraction for stances/lists. Do not implement three redesigned screens in the same week. Lists and stances stay sessionStorage until someone pays.

### 4. Backend “week 1 foundations” is the entire schedule, and it is already blocked on David

**Failure:** D1 slips (plan already says if it slips past **Wed 9/16, every date moves**). You spend 10 days on paused-project archaeology. Connectors never write. Pitch is still a Cloudflare shell over NXDOMAIN.

**Evidence:** Project paused ~9 months, **past the 90-day free restore window**. Org at 2-active free cap. STATUS: waiting on David for restore-vs-download **and** Pro-vs-pause-another-project. Write path (lookups, inserts, updates, tracked-term calls) is **explicitly untested**. Cron lived outside the repo and was lost; it must be reinvented as a migration. 41 Lovable-era migrations vs `types.ts` — plan lists drift as medium, which is wishful. Restore may only offer a backup download; then you are creating a new project, pushing 41 migrations, pointing Cloudflare env at a new ref, redeploying, deleting old scraped rows if IDs collide (`external_id NOT LIKE 'legistar-%'`). Santa Rosa cancellation labeling and duplicate suppression only show up on the write path. This is not “Tue 9/15.” It is the kind of mess that eats week 1 and week 2.

**Change:** D1/D2 are today, not tomorrow. If the dashboard is not restored by end of 9/14, **rebuild immediately** — do not spend days “checking if restore is offered.” Pro upgrade or pause a sibling project is a 15-minute decision; the plan treating it as a workshop is delay. Until row counts exist in Postgres from the new connectors, **stop all design and AI work.**

### 5. The 9-screen Claude Design track is anti-pitch work (and the cut list protects it)

**Failure:** Weeks 2–3 go to artboard fidelity. Auth/alerts/data accuracy get the leftovers. Pitch-critical screens include pricing, alert email, mobile variants of three views — for an ICP that is not decided and a payment flow that is **manual invoice, no Stripe**. Design-to-code is already listed as a medium risk that “eats W3.” It will.

**Evidence:** §5 is 9 artboards including mobile. §8 cuts Stripe (already out), weekly digest, **mobile artboards**, calendar polish, error tracking. It does **not** cut the redesign. “Never cut” includes user sessions that are scheduled after the redesign consumes the calendar. Professional ICP (D4 recommendation) hires this for “don’t miss the hearing,” not a shadcn restyle. Investors in 4 weeks buy evidence of a loop, not Claude Design. Landing needs a *live* item from this week — that depends on backend+connectors, not Figma-like canvases. Freeze 9/20 is before the write path is proven, so the canvas is designed against empty states and leftover scraped rows.

**Change:** Cut Claude Design entirely for this window. Ship copy + one live example on the existing screens. Restyle nothing until a design partner complains about a specific screen. Move “redesign” off the critical path in §6.

---

## 2. Assumptions most likely wrong

**Timeline.** Week 1 backend is not 2–3 days. 41 migrations + lost cron + untested writes + paused-past-restore + project-cap is a week, if it goes well. Design freeze 9/20 after D4 on 9/16 assumes an ICP decision, a brief, 9 artboards, and visual refinement in four days, by a PM who is also restoring Supabase. Code freeze 10/9 with sessions 10/5–11 assumes users don’t find anything that requires a schema change.

**Technical.** “Rebuild from migrations, data refills” assumes Lovable migrations apply cleanly, `types.ts` matches, edge functions deploy, `pg_cron`+`pg_net` work on the chosen plan, and Legistar writes don’t duplicate/skip/mis-timezone in production. Connectors passing `test:live` against the **API** is not the store path. `extractKeywordTags` matching `"bus"` inside `"business"` means alerts will fire on garbage; that’s a product bug on the one loop you claim you won’t cut. AI “provider-agnostic, either works” plus **≥90% accurate, 0 fabricated facts** on civic legislation in two weeks is false. One hallucinated vote in a demo kills the civic-trust story. Magic link + new domain + Resend in a week does not imply inbox placement.

**Market / ICP.** D4 is still open, but the whole plan is built as if professionals will pay. North Bay coverage is **four Legistar clients**. Volume is 5–25 meetings / 90 days and 190–530 matters / 180 days, **mostly consent calendar**. Santa Rosa cancels ~1/3. These people already have Legistar, Granicus, clerk listservs, and colleagues. You have not tested that “one searchable place + topic alert” is a budget line vs. a free bookmark. Residents-vs-professionals is not a detail; it changes every screen, every price, and the investor story — and you want it decided in 48 hours so a canvas can freeze.

**Pricing.** Seeded $9.99/$29.99/$99.99 is consumer. D5 “paid pilot, invoice manually” is due **Fri 9/25**. You will not have paying users by 10/12. You might have “I’ll try a pilot” from people who have not received a useful alert yet. Pitching “paying users” on that is a lie.

**The dual-audience assumption.** Investors and paying users do not need the same artifact in 4 weeks. Investors need proof someone cares. Users need the alert to be right. The plan builds a redesign that serves neither in time.

**Data density.** DoD #1 requires a real alert on a real item **within one ingest cycle (≤6h)** for a stranger. With sparse meetings and consent-heavy matters, a new user who picks two topics may get **nothing** for days. The pitch loop is then “wait for cron.” That is not a demo.

---

## 3. What to cut — and what’s missing

**Cut now (not “if behind”):**
- Entire Claude Design / 9-screen / design-freeze track
- AI summaries as a DoD bar (label and kill switch: default **off** for the pitch)
- Dual audience: pick **paying-user pilots in North Bay**. Investors get that recording, not a separate product
- Stances, lists-as-product, pricing-page artboard, mobile artboards, 1MB code-split, frontend error tracking
- “5–10 live sessions” as a week-4 festival — replace with 5 scheduled conversations starting this week
- Merge-to-`main` as a week-3 ceremony on a site that **auto-deploys `main`**

**Cut list in the plan is inverted.** Stripe is already out; cutting it is theater. The expensive item is §5.

**Missing entirely:**
- **Hours.** No budget for a part-time PM. Without “12 hours/week vs 40,” the schedule is fan fiction.
- **Recruiting pipeline.** Names, intros, scripts, incentives. Week 4 “target users (per D4)” is a blank.
- **Concierge.** For a $0→invoice professional pilot, *you* set their jurisdictions and terms after a call. Self-serve onboarding is the wrong 10/12 goal.
- **Empty-alert problem.** What the stranger sees when nothing matched in 6h. Without this, DoD #1 is a dice roll on the civic calendar.
- **Keyword quality.** `extractKeywordTags` substring bug is a follow-up in STATUS, not on the critical path. It will spam or miss. That *is* the product.
- **Auth email = alert email.** Two email products (magic link + alerts) on a domain decided 9/18.
- **Staging.** Auto-deploy `main` + merge in W3 + rollback rehearsal in W4 means the first broken RLS policy can be the public pitch site.
- **Competition / status quo.** Why this beats Legistar’s own notifications and the clerk’s PDF. Not in the brief, not in the pitch metrics.
- **Legal/ops.** CAN-SPAM, unsubscribe, storing/redistributing agenda text and staff reports, “AI summary” on legislation.
- **Restore failure playbook with a time box.** “Depends on the dashboard” is not a plan; it’s an open tab.
- **Founder-as-single-point.** D1–D6 all say David. STATUS already waiting. The critical path is blocked on decisions, not code.

---

## 4. Sequencing is wrong — alternative 4 weeks

Current: backend → accounts/alerts → redesign → users → pitch.  
Users are last. Design is frozen before truth. AI and visual work run in parallel with the only thing that matters.

**Alternative (same dates, one founder):**

| When | Work |
|---|---|
| **72h / W1** | Unblock D1/D2 immediately. Rebuild if restore isn’t one click. Deploy functions, cron, secrets. Run 8 connectors. **Prove rows in Postgres** (counts, no dupes, cancellations, agenda render). Send **one** Resend email to David on a real new item, even from a hardcoded term. **No canvas. No AI swap.** Parallel: 10 outreach emails to North Bay journalists/attorneys/advocates. |
| **W2** | Magic link + `tracked_term.user_id` + the smallest RLS. Wire **only** tracked terms to DB. Alert: new item → match → email → unsubscribe. Fix keyword word boundaries. Put 2–3 design partners on it (you configure their terms on a call). AI summaries stay off. UI stays Lovable. |
| **W3** | Accuracy 30-item sample vs source. Freshness tripwire that pages David. Deliverability (Gmail/Outlook) until it’s boring. Landing copy + one live item on **existing** UI. Manual pilot offer (invoice, 3 months, price said out loud on the call — not $9.99). Record the 2-minute demo **now**, not after a redesign. |
| **W4** | Daily fixes from actual partners. Quotes. One-pager. Rollback rehearsal. Pitch: *here are N people on real North Bay alerts; here is the miss-rate vs source; here is who invoiced.* Not 9 artboards. |

If D1 is not producing connector rows by **Fri 9/18**, slip the pitch. Do not “move every date right” and keep the redesign. Kill the pitch date rather than arrive with a shell.

---

## 5. Single riskiest test in the next 72 hours

**Restore/rebuild until a new Legistar connector run commits correct rows, then email David one alert for a real current North Bay item (not a fixture, not sessionStorage).**

That is the whole company in one test: project cap, paused restore, 41 migrations, lost cron, untested `legistarStore.ts` write path, ID scheme vs old scrapes, cancellations, Resend, DNS. If that is not done by **Thu 9/17**, Oct 12 is already dead and the rest of PLAN.md is costume work.

Do it in parallel with **three live conversations** with the proposed ICP asking: *what do you use now, what did you miss last quarter, would you pay for an email on these four jurisdictions.* If you cannot get three conversations, D4 is a slogan and the investor+user pitch is empty even if the database comes back.