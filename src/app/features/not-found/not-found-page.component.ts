import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { LoginDialogComponent } from '../../shared/login-dialog/login-dialog.component';

@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink, LoginDialogComponent],
  templateUrl: './not-found-page.component.html',
  styleUrl: './not-found-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundPageComponent {
  protected readonly authService = inject(AuthService);
  protected readonly isLoginOpen = signal(false);

  protected openLogin(): void {
    this.isLoginOpen.set(true);
  }

  protected closeLogin(): void {
    this.isLoginOpen.set(false);
  }
}
