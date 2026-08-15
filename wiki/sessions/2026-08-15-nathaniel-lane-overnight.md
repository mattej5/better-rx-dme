# 2026-08-15 — Nathaniel lane (N1–N12) overnight run

Read this in two minutes, then start at **"Do this first."**

All twelve N-cards have code on branch `nathaniel`, pushed. `npx tsc --noEmit` clean, `npm run build` clean, `npm run eval:parse` and `node scripts/check-templates.ts` both pass.

## Do this first — one env var unblocks eight cards

`SUPABASE_SERVICE_ROLE_KEY` is not in this checkout, so **every screen in this lane rendered against fixtures and no database write has ever executed.** The query paths are written, typed against `src/types/db.ts`, and compile — they have simply never run.

```
npx vercel env pull .env.local
npm run seed
npm run dev
```

Then click through `/order/<patientId>`, `/orders/<orderId>`, and `/v/<token>`. Fixture fallbacks are guarded and self-remove once the env is present; the swap is deleting a fixture block, not rewriting a page.

Second, for the AI number: `ANTHROPIC_API_KEY=sk-ant-... npm run eval:parse` prints the real hybrid score. Without it the runner honestly reports "not measured" rather than an estimate.

## Cards moved to Done

| Card | Commit |
|---|---|
| **N3** — message templates + nudge ladder | `50e0e36` |

Pure, no I/O, fully verified including clock-jump idempotency. Nothing gates it.

## Cards moved to Blocked

| Card | Commit | Blocked on |
|---|---|---|
| N1 — env setup | `7fe6c83` | A human sending one SMS to a Verified Caller ID |
| N2 — `sendMessage()` seam | `7fe6c83` | `SUPABASE_SERVICE_ROLE_KEY` |
| N4 — `parseVendorReply()` | `c2e9008` `4969ecb` | `ANTHROPIC_API_KEY` |
| N5 — eval harness | `df61495` `c2e9008` | `ANTHROPIC_API_KEY` (hybrid column only) |
| N6 — magic link + run list | `3218710` | `SUPABASE_SERVICE_ROLE_KEY` |
| N7 — stop cards + POD | `7fb7983` | `SUPABASE_SERVICE_ROLE_KEY` |
| N8 — order flow steps 1–2 | `04f71eb` | `SUPABASE_SERVICE_ROLE_KEY` |
| N9 — compare step | `04f71eb` | `SUPABASE_SERVICE_ROLE_KEY` |
| N10 — order detail | `04f71eb` | `SUPABASE_SERVICE_ROLE_KEY` |
| N11 — replacement flow | `7fb7983` | **No UI entry point** + the key |
| N12 — onboarding + report card | `3218710` | `SUPABASE_SERVICE_ROLE_KEY` |

"Blocked" here means *code complete, never executed against real data* — not *unstarted*. Every card's Notion note carries its specifics.

## The one real gap

**N11 has no way in.** `src/lib/replacement.ts` is complete and typed, but the nurse-facing "Request replacement" button does not exist. It belongs in `app/(hospice)/orders/[orderId]` and is roughly a five-line call:

```ts
requestReplacement({ orderId, conditionEventId, confirmation: { confirmedBy: session } })
```

Nothing else in the lane is missing a surface.

## Three things to fix before the pitch, not after

1. **Deliverable B's cost claim is wrong.** `specs/engine.md` §3.5 says "under $5/year in inference." Two errors underneath it: the spec's 512-token cache minimum is actually **4096** on Opus 4.8, and — the bigger one — at 20 orders/week vendor replies arrive minutes-to-hours apart, so a 5-minute ephemeral cache is **cold on most production calls**. Real figure is nearer **$50/year**. Still trivially cheap, but Vin's V11 repeats the $5 number and a judge who does the arithmetic will find it. The long system prompt earns its keep on *accuracy*, not cache economics — say that.

2. **The eval flatters itself slightly.** N4's `PARSE_SYSTEM` few-shot examples overlap with strings in `evals/vendor-replies.json`. Rules were taught rather than fixtures pasted, and wording was varied, but the harness measures generalization less than the score implies. One honest sentence in the writeup beats a judge finding it.

3. **`specs/engine.md` §3.4 pins `claude-opus-5`, which does not exist** and 404s. Shipped `claude-opus-4-8` — same $5/$25 tier the cost table assumes. The spec still needs correcting so nobody re-introduces it.

## Demo gotchas found while building

- **The DON approval branch needs qty ≥ 2.** With seeded prices no single unit crosses $500/month, so a qty-1 order never triggers approval. Rehearse with an alternating-pressure mattress at qty 2.
- **The expired-link page can't be demoed once the DB is live.** It's fixture-only; the seed has no `magic_links` row with a past `expires_at`. If it's in the pitch, ask the data lane to seed one.
- **A freshly-placed order tapped through ON MY WAY sits at `ordered`.** `deriveStatus` only reaches `in_transit` after a `dispatched` event and §1.3 defines no `dispatched` endpoint. Seeded orders already carry it, so the rehearsed path works — just don't place a brand-new order on stage.
- **No blob storage.** Signature and photo capture inline as data URLs, downscaled and capped at 400KB. Over the cap it returns `stored:false` rather than claiming an upload.
- **Seeded patients have no lat/lng**, so GPS haversine refinement can't fire. The endpoint carries the driver's stated ETA with `refined:false` instead of inventing a number.

## Relay these

**To Vin:** "Pull `SUPABASE_SERVICE_ROLE_KEY` into the shared env — it's the single thing gating eight of my cards, all of which are code-complete. Also: V11's deliverable B repeats engine.md's 'under $5/year' inference figure; the real number is closer to $50/year because the prompt cache goes cold between vendor replies. And `specs/engine.md` §3.4 pins a model ID that doesn't exist."

**To Tony:** "T1's six seeded vendors need OUR real phone numbers, not synthetic ones. A2P 10DLC means only Verified Caller IDs receive anything this weekend — synthetic numbers fail silently at the carrier, with no error. Also, addendum #8 cut family comms from v1, so the death fan-out is vendor-only: four orders × one message, not × two."

## Notes

- Non-Claude tooling was left untouched but never invoked, per instruction. `.agents/skills/grill-me/agents/openai.yaml` is still untracked in the working tree.
- Four commits from this run touched `components/*.tsx` — all additive prop extensions wired into V13's existing shells. No parallel components were created. `/dev/components` still renders.
- New: `wiki/facts/sms-delivery-constraints.md` — why the vendor channel is a magic link rather than a text.
