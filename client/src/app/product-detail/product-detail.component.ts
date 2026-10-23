import { Component, OnInit } from '@angular/core';
import { ProductService } from '../services/product.service';
import { TraderService } from '../services/trader.service';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-product-detail',
  templateUrl: './product-detail.component.html',
  styleUrls: ['./product-detail.component.css']
})
export class ProductDetailComponent implements OnInit{
  product: any;
  trader: any;
  isLoading: boolean = true;

  constructor( 
    private productService: ProductService,
    private traderService: TraderService,
    private route: ActivatedRoute
  ){}

  ngOnInit(){
    this.getOne();
  }

  getOne(){
    let id = this.route.snapshot.paramMap.get("id");
    this.isLoading = true;
    this.productService.getOneProduct(id).subscribe({
      next: data => {
        this.product = data;
        this.isLoading = false;
        if (this.product && this.product.createdBy) {
          this.traderService.getTrader(this.product.createdBy).subscribe({
            next: traderData => {
              this.trader = traderData;
            },
            error: () => {}
          });
        }
      },
      error: err => {
        this.isLoading = false;
        console.log(err.message);
      }
    });
  }

  getWhatsAppUrl(): string {
    if (!this.trader || !this.trader.cell) return '';
    let cleanNumber = ('' + this.trader.cell).replace(/\D/g, '');
    if (cleanNumber.startsWith('0')) {
      cleanNumber = '27' + cleanNumber.substring(1);
    }
    const message = `Hi! I found your product "${this.product?.p_name || 'item'}" (R${this.product?.price || ''}) on Kasi-eCo and would like to inquire.`;
    return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
  }
}
