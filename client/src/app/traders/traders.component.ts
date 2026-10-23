import { Component, OnInit } from '@angular/core';
import { Trader } from '../trader';
import { TraderService } from '../services/trader.service';

@Component({
  selector: 'app-traders',
  templateUrl: './traders.component.html',
  styleUrls: ['./traders.component.css']
})
export class TradersComponent implements OnInit {
  traders: Trader[] = [];
  filteredTraders: Trader[] = [];
  searchTerm = '';
  isLoading = true;

  constructor(private traderService: TraderService) {}

  ngOnInit(): void {
    this.getTraders();
  }

  getTraders(): void {
    this.isLoading = true;
    this.traderService.getTraders().subscribe({
      next: (traders: Trader[]) => {
        this.traders = traders || [];
        this.filteredTraders = [...this.traders];
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error fetching traders:', err);
        this.isLoading = false;
      }
    });
  }

  search(): void {
    if (this.searchTerm.trim() !== '') {
      const term = this.searchTerm.toLowerCase().trim();
      this.filteredTraders = this.traders.filter((trader: Trader) => {
        const businessName = (trader.businessName || '').toLowerCase();
        const traderName = (trader.trader_name || '').toLowerCase();
        return businessName.includes(term) || traderName.includes(term);
      });
    } else {
      this.filteredTraders = [...this.traders];
    }
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.filteredTraders = [...this.traders];
  }

  getWhatsAppUrl(trader: Trader): string {
    if (!trader.cell) return '';
    let clean = ('' + trader.cell).replace(/\D/g, '');
    if (clean.startsWith('0')) {
      clean = '27' + clean.substring(1);
    }
    const message = `Hi! I found your store "${trader.businessName}" on Kasi-eCo.`;
    return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
  }
}
