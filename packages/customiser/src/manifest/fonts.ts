/**
 * THE STARTER FONTS: open-licence typefaces every install starts with.
 *
 * Written once at install into the fonts table (`seeds`), for no app in
 * particular, so both shop apps on one install offer them. Each is named by
 * its own family name and its licence, the SIL Open Font License, which lets
 * a shop use it on anything it makes and sells. The font files and their
 * licence texts ship with the files of a later release (TODO(J10)).
 *
 * `smallest` is the size below which a typeface's thin strokes close up when
 * engraved, in millimetres, where the shop's experience gave one.
 */
import { w, type Words } from './words.ts';

export const OPEN_LICENCE = 'SIL Open Font License 1.1';

const STYLE = {
  serif: w('Serif', 'Serifenschrift', 'Avec empattements', 'Antikva', 'Patková', 'مذيّل', '衬线体', '襯線體'),
  sans: w('Sans', 'Serifenlos', 'Sans empattements', 'Grotesk', 'Bezpatková', 'غير مذيّل', '无衬线体', '無襯線體'),
  script: w('Handwriting', 'Handschrift', 'Manuscrite', 'Håndskrift', 'Psací', 'خط يدوي', '手写体', '手寫體'),
  slab: w('Slab serif', 'Serifenbetonte Schrift', 'Égyptienne', 'Slab serif', 'Egyptienka', 'مذيّل كتلي', '粗衬线体', '粗襯線體'),
  condensed: w('Condensed capitals', 'Schmale Versalien', 'Capitales étroites', 'Smalle versaler', 'Úzké verzálky', 'أحرف كبيرة مضغوطة', '窄体大写', '窄體大寫'),
  grotesque: w('Grotesque', 'Grotesk', 'Grotesque', 'Grotesk', 'Grotesk', 'غروتسك', '怪诞体', '怪誕體'),
  display: w('Display serif', 'Auszeichnungs-Serifenschrift', 'Titrage à empattements', 'Display-antikva', 'Titulková patková', 'مذيّل للعناوين', '标题衬线体', '標題襯線體'),
  mono: w('Monospaced', 'Dickte', 'Chasse fixe', 'Fast bredde', 'Neproporcionální', 'ثابت العرض', '等宽', '等寬'),
} satisfies Record<string, Words>;

export interface StarterFont {
  family: string;
  style: keyof typeof STYLE;
  weights: string;
  smallest: number | null;
}

export const STARTER_FONTS: readonly StarterFont[] = [
  { family: 'Cormorant Garamond', style: 'serif', weights: '300–700', smallest: 6 },
  { family: 'Manrope', style: 'sans', weights: '200–800', smallest: 4 },
  { family: 'Caveat', style: 'script', weights: '400–700', smallest: 7 },
  { family: 'Zilla Slab', style: 'slab', weights: '300–700', smallest: 5 },
  { family: 'Oswald', style: 'condensed', weights: '200–700', smallest: 5 },
  { family: 'Archivo', style: 'grotesque', weights: '100–900', smallest: null },
  { family: 'Libre Baskerville', style: 'serif', weights: '400, 700', smallest: null },
  { family: 'DM Serif Display', style: 'display', weights: '400', smallest: null },
  { family: 'JetBrains Mono', style: 'mono', weights: '100–800', smallest: null },
];

/** The rows the install writes: the starter set, its licence, for every app. */
export function starterFontRows(): Record<string, unknown>[] {
  return STARTER_FONTS.map((font) => ({
    '@label': `font:${font.family.toLowerCase().replaceAll(' ', '-')}`,
    family: font.family,
    name: font.family,
    style: { '@t': STYLE[font.style] },
    weights: font.weights,
    licence: OPEN_LICENCE,
    starter: true,
    ...(font.smallest === null ? {} : { smallest_mm: font.smallest }),
    active: true,
  }));
}
