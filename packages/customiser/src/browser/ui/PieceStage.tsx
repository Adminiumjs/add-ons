/**
 * A FLAT PIECE ON THE CUSTOMER'S STAGE, IN 3D: the comp's 3D preview.
 *
 * The piece is the shop's outline pushed up to the material's thickness,
 * with the customer's design on its top, painted from the same flat sheet
 * the flat view, the proof and the laser's file are drawn from. Around it,
 * the comp's chrome: the size and material labels, the hint, "See it flat",
 * the turn buttons, − / % / + and "Reset the view".
 *
 * - Drag turns it (a finger only side to side, so the page still scrolls);
 *   two fingers pinch and tilt; the wheel zooms; on the focused stage the
 *   arrows turn it, + and − zoom and 0 resets. A tap on the piece takes the
 *   customer to the field of the part it lands on.
 * - "See it flat" shows the flat drawing, whose parts are buttons into their
 *   fields as before.
 * - A device that cannot draw 3D shows it flat, says so, and the switch stays
 *   on; one that asked for less motion starts flat.
 *
 * The stage is a group (`aria-roledescription` "3D preview") so the parts in
 * the flat drawing reach assistive technology.
 */
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Box, Move3d, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';

import { flatSheet } from '../../draw/flat.ts';
import { hasWebGL, reducedMotion } from '../../three/load.ts';
import { ModelView } from '../../three/PieceView.tsx';
import type { Stage3d, StageModel } from '../../three/stage3d.ts';
import { usePieceModel, type OutlineSource } from '../../three/usePiece.ts';
import { apply, Gestures, keyCommand, startView, TURNS, wheelFactor, zoomed, zoomLabel, ZOOM_IN, ZOOM_OUT, type TurnName, type View } from '../../three/view.ts';
import type { CustomiserApi, DesignData } from '../api.ts';
import type { Catalogue } from '../catalogue.ts';
import { useShared } from './context.tsx';
import { thresholdOf, useOneColour, type Upload } from './pictures.ts';

export interface PieceStageProps {
  api: CustomiserApi;
  catalogue: Catalogue;
  design: DesignData;
  pictures: Readonly<Record<string, Upload>>;
  startThreshold: number;
  narrow: boolean;
  /** The piece drawn flat, its parts buttons into their fields: "See it flat". */
  flat: ReactNode;
  /** What the stage is called: the product and the design. */
  product: string;
  designName: string;
  /** The labels along the stage's foot: its size, its material. */
  size: string;
  material: string | null;
  /** A tap on a part of the piece in 3D. */
  onPart: (code: string) => void;
  /** A kit: started from its own angle, drawn as the shop's model it is given (none: not drawn yet). */
  kind?: 'piece' | 'kit';
  model?: StageModel | null;
  /** Shown flat whatever the switch says (a kit's pieces laid flat). */
  forceFlat?: boolean;
  /** Beside the switch: a kit's Assembled / Pieces. */
  modes?: ReactNode;
  /** Where a tap on the kit's model landed: the part there, if any. */
  pickPart?: (stage: Stage3d, x: number, y: number) => string | null;
}

const ICONS: Readonly<Record<TurnName, typeof ArrowLeft>> = { left: ArrowLeft, right: ArrowRight, up: ArrowUp, down: ArrowDown };

/** Where the customer's outline is read from: the shop's asset, by its address. */
export function outlineOf(api: CustomiserApi, catalogue: Catalogue): OutlineSource | null {
  const file = catalogue.base.row['outline_file'];
  if (typeof file !== 'string' || file === '' || api.outlineUrl === undefined) return null;
  const outlineUrl = api.outlineUrl;
  return {
    key: `${String(catalogue.base.id)}:${file}`,
    text: async () => {
      const url = await outlineUrl(catalogue.base.row);
      if (url === null) return null;
      const answer = await fetch(url);
      return answer.ok ? await answer.text() : null;
    },
  };
}

/** The addresses the piece's top paints its pictures from: as the flat view draws them (a logo the laser engraves, in one colour). */
export function usePaintedPictures(catalogue: Catalogue, design: DesignData, pictures: Readonly<Record<string, Upload>>, startThreshold: number): Record<string, string> {
  const sheet = flatSheet(catalogue, design, { empty: 'hide', labels: { logo: '', photo: '' }, holds: (column) => pictures[column] !== undefined });
  const itemOf = (column: string) => sheet.items.find((one): one is Extract<(typeof sheet.items)[number], { kind: 'picture' }> => one.kind === 'picture' && one.column === column);
  const logo = itemOf('logo_file');
  const photo = itemOf('photo_file');
  const logoLaser = useOneColour(logo?.oneColour === true ? pictures['logo_file'] : undefined, thresholdOf(logo, startThreshold), logo?.colour ?? '#000000');
  const photoLaser = useOneColour(photo?.oneColour === true ? pictures['photo_file'] : undefined, thresholdOf(photo, startThreshold), photo?.colour ?? '#000000');
  const out: Record<string, string> = {};
  for (const [column, item, laser] of [
    ['logo_file', logo, logoLaser],
    ['photo_file', photo, photoLaser],
  ] as const) {
    const url = item?.oneColour === true ? laser : pictures[column]?.url;
    if (item !== undefined && url !== undefined && url !== null) out[column] = url;
  }
  return out;
}

export function PieceStage(props: PieceStageProps): ReactNode {
  const { t } = useShared();
  const { catalogue, design, pictures, startThreshold, narrow } = props;
  const [no3d, setNo3d] = useState(() => !hasWebGL());
  const kind = props.kind ?? 'piece';
  const [flat, setFlat] = useState(() => reducedMotion());
  const [view, setView] = useState<View>(() => startView(kind));
  const [dragging, setDragging] = useState(false);
  const shownFlat = flat || no3d || props.forceFlat === true;
  const stage = useRef<HTMLDivElement | null>(null);
  const flatBox = useRef<HTMLDivElement | null>(null);
  const model3d = useRef<Stage3d | null>(null);
  const gestures = useRef(new Gestures());
  const viewNow = useRef(view);
  viewNow.current = view;

  const sheet = useMemo(
    () => flatSheet(catalogue, design, { empty: 'dim', labels: { logo: t('editor.drawing.logo', 'Your logo'), photo: t('editor.drawing.photo', 'Your photo') }, holds: (column) => pictures[column] !== undefined }),
    [catalogue, design, pictures, t],
  );
  const painted = usePaintedPictures(catalogue, design, pictures, startThreshold);
  const outline = useMemo(() => outlineOf(props.api, catalogue), [props.api, catalogue]);
  const pieceModel = usePieceModel(shownFlat || props.model !== undefined ? null : sheet, catalogue.base.thickness, outline, painted);
  const model = props.model !== undefined ? props.model : pieceModel;

  // The wheel zooms the piece, not the page: a listener that may stop the page scrolling.
  useEffect(() => {
    const el = stage.current;
    if (el === null) return undefined;
    const wheel = (event: WheelEvent): void => {
      event.preventDefault();
      setView((now) => zoomed(now, wheelFactor(event.deltaY)));
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, []);

  // The flat drawing is zoomed as the 3D piece is (the stage's own scale, set on the element, not in markup).
  useEffect(() => {
    if (flatBox.current !== null) flatBox.current.style.transform = view.zoom === 1 ? '' : `scale(${String(view.zoom)})`;
  }, [view.zoom, shownFlat]);

  const down = (event: PointerEvent<HTMLDivElement>): void => {
    gestures.current.down(event.pointerId, event.clientX, event.clientY, event.pointerType === 'touch', viewNow.current);
  };
  const move = (event: PointerEvent<HTMLDivElement>): void => {
    const moved = gestures.current.move(event.pointerId, event.clientX, event.clientY, viewNow.current, shownFlat);
    if (moved.capture === true) {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // A pointer the page no longer has: the drag goes on without it.
      }
      setDragging(true);
    }
    if (moved.view !== undefined) setView(moved.view);
  };
  const up = (event: PointerEvent<HTMLDivElement>, cancelled: boolean): void => {
    const { tap } = gestures.current.up(event.pointerId);
    if (!gestures.current.dragging) setDragging(false);
    if (!tap || cancelled || shownFlat || model3d.current === null) return;
    const box = stage.current?.getBoundingClientRect();
    if (box === undefined || box.width <= 0 || box.height <= 0) return;
    const [x, y] = [(event.clientX - box.left) / box.width, (event.clientY - box.top) / box.height];
    if (props.pickPart !== undefined) {
      const code = props.pickPart(model3d.current, x, y);
      if (code !== null) props.onPart(code);
      return;
    }
    const spot = model3d.current.pick(x, y);
    if (spot === null) return;
    // The part on top where the tap landed: the last one drawn there.
    const hit = [...sheet.items].reverse().find((item) => item.live && spot.x >= item.box.x && spot.x <= item.box.x + item.box.w && spot.y >= item.box.y && spot.y <= item.box.y + item.box.h);
    if (hit !== undefined) props.onPart(hit.code);
  };
  const keyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.target !== event.currentTarget) return;
    const command = keyCommand(event.key, shownFlat);
    if (command === null) return;
    event.preventDefault();
    setView((now) => apply(now, command, kind));
  };
  const fail = useCallback(() => setNo3d(true), []);

  const label = shownFlat
    ? t('editor.stage.label', '{product}, {design}. Shown flat.', { product: props.product, design: props.designName })
    : t('editor.stage.label3d', '{product}, {design}. Use the arrow keys to turn it, plus and minus to zoom, 0 to reset.', { product: props.product, design: props.designName });

  return (
    <>
      <div
        ref={stage}
        className={`cz-stage cz-stage-3d${shownFlat ? ' cz-stage-flat' : dragging ? ' cz-grabbing' : ''}`}
        tabIndex={0}
        role="group"
        aria-roledescription={t('editor.stage.roledescription', '3D preview')}
        aria-label={label}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={(event) => up(event, false)}
        onPointerCancel={(event) => up(event, true)}
        onKeyDown={keyDown}
      >
        {shownFlat ? (
          <div ref={flatBox} className="cz-flat-box">
            {props.flat}
          </div>
        ) : (
          <ModelView model={model} view={view} className="cz-model" stageRef={model3d} onFail={fail} />
        )}
        <span className="cz-stage-labels">
          <span className="cz-mono cz-stage-label">{props.size}</span>
          {props.material === null ? null : <span className="cz-stage-label">{props.material}</span>}
        </span>
        {shownFlat || model === null ? null : (
          <span className="cz-stage-hint">
            <Move3d aria-hidden="true" />
            {narrow ? t('editor.stage.hintPhone', 'Drag to turn · pinch to zoom') : t('editor.stage.hint', 'Drag to turn · scroll to zoom')}
          </span>
        )}
      </div>
      <div className="cz-stage-bar">
        <button
          type="button"
          role="switch"
          aria-checked={flat || no3d}
          aria-disabled={no3d}
          className={no3d ? 'cz-flat-switch cz-locked' : 'cz-flat-switch'}
          onClick={() => {
            if (!no3d) setFlat((now) => !now);
          }}
        >
          <span className={flat || no3d ? 'cz-switch-track cz-on' : 'cz-switch-track'} aria-hidden="true">
            <span className="cz-switch-knob" />
          </span>
          {t('editor.stage.seeFlat', 'See it flat')}
        </button>
        {props.modes}
        <div className="cz-stage-tools">
          {shownFlat ? null : (
            <div role="group" aria-label={t('editor.stage.turn', 'Turn the piece')} className="cz-tool-group">
              {TURNS.map((turn) => {
                const Icon = ICONS[turn.name];
                const name = turnName(t, turn.name);
                return (
                  <button key={turn.name} type="button" className="cz-tool-button" aria-label={name} title={name} onClick={() => setView((now) => apply(now, { kind: 'turn', dx: turn.dx, dy: turn.dy }, kind))}>
                    <Icon aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          )}
          <div role="group" aria-label={t('editor.stage.zoom', 'Zoom')} className="cz-tool-group">
            <button type="button" className="cz-tool-button" aria-label={t('editor.stage.zoomOut', 'Zoom out')} onClick={() => setView((now) => zoomed(now, ZOOM_OUT))}>
              <ZoomOut aria-hidden="true" />
            </button>
            <span className="cz-mono cz-tool-label">{zoomLabel(view)}</span>
            <button type="button" className="cz-tool-button" aria-label={t('editor.stage.zoomIn', 'Zoom in')} onClick={() => setView((now) => zoomed(now, ZOOM_IN))}>
              <ZoomIn aria-hidden="true" />
            </button>
          </div>
          <button type="button" className="cz-reset" onClick={() => setView(startView(kind))}>
            <RotateCcw aria-hidden="true" />
            {t('editor.stage.reset', 'Reset the view')}
          </button>
        </div>
      </div>
      {no3d ? (
        <div role="status" className="cz-note">
          <Box aria-hidden="true" />
          <span>{t('editor.stage.no3d', 'This device can’t show the 3D view, so you’re seeing each piece flat. It’s the same design we’ll cut.')}</span>
        </div>
      ) : null}
    </>
  );
}

function turnName(t: ReturnType<typeof useShared>['t'], name: TurnName): string {
  if (name === 'left') return t('editor.stage.turnLeft', 'Turn left');
  if (name === 'right') return t('editor.stage.turnRight', 'Turn right');
  if (name === 'up') return t('editor.stage.turnUp', 'Turn up');
  return t('editor.stage.turnDown', 'Turn down');
}
