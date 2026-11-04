/**
 * STEP 1 FOR A 3D-PRINTED ITEM (BC-0.BASE.print, BC-D2.print; Birch Row
 * Customiser 2575-2577):
 *
 * - "The model to print" · "STL or 3MF · up to 30 MB": the file the printer
 *   gets. Read by its bytes (an STL by its size, a 3MF by its zip's own
 *   directory, with caps), and read whole: a model with no flat face that
 *   can carry words is refused. Its box gives the item's size.
 * - "The preview model" · "GLB · up to 30 MB": a lighter GLB the shoppers'
 *   preview turns, read by its bytes and by three.js, with the same flat
 *   face test. It is laid over the model to print (`three/align.ts`); when
 *   the two are not the same shape, the step says so.
 * - the preview: the preview model turned (the model to print until there
 *   is one); before either, the item drawn flat and "no preview yet".
 *
 * Refusals in BC-F9's words: "{file}: That isn't an STL or 3MF file." /
 * "{file}: That file is over 30 MB." / "{file}: This model has no flat face
 * we can use here."
 */
import { useEffect, useState, type ChangeEvent, type ReactNode } from 'react';

import { align, MISFIT } from '../../three/align.ts';
import { extent, surveyOf } from '../../three/faces.ts';
import { loadThree } from '../../three/load.ts';
import { PrintRefused, readPrintModel, trianglesOfPrint } from '../../three/printModel.ts';
import { is3mf, isGlb, isStl } from '../../three/sniff.ts';
import { useModelBytes } from '../../three/useModel.ts';
import { Alert, asDataError, Card, FileInput, Figure, lucideByName, Stack, useUploader, type AddOnTranslate, type DataRow } from '../shared/host.ts';
import { ModelTurntable, storedModel } from '../shared/ShopModel3d.tsx';
import { refusal } from '../shared/refusal.ts';
import { useToast } from '../shared/toast.ts';
import { Drawing } from './Drawing.tsx';
import { mm, num, sizeOf, text } from './facts.ts';
import { FileRow, useStoredFacts } from './KitBase.tsx';
import { megabytes, MODEL_BYTES } from './kit.ts';

const Printer = lucideByName('printer');
const BoxIcon = lucideByName('box');

type Save = (values: Record<string, string | number | null>) => void;

/** Why a model to print was refused, in the shop's words. */
export function printRefusal(t: AddOnTranslate, file: string, problem: PrintRefused['problem'] | 'no-flat' | 'not-kind' | 'too-large'): string {
  switch (problem) {
    case 'too-large':
      return t('setup.print.tooBig', '{file}: That file is over 30 MB.', { file });
    case 'no-flat':
    case 'empty':
      return t('setup.print.noFlat', '{file}: This model has no flat face we can use here.', { file });
    case 'too-many':
    case 'too-big':
      return t('setup.print.tooMuch', '{file}: This 3MF holds more than a model to print can.', { file });
    case 'damaged':
      return t('setup.print.damaged', '{file}: This file is damaged. Export it again.', { file });
    default:
      return t('setup.print.notModel', '{file}: That isn’t an STL or 3MF file.', { file });
  }
}

/**
 * A picked model to print, checked as the step checks it: the problem, or
 * its size in millimetres (its box, its top up the z axis).
 */
export async function checkPrintFile(bytes: Uint8Array, size: number): Promise<{ problem: Parameters<typeof printRefusal>[2] } | { width: number; height: number; depth: number }> {
  if (size > MODEL_BYTES) return { problem: 'too-large' };
  if (!isStl(bytes) && !is3mf(bytes)) return { problem: 'not-kind' };
  try {
    const model = await readPrintModel(bytes);
    const tris = trianglesOfPrint(model);
    const survey = surveyOf(tris, '0');
    // A model too large to walk here is taken: its faces are then found where the pointer lands.
    if (survey !== null && survey.faces.length === 0) return { problem: 'no-flat' };
    const box = extent(tris);
    return { width: box.max[0] - box.min[0], height: box.max[1] - box.min[1], depth: box.max[2] - box.min[2] };
  } catch (caught) {
    if (caught instanceof PrintRefused) return { problem: caught.problem };
    throw caught;
  }
}

const tenth = (value: number): number => Math.round(value * 10) / 10;

export function PrintedFields({ t, base, save }: { t: AddOnTranslate; base: DataRow; save: Save }): ReactNode {
  return (
    <>
      <PrintModel t={t} base={base} save={save} />
      <PreviewModel t={t} base={base} />
    </>
  );
}

/** One of the two files: its card, its row once it is in, and its upload. */
function ModelCard({ t, title, limits, empty, icon, rowName, uploadLabel, accept, has, name, size, busy, error, disabled, pick }: { t: AddOnTranslate; title: string; limits: string; empty: string; icon: ReactNode; rowName: string; uploadLabel: string; accept: string; has: boolean; name: string | null; size: number | null; busy: boolean; error: string | null; disabled: boolean; pick: (event: ChangeEvent<HTMLInputElement>) => void }): ReactNode {
  return (
    <Card title={title} description={<Figure>{limits}</Figure>}>
      <Stack gap="md">
        {has ? (
          <ul className="m-0 list-none p-0">
            <FileRow number="" icon={icon} name={rowName} file={name} meta={size === null ? '' : megabytes(size)} />
          </ul>
        ) : (
          <p className="m-0 text-[12.5px] text-fg-muted">{empty}</p>
        )}
        <FileInput type="file" accept={accept} label={has ? t('setup.outline.replace', 'Replace') : uploadLabel} disabled={disabled || busy} error={error ?? undefined} onChange={pick} />
      </Stack>
    </Card>
  );
}

function PrintModel({ t, base, save }: { t: AddOnTranslate; base: DataRow; save: Save }): ReactNode {
  const upload = useUploader('bases', 'print_file');
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<{ name: string; size: number } | null>(null);
  const stored = useStoredFacts(base['print_file']);
  const pick = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file === undefined || upload === null) return;
    setBusy(true);
    try {
      const checked = await checkPrintFile(file.size > MODEL_BYTES ? new Uint8Array(0) : new Uint8Array(await file.arrayBuffer()), file.size);
      if ('problem' in checked) return setError(printRefusal(t, file.name, checked.problem));
      await upload.upload(base['id'] as string | number, file, { name: file.name });
      setError(null);
      setPicked({ name: file.name, size: file.size });
      // The item's size is its model's: across, down and its depth, as the stage's labels say it.
      save({ width_mm: tenth(checked.width), height_mm: tenth(checked.height), thickness_mm: tenth(checked.depth), ...(text(base['material']) === '' ? { material: 'PLA' } : {}) });
      toast(t('setup.kit.addedOne', 'File added.'));
    } catch (caught) {
      setError(t('setup.outline.refused', '{file}: {why}', { file: file.name, why: asDataError(caught).message || refusal(t, asDataError(caught)).message }));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      {upload === null ? <Alert tone="warn" title={t('setup.upload.none', 'Uploading here needs a newer Adminium.')} body={t('setup.upload.noneBody', 'Ask whoever runs Adminium to update it. Everything else on this page works now.')} /> : null}
      <ModelCard
        t={t}
        title={t('setup.print.model', 'The model to print')}
        limits={t('setup.print.modelLimits', 'STL or 3MF · up to 30 MB')}
        empty={t('setup.print.modelEmpty', 'The file the printer gets.')}
        icon={<Printer className="size-[15px]" aria-hidden="true" />}
        rowName={t('setup.print.forPrinter', 'For the printer')}
        uploadLabel={t('setup.kit.uploadModel', 'Upload the model')}
        accept=".stl,.3mf"
        has={text(base['print_file']) !== ''}
        name={picked?.name ?? stored.name}
        size={picked?.size ?? stored.size}
        busy={busy}
        error={error}
        disabled={upload === null}
        pick={(event) => void pick(event)}
      />
    </>
  );
}

function PreviewModel({ t, base }: { t: AddOnTranslate; base: DataRow }): ReactNode {
  const upload = useUploader('bases', 'model_file');
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<{ name: string; size: number } | null>(null);
  const stored = useStoredFacts(base['model_file']);
  const pick = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file === undefined || upload === null) return;
    if (file.size > MODEL_BYTES) return setError(t('setup.kit.modelTooBig', '{file}: That file is over 30 MB.', { file: file.name }));
    const bytes = await file.arrayBuffer();
    // A GLB says its own length in its header: the whole file is read for it.
    if (!isGlb(new Uint8Array(bytes))) return setError(t('setup.kit.notGlb', '{file}: That isn’t a GLB model.', { file: file.name }));
    setBusy(true);
    try {
      let flat = 1;
      try {
        flat = (await (await loadThree()).modelFacts(bytes, 'glb')).flat;
      } catch {
        return setError(t('setup.print.unreadable', '{file}: This GLB can’t be read here. Export it again without Draco or meshopt packing.', { file: file.name }));
      }
      if (flat === 0) return setError(printRefusal(t, file.name, 'no-flat'));
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
    <ModelCard
      t={t}
      title={t('setup.print.preview', 'The preview model')}
      limits={t('setup.kit.modelLimits', 'GLB · up to 30 MB')}
      empty={t('setup.print.previewEmpty', 'A lighter GLB the shopper’s preview uses.')}
      icon={<BoxIcon className="size-[15px]" aria-hidden="true" />}
      rowName={t('setup.print.forPreview', 'For the preview')}
      uploadLabel={t('setup.print.uploadPreview', 'Upload the preview')}
      accept=".glb"
      has={text(base['model_file']) !== ''}
      name={picked?.name ?? stored.name}
      size={picked?.size ?? stored.size}
      busy={busy}
      error={error}
      disabled={upload === null}
      pick={(event) => void pick(event)}
    />
  );
}

/**
 * How the preview model lies over the model to print, once both are read:
 * none until then, or where either cannot be read.
 */
export function usePreviewFit(base: DataRow): ReturnType<typeof align> | null {
  const printBytes = useModelBytes(storedModel(base['print_file'], 'stl'));
  const previewBytes = useModelBytes(storedModel(base['model_file'], 'glb'));
  const [fit, setFit] = useState<{ key: string; fit: ReturnType<typeof align> | null } | null>(null);
  const key = `${text(base['print_file'])}|${text(base['model_file'])}`;
  useEffect(() => {
    if (!(printBytes instanceof ArrayBuffer) || !(previewBytes instanceof ArrayBuffer)) return;
    let alive = true;
    void (async () => {
      try {
        const print = extent(trianglesOfPrint(await readPrintModel(new Uint8Array(printBytes))));
        const preview = await (await loadThree()).modelFacts(previewBytes, 'glb');
        if (alive) setFit({ key, fit: align(print, preview) });
      } catch {
        if (alive) setFit({ key, fit: null });
      }
    })();
    return () => {
      alive = false;
    };
  }, [key, printBytes, previewBytes]);
  return fit?.key === key ? fit.fit : null;
}

/** The printed item's preview: its preview model turned, else its model to print, else the item drawn flat. */
export function PrintedPreview({ t, base }: { t: AddOnTranslate; base: DataRow }): ReactNode {
  const preview = storedModel(base['model_file'], 'glb');
  const print = storedModel(base['print_file'], 'stl');
  const facts = useStoredFacts(preview === null ? base['print_file'] : base['model_file']);
  const fit = usePreviewFit(base);
  const size = sizeOf(base);
  const depth = num(base['thickness_mm']);
  const builtIn = <Drawing kind="piece" size={size} corner={num(base['corner_mm']) ?? 0} label={t('setup.piece.alt', '{name}, drawn flat', { name: text(base['name']) })} />;
  const source = preview ?? print;
  const meta = <Figure>{size.width > 0 && depth !== null ? t('setup.piece.meta', '{w} × {h} × {d} mm', { w: mm(size.width), h: mm(size.height), d: mm(depth) }) : (facts.name ?? t('setup.print.noPreview', 'no preview yet'))}</Figure>;
  return (
    <Stack gap="sm">
      {source === null ? (
        <div className="flex flex-col gap-2">
          <div className="relative grid aspect-square place-items-center overflow-hidden rounded-2xl border border-border bg-surface-3 p-3">{builtIn}</div>
          <div className="flex justify-end">
            <Figure>{t('setup.print.noPreview', 'no preview yet')}</Figure>
          </div>
        </div>
      ) : (
        <ModelTurntable t={t} kind="printed" source={source} fileName={facts.name ?? t('setup.kit.theModel', 'the model')} label={t('setup.preview.alt', '{name} preview', { name: text(base['name']) })} meta={meta} fallback={builtIn} />
      )}
      {fit !== null && fit.misfit > MISFIT ? (
        <Alert tone="warn" title={t('setup.print.misfit', 'The two models aren’t the same shape')} body={t('setup.print.misfitBody', 'Words on a marked face may sit in the wrong place on the preview. Export the preview from the same model you print.')} />
      ) : null}
    </Stack>
  );
}
