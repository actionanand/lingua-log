import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
  signal,
} from '@angular/core';
import { AuthService } from '../../core/auth.service';
import { EntryEditorComponent } from '../language-entry/entry-editor.component';
import {
  EntryTable,
  LanguageOption,
  LinguaLogEntry,
  ResourceEntry,
  TranslationEntry,
} from '../language-entry/sheet-entry-codec';
import {
  LanguageLogSheetRow,
  LanguageLogSheetService,
} from '../language-log/language-log-sheet.service';
import { SafeExplanationHtmlPipe } from '../language-log/safe-explanation-html.pipe';

@Component({
  selector: 'app-sheet-data-page',
  imports: [EntryEditorComponent, SafeExplanationHtmlPipe],
  templateUrl: './sheet-data-page.component.html',
  styleUrl: './sheet-data-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SheetDataPageComponent {
  protected readonly authService = inject(AuthService);
  protected readonly sheetService = inject(LanguageLogSheetService);
  protected readonly pageSizeOptions = [10, 30, 50, 75] as const;
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(10);
  protected readonly editingRow = signal<LanguageLogSheetRow | null>(null);
  protected readonly viewingRow = signal<LanguageLogSheetRow | null>(null);
  protected readonly rowsResource = resource({
    loader: ({ abortSignal }) => this.sheetService.fetchRows(abortSignal),
  });

  protected readonly rows = computed(() => this.rowsResource.value() ?? []);
  protected readonly visibleRows = computed(() =>
    this.authService.isLoggedIn()
      ? this.rows()
      : this.rows().filter((row) => !row.entry.isProtected),
  );
  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.visibleRows().length / this.pageSize())),
  );
  protected readonly activePageIndex = computed(() =>
    Math.min(this.pageIndex(), this.totalPages() - 1),
  );
  protected readonly pageNumbers = computed(() => {
    const totalPages = this.totalPages();
    const currentPage = this.activePageIndex();
    const startPage = Math.max(0, Math.min(currentPage - 2, totalPages - 5));
    const endPage = Math.min(totalPages, startPage + 5);

    return Array.from({ length: endPage - startPage }, (_, index) => startPage + index);
  });
  protected readonly pagedRows = computed(() => {
    const startIndex = this.activePageIndex() * this.pageSize();

    return this.visibleRows().slice(startIndex, startIndex + this.pageSize());
  });

  protected reload(): void {
    this.rowsResource.reload();
    this.pageIndex.set(0);
  }

  protected updatePageSize(value: string): void {
    this.pageSize.set(Number(value));
    this.pageIndex.set(0);
  }

  protected previousPage(): void {
    this.pageIndex.set(Math.max(0, this.activePageIndex() - 1));
  }

  protected nextPage(): void {
    this.pageIndex.set(Math.min(this.totalPages() - 1, this.activePageIndex() + 1));
  }

  protected goToPage(pageIndex: number): void {
    this.pageIndex.set(Math.max(0, Math.min(this.totalPages() - 1, pageIndex)));
  }

  protected openEdit(row: LanguageLogSheetRow): void {
    this.editingRow.set(row);
  }

  protected closeEdit(): void {
    this.editingRow.set(null);
  }

  protected openView(row: LanguageLogSheetRow): void {
    this.viewingRow.set(row);
  }

  protected closeView(): void {
    this.viewingRow.set(null);
  }

  protected displaySheetItem(rowNumber: number): number {
    return Math.max(1, rowNumber - 1);
  }

  protected sourceDisplayLanguage(entry: LinguaLogEntry): string {
    return displayLanguage(entry.sourceLanguage, entry.sourceLanguageOther);
  }

  protected translationDisplayLanguage(translation: TranslationEntry): string {
    return displayLanguage(translation.language, translation.languageOther);
  }

  protected translationSummary(entry: LinguaLogEntry): string {
    const languages = entry.translations.map((translation) =>
      displayLanguage(translation.language, translation.languageOther),
    );

    return languages.length > 0 ? languages.join(', ') : 'None';
  }

  protected tableTitle(entry: LinguaLogEntry): string {
    return entry.tableName || 'Table';
  }

  protected tableSize(table: EntryTable | null): string {
    if (!table) {
      return 'None';
    }

    const columns = table.rows.reduce((count, row) => Math.max(count, row.length), 0);
    return `${table.rows.length} x ${columns}`;
  }

  protected resourceHref(resource: ResourceEntry): string {
    const trimmedResource = resource.value.trim();

    if (!trimmedResource) {
      return '';
    }

    if (/^https?:\/\//i.test(trimmedResource)) {
      return trimmedResource;
    }

    if (/^[^\s]+\.[^\s]+/.test(trimmedResource)) {
      return `https://${trimmedResource}`;
    }

    return '';
  }

  protected resourceLabel(resource: ResourceEntry, index: number): string {
    return resource.label || `Resource ${index + 1}`;
  }

  protected isBoldTableCell(table: EntryTable, rowIndex: number, columnIndex: number): boolean {
    return (table.boldHeader && rowIndex === 0) || (table.boldFirstColumn && columnIndex === 0);
  }

  protected formatDate(value: string): string {
    if (!value) {
      return 'Unknown time';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }

  protected errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Could not load sheet data.';
  }
}

function displayLanguage(language: LanguageOption, languageOther: string): string {
  return language === 'Other' && languageOther ? languageOther : language;
}
