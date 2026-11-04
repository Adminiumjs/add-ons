/**
 * WHAT ADMINIUM KEEPS OF AN SVG, AS A TEST READS IT (copied from the engine's
 * cleaner, `apps/server/src/files/svg.ts`, at 0.3.43): the elements a cleaned
 * drawing may hold, the attributes it may carry, links only to `#id`, no
 * namespace but SVG's. A file the Customiser makes that passes this is a file
 * Adminium stores as it is: nothing foreign in it to refuse or take out.
 */
const ELEMENTS = new Set(['svg', 'g', 'defs', 'symbol', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask', 'use', 'text', 'tspan', 'title', 'desc']);
const PAINT = ['fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset', 'opacity', 'color', 'display', 'visibility', 'stop-color', 'stop-opacity', 'clip-path', 'clip-rule', 'mask', 'vector-effect', 'paint-order', 'shape-rendering', 'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant', 'font-stretch', 'letter-spacing', 'word-spacing', 'text-anchor', 'dominant-baseline', 'alignment-baseline', 'baseline-shift', 'text-decoration', 'writing-mode', 'direction', 'unicode-bidi', 'mix-blend-mode'];
const ATTRIBUTES = new Set([...PAINT, 'id', 'xml:space', 'xml:lang', 'lang', 'transform', 'style', 'width', 'height', 'viewBox', 'preserveAspectRatio', 'x', 'y', 'rx', 'ry', 'cx', 'cy', 'r', 'x1', 'y1', 'x2', 'y2', 'points', 'd', 'pathLength', 'gradientUnits', 'gradientTransform', 'spreadMethod', 'fx', 'fy', 'fr', 'offset', 'clipPathUnits', 'maskUnits', 'maskContentUnits', 'dx', 'dy', 'rotate', 'textLength', 'lengthAdjust']);
const SVG_NS = 'http://www.w3.org/2000/svg';

/** Everything in an SVG's text the engine's cleaner would refuse or take out; empty when it would keep it as it is. */
export function foreignParts(text: string): string[] {
  const out: string[] = [];
  if (/<!DOCTYPE|<!ENTITY|<!\[CDATA\[|<\?(?!xml )/i.test(text)) out.push('a DOCTYPE, entity, CDATA or processing instruction');
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  if (doc.getElementsByTagName('parsererror').length > 0) return ['not well formed'];
  const walk = (el: Element): void => {
    if (el.namespaceURI !== SVG_NS) out.push(`${el.tagName}: not SVG`);
    if (!ELEMENTS.has(el.localName)) out.push(`<${el.localName}>`);
    for (const one of Array.from(el.attributes)) {
      if (one.name === 'xmlns') continue;
      if (!ATTRIBUTES.has(one.name)) out.push(`${el.localName}@${one.name}`);
      if (/url\(/.test(one.value) && !/^url\(#[A-Za-z_][\w.:-]*\)$/.test(one.value.trim())) out.push(`${el.localName}@${one.name}: a link out`);
    }
    for (const child of Array.from(el.children)) walk(child);
  };
  walk(doc.documentElement);
  return out;
}
