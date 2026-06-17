import { Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import {
  LinguaLogEntry,
  entryFromSheetCells,
  sheetColumns,
} from '../language-entry/sheet-entry-codec';

export interface LanguageLogSheetRow {
  entry: LinguaLogEntry;
  rowNumber: number;
}

interface GvizCell {
  v?: unknown;
  f?: string;
}

interface GvizColumn {
  id?: string;
  label?: string;
}

interface GvizRow {
  c?: (GvizCell | null)[];
}

interface GvizResponse {
  table?: {
    cols?: GvizColumn[];
    rows?: GvizRow[];
    parsedNumHeaders?: number;
  };
}

interface CachedRows {
  cachedAt: string;
  rows: LanguageLogSheetRow[];
}

interface CapacitorBridge {
  getPlatform?: () => string;
  isNativePlatform?: () => boolean;
}

const offlineCacheKey = 'lingua-log.android.sheet-cache.v1';
const offlineCacheLimit = 30;

@Injectable({
  providedIn: 'root',
})
export class LanguageLogSheetService {
  readonly isOfflineCache = signal(false);
  readonly offlineCachedAt = signal('');

  async fetchRows(abortSignal: AbortSignal): Promise<LanguageLogSheetRow[]> {
    this.isOfflineCache.set(false);

    try {
      const response = await fetch(this.createGvizUrl(), { signal: abortSignal });

      if (!response.ok) {
        throw new Error(`Google Sheet request failed with ${response.status}`);
      }

      const rows = this.parseRows(await response.text());
      this.cacheRows(rows);
      this.offlineCachedAt.set('');

      return rows;
    } catch (error) {
      if (isNativeAndroid() && !navigator.onLine) {
        const cachedRows = this.readCachedRows();

        if (cachedRows) {
          this.isOfflineCache.set(true);
          this.offlineCachedAt.set(cachedRows.cachedAt);
          return cachedRows.rows;
        }
      }

      throw error;
    }
  }

  private parseRows(text: string): LanguageLogSheetRow[] {
    const payload = parseGvizResponse(text);
    const table = payload.table;
    const columns = table?.cols ?? [];
    const rows = table?.rows ?? [];
    const columnHeaders = resolveHeaders(columns);
    const firstRowCells = resolveCells(rows[0] ?? {}, sheetColumns.length);
    const hasHeaderRow = isSheetHeaderRow(firstRowCells);
    const headers = hasHeaderRow ? firstRowCells.map(normalizeColumnLabel) : columnHeaders;
    const dataRows = hasHeaderRow ? rows.slice(1) : rows;
    const firstDataRowNumber = hasHeaderRow ? 2 : (table?.parsedNumHeaders ?? 1) + 1;

    return dataRows.map((row, index) => ({
      entry: entryFromSheetCells(resolveCells(row, headers.length), headers),
      rowNumber: firstDataRowNumber + index,
    }));
  }

  private cacheRows(rows: readonly LanguageLogSheetRow[]): void {
    if (!isNativeAndroid()) {
      return;
    }

    const cachedRows: CachedRows = {
      cachedAt: new Date().toISOString(),
      rows: rows.slice(0, offlineCacheLimit),
    };

    localStorage.setItem(offlineCacheKey, JSON.stringify(cachedRows));
  }

  private readCachedRows(): CachedRows | null {
    const rawValue = localStorage.getItem(offlineCacheKey);

    if (!rawValue) {
      return null;
    }

    try {
      const cachedRows = JSON.parse(rawValue) as CachedRows;
      return Array.isArray(cachedRows.rows) ? cachedRows : null;
    } catch {
      return null;
    }
  }

  private createGvizUrl(): string {
    const params = new URLSearchParams({
      gid: String(environment.SHEET_GID),
      tqx: 'out:json',
    });

    return `https://docs.google.com/spreadsheets/d/${environment.GOOGLE_SHEET_ID}/gviz/tq?${params.toString()}`;
  }
}

function isNativeAndroid(): boolean {
  const capacitor = (globalThis as typeof globalThis & { Capacitor?: CapacitorBridge }).Capacitor;

  return (
    capacitor?.getPlatform?.() === 'android' && (capacitor.isNativePlatform?.() ?? true) === true
  );
}

function parseGvizResponse(text: string): GvizResponse {
  const firstBraceIndex = text.indexOf('{');
  const lastBraceIndex = text.lastIndexOf('}');

  if (firstBraceIndex < 0 || lastBraceIndex < firstBraceIndex) {
    throw new Error('Google Sheet response was not valid gviz JSON.');
  }

  return JSON.parse(text.slice(firstBraceIndex, lastBraceIndex + 1)) as GvizResponse;
}

function resolveHeaders(columns: readonly GvizColumn[]): readonly string[] {
  const labels = columns.map((column) => normalizeColumnLabel(column.label || column.id || ''));
  const hasKnownLabels = labels.some((label) => sheetColumns.some((column) => column === label));

  if (!hasKnownLabels) {
    return sheetColumns;
  }

  return labels.map((label, index) => label || sheetColumns[index] || '');
}

function resolveCells(row: GvizRow, minimumLength: number): string[] {
  const cells = row.c ?? [];
  const values = cells.map((cell) => cellValueToString(cell));

  while (values.length < minimumLength) {
    values.push('');
  }

  return values;
}

function isSheetHeaderRow(cells: readonly string[]): boolean {
  return (
    normalizeColumnLabel(cells[0] ?? '') === 'EntryId' &&
    normalizeColumnLabel(cells[1] ?? '') === 'CreatedAt' &&
    normalizeColumnLabel(cells[2] ?? '') === 'UpdatedAt'
  );
}

function cellValueToString(cell: GvizCell | null): string {
  if (!cell || cell.v === null || cell.v === undefined) {
    return '';
  }

  if (typeof cell.v === 'number' && cell.f) {
    return cell.f;
  }

  return String(cell.v);
}

function normalizeColumnLabel(value: string): string {
  const normalizedValue = value.toLowerCase().replace(/[^a-z0-9]/g, '');
  const matchingColumn = sheetColumns.find(
    (column) => column.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedValue,
  );

  return matchingColumn ?? value;
}
