# AI Approach (deliverable B)

What is rules, what is LLM, what baseline the LLM has to beat, what it costs, and how it is kept from doing damage.

Decision record: `wiki/decisions/0003-ai-scope.md`. Implementation: `specs/engine.md` §2 and §3.4.

---

## 1. The split

**Deterministic rules do the work that matters.**

| Job | Method | Why not an LLM |
|---|---|---|
| At-risk flagging | Five threshold rules over the event log | The inputs are two timestamps and a deadline. An LLM here is a lookup table with a bill attached |
| Vendor reliability and condition scores | Weighted arithmetic over `order_events` | The vendor sees the same number with the formula printed. A model output cannot be disputed line by line |
| Billing clock and equipment-days saved | Timestamp subtraction | It is a dollar figure on a DON report. It has to be reproducible |
| Escalation ladder timing | Multiples of the silence window | Idempotent, replayable, testable |
| Structured SMS replies ("YES", "ETA 3PM") | Regex, first pass | Faster and at least as accurate, see §3 |

**The LLM appears in exactly one place in the codebase:** behind `parseVendorReply()` in `src/lib/parse.ts`, plus optional outbound message drafting which is off by default. That is the whole surface area.

**Named baseline for the flagging engine.** The at-risk engine has no AI to defend, because it has no AI. Choosing rules and saying so is a legitimate answer under the bounty brief `[brief]`. What we defend instead is the one place we did reach for a model.

---

## 2. Why free-text vendor replies are the one honest use

The vendor baseline is a dispatcher who never logs in and answers a text `[faq]`. Real replies look like this, from our eval fixture set:

```
stuck behind an accident on I-15, maybe 2hrs
got it but the bed is on the other truck, tomorrow am ok?
O2 needs a hazmat driver, none till Monday
no problem
kk
who is this
```

`"no problem"` means yes. `"ok"` alone is an acknowledgment, not a confirmation. `"maybe"` is not an ETA. No regex resolves that set, and guessing wrong on an oxygen delivery is a clinical event, not a UX annoyance.

---

## 3. Hybrid, with the baseline reported alongside

`parseVendorReply()` runs regex first, always.

**Pass 1, regex.** Zero marginal cost, roughly 0.1 ms. Handles the structured majority: yes/no variants, `ETA 5:10 PM`, `in 45 min`, bare confirm plus time. Confidence 0.9 to 0.99.

**Pass 2, LLM.** Fires only when pass 1 returns `unknown`, or when the message runs over 12 words with no clean match. Structured JSON output, grounded in that order's context, `effort: "low"`.

**The evidence that shaped this.** JAMIA Open, November 2025, 7,764 radiology reports: regex 89.20% vs LLM 87.69% (P=.56), with regex 18,404x faster on the corpus; the authors recommend a hybrid, deterministic for standardized fields and LLM for messy context `[research]`. We took that recommendation literally. We pay for the model only on the tail where it wins.

**We report both numbers.** `npm run eval:parse` runs 24 fixtures (8 structured, 10 messy, 6 adversarial) through regex-only and through the hybrid, and prints:

```
Regex baseline   14/24 (58%)   |  cost $0.00   |  0.4 ms total
Hybrid           22/24 (92%)   |  cost $0.031  |  4.1 s total
LLM invoked on 11/24; 2 correctly returned low confidence -> human confirm
```

The last line is the safety story with a number on it. The two the hybrid "fails" are cases where it declined to guess and handed off to a nurse. The runner exits 1 if the hybrid drops below 20/24, so a prompt edit cannot silently regress during the build.

---

## 4. Cost per order

Reproduced from `specs/engine.md` §3.5. Assume roughly 2.2 vendor replies per order; regex handles about 70% at zero marginal cost.

| Path | Calls/order | In (cached / fresh) | Out | Cost @ Opus 5 ($5/$25 per MTok) |
|---|---|---|---|---|
| Regex only (70%) | 0 | (none) | (none) | **$0.0000** |
| LLM parse (30%) | 0.66 | 700 cached (@$0.50/MTok) + 250 fresh | ~120 | **$0.0043** |
| Outbound draft (optional, off by default) | 0.3 | 400 cached + 150 | 200 | $0.0021 |
| **Total, parse only** | | | | **≈ $0.004 / order** |
| **Total, parse + drafting** | | | | **≈ $0.007 / order** |

At 20 DME orders per week for a 100-patient hospice `[assumed, open question]` that is **under $5 per year in inference**. Cache-read pricing at roughly 0.1x does the heavy lifting: the ~700-token system prefix sits above the 512-token cache minimum, so every parse after the first is a cache read, and the first request of each cold window pays a 1.25x write.

**Model choice is deliberate, not a default.** `claude-haiku-4-5` ($1/$5) would drop this roughly 5x. We ship Opus 5 because at $5 per year the cost is not the constraint, and we say so out loud rather than quietly picking the cheap model and calling it engineering.

**SMS is the real line item, not tokens.** Twilio runs about **$0.0087 per message** `[team]`. A typical order sends one notify plus up to two nudges, so roughly $0.026 per order in SMS, which is **six times the inference cost**. Any honest cost slide leads with that number, not with the model.

---

## 5. Safety

**Grounded.** The parse prompt receives that specific order's context: item, urgency, needed-by, vendor, current status, hospice timezone. It is not asked what it thinks about DME.

**Tool-choice constrained.** The agent picks one action from a fixed list: `update_status`, `set_eta`, `flag_at_risk`, `ask_clarification`, `escalate_to_human`. No open conversation, no browsing, no research `[team]`. There is no path from a vendor's text to an arbitrary action.

**Confidence gated.** Below **0.75** confidence, nothing changes state. The interpretation is written onto the order timeline as "we read this as X, please confirm," and a nurse taps to accept or correct.

**High-stakes actions are always human-confirmed regardless of confidence.** Reordering to a backup vendor and escalating to the DON both require a tap. Nothing auto-cancels an order, and the screen says so.

**Explainability is rendered, not claimed.** The parsed interpretation appears under the raw vendor message on the order timeline (view 6). Every `at_risk_flagged` event carries a required human-sentence `reason`, for example: "Delivery ETA 5:10 PM, discharge 4:30 PM, misses by 40 minutes."

**Prompt injection.** A vendor SMS is untrusted input. The constrained action list is the containment: the worst case is a wrong status or a wrong ETA on one order, which the nurse sees on the timeline with the raw text beside it.

**Swappable provider.** The seam is provider-agnostic by contract. A Gemini key is available and the body of `parseVendorReply()` can change without touching a caller.

---

## 6. What we chose not to build, and why

- **ETA prediction model.** No delivery-timing dataset exists in any shareable form `[faq]`. A model trained on synthetic data would be a number with no meaning attached.
- **Agent-to-agent (A2A) vendor negotiation.** Dropped, then upgraded to an answer on the architecture slide rather than a build `[team]`. A2A is transport, not inference, so there is no baseline for it to beat. The honest version: our magic-link JSON contract already is the machine interface, and a vendor's agent can POST the same payload a dispatcher answers by SMS. Building both agents ourselves would be self-dealing theater.
- **Free-form chat with the nurse.** Every user is effectively a first-time user because of turnover `[brief]`. A chat box is a worse interface than a button for someone who has never seen the screen.
