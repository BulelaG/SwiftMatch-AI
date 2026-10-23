import { Component, OnInit } from '@angular/core';
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

  constructor(private matchService: MatchService) {}

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
}
