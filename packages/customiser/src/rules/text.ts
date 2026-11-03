/**
 * HOW MUCH TEXT A PART TAKES — arithmetic on declared sizes, never on fonts.
 *
 * One rule with a switch, the same for the browser and the server:
 *
 * - `grows` on (laser pieces): a part takes `chars` characters at its
 *   design `size`, and more at smaller letters, in proportion. The shop's
 *   field reads "Characters at {design size}". A part of 16 at 10 mm takes 26
 *   at 6 mm.
 * - `grows` off (printed pages): `chars` is the limit at every size; the
 *   safe line decides what fits, and only the customer's editor, which has
 *   the fonts, can measure that.
 *
 * Characters are counted as code points, line breaks left out and the ends
 * trimmed: a space at the end prints nothing. No language's rules for
 * splitting text are used, so every place counts the same.
 */
import { PT_MM, type TextRules } from './shapes.ts';

/** The text as it prints: the ends trimmed. */
export const printed = (text: string | undefined): string => (text ?? '').trim();

/** How many characters a text counts for its limit. */
export const charCount = (text: string | undefined): number => [...printed(text).replace(/\r?\n/g, '')].length;

/** How many lines a text runs to. */
export const lineCount = (text: string | undefined): number => {
  const shown = printed(text);
  return shown === '' ? 0 : shown.split(/\r?\n/).length;
};

/** The most characters a part takes at a size: its own figure, scaled with the size where it grows. */
export function charLimit(rules: Pick<TextRules, 'chars' | 'grows' | 'size'>, size: number = rules.size): number {
  if (!rules.grows || !(size > 0) || !(rules.size > 0)) return rules.chars;
  return Math.max(1, Math.floor((rules.chars * rules.size) / size + 1e-6));
}

const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

/** Whether a part may be set at a size: one of its list, or inside its range, or its own size when it says neither. */
export function sizeAllowed(rules: Pick<TextRules, 'size' | 'sizes' | 'min' | 'max'>, size: number): boolean {
  if (!(size > 0)) return false;
  if (rules.sizes !== null) return near(size, rules.size) || rules.sizes.some((one) => near(one, size));
  if (rules.min !== null || rules.max !== null) return (rules.min === null || size >= rules.min - 1e-6) && (rules.max === null || size <= rules.max + 1e-6);
  return near(size, rules.size);
}

/** A size in millimetres, from the part's own unit. */
export const sizeInMm = (rules: Pick<TextRules, 'unit'>, size: number): number => (rules.unit === 'pt' ? size * PT_MM : size);

/**
 * The largest allowed size below `size` at which a text fits its part, or
 * none: the "Make it smaller" fix. A range steps down by half a millimetre (as
 * the size stepper does), a list takes its next size down.
 */
export function sizeThatFits(rules: TextRules, text: string, size: number = rules.size, fits: (at: number) => boolean = (at) => charCount(text) <= charLimit(rules, at)): number | null {
  const candidates = rules.sizes !== null ? [...rules.sizes].sort((a, b) => b - a) : rules.min !== null ? steps(size, rules.min) : [];
  for (const at of candidates) if (at < size - 1e-6 && sizeAllowed(rules, at) && fits(at)) return at;
  return null;
}

function steps(from: number, down: number): number[] {
  const out: number[] = [];
  for (let at = Math.round((from - 0.5) * 10) / 10; at > down - 1e-6; at = Math.round((at - 0.5) * 10) / 10) out.push(at);
  if (out.length === 0 || !near(out[out.length - 1]!, down)) out.push(down);
  return out;
}
