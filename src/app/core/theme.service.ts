import { Injectable, computed, effect, signal } from '@angular/core';

export type ThemePreference = 'auto' | 'light' | 'dark';
type EffectiveTheme = 'light' | 'dark';

declare global {
  interface Window {
    LinguaLogAndroid?: {
      setTheme(theme: EffectiveTheme): void;
    };
  }
}

const themeStorageKey = 'll.ui.preference.v2';
const themeOrder: readonly ThemePreference[] = ['auto', 'light', 'dark'];
const lightThemeColor = '#f3f7f4';
const darkThemeColor = '#0f1713';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  readonly preference = signal<ThemePreference>(readStoredThemePreference());
  private readonly systemPrefersDark = signal(readSystemPrefersDark());
  readonly effectiveTheme = computed<EffectiveTheme>(() => {
    const preference = this.preference();

    if (preference === 'dark' || (preference === 'auto' && this.systemPrefersDark())) {
      return 'dark';
    }

    return 'light';
  });
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
    const mediaQuery = getDarkModeMediaQuery();
    mediaQuery?.addEventListener('change', (event) => {
      this.systemPrefersDark.set(event.matches);
    });

    effect(() => {
      const preference = this.preference();
      const effectiveTheme = this.effectiveTheme();
      document.documentElement.dataset['theme'] = preference;
      updateBrowserThemeChrome(effectiveTheme);
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

function updateBrowserThemeChrome(theme: EffectiveTheme): void {
  const themeColor = theme === 'dark' ? darkThemeColor : lightThemeColor;
  const themeColorMeta =
    document.querySelector<HTMLMetaElement>('#app-theme-color') ??
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  const colorSchemeMeta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');

  themeColorMeta?.setAttribute('content', themeColor);
  colorSchemeMeta?.setAttribute('content', theme === 'dark' ? 'dark light' : 'light dark');
  document.documentElement.style.backgroundColor = themeColor;
  window.LinguaLogAndroid?.setTheme(theme);
}

function readSystemPrefersDark(): boolean {
  return getDarkModeMediaQuery()?.matches ?? false;
}

function getDarkModeMediaQuery(): MediaQueryList | null {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;
}

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'auto' || value === 'light' || value === 'dark';
}
