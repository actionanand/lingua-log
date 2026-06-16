import { ChangeDetectionStrategy, Component } from '@angular/core';
import { EntryEditorComponent } from '../language-entry/entry-editor.component';

@Component({
  selector: 'app-converter-page',
  imports: [EntryEditorComponent],
  template: `<app-entry-editor heading="Create language log entry" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConverterPageComponent {}
