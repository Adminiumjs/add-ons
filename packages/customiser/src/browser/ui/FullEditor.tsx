/**
 * THE FULL EDITOR: a printed page the customer lays out themselves (Marlow
 * Press, the full editor; "Start from blank" and "Switch to the full
 * editor").
 *
 * The header: back, the design's name and the page's size, the side, Undo
 * and Redo, the zoom, "Save and come back" and "Use this design". The tools
 * down the side: "Add words", "Add an image", "Rectangle", "Ellipse", "Line",
 * and the guides. The card at its size with its trim, bleed and safe line.
 * The panel: the part selected (its position and size, where it aligns on the
 * page, its words, font, size, weight and alignment, its colour, its picture)
 * and the layers. On a phone the tools sit at the foot with "Properties",
 * which opens the panel as a sheet.
 *
 * What is made is data (`values.placed`), checked by the same rules as every
 * design: a picture is one of the design's two files (its logo and its
 * photo), so a page takes two at most. Every action has a keyboard path: the
 * card takes the arrow keys (Shift: five steps; Alt: resize), Delete and
 * Escape; each part is a button on the card and in the layers; every value
 * is a field.
 */
import { AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignStartHorizontal, AlignStartVertical, AlignCenter, AlignLeft, AlignRight, ArrowLeft, ChevronDown, ChevronUp, Circle, CircleAlert, Image as ImageIcon, ImageOff, Minus, Move, Redo2, Ruler, SlidersHorizontal, Square, Trash2, TriangleAlert, Type, Undo2, Upload as UploadIcon, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';

import type { DesignAnswer, DesignValues, PlacedKind, PlacedPart } from '../../rules/index.ts';
import { FILE_COLUMNS } from '../api.ts';
import { movedBox, nudgedBox, resizedBox, type FaceFacts } from '../../draw/boxes.ts';
import { pointOnFace, Scene, viewOfFace, type Face } from '../../draw/Scene.tsx';
import { offeredFonts, type Catalogue, type Palette } from '../catalogue.ts';
import { boxOfPlaced, drawnOfPlaced, newImage, newPart, paintOf, placedOn, PLAIN, SWATCHES, textHeight, WEIGHTS } from '../placed.ts';
import { useShared } from './context.tsx';
import { fileMeta, TransferBar } from './fieldKit.tsx';
import { browserMeasure } from './fonts.ts';
import { Dialog } from './Overlay.tsx';
import type { Pictures } from './pictures.ts';
import { CAP_WORDS, COLUMN_KINDS } from './pictures.ts';

const ZOOMS = [0.5, 0.75, 1, 1.5, 2, 3] as const;
/** The card's width on screen at 100 %, in pixels, on a wide screen. */
const PAGE_PX = 460;

export interface FullEditorProps {
  catalogue: Catalogue;
  values: DesignValues;
  palette: Palette | null;
  sides: number;
  /** The ready-made design it was made from ("Harbour, made your own"), or none for a blank page. */
  from: string | null;
  answer: DesignAnswer;
  pictures: Pictures;
  narrow: boolean;
  canUndo: boolean;
  canRedo: boolean;
  /** One change to the design; changes with the same `gesture` are one step of undo (a drag, typing in one field). */
  change: (next: DesignValues, gesture?: string) => void;
  endGesture: () => void;
  undo: () => void;
  redo: () => void;
  onBack: () => void;
  onSave: () => void;
  onUse: () => void;
  /** Tell the customer something short (a picture too many). */
  toast: (text: string, kind?: 'ok' | 'info' | 'warn') => void;
  busy: boolean;
  /** Shown after "Switch to the full editor": the moves are the customer's now. */
  banner: boolean;
}

type Drag = { id: string; mode: 'move' | 'resize'; from: { x: number; y: number }; box: { x: number; y: number; w: number; h: number }; moved: boolean };

export function FullEditor(props: FullEditorProps) {
  const { catalogue, values, palette, answer, pictures, narrow } = props;
  const { t } = useShared();
  const { base } = catalogue;
  const two = props.sides >= 2 && base.sides >= 2;
  const [side, setSide] = useState<'front' | 'back'>('front');
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [guides, setGuides] = useState(true);
  const [banner, setBanner] = useState(props.banner);
  const [sheet, setSheet] = useState(false);
  const replacing = useRef<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const drag = useRef<Drag | null>(null);
  const hint = useId();
  const measure = browserMeasure();
  const face: FaceFacts = { kind: 'page', width: base.width, height: base.height, bleed: base.bleed, safe: base.safe ?? 0, sides: two ? 2 : 1 };
  const shown = placedOn(values, side);
  const chosen = shown.find((one) => one.id === selected) ?? null;
  // The base's offered fonts: new words start in the first, and a words layer may pick among them (and keep the font it has).
  const offered = offeredFonts(catalogue);
  const fonts = offered.length > 0 ? offered.map((one) => ({ family: one.family, name: one.name })) : [{ family: 'Manrope', name: 'Manrope' }];

  const set = (next: PlacedPart[], gesture?: string): void => props.change({ ...values, placed: next }, gesture);
  const patch = (id: string, change: Partial<PlacedPart>, gesture?: string): void => set((values.placed ?? []).map((one) => (one.id === id ? { ...one, ...change } : one)), gesture);
  const remove = (id: string): void => {
    set((values.placed ?? []).filter((one) => one.id !== id));
    setSelected(null);
  };
  const names = { text: t('editor.full.partText', 'Text'), rect: t('editor.full.rect', 'Rectangle'), ellipse: t('editor.full.ellipse', 'Ellipse'), line: t('editor.full.line', 'Line') };
  const add = (kind: Exclude<PlacedKind, 'image'>): void => {
    const part = newPart(kind, values, side, base, fonts[0]!.family, names, t('editor.full.sample', 'Your words here'));
    set([...(values.placed ?? []), part]);
    setSelected(part.id);
  };
  /** The picture column a new image takes: the first the design does not use yet. */
  const freeColumn = (): string | null => FILE_COLUMNS.find((column) => !(values.placed ?? []).some((one) => one.kind === 'image' && one.file === column)) ?? null;
  const pickImage = (replace: string | null): void => {
    replacing.current = replace;
    const column = replace === null ? freeColumn() : ((values.placed ?? []).find((one) => one.id === replace)?.file ?? null);
    if (column === null) {
      props.toast(t('editor.full.twoPictures', 'A design takes two pictures at most: replace one, or remove it first.'), 'warn');
      return;
    }
    const input = file.current;
    if (input === null) return;
    input.dataset['column'] = column;
    input.accept = (COLUMN_KINDS[column] ?? []).map((kind) => (kind === 'jpeg' ? '.jpg,.jpeg,image/jpeg' : kind === 'svg' ? '.svg,image/svg+xml' : kind === 'pdf' ? '.pdf,application/pdf' : '.png,image/png')).join(',');
    input.click();
  };
  const sent = (column: string, picked: File): void => {
    const replace = replacing.current;
    void pictures.send(column, picked, COLUMN_KINDS[column] ?? []).then((taken) => {
      if (taken === null) return;
      if (replace !== null) {
        patch(replace, { file: column });
        return;
      }
      const part = newImage(values, side, base, column, picked.name.slice(0, 80) || t('editor.full.image', 'Image'), taken.px);
      set([...(values.placed ?? []), part]);
      setSelected(part.id);
    });
  };

  // Moving and sizing with the pointer: a press that does not go a hundredth of the card is a click.
  const view = viewOfFace({ kind: 'page', width: base.width, height: base.height, bleed: base.bleed, safe: base.safe ?? 0, corner: 0 });
  const onPointerDown = (event: PointerEvent<SVGSVGElement>): void => {
    const at = pointOnFace(event.currentTarget, event.clientX, event.clientY, view);
    if (at === null) return;
    const target = event.target as Element;
    const handle = target.closest('[data-handle]') !== null;
    const id = handle ? selected : target.closest('[data-part]')?.getAttribute('data-part');
    const part = shown.find((one) => one.id === id);
    if (part === undefined) {
      setSelected(null);
      return;
    }
    setSelected(part.id);
    drag.current = { id: part.id, mode: handle ? 'resize' : 'move', from: at, box: boxOfPlaced(part), moved: false };
  };
  const onPointerMove = (event: PointerEvent<SVGSVGElement>): void => {
    const now = drag.current;
    if (now === null) return;
    const at = pointOnFace(event.currentTarget, event.clientX, event.clientY, view);
    if (at === null) return;
    const [dx, dy] = [at.x - now.from.x, at.y - now.from.y];
    if (!now.moved && Math.hypot(dx, dy) < Math.min(base.width, base.height) / 100) return;
    if (!now.moved) event.currentTarget.setPointerCapture?.(event.pointerId);
    now.moved = true;
    const box = now.mode === 'move' ? movedBox(now.box, dx, dy, face) : resizedBox(now.box, dx, dy, face);
    patch(now.id, box, `drag:${now.id}`);
  };
  const onPointerUp = (): void => {
    drag.current = null;
    props.endGesture();
  };
  const onFaceKey = (event: KeyboardEvent<SVGSVGElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setSelected(null);
      return;
    }
    if (chosen === null) return;
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      remove(chosen.id);
      return;
    }
    if (event.key === 'Enter' && narrow) {
      event.preventDefault();
      setSheet(true);
      return;
    }
    const next = nudgedBox(boxOfPlaced(chosen), event.key, { shift: event.shiftKey, alt: event.altKey }, face);
    if (next === null) return;
    event.preventDefault();
    patch(chosen.id, chosen.kind === 'text' ? { x: next.x, y: next.y, w: next.w } : next, `nudge:${chosen.id}:${event.altKey ? 'size' : 'place'}`);
  };

  const sceneFace: Face = { kind: 'page', width: base.width, height: base.height, bleed: base.bleed, safe: base.safe ?? 0, corner: base.corner, paper: paintOf(palette, 'paper', 'paper') };
  const label = { image: t('editor.full.image', 'Image') };
  const zoomAt = Math.max(0, ZOOMS.indexOf(zoom as (typeof ZOOMS)[number]));
  const title = props.from === null ? t('editor.full.blank', 'Start from blank') : t('editor.full.madeYours', '{design}, made your own', { design: props.from });
  const size = base.safe === null ? t('editor.full.sizeNoSafe', '{w} × {h} mm · bleed {bleed} mm', { w: base.width, h: base.height, bleed: base.bleed }) : t('editor.full.size', '{w} × {h} mm · bleed {bleed} mm · safe line {safe} mm', { w: base.width, h: base.height, bleed: base.bleed, safe: base.safe });
  const tools: readonly { key: PlacedKind; icon: ReactNode; label: string }[] = [
    { key: 'text', icon: <Type aria-hidden="true" />, label: t('editor.full.addWords', 'Add words') },
    { key: 'image', icon: <ImageIcon aria-hidden="true" />, label: t('editor.full.addImage', 'Add an image') },
    { key: 'rect', icon: <Square aria-hidden="true" />, label: t('editor.full.rect', 'Rectangle') },
    { key: 'ellipse', icon: <Circle aria-hidden="true" />, label: t('editor.full.ellipse', 'Ellipse') },
    { key: 'line', icon: <Minus aria-hidden="true" />, label: t('editor.full.line', 'Line') },
  ];
  const tool = (one: (typeof tools)[number]): void => (one.key === 'image' ? pickImage(null) : add(one.key));
  const guidesButton = (
    <button type="button" className={guides ? 'cz-ed-tool cz-on' : 'cz-ed-tool'} aria-label={t('editor.stage.guides', 'Guides')} title={t('editor.stage.guides', 'Guides')} aria-pressed={guides} onClick={() => setGuides(!guides)}>
      <Ruler aria-hidden="true" />
    </button>
  );
  const inspector = <Inspector {...props} part={chosen} shown={shown} fonts={fonts} onSelect={setSelected} onRemove={remove} patch={patch} onPick={(id) => pickImage(id)} answer={answer} measure={measure} />;

  return (
    <section
      className="cz-ed"
      data-screen="full"
      onKeyDown={(event) => {
        if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
        const key = event.key.toLowerCase();
        if (key === 'z' && !event.shiftKey) {
          event.preventDefault();
          props.undo();
        } else if ((key === 'z' && event.shiftKey) || key === 'y') {
          event.preventDefault();
          props.redo();
        }
      }}
    >
      <header className="cz-ed-head">
        <button type="button" className="cz-icon-button" aria-label={props.from === null ? t('editor.full.back', 'Back') : t('editor.full.backToForm', 'Back to the form')} title={props.from === null ? t('editor.full.back', 'Back') : t('editor.full.backToForm', 'Back to the form')} onClick={props.onBack}>
          <ArrowLeft aria-hidden="true" className="cz-flip" />
        </button>
        <div className="cz-ed-name">
          <h1 className="cz-ed-title">{title}</h1>
          <span className="cz-mono cz-ed-size">{size}</span>
        </div>
        {two ? (
          <div role="radiogroup" aria-label={t('editor.stage.side', 'Side')} className="cz-seg">
            {(['front', 'back'] as const).map((one) => (
              <button
                key={one}
                type="button"
                role="radio"
                aria-checked={side === one}
                className={side === one ? 'cz-on' : ''}
                onClick={() => {
                  setSide(one);
                  setSelected(null);
                }}
              >
                {one === 'front' ? t('editor.side.front', 'Front') : t('editor.side.back', 'Back')}
              </button>
            ))}
          </div>
        ) : null}
        <span className="cz-undo">
          <button type="button" className="cz-icon-button" aria-label={t('editor.undo', 'Undo')} title={t('editor.undo', 'Undo')} aria-disabled={!props.canUndo} onClick={props.undo}>
            <Undo2 aria-hidden="true" className="cz-flip" />
          </button>
          <button type="button" className="cz-icon-button" aria-label={t('editor.redo', 'Redo')} title={t('editor.redo', 'Redo')} aria-disabled={!props.canRedo} onClick={props.redo}>
            <Redo2 aria-hidden="true" className="cz-flip" />
          </button>
        </span>
        {narrow ? null : (
          <div role="group" aria-label={t('editor.full.zoom', 'Zoom')} className="cz-ed-zoom">
            <button type="button" aria-label={t('editor.full.zoomOut', 'Zoom out')} aria-disabled={zoomAt === 0} onClick={() => setZoom(ZOOMS[Math.max(0, zoomAt - 1)]!)}>
              <ZoomOut aria-hidden="true" />
            </button>
            <span className="cz-mono">{`${String(Math.round(zoom * 100))}%`}</span>
            <button type="button" aria-label={t('editor.full.zoomIn', 'Zoom in')} aria-disabled={zoomAt === ZOOMS.length - 1} onClick={() => setZoom(ZOOMS[Math.min(ZOOMS.length - 1, zoomAt + 1)]!)}>
              <ZoomIn aria-hidden="true" />
            </button>
          </div>
        )}
        <div className="cz-ed-actions">
          <button type="button" className="cz-button cz-button-small" disabled={props.busy} onClick={props.onSave}>
            {t('editor.save', 'Save and come back')}
          </button>
          <button type="button" className="cz-primary cz-button-small" aria-busy={props.busy} onClick={props.onUse}>
            {t('editor.full.use', 'Use this design')}
          </button>
        </div>
      </header>
      {banner ? (
        <div role="status" className="cz-ed-banner">
          <Move aria-hidden="true" />
          <span className="cz-grow">{t('editor.full.banner', 'You can move anything now; your words stay.')}</span>
          <button type="button" className="cz-icon-button cz-ed-banner-close" aria-label={t('editor.full.hideNote', 'Hide this note')} onClick={() => setBanner(false)}>
            <X aria-hidden="true" />
          </button>
        </div>
      ) : null}
      <input
        ref={file}
        type="file"
        className="cz-hidden-file"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const picked = event.target.files?.[0];
          const column = event.target.dataset['column'];
          event.target.value = '';
          if (picked !== undefined && column !== undefined) sent(column, picked);
        }}
      />
      <div className="cz-ed-body">
        {narrow ? null : (
          <nav aria-label={t('editor.full.tools', 'Tools')} className="cz-ed-rail">
            {tools.map((one) => (
              <button key={one.key} type="button" className="cz-ed-tool" aria-label={one.label} title={one.label} onClick={() => tool(one)}>
                {one.icon}
              </button>
            ))}
            <span className="cz-ed-rule" />
            {guidesButton}
          </nav>
        )}
        <div className="cz-ed-canvas">
          <div className="cz-ed-card">
            {FILE_COLUMNS.map((column) => (pictures.transfers[column] === undefined ? null : <TransferBar key={column} transfer={pictures.transfers[column]!} label={t('editor.full.sending', 'Uploading your image')} />))}
            {FILE_COLUMNS.map((column) => {
              const problem = pictures.problems[column];
              return problem === undefined ? null : (
                <p key={column} role="alert" className="cz-error">
                  <CircleAlert aria-hidden="true" />
                  <span>
                    {problem.text}
                    {problem.detail === undefined ? null : (
                      <span lang="en" className="cz-detail">
                        {problem.detail}
                      </span>
                    )}
                  </span>
                </p>
              );
            })}
            <Scene
              face={sceneFace}
              drawn={drawnOfPlaced(shown, palette, pictures.pictures, label)}
              guides={guides}
              selected={chosen?.id ?? null}
              label={t('editor.full.card', 'Your design, {side}', { side: side === 'front' ? t('editor.side.front', 'Front') : t('editor.side.back', 'Back') })}
              {...(narrow ? {} : { width: Math.round(PAGE_PX * zoom) })}
              interactive={{ describedBy: hint, onPointerDown, onPointerMove, onPointerUp, onKeyDown: onFaceKey, onSelect: setSelected, selectLabel: (id) => t('editor.full.select', 'Select {name}', { name: shown.find((one) => one.id === id)?.name ?? '' }) }}
            />
            {guides ? (
              <div className="cz-legend">
                <span className="cz-legend-item">
                  <span className="cz-legend-trim" />
                  {t('editor.stage.trim', 'Trim')}
                </span>
                <span className="cz-legend-item">
                  <span className="cz-legend-bleed" />
                  {t('editor.stage.bleed', 'Bleed')} <span className="cz-mono">{`${String(base.bleed)} mm`}</span>
                </span>
                {base.safe === null ? null : (
                  <span className="cz-legend-item">
                    <span className="cz-legend-safe" />
                    {t('editor.stage.safe', 'Safe line')} <span className="cz-mono">{`${String(base.safe)} mm`}</span>
                  </span>
                )}
              </div>
            ) : null}
            <p id={hint} className="cz-small cz-ed-note">
              {t('editor.full.note', 'Drag to move, or use the arrow keys. Anything outside the safe line may be trimmed off.')}
            </p>
          </div>
        </div>
        {narrow ? null : (
          <aside aria-label={t('editor.full.properties', 'Properties')} className="cz-ed-panel">
            {inspector}
          </aside>
        )}
      </div>
      {narrow ? (
        <nav aria-label={t('editor.full.tools', 'Tools')} className="cz-ed-foot">
          {tools.map((one) => (
            <button key={one.key} type="button" className="cz-ed-tool" aria-label={one.label} title={one.label} onClick={() => tool(one)}>
              {one.icon}
            </button>
          ))}
          {guidesButton}
          <button type="button" className="cz-button cz-button-small cz-push" onClick={() => setSheet(true)}>
            <SlidersHorizontal aria-hidden="true" />
            {t('editor.full.properties', 'Properties')}
          </button>
        </nav>
      ) : null}
      {narrow && sheet ? (
        <Dialog labelledBy="cz-ed-sheet-title" onClose={() => setSheet(false)} className="cz-oc cz-oc-foot cz-ed-sheet" scrimClass="cz-scrim cz-scrim-sheet">
          <div className="cz-oc-head">
            <h2 id="cz-ed-sheet-title" className="cz-oc-title">
              {t('editor.full.properties', 'Properties')}
            </h2>
            <button type="button" className="cz-icon-button cz-push" aria-label={t('editor.close', 'Close')} onClick={() => setSheet(false)}>
              <X aria-hidden="true" />
            </button>
          </div>
          <div className="cz-oc-body">{inspector}</div>
        </Dialog>
      ) : null}
    </section>
  );
}

interface InspectorProps extends FullEditorProps {
  part: PlacedPart | null;
  shown: readonly PlacedPart[];
  fonts: readonly { family: string; name: string }[];
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  patch: (id: string, change: Partial<PlacedPart>, gesture?: string) => void;
  onPick: (id: string) => void;
  measure: ReturnType<typeof browserMeasure>;
}

/**
 * The fonts a words layer may pick: the base's offered ones, and the font the
 * layer already has when the base no longer offers it (a design made before
 * the shop narrowed its fonts keeps its words as they are, until changed).
 */
export function fontsFor(part: PlacedPart, offered: readonly { family: string; name: string }[], catalogue: Catalogue): { family: string; name: string }[] {
  const own = part.font;
  if (own === undefined || own === '' || offered.some((one) => one.family === own)) return [...offered];
  const known = catalogue.fonts.find((one) => one.family === own);
  return [...offered, { family: own, name: known?.name ?? own }];
}

/** The panel: the part selected, then the layers. */
function Inspector(props: InspectorProps) {
  const { part, shown, palette, catalogue, patch } = props;
  const { t } = useShared();
  const base = catalogue.base;
  const round = (value: number): number => Math.round(value * 10) / 10 + 0;
  const roleName: Record<string, string> = { paper: t('editor.full.paper', 'Paper'), ink: t('editor.full.ink', 'Ink'), accent: t('editor.full.accent', 'Accent') };
  const colours = [...Object.keys(PLAIN).map((role) => ({ value: role, hex: paintOf(palette, role, role), name: `${roleName[role] ?? role} (${paintOf(palette, role, role)})` })), ...SWATCHES.map((hex) => ({ value: hex, hex, name: hex }))];
  const layers = [...shown].reverse();
  const box = part === null ? null : boxOfPlaced(part);
  // Words past the safe line: measured with the font, as the comp warns in the panel.
  const pastSafe = (() => {
    if (part === null || part.kind !== 'text' || props.measure === undefined || base.safe === null || box === null) return false;
    const wide = Math.max(0, ...(part.text ?? '').split(/\r?\n/).map((line) => props.measure!(line, part.font ?? 'Manrope', (part.size ?? 9) * (25.4 / 72), part.weight ?? 400)));
    const x0 = part.align === 'center' ? box.x + (box.w - wide) / 2 : part.align === 'end' ? box.x + box.w - wide : box.x;
    return x0 < base.safe - 0.01 || x0 + wide > base.width - base.safe + 0.01 || box.y < base.safe - 0.01 || box.y + box.h > base.height - base.safe + 0.01;
  })();
  const blurry = part === null ? undefined : props.answer.advice.find((one) => one.part === part.id && one.kind === 'blurry');
  const align = (how: 'left' | 'centre' | 'right' | 'top' | 'middle' | 'bottom'): void => {
    if (part === null || box === null) return;
    const at: Partial<PlacedPart> = how === 'left' ? { x: 0 } : how === 'centre' ? { x: round((base.width - box.w) / 2) } : how === 'right' ? { x: round(base.width - box.w) } : how === 'top' ? { y: 0 } : how === 'middle' ? { y: round((base.height - box.h) / 2) } : { y: round(base.height - box.h) };
    patch(part.id, at);
  };
  const number = (key: 'x' | 'y' | 'w' | 'h', short: string, label: string) => (
    <label key={key} className="cz-ed-geom">
      <span className="cz-mono cz-ed-geom-key">{short}</span>
      <input
        type="number"
        step={0.5}
        className="cz-mono"
        value={String(key === 'h' && box !== null ? box.h : (part?.[key] ?? 0))}
        aria-label={label}
        onChange={(event) => {
          const value = parseFloat(event.target.value);
          if (part !== null && !Number.isNaN(value)) patch(part.id, { [key]: round(value) }, `${key}:${part.id}`);
        }}
        onBlur={props.endGesture}
      />
    </label>
  );
  const held = part?.kind === 'image' && part.file !== undefined ? props.pictures.pictures[part.file] : undefined;
  return (
    <div className="cz-ed-inspector">
      {part === null ? (
        <p className="cz-small">{t('editor.full.nothing', 'Nothing selected. Tap something on the card, or add words, an image or a shape from the tools.')}</p>
      ) : (
        <>
          <div className="cz-ed-selected">
            <span className="cz-strong cz-ellipsis cz-grow">{part.name ?? part.kind}</span>
            <button type="button" className="cz-icon-button" aria-label={t('editor.full.delete', 'Delete')} title={t('editor.full.delete', 'Delete')} onClick={() => props.onRemove(part.id)}>
              <Trash2 aria-hidden="true" />
            </button>
          </div>
          <div className="cz-ed-group">
            <span className="cz-ed-kicker">
              {t('editor.full.position', 'Position and size')} <span className="cz-mono">mm</span>
            </span>
            <div className="cz-ed-grid">
              {number('x', 'X', t('editor.full.across', 'Across in millimetres'))}
              {number('y', 'Y', t('editor.full.down', 'Down in millimetres'))}
              {number('w', 'W', t('editor.full.width', 'Width in millimetres'))}
              {part.kind === 'text' ? null : number('h', 'H', t('editor.full.height', 'Height in millimetres'))}
            </div>
          </div>
          <div className="cz-ed-group">
            <span className="cz-ed-kicker">{t('editor.full.alignPage', 'Align to the page')}</span>
            <div role="group" aria-label={t('editor.full.alignPage', 'Align to the page')} className="cz-ed-aligns">
              {(
                [
                  ['left', AlignStartVertical, t('editor.full.alignLeft', 'Align to the left edge')],
                  ['centre', AlignCenterVertical, t('editor.full.alignCentre', 'Centre across')],
                  ['right', AlignEndVertical, t('editor.full.alignRight', 'Align to the right edge')],
                  ['top', AlignStartHorizontal, t('editor.full.alignTop', 'Align to the top')],
                  ['middle', AlignCenterHorizontal, t('editor.full.alignMiddle', 'Centre down')],
                  ['bottom', AlignEndHorizontal, t('editor.full.alignBottom', 'Align to the bottom')],
                ] as const
              ).map(([how, Icon, label]) => (
                <button key={how} type="button" className="cz-ed-tool cz-ed-tool-small" aria-label={label} title={label} onClick={() => align(how)}>
                  <Icon aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
          {part.kind === 'text' ? (
            <div className="cz-ed-group">
              <label className="cz-ed-field">
                <span className="cz-ed-kicker">{t('editor.full.words', 'Words')}</span>
                <textarea className="cz-input cz-ed-words" rows={2} value={part.text ?? ''} onChange={(event) => patch(part.id, { text: event.target.value, h: textHeight(part.size ?? 9, event.target.value.split(/\r?\n/).length) }, `text:${part.id}`)} onBlur={props.endGesture} />
              </label>
              <div className="cz-ed-pair">
                <label className="cz-ed-field">
                  <span className="cz-tool-label">{t('editor.fields.font', 'Font')}</span>
                  <select className="cz-select" value={part.font ?? ''} onChange={(event) => patch(part.id, { font: event.target.value })}>
                    {fontsFor(part, props.fonts, catalogue).map((one) => (
                      <option key={one.family} value={one.family}>
                        {one.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="cz-ed-field">
                  <span className="cz-tool-label">{t('editor.fields.size', 'Size')}</span>
                  <span className="cz-ed-unit">
                    <input
                      type="number"
                      step={0.5}
                      min={4}
                      max={200}
                      aria-label={t('editor.full.sizePt', 'Size in points')}
                      className="cz-mono"
                      value={String(part.size ?? 9)}
                      onChange={(event) => {
                        const value = parseFloat(event.target.value);
                        if (value >= 4 && value <= 200) patch(part.id, { size: value, h: textHeight(value, (part.text ?? '').split(/\r?\n/).length) }, `size:${part.id}`);
                      }}
                      onBlur={props.endGesture}
                    />
                    <span className="cz-mono">pt</span>
                  </span>
                </label>
              </div>
              <div className="cz-ed-pair cz-ed-pair-end">
                <label className="cz-ed-field">
                  <span className="cz-tool-label">{t('editor.full.weight', 'Weight')}</span>
                  <select className="cz-select" value={String(part.weight ?? 400)} onChange={(event) => patch(part.id, { weight: Number(event.target.value) })}>
                    {WEIGHTS.map((one) => (
                      <option key={one} value={String(one)}>
                        {one === 400 ? t('editor.full.regular', 'Regular') : one === 500 ? t('editor.full.medium', 'Medium') : one === 600 ? t('editor.full.semibold', 'Semibold') : one === 700 ? t('editor.full.bold', 'Bold') : t('editor.full.extrabold', 'Extrabold')}
                      </option>
                    ))}
                  </select>
                </label>
                <div role="radiogroup" aria-label={t('editor.full.alignment', 'Alignment')} className="cz-ed-aligns">
                  {(
                    [
                      ['start', AlignLeft, t('editor.full.start', 'Start')],
                      ['center', AlignCenter, t('editor.full.centre', 'Centre')],
                      ['end', AlignRight, t('editor.full.end', 'End')],
                    ] as const
                  ).map(([value, Icon, label]) => (
                    <button key={value} type="button" role="radio" aria-checked={(part.align ?? 'start') === value} className={(part.align ?? 'start') === value ? 'cz-ed-tool cz-ed-tool-small cz-on' : 'cz-ed-tool cz-ed-tool-small'} aria-label={label} title={label} onClick={() => patch(part.id, { align: value })}>
                      <Icon aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </div>
              {pastSafe ? (
                <p role="status" className="cz-advice">
                  <TriangleAlert aria-hidden="true" />
                  {t('editor.full.safe', 'This runs past the safe line. Make it smaller or move it in.')}
                </p>
              ) : null}
            </div>
          ) : null}
          {part.kind === 'image' ? (
            <div className="cz-ed-group">
              {held === undefined ? null : (
                <div className="cz-file cz-file-print">
                  <span className="cz-thumb">{held.url === undefined ? <span className="cz-mono cz-thumb-kind">{held.kind.toUpperCase()}</span> : <img src={held.url} alt="" className="cz-thumb-img" />}</span>
                  <span className="cz-file-text">
                    <span className="cz-mono cz-strong cz-ellipsis">{held.name === '' ? t('editor.fields.kept', 'Kept with your design') : held.name}</span>
                    <span className="cz-mono cz-small">{fileMeta(held, true)}</span>
                  </span>
                </div>
              )}
              <div role="radiogroup" aria-label={t('editor.full.fitAria', 'How it sits in its box')} className="cz-seg cz-seg-start">
                {(['inside', 'fill'] as const).map((fit) => (
                  <button key={fit} type="button" role="radio" aria-checked={(part.fit ?? 'inside') === fit} className={(part.fit ?? 'inside') === fit ? 'cz-on' : ''} onClick={() => patch(part.id, { fit })}>
                    {fit === 'inside' ? t('editor.logo.fitInside', 'Fit inside') : t('editor.logo.fill', 'Fill')}
                  </button>
                ))}
              </div>
              {blurry === undefined || blurry.kind !== 'blurry' ? null : (
                <p role="status" className="cz-advice">
                  <ImageOff aria-hidden="true" />
                  {t('editor.full.blurry', 'This picture may print blurry at this size — {dpi} dpi, we need {needs}. A bigger file will be sharper.', { dpi: blurry.dpi, needs: blurry.needs })}
                </p>
              )}
              <button type="button" className="cz-button cz-button-small cz-seg-start" onClick={() => props.onPick(part.id)}>
                <UploadIcon aria-hidden="true" />
                {held === undefined ? t('editor.full.uploadImage', 'Upload an image') : t('editor.full.replaceImage', 'Replace the image')}
              </button>
              <span className="cz-mono cz-hint">{`${(COLUMN_KINDS[part.file ?? 'logo_file'] ?? []).map((one) => one.toUpperCase()).join(' · ')} · ${CAP_WORDS}`}</span>
            </div>
          ) : null}
          {part.kind === 'image' ? null : (
          <div className="cz-ed-group">
            <span id="cz-ed-colour" className="cz-ed-kicker">
              {part.kind === 'text' ? t('editor.fields.colour', 'Colour') : t('editor.full.fill', 'Fill')}
            </span>
              <div role="radiogroup" aria-labelledby="cz-ed-colour" className="cz-ed-swatches">
                {colours.map((one) => {
                  const on = (part.colour ?? (part.kind === 'text' || part.kind === 'line' ? 'ink' : 'accent')) === one.value;
                  return (
                    <button key={one.value} type="button" role="radio" aria-checked={on} aria-label={one.name} title={one.name} className={on ? 'cz-swatch-button cz-on' : 'cz-swatch-button'} onClick={() => patch(part.id, { colour: one.value })}>
                      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
                        <rect x="1" y="1" width="20" height="20" rx="5" fill={one.hex} stroke="rgba(0,0,0,.15)" />
                      </svg>
                    </button>
                  );
                })}
              </div>
          </div>
          )}
        </>
      )}
      <div className="cz-ed-group">
        <span className="cz-ed-kicker">{t('editor.full.layers', 'Layers')}</span>
        {layers.length === 0 ? (
          <p className="cz-small">{t('editor.full.noLayers', 'Nothing on this side yet.')}</p>
        ) : (
          <ul className="cz-ed-layers">
            {layers.map((one) => {
              const all = props.values.placed ?? [];
              const at = all.indexOf(one);
              const move = (by: 1 | -1): void => {
                // Forward is later in the list, drawn over what is before it; only parts on this side swap.
                const sameSide = all.map((item, index) => ({ item, index })).filter(({ item }) => item.side === one.side);
                const here = sameSide.findIndex(({ index }) => index === at);
                const other = sameSide[here + by];
                if (other === undefined) return;
                const next = [...all];
                [next[at], next[other.index]] = [next[other.index]!, next[at]!];
                props.change({ ...props.values, placed: next });
              };
              const Icon = one.kind === 'text' ? Type : one.kind === 'image' ? ImageIcon : one.kind === 'ellipse' ? Circle : one.kind === 'line' ? Minus : Square;
              const shownName = one.kind === 'text' ? `${one.name ?? ''} — ${(one.text ?? '').split(/\r?\n/)[0] ?? ''}` : (one.name ?? one.kind);
              return (
                <li key={one.id} className={part?.id === one.id ? 'cz-ed-layer cz-on' : 'cz-ed-layer'}>
                  <Icon aria-hidden="true" />
                  <button type="button" className="cz-ed-layer-name" aria-pressed={part?.id === one.id} onClick={() => props.onSelect(one.id)}>
                    {shownName}
                  </button>
                  <button type="button" className="cz-icon-button cz-icon-small" aria-label={t('editor.full.forward', 'Bring {name} forward', { name: one.name ?? one.kind })} onClick={() => move(1)}>
                    <ChevronUp aria-hidden="true" />
                  </button>
                  <button type="button" className="cz-icon-button cz-icon-small" aria-label={t('editor.full.backward', 'Send {name} back', { name: one.name ?? one.kind })} onClick={() => move(-1)}>
                    <ChevronDown aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
