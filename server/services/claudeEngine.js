/**
 * claudeEngine.js
 * ──────────────────────────────────────────────────────────
 * SwiftMatch AI — Anthropic Claude Integration Layer
 * Handles: RFQ Parsing · Explainability Narratives · WhatsApp Drafting ·
 *          BOM & Margin Estimation · B-BBEE Scorecard Points
 *
 * Model: claude-opus-5-5 (adaptive thinking is always on; depth is
 * controlled with output_config.effort). Server-side refusal fallbacks
 * are enabled so a policy decline re-runs on a fallback model inside
 * the same call. Every function has a deterministic fallback so the
 * demo never breaks if the API key is absent or the venue is offline.
 * ──────────────────────────────────────────────────────────
 */

const Anthropic = require('@anthropic-ai/sdk');

const MODEL = 'claude-opus-5-5';
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

let client = null;

function isConfigured() {
  return !!process.env.ANTHROPIC_API_KEY;
}

function getClient() {
  if (!client) {
    if (!isConfigured()) throw new Error('ANTHROPIC_API_KEY not set in environment.');
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

/** Pull the first text block out of a response (thinking blocks may precede it). */
function textOf(response) {
  const block = (response.content || []).find(b => b.type === 'text');
  return block ? block.text.trim() : '';
}

/**
 * Single call helper. Tries the beta endpoint with server-side fallbacks
 * first; if the API rejects that shape (older account/proxy), retries once
 * on the plain Messages endpoint without fallbacks.
 */
async function ask({ system, prompt, maxTokens = 2048, effort = 'low' }) {
  const c = getClient();
  const base = {
    model: MODEL,
    max_tokens: maxTokens,
    output_config: { effort },
    system,
    messages: [{ role: 'user', content: prompt }]
  };
  try {
    const res = await c.beta.messages.create({ ...base, betas: [FALLBACK_BETA], fallbacks: 'default' });
    if (res.stop_reason === 'refusal') throw new Error('Model declined the request.');
    return textOf(res);
  } catch (err) {
    if (err instanceof Anthropic.BadRequestError) {
      const res = await c.messages.create(base);
      if (res.stop_reason === 'refusal') throw new Error('Model declined the request.');
      return textOf(res);
    }
    throw err;
  }
}

function stripFences(text) {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}

// ─────────────────────────────────────────────────────────────
// 1. RFQ Parser — Extract structured procurement intent
// ─────────────────────────────────────────────────────────────
async function parseRFQ(rawText) {
  const system = 'You are a South African enterprise procurement specialist. You extract structured data from corporate RFQ text and reply with JSON only, no prose and no code fences.';
  const prompt = `RFQ TEXT:
"""${rawText}"""

Return a JSON object with exactly these keys:
{
  "category": "one of: Leathercraft & Corporate Gifts | Furniture & Timber Joinery | Eco-Packaging & Printing | Apparel & Industrial Workwear | Metal Fabrication & Welding | Art & Decor Ceramics | other",
  "requiredQuantity": <integer, or null if not stated>,
  "budgetZAR": <integer rand amount, or null if not stated>,
  "maxTurnaroundDays": <integer days, or null if not stated>,
  "targetLocation": "<city or suburb, province — or null>",
  "keywords": ["key", "product", "terms"],
  "complianceRequirements": [any of "cipcRegistered","taxPinCompliant","bbbeeLevel1","coidaRegistered","youthOwned" that the text explicitly requires],
  "summary": "<one plain-English sentence>"
}`;

  try {
    const text = await ask({ system, prompt, maxTokens: 1024, effort: 'low' });
    return JSON.parse(stripFences(text));
  } catch (err) {
    console.warn(`[ClaudeEngine] parseRFQ fallback: ${err.message}`);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// 2. Explainability Narrative — Transparent AI Audit Trail
// ─────────────────────────────────────────────────────────────
async function generateExplanation(rfq, topSme, radarScores, evidence = {}) {
  const system = 'You are the AI transparency officer for SwiftMatch AI, a South African SME-to-corporate matching platform. Explain ranking decisions in plain, professional language using only the numbers provided. Never invent facts about the supplier.';
  const prompt = `RFQ: ${rfq.summary || rfq.rawPrompt}
BUDGET: R${Number(rfq.budgetZAR || 0).toLocaleString()}
QUANTITY: ${rfq.requiredQuantity || 'n/a'} units
DEADLINE: ${rfq.maxTurnaroundDays || 'n/a'} days

RECOMMENDED SME: ${topSme.businessName} (${topSme.location})
SECTOR: ${topSme.category}
MONTHLY CAPACITY: ${topSme.monthlyCapacityUnits} units · AVG TURNAROUND: ${topSme.averageTurnaroundDays} days
VERIFIED ORDERS ON KASI-ECO: ${topSme.verifiedOrdersCount} · RATING: ${topSme.kasiEcoRating}/5
COMPLIANCE ON RECORD: CIPC=${!!topSme.compliance?.cipcRegistered}, TaxPIN=${!!topSme.compliance?.taxPinCompliant}, B-BBEE level=${topSme.compliance?.bbbeeLevel}, COIDA=${!!topSme.compliance?.coidaRegistered}

SCORES (weights: semantic 35%, capacity 25%, compliance 15%, geography 15%, reputation 10%):
- Semantic fit: ${radarScores.semantic ?? 0}% (embedding cosine ${evidence.semantic?.cosine ?? 'n/a'}, matched terms: ${(evidence.semantic?.matchedTerms || []).join(', ') || 'none'})
- Capacity: ${radarScores.capacity ?? 0}% (ratio ${evidence.capacity?.capacityRatio ?? 'n/a'}x)
- Compliance: ${radarScores.compliance ?? 0}%
- Geography: ${radarScores.geographic ?? 0}% (${evidence.geography?.distanceKm ?? 'n/a'} km from site)
- Reputation: ${radarScores.reputation ?? 0}%
- OVERALL: ${radarScores.overall ?? 0}%

Write three short paragraphs (max 60 words each), no headings:
1. Why this SME fits — craft relevance and capacity buffer.
2. Compliance and delivery readiness — what is verified and what still needs a document.
3. Responsible-AI note — what a human procurement officer must still verify before award, and one risk to watch.`;

  try {
    return await ask({ system, prompt, maxTokens: 1024, effort: 'medium' });
  } catch (err) {
    console.warn(`[ClaudeEngine] explanation fallback: ${err.message}`);
    const ratio = evidence.capacity?.capacityRatio ?? (topSme.monthlyCapacityUnits / (rfq.requiredQuantity || 1)).toFixed(2);
    return `${topSme.businessName} ranks first at ${radarScores.overall ?? 0}% overall. Semantic fit scored ${radarScores.semantic ?? 0}% against the requirement text, and the workshop's ${topSme.monthlyCapacityUnits} units/month gives a ${ratio}x buffer over the ${rfq.requiredQuantity} units requested.

Compliance on record: CIPC ${topSme.compliance?.cipcRegistered ? 'active' : 'missing'}, SARS Tax PIN ${topSme.compliance?.taxPinCompliant ? 'in good standing' : 'missing'}, B-BBEE level ${topSme.compliance?.bbbeeLevel}, COIDA ${topSme.compliance?.coidaRegistered ? 'on file' : 'not yet on file'}. Average turnaround is ${topSme.averageTurnaroundDays} days against a ${rfq.maxTurnaroundDays}-day deadline.

Responsible-AI note: this ranking is a shortlist, not an award. A procurement officer must still verify the supplier's documents at source, request a physical sample, and confirm pricing with the maker before issuing a purchase order.`;
  }
}

// ─────────────────────────────────────────────────────────────
// 3. WhatsApp Message Drafter — Plain-language, bilingual greeting
// ─────────────────────────────────────────────────────────────
function fallbackWhatsApp(sme, rfq) {
  return `🔔 *New corporate opportunity via SwiftMatch AI*

Sawubona ${sme.owner.split(' ')[0]}! A verified corporate buyer has shortlisted *${sme.businessName}* for a direct order.

📋 *What they need:* ${rfq.summary || rfq.rawPrompt}
📦 *Quantity:* ${rfq.requiredQuantity || 'see spec'} units
💰 *Budget:* R${Number(rfq.budgetZAR || 0).toLocaleString()}
⏱️ *Deadline:* ${rfq.maxTurnaroundDays || 'see spec'} days
📍 *Deliver to:* ${rfq.targetLocation || 'Gauteng'}

Reply:
1️⃣ Accept and request the purchase order
2️⃣ Ask a question about the spec
3️⃣ Decline (at capacity)

_Your details are only shared with the buyer once you accept._`;
}

async function draftWhatsAppMessage(sme, rfq) {
  const system = 'You write short, warm WhatsApp messages for South African township small-business owners. Plain English, one isiZulu greeting word, no corporate jargon, under 130 words, WhatsApp bold with *asterisks*, numbered reply options at the end.';
  const prompt = `ARTISAN FIRST NAME: ${sme.owner.split(' ')[0]}
BUSINESS: ${sme.businessName}
OPPORTUNITY: ${rfq.summary || rfq.rawPrompt}
QUANTITY: ${rfq.requiredQuantity || 'see spec'} units
BUDGET: R${Number(rfq.budgetZAR || 0).toLocaleString()}
DEADLINE: ${rfq.maxTurnaroundDays || 'see spec'} days
DELIVER TO: ${rfq.targetLocation || 'Gauteng'}

End with exactly three numbered options: 1 accept and request PO, 2 ask a question, 3 decline. Add one line saying their contact details are only shared with the buyer once they accept.`;

  try {
    return await ask({ system, prompt, maxTokens: 1024, effort: 'low' });
  } catch (err) {
    console.warn(`[ClaudeEngine] whatsapp fallback: ${err.message}`);
    return fallbackWhatsApp(sme, rfq);
  }
}

// ─────────────────────────────────────────────────────────────
// 4. Bill of Materials & Artisan Margin Protection (deterministic)
// ─────────────────────────────────────────────────────────────
async function estimateBillOfMaterials(rfq, sme) {
  const qty = Number(rfq.requiredQuantity) || 150;
  const budget = Number(rfq.budgetZAR) || 85000;
  const unitBudget = budget / qty;

  const rawMaterialsPct = 0.45;
  const laborPct = 0.35;
  const marginPct = 0.20;

  const estimatedRaw = Math.round(budget * rawMaterialsPct);
  const estimatedLabor = Math.round(budget * laborPct);
  const estimatedMargin = Math.round(budget * marginPct);
  const artisans = Math.max(1, Number(sme?.youthEmployed) || 3);

  return {
    success: true,
    method: 'Deterministic split (45% materials / 35% labour / 20% protected margin). Indicative only — the maker confirms real pricing.',
    rfqTitle: rfq.rawPrompt,
    quantity: qty,
    totalBudgetZAR: budget,
    unitBudgetZAR: Math.round(unitBudget),
    costBreakdown: {
      rawMaterialsZAR: estimatedRaw,
      artisanLaborZAR: estimatedLabor,
      netProfitMarginZAR: estimatedMargin,
      profitMarginPercentage: 20
    },
    lineItems: [
      { item: 'Grade-A raw stock & hardware', estimatedCost: Math.round(estimatedRaw * 0.7) },
      { item: 'Packaging, branding & finishing supplies', estimatedCost: Math.round(estimatedRaw * 0.3) },
      { item: `Workshop production wages (${artisans} artisans)`, estimatedCost: Math.round(estimatedLabor * 0.85) },
      { item: 'Quality vetting & ground courier', estimatedCost: Math.round(estimatedLabor * 0.15) }
    ],
    marginProtectionNote: 'Artisan net margin protected at 20% to prevent unviable underbidding.',
    recommendedPaymentSchedule: '30% deposit on sample sign-off, 70% on delivery confirmation.'
  };
}

// ─────────────────────────────────────────────────────────────
// 5. B-BBEE Scorecard Points (indicative, deterministic)
// ─────────────────────────────────────────────────────────────
function calculateBbbeePoints(budgetZAR, sme) {
  const budget = Number(budgetZAR) || 85000;
  // Amended Codes of Good Practice: spend with a Level 1 EME is recognised at 135%.
  const multiplier = 1.35;
  const recognizedSpend = Math.round(budget * multiplier);
  const preferentialProcurementContribution = Math.min(2.5, +(budget / 50000).toFixed(2));
  const esdPointsEarned = +(Math.min(5.0, preferentialProcurementContribution * 1.6)).toFixed(1);

  return {
    actualSpendZAR: budget,
    recognizedSpendZAR: recognizedSpend,
    procurementRecognitionMultiplier: '135% (Level 1 EME)',
    bbbeeLevel: sme?.compliance?.bbbeeLevel || 1,
    youthOwned: sme?.youthOwned !== false,
    scorecardImpact: {
      element400Points: preferentialProcurementContribution,
      element500EsdPoints: esdPointsEarned,
      totalScorecardBoost: +(preferentialProcurementContribution + esdPointsEarned).toFixed(1)
    },
    disclaimer: 'Indicative only. Actual scorecard points depend on the measured entity\'s total procurement spend and a verification agency\'s assessment.',
    executiveSummary: `Procuring R${budget.toLocaleString()} from ${sme?.businessName || 'this Level 1 EME'} is recognised as R${recognizedSpend.toLocaleString()} of preferential procurement spend, worth approximately +${(preferentialProcurementContribution + esdPointsEarned).toFixed(1)} scorecard points.`
  };
}

module.exports = {
  MODEL,
  isConfigured,
  parseRFQ,
  generateExplanation,
  draftWhatsAppMessage,
  estimateBillOfMaterials,
  calculateBbbeePoints
};
