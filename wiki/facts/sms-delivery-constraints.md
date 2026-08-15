# SMS delivery constraints — why the vendor channel is a magic link, not a text

Source: Twilio docs, checked 2026-08-14. `[research]`

## The hard constraint

Application-to-person (A2P) SMS to US numbers over a 10-digit long code requires **A2P 10DLC brand + campaign registration**. Two facts make this unusable inside a 24-hour build:

- **Campaign review takes 10–15 days.** Brand approval is fast (minutes, via The Campaign Registry); the campaign is the bottleneck.
- **Trial accounts cannot register at all.** Registration requires a paid account.

Unregistered traffic to US numbers is filtered or blocked by the carriers, not by Twilio.

## What does work this weekend

A trial account can send to **Verified Caller IDs** — numbers confirmed in the Twilio console. Our own phones. Messages carry a `Sent from your Twilio trial account -` prefix.

So: one real SMS, to a phone we control, is demonstrable. Real SMS to a judge's phone is not.

## Why this does not hurt the build

It pushes us toward the architecture we already chose, and it is worth saying out loud in the pitch rather than hiding:

1. **`sendMessage()` is a seam** (`specs/engine.md` §3.1). Transport is config, not architecture. Resend email is the fallback and has no carrier registration problem.
2. **The demo panel has a simulated inbox** (§3.3). The nudge ladder and `parseVendorReply()` demo end-to-end with no carrier involved — and it is the same code path a real Twilio webhook hits.
3. **The vendor's real entry point is the magic link, not the SMS.** `/v/[token]` + the demo panel's QR code (§5.2) puts the vendor run list on a judge's own phone with zero login, zero app install, and zero carrier.

Framing for the pitch: *"Reaching an unregistered vendor by SMS requires a 10–15 day carrier review. So the transport sits behind a seam, and the vendor's actual entry point is a link that needs no app and no registration."* That is a stronger differentiation answer than working SMS would have been — it is the same reason a vendor who never logs in can still participate.

## Consequence for the seed data

`T1` seeds 6 vendors with phone numbers. On a trial account only verified numbers can receive anything, so the demo vendors' phone numbers must be **our own verified numbers**, not synthetic ones. Synthetic numbers fail silently — no error, no delivery. This needs to reach the engine lane before the seed is finalized.

## Related

- [[why-deliveries-fail]] — SMS nudge-ladder evidence (RR 1.49 multi vs 1.09 single)
- [[vendor-value-prop]] — the vendor who never logs in
- `specs/engine.md` §3 — comms loop, templates, ladder
- `wiki/decisions/0003-ai-scope.md` — magic link as the GPS opt-in mechanic
