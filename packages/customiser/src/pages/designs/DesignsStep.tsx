/**
 * STEP 3, READY-MADE DESIGNS: the base's designs in the order customers see
 * them, and the editor for one of them.
 *
 * The list is each comp's: on a piece (Birch Row, BC-D4.list) a column of
 * rows, each with its picture, its name and filters, "Move up", "Move down",
 * "Duplicate", "Hide" / "Show" and (F17) "Delete", the design opened beside
 * it; on a page (Marlow Press, MC-E1) wide rows with the front and the back,
 * "Both sides · 2 layouts · 3 palettes", the "Shown to customers" switch, the
 * moves, "Duplicate", "Edit" and (F16) "Delete", "Edit" opening the editor on
 * its own. "New design" heads both. The design open is in the address
 * (`?design=`), so a reload keeps it.
 */
import { useState, type ReactNode } from 'react';

import { asDataError, Button, Card, Dialog, DialogBody, DialogFooter, DialogHeader, EmptyState, Figure, IconButton, lucideByName, Stack, Switch, useAccess, useNavigate, useSearch, type AddOnTranslate, type DataRow } from '../shared/host.ts';
import { pageAt } from '../shared/paths.ts';
import { refusal } from '../shared/refusal.ts';
import { useToast } from '../shared/toast.ts';
import type { SetupData } from '../setup/data.ts';
import { offeredOf, text } from '../setup/facts.ts';
import { Scene } from '../../draw/Scene.tsx';
import { useDesignRows, type DesignRows } from './data.ts';
import { drawnOf, Editor, faceOf, lookOf } from './Editor.tsx';
import { draftOf, partsOn, type FaceFacts } from './draft.ts';
import { InUse, useDesignWrites } from './writes.ts';

const UpIcon = lucideByName('arrow-up');
const DownIcon = lucideByName('arrow-down');
const CopyIcon = lucideByName('copy');
const EyeIcon = lucideByName('eye');
const EyeOff = lucideByName('eye-off');
const EditIcon = lucideByName('square-pen');
const TrashIcon = lucideByName('trash-2');
const PlusIcon = lucideByName('plus');

const listOf = (raw: unknown): unknown[] => {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== 'string') return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export function DesignsStep({ t, base, data }: { t: AddOnTranslate; base: DataRow; data: SetupData }): ReactNode {
  const search = useSearch({ strict: false });
  const navigate = useNavigate();
  const toast = useToast();
  const access = useAccess();
  const rows = useDesignRows(base, data.designs);
  const writes = useDesignWrites(base);
  const [deleting, setDeleting] = useState<DataRow | null>(null);
  const [busy, setBusy] = useState(false);
  const face = faceOf(base, data.settings);
  const page = face.kind === 'page';
  const canEdit = access.canUpdate('ready_designs') && access.canCreate('ready_parts');
  const list = data.designs;
  const wanted = typeof search['design'] === 'string' ? search['design'] : null;
  const open = list.find((row) => String(row['id']) === wanted) ?? (page ? null : (list[0] ?? null));
  const id = base['id'] as string | number;
  const go = (design: string | number | null): void => void navigate({ to: `${pageAt()}/${String(id)}`, search: design === null ? { step: 'designs' } : { step: 'designs', design: String(design) } });
  const failed = (caught: unknown): void => toast(refusal(t, asDataError(caught)).message, 'error');
  const run = async (work: () => Promise<void>): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      await work();
    } catch (caught) {
      failed(caught);
    } finally {
      setBusy(false);
    }
  };

  const make = (): void =>
    void run(async () => {
      const row = await writes.create(list, face, data.areas, { name: t('designs.new.name', 'New design'), paper: t('designs.new.paper', 'Paper'), partName: t('designs.new.namePart', 'Name'), sample: t('designs.new.sampleName', 'Your name'), palette: t('designs.paletteName', 'Palette {n}', { n: 1 }), layout: t('designs.new.layout', 'Standard'), roles: { paper: t('designs.role.paper', 'Paper'), ink: t('designs.role.ink', 'Ink'), accent: t('designs.role.accent', 'Accent') } }, offeredOf(base).fonts[0]);
      toast(t('designs.made', 'New design made. It stays hidden until you show it.'));
      go(row['id'] as string | number);
    });
  const duplicate = (design: DataRow): void =>
    void run(async () => {
      const name = t('designs.copyName', '{name} copy', { name: text(design['name']) });
      const row = await writes.duplicate(list, design, name, rows);
      toast(t('designs.copied', '{name} is made. It stays hidden until you show it.', { name }));
      if (!page) go(row['id'] as string | number);
    });
  const shown = (design: DataRow, on: boolean): void =>
    void run(async () => {
      await writes.shown(design['id'] as string | number, on);
      toast(on ? t('designs.nowShown', '“{name}” shown to customers.', { name: text(design['name']) }) : t('designs.nowHidden', '“{name}” hidden from customers.', { name: text(design['name']) }), 'info');
    });
  const move = (design: DataRow, dir: -1 | 1): void => void run(() => writes.move(list, design['id'] as string | number, dir));
  const remove = async (): Promise<void> => {
    if (deleting === null) return;
    try {
      await writes.remove(deleting, rows);
      toast(t('designs.deleted', '“{name}” deleted. Orders already placed keep their copy.', { name: text(deleting['name']) }), 'info');
      if (open !== null && String(open['id']) === String(deleting['id'])) go(null);
    } catch (caught) {
      if (caught instanceof InUse) toast(t('designs.inUse', 'Customers have made designs from “{name}”, so it stays. Hide it instead.', { name: text(deleting['name']) }), 'error');
      else failed(caught);
    } finally {
      setDeleting(null);
    }
  };

  const shownCount = list.filter((row) => row['state'] === 'published').length;
  const header = (
    <div className="flex flex-wrap items-center gap-2">
      <h2 className="m-0 text-[14px] font-extrabold">{t('designs.title', 'Designs')}</h2>
      <Figure>{page ? t('designs.countPage', '{n, plural, one {# design} other {# designs}} · {shown} shown', { n: list.length, shown: shownCount }) : t('designs.count', '{n} · {hidden} hidden', { n: list.length, hidden: list.length - shownCount })}</Figure>
      <span className="flex-1" />
      {canEdit ? (
        <Button variant={page ? 'primary' : 'secondary'} iconLeft={<PlusIcon />} loading={busy} onClick={make}>
          {t('designs.new', 'New design')}
        </Button>
      ) : null}
    </div>
  );
  const empty = page ? (
    <EmptyState
      title={t('designs.emptyPage', 'No designs for {product} yet', { product: text(base['name']).toLowerCase() })}
      body={t('designs.emptyPageBody', 'Customers see “Start from blank” and “Send your own file” until you add one.')}
      {...(canEdit ? { actions: <Button onClick={make}>{t('designs.new', 'New design')}</Button> } : {})}
    />
  ) : (
    <p className="m-0 px-3 py-4 text-[12.5px] leading-relaxed text-fg-muted">{t('setup.designs.none', 'No ready-made designs yet. Shoppers start with the plain piece until you add one.')}</p>
  );
  const rowsOf = (
    <ul aria-label={t('designs.title', 'Designs')} className="m-0 flex list-none flex-col p-0">
      {list.map((design, index) => (
        <DesignRow key={String(design['id'])} t={t} base={base} face={face} data={data} rows={rows} design={design} index={index} last={index === list.length - 1} page={page} selected={open !== null && String(open['id']) === String(design['id'])} canEdit={canEdit && !busy} onSelect={() => go(design['id'] as string | number)} onMove={(dir) => move(design, dir)} onDuplicate={() => duplicate(design)} onShown={(on) => shown(design, on)} onDelete={() => setDeleting(design)} />
      ))}
    </ul>
  );
  const confirm =
    deleting === null ? null : (
      <Dialog open onOpenChange={(next) => (next ? undefined : setDeleting(null))}>
        <DialogHeader title={t('designs.delete.title', 'Delete “{name}”?', { name: text(deleting['name']) })} closeLabel={t('designs.close', 'Close')} tone="danger" />
        <DialogBody>
          <p className="m-0 text-[13px] leading-relaxed">{t('designs.delete.body', 'Customers will not see it any more. Orders already placed keep their copy.')}</p>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setDeleting(null)}>
            {t('designs.delete.keep', 'Keep it')}
          </Button>
          <Button variant="destructive" onClick={() => void remove()}>
            {t('designs.delete.go', 'Delete it')}
          </Button>
        </DialogFooter>
      </Dialog>
    );
  const editor =
    open === null || rows.loading ? null : <Editor key={String(open['id'])} t={t} base={base} data={data} design={open} rows={rows} readOnly={!canEdit} {...(page ? { onBack: () => go(null) } : {})} />;

  if (page && open !== null) return editor;
  if (page) {
    return (
      <Stack gap="md">
        {header}
        {list.length === 0 ? empty : <Card>{rowsOf}</Card>}
        {list.length === 0 ? null : <p className="m-0 text-[12.5px] text-fg-subtle">{t('designs.order', 'Customers see the designs in this order. Hidden designs stay here for you to finish.')}</p>}
        {confirm}
      </Stack>
    );
  }
  return (
    <div className="flex flex-wrap items-start gap-4">
      <div className="flex w-full flex-col overflow-hidden rounded-xl border border-border bg-surface sm:w-[280px]">
        <div className="border-b border-border px-3 py-3">{header}</div>
        {list.length === 0 ? empty : rowsOf}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">{editor}</div>
      {confirm}
    </div>
  );
}

interface RowProps {
  t: AddOnTranslate;
  base: DataRow;
  face: FaceFacts & { corner: number };
  data: SetupData;
  rows: DesignRows;
  design: DataRow;
  index: number;
  last: boolean;
  page: boolean;
  selected: boolean;
  canEdit: boolean;
  onSelect: () => void;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
  onShown: (on: boolean) => void;
  onDelete: () => void;
}

/** A design's picture, drawn from its parts: one side, the first layout, the first palette. */
function Thumb({ t, face, data, rows, design, side, width }: { t: AddOnTranslate; face: FaceFacts & { corner: number }; data: SetupData; rows: DesignRows; design: DataRow; side: 'front' | 'back'; width: number }): ReactNode {
  const draft = draftOf(design, rows.parts, rows.palettes, rows.colours);
  const look = lookOf(face, draft, draft.palettes[0]?.key ?? null, data.finishes);
  const drawn = drawnOf(t, partsOn(draft, side, draft.layouts[0]?.key ?? null), look);
  return <Scene face={{ kind: face.kind, width: face.width, height: face.height, bleed: face.bleed, safe: face.safe, corner: face.corner, ...(look.roles['paper'] === undefined ? {} : { paper: look.roles['paper'] }) }} drawn={drawn} guides={false} width={width} label={side === 'back' ? t('designs.thumbBack', '{name}, the back', { name: draft.name }) : t('designs.thumb', '{name}, as drawn', { name: draft.name })} />;
}

function DesignRow({ t, base, face, data, rows, design, index, last, page, selected, canEdit, onSelect, onMove, onDuplicate, onShown, onDelete }: RowProps): ReactNode {
  const name = text(design['name']);
  const shown = design['state'] === 'published';
  const tags = listOf(design['tags']).filter((one): one is string => typeof one === 'string');
  const layouts = listOf(design['layouts']).length;
  const palettes = rows.palettes.filter((row) => String(row['ready_design_id']) === String(design['id'])).length;
  const two = face.sides === 2;
  void base;
  const moves = canEdit ? (
    <>
      <IconButton label={t('designs.up', 'Move {name} up', { name })} variant={page ? 'bordered' : 'ghost'} disabled={index === 0} onClick={() => onMove(-1)}>
        <UpIcon />
      </IconButton>
      <IconButton label={t('designs.down', 'Move {name} down', { name })} variant={page ? 'bordered' : 'ghost'} disabled={last} onClick={() => onMove(1)}>
        <DownIcon />
      </IconButton>
      <IconButton label={t('designs.duplicate', 'Duplicate {name}', { name })} variant={page ? 'bordered' : 'ghost'} onClick={onDuplicate}>
        <CopyIcon />
      </IconButton>
    </>
  ) : null;
  const del = canEdit ? (
    <IconButton label={t('designs.deleteAria', 'Delete {name}', { name })} variant={page ? 'bordered' : 'ghost'} onClick={onDelete}>
      <TrashIcon />
    </IconButton>
  ) : null;
  if (page) {
    return (
      <li className="flex flex-wrap items-center gap-3 border-b border-border px-3 py-3">
        <span className="w-5 font-mono text-[11.5px] font-bold text-fg-subtle">{String(index + 1)}</span>
        <span className="flex gap-1.5" aria-hidden="true">
          <Thumb t={t} face={face} data={data} rows={rows} design={design} side="front" width={90} />
          {two ? <Thumb t={t} face={face} data={data} rows={rows} design={design} side="back" width={90} /> : null}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[14.5px] font-extrabold">{name}</span>
          <span className="text-[12px] text-fg-subtle">{t('designs.metaPage', '{sides} · {layouts, plural, one {# layout} other {# layouts}} · {palettes, plural, one {# palette} other {# palettes}}', { sides: two ? t('designs.bothSides', 'Both sides') : t('designs.oneSide', 'One side'), layouts: Math.max(1, layouts), palettes })}</span>
        </span>
        <Switch label={shown ? t('designs.shown', 'Shown to customers') : t('designs.hiddenShort', 'Hidden')} checked={shown} disabled={!canEdit} onCheckedChange={onShown} />
        <span className="flex items-center gap-1.5">
          {moves}
          {del}
          <Button variant="secondary" size="sm" iconLeft={<EditIcon />} onClick={onSelect} aria-label={t('designs.editAria', 'Edit {name}', { name })}>
            {t('designs.edit', 'Edit')}
          </Button>
        </span>
      </li>
    );
  }
  const body = (
    <>
      <span className="w-[52px]" aria-hidden="true">
        <Thumb t={t} face={face} data={data} rows={rows} design={design} side="front" width={52} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-start">
        <span className="text-[13px] font-extrabold">{name}</span>
        <span className="font-mono text-[10.5px] text-fg-subtle">{[...tags, ...(shown ? [] : [t('designs.hiddenMeta', 'hidden')])].join(' · ')}</span>
      </span>
    </>
  );
  return (
    <li className="flex items-center gap-2.5 border-b border-border px-3 py-2">
      {selected ? (
        <button type="button" aria-pressed="true" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[10px] bg-accent-soft">
          {body}
        </button>
      ) : (
        <button type="button" aria-pressed="false" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[10px]">
          {body}
        </button>
      )}
      <span className="flex items-center">
        {moves}
        {canEdit ? (
          <IconButton label={shown ? t('designs.hide', 'Hide {name}', { name }) : t('designs.show', 'Show {name}', { name })} variant="ghost" onClick={() => onShown(!shown)}>
            {shown ? <EyeOff /> : <EyeIcon />}
          </IconButton>
        ) : null}
        {del}
      </span>
    </li>
  );
}
