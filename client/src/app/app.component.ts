import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatchService } from './services/match.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  isDarkMode: boolean = true;
  poolSize: number | null = 384;
  engineReady: boolean = true;
  apiReachable: boolean = true;
  showSmmeMenu: boolean = false;

  showAuditModal: boolean = false;
  showEngineModal: boolean = false;
  showCompanyModal: boolean = false;

  constructor(
    private matchService: MatchService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Permanently lock to Obsidian Enterprise Dark Theme
    localStorage.setItem('swiftmatch-theme', 'dark');
    document.documentElement.setAttribute('data-theme', 'dark');

    this.matchService.getHealth().subscribe({
      next: h => {
        this.apiReachable = true;
        this.poolSize = h.smeProfiles ?? 384;
        this.engineReady = !!h.embedding?.ready;
      },
      error: () => {
        this.apiReachable = false;
        this.poolSize = 384;
        this.engineReady = false;
      }
    });
  }

  toggleSmmeMenu(): void {
    this.showSmmeMenu = !this.showSmmeMenu;
  }

  goToWorkspace(): void {
    this.showSmmeMenu = false;
    this.router.navigate(['/'], { queryParams: { screen: 'request' } });
    setTimeout(() => {
      const el = document.getElementById('sourcing-form-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  }

  scrollToScorecard(): void {
    this.showSmmeMenu = false;
    this.router.navigate(['/'], { queryParams: { screen: 'results' } });
  }

  openAuditModal(): void {
    this.showSmmeMenu = false;
    this.showAuditModal = true;
  }

  closeAuditModal(): void {
    this.showAuditModal = false;
  }

  openEngineModal(): void {
    this.showSmmeMenu = false;
    this.showEngineModal = true;
  }

  closeEngineModal(): void {
    this.showEngineModal = false;
  }

  openCompanyModal(): void {
    this.showSmmeMenu = false;
    this.showCompanyModal = true;
  }

  closeCompanyModal(): void {
    this.showCompanyModal = false;
  }
}
