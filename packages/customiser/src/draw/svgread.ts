/**
 * A CLEANED SVG READ AS SHAPES: a piece's outline, a customer's logo.
 *
 * The files Adminium keeps are cleaned (only drawing elements, only local
 * links), so what is in them is shapes in groups. Each shape is read as path
 * data in its own units, with every transform above it (and the drawing's
 * own frame, `viewBox`) folded into one matrix, its paint, and the laser
 * layer it belongs to: inside a group named `CUT`, `SCORE` or `ENGRAVE`, or
 * by the laser's colours (red cuts, blue scores), else none.
 *
 * What cannot be drawn as an outline is counted, never guessed: words that
 * are still words, and parts used by reference.
 */
export type Matrix = [number, number, number, number, number, number];
export type Layer = 'CUT' | 'SCORE' | 'ENGRAVE';

export interface ReadShape {
  d: string;
  matrix: Matrix;
  fill: string | null;
  stroke: string | null;
  strokeWidth: number;
  layer: Layer | null;
}

export interface ReadSvg {
  /** The drawing's own frame, in its units. */
  view: { x: number; y: number; w: number; h: number };
  shapes: ReadShape[];
  /** How many words (`<text>`) and references (`<use>`) it holds that are left out. */
  skipped: number;
}

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** `a` then `b`: a point is moved by `b` first, then by `a` (as nested SVG transforms are). */
export function times(a: Matrix, b: Matrix): Matrix {
  return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
}

const numbers = (text: string): number[] => (text.match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) ?? []).map(Number);

/** An SVG `transform` list as one matrix. */
export function transformOf(text: string | null): Matrix {
  if (text === null) return IDENTITY;
  let out = IDENTITY;
  for (const [, name, args] of text.matchAll(/(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g)) {
    const n = numbers(args ?? '');
    let m: Matrix = IDENTITY;
    if (name === 'matrix' && n.length === 6) m = n as Matrix;
    else if (name === 'translate') m = [1, 0, 0, 1, n[0] ?? 0, n[1] ?? 0];
    else if (name === 'scale') m = [n[0] ?? 1, 0, 0, n[1] ?? n[0] ?? 1, 0, 0];
    else if (name === 'rotate') {
      const r = ((n[0] ?? 0) * Math.PI) / 180;
      const [cx, cy] = [n[1] ?? 0, n[2] ?? 0];
      m = times(times([1, 0, 0, 1, cx, cy], [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0]), [1, 0, 0, 1, -cx, -cy]);
    } else if (name === 'skewX') m = [1, 0, Math.tan(((n[0] ?? 0) * Math.PI) / 180), 1, 0, 0];
    else if (name === 'skewY') m = [1, Math.tan(((n[0] ?? 0) * Math.PI) / 180), 0, 1, 0, 0];
    out = times(out, m);
  }
  return out;
}

const attr = (el: Element, name: string): number => Number(el.getAttribute(name) ?? 0) || 0;

/** A shape element as path data in its own units; none for one that draws nothing. */
export function pathOf(el: Element): string | null {
  const name = el.localName;
  if (name === 'path') return el.getAttribute('d');
  if (name === 'rect') {
    const [x, y, w, h] = [attr(el, 'x'), attr(el, 'y'), attr(el, 'width'), attr(el, 'height')];
    if (w <= 0 || h <= 0) return null;
    let rx = Math.min(attr(el, 'rx') || attr(el, 'ry'), w / 2);
    let ry = Math.min(attr(el, 'ry') || attr(el, 'rx'), h / 2);
    if (rx <= 0 || ry <= 0) return `M${String(x)} ${String(y)}H${String(x + w)}V${String(y + h)}H${String(x)}Z`;
    [rx, ry] = [Math.max(rx, 0), Math.max(ry, 0)];
    return `M${String(x + rx)} ${String(y)}H${String(x + w - rx)}A${String(rx)} ${String(ry)} 0 0 1 ${String(x + w)} ${String(y + ry)}V${String(y + h - ry)}A${String(rx)} ${String(ry)} 0 0 1 ${String(x + w - rx)} ${String(y + h)}H${String(x + rx)}A${String(rx)} ${String(ry)} 0 0 1 ${String(x)} ${String(y + h - ry)}V${String(y + ry)}A${String(rx)} ${String(ry)} 0 0 1 ${String(x + rx)} ${String(y)}Z`;
  }
  if (name === 'circle' || name === 'ellipse') {
    const [cx, cy] = [attr(el, 'cx'), attr(el, 'cy')];
    const rx = name === 'circle' ? attr(el, 'r') : attr(el, 'rx');
    const ry = name === 'circle' ? attr(el, 'r') : attr(el, 'ry');
    if (rx <= 0 || ry <= 0) return null;
    return `M${String(cx - rx)} ${String(cy)}A${String(rx)} ${String(ry)} 0 1 0 ${String(cx + rx)} ${String(cy)}A${String(rx)} ${String(ry)} 0 1 0 ${String(cx - rx)} ${String(cy)}Z`;
  }
  if (name === 'line') return `M${String(attr(el, 'x1'))} ${String(attr(el, 'y1'))}L${String(attr(el, 'x2'))} ${String(attr(el, 'y2'))}`;
  if (name === 'polyline' || name === 'polygon') {
    const n = numbers(el.getAttribute('points') ?? '');
    if (n.length < 4) return null;
    const pairs: string[] = [];
    for (let i = 0; i + 1 < n.length; i += 2) pairs.push(`${i === 0 ? 'M' : 'L'}${String(n[i])} ${String(n[i + 1])}`);
    return pairs.join('') + (name === 'polygon' ? 'Z' : '');
  }
  return null;
}

/** A paint property, from the element's own attribute or its style. */
function paintOf(el: Element, name: string): string | null {
  const style = el.getAttribute('style') ?? '';
  const inStyle = new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`).exec(style)?.[1]?.trim();
  return inStyle ?? el.getAttribute(name);
}

/** A colour as `#rrggbb`, or none for `none` and paint that is no plain colour (a gradient). */
export function colourOf(paint: string | null): string | null {
  if (paint === null) return null;
  const value = paint.trim().toLowerCase();
  if (value === 'none' || value.startsWith('url(')) return null;
  const named: Record<string, string> = { black: '#000000', white: '#ffffff', red: '#ff0000', blue: '#0000ff', green: '#008000' };
  if (named[value] !== undefined) return named[value]!;
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(value);
  if (short !== null) return `#${short[1]!}${short[1]!}${short[2]!}${short[2]!}${short[3]!}${short[3]!}`;
  if (/^#[0-9a-f]{6}$/.test(value)) return value;
  const rgb = /^rgba?\(([^)]*)\)$/.exec(value);
  if (rgb !== null) {
    const [r, g, b] = numbers(rgb[1]!).map((one) => Math.max(0, Math.min(255, Math.round(one))));
    return `#${[r ?? 0, g ?? 0, b ?? 0].map((one) => one.toString(16).padStart(2, '0')).join('')}`;
  }
  return '#000000';
}

/** The laser's layer a colour names: red cuts, blue scores. */
function layerOfColour(colour: string | null): Layer | null {
  if (colour === null) return null;
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(colour.slice(at, at + 2), 16));
  if (r! > 200 && g! < 80 && b! < 80) return 'CUT';
  if (b! > 200 && r! < 80 && g! < 80) return 'SCORE';
  return null;
}

const SHAPES = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon']);
/** Never drawn where they stand: definitions, a clip's or a mask's own shapes. */
const UNDRAWN = new Set(['defs', 'clipPath', 'mask', 'symbol', 'linearGradient', 'radialGradient', 'title', 'desc']);

/** A cleaned SVG's text read as shapes; none for text that is no SVG. */
export function readSvg(text: string): ReadSvg | null {
  if (typeof DOMParser === 'undefined') return null;
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const root = doc.documentElement;
  if (root === null || root.localName !== 'svg' || doc.getElementsByTagName('parsererror').length > 0) return null;
  const box = numbers(root.getAttribute('viewBox') ?? '');
  const view = box.length === 4 ? { x: box[0]!, y: box[1]!, w: box[2]!, h: box[3]! } : { x: 0, y: 0, w: parseFloat(root.getAttribute('width') ?? '0') || 100, h: parseFloat(root.getAttribute('height') ?? '0') || 100 };
  const shapes: ReadShape[] = [];
  let skipped = 0;
  const walk = (el: Element, matrix: Matrix, layer: Layer | null, fill: string | null, stroke: string | null, width: number): void => {
    const name = el.localName;
    if (UNDRAWN.has(name)) return;
    if (name === 'text' || name === 'use') {
      skipped += 1;
      return;
    }
    const id = (el.getAttribute('id') ?? '').toUpperCase();
    const named: Layer | null = id === 'CUT' || id === 'SCORE' || id === 'ENGRAVE' ? id : null;
    const here = el === root ? matrix : times(matrix, transformOf(el.getAttribute('transform')));
    const ownFill = paintOf(el, 'fill');
    const ownStroke = paintOf(el, 'stroke');
    const ownWidth = paintOf(el, 'stroke-width');
    const nextFill = ownFill ?? fill;
    const nextStroke = ownStroke ?? stroke;
    const nextWidth = ownWidth === null ? width : parseFloat(ownWidth) || width;
    if (SHAPES.has(name)) {
      const d = pathOf(el);
      if (d === null || d.trim() === '') return;
      const strokeColour = colourOf(nextStroke);
      const fillColour = colourOf(nextFill);
      shapes.push({ d, matrix: here, fill: fillColour, stroke: strokeColour, strokeWidth: nextWidth, layer: layer ?? named ?? layerOfColour(strokeColour) ?? layerOfColour(fillColour) });
      return;
    }
    for (const child of Array.from(el.children)) walk(child, here, layer ?? named, nextFill, nextStroke, nextWidth);
  };
  // SVG's own start: shapes are filled black and not stroked.
  walk(root, IDENTITY, null, '#000000', null, 1);
  return { view, shapes, skipped };
}

/** The matrix that puts a drawing's frame into a box: inside it whole (`meet`), filling it (`slice`), or stretched to it. */
export function frameInto(view: ReadSvg['view'], box: { x: number; y: number; w: number; h: number }, how: 'meet' | 'slice' | 'stretch'): Matrix {
  const sx = box.w / (view.w || 1);
  const sy = box.h / (view.h || 1);
  if (how === 'stretch') return [sx, 0, 0, sy, box.x - view.x * sx, box.y - view.y * sy];
  const k = how === 'meet' ? Math.min(sx, sy) : Math.max(sx, sy);
  return [k, 0, 0, k, box.x + (box.w - view.w * k) / 2 - view.x * k, box.y + (box.h - view.h * k) / 2 - view.y * k];
}

/** A matrix as an SVG transform. */
export const matrixText = (m: Matrix): string => `matrix(${m.map((one) => String(Math.round(one * 1e6) / 1e6 + 0)).join(' ')})`;
