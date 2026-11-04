/**
 * THE DESIGN EDITOR: one ready-made design, its parts placed on the base and
 * each part's rules, kept as a draft until "Save the design".
 *
 * One editor, drawn as each comp draws its own:
 * - a page (Marlow Press, MC-E2): the header with the side, Undo and Redo,
 *   the zoom, "Preview as a customer" and "Save the design"; the tools down
 *   the side; the card at its size with its guides; the panel — the design
 *   (name, shown, its palettes, its layouts) or the part selected — and the
 *   layers;
 * - a piece (Birch Row, BC-D4): the design's name and "Add text", "Add a logo
 *   box", "Add a motif", "Add a shape"; the piece; the parts; the selected
 *   part's rules.
 *
 * Every action has a keyboard path: the face takes the arrow keys (Alt to
 * resize, Shift for five steps), Delete and Escape; Ctrl or Cmd + Z undoes
 * and Ctrl or Cmd + Shift + Z (or Y) redoes; each part is a button on the
 * face, in the parts or the layers, and every rule is a field.
 */
import { useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';

import { asDataError, Button, Dialog, DialogBody, DialogFooter, DialogHeader, Figure, IconButton, Input, lucideByName, SegmentedControl, Stack, ToggleChip, useBlocker, type AddOnTranslate, type DataRow } from '../shared/host.ts';
import { refusal } from '../shared/refusal.ts';
import { useToast } from '../shared/toast.ts';
import { Legend } from '../setup/BaseStep.tsx';
import type { SetupData } from '../setup/data.ts';
import { guidesOf, kindOf, mm, num, offeredOf, text } from '../setup/facts.ts';
import { drawPart, type Drawn, type Look } from '../../draw/parts.ts';
import { pointOnFace, Scene, viewOfFace, type Face } from '../../draw/Scene.tsx';
import type { DesignRows } from './data.ts';
import { addPart, changesOf, commit, draftOf, endGesture, hasChanges, historyOf, movedBox, nudgedBox, partsOn, redo, removePart, resizedBox, undo, type DesignDraft, type FaceFacts, type History, type PartDraft, type Role, type Side, type Tool } from './draft.ts';
import { PagePanel } from './PagePanel.tsx';
import { PiecePanel } from './PiecePanel.tsx';
import { CustomerPreview, previewEditor } from './preview.tsx';
import { usePreviewPicture } from './picture.ts';
import { useSaveDesign } from './save.ts';
import { motifName, partWords } from './words.ts';

const Back = lucideByName('arrow-left');
const Undo = lucideByName('undo-2');
const Redo = lucideByName('redo-2');
const ZoomIn = lucideByName('zoom-in');
const ZoomOut = lucideByName('zoom-out');
const Eye = lucideByName('eye');
const TypeIcon = lucideByName('type');
const ImageIcon = lucideByName('image');
const ImagePlus = lucideByName('image-plus');
const SquareIcon = lucideByName('square');
const Circle = lucideByName('circle');
const MinusIcon = lucideByName('minus');
const Sprout = lucideByName('sprout');

const ZOOMS = [0.5, 0.75, 1, 1.5, 2, 3] as const;
/** The card's width on screen at 100 %, in pixels; a piece is drawn to the panel's width. */
const PAGE_WIDTH = 420;

export interface EditorProps {
  t: AddOnTranslate;
  base: DataRow;
  data: SetupData;
  design: DataRow;
  rows: DesignRows;
  /** The reader may look, not change: every control that writes is switched off. */
  readOnly: boolean;
  /** A page's editor stands on its own screen: back to the designs. */
  onBack?: () => void;
}

/** The face the base offers, as the editor draws on it. */
export function faceOf(base: DataRow, settings: DataRow | null): FaceFacts & { corner: number } {
  const guides = guidesOf(base, { bleed: num(settings?.['default_bleed_mm']) ?? 3, safe: num(settings?.['default_safe_mm']) ?? 4 });
  const page = kindOf(base) === 'page';
  return { kind: page ? 'page' : 'piece', width: guides.width, height: guides.height, bleed: page ? guides.bleed : 0, safe: page ? guides.safe : 0, sides: page ? guides.sides : 1, corner: guides.corner };
}

/** The colours a design is drawn in: its palette's roles on a page, the base's finishes on a piece. */
export function lookOf(face: FaceFacts, draft: DesignDraft, paletteKey: string | null, finishes: readonly DataRow[]): Look {
  const palette = draft.palettes.find((one) => one.key === paletteKey) ?? draft.palettes[0];
  return { page: face.kind === 'page', roles: palette === undefined ? {} : { ...palette.colours }, finishes: Object.fromEntries(finishes.map((row) => [text(row['code']), text(row['hex'])])) };
}

/** A draft's parts drawn, for a thumbnail or the editor. */
export function drawnOf(t: AddOnTranslate, parts: readonly PartDraft[], look: Look): Drawn[] {
  const labels = { logo: look.page ? t('designs.slot.logo', 'Customer’s logo') : t('designs.slot.logoPiece', 'Shopper’s logo'), photo: t('designs.slot.photo', 'Customer’s photo'), choice: (code: string) => motifName(t, code) };
  return parts.flatMap((part) => {
    const drawn = drawPart(part, look, labels);
    return drawn === null ? [] : [drawn];
  });
}

type Drag = { mode: 'move' | 'resize'; key: string; from: { x: number; y: number }; box: { x: number; y: number; w: number; h: number }; moved: boolean };

export function Editor({ t, base, data, design, rows, readOnly, onBack }: EditorProps): ReactNode {
  const face = faceOf(base, data.settings);
  const page = face.kind === 'page';
  const [before, setBefore] = useState<DesignDraft>(() => draftOf(design, rows.parts, rows.palettes, rows.colours));
  const [history, setHistory] = useState<History>(() => historyOf(before));
  const draft = history.present;
  const [side, setSide] = useState<Side>('front');
  const [layout, setLayout] = useState<string | null>(draft.layouts[0]?.key ?? null);
  const [paletteKey, setPaletteKey] = useState<string | null>(draft.palettes[0]?.key ?? null);
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [guides, setGuides] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const drag = useRef<Drag | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const hint = useId();
  const toast = useToast();
  const save = useSaveDesign();
  const makePicture = usePreviewPicture();
  const app = text(base['app']) === '' ? null : text(base['app']);
  const roleNames: Record<Role, string> = { paper: t('designs.role.paper', 'Paper'), ink: t('designs.role.ink', 'Ink'), accent: t('designs.role.accent', 'Accent') };
  const dirty = !readOnly && hasChanges(changesOf(before, draft, app, roleNames));
  const blocker = useBlocker({ shouldBlockFn: () => dirty, enableBeforeUnload: () => dirty, withResolver: true });

  const shownLayout = draft.layouts.some((one) => one.key === layout) ? layout : (draft.layouts[0]?.key ?? null);
  const visible = partsOn(draft, side, shownLayout);
  const chosen = visible.find((part) => part.key === selected) ?? null;
  const look = lookOf(face, draft, paletteKey, data.finishes);
  const drawn = drawnOf(t, visible, look);
  const offered = offeredOf(base);
  const fonts = offered.fonts.length > 0 ? offered.fonts : data.fonts.map((row) => text(row['family']));
  const logoFeature = data.features.find((row) => text(row['code']) === 'logo');

  const change = (next: (draft: DesignDraft) => DesignDraft, token?: string): void => {
    if (readOnly) return;
    setHistory((now) => commit(now, next(now.present), token));
  };
  const add = (tool: Tool): void => {
    if (readOnly) return;
    const words = partWords(t, tool, page);
    const result = addPart(draft, tool, { face, side, layout: shownLayout, fonts, finishes: offered.finishes, logoFeature: logoFeature === undefined ? null : (logoFeature['id'] as string | number), name: words.name, sample: words.sample, shapeSays: words.says });
    setHistory(commit(history, result.draft));
    setSelected(result.key);
    svg.current?.focus();
  };
  const doUndo = (): void => setHistory((now) => undo(now));
  const doRedo = (): void => setHistory((now) => redo(now));

  const onSave = async (): Promise<void> => {
    setSaving(true);
    try {
      const saved = await save(before, draft, app, roleNames);
      setBefore(saved);
      setHistory(historyOf(saved));
      if (selected !== null && !saved.parts.some((part) => part.key === selected)) setSelected(null);
      toast(draft.state === 'published' ? t('designs.saved.shown', 'Saved. Customers see it next time they choose a design.') : t('designs.saved.hidden', 'Saved. It stays hidden until you show it.'));
      // A design customers see gets its preview picture again, from the rows as saved.
      if (saved.state === 'published' && (await makePicture(base, saved.id)) === 'failed') toast(t('designs.saved.noPicture', 'Its preview picture couldn’t be made. Customers see the design drawn instead.'), 'info');
    } catch (caught) {
      toast(refusal(t, asDataError(caught)).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const view = viewOfFace({ ...face, paper: undefined });
  const onPointerDown = (event: PointerEvent<SVGSVGElement>): void => {
    const at = pointOnFace(event.currentTarget, event.clientX, event.clientY, view);
    if (at === null) return;
    const target = event.target as Element;
    const handle = target.closest('[data-handle]') !== null;
    const key = handle ? selected : target.closest('[data-part]')?.getAttribute('data-part');
    const part = visible.find((one) => one.key === key);
    if (key === null || key === undefined || part === undefined || part.box === null) {
      setSelected(null);
      return;
    }
    setSelected(part.key);
    if (readOnly || part.rules['background'] === true) return;
    drag.current = { mode: handle ? 'resize' : 'move', key: part.key, from: at, box: part.box, moved: false };
  };
  const onPointerMove = (event: PointerEvent<SVGSVGElement>): void => {
    const now = drag.current;
    if (now === null) return;
    const at = pointOnFace(event.currentTarget, event.clientX, event.clientY, view);
    if (at === null) return;
    const dx = at.x - now.from.x;
    const dy = at.y - now.from.y;
    // A press that has not gone a hundredth of the face is a click, never a move: the comp's 3 px.
    if (!now.moved && Math.hypot(dx, dy) < Math.min(face.width, face.height) / 100) return;
    if (!now.moved) event.currentTarget.setPointerCapture?.(event.pointerId);
    now.moved = true;
    const box = now.mode === 'move' ? movedBox(now.box, dx, dy, face) : resizedBox(now.box, dx, dy, face);
    change((d) => ({ ...d, parts: d.parts.map((part) => (part.key === now.key ? { ...part, box } : part)) }), `drag:${now.key}`);
  };
  const onPointerUp = (): void => {
    drag.current = null;
    setHistory((now) => endGesture(now));
  };
  const onFaceKey = (event: KeyboardEvent<SVGSVGElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setSelected(null);
      return;
    }
    if (chosen === null || readOnly) return;
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      change((d) => removePart(d, chosen.key));
      setSelected(null);
      return;
    }
    if (chosen.box === null || chosen.rules['background'] === true) return;
    const next = nudgedBox(chosen.box, event.key, { shift: event.shiftKey, alt: event.altKey }, face);
    if (next === null) return;
    event.preventDefault();
    change((d) => ({ ...d, parts: d.parts.map((part) => (part.key === chosen.key ? { ...part, box: next } : part)) }), `nudge:${chosen.key}:${event.altKey ? 'size' : 'place'}`);
  };
  const onEditorKey = (event: KeyboardEvent<HTMLDivElement>): void => {
    const typing = (event.target as Element).closest('input, textarea, select') !== null;
    if (typing || !(event.ctrlKey || event.metaKey)) return;
    const key = event.key.toLowerCase();
    if (key === 'z' && !event.shiftKey) {
      event.preventDefault();
      doUndo();
    } else if ((key === 'z' && event.shiftKey) || key === 'y') {
      event.preventDefault();
      doRedo();
    }
  };

  const nameOf = (key: string): string => visible.find((part) => part.key === key)?.name ?? '';
  const sceneFace: Face = { kind: face.kind, width: face.width, height: face.height, bleed: face.bleed, safe: face.safe, corner: face.corner, ...(look.roles['paper'] === undefined ? {} : { paper: look.roles['paper'] }) };
  const scene = (
    <Scene
      svgRef={svg}
      face={sceneFace}
      drawn={drawn}
      guides={guides}
      selected={chosen?.key ?? null}
      fixed={new Set(visible.filter((part) => part.rules['background'] === true).map((part) => part.key))}
      label={t('designs.face', 'The design: {name}', { name: draft.name })}
      {...(page ? { width: Math.round(PAGE_WIDTH * zoom) } : {})}
      interactive={{ describedBy: hint, onPointerDown, onPointerMove, onPointerUp, onKeyDown: onFaceKey, onSelect: setSelected, selectLabel: (key) => t('designs.select', 'Select {name}', { name: nameOf(key) }) }}
    />
  );
  const undoRedo = (
    <Stack direction="row" gap="xs">
      <IconButton label={t('designs.undo', 'Undo')} variant="bordered" disabled={history.past.length === 0} onClick={doUndo}>
        <Undo />
      </IconButton>
      <IconButton label={t('designs.redo', 'Redo')} variant="bordered" disabled={history.future.length === 0} onClick={doRedo}>
        <Redo />
      </IconButton>
    </Stack>
  );
  const saveButton = readOnly ? null : (
    <Button loading={saving} disabled={!dirty || saving} onClick={() => void onSave()}>
      {t('designs.save', 'Save the design')}
    </Button>
  );
  const preview = page ? (
    <Button variant="secondary" iconLeft={<Eye />} disabled={previewEditor() === null} onClick={() => setPreviewing(true)}>
      {t('designs.preview', 'Preview as a customer')}
    </Button>
  ) : null;
  const leave = blocker?.status === 'blocked' ? (
    <Dialog open onOpenChange={(open) => (open ? undefined : blocker.reset?.())}>
      <DialogHeader title={t('designs.leave.title', 'Leave without saving?')} closeLabel={t('designs.close', 'Close')} />
      <DialogBody>
        <p className="m-0 text-[13px] leading-relaxed">{t('designs.leave.body', 'Your changes to “{name}” are not saved yet.', { name: draft.name })}</p>
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={() => blocker.reset?.()}>
          {t('designs.leave.stay', 'Keep editing')}
        </Button>
        <Button variant="destructive" onClick={() => blocker.proceed?.()}>
          {t('designs.leave.go', 'Leave without saving')}
        </Button>
      </DialogFooter>
    </Dialog>
  ) : null;

  if (previewing) {
    return <CustomerPreview t={t} base={base} data={data} rows={rows} draft={draft} name={draft.name} who={page ? 'customer' : 'shopper'} onBack={() => setPreviewing(false)} />;
  }

  if (page) {
    const zoomAt = Math.max(0, ZOOMS.indexOf(zoom as (typeof ZOOMS)[number]));
    return (
      <div className="flex flex-col gap-3" onKeyDown={onEditorKey} data-part="customiser-editor">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5">
          {onBack === undefined ? null : (
            <IconButton label={t('designs.back', 'Back to the designs')} variant="bordered" onClick={onBack}>
              <Back />
            </IconButton>
          )}
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[14px] font-extrabold">{draft.name}</span>
            <Figure>{t('designs.trim', '{w} × {h} mm · bleed {bleed} mm · safe line {safe} mm', { w: mm(face.width), h: mm(face.height), bleed: mm(face.bleed), safe: mm(face.safe) })}</Figure>
          </span>
          {face.sides === 2 ? (
            <SegmentedControl
              aria-label={t('designs.side', 'Side')}
              value={side}
              onValueChange={(value) => {
                setSide(value === 'back' ? 'back' : 'front');
                setSelected(null);
              }}
              options={[
                { value: 'front', label: t('setup.side.front', 'Front') },
                { value: 'back', label: t('setup.side.back', 'Back') },
              ]}
            />
          ) : null}
          {undoRedo}
          <div role="group" aria-label={t('designs.zoom', 'Zoom')} className="inline-flex items-center gap-1 rounded-[10px] border border-border-strong bg-surface-2">
            <IconButton label={t('designs.zoomOut', 'Zoom out')} variant="ghost" disabled={zoomAt === 0} onClick={() => setZoom(ZOOMS[Math.max(0, zoomAt - 1)]!)}>
              <ZoomOut />
            </IconButton>
            <span className="w-[42px] text-center font-mono text-[11.5px] font-bold text-fg-muted">{`${String(Math.round(zoom * 100))}%`}</span>
            <IconButton label={t('designs.zoomIn', 'Zoom in')} variant="ghost" disabled={zoomAt === ZOOMS.length - 1} onClick={() => setZoom(ZOOMS[Math.min(ZOOMS.length - 1, zoomAt + 1)]!)}>
              <ZoomIn />
            </IconButton>
          </div>
          {preview}
          {saveButton}
        </div>
        {previewEditor() === null ? <p className="m-0 text-[12px] text-fg-subtle">{t('designs.preview.later', 'Preview as a customer opens here once the customer’s editor comes with this add-on.')}</p> : null}
        <div className="flex flex-wrap items-start gap-3">
          <nav aria-label={t('designs.tools', 'Tools')} className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface p-2">
            {(
              [
                ['text', TypeIcon, t('designs.tool.textPart', 'Add a text part')],
                ['logo', ImagePlus, t('designs.tool.logo', 'Add a logo box')],
                ['rect', SquareIcon, t('designs.tool.rect', 'Rectangle')],
                ['ellipse', Circle, t('designs.tool.ellipse', 'Ellipse')],
                ['line', MinusIcon, t('designs.tool.line', 'Line')],
              ] as const
            ).map(([tool, Icon, label]) => (
              <IconButton key={tool} label={label} variant="bordered" disabled={readOnly} onClick={() => add(tool)}>
                <Icon />
              </IconButton>
            ))}
            <ToggleChip pressed={guides} onPressedChange={setGuides}>
              {t('designs.guides', 'Guides')}
            </ToggleChip>
          </nav>
          <div className="flex min-w-0 flex-1 flex-col items-center gap-3 overflow-hidden rounded-xl border border-border bg-surface-3 p-3">
            {scene}
            <Legend t={t} bleed={face.bleed} safe={face.safe} />
            <p id={hint} className="m-0 text-center text-[12.5px] text-fg-subtle">
              {t('designs.note', 'Parts with a padlock stay as you made them; the customer fills in the rest. Drag to move, or use the arrow keys.')}
            </p>
          </div>
          <PagePanel t={t} face={face} draft={draft} side={side} layout={shownLayout} paletteKey={paletteKey} selected={chosen} visible={visible} fonts={fonts} readOnly={readOnly} change={change} onSelect={setSelected} onLayout={setLayout} onPalette={setPaletteKey} />
        </div>
        {leave}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3" onKeyDown={onEditorKey} data-part="customiser-editor">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="flex min-w-0 flex-1">
          <Input aria-label={t('designs.name', 'Design name')} value={draft.name} maxLength={120} disabled={readOnly} onChange={(event) => change((d) => ({ ...d, name: event.target.value }), 'name')} onBlur={() => setHistory((now) => endGesture(now))} />
        </span>
        {(
          [
            ['text', TypeIcon, t('designs.tool.text', 'Add text')],
            ['logo', ImageIcon, t('designs.tool.logo', 'Add a logo box')],
            ['motif', Sprout, t('designs.tool.motif', 'Add a motif')],
            ['shape', SquareIcon, t('designs.tool.shape', 'Add a shape')],
          ] as const
        ).map(([tool, Icon, label]) => (
          <Button key={tool} variant="secondary" iconLeft={<Icon />} disabled={readOnly} onClick={() => add(tool)}>
            {label}
          </Button>
        ))}
        {undoRedo}
        {saveButton}
      </div>
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="rounded-xl border border-border bg-surface-3 p-3">{scene}</div>
          <p id={hint} className="m-0 text-[12px] leading-relaxed text-fg-muted">
            {t('designs.hint', 'Drag a part to place it, or its corner to resize. Arrow keys move the selected part; Alt + arrows resize it.')}
          </p>
          <PartChips t={t} parts={visible} selected={chosen?.key ?? null} onSelect={setSelected} />
        </div>
        {chosen === null ? null : <PiecePanel t={t} face={face} part={chosen} fonts={fonts} finishes={data.finishes} offeredFinishes={offered.finishes} appPalettes={rows.appPalettes} colours={rows.colours} readOnly={readOnly} change={change} onRemoved={() => setSelected(null)} />}
      </div>
      {leave}
    </div>
  );
}

const Lock = lucideByName('lock');

/** The comp's row of parts under the piece: each a button that selects its part, a padlock on the shop's own. */
function PartChips({ t, parts, selected, onSelect }: { t: AddOnTranslate; parts: readonly PartDraft[]; selected: string | null; onSelect: (key: string) => void }): ReactNode {
  return (
    <div role="group" aria-label={t('designs.parts', 'Parts')} className="flex flex-wrap gap-1.5">
      {parts.map((part) => (
        <ToggleChip key={part.key} pressed={part.key === selected} onPressedChange={() => onSelect(part.key)} aria-label={part.locked ? t('designs.partLocked', '{name}, locked', { name: part.name }) : part.name}>
          <span className="inline-flex items-center gap-1.5">
            {part.locked ? <Lock /> : null}
            {part.name}
          </span>
        </ToggleChip>
      ))}
    </div>
  );
}
