BetterRX Bounty | DME Ordering and Visibility Challenge

        Builder Day Bounty

      DME Ordering and Visibility Challenge

      Close the coordination gap between hospices and durable medical equipment vendors, from admission to pickup. Use whatever solves it best. AI is welcome, not required.

      $10,000
      Award

    01Overview
    02Core Challenge
    03AI Approach
    04Market Landscape
    05Required Features
    06Integration
    07Data Guidelines
    08Deliverables
    09Judging and Logistics

    Problem Statement
    Two moments hospices don't control, but always get blamed for.

    A new hospice patient needs a hospital bed and oxygen concentrator in place before they're discharged home. A patient passes away, and the equipment needs to be picked up in a timely, respectful way. Both moments are handled by a separate DME vendor, outside the hospice's EMR and outside their direct control. Both moments, when they go wrong, land on the hospice's reputation, the family's experience, and the hospice's CAHPS scores.

        What we've heard directly from hospices

          Equipment arriving late for a new discharge is a recurring service failure. Some hospices now pad a day of buffer around it because they no longer trust the vendor's timeline.

          Untimely pickup after a patient's death is distressing for grieving families and reflects poorly on the hospice, even though the hospice doesn't own that relationship.

          Most ordering today happens by phone, fax, or a vendor-specific portal, rarely with real-time visibility either side can rely on.

        Why BetterRX is running this bounty

          Our own discovery research points toward delivery visibility, not DME ownership, as the higher-leverage problem. We want outside builders to pressure-test that assumption.

          We're deliberately not prescribing the solution. We want the best answer to the problem, not a preconceived one.

          A hackathon lets us learn fast and cheaply, without committing engineering roadmap time to a bet we haven't validated.

      What winning looks like

      The strongest submissions will make a hospice case manager or a DME dispatcher's day measurably easier. That matters more than technical polish. We'll go deeper on requirements, integration, and judging criteria in the tabs above.

    Core Challenge
    The problem, in their words.

    The task: build a solution that gives hospices and DME vendors shared visibility and coordination across the ordering-to-pickup lifecycle. Everything below is pulled directly from BetterRX's own discovery interviews with hospice executives, quoted by title only. The more clearly we can put the actual problem in front of you, the better you can solve it.

    When Equipment Is Late, It's the Hospice's Discharge on the Line

    A new patient can't safely go home without a bed, oxygen, or a wheelchair in place. Hospices don't control the DME vendor's timeline, but they absorb the consequence when it slips.

        "If we get a call after hours for a broken wheelchair, it causes a lot of issues when equipment is outdated. Dissatisfaction for patients, and staff that need to respond."

        Hospice CEO

        "In ten percent of cases she will authorize the equipment to be there a day before the discharge home, as there is no guarantee from the DME company. Big service failure issue for hospice."

        Hospice CEO

        "DME is the bigger headache because of the lack of options. DME is more about the logistics. Nationals only work Monday through Friday, nine to five."

        Hospice CEO

    Pickup After a Death, and Why It Matters More Than It Sounds

    Retrieval is usually triggered by a phone call after a patient passes. When it's slow, a grieving family is left looking at equipment they no longer need, and the hospice takes the blame for a vendor's delay.

        "It's very distressing to see the equipment of a loved one still lingering in your home. The pickup process gives the hospice a bad name."

        Hospice CEO

        "Someone would die and StateServ wouldn't know about it. Patients want their equipment picked up. If we don't pick it up then we have to pay for an additional day as well."

        Hospice COO

        "The DME doesn't consider themselves part of our org. But it reflects on our org. We want perfection."

        Hospice COO

    Fragmented Visibility, and What Fixing It Would Actually Take

    Most hospices juggle separate logins, separate portals, and no shared view of order status. The few who've thought hard about the fix describe something nobody's actually built yet.

        "Three levels: one, SSO. Two, single pane of glass. Three, one place to do it all. I haven't heard of anyone doing this yet."

        Hospice VP of Digital Transformation and Operations

        "If I can just log in once with SSO, that's better than having two sets of credentials. I would put this in the top two criteria: quality, price, and workflow management and integration."

        Hospice VP of Digital Transformation and Operations

        "We can see real time updates on if equipment has been ordered, left the warehouse, in route."

        Hospice Admin, CEO

    Equipment Quality and Who Actually Owns the Problem

    DME is a separate company from the hospice's perspective. Families and regulators don't draw that distinction, so equipment condition and vendor responsiveness become the hospice's problem by default.

        "We had a wheelchair with a screw sticking out of it. Or a chair with fecal matter. People in hospice don't realize that this is a separate company."

        Hospice CEO

        "We like that we have a one-on-one with their rep and get direct contact resolution when it comes to issues. Gives a lot of visibility and quick response time."

        Hospice Regional Vice President of Clinical Care Services

      The task, restated

      Build a solution that gives hospices and DME vendors shared visibility and coordination across this lifecycle, grounded in the problems above rather than an imagined version of them. We're AI-preferred, not AI-required. See the AI Approach tab for how we'll evaluate that specifically.

    AI Approach
    AI-preferred, with a real bar.

    We're not interested in AI sprinkled on top for its own sake. If your solution uses AI or ML anywhere, name the rules-based or deterministic alternative and explain, specifically, why AI earns its place over that baseline. Vague appeals to "AI is smarter" won't score well. A concrete comparison will.

        Good reasons AI wins

          Pattern complexity. The signal isn't a clean threshold. Predicting service-failure risk from vendor history, order type, geography, and timing has too many interacting variables for hand-tuned rules to hold up.

          Data drift. A rules engine needs constant manual retuning as vendor performance or patient volume shifts. A model adapts as new data comes in.

          Novel inference. The model surfaces a correlation no one would think to hard-code, like a specific vendor's on-time rate degrading for a specific order type or region.

        What won't score well

          An LLM call standing in for a lookup table or a simple if/then check.

          "We used AI" as the pitch, with no stated baseline to compare against.

          AI applied where it adds latency or fragility without adding accuracy, insight, or a capability a rules engine genuinely couldn't offer.

      Requirement: defend your AI, if you use it

      If your solution uses AI anywhere, you must be ready to defend two things when you present. First, why AI is the right tool for this specific problem, not a rules-based engine with extra steps. Second, how you've kept it safe: how you avoid hallucinated statuses, capacities, or patient details, how low-confidence predictions get flagged instead of stated as fact, and where a person has to confirm before a high-stakes action happens. Teams that skip this defense will be scored down under AI ROI, regardless of how the model performs.

      It's fine if the honest answer is "rules-based is better here"

      Teams that correctly identify a piece of the problem where a deterministic approach is the right call, and say so, will not be penalized for skipping AI there. We're judging problem-solving judgment, not AI usage volume.

    Context
    How hospices get DME today.

    DME today moves through a mix of national platforms, regional vendors, and manual coordination: phone calls, faxes, and vendor-specific portals. A combined DME-plus-medication approach is an emerging category, and several EMR vendors have begun acquiring or partnering directly into DME software rather than leaving it to third parties.

      An assumption worth building around

      BetterRX has no existing DME vendor network today. Whatever you build needs to create real value on day one, before a single vendor relationship exists, and ideally needs a path to bring DME vendors into the system rather than assuming they're already connected. This is a cold-start problem as much as a coordination problem.

        What's common across the market

          Vendor networks vary by pricing model. Some take a spread between what the hospice pays and what the vendor is paid, others charge a flat per-patient-day rate.

          Most order tracking still relies on vendor-specific portals rather than a shared, hospice-and-vendor view of order status.

          Real-time delivery tracking (GPS, proof-of-delivery capture) exists in DME and HME operational software, but is rarely surfaced back to the hospice in a usable way.

        What's shifting

          EMR platforms are increasingly building or acquiring DME capability directly, rather than leaving it entirely to third-party integrations.

          Predictive analytics is already established in hospice for clinical risk, like length-of-stay or mortality-risk scoring, but rarely applied yet to DME logistics specifically. That's a relatively open lane.

    Read the full Competitive and Market Landscape briefing

    Required Features
    Design for both sides of the handoff.

    DME only works when the hospice and the vendor are looking at the same information. Your solution should account for both sides, plus the layer that alerts someone when something's about to go wrong.

    The Order Lifecycle

      01Ordered
Triggered at admission or pre-admission. Hospice specifies patient, equipment, urgency.

      →

      02Dispatched
Vendor assigns to a route. ETA generated.

      →

      03In Transit / At Risk
Live status. This is where a risk signal should fire if delivery won't beat a deadline.

      →

      04Delivered
Proof of delivery captured. Hospice and family notified.

      →

      05Pickup Triggered
Patient status change (death, discharge) automatically flags equipment for retrieval.

      →

      06Pickup Delayed
Retrieval hasn't happened within an expected window. Family is still looking at equipment they don't need.

        Hospice-Side Profile

          Patient and equipment need (type, quantity, urgency, target date)

          Discharge-readiness flag. Equipment must be confirmed before a scheduled discharge.

          Post-death pickup trigger, ideally tied to an EMR status change rather than a manual call

          Vendor choice within a market (most hospices work multiple vendors, not one)

          Total cost-of-care visibility. DME spend alongside medication spend, not in a separate silo.

          Mobile and tablet-friendly ordering at the bedside

        DME Vendor-Side Profile Hardest part
        This is where we most want to see something original. Getting the hospice side right is table stakes. Solving the vendor side well, especially with no existing vendor network to lean on, is the differentiator.

          Fleet and route capacity, service area, and current load

          Serialized equipment inventory: what's in stock, what's out, what's overdue for pickup

          Delivery and pickup status with proof-of-capture (signature, photo, timestamp)

          SLA and contract terms per hospice client, tracked against actual performance

          Resupply cadence for consumables (CPAP supplies, wound care) tied to payer-approved timelines

          Billing trigger tied to delivery completion. DME claim denial rates run 15 to 25 percent, largely from documentation gaps.

          Vendor recruitment and onboarding. Since BetterRX has no vendor network today, a path to identify, invite, and activate local and regional DME vendors from a cold start.

      Shared / Notification Layer

        Real-time status visible to both sides, not just the vendor's internal system Differentiator

        Service-failure risk scoring, surfacing an at-risk order before it's late, not after Differentiator

        Escalation path to a case manager or vendor rep when a risk threshold is crossed

        Explainability. "Why was this order flagged as at-risk?" should have a legible answer, not a black box.

    Integration Requirements
    Plug into what hospices already run.

    Your solution needs to plausibly connect to BetterRX's own eRx system and to the EMR platforms that dominate hospice operations today. You don't need a production integration. A clear, technically credible integration approach is enough.

    DME Coding and Claims Standards

    DME doesn't have a pharmacy-style e-prescribing standard for placing orders. What it does have: equipment is identified using HCPCS Level II "E" codes, the CMS coding set built specifically for durable medical equipment (over 500 codes; CPAP, code E0601, is the single most-fulfilled DME code nationally). On the billing side, DME claims run through the same ANSI X12 837 claims transaction standard used across healthcare generally, not a DME-specific one. There is no widely-adopted front-end ordering standard the way pharmacy has with e-prescribing. That gap is exactly why most real DME integration happens through each EMR's own partner-connection layer rather than a shared industry protocol, which is what the rest of this tab covers.

    Your solution still needs a way to connect to BetterRX's eRx system so DME and medication data can sit side by side for a patient. Treat that as a data-sharing integration between two systems, not a shared transaction standard, since DME has no pharmacy-equivalent standard to plug into.

    Hospice EMRs, Integration Reference Points

      HCHB
Homecare Homebase

      Has a dedicated integration layer built specifically to automate DME ordering and share real-time patient status with outside vendors. Existing DME integrations already plug in this way, a credible precedent to design against.

      Axxess

      Supports DME integration through a partner-connection model, where patient updates sync automatically to a connected DME system. Note: sources disagree on whether Axxess exposes a public API. Design for the partner-connection pattern, not an assumed open API.

      WellSky

      The most vertically integrated of the four. WellSky acquired a DME and HME software platform outright in 2024 rather than relying solely on third-party partners. Worth knowing when designing an integration story, since some WellSky-run agencies may already have DME tooling bundled in.

      MatrixCare

      Has the most mature multi-partner DME ecosystem of the four, including a bi-directional ordering interface with the leading DME-vendor software platform, built directly into the hospice EHR rather than a bolt-on portal.

      What "integration-ready" means for judging

      You're not expected to build a live EMR connection in 24 hours. Show us you understand the shape of the data (what a patient or order record looks like, what triggers a status change) and sketch how your solution would sit alongside one of these systems. A diagram is enough.

    Data Guidelines
    Synthetic data only.

    No proprietary or real patient data. Generate your own synthetic dataset, or ground it in the public data and sample orders below.

        Sample DME Orders (synthetic, AI-generated)

        A handful of example order records spanning the full lifecycle, including both risk states, to give you a concrete transaction shape to build against. This example set was generated by an AI agent, not sourced from any real hospice, patient, or vendor.

        View sample orders

        CMS Medicare DME, Devices and Supplies Public Use Files

        Aggregate utilization, payment, and equipment-type statistics by HCPCS code, summarized by provider. This is not individual order or transaction-level data. Use it for realistic distributions and cost benchmarks, not as literal sample orders.

        data.cms.gov

        CMS Hospice Provider Utilization and Payment Public Use File

        Aggregated hospice-level data on utilization, length of stay, diagnoses, and beneficiary demographics. Also aggregate, not per-patient or per-order.

        catalog.data.gov

      Do not use

      Real patient information, real hospice client data, or anything proprietary to your employer or a prior project. If in doubt, generate it synthetically instead.

    Deliverables
    What to bring to judging.

    Five things. None of them need to be polished. They need to be true, specific, and real.

        A
        A working applicationThis needs to run, not just look like it runs. A clickable Figma flow or a static demo won't cut it this time. Keep the backend as simple as you need to, but a judge should be able to click through a real interaction, not a mockup of one.

        B
        AI approach explanation, or rationale for skipping itWhat you used, and specifically how it compares to a rules-based baseline for your use case. Include your best estimate of token or compute cost per patient or per order, even a rough one, and how you kept the approach safe (grounded, confidence-checked, human-confirmed for high-stakes actions). If you deliberately went rules-based somewhere, say why. That's a legitimate answer.

        C
        Differentiation snapshotA short, direct comparison: what does your solution do differently from how DME ordering happens today, and why does that matter to a hospice or a vendor?

        D
        Integration approach sketchHow your solution would connect to BetterRX's eRx system and to at least one EMR (HCHB, Axxess, WellSky, or MatrixCare), including the data shape involved: what a patient or order record actually looks like as it moves between systems. A diagram is enough. No live connection required.

        E
        2 to 3 example scenariosWalk us through real situations your solution would change: a discharge-readiness scenario, a post-death pickup scenario, or a service-failure-prevention scenario.

    Judging and Logistics
    How we'll evaluate, and the ground rules.

    Judging Rubric

      Criteria	Weight	What it tests

      Differentiation from current DME approaches	30%	Did the team understand today's market well enough to beat it, not just match it?

      Addresses core user problems	25%	Grounded in real pain points, discharge readiness, pickup timeliness, visibility, not an imagined problem.

      Architecture and integration-readiness	15%	Could this plausibly plug into BetterRX's eRx system and an EMR without a rebuild?

      AI ROI	15%	If AI is used, does it demonstrably beat a rules-based alternative, and is it used safely?

      UX and intuitiveness	15%	Is the user experience intuitive?

    Ground Rules

      Eligibility
Open
No minimum experience requirement

      Team size
Any
1 to 3 recommended

      Max teams
8
In our bounty room

      Briefing
15 to 20 min
Deep dive, Aug 14, 1:00pm

      Pitch time
5 min + Q&A
About 5 min buffer per team

      Judges
3
From BetterRX

      Why the loose eligibility bar

      This bounty is a genuine discovery exercise, not a recruiting funnel. We'd rather hear from a range of perspectives than filter for seniority. The naive-but-good idea is sometimes the one an experienced team filters out.

      BetterRX · Builder Day Bounty · August 2026

    Market Landscape Briefing · Sample DME Orders