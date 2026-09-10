/**
 * The HTML renderer — a self-contained page, one `<style>`, no script, no
 * fetch, no font.
 *
 * ── EVERY LOCALE, WHICH IS WHY HTML EXISTS HERE AT ALL ─────────────────────
 *
 * The PDF writer draws Helvetica's WinAnsi repertoire and refuses the rest
 * (34 O12). HTML has no such limit — it is UTF-8, and the reader's own browser
 * has the fonts — so a Japanese or Arabic document is rendered here in full
 * and refused only for PDF. The conformance suite asserts exactly that pairing:
 * the same subject that returns `LATIN_ONLY` for `pdf` must succeed for `html`,
 * which is what proves the refusal belongs to the WRITER and is not a blanket
 * rejection of the subject.
 *
 * ── FORCED LIGHT, AND WHY THAT IS NOT A STYLE PREFERENCE ───────────────────
 *
 * The page sets its own colours and does NOT answer `prefers-color-scheme`.
 * These bytes are printed, attached to email and opened in readers that
 * compose against white; a document that turned dark in somebody's viewer
 * would print as a black rectangle, and a light-on-dark invoice photographed
 * for an expense claim is unreadable. `color-scheme: only light` says so to
 * the browser rather than leaving it to be inferred from the colours.
 *
 * ── ESCAPING IS NOT OPTIONAL AND NOT CLEVER ────────────────────────────────
 *
 * Every string in a document comes from somebody's database, and a customer
 * name is attacker-controlled input by the time a public request can supply
 * one (34 D15). One escape function, applied at every interpolation, five
 * characters, no allow-list and no "this one is safe" exception. The
 * conformance suite pushes `<script>alert(1)</script>` through a text slot on
 * every kind and requires the string `<script` to be absent from the output.
 */

import type { Block, Document } from './layout.ts';

const ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** The one escape, applied at every interpolation below without exception. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ESCAPES[character] ?? character);
}

/** `a4` | `letter` | `receipt-80mm` → the `@page` size the sheet is drawn for. */
const PAGE_SIZE: Readonly<Record<string, string>> = {
  a4: 'A4',
  letter: 'Letter',
  // 80 mm is a till roll: fixed width, and the height grows with the content
  // rather than paginating, which is what a roll actually does.
  'receipt-80mm': '80mm auto',
};

function styles(accent: string, paper: string): string {
  const size = PAGE_SIZE[paper] ?? 'A4';
  const narrow = paper === 'receipt-80mm';
  return `
:root { color-scheme: only light; --accent: ${escapeHtml(accent)}; }
@page { size: ${size}; margin: ${narrow ? '4mm' : '16mm'}; }
* { box-sizing: border-box; }
body {
  margin: 0;
  background: #ffffff;
  color: #111827;
  font: ${narrow ? '11px' : '13px'}/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
.sheet { max-width: ${narrow ? '72mm' : '178mm'}; margin: 0 auto; padding: ${narrow ? '4mm 0' : '10mm 0'}; }
.heading { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; border-block-end: 2px solid var(--accent); padding-block-end: 8px; }
.heading h1 { margin: 0; font-size: ${narrow ? '15px' : '22px'}; letter-spacing: .04em; color: var(--accent); }
.heading .number { font-variant-numeric: tabular-nums; color: #4b5563; }
.parties { display: flex; gap: 24px; margin-block-start: 14px; flex-wrap: wrap; }
.party { min-width: 40%; }
.label { font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: #6b7280; margin-block-end: 3px; }
.party .name { font-weight: 600; }
.party div, .passage p { white-space: pre-line; }
.facts { margin-block-start: 12px; display: flex; gap: 20px; flex-wrap: wrap; }
.fact .value { font-variant-numeric: tabular-nums; }
table { width: 100%; border-collapse: collapse; margin-block-start: 16px; }
th, td { padding: ${narrow ? '4px 2px' : '7px 4px'}; border-block-end: 1px solid #e5e7eb; vertical-align: top; }
th { text-align: start; font-size: 10px; letter-spacing: .06em; text-transform: uppercase; color: #6b7280; border-block-end: 1px solid #d1d5db; }
th.right, td.right { text-align: end; font-variant-numeric: tabular-nums; white-space: nowrap; }
.ladder { margin-block-start: 12px; margin-inline-start: auto; width: ${narrow ? '100%' : '52%'}; }
.ladder .row { display: flex; justify-content: space-between; gap: 16px; padding: 4px 0; }
.ladder .row.total { border-block-start: 2px solid var(--accent); margin-block-start: 4px; padding-block-start: 7px; font-weight: 700; font-size: ${narrow ? '12px' : '15px'}; }
.ladder .value { font-variant-numeric: tabular-nums; }
.passage { margin-block-start: 14px; }
.passage p { margin: 2px 0 0; }
`.trim();
}

function block(entry: Block): string {
  switch (entry.kind) {
    case 'heading':
      return (
        '<header class="heading">' +
        `<h1>${escapeHtml(entry.title)}</h1>` +
        (entry.number === '' ? '' : `<span class="number">${escapeHtml(entry.number)}</span>`) +
        '</header>'
      );

    case 'parties':
      return (
        '<section class="parties">' +
        `<div class="party"><div class="label">${escapeHtml(entry.fromLabel)}</div>` +
        entry.from.map((line) => `<div>${escapeHtml(line)}</div>`).join('') +
        '</div>' +
        `<div class="party"><div class="label">${escapeHtml(entry.toLabel)}</div>` +
        (entry.toName === '' ? '' : `<div class="name">${escapeHtml(entry.toName)}</div>`) +
        entry.to.map((line) => `<div>${escapeHtml(line)}</div>`).join('') +
        '</div></section>'
      );

    case 'facts':
      return (
        '<section class="facts">' +
        entry.rows
          .map(
            (row) =>
              `<div class="fact"><div class="label">${escapeHtml(row.label)}</div>` +
              `<div class="value">${escapeHtml(row.value)}</div></div>`,
          )
          .join('') +
        '</section>'
      );

    case 'items':
      return (
        '<table><thead><tr>' +
        entry.columns
          .map(
            (column) =>
              `<th${column.align === 'right' ? ' class="right"' : ''}>${escapeHtml(column.label)}</th>`,
          )
          .join('') +
        '</tr></thead><tbody>' +
        entry.rows
          .map(
            (row) =>
              '<tr>' +
              row
                .map((cell, at) => {
                  const right = entry.columns[at]?.align === 'right';
                  return `<td${right ? ' class="right"' : ''}>${escapeHtml(cell)}</td>`;
                })
                .join('') +
              '</tr>',
          )
          .join('') +
        '</tbody></table>'
      );

    case 'ladder':
      return (
        '<section class="ladder">' +
        entry.rows
          .map(
            (row) =>
              `<div class="row${row.emphasis ? ' total' : ''}">` +
              `<span>${escapeHtml(row.label)}</span>` +
              `<span class="value">${escapeHtml(row.value)}</span></div>`,
          )
          .join('') +
        '</section>'
      );

    case 'passage':
      return (
        '<section class="passage">' +
        `<div class="label">${escapeHtml(entry.heading)}</div>` +
        entry.lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('') +
        '</section>'
      );
  }
}

/**
 * The whole page, as bytes.
 *
 * `<title>` is the document's own heading and number, because that is what a
 * browser tab and a printed header show, and "Untitled" on an invoice is the
 * sort of detail that gets noticed.
 *
 * `dir` comes from the DOCUMENT's language and not from the viewer's locale:
 * an Arabic invoice read by an English-speaking accountant is still an Arabic
 * invoice, and flipping it because the reader's browser is left-to-right would
 * scramble it.
 */
export function renderHtml(document: Document, paper: string): Uint8Array {
  const heading = document.blocks.find((entry) => entry.kind === 'heading');
  const title =
    heading === undefined
      ? 'Document'
      : [heading.title, heading.number].filter((part) => part !== '').join(' ');

  const html =
    '<!doctype html>' +
    `<html lang="${escapeHtml(document.locale)}" dir="${document.rtl ? 'rtl' : 'ltr'}">` +
    '<head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    `<title>${escapeHtml(title)}</title>` +
    `<style>${styles(document.accent, paper)}</style>` +
    '</head><body><main class="sheet">' +
    document.blocks.map(block).join('') +
    '</main></body></html>';

  return new TextEncoder().encode(html);
}
