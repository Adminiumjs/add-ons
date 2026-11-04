/**
 * A FLAT PIECE IN 3D ON THE SHOP'S SCREENS.
 *
 * - `PieceTurntable`: the set-up's Base preview (BC-D2.flat, Birch Row
 *   Customiser 680-695): the piece made from its outline and thickness, in
 *   a square, turned by a drag or the four turn buttons below it, its size
 *   beside them. Until the outline is in, the comp's striped square says the
 *   preview comes with it. A device that cannot draw 3D gets the piece
 *   drawn flat (the comp's built-in preview), as before.
 * - `PieceStillBox`: a still of a piece in a square (a record's preview,
 *   the order line's "3D").
 *
 * The outline is read from the shop's stored file, the one the laser's
 * file is cut from.
 */
import { useCallback, useRef, useState, type PointerEvent, type ReactNode } from 'react';

import { materialColours, type FlatItem, type FlatSheet } from '../../draw/flat.ts';
import { hasWebGL } from '../../three/load.ts';
import { ModelView, PieceStill } from '../../three/PieceView.tsx';
import { usePieceModel, type OutlineSource } from '../../three/usePiece.ts';
import { apply, Gestures, startView, TURNS, type TurnName, type View } from '../../three/view.ts';
import { lucideByName, type AddOnTranslate } from './host.ts';
import { fileBytes, fileIdOf } from './stored.ts';

const ICONS: Readonly<Record<TurnName, ReturnType<typeof lucideByName>>> = {
  left: lucideByName('arrow-left'),
  right: lucideByName('arrow-right'),
  up: lucideByName('arrow-up'),
  down: lucideByName('arrow-down'),
};

/** Where a stored outline is read from: its file, by its id. */
export function storedOutline(file: unknown): OutlineSource | null {
  const id = fileIdOf(file);
  if (id === null) return null;
  return {
    key: id,
    text: async () => {
      const bytes = await fileBytes(file);
      return bytes === null ? null : new TextDecoder().decode(bytes);
    },
  };
}

/** A piece with nothing on it but what is given (its areas, named in dashed boxes): its material's colours, its size. */
export function plainSheet(size: { width: number; height: number }, corner: number, material: string | null, areas: readonly { id: string; name: string; box: { x: number; y: number; w: number; h: number } }[] = []): FlatSheet {
  const colours = materialColours(material);
  const items: FlatItem[] = areas.map((area) => ({ key: area.id, code: area.id, box: area.box, live: false, locked: false, kind: 'slot', label: area.name, filled: false, page: false }));
  return { side: 'front', face: { kind: 'piece', width: Math.max(size.width, 1), height: Math.max(size.height, 1), corner, bleed: 0, safe: null, colour: colours.face, edge: colours.edge }, items };
}

function turnName(t: AddOnTranslate, name: TurnName): string {
  if (name === 'left') return t('setup.turn.left', 'Turn left');
  if (name === 'right') return t('setup.turn.right', 'Turn right');
  if (name === 'up') return t('setup.turn.up', 'Turn up');
  return t('setup.turn.down', 'Turn down');
}

export interface PieceTurntableProps {
  t: AddOnTranslate;
  sheet: FlatSheet;
  thickness: number | null;
  outline: OutlineSource | null;
  /** The picture's name for a reader: "{name} preview". */
  label: string;
  /** The piece's size beside the turn buttons: "95 × 95 × 6 mm". */
  meta: ReactNode;
  /** The piece drawn flat, where this device cannot draw it in 3D. */
  fallback: ReactNode;
}

export function PieceTurntable({ t, sheet, thickness, outline, label, meta, fallback }: PieceTurntableProps): ReactNode {
  const [failed, setFailed] = useState(() => !hasWebGL());
  const [view, setView] = useState<View>(() => startView('piece'));
  const gestures = useRef(new Gestures());
  const now = useRef(view);
  now.current = view;
  const model = usePieceModel(failed ? null : sheet, thickness, failed ? null : outline);
  const fail = useCallback(() => setFailed(true), []);
  const move = (event: PointerEvent<HTMLDivElement>): void => {
    const moved = gestures.current.move(event.pointerId, event.clientX, event.clientY, now.current, false);
    if (moved.capture === true) {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // A pointer the page no longer has: the drag goes on without it.
      }
    }
    if (moved.view !== undefined) setView(moved.view);
  };
  if (failed)
    return (
      <div className="flex flex-col gap-2">
        <div className="rounded-xl border border-border bg-surface-3 p-3">{fallback}</div>
        <div className="flex justify-end">{meta}</div>
      </div>
    );
  return (
    <div className="flex flex-col gap-2" data-part="customiser-piece-3d">
      <div
        role="img"
        aria-label={label}
        className="relative aspect-square cursor-grab touch-none select-none overflow-hidden rounded-2xl border border-border bg-surface-3"
        onPointerDown={(event) => gestures.current.down(event.pointerId, event.clientX, event.clientY, event.pointerType === 'touch', now.current)}
        onPointerMove={move}
        onPointerUp={(event) => gestures.current.up(event.pointerId)}
        onPointerCancel={(event) => gestures.current.up(event.pointerId)}
      >
        <ModelView model={model} view={view} className="absolute inset-0" onFail={fail} />
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {TURNS.map((turn) => {
          const Icon = ICONS[turn.name];
          const name = turnName(t, turn.name);
          return (
            <button key={turn.name} type="button" aria-label={name} title={name} className="grid size-[34px] place-items-center rounded-[9px] border border-border-strong bg-surface p-0 text-fg-muted hover:border-accent" onClick={() => setView((at) => apply(at, { kind: 'turn', dx: turn.dx, dy: turn.dy }, 'piece'))}>
              <Icon className="size-[15px]" aria-hidden="true" />
            </button>
          );
        })}
        <span className="ms-auto">{meta}</span>
      </div>
    </div>
  );
}

/** The comp's striped square, before a piece's outline is in. */
export function WaitingSquare({ words }: { words: ReactNode }): ReactNode {
  return (
    <div className="relative grid aspect-square place-items-center overflow-hidden rounded-2xl border border-border bg-surface-3 p-6 text-center">
      <svg aria-hidden="true" className="absolute inset-0 size-full" preserveAspectRatio="none">
        <defs>
          <pattern id="customiser-waiting-stripes" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="8" height="16" fill="var(--surface)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#customiser-waiting-stripes)" />
      </svg>
      <span className="relative rounded-[7px] bg-surface px-2.5 py-1.5 font-mono text-[11.5px] text-fg-subtle">{words}</span>
    </div>
  );
}

export interface PieceStillBoxProps {
  sheet: FlatSheet;
  thickness: number | null;
  outline: OutlineSource | null;
  pictures?: Readonly<Record<string, string>>;
  label: string;
  fallback: ReactNode;
}

/** A still of the piece in a square, named for a reader; the flat drawing where none can be drawn. */
export function PieceStillBox({ sheet, thickness, outline, pictures, label, fallback }: PieceStillBoxProps): ReactNode {
  return (
    <div role="img" aria-label={label} className="relative aspect-square overflow-hidden rounded-xl border border-border bg-surface-3">
      <PieceStill sheet={sheet} thickness={thickness} outline={outline} {...(pictures === undefined ? {} : { pictures })} width={480} height={480} alt="" className="absolute inset-0 size-full" fallback={<div className="p-3">{fallback}</div>} />
    </div>
  );
}
