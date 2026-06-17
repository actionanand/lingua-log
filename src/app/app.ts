import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';
import { LogSearchService } from './core/log-search.service';
import { ThemeService } from './core/theme.service';
import { LoginDialogComponent } from './shared/login-dialog/login-dialog.component';

@Component({
  selector: 'app-root',
  imports: [LoginDialogComponent, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly authService = inject(AuthService);
  protected readonly logSearchService = inject(LogSearchService);
  protected readonly themeService = inject(ThemeService);
  private readonly router = inject(Router);
  protected readonly title = signal('LinguaLog');
  protected readonly isLoginOpen = signal(false);
  protected readonly isMenuOpen = signal(false);
  protected readonly isSearchOpen = signal(false);

  protected toggleMenu(): void {
    this.isMenuOpen.update((value) => !value);
  }

  protected closeMenu(): void {
    this.isMenuOpen.set(false);
  }

  protected toggleSearch(): void {
    this.isSearchOpen.update((value) => !value);
    this.closeMenu();
  }

  protected closeSearch(): void {
    this.isSearchOpen.set(false);
  }

  protected updateSearch(value: string): void {
    this.logSearchService.updateQuery(value);
  }

  protected clearSearch(): void {
    this.logSearchService.clear();
  }

  protected cycleTheme(): void {
    this.themeService.cyclePreference();
  }

  protected openLogin(): void {
    this.isLoginOpen.set(true);
    this.closeMenu();
    this.closeSearch();
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
