/**
 * A RECEIPT'S LINES, AS THE SCREEN HOLDS THEM.
 *
 * What a person typed is kept as text and sent as text. What Adminium decided
 * — the quantity in units, the cost it used, the amount — is read from the
 * saved row and shown from there; nothing here multiplies, divides or rounds
 * a figure that is then shown as fact.
 */
import type { DataRow, DataValue } from '../shared/host.ts';

export type LineStatus = 'draft' | 'posted' | 'reversed' | 'sent_back';

export interface Ordered {
  packs: string;
  packName: string;
  packSize: string;
  qty: string;
  received: string;
  open: string;
  supplierCode: string;
  /** What one unit costs on the order, where the reader may see it: shown beside an empty cost, never sent. */
  cost: string;
}

export interface Line {
  /** The screen's own key: stable while the line is typed, saved or not. */
  key: string;
  /** The saved row's key; null until the line is saved. */
  id: string | null;
  poLineId: string | null;
  itemId: string;
  itemName: string;
  sku: string;
  unit: string;
  decimals: number;
  tracks: boolean;
  /** The pack this line may be counted in; an empty size is "no pack known". */
  packName: string;
  packSize: string;
  inPacks: boolean;
  /** As typed: packs when `inPacks`, else units. */
  qty: string;
  /** As typed; empty leaves the cost to Adminium. */
  unitCost: string;
  batch: string;
  expires: string;
  status: LineStatus;
  /** What was ordered, for a line of a purchase order. */
  ordered: Ordered | null;
  /** The row as Adminium stored it, with what it decided. */
  saved: DataRow | null;
  /** Changed since it was read or saved. */
  dirty: boolean;
}

const text = (value: DataValue | undefined): string => (value === null || value === undefined ? '' : String(value));
const truthy = (value: DataValue | undefined): boolean => value === true || value === 1 || value === '1' || value === 'true';

/** A stored decimal without the zeros its scale pads it with: `5.000` reads `5`, `0.250` reads `0.25`. */
export function plain(value: DataValue | undefined): string {
  const raw = text(value);
  if (!/^-?\d+\.\d+$/.test(raw)) return raw;
  return raw.replace(/0+$/, '').replace(/\.$/, '');
}

/** Whether a typed figure is more than nothing. Text is compared, never parsed into a float. */
export const positive = (typed: string): boolean => /^\d*\.?\d+$/.test(typed.trim()) && /[1-9]/.test(typed);

/** One more of what the line is counted in: the field's own step, kept as text. */
export function plusOne(typed: string): string {
  const raw = typed.trim();
  if (raw === '') return '1';
  const match = /^(\d*)(\.\d+)?$/.exec(raw);
  if (match === null) return raw;
  return `${String(BigInt(match[1] === '' ? '0' : (match[1] as string)) + 1n)}${match[2] ?? ''}`;
}

let made = 0;
const nextKey = (): string => `new-${String((made += 1))}`;

/** A fresh line for an item found by a scan: one pack where a pack is known, else one unit. */
export function lineForItem(item: DataRow): Line {
  const packSize = plain(item['pack_size']);
  const inPacks = positive(packSize);
  return {
    key: nextKey(),
    id: null,
    poLineId: null,
    itemId: text(item['id']),
    itemName: text(item['name']),
    sku: text(item['sku']),
    unit: text(item['unit']),
    decimals: Number(item['decimals'] ?? 0) || 0,
    tracks: truthy(item['tracks_batches']),
    packName: text(item['pack_name']),
    packSize,
    inPacks,
    qty: '1',
    unitCost: '',
    batch: '',
    expires: '',
    status: 'draft',
    ordered: null,
    saved: null,
    dirty: true,
  };
}

/** An order's line still to come, with nothing typed yet. */
export function lineForOrderLine(poLine: DataRow, item: DataRow | undefined): Line {
  const packSize = plain(poLine['pack_size']);
  return {
    key: `po-${text(poLine['id'])}`,
    id: null,
    poLineId: text(poLine['id']),
    itemId: text(poLine['item_id']),
    itemName: text(poLine['item_name']),
    sku: text(item?.['sku']),
    unit: text(poLine['unit']),
    decimals: Number(item?.['decimals'] ?? 0) || 0,
    tracks: truthy(item?.['tracks_batches']),
    packName: text(poLine['pack_name']),
    packSize,
    inPacks: positive(packSize),
    qty: '',
    unitCost: '',
    batch: '',
    expires: '',
    status: 'draft',
    ordered: orderedOf(poLine),
    saved: null,
    dirty: false,
  };
}

export function orderedOf(poLine: DataRow): Ordered {
  return {
    packs: plain(poLine['packs']),
    packName: text(poLine['pack_name']),
    packSize: plain(poLine['pack_size']),
    qty: plain(poLine['qty']),
    received: plain(poLine['received']),
    open: plain(poLine['open_qty']),
    supplierCode: text(poLine['supplier_code']),
    cost: plain(poLine['unit_cost']),
  };
}

/** A saved line as the screen holds it. */
export function lineForSaved(row: DataRow, item: DataRow | undefined, poLine: DataRow | undefined): Line {
  const packs = plain(row['packs']);
  const inPacks = packs !== '';
  return {
    key: `row-${text(row['id'])}`,
    id: text(row['id']),
    poLineId: row['po_line_id'] === null || row['po_line_id'] === undefined ? null : text(row['po_line_id']),
    itemId: text(row['item_id']),
    itemName: text(row['item_name']),
    sku: text(item?.['sku']),
    unit: text(row['unit']),
    decimals: Number(item?.['decimals'] ?? 0) || 0,
    tracks: truthy(item?.['tracks_batches']) || text(row['batch_code']) !== '',
    packName: text(poLine?.['pack_name'] ?? item?.['pack_name']),
    packSize: plain(row['pack_size'] ?? poLine?.['pack_size'] ?? item?.['pack_size']),
    inPacks,
    qty: inPacks ? packs : plain(row['qty_typed']),
    unitCost: plain(row['unit_cost']),
    batch: text(row['batch_code']),
    expires: text(row['expires_on']).slice(0, 10),
    status: (text(row['status']) || 'draft') as LineStatus,
    ordered: poLine === undefined ? null : orderedOf(poLine),
    saved: row,
    dirty: false,
  };
}

/**
 * The lines of a receipt against an order: what is saved, then every line of
 * the order still to come that the receipt does not hold yet.
 */
export function mergeLines(saved: readonly DataRow[], poLines: readonly DataRow[], items: ReadonlyMap<string, DataRow>): Line[] {
  const byPoLine = new Map(poLines.map((line) => [text(line['id']), line]));
  const out = saved.map((row) => lineForSaved(row, items.get(text(row['item_id'])), row['po_line_id'] === null || row['po_line_id'] === undefined ? undefined : byPoLine.get(text(row['po_line_id']))));
  const held = new Set(out.map((line) => line.poLineId).filter((id): id is string => id !== null));
  for (const poLine of poLines) {
    if (held.has(text(poLine['id'])) || !positive(plain(poLine['open_qty']))) continue;
    out.push(lineForOrderLine(poLine, items.get(text(poLine['item_id']))));
  }
  return out;
}

/** A line somebody typed a quantity on: the only lines a save sends. */
export const typedOn = (line: Line): boolean => line.qty.trim() !== '';

/**
 * What a line sends. Counted in packs it sends the packs and their size and
 * Adminium works out the units; counted in units it sends what was typed. A
 * reader who may not see costs sends none: Adminium decides it.
 */
export function lineValues(line: Line, costs: boolean): Record<string, DataValue> {
  return {
    item_id: line.itemId,
    ...(line.poLineId === null ? {} : { po_line_id: line.poLineId }),
    ...(line.inPacks ? { packs: line.qty, pack_size: line.packSize, qty_typed: null } : { packs: null, qty_typed: line.qty }),
    ...(costs ? { unit_cost: line.unitCost === '' ? null : line.unitCost } : {}),
    batch_code: line.batch.trim() === '' ? null : line.batch.trim(),
    expires_on: line.expires === '' ? null : line.expires,
  };
}

export type Problems = Readonly<Record<string, Partial<Record<'qty' | 'batch_code' | 'expires_on', 'missing'>>>>;

/**
 * What is plainly missing before a post: a help for the person typing, never
 * the judge. Adminium checks every line again, and its word is shown on the
 * same field.
 */
export function problemsOf(lines: readonly Line[]): Problems {
  const out: Record<string, Partial<Record<'qty' | 'batch_code' | 'expires_on', 'missing'>>> = {};
  for (const line of lines) {
    if (line.status !== 'draft' || !typedOn(line)) continue;
    const found: Partial<Record<'qty' | 'batch_code' | 'expires_on', 'missing'>> = {};
    if (!positive(line.qty)) found.qty = 'missing';
    if (line.tracks && line.batch.trim() === '') found.batch_code = 'missing';
    if (line.tracks && line.expires === '') found.expires_on = 'missing';
    if (Object.keys(found).length > 0) out[line.key] = found;
  }
  return out;
}

export const countProblems = (problems: Problems): number => Object.values(problems).reduce((sum, fields) => sum + Object.keys(fields).length, 0);
