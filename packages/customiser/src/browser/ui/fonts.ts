/**
 * THE SHOP'S FONTS, LOADED FOR THE CUSTOMER.
 *
 * A font the shop uploaded is served as a product asset (a WOFF2 file any
 * visitor's browser may load); it is loaded with the browser's own font API,
 * never as markup. A starter font whose file is not uploaded yet is asked for
 * by its family name, so a page that already loads it (or a system that has
 * it) shows it, and every other page falls back to a plain face of the same
 * kind.
 *
 * Words shown in their font (a font chip, a field) take a class per family,
 * `cz-font-<n>`, written into one style sheet of the editor's own: the
 * editor's markup carries no inline style.
 */
import type { CustomiserApi } from '../api.ts';
import type { Font } from '../catalogue.ts';

const loaded = new Map<string, number>();
let sheet: { text: string; node: HTMLStyleElement | null } = { text: '', node: null };

/** A family as CSS names it, with a fallback of its kind. */
export function cssFamily(family: string): string {
  const quoted = `"${family.replace(/["\\]/g, '')}"`;
  const lower = family.toLowerCase();
  const kind = lower.includes('mono') ? 'ui-monospace, monospace' : /caveat|script|hand/.test(lower) ? 'cursive' : /garamond|baskerville|serif|slab/.test(lower) && !/sans/.test(lower) ? 'ui-serif, serif' : 'ui-sans-serif, system-ui, sans-serif';
  return `${quoted}, ${kind}`;
}

function write(): void {
  if (typeof document === 'undefined') return;
  if (sheet.node === null || !document.head.contains(sheet.node)) {
    sheet.node = document.createElement('style');
    sheet.node.setAttribute('data-customiser-fonts', '');
    document.head.append(sheet.node);
  }
  sheet.node.textContent = sheet.text;
}

/** The class that sets a family's font, registered on first use. */
export function fontClass(family: string): string {
  let index = loaded.get(family);
  if (index === undefined) {
    index = loaded.size;
    loaded.set(family, index);
    sheet = { ...sheet, text: `${sheet.text}.cz .cz-font-${String(index)}{font-family:${cssFamily(family)}}\n` };
    write();
  }
  return `cz-font-${String(index)}`;
}

const asked = new Set<string>();

/** Load the shop's uploaded font files, once each, through the browser's font API. */
export async function loadFonts(api: CustomiserApi, fonts: readonly Font[]): Promise<void> {
  if (typeof FontFace === 'undefined' || typeof document === 'undefined' || !('fonts' in document)) return;
  for (const font of fonts) {
    if (asked.has(font.family)) continue;
    asked.add(font.family);
    const url = await api.fontUrl(font.row).catch(() => null);
    if (url === null) continue;
    try {
      const face = new FontFace(font.family, `url(${JSON.stringify(url)}) format("woff2")`);
      document.fonts.add(await face.load());
    } catch {
      // A font that does not load shows its fallback; the design is unchanged.
    }
  }
}

/** A measure of words in a font, from the browser's own drawing of them: the safe-line advice needs it. */
export function browserMeasure(): ((line: string, font: string, sizeMm: number, weight: number) => number) | undefined {
  if (typeof document === 'undefined') return undefined;
  let context: CanvasRenderingContext2D | null = null;
  try {
    context = document.createElement('canvas').getContext('2d');
  } catch {
    context = null;
  }
  if (context === null || typeof context.measureText !== 'function') return undefined;
  const pen = context;
  return (line, font, sizeMm, weight) => {
    // Drawn at 100 px a millimetre, read back in millimetres.
    pen.font = `${String(weight)} ${String(sizeMm * 100)}px ${cssFamily(font)}`;
    return pen.measureText(line).width / 100;
  };
}
