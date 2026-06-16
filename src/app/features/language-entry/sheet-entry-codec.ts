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
  'Resource1',
  'Resource2',
] as const;

export type SheetColumn = (typeof sheetColumns)[number];

export interface TranslationEntry {
  language: LanguageOption;
  languageOther: string;
  text: string;
}

export interface LinguaLogEntry {
  entryId: string;
  createdAt: string;
  updatedAt: string;
  sourceLanguage: LanguageOption;
  sourceLanguageOther: string;
  sourceText: string;
  sourceTransliteration: string;
  translations: TranslationEntry[];
  explanationHtml: string;
  resources: string[];
}

type SheetRow = Record<SheetColumn, string>;

export function createEmptyEntry(): LinguaLogEntry {
  const createdAt = new Date().toISOString();

  return {
    entryId: createEntryId(),
    createdAt,
    updatedAt: createdAt,
    sourceLanguage: 'Tamil',
    sourceLanguageOther: '',
    sourceText: '',
    sourceTransliteration: '',
    translations: [{ language: 'English', languageOther: '', text: '' }],
    explanationHtml: '',
    resources: [''],
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
  row.SourceLanguage = entry.sourceLanguage;
  row.SourceOtherLanguage = entry.sourceLanguage === 'Other' ? entry.sourceLanguageOther : '';
  row.SourceText = entry.sourceText;
  row.SourceTransliteration = entry.sourceTransliteration;
  row.ExplanationHtml = entry.explanationHtml;
  row.Resource1 = entry.resources[0] ?? '';
  row.Resource2 = entry.resources[1] ?? '';

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
  const hasHeader = firstRow.some((cell) => sheetColumns.includes(cell.trim() as SheetColumn));
  const headers = hasHeader ? firstRow.map((cell) => cell.trim()) : [...sheetColumns];
  const dataRows = hasHeader ? rows.slice(1) : rows;

  return dataRows.map((row) => entryFromRow(row, headers));
}

function entryFromRow(cells: string[], headers: string[]): LinguaLogEntry {
  const row = createBlankSheetRow();

  headers.forEach((header, index) => {
    if (sheetColumns.includes(header as SheetColumn)) {
      row[header as SheetColumn] = cells[index] ?? '';
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
    sourceLanguage,
    sourceLanguageOther:
      sourceLanguage === 'Other' ? row.SourceOtherLanguage || row.OtherLanguage : '',
    sourceText,
    sourceTransliteration: row.SourceTransliteration,
    translations,
    explanationHtml: row.ExplanationHtml,
    resources: [row.Resource1, row.Resource2].filter((resource) => resource.trim().length > 0),
  };
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

    if (char === '"' && isQuoted && nextChar === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      isQuoted = !isQuoted;
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
