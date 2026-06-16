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
  LanguageOption,
  LinguaLogEntry,
  TranslationEntry,
  createEmptyEntry,
  languageOptions,
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

type RichTextCommand = 'bold' | 'italic' | 'strikeThrough' | 'insertUnorderedList';

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
  protected readonly maxResources = 2;
  protected readonly copyStatus = signal('');
  protected readonly sourceLanguage = signal<LanguageOption>('Tamil');
  protected readonly availableTranslationLanguages = computed(() =>
    this.languages.filter((language) => language !== this.sourceLanguage()),
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

  protected formatExplanation(command: RichTextCommand): void {
    const editor = this.explanationEditor();
    editor?.nativeElement.focus();
    document.execCommand('styleWithCSS', false, 'false');
    document.execCommand(command, false);
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
      return `<b>${children}</b>`;
    case 'i':
    case 'em':
      return `<i>${children}</i>`;
    case 's':
    case 'strike':
      return `<s>${children}</s>`;
    case 'ul':
      return `<ul>${children}</ul>`;
    case 'li':
      return `<li>${children}</li>`;
    case 'br':
      return '<br>';
    case 'div':
    case 'p':
      return `${children}<br>`;
    default:
      return children;
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
