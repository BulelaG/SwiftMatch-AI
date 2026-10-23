# SwiftMatch AI — Top-15 Live Pitch (5 min + 2 min Q&A, max 3 slides)

Rule from the organisers: do not repeat the video. Use the slot for a live demo, roadmap, commercial potential and Q&A. Three slides, then the live app. Build these in Canva or PowerPoint; the copy below is final.

---

## Slide 1 — Problem & beneficiary

**Title:** The R26-billion match that never happens

- Corporates must spend on youth-owned and black-owned suppliers (B-BBEE Codes 400/500), and most struggle to find credible ones.
- Vendor databases match keywords. "Hardwood reception counter" never finds "solid oak joinery".
- Township makers run on WhatsApp, not procurement portals. They are invisible to the buyer and never learn why they lost.
- **Beneficiaries:** procurement and ESD officers (speed, defensibility) and youth-owned SMEs (discovery, feedback, readiness).

Footer: Swift House · built on Kasi-eCo, our live township marketplace

---

## Slide 2 — Solution & AI architecture

**Title:** Explainable matching, from RFQ to WhatsApp

Three-screen flow diagram (left to right):

1. **Corporate request** → Claude extracts quantity, budget, deadline, site, mandatory checks.
2. **Matching engine** → on-device sentence embeddings (MiniLM, 384-d) + lexical overlap → deterministic weighted score: 35% semantic · 25% capacity · 15% compliance · 15% distance · 10% track record. Hard filter marks suppliers *ineligible with the reason*, never hidden.
3. **Maker phone** → plain-language WhatsApp dispatch drafted by Claude; accept / ask / decline; contact revealed only on accept.

Side panel: *Measured on 12 held-out RFQs: semantic engine Top-1 100%, keyword baseline 58%. Reproducible with `npm run eval`.*

Stack line: Angular 16 · Node/Express · MongoDB-ready · @xenova/transformers (ONNX) · Claude Opus 5.5

---

## Slide 3 — Roadmap & business potential

**Title:** From prototype to paid pilot in 6 months

| Month | Milestone |
|---|---|
| 1–2 | Onboard 50 verified Kasi-eCo makers; CIPC + SARS status API verification |
| 3 | First YES corporate partner posts live RFQs; funding-eligibility matcher (NEF, SEFA, ESD funds) |
| 4–5 | Track R500k+ of purchase orders through the WhatsApp loop; structured buyer feedback + SME response |
| 6 | Convert pilot to annual enterprise licence |

**Revenue:** corporate SaaS R60k–R180k/yr · ESD sponsorship packages for onboarding cohorts · 1.5% success fee on settled POs. SMEs pay nothing.

**Ask:** YES AI Hub incubation: cloud hosting, two sponsored engineers for the verification integrations and field onboarding.

---

## Live demo order (3 minutes of the 5)

1. Paste the held-out carpenter RFQ, extract with Claude, search.
2. Point to the engine chip and the "How the % was computed" table.
3. Show the ineligible row and its reason.
4. Maker phone: WhatsApp preview, accept, contact revealed.
5. Open the model card for 10 seconds.

## Q&A cheat sheet

- **"Isn't this a directory?"** A directory waits for the right keyword. This ingests an unstructured need, embeds it, checks capacity, compliance and distance, explains the rank, and dispatches to the maker's phone.
- **"Why not just ask an LLM to pick?"** Ranking is deterministic and auditable; the LLM only handles language. Same input, same rank, every time. That's what a B-BBEE verifier needs.
- **"Bias?"** Fixed published weights, no demographic inputs, reputation capped at 10% so newcomers aren't locked out, ineligible suppliers see exactly what to fix.
- **"Data?"** Synthetic profiles for the hackathon; production data comes from Kasi-eCo onboarding with consent, and compliance from CIPC/SARS APIs.
- **"What's hard about scaling?"** Verification integrations and field onboarding, which is exactly what the two sponsored engineers would do.
- **"Who pays?"** The corporate, from an ESD budget they are already obliged to spend.
