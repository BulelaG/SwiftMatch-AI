import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MatchService {
  private apiUrl = 'http://localhost:5050/api';

  constructor(private http: HttpClient) { }

  getSmes(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/smes`);
  }

  getPresetRfqs(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/rfqs`);
  }

  runMatch(payload: {
    rfqText: string;
    requiredQuantity: number;
    budgetZAR: number;
    maxTurnaroundDays?: number;
    targetLocation?: string;
  }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/match`, payload);
  }

  dispatchWhatsApp(payload: {
    smeId: string;
    rfqTitle: string;
    budgetZAR: number;
    buyerName: string;
  }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/whatsapp/dispatch`, payload);
  }

  getEcosystemMetrics(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/ecosystem/metrics`);
  }

  // ── Claude AI Integration Endpoints ──
  parseRfqWithClaude(rawText: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/claude/parse-rfq`, { rawText });
  }

  getClaudeExplanation(payload: { rfq: any; smeId: string; radarScores: any }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/claude/explain`, payload);
  }

  draftClaudeWhatsApp(payload: { smeId: string; rfq: any }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/claude/whatsapp`, payload);
  }

  // ── New Investor-Grade Capability Endpoints ──
  estimateBom(payload: { rfq: any; smeId?: string }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/bom`, payload);
  }

  getBbbeeScore(payload: { budgetZAR: number; smeId?: string }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/bbbee/score`, payload);
  }
}
