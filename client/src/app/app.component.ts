import { Component, OnInit } from '@angular/core';
import { MatchService } from './services/match.service';

export type ThemeName = 'dark' | 'light' | 'uber';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  readonly themes: { id: ThemeName; label: string; icon: string; description: string }[] = [
    { id: 'dark', label: 'Dark', icon: 'bi-moon-stars-fill', description: 'Obsidian dark theme' },
    { id: 'light', label: 'Light', icon: 'bi-sun-fill', description: 'Light enterprise theme' },
    { id: 'uber', label: 'Uber', icon: 'bi-car-front-fill', description: 'Uber Base palette: black, white and safety blue' }
  ];
  theme: ThemeName = 'dark';
  poolSize: number | null = null;
  engineReady: boolean = false;
  apiReachable: boolean = true;

  constructor(private matchService: MatchService) {}

  ngOnInit(): void {
    const saved = localStorage.getItem('swiftmatch-theme');
    this.theme = this.themes.some(t => t.id === saved) ? (saved as ThemeName) : 'dark';
    this.applyTheme();

    this.matchService.getHealth().subscribe({
      next: h => {
        this.apiReachable = true;
        this.poolSize = h.smeProfiles ?? null;
        this.engineReady = !!h.embedding?.ready;
      },
      error: () => {
        this.apiReachable = false;
        this.poolSize = null;
        this.engineReady = false;
      }
    });
  }

  get isDarkMode(): boolean {
    return this.theme === 'dark';
  }

  setTheme(theme: ThemeName): void {
    this.theme = theme;
    localStorage.setItem('swiftmatch-theme', theme);
    this.applyTheme();
  }

  private applyTheme(): void {
    document.documentElement.setAttribute('data-theme', this.theme);
  }
}
