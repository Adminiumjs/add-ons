/**
 * HOW A 3D PREVIEW IS TURNED AND ZOOMED, WITH NO SCREEN AND NO LIBRARY IN IT.
 *
 * The comp's stage (Birch Row Customiser, the 3D preview): a piece is turned
 * by a tilt (`rx`, kept within 80° either way) and a turn (`ry`, any amount),
 * and zoomed between 60 % and 220 %. Each kind of base starts at its own
 * angle; "Reset the view" goes back to it at 100 %.
 *
 * - The keys on the focused stage: arrows turn (only while it is shown in 3D),
 *   `+` / `=` and `-` zoom, `0` resets.
 * - The pointer: a drag of more than 4 px turns (a shorter one is a tap, which
 *   picks a part); two pointers pinch to zoom, and tilt as they move up or
 *   down together. A finger's drag only turns side to side, so the page still
 *   scrolls up and down under it; a mouse turns both ways.
 * - The wheel zooms.
 *
 * A flat piece lies face-up, so its tilt leans its top away and the view
 * looks down on it from 90° less the tilt. A GLB stands upright (glTF's own
 * way, its top up the y axis), so its tilt is how far above it the view
 * looks from: the stage turns it the other way (`upright`), and so that a
 * drag, a button or a key still moves the near side the same way, the tilt
 * they ask for is turned round with it.
 *
 * Kept apart from three.js so the shop's 2D screens carry it at no cost and a
 * test holds every rule without a canvas.
 */

export type ModelKind = 'piece' | 'kit' | 'printed';

export interface View {
  /** The tilt, in degrees: the top of a flat piece leans away as it grows; an upright model is seen from further above. */
  rx: number;
  /** The turn, in degrees: the piece's right side comes forward as it shrinks. */
  ry: number;
  zoom: number;
}

export const ZOOM_MIN = 0.6;
export const ZOOM_MAX = 2.2;
export const TILT_MAX = 80;
/** How far a pointer moves before a press becomes a drag, in pixels. */
export const DRAG_START = 4;

/** Where each kind of base is first seen from, as the comp frames it. */
export const START: Readonly<Record<ModelKind, { rx: number; ry: number }>> = {
  piece: { rx: 36, ry: -20 },
  kit: { rx: 12, ry: -30 },
  printed: { rx: 30, ry: -18 },
};

export const startView = (kind: ModelKind): View => ({ ...START[kind], zoom: 1 });

/**
 * Whether the stage shows a model standing upright: a GLB, whose top is up
 * the y axis. A flat piece and a model to print (an STL or a 3MF, its top up
 * the z axis as slicers keep it) lie face-up.
 */
export const isUpright = (model: unknown): boolean => {
  const one = model as { kind?: unknown; file?: unknown } | null;
  return typeof one === 'object' && one !== null && one.kind === 'model' && one.file === 'glb';
};

/** Which way a tilt asked for turns the view: the other way round for an upright model. */
const tiltSign = (upright: boolean): number => (upright ? -1 : 1);

const clamp = (value: number, low: number, high: number): number => Math.max(low, Math.min(high, value));

/** The view turned by `dx` degrees and tilted by `dy` (as a flat piece takes it; turned round for an upright model). */
export const turned = (view: View, dx: number, dy: number, upright = false): View => ({ ...view, ry: view.ry + dx, rx: clamp(view.rx + dy * tiltSign(upright), -TILT_MAX, TILT_MAX) });

/** The view zoomed by a factor, kept to two decimals and within its bounds. */
export const zoomed = (view: View, factor: number): View => ({ ...view, zoom: clamp(Math.round(view.zoom * factor * 100) / 100, ZOOM_MIN, ZOOM_MAX) });

/** The zoom as the stage says it: "100%". */
export const zoomLabel = (view: View): string => `${String(Math.round(view.zoom * 100))}%`;

/** The four turn buttons, in the comp's order. */
export const TURNS = [
  { name: 'left', dx: -15, dy: 0 },
  { name: 'right', dx: 15, dy: 0 },
  { name: 'up', dx: 0, dy: 12 },
  { name: 'down', dx: 0, dy: -12 },
] as const;
export type TurnName = (typeof TURNS)[number]['name'];

/** The zoom buttons' and keys' steps. */
export const ZOOM_IN = 1.12;
export const ZOOM_OUT = 0.89;

export type Command = { kind: 'turn'; dx: number; dy: number } | { kind: 'zoom'; factor: number } | { kind: 'reset' };

const ARROWS: Readonly<Record<string, TurnName>> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };

/** What a key does on the focused stage; none for a key it leaves alone (the arrows, while it is flat). */
export function keyCommand(key: string, flat: boolean): Command | null {
  const arrow = ARROWS[key];
  if (arrow !== undefined) {
    if (flat) return null;
    const turn = TURNS.find((one) => one.name === arrow)!;
    return { kind: 'turn', dx: turn.dx, dy: turn.dy };
  }
  if (key === '+' || key === '=') return { kind: 'zoom', factor: ZOOM_IN };
  if (key === '-') return { kind: 'zoom', factor: ZOOM_OUT };
  if (key === '0') return { kind: 'reset' };
  return null;
}

/** A command applied to the view of a base of this kind (an upright model's tilt turned round). */
export function apply(view: View, command: Command, kind: ModelKind, upright = false): View {
  if (command.kind === 'turn') return turned(view, command.dx, command.dy, upright);
  if (command.kind === 'zoom') return zoomed(view, command.factor);
  return startView(kind);
}

/** The wheel's step: up zooms in. */
export const wheelFactor = (deltaY: number): number => (deltaY < 0 ? 1.08 : 0.93);

interface Pointer {
  x: number;
  y: number;
  touch: boolean;
}

/** What a pointer's move asks of the stage. */
export interface Moved {
  /** The view to show, where it changed. */
  view?: View;
  /** Whether the stage should take the pointer now (a drag has begun). */
  capture?: boolean;
}

/**
 * The pointers on the stage, and what their moves do to the view.
 *
 * One pointer: once it has moved more than 4 px it turns the piece (half a
 * degree a pixel across, 0.4 down; a finger only across). Two: the distance
 * between them zooms, their middle moving up or down tilts. Lifting a pointer
 * that never became a drag is a tap (`up` says so), for picking a part.
 */
export class Gestures {
  private pointers = new Map<number, Pointer>();
  private drag: { x: number; y: number; view: View } | null = null;
  private pinch: { distance: number; middleY: number; view: View } | null = null;
  /** Whether two pointers were down at once since the last time none was: no tap then. */
  private multi = false;
  /** Whether a one-pointer drag is turning the piece. */
  dragging = false;

  down(id: number, x: number, y: number, touch: boolean, view: View): void {
    this.pointers.set(id, { x, y, touch });
    if (this.pointers.size === 1) this.drag = { x, y, view };
    else {
      this.multi = true;
      this.drag = null;
      this.dragging = false;
      this.pinch = null;
    }
  }

  move(id: number, x: number, y: number, view: View, flat: boolean, upright = false): Moved {
    const sign = tiltSign(upright);
    const pointer = this.pointers.get(id);
    if (pointer === undefined) return {};
    this.pointers.set(id, { ...pointer, x, y });
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()] as [Pointer, Pointer];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const middleY = (a.y + b.y) / 2;
      if (this.pinch === null || this.pinch.distance <= 0) {
        this.pinch = { distance, middleY, view };
        return {};
      }
      const zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, (this.pinch.view.zoom * distance) / this.pinch.distance));
      const rx = flat ? this.pinch.view.rx : Math.max(-TILT_MAX, Math.min(TILT_MAX, this.pinch.view.rx - (middleY - this.pinch.middleY) * 0.4 * sign));
      return { view: { ...view, zoom, rx } };
    }
    const drag = this.drag;
    if (drag === null || this.pointers.size !== 1 || flat) return {};
    const [dx, dy] = [x - drag.x, y - drag.y];
    let capture = false;
    if (!this.dragging) {
      if (Math.hypot(dx, dy) <= DRAG_START) return {};
      this.dragging = true;
      capture = true;
    }
    const ry = drag.view.ry + dx * 0.5;
    const rx = pointer.touch ? drag.view.rx : Math.max(-TILT_MAX, Math.min(TILT_MAX, drag.view.rx - dy * 0.4 * sign));
    return { view: { ...view, rx, ry }, capture };
  }

  /** A pointer lifted: whether it was a tap (one pointer that never dragged). */
  up(id: number): { tap: boolean } {
    const had = this.pointers.has(id);
    const tap = had && this.pointers.size === 1 && !this.dragging && !this.multi;
    this.pointers.delete(id);
    if (this.pointers.size < 2) this.pinch = null;
    if (this.pointers.size === 0) {
      this.drag = null;
      this.dragging = false;
      this.multi = false;
    }
    return { tap };
  }
}
