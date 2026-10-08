/**
 * A FIGURE THE SCREEN WORKS OUT WHILE SOMEBODY TYPES.
 *
 * What Adminium decided is read from the saved row and shown from there. But
 * a person counting boxes wants to see what the boxes come to, and what the
 * order still expects, before anything is saved. These are those hints: exact
 * sums over the text as typed — whole numbers of millionths, never a float —
 * shown beside the field and replaced by Adminium's own figure once it has
 * saved the line. Nothing worked out here is ever sent.
 */
const PLACES = 6;
const ONE = 10n ** BigInt(PLACES);

/** A typed figure, not less than nothing, as millionths; null when it is not a figure or has more places than that. */
function read(typed: string): bigint | null {
  const raw = typed.trim();
  if (!/^(\d+\.?\d*|\.\d+)$/.test(raw)) return null;
  const [whole = '', part = ''] = raw.split('.');
  if (part.length > PLACES) return null;
  return BigInt(whole === '' ? '0' : whole) * ONE + BigInt(part.padEnd(PLACES, '0'));
}

/** Millionths as a person writes them: no padding zeros. */
function shown(scaled: bigint): string {
  const whole = scaled / ONE;
  const part = String(scaled % ONE).padStart(PLACES, '0').replace(/0+$/, '');
  return part === '' ? String(whole) : `${String(whole)}.${part}`;
}

/** `a × b`, exactly; null when either is not a figure or the answer has more than six places. */
export function times(a: string, b: string): string | null {
  const x = read(a);
  const y = read(b);
  if (x === null || y === null) return null;
  const product = x * y;
  return product % ONE === 0n ? shown(product / ONE) : null;
}

/** How `now` stands against `expected`: what is still to come, what is over, or even. Null when either is not a figure. */
export function against(expected: string, now: string): { side: 'short' | 'over' | 'even'; by: string } | null {
  const x = read(expected);
  const y = read(now);
  if (x === null || y === null) return null;
  if (x === y) return { side: 'even', by: '0' };
  return x > y ? { side: 'short', by: shown(x - y) } : { side: 'over', by: shown(y - x) };
}

/** `a ÷ b` where it comes out whole (so many packs, none broken); else null. */
export function wholeTimes(a: string, b: string): string | null {
  const x = read(a);
  const y = read(b);
  if (x === null || y === null || y === 0n || x % y !== 0n) return null;
  return String(x / y);
}
