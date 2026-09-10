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
import { writePdf, type Page } from '../pdf/writer.ts';

const PAPER: Readonly<Record<string, Frame>> = {
  a4: { widthPt: 595, heightPt: 842 },
  letter: { widthPt: 612, heightPt: 792 },
  // 80 mm at 72 dpi is 227 pt. The height is a long roll rather than a sheet:
  // a till does not turn the page.
  'receipt-80mm': { widthPt: 227, heightPt: 1400 },
};

const INK = '#111827';
const MUTED = '#6b7280';
const HAIRLINE = '#e5e7eb';

interface Cursor {
  ops: number[];
  y: number;
  page: number;
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
    top: narrow ? 14 : 56,
    bottom: frame.heightPt - (narrow ? 14 : 56),
    body: narrow ? 8 : 9.5,
    small: narrow ? 6.5 : 7.5,
    leading: narrow ? 11 : 13,
    narrow,
  };
}

const contentWidth = (m: Metrics): number => m.frame.widthPt - m.marginX * 2;

/** Start a new page when `needed` points would run past the bottom margin. */
function ensure(cursor: Cursor, m: Metrics, needed: number, pages: Page[]): void {
  if (cursor.y + needed <= m.bottom) return;
  pages.push({ widthPt: m.frame.widthPt, heightPt: m.frame.heightPt, stream: cursor.ops });
  cursor.ops = [];
  cursor.y = m.top;
  cursor.page += 1;
}

function label(m: Metrics, x: number, y: number, value: string): number[] {
  return text(m.frame, x, y, value.toUpperCase(), { sizePt: m.small, color: MUTED });
}

function drawHeading(
  entry: Extract<Block, { kind: 'heading' }>,
  m: Metrics,
  cursor: Cursor,
): void {
  const size = m.narrow ? 13 : 20;
  cursor.ops.push(
    ...text(m.frame, m.marginX, cursor.y + size, entry.title, {
      sizePt: size,
      weight: 'bold',
      color: entry.accent,
    }),
  );
  if (entry.number !== '') {
    cursor.ops.push(
      ...textRight(m.frame, m.frame.widthPt - m.marginX, cursor.y + size, entry.number, {
        sizePt: m.body,
        color: MUTED,
      }),
    );
  }
  cursor.y += size + 6;
  cursor.ops.push(...rule(m.frame, m.marginX, cursor.y, contentWidth(m), entry.accent, 1.5));
  cursor.y += m.leading;
}

function drawParties(
  entry: Extract<Block, { kind: 'parties' }>,
  m: Metrics,
  cursor: Cursor,
): void {
  const columnWidth = m.narrow ? contentWidth(m) : (contentWidth(m) - 24) / 2;
  const columns: { x: number; label: string; name: string; lines: readonly string[] }[] = [
    { x: m.marginX, label: entry.fromLabel, name: '', lines: entry.from },
    {
      x: m.narrow ? m.marginX : m.marginX + columnWidth + 24,
      label: entry.toLabel,
      name: entry.toName,
      lines: entry.to,
    },
  ];

  // On a till roll the two parties stack; on a sheet they sit side by side and
  // the block is as tall as the taller of the two.
  let tallest = cursor.y;
  for (const column of columns) {
    let y = m.narrow && column.x === m.marginX && column !== columns[0] ? tallest : cursor.y;
    if (m.narrow && column === columns[1]) y = tallest + 4;
    cursor.ops.push(...label(m, column.x, y + m.small, column.label));
    y += m.small + 4;
    if (column.name !== '') {
      cursor.ops.push(
        ...text(m.frame, column.x, y + m.body, column.name, {
          sizePt: m.body,
          weight: 'bold',
          color: INK,
        }),
      );
      y += m.leading;
    }
    for (const line of column.lines) {
      const drawn = paragraph(
        m.frame,
        column.x,
        y + m.body,
        line,
        columnWidth,
        { sizePt: m.body, color: INK },
        m.leading,
      );
      cursor.ops.push(...drawn.ops);
      y = drawn.y - m.body;
    }
    tallest = Math.max(tallest, y);
  }
  cursor.y = tallest + m.leading;
}

function drawFacts(entry: Extract<Block, { kind: 'facts' }>, m: Metrics, cursor: Cursor): void {
  if (m.narrow) {
    for (const row of entry.rows) {
      cursor.ops.push(...label(m, m.marginX, cursor.y + m.small, row.label));
      cursor.ops.push(
        ...textRight(m.frame, m.frame.widthPt - m.marginX, cursor.y + m.small, row.value, {
          sizePt: m.body,
          color: INK,
        }),
      );
      cursor.y += m.leading;
    }
    cursor.y += 4;
    return;
  }

  const gap = contentWidth(m) / Math.max(entry.rows.length, 1);
  entry.rows.forEach((row, at) => {
    const x = m.marginX + gap * at;
    cursor.ops.push(...label(m, x, cursor.y + m.small, row.label));
    cursor.ops.push(
      ...text(m.frame, x, cursor.y + m.small + m.leading - 2, row.value, {
        sizePt: m.body,
        color: INK,
      }),
    );
  });
  cursor.y += m.small + m.leading + 6;
}

function drawItems(
  entry: Extract<Block, { kind: 'items' }>,
  m: Metrics,
  cursor: Cursor,
  pages: Page[],
): void {
  // Description takes what the three numeric columns leave. On a till roll the
  // numeric columns are narrower because there is nothing else to give.
  const numeric = m.narrow ? 34 : 78;
  const right = m.frame.widthPt - m.marginX;
  const edges = [right - numeric * 2, right - numeric, right];
  const descWidth = contentWidth(m) - numeric * 3 - 6;

  const header = (): void => {
    cursor.ops.push(...label(m, m.marginX, cursor.y + m.small, entry.columns[0]?.label ?? ''));
    entry.columns.slice(1).forEach((column, at) => {
      cursor.ops.push(
        ...textRight(m.frame, edges[at]!, cursor.y + m.small, column.label.toUpperCase(), {
          sizePt: m.small,
          color: MUTED,
        }),
      );
    });
    cursor.y += m.small + 5;
    cursor.ops.push(...rule(m.frame, m.marginX, cursor.y, contentWidth(m), '#d1d5db'));
    cursor.y += 6;
  };

  ensure(cursor, m, m.small + m.leading * 2, pages);
  header();

  for (const row of entry.rows) {
    const wrapped = wrap(row[0] ?? '', descWidth, { sizePt: m.body });
    const height = wrapped.length * m.leading + 4;
    const before = cursor.page;
    ensure(cursor, m, height, pages);
    // A row that pushed onto a new page needs the column headings again —
    // otherwise page two is a table of unlabelled numbers.
    if (cursor.page !== before) header();

    wrapped.forEach((line, at) => {
      cursor.ops.push(
        ...text(m.frame, m.marginX, cursor.y + m.body + at * m.leading, line, {
          sizePt: m.body,
          color: INK,
        }),
      );
    });
    row.slice(1).forEach((cell, at) => {
      cursor.ops.push(
        ...textRight(m.frame, edges[at]!, cursor.y + m.body, cell, {
          sizePt: m.body,
          color: INK,
        }),
      );
    });
    cursor.y += height;
    cursor.ops.push(...rule(m.frame, m.marginX, cursor.y - 2, contentWidth(m), HAIRLINE));
  }
  cursor.y += 6;
}

function drawLadder(
  entry: Extract<Block, { kind: 'ladder' }>,
  m: Metrics,
  cursor: Cursor,
  pages: Page[],
  accent: string,
): void {
  const width = m.narrow ? contentWidth(m) : contentWidth(m) * 0.52;
  const x = m.frame.widthPt - m.marginX - width;
  const right = m.frame.widthPt - m.marginX;

  // The ladder is kept whole: a total on its own on page two, with the
  // subtotal it comes from on page one, is worse than a short first page.
  ensure(cursor, m, entry.rows.length * m.leading + 12, pages);

  for (const row of entry.rows) {
    if (row.emphasis) {
      cursor.ops.push(...rule(m.frame, x, cursor.y, width, accent, 1.5));
      cursor.y += 6;
    }
    const size = row.emphasis ? m.body + (m.narrow ? 2 : 3) : m.body;
    const weight = row.emphasis ? ('bold' as const) : ('regular' as const);
    cursor.ops.push(
      ...text(m.frame, x, cursor.y + size, row.label, { sizePt: size, weight, color: INK }),
    );
    cursor.ops.push(
      ...textRight(m.frame, right, cursor.y + size, row.value, { sizePt: size, weight, color: INK }),
    );
    cursor.y += size + (row.emphasis ? 8 : 5);
  }
  cursor.y += 6;
}

function drawPassage(
  entry: Extract<Block, { kind: 'passage' }>,
  m: Metrics,
  cursor: Cursor,
  pages: Page[],
): void {
  ensure(cursor, m, m.small + m.leading * 2, pages);
  cursor.ops.push(...label(m, m.marginX, cursor.y + m.small, entry.heading));
  cursor.y += m.small + 4;
  for (const line of entry.lines) {
    const drawn = paragraph(
      m.frame,
      m.marginX,
      cursor.y + m.body,
      line,
      contentWidth(m),
      { sizePt: m.body, color: INK },
      m.leading,
    );
    cursor.ops.push(...drawn.ops);
    cursor.y = drawn.y - m.body + 2;
  }
  cursor.y += 6;
}

export function renderPdf(document: Document, paper: string): Uint8Array {
  const m = metricsFor(paper);
  const pages: Page[] = [];
  const cursor: Cursor = { ops: [], y: m.top, page: 0 };

  // A hairline of the document's accent down the inside edge — the one piece
  // of the comp's branding a text-only writer can honour without an image.
  cursor.ops.push(...box(m.frame, 0, 0, m.narrow ? 2 : 4, m.frame.heightPt, document.accent));

  for (const entry of document.blocks) {
    switch (entry.kind) {
      case 'heading':
        drawHeading(entry, m, cursor);
        break;
      case 'parties':
        ensure(cursor, m, m.leading * 4, pages);
        drawParties(entry, m, cursor);
        break;
      case 'facts':
        ensure(cursor, m, m.leading * 2, pages);
        drawFacts(entry, m, cursor);
        break;
      case 'items':
        drawItems(entry, m, cursor, pages);
        break;
      case 'ladder':
        drawLadder(entry, m, cursor, pages, document.accent);
        break;
      case 'passage':
        drawPassage(entry, m, cursor, pages);
        break;
    }
  }

  pages.push({ widthPt: m.frame.widthPt, heightPt: m.frame.heightPt, stream: cursor.ops });
  return writePdf(pages);
}

export { widthOf };
