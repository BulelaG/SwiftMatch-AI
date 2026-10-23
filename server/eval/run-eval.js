/**
 * run-eval.js — Reproducible offline evaluation of the matching engine.
 *
 *   node eval/run-eval.js
 *
 * Scores every RFQ in eval/testset.json against the SME pool with
 *   (a) the hybrid embedding engine (MiniLM cosine + lexical) and
 *   (b) the lexical-only baseline,
 * then reports Top-1 accuracy and Mean Reciprocal Rank for each and
 * writes eval/results.json. No API key or network needed after the
 * first model download.
 */

const fs = require('fs');
const path = require('path');
const { matchSmeToRfq, resolveLocation } = require('../services/matchingEngine');
const embeddingEngine = require('../services/embeddingEngine');

const smes = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'smes.json'), 'utf8'));
const testset = JSON.parse(fs.readFileSync(path.join(__dirname, 'testset.json'), 'utf8'));

function toRfq(t) {
  const site = resolveLocation(t.targetLocation || '');
  return {
    rawPrompt: t.rfqText,
    requiredQuantity: t.requiredQuantity,
    budgetZAR: t.budgetZAR,
    maxTurnaroundDays: t.maxTurnaroundDays,
    targetLocation: t.targetLocation,
    targetCoordinates: { lat: site.lat, lng: site.lng },
    complianceRequirements: t.complianceRequirements || []
  };
}

function rank(rfq, rfqVector) {
  // Ranking is by score only here, so the eval measures retrieval quality
  // independently of the eligibility hard-filter (which is tested in t08).
  return smes.map(s => matchSmeToRfq(rfq, s, rfqVector))
             .sort((a, b) => b.matchPercentage - a.matchPercentage);
}

function summarise(rows) {
  const top1 = rows.filter(r => r.rank === 1).length / rows.length;
  const mrr = rows.reduce((acc, r) => acc + 1 / r.rank, 0) / rows.length;
  return { top1Accuracy: +top1.toFixed(3), mrr: +mrr.toFixed(3), n: rows.length };
}

(async () => {
  const t0 = Date.now();
  const index = await embeddingEngine.indexSmes(smes);
  const engineReady = index.ready;

  const hybridRows = [];
  const lexicalRows = [];

  for (const t of testset) {
    const rfq = toRfq(t);
    const vec = engineReady ? await embeddingEngine.embed(rfq.rawPrompt) : null;

    const h = rank(rfq, vec);
    const hRank = h.findIndex(r => r.sme.id === t.expectedTop) + 1;
    hybridRows.push({ id: t.id, expected: t.expectedTop, top: h[0].sme.id, topScore: h[0].matchPercentage, rank: hRank, cosine: h.find(r => r.sme.id === t.expectedTop)?.evidence.semantic.cosine ?? null, eligibleTop: h[0].eligible });

    const l = rank(rfq, null);
    const lRank = l.findIndex(r => r.sme.id === t.expectedTop) + 1;
    lexicalRows.push({ id: t.id, expected: t.expectedTop, top: l[0].sme.id, topScore: l[0].matchPercentage, rank: lRank });
  }

  const results = {
    generatedAt: new Date().toISOString(),
    smeCount: smes.length,
    testCases: testset.length,
    embedding: embeddingEngine.getStatus(),
    hybridEmbedding: engineReady ? summarise(hybridRows) : null,
    lexicalBaseline: summarise(lexicalRows),
    perCase: testset.map((t, i) => ({
      id: t.id, note: t.note, expected: t.expectedTop,
      hybrid: engineReady ? { top: hybridRows[i].top, rank: hybridRows[i].rank, score: hybridRows[i].topScore, cosineToExpected: hybridRows[i].cosine } : null,
      lexical: { top: lexicalRows[i].top, rank: lexicalRows[i].rank, score: lexicalRows[i].topScore }
    })),
    durationMs: Date.now() - t0
  };

  fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(results, null, 2));

  console.log('\nSwiftMatch AI — matching engine evaluation');
  console.log('──────────────────────────────────────────');
  console.log(`SME pool: ${smes.length} · test RFQs: ${testset.length} (3 presets + ${testset.length - 3} held-out paraphrases)`);
  console.log(`Embedding engine: ${engineReady ? embeddingEngine.MODEL_ID : 'unavailable (lexical only)'}\n`);
  console.log('case  expected  hybrid-top  rank  cos    | lexical-top  rank');
  testset.forEach((t, i) => {
    const h = hybridRows[i], l = lexicalRows[i];
    console.log(`${t.id}   ${t.expectedTop}   ${engineReady ? `${h.top}     ${h.rank}     ${h.cosine ?? '-'}` : '-'}   | ${l.top}      ${l.rank}`);
  });
  console.log('');
  if (engineReady) console.log(`Hybrid embedding : Top-1 ${(results.hybridEmbedding.top1Accuracy * 100).toFixed(0)}%  MRR ${results.hybridEmbedding.mrr}`);
  console.log(`Lexical baseline : Top-1 ${(results.lexicalBaseline.top1Accuracy * 100).toFixed(0)}%  MRR ${results.lexicalBaseline.mrr}`);
  console.log(`\nWrote eval/results.json in ${results.durationMs} ms`);
})().catch(err => { console.error(err); process.exit(1); });
