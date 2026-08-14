# ADR 0004 — Reliability score: synthetic, labeled loud, framed as flywheel

Date: 2026-08-14 · Status: accepted · `[team]`

## Decision

Ship the vendor reliability score as a **main accountability mechanism** (Vin's call), computed from delivery/pickup events: on-time %, confirmation responsiveness, at-risk frequency, condition attestations. Demo runs on **synthetic history, labeled on-screen and on-slide as synthetic**, with the exact event-driven accrual path stated: the same score fills with real data from day one of operation. Day-one cold start (no history) falls back to deterministic ranking: hours, coverage area, equipment match, price.

Score arithmetic is deterministic ([[0003-ai-scope]]) — a transparent formula, not a model. Explainability is a rubric differentiator tag.

## Framing

The score is a **marketplace flywheel, not a compliance stick** ([[vendor-value-prop]]): good vendors visibly win order volume in the compare view; the vendor report card shows the score next to business won. Second score for equipment condition feeds from pickup/delivery photos (transcript idea, kept).

## Risk

No real delivery-timing data exists anywhere (`[faq]` — confirmed by [[why-deliveries-fail]] research). Unlabeled synthetic precision would be scored down under AI ROI honesty. The label is load-bearing; it goes in the assumptions ledger.
