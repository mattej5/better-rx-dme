# Glossary

Hospice and DME terms used throughout the sponsor material. Agents should use these exactly; don't invent synonyms.

| Term | Meaning |
|---|---|
| **DME** | Durable Medical Equipment — hospital beds, wheelchairs, oxygen concentrators, CPAP. The physical equipment a hospice patient needs at home. |
| **HME** | Home Medical Equipment. Often paired with DME in vendor software naming ("DME/HME platform"). |
| **CAHPS** | Consumer Assessment of Healthcare Providers and Systems. The public survey scores families use to choose a hospice. Service failures hit these. |
| **EMR / EHR** | Electronic Medical/Health Record. Source of truth for patient, diagnosis, and prescription data. Hospice EMRs: HCHB, MatrixCare, Axxess, WellSky. Epic is hospital-side, not hospice. |
| **HCHB** | Homecare Homebase. The largest hospice EMR. |
| **ADT** | Admit / Discharge / Transfer message. The standard healthcare event message. Assume BetterRX receives it. |
| **eRx** | Electronic prescribing. BetterRX's existing medication ordering system. |
| **MedRx** | BetterRX's medication system, where patient/diagnosis/allergy data already lands. |
| **IDT** | Interdisciplinary Team meeting. Where nurses and physicians agree a patient's condition warrants new equipment; the physician writes the prescription, the nurse places the order. |
| **DON** | Director of Nursing. Approves high-cost orders, reads reporting, owns care-vs-cost balance. |
| **HCPCS Level II "E" codes** | The CMS coding set for DME. 500+ codes. `E0250` hospital bed, `E1130` wheelchair, `E0601` CPAP (most-fulfilled DME code nationally). |
| **ANSI X12 837** | The general healthcare claims transaction standard. DME billing runs through it; there's no DME-specific one. |
| **NDC** | National Drug Code. The medication equivalent of an E-code in the eRx payloads. |
| **PPD** | Per Patient Day. How BetterRX charges hospices, and how the DME product would be priced (bundleable with the existing pharmacy tech PPD). |
| **PBM** | Pharmacy Benefit Manager. Some vendors bundle DME + PBM under one contract. |
| **DMEPOS** | Durable Medical Equipment, Prosthetics, Orthotics, and Supplies. The CMS public-use-file category name. |
| **POD** | Proof of Delivery. Signature, photo, timestamp captured at delivery. |
| **STAT** | Urgent order type. Same-day expectation. Contrast: `Admission`, `Routine`. |
| **Guardrails** | BetterRX's own product term: encoded operational rules letting hospice leaders express a "philosophy of care" so non-technical staff default to the right choice. |
| **Philosophy of care** | The hospice leadership's operating stance that guardrails encode. Sponsor's phrase, worth using back at them. |
| **Comfort kit** | The small set of medications a hospice nurse carries in her car. Roughly the entirety of hospice-held inventory — they hold essentially no equipment. |
| **StateServ / Dragonfly** | Named DME-adjacent platforms BetterRX positions against. |
| **Bonafide** | The DME/HME software platform WellSky acquired in 2024. |
| **Brightree** | The leading DME-vendor software platform; MatrixCare has a bi-directional interface with it. |
