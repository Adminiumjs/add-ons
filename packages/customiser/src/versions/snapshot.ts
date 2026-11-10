/**
 * THE VERSION AN ORDER LINE SNAPSHOTS (`posting-rows@1`, ledger `designs`).
 *
 * When a shop app's order line orders a customer's design, Adminium hands in
 * the line, the design as it stands and the versions it already has, and
 * writes what this answers, inside the line's own save:
 *
 * - the design's next version, a copy of what the customer chose (the shop
 *   proofs and makes from it, whatever happens to the design after);
 * - the design marked ordered, so its own link never changes it again.
 *
 * A design already ordered whose newest version holds what it holds now gets
 * no new version (a second line of the same design, a repeat order): the
 * version the shop proofed stands. A design that is not there (gone since
 * the line's check) is refused. Pure, like every answer Adminium runs: it
 * reads nothing, keeps no clock and makes nothing up.
 */
import type { PlannedRow, PostingInput, PostingOutput, PostingScalar } from '@adminium/add-on-contracts';

type Read = Record<string, PostingScalar | null>;

/** The key a link input names: the bare key, or the row it points at. */
function keyOf(input: PostingInput['lines'][number]['inputs'][string]): string | null {
  if (input === null || input === undefined) return null;
  if (typeof input === 'object') return input.row;
  return String(input);
}

/** A JSON value as it crosses the call (text), compared by what it holds, not how it was spelled. */
function sameJson(a: PostingScalar | null | undefined, b: PostingScalar | null | undefined): boolean {
  const read = (value: PostingScalar | null | undefined): unknown => {
    if (typeof value !== 'string') return value ?? null;
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return value;
    }
  };
  const stable = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
    if (value !== null && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stable(record[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
  };
  return stable(read(a)) === stable(read(b));
}

/**
 * The label of a new version row. Adminium refuses a plan that gives one label
 * twice, and one order may order several designs, each at its own version 1:
 * so the label names the design as well as the version. A save makes at most
 * one new version of a design (a second line of it sees what the first
 * planned), so design and version are unique within one plan. A key too long
 * for a label (64 characters) falls back to the row's place in the plan,
 * unique as well.
 */
function labelOf(key: string, version: number, at: number): string {
  const named = `design-${key}-v${String(version)}`;
  return named.length <= 64 ? named : `row-${String(at)}-v${String(version)}`;
}

export function rows(input: PostingInput): PostingOutput {
  const out: PlannedRow[] = [];
  const refusals: NonNullable<PostingOutput['refusals']> = [];
  const designs: readonly Read[] = input.reads['design'] ?? [];
  const versions: readonly Read[] = input.reads['versions'] ?? [];
  // Two lines of one save may order the same design: the second sees what the first planned.
  const planned = new Map<string, { version: number; values: PostingScalar | null }>();
  for (const line of input.lines) {
    const key = keyOf(line.inputs['design']);
    if (key === null) continue;
    const design = designs.find((row) => String(row['id']) === key);
    if (design === undefined) {
      refusals.push({ line: line.line, reason: 'not-valid' });
      continue;
    }
    const mine = versions.filter((row) => String(row['design_id']) === key);
    const newest = planned.get(key) ?? mine.reduce<{ version: number; values: PostingScalar | null } | null>((best, row) => {
      const version = Number(row['version']);
      return best === null || version > best.version ? { version, values: row['values'] ?? null } : best;
    }, null);
    const values = design['values'] ?? null;
    if (newest === null || !sameJson(newest.values, values)) {
      const version = (newest?.version ?? 0) + 1;
      out.push({ op: 'insert', table: 'design_versions', line: line.line, label: labelOf(key, version, out.length), values: { app: design['app'] ?? null, design_id: design['id'] ?? key, version, values, note: null } });
      planned.set(key, { version, values });
    }
    if (design['state'] !== 'ordered' && !out.some((row) => row.op === 'update' && String(row.key['id']) === key)) {
      out.push({ op: 'update', table: 'designs', line: line.line, key: { id: design['id'] ?? key }, set: { state: 'ordered' } });
    }
  }
  return refusals.length > 0 ? { rows: out, refusals } : { rows: out };
}
