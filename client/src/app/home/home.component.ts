import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatchService, MatchRequest } from '../services/match.service';

interface FormErrors {
  rfqText?: string;
  requiredQuantity?: string;
  budgetZAR?: string;
  maxTurnaroundDays?: string;
  targetLocation?: string;
}

type Screen = 'request' | 'results' | 'maker';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css', './home.additions.css']
})
export class HomeComponent implements OnInit {
  // Screen state: 'request' (Screen 1) | 'results' (Screen 2) | 'maker' (Screen 3)
  currentScreen: Screen = 'request';

  // Screen 1: Form Model
  rfqText: string = 'Looking for 150 handmade genuine leather conference folios and executive desk pads for an upcoming leadership summit in Sandton.';
  selectedCategory: string = 'Leathercraft & Corporate Gifts';
  requiredQuantity: number = 150;
  budgetZAR: number = 85000;
  maxTurnaroundDays: number = 21;
  targetLocation: string = 'Sandton, Gauteng';

  // Compliance Flags (buyer-selected mandatory checks)
  requireCipc: boolean = true;
  requireTaxPin: boolean = true;
  requireYouthOwned: boolean = true;
  requireCoida: boolean = false;

  categories: string[] = [
    'Leathercraft & Corporate Gifts',
    'Furniture & Timber Joinery',
    'Eco-Packaging & Printing',
    'Apparel & Industrial Workwear',
    'Metal Fabrication & Welding',
    'Art & Decor Ceramics'
  ];

  // Validation State
  errors: FormErrors = {};
  isSubmitted: boolean = false;
  isSubmitting: boolean = false;

  // Presets & Claude State
  presetRfqs: any[] = [];
  isClaudeParsing: boolean = false;
  claudeNotice: string | null = null;

  // Screen 2: Matches Data
  matches: any[] = [];
  featuredMatch: any = null;
  selectedMatch: any = null;
  totalEvaluated: number = 0;
  eligibleCount: number = 0;
  engineInfo: any = null;
  resolvedSite: any = null;
  isGeneratingAudit: boolean = false;
  claudeAuditNarrative: string | null = null;
  claudeAuditSource: string | null = null;

  // Responsible AI model card
  modelCard: any = null;
  showModelCard: boolean = false;

  // Screen 3: Maker Experience State
  activeMaker: any = null;
  activeMatch: any = null;
  makerAccepted: boolean = false;
  makerDeclined: boolean = false;
  dispatchFeedback: string | null = null;
  whatsappDraft: string | null = null;
  whatsappSource: string | null = null;
  isDraftingWhatsApp: boolean = false;

  // Screen 2: BOM & B-BBEE Panels
  bomData: any = null;
  isBomLoading: boolean = false;
  bbbeeData: any = null;
  isBbbeeLoading: boolean = false;

  constructor(
    private matchService: MatchService,
    private route: ActivatedRoute
  ) { }

  ngOnInit(): void {
    const snapScreen = this.route.snapshot.queryParamMap.get('screen');
    if (snapScreen && ['request', 'results', 'maker'].includes(snapScreen)) {
      this.currentScreen = snapScreen as Screen;
    }
    this.route.queryParams.subscribe(params => {
      if (params['screen'] && ['request', 'results', 'maker'].includes(params['screen'])) {
        this.currentScreen = params['screen'];
      }
    });
    this.loadPresets();
    this.runMatch(false);
  }

  // ── Derived labels ──
  get engineLabel(): string {
    if (!this.engineInfo) return 'Engine warming up';
    if (this.engineInfo.semantic === 'hybrid-embedding') {
      return `Semantic engine: MiniLM-L6-v2 · ${this.engineInfo.dimensions}-d vectors + lexical`;
    }
    return 'Semantic engine: lexical fallback (embeddings unavailable)';
  }

  get complianceRequirements(): string[] {
    const reqs: string[] = [];
    if (this.requireCipc) reqs.push('cipcRegistered');
    if (this.requireTaxPin) reqs.push('taxPinCompliant');
    if (this.requireYouthOwned) reqs.push('youthOwned');
    if (this.requireCoida) reqs.push('coidaRegistered');
    return reqs;
  }

  private buildPayload(): MatchRequest {
    return {
      rfqText: this.rfqText,
      category: this.selectedCategory,
      requiredQuantity: this.requiredQuantity,
      budgetZAR: this.budgetZAR,
      maxTurnaroundDays: this.maxTurnaroundDays,
      targetLocation: this.targetLocation,
      complianceRequirements: this.complianceRequirements
    };
  }

  loadPresets(): void {
    this.matchService.getPresetRfqs().subscribe({
      next: data => this.presetRfqs = data,
      error: err => console.error('Error fetching presets:', err)
    });
  }

  loadModelCard(): void {
    this.showModelCard = !this.showModelCard;
    if (this.modelCard || !this.showModelCard) return;
    this.matchService.getModelCard().subscribe({
      next: card => this.modelCard = card,
      error: err => console.error('Error fetching model card:', err)
    });
  }

  private applyMatchResponse(res: any): void {
    this.matches = res.matches || [];
    this.totalEvaluated = res.totalEvaluated || this.matches.length;
    this.eligibleCount = res.eligibleCount ?? this.matches.filter(m => m.eligible).length;
    this.engineInfo = res.engine || null;
    this.resolvedSite = res.rfq?.resolvedSite || null;
    if (this.matches.length > 0) {
      this.featuredMatch = this.matches[0];
      this.selectedMatch = this.matches[0];
      this.activeMatch = this.matches[0];
      this.activeMaker = this.matches[0].sme;
    }
    this.bomData = null;
    this.bbbeeData = null;
    this.claudeAuditNarrative = null;
    this.claudeAuditSource = null;
  }

  private runMatch(navigate: boolean): void {
    this.matchService.runMatch(this.buildPayload()).subscribe({
      next: res => {
        this.isSubmitting = false;
        this.applyMatchResponse(res);
        if (navigate) this.currentScreen = 'results';
      },
      error: err => {
        console.error('Match error:', err);
        this.isSubmitting = false;
        if (navigate) this.currentScreen = 'results';
      }
    });
  }

  applyPreset(preset: any): void {
    this.rfqText = preset.rawPrompt;
    this.requiredQuantity = preset.requiredQuantity;
    this.budgetZAR = preset.budgetZAR;
    this.maxTurnaroundDays = preset.maxTurnaroundDays;
    this.targetLocation = preset.targetLocation;
    if (preset.category && this.categories.includes(preset.category)) {
      this.selectedCategory = preset.category;
    }
    const reqs: string[] = preset.complianceRequirements || [];
    this.requireCipc = reqs.includes('cipcRegistered');
    this.requireTaxPin = reqs.includes('taxPinCompliant');
    this.requireCoida = reqs.includes('coidaRegistered');
    this.requireYouthOwned = reqs.includes('youthOwned') || /youth/i.test(preset.rawPrompt || '');

    this.errors = {};
    this.claudeNotice = `Loaded scenario: ${preset.title.split(':')[0]}`;
    setTimeout(() => this.claudeNotice = null, 3500);
  }

  validateForm(): boolean {
    this.errors = {};
    if (!this.rfqText || this.rfqText.trim().length < 10) {
      this.errors.rfqText = 'Please provide a descriptive procurement specification (at least 10 characters).';
    }
    if (!this.requiredQuantity || this.requiredQuantity <= 0) {
      this.errors.requiredQuantity = 'Quantity must be greater than 0.';
    }
    if (!this.budgetZAR || this.budgetZAR <= 0) {
      this.errors.budgetZAR = 'Please specify a valid budget allocation in ZAR.';
    }
    if (!this.maxTurnaroundDays || this.maxTurnaroundDays <= 0) {
      this.errors.maxTurnaroundDays = 'Turnaround timeline must be at least 1 day.';
    }
    if (!this.targetLocation || this.targetLocation.trim().length < 3) {
      this.errors.targetLocation = 'Please specify a delivery location or site address.';
    }
    return Object.keys(this.errors).length === 0;
  }

  submitProcurementRequest(): void {
    this.isSubmitted = true;
    if (!this.validateForm()) return;
    this.isSubmitting = true;
    this.runMatch(true);
  }

  // Claude natural-language extraction (server falls back to rules offline)
  autofillWithClaude(): void {
    if (!this.rfqText || this.rfqText.trim().length < 10) {
      this.errors.rfqText = 'Enter your procurement requirement before extracting with Claude.';
      return;
    }
    this.isClaudeParsing = true;
    this.claudeNotice = 'Extracting structured procurement parameters...';

    this.matchService.parseRfqWithClaude(this.rfqText).subscribe({
      next: res => {
        this.isClaudeParsing = false;
        const s = res.structured;
        if (s) {
          if (s.requiredQuantity) this.requiredQuantity = s.requiredQuantity;
          if (s.budgetZAR) this.budgetZAR = s.budgetZAR;
          if (s.maxTurnaroundDays) this.maxTurnaroundDays = s.maxTurnaroundDays;
          if (s.targetLocation) this.targetLocation = s.targetLocation;
          if (s.category && this.categories.includes(s.category)) this.selectedCategory = s.category;
          const reqs: string[] = s.complianceRequirements || [];
          if (reqs.includes('youthOwned')) this.requireYouthOwned = true;
          if (reqs.includes('coidaRegistered')) this.requireCoida = true;
          this.claudeNotice = res.source === 'claude'
            ? 'Claude extracted quantity, budget, deadline and site from your text.'
            : 'Rule-based extraction applied (Claude key not configured).';
        }
        setTimeout(() => this.claudeNotice = null, 4000);
      },
      error: () => {
        this.isClaudeParsing = false;
        this.claudeNotice = 'Extraction service unavailable. Please fill the fields manually.';
        setTimeout(() => this.claudeNotice = null, 4000);
      }
    });
  }

  resetForm(): void {
    this.rfqText = '';
    this.requiredQuantity = 100;
    this.budgetZAR = 50000;
    this.maxTurnaroundDays = 14;
    this.targetLocation = 'Sandton, Gauteng';
    this.errors = {};
    this.isSubmitted = false;
  }

  // ── Screen navigation ──
  navigateTo(screen: Screen): void {
    this.currentScreen = screen;
  }

  selectCandidate(match: any): void {
    this.selectedMatch = match;
    this.claudeAuditNarrative = null;
  }

  openMakerExperience(match: any): void {
    this.activeMatch = match;
    this.activeMaker = match.sme;
    this.makerAccepted = false;
    this.makerDeclined = false;
    this.dispatchFeedback = null;
    this.whatsappDraft = null;
    this.whatsappSource = null;
    this.currentScreen = 'maker';
  }

  // ── Per-match helpers used by the template ──
  capacityRatio(match: any): number {
    return match?.evidence?.capacity?.capacityRatio ?? 0;
  }

  turnaroundMargin(match: any): number {
    return match?.evidence?.capacity?.turnaroundMarginDays ?? 0;
  }

  logisticsLabel(match: any): string {
    const km = match?.distanceKm ?? 0;
    if (km <= 40) return 'Same-day courier';
    if (km <= 150) return 'Next-day courier';
    if (km <= 600) return '2–3 day freight';
    return 'Inter-provincial freight';
  }

  factorRows(match: any): { label: string; weight: number; score: number; evidence: string }[] {
    if (!match) return [];
    const w = match.weights || {};
    const r = match.radarScores || {};
    const e = match.evidence || {};
    const sem = e.semantic || {};
    const cap = e.capacity || {};
    const comp = e.compliance || {};
    const geo = e.geography || {};
    const rep = e.reputation || {};
    const passed = (comp.checks || []).filter((c: any) => c.passed).length;
    return [
      {
        label: 'Semantic fit',
        weight: Math.round((w.semanticFit || 0.35) * 100),
        score: r.semanticFit || 0,
        evidence: sem.cosine != null
          ? `cosine ${sem.cosine} · ${sem.lexicalHits || 0} tag hits${sem.matchedTerms?.length ? ` (${sem.matchedTerms.slice(0, 3).join(', ')})` : ''}`
          : `${sem.lexicalHits || 0} tag hits (lexical fallback)`
      },
      {
        label: 'Production capacity',
        weight: Math.round((w.productionCapacity || 0.25) * 100),
        score: r.productionCapacity || 0,
        evidence: `${cap.capacityRatio ?? '–'}x of required volume · turnaround ${cap.turnaroundOk ? 'within' : 'exceeds'} deadline`
      },
      {
        label: 'Mandatory compliance',
        weight: Math.round((w.complianceStatus || 0.15) * 100),
        score: r.complianceStatus || 0,
        evidence: (comp.checks || []).length ? `${passed}/${comp.checks.length} buyer-selected checks passed` : 'no mandatory checks selected'
      },
      {
        label: 'Geographic proximity',
        weight: Math.round((w.geographicProximity || 0.15) * 100),
        score: r.geographicProximity || 0,
        evidence: `${geo.distanceKm ?? match.distanceKm} km from delivery site`
      },
      {
        label: 'Reputation & orders',
        weight: Math.round((w.reputationAndOrders || 0.10) * 100),
        score: r.reputationAndOrders || 0,
        evidence: `${rep.rating ?? '–'}/5 rating · ${rep.verifiedOrders ?? '–'} verified Kasi-eCo orders`
      }
    ];
  }

  // ── Maker actions ──
  acceptOpportunity(): void {
    this.makerAccepted = true;
    this.makerDeclined = false;
    this.dispatchFeedback = `Opportunity accepted by ${this.activeMaker?.owner}. Digital Purchase Order #PO-2026-${Math.floor(1000 + Math.random() * 9000)} requested; the buyer now receives your contact details.`;
  }

  declineOpportunity(): void {
    this.makerDeclined = true;
    this.makerAccepted = false;
    this.dispatchFeedback = 'Opportunity declined (at capacity). The next-ranked eligible supplier will be notified. Your profile is not penalised.';
  }

  draftWhatsApp(): void {
    if (!this.activeMaker) return;
    this.isDraftingWhatsApp = true;
    this.whatsappDraft = null;
    this.matchService.draftClaudeWhatsApp({
      smeId: this.activeMaker.id,
      rfq: {
        rawPrompt: this.rfqText,
        budgetZAR: this.budgetZAR,
        requiredQuantity: this.requiredQuantity,
        maxTurnaroundDays: this.maxTurnaroundDays,
        targetLocation: this.targetLocation
      }
    }).subscribe({
      next: res => {
        this.isDraftingWhatsApp = false;
        this.whatsappDraft = res.message;
        this.whatsappSource = res.source;
      },
      error: () => {
        this.isDraftingWhatsApp = false;
        this.whatsappDraft = `Sawubona ${this.activeMaker?.owner?.split(' ')[0]}! A corporate buyer has shortlisted ${this.activeMaker?.businessName} for ${this.requiredQuantity} units (budget R${this.budgetZAR.toLocaleString()}, ${this.maxTurnaroundDays} days). Reply 1 to accept, 2 to ask a question, 3 to decline.`;
        this.whatsappSource = 'offline';
      }
    });
  }

  generateClaudeDeepAudit(match: any): void {
    this.isGeneratingAudit = true;
    const payload = {
      rfq: {
        rawPrompt: this.rfqText,
        budgetZAR: this.budgetZAR,
        requiredQuantity: this.requiredQuantity,
        maxTurnaroundDays: this.maxTurnaroundDays,
        targetLocation: this.targetLocation
      },
      smeId: match.sme.id,
      radarScores: {
        semantic: match.radarScores?.semanticFit ?? 0,
        capacity: match.radarScores?.productionCapacity ?? 0,
        compliance: match.radarScores?.complianceStatus ?? 0,
        geographic: match.radarScores?.geographicProximity ?? 0,
        reputation: match.radarScores?.reputationAndOrders ?? 0,
        overall: match.matchPercentage
      },
      evidence: match.evidence || {}
    };

    this.matchService.getClaudeExplanation(payload).subscribe({
      next: res => {
        this.isGeneratingAudit = false;
        this.claudeAuditNarrative = res.narrative;
        this.claudeAuditSource = res.source;
      },
      error: () => {
        this.isGeneratingAudit = false;
        this.claudeAuditSource = 'offline';
        this.claudeAuditNarrative = `${match.sme.businessName} ranks first at ${match.matchPercentage}%: semantic fit ${match.radarScores?.semanticFit}%, capacity ${this.capacityRatio(match)}x of the requested ${this.requiredQuantity} units, ${match.distanceKm} km from site. A procurement officer must still verify documents at source and request a sample before award.`;
      }
    });
  }

  loadBomEstimate(): void {
    if (this.bomData) { return; }
    this.isBomLoading = true;
    const rfq = {
      rawPrompt: this.rfqText,
      budgetZAR: this.budgetZAR,
      requiredQuantity: this.requiredQuantity,
      maxTurnaroundDays: this.maxTurnaroundDays
    };
    this.matchService.estimateBom({ rfq, smeId: this.featuredMatch?.sme?.id }).subscribe({
      next: data => { this.bomData = data; this.isBomLoading = false; },
      error: () => {
        this.isBomLoading = false;
        const qty = this.requiredQuantity || 150;
        const budget = this.budgetZAR || 85000;
        this.bomData = {
          totalBudgetZAR: budget,
          unitBudgetZAR: Math.round(budget / qty),
          costBreakdown: {
            rawMaterialsZAR: Math.round(budget * 0.45),
            artisanLaborZAR: Math.round(budget * 0.35),
            netProfitMarginZAR: Math.round(budget * 0.20),
            profitMarginPercentage: 20
          },
          lineItems: [
            { item: 'Grade-A raw stock & hardware', estimatedCost: Math.round(budget * 0.315) },
            { item: 'Packaging, branding & finishing', estimatedCost: Math.round(budget * 0.135) },
            { item: 'Workshop wages', estimatedCost: Math.round(budget * 0.2975) },
            { item: 'Quality vetting & ground courier', estimatedCost: Math.round(budget * 0.0525) }
          ],
          marginProtectionNote: 'Artisan net margin protected at 20% to prevent unviable underbidding.',
          recommendedPaymentSchedule: '30% deposit on sample sign-off · 70% on delivery confirmation.'
        };
      }
    });
  }

  loadBbbeeScore(): void {
    if (this.bbbeeData) { return; }
    this.isBbbeeLoading = true;
    this.matchService.getBbbeeScore({ budgetZAR: this.budgetZAR, smeId: this.featuredMatch?.sme?.id }).subscribe({
      next: data => { this.bbbeeData = data; this.isBbbeeLoading = false; },
      error: () => {
        this.isBbbeeLoading = false;
        const budget = this.budgetZAR || 85000;
        const recognized = Math.round(budget * 1.35);
        const e400 = +(Math.min(2.5, budget / 50000)).toFixed(2);
        const e500 = +(Math.min(5.0, e400 * 1.6)).toFixed(1);
        this.bbbeeData = {
          actualSpendZAR: budget,
          recognizedSpendZAR: recognized,
          procurementRecognitionMultiplier: '135% (Level 1 EME)',
          bbbeeLevel: 1,
          scorecardImpact: { element400Points: e400, element500EsdPoints: e500, totalScorecardBoost: +(e400 + e500).toFixed(1) },
          executiveSummary: `Procuring R${budget.toLocaleString()} from this Level 1 EME is recognised as R${recognized.toLocaleString()} of preferential procurement spend, worth approximately +${(e400 + e500).toFixed(1)} scorecard points.`
        };
      }
    });
  }
}
