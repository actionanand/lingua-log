import { Injectable, computed, effect, signal } from '@angular/core';

export type ThemePreference = 'auto' | 'light' | 'dark';

const themeStorageKey = 'll.ui.preference.v2';
const themeOrder: readonly ThemePreference[] = ['auto', 'light', 'dark'];

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  readonly preference = signal<ThemePreference>(readStoredThemePreference());
  readonly label = computed(() => {
    switch (this.preference()) {
      case 'light':
        return 'Light';
      case 'dark':
        return 'Dark';
      default:
        return 'Auto';
    }
  });
  readonly icon = computed(() => {
    switch (this.preference()) {
      case 'light':
        return 'light_mode';
      case 'dark':
        return 'dark_mode';
      default:
        return 'brightness_auto';
    }
  });

  constructor() {
    effect(() => {
      const preference = this.preference();
      document.documentElement.dataset['theme'] = preference;
      localStorage.setItem(themeStorageKey, JSON.stringify({ preference }));
    });
  }

  cyclePreference(): void {
    const currentIndex = themeOrder.indexOf(this.preference());
    const nextIndex = (currentIndex + 1) % themeOrder.length;
    this.preference.set(themeOrder[nextIndex] ?? 'auto');
  }
}

function readStoredThemePreference(): ThemePreference {
  const rawValue = localStorage.getItem(themeStorageKey);

  if (!rawValue) {
    return 'auto';
  }

  try {
    const parsedValue = JSON.parse(rawValue) as { preference?: unknown };
    return isThemePreference(parsedValue.preference) ? parsedValue.preference : 'auto';
  } catch {
    return 'auto';
  }
}

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'auto' || value === 'light' || value === 'dark';
}
