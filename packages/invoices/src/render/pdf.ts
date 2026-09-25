/**
 * The PDF renderer — the same blocks `html.ts` draws, on paper.
 *
 * It owns no layout decisions: `layout.ts` decided what the document contains
 * and in what order, and this file decides only where on a sheet each block
 * lands. That split is what keeps a downloaded PDF and a previewed page from
 * disagreeing about an invoice somebody is being asked to pay.
 *
 * ── COVERAGE IS CHECKED BEFORE ANY OF THIS RUNS ────────────────────────────
 *
 * Not here — in `server.ts`, over every string the layout produced, before a
 * single byte is written. By the time this file executes, the document is
 * known to be drawable. A check inside the writer could only refuse halfway
 * through a page it had already half-drawn, and a check per-primitive would
 * report the first bad glyph rather than all of them.
 *
 * ── PAGINATION IS BY LINES, WHICH IS THE HONEST APPROXIMATION ──────────────
 *
 * A real typesetter measures each block and breaks where it fits. This counts
 * lines against the space left and moves to a new page when the next block
 * would not fit, keeping the table header with its rows and the totals ladder
 * whole. That is enough for a document whose long part is a list of lines, and
 * it is stated here rather than discovered: an invoice with a 400-word note
 * will break that note across a page boundary mid-paragraph.
 */

import type { Block, Document } from './layout.ts';
import { box, paragraph, rule, text, textRight, wrap, type Frame } from '../pdf/primitives.ts';
import { widthOf } from '../pdf/helvetica.ts';
import { ascii, fontName, literal, pt, rgb, writePdf, type Page } from '../pdf/writer.ts';

const PAPER: Readonly<Record<string, Frame>> = {
  a4: { widthPt: 595, heightPt: 842 },
  letter: { widthPt: 612, heightPt: 792 },
  // 80 mm at 72 dpi is 227 pt. The height is a long roll rather than a sheet:
  // a till does not turn the page.
  'receipt-80mm': { widthPt: 227, heightPt: 1400 },
};

const INK = '#191920';
const MID = '#4a4a54';
const MUTED = '#6a6a75';
const SUBTLE = '#8a8a95';
const HAIRLINE = '#e6e6ea';
const PANEL = '#f7f7f9';

interface Cursor {
  ops: number[];
  y: number;
  page: number;
  /** What every page starts with: the accent edge, and a void document's word across it. */
  readonly prelude: readonly number[];
}

interface Metrics {
  readonly frame: Frame;
  readonly marginX: number;
  readonly top: number;
  readonly bottom: number;
  readonly body: number;
  readonly small: number;
  readonly leading: number;
  readonly narrow: boolean;
}

function metricsFor(paper: string): Metrics {
  const frame = PAPER[paper] ?? PAPER.a4!;
  const narrow = paper === 'receipt-80mm';
  const marginX = narrow ? 10 : 48;
  return {
    frame,
    marginX,
    top: narrow ? 14 : 48,
    bottom: frame.heightPt - (narrow ? 14 : 48),
    body: narrow ? 8 : 9.5,
    small: narrow ? 6.5 : 7.5,
    leading: narrow ? 11 : 13,
    narrow,
  };
}

const contentWidth = (m: Metrics): number => m.frame.widthPt - m.marginX * 2;
const right = (m: Metrics): number => m.frame.widthPt - m.marginX;

/** Start a new page when `needed` points would run past the bottom margin. */
function ensure(cursor: Cursor, m: Metrics, needed: number, pages: Page[]): void {
  if (cursor.y + needed <= m.bottom) return;
  pages.push({ widthPt: m.frame.widthPt, heightPt: m.frame.heightPt, stream: cursor.ops });
  cursor.ops = [...cursor.prelude];
  cursor.y = m.top;
  cursor.page += 1;
}

function label(m: Metrics, x: number, y: number, value: string): number[] {
  return text(m.frame, x, y, value.toUpperCase(), { sizePt: m.small, weight: 'bold', color: SUBTLE });
}

function drawLetterhead(entry: Extract<Block, { kind: 'letterhead' }>, m: Metrics, cursor: Cursor, accent: string): void {
  const markSize = m.narrow ? 20 : 30;
  let x = m.marginX;
  // The mark: the name's first letter on the accent. An image is drawn in the
  // HTML copy only — the caller is told so in the PDF's warnings.
  if (entry.letter !== '') {
    cursor.ops.push(...box(m.frame, x, cursor.y, markSize, markSize, accent));
    const size = m.narrow ? 11 : 15;
    const letterWidth = widthOf(entry.letter, size, 'bold');
    cursor.ops.push(
      ...text(m.frame, x + (markSize - letterWidth) / 2, cursor.y + markSize / 2 + size * 0.36, entry.letter, {
        sizePt: size,
        weight: 'bold',
        color: '#ffffff',
      }),
    );
    x += markSize + 9;
  }
  const nameSize = m.narrow ? 11 : 15;
  if (entry.name !== '') {
    cursor.ops.push(...text(m.frame, x, cursor.y + markSize / 2 + nameSize * 0.36, entry.name, { sizePt: nameSize, weight: 'bold', color: INK }));
  }
  let y = cursor.y;
  if (m.narrow) {
    y = cursor.y + markSize + 4;
    for (const line of entry.lines) {
      cursor.ops.push(...text(m.frame, m.marginX, y + m.small, line, { sizePt: m.small, color: MUTED }));
      y += m.small + 3;
    }
    cursor.y = Math.max(cursor.y + markSize, y) + 6;
  } else {
    for (const line of entry.lines) {
      cursor.ops.push(...textRight(m.frame, right(m), y + m.small + 1, line, { sizePt: m.small + 0.5, color: MUTED }));
      y += m.small + 4;
    }
    cursor.y = Math.max(cursor.y + markSize, y) + 12;
  }
  cursor.ops.push(...rule(m.frame, m.marginX, cursor.y, contentWidth(m), HAIRLINE));
  cursor.y += m.narrow ? 8 : 16;
}

function drawParties(entry: Extract<Block, { kind: 'parties' }>, m: Metrics, cursor: Cursor): void {
  const metaWidth = m.narrow ? contentWidth(m) : 190;
  const toWidth = m.narrow ? contentWidth(m) : contentWidth(m) - metaWidth - 28;
  let y = cursor.y;
  if (entry.toLabel !== '') {
    cursor.ops.push(...label(m, m.marginX, y + m.small, entry.toLabel));
    y += m.small + 5;
  }
  if (entry.toName !== '') {
    const drawn = paragraph(m.frame, m.marginX, y + m.body + 1, entry.toName, toWidth, { sizePt: m.body + 1.5, weight: 'bold', color: INK }, m.leading + 1);
    cursor.ops.push(...drawn.ops);
    y = drawn.y - m.body - 1 + 2;
  }
  for (const line of entry.toLines) {
    const drawn = paragraph(m.frame, m.marginX, y + m.body, line, toWidth, { sizePt: m.body, color: MUTED }, m.leading);
    cursor.ops.push(...drawn.ops);
    y = drawn.y - m.body;
  }

  let metaY = m.narrow ? y + 6 : cursor.y;
  const metaX = m.narrow ? m.marginX : right(m) - metaWidth;
  for (const row of entry.meta) {
    cursor.ops.push(...text(m.frame, metaX, metaY + m.body, row.label, { sizePt: m.small + 0.5, weight: 'bold', color: SUBTLE }));
    cursor.ops.push(...textRight(m.frame, right(m), metaY + m.body, row.value, { sizePt: m.body, color: INK }));
    metaY += m.leading + 2;
  }
  cursor.y = Math.max(y, metaY) + (m.narrow ? 8 : 16);
}

function drawTitle(entry: Extract<Block, { kind: 'title' }>, m: Metrics, cursor: Cursor, pages: Page[]): void {
  const size = m.narrow ? 12 : 18;
  ensure(cursor, m, size * 2, pages);
  const drawn = paragraph(m.frame, m.marginX, cursor.y + size, entry.text, contentWidth(m), { sizePt: size, weight: 'bold', color: INK }, size + 4);
  cursor.ops.push(...drawn.ops);
  cursor.y = drawn.y - size + (m.narrow ? 6 : 12);
}

function drawItems(entry: Extract<Block, { kind: 'items' }>, m: Metrics, cursor: Cursor, pages: Page[]): void {
  // The first column takes what the three figure columns leave. On a till roll
  // the figure columns are narrower because there is nothing else to give.
  const numeric = m.narrow ? 38 : 84;
  const edges = [right(m) - numeric * 2, right(m) - numeric, right(m)];
  const descWidth = contentWidth(m) - numeric * 3 - 6;

  const header = (): void => {
    cursor.ops.push(...rule(m.frame, m.marginX, cursor.y, contentWidth(m), INK));
    cursor.y += 6;
    cursor.ops.push(...label(m, m.marginX, cursor.y + m.small, entry.columns[0]?.label ?? ''));
    entry.columns.slice(1).forEach((column, at) => {
      if (column.label === '') return;
      cursor.ops.push(
        ...textRight(m.frame, edges[at]!, cursor.y + m.small, column.label.toUpperCase(), {
          sizePt: m.small,
          weight: 'bold',
          color: SUBTLE,
        }),
      );
    });
    cursor.y += m.small + 5;
    cursor.ops.push(...rule(m.frame, m.marginX, cursor.y, contentWidth(m), HAIRLINE));
    cursor.y += 6;
  };

  ensure(cursor, m, m.small + m.leading * 2, pages);
  header();

  for (const row of entry.rows) {
    const wrapped = wrap(row.cells[0] ?? '', descWidth, { sizePt: m.body });
    const notes = row.note === '' ? [] : wrap(row.note, descWidth, { sizePt: m.small });
    const height = wrapped.length * m.leading + notes.length * (m.small + 3) + 4;
    const before = cursor.page;
    ensure(cursor, m, height, pages);
    // A row that pushed onto a new page needs the column headings again —
    // otherwise page two is a table of unlabelled numbers.
    if (cursor.page !== before) header();

    wrapped.forEach((line, at) => {
      cursor.ops.push(...text(m.frame, m.marginX, cursor.y + m.body + at * m.leading, line, { sizePt: m.body, color: INK }));
    });
    notes.forEach((line, at) => {
      cursor.ops.push(
        ...text(m.frame, m.marginX, cursor.y + wrapped.length * m.leading + m.small + at * (m.small + 3), line, {
          sizePt: m.small,
          color: SUBTLE,
        }),
      );
    });
    row.cells.slice(1).forEach((cell, at) => {
      const last = at === row.cells.length - 2;
      cursor.ops.push(
        ...textRight(m.frame, edges[at]!, cursor.y + m.body, cell, {
          sizePt: m.body,
          weight: last ? 'bold' : 'regular',
          color: last ? INK : MUTED,
        }),
      );
    });
    cursor.y += height;
    cursor.ops.push(...rule(m.frame, m.marginX, cursor.y - 2, contentWidth(m), HAIRLINE));
  }
  cursor.y += 6;
}

function drawLadder(entry: Extract<Block, { kind: 'ladder' }>, m: Metrics, cursor: Cursor, pages: Page[], accent: string): void {
  const width = m.narrow ? contentWidth(m) : contentWidth(m) * 0.52;
  const x = right(m) - width;

  // The ladder is kept whole: a total on its own on page two, with the
  // subtotal it comes from on page one, is worse than a short first page.
  ensure(cursor, m, entry.rows.length * (m.leading + 4) + 12, pages);

  for (const row of entry.rows) {
    if (row.emphasis) {
      cursor.ops.push(...rule(m.frame, x, cursor.y, width, accent, 1.5));
      cursor.y += 6;
    }
    const size = row.emphasis ? m.body + (m.narrow ? 2 : 3) : m.body;
    const weight = row.emphasis ? ('bold' as const) : ('regular' as const);
    cursor.ops.push(...text(m.frame, x, cursor.y + size, row.label, { sizePt: size, weight, color: row.emphasis ? INK : SUBTLE }));
    cursor.ops.push(...textRight(m.frame, right(m), cursor.y + size, row.value, { sizePt: size, weight, color: INK }));
    cursor.y += size + (row.emphasis ? 8 : 5);
  }
  cursor.y += 6;
}

function drawLedger(entry: Extract<Block, { kind: 'ledger' }>, m: Metrics, cursor: Cursor, pages: Page[]): void {
  const width = m.narrow ? contentWidth(m) : contentWidth(m) * 0.58;
  const x = right(m) - width;
  ensure(cursor, m, (entry.rows.length + 3) * (m.leading + 2), pages);
  cursor.y += 6;
  cursor.ops.push(...label(m, x, cursor.y + m.small, entry.heading));
  cursor.y += m.small + 4;
  cursor.ops.push(...rule(m.frame, x, cursor.y, width, HAIRLINE));
  cursor.y += 4;
  for (const row of entry.rows) {
    cursor.ops.push(...text(m.frame, x, cursor.y + m.body, row.date, { sizePt: m.body, color: MUTED }));
    cursor.ops.push(...text(m.frame, x + (m.narrow ? 60 : 80), cursor.y + m.body, row.method, { sizePt: m.body, color: MID }));
    cursor.ops.push(...textRight(m.frame, right(m), cursor.y + m.body, row.amount, { sizePt: m.body, weight: 'bold', color: INK }));
    cursor.y += m.leading + 1;
  }
  cursor.y += 3;
  cursor.ops.push(...rule(m.frame, x, cursor.y, width, INK));
  cursor.y += 5;
  const size = m.body + (m.narrow ? 2 : 3);
  cursor.ops.push(...text(m.frame, x, cursor.y + size, entry.dueLabel, { sizePt: m.body + 1, weight: 'bold', color: INK }));
  cursor.ops.push(...textRight(m.frame, right(m), cursor.y + size, entry.due, { sizePt: size, weight: 'bold', color: INK }));
  cursor.y += size + 10;
}

function drawSigned(entry: Extract<Block, { kind: 'signed' }>, m: Metrics, cursor: Cursor, pages: Page[]): void {
  ensure(cursor, m, m.leading * 4, pages);
  cursor.y += 8;
  cursor.ops.push(...label(m, m.marginX, cursor.y + m.small, entry.heading));
  cursor.y += m.small + 5;
  // Bold in the PDF where the page sets it in italics: the writer carries the
  // two base faces it needs and no third.
  cursor.ops.push(...text(m.frame, m.marginX, cursor.y + m.body + 3, entry.name, { sizePt: m.body + 4, weight: 'bold', color: INK }));
  cursor.y += m.body + 8;
  if (entry.line !== '') {
    cursor.ops.push(...text(m.frame, m.marginX, cursor.y + m.small, entry.line, { sizePt: m.small + 0.5, color: MUTED }));
    cursor.y += m.leading;
  }
  cursor.y += 6;
}

function drawPassage(entry: Extract<Block, { kind: 'passage' }>, m: Metrics, cursor: Cursor, pages: Page[]): void {
  ensure(cursor, m, m.small + m.leading * 2, pages);
  if (entry.heading !== '') {
    cursor.ops.push(...label(m, m.marginX, cursor.y + m.small, entry.heading));
    cursor.y += m.small + 4;
  }
  for (const line of entry.lines) {
    const drawn = paragraph(m.frame, m.marginX, cursor.y + m.body, line, contentWidth(m), { sizePt: m.body, color: MID }, m.leading);
    cursor.ops.push(...drawn.ops);
    cursor.y = drawn.y - m.body + 4;
  }
  cursor.y += 6;
}

function drawFoot(entry: Extract<Block, { kind: 'foot' }>, m: Metrics, cursor: Cursor, pages: Page[]): void {
  const pad = m.narrow ? 6 : 12;
  const both = entry.payLines.length > 0 && entry.footText !== '';
  const leftWidth = m.narrow || !both ? contentWidth(m) - pad * 2 : (contentWidth(m) - pad * 2) * 0.42;
  const rightX = m.narrow || !both ? m.marginX + pad : m.marginX + pad + leftWidth + 20;
  const rightWidth = m.narrow || !both ? contentWidth(m) - pad * 2 : contentWidth(m) - pad * 2 - leftWidth - 20;

  const payLines = entry.payLines.flatMap((line) =>
    wrap(line.text, leftWidth, { sizePt: m.body, weight: line.strong ? 'bold' : 'regular' }).map((text) => ({ text, strong: line.strong })),
  );
  const footLines = entry.footText === '' ? [] : wrap(entry.footText, rightWidth, { sizePt: m.body });
  const payHeight = payLines.length === 0 ? 0 : m.small + 5 + payLines.length * m.leading;
  const footHeight = footLines.length === 0 ? 0 : m.small + 5 + footLines.length * m.leading;
  const height = (m.narrow || !both ? payHeight + footHeight + (both ? 10 : 0) : Math.max(payHeight, footHeight)) + pad * 2;

  cursor.y += m.narrow ? 8 : 20;
  ensure(cursor, m, height, pages);
  cursor.ops.push(...box(m.frame, m.marginX, cursor.y, contentWidth(m), height, PANEL));
  let y = cursor.y + pad;
  if (payLines.length > 0) {
    cursor.ops.push(...label(m, m.marginX + pad, y + m.small, entry.payLabel));
    y += m.small + 5;
    for (const line of payLines) {
      cursor.ops.push(...text(m.frame, m.marginX + pad, y + m.body, line.text, { sizePt: m.body, weight: line.strong ? 'bold' : 'regular', color: line.strong ? INK : MID }));
      y += m.leading;
    }
  }
  let footY = m.narrow || !both ? (payLines.length > 0 ? y + 10 : y) : cursor.y + pad;
  if (footLines.length > 0) {
    cursor.ops.push(...label(m, rightX, footY + m.small, entry.footLabel));
    footY += m.small + 5;
    for (const line of footLines) {
      cursor.ops.push(...text(m.frame, rightX, footY + m.body, line, { sizePt: m.body, color: MID }));
      footY += m.leading;
    }
  }
  cursor.y += height + 8;
}

function drawSignature(entry: Extract<Block, { kind: 'signature' }>, m: Metrics, cursor: Cursor, pages: Page[]): void {
  ensure(cursor, m, m.leading, pages);
  const drawn = paragraph(m.frame, m.marginX, cursor.y + m.small, entry.text, contentWidth(m), { sizePt: m.small + 0.5, color: SUBTLE }, m.leading);
  cursor.ops.push(...drawn.ops);
  cursor.y = drawn.y;
}

/**
 * The word across a void document: large, pale, turned — under everything
 * else on the page, so it never hides a figure.
 */
function voidStamp(m: Metrics, word: string): number[] {
  const size = m.narrow ? 40 : 96;
  const width = widthOf(word, size, 'bold');
  const angle = (24 * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  // Centre the word on the page along the turned baseline.
  const cx = m.frame.widthPt / 2;
  const cy = m.frame.heightPt / 2;
  const x = cx - (width / 2) * cos + (size / 3) * sin;
  const y = cy - (width / 2) * sin - (size / 3) * cos;
  const [r, g, b] = rgb('#e8e8ec');
  return [
    ...ascii(`q\n${pt(r)} ${pt(g)} ${pt(b)} rg\nBT\n${fontName('bold')} ${pt(size)} Tf\n`),
    ...ascii(`${pt(cos)} ${pt(sin)} ${pt(-sin)} ${pt(cos)} ${pt(x)} ${pt(y)} Tm\n`),
    ...literal(word),
    ...ascii(' Tj\nET\nQ\n'),
  ];
}

export function renderPdf(document: Document, paper: string): Uint8Array {
  const m = metricsFor(paper);
  const pages: Page[] = [];
  // A hairline of the document's accent down the inside edge — the one piece
  // of the comp's branding a text-only writer can honour without an image —
  // and, on a void document, the word across every page, under the text.
  const prelude = [
    ...(document.voidMark === null ? [] : voidStamp(m, document.voidMark)),
    ...box(m.frame, 0, 0, m.narrow ? 2 : 4, m.frame.heightPt, document.accent),
  ];
  const cursor: Cursor = { ops: [...prelude], y: m.top, page: 0, prelude };

  for (const entry of document.blocks) {
    switch (entry.kind) {
      case 'letterhead':
        drawLetterhead(entry, m, cursor, document.accent);
        break;
      case 'parties':
        ensure(cursor, m, m.leading * 5, pages);
        drawParties(entry, m, cursor);
        break;
      case 'title':
        drawTitle(entry, m, cursor, pages);
        break;
      case 'items':
        drawItems(entry, m, cursor, pages);
        break;
      case 'ladder':
        drawLadder(entry, m, cursor, pages, document.accent);
        break;
      case 'ledger':
        drawLedger(entry, m, cursor, pages);
        break;
      case 'signed':
        drawSigned(entry, m, cursor, pages);
        break;
      case 'passage':
        drawPassage(entry, m, cursor, pages);
        break;
      case 'foot':
        drawFoot(entry, m, cursor, pages);
        break;
      case 'signature':
        drawSignature(entry, m, cursor, pages);
        break;
    }
  }

  pages.push({ widthPt: m.frame.widthPt, heightPt: m.frame.heightPt, stream: cursor.ops });
  return writePdf(pages);
}

export { widthOf };
