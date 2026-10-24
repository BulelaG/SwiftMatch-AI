import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface MatchRequest {
  rfqText: string;
  category?: string;
  requiredQuantity: number;
  budgetZAR: number;
  maxTurnaroundDays?: number;
  targetLocation?: string;
  complianceRequirements?: string[];
}

@Injectable({
  providedIn: 'root'
})
export class MatchService {
  // Local dev talks to the server on :5050; any other host is the hosted build.
  private apiUrl = ['localhost', '127.0.0.1'].includes(window.location.hostname)
    ? 'http://localhost:5050/api'
    : 'https://swiftmatch-ai-api.onrender.com/api';

  constructor(private http: HttpClient) { }

  getHealth(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/health`);
  }

  getSmes(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/smes`);
  }

  getPresetRfqs(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/rfqs`);
  }

  getModelCard(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/model-card`);
  }

  runMatch(payload: MatchRequest): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/match`, payload);
  }

  getEcosystemMetrics(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/ecosystem/metrics`);
  }

  // ── Claude AI Integration Endpoints ──
  parseRfqWithClaude(rawText: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/claude/parse-rfq`, { rawText });
  }

  getClaudeExplanation(payload: { rfq: any; smeId: string; radarScores: any; evidence?: any }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/claude/explain`, payload);
  }

  draftClaudeWhatsApp(payload: { smeId: string; rfq: any }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/claude/whatsapp`, payload);
  }

  // ── Commercial Panels ──
  estimateBom(payload: { rfq: any; smeId?: string }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/bom`, payload);
  }

  getBbbeeScore(payload: { budgetZAR: number; smeId?: string }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/bbbee/score`, payload);
  }
}
