const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { matchSmeToRfq } = require('./services/matchingEngine');
const { parseRFQ, generateExplanation, draftWhatsAppMessage } = require('./services/claudeEngine');

const app = express();
const PORT = process.env.PORT || 5050;

app.use(cors());
app.use(express.json());

// Load In-Memory Data Store
const smesPath = path.join(__dirname, 'data', 'smes.json');
const rfqsPath = path.join(__dirname, 'data', 'rfqs.json');

let smes = [];
let rfqs = [];

try {
  smes = JSON.parse(fs.readFileSync(smesPath, 'utf8'));
  rfqs = JSON.parse(fs.readFileSync(rfqsPath, 'utf8'));
  console.log(`[SwiftMatch AI] Loaded ${smes.length} verified SMEs and ${rfqs.length} preset RFQs.`);
} catch (e) {
  console.error('[SwiftMatch AI] Error reading seed data:', e);
}

// ── GET: Health Check ──
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', version: '1.0.0', service: 'SwiftMatch AI Core Engine' });
});

// ── GET: All Verified SMEs ──
app.get('/api/smes', (req, res) => {
  res.json(smes);
});

// ── GET: Preset RFQs ──
app.get('/api/rfqs', (req, res) => {
  res.json(rfqs);
});

// ── POST: Run Semantic AI Matching Engine ──
app.post('/api/match', (req, res) => {
  const { rfqText, requiredQuantity, budgetZAR, maxTurnaroundDays, targetLocation } = req.body;

  const virtualRfq = {
    rawPrompt: rfqText || 'Corporate procurement requirement',
    requiredQuantity: Number(requiredQuantity) || 100,
    budgetZAR: Number(budgetZAR) || 75000,
    maxTurnaroundDays: Number(maxTurnaroundDays) || 21,
    targetLocation: targetLocation || 'Sandton, Gauteng',
    targetCoordinates: { lat: -26.1076, lng: 28.0567 }, // Sandton center
    complianceRequirements: ['cipcRegistered', 'taxPinCompliant']
  };

  // Run matching across all SMEs in the verified network
  const results = smes.map(sme => matchSmeToRfq(virtualRfq, sme));

  // Sort descending by match percentage
  results.sort((a, b) => b.matchPercentage - a.matchPercentage);

  res.json({
    rfq: virtualRfq,
    totalEvaluated: smes.length,
    matches: results
  });
});

// ── POST: Generate WhatsApp Proposal Payload ──
app.post('/api/whatsapp/dispatch', (req, res) => {
  const { smeId, rfqTitle, budgetZAR, buyerName } = req.body;
  const targetSme = smes.find(s => s.id === smeId) || smes[0];

  const payload = {
    to: targetSme.cell,
    artisanName: targetSme.owner,
    businessName: targetSme.businessName,
    message: `🔔 *NEW CORPORATE OPPORTUNITY via SwiftMatch AI!*

Hi ${targetSme.owner}! A corporate buyer (${buyerName || 'Sandton Corporate Partner'}) has shortlisted *${targetSme.businessName}* for a procurement order.

📋 *Requirement:* ${rfqTitle || 'Corporate Procurement Order'}
💰 *Budget Allocation:* R${Number(budgetZAR || 85000).toLocaleString()}
📍 *Delivery Site:* Sandton, Gauteng

Reply:
[1] ✅ Accept & Request Purchase Order
[2] ℹ️ View Full Specification
[3] ❌ Decline Opportunity`,
    timestamp: new Date().toISOString()
  };

  res.json({ success: true, payload });
});

// ── POST: Claude AI — Parse RFQ from natural language ──
app.post('/api/claude/parse-rfq', async (req, res) => {
  const { rawText } = req.body;
  if (!rawText) return res.status(400).json({ error: 'rawText is required' });

  try {
    const structured = await parseRFQ(rawText);
    if (!structured) {
      return res.status(503).json({ error: 'Claude unavailable — fallback to local heuristics', fallback: true });
    }
    res.json({ success: true, structured });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST: Claude AI — Generate XAI Explanation for a match ──
app.post('/api/claude/explain', async (req, res) => {
  const { rfq, smeId, radarScores } = req.body;
  if (!rfq || !smeId) return res.status(400).json({ error: 'rfq and smeId required' });

  const targetSme = smes.find(s => s.id === smeId) || smes[0];

  try {
    const narrative = await generateExplanation(rfq, targetSme, radarScores || {});
    res.json({ success: true, narrative, sme: targetSme.businessName });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST: Claude AI — Draft WhatsApp message for artisan ──
app.post('/api/claude/whatsapp', async (req, res) => {
  const { smeId, rfq } = req.body;
  if (!smeId || !rfq) return res.status(400).json({ error: 'smeId and rfq required' });

  const targetSme = smes.find(s => s.id === smeId) || smes[0];

  try {
    const message = await draftWhatsAppMessage(targetSme, rfq);
    res.json({
      success: true,
      to: targetSme.cell,
      artisanName: targetSme.owner,
      businessName: targetSme.businessName,
      message,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET: YES Ecosystem Impact Metrics ──
app.get('/api/ecosystem/metrics', (req, res) => {
  const totalYouthEmployed = smes.reduce((acc, curr) => acc + (curr.youthEmployed || 0), 0);
  res.json({
    totalMatchedVolumeZAR: 14850000,
    youthSmesEngaged: 384,
    youthJobsSustained: totalYouthEmployed * 14,
    topSectors: [
      { name: 'Leathercraft & Corporate Gifting', demandPercentage: 34 },
      { name: 'Furniture & Timber Fabrication', demandPercentage: 28 },
      { name: 'Eco-Packaging & Printing', demandPercentage: 22 },
      { name: 'Apparel & Workwear', demandPercentage: 16 }
    ],
    supplyGaps: [
      'High Demand / Low Supply: Certified Flame-Retardant Uniform Fabrics',
      'Compliance Chasm: COIDA Letters of Good Standing among micro-carpenters',
      'Geographic Underservice: Sebokeng and Hammanskraal artisan clusters'
    ]
  });
});

app.listen(PORT, () => {
  console.log(`🚀 [SwiftMatch AI Server] running on http://localhost:${PORT}`);
});
