
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { Product } from '../services/product.service';
import { MessageService } from '../message.service';

@Injectable({ providedIn: 'root'})
export class ProductInventoryService {


  getAllProducts() {
    throw new Error('Method not implemented.');
  }


  private KasiecoUrl = 'https://kasi-e-co.vercel.app/v1/products';  // URL to web api

  httpOptions = {
    headers: new HttpHeaders({ 'Content-Type': 'application/json' })
  };

  constructor(
    private http: HttpClient,
    private messageService: MessageService) { }

  /** GET Products from the server */
  getProducts(): Observable<Product[]> {
    return this.http.get<Product[]>(this.KasiecoUrl)
      .pipe(
        tap(_ => this.log('fetched products')),
        catchError(this.handleError<Product[]>('getProducts', []))
      );
  }

  /** GET product by id. Return `undefined` when id not found */
  getProductNo404(id: number): Observable<Product> {
    const url = `${this.KasiecoUrl}/?id=${id}`;
    return this.http.get<Product[]>(url)
      .pipe(
        map(products => products[0]), // returns a {0|1} element array
        tap(h => {
          const outcome = h ? 'fetched' : 'did not find';
          this.log(`${outcome} product id=${id}`);
        }),
        catchError(this.handleError<Product>(`getProduct id=${id}`))
      );
  }

  /** GET product by id. Will 404 if id not found */
  getProduct(id: any): Observable<Product> {
    const url = `${this.KasiecoUrl}/${id}`;
    return this.http.get<Product>(url).pipe(
      tap(_ => this.log(`fetched product id=${id}`)),
      catchError(this.handleError<Product>(`geProduct id=${id}`))
    );
  }

  /* GET products whose name contains search term */
  searchProducts(term: string): Observable<Product[]> {
    if (!term.trim()) {
      // if not search term, return empty product array.
      return of([]);
    }
    return this.http.get<Product[]>(`${this.KasiecoUrl}/?name=${term}`).pipe(
      tap(x => x.length ?
         this.log(`found products matching "${term}"`) :
         this.log(`no products matching "${term}"`)),
      catchError(this.handleError<Product[]>('searchHeroes', []))
    );
  }

  //////// Save methods //////////

  /** POST: add a new product to the server */
  addProduct(product: any): Observable<Product> {
    return this.http.post<Product>(`${this.KasiecoUrl}/addProduct`, product).pipe(
      tap((newProduct: Product) => this.log(`added product `)),
      catchError(this.handleError<Product>('addPtroduct'))
    );
  }

  /** DELETE: delete the product from the server */
  deleteProduct(id: any): Observable<Product> {
    const url = `${this.KasiecoUrl}/${id}`;

    return this.http.delete<Product>(url).pipe(
      tap(_ => this.log(`deleted product id=${id}`)),
      catchError(this.handleError<Product>('deleteProduct'))
    );
  }

  /** PUT: update the product on the server */
  updateProduct(product: any): Observable<any> {

    const url = `${this.KasiecoUrl}/${product.id}`; // Update the URL with the product's ID

    return this.http.put(url, product, this.httpOptions).pipe(
      tap(_ => this.log(`updated product id=${product.id}`)),
      catchError(this.handleError<any>('updateProduct'))
    );
  }

  /**
   * Handle Http operation that failed.
   * Let the app continue.
   *
   * @param operation - name of the operation that failed
   * @param result - optional value to return as the observable result
   */
  private handleError<T>(operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {

      // TODO: send the error to remote logging infrastructure
      console.error(error); // log to console instead

      // TODO: better job of transforming error for user consumption
      this.log(`${operation} failed: ${error.message}`);

      // Let the app keep running by returning an empty result.
      return of(result as T);
    };
  }

  /** Log a HeroService message with the MessageService */
  private log(message: string) {
    this.messageService.add(`HeroService: ${message}`);
  }
}