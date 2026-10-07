/**
 * ONE CALL'S WORK IN PROGRESS.
 *
 * A call plans every line it is handed, in order, and two lines may share an
 * item: the second must see what the first took. So the rows read for the
 * call, the rows it has decided to add, and two running tallies — what has
 * been taken from each level and promised from each stock point — are kept
 * here, and every action writes through it.
 *
 * A row this answer adds has no key yet. It is given a label, and a later row
 * of the same answer names it by that label (`{"@row": …}`), which Adminium
 * turns into the key once the row is made.
 */

import type { PlannedRow, PostingInput, PostingLine, PostingNote, PostingOutput, PostingReason, PostingRefusal, PostingScalar, PostingWords } from '@adminium/add-on-contracts';

import { COST, QTY, readOr0, text } from './decimal.ts';

export type Value = PostingScalar | null;
export type Row = Record<string, Value>;
/** The key of a row that was read, or the label of one this answer adds. */
export type Ref = PostingScalar | { '@row': string };

export const same = (a: unknown, b: unknown): boolean => a !== null && a !== undefined && a !== '' && b !== null && b !== undefined && b !== '' && String(a) === String(b);
export const blank = (value: unknown): boolean => value === null || value === undefined || value === '';
/** A yes as each database hands one back. */
export const yes = (value: unknown): boolean => value === true || value === 1 || value === '1' || value === 'true' || value === 't';
export const textOf = (value: unknown): string | null => (blank(value) ? null : String(value));

/** A stock point: one item in one place. `row` is empty for one this answer adds. */
export interface Point {
  key: string;
  ref: Ref;
  row: Row | null;
  item: Row;
  place: string;
}

/** A level: what one stock point holds of one batch. `row` is empty for one this answer adds. */
export interface Level {
  key: string;
  ref: Ref;
  row: Row | null;
  point: Point;
  unassigned: boolean;
  batch: string;
}

export class Book {
  readonly rows: PlannedRow[] = [];
  readonly refusals: PostingRefusal[] = [];
  readonly notes: { line: string; note: PostingNote; item?: string }[] = [];
  readonly words: PostingWords[] = [];
  /** What earlier lines of this call took from each level, and promised from each point. */
  readonly took = new Map<string, bigint>();
  readonly promised = new Map<string, bigint>();
  private readonly points = new Map<string, Point>();
  private readonly levels = new Map<string, Level>();
  private readonly batches = new Map<string, Ref>();
  private readonly updated = new Set<string>();

  readonly input: PostingInput;

  constructor(input: PostingInput) {
    this.input = input;
  }

  read(name: string): Row[] {
    return (this.input.reads[name] ?? []) as Row[];
  }

  written(name: string): Row[] {
    return (this.input.written[name] ?? []) as Row[];
  }

  setting(name: string): Value {
    return (this.input.settings[name] ?? null) as Value;
  }

  /** The first line of the call: where a row that belongs to the round as a whole is put. */
  first(): string {
    return this.input.lines[0]?.line ?? '';
  }

  insert(line: string, table: string, values: Record<string, Value | { '@row': string }>, label?: string): void {
    this.rows.push(label === undefined ? { op: 'insert', table, line, values } : { op: 'insert', table, label, line, values });
  }

  /** One update a row and a column set: the same flag raised twice in a call is written once. */
  update(line: string, table: string, id: PostingScalar, set: Record<string, Value>): void {
    const mark = `${table}:${String(id)}:${JSON.stringify(set)}`;
    if (this.updated.has(mark)) return;
    this.updated.add(mark);
    this.rows.push({ op: 'update', table, line, key: { id }, set });
  }

  refuse(line: string, reason: PostingReason, more: { left?: string; item?: string } = {}): void {
    this.refusals.push({ line, reason, ...more });
  }

  note(line: string, note: PostingNote, item?: string): void {
    if (this.notes.some((one) => one.line === line && one.note === note && one.item === item)) return;
    this.notes.push(item === undefined ? { line, note } : { line, note, item });
  }

  /** The item of a key, from the rows read; a call that names one it was not handed has nothing to stand on. */
  item(id: unknown): Row {
    const found = this.read('items').find((row) => same(row['id'], id));
    if (found === undefined) throw new Error(`item ${String(id)} was not read`);
    return found;
  }

  /** The stock point of an item in a place: the one read, or one this answer adds (once). */
  point(line: string, item: Row, place: unknown): Point {
    const key = `${String(item['id'])}:${String(place)}`;
    const known = this.points.get(key);
    if (known !== undefined) return known;
    const row = this.read('points').find((one) => same(one['item_id'], item['id']) && same(one['place_id'], place)) ?? null;
    let point: Point;
    if (row !== null) point = { key: `p${String(row['id'])}`, ref: row['id'] as PostingScalar, row, item, place: String(place) };
    else {
      const label = `p:${key}`;
      this.insert(line, 'stock_points', { item_id: item['id'] as Value, place_id: place as Value, cost_avg: text(readOr0(item['cost_avg'], COST), COST) }, label);
      point = { key: label, ref: { '@row': label }, row: null, item, place: String(place) };
    }
    this.points.set(key, point);
    return point;
  }

  /** The stock point of an item in a place as it was read, or nothing: a question never adds one. */
  pointRead(item: Row, place: unknown): Point | null {
    const row = this.read('points').find((one) => same(one['item_id'], item['id']) && same(one['place_id'], place));
    return row === undefined ? null : { key: `p${String(row['id'])}`, ref: row['id'] as PostingScalar, row, item, place: String(place) };
  }

  /** The levels a stock point holds, as read. A point this answer adds holds none yet. */
  levelsOf(point: Point): Level[] {
    if (point.row === null) return [...this.levels.values()].filter((level) => level.point === point);
    const read = this.read('levels')
      .filter((row) => same(row['stock_point_id'], point.row?.['id']))
      .map((row) => this.levelOfRow(point, row));
    const added = [...this.levels.values()].filter((level) => level.point === point && level.row === null);
    return [...read, ...added];
  }

  private levelOfRow(point: Point, row: Row): Level {
    const key = `l${String(row['id'])}`;
    const known = this.levels.get(key);
    if (known !== undefined) return known;
    const level: Level = { key, ref: row['id'] as PostingScalar, row, point, unassigned: yes(row['unassigned']), batch: String(row['batch_id']) };
    this.levels.set(key, level);
    return level;
  }

  /** The level of a batch in a stock point: the one read, or one this answer adds (once). */
  level(line: string, point: Point, batch: Ref, unassigned: boolean): Level {
    const batchKey = typeof batch === 'object' ? batch['@row'] : String(batch);
    if (point.row !== null && typeof batch !== 'object') {
      const row = this.read('levels').find((one) => same(one['stock_point_id'], point.row?.['id']) && same(one['batch_id'], batch));
      if (row !== undefined) return this.levelOfRow(point, row);
    }
    const label = `l:${point.key}:${batchKey}`;
    const known = this.levels.get(label);
    if (known !== undefined) return known;
    this.insert(line, 'levels', { stock_point_id: point.ref as Value | { '@row': string }, batch_id: batch as Value | { '@row': string } }, label);
    const level: Level = { key: label, ref: { '@row': label }, row: null, point, unassigned, batch: batchKey };
    this.levels.set(label, level);
    return level;
  }

  /** The batch nobody has named, of an item: the one read, or one this answer adds (once). Its code is a dash. */
  unassignedBatch(line: string, item: Row): Ref {
    const key = String(item['id']);
    const known = this.batches.get(key);
    if (known !== undefined) return known;
    const row = this.read('batches').find((one) => same(one['item_id'], item['id']) && yes(one['unassigned']));
    let ref: Ref;
    if (row !== undefined) ref = row['id'] as PostingScalar;
    else {
      const label = `b:${key}:-`;
      this.insert(line, 'batches', { item_id: item['id'] as Value, code: '-', unassigned: true, expires_on: null, received_on: null }, label);
      ref = { '@row': label };
    }
    this.batches.set(key, ref);
    return ref;
  }

  /** The level of the batch nobody has named, in a stock point. */
  unassignedLevel(line: string, point: Point): Level {
    const read = point.row === null ? undefined : this.read('levels').find((one) => same(one['stock_point_id'], point.row?.['id']) && yes(one['unassigned']));
    if (read !== undefined) return this.levelOfRow(point, read);
    return this.level(line, point, this.unassignedBatch(line, point.item), true);
  }

  /** What a level still holds once this call's earlier takes are off it. */
  left(level: Level): bigint {
    return (level.row === null ? 0n : readOr0(level.row['qty'], QTY)) - (this.took.get(level.key) ?? 0n);
  }

  take(level: Level, amount: bigint): void {
    this.took.set(level.key, (this.took.get(level.key) ?? 0n) + amount);
  }

  /** What a stock point can still promise: on hand less reserved, less what this call has promised. Never below nothing. */
  available(point: Point): bigint {
    const stored = point.row === null ? 0n : readOr0(point.row['available'], QTY);
    const open = stored - (this.promised.get(point.key) ?? 0n);
    return open > 0n ? open : 0n;
  }

  promise(point: Point, amount: bigint): void {
    this.promised.set(point.key, (this.promised.get(point.key) ?? 0n) + amount);
  }

  /** One movement of a level. `qty` is signed: in is plus. */
  move(line: string, level: Level, kind: string, qty: bigint, more: { cost?: bigint; reason?: Value; note?: Value; reverses?: Value; pair?: { '@row': string }; label?: string } = {}): void {
    const cost = more.cost ?? readOr0(level.point.item['cost_avg'], COST);
    this.insert(
      line,
      'movements',
      {
        level_id: level.ref as Value | { '@row': string },
        kind,
        qty: text(qty, QTY),
        unit_cost: text(cost, COST),
        reason_id: more.reason ?? null,
        note: more.note ?? null,
        reverses_id: more.reverses ?? null,
        pair_id: more.pair ?? null,
      },
      more.label,
    );
    this.take(level, -qty);
  }

  /** Marks a stock point as one to count again. A point this answer adds cannot be marked yet. */
  needsCount(line: string, point: Point): void {
    if (point.row !== null && !yes(point.row['needs_count'])) this.update(line, 'stock_points', point.row['id'] as PostingScalar, { needs_count: true });
  }

  output(): PostingOutput {
    const out: PostingOutput = { rows: this.rows };
    if (this.refusals.length > 0) out.refusals = this.refusals;
    if (this.notes.length > 0) out.notes = this.notes;
    if (this.input.mode === 'words') out.words = this.words;
    return out;
  }
}

/** A line's input as text, or nothing. */
export const inputText = (line: PostingLine, name: string): string | null => {
  const value = line.inputs[name];
  return value === null || value === undefined || value === '' || typeof value === 'object' ? null : String(value);
};

/** A line's input that names a row of another table. */
export const inputRow = (line: PostingLine, name: string): { table: string; row: string } | null => {
  const value = line.inputs[name];
  return value !== null && typeof value === 'object' ? value : null;
};
