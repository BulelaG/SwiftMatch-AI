import { Component, HostListener, OnInit } from '@angular/core';
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
type DetailTab = 'feasibility' | 'bbbee' | 'bom' | 'claude';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css', './home.additions.css']
})
export class HomeComponent implements OnInit {
  // ── Workflow state: 1 request → 2 results → 3 maker ──
  currentScreen: Screen = 'request';
  today: Date = new Date();

  // ── Screen 1: form model ──
  rfqText: string = 'Looking for 150 handmade genuine leather conference folios and executive desk pads for an upcoming leadership summit in Sandton.';
  selectedCategory: string = 'Leathercraft & Corporate Gifts';
  requiredQuantity: number = 150;
  budgetZAR: number = 85000;
  maxTurnaroundDays: number = 21;
  targetLocation: string = 'Sandton, Gauteng';

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
  quickQuantities: number[] = [50, 150, 300, 500];

  errors: FormErrors = {};
  isSubmitted: boolean = false;
  isSubmitting: boolean = false;

  presetRfqs: any[] = [];
  isClaudeParsing: boolean = false;
  claudeNotice: string | null = null;

  // ── Screen 2: results ──
  matches: any[] = [];
  featuredMatch: any = null;
  selectedMatch: any = null;
  totalEvaluated: number = 0;
  eligibleCount: number = 0;
  engineInfo: any = null;
  engineHealth: any = null;
  resolvedSite: any = null;
  isLoadingMatches: boolean = false;
  matchError: string | null = null;

  activeDetailTab: DetailTab = 'feasibility';
  candidateFilter: 'all' | 'eligible' | 'shortlisted' = 'all';
  candidateSearchQuery: string = '';
  shortlistedIds: string[] = [];
  copiedSummaryToast: boolean = false;
  copyFailed: boolean = false;
  showAuditMemo: boolean = false;

  isGeneratingAudit: boolean = false;
  claudeAuditNarrative: string | null = null;
  claudeAuditSource: string | null = null;

  modelCard: any = null;
  showModelCard: boolean = false;

  bomData: any = null;
  isBomLoading: boolean = false;
  bbbeeData: any = null;
  isBbbeeLoading: boolean = false;

  // ── Screen 3: maker ──
  activeMaker: any = null;
  activeMatch: any = null;
  makerAccepted: boolean = false;
  makerDeclined: boolean = false;
  makerCounterOffered: boolean = false;
  showCounterOfferModal: boolean = false;
  counterOfferDays: number = 28;
  counterOfferNotes: string = '';
  dispatchFeedback: string | null = null;
  whatsappDraft: string | null = null;
  whatsappSource: string | null = null;
  isDraftingWhatsApp: boolean = false;

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
    this.matchService.getHealth().subscribe({
      next: h => this.engineHealth = h,
      error: () => this.engineHealth = null
    });
    this.isLoadingMatches = true;
    this.runMatch(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.showAuditMemo) this.closeAuditMemo();
    if (this.showCounterOfferModal) this.closeCounterOffer();
  }

  // ── Derived labels ──
  get engineLabel(): string {
    if (!this.engineInfo) return 'Engine warming up';
    if (this.engineInfo.semantic === 'hybrid-embedding') {
      return `Semantic engine: MiniLM-L6-v2 · ${this.engineInfo.dimensions}-d vectors + lexical`;
    }
    return 'Semantic engine: lexical fallback (embeddings unavailable)';
  }

  get llmModelLabel(): string {
    return this.engineHealth?.claude?.model || 'Claude';
  }

  get llmConfigured(): boolean {
    return !!this.engineHealth?.claude?.configured;
  }

  get complianceRequirements(): string[] {
    const reqs: string[] = [];
    if (this.requireCipc) reqs.push('cipcRegistered');
    if (this.requireTaxPin) reqs.push('taxPinCompliant');
    if (this.requireYouthOwned) reqs.push('youthOwned');
    if (this.requireCoida) reqs.push('coidaRegistered');
    return reqs;
  }

  get unitBudgetZAR(): number {
    if (!this.requiredQuantity || this.requiredQuantity <= 0) return 0;
    return Math.round((this.budgetZAR || 0) / this.requiredQuantity);
  }

  get averageTurnaroundLabel(): string {
    const days = this.matches.map(m => m.sme?.averageTurnaroundDays).filter((d: any) => typeof d === 'number');
    if (!days.length) return 'Not loaded yet';
    return `${Math.min(...days)}–${Math.max(...days)} days`;
  }

  get bbbeeBoostLabel(): string | null {
    const boost = this.bbbeeData?.scorecardImpact?.totalScorecardBoost;
    return boost != null ? `+${boost} pts` : null;
  }

  get filteredMatches(): any[] {
    let list = this.matches;
    if (this.candidateFilter === 'eligible') {
      list = list.filter(m => m.eligible);
    } else if (this.candidateFilter === 'shortlisted') {
      list = list.filter(m => this.shortlistedIds.includes(m.sme.id));
    }
    const q = this.candidateSearchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(m =>
        [m.sme?.businessName, m.sme?.location, m.sme?.owner, m.sme?.category]
          .some(v => typeof v === 'string' && v.toLowerCase().includes(q))
      );
    }
    return list;
  }

  trackById(_: number, m: any): string {
    return m?.sme?.id ?? _;
  }

  // ── Shortlist & clipboard ──
  toggleShortlist(smeId: string, event?: Event): void {
    if (event) event.stopPropagation();
    const idx = this.shortlistedIds.indexOf(smeId);
    if (idx > -1) this.shortlistedIds.splice(idx, 1);
    else this.shortlistedIds.push(smeId);
  }

  isShortlisted(smeId: string): boolean {
    return this.shortlistedIds.includes(smeId);
  }

  setQuantity(qty: number): void {
    this.requiredQuantity = qty;
    this.revalidate();
  }

  copySourcingSummary(m: any): void {
    if (!m) return;
    const c = m.sme?.compliance || {};
    const summary = [
      'SWIFTMATCH AI — SOURCING SHORTLIST SUMMARY',
      '------------------------------------------',
      `Supplier: ${m.sme?.businessName} (${m.sme?.owner}, ${m.sme?.location})`,
      `Requirement: ${this.rfqText}`,
      `Volume: ${this.requiredQuantity} units · Budget: R${(this.budgetZAR || 0).toLocaleString()}`,
      `Delivery: ${this.resolvedSite?.name || this.targetLocation} within ${this.maxTurnaroundDays} days`,
      `Match score: ${m.matchPercentage}% · ${m.eligible ? 'All mandatory checks passed' : 'INELIGIBLE: ' + (m.ineligibilityReasons || []).join(', ')}`,
      `On record: CIPC ${c.cipcRegistered ? 'yes' : 'no'} · SARS Tax PIN ${c.taxPinCompliant ? 'yes' : 'no'} · B-BBEE level ${c.bbbeeLevel ?? 'n/a'} · COIDA ${c.coidaRegistered ? 'yes' : 'no'}${m.sme?.youthOwned ? ' · youth-owned' : ''}`,
      'Shortlist only. Documents to be verified at source before award.'
    ].join('\n');

    if (!navigator?.clipboard?.writeText) {
      this.copyFailed = true;
      setTimeout(() => this.copyFailed = false, 3000);
      return;
    }
    navigator.clipboard.writeText(summary).then(() => {
      this.copiedSummaryToast = true;
      setTimeout(() => this.copiedSummaryToast = false, 3000);
    }).catch(() => {
      this.copyFailed = true;
      setTimeout(() => this.copyFailed = false, 3000);
    });
  }

  // ── Data loading ──
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
    } else {
      this.featuredMatch = null;
      this.selectedMatch = null;
      this.activeMatch = null;
      this.activeMaker = null;
    }
    this.bomData = null;
    this.bbbeeData = null;
    this.claudeAuditNarrative = null;
    this.claudeAuditSource = null;
    this.activeDetailTab = 'feasibility';
  }

  private runMatch(navigate: boolean): void {
    this.matchError = null;
    this.matchService.runMatch(this.buildPayload()).subscribe({
      next: res => {
        this.isSubmitting = false;
        this.isLoadingMatches = false;
        this.applyMatchResponse(res);
        if (navigate) this.currentScreen = 'results';
      },
      error: err => {
        console.error('Match error:', err);
        this.isSubmitting = false;
        this.isLoadingMatches = false;
        this.matchError = err?.status === 0
          ? 'The matching service is not reachable. Start the API server on port 5050 and try again.'
          : `The matching service returned an error (${err?.status || 'unknown'}). Please try again.`;
        if (navigate) this.currentScreen = 'results';
      }
    });
  }

  retryMatch(): void {
    this.isLoadingMatches = true;
    this.runMatch(false);
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

  // ── Validation ──
  validateForm(): boolean {
    this.errors = {};
    if (!this.rfqText || this.rfqText.trim().length < 10) {
      this.errors.rfqText = 'Describe the requirement in at least 10 characters.';
    }
    if (!this.requiredQuantity || this.requiredQuantity <= 0) {
      this.errors.requiredQuantity = 'Quantity must be greater than 0.';
    }
    if (!this.budgetZAR || this.budgetZAR <= 0) {
      this.errors.budgetZAR = 'Enter a budget in rand greater than 0.';
    }
    if (!this.maxTurnaroundDays || this.maxTurnaroundDays <= 0) {
      this.errors.maxTurnaroundDays = 'Turnaround must be at least 1 day.';
    }
    if (!this.targetLocation || this.targetLocation.trim().length < 3) {
      this.errors.targetLocation = 'Enter a delivery town or city.';
    }
    return Object.keys(this.errors).length === 0;
  }

  revalidate(): void {
    if (this.isSubmitted) this.validateForm();
  }

  get errorCount(): number {
    return Object.keys(this.errors).length;
  }

  submitProcurementRequest(): void {
    this.isSubmitted = true;
    if (!this.validateForm()) {
      const firstInvalid = document.querySelector<HTMLElement>('.form-control.is-invalid');
      firstInvalid?.focus();
      return;
    }
    this.isSubmitting = true;
    this.isLoadingMatches = true;
    this.runMatch(true);
  }

  autofillWithClaude(): void {
    if (!this.rfqText || this.rfqText.trim().length < 10) {
      this.isSubmitted = true;
      this.errors.rfqText = 'Enter the requirement text before extracting.';
      return;
    }
    this.isClaudeParsing = true;
    this.claudeNotice = 'Extracting quantity, budget, deadline and site from your text...';

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
            ? 'Claude filled the fields from your text. Check them before searching.'
            : 'Fields filled by rule-based extraction (Claude key not configured). Check them before searching.';
          this.revalidate();
        }
        setTimeout(() => this.claudeNotice = null, 5000);
      },
      error: () => {
        this.isClaudeParsing = false;
        this.claudeNotice = 'Extraction service unavailable. Fill the fields manually.';
        setTimeout(() => this.claudeNotice = null, 5000);
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

  // ── Navigation ──
  navigateTo(screen: Screen): void {
    if (screen === 'maker' && !this.activeMaker) return;
    this.currentScreen = screen;
  }

  selectCandidate(match: any): void {
    this.selectedMatch = match;
    this.claudeAuditNarrative = null;
    this.claudeAuditSource = null;
    this.bomData = null;
    this.bbbeeData = null;
    if (this.activeDetailTab === 'bbbee') this.loadBbbeeScore();
    else if (this.activeDetailTab === 'bom') this.loadBomEstimate();
  }

  onCandidateKey(event: KeyboardEvent, match: any): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.selectCandidate(match);
    }
  }

  setDetailTab(tab: DetailTab): void {
    this.activeDetailTab = tab;
    if (tab === 'bbbee' && !this.bbbeeData) this.loadBbbeeScore();
    else if (tab === 'bom' && !this.bomData) this.loadBomEstimate();
    else if (tab === 'claude' && !this.claudeAuditNarrative && !this.isGeneratingAudit) {
      this.generateClaudeDeepAudit(this.selectedMatch || this.featuredMatch);
    }
  }

  private focusLater(id: string): void {
    setTimeout(() => document.getElementById(id)?.focus(), 0);
  }

  // ── Memo dialog ──
  openAuditMemo(): void {
    this.loadBbbeeScore();
    this.showAuditMemo = true;
    this.focusLater('memo-close');
  }

  closeAuditMemo(): void {
    this.showAuditMemo = false;
    this.focusLater('memo-open');
  }

  printAuditMemo(): void {
    window.print();
  }

  // ── Counter-offer dialog ──
  openCounterOffer(): void {
    this.counterOfferDays = (this.maxTurnaroundDays || 21) + 7;
    this.counterOfferNotes = `Proposing ${this.counterOfferDays} days so every unit is hand-finished and quality-checked before dispatch.`;
    this.showCounterOfferModal = true;
    this.focusLater('counterOfferDays');
  }

  closeCounterOffer(): void {
    this.showCounterOfferModal = false;
    this.focusLater('counter-open');
  }

  submitCounterOffer(): void {
    if (!this.counterOfferDays || this.counterOfferDays < 1) return;
    this.showCounterOfferModal = false;
    this.makerCounterOffered = true;
    this.makerAccepted = false;
    this.makerDeclined = false;
    this.dispatchFeedback = `Counter-proposal sent: ${this.counterOfferDays}-day turnaround requested. The buyer will confirm or decline; your contact details stay private until then.`;
  }

  openMakerExperience(match: any): void {
    this.activeMatch = match;
    this.activeMaker = match.sme;
    this.makerAccepted = false;
    this.makerDeclined = false;
    this.makerCounterOffered = false;
    this.showCounterOfferModal = false;
    this.dispatchFeedback = null;
    this.whatsappDraft = null;
    this.whatsappSource = null;
    this.currentScreen = 'maker';
    window.scrollTo({ top: 0 });
  }

  // ── Per-match helpers ──
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

  capacityUtilisation(match: any): number {
    const cap = match?.sme?.monthlyCapacityUnits || 0;
    if (!cap) return 0;
    return Math.min(999, Math.round((this.requiredQuantity / cap) * 100));
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
    this.makerCounterOffered = false;
    this.dispatchFeedback = `Accepted. A purchase-order request has been sent to the buyer and your contact details are now shared with them.`;
  }

  declineOpportunity(): void {
    this.makerDeclined = true;
    this.makerAccepted = false;
    this.makerCounterOffered = false;
    this.dispatchFeedback = 'Declined (at capacity). The next-ranked eligible supplier will be notified. Your profile is not penalised.';
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
    if (!match) return;
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
        this.claudeAuditNarrative = `${match.sme.businessName} ranks at ${match.matchPercentage}%: semantic fit ${match.radarScores?.semanticFit}%, capacity ${this.capacityRatio(match)}x of the requested ${this.requiredQuantity} units, ${match.distanceKm} km from site. A procurement officer must still verify documents at source and request a sample before award.`;
      }
    });
  }

  loadBomEstimate(): void {
    if (this.bomData || this.isBomLoading) return;
    this.isBomLoading = true;
    const rfq = {
      rawPrompt: this.rfqText,
      budgetZAR: this.budgetZAR,
      requiredQuantity: this.requiredQuantity,
      maxTurnaroundDays: this.maxTurnaroundDays
    };
    const currentSme = (this.selectedMatch || this.featuredMatch)?.sme;
    this.matchService.estimateBom({ rfq, smeId: currentSme?.id }).subscribe({
      next: data => { this.bomData = data; this.isBomLoading = false; },
      error: () => {
        this.isBomLoading = false;
        const qty = this.requiredQuantity || 150;
        const budget = this.budgetZAR || 85000;
        this.bomData = {
          quantity: qty,
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
          method: 'Offline estimate (deterministic split).',
          marginProtectionNote: 'Artisan net margin protected at 20% to prevent unviable underbidding.',
          recommendedPaymentSchedule: '30% deposit on sample sign-off · 70% on delivery confirmation.'
        };
      }
    });
  }

  loadBbbeeScore(): void {
    if (this.bbbeeData || this.isBbbeeLoading) return;
    this.isBbbeeLoading = true;
    const currentSme = (this.selectedMatch || this.featuredMatch)?.sme;
    this.matchService.getBbbeeScore({ budgetZAR: this.budgetZAR, smeId: currentSme?.id }).subscribe({
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
          bbbeeLevel: currentSme?.compliance?.bbbeeLevel ?? 1,
          scorecardImpact: { element400Points: e400, element500EsdPoints: e500, totalScorecardBoost: +(e400 + e500).toFixed(1) },
          disclaimer: 'Indicative only. Actual points depend on the measured entity\'s total procurement spend.',
          executiveSummary: `Procuring R${budget.toLocaleString()} from this Level 1 EME is recognised as R${recognized.toLocaleString()} of preferential procurement spend, worth approximately +${(e400 + e500).toFixed(1)} scorecard points.`
        };
      }
    });
  }
}
