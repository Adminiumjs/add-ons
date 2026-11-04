/**
 * STEP 1 FOR A KIT OF PIECES (BC-D2.kit, Birch Row Customiser 2572-2581):
 *
 * - "The pieces" · "SVG · several at once · 2 MB each": every piece its own
 *   SVG, picked several at once, each read by its bytes, measured from its
 *   drawing ("{w} × {h} mm") and numbered in turn;
 * - "The assembled model" · "GLB · up to 30 MB": one GLB of the kit put
 *   together, read by its bytes;
 * - "Thickness": the comp's three thicknesses of the kit's material;
 * - the preview: the uploaded model drawn with three.js (BC-D10); before
 *   there is one, or where it cannot be drawn, the built-in preview (the
 *   kit's front, flat).
 *
 * Refusals are in BC-F9's words: "{file}: That isn't an SVG." / "{file}:
 * That isn't a GLB model." / "{file}: That file is over 2 MB."
 */
import { useEffect, useId, useState, type ChangeEvent, type ReactNode } from 'react';

import { isGlb, isSvg } from '../../three/sniff.ts';
import { Alert, asDataError, Card, FileInput, Figure, lucideByName, Stack, ToggleChip, useRecords, useUploader, useWrite, type AddOnTranslate, type DataRow } from '../shared/host.ts';
import { storedModel, ModelTurntable } from '../shared/ShopModel3d.tsx';
import { refusal } from '../shared/refusal.ts';
import { storedFacts } from '../shared/stored.ts';
import { useToast } from '../shared/toast.ts';
import { Drawing } from './Drawing.tsx';
import { mm, num, sizeOf, svgSize, text } from './facts.ts';
import { inPieceOrder, KIT_THICKNESSES, layersIn, megabytes, MODEL_BYTES, nextPieceCode, PIECE_BYTES, pieceNameOf } from './kit.ts';

const Shapes = lucideByName('shapes');
const BoxIcon = lucideByName('box');

type Save = (values: Record<string, string | number | null>) => void;

/** A file's first bytes, enough to tell what it is. */
const headOf = async (file: Blob, bytes = 4096): Promise<Uint8Array> => new Uint8Array(await file.slice(0, bytes).arrayBuffer());

/** The kit's pieces, in the shop's order. */
export function useKitPieces(base: DataRow, enabled = true): readonly DataRow[] {
  const id = base['id'] as string | number;
  const pieces = useRecords('base_pieces', { filter: [{ column: 'base_id', op: 'eq', value: id }], sort: [{ column: 'position', direction: 'asc' }], pageSize: 199, enabled });
  return inPieceOrder(pieces.rows);
}

/** The stored file's name and size, once the dashboard has said them. */
export function useStoredFacts(value: unknown): { name: string | null; size: number | null } {
  const [found, setFound] = useState<{ name: string | null; size: number | null }>({ name: null, size: null });
  const key = text(value as string | null);
  useEffect(() => {
    let alive = true;
    void storedFacts(value).then((facts) => {
      if (alive) setFound(facts);
    });
    return () => {
      alive = false;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return found;
}

export function KitFields({ t, base, pieces, save }: { t: AddOnTranslate; base: DataRow; pieces: readonly DataRow[]; save: Save }): ReactNode {
  return (
    <>
      <Pieces t={t} base={base} pieces={pieces} />
      <Model t={t} base={base} />
      <Thickness t={t} base={base} save={save} />
    </>
  );
}

/** One file of the kit in its card's list: its number, its name, its file, its size. */
export function FileRow({ number, icon, name, file, meta }: { number: string; icon: ReactNode; name: string; file: string | null; meta: string }): ReactNode {
  return (
    <li className="flex items-center gap-2.5 border-b border-border px-0 py-2 last:border-b-0">
      <span className="w-5 font-mono text-[10.5px] font-bold text-fg-subtle">{number}</span>
      <span className="flex size-[15px] shrink-0 text-fg-muted">{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="text-[13px] font-bold">{name}</span>
        {file === null ? null : <span className="truncate font-mono text-[11px] text-fg-subtle">{file}</span>}
      </span>
      <span className="whitespace-nowrap font-mono text-[11.5px] text-fg-muted">{meta}</span>
    </li>
  );
}

function PieceRow({ t, piece }: { t: AddOnTranslate; piece: DataRow }): ReactNode {
  const facts = useStoredFacts(piece['file']);
  const [w, h] = [num(piece['width_mm']), num(piece['height_mm'])];
  return <FileRow number={text(piece['code'])} icon={<Shapes className="size-[15px]" aria-hidden="true" />} name={text(piece['name'])} file={facts.name} meta={w !== null && h !== null && w > 0 && h > 0 ? t('setup.size', '{w} × {h} mm', { w: mm(w), h: mm(h) }) : t('setup.kit.measuring', 'measuring…')} />;
}

function Pieces({ t, base, pieces }: { t: AddOnTranslate; base: DataRow; pieces: readonly DataRow[] }): ReactNode {
  const write = useWrite('base_pieces');
  const upload = useUploader('base_pieces', 'file');
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pick = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const files = [...(event.target.files ?? [])];
    event.target.value = '';
    if (files.length === 0 || upload === null) return;
    // Every file is read before any is kept: one that is not an SVG, or too big, stops them all.
    for (const file of files) {
      if (!isSvg(await headOf(file))) return setError(t('setup.outline.notSvg', '{file}: That isn’t an SVG.', { file: file.name }));
      if (file.size > PIECE_BYTES) return setError(t('setup.outline.tooBig', '{file}: That file is over 2 MB.', { file: file.name }));
    }
    setBusy(true);
    let added = 0;
    try {
      for (const [index, file] of files.entries()) {
        const svg = await file.text();
        const measured = svgSize(svg);
        const { row } = await write.create({
          app: text(base['app']) === '' ? null : text(base['app']),
          base_id: base['id'] as string | number,
          code: nextPieceCode(pieces, index),
          name: pieceNameOf(file.name),
          width_mm: measured?.width ?? 0,
          height_mm: measured?.height ?? 0,
          layers: JSON.stringify(layersIn(svg)),
          position: pieces.length + index + 1,
        });
        try {
          await upload.upload(row['id'] as string | number, file, { name: file.name });
        } catch (caught) {
          // A piece Adminium would not keep the drawing of is not kept at all.
          await write.remove(row['id'] as string | number).catch(() => undefined);
          throw caught;
        }
        added += 1;
      }
      setError(null);
      toast(added > 1 ? t('setup.kit.added', '{n, plural, one {# file added.} other {# files added.}}', { n: added }) : t('setup.kit.addedOne', 'File added.'));
    } catch (caught) {
      setError(t('setup.outline.refused', '{file}: {why}', { file: files[added]?.name ?? '', why: asDataError(caught).message || refusal(t, asDataError(caught)).message }));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card title={t('setup.kit.pieces', 'The pieces')} description={<Figure>{t('setup.kit.piecesLimits', 'SVG · several at once · 2 MB each')}</Figure>}>
      <Stack gap="md">
        {pieces.length > 0 ? (
          <ul className="m-0 max-h-[260px] list-none overflow-y-auto p-0">
            {pieces.map((piece) => (
              <PieceRow key={String(piece['id'])} t={t} piece={piece} />
            ))}
          </ul>
        ) : (
          <p className="m-0 text-[12.5px] text-fg-muted">{t('setup.kit.piecesEmpty', 'Upload every piece as its own SVG.')}</p>
        )}
        {upload === null ? <Alert tone="warn" title={t('setup.upload.none', 'Uploading here needs a newer Adminium.')} body={t('setup.upload.noneBody', 'Ask whoever runs Adminium to update it. Everything else on this page works now.')} /> : null}
        <FileInput type="file" accept=".svg,image/svg+xml" multiple label={pieces.length > 0 ? t('setup.kit.addPieces', 'Add pieces') : t('setup.kit.uploadPieces', 'Upload the pieces')} disabled={upload === null || busy} error={error ?? undefined} onChange={(event) => void pick(event)} />
      </Stack>
    </Card>
  );
}

function Model({ t, base }: { t: AddOnTranslate; base: DataRow }): ReactNode {
  const upload = useUploader('bases', 'model_file');
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<{ name: string; size: number } | null>(null);
  const stored = useStoredFacts(base['model_file']);
  const has = text(base['model_file']) !== '';
  const name = picked?.name ?? stored.name;
  const size = picked?.size ?? stored.size;
  const pick = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file === undefined || upload === null) return;
    if (file.size > MODEL_BYTES) return setError(t('setup.kit.modelTooBig', '{file}: That file is over 30 MB.', { file: file.name }));
    // A GLB says its own length in its header: the whole file is read for it.
    if (!isGlb(new Uint8Array(await file.arrayBuffer()))) return setError(t('setup.kit.notGlb', '{file}: That isn’t a GLB model.', { file: file.name }));
    setBusy(true);
    try {
      await upload.upload(base['id'] as string | number, file, { name: file.name });
      setError(null);
      setPicked({ name: file.name, size: file.size });
      toast(t('setup.kit.addedOne', 'File added.'));
    } catch (caught) {
      setError(t('setup.outline.refused', '{file}: {why}', { file: file.name, why: asDataError(caught).message || refusal(t, asDataError(caught)).message }));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card title={t('setup.kit.model', 'The assembled model')} description={<Figure>{t('setup.kit.modelLimits', 'GLB · up to 30 MB')}</Figure>}>
      <Stack gap="md">
        {has ? (
          <ul className="m-0 list-none p-0">
            <FileRow number="" icon={<BoxIcon className="size-[15px]" aria-hidden="true" />} name={t('setup.kit.assembled', 'Assembled')} file={name} meta={size === null ? '' : megabytes(size)} />
          </ul>
        ) : (
          <p className="m-0 text-[12.5px] text-fg-muted">{t('setup.kit.modelEmpty', 'A GLB of the kit put together.')}</p>
        )}
        <FileInput type="file" accept=".glb" label={has ? t('setup.outline.replace', 'Replace') : t('setup.kit.uploadModel', 'Upload the model')} disabled={upload === null || busy} error={error ?? undefined} onChange={(event) => void pick(event)} />
      </Stack>
    </Card>
  );
}

function Thickness({ t, base, save }: { t: AddOnTranslate; base: DataRow; save: Save }): ReactNode {
  const label = useId();
  const material = text(base['material']) || t('setup.material.name', 'Material');
  const thickness = num(base['thickness_mm']);
  const offered = [...new Set([...KIT_THICKNESSES, ...(thickness === null ? [] : [thickness])])].sort((a, b) => a - b);
  return (
    <Card title={<span id={label}>{t('setup.kit.thickness', 'Thickness')}</span>}>
      <div role="group" aria-labelledby={label} className="flex flex-wrap gap-2">
        {offered.map((one) => (
          <ToggleChip key={one} pressed={one === thickness} onPressedChange={() => save({ thickness_mm: one })}>
            {material} · {t('setup.mm', '{n} mm', { n: mm(one) })}
          </ToggleChip>
        ))}
      </div>
    </Card>
  );
}

/** The kit's preview: the uploaded model turned, or the striped square until it is in. */
export function KitPreview({ t, base }: { t: AddOnTranslate; base: DataRow }): ReactNode {
  const source = storedModel(base['model_file'], 'glb');
  const facts = useStoredFacts(base['model_file']);
  const size = sizeOf(base);
  const builtIn = <Drawing kind="piece" size={size} corner={0} label={t('setup.piece.alt', '{name}, drawn flat', { name: text(base['name']) })} />;
  if (source === null)
    return (
      <div className="flex flex-col gap-2">
        <div className="relative grid aspect-square place-items-center overflow-hidden rounded-2xl border border-border bg-surface-3 p-3">{builtIn}</div>
        <div className="flex justify-end">
          <Figure>{t('setup.kit.noModel', 'no model yet')}</Figure>
        </div>
      </div>
    );
  const fileName = facts.name ?? t('setup.kit.theModel', 'the model');
  return (
    <ModelTurntable
      t={t}
      source={source}
      fileName={fileName}
      label={t('setup.preview.alt', '{name} preview', { name: text(base['name']) })}
      meta={<Figure>{facts.name ?? t('setup.kit.assembled', 'Assembled')}</Figure>}
      fallback={builtIn}
    />
  );
}
