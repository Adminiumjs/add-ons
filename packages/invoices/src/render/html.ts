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

/*
 * The printed copy's own palette: ink, three greys and a hairline, on white.
 * Fixed rather than themed, for the reason in the header.
 */
function styles(accent: string, paper: string): string {
  const size = PAGE_SIZE[paper] ?? 'A4';
  const narrow = paper === 'receipt-80mm';
  return `
:root { color-scheme: only light; --accent: ${escapeHtml(accent)}; --ink: #191920; --mid: #4a4a54; --mut: #6a6a75; --sub: #8a8a95; --line: #e6e6ea; }
@page { size: ${size}; margin: ${narrow ? '4mm' : '16mm'}; }
* { box-sizing: border-box; }
body {
  margin: 0;
  background: #ffffff;
  color: var(--ink);
  font: ${narrow ? '11px' : '12.5px'}/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
.sheet { position: relative; max-width: ${narrow ? '72mm' : '178mm'}; margin: 0 auto; padding: ${narrow ? '4mm 0' : '10mm 0'}; }
.fig { font-variant-numeric: tabular-nums; unicode-bidi: isolate; white-space: nowrap; }
.void { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; overflow: hidden; }
.void span { transform: rotate(-24deg); font-size: ${narrow ? '48px' : '120px'}; font-weight: 800; letter-spacing: .08em; color: rgba(25,25,32,.08); border: ${narrow ? '4px' : '10px'} solid rgba(25,25,32,.08); border-radius: 26px; padding: 0 .25em; line-height: 1.15; }
.letterhead { display: ${narrow ? 'block' : 'grid'}; grid-template-columns: minmax(0,1fr) auto; gap: 20px; align-items: start; padding-block-end: ${narrow ? '10px' : '22px'}; border-block-end: 1px solid var(--line); }
.brand { display: flex; align-items: center; gap: 11px; }
.mark { inline-size: 40px; block-size: 40px; border-radius: 11px; background: var(--accent); color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 19px; font-weight: 800; flex: 0 0 auto; }
.mark-image { max-inline-size: 120px; max-block-size: 48px; }
.brand .name { font-size: ${narrow ? '14px' : '18px'}; font-weight: 800; letter-spacing: -.02em; }
.from { display: flex; flex-direction: column; gap: 3px; text-align: end; font-size: 11.5px; font-weight: 600; color: var(--mut); }
.parties { display: ${narrow ? 'block' : 'grid'}; grid-template-columns: minmax(0,1fr) auto; gap: 28px; align-items: start; padding-block: ${narrow ? '10px' : '22px'}; }
.label { font-size: 9.5px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--sub); }
.to { display: flex; flex-direction: column; gap: 4px; min-inline-size: 0; }
.to .who { font-size: 14px; font-weight: 700; }
.to .line { color: var(--mut); white-space: pre-line; }
.meta { display: flex; flex-direction: column; gap: 7px; min-inline-size: 190px; }
.meta .pair { display: flex; gap: 16px; justify-content: space-between; }
.meta .k { font-size: 11.5px; font-weight: 700; color: var(--sub); }
.meta .v { font-weight: 600; }
h1 { margin: 6px 0 18px; font-size: ${narrow ? '15px' : '24px'}; font-weight: 800; letter-spacing: -.03em; line-height: 1.2; }
table { inline-size: 100%; border-collapse: collapse; border-block-start: 1px solid var(--ink); }
th, td { padding: ${narrow ? '4px 2px' : '9px 4px'}; border-block-end: 1px solid var(--line); vertical-align: top; }
th { text-align: start; font-size: 9.5px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--sub); }
th.right, td.right { text-align: end; }
td.right { color: var(--mut); }
td.right:last-child { color: var(--ink); font-weight: 600; }
td .note { display: block; font-size: 11px; color: var(--sub); }
.ladder { margin-block-start: 12px; margin-inline-start: auto; inline-size: ${narrow ? '100%' : '52%'}; }
.ladder .row { display: flex; justify-content: space-between; gap: 16px; padding: 3px 0; }
.ladder .row .k { color: var(--sub); font-weight: 700; }
.ladder .row.total { border-block-start: 2px solid var(--accent); margin-block-start: 4px; padding-block-start: 7px; font-weight: 800; font-size: ${narrow ? '12px' : '15px'}; }
.ladder .row.total .k { color: var(--ink); }
.ledger { margin-block-start: 16px; margin-inline-start: auto; inline-size: ${narrow ? '100%' : '58%'}; }
.ledger .label { padding-block-end: 6px; border-block-end: 1px solid var(--line); }
.ledger .pay { display: grid; grid-template-columns: 90px minmax(0,1fr) auto; gap: 10px; padding: 3px 0; }
.ledger .pay .d { color: var(--mut); }
.ledger .due { display: flex; justify-content: space-between; gap: 24px; margin-block-start: 6px; padding-block-start: 8px; border-block-start: 1px solid var(--ink); font-weight: 800; }
.ledger .due .fig { font-size: 16px; }
.signed { margin-block-start: 20px; padding: 12px 14px; border: 1px solid var(--line); border-radius: 10px; }
.signed .name { font-size: 17px; font-weight: 700; font-style: italic; }
.signed .line { font-size: 11px; color: var(--mut); }
.passage { margin-block-start: 14px; }
.passage p { margin: 3px 0 0; white-space: pre-line; color: var(--mid); }
.foot { display: ${narrow ? 'block' : 'grid'}; grid-template-columns: minmax(150px,auto) minmax(0,1fr); gap: 24px; margin-block-start: ${narrow ? '14px' : '36px'}; padding: 14px 16px; border-radius: 10px; background: #f7f7f9; }
.foot .col { display: flex; flex-direction: column; gap: 5px; min-inline-size: 0; }
.foot .col + .col { margin-block-start: ${narrow ? '10px' : '0'}; }
.foot .line { white-space: pre-line; color: var(--mid); }
.foot .strong { font-weight: 700; color: var(--ink); }
.signature { margin-block-start: 12px; font-size: 10.5px; color: var(--sub); }
@media print { .sheet { padding: 0; } }
`.trim();
}

/** A figure, isolated so a right-to-left page never reorders its parts. */
const figure = (value: string): string => `<span class="fig">${escapeHtml(value)}</span>`;

/**
 * Somebody else's text — a street, a name, a description — isolated and left
 * to find its own direction, so "12 Bell Street" stays in that order on an
 * Arabic page while the line itself still sits where the page's lines sit.
 */
const own = (value: string): string => `<bdi>${escapeHtml(value)}</bdi>`;

function block(entry: Block): string {
  switch (entry.kind) {
    case 'letterhead':
      return (
        '<header class="letterhead"><div class="brand">' +
        (entry.image !== ''
          ? `<img class="mark-image" alt="" src="${escapeHtml(entry.image)}">`
          : entry.letter === ''
            ? ''
            : `<span class="mark" aria-hidden="true">${escapeHtml(entry.letter)}</span>`) +
        (entry.name === '' ? '' : `<span class="name">${own(entry.name)}</span>`) +
        '</div><div class="from">' +
        entry.lines.map((line) => `<span>${own(line)}</span>`).join('') +
        '</div></header>'
      );

    case 'parties':
      return (
        '<section class="parties"><div class="to">' +
        (entry.toLabel === '' ? '' : `<span class="label">${escapeHtml(entry.toLabel)}</span>`) +
        (entry.toName === '' ? '' : `<span class="who">${own(entry.toName)}</span>`) +
        entry.toLines.map((line) => `<span class="line">${own(line)}</span>`).join('') +
        '</div><div class="meta">' +
        entry.meta
          .map(
            (row) =>
              `<span class="pair"><span class="k">${escapeHtml(row.label)}</span>` +
              `<span class="v">${figure(row.value)}</span></span>`,
          )
          .join('') +
        '</div></section>'
      );

    case 'title':
      return `<h1>${own(entry.text)}</h1>`;

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
              row.cells
                .map((cell, at) => {
                  const right = entry.columns[at]?.align === 'right';
                  const note = at === 0 && row.note !== '' ? `<span class="note">${escapeHtml(row.note)}</span>` : '';
                  return `<td${right ? ' class="right"' : ''}>${right ? figure(cell) : own(cell)}${note}</td>`;
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
              `<span class="k">${escapeHtml(row.label)}</span>${figure(row.value)}</div>`,
          )
          .join('') +
        '</section>'
      );

    case 'ledger':
      return (
        '<section class="ledger">' +
        `<div class="label">${escapeHtml(entry.heading)}</div>` +
        entry.rows
          .map(
            (row) =>
              `<div class="pay"><span class="d">${figure(row.date)}</span>` +
              `<span>${own(row.method)}</span>${figure(row.amount)}</div>`,
          )
          .join('') +
        `<div class="due"><span>${escapeHtml(entry.dueLabel)}</span>${figure(entry.due)}</div>` +
        '</section>'
      );

    case 'signed':
      return (
        '<section class="signed">' +
        `<div class="label">${escapeHtml(entry.heading)}</div>` +
        `<div class="name">${own(entry.name)}</div>` +
        (entry.line === '' ? '' : `<div class="line">${escapeHtml(entry.line)}</div>`) +
        '</section>'
      );

    case 'passage':
      return (
        '<section class="passage">' +
        (entry.heading === '' ? '' : `<div class="label">${escapeHtml(entry.heading)}</div>`) +
        entry.lines.map((line) => `<p>${own(line)}</p>`).join('') +
        '</section>'
      );

    case 'foot':
      return (
        '<section class="foot">' +
        (entry.payLines.length === 0
          ? ''
          : '<div class="col">' +
            `<span class="label">${escapeHtml(entry.payLabel)}</span>` +
            entry.payLines
              .map((line) => `<span class="line${line.strong ? ' strong' : ''}">${own(line.text)}</span>`)
              .join('') +
            '</div>') +
        (entry.footText === ''
          ? ''
          : '<div class="col">' +
            `<span class="label">${escapeHtml(entry.footLabel)}</span>` +
            `<span class="line">${own(entry.footText)}</span>` +
            '</div>') +
        '</section>'
      );

    case 'signature':
      return `<div class="signature">${escapeHtml(entry.text)}</div>`;
  }
}

/**
 * The whole page, as bytes.
 *
 * `<title>` is the document's own kind and number, because that is what a
 * browser tab and a printed header show, and "Untitled" on an invoice is the
 * sort of detail that gets noticed.
 *
 * `dir` comes from the DOCUMENT's language and not from the viewer's locale:
 * an Arabic invoice read by an English-speaking accountant is still an Arabic
 * invoice, and flipping it because the reader's browser is left-to-right would
 * scramble it. Every figure is isolated, so a total keeps its digits in order
 * on a right-to-left page.
 */
export function renderHtml(document: Document, paper: string): Uint8Array {
  const title = document.name === '' ? 'Document' : document.name;

  const html =
    '<!doctype html>' +
    `<html lang="${escapeHtml(document.locale)}" dir="${document.rtl ? 'rtl' : 'ltr'}">` +
    '<head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    `<title>${escapeHtml(title)}</title>` +
    `<style>${styles(document.accent, paper)}</style>` +
    '</head><body><main class="sheet">' +
    (document.voidMark === null
      ? ''
      : `<div class="void" aria-hidden="true"><span>${escapeHtml(document.voidMark)}</span></div>`) +
    document.blocks.map(block).join('') +
    '</main></body></html>';

  return new TextEncoder().encode(html);
}
