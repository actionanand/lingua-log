import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

const allowedTextColors = ['green', 'red', 'blue', 'purple', 'darkorange'] as const;
const allowedBackgroundColors = ['lightgreen', 'lightpink', 'yellow', 'lightblue', 'lightgray'] as const;
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

@Pipe({
  name: 'safeExplanationHtml',
})
export class SafeExplanationHtmlPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(value: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(sanitizeExplanationHtml(value));
  }
}

function sanitizeExplanationHtml(html: string): string {
  const template = document.createElement('template');
  template.innerHTML = html;

  return Array.from(template.content.childNodes).map(sanitizeNode).join('');
}

function sanitizeNode(node: ChildNode): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeHtml(node.textContent ?? '');
  }

  if (!(node instanceof HTMLElement)) {
    return '';
  }

  const children = Array.from(node.childNodes).map(sanitizeNode).join('');

  switch (node.tagName.toLowerCase()) {
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
    case 'span':
      return sanitizeSpan(node, children);
    default:
      return children;
  }
}

function sanitizeSpan(node: HTMLElement, children: string): string {
  const styles: string[] = [];
  const color = normalizeAllowedColor(node.style.color, allowedTextColors);
  const backgroundColor = normalizeAllowedColor(node.style.backgroundColor, allowedBackgroundColors);

  if (color) {
    styles.push(`color: ${color}`);
  }

  if (backgroundColor) {
    styles.push(`background-color: ${backgroundColor}`);
  }

  return styles.length > 0 ? `<span style="${styles.join('; ')}">${children}</span>` : children;
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
