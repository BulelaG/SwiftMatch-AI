import { Component, OnInit, Input } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TraderService } from '../services/trader.service';
import { ProductService } from '../services/product.service';

@Component({
  selector: 'app-trader-detail',
  templateUrl: './trader-detail.component.html',
  styleUrls: ['./trader-detail.component.css']
})
export class TraderDetailComponent implements OnInit {
  trader: any;
  products: any[] = [];
  isLoadingProducts = false;
  copied = false;
  @Input() traderId?: any;

  constructor(
    private route: ActivatedRoute,
    private traderService: TraderService,
    private productService: ProductService
  ) { }

  ngOnInit(){
    this.getOne();
  }

  getOne(){
    const id = this.traderId || this.route.snapshot.paramMap.get("id");
    if (id) {
      this.traderService.getTrader(id).subscribe({
        next: data => {
          this.trader = data;
          this.loadTraderProducts(id);
        },
        error: err => {
          console.log(err.message);
        }
      });
    }
  }

  loadTraderProducts(traderId: any) {
    this.isLoadingProducts = true;
    this.productService.getAllProducts().subscribe({
      next: (allProducts: any) => {
        if (Array.isArray(allProducts)) {
          this.products = allProducts.filter((p: any) => 
            p.createdBy === traderId || 
            (this.trader && (p.createdBy === this.trader.email || p.createdBy === this.trader.businessName))
          );
        }
        this.isLoadingProducts = false;
      },
      error: () => {
        this.isLoadingProducts = false;
      }
    });
  }

  copyStoreLink() {
    if (navigator && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      this.copied = true;
      setTimeout(() => this.copied = false, 2500);
    }
  }

  getWhatsAppUrl(productName?: string): string {
    if (!this.trader || !this.trader.cell) return '';
    let cleanNumber = ('' + this.trader.cell).replace(/\D/g, '');
    if (cleanNumber.startsWith('0')) {
      cleanNumber = '27' + cleanNumber.substring(1);
    }
    const store = this.trader.businessName || 'Kasi-eCo';
    const message = productName 
      ? `Hi ${this.trader.fname || ''}! I am interested in ordering "${productName}" from your store "${store}" on Kasi-eCo.`
      : `Hi ${this.trader.fname || ''}! I found your store "${store}" on Kasi-eCo.`;
    return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
  }
}