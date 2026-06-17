import { Injectable, computed, signal } from '@angular/core';
import { environment } from '../../environments/environment';

interface StoredSession {
  userName: string;
  passwordHash: string;
}

export interface LoginResult {
  success: boolean;
  message: string;
}

const storageKey = 'll::v9:k4Jp2sQx7m::auth';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly session = signal<StoredSession | null>(readStoredSession());

  readonly isLoggedIn = computed(() => this.session()?.passwordHash === environment.passwordHash);
  readonly displayName = computed(() => {
    const userName = this.session()?.userName ?? '';
    const name = userName.includes('@') ? userName.split('@')[0] : userName;

    return capitalizeName(name);
  });

  async login(userName: string, password: string): Promise<LoginResult> {
    const trimmedUserName = userName.trim();

    if (!trimmedUserName) {
      return { success: false, message: 'Enter a user name.' };
    }

    const passwordHash = await sha1(password);

    if (passwordHash !== environment.passwordHash) {
      this.session.set({ userName: trimmedUserName, passwordHash });
      writeStoredSession(this.session());

      return { success: false, message: 'Wrong password. Please re-enter it.' };
    }

    this.session.set({ userName: trimmedUserName, passwordHash });
    writeStoredSession(this.session());

    return { success: true, message: '' };
  }

  logout(): void {
    this.session.set(null);
    localStorage.removeItem(storageKey);
  }
}

async function sha1(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-1', bytes);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function readStoredSession(): StoredSession | null {
  try {
    const rawValue = localStorage.getItem(storageKey);

    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue) as Partial<StoredSession>;

    if (!parsedValue.userName || !parsedValue.passwordHash) {
      return null;
    }

    return {
      userName: parsedValue.userName,
      passwordHash: parsedValue.passwordHash,
    };
  } catch {
    return null;
  }
}

function writeStoredSession(session: StoredSession | null): void {
  if (!session) {
    return;
  }

  localStorage.setItem(storageKey, JSON.stringify(session));
}

function capitalizeName(value: string): string {
  return value
    .split(/[.\s_-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(' ');
}
