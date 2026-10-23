import { Component, OnInit } from '@angular/core';
import { TraderService } from './services/trader.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  isDarkMode: boolean = true;
  token = window.sessionStorage.getItem('auth-token');
  traders: any[] = [];

  constructor(
    private traderService: TraderService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Check saved theme or default to dark
    const saved = localStorage.getItem('swiftmatch-theme');
    if (saved) {
      this.isDarkMode = saved === 'dark';
    } else {
      this.isDarkMode = true;
    }
    this.applyTheme();

    this.traderService.getTraders().subscribe(
      (data: any) => {
        this.traders = data;
      },
      (error: any) => {
        console.error('Error fetching traders', error);
      }
    );
  }

  toggleTheme(): void {
    this.isDarkMode = !this.isDarkMode;
    localStorage.setItem('swiftmatch-theme', this.isDarkMode ? 'dark' : 'light');
    this.applyTheme();
  }

  private applyTheme(): void {
    const theme = this.isDarkMode ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
  }

  signout(): void {
    window.sessionStorage.clear();
    window.location.replace('login');
  }

  navigateToTraderDetails(traderId: number): void {
    this.router.navigate(['/traders', traderId]);
  }
}
