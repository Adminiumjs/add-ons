/**
 * MARK FACES (BC-D2.markfaces, BC-F8; Birch Row Customiser 697-754, 1978-1992,
 * 2591-2614): the faces of the kit's model a shopper's words or logo go on.
 *
 * The shop clicks a face of its own model, drawn with three.js: the face
 * under the pointer is found by a ray from the camera, and it is flat when
 * the triangles round the one hit lie in its plane far enough each way
 * (`three/faces.ts`). A face that is not flat says so: "This face isn't
 * flat, so it can't carry words or a logo. Pick a flat face." A flat one
 * opens the form: "Name it", "The piece it's on", "The area it carries",
 * "Mark this face" (or "Save changes", "Unmark it").
 *
 * The list beside the model is the keyboard's way to the same faces: every
 * marked face and the model's largest flat faces, each a button. Marked
 * faces are outlined on the model, and the one picked (or under the
 * pointer) is tinted.
 *
 * A face is kept on the base's `faces` column as the model's own numbers
 * (its mesh, its plane, its size), so it lands on the same spot each time
 * the model is read; the area it carries names it by its code.
 *
 * A 3D-printed item (BC-D2.print; 2596, 2610-2612) marks faces on its model
 * to print, the file the printer gets: "Say how words sit on each flat
 * face." Its form asks "Raised" or "Cut in", "Raised by" (or "Depth cut
 * in") and "Smallest letter", kept on the face and on the rules of the area
 * it carries (the rules the customer's words are checked by). The model's
 * curved part is listed as "Curved": picking it says the face isn't flat.
 * Each face is also kept as the same face on the preview model, laid over
 * the model to print (`three/align.ts`), where the shoppers see it.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react';

import { placePlane } from '../../three/align.ts';
import { mmPerUnit, sameFace, spanOf, surveyOf, type FacePlane, type FaceRelief, type MarkedFace } from '../../three/faces.ts';
import { facesOf, facesValue, RELIEF_DEPTH, RELIEF_LETTER } from '../../three/faceStore.ts';
import { readPrintModel, trianglesOfPrint } from '../../three/printModel.ts';
import { hasWebGL } from '../../three/load.ts';
import { ModelView } from '../../three/PieceView.tsx';
import type { Stage3d } from '../../three/stage3d.ts';
import { useModelBytes, useShopModel } from '../../three/useModel.ts';
import { Gestures, startView, type View } from '../../three/view.ts';
import { Alert, asDataError, Button, Card, Figure, Input, lucideByName, SegmentedControl, Select, Stack, useWrite, type AddOnTranslate, type DataRow } from '../shared/host.ts';
import { storedModel } from '../shared/ShopModel3d.tsx';
import { refusal } from '../shared/refusal.ts';
import { useToast } from '../shared/toast.ts';
import { Stepper } from './AreasStep.tsx';
import { boxValues, jsonOf, kindOf, mm, num, offeredOf, startRules, text } from './facts.ts';
import { faceCode, pieceLabel, pieceSize } from './kit.ts';
import { usePreviewFit } from './PrintedBase.tsx';

const BoxSelect = lucideByName('box-select');
const Wide = lucideByName('rectangle-horizontal');
const Tall = lucideByName('rectangle-vertical');
const Square = lucideByName('square');
const CircleAlert = lucideByName('circle-alert');
const CircleDashed = lucideByName('circle-dashed');

/** The page's accent, for the outlines on the model (the model's colours are paint, not tokens). */
function accentOf(): string {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') return '#1c59e0';
  const value = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  return /^#[0-9a-f]{6}$/i.test(value) ? value : '#1c59e0';
}

/** The face being marked: a face already marked, or a plane picked on the model. */
interface Draft {
  plane: FacePlane;
  /** The marked face it is, if it is one. */
  code: string | null;
  name: string;
  piece: string;
  area: string;
  /** On a 3D-printed item: how its words sit. */
  relief: FaceRelief;
}

/** How words sit on a face no one has said yet: raised 1 mm, letters at least 4 mm (the comp's). */
const START_RELIEF: FaceRelief = { mode: 'raised', depth: RELIEF_DEPTH.start, smallest: RELIEF_LETTER.start };
/** A model whose curved part is at least this share of its surface lists it, as the comp lists "The edge" (the keyring's rounded ends are a tenth of it). */
const CURVED_SHOWN = 0.03;

/** The share of a model to print's surface that is curved, once its file is read; none before, or where it is too large to walk. */
function useCurved(bytes: ArrayBuffer | null | false): number | null {
  const [found, setFound] = useState<{ bytes: ArrayBuffer; curved: number | null } | null>(null);
  useEffect(() => {
    if (!(bytes instanceof ArrayBuffer)) return;
    let alive = true;
    void readPrintModel(new Uint8Array(bytes))
      .then((model) => surveyOf(trianglesOfPrint(model), '0')?.curved ?? null)
      .catch(() => null)
      .then((curved) => {
        if (alive) setFound({ bytes, curved });
      });
    return () => {
      alive = false;
    };
  }, [bytes]);
  return found !== null && found.bytes === bytes ? found.curved : null;
}

const NEW_AREA = 'new';

export function MarkFaces({ t, base, pieces, areas }: { t: AddOnTranslate; base: DataRow; pieces: readonly DataRow[]; areas: readonly DataRow[] }): ReactNode {
  const writeBase = useWrite('bases');
  const writeArea = useWrite('base_areas');
  const toast = useToast();
  const printed = kindOf(base) === 'printed';
  // A printed item's faces are found on the file the printer gets; a kit's on its assembled model.
  const source = useMemo(() => (printed ? storedModel(base['print_file'], 'stl') : storedModel(base['model_file'], 'glb')), [printed, base['print_file'], base['model_file']]); // eslint-disable-line react-hooks/exhaustive-deps
  const curved = useCurved(useModelBytes(printed ? source : null));
  const fit = usePreviewFit(base);
  const marked = useMemo(() => facesOf(base['faces']), [base['faces']]); // eslint-disable-line react-hooks/exhaustive-deps
  const [draft, setDraft] = useState<Draft | null>(null);
  const [hover, setHover] = useState<FacePlane | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<readonly FacePlane[]>([]);
  const [box, setBox] = useState<readonly [number, number, number] | null>(null);
  const [failed, setFailed] = useState(() => !hasWebGL());
  const [view] = useState<View>(() => (printed ? { ...startView('printed'), rx: 24, ry: -14 } : { ...startView('kit'), rx: 8, ry: -22 }));
  const stage = useRef<Stage3d | null>(null);
  const host = useRef<HTMLDivElement | null>(null);
  const gestures = useRef(new Gestures());
  const [turned, setTurned] = useState<View | null>(null);
  const shown = turned ?? view;
  const nameField = useId();
  const accent = useMemo(accentOf, []);
  const marks = useMemo(() => ({ faces: marked, selected: draft?.plane ?? null, hover, colour: accent }), [marked, draft, hover, accent]);
  const { model, unreadable } = useShopModel(failed ? null : source, NO_DECALS, marks);

  // Once the model is drawn: its flat faces for the list, and its size for the faces' millimetres.
  const drawn = useCallback((made: Stage3d) => {
    const size = made.modelBox();
    setBox((now) => (now !== null && size !== null && now.every((one, i) => one === size[i]) ? now : size));
    setFound((now) => (now.length > 0 ? now : made.flatFaces()));
  }, []);

  // A model to print is in millimetres, as printers take it.
  const scaleMm = printed || box === null ? 1 : mmPerUnit(box[0], num(base['width_mm']));
  const mmOf = (plane: FacePlane): { w: number; h: number } => {
    const span = spanOf(plane);
    return { w: Math.round(span.w * scaleMm * 10) / 10, h: Math.round(span.h * scaleMm * 10) / 10 };
  };
  const size = box === null ? 0 : Math.hypot(...box);
  const markedAs = (plane: FacePlane): MarkedFace | undefined => marked.find((one) => sameFace(one, plane, size || 1));
  const carrying = (code: string): DataRow | undefined => areas.find((area) => text(area['face']) === code);
  /** The piece whose size is nearest the face's, for a face marked the first time. */
  const nearestPiece = (plane: FacePlane): string => {
    const want = mmOf(plane);
    const scored = pieces.map((piece) => {
      const p = pieceSize(piece);
      return { id: text(piece['id']), off: Math.abs(p.width - want.w) + Math.abs(p.height - want.h) };
    });
    return scored.sort((a, b) => a.off - b.off)[0]?.id ?? '';
  };

  const open = (plane: FacePlane): void => {
    setError(null);
    const known = markedAs(plane);
    if (known !== undefined) setDraft({ plane: known, code: known.code, name: known.name, piece: known.piece ?? '', area: text(carrying(known.code)?.['id']) || NEW_AREA, relief: known.relief ?? START_RELIEF });
    else setDraft({ plane, code: null, name: '', piece: printed ? '' : nearestPiece(plane), area: NEW_AREA, relief: START_RELIEF });
    window.setTimeout(() => document.getElementById(nameField)?.focus(), 0);
  };
  const notFlat = (): void => {
    setDraft(null);
    setError(t('setup.faces.notFlat', 'This face isn’t flat, so it can’t carry words or a logo. Pick a flat face.'));
  };

  const spot = (event: PointerEvent<HTMLDivElement>): { x: number; y: number } | null => {
    const rect = host.current?.getBoundingClientRect();
    return rect === undefined || rect.width <= 0 || rect.height <= 0 ? null : { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
  };
  const down = (event: PointerEvent<HTMLDivElement>): void => gestures.current.down(event.pointerId, event.clientX, event.clientY, event.pointerType === 'touch', shown);
  const move = (event: PointerEvent<HTMLDivElement>): void => {
    const moved = gestures.current.move(event.pointerId, event.clientX, event.clientY, shown, false);
    if (moved.view !== undefined) {
      if (moved.capture === true) event.currentTarget.setPointerCapture?.(event.pointerId);
      setTurned(moved.view);
      return;
    }
    if (gestures.current.dragging || event.pointerType === 'touch') return;
    const at = spot(event);
    const picked = at === null ? null : (stage.current?.pickFace(at.x, at.y) ?? null);
    const next = picked?.flat === true ? picked.plane : null;
    setHover((now) => (now === null && next === null ? now : now !== null && next !== null && sameFace(now, next, size || 1) ? now : next));
  };
  const up = (event: PointerEvent<HTMLDivElement>): void => {
    const { tap } = gestures.current.up(event.pointerId);
    if (!tap) return;
    const at = spot(event);
    const picked = at === null ? null : (stage.current?.pickFace(at.x, at.y) ?? null);
    if (picked === null) return;
    if (picked.flat) open(picked.plane);
    else notFlat();
  };

  const saveFaces = (faces: readonly MarkedFace[]): Promise<unknown> => writeBase.update(base['id'] as string | number, { faces: facesValue(faces) });
  const failedWrite = useCallback((caught: unknown) => toast(refusal(t, asDataError(caught)).message, 'error'), [t, toast]);
  const save = async (): Promise<void> => {
    if (draft === null) return;
    const name = draft.name.trim();
    if (name === '') {
      setError(t('setup.faces.nameIt', 'Give the face a name the shopper will understand, like “Shop sign”.'));
      document.getElementById(nameField)?.focus();
      return;
    }
    const code = draft.code ?? faceCode(name, marked.map((one) => one.code));
    const plane = planeAlone(draft.plane);
    const face: MarkedFace = {
      ...plane,
      code,
      name,
      piece: draft.piece === '' ? null : draft.piece,
      size: mmOf(draft.plane),
      ...(printed ? { relief: draft.relief } : {}),
      ...(printed && fit !== null ? { preview: placePlane(fit, plane) } : {}),
    };
    const faces = draft.code === null ? [...marked, face] : marked.map((one) => (one.code === draft.code ? face : one));
    try {
      await saveFaces(faces);
      const piece = face.piece === null ? null : /^\d+$/.test(face.piece) ? Number(face.piece) : face.piece;
      if (printed) await saveAreasOn(face);
      else if (draft.area === NEW_AREA) {
        // A new area on the face, across most of it, named as the face is.
        const pieceRow = pieces.find((one) => text(one['id']) === face.piece);
        const surface = pieceRow === undefined ? { width: face.size.w, height: face.size.h } : pieceSize(pieceRow);
        await writeArea.create({
          app: text(base['app']) === '' ? null : text(base['app']),
          base_id: base['id'] as string | number,
          code: faceCode(name, areas.map((one) => text(one['code']))),
          name,
          face: code,
          piece_id: piece,
          shape: 'rect',
          ...boxValues({ x: surface.width * 0.08, y: surface.height * 0.1, w: surface.width * 0.84, h: surface.height * 0.8 }),
          takes: 'words',
          required: false,
          rules: JSON.stringify(startRules(kindOf(base), surface, offeredOf(base))),
          position: areas.length + 1,
        });
      } else await writeArea.update(draft.area, { face: code, piece_id: piece });
      setError(null);
      setDraft({ ...draft, code, name, plane: face });
      toast(t('setup.faces.marked', '“{name}” marked.', { name }));
    } catch (caught) {
      failedWrite(caught);
    }
  };
  /**
   * A printed face's areas: the one it carries takes its relief into its
   * rules (how the words are made, and the smallest letter the customer's
   * words are checked against); a face carrying none gets one across most of
   * it, words only, as the comp's keyring front.
   */
  const saveAreasOn = async (face: MarkedFace): Promise<void> => {
    const relief = face.relief ?? START_RELIEF;
    const reliefRules = { mode: relief.mode, depthMm: relief.depth, smallestLetterMm: relief.smallest };
    const on = areas.filter((one) => text(one['face']) === face.code);
    if (on.length > 0) {
      for (const area of on) await writeArea.update(area['id'] as string | number, { rules: JSON.stringify({ ...jsonOf(area['rules']), ...reliefRules }) });
      return;
    }
    const surface = { width: face.size.w, height: face.size.h };
    await writeArea.create({
      app: text(base['app']) === '' ? null : text(base['app']),
      base_id: base['id'] as string | number,
      code: faceCode(face.name, areas.map((one) => text(one['code']))),
      name: face.name,
      face: face.code,
      piece_id: null,
      shape: 'rect',
      ...boxValues({ x: surface.width * 0.08, y: surface.height * 0.1, w: surface.width * 0.84, h: surface.height * 0.8 }),
      takes: 'words',
      required: false,
      rules: JSON.stringify({ ...startRules('printed', surface, offeredOf(base)), ...reliefRules }),
      position: areas.length + 1,
    });
  };

  const unmark = async (): Promise<void> => {
    if (draft?.code === null || draft === null) return;
    const code = draft.code;
    try {
      await saveFaces(marked.filter((one) => one.code !== code));
      // The areas it carried stay, on the piece the face was.
      for (const area of areas.filter((one) => text(one['face']) === code)) await writeArea.update(area['id'] as string | number, { face: null });
      setDraft(null);
      toast(t('setup.faces.unmarked', 'Face unmarked.'), 'info');
    } catch (caught) {
      failedWrite(caught);
    }
  };

  // The list: the marked faces, then the model's other flat faces, largest first.
  const others = found.filter((plane) => markedAs(plane) === undefined);
  const rows: { plane: FacePlane; name: string; face: MarkedFace | undefined }[] = [
    ...marked.map((face) => ({ plane: face as FacePlane, name: face.name, face })),
    ...others.map((plane, index) => ({ plane, name: t('setup.faces.flatFace', 'Flat face {n}', { n: index + 1 }), face: undefined })),
  ];
  if (draft !== null && draft.code === null && !rows.some((row) => sameFace(row.plane, draft.plane, size || 1))) rows.push({ plane: draft.plane, name: t('setup.faces.picked', 'The face you picked'), face: undefined });

  const noModel = source === null;
  const needModel = printed ? t('setup.faces.needPrint', 'Upload the model to print to mark its faces.') : t('setup.faces.needModel', 'Upload the assembled model to mark its faces.');
  const depthLabel = draft?.relief.mode === 'cut' ? t('setup.faces.depthCut', 'Depth cut in') : t('setup.faces.raisedBy', 'Raised by');
  const relief = (change: (now: FaceRelief) => FaceRelief): void => {
    if (draft !== null) setDraft({ ...draft, relief: change(draft.relief) });
  };
  return (
    <Card
      title={
        <span className="flex items-center gap-2.5">
          <BoxSelect className="size-[17px] text-accent" aria-hidden="true" />
          {t('setup.faces.title', 'Mark faces')}
        </span>
      }
      description={printed ? t('setup.faces.subPrinted', 'Say how words sit on each flat face.') : t('setup.faces.sub', 'Click a flat face, then say which piece and area it carries.')}
      actions={<Figure>{t('setup.faces.count', '{n, plural, one {# marked} other {# marked}}', { n: marked.length })}</Figure>}
    >
      <div className="grid gap-[18px] md:grid-cols-2" data-part="customiser-mark-faces">
        <Stack gap="sm">
          <div
            ref={host}
            role="img"
            aria-label={t('setup.faces.alt', '{name}, with its marked faces', { name: text(base['name']) })}
            className="relative aspect-square cursor-pointer touch-none select-none overflow-hidden rounded-2xl border border-border bg-surface-3"
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={(event) => gestures.current.up(event.pointerId)}
            onPointerLeave={() => setHover(null)}
          >
            {noModel || failed || unreadable ? (
              <div className="absolute inset-0 grid place-items-center p-6 text-center">
                <span className="rounded-[7px] bg-surface px-2.5 py-1.5 font-mono text-[11.5px] text-fg-subtle">{noModel ? needModel : t('setup.faces.cannotDraw', 'This device can’t draw the model, so faces are picked from the list.')}</span>
              </div>
            ) : (
              <ModelView model={model} view={shown} className="absolute inset-0" stageRef={stage} onFail={() => setFailed(true)} onDrawn={drawn} />
            )}
          </div>
          <span className="text-[12px] text-fg-subtle">{t('setup.faces.hint', 'Click a flat face on the model, or pick one from the list.')}</span>
        </Stack>
        <Stack gap="md">
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {rows.map((row) => {
              const span = mmOf(row.plane);
              const Icon = span.w > span.h * 1.6 ? Wide : span.h > span.w * 1.6 ? Tall : Square;
              const on = draft !== null && sameFace(draft.plane, row.plane, size || 1);
              return (
                <li key={row.face?.code ?? `${row.plane.mesh}:${row.plane.point.join(',')}:${row.plane.normal.join(',')}`}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => open(row.plane)}
                    onMouseEnter={() => setHover(row.plane)}
                    onMouseLeave={() => setHover(null)}
                    className="flex min-h-11 w-full items-center gap-2.5 rounded-[11px] border-[1.5px] border-border-strong bg-surface px-3 py-2 text-start hover:border-accent aria-pressed:border-accent aria-pressed:bg-accent-soft"
                  >
                    <Icon className="size-[15px] shrink-0 text-fg-muted" aria-hidden="true" />
                    <span className="flex min-w-0 flex-1 flex-col gap-px">
                      <span className="text-[13px] font-bold">{row.name}</span>
                      <span className="font-mono text-[11px] text-fg-subtle">{t('setup.faces.meta', 'flat · {w} × {h} mm', { w: span.w, h: span.h })}</span>
                    </span>
                    {row.face === undefined ? (
                      <span className="whitespace-nowrap rounded-full bg-surface-3 px-2.5 py-0.5 text-[11px] font-extrabold text-fg-muted">{t('setup.faces.notMarked', 'Not marked')}</span>
                    ) : (
                      <span className="whitespace-nowrap rounded-full bg-pos-soft px-2.5 py-0.5 text-[11px] font-extrabold text-pos">{t('setup.faces.markedAs', 'Marked · {name}', { name: row.face.name })}</span>
                    )}
                  </button>
                </li>
              );
            })}
            {printed && curved !== null && curved >= CURVED_SHOWN ? (
              <li>
                <button type="button" aria-pressed={false} onClick={notFlat} className="flex min-h-11 w-full items-center gap-2.5 rounded-[11px] border-[1.5px] border-border-strong bg-surface px-3 py-2 text-start hover:border-accent">
                  <CircleDashed className="size-[15px] shrink-0 text-fg-muted" aria-hidden="true" />
                  <span className="flex min-w-0 flex-1 flex-col gap-px">
                    <span className="text-[13px] font-bold">{t('setup.faces.curvedName', 'The curved part')}</span>
                    <span className="font-mono text-[11px] text-fg-subtle">{t('setup.faces.curvedMeta', 'curved all round')}</span>
                  </span>
                  <span className="whitespace-nowrap rounded-full bg-surface-3 px-2.5 py-0.5 text-[11px] font-extrabold text-fg-subtle">{t('setup.faces.curved', 'Curved')}</span>
                </button>
              </li>
            ) : null}
          </ul>
          {error === null ? null : (
            <div role="alert" className="flex items-start gap-2 rounded-[11px] bg-danger-soft px-3 py-2.5">
              <CircleAlert className="mt-0.5 size-[15px] shrink-0 text-danger" aria-hidden="true" />
              <span className="text-[12.5px] font-bold leading-normal text-danger">{error}</span>
            </div>
          )}
          {draft === null ? null : (
            <div className="flex flex-col gap-3 rounded-[13px] border border-border-strong p-3">
              <Input id={nameField} label={t('setup.faces.name', 'Name it')} value={draft.name} maxLength={80} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
              {printed ? (
                <>
                  <div className="self-start">
                    <SegmentedControl
                      aria-label={t('setup.faces.how', 'How words sit on this face')}
                      value={draft.relief.mode}
                      onValueChange={(value) => relief((now) => ({ ...now, mode: value === 'cut' ? 'cut' : 'raised' }))}
                      options={[
                        { value: 'raised', label: t('setup.faces.raised', 'Raised') },
                        { value: 'cut', label: t('setup.faces.cut', 'Cut in') },
                      ]}
                    />
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Stepper t={t} label={depthLabel} value={t('setup.mm', '{n} mm', { n: mm(draft.relief.depth) })} down={() => relief((now) => ({ ...now, depth: Math.max(RELIEF_DEPTH.least, now.depth - RELIEF_DEPTH.step) }))} up={() => relief((now) => ({ ...now, depth: Math.min(RELIEF_DEPTH.most, now.depth + RELIEF_DEPTH.step) }))} />
                    <Stepper t={t} label={t('setup.faces.smallest', 'Smallest letter')} value={t('setup.mm', '{n} mm', { n: mm(draft.relief.smallest) })} down={() => relief((now) => ({ ...now, smallest: Math.max(RELIEF_LETTER.least, now.smallest - RELIEF_LETTER.step) }))} up={() => relief((now) => ({ ...now, smallest: Math.min(RELIEF_LETTER.most, now.smallest + RELIEF_LETTER.step) }))} />
                  </div>
                </>
              ) : (
              <div className="grid gap-2.5 sm:grid-cols-2">
                <Select label={t('setup.faces.piece', 'The piece it’s on')} value={draft.piece} onChange={(event) => setDraft({ ...draft, piece: event.target.value })} options={[...pieces.map((piece) => ({ value: text(piece['id']), label: pieceLabel(piece) })), ...(pieces.length === 0 ? [{ value: '', label: t('setup.faces.noPieces', 'No pieces yet') }] : [])]} />
                <Select
                  label={t('setup.faces.area', 'The area it carries')}
                  value={draft.area}
                  onChange={(event) => setDraft({ ...draft, area: event.target.value })}
                  options={[...areas.map((area) => ({ value: text(area['id']), label: text(area['name']) })), { value: NEW_AREA, label: t('setup.faces.newArea', 'A new area') }]}
                />
              </div>
              )}
              <Stack direction="row" gap="sm" wrap>
                <Button onClick={() => void save()}>{draft.code === null ? t('setup.faces.mark', 'Mark this face') : t('setup.faces.save', 'Save changes')}</Button>
                {draft.code === null ? null : (
                  <Button variant="secondary" onClick={() => void unmark()}>
                    {t('setup.faces.unmark', 'Unmark it')}
                  </Button>
                )}
              </Stack>
            </div>
          )}
          {noModel ? <Alert tone="info" title={needModel} /> : null}
        </Stack>
      </div>
    </Card>
  );
}

const NO_DECALS: readonly never[] = [];

/** A face's plane alone: a face marked before brings its name, its relief and its preview, which a save makes again. */
function planeAlone(face: FacePlane): FacePlane {
  return { mesh: face.mesh, ...(face.meshName === undefined ? {} : { meshName: face.meshName }), normal: face.normal, point: face.point, u: face.u, v: face.v, bounds: face.bounds };
}
