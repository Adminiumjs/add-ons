/**
 * Stripe's request bodies: form encoding with bracketed keys.
 *
 * `{ line_items: [{ quantity: 1 }] }` → `line_items[0][quantity]=1`. Values
 * are strings, numbers or booleans; `undefined` leaves the key out, so an
 * optional field is never sent empty (Stripe reads an empty value as "unset").
 */

export type FormValue = string | number | boolean | undefined | readonly FormValue[] | { readonly [key: string]: FormValue };

function flatten(prefix: string, value: FormValue, out: [string, string][]): void {
  if (value === undefined) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => flatten(`${prefix}[${index}]`, item, out));
    return;
  }
  if (typeof value === 'object') {
    for (const [key, inner] of Object.entries(value)) flatten(prefix === '' ? key : `${prefix}[${key}]`, inner, out);
    return;
  }
  out.push([prefix, String(value)]);
}

/** The body text. Keys keep their order, which keeps the mock suite's requests stable. */
export function formBody(fields: { readonly [key: string]: FormValue }): string {
  const pairs: [string, string][] = [];
  flatten('', fields, pairs);
  return new URLSearchParams(pairs).toString();
}
