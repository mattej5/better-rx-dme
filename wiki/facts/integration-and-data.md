# Integration and Data

## What we must show for deliverable D

How the solution connects to **BetterRX's eRx system** and to **at least one EMR** (HCHB, Axxess, WellSky, or MatrixCare), including the shape of a patient/order record as it moves between systems. **A diagram is enough.** No live connection required in 24 hours. `[brief]`

## Real BetterRX eRx payloads

These reflect BetterRX's actual eRx data model and were supplied in the FAQ. Our DME event schema should mirror this shape so DME and medication data sit side by side for a patient. `[faq]`

### Patient / demographics event

```json
{
  "meta": { "eventType": "newOrUpdatePatient" },
  "account": { "identifiers": [ { "id": "testAccountId" } ] },
  "patient": {
    "identifiers": [ { "id": "testPatientId", "idType": "testPatientIdType" } ],
    "demographics": {
      "firstName": "Donald", "lastName": "Tester",
      "dob": "1960-01-14", "gender": "M",
      "ssn": "123-35-3752", "medRecNo": "1234567890",
      "phone": "123-456-7890",
      "address": {
        "street1": "testStreet1", "street2": "testStreet2",
        "city": "testCity", "state": "testState",
        "zip": "testZip", "country": "USA"
      },
      "diagnoses": [ { "codeType": "icd10Code", "code": "C90.00", "isPrimary": true } ],
      "allergies": [ { "description": "Latex" } ]
    }
  }
}
```

### Medication event

```json
{
  "meta": { "eventType": "newMedications" },
  "account": { "identifiers": [ { "id": "testAccountId" } ] },
  "patient": {
    "identifiers": [ { "id": "testPatientId", "idType": "testPatientIdType" } ],
    "medications": [
      {
        "externalId": "0b307548-2c46-4b40-8b16-bb5501f5d6c5",
        "product": {
          "codeType": "NDC",
          "code": "00054051741",
          "name": "MORPHINE CONCENTRATE 100 MG/5 ML (20 MG/ML) ORAL SOLUTION"
        },
        "sig": "TAKE 0.25ML BY MOUTH FOR MODERATE PAIN RATING OF 4-7/10. ...",
        "physician": { "identifier": { "id": "1497771109", "idType": "npi" } }
      }
    ]
  }
}
```

**Design implication:** a DME event should look like `newDmeOrder` / `dmeStatusUpdate` following the same `meta` / `account` / `patient` envelope, with the product identified by an **HCPCS Level II E-code** where medications use an NDC code. That parallel is the cleanest integration story available to us. `[assumed]` — extrapolated from the two payloads above.

## DME coding and claims standards

- **No pharmacy-style e-prescribing standard exists for DME ordering.** There is no front-end ordering standard at all. `[brief]` `[landscape]`
- Equipment is identified by **HCPCS Level II "E" codes**, the CMS coding set for durable medical equipment. **500+ codes.** `E0601` (CPAP) is the single most-fulfilled DME code nationally. `[brief]`
- Billing runs through the generic **ANSI X12 837** claims transaction, not anything DME-specific. `[brief]`
- Because there's no shared ordering protocol, real DME integration happens through **each EMR's own partner-connection layer**. That's the pattern to design against. `[brief]`

Common E-codes seen in the sample orders: `E0250` hospital bed, `E1130` wheelchair, `E0601` CPAP / oxygen concentrator.

## The four hospice EMRs

| EMR | What exists today |
|---|---|
| **HCHB** (Homecare Homebase) | Dedicated integration layer purpose-built to automate DME/supply ordering and share real-time patient status with outside vendors. Existing DME integrations already plug in this way — the most credible precedent to design against. `[brief]` |
| **Axxess** | Partner-connection model; patient updates sync automatically to a connected DME system. Sources disagree on whether a public API exists. **Design for the partner-connection pattern, not an assumed open API.** `[brief]` |
| **WellSky** | Most vertically integrated. Acquired a DME/HME software platform (Bonafide) outright in 2024. Some WellSky agencies may already have DME tooling bundled. `[brief]` `[landscape]` |
| **MatrixCare** | Most mature multi-partner DME ecosystem; bi-directional ordering interface with the leading DME-vendor software platform (Brightree), built into the hospice EHR rather than bolted on. `[brief]` |

HCHB is the largest hospice EMR. `[kickoff-qa]`

**Recommendation:** sketch against **HCHB** (purpose-built DME integration layer, largest install base) and mention MatrixCare as the bi-directional precedent. `[assumed]`

## Public datasets

- **CMS Medicare DME, Devices and Supplies PUF** — `data.cms.gov`. Aggregate utilization, payment, and equipment-type by HCPCS code, summarized by provider, back to 2013. Use for **realistic distributions and cost benchmarks**, not as literal sample orders. Contains **no** delivery timing or fulfillment data.
- **CMS Hospice Provider Utilization and Payment PUF** — `catalog.data.gov`. Aggregate hospice-level utilization, length of stay, diagnoses, demographics. Also aggregate, not per-patient.
- **Sample DME orders** — synthetic, AI-generated, in `docs/bounty/sample-orders.md`. Use for transaction shape only; it is not statistically representative.

## Benchmark numbers (sanity-check only, not DME-specific) `[landscape]`

- 65–85% — typical accuracy range for published hospice clinical risk models (readmission, mortality, fall risk)
- 15–25% — DME claim denial rate industry-wide, vs. 5–10% general medical billing
- 20–35% — reported on-time delivery / capacity gains from AI-driven route and ETA optimization in **general logistics**, not DME

These are useful as a sanity check on AI ROI claims, not as a target a hackathon prototype must hit.

## Where the integration gap actually is

Sponsor at kickoff: the hospice-EMR side is **already done**. "Where I think the integration's going to be is with the DME vendor side... if we want some of that data regarding deliveries and inventory." They assume they'd integrate with vendor software but **do not know** whether that means a portal, an integration, magic links, or something else — and they're leaving that call to us. Make the assumption, defend it. `[kickoff-qa]`
