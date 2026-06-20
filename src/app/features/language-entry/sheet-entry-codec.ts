export const languageOptions = [
  'Tamil',
  'English',
  'Sanskrit',
  'Hindi',
  'Kannada',
  'Malayalam',
  'Telugu',
  'French',
  'Other',
] as const;

export type LanguageOption = (typeof languageOptions)[number];

export const sheetColumns = [
  'EntryId',
  'CreatedAt',
  'UpdatedAt',
  'Protected',
  'SourceLanguage',
  'SourceOtherLanguage',
  'SourceText',
  'SourceTransliteration',
  'Tamil',
  'English',
  'Sanskrit',
  'Hindi',
  'Kannada',
  'Malayalam',
  'Telugu',
  'French',
  'OtherLanguage',
  'Other',
  'ExplanationHtml',
  'TableData',
  'Resource1Label',
  'Resource1Value',
  'Resource2Label',
  'Resource2Value',
  'TableName',
] as const;

export type SheetColumn = (typeof sheetColumns)[number];
type LegacySheetColumn = Exclude<SheetColumn, 'Protected' | 'TableData'>;

const legacySheetColumns = sheetColumns.filter(
  (column): column is LegacySheetColumn => column !== 'Protected' && column !== 'TableData',
);
const protectedColumnsWithoutTableData = sheetColumns.filter((column) => column !== 'TableData');
const unprotectedColumnsWithTableData = sheetColumns.filter((column) => column !== 'Protected');

export interface TranslationEntry {
  language: LanguageOption;
  languageOther: string;
  text: string;
}

export interface ResourceEntry {
  label: string;
  value: string;
}

export const tableThemeOptions = ['plain', 'soft', 'grid'] as const;
export type TableTheme = (typeof tableThemeOptions)[number];

export interface EntryTable {
  theme: TableTheme;
  boldHeader: boolean;
  boldFirstColumn: boolean;
  rows: string[][];
}

export interface LinguaLogEntry {
  entryId: string;
  createdAt: string;
  updatedAt: string;
  isProtected: boolean;
  sourceLanguage: LanguageOption;
  sourceLanguageOther: string;
  sourceText: string;
  sourceTransliteration: string;
  translations: TranslationEntry[];
  explanationHtml: string;
  table: EntryTable | null;
  tableName: string;
  resources: ResourceEntry[];
}

type SheetRow = Record<SheetColumn, string>;

export function createEmptyEntry(): LinguaLogEntry {
  const createdAt = new Date().toISOString();

  return {
    entryId: createEntryId(),
    createdAt,
    updatedAt: createdAt,
    isProtected: false,
    sourceLanguage: 'Tamil',
    sourceLanguageOther: '',
    sourceText: '',
    sourceTransliteration: '',
    translations: [{ language: 'English', languageOther: '', text: '' }],
    explanationHtml: '',
    table: null,
    tableName: '',
    resources: [{ label: '', value: '' }],
  };
}

export function createEntryId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `entry-${Date.now().toString(36)}`;
}

export function toTsvHeader(): string {
  return sheetColumns.join('\t');
}

export function toTsvRow(entry: LinguaLogEntry): string {
  return toSheetCells(entry).map(escapeTsvCell).join('\t');
}

export function toSheetCells(entry: LinguaLogEntry): string[] {
  const row = createBlankSheetRow();
  row.EntryId = entry.entryId;
  row.CreatedAt = entry.createdAt;
  row.UpdatedAt = new Date().toISOString();
  row.Protected = entry.isProtected ? 'Yes' : 'No';
  row.SourceLanguage = entry.sourceLanguage;
  row.SourceOtherLanguage = entry.sourceLanguage === 'Other' ? entry.sourceLanguageOther : '';
  row.SourceText = entry.sourceText;
  row.SourceTransliteration = entry.sourceTransliteration;
  row.ExplanationHtml = entry.explanationHtml;
  row.TableData = encodeTableData(entry.table);
  row.Resource1Label = entry.resources[0]?.label ?? '';
  row.Resource1Value = entry.resources[0]?.value ?? '';
  row.Resource2Label = entry.resources[1]?.label ?? '';
  row.Resource2Value = entry.resources[1]?.value ?? '';
  row.TableName = entry.tableName;

  setLanguageText(row, entry.sourceLanguage, entry.sourceText, entry.sourceLanguageOther);

  for (const translation of entry.translations) {
    setLanguageText(row, translation.language, translation.text, translation.languageOther);
  }

  return sheetColumns.map((column) => row[column]);
}

export function parseSheetText(text: string): LinguaLogEntry[] {
  const rows = parseTsv(text).filter((row) => row.some((cell) => cell.trim().length > 0));

  if (rows.length === 0) {
    return [];
  }

  const firstRow = rows[0] ?? [];
  const hasHeader = isHeaderRow(firstRow);

  if (!hasHeader) {
    const singleRow = findSingleHeaderlessRecord(text, rows);
    return singleRow ? [entryFromSheetCells(singleRow, inferHeadersForRow(singleRow))] : [];
  }

  const headers = firstRow.map((cell) => cell.trim());
  return rows.slice(1).map((row) => entryFromSheetCells(row, headers));
}

function isHeaderRow(row: string[]): boolean {
  return (
    row[0]?.trim() === 'EntryId' && row[1]?.trim() === 'CreatedAt' && row[2]?.trim() === 'UpdatedAt'
  );
}

export function entryFromSheetCells(
  cells: readonly string[],
  headers: readonly string[] = sheetColumns,
): LinguaLogEntry {
  const row = createBlankSheetRow();
  const normalizedCells = normalizeCellsForHeaders(cells, headers);

  headers.forEach((header, index) => {
    if (sheetColumns.includes(header as SheetColumn)) {
      row[header as SheetColumn] = normalizedCells[index] ?? '';
    }
  });

  const sourceLanguage = parseLanguage(row.SourceLanguage);
  const sourceText = row.SourceText || getLanguageText(row, sourceLanguage);
  const translations = languageOptions
    .filter((language) => language !== sourceLanguage)
    .map((language) => ({
      language,
      languageOther: language === 'Other' ? row.OtherLanguage : '',
      text: getLanguageText(row, language),
    }))
    .filter((translation) => translation.text.trim().length > 0);

  return {
    entryId: row.EntryId || createEntryId(),
    createdAt: row.CreatedAt || new Date().toISOString(),
    updatedAt: row.UpdatedAt || new Date().toISOString(),
    isProtected: row.Protected.trim().toLowerCase() === 'yes',
    sourceLanguage,
    sourceLanguageOther:
      sourceLanguage === 'Other' ? row.SourceOtherLanguage || row.OtherLanguage : '',
    sourceText,
    sourceTransliteration: row.SourceTransliteration,
    translations,
    explanationHtml: row.ExplanationHtml,
    table: decodeTableData(row.TableData),
    tableName: row.TableName.trim(),
    resources: [
      createResourceEntry(row.Resource1Label, row.Resource1Value),
      createResourceEntry(row.Resource2Label, row.Resource2Value),
    ].filter((resource) => resource.label.length > 0 || resource.value.length > 0),
  };
}

function createResourceEntry(label: string, value: string): ResourceEntry {
  return {
    label: label.trim(),
    value: value.trim(),
  };
}

function findSingleHeaderlessRecord(text: string, rows: string[][]): string[] | null {
  if (rows.length === 1 && looksLikeHeaderlessRecord(rows[0] ?? [])) {
    return rows[0] ?? [];
  }

  const flattenedRows = parseTsv(text.replace(/\r?\n/g, '\t')).filter((row) =>
    row.some((cell) => cell.trim().length > 0),
  );
  const flattenedRow = flattenedRows[0] ?? [];

  if (looksLikeHeaderlessRecord(flattenedRow)) {
    return flattenedRow;
  }

  return foldSingleHeaderlessRecord(rows);
}

function inferHeadersForRow(row: string[]): readonly string[] {
  if (isProtectedValue(row[3]) || languageOptions.includes(row[4] as LanguageOption)) {
    if (row.length === protectedColumnsWithoutTableData.length) {
      return protectedColumnsWithoutTableData;
    }

    return sheetColumns;
  }

  if (languageOptions.includes(row[3] as LanguageOption)) {
    if (looksLikeUnprotectedRowWithTableData(row)) {
      return unprotectedColumnsWithTableData;
    }

    return legacySheetColumns;
  }

  return sheetColumns;
}

function looksLikeUnprotectedRowWithTableData(row: string[]): boolean {
  const tableDataIndex = unprotectedColumnsWithTableData.indexOf('TableData');

  return (
    row.length === unprotectedColumnsWithTableData.length ||
    looksLikeTableData(row[tableDataIndex]) ||
    (row[tableDataIndex]?.trim() === '' && (row[tableDataIndex + 1]?.trim().length ?? 0) > 0)
  );
}

function looksLikeTableData(value: string | undefined): boolean {
  const trimmedValue = value?.trim() ?? '';

  return trimmedValue.startsWith('{"v":') || trimmedValue.startsWith('{"r":');
}

function normalizeCellsForHeaders(
  cells: readonly string[],
  headers: readonly string[],
): string[] | readonly string[] {
  if (cells.length <= headers.length) {
    return cells;
  }

  const explanationIndex = headers.indexOf('ExplanationHtml');

  if (explanationIndex < 0 || cells.length <= explanationIndex) {
    return cells;
  }

  return [...cells.slice(0, explanationIndex), cells.slice(explanationIndex).join('\n')];
}

function encodeTableData(table: EntryTable | null): string {
  if (!table || table.rows.length === 0 || table.rows.every((row) => row.every(isBlank))) {
    return '';
  }

  const normalizedRows = trimEmptyTrailingRows(table.rows)
    .map((row) => trimEmptyTrailingCells(row).slice(0, 7))
    .slice(0, 13);

  if (normalizedRows.length === 0 || normalizedRows.every((row) => row.every(isBlank))) {
    return '';
  }

  return JSON.stringify({
    v: 1,
    t: table.theme,
    h: table.boldHeader ? 1 : 0,
    c: table.boldFirstColumn ? 1 : 0,
    r: normalizedRows,
  });
}

function decodeTableData(value: string): EntryTable | null {
  if (!value.trim()) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(value) as {
      t?: unknown;
      h?: unknown;
      c?: unknown;
      r?: unknown;
    };

    if (!Array.isArray(parsedValue.r)) {
      return null;
    }

    const rows = parsedValue.r
      .filter((row): row is unknown[] => Array.isArray(row))
      .map((row) => row.map((cell) => String(cell ?? '')).slice(0, 7))
      .slice(0, 13);
    const normalizedRows = trimEmptyTrailingRows(rows);

    if (normalizedRows.length === 0) {
      return null;
    }

    return {
      theme: parseTableTheme(parsedValue.t),
      boldHeader: parsedValue.h === 1 || parsedValue.h === true,
      boldFirstColumn: parsedValue.c === 1 || parsedValue.c === true,
      rows: normalizedRows,
    };
  } catch {
    return null;
  }
}

function parseTableTheme(value: unknown): TableTheme {
  return tableThemeOptions.find((theme) => theme === value) ?? 'plain';
}

function trimEmptyTrailingRows(rows: readonly string[][]): string[][] {
  const nextRows = rows.map((row) => [...row]);

  while (nextRows.length > 0 && (nextRows.at(-1) ?? []).every(isBlank)) {
    nextRows.pop();
  }

  return nextRows;
}

function trimEmptyTrailingCells(row: readonly string[]): string[] {
  const nextRow = [...row];

  while (nextRow.length > 1 && isBlank(nextRow.at(-1) ?? '')) {
    nextRow.pop();
  }

  return nextRow;
}

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

function foldSingleHeaderlessRecord(rows: string[][]): string[] | null {
  const firstRow = rows[0] ?? [];

  if (!looksLikeHeaderlessRecord(firstRow)) {
    return null;
  }

  const foldedRow = [...firstRow];

  for (const row of rows.slice(1)) {
    if (looksLikeHeaderlessRecord(row)) {
      return null;
    }

    const continuationText = row.join('\t');
    const lastCellIndex = Math.max(foldedRow.length - 1, 0);
    foldedRow[lastCellIndex] = `${foldedRow[lastCellIndex]}\n${continuationText}`;
  }

  return foldedRow;
}

function looksLikeHeaderlessRecord(row: string[]): boolean {
  return (
    row[0]?.trim().length > 0 &&
    isIsoDate(row[1]) &&
    isIsoDate(row[2]) &&
    ((isProtectedValue(row[3]) && languageOptions.includes(row[4] as LanguageOption)) ||
      languageOptions.includes(row[3] as LanguageOption))
  );
}

function isProtectedValue(value: string | undefined): boolean {
  const normalizedValue = value?.trim().toLowerCase();

  return normalizedValue === 'yes' || normalizedValue === 'no';
}

function isIsoDate(value: string | undefined): boolean {
  return Boolean(value?.trim().match(/^\d{4}-\d{2}-\d{2}T/));
}

function createBlankSheetRow(): SheetRow {
  return sheetColumns.reduce((row, column) => ({ ...row, [column]: '' }), {} as SheetRow);
}

function setLanguageText(
  row: SheetRow,
  language: LanguageOption,
  text: string,
  otherLanguageName: string,
): void {
  if (language === 'Other') {
    row.Other = text;
    row.OtherLanguage = otherLanguageName;
    return;
  }

  row[language] = text;
}

function getLanguageText(row: SheetRow, language: LanguageOption): string {
  if (language === 'Other') {
    return row.Other;
  }

  return row[language];
}

function parseLanguage(value: string): LanguageOption {
  const language = languageOptions.find((option) => option === value);
  return language ?? 'Other';
}

function escapeTsvCell(value: string): string {
  if (!/[\t\r\n"]/.test(value)) {
    return value;
  }

  return `"${value.replaceAll('"', '""')}"`;
}

function parseTsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let isQuoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (isQuoted && nextChar === '"') {
        cell += '"';
        index += 1;
        continue;
      }

      if (isQuoted) {
        isQuoted = false;
        continue;
      }

      if (cell.length === 0) {
        isQuoted = true;
        continue;
      }

      cell += char;
      continue;
    }

    if (char === '\t' && !isQuoted) {
      row.push(cell);
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !isQuoted) {
      if (char === '\r' && nextChar === '\n') {
        index += 1;
      }

      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);

  return rows;
}
