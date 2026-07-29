import { Injectable } from '@angular/core';

import './native-bridge.model';
import { SecuritySettings } from './security-settings.service';

export interface PinCredentials {
  readonly pinSalt: string;
  readonly pinVerifier: string;
  readonly pinIterations: number;
}

const iterations = 210_000;

function bytesToBase64(value: Uint8Array): string {
  let binaryValue = '';
  for (const byte of value) {
    binaryValue += String.fromCharCode(byte);
  }
  return btoa(binaryValue);
}

function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

@Injectable({ providedIn: 'root' })
export class SecurityService {
  readonly biometricAvailable = this.checkBiometricAvailability();

  async createPin(pin: string): Promise<PinCredentials> {
    const salt = crypto.getRandomValues(new Uint8Array(16));

    return {
      pinSalt: bytesToBase64(salt),
      pinVerifier: await this.derive(pin, salt, iterations),
      pinIterations: iterations,
    };
  }

  async verifyPin(pin: string, settings: SecuritySettings): Promise<boolean> {
    if (!settings.pinSalt || !settings.pinVerifier || !settings.pinIterations) {
      return false;
    }

    const verifier = await this.derive(
      pin,
      base64ToBytes(settings.pinSalt),
      settings.pinIterations,
    );

    return this.constantTimeEqual(verifier, settings.pinVerifier);
  }

  enableBiometric(pinVerifier: string): boolean {
    if (!window.LinguaLogNative) {
      return false;
    }

    window.LinguaLogNative.enableBiometric(pinVerifier);
    return true;
  }

  requestBiometric(): void {
    window.LinguaLogNative?.authenticateBiometric();
  }

  disableBiometric(): void {
    window.LinguaLogNative?.disableBiometric();
  }

  private checkBiometricAvailability(): boolean {
    try {
      return window.LinguaLogNative?.isBiometricAvailable() ?? false;
    } catch {
      return false;
    }
  }

  private async derive(pin: string, salt: Uint8Array, pinIterations: number): Promise<string> {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(pin),
      'PBKDF2',
      false,
      ['deriveBits'],
    );
    const bits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        hash: 'SHA-256',
        salt: salt as BufferSource,
        iterations: pinIterations,
      },
      key,
      256,
    );

    return bytesToBase64(new Uint8Array(bits));
  }

  private constantTimeEqual(left: string, right: string): boolean {
    if (left.length !== right.length) {
      return false;
    }

    let difference = 0;
    for (let index = 0; index < left.length; index += 1) {
      difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
    }

    return difference === 0;
  }
}
