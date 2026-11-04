/**
 * STEP 2, AREAS: where a shopper may put their own words or logo.
 *
 * Drawn on the face: "Draw a rectangle" / "Draw an oval", then a drag across
 * the face, or Enter for the comp's standard size; Esc cancels. An area is
 * moved by dragging it, resized by its corner; with the face focused, the
 * arrow keys move the selected area and Alt + arrows resize it (Shift for
 * five steps). Every area is also a button on the face and a row in the
 * list, so each step has a keyboard path.
 *
 * Each area keeps its rules in the shape the rule module reads (`chars`,
 * `grows`, `unit`, `size`, `min`, `max`, `fonts`, `finishes`; a logo's
 * `picture`, `fit`, `colour`, `file`; both under `alsoLogo`).
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';

import { asDataError, Button, Figure, Grid, IconButton, Input, lucideByName, SegmentedControl, Stack, Switch, ToggleChip, useWrite, type AddOnTranslate, type DataRow } from '../shared/host.ts';
import { refusal } from '../shared/refusal.ts';
import { useToast } from '../shared/toast.ts';
import type { SetupData } from './data.ts';
import { Drawing, pointOn, viewOf, type DrawnArea } from './Drawing.tsx';
import { boxOf, boxValues, codeFor, dragged, drawnEnough, guidesOf, kindOf, logoRules, moved, mm, nudged, num, offeredOf, resized, rulesFor, sizeOf, standardBox, startRules, takesOf, text, wordsRulesOf, yes, type Box, type Shape, type Takes } from './facts.ts';

type Drag = { mode: 'draw'; from: { x: number; y: number }; shape: Shape } | { mode: 'move' | 'resize'; id: string; from: { x: number; y: number }; box: Box; moved: boolean };

export function AreasStep({ t, base, data }: { t: AddOnTranslate; base: DataRow; data: SetupData }): ReactNode {
  const kind = kindOf(base) === 'page' ? 'page' : 'piece';
  const size = sizeOf(base);
  const guides = guidesOf(base, { bleed: num(data.settings?.['default_bleed_mm']) ?? 3, safe: num(data.settings?.['default_safe_mm']) ?? 4 });
  const offered = offeredOf(base);
  const write = useWrite('base_areas');
  const toast = useToast();
  const hint = useId();
  const svg = useRef<SVGSVGElement>(null);
  const [drawMode, setDrawMode] = useState<Shape | null>(null);
  const [draft, setDraft] = useState<Box | null>(null);
  const [live, setLive] = useState<{ id: string; box: Box } | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [focusName, setFocusName] = useState<string | null>(null);
  const drag = useRef<Drag | null>(null);
  const areas = data.areas;
  const selected = picked === 'none' ? null : (picked ?? (areas[0] === undefined ? null : String(areas[0]['id'])));
  const view = viewOf(kind, size, guides);
  const failed = (caught: unknown): void => toast(refusal(t, asDataError(caught)).message, 'error');

  useEffect(() => {
    if (focusName === null) return;
    document.getElementById(`area-name-${focusName}`)?.focus();
    setFocusName(null);
  }, [focusName, areas]);

  const add = (shape: Shape, box: Box): void => {
    const name = shape === 'oval' ? t('setup.areas.newOval', 'New oval area') : t('setup.areas.newRect', 'New area');
    const codes = areas.map((area) => text(area['code']));
    write
      .create({
        app: text(base['app']) === '' ? null : text(base['app']),
        base_id: base['id'] as string | number,
        code: codeFor(name, codes, 'area'),
        name,
        shape,
        ...boxValues(box),
        ...(kind === 'page' ? { side: 'front' } : {}),
        takes: 'words',
        required: false,
        rules: JSON.stringify(startRules(kindOf(base), size, offered)),
        position: areas.length + 1,
      })
      .then(({ row }) => {
        setPicked(String(row['id']));
        setFocusName(String(row['id']));
        toast(shape === 'oval' ? t('setup.areas.ovalDrawn', 'Oval drawn. Give it a name.') : t('setup.areas.rectDrawn', 'Rectangle drawn. Give it a name.'));
      })
      .catch(failed);
  };
  const saveBox = (id: string, box: Box): void => void write.update(id, boxValues(box)).catch(failed);
  const boxFor = (area: DataRow): Box => (live !== null && live.id === String(area['id']) ? live.box : boxOf(area));

  const onPointerDown = (event: PointerEvent<SVGSVGElement>): void => {
    const at = pointOn(event.currentTarget, event.clientX, event.clientY, view);
    if (at === null) return;
    if (drawMode !== null) {
      drag.current = { mode: 'draw', from: at, shape: drawMode };
      setDraft({ x: at.x, y: at.y, w: 0, h: 0 });
      event.preventDefault();
      return;
    }
    const target = event.target as Element;
    const id = target.closest('[data-part]')?.getAttribute('data-part');
    const area = areas.find((one) => String(one['id']) === id);
    if (id === undefined || id === null || area === undefined) return;
    setPicked(id);
    drag.current = { mode: target.closest('[data-handle]') === null ? 'move' : 'resize', id, from: at, box: boxOf(area), moved: false };
  };
  const onPointerMove = (event: PointerEvent<SVGSVGElement>): void => {
    const now = drag.current;
    if (now === null) return;
    const at = pointOn(event.currentTarget, event.clientX, event.clientY, view);
    if (at === null) return;
    if (now.mode === 'draw') {
      setDraft(dragged(now.from, at, size));
      return;
    }
    const dx = at.x - now.from.x;
    const dy = at.y - now.from.y;
    // A press that has not gone 1 % of the face is a click, never a move: the comp's 3 px.
    if (!now.moved && Math.hypot(dx, dy) < Math.min(size.width, size.height) / 100) return;
    if (!now.moved) event.currentTarget.setPointerCapture?.(event.pointerId);
    now.moved = true;
    setLive({ id: now.id, box: now.mode === 'move' ? moved(now.box, dx, dy, size) : resized(now.box, dx, dy, size) });
  };
  const onPointerUp = (): void => {
    const now = drag.current;
    drag.current = null;
    if (now === null) return;
    if (now.mode === 'draw') {
      const box = draft;
      setDraft(null);
      setDrawMode(null);
      if (box !== null && drawnEnough(box, size)) add(now.shape, box);
      else toast(t('setup.areas.dragToDraw', 'Drag across the piece to draw it.'), 'info');
      return;
    }
    if (now.moved && live !== null) saveBox(now.id, live.box);
    setLive(null);
  };
  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>): void => {
    if (event.key === 'Escape' && (drawMode !== null || drag.current !== null)) {
      event.preventDefault();
      drag.current = null;
      setDraft(null);
      setLive(null);
      setDrawMode(null);
      return;
    }
    if (drawMode !== null && event.key === 'Enter') {
      event.preventDefault();
      add(drawMode, standardBox(size));
      setDrawMode(null);
      return;
    }
    const area = areas.find((one) => String(one['id']) === selected);
    if (area === undefined) return;
    const next = nudged(boxOf(area), event.key, { shift: event.shiftKey, alt: event.altKey }, size);
    if (next === null) return;
    event.preventDefault();
    saveBox(String(area['id']), next);
  };
  const drawn: DrawnArea[] = areas.map((area) => ({ id: String(area['id']), name: text(area['name']), shape: area['shape'] === 'oval' ? 'oval' : 'rect', box: boxFor(area) }));
  const startDrawing = (shape: Shape): void => {
    setDrawMode(drawMode === shape ? null : shape);
    setDraft(null);
    svg.current?.focus();
  };

  return (
    <Grid columns={2} gap="lg">
      <Stack gap="sm">
        <div className="rounded-xl border border-border bg-surface-3 p-3">
          <Drawing
            svgRef={svg}
            kind={kind}
            size={size}
            guides={guides}
            corner={num(base['corner_mm']) ?? 0}
            areas={drawn}
            selected={selected}
            draft={draft === null || drawMode === null ? null : { box: draft, shape: drawMode }}
            label={kind === 'page' ? t('setup.areas.facePage', 'The page, with its areas') : t('setup.areas.face', 'The piece, with its areas')}
            interactive={{ describedBy: hint, onPointerDown, onPointerMove, onPointerUp, onKeyDown, onSelect: setPicked, selectLabel: (name) => t('setup.areas.select', 'Select {name}', { name }) }}
          />
        </div>
        <Stack direction="row" gap="sm" wrap>
          <ToggleChip pressed={drawMode === 'rect'} onPressedChange={() => startDrawing('rect')}>
            {t('setup.areas.drawRect', 'Draw a rectangle')}
          </ToggleChip>
          <ToggleChip pressed={drawMode === 'oval'} onPressedChange={() => startDrawing('oval')}>
            {t('setup.areas.drawOval', 'Draw an oval')}
          </ToggleChip>
        </Stack>
        <p id={hint} className="m-0 text-[12px] leading-relaxed text-fg-muted">
          {drawMode === null
            ? t('setup.areas.hint', 'Drag an area to move it, or its corner to resize. With the piece focused, arrow keys move the selected area and Alt + arrows resize it.')
            : drawMode === 'oval'
              ? t('setup.areas.hintOval', 'Drag across the piece to draw the oval. Or press Enter for a standard size. Esc cancels.')
              : t('setup.areas.hintRect', 'Drag across the piece to draw the rectangle. Or press Enter for a standard size. Esc cancels.')}
        </p>
        <p className="m-0 text-[12px] text-fg-subtle">{kind === 'page' ? t('setup.areas.wherePage', 'Areas sit on a side of the page, inside the safe line.') : t('setup.areas.where', 'Areas sit on the face of the piece.')}</p>
      </Stack>
      <Stack gap="sm">
        {areas.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border-strong px-5 py-4 text-center">
            <span className="text-[14px] font-extrabold">{t('setup.areas.none', 'No areas yet')}</span>
            <span className="text-[12.5px] leading-relaxed text-fg-muted">{t('setup.areas.noneBody', 'Draw a rectangle or an oval where a shopper may add their own words or logo.')}</span>
          </div>
        ) : null}
        {areas.map((area) => (
          <AreaRow key={String(area['id'])} t={t} area={area} base={base} data={data} open={String(area['id']) === selected} onToggle={() => setPicked(String(area['id']) === selected ? 'none' : String(area['id']))} failed={failed} />
        ))}
      </Stack>
    </Grid>
  );
}

function AreaRow({ t, area, base, data, open, onToggle, failed }: { t: AddOnTranslate; area: DataRow; base: DataRow; data: SetupData; open: boolean; onToggle: () => void; failed: (caught: unknown) => void }): ReactNode {
  const write = useWrite('base_areas');
  const toast = useToast();
  const id = String(area['id']);
  const kind = kindOf(base);
  const size = sizeOf(base);
  const offered = offeredOf(base);
  const takes = takesOf(area);
  const rules = wordsRulesOf(area);
  const unit = kind === 'page' ? 'pt' : 'mm';
  const panel = useId();
  const [name, setName] = useState<string | null>(null);
  const logo = data.features.find((feature) => text(feature['code']) === 'logo');
  const save = (values: Record<string, string | number | boolean | null>): void => void write.update(id, values).catch(failed);
  const setRules = (change: Parameters<typeof rulesFor>[4]): void => save({ rules: JSON.stringify(rulesFor(area, kind, size, offered, change)) });
  const takesWords = takes !== 'logo';
  const what = takes === 'logo' ? t('setup.areas.takesLogo', 'A logo') : takes === 'both' ? t('setup.areas.takesEither', 'Words or a logo') : t('setup.areas.takesWords', 'Words');
  const step = kind === 'page' ? 1 : 0.5;
  const finishName = (code: string): string => text(data.finishes.find((one) => text(one['code']) === code)?.['name']) || code;
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <button type="button" aria-expanded={open} aria-controls={panel} onClick={onToggle} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-start hover:bg-surface-2">
        <span className="flex-1 text-[13px] font-extrabold">{text(area['name'])}</span>
        <span className="font-mono text-[11px] text-fg-subtle">{yes(area['required']) ? t('setup.areas.metaRequired', '{what} · required', { what }) : what}</span>
      </button>
      {open ? (
        <div id={panel} className="flex flex-col gap-3 px-3 pb-4">
          <Input
            id={`area-name-${id}`}
            label={t('setup.areas.name', 'Name')}
            value={name ?? text(area['name'])}
            maxLength={120}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => {
              if (name !== null && name.trim() !== '' && name.trim() !== text(area['name'])) save({ name: name.trim() });
              setName(null);
            }}
          />
          {kind === 'page' && guidesOf(base).sides === 2 ? (
            <SegmentedControl aria-label={t('setup.areas.side', 'Side')} value={area['side'] === 'back' ? 'back' : 'front'} onValueChange={(value) => save({ side: value })} options={[{ value: 'front', label: t('setup.side.front', 'Front') }, { value: 'back', label: t('setup.side.back', 'Back') }]} />
          ) : null}
          <Stack gap="xs">
            <span className="text-[12px] font-bold text-fg-muted">{t('setup.areas.takes', 'What it takes')}</span>
            <SegmentedControl
              aria-label={t('setup.areas.takes', 'What it takes')}
              value={takes}
              onValueChange={(value) => {
                const next = value as Takes;
                save({ takes: next, rules: JSON.stringify(next === 'logo' ? logoRules(kind) : rulesFor(area, kind, size, offered, { takes: next })), feature_id: next === 'words' || logo === undefined ? null : (logo['id'] as string | number) });
              }}
              options={[
                { value: 'words', label: t('setup.areas.takesWords', 'Words') },
                { value: 'logo', label: t('setup.areas.takesLogo', 'A logo') },
                { value: 'both', label: t('setup.areas.takesBoth', 'Both') },
              ]}
            />
          </Stack>
          {takesWords ? (
            <>
              <Stack direction="row" gap="md" wrap>
                <Stepper t={t} label={t('setup.areas.chars', 'Characters')} value={String(rules.chars)} down={() => setRules({ set: { chars: Math.max(1, rules.chars - 1) } })} up={() => setRules({ set: { chars: Math.min(60, rules.chars + 1) } })} />
                <Stepper t={t} label={t('setup.areas.smallest', 'Smallest')} value={`${mm(rules.min)} ${unit}`} down={() => setRules({ set: { min: Math.max(2, rules.min - step) } })} up={() => setRules({ set: { min: Math.min(40, rules.min + step) } })} />
                <Stepper t={t} label={t('setup.areas.largest', 'Largest')} value={`${mm(rules.max)} ${unit}`} down={() => setRules({ set: { max: Math.max(3, rules.max - step) } })} up={() => setRules({ set: { max: Math.min(60, rules.max + step) } })} />
              </Stack>
              <Chips t={t} label={t('setup.areas.fonts', 'Fonts')} all={offered.fonts} on={rules.fonts} name={(family) => family} toggle={(family) => setRules({ toggle: { field: 'fonts', value: family } })} />
              {kind === 'page' ? null : <Chips t={t} label={t('setup.areas.finishes', 'Finishes')} all={offered.finishes} on={rules.finishes} name={finishName} toggle={(code) => setRules({ toggle: { field: 'finishes', value: code } })} />}
            </>
          ) : null}
          <Stack direction="row" gap="md" align="center" justify="between" wrap>
            <Switch label={t('setup.areas.required', 'Required')} checked={yes(area['required'])} onCheckedChange={(checked) => save({ required: checked })} />
            <Button
              variant="ghost"
              onClick={() =>
                void write
                  .remove(id)
                  .then(() => toast(t('setup.areas.removed', 'Area removed. Designs already ordered keep it.'), 'info'))
                  .catch(failed)
              }
            >
              {t('setup.areas.remove', 'Remove this area')}
            </Button>
          </Stack>
        </div>
      ) : null}
    </div>
  );
}

const Minus = lucideByName('minus');
const Plus = lucideByName('plus');

/** The comp's stepper: a figure with "Less" and "More" either side, named as a group. */
export function Stepper({ t, label, value, down, up }: { t: AddOnTranslate; label: string; value: string; down: () => void; up: () => void }): ReactNode {
  return (
    <Stack gap="xs">
      <span className="text-[12px] font-bold text-fg-muted">{label}</span>
      <div role="group" aria-label={label} className="inline-flex items-center rounded-[10px] border border-border-strong bg-surface">
        <IconButton label={t('setup.less', 'Less')} variant="ghost" onClick={down}>
          <Minus />
        </IconButton>
        <span aria-live="polite" className="w-[120px] text-center font-mono text-[12.5px] font-bold">
          {value}
        </span>
        <IconButton label={t('setup.more', 'More')} variant="ghost" onClick={up}>
          <Plus />
        </IconButton>
      </div>
    </Stack>
  );
}

function Chips({ t, label, all, on, name, toggle }: { t: AddOnTranslate; label: string; all: readonly string[]; on: readonly string[]; name: (value: string) => string; toggle: (value: string) => void }): ReactNode {
  const id = useId();
  return (
    <Stack gap="xs">
      <span id={id} className="text-[12px] font-bold text-fg-muted">
        {label}
      </span>
      {all.length === 0 ? (
        <Figure>{t('setup.areas.noneOffered', 'None offered on this base yet: switch them on in Fonts & finishes.')}</Figure>
      ) : (
        <div role="group" aria-labelledby={id} className="flex flex-wrap gap-1.5">
          {all.map((value) => (
            <ToggleChip key={value} pressed={on.includes(value)} onPressedChange={() => toggle(value)}>
              {name(value)}
            </ToggleChip>
          ))}
        </div>
      )}
    </Stack>
  );
}
