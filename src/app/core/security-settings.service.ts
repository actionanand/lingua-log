import { Injectable, signal } from '@angular/core';

export interface SecuritySettings {
  readonly pinEnabled: boolean;
  readonly pinSalt?: string;
  readonly pinVerifier?: string;
  readonly pinIterations?: number;
  readonly biometricEnabled: boolean;
}

const storageKey = 'll::device:v3:Q7f9Lm2xP4::guard';
const defaultSettings: SecuritySettings = {
  pinEnabled: false,
  biometricEnabled: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

@Injectable({ providedIn: 'root' })
export class SecuritySettingsService {
  private readonly state = signal<SecuritySettings>(this.read());

  readonly settings = this.state.asReadonly();

  update(patch: Partial<SecuritySettings>): void {
    this.state.update((current) => {
      const next = { ...current, ...patch };
      this.persist(next);
      return next;
    });
  }

  removePin(): void {
    const next = { ...defaultSettings };
    this.state.set(next);
    this.persist(next);
  }

  private read(): SecuritySettings {
    try {
      const rawValue = localStorage.getItem(storageKey);
      if (!rawValue) {
        return defaultSettings;
      }

      const parsedValue: unknown = JSON.parse(rawValue);
      if (!isRecord(parsedValue)) {
        return defaultSettings;
      }

      const pinSalt =
        typeof parsedValue['pinSalt'] === 'string' ? parsedValue['pinSalt'] : undefined;
      const pinVerifier =
        typeof parsedValue['pinVerifier'] === 'string' ? parsedValue['pinVerifier'] : undefined;
      const pinIterations =
        typeof parsedValue['pinIterations'] === 'number' ? parsedValue['pinIterations'] : undefined;
      const pinEnabled =
        parsedValue['pinEnabled'] === true &&
        Boolean(pinSalt) &&
        Boolean(pinVerifier) &&
        typeof pinIterations === 'number';

      return {
        pinEnabled,
        pinSalt,
        pinVerifier,
        pinIterations,
        biometricEnabled: pinEnabled && parsedValue['biometricEnabled'] === true,
      };
    } catch {
      return defaultSettings;
    }
  }

  private persist(settings: SecuritySettings): void {
    try {
      localStorage.setItem(storageKey, JSON.stringify(settings));
    } catch {
      // Keep the in-memory setting available when local storage is unavailable.
    }
  }
}
