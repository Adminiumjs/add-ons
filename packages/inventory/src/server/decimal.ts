/**
 * QUANTITIES AND COSTS AS WHOLE NUMBERS.
 *
 * A quantity is kept to three places and a unit cost to four. Both are held
 * here as integers of that many places (`1.250` is `1250n`), so no figure in
 * the file that decides is ever a float: `0.1 + 0.2` is `300n`, never
 * `0.30000000000000004`. A figure crosses in as text (`"12.500"`) or as a
 * JSON number and leaves as text with exactly the places its column keeps.
 *
 * One rounding per stored figure, half away from zero.
 */

/** The places a quantity and a unit cost keep. */
export const QTY = 3;
export const COST = 4;

const pow10 = (places: number): bigint => 10n ** BigInt(places);

/**
 * A figure as an integer of `scale` places. Text is read digit by digit; a
 * number is read through its own shortest text, which is exact for every
 * figure a column of these scales can hold. More places than `scale` are
 * rounded, half away from zero. Empty reads as nothing.
 */
export function read(value: unknown, scale: number): bigint | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'bigint') return value;
  if (typeof value !== 'string' && typeof value !== 'number') throw new Error(`not a figure: ${typeof value}`);
  const text = typeof value === 'number' ? String(value) : value.trim();
  const match = /^([+-])?(\d+)(?:\.(\d+))?$/.exec(text);
  if (match === null) throw new Error(`not a figure: "${text}"`);
  const negative = match[1] === '-';
  const whole = match[2] ?? '0';
  const fraction = match[3] ?? '';
  let scaled = BigInt(whole) * pow10(scale) + BigInt((fraction + '0'.repeat(scale)).slice(0, scale) || '0');
  // The first place past the scale decides the rounding.
  if (fraction.length > scale && (fraction.charCodeAt(scale) ?? 48) >= 53) scaled += 1n;
  return negative ? -scaled : scaled;
}

/** As {@link read}, with nothing read as zero. */
export function readOr0(value: unknown, scale: number): bigint {
  return read(value, scale) ?? 0n;
}

/** The text a column of `scale` places stores: `1250n` at three places is `"1.250"`. */
export function text(scaled: bigint, scale: number): string {
  const negative = scaled < 0n;
  const digits = (negative ? -scaled : scaled).toString().padStart(scale + 1, '0');
  const body = scale === 0 ? digits : `${digits.slice(0, digits.length - scale)}.${digits.slice(digits.length - scale)}`;
  return negative ? `-${body}` : body;
}

/** `a ÷ b`, rounded half away from zero to a whole number. */
export function divRound(a: bigint, b: bigint): bigint {
  if (b === 0n) throw new Error('division by nothing');
  const negative = a < 0n !== b < 0n;
  const top = a < 0n ? -a : a;
  const bottom = b < 0n ? -b : b;
  const rounded = (top * 2n + bottom) / (bottom * 2n);
  return negative ? -rounded : rounded;
}

/** `a ÷ b`, rounded down toward zero: how many whole times `b` goes into `a`. */
export function divFloor(a: bigint, b: bigint): bigint {
  if (b === 0n) throw new Error('division by nothing');
  return a / b;
}

/**
 * The product of two figures of `scaleA` and `scaleB` places, at `scale`
 * places: a quantity times a quantity is a quantity (`mul(a, QTY, b, QTY, QTY)`).
 */
export function mul(a: bigint, scaleA: number, b: bigint, scaleB: number, scale: number): bigint {
  return divRound(a * b, pow10(scaleA + scaleB - scale));
}

/** A whole number (a multiplier, a count) as a figure of `scale` places. */
export function whole(n: number, scale: number): bigint {
  if (!Number.isInteger(n)) return read(n, scale) ?? 0n;
  return BigInt(n) * pow10(scale);
}

/** A quantity shown in an item's own places (0 to 3), rounded down: what "left" says. */
export function shown(scaled: bigint, decimals: number): string {
  const places = Math.max(0, Math.min(QTY, decimals));
  const cut = scaled / pow10(QTY - places);
  return text(cut, places);
}

export const min = (a: bigint, b: bigint): bigint => (a < b ? a : b);
export const max = (a: bigint, b: bigint): bigint => (a > b ? a : b);
