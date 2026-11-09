/**
 * STEP 1, THE BASE: what gets customised.
 *
 * - A flat page (Marlow Press): the trim size, the bleed and the safe line,
 *   one side or both, drawn as the comp draws them ("85 × 55 mm + 3 mm
 *   bleed", legend Trim · Bleed · Safe line).
 * - A flat piece (Birch Row): the outline as an SVG Adminium cleans as it
 *   comes in, and the material and its thickness.
 * - A kit of pieces (`KitBase.tsx`): its pieces, its assembled model, its
 *   thickness, and its marked faces below.
 * - A 3D-printed item (`PrintedBase.tsx`): the model to print and the
 *   preview model, and its marked faces below, each saying how the words
 *   sit on it (raised or cut in).
 */
import { useId, useState, type ChangeEvent, type ReactNode } from 'react';

import { Alert, asDataError, Card, FileInput, Figure, Grid, Input, NumberInput, SegmentedControl, Stack, ToggleChip, useUploader, useWrite, type AddOnTranslate, type DataRow } from '../shared/host.ts';
import { PieceTurntable, plainSheet, storedOutline, WaitingSquare } from '../shared/Piece3d.tsx';
import { refusal } from '../shared/refusal.ts';
import { useToast } from '../shared/toast.ts';
import { Drawing } from './Drawing.tsx';
import { guidesOf, kindOf, looksSvg, materialsIn, mm, num, OUTLINE_BYTES, sizeOf, svgSize, text } from './facts.ts';
import { KitFields, KitPreview, useKitPieces } from './KitBase.tsx';
import { MarkFaces } from './MarkFaces.tsx';
import { PrintedFields, PrintedPreview } from './PrintedBase.tsx';
import { kindName } from './NewBase.tsx';

/** A number field that saves its column when it is left with a new value. */
export function SavedNumber<Clear extends boolean = false>({ label, value, unit, onSave, decimals = 1, clearable, hint, disabled }: { label: string; value: number | null; unit?: string; onSave: (value: Clear extends true ? number | null : number) => void; decimals?: number; clearable?: Clear; hint?: string; disabled?: boolean }): ReactNode {
  const shown = value === null ? '' : String(value);
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <NumberInput
      label={label}
      value={draft ?? shown}
      decimals={decimals}
      {...(unit === undefined ? {} : { unit })}
      {...(hint === undefined ? {} : { hint })}
      {...(disabled === true ? { disabled: true } : {})}
      onChange={setDraft}
      onBlur={() => {
        // A field that may be empty is emptied by clearing it: the column goes back to none.
        if (draft !== null && clearable === true && draft.trim() === '' && shown !== '') (onSave as (value: number | null) => void)(null);
        else if (draft !== null && draft !== shown && draft.trim() !== '' && Number.isFinite(Number(draft))) onSave(Number(draft));
        setDraft(null);
      }}
    />
  );
}

export function BaseStep({ t, base, bases, settings, areas = [] }: { t: AddOnTranslate; base: DataRow; bases: readonly DataRow[]; settings: DataRow | null; areas?: readonly DataRow[] }): ReactNode {
  const kind = kindOf(base);
  const pieces = useKitPieces(base, kind === 'kit');
  const write = useWrite('bases');
  const toast = useToast();
  const id = base['id'] as string | number;
  const save = (values: Record<string, string | number | null>): void => {
    write.update(id, values).catch((caught: unknown) => toast(refusal(t, asDataError(caught)).message, 'error'));
  };
  const note =
    kind === 'page'
      ? t('setup.base.note.page', 'A page at the finished size, with the bleed and the safe line drawn for you. One for each side.')
      : kind === 'piece'
        ? t('setup.base.note.piece', 'Cut from one sheet. The 3D preview is made from the outline and the thickness.')
        : kind === 'kit'
          ? t('setup.base.note.kit', 'Each piece is cut flat. The model shows them put together.')
          : t('setup.base.note.printed', 'Printed in PLA. Words and logos are raised from, or cut into, a flat face.');
  const step = (
    <Grid columns={2} gap="lg">
      <Stack gap="md">
        <Card title={kindName(t, kind)} description={note} />
        {kind === 'page' ? <PageFields t={t} base={base} settings={settings} save={save} /> : null}
        {kind === 'piece' ? <Outline t={t} base={base} save={save} /> : null}
        {kind === 'piece' ? <Material t={t} base={base} bases={bases} save={save} /> : null}
        {kind === 'kit' ? <KitFields t={t} base={base} pieces={pieces} save={save} /> : null}
        {kind === 'printed' ? <PrintedFields t={t} base={base} save={save} /> : null}
      </Stack>
      {kind === 'kit' ? <KitPreview t={t} base={base} /> : kind === 'printed' ? <PrintedPreview t={t} base={base} /> : <Preview t={t} base={base} settings={settings} />}
    </Grid>
  );
  // A kit's and a printed item's marked faces sit below the base, across the page, as the comp's.
  return kind === 'kit' || kind === 'printed' ? (
    <Stack gap="lg">
      {step}
      <MarkFaces t={t} base={base} pieces={pieces} areas={areas} />
    </Stack>
  ) : (
    step
  );
}

function PageFields({ t, base, settings, save }: { t: AddOnTranslate; base: DataRow; settings: DataRow | null; save: (values: Record<string, string | number | null>) => void }): ReactNode {
  const guides = guidesOf(base, { bleed: num(settings?.['default_bleed_mm']) ?? 3, safe: num(settings?.['default_safe_mm']) ?? 4 });
  return (
    <Card title={t('setup.page.title', 'The page')} description={t('setup.page.size', '{w} × {h} mm + {bleed} mm bleed', { w: mm(guides.width), h: mm(guides.height), bleed: mm(guides.bleed) })}>
      <Stack gap="md">
        <Grid columns={2} gap="md">
          <SavedNumber label={t('setup.page.width', 'Trim width')} unit="mm" value={guides.width} onSave={(value) => save({ width_mm: value })} />
          <SavedNumber label={t('setup.page.height', 'Trim height')} unit="mm" value={guides.height} onSave={(value) => save({ height_mm: value })} />
          <SavedNumber label={t('setup.page.bleed', 'Bleed')} unit="mm" value={guides.bleed} onSave={(value) => save({ bleed_mm: value })} />
          <SavedNumber label={t('setup.page.safe', 'Safe line')} unit="mm" value={guides.safe} onSave={(value) => save({ safe_mm: value })} />
          <SavedNumber label={t('setup.page.corner', 'Rounded corners')} unit="mm" value={num(base['corner_mm'])} clearable onSave={(value) => save({ corner_mm: value })} />
        </Grid>
        <SegmentedControl
          aria-label={t('setup.page.sides', 'Sides')}
          value={String(guides.sides)}
          onValueChange={(value) => save({ sides: Number(value) })}
          options={[
            { value: '1', label: t('setup.page.oneSide', 'One side') },
            { value: '2', label: t('setup.page.bothSides', 'Both sides') },
          ]}
        />
      </Stack>
    </Card>
  );
}

function Outline({ t, base, save }: { t: AddOnTranslate; base: DataRow; save: (values: Record<string, string | number | null>) => void }): ReactNode {
  const upload = useUploader('bases', 'outline_file');
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [removed, setRemoved] = useState<readonly string[]>([]);
  const [busy, setBusy] = useState(false);
  const has = text(base['outline_file']) !== '';
  const size = sizeOf(base);
  const pick = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file === undefined || upload === null) return;
    if (!looksSvg(file)) return setError(t('setup.outline.notSvg', '{file}: That isn’t an SVG.', { file: file.name }));
    if (file.size > OUTLINE_BYTES) return setError(t('setup.outline.tooBig', '{file}: That file is over 2 MB.', { file: file.name }));
    setBusy(true);
    try {
      const measured = svgSize(await file.text());
      // The upload saves the row with the file in its column; the size read from the drawing follows it.
      const stored = await upload.upload(base['id'] as string | number, file, { name: file.name });
      setError(null);
      setRemoved(stored.removed);
      if (measured !== null) save({ width_mm: measured.width, height_mm: measured.height });
      toast(stored.removed.length > 0 ? t('setup.outline.cleaned', 'Outline cleaned and saved.') : t('setup.outline.saved', 'Outline saved.'));
    } catch (caught) {
      // Adminium's own words: it read the bytes and refused them.
      setError(t('setup.outline.refused', '{file}: {why}', { file: file.name, why: asDataError(caught).message || refusal(t, asDataError(caught)).message }));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card title={t('setup.outline.title', 'The outline')} description={<Figure>{t('setup.outline.limits', 'SVG · up to 2 MB')}</Figure>}>
      <Stack gap="md">
        {has ? (
          <Stack direction="row" gap="sm" justify="between" align="center">
            <span className="text-[13px] font-bold">{t('setup.outline.name', 'Outline')}</span>
            <Figure>{t('setup.size', '{w} × {h} mm', { w: mm(size.width), h: mm(size.height) })}</Figure>
          </Stack>
        ) : (
          <p className="m-0 text-[12.5px] text-fg-muted">{t('setup.outline.empty', "Upload the piece's outline as an SVG. We clean it as it comes in.")}</p>
        )}
        {removed.length > 0 ? (
          <Alert
            tone="info"
            title={t('setup.outline.removed', 'We removed {n, plural, one {# thing} other {# things}} that can’t be used in an outline', { n: removed.length })}
            body={t('setup.outline.removedList', 'Taken out: {list}. The shape itself is unchanged.', { list: removedWords(t, removed).join(' · ') })}
          />
        ) : null}
        {upload === null ? <Alert tone="warn" title={t('setup.upload.none', 'Uploading here needs a newer Adminium.')} body={t('setup.upload.noneBody', 'Ask whoever runs Adminium to update it. Everything else on this page works now.')} /> : null}
        <FileInput type="file" accept=".svg,image/svg+xml" label={has ? t('setup.outline.replace', 'Replace') : t('setup.outline.upload', 'Upload the outline')} disabled={upload === null || busy} error={error ?? undefined} onChange={(event) => void pick(event)} />
      </Stack>
    </Card>
  );
}

/**
 * What Adminium's cleaner took out of an outline, in words a shop reads:
 * Adminium names each thing as the drawing wrote it (`<script>`, `onclick`,
 * `inkscape:*`), and the comp says "a script", "an outside link". A name
 * this does not know is shown as Adminium wrote it.
 */
export function removedWords(t: AddOnTranslate, removed: readonly string[]): string[] {
  return removed.map((name) => {
    const plain = name.toLowerCase();
    if (plain === '<script>') return t('setup.outline.gone.script', 'a script');
    if (/^on[a-z]+$/.test(plain)) return t('setup.outline.gone.handler', 'a script that runs on {name}', { name });
    if (/^(inkscape|sodipodi):/.test(plain)) return t('setup.outline.gone.editor', 'the drawing program’s notes');
    if (plain === '<a>' || plain.endsWith('href')) return t('setup.outline.gone.link', 'a link to an outside page');
    if (plain === '<metadata>' || /^(rdf|cc|dc):/.test(plain)) return t('setup.outline.gone.notes', 'notes about the file');
    return name;
  });
}

function Material({ t, base, bases, save }: { t: AddOnTranslate; base: DataRow; bases: readonly DataRow[]; save: (values: Record<string, string | number | null>) => void }): ReactNode {
  const known = materialsIn(bases.filter((row) => text(row['app']) === text(base['app'])));
  const material = text(base['material']);
  const thickness = num(base['thickness_mm']);
  const [draft, setDraft] = useState<string | null>(null);
  const label = useId();
  return (
    <Card title={<span id={label}>{t('setup.material.title', 'Material and thickness')}</span>}>
      <Stack gap="md">
        {known.length > 0 ? (
          <div role="group" aria-labelledby={label} className="flex flex-wrap gap-2">
            {known.map((one) => (
              <ToggleChip key={`${one.material}|${String(one.thickness)}`} pressed={one.material === material && one.thickness === thickness} onPressedChange={() => save({ material: one.material, thickness_mm: one.thickness })}>
                {one.material} · {t('setup.mm', '{n} mm', { n: mm(one.thickness) })}
              </ToggleChip>
            ))}
          </div>
        ) : null}
        <Grid columns={2} gap="md">
          <Input
            label={t('setup.material.name', 'Material')}
            value={draft ?? material}
            maxLength={80}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => {
              if (draft !== null && draft.trim() !== material) save({ material: draft.trim() === '' ? null : draft.trim() });
              setDraft(null);
            }}
          />
          <SavedNumber label={t('setup.material.thickness', 'Thickness')} unit="mm" value={thickness} onSave={(value) => save({ thickness_mm: value })} />
          <SavedNumber label={t('setup.piece.width', 'Width')} unit="mm" value={num(base['width_mm'])} onSave={(value) => save({ width_mm: value })} />
          <SavedNumber label={t('setup.piece.height', 'Height')} unit="mm" value={num(base['height_mm'])} onSave={(value) => save({ height_mm: value })} />
          <SavedNumber label={t('setup.page.corner', 'Rounded corners')} unit="mm" value={num(base['corner_mm'])} clearable onSave={(value) => save({ corner_mm: value })} />
        </Grid>
      </Stack>
    </Card>
  );
}

function Preview({ t, base, settings }: { t: AddOnTranslate; base: DataRow; settings: DataRow | null }): ReactNode {
  const kind = kindOf(base);
  const size = sizeOf(base);
  if (kind === 'page') {
    const guides = guidesOf(base, { bleed: num(settings?.['default_bleed_mm']) ?? 3, safe: num(settings?.['default_safe_mm']) ?? 4 });
    return (
      <Stack gap="sm">
        <div className="rounded-xl border border-border bg-surface-3 p-3">
          <Drawing kind="page" size={size} guides={guides} label={t('setup.page.alt', 'The page at {w} × {h} mm, with the trim, the bleed and the safe line', { w: mm(size.width), h: mm(size.height) })} />
        </div>
        <Legend t={t} bleed={guides.bleed} safe={guides.safe} />
      </Stack>
    );
  }
  if (kind !== 'piece' || text(base['outline_file']) === '') {
    return kind === 'piece' ? (
      <WaitingSquare words={t('setup.preview.waiting', 'the 3D preview appears once the outline is in')} />
    ) : (
      <div className="flex items-center justify-center rounded-xl border border-dashed border-border-strong bg-surface-2 px-4 py-4">
        <Figure>{t('setup.preview.waiting', 'the 3D preview appears once the outline is in')}</Figure>
      </div>
    );
  }
  const corner = num(base['corner_mm']) ?? 0;
  const thickness = num(base['thickness_mm']);
  // The piece made from its outline and thickness, as the shoppers will turn it.
  return (
    <PieceTurntable
      t={t}
      sheet={plainSheet(size, corner, text(base['material']) || null)}
      thickness={thickness}
      outline={storedOutline(base['outline_file'])}
      label={t('setup.preview.alt', '{name} preview', { name: text(base['name']) })}
      meta={<Figure>{t('setup.piece.meta', '{w} × {h} × {d} mm', { w: mm(size.width), h: mm(size.height), d: mm(thickness ?? 0) })}</Figure>}
      fallback={<Drawing kind="piece" size={size} corner={corner} label={t('setup.piece.alt', '{name}, drawn flat', { name: text(base['name']) })} />}
    />
  );
}

/** The page's legend, the comp's: Trim · Bleed 3 mm · Safe line 4 mm. */
export function Legend({ t, bleed, safe }: { t: AddOnTranslate; bleed: number; safe: number }): ReactNode {
  return (
    <ul className="flex list-none flex-wrap gap-3 text-[12px] text-fg-muted">
      <li>
        <span className="text-danger">━</span> {t('setup.legend.trim', 'Trim')}
      </li>
      <li>
        <span className="text-danger">▬</span> {t('setup.legend.bleed', 'Bleed')} <span className="font-mono">{t('setup.mm', '{n} mm', { n: mm(bleed) })}</span>
      </li>
      <li>
        <span className="text-info">┅</span> {t('setup.legend.safe', 'Safe line')} <span className="font-mono">{t('setup.mm', '{n} mm', { n: mm(safe) })}</span>
      </li>
    </ul>
  );
}
