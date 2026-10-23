# ⚡ SwiftMatch AI — Enterprise Demand & Township SME Matching Engine

> **YES AI Hackathon 2026** • **Challenge 4: ESD Tech Enablement**  
> *Developed on-site at WeWork Sandton, Johannesburg (23–24 October 2026)*  
> *Track: Enterprise Supplier Development (ESD) & Youth Economic Inclusion*

---

## 📌 Executive Summary

South Africa's Top 100 Corporates spend over **R40 Billion annually** on Enterprise & Supplier Development (ESD) and preferential procurement under the B-BBEE Codes of Good Practice. Yet, procurement managers struggle with a 6-week administrative bottleneck to discover, verify, and match compliant township makers. Simultaneously, over **60% of youth-owned township artisans** operate solely through WhatsApp without visibility on corporate ERPs like SAP Ariba or Coupa.

**SwiftMatch AI** bridges this chasm with an **Investor-Grade 3-Screen Platform**:
1. **Screen 1 — Corporate Sourcing Request:** Natural-language RFQ ingestion parsed with **Anthropic Claude 3.5 Sonnet** + one-click demo presets.
2. **Screen 2 — Matching Results & Explainability:** Multi-factor deterministic ranking (5 scoring factors) + reason-first cards + **B-BBEE Scorecard Impact Panel** (+4.4 points boost, 135% recognition) + **Workshop Economics / BOM Estimator** (with 20% protected margin floor).
3. **Screen 3 — Maker Mobile Hub (390px):** Mobile-first WhatsApp order dispatch + instant Accept/Decline PO workflow + **Supplier Readiness Gap Advisor** (actionable roadmap to close compliance gaps and 3x contract size).
4. **Supply-Side Backbone:** Deep-linked to the verified grassroots marketplace catalog on [Kasi-eCo](http://localhost:4200).

---

## 💎 Investor-Grade Feature Architecture

### 1. B-BBEE Scorecard Optimization Engine (`calculateBbbeePoints`)
- **Preferential Procurement (Element 400):** Calculates recognized spend under the amended dti Codes (Level 1 EME = 135% recognition factor). A R85,000 spend translates to R114,750 in recognized procurement.
- **Enterprise & Supplier Development (Element 500):** Computes direct scorecard point contributions (+1.7 Element 400, +2.7 Element 500 ESD bonus = +4.4 points boost).
- **Executive Summary:** Generates compliance-ready audit text for corporate ESD reporting committees.

### 2. Workshop Economics & BOM Estimator (`estimateBillOfMaterials`)
- **Automated Cost Breakdown:** Dynamic model allocating 45% Raw Materials, 35% Artisan Labor, and 20% Net Profit Margin.
- **Margin Protection Guardrail:** Enforces a 20% profit floor to prevent township SMMEs from unsustainable underbidding.
- **Milestone Payment Architecture:** Recommends standard 30% upfront deposit upon sample sign-off and 70% upon delivery confirmation.

### 3. Supplier Readiness Gap Advisor
- **Diagnostic Audit:** Categorizes supplier compliance into *Good Standing* (CIPC, SARS Tax PIN), *Immediate Gaps* (COIDA Letter of Good Standing, business banking), and *Growth Accreditations* (ISO 9001).
- **Direct Redirection:** Provides links to registration portals (e.g. DoEL compensation fund) to systematically advance SMMEs up the corporate procurement ladder.

### 4. Linear & Stripe-Inspired Enterprise Visual System
- **Canvas:** `#F8F9F8` (neutral light canvas)
- **Surface:** `#FFFFFF` (crisp surface cards)
- **Ink:** `#171C1A` (high-contrast typography)
- **Muted:** `#6C746F` (accessible secondary meta)
- **Accent:** `#16745B` (emerald ESD credibility tone)
- **Typography:** Inter (interface UI) + Poppins (authoritative headings)

---

## 📋 Hackathon Rule 1.2 Compliance Disclosure

Per Hackathon Rules Section 1.2 on pre-existing work and third-party tools:

### 1. Pre-Existing Work (Prior to Hackathon)
- **Kasi-eCo Marketplace Baseline:** The grassroots e-commerce platform codebase (Angular 16 frontend template and theme foundations) developed under the Swift House initiative.
- **Initial Artisan Data Schema:** High-level entity structure of township artisans and craft categories.

### 2. Developed During the Hackathon (On-Site at WeWork Sandton)
- **SwiftMatch AI Matching Engine (`matchingEngine.js`):** Custom 5-factor weighted deterministic scoring algorithm with Haversine distance calculations and capacity ratio curves.
- **Anthropic Claude Integration (`claudeEngine.js`):**
  - Prompt extraction pipeline for unstructured corporate procurement RFQs (`/api/claude/parse-rfq`).
  - Explainable AI (XAI) natural language audit trail generation (`/api/claude/explain`).
  - Tone-adaptive, bilingual artisan WhatsApp message composer (`/api/claude/whatsapp`).
- **Dark Obsidian "Afro-Enterprise Dark Glass" UI:** Complete corporate executive command bar, live candidate card ranking, real-time conic gradient score meters, XAI audit drawer, and simulated smartphone WhatsApp dispatch viewer.
- **YES Ecosystem Impact Macro Dashboard:** Visualizing aggregate procurement volumes, youth jobs sustained, sector demand percentages, and systemic township capability gaps.
- **Standalone Express Backend Server (`server.js`):** Port 5050 REST API orchestrating the matching, Claude AI, and ecosystem telemetry.

### 3. Third-Party AI Models, APIs & Libraries
- **Anthropic Claude 3.5 Sonnet (`@anthropic-ai/sdk`)**: LLM for structured RFQ parsing, transparency audit narratives, and tone-adaptive WhatsApp composition.
- **Antigravity (Google DeepMind)**: AI pair-programming assistant used during development.
- **Bootstrap 5 & Bootstrap Icons**: Frontend grid layout, responsive typography, and iconography.
- **Plus Jakarta Sans**: Typography via Google Fonts.
- **Node.js & Express**: Backend runtime and REST API framework.
- **Angular 16**: Reactive frontend client.

---

## 🏗️ Architecture Overview

```mermaid
flowchart TD
    subgraph Corporate ["Corporate Procurement (Sandton)"]
        A["Natural Language RFQ / Requirement"]
    end

    subgraph SwiftMatch ["SwiftMatch AI Platform (Port 4300 / 5050)"]
        B["Executive Command Bar"] --> C["Claude 3.5 Sonnet Parser"]
        C --> D["Multi-Factor Matching Engine"]
        D -->|Semantic 35%| E["Candidate Ranking Matrix"]
        D -->|Capacity 25%| E
        D -->|Compliance 15%| E
        D -->|Geo 15%| E
        D -->|Reputation 10%| E
        E --> F["Explainable AI (XAI) Audit Drawer"]
        F --> G["Claude Sonnet Audit Narrative"]
    end

    subgraph Dispatch ["Artisan Engagement"]
        F --> H["WhatsApp Bot Dispatch (isiZulu / English)"]
        H --> I["Township Artisan Mobile Phone"]
    end

    subgraph Grassroots ["Supply Engine: Kasi-eCo"]
        E -. Deep Link .-> J["Live Kasi-eCo Artisan Profile & Catalog"]
    end
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- npm (v9+)
- Angular CLI 16 (`npm install -g @angular/cli@16`)

### 1. Clone & Setup Backend
```bash
cd c:\projects\SwiftMatch-AI\server
npm install
```

Configure your environment variables in `c:\projects\SwiftMatch-AI\server\.env`:
```env
PORT=5050
ANTHROPIC_API_KEY=sk-ant-api03-... # Your Anthropic API Key (optional — graceful fallback included)
```

Start the backend:
```bash
node server.js
# Listening on http://localhost:5050
```

### 2. Setup Frontend Client
```bash
cd c:\projects\SwiftMatch-AI\client
npm start -- --port 4300
# Available at http://localhost:4300
```

---

## 🎯 Verification Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/health` | GET | System health & engine status check |
| `/api/smes` | GET | List verified township SME supplier network |
| `/api/rfqs` | GET | Pre-configured corporate RFQ test cases |
| `/api/match` | POST | Execute multi-factor weighted matching matrix |
| `/api/claude/parse-rfq` | POST | Claude-powered structured RFQ extractor |
| `/api/claude/explain` | POST | Claude-powered XAI audit narrative generator |
| `/api/claude/whatsapp` | POST | Claude-powered bilingual WhatsApp composer |
| `/api/ecosystem/metrics` | GET | YES macroeconomic impact & gap telemetry |

---

## 👥 Authors & Team
- **Bulela Gomoshe** — Lead Architecture & Fullstack Engineering (`Swift House` / `Kasi-eCo`)
- Built for the **YES AI Hackathon 2026**, Johannesburg, South Africa.
