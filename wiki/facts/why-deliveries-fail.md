# Why DME Deliveries Fail — causal chain and CAHPS truth

Research pass 2026-08-14. Tag `[research]`.

## Causal chain (each link labeled)

1. Medicare competitive bidding cut reimbursement; suppliers with ≥$2,500 allowed charges fell **27% in bid areas vs 5% in comparators** (GAO-14-156, 2014). `[research]` verified, primary
2. Nationally, DMEPOS supplier locations down **37.4% since July 2013** to ~8,078 (Jan 2026 data; 16 states lost >40%; CT −55.9%). Count credible; causal attribution is AAHomecare's (trade association). `[research]`
3. Fewer suppliers per geography → fewer fallback vendors when the primary is stocked out or committed. Inferred; no dataset measures fallback depth.
4. Rural supplier deserts concentrate the risk. `[assumed]` — only vendor marketing supports it; needs a citation or drop it.
5. Vendors staff business hours; hospice deaths and crises are 24/7. `[assumed]` — structurally obvious, uncited. Sponsor quote backs it: "Nationals only work Monday through Friday, nine to five" `[brief]`.
6. The order crosses an org boundary into a system the hospice cannot see; status unknown until someone phones. `[brief]`
7. Family experiences the gap as hospice failure; the vendor is invisible to them. `[brief]`

**Judge-killer to pre-empt:** GAO explicitly did *not* find beneficiary-access harm from competitive bidding. Our claim is **coordination fragility** (fewer fallbacks, zero cross-boundary visibility), not access denial. Say it before they do.

## CAHPS — corrected understanding

- The CAHPS Hospice Survey (QAG V12.0) contains **no equipment question at all**. Verified by direct text extraction of the instrument: zero hits for equipment/supplies/oxygen/hospital bed/wheelchair. A vendor blog claiming "half the survey focuses on DME" is false.
- The anchor item is **Q6: how often the hospice team "let you know when they would arrive."** Arrival-time communication is CMS-scored, published on Care Compare, star-rated. That is our product in CMS's own words. (Verbatim wording garbled in our PDF extraction — re-check exact phrasing before it goes on a slide.)
- Equipment failures plausibly land on Q5 (evenings/weekends help), Q7 (help as soon as needed), Q30/Q31 (overall + recommend). `[research]`-inferred — say "we believe it lands here," never "CAHPS measures equipment."
- Money attached: 8 CAHPS measures on Care Compare, star ratings, 4% APU penalty for non-*reporting*. The score cuts referrals via public display, not payment directly. Get this right.

## SMS coordination precedents

- **Trucker Tools "Text to Track"** (verified, shipping product): dispatcher's phone number in → one-time SMS link out → no app, no login → opt-in GPS flows back into the broker's TMS. Exactly the FAQ's never-logs-in vendor baseline. Copy the mechanic.
- Contrast: FourKites built app-first (660k+ driver installs), then had to ship SMS fallbacks for the low-tech tail. The industry already learned our lesson. `[research]`
- SMS nudges move behavior: meta-analysis (21 studies, n=16,076) attendance RR 1.23; **multiple notifications RR 1.49 vs single RR 1.09** — the escalation ladder is a feature, not a retry. Caveat: not validated on low-tech populations specifically. `[research]`

## Rules vs LLM for parsing

JAMIA Open (Nov 2025, 7,764 radiology reports): regex 89.20% vs LLM 87.69% (P=.56), regex **18,404× faster** on the corpus; authors recommend hybrid — deterministic for standardized fields, LLM for messy context. Cite it; choose hybrid; state we used the slower tool only where it wins. See [[0003-ai-scope]]. `[research]` verified, peer-reviewed

## No source exists for

DME delivery-timeliness data of any kind · supplier density ↔ lateness link · DME driver workforce numbers · post-death pickup timeliness · SMS efficacy for non-technical users specifically.

Related: [[reverse-logistics-and-pickup]], [[competitor-products]], [[user-journeys]], [problem.md](problem.md)
