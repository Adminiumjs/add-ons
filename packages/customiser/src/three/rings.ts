/**
 * A PIECE'S OUTLINE AS SOLIDS AND HOLES, IN MILLIMETRES.
 *
 * An outline is drawn as closed lines (rings): the piece's edge, and inside
 * it the holes cut through it (a keyring's hole, a window). A laser file
 * draws a hole as a shape of its own as often as a part of the edge's path,
 * so which ring is which is read from where it lies, not from how it was
 * drawn: a ring inside an odd number of others is a hole in the smallest of
 * them, a ring inside an even number (none, or an island inside a hole) is a
 * solid of its own.
 *
 * No library: a test holds the rule on plain points.
 */
export interface Point {
  x: number;
  y: number;
}

export interface Solid {
  outer: Point[];
  holes: Point[][];
}

/** A ring's area, signed by which way it runs. */
export function signedArea(ring: readonly Point[]): number {
  let sum = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

/** Whether a point lies inside a ring (crossing count). */
export function inside(point: Point, ring: readonly Point[]): boolean {
  let within = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const a = ring[i]!;
    const b = ring[j]!;
    if (a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) within = !within;
  }
  return within;
}

/** A ring with the last point dropped where it repeats the first, and the rings too small to cut left out. */
function cleaned(ring: readonly Point[]): Point[] | null {
  const out = ring.filter((one, at) => at === 0 || one.x !== ring[at - 1]!.x || one.y !== ring[at - 1]!.y);
  if (out.length > 1 && out[0]!.x === out[out.length - 1]!.x && out[0]!.y === out[out.length - 1]!.y) out.pop();
  return out.length >= 3 && Math.abs(signedArea(out)) > 1e-6 ? out : null;
}

/** The rings sorted into solids, each with the holes cut through it. */
export function solidsOf(rings: readonly (readonly Point[])[]): Solid[] {
  const kept = rings.map(cleaned).filter((one): one is Point[] => one !== null);
  // Largest first: a ring can only be inside one larger than itself.
  const sorted = kept.map((ring) => ({ ring, area: Math.abs(signedArea(ring)) })).sort((a, b) => b.area - a.area);
  const solids: { solid: Solid; ring: Point[] }[] = [];
  const depthOf: number[] = [];
  sorted.forEach(({ ring }, at) => {
    const probe = ring[0]!;
    const around = sorted.slice(0, at).map((one, index) => ({ index, ring: one.ring })).filter((one) => inside(probe, one.ring));
    const depth = around.length;
    depthOf.push(depth);
    if (depth % 2 === 0) {
      solids.push({ solid: { outer: ring, holes: [] }, ring });
      return;
    }
    // A hole belongs to the smallest solid around it: the last one found, by area.
    const parent = [...around].reverse().find((one) => depthOf[one.index]! % 2 === 0);
    const owner = parent === undefined ? undefined : solids.find((one) => one.ring === parent.ring);
    owner?.solid.holes.push(ring);
  });
  return solids.map((one) => one.solid);
}

/** A rectangle with rounded corners, as a ring (each corner in `steps` pieces). */
export function roundedRing(width: number, height: number, corner: number, steps = 8): Point[] {
  const r = Math.max(0, Math.min(corner, width / 2, height / 2));
  if (r === 0)
    return [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height },
    ];
  const out: Point[] = [];
  const corners: [number, number, number][] = [
    [width - r, r, -Math.PI / 2],
    [width - r, height - r, 0],
    [r, height - r, Math.PI / 2],
    [r, r, Math.PI],
  ];
  for (const [cx, cy, start] of corners)
    for (let i = 0; i <= steps; i += 1) {
      const angle = start + (i / steps) * (Math.PI / 2);
      out.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
    }
  return out;
}

/** The box round every solid's outer ring. */
export function boundsOf(solids: readonly Solid[]): { x: number; y: number; w: number; h: number } | null {
  const points = solids.flatMap((one) => one.outer);
  if (points.length === 0) return null;
  const xs = points.map((one) => one.x);
  const ys = points.map((one) => one.y);
  const [x, y] = [Math.min(...xs), Math.min(...ys)];
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
