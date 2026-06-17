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

@Component({
  selector: 'app-language-log-page',
  imports: [EntryEditorComponent, SafeExplanationHtmlPipe],
  templateUrl: './language-log-page.component.html',
  styleUrl: './language-log-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LanguageLogPageComponent {
  protected readonly authService = inject(AuthService);
  private readonly sheetService = inject(LanguageLogSheetService);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly globeSvg = this.sanitizer.bypassSecurityTrustHtml(GLOBE);
  protected readonly pageSizeOptions = [5, 10, 20, 50] as const;
  protected readonly selectedLanguage = signal<LanguageFilter>('All');
  protected readonly selectedScope = signal<LanguageScope>('all');
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(10);
  protected readonly editingRow = signal<LanguageLogSheetRow | null>(null);
  protected readonly rowsResource = resource({
    loader: ({ abortSignal }) => this.sheetService.fetchRows(abortSignal),
  });

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
    this.visibleRows().filter((row) => this.visibleLanguageBlocks(row.entry).length > 0),
  );
  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredRows().length / this.pageSize())),
  );
  protected readonly pagedRows = computed(() => {
    const startIndex = this.pageIndex() * this.pageSize();

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
    this.pageIndex.update((index) => Math.max(0, index - 1));
  }

  protected nextPage(): void {
    this.pageIndex.update((index) => Math.min(this.totalPages() - 1, index + 1));
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

  protected visibleLanguageBlocks(entry: LinguaLogEntry): LanguageBlock[] {
    const blocks: LanguageBlock[] = [];

    if (this.selectedScope() !== 'translation') {
      blocks.push({
        key: `${entry.entryId}-source`,
        language: this.displayLanguage(entry.sourceLanguage, entry.sourceLanguageOther),
        role: 'Source',
        text: entry.sourceText,
        transliteration: entry.sourceTransliteration,
      });
    }

    if (this.selectedScope() !== 'source') {
      blocks.push(
        ...entry.translations.map((translation, index) => ({
          key: `${entry.entryId}-translation-${index}`,
          language: this.displayLanguage(translation.language, translation.languageOther),
          role: 'Translation' as const,
          text: translation.text,
          transliteration: '',
        })),
      );
    }

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
}
