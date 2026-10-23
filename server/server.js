const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { rankSmes, resolveLocation, WEIGHTS } = require('./services/matchingEngine');
const embeddingEngine = require('./services/embeddingEngine');
const claude = require('./services/claudeEngine');
const modelCard = require('./data/model-card.json');

const app = express();
const PORT = process.env.PORT || 5050;

app.use(cors());
app.use(express.json());

// ── Load in-memory seed data ──
const smesPath = path.join(__dirname, 'data', 'smes.json');
const rfqsPath = path.join(__dirname, 'data', 'rfqs.json');

let smes = [];
let rfqs = [];

try {
  smes = JSON.parse(fs.readFileSync(smesPath, 'utf8'));
  rfqs = JSON.parse(fs.readFileSync(rfqsPath, 'utf8'));
  console.log(`[SwiftMatch AI] Loaded ${smes.length} SME profiles and ${rfqs.length} preset RFQs.`);
} catch (e) {
  console.error('[SwiftMatch AI] Error reading seed data:', e);
}

// Warm the on-device embedding model and index SME vectors at boot.
embeddingEngine.indexSmes(smes).catch(err => console.warn('[SwiftMatch AI] Embedding index skipped:', err.message));

function publicSme(sme) {
  const { _vector, cell, email, ...rest } = sme;
  return { ...rest, cellMasked: cell ? `${cell.slice(0, 3)} *** ${cell.slice(-4)}` : null };
}

function buildRfq(body) {
  const site = resolveLocation(body.targetLocation || '');
  const complianceRequirements = Array.isArray(body.complianceRequirements) && body.complianceRequirements.length
    ? body.complianceRequirements
    : ['cipcRegistered', 'taxPinCompliant'];
  return {
    rawPrompt: body.rfqText || body.rawPrompt || 'Corporate procurement requirement',
    category: body.category || null,
    requiredQuantity: Number(body.requiredQuantity) || 100,
    budgetZAR: Number(body.budgetZAR) || 75000,
    maxTurnaroundDays: Number(body.maxTurnaroundDays) || 21,
    targetLocation: body.targetLocation || 'Sandton, Gauteng',
    resolvedSite: site,
    targetCoordinates: { lat: site.lat, lng: site.lng },
    complianceRequirements
  };
}

// ── GET: Health & engine status ──
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '1.1.0',
    service: 'SwiftMatch AI Core Engine',
    embedding: embeddingEngine.getStatus(),
    claude: { configured: claude.isConfigured(), model: claude.MODEL },
    smeProfiles: smes.length,
    weights: WEIGHTS
  });
});

// ── GET: SME profiles (POPIA-masked) ──
app.get('/api/smes', (req, res) => {
  res.json(smes.map(publicSme));
});

// ── GET: Preset RFQs ──
app.get('/api/rfqs', (req, res) => {
  res.json(rfqs);
});

// ── GET: Model card / Responsible AI disclosure ──
app.get('/api/model-card', (req, res) => {
  res.json({ ...modelCard, embedding: embeddingEngine.getStatus(), llm: { model: claude.MODEL, configured: claude.isConfigured() }, weights: WEIGHTS });
});

// ── POST: Run matching engine ──
app.post('/api/match', async (req, res) => {
  const rfq = buildRfq(req.body || {});
  try {
    const { matches, engine, eligibleCount } = await rankSmes(rfq, smes);
    res.json({
      rfq,
      engine: {
        semantic: engine,
        model: engine === 'hybrid-embedding' ? embeddingEngine.MODEL_ID : 'lexical tag overlap',
        dimensions: engine === 'hybrid-embedding' ? embeddingEngine.DIMENSIONS : null,
        weights: WEIGHTS
      },
      totalEvaluated: smes.length,
      eligibleCount,
      matches
    });
  } catch (err) {
    console.error('[SwiftMatch AI] match error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST: Claude — parse RFQ from natural language ──
app.post('/api/claude/parse-rfq', async (req, res) => {
  const { rawText } = req.body || {};
  if (!rawText) return res.status(400).json({ error: 'rawText is required' });

  const structured = await claude.parseRFQ(rawText);
  if (structured) return res.json({ success: true, source: 'claude', structured });

  // Rule-based fallback so the UI still fills the form offline.
  const text = rawText.toLowerCase();
  // Quantity: first integer that is not a rand amount, a duration or a percentage.
  const qtyMatches = [...text.matchAll(/(?<![r\d,.])(\d{1,3}(?:,\d{3})+|\d+)\s+(?!days?|weeks?|calendar|%|k)([a-z]+)/g)];
  const qty = qtyMatches.length ? qtyMatches[0] : null;
  const budget = text.match(/r\s?(\d{1,3}(?:[ ,]\d{3})+|\d+)(?:k)?/);
  const days = text.match(/(\d+)\s*(?:calendar\s*)?days?/) || (text.match(/(\d+)\s*weeks?/) ? [null, String(Number(text.match(/(\d+)\s*weeks?/)[1]) * 7)] : null);
  const site = resolveLocation(rawText);
  res.json({
    success: true,
    source: 'rules',
    structured: {
      requiredQuantity: qty ? Number(qty[1].replace(/[ ,]/g, '')) : null,
      budgetZAR: budget ? Number(budget[1].replace(/[ ,]/g, '')) * (/\dk\b/.test(budget[0]) ? 1000 : 1) : null,
      maxTurnaroundDays: days ? Number(days[1]) : null,
      targetLocation: site.resolved ? site.name : null,
      complianceRequirements: [
        ...(/youth/.test(text) ? ['youthOwned'] : []),
        ...(/level\s*1|b-?bbee/.test(text) ? ['bbbeeLevel1'] : []),
        ...(/coida/.test(text) ? ['coidaRegistered'] : [])
      ],
      summary: rawText.slice(0, 140)
    }
  });
});

// ── POST: Claude — XAI narrative for a match ──
app.post('/api/claude/explain', async (req, res) => {
  const { rfq, smeId, radarScores, evidence } = req.body || {};
  if (!rfq || !smeId) return res.status(400).json({ error: 'rfq and smeId required' });
  const targetSme = smes.find(s => s.id === smeId) || smes[0];
  try {
    const narrative = await claude.generateExplanation(rfq, targetSme, radarScores || {}, evidence || {});
    res.json({ success: true, source: claude.isConfigured() ? 'claude' : 'fallback', narrative, sme: targetSme.businessName });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST: Claude — WhatsApp dispatch draft ──
app.post('/api/claude/whatsapp', async (req, res) => {
  const { smeId, rfq } = req.body || {};
  if (!smeId || !rfq) return res.status(400).json({ error: 'smeId and rfq required' });
  const targetSme = smes.find(s => s.id === smeId) || smes[0];
  try {
    const message = await claude.draftWhatsAppMessage(targetSme, rfq);
    res.json({
      success: true,
      source: claude.isConfigured() ? 'claude' : 'fallback',
      to: targetSme.cell, // the maker's own screen — not shown to the buyer
      artisanName: targetSme.owner,
      businessName: targetSme.businessName,
      message,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET: Ecosystem metrics (ILLUSTRATIVE projection — see model card) ──
app.get('/api/ecosystem/metrics', (req, res) => {
  const totalYouthEmployed = smes.reduce((acc, curr) => acc + (curr.youthEmployed || 0), 0);
  res.json({
    disclaimer: 'Illustrative pilot projection. Not measured outcomes.',
    smeProfilesIndexed: smes.length,
    youthEmployedAcrossProfiles: totalYouthEmployed,
    projected: {
      totalMatchedVolumeZAR: 14850000,
      youthSmesEngaged: 384,
      youthJobsSustained: totalYouthEmployed * 14
    },
    topSectors: [
      { name: 'Leathercraft & Corporate Gifting', demandPercentage: 34 },
      { name: 'Furniture & Timber Fabrication', demandPercentage: 28 },
      { name: 'Eco-Packaging & Printing', demandPercentage: 22 },
      { name: 'Apparel & Workwear', demandPercentage: 16 }
    ],
    supplyGaps: [
      'High demand / low supply: certified flame-retardant uniform fabrics',
      'Compliance gap: COIDA letters of good standing among micro-carpenters',
      'Geographic under-service: Sebokeng and Hammanskraal artisan clusters'
    ]
  });
});

// ── POST: Bill of Materials ──
app.post('/api/bom', async (req, res) => {
  const { rfq, smeId } = req.body || {};
  if (!rfq) return res.status(400).json({ error: 'rfq object is required' });
  const targetSme = smes.find(s => s.id === smeId) || smes[0];
  res.json(await claude.estimateBillOfMaterials(rfq, targetSme));
});

// ── POST: B-BBEE scorecard impact ──
app.post('/api/bbbee/score', (req, res) => {
  const { budgetZAR, smeId } = req.body || {};
  if (!budgetZAR) return res.status(400).json({ error: 'budgetZAR is required' });
  const targetSme = smes.find(s => s.id === smeId) || smes[0];
  res.json(claude.calculateBbbeePoints(budgetZAR, targetSme));
});

app.listen(PORT, () => {
  console.log(`🚀 [SwiftMatch AI Server] running on http://localhost:${PORT}`);
  console.log(`   Claude: ${claude.isConfigured() ? `configured (${claude.MODEL})` : 'NOT configured — deterministic fallbacks active'}`);
});
