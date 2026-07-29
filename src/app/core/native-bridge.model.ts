export interface LinguaLogNativeBridge {
  isBiometricAvailable(): boolean;
  enableBiometric(secret: string): void;
  authenticateBiometric(): void;
  disableBiometric(): void;
}

declare global {
  interface Window {
    LinguaLogNative?: LinguaLogNativeBridge;
  }
}

export {};
