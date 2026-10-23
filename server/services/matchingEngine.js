/**
 * matchingEngine.js
 * ──────────────────────────────────────────────────────────
 * SwiftMatch AI — Deterministic, explainable multi-factor ranking.
 *
 *   MatchScore = 0.35·Semantic + 0.25·Capacity + 0.15·Compliance
 *              + 0.15·Geography + 0.10·Reputation
 *
 * Semantic  = hybrid of on-device sentence-embedding cosine similarity
 *             (all-MiniLM-L6-v2) and lexical tag overlap.
 * Capacity  = monthly units vs required units, penalised if the SME's
 *             average turnaround exceeds the buyer's deadline.
 * Compliance= share of the buyer's MANDATORY statutory checks passed.
 *             Any failed mandatory check also marks the SME INELIGIBLE
 *             (hard filter) — it is still shown, but ranked below all
 *             eligible suppliers and flagged with the reason.
 * Geography = Haversine distance from the resolved delivery site.
 * Reputation= Kasi-eCo rating + verified order history.
 *
 * Responsible-AI note: owner age, gender and name are NEVER used as
 * scoring inputs. Every factor returns its raw evidence so the UI can
 * show the buyer exactly why a supplier ranked where it did.
 * ──────────────────────────────────────────────────────────
 */

const { cosine, embed } = require('./embeddingEngine');

const WEIGHTS = {
  semanticFit: 0.35,
  productionCapacity: 0.25,
  complianceStatus: 0.15,
  geographicProximity: 0.15,
  reputationAndOrders: 0.10
};

// ── Small South African gazetteer for delivery-site resolution ──
const GAZETTEER = [
  { name: 'Sandton',        lat: -26.1076, lng: 28.0567 },
  { name: 'Rosebank',       lat: -26.1467, lng: 28.0416 },
  { name: 'Randburg',       lat: -26.0936, lng: 27.9947 },
  { name: 'Midrand',        lat: -25.9983, lng: 28.1263 },
  { name: 'Centurion',      lat: -25.8603, lng: 28.1894 },
  { name: 'Pretoria',       lat: -25.7479, lng: 28.2293 },
  { name: 'Johannesburg',   lat: -26.2041, lng: 28.0473 },
  { name: 'Soweto',         lat: -26.2485, lng: 27.8540 },
  { name: 'Alexandra',      lat: -26.1044, lng: 28.0984 },
  { name: 'Tembisa',        lat: -25.9964, lng: 28.2268 },
  { name: 'Kempton Park',   lat: -26.1000, lng: 28.2333 },
  { name: 'Germiston',      lat: -26.2178, lng: 28.1672 },
  { name: 'Cape Town',      lat: -33.9249, lng: 18.4241 },
  { name: 'Khayelitsha',    lat: -34.0381, lng: 18.6789 },
  { name: 'Stellenbosch',   lat: -33.9321, lng: 18.8602 },
  { name: 'Durban',         lat: -29.8587, lng: 31.0218 },
  { name: 'Pietermaritzburg', lat: -29.6006, lng: 30.3794 },
  { name: 'Gqeberha',       lat: -33.9608, lng: 25.6022 },
  { name: 'Port Elizabeth', lat: -33.9608, lng: 25.6022 },
  { name: 'East London',    lat: -33.0153, lng: 27.9116 },
  { name: 'Bloemfontein',   lat: -29.0852, lng: 26.1596 },
  { name: 'Polokwane',      lat: -23.9045, lng: 29.4689 },
  { name: 'Nelspruit',      lat: -25.4745, lng: 30.9703 },
  { name: 'Mbombela',       lat: -25.4745, lng: 30.9703 },
  { name: 'Rustenburg',     lat: -25.6672, lng: 27.2420 },
  { name: 'Kimberley',      lat: -28.7282, lng: 24.7499 }
];

function resolveLocation(text) {
  const lower = (text || '').toLowerCase();
  // Prefer the most specific (longest) place name that appears in the text.
  const hits = GAZETTEER.filter(g => lower.includes(g.name.toLowerCase()))
                        .sort((a, b) => b.name.length - a.name.length);
  if (hits.length > 0) {
    return { name: hits[0].name, lat: hits[0].lat, lng: hits[0].lng, resolved: true };
  }
  return { name: 'Sandton (default)', lat: -26.1076, lng: 28.0567, resolved: false };
}

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── 1. Semantic fit (hybrid: embedding cosine + lexical overlap) ──
function lexicalScore(rfqText, sme) {
  const lower = (rfqText || '').toLowerCase();
  let hits = 0;
  const matchedTerms = [];
  for (const tag of sme.tags || []) {
    const t = tag.toLowerCase();
    if (lower.includes(t)) { hits += 2; matchedTerms.push(tag); continue; }
    for (const w of t.split(' ')) {
      if (w.length > 3 && lower.includes(w)) { hits += 1; if (!matchedTerms.includes(w)) matchedTerms.push(w); }
    }
  }
  if (sme.category && lower.includes(sme.category.toLowerCase())) hits += 3;
  // Saturates at ~8 hits.
  return { score: Math.min(1, hits / 8), hits, matchedTerms: matchedTerms.slice(0, 6) };
}

/**
 * MiniLM cosine values for related-but-not-identical text typically sit
 * between ~0.12 (unrelated) and ~0.55 (clear match). We map that band
 * linearly onto 0–1 so the factor is comparable with the others.
 */
const COS_LOW = 0.12;
const COS_HIGH = 0.55;
function calibrateCosine(c) {
  return Math.max(0, Math.min(1, (c - COS_LOW) / (COS_HIGH - COS_LOW)));
}

function semanticFit(rfq, sme, rfqVector) {
  const lex = lexicalScore(rfq.rawPrompt, sme);
  if (rfqVector && sme._vector) {
    const cos = cosine(rfqVector, sme._vector);
    const vec = calibrateCosine(cos);
    const score = 0.7 * vec + 0.3 * lex.score;
    return {
      score,
      engine: 'hybrid-embedding',
      cosine: Math.round(cos * 1000) / 1000,
      calibratedVector: Math.round(vec * 100) / 100,
      lexicalHits: lex.hits,
      matchedTerms: lex.matchedTerms
    };
  }
  return {
    score: 0.45 + lex.score * 0.5, // lexical-only fallback, bounded 0.45–0.95
    engine: 'lexical-fallback',
    cosine: null,
    calibratedVector: null,
    lexicalHits: lex.hits,
    matchedTerms: lex.matchedTerms
  };
}

// ── 2. Capacity & turnaround ──
function capacityFit(rfq, sme) {
  const required = Number(rfq.requiredQuantity) || 0;
  const monthly = Number(sme.monthlyCapacityUnits) || 0;
  const ratio = required > 0 ? monthly / required : 1;
  let score;
  if (ratio >= 1.2) score = 1.0;
  else if (ratio >= 0.9) score = 0.85;
  else if (ratio >= 0.6) score = 0.65;
  else if (ratio >= 0.3) score = 0.4;
  else score = 0.2;

  const turnaroundOk = !(sme.averageTurnaroundDays > rfq.maxTurnaroundDays);
  if (!turnaroundOk) score *= 0.75;

  return {
    score,
    capacityRatio: Math.round(ratio * 100) / 100,
    monthlyCapacityUnits: monthly,
    requiredQuantity: required,
    turnaroundOk,
    turnaroundMarginDays: (rfq.maxTurnaroundDays || 0) - (sme.averageTurnaroundDays || 0)
  };
}

// ── 3. Compliance (hard filter + soft score) ──
const CHECK_LABELS = {
  cipcRegistered: 'CIPC registration',
  taxPinCompliant: 'SARS Tax Compliance PIN',
  bbbeeLevel1: 'B-BBEE Level 1',
  coidaRegistered: 'COIDA letter of good standing',
  youthOwned: '100% youth-owned'
};

function passesCheck(req, sme) {
  const c = sme.compliance || {};
  switch (req) {
    case 'cipcRegistered': return !!c.cipcRegistered;
    case 'taxPinCompliant': return !!c.taxPinCompliant;
    case 'bbbeeLevel1': return c.bbbeeLevel === 1;
    case 'coidaRegistered': return !!c.coidaRegistered;
    case 'youthOwned': return sme.youthOwned === true;
    default: return true;
  }
}

function complianceFit(rfq, sme) {
  const reqs = Array.isArray(rfq.complianceRequirements) ? rfq.complianceRequirements : [];
  const checks = reqs.map(r => ({ key: r, label: CHECK_LABELS[r] || r, passed: passesCheck(r, sme) }));
  const failed = checks.filter(c => !c.passed);
  let score;
  if (checks.length === 0) {
    const c = sme.compliance || {};
    score = c.cipcRegistered && c.taxPinCompliant ? 0.95 : 0.7;
  } else {
    score = (checks.length - failed.length) / checks.length;
  }
  return { score, checks, failed, eligible: failed.length === 0 };
}

// ── 4. Geography ──
function geoFit(rfq, sme) {
  const site = rfq.targetCoordinates;
  if (!site || !sme.coordinates) return { score: 0.8, distanceKm: 35 };
  const distanceKm = Math.round(calculateDistanceKm(site.lat, site.lng, sme.coordinates.lat, sme.coordinates.lng));
  let score;
  if (distanceKm < 30) score = 0.98;
  else if (distanceKm < 60) score = 0.85;
  else if (distanceKm < 150) score = 0.70;
  else if (distanceKm < 600) score = 0.50;
  else score = 0.35;
  return { score, distanceKm };
}

// ── 5. Reputation ──
function reputationFit(sme) {
  const rating = Math.min(5, Number(sme.kasiEcoRating) || 0);
  const orders = Number(sme.verifiedOrdersCount) || 0;
  const orderSignal = Math.min(1, Math.log10(1 + orders) / 2); // 99 orders → 1.0
  return {
    score: 0.7 * (rating / 5) + 0.3 * orderSignal,
    rating,
    verifiedOrders: orders
  };
}

function maskCell(cell) {
  if (!cell || cell.length < 7) return cell;
  return `${cell.slice(0, 3)} *** ${cell.slice(-4)}`;
}

function matchSmeToRfq(rfq, sme, rfqVector) {
  const sem = semanticFit(rfq, sme, rfqVector);
  const cap = capacityFit(rfq, sme);
  const comp = complianceFit(rfq, sme);
  const geo = geoFit(rfq, sme);
  const rep = reputationFit(sme);

  const total =
    sem.score * WEIGHTS.semanticFit +
    cap.score * WEIGHTS.productionCapacity +
    comp.score * WEIGHTS.complianceStatus +
    geo.score * WEIGHTS.geographicProximity +
    rep.score * WEIGHTS.reputationAndOrders;

  const matchPercentage = Math.round(total * 100);

  const highlights = [];
  const gaps = [];

  if (sem.score >= 0.6) highlights.push(`Strong craft alignment with ${sme.category}${sem.matchedTerms.length ? ` (matched: ${sem.matchedTerms.slice(0, 3).join(', ')})` : ''}`);
  if (cap.capacityRatio >= 1.2) highlights.push(`Production buffer: ${cap.monthlyCapacityUnits} units/mo vs ${cap.requiredQuantity} required (${cap.capacityRatio}x)`);
  if (geo.distanceKm <= 40) highlights.push(`Delivery site within ${geo.distanceKm} km (low logistics risk)`);
  if (sme.youthEmployed >= 4) highlights.push(`Socio-economic impact: ${sme.youthEmployed} youth employed in the workshop`);
  if (comp.checks.length > 0 && comp.eligible) highlights.push(`All ${comp.checks.length} mandatory statutory checks passed`);

  if (!cap.turnaroundOk) gaps.push(`Delivery timeline tight: average turnaround ${sme.averageTurnaroundDays} days vs ${rfq.maxTurnaroundDays} requested. Recommend a sample sign-off milestone.`);
  if (cap.capacityRatio < 0.9) gaps.push(`Capacity shortfall: ${cap.monthlyCapacityUnits} units/mo vs ${cap.requiredQuantity} required. Consider a split award or phased delivery.`);
  for (const f of comp.failed) gaps.push(`Mandatory check failed: ${f.label} not on record. Supplier is ineligible until this is resolved.`);
  if (!sme.compliance?.coidaRegistered && !comp.failed.some(f => f.key === 'coidaRegistered')) gaps.push('COIDA letter of good standing not on record (optional for this RFQ). Recommend 20% milestone retention.');
  if (geo.distanceKm > 150) gaps.push(`Supplier is ${geo.distanceKm} km from the delivery site. Freight adds 2–3 days and cost.`);

  // Public, POPIA-safe view of the SME for corporate screens.
  const { _vector, cell, email, ...publicSme } = sme;

  return {
    sme: { ...publicSme, cellMasked: maskCell(cell), emailMasked: email ? email.replace(/^(.).+(@.+)$/, '$1***$2') : null },
    matchPercentage,
    eligible: comp.eligible,
    ineligibilityReasons: comp.failed.map(f => f.label),
    radarScores: {
      semanticFit: Math.round(sem.score * 100),
      productionCapacity: Math.round(cap.score * 100),
      complianceStatus: Math.round(comp.score * 100),
      geographicProximity: Math.round(geo.score * 100),
      reputationAndOrders: Math.round(rep.score * 100)
    },
    weights: WEIGHTS,
    evidence: {
      semantic: { engine: sem.engine, cosine: sem.cosine, calibratedVector: sem.calibratedVector, lexicalHits: sem.lexicalHits, matchedTerms: sem.matchedTerms },
      capacity: { capacityRatio: cap.capacityRatio, turnaroundOk: cap.turnaroundOk, turnaroundMarginDays: cap.turnaroundMarginDays },
      compliance: { checks: comp.checks },
      geography: { distanceKm: geo.distanceKm },
      reputation: { rating: rep.rating, verifiedOrders: rep.verifiedOrders }
    },
    distanceKm: geo.distanceKm,
    highlights,
    gaps,
    explainabilitySummary: comp.eligible
      ? `Matched with ${matchPercentage}% confidence. Semantic fit ${Math.round(sem.score * 100)}%, capacity ${Math.round(cap.score * 100)}%, ${geo.distanceKm} km from site.`
      : `Ranked at ${matchPercentage}% but INELIGIBLE: ${comp.failed.map(f => f.label).join(', ')} missing.`
  };
}

/**
 * Rank every SME for an RFQ. Eligible suppliers always rank above
 * ineligible ones; within each group, by match percentage.
 */
async function rankSmes(rfq, smes) {
  const rfqVector = await embed(rfq.rawPrompt || '');
  const results = smes.map(sme => matchSmeToRfq(rfq, sme, rfqVector));
  results.sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    return b.matchPercentage - a.matchPercentage;
  });
  return {
    matches: results,
    engine: rfqVector ? 'hybrid-embedding' : 'lexical-fallback',
    eligibleCount: results.filter(r => r.eligible).length
  };
}

module.exports = { matchSmeToRfq, rankSmes, resolveLocation, WEIGHTS, GAZETTEER, maskCell };
