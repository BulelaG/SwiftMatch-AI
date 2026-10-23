/**
 * claudeEngine.js
 * ──────────────────────────────────────────────────────────
 * SwiftMatch AI — Anthropic Claude Integration Layer
 * Handles: RFQ Parsing · Explainability Narratives · WhatsApp Drafting
 * ──────────────────────────────────────────────────────────
 */

const Anthropic = require('@anthropic-ai/sdk');

// Lazily initialise client so server boots without API key in dev
let client = null;

function getClient() {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not set in environment. Add it to your .env file.');
    }
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

// ─────────────────────────────────────────────────────────────
// 1. RFQ Parser — Extract structured procurement intent from
//    raw natural-language corporate text
// ─────────────────────────────────────────────────────────────
async function parseRFQ(rawText) {
  const prompt = `You are a South African enterprise procurement specialist. Extract structured data from this corporate RFQ request.

RFQ TEXT:
"${rawText}"

Return ONLY a valid JSON object with these exact keys (no markdown, no extra text):
{
  "category": "one of: leathercraft | furniture | textiles | packaging | metalwork | ceramics | printing | catering | other",
  "requiredQuantity": <integer>,
  "budgetZAR": <integer>,
  "maxTurnaroundDays": <integer>,
  "targetLocation": "<city, province>",
  "keywords": ["array", "of", "key", "product", "terms"],
  "complianceRequirements": ["cipcRegistered", "taxPinCompliant"],
  "youthOwned": <true|false>,
  "summary": "<one sentence plain-English summary of the requirement>"
}

If a value cannot be inferred, use sensible South African B2B defaults (quantity: 100, budget: 75000, turnaround: 21 days, location: "Sandton, Gauteng").`;

  try {
    const response = await getClient().messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].text.trim();
    // Strip any accidental markdown code fences
    const clean = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim();
    return JSON.parse(clean);
  } catch (err) {
    console.error('[ClaudeEngine] parseRFQ error:', err.message);
    // Graceful fallback — return null so caller can use deterministic matching
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// 2. Explainability Narrative — Generate a clear, judge-friendly
//    AI audit trail for a specific match result
// ─────────────────────────────────────────────────────────────
async function generateExplanation(rfq, topSme, radarScores) {
  const prompt = `You are an AI transparency officer for SwiftMatch AI, a South African SME-Corporate matching platform.

Explain why this township SME was recommended for this corporate RFQ in plain, professional language. 
Be specific, use numbers from the scores, and make the reasoning transparent and trustworthy.

RFQ SUMMARY: ${rfq.summary || rfq.rawPrompt}
BUDGET: R${(rfq.budgetZAR || 85000).toLocaleString()}
QUANTITY: ${rfq.requiredQuantity || 100} units

RECOMMENDED SME: ${topSme.businessName} (${topSme.location})
OWNER: ${topSme.owner}
SECTOR: ${topSme.sector}

MATCH SCORES:
- Semantic Alignment: ${radarScores.semantic || 0}% (product/service category fit)
- Capacity Score: ${radarScores.capacity || 0}% (can they fulfill this volume?)
- Compliance Score: ${radarScores.compliance || 0}% (CIPC, Tax Pin, regulatory readiness)
- Geographic Score: ${radarScores.geographic || 0}% (proximity to delivery site)
- Reputation Score: ${radarScores.reputation || 0}% (track record, verified ratings)
- OVERALL MATCH: ${radarScores.overall || 0}%

Write 3 short paragraphs (max 60 words each):
1. WHY THIS SME FITS — specific product/service alignment
2. CAPACITY & COMPLIANCE READINESS — can they deliver safely?
3. RESPONSIBLE AI NOTE — what gaps exist, what should the buyer verify?

Respond in plain text only. No markdown headers. No bullet points.`;

  try {
    const response = await getClient().messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }]
    });
    return response.content[0].text.trim();
  } catch (err) {
    console.error('[ClaudeEngine] generateExplanation error:', err.message);
    return `${topSme.businessName} achieved a ${radarScores.overall || 0}% overall match score against this RFQ based on semantic product alignment, verified capacity, compliance status, geographic proximity, and reputation. The deterministic multi-factor algorithm weighted semantic alignment at 35%, capacity at 25%, compliance at 15%, geography at 15%, and reputation at 10%. Buyers should independently verify CIPC registration, current tax clearance, and COIDA status before issuing a Purchase Order.`;
  }
}

// ─────────────────────────────────────────────────────────────
// 3. WhatsApp Message Drafter — Tone-adaptive, isiZulu/English
//    bilingual message for township artisan outreach
// ─────────────────────────────────────────────────────────────
async function draftWhatsAppMessage(sme, rfq) {
  const prompt = `You are drafting a WhatsApp notification for a township small business owner in South Africa.
Write a warm, respectful, professional message in English with a small Zulu greeting phrase.
Keep it SHORT — max 180 words total. Use simple language. Use WhatsApp formatting (*bold*).

ARTISAN NAME: ${sme.owner}
BUSINESS: ${sme.businessName}
LOCATION: ${sme.location}

CORPORATE OPPORTUNITY:
- Requirement: ${rfq.rawPrompt || rfq.summary}
- Budget: R${(rfq.budgetZAR || 85000).toLocaleString()}
- Quantity: ${rfq.requiredQuantity || 100} units
- Deadline: ${rfq.maxTurnaroundDays || 21} days from order

Include:
1. Greeting with Zulu phrase (sawubona / sanibonani)
2. Exciting announcement that they've been shortlisted by a corporate buyer
3. The key opportunity details (brief)
4. Clear call to action: reply YES to accept, NO to decline
5. SwiftMatch AI signature

Return only the WhatsApp message text. No extra commentary.`;

  try {
    const response = await getClient().messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }]
    });
    return response.content[0].text.trim();
  } catch (err) {
    console.error('[ClaudeEngine] draftWhatsAppMessage error:', err.message);
    // Return the static fallback message
    return `🔔 *NEW CORPORATE OPPORTUNITY via SwiftMatch AI!*

Sawubona ${sme.owner}! A corporate buyer has shortlisted *${sme.businessName}* for a procurement order.

📋 *Requirement:* ${rfq.rawPrompt || 'Corporate Procurement Order'}
💰 *Budget:* R${(rfq.budgetZAR || 85000).toLocaleString()}
⏱️ *Turnaround:* ${rfq.maxTurnaroundDays || 21} days

Reply:
✅ *YES* — I'm interested, send Purchase Order details
❌ *NO* — Decline this opportunity

_SwiftMatch AI | Powered by Kasi-eCo_`;
  }
}

module.exports = { parseRFQ, generateExplanation, draftWhatsAppMessage };
