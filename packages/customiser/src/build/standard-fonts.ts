/**
 * THE PDF WRITER'S FOURTEEN STANDARD FONTS, LEFT OUT.
 *
 * The production files set every word as the outlines of the shop's own
 * font: they never use the PDF writer's built-in Helvetica or Times. Those
 * fonts' metrics are a large block of packed data; this stands in for the
 * module that holds them, in the shop's screens' build only, with the same
 * names and no data. A built-in font asked for anyway is refused, by name.
 */
export const FontNames = {
  Courier: 'Courier',
  CourierBold: 'Courier-Bold',
  CourierOblique: 'Courier-Oblique',
  CourierBoldOblique: 'Courier-BoldOblique',
  Helvetica: 'Helvetica',
  HelveticaBold: 'Helvetica-Bold',
  HelveticaOblique: 'Helvetica-Oblique',
  HelveticaBoldOblique: 'Helvetica-BoldOblique',
  TimesRoman: 'Times-Roman',
  TimesRomanBold: 'Times-Bold',
  TimesRomanItalic: 'Times-Italic',
  TimesRomanBoldItalic: 'Times-BoldItalic',
  Symbol: 'Symbol',
  ZapfDingbats: 'ZapfDingbats',
} as const;

export class Font {
  static load(name: string): never {
    throw new Error(`The built-in font ${name} is not in this build: words are drawn as outlines.`);
  }
}

export const Encodings: Record<string, unknown> = {};
export type EncodingType = unknown;
