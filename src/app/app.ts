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

  protected openLogin(): void {
    this.isLoginOpen.set(true);
  }

  protected closeLogin(): void {
    this.isLoginOpen.set(false);
  }

  protected logout(): void {
    this.authService.logout();
    void this.router.navigateByUrl('/logs');
  }
}
