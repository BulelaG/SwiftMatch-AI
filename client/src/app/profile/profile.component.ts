import { Component, OnInit } from '@angular/core';
import { TokenStorageService } from '../_services/token-storage.service';
import { TraderService } from '../services/trader.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit {
  currentTrader: any;
  showUpdateForm: boolean = false;
  imageUrl: string = '';
  trader: any = {};

  constructor(private token: TokenStorageService, private traderService: TraderService) { }

  ngOnInit(): void {
    if (!window.sessionStorage.getItem('auth-token')) {
      // Redirect to home if the user is not authenticated
      return window.location.replace('/home');
    }

    this.currentTrader = this.token.getUser();
    this.getOne();

    this.imageUrl = sessionStorage.getItem('profileImageUrl') || '';
    this.currentTrader.email = sessionStorage.getItem('profileEmail') || this.currentTrader.email;
  }

  logout(): void {
    this.token.signOut();
    window.location.replace('/home');
  }

  toggleUpdateForm() {
    // Function to toggle the visibility of the update profile form
    this.showUpdateForm = !this.showUpdateForm;
    if (this.showUpdateForm) {
      // Initialize the trader object with the current trader data
      this.trader = { ...this.currentTrader };
    }
  }  

  update() {
    // Function to cancel the update operation and hide the update profile form
    this.showUpdateForm = !this.showUpdateForm;
    console.log(this.showUpdateForm)
  }

  getOne() {
    this.traderService.getTrader(this.currentTrader.id).subscribe({
      next: (data: any) => {
        this.trader = data;
        console.log(this.trader);
      },
      error: (error: any) => {
        console.error('Error fetching trader data:', error);
      }
    });
  }

  deleteProfile(): void {
    console.log('Deleting profile for trader ID:', this.currentTrader.id);
    this.traderService.deleteTraderProfile(this.currentTrader.id).subscribe(
      (response: any) => {
        console.log('Profile deleted successfully!', response);
        // Optionally, you can perform actions on success, show a success message, etc.
        this.token.signOut(); // Log out the trader after deleting the profile.
        window.location.replace('/home');
      },
      (error: any) => {
        console.error('Error deleting profile:', error);
        // Optionally, handle the error and show an error message.
      }
    );
  }

  updateProfile(): void {
    this.traderService.updateTrader(this.trader, this.currentTrader.id).subscribe({
      next: (response: any) => {
        // this.getOne()
        console.log('Profile updated successfully!', response);
        // Optionally, you can perform actions on success, show a success message, etc.
        this.update(); // Hide the update form after successful update.
      },
      error: (e: any) => {
        console.error('Error updating profile:', e);
        // Optionally, handle the error and show an error message.
      }
    });
  }
}