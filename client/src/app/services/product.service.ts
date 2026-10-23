import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';

const base_api = 'https://kasi-e-co.vercel.app/v1/products/';
const token = window.sessionStorage.getItem("auth-token") ? window.sessionStorage.getItem("auth-token") : null
const httpOptions = {
  headers: new HttpHeaders({ 
    'x-access-token': `${token}`,
    'Content-Type': 'application/json'
  })
};

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  navigate(arg0: any[]) {
    throw new Error('Method not implemented.');
  }

  constructor(private http: HttpClient) { }

  getAllProducts(): Observable<Product[]> {
    return this.http.get<Product[]>(base_api).pipe(
      catchError((error: any) => {
        // Handle the error here (e.g., logging, showing a friendly error message)
        throw error;
      })
    );
  }

  getOneProduct(id: any): Observable<Product> {
    const url = `${base_api}${id}`;
    return this.http.get<Product>(url).pipe(
      catchError((error: any) => {
        // Handle the error here (e.g., logging, showing a friendly error message)
        throw error;
      })
    );
  }


  getProductsByTraderId(id: any): Observable<Product> {
    const url = `${base_api}inventory/${id}`;
    return this.http.get<Product>(url, httpOptions).pipe(
      catchError((error: any) => {
        // Handle the error here (e.g., logging, showing a friendly error message)
        throw error;
      })
    );
  }

  addProduct(p_name: any, price: any, category: any, description: any, image: any): Observable<any> {
    return this.http.post(base_api + 'addProduct', {
      p_name,
      category,
      description,
      price,
      image
    }, 
    httpOptions
    );
  }
}

export interface Product {
  accessToken(accessToken: any): unknown;
  // Define the properties of a product here
}
