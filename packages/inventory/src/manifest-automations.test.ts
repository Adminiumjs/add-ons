/**
 * THE RULES IT BRINGS.
 *
 * Four automations come with the add-on. The owner may switch each on or off
 * and copy one to change it; none is theirs to edit. Two are on from the
 * first minute because they only tell somebody something (and draft an order
 * nobody has sent); the two that EMAIL A SUPPLIER by themselves are off until
 * the owner turns them on.
 */

import { describe, expect, it } from 'vitest';

import manifest from '../manifest.json' with { type: 'json' };

interface Condition {
  left: { field?: string; count?: { table: string; matchColumn: string; equalsField: string; where?: Condition } };
  op: string;
  right?: unknown;
}
interface Node {
  id: string;
  kind: string;
  amount?: number;
  unit?: string;
  condition?: Condition;
  action?: { kind: string; table?: string; values?: Record<string, unknown>; to?: { roles: string[] }; title?: Record<string, string>; body?: Record<string, string> };
  branches?: { id: string; nodes: Node[] }[];
}
interface Rule {
  key: string;
  enabled: boolean;
  trigger: {
    kind: string;
    event?: string;
    table?: string;
    changedColumn?: string;
    when?: Condition[];
    schedule?: { kind: string; time: string };
    forEach?: { table: string; where: Condition[]; once: boolean };
  };
  graph: { nodes: Node[] };
}
interface Column {
  ref: string;
  rules?: Record<string, unknown>;
}

const rules = (manifest as unknown as { automations: Rule[] }).automations;
const tables = manifest.requiredSchema.tables as unknown as { ref: string; columns: Column[] }[];
const columnsOf = (ref: string) => tables.find((table) => table.ref === ref)?.columns ?? [];
const roleKeys = (manifest as unknown as { roles: { key: string }[] }).roles.map((role) => role.key);
const ruleOf = (key: string): Rule => {
  const found = rules.find((rule) => rule.key === key);
  if (found === undefined) throw new Error(`no rule "${key}"`);
  return found;
};
/** Every step of a rule, a branch's own steps after it. */
const steps = (nodes: Node[]): Node[] => nodes.flatMap((node) => [node, ...(node.branches ?? []).flatMap((branch) => steps(branch.nodes))]);
/** The table a rule's record is a row of. */
const recordTable = (rule: Rule) => rule.trigger.table ?? rule.trigger.forEach?.table ?? '';
const SENDS = { kind: 'record.update', values: { status: 'sent', sent_how: 'email' } };

describe('the rules the add-on ships', () => {
  it('are four, and only the two that email nobody are on from the start', () => {
    expect(rules.map((rule) => [rule.key, rule.enabled])).toEqual([
      ['low-stock', true],
      ['send-drafts-daily', false],
      ['send-when-drafted', false],
      ['expiring-soon', true],
    ]);
    // What a rule switched on by default may do: tell a role, and make a request. Never send an order.
    for (const rule of rules.filter((one) => one.enabled)) {
      expect(steps(rule.graph.nodes).filter((node) => node.action?.kind === 'record.update'), rule.key).toEqual([]);
    }
  });

  it('name in every notice and every value only columns of the record the rule runs for', () => {
    for (const rule of rules) {
      const columns = columnsOf(recordTable(rule)).map((column) => column.ref);
      expect(columns.length, rule.key).toBeGreaterThan(0);
      const texts = steps(rule.graph.nodes).flatMap((node) => [...Object.values(node.action?.title ?? {}), ...Object.values(node.action?.body ?? {}), ...Object.values(node.action?.values ?? {}).filter((value) => typeof value === 'string')]);
      for (const text of texts) {
        for (const match of String(text).matchAll(/\{\{\s*record\.([a-z_]+)\s*\}\}/g)) expect(columns, `${rule.key} · ${match[1] ?? ''}`).toContain(match[1]);
      }
      for (const condition of [...(rule.trigger.when ?? []), ...(rule.trigger.forEach?.where ?? []), ...steps(rule.graph.nodes).flatMap((node) => (node.condition === undefined ? [] : [node.condition]))]) {
        if (condition.left.field !== undefined) expect(columns, `${rule.key} · ${condition.left.field}`).toContain(condition.left.field);
      }
    }
  });

  it('tell only roles the add-on has', () => {
    const told = rules.flatMap((rule) => steps(rule.graph.nodes).flatMap((node) => node.action?.to?.roles ?? []));
    expect(told.length).toBeGreaterThan(0);
    for (const role of told) expect(roleKeys).toContain(role);
    expect(new Set(told)).toEqual(new Set(['manager']));
  });

  it('hear a change only of a column that is announced when its total settles', () => {
    for (const rule of rules.filter((one) => one.trigger.changedColumn !== undefined)) {
      const column = columnsOf(recordTable(rule)).find((one) => one.ref === rule.trigger.changedColumn);
      expect(column?.rules?.['announce'], `${rule.key} · ${rule.trigger.changedColumn ?? ''}`).toBe(true);
    }
  });
});

describe('low stock', () => {
  const rule = ruleOf('low-stock');

  it('runs when an item falls to its reorder level, and not while it stays there', () => {
    expect(rule.trigger).toEqual({ kind: 'record', event: 'updated', table: 'stock_points', changedColumn: 'to_reorder', when: [{ left: { field: 'to_reorder' }, op: 'is', right: 1 }] });
  });

  it('asks for a reorder of that stock point first, and leaves the quantity to the add-on', () => {
    expect(rule.graph.nodes[1]?.action).toEqual({ kind: 'record.create', table: 'reorder_requests', values: { stock_point_id: '{{record.id}}' } });
  });

  it('then says what became of it: no supplier, enough elsewhere, or on a draft order', () => {
    const branches = rule.graph.nodes.filter((node) => node.kind === 'branch');
    expect(branches.map((node) => node.condition)).toEqual([
      { left: { field: 'request_note' }, op: 'is', right: 'needs_supplier' },
      { left: { field: 'request_note' }, op: 'is', right: 'elsewhere' },
    ]);
    // Each "yes" tells the manager and stops; only what is left reaches the last notice.
    for (const branch of branches) expect(branch.branches?.[0]?.nodes.map((node) => node.kind)).toEqual(['action', 'stop']);
    expect(steps(rule.graph.nodes).filter((node) => node.action?.kind === 'notification')).toHaveLength(3);
    expect(rule.graph.nodes.at(-1)?.action?.kind).toBe('notification');
  });
});

describe('sending a draft order by itself', () => {
  it('at 17:00: only a draft marked for it, with a line and an address to send to', () => {
    const rule = ruleOf('send-drafts-daily');
    expect(rule.trigger.schedule).toEqual({ kind: 'daily', time: '17:00' });
    expect(rule.trigger.forEach).toEqual({
      table: 'purchase_orders',
      where: [
        { left: { field: 'status' }, op: 'is', right: 'draft' },
        { left: { field: 'auto_send' }, op: 'is', right: 'true' },
        { left: { field: 'line_count' }, op: 'gt', right: 0 },
        { left: { field: 'supplier_email' }, op: 'not_empty' },
      ],
      once: false,
    });
    expect(rule.graph.nodes.at(-1)?.action).toEqual(SENDS);
  });

  it('fifteen minutes after the last line: never while somebody is still adding lines', () => {
    const rule = ruleOf('send-when-drafted');
    expect(rule.trigger).toMatchObject({ kind: 'record', event: 'updated', table: 'purchase_orders', changedColumn: 'line_count' });
    const [, wait, ...rest] = rule.graph.nodes;
    expect(wait).toMatchObject({ kind: 'wait', amount: 15, unit: 'minutes' });
    // After the wait everything is asked again: the order may have been sent, changed or emptied meanwhile.
    expect(rest.map((node) => node.kind)).toEqual(['condition', 'condition', 'condition', 'condition', 'action']);
    expect(rest.find((node) => node.condition?.left.count !== undefined)?.condition).toEqual({
      left: { count: { table: 'po_lines', matchColumn: 'po_id', equalsField: 'id', where: { left: { field: 'created_at' }, op: 'within_last', right: { amount: 14, unit: 'minutes' } } } },
      op: 'is',
      right: 0,
    });
    expect(rest.at(-1)?.action).toEqual(SENDS);
  });

  it('sends by the same move a person makes: the order becomes sent, by email', () => {
    // The move draft → sent carries no role, so a rule may make it.
    const moves = (tables.find((table) => table.ref === 'purchase_orders') as unknown as { states: { moves: Record<string, (string | { to: string; roles?: string[] })[]> } }).states.moves['draft'] ?? [];
    const toSent = moves.map((move) => (typeof move === 'string' ? { to: move } : move)).find((move) => move.to === 'sent');
    expect(toSent).toBeDefined();
    expect(toSent?.roles).toBeUndefined();
  });
});

describe('expiring soon', () => {
  it('tells of each batch with stock left once, thirty days before its date', () => {
    const rule = ruleOf('expiring-soon');
    expect(rule.trigger).toEqual({
      kind: 'schedule',
      schedule: { kind: 'daily', time: '08:00' },
      forEach: { table: 'levels', where: [{ left: { field: 'qty' }, op: 'gt', right: 0 }, { left: { field: 'expires_on' }, op: 'within_next', right: { amount: 30, unit: 'days' } }], once: true },
    });
    expect(rule.graph.nodes.map((node) => node.action?.kind ?? node.kind)).toEqual(['trigger', 'notification']);
  });
});
