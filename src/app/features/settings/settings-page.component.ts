import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AppLockService } from '../../core/app-lock.service';
import { SecuritySettingsService } from '../../core/security-settings.service';
import { SecurityService } from '../../core/security.service';

@Component({
  selector: 'app-settings-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './settings-page.component.html',
  styleUrl: './settings-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(window:biometric-enabled)': 'onBiometricEnabled()',
    '(document:keydown.escape)': 'closeActiveDialog()',
  },
})
export class SettingsPageComponent {
  protected readonly settings = inject(SecuritySettingsService);
  protected readonly security = inject(SecurityService);
  protected readonly lock = inject(AppLockService);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly pinDialogOpen = signal(false);
  protected readonly removeDialogOpen = signal(false);
  protected readonly formError = signal('');
  protected readonly savingPin = signal(false);
  protected readonly message = signal('');
  protected readonly pinForm = this.formBuilder.nonNullable.group({
    pin: ['', [Validators.required, Validators.pattern(/^\d{4,8}$/)]],
    confirmation: ['', [Validators.required, Validators.pattern(/^\d{4,8}$/)]],
  });
  protected readonly biometricDescription = computed(() => {
    if (!this.security.biometricAvailable) {
      return 'Available on supported Android devices';
    }
    if (!this.settings.settings().pinEnabled) {
      return 'Create a PIN first';
    }
    return this.settings.settings().biometricEnabled
      ? 'Enabled with PIN fallback'
      : 'Use an enrolled fingerprint';
  });

  protected openPinDialog(): void {
    this.formError.set('');
    this.pinForm.reset({ pin: '', confirmation: '' });
    this.pinDialogOpen.set(true);
  }

  protected closePinDialog(): void {
    this.pinDialogOpen.set(false);
    this.formError.set('');
  }

  protected closeActiveDialog(): void {
    if (this.pinDialogOpen()) {
      this.closePinDialog();
      return;
    }

    this.removeDialogOpen.set(false);
  }

  protected async savePin(): Promise<void> {
    const { pin, confirmation } = this.pinForm.getRawValue();
    if (this.pinForm.invalid || pin !== confirmation) {
      this.formError.set('Use 4 to 8 digits and enter the same PIN twice.');
      return;
    }

    this.savingPin.set(true);
    const wasEnabled = this.settings.settings().pinEnabled;
    try {
      const credentials = await this.security.createPin(pin);
      this.security.disableBiometric();
      this.settings.update({
        pinEnabled: true,
        biometricEnabled: false,
        ...credentials,
      });
      this.closePinDialog();
      this.showMessage(wasEnabled ? 'PIN changed. Fingerprint unlock is off.' : 'PIN enabled.');
    } catch {
      this.formError.set('PIN setup failed. Please try again.');
    } finally {
      this.savingPin.set(false);
    }
  }

  protected toggleBiometric(): void {
    const current = this.settings.settings();
    if (!current.pinEnabled || !current.pinVerifier || !this.security.biometricAvailable) {
      return;
    }

    if (current.biometricEnabled) {
      this.security.disableBiometric();
      this.settings.update({ biometricEnabled: false });
      this.showMessage('Fingerprint unlock disabled.');
      return;
    }

    if (this.security.enableBiometric(current.pinVerifier)) {
      this.showMessage('Confirm your fingerprint in the Android prompt.');
    }
  }

  protected onBiometricEnabled(): void {
    this.settings.update({ biometricEnabled: true });
    this.showMessage('Fingerprint unlock enabled.');
  }

  protected removePin(): void {
    this.security.disableBiometric();
    this.settings.removePin();
    this.removeDialogOpen.set(false);
    this.lock.unlock();
    this.showMessage('PIN and fingerprint protection removed.');
  }

  private showMessage(value: string): void {
    this.message.set(value);
    window.setTimeout(() => {
      if (this.message() === value) {
        this.message.set('');
      }
    }, 3500);
  }
}
