import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login-dialog',
  imports: [ReactiveFormsModule],
  templateUrl: './login-dialog.component.html',
  styleUrl: './login-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginDialogComponent {
  readonly closed = output<void>();

  private readonly authService = inject(AuthService);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly isPasswordVisible = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly isWobbling = signal(false);
  protected readonly form = this.formBuilder.nonNullable.group({
    userName: '',
    password: '',
  });

  protected close(): void {
    this.closed.emit();
  }

  protected togglePasswordVisibility(): void {
    this.isPasswordVisible.update((value) => !value);
  }

  protected async submit(): Promise<void> {
    const result = await this.authService.login(
      this.form.controls.userName.value,
      this.form.controls.password.value,
    );

    if (result.success) {
      this.errorMessage.set('');
      this.closed.emit();
      return;
    }

    this.errorMessage.set(result.message);
    this.form.controls.password.setValue('');
    this.wobble();
  }

  private wobble(): void {
    this.isWobbling.set(false);
    requestAnimationFrame(() => this.isWobbling.set(true));
  }
}
