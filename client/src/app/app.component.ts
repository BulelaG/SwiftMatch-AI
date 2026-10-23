import { Component, OnInit } from '@angular/core';
import { MatchService } from './services/match.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  isDarkMode: boolean = true;
  poolSize: number | null = null;
  engineReady: boolean = false;

  constructor(private matchService: MatchService) {}

  ngOnInit(): void {
    const saved = localStorage.getItem('swiftmatch-theme');
    this.isDarkMode = saved ? saved === 'dark' : true;
    this.applyTheme();

    this.matchService.getHealth().subscribe({
      next: h => {
        this.poolSize = h.smeProfiles ?? null;
        this.engineReady = !!h.embedding?.ready;
      },
      error: () => { this.poolSize = null; }
    });
  }

  toggleTheme(): void {
    this.isDarkMode = !this.isDarkMode;
    localStorage.setItem('swiftmatch-theme', this.isDarkMode ? 'dark' : 'light');
    this.applyTheme();
  }

  private applyTheme(): void {
    document.documentElement.setAttribute('data-theme', this.isDarkMode ? 'dark' : 'light');
  }
}
