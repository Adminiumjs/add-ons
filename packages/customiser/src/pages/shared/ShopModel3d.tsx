/**
 * A SHOP'S OWN MODEL IN 3D ON THE SHOP'S SCREENS.
 *
 * - `ModelTurntable`: the set-up's Base preview of a kit (BC-D10, Birch Row
 *   Customiser 680-695): the uploaded GLB drawn with three.js, turned by a
 *   drag or the four turn buttons below it, with the comp's badge "Your
 *   uploaded model · drag to turn". Where the device cannot read or draw the
 *   file, the comp's built-in preview is shown instead and the line below
 *   says so: "This device couldn't draw {file} — showing the built-in
 *   preview."
 *
 * The file is read from the shop's stored copy, as the shoppers' copy is.
 */
import { useCallback, useRef, useState, type PointerEvent, type ReactNode } from 'react';

import { hasWebGL } from '../../three/load.ts';
import { ModelView } from '../../three/PieceView.tsx';
import type { ModelKind } from '../../three/sniff.ts';
import { useShopModel, type ModelSource } from '../../three/useModel.ts';
import { apply, Gestures, isUpright, startView, type View } from '../../three/view.ts';
import { lucideByName, type AddOnTranslate } from './host.ts';
import { TurnButtons } from './Piece3d.tsx';
import { fileBytes, fileIdOf } from './stored.ts';

const BoxIcon = lucideByName('box');

/** Where a stored model is read from: its file, by its id. */
export function storedModel(file: unknown, kind: ModelKind): ModelSource | null {
  const id = fileIdOf(file);
  if (id === null) return null;
  return {
    key: id,
    kind,
    read: async () => {
      const bytes = await fileBytes(file);
      return bytes === null ? null : (bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    },
  };
}

export interface ModelTurntableProps {
  t: AddOnTranslate;
  source: ModelSource;
  /** The file's name, for the line that says it could not be drawn. */
  fileName: string;
  label: string;
  /** Below the square, beside the turn buttons: the model's name. */
  meta: ReactNode;
  /** The built-in preview, where this device cannot draw the model. */
  fallback: ReactNode;
  /** The angle it starts from and turns by: a kit's, or a 3D-printed item's. */
  kind?: 'kit' | 'printed';
}

export function ModelTurntable({ t, source, fileName, label, meta, fallback, kind = 'kit' }: ModelTurntableProps): ReactNode {
  const [failed, setFailed] = useState(() => !hasWebGL());
  const [view, setView] = useState<View>(() => startView(kind));
  const gestures = useRef(new Gestures());
  const now = useRef(view);
  now.current = view;
  const { model, unreadable } = useShopModel(failed ? null : source, NO_DECALS);
  const fail = useCallback(() => setFailed(true), []);
  const upright = isUpright(model);
  const move = (event: PointerEvent<HTMLDivElement>): void => {
    const moved = gestures.current.move(event.pointerId, event.clientX, event.clientY, now.current, false, upright);
    if (moved.capture === true) {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // A pointer the page no longer has: the drag goes on without it.
      }
    }
    if (moved.view !== undefined) setView(moved.view);
  };
  if (failed || unreadable)
    return (
      <div className="flex flex-col gap-2" data-part="customiser-model-fallback">
        <div className="relative aspect-square overflow-hidden rounded-2xl border border-border bg-surface-3 p-3">{fallback}</div>
        <div className="flex flex-wrap items-center gap-1">
          <span className="ms-auto font-mono text-[11px] text-fg-subtle">{t('setup.model.couldNot', 'This device couldn’t draw {file} — showing the built-in preview.', { file: fileName })}</span>
        </div>
      </div>
    );
  return (
    <div className="flex flex-col gap-2" data-part="customiser-model-3d">
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
        <span className="pointer-events-none absolute start-2.5 top-2.5 flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-surface px-2.5 py-1 text-[11.5px] font-bold text-fg-muted">
          <BoxIcon className="size-[13px]" aria-hidden="true" />
          {t('setup.model.badge', 'Your uploaded model · drag to turn')}
        </span>
      </div>
      <TurnButtons t={t} onTurn={(dx, dy) => setView((at) => apply(at, { kind: 'turn', dx, dy }, kind, upright))} meta={meta} />
    </div>
  );
}

const NO_DECALS: readonly never[] = [];

