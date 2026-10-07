/**
 * AN OPENING-STOCK FILE, READ IN THE BROWSER.
 *
 * The file never leaves the screen as a file: it is read here, shown for
 * review, and saved as ordinary receipt lines. Figures stay text all the way.
 * Dates are `YYYY-MM-DD` and the decimal mark is a point — one form for every
 * language, so a file made in one office loads in another.
 */

export const HEADER = ['sku', 'barcode', 'name', 'quantity', 'unit_cost', 'batch', 'expires'] as const;
export type Head = (typeof HEADER)[number];
/** The most rows one file may hold. */
export const ROWS_MAX = 5000;
/** The most lines one receipt holds: a longer file is saved as parts. */
export const PART_MAX = 1000;

export interface FileRow {
  /** The row's number in the file, the header being row 1. */
  at: number;
  sku: string;
  barcode: string;
  name: string;
  quantity: string;
  unit_cost: string;
  batch: string;
  expires: string;
}

export type FileProblem = 'quantity' | 'unit_cost' | 'expires' | 'no-item';

/** The file's sample: the header row and nothing else, so nothing is exported. */
export const SAMPLE = `${HEADER.join(',')}\n`;

/** Cells of a comma-separated file, quotes and doubled quotes read as a spreadsheet writes them. */
export function cells(file: string): string[][] {
  const text = file.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i] as string;
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += char;
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((line) => line.some((value) => value.trim() !== ''));
}

export type Parsed = { ok: true; rows: FileRow[] } | { ok: false; why: 'empty' | 'header' | 'too-many'; count?: number; missing?: string[] };

export function parse(file: string): Parsed {
  const all = cells(file);
  const head = (all[0] ?? []).map((name) => name.trim().toLowerCase());
  if (all.length === 0) return { ok: false, why: 'empty' };
  // A row is found by `quantity` and by one of the three things that name an item.
  const missing = ['quantity'].filter((name) => !head.includes(name));
  if (!['sku', 'barcode', 'name'].some((name) => head.includes(name))) missing.push('sku');
  if (missing.length > 0) return { ok: false, why: 'header', missing };
  const body = all.slice(1);
  if (body.length === 0) return { ok: false, why: 'empty' };
  if (body.length > ROWS_MAX) return { ok: false, why: 'too-many', count: body.length };
  const at = (name: Head): number => head.indexOf(name);
  const rows = body.map((line, index): FileRow => {
    const value = (name: Head): string => (at(name) === -1 ? '' : (line[at(name)] ?? '').trim());
    return { at: index + 2, sku: value('sku'), barcode: value('barcode'), name: value('name'), quantity: value('quantity'), unit_cost: value('unit_cost'), batch: value('batch'), expires: value('expires') };
  });
  return { ok: true, rows };
}

const isDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

/** What is plainly wrong with a row as typed. Adminium judges every line again when it is saved. */
export function problemsOf(row: FileRow): FileProblem[] {
  const out: FileProblem[] = [];
  if (!/^\d+(\.\d{1,3})?$/.test(row.quantity) || !/[1-9]/.test(row.quantity)) out.push('quantity');
  if (row.unit_cost !== '' && !/^\d+(\.\d{1,4})?$/.test(row.unit_cost)) out.push('unit_cost');
  if (row.expires !== '' && !isDate(row.expires)) out.push('expires');
  return out;
}

/** A list cut into parts of at most `size`, in order. */
export function parts<T>(list: readonly T[], size = PART_MAX): T[][] {
  const out: T[][] = [];
  for (let start = 0; start < list.length; start += size) out.push(list.slice(start, start + size));
  return out;
}
