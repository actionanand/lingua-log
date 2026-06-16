import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { EntryEditorComponent } from '../language-entry/entry-editor.component';
import { LinguaLogEntry, parseSheetText } from '../language-entry/sheet-entry-codec';

@Component({
  selector: 'app-sheet-preview-page',
  imports: [EntryEditorComponent],
  templateUrl: './sheet-preview-page.component.html',
  styleUrl: './sheet-preview-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SheetPreviewPageComponent {
  protected readonly sheetText = signal('');
  protected readonly selectedEntry = signal<LinguaLogEntry | null>(null);
  protected readonly entries = computed(() => parseSheetText(this.sheetText()));
  protected readonly parseMessage = computed(() => {
    if (this.sheetText().trim().length > 0 && this.entries().length === 0) {
      return 'For multiple rows, paste the header row also. A single row can be pasted without the header.';
    }

    return '';
  });

  protected updateSheetText(value: string): void {
    this.sheetText.set(value);
    this.selectedEntry.set(null);
  }

  protected selectEntry(entry: LinguaLogEntry): void {
    this.selectedEntry.set(entry);
  }
}
