/**
 * The pieces this add-on knows how to draw, and what they are made of.
 *
 * WHY THIS IS NOT IN THE TEMPLATE. `Template` is the CONTRACT's shape
 * (`product-personalizer@1`): a product key, the angles the maker put up, and
 * the zones they drew on them. It deliberately says nothing about how big a
 * coaster is or what walnut looks like, because those belong to the shop's
 * catalogue and a contract that carried them could only ever describe one
 * shop's catalogue.
 *
 * So the add-on keeps its own small table, keyed by the same `productKey` the
 * template carries, and a piece it has never heard of falls back to a plain
 * rectangle at the template's own stated size rather than failing to render.
 * That is the seam a real install replaces: the host hands over a product
 * record, this table becomes a lookup, and nothing above it changes.
 *
 * THE COLOURS ARE THE MATERIAL'S, NEVER THE INTERFACE'S. Comp L's one critical
 * colour rule: everything drawn inside the preview uses the piece's own
 * colours, and the only tokens allowed near it are the guide colours — a dashed
 * `--info` outline for a zone being edited, a solid `--danger` outline for one
 * whose content does not fit, a `--pos` flash when a change lands. Nothing in
 * this file is an accent.
 */

export type MaterialId = 'walnut' | 'birch' | 'slate' | 'ceramic';

export interface Material {
  id: MaterialId;
  /** The two ends of the tile's gradient. */
  from: string;
  to: string;
  /** Grain strokes: colour and opacity. Absent on materials with no grain. */
  grain?: { stroke: string; opacity: number; count: number };
  /** What a cut into this material reads as. */
  engraved: string;
  /** What sits proud of it. */
  raised: string;
  /** The two paints the studio keeps. */
  paint: { white: string; black: string };
  /** Printed ink. */
  printed: string;
  /** An edge that reads as thickness, at the three-quarter angle. */
  edge: string;
}

export const MATERIALS: Readonly<Record<MaterialId, Material>> = {
  walnut: {
    id: 'walnut',
    from: '#8a5a30',
    to: '#4a2c14',
    grain: { stroke: '#301a09', opacity: 0.24, count: 9 },
    engraved: '#2a1608',
    raised: '#b98a5c',
    paint: { white: '#f4efe6', black: '#141010' },
    printed: '#efe6d8',
    edge: '#33200e',
  },
  birch: {
    id: 'birch',
    from: '#efdcb8',
    to: '#cdae7c',
    grain: { stroke: '#a4823f', opacity: 0.18, count: 11 },
    engraved: '#5d4520',
    raised: '#fbf3e2',
    paint: { white: '#ffffff', black: '#1a1613' },
    printed: '#3c2f18',
    edge: '#b08f5c',
  },
  slate: {
    id: 'slate',
    from: '#5b6068',
    to: '#272b31',
    grain: { stroke: '#181b1f', opacity: 0.22, count: 7 },
    engraved: '#d6dae0',
    raised: '#8e959e',
    paint: { white: '#f2f4f7', black: '#0d0f11' },
    printed: '#eef1f5',
    edge: '#1b1e22',
  },
  ceramic: {
    id: 'ceramic',
    from: '#faf6ee',
    to: '#ddd4c2',
    engraved: '#7c6a4c',
    raised: '#ffffff',
    paint: { white: '#ffffff', black: '#22201c' },
    printed: '#3a3227',
    edge: '#c7bda9',
  },
};

export type PieceShape = 'rect' | 'round' | 'ellipse';

export interface Piece {
  key: string;
  widthMm: number;
  heightMm: number;
  shape: PieceShape;
  /** Corner radius for `round`, in millimetres. */
  radiusMm?: number;
  /** Holes the laser cuts right through — a keyring loop, a hanging hole. */
  holes?: readonly { xMm: number; yMm: number; rMm: number }[];
  /** A light score the studio runs inside the edge on some pieces. */
  scoreInsetMm?: number;
  material: MaterialId;
}

export const PIECES: Readonly<Record<string, Piece>> = {
  'walnut-coasters': {
    key: 'walnut-coasters',
    widthMm: 95,
    heightMm: 95,
    shape: 'round',
    radiusMm: 10,
    scoreInsetMm: 5,
    material: 'walnut',
  },
  'ply-coasters': {
    key: 'ply-coasters',
    widthMm: 95,
    heightMm: 95,
    shape: 'round',
    radiusMm: 10,
    scoreInsetMm: 5,
    material: 'birch',
  },
  'house-sign': {
    key: 'house-sign',
    widthMm: 250,
    heightMm: 120,
    shape: 'rect',
    holes: [
      { xMm: 16, yMm: 60, rMm: 4 },
      { xMm: 234, yMm: 60, rMm: 4 },
    ],
    material: 'slate',
  },
  'keyring': {
    key: 'keyring',
    widthMm: 60,
    heightMm: 32,
    shape: 'round',
    radiusMm: 8,
    holes: [{ xMm: 8, yMm: 16, rMm: 2.5 }],
    material: 'walnut',
  },
  'stoneware-mug': {
    key: 'stoneware-mug',
    widthMm: 200,
    heightMm: 90,
    shape: 'round',
    radiusMm: 6,
    material: 'ceramic',
  },
};

/** The piece a template is for, or a plain rectangle if the shop has a new one. */
export function pieceFor(productKey: string, fallbackMm = { w: 100, h: 100 }): Piece {
  return (
    PIECES[productKey] ?? {
      key: productKey,
      widthMm: fallbackMm.w,
      heightMm: fallbackMm.h,
      shape: 'rect',
      material: 'birch',
    }
  );
}
