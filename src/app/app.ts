import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';
import { LoginDialogComponent } from './shared/login-dialog/login-dialog.component';

@Component({
  selector: 'app-root',
  imports: [LoginDialogComponent, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly title = signal('LinguaLog');
  protected readonly isLoginOpen = signal(false);
  protected readonly isMenuOpen = signal(false);

  protected toggleMenu(): void {
    this.isMenuOpen.update((value) => !value);
  }

  protected closeMenu(): void {
    this.isMenuOpen.set(false);
  }

  protected openLogin(): void {
    this.isLoginOpen.set(true);
    this.closeMenu();
  }

  protected closeLogin(): void {
    this.isLoginOpen.set(false);
  }

  protected logout(): void {
    this.authService.logout();
    this.closeMenu();
    void this.router.navigateByUrl('/logs');
  }
}
