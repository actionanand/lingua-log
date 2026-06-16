import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'converter',
  },
  {
    path: 'converter',
    loadComponent: () =>
      import('./features/converter/converter-page.component').then((m) => m.ConverterPageComponent),
  },
  {
    path: 'sheet-preview',
    loadComponent: () =>
      import('./features/sheet-preview/sheet-preview-page.component').then(
        (m) => m.SheetPreviewPageComponent,
      ),
  },
  {
    path: '**',
    redirectTo: 'converter',
  },
];
