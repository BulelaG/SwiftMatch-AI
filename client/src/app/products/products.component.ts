import { Component, OnInit } from '@angular/core';
import { ProductService } from '../services/product.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-products',
  templateUrl: './products.component.html',
  styleUrls: ['./products.component.css']
})
export class ProductsComponent implements OnInit {
  products: any[] = [];
  filteredProducts: any[] = [];
  searchTerm = '';
  selectedCategory = 'all';
  categories: string[] = [];
  isLoading = true;

  constructor(
    private productService: ProductService, 
    private router: Router
  ) { }

  ngOnInit() {
    this.getAllProducts();
  }

  getAllProducts() {
    this.isLoading = true;
    this.productService.getAllProducts().subscribe({
      next: (data: any[]) => {
        this.products = data || [];
        this.filteredProducts = [...this.products];
        this.extractCategories();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error occurred while retrieving products:', error);
        this.isLoading = false;
      }
    });
  }

  extractCategories() {
    const cats = new Set<string>();
    this.products.forEach(p => {
      if (p.category && p.category.trim() !== '') {
        cats.add(p.category.trim());
      }
    });
    this.categories = Array.from(cats);
  }

  filterByCategory(category: string) {
    this.selectedCategory = category;
    this.applyFilters();
  }

  search() {
    this.applyFilters();
  }

  clearSearch() {
    this.searchTerm = '';
    this.selectedCategory = 'all';
    this.filteredProducts = [...this.products];
  }

  applyFilters() {
    let result = [...this.products];

    if (this.selectedCategory !== 'all') {
      result = result.filter(p => (p.category || '').toLowerCase() === this.selectedCategory.toLowerCase());
    }

    if (this.searchTerm.trim() !== '') {
      const term = this.searchTerm.toLowerCase().trim();
      result = result.filter(p => 
        (p.p_name || '').toLowerCase().includes(term) ||
        (p.description || '').toLowerCase().includes(term) ||
        (p.category || '').toLowerCase().includes(term)
      );
    }

    this.filteredProducts = result;
  }

  viewProductDetails(product: any) {
    if (product && product.id) {
      this.router.navigate(['/product-detail', product.id]);
    }
  }
}
