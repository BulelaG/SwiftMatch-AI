# ⚡ SwiftMatch AI — Explainable SME ↔ Corporate Opportunity Matching

> **YES AI Hackathon 2026 · Challenge 4: YES SME–Corporate Opportunity Matching Platform**
> Built on-site at WeWork Sandton, 23–24 October 2026, by **Swift House** on top of our live township marketplace, [Kasi-eCo](https://github.com/BulelaG/Kasi-eCo).

---

## What it does

A corporate buyer describes a need in plain English. SwiftMatch AI extracts the requirement, scores every verified youth-owned SME against it with **on-device sentence embeddings plus a deterministic, published weighting**, explains every score, flags ineligible suppliers *with the reason*, and dispatches the opportunity to the maker's phone as a plain-language WhatsApp message. The maker accepts or declines; only on accept does the buyer receive their contact details.

Three screens:

1. **Corporate Sourcing Request** — natural-language RFQ, Claude field extraction, buyer-selected mandatory checks (CIPC, SARS Tax PIN, youth ownership, COIDA).
2. **Matching Results & Explainability** — ranked shortlist, "how the % was computed" table with raw evidence (cosine, capacity ratio, km, checks passed), eligibility flags, Claude audit narrative, B-BBEE recognised-spend and bill-of-materials panels, and a Responsible AI model card.
3. **Maker Mobile Hub (390px)** — WhatsApp dispatch preview, accept / decline, "why you were matched", document readiness and a gap advisor that tells the SME what to fix to win bigger contracts.

---

## How the matching works

```
MatchScore = 0.35·Semantic + 0.25·Capacity + 0.15·Compliance + 0.15·Geography + 0.10·Reputation
```

| Factor | How it is computed | Evidence surfaced to the buyer |
|---|---|---|
| Semantic fit | `all-MiniLM-L6-v2` sentence embeddings (384-d, quantized ONNX, runs **on the server, no external API**) → cosine similarity, calibrated to 0–1, blended 70/30 with lexical tag overlap | cosine value, matched terms |
| Capacity | monthly units ÷ required units, ×0.75 if average turnaround exceeds the deadline | capacity ratio, margin in days |
| Compliance | share of the **buyer-selected** mandatory checks passed. Any failure also marks the SME **ineligible** (hard filter): still shown, ranked below all eligible suppliers, with the missing document named | checks passed / total |
| Geography | Haversine distance from the delivery site, resolved from free text with a South African gazetteer | km, resolved site name |
| Reputation | Kasi-eCo rating (70%) + log-scaled verified order count (30%), capped at 10% weight so newcomers are not locked out | rating, orders |

Owner **age, gender and name are never scoring inputs**. Weights are fixed and identical for every supplier. If the embedding model cannot load, the engine falls back to lexical scoring and says so in the UI.

### Evaluation (reproducible)

```bash
cd server && npm run eval
```

12 RFQs (3 demo presets + 9 held-out paraphrases written to share **no vocabulary** with the SME tags, e.g. "hardwood reception counters" → "solid oak joinery", "reflective safety vests" → "hi-vis workwear"). Results from `eval/results.json`:

| Engine | Top-1 accuracy | MRR |
|---|---|---|
| Hybrid embedding (this build) | **100%** (12/12) | **1.00** |
| Lexical keyword baseline | 58% (7/12) | 0.77 |

The dataset is small and synthetic; this measures retrieval quality on paraphrase, not real award outcomes. See *Limitations*.

---

## Where AI is used, and where a person decides

| Step | Technology | Human review |
|---|---|---|
| Extract quantity, budget, deadline, site, checks from RFQ text | Claude (`claude-opus-5-5`, low effort) with a rule-based offline fallback | Buyer sees and can edit every field before searching |
| Rank suppliers | Deterministic engine above (no LLM) | Buyer chooses from the shortlist; nothing is awarded automatically |
| Audit narrative | Claude, grounded only in the computed scores and the SME's on-record fields | Labelled as AI-generated; "review before use" |
| WhatsApp dispatch | Claude drafts plain-language, bilingual-greeting message | Maker accepts, asks, or declines |

Claude calls use `@anthropic-ai/sdk` with server-side refusal fallbacks enabled; if the beta shape is rejected the call retries on the standard endpoint, and if no key is configured every function returns a deterministic template so the demo never breaks.

---

## Responsible AI, data and POPIA

The full model card is served at `GET /api/model-card` and rendered in the app. Summary:

- **Data:** 6 synthetic SME profiles modelled on real Kasi-eCo categories; 3 synthetic RFQs; ecosystem metrics are labelled *illustrative projection*. No real personal data is processed.
- **Privacy:** phone numbers and emails are stripped from all corporate-facing responses and masked (`072 *** 2233`) until the maker accepts. Embeddings run on-device; SME text is never sent to a third-party embedding API. Only RFQ text and business (not personal) fields go to Claude, and only when a key is configured.
- **Fairness:** no demographic inputs; published fixed weights; reputation capped; ineligible suppliers are told exactly what is missing (right of response) rather than silently excluded.
- **Limitations:** tiny synthetic dataset; embedding similarity measures text relatedness, not product quality; compliance flags are self-declared seed data (production would verify against CIPC/SARS); the gazetteer covers major SA cities only and flags unresolved sites; B-BBEE points are indicative.

---

## Hackathon Rule 1.2 disclosure

**Existed before the event:** the Kasi-eCo marketplace (Angular 16 + Node/Express + MongoDB), its design tokens, and the artisan category taxonomy. The Angular project scaffold here was copied from that codebase.

**Built during the hackathon (23–24 Oct):** everything in `server/` (matching engine, embedding engine, Claude layer, model card, eval harness, API), the three-screen SwiftMatch UI in `client/src/app/home`, the enterprise header/theme, and all documentation in `docs/`.

**AI tools used:** Anthropic Claude Code and Google Antigravity as pair-programming assistants for scaffolding, code review and documentation; Claude Opus 5.5 inside the product for the three language tasks above. Architecture, scoring design, weights, test set and integration are the team's own work.

**Third-party models, libraries, data:** `Xenova/all-MiniLM-L6-v2` (Apache-2.0) via `@xenova/transformers` 2.17; `@anthropic-ai/sdk` 1.1; Express 4; Angular 16; Bootstrap 5 + Bootstrap Icons; Google Fonts (Inter, Poppins); Unsplash images (Unsplash licence). SME and RFQ records are synthetic and written by the team.

---

## Run it

Prerequisites: Node.js 20+ (built on 22), npm 9+, Angular CLI 16.

```bash
# 1. Backend (first run downloads the 23 MB embedding model into server/.model-cache)
cd server
npm install
echo PORT=5050 > .env
echo ANTHROPIC_API_KEY=sk-ant-...  >> .env   # optional; omit for deterministic fallbacks
node server.js                                 # http://localhost:5050

# 2. Frontend
cd ../client
npm install
npm start -- --port 4300                       # http://localhost:4300

# 3. Reproduce the evaluation
cd ../server && npm run eval
```

### Frontend checks

```bash
cd client
npm run build                                   # production build
CHROME_BIN="C:/Program Files/Google/Chrome/Application/chrome.exe" npx ng test --watch=false --browsers=ChromeHeadless
```

The client is a single Angular feature (`home/`) with three screens and three colour themes selectable in the header: Dark (obsidian), Light, and Uber (the Uber Base palette: black primary, white canvas, safety-blue links and focus, green positive states, red errors). Themes are pure CSS token sets on `html[data-theme]`; all component colours derive from those tokens. Shell and screens use semantic landmarks, a skip link, keyboard-operable stepper, tabs and candidate list, `aria-current` / `aria-pressed` / `aria-selected` state, visible focus rings, reduced-motion support, and explicit loading, error and empty states for the shortlist. Verified at 390, 768 and 1280 px with no horizontal overflow; screenshots are in `docs/screens/`.

### API

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/health` | GET | Engine status: embedding model ready, Claude configured, weights |
| `/api/model-card` | GET | Responsible AI disclosure |
| `/api/smes` | GET | SME profiles (contact fields masked) |
| `/api/rfqs` | GET | Demo RFQ presets |
| `/api/match` | POST | `{ rfqText, requiredQuantity, budgetZAR, maxTurnaroundDays, targetLocation, complianceRequirements[] }` → ranked, explained, eligibility-flagged matches |
| `/api/claude/parse-rfq` | POST | Structured extraction (Claude, rule-based fallback) |
| `/api/claude/explain` | POST | Audit narrative grounded in the scores |
| `/api/claude/whatsapp` | POST | Plain-language dispatch draft |
| `/api/bbbee/score` | POST | Indicative B-BBEE recognised spend and points |
| `/api/bom` | POST | Indicative bill of materials with 20% margin floor |
| `/api/ecosystem/metrics` | GET | Illustrative ecosystem projection |

---

## Project layout

```
server/
  server.js                 Express API
  services/embeddingEngine.js   on-device MiniLM embeddings, SME vector index
  services/matchingEngine.js    5-factor scoring, hard-filter eligibility, gazetteer
  services/claudeEngine.js      Claude Opus 5.5 integration with fallbacks
  data/smes.json · rfqs.json · model-card.json
  eval/testset.json · run-eval.js · results.json
client/src/app/
  app.component.*           shell: header, skip link, theme, engine status, footer
  home/                     the three SwiftMatch screens (template, component, styles, spec)
  services/match.service.ts
docs/
  VIDEO_SCRIPT.md · PITCH_SLIDES.md
```

---

## Team

**Bulela Gomoshe** — founder, Swift House; architecture and full-stack engineering. Swift House is a CIPC-registered youth-owned company; Kasi-eCo is its flagship product.
