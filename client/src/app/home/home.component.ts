import { Component, OnInit } from '@angular/core';
import { MatchService } from '../services/match.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  // RFQ Input Form
  rfqText: string = 'Looking for 150 handmade genuine leather conference folios and desk pads for our upcoming leadership summit in Sandton. Must be 100% youth-owned, based in Gauteng, delivery required within 3 weeks. Budget R85,000.';
  requiredQuantity: number = 150;
  budgetZAR: number = 85000;
  maxTurnaroundDays: number = 21;
  targetLocation: string = 'Sandton, Gauteng';

  // State flags
  isMatching: boolean = false;
  hasMatched: boolean = false;
  selectedTab: 'match' | 'ecosystem' = 'match';

  // Data
  presetRfqs: any[] = [];
  matches: any[] = [];
  selectedMatch: any = null;
  ecosystemMetrics: any = null;

  // WhatsApp simulation modal
  activeWhatsAppPayload: any = null;
  showWhatsAppModal: boolean = false;

  // Claude AI state
  isClaudeParsing: boolean = false;
  isClaudeAuditing: boolean = false;
  isClaudeDrafting: boolean = false;
  claudeAuditNarrative: string | null = null;
  claudeStatusNotice: string | null = null;

  constructor(private matchService: MatchService) { }

  ngOnInit(): void {
    this.loadPresets();
    this.loadMetrics();
    // Auto-run first match on load for instant demo readiness
    this.executeMatch();
  }

  getScoreGradient(pct: number): string {
    const score = Math.max(0, Math.min(100, pct || 0));
    return `conic-gradient(#10b981 0% ${score}%, rgba(255, 255, 255, 0.08) ${score}% 100%)`;
  }

  loadPresets(): void {
    this.matchService.getPresetRfqs().subscribe({
      next: data => this.presetRfqs = data,
      error: err => console.error('Error fetching RFQ presets:', err)
    });
  }

  loadMetrics(): void {
    this.matchService.getEcosystemMetrics().subscribe({
      next: data => this.ecosystemMetrics = data,
      error: err => console.error('Error fetching ecosystem metrics:', err)
    });
  }

  applyPreset(preset: any): void {
    this.rfqText = preset.rawPrompt;
    this.requiredQuantity = preset.requiredQuantity;
    this.budgetZAR = preset.budgetZAR;
    this.maxTurnaroundDays = preset.maxTurnaroundDays;
    this.targetLocation = preset.targetLocation;
    this.claudeAuditNarrative = null;
    this.executeMatch();
  }

  executeMatch(): void {
    this.isMatching = true;
    this.matchService.runMatch({
      rfqText: this.rfqText,
      requiredQuantity: this.requiredQuantity,
      budgetZAR: this.budgetZAR,
      maxTurnaroundDays: this.maxTurnaroundDays,
      targetLocation: this.targetLocation
    }).subscribe({
      next: res => {
        this.matches = res.matches || [];
        this.isMatching = false;
        this.hasMatched = true;
        if (this.matches.length > 0) {
          this.selectedMatch = this.matches[0];
        }
      },
      error: err => {
        console.error('Matching failed:', err);
        this.isMatching = false;
      }
    });
  }

  // ── Claude AI: Smart Parse natural text RFQ ──
  smartParseWithClaude(): void {
    if (!this.rfqText.trim()) return;
    this.isClaudeParsing = true;
    this.claudeStatusNotice = 'Claude 3.5 Sonnet extracting structured procurement parameters...';

    this.matchService.parseRfqWithClaude(this.rfqText).subscribe({
      next: res => {
        this.isClaudeParsing = false;
        this.claudeStatusNotice = null;
        if (res.structured) {
          if (res.structured.requiredQuantity) this.requiredQuantity = res.structured.requiredQuantity;
          if (res.structured.budgetZAR) this.budgetZAR = res.structured.budgetZAR;
          if (res.structured.maxTurnaroundDays) this.maxTurnaroundDays = res.structured.maxTurnaroundDays;
          if (res.structured.targetLocation) this.targetLocation = res.structured.targetLocation;
          this.executeMatch();
        }
      },
      error: err => {
        console.warn('Claude parse error/fallback:', err);
        this.isClaudeParsing = false;
        this.claudeStatusNotice = 'Standard rule-based extractor applied (add ANTHROPIC_API_KEY in .env for live Claude)';
        setTimeout(() => this.claudeStatusNotice = null, 4000);
        this.executeMatch();
      }
    });
  }

  selectMatchForAudit(match: any): void {
    this.selectedMatch = match;
    this.claudeAuditNarrative = null;
  }

  // ── Claude AI: Generate deep explainability narrative ──
  generateClaudeAudit(): void {
    if (!this.selectedMatch) return;
    this.isClaudeAuditing = true;

    const payload = {
      rfq: {
        rawPrompt: this.rfqText,
        budgetZAR: this.budgetZAR,
        requiredQuantity: this.requiredQuantity,
        maxTurnaroundDays: this.maxTurnaroundDays
      },
      smeId: this.selectedMatch.sme.id,
      radarScores: {
        semantic: this.selectedMatch.radarScores.semanticCraftRelevance,
        capacity: this.selectedMatch.radarScores.capacityFeasibility,
        compliance: this.selectedMatch.radarScores.statutoryCompliance,
        geographic: this.selectedMatch.radarScores.geographicProximity,
        reputation: this.selectedMatch.radarScores.reputationAndOrders,
        overall: this.selectedMatch.matchPercentage
      }
    };

    this.matchService.getClaudeExplanation(payload).subscribe({
      next: res => {
        this.isClaudeAuditing = false;
        this.claudeAuditNarrative = res.narrative;
      },
      error: err => {
        console.warn('Claude explanation error:', err);
        this.isClaudeAuditing = false;
        this.claudeAuditNarrative = `${this.selectedMatch.sme.businessName} demonstrated strong deterministic score performance with ${this.selectedMatch.matchPercentage}% overall fit. Primary strengths include verified production capacity (${this.selectedMatch.sme.monthlyCapacityUnits} units/month) and proximity to delivery hub (${this.selectedMatch.distanceKm} km). Prior to purchase order dispatch, confirm valid CIPC registration and COIDA letter of good standing.`;
      }
    });
  }

  // ── WhatsApp dispatch ──
  deployToWhatsApp(match: any): void {
    this.matchService.dispatchWhatsApp({
      smeId: match.sme.id,
      rfqTitle: this.rfqText.substring(0, 60) + '...',
      budgetZAR: this.budgetZAR,
      buyerName: 'Anglo American ESD Procurement'
    }).subscribe({
      next: res => {
        this.activeWhatsAppPayload = res.payload;
        this.showWhatsAppModal = true;
      },
      error: err => console.error('WhatsApp dispatch error:', err)
    });
  }

  // ── Claude AI: Tone-adaptive bilingual WhatsApp draft ──
  draftWithClaude(): void {
    if (!this.selectedMatch) return;
    this.isClaudeDrafting = true;

    this.matchService.draftClaudeWhatsApp({
      smeId: this.selectedMatch.sme.id,
      rfq: {
        rawPrompt: this.rfqText,
        budgetZAR: this.budgetZAR,
        requiredQuantity: this.requiredQuantity,
        maxTurnaroundDays: this.maxTurnaroundDays
      }
    }).subscribe({
      next: res => {
        this.isClaudeDrafting = false;
        if (this.activeWhatsAppPayload) {
          this.activeWhatsAppPayload.message = res.message;
        }
      },
      error: err => {
        console.warn('Claude WhatsApp drafting fallback:', err);
        this.isClaudeDrafting = false;
      }
    });
  }

  closeWhatsAppModal(): void {
    this.showWhatsAppModal = false;
  }
}
