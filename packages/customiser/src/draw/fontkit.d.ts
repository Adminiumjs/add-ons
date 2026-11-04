/**
 * The few calls of `fontkit` the production files make: it ships no types of
 * its own. A font read from its file; a line of words laid out in it (its
 * glyphs, each with its advance and offset in the font's units); a glyph's
 * outline as drawing commands.
 */
declare module 'fontkit' {
  export interface PathCommand {
    command: 'moveTo' | 'lineTo' | 'quadraticCurveTo' | 'bezierCurveTo' | 'closePath';
    args: number[];
  }
  export interface Glyph {
    id: number;
    path: { commands: PathCommand[] };
    advanceWidth: number;
  }
  export interface GlyphPosition {
    xAdvance: number;
    yAdvance: number;
    xOffset: number;
    yOffset: number;
  }
  export interface GlyphRun {
    glyphs: Glyph[];
    positions: GlyphPosition[];
    advanceWidth: number;
  }
  export interface Font {
    unitsPerEm: number;
    familyName: string;
    variationAxes: Record<string, { min: number; default: number; max: number }>;
    layout(text: string, features?: string[] | Record<string, boolean>, script?: string, language?: string, direction?: 'ltr' | 'rtl'): GlyphRun;
    getVariation(settings: Record<string, number>): Font;
    glyphForCodePoint(codePoint: number): Glyph;
    hasGlyphForCodePoint(codePoint: number): boolean;
  }
  export function create(buffer: Uint8Array, postscriptName?: string): Font;
}
