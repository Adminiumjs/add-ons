/**
 * A SMALL OPENAPI CHECKER for the request bodies this add-on sends PayPal.
 *
 * It reads the trimmed copy of PayPal's own descriptions
 * (`paypal-openapi.json`, its `source` block names the commit and versions)
 * and covers the parts of OpenAPI those files use: `$ref`, `allOf`, `anyOf`,
 * `oneOf`, `type`, `enum`, `required`, `properties`, `additionalProperties`,
 * `items`, lengths, counts, ranges and `pattern`.
 *
 * Two rules are stricter than the descriptions, on purpose:
 *   - an object whose schema lists its properties is CLOSED: a field it does
 *     not list is an error (PayPal ignores some unknown fields, which is how a
 *     misspelt one goes unnoticed);
 *   - a `readOnly` field in a request is an error.
 *
 * Test only.
 */
import spec from './paypal-openapi.json' with { type: 'json' };

type Schema = Record<string, unknown>;
type Spec = 'orders' | 'payments';

const SCHEMAS = spec.schemas as unknown as Record<Spec, Record<string, Schema>>;

function resolve(which: Spec, schema: Schema): Schema {
  let current = schema;
  for (let depth = 0; typeof current['$ref'] === 'string' && depth < 20; depth += 1) {
    const name = (current['$ref'] as string).split('/').at(-1)!;
    const target = SCHEMAS[which][name];
    if (target === undefined) throw new Error(`the trimmed spec lacks ${name}`);
    current = target;
  }
  return current;
}

/** A pattern as JavaScript reads it: with `u` where it compiles, else as written (the email pattern needs the old rules). */
function compiled(pattern: string): RegExp {
  try {
    return new RegExp(pattern, 'u');
  } catch {
    return new RegExp(pattern);
  }
}

function knownKeys(which: Spec, schema: Schema, seen = new Set<Schema>()): Set<string> | 'open' {
  const s = resolve(which, schema);
  if (seen.has(s)) return new Set();
  seen.add(s);
  if (s['additionalProperties'] === true || typeof s['additionalProperties'] === 'object') return 'open';
  const keys = new Set(Object.keys((s['properties'] as Schema | undefined) ?? {}));
  for (const part of [...((s['allOf'] as Schema[]) ?? []), ...((s['anyOf'] as Schema[]) ?? []), ...((s['oneOf'] as Schema[]) ?? [])]) {
    const inner = knownKeys(which, part, seen);
    if (inner === 'open') return 'open';
    for (const key of inner) keys.add(key);
  }
  return keys;
}

function check(which: Spec, schema: Schema, value: unknown, path: string, closed: boolean, out: string[]): void {
  const s = resolve(which, schema);
  if (s['readOnly'] === true) out.push(`${path}: is read-only and may not be sent`);
  for (const part of (s['allOf'] as Schema[] | undefined) ?? []) check(which, part, value, path, false, out);
  for (const key of ['anyOf', 'oneOf'] as const) {
    const parts = s[key] as Schema[] | undefined;
    if (parts !== undefined && !parts.some((part) => {
      const errors: string[] = [];
      check(which, part, value, path, false, errors);
      return errors.length === 0;
    })) out.push(`${path}: matches none of its ${key}`);
  }
  const type = s['type'];
  if (type === 'string') {
    if (typeof value !== 'string') return void out.push(`${path}: is not a string`);
    if (typeof s['minLength'] === 'number' && value.length < s['minLength']) out.push(`${path}: is shorter than ${s['minLength']}`);
    if (typeof s['maxLength'] === 'number' && value.length > s['maxLength']) out.push(`${path}: is longer than ${s['maxLength']}`);
    if (typeof s['pattern'] === 'string' && !compiled(s['pattern']).test(value)) out.push(`${path}: does not match ${s['pattern']}`);
  }
  if ((type === 'integer' || type === 'number') && (typeof value !== 'number' || (type === 'integer' && !Number.isInteger(value)))) out.push(`${path}: is not a ${type}`);
  if (type === 'boolean' && typeof value !== 'boolean') out.push(`${path}: is not a boolean`);
  if (Array.isArray(s['enum']) && !(s['enum'] as unknown[]).includes(value)) out.push(`${path}: ${JSON.stringify(value)} is not one of ${JSON.stringify(s['enum'])}`);
  if (type === 'array') {
    if (!Array.isArray(value)) return void out.push(`${path}: is not an array`);
    if (typeof s['minItems'] === 'number' && value.length < s['minItems']) out.push(`${path}: has fewer than ${s['minItems']} items`);
    if (typeof s['maxItems'] === 'number' && value.length > s['maxItems']) out.push(`${path}: has more than ${s['maxItems']} items`);
    const items = s['items'] as Schema | undefined;
    if (items !== undefined) value.forEach((item, index) => check(which, items, item, `${path}[${index}]`, true, out));
  }
  const isObject = typeof value === 'object' && value !== null && !Array.isArray(value);
  if (type === 'object' && !isObject) return void out.push(`${path}: is not an object`);
  if (!isObject) return;
  const object = value as Record<string, unknown>;
  for (const key of (s['required'] as string[] | undefined) ?? []) if (!(key in object)) out.push(`${path}.${key}: is required`);
  const properties = (s['properties'] as Record<string, Schema> | undefined) ?? {};
  for (const [key, inner] of Object.entries(properties)) if (key in object) check(which, inner, object[key], `${path}.${key}`, true, out);
  if (closed) {
    const known = knownKeys(which, schema);
    if (known !== 'open' && known.size > 0) for (const key of Object.keys(object)) if (!known.has(key)) out.push(`${path}.${key}: is not a field PayPal describes`);
  }
}

/** The operation a request is, by method and path; null for a call with no body to check. */
export function operationOf(method: string, path: string): keyof typeof spec.requests | null {
  const bare = path.split('?')[0]!;
  if (method === 'POST' && bare === '/v2/checkout/orders') return 'POST /v2/checkout/orders';
  if (method === 'PATCH' && /^\/v2\/checkout\/orders\/[^/]+$/.test(bare)) return 'PATCH /v2/checkout/orders/{id}';
  if (method === 'POST' && /^\/v2\/checkout\/orders\/[^/]+\/capture$/.test(bare)) return 'POST /v2/checkout/orders/{id}/capture';
  if (method === 'POST' && /^\/v2\/payments\/captures\/[^/]+\/refund$/.test(bare)) return 'POST /v2/payments/captures/{capture_id}/refund';
  return null;
}

/** Every way a request body breaks PayPal's description of it. */
export function requestIssues(operation: keyof typeof spec.requests, body: unknown): string[] {
  const { spec: which, schema } = spec.requests[operation] as { spec: Spec; schema: string };
  const out: string[] = [];
  check(which, { $ref: `#/components/schemas/${schema}` }, body, 'body', true, out);
  return out;
}

/** Every way a query string breaks the description of the events list. */
export function eventsQueryIssues(search: string): string[] {
  const allowed = spec.query['GET /v1/notifications/webhooks-events'] as Record<string, { type: string }>;
  const out: string[] = [];
  for (const [name, value] of new URLSearchParams(search)) {
    const param = allowed[name];
    if (param === undefined) out.push(`${name}: is not a parameter PayPal describes`);
    else if (param.type === 'integer' && !/^\d+$/.test(value)) out.push(`${name}: is not an integer`);
  }
  return out;
}

export const OPENAPI_SOURCE = spec.source;
