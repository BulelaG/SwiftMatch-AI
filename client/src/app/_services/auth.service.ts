import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

const AUTH_API = 'https://kasi-e-co.vercel.app/v1/traders/';
// const AUTH_PRODUCTS_API = 'https://kasi-e-co.vercel.app/v1/products/';


const httpOptions = {
  headers: new HttpHeaders({ 'Content-Type': 'application/json' })
};

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  constructor(private http: HttpClient) { }

  login(email: string, password: string): Observable<any> {
    return this.http.post(AUTH_API + 'signin', {
      email,
      password
    }, httpOptions);
  }

  register(fname: any, cell: any, businessName: any, address: any, image: any, email: any,  password: any): Observable<any> {
    return this.http.post(AUTH_API + 'signup', {
      fname,
      email,
      cell,
      businessName,
      address,
      password,
      image
    }, httpOptions);
  }
}
