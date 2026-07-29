import { NgOptimizedImage } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { AppLockService } from '../../core/app-lock.service';
import { SecuritySettingsService } from '../../core/security-settings.service';
import { SecurityService } from '../../core/security.service';

@Component({
  selector: 'app-lock',
  imports: [NgOptimizedImage, ReactiveFormsModule],
  templateUrl: './app-lock.component.html',
  styleUrl: './app-lock.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppLockComponent {
  protected readonly lock = inject(AppLockService);
  protected readonly settings = inject(SecuritySettingsService);
  protected readonly security = inject(SecurityService);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly unlockForm = this.formBuilder.nonNullable.group({
    pin: ['', [Validators.required, Validators.pattern(/^\d{4,8}$/)]],
  });
  protected readonly error = signal('');
  protected readonly verifying = signal(false);
  protected readonly wobble = signal(false);
  private readonly pinInput = viewChild<ElementRef<HTMLInputElement>>('pinInput');

  constructor() {
    afterNextRender(() => {
      if (!this.lock.locked()) {
        return;
      }

      if (this.settings.settings().biometricEnabled && this.security.biometricAvailable) {
        this.security.requestBiometric();
      } else {
        this.pinInput()?.nativeElement.focus();
      }
    });
  }

  protected async unlockWithPin(): Promise<void> {
    if (this.unlockForm.invalid) {
      this.showError('Enter your 4 to 8 digit PIN.');
      return;
    }

    this.verifying.set(true);
    try {
      const valid = await this.security.verifyPin(
        this.unlockForm.controls.pin.value,
        this.settings.settings(),
      );

      if (!valid) {
        this.unlockForm.reset({ pin: '' });
        this.showError('Wrong PIN. Please try again.');
        this.pinInput()?.nativeElement.focus();
        return;
      }

      this.unlockForm.reset({ pin: '' });
      this.clearError();
      this.lock.unlock();
    } catch {
      this.showError('PIN verification failed. Please try again.');
    } finally {
      this.verifying.set(false);
    }
  }

  protected useFingerprint(): void {
    this.clearError();
    this.security.requestBiometric();
  }

  protected clearError(): void {
    this.error.set('');
    this.wobble.set(false);
  }

  private showError(message: string): void {
    this.error.set(message);
    this.wobble.set(false);
    window.setTimeout(() => this.wobble.set(true));
  }
}
