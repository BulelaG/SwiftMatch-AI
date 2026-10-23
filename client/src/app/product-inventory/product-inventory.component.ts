import { Component, OnInit } from '@angular/core';
import { ProductInventoryService } from '../services/product-inventory.service';
import { Product } from '../products';
import { TokenStorageService } from '../_services/token-storage.service';
import { ProductService } from '../services/product.service';

@Component({
  selector: 'app-product-inventory',
  templateUrl: './product-inventory.component.html',
  styleUrls: ['./product-inventory.component.css']
})
export class ProductInventoryComponent implements OnInit {
  products: any[] = [];
  form: any = {
    p_name: '',
    price: '',
    description: '',
    category: '',
    image: ''
  };
  isSubmitting = false;
  isSuccessful = false;
  isFailed = false;
  errorMessage = '';
  currentUser: any;
  isLoading = true;

  constructor(
    private productInventoryService: ProductInventoryService, 
    private token: TokenStorageService,  
    private productService: ProductService
  ) {}

  ngOnInit() {
    if (!window.sessionStorage.getItem('auth-token')) {
      return window.location.replace('/home');
    }
    this.currentUser = this.token.getUser();
    this.getProductsTraderId();
  }

  onSubmit(): void {
    const { p_name, category, description, price, image } = this.form;
    this.isSubmitting = true;
    this.isSuccessful = false;
    this.isFailed = false;

    this.productService.addProduct(p_name, category, description, price, image).subscribe({
      next: (data: any) => {
        this.isSuccessful = true;
        this.isFailed = false;
        this.isSubmitting = false;
        this.resetForm();
        this.getProductsTraderId();
      },
      error: (err: any) => {
        this.errorMessage = err?.error?.message || 'Failed to add product. Please check your inputs.';
        this.isFailed = true;
        this.isSubmitting = false;
      }
    });
  }

  resetForm(): void {
    this.form = {
      p_name: '',
      price: '',
      description: '',
      category: '',
      image: ''
    };
  }

  delete(product: Product): void {
    if (confirm(`Are you sure you want to delete "${product.p_name || 'this product'}"?`)) {
      this.productInventoryService.deleteProduct(product.id).subscribe({
        next: () => {
          this.products = this.products.filter((p: Product) => p.id !== product.id);
        },
        error: (err) => {
          console.error('Delete failed:', err);
        }
      });
    }
  }

  handleImageInput(event: any): void {
    const file: File = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.form.image = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  getProductsTraderId(): void {
    this.isLoading = true;
    if (this.currentUser && this.currentUser.id) {
      this.productService.getProductsByTraderId(this.currentUser.id).subscribe({
        next: (data: any) => {
          this.products = data || [];
          this.isLoading = false;
        },
        error: (err: any) => {
          console.log(err.message);
          this.isLoading = false;
        }
      });
    } else {
      this.isLoading = false;
    }
  }
}
