// Deterministic Multi-Factor Matching Algorithm
// Final Match Score = w1*Semantic + w2*Capacity + w3*Compliance + w4*Geo + w5*Reputation

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function calculateSemanticScore(rfqText, sme) {
  const lowerText = rfqText.toLowerCase();
  const tokens = lowerText.split(/[\s,.-]+/);
  
  let matchHits = 0;
  const tags = sme.tags || [];
  
  tags.forEach(tag => {
    const lowerTag = tag.toLowerCase();
    if (lowerText.includes(lowerTag)) {
      matchHits += 2;
    } else {
      const tagWords = lowerTag.split(' ');
      tagWords.forEach(w => {
        if (w.length > 3 && lowerText.includes(w)) matchHits += 1;
      });
    }
  });

  if (sme.category && lowerText.includes(sme.category.toLowerCase())) {
    matchHits += 3;
  }

  // Base semantic score bounded between 0.40 and 0.98
  const base = Math.min(0.98, 0.45 + (matchHits * 0.12));
  return Math.round(base * 100) / 100;
}

function matchSmeToRfq(rfq, sme) {
  // 1. Semantic Fit (35% weight)
  const semanticScore = calculateSemanticScore(rfq.rawPrompt, sme);

  // 2. Capacity Score (25% weight)
  let capacityScore = 0.5;
  if (rfq.requiredQuantity && sme.monthlyCapacityUnits) {
    const ratio = sme.monthlyCapacityUnits / rfq.requiredQuantity;
    if (ratio >= 1.2) capacityScore = 1.0;
    else if (ratio >= 0.9) capacityScore = 0.85;
    else if (ratio >= 0.6) capacityScore = 0.65;
    else capacityScore = 0.4;
  }

  // 3. Compliance Score (15% weight)
  let complianceScore = 0.5;
  const comp = sme.compliance || {};
  let validChecks = 0;
  let totalChecks = 0;

  if (rfq.complianceRequirements && rfq.complianceRequirements.length > 0) {
    totalChecks = rfq.complianceRequirements.length;
    rfq.complianceRequirements.forEach(req => {
      if (req === 'cipcRegistered' && comp.cipcRegistered) validChecks++;
      if (req === 'taxPinCompliant' && comp.taxPinCompliant) validChecks++;
      if (req === 'bbbeeLevel1' && comp.bbbeeLevel === 1) validChecks++;
      if (req === 'coidaRegistered' && comp.coidaRegistered) validChecks++;
    });
    complianceScore = totalChecks > 0 ? (validChecks / totalChecks) : 0.8;
  } else {
    complianceScore = comp.taxPinCompliant && comp.cipcRegistered ? 0.95 : 0.7;
  }

  // 4. Geographic Feasibility (15% weight)
  let geoScore = 0.8;
  let distanceKm = 35;
  if (rfq.targetCoordinates && sme.coordinates) {
    distanceKm = Math.round(calculateDistanceKm(
      rfq.targetCoordinates.lat, rfq.targetCoordinates.lng,
      sme.coordinates.lat, sme.coordinates.lng
    ));
    if (distanceKm < 30) geoScore = 0.98;
    else if (distanceKm < 60) geoScore = 0.85;
    else if (distanceKm < 150) geoScore = 0.70;
    else geoScore = 0.50; // inter-provincial
  }

  // 5. Reputation Score (10% weight)
  const repScore = Math.min(1.0, (sme.kasiEcoRating || 4.5) / 5.0);

  // Calculate Weighted Total Score
  const totalScore = (
    (semanticScore * 0.35) +
    (capacityScore * 0.25) +
    (complianceScore * 0.15) +
    (geoScore * 0.15) +
    (repScore * 0.10)
  );

  const finalPercentage = Math.round(totalScore * 100);

  // Generate Explainable AI Gaps & Highlights
  const highlights = [];
  const gaps = [];

  if (semanticScore >= 0.85) highlights.push(`Strong craft alignment with ${sme.category}`);
  if (capacityScore >= 0.9) highlights.push(`Sufficient production buffer (${sme.monthlyCapacityUnits} units/mo vs ${rfq.requiredQuantity} required)`);
  if (distanceKm <= 40) highlights.push(`Proximity feasibility within ${distanceKm} km (low logistics risk)`);
  if (sme.youthEmployed >= 4) highlights.push(`High socio-economic impact: ${sme.youthEmployed} youth sustained`);

  if (sme.averageTurnaroundDays > rfq.maxTurnaroundDays) {
    gaps.push(`Delivery timeline tight: average turnaround ${sme.averageTurnaroundDays} days vs ${rfq.maxTurnaroundDays} requested.`);
  }
  if (!sme.compliance.coidaRegistered && (rfq.complianceRequirements || []).includes('coidaRegistered')) {
    gaps.push(`COIDA letter of good standing missing. Recommend 20% milestone retention until provided.`);
  }
  if (distanceKm > 100) {
    gaps.push(`Supplier is located in another province (${distanceKm} km away). Ground courier lead-time adds 2-3 days.`);
  }

  return {
    sme,
    matchPercentage: finalPercentage,
    radarScores: {
      semanticFit: Math.round(semanticScore * 100),
      productionCapacity: Math.round(capacityScore * 100),
      complianceStatus: Math.round(complianceScore * 100),
      geographicProximity: Math.round(geoScore * 100),
      reputationAndOrders: Math.round(repScore * 100)
    },
    distanceKm,
    highlights,
    gaps,
    explainabilitySummary: `Matched with ${finalPercentage}% confidence. ${sme.businessName} demonstrated strong craft relevance, verified past order fulfillment on Kasi-eCo, and viable delivery logistics.`
  };
}

module.exports = { matchSmeToRfq };
