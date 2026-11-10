/**
 * THE SAMPLES AS ROWS, AND A DESIGN'S QUESTION AS ADMINIUM PUTS IT.
 *
 * The sample files name rows by labels (`{"@ref": "base:cards"}`); a table
 * holds keys. This gives every sample row a key (Birch Row's from 1, Marlow
 * Press's from 1001, so both shops can sit in one install's tables), and
 * reads what the checker declares for a design the way Adminium reads it:
 * keyed, starting from the design, in the declared order. So a rule
 * that needed a row the checker does not read fails here, not on a shop.
 *
 * Two forms of the same rows: as the browser holds them (numbers, parsed
 * JSON), and as the server hands them (`asStored`: JSON as text with its keys
 * in order, decimals as text, every column there).
 */
import manifest from '../../manifest.json' with { type: 'json' };
import type { CheckInput, CheckLine } from '@adminium/add-on-contracts';

import { CHECKER } from '../manifest/checker.ts';
import type { DesignFacts, FileFact } from '../rules/index.ts';
import { buildSample, SAMPLE_APPS, type Row } from '../sample/bundle.ts';

export type Tables = Record<string, Row[]>;
type Column = { ref: string; type: string; scale?: number; default?: unknown };

const columnsOf = new Map((manifest.requiredSchema.tables as unknown as { ref: string; columns: Column[] }[]).map((table) => [table.ref, table.columns]));
/** The checker's reads, as the manifest declares them (`manifest.test.ts` holds the file to the script that writes it). */
export const READS = CHECKER.reads;

/** Both shops' sample rows, each with a key, every label resolved to the key of the row it names. */
export function sampleTables(): Tables {
  const out: Tables = {};
  const keyOf = new Map<string, number>();
  const bundles = SAMPLE_APPS.map((app, i) => ({ bundle: buildSample(app), from: i * 1000 }));
  for (const { bundle, from } of bundles) {
    for (const table of bundle.tables) {
      const rows = (out[table.ref] ??= []);
      for (const row of table.rows) {
        const id = from + rows.filter((one) => Number(one['id']) > from).length + 1;
        if (typeof row['@label'] === 'string') keyOf.set(row['@label'], id);
        rows.push({ ...row, id });
      }
    }
  }
  const resolve = (value: unknown): unknown => {
    if (typeof value === 'object' && value !== null && '@ref' in value) {
      const key = keyOf.get(String((value as { '@ref': unknown })['@ref']));
      if (key === undefined) throw new Error(`no row labelled ${String((value as { '@ref': unknown })['@ref'])}`);
      return key;
    }
    return value;
  };
  for (const rows of Object.values(out)) {
    for (const [i, row] of rows.entries()) {
      const { '@label': _label, ...rest } = row;
      void _label;
      rows[i] = Object.fromEntries(Object.entries(rest).map(([key, value]) => [key, resolve(value)]));
    }
  }
  return out;
}

/** The design labelled so in the samples (`design:mp-4112`), as a row. */
export function sampleDesign(tables: Tables, code: string): Row {
  const found = tables['designs']!.find((row) => row['code'] === code);
  if (found === undefined) throw new Error(`no design ${code}`);
  return found;
}

/** What the checker's reads find for one design, read by read, as Adminium reads them. */
export function readsFor(design: Row, tables: Tables): Record<string, Row[]> {
  const found = new Map<string, Row[]>([['design', [design]]]);
  const out: Record<string, Row[]> = {};
  for (const read of READS) {
    const [from, column] = read.by.from.split('.') as [string, string];
    const values = new Set((found.get(from) ?? []).map((row) => row[column]).filter((value) => value !== null && value !== undefined && value !== '').map(String));
    const rows = (tables[read.table] ?? []).filter((row) => values.has(String(row[read.by.column]))).sort((a, b) => Number(a['id']) - Number(b['id']));
    found.set(read.id, rows);
    out[read.id] = rows;
  }
  return out;
}

/** The question the browser asks itself: rows as it holds them. */
export function browserFacts(design: Row, tables: Tables, files: readonly FileFact[] = [], extra: Partial<DesignFacts> = {}): DesignFacts {
  const rows = readsFor(design, tables);
  return {
    design,
    ready: rows['ready']?.[0] ?? null,
    parts: rows['parts'] ?? [],
    base: rows['base']?.[0] ?? null,
    areas: rows['areas'] ?? [],
    palettes: rows['palettes'] ?? [],
    features: rows['features'] ?? [],
    colours: tables['palette_colours'] ?? [],
    files,
    settings: settingsRow(),
    ...extra,
  };
}

/** Text of a JSON value with its keys in order, as Adminium hands a JSON column on every engine. */
export function stableJson(value: unknown): string {
  const sorted = (one: unknown): unknown =>
    Array.isArray(one) ? one.map(sorted) : typeof one === 'object' && one !== null ? Object.fromEntries(Object.keys(one).sort().map((key) => [key, sorted((one as Record<string, unknown>)[key])])) : one;
  return JSON.stringify(sorted(value));
}

/** A row as the server hands it: every column there, JSON as text, decimals as text at their scale, the default where nothing was written. */
export function asStored(table: string, row: Row): Row {
  const out: Record<string, unknown> = {};
  for (const column of columnsOf.get(table) ?? []) {
    const value = row[column.ref] ?? column.default ?? null;
    if (value === null) out[column.ref] = null;
    else if (column.type === 'json') out[column.ref] = stableJson(value);
    else if (column.type === 'decimal') out[column.ref] = Number(value).toFixed(column.scale ?? 2);
    else out[column.ref] = value;
  }
  return out;
}

type PublicEntry = { table: string; key?: string; level?: string; methods: string[]; select: string[]; filters?: { column: string; op: string; value: unknown }[]; appColumn?: string };

/**
 * A table's rows as one shop's visitor reads them through the add-on's own
 * public entry in manifest.json: that app's rows where the entry holds them
 * to one, the rows its filters let through (a column left unwritten reads as
 * its default), and only the columns it selects. What the customer's editor
 * checks a design with is this, never the full rows the server reads.
 */
export function served(table: string, rows: readonly Row[], app: string): Row[] {
  const entry = (manifest.publicAccess as PublicEntry[]).find((one) => one.table === table && one.key === undefined && one.level === undefined && one.methods.includes('GET'));
  if (entry === undefined) throw new Error(`no public read of ${table}`);
  const columns = columnsOf.get(table) ?? [];
  const valueOf = (row: Row, ref: string): unknown => row[ref] ?? columns.find((column) => column.ref === ref)?.default ?? null;
  return rows
    .filter((row) => entry.appColumn === undefined || row[entry.appColumn] === app)
    .filter((row) => (entry.filters ?? []).every((filter) => filter.op === 'eq' && String(valueOf(row, filter.column)) === String(filter.value)))
    .map((row) => Object.fromEntries(entry.select.filter((ref) => ref in row).map((ref) => [ref, row[ref]])));
}

/** The settings row an install writes, from the manifest's defaults. */
export const settingsRow = (): Row => asStoredDefaults('settings');
function asStoredDefaults(table: string): Row {
  return Object.fromEntries((columnsOf.get(table) ?? []).map((column) => [column.ref, column.ref === 'id' ? 1 : (column.default ?? null)]));
}

/** One line of the question Adminium puts, for a design: its row and its reads as stored, and what is known of its files. */
export function checkLine(key: string, design: Row, tables: Tables, files: readonly FileFact[] = [], paid: string[] = []): CheckLine {
  const rows = readsFor(design, tables);
  return {
    key,
    design: asStored('designs', design) as CheckLine['design'],
    rows: Object.fromEntries(READS.map((read) => [read.id, (rows[read.id] ?? []).map((row) => asStored(read.table, row))])) as CheckLine['rows'],
    paid: [...paid].sort(),
    // Adminium knows a file's type and size, never its pixels.
    files: files.map(({ column, kind, size }) => ({ column, kind, size })),
  };
}

/** A whole question. */
export function checkInput(lines: CheckLine[], mode: CheckInput['mode'] = 'save'): CheckInput {
  return { contract: 'design-check@1', mode, lines, settings: settingsRow() as CheckInput['settings'], version: manifest.version };
}
