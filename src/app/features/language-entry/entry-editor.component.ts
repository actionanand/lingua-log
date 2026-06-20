import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';
import {
  EntryTable,
  LanguageOption,
  LinguaLogEntry,
  TableTheme,
  TranslationEntry,
  createEmptyEntry,
  languageOptions,
  tableThemeOptions as tableThemes,
  toTsvHeader,
  toTsvRow,
} from './sheet-entry-codec';

type TranslationForm = FormGroup<{
  language: FormControl<LanguageOption>;
  languageOther: FormControl<string>;
  text: FormControl<string>;
}>;

type EntryForm = FormGroup<{
  isProtected: FormControl<boolean>;
  sourceLanguage: FormControl<LanguageOption>;
  sourceLanguageOther: FormControl<string>;
  sourceText: FormControl<string>;
  sourceTransliteration: FormControl<string>;
  translations: FormArray<TranslationForm>;
  explanationHtml: FormControl<string>;
  resources: FormArray<FormControl<string>>;
}>;

type RichTextCommand =
  | 'bold'
  | 'italic'
  | 'strikeThrough'
  | 'insertUnorderedList'
  | 'insertOrderedList'
  | 'indent'
  | 'outdent';
type RichTextColorCommand = 'foreColor' | 'hiliteColor';

const textColorOptions = [
  { label: 'Green text', value: 'green' },
  { label: 'Red text', value: 'red' },
  { label: 'Blue text', value: 'blue' },
  { label: 'Purple text', value: 'purple' },
  { label: 'Orange text', value: 'darkorange' },
] as const;

const backgroundColorOptions = [
  { label: 'Green background', value: 'lightgreen' },
  { label: 'Red background', value: 'lightpink' },
  { label: 'Yellow background', value: 'yellow' },
  { label: 'Blue background', value: 'lightblue' },
  { label: 'Gray background', value: 'lightgray' },
] as const;

const allowedTextColors = textColorOptions.map((color) => color.value);
const allowedBackgroundColors = backgroundColorOptions.map((color) => color.value);
const colorAliases: Record<string, string> = {
  'rgb(0, 0, 255)': 'blue',
  'rgb(0, 128, 0)': 'green',
  'rgb(128, 0, 128)': 'purple',
  'rgb(144, 238, 144)': 'lightgreen',
  'rgb(173, 216, 230)': 'lightblue',
  'rgb(211, 211, 211)': 'lightgray',
  'rgb(255, 0, 0)': 'red',
  'rgb(255, 140, 0)': 'darkorange',
  'rgb(255, 182, 193)': 'lightpink',
  'rgb(255, 255, 0)': 'yellow',
};

@Component({
  selector: 'app-entry-editor',
  imports: [ReactiveFormsModule],
  templateUrl: './entry-editor.component.html',
  styleUrl: './entry-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntryEditorComponent {
  readonly initialEntry = input<LinguaLogEntry | null>(null);
  readonly heading = input('Create converter entry');

  protected readonly languages = languageOptions;
  protected readonly textColorOptions = textColorOptions;
  protected readonly backgroundColorOptions = backgroundColorOptions;
  protected readonly tableThemeOptions = tableThemes.map((theme) => ({
    value: theme,
    label: `${theme.charAt(0).toUpperCase()}${theme.slice(1)}`,
  }));
  protected readonly maxResources = 2;
  protected readonly maxTableColumns = 7;
  protected readonly maxTableRows = 13;
  protected readonly copyStatus = signal('');
  protected readonly sourceLanguage = signal<LanguageOption>('Tamil');
  protected readonly table = signal<EntryTable | null>(null);
  protected readonly newTableColumnCount = signal(3);
  protected readonly tablePasteText = signal('');
  protected readonly availableTranslationLanguages = computed(() =>
    this.languages.filter((language) => language !== this.sourceLanguage()),
  );
  protected readonly tableColumnCount = computed(() => this.table()?.rows[0]?.length ?? 0);
  protected readonly canAddTableColumn = computed(
    () => this.tableColumnCount() > 0 && this.tableColumnCount() < this.maxTableColumns,
  );
  protected readonly canAddTableRow = computed(
    () => Boolean(this.table()) && (this.table()?.rows.length ?? 0) < this.maxTableRows,
  );
  protected readonly explanationEditor = viewChild<ElementRef<HTMLDivElement>>('explanationEditor');

  private readonly formBuilder = inject(FormBuilder);
  private readonly startingEntry = createEmptyEntry();
  private readonly entryId = signal(this.startingEntry.entryId);
  private readonly createdAt = signal(this.startingEntry.createdAt);

  protected readonly form: EntryForm = this.formBuilder.nonNullable.group({
    isProtected: this.startingEntry.isProtected,
    sourceLanguage: this.startingEntry.sourceLanguage,
    sourceLanguageOther: this.startingEntry.sourceLanguageOther,
    sourceText: this.startingEntry.sourceText,
    sourceTransliteration: this.startingEntry.sourceTransliteration,
    translations: this.formBuilder.nonNullable.array(
      this.startingEntry.translations.map((translation) =>
        this.createTranslationGroup(translation),
      ),
    ),
    explanationHtml: this.startingEntry.explanationHtml,
    resources: this.formBuilder.nonNullable.array(
      this.startingEntry.resources.map((resource) =>
        this.formBuilder.nonNullable.control(resource),
      ),
    ),
  });

  constructor() {
    effect(() => {
      const entry = this.initialEntry();
      this.explanationEditor();

      if (entry) {
        queueMicrotask(() => this.applyEntry(entry));
      }
    });
  }

  protected get translations(): FormArray<TranslationForm> {
    return this.form.controls.translations;
  }

  protected get resources(): FormArray<FormControl<string>> {
    return this.form.controls.resources;
  }

  protected setSourceLanguage(language: LanguageOption): void {
    this.form.controls.sourceLanguage.setValue(language);
    this.sourceLanguage.set(language);
    this.copyStatus.set('');
    this.keepTranslationLanguagesValid();
  }

  protected toggleProtected(): void {
    this.form.controls.isProtected.setValue(!this.form.controls.isProtected.value);
  }

  protected addTranslation(): void {
    this.translations.push(
      this.createTranslationGroup({
        language: this.firstAvailableTranslationLanguage(),
        languageOther: '',
        text: '',
      }),
    );
  }

  protected removeTranslation(index: number): void {
    if (this.translations.length === 1) {
      this.translations.at(index).reset({
        language: this.firstAvailableTranslationLanguage(),
        languageOther: '',
        text: '',
      });
      return;
    }

    this.translations.removeAt(index);
  }

  protected addResource(): void {
    if (this.resources.length < this.maxResources) {
      this.resources.push(this.formBuilder.nonNullable.control(''));
    }
  }

  protected removeResource(index: number): void {
    if (this.resources.length === 1) {
      this.resources.at(index).setValue('');
      return;
    }

    this.resources.removeAt(index);
  }

  protected updateNewTableColumnCount(value: string): void {
    this.newTableColumnCount.set(clampInteger(Number(value), 1, this.maxTableColumns));
  }

  protected createTable(): void {
    const columnCount = this.newTableColumnCount();

    this.table.set({
      theme: 'soft',
      boldHeader: true,
      boldFirstColumn: false,
      rows: [createEmptyTableRow(columnCount)],
    });
  }

  protected clearTable(): void {
    this.table.set(null);
    this.tablePasteText.set('');
  }

  protected addTableRow(): void {
    this.updateTable((table) => ({
      ...table,
      rows: [...table.rows, createEmptyTableRow(table.rows[0]?.length ?? 1)].slice(
        0,
        this.maxTableRows,
      ),
    }));
  }

  protected addTableColumn(): void {
    this.updateTable((table) => ({
      ...table,
      rows: table.rows.map((row) => [...row, ''].slice(0, this.maxTableColumns)),
    }));
  }

  protected removeLastTableRow(): void {
    this.updateTable((table) => ({
      ...table,
      rows:
        table.rows.length > 1
          ? table.rows.slice(0, table.rows.length - 1)
          : [createEmptyTableRow(table.rows[0]?.length ?? 1)],
    }));
  }

  protected removeLastTableColumn(): void {
    this.updateTable((table) => {
      const nextColumnCount = Math.max(1, (table.rows[0]?.length ?? 1) - 1);

      return {
        ...table,
        rows: table.rows.map((row) => row.slice(0, nextColumnCount)),
      };
    });
  }

  protected removeEmptyTableRows(): void {
    this.updateTable((table) => {
      const filledRows = table.rows.filter((row) => row.some((cell) => cell.trim().length > 0));

      return {
        ...table,
        rows:
          filledRows.length > 0 ? filledRows : [createEmptyTableRow(table.rows[0]?.length ?? 1)],
      };
    });
  }

  protected updateTableTheme(theme: string): void {
    if (isTableTheme(theme)) {
      this.updateTable((table) => ({ ...table, theme }));
    }
  }

  protected toggleTableBoldHeader(): void {
    this.updateTable((table) => ({ ...table, boldHeader: !table.boldHeader }));
  }

  protected toggleTableBoldFirstColumn(): void {
    this.updateTable((table) => ({ ...table, boldFirstColumn: !table.boldFirstColumn }));
  }

  protected updateTableCell(rowIndex: number, columnIndex: number, value: string): void {
    this.updateTable((table) => ({
      ...table,
      rows: table.rows.map((row, currentRowIndex) =>
        currentRowIndex === rowIndex
          ? row.map((cell, currentColumnIndex) =>
              currentColumnIndex === columnIndex ? value : cell,
            )
          : row,
      ),
    }));
  }

  protected updateTablePasteText(value: string): void {
    this.tablePasteText.set(value);
  }

  protected applyTablePaste(): void {
    const parsedRows = parsePastedTable(this.tablePasteText());

    if (parsedRows.length === 0) {
      return;
    }

    this.setTableRows(parsedRows);
    this.tablePasteText.set('');
  }

  protected pasteIntoTable(event: ClipboardEvent, rowIndex: number, columnIndex: number): void {
    const pastedText = event.clipboardData?.getData('text/plain') ?? '';
    const parsedRows = parsePastedTable(pastedText);

    if (parsedRows.length === 0) {
      return;
    }

    event.preventDefault();
    this.mergeTableRows(parsedRows, rowIndex, columnIndex);
  }

  protected formatExplanation(command: RichTextCommand): void {
    const editor = this.explanationEditor();
    editor?.nativeElement.focus();
    document.execCommand('styleWithCSS', false, 'false');
    document.execCommand(command, false);
    this.updateExplanationValue();
  }

  protected colorExplanation(command: RichTextColorCommand, color: string): void {
    const editor = this.explanationEditor();
    editor?.nativeElement.focus();
    document.execCommand('styleWithCSS', false, 'true');

    const commandWorked = document.execCommand(command, false, color);

    if (command === 'hiliteColor' && !commandWorked) {
      document.execCommand('backColor', false, color);
    }

    this.updateExplanationValue();
  }

  protected keepEditorSelection(event: MouseEvent): void {
    event.preventDefault();
  }

  protected updateExplanationValue(): void {
    const editor = this.explanationEditor();

    if (!editor) {
      return;
    }

    this.form.controls.explanationHtml.setValue(editor.nativeElement.innerHTML);
  }

  protected syncExplanation(): void {
    const editor = this.explanationEditor();

    if (!editor) {
      return;
    }

    const sanitizedHtml = sanitizeRichText(editor.nativeElement.innerHTML);
    this.form.controls.explanationHtml.setValue(sanitizedHtml);

    if (editor.nativeElement.innerHTML !== sanitizedHtml) {
      editor.nativeElement.innerHTML = sanitizedHtml;
    }
  }

  protected async copyHeader(): Promise<void> {
    await this.copyText(toTsvHeader(), 'Copied the Google Sheet header row.');
  }

  protected async copyRow(): Promise<void> {
    this.syncExplanation();
    await this.copyText(toTsvRow(this.buildEntry()), 'Copied one Google Sheet row.');
  }

  protected async copyHeaderAndRow(): Promise<void> {
    this.syncExplanation();
    await this.copyText(
      `${toTsvHeader()}\n${toTsvRow(this.buildEntry())}`,
      'Copied header and entry row.',
    );
  }

  private applyEntry(entry: LinguaLogEntry): void {
    this.entryId.set(entry.entryId);
    this.createdAt.set(entry.createdAt);
    this.sourceLanguage.set(entry.sourceLanguage);
    this.table.set(cloneTable(entry.table));
    this.copyStatus.set('');

    this.translations.clear();
    const translations =
      entry.translations.length > 0
        ? entry.translations
        : [
            {
              language: this.firstAvailableTranslationLanguage(entry.sourceLanguage),
              languageOther: '',
              text: '',
            },
          ];

    for (const translation of translations) {
      this.translations.push(this.createTranslationGroup(translation));
    }

    this.resources.clear();
    const resources =
      entry.resources.length > 0 ? entry.resources.slice(0, this.maxResources) : [''];
    for (const resource of resources) {
      this.resources.push(this.formBuilder.nonNullable.control(resource));
    }

    this.form.patchValue({
      sourceLanguage: entry.sourceLanguage,
      sourceLanguageOther: entry.sourceLanguageOther,
      sourceText: entry.sourceText,
      sourceTransliteration: entry.sourceTransliteration,
      explanationHtml: entry.explanationHtml,
      isProtected: entry.isProtected,
    });

    const editor = this.explanationEditor();
    if (editor) {
      editor.nativeElement.innerHTML = sanitizeRichText(entry.explanationHtml);
    }
  }

  private buildEntry(): LinguaLogEntry {
    const rawValue = this.form.getRawValue();

    return {
      entryId: this.entryId(),
      createdAt: this.createdAt(),
      updatedAt: new Date().toISOString(),
      isProtected: rawValue.isProtected,
      sourceLanguage: rawValue.sourceLanguage,
      sourceLanguageOther: rawValue.sourceLanguageOther.trim(),
      sourceText: rawValue.sourceText.trim(),
      sourceTransliteration: rawValue.sourceTransliteration.trim(),
      translations: rawValue.translations
        .map((translation) => ({
          language: translation.language,
          languageOther: translation.languageOther.trim(),
          text: translation.text.trim(),
        }))
        .filter((translation) => translation.text.length > 0),
      explanationHtml: rawValue.explanationHtml,
      table: normalizeTable(this.table()),
      resources: rawValue.resources
        .map((resource) => resource.trim())
        .filter(Boolean)
        .slice(0, this.maxResources),
    };
  }

  private keepTranslationLanguagesValid(): void {
    for (const translation of this.translations.controls) {
      if (translation.controls.language.value === this.sourceLanguage()) {
        translation.controls.language.setValue(this.firstAvailableTranslationLanguage());
      }
    }
  }

  private createTranslationGroup(translation: TranslationEntry): TranslationForm {
    return this.formBuilder.nonNullable.group({
      language: translation.language,
      languageOther: translation.languageOther,
      text: translation.text,
    });
  }

  private firstAvailableTranslationLanguage(
    sourceLanguage = this.sourceLanguage(),
  ): LanguageOption {
    return this.languages.find((language) => language !== sourceLanguage) ?? 'English';
  }

  private async copyText(text: string, successMessage: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.copyStatus.set(successMessage);
    } catch {
      this.copyStatus.set(
        'Clipboard copy failed. Select the generated row from the form and copy it manually.',
      );
    }
  }

  private updateTable(updater: (table: EntryTable) => EntryTable): void {
    this.table.update((table) => (table ? normalizeTableForEditing(updater(table)) : table));
  }

  private setTableRows(rows: string[][]): void {
    const normalizedRows = normalizeTableRows(rows);

    if (normalizedRows.length === 0) {
      return;
    }

    this.table.set({
      theme: this.table()?.theme ?? 'soft',
      boldHeader: this.table()?.boldHeader ?? true,
      boldFirstColumn: this.table()?.boldFirstColumn ?? false,
      rows: normalizedRows,
    });
  }

  private mergeTableRows(rows: string[][], startRowIndex: number, startColumnIndex: number): void {
    const parsedRows = normalizeTableRows(rows);

    if (parsedRows.length === 0) {
      return;
    }

    this.updateTable((table) => {
      const columnCount = Math.min(
        this.maxTableColumns,
        Math.max(table.rows[0]?.length ?? 1, startColumnIndex + (parsedRows[0]?.length ?? 1)),
      );
      const rowCount = Math.min(
        this.maxTableRows,
        Math.max(table.rows.length, startRowIndex + parsedRows.length),
      );
      const nextRows = Array.from({ length: rowCount }, (_, rowIndex) => {
        const existingRow = table.rows[rowIndex] ?? [];

        return Array.from(
          { length: columnCount },
          (_, columnIndex) => existingRow[columnIndex] ?? '',
        );
      });

      parsedRows.forEach((row, pastedRowIndex) => {
        row.forEach((cell, pastedColumnIndex) => {
          const nextRowIndex = startRowIndex + pastedRowIndex;
          const nextColumnIndex = startColumnIndex + pastedColumnIndex;

          if (nextRows[nextRowIndex] && nextColumnIndex < columnCount) {
            nextRows[nextRowIndex][nextColumnIndex] = cell;
          }
        });
      });

      return { ...table, rows: nextRows };
    });
  }
}

function cloneTable(table: EntryTable | null): EntryTable | null {
  return table
    ? {
        ...table,
        rows: table.rows.map((row) => [...row]),
      }
    : null;
}

function normalizeTable(table: EntryTable | null): EntryTable | null {
  if (!table) {
    return null;
  }

  const rows = normalizeTableRows(table.rows);

  if (rows.length === 0 || rows.every((row) => row.every((cell) => cell.trim().length === 0))) {
    return null;
  }

  return {
    theme: table.theme,
    boldHeader: table.boldHeader,
    boldFirstColumn: table.boldFirstColumn,
    rows,
  };
}

function normalizeTableForEditing(table: EntryTable): EntryTable {
  return {
    ...table,
    rows: normalizeTableRows(table.rows),
  };
}

function normalizeTableRows(rows: readonly string[][]): string[][] {
  const columnCount = clampInteger(Math.max(...rows.map((row) => row.length), 1), 1, 7);

  return rows
    .slice(0, 13)
    .map((row) => Array.from({ length: columnCount }, (_, index) => row[index] ?? '').slice(0, 7));
}

function createEmptyTableRow(columnCount: number): string[] {
  return Array.from({ length: clampInteger(columnCount, 1, 7) }, () => '');
}

function parsePastedTable(value: string): string[][] {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return [];
  }

  const markdownRows = parseMarkdownTable(trimmedValue);

  if (markdownRows.length > 0) {
    return normalizeTableRows(markdownRows);
  }

  return normalizeTableRows(
    trimmedValue
      .split(/\r?\n/)
      .map((row) => row.split('\t').map((cell) => cell.trim()))
      .filter((row) => row.some((cell) => cell.length > 0)),
  );
}

function parseMarkdownTable(value: string): string[][] {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.includes('|'));

  if (lines.length === 0) {
    return [];
  }

  const rows = lines
    .filter((line) => !isMarkdownDividerRow(line))
    .map((line) =>
      line
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((cell) => cell.trim()),
    )
    .filter((row) => row.length > 0 && row.some((cell) => cell.length > 0));

  return rows.length > 0 ? rows : [];
}

function isMarkdownDividerRow(line: string): boolean {
  return /^(\|?\s*:?-{3,}:?\s*)+\|?$/.test(line);
}

function isTableTheme(value: string): value is TableTheme {
  return tableThemes.some((theme) => theme === value);
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function sanitizeRichText(html: string): string {
  const template = document.createElement('template');
  template.innerHTML = html;
  const sanitized = Array.from(template.content.childNodes).map(sanitizeNode).join('');

  return sanitized === '<br>' ? '' : sanitized;
}

function sanitizeNode(node: ChildNode): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeHtml(node.textContent ?? '');
  }

  if (!(node instanceof HTMLElement)) {
    return '';
  }

  const children = Array.from(node.childNodes).map(sanitizeNode).join('');
  const tagName = node.tagName.toLowerCase();

  switch (tagName) {
    case 'b':
    case 'strong':
      return wrapWithAllowedStyles(node, `<b>${children}</b>`);
    case 'i':
    case 'em':
      return wrapWithAllowedStyles(node, `<i>${children}</i>`);
    case 's':
    case 'strike':
      return wrapWithAllowedStyles(node, `<s>${children}</s>`);
    case 'ul':
      return `<ul>${children}</ul>`;
    case 'ol':
      return `<ol>${children}</ol>`;
    case 'li':
      return `<li>${children}</li>`;
    case 'br':
      return '<br>';
    case 'font':
      return sanitizeFontNode(node, children);
    case 'span':
      return sanitizeSpanNode(node, children);
    case 'div':
    case 'p':
      return `${children}<br>`;
    default:
      return children;
  }
}

function sanitizeFontNode(node: HTMLElement, children: string): string {
  const color = normalizeAllowedColor(node.getAttribute('color') ?? '', allowedTextColors);

  return color ? `<span style="color: ${color}">${children}</span>` : children;
}

function sanitizeSpanNode(node: HTMLElement, children: string): string {
  return wrapWithAllowedStyles(node, children);
}

function wrapWithAllowedStyles(node: HTMLElement, content: string): string {
  const styleAttribute = allowedStyleAttribute(node);

  return styleAttribute ? `<span style="${styleAttribute}">${content}</span>` : content;
}

function allowedStyleAttribute(node: HTMLElement): string {
  const styles: string[] = [];
  const color = normalizeAllowedColor(node.style.color, allowedTextColors);
  const backgroundColor = normalizeAllowedColor(
    node.style.backgroundColor,
    allowedBackgroundColors,
  );

  if (color) {
    styles.push(`color: ${color}`);
  }

  if (backgroundColor) {
    styles.push(`background-color: ${backgroundColor}`);
  }

  return styles.join('; ');
}

function normalizeAllowedColor(value: string, allowedColors: readonly string[]): string {
  const normalizedValue = value.trim().toLowerCase().replace(/\s+/g, ' ');
  const aliasedValue = colorAliases[normalizedValue] ?? normalizedValue;

  return allowedColors.find((color) => color === aliasedValue) ?? '';
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
