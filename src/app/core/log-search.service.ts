import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class LogSearchService {
  readonly query = signal('');

  updateQuery(value: string): void {
    this.query.set(value);
  }

  clear(): void {
    this.query.set('');
  }
}
