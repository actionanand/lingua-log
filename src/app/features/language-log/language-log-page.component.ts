import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
  signal,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { GLOBE } from '../../../data/images/svg/globe';
import { AuthService } from '../../core/auth.service';
import { LogSearchService } from '../../core/log-search.service';
import { EntryEditorComponent } from '../language-entry/entry-editor.component';
import {
  LanguageOption,
  LinguaLogEntry,
  languageOptions,
} from '../language-entry/sheet-entry-codec';
import { LanguageLogSheetRow, LanguageLogSheetService } from './language-log-sheet.service';
import { SafeExplanationHtmlPipe } from './safe-explanation-html.pipe';

type LanguageFilter = string;
type LanguageScope = 'all' | 'source' | 'translation';

interface LanguageBlock {
  key: string;
  language: string;
  role: 'Source' | 'Translation';
  text: string;
  transliteration: string;
}

interface CapacitorBridge {
  getPlatform?: () => string;
  isNativePlatform?: () => boolean;
}

@Component({
  selector: 'app-language-log-page',
  imports: [EntryEditorComponent, SafeExplanationHtmlPipe],
  templateUrl: './language-log-page.component.html',
  styleUrl: './language-log-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(touchstart)': 'onTouchStart($event)',
    '(touchmove)': 'onTouchMove($event)',
    '(touchend)': 'onTouchEnd()',
    '(touchcancel)': 'onTouchEnd()',
  },
})
export class LanguageLogPageComponent {
  protected readonly authService = inject(AuthService);
  protected readonly logSearchService = inject(LogSearchService);
  protected readonly sheetService = inject(LanguageLogSheetService);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly globeSvg = this.sanitizer.bypassSecurityTrustHtml(GLOBE);
  protected readonly pageSizeOptions = [5, 10, 20, 50] as const;
  protected readonly selectedLanguage = signal<LanguageFilter>('All');
  protected readonly selectedScope = signal<LanguageScope>('all');
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(10);
  protected readonly editingRow = signal<LanguageLogSheetRow | null>(null);
  protected readonly pullDistance = signal(0);
  protected readonly rowsResource = resource({
    loader: ({ abortSignal }) => this.sheetService.fetchRows(abortSignal),
  });
  private touchStartY = 0;

  protected readonly rows = computed(() => this.rowsResource.value() ?? []);
  protected readonly visibleRows = computed(() =>
    this.authService.isLoggedIn()
      ? this.rows()
      : this.rows().filter((row) => !row.entry.isProtected),
  );
  protected readonly availableLanguages = computed(() => {
    const languages = new Set<string>(languageOptions);

    for (const row of this.visibleRows()) {
      languages.add(this.displayLanguage(row.entry.sourceLanguage, row.entry.sourceLanguageOther));

      for (const translation of row.entry.translations) {
        languages.add(this.displayLanguage(translation.language, translation.languageOther));
      }
    }

    return ['All', ...Array.from(languages).sort((a, b) => a.localeCompare(b))];
  });
  protected readonly filteredRows = computed(() =>
    this.visibleRows().filter(
      (row) =>
        (this.sourceMatchesFilters(row.entry) ||
          this.visibleLanguageBlocks(row.entry).length > 0) &&
        this.matchesSearch(row.entry),
    ),
  );
  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredRows().length / this.pageSize())),
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

    return this.filteredRows().slice(startIndex, startIndex + this.pageSize());
  });

  protected updateLanguageFilter(value: string): void {
    this.selectedLanguage.set(value || 'All');
    this.pageIndex.set(0);
  }

  protected updateScope(scope: LanguageScope): void {
    this.selectedScope.set(scope);
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

  protected reload(): void {
    this.rowsResource.reload();
    this.pageIndex.set(0);
  }

  protected openEdit(row: LanguageLogSheetRow): void {
    this.editingRow.set(row);
  }

  protected closeEdit(): void {
    this.editingRow.set(null);
  }

  protected offlineCacheMessage(): string {
    const cachedAt = this.sheetService.offlineCachedAt();

    if (!cachedAt) {
      return 'Offline content. Pull down or tap Reload when you are online.';
    }

    return `Offline content from ${this.formatDate(cachedAt)}. Pull down or tap Reload to fetch fresh data.`;
  }

  protected onTouchStart(event: TouchEvent): void {
    if (!isNativeAndroid() || window.scrollY > 0 || this.rowsResource.isLoading()) {
      return;
    }

    this.touchStartY = event.touches[0]?.clientY ?? 0;
  }

  protected onTouchMove(event: TouchEvent): void {
    if (!isNativeAndroid() || this.touchStartY === 0 || window.scrollY > 0) {
      return;
    }

    const currentY = event.touches[0]?.clientY ?? 0;
    const distance = Math.max(0, Math.min(96, currentY - this.touchStartY));

    if (distance > 8) {
      this.pullDistance.set(distance);
    }
  }

  protected onTouchEnd(): void {
    const distance = this.pullDistance();
    this.touchStartY = 0;
    this.pullDistance.set(0);

    if (isNativeAndroid() && distance >= 72) {
      this.reload();
    }
  }

  protected resourceHref(resource: string): string {
    const trimmedResource = resource.trim();

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

  protected resourceLabel(index: number): string {
    return `Resource ${index + 1}`;
  }

  protected displayRowNumber(rowNumber: number): number {
    return Math.max(1, rowNumber - 1);
  }

  protected sourceDisplayLanguage(entry: LinguaLogEntry): string {
    return this.displayLanguage(entry.sourceLanguage, entry.sourceLanguageOther);
  }

  protected visibleLanguageBlocks(entry: LinguaLogEntry): LanguageBlock[] {
    if (this.selectedScope() === 'source') {
      return [];
    }

    const blocks: LanguageBlock[] = entry.translations.map((translation, index) => ({
      key: `${entry.entryId}-translation-${index}`,
      language: this.displayLanguage(translation.language, translation.languageOther),
      role: 'Translation' as const,
      text: translation.text,
      transliteration: '',
    }));

    return blocks.filter((block) => this.matchesLanguageFilter(block.language));
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
    return error instanceof Error ? error.message : 'Could not load language log.';
  }

  private displayLanguage(language: LanguageOption, languageOther: string): string {
    return language === 'Other' && languageOther ? languageOther : language;
  }

  private matchesLanguageFilter(language: string): boolean {
    return this.selectedLanguage() === 'All' || language === this.selectedLanguage();
  }

  private sourceMatchesFilters(entry: LinguaLogEntry): boolean {
    return (
      this.selectedScope() !== 'translation' &&
      this.matchesLanguageFilter(this.sourceDisplayLanguage(entry))
    );
  }

  private matchesSearch(entry: LinguaLogEntry): boolean {
    const query = this.logSearchService.query().trim().toLowerCase();

    if (!query) {
      return true;
    }

    const searchableText = [
      entry.sourceLanguage,
      entry.sourceLanguageOther,
      entry.sourceText,
      entry.sourceTransliteration,
      htmlToText(entry.explanationHtml),
      ...entry.resources,
      ...entry.translations.flatMap((translation) => [
        translation.language,
        translation.languageOther,
        translation.text,
      ]),
    ]
      .join(' ')
      .toLowerCase();

    return searchableText.includes(query);
  }
}

function htmlToText(value: string): string {
  const template = document.createElement('template');
  template.innerHTML = value;

  return template.content.textContent ?? '';
}

function isNativeAndroid(): boolean {
  const capacitor = (globalThis as typeof globalThis & { Capacitor?: CapacitorBridge }).Capacitor;

  return (
    capacitor?.getPlatform?.() === 'android' && (capacitor.isNativePlatform?.() ?? true) === true
  );
}
