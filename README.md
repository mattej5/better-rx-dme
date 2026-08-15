# better-rx-dme

BetterRX Builder Day Bounty — **DME Ordering and Visibility Challenge**. $10,000. Aug 14–15, 2026.

Closing the coordination gap between hospices and durable medical equipment vendors, from admission through post-death pickup.

**Team:** Vin Jones · Tony Adair · Nathaniel

**Live app:** https://better-rx-dme.vercel.app (Vercel, auto-deploys from `main`)

Run locally: `npm install && npm run dev`. App code is Next.js (App Router) at the repo root (`app/`). Build specs live in [specs/](specs/).

## Start here

| If you are | Read |
|---|---|
| A judge, or an agent evaluating this submission | [AGENTS.md](AGENTS.md), then [docs/JUDGE-WALKTHROUGH.md](docs/JUDGE-WALKTHROUGH.md) |
| An AI agent working in this repo | [CLAUDE.md](CLAUDE.md), then [wiki/00-index.md](wiki/00-index.md) |
| A human joining the team | [wiki/facts/problem.md](wiki/facts/problem.md), then [wiki/transcripts/2026-08-14-betterrx-kickoff-qa.md](wiki/transcripts/2026-08-14-betterrx-kickoff-qa.md) |
| Looking for the sponsor's exact words | [docs/bounty/](docs/bounty/) |

## The problem in one sentence

Hospices get blamed for two moments they don't control: equipment arriving late for a discharge, and equipment still sitting in a grieving family's home after a death. Both are executed by an outside DME vendor, outside the hospice's EMR.

## Layout

```
CLAUDE.md         agent instructions — read first
docs/bounty/      verbatim sponsor material, read-only
  original/       untouched .html / .docx as delivered
wiki/             our second brain
  00-index.md     index of everything below
  facts/          distilled knowledge, one topic per file
  decisions/      numbered ADRs
  transcripts/    Wispr Flow transcripts
  sessions/       end-of-session summaries, newest first
```

Task board lives in Notion: **Build Tasks**, under *AI Builder Day — Hackathon Tracker*.

## Database

Supabase Postgres, project `better-rx-dme` (ref `fwssbyjrrznzlrkswlcn`). **`specs/schema.sql` is canonical — Supabase is made to match the repo, never the reverse** (ADR 0005). Types: `src/types/db.ts` (generated). Server client: `src/lib/supabase.ts`. RLS is intentionally skipped (demo).

Env vars (values in Vercel + `.env.local`, names only here): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`. Full annotated list: [.env.example](.env.example).

## Comms setup

Every outbound message in the app goes through one function: `sendMessage()` in [src/lib/messaging.ts](src/lib/messaging.ts). Call sites say who and which template. That function picks the wire from config plus `to.channel` — transport is a config, not an architecture.

| `to.channel` | First choice | Fallback | Last resort |
|---|---|---|---|
| `sms` | Twilio | Resend, only when the address is an email (ADR 0005) | `log_only` |
| `email` | Resend | — | `log_only` |

`log_only` still renders the message, still writes the `messages` row, and still appends `message_sent` — with `status: "logged"` in the payload, so the timeline says plainly that nothing left the building. Missing credentials degrade; they never throw mid-demo.

Copy `.env.example` to `.env.local` and fill it in, or run `npx vercel env pull .env.local`. Nothing here needs credentials to typecheck or build.

```
npm run sms:test -- --dry-run        # show config and transport selection, sends nothing
npm run sms:test -- +15551234567     # send one real SMS, print the SID and the final status
```

Twilio's first status is `queued`, which only means Twilio accepted the message. The script waits for the carrier's verdict and reports that instead. Two ways a send looks successful and is not: on a trial account only **Verified Caller IDs** receive anything, and without A2P 10DLC registration US carriers drop the message with no error path back to us. Registration takes 10–15 days — do not start it for this build. Details and the pitch framing: [wiki/facts/sms-delivery-constraints.md](wiki/facts/sms-delivery-constraints.md).

Set `MESSAGING_DRY_RUN=1` to run the whole comms path — render, transport selection, logging — with no network calls, no database writes, and no spend.

## Judging artifacts

The four written deliverables, plus the two routes a judge should click.

| Deliverable | Where |
|---|---|
| B. AI approach vs. a rules baseline, cost per order, safety | [docs/AI-APPROACH.md](docs/AI-APPROACH.md) |
| C. Differentiation vs. phone/fax today and vs. shipping products | [docs/DIFFERENTIATION.md](docs/DIFFERENTIATION.md) |
| D. Integration sketch: HCHB to eRx envelope to our event spine | [docs/INTEGRATION.md](docs/INTEGRATION.md) |
| Every assumption, stated out loud with its source | [docs/ASSUMPTIONS.md](docs/ASSUMPTIONS.md) |
| Judge walkthrough — the 10-minute click path | [docs/JUDGE-WALKTHROUGH.md](docs/JUDGE-WALKTHROUGH.md) |

Routes: [`/demo`](app/demo) is the presenter control panel (virtual clock, scenario jumps, simulated vendor SMS, simulated EMR death event). [`/dev/components`](app/dev/components) is the component gallery.

The HCHB partner-connection adapter stub is [src/integrations/hchb/adapter.ts](src/integrations/hchb/adapter.ts).

## Non-negotiables

- Synthetic data only. No real patient or hospice data, ever.
- The app has to actually run. A mockup does not count.
- Any AI must be defended against a named rules-based baseline.
- Every assumption gets stated out loud, in the demo and the writeup.
