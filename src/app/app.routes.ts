import { Routes } from '@angular/router';
import { loggedInGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'logs',
  },
  {
    path: 'logs',
    loadComponent: () =>
      import('./features/language-log/language-log-page.component').then(
        (m) => m.LanguageLogPageComponent,
      ),
  },
  {
    path: 'converter',
    canMatch: [loggedInGuard],
    loadComponent: () =>
      import('./features/converter/converter-page.component').then((m) => m.ConverterPageComponent),
  },
  {
    path: 'sheet-preview',
    canMatch: [loggedInGuard],
    loadComponent: () =>
      import('./features/sheet-preview/sheet-preview-page.component').then(
        (m) => m.SheetPreviewPageComponent,
      ),
  },
  {
    path: 'not-found',
    loadComponent: () =>
      import('./features/not-found/not-found-page.component').then((m) => m.NotFoundPageComponent),
  },
  {
    path: '**',
    redirectTo: 'not-found',
  },
];
