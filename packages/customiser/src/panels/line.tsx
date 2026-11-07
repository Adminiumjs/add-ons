/**
 * THE PANEL ON AN ORDER LINE: "Customising".
 *
 * Drawn in a tab of the record page of an app's order line, which links to
 * the customer's design (`rules.addOnLink` into `designs`). It shows the
 * design as it will be made, drawn flat from its newest version (both sides
 * of a page, as printed; a piece as cut), what the customer chose for each
 * part, and where it stands. From here the shop makes, in this browser:
 *
 * - **the proof** of the newest version (an A4 PDF of a page, a picture of a
 *   piece), kept on the version for the app's proof sheet to send;
 * - **the files**: a print PDF a side for the press, an SVG a piece for the
 *   laser, a 3MF for a 3D-printed item's printer (the model with the words
 *   raised or cut in), kept as the version's files and listed to download.
 *
 * Below, the versions in turn, newest first, the older ones greyed: each
 * order snapshots one, and the shop's proofs are made of them. Whether a
 * proof is waiting, approved or asked to change is the app's own record of
 * the proof it sent; the panel never changes the design itself.
 */
import { useState, type ReactNode } from 'react';

import type { CatalogueRows, DesignData } from '../browser/api.ts';
import { SharedContext, sharedFor } from '../browser/ui/context.tsx';
import { Drawing } from '../browser/ui/Drawing.tsx';
import type { Upload } from '../browser/ui/pictures.ts';
import { sidesMade } from '../draw/flat.ts';
import { layoutsOf } from '../rules/design.ts';
import { FontMissing } from '../draw/pdf.ts';
import { Alert, asDataError, Button, Card, EmptyState, Figure, KeyValueList, lucideByName, Stack, StatusPill, useAccess, useLocaleTag, useRecord, useRecords, useUploader, useWrite, type AddOnTranslate, type DataRow, type DataValue } from '../pages/shared/host.ts';
import { wordsFor } from '../pages/shared/messages.ts';
import { refusal } from '../pages/shared/refusal.ts';
import { fileAddress, fileIdOf } from '../pages/shared/stored.ts';
import { useToast } from '../pages/shared/toast.ts';
import { jsonOf, kindOf, mm, text } from '../pages/setup/facts.ts';
import { PANEL, SETUP, SHARED } from '../pages/strings/index.ts';
import { catalogueFor, fileStem, fontBook, makeLaserFiles, pieceSheetFor, makePageProof, makePieceProof, makePrintFiles, picturesOf, sheetsFor, valuesOf, type Made, type MakeWords } from './make.ts';
import { makePrintedFile, PrintedRefused, reliefOfFace } from './printed.ts';
import type { PanelProps } from './product.tsx';
import { hiddenColumns, isForbidden, LINE_READS, mayMake, unreadTables } from './rights.ts';
import { KitViews, PieceViews, PrintedViews } from './views.tsx';

const t = wordsFor(SHARED, SETUP, PANEL);

const ImageIcon = lucideByName('image');
const FileDown = lucideByName('file-down');
const Download = lucideByName('download');
const FileText = lucideByName('file-text');
const FileCode = lucideByName('file-code-2');
const LockKeyhole = lucideByName('lock-keyhole');
const TriangleAlert = lucideByName('triangle-alert');

/** A moment as people read it, with its weekday: "Thu 6 Aug 2026 · 16:12". */
export function moment(value: unknown, locale: string): string {
  const at = typeof value === 'string' || typeof value === 'number' ? new Date(value) : null;
  if (at === null || Number.isNaN(at.getTime())) return '';
  const day = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(at);
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(at);
  return `${day} · ${time}`;
}

/** What the shopper chose for one part, in a line: the words, the font, the size, the finish; or that they left it plain. */
export function choiceLine(t: AddOnTranslate, value: unknown, unit: 'mm' | 'pt', finishName: (code: string) => string): string {
  if (typeof value !== 'object' || value === null) return t('panel.line.plain', 'left plain');
  const chosen = value as Record<string, unknown>;
  const out: string[] = [];
  if (typeof chosen['text'] === 'string' && chosen['text'] !== '') out.push(t('panel.line.words', '“{words}”', { words: chosen['text'] }));
  if (typeof chosen['file'] === 'string' && chosen['file'] !== '') out.push(t('panel.line.logo', 'their own logo'));
  if (typeof chosen['choice'] === 'string') out.push(chosen['choice']);
  if (typeof chosen['colour'] === 'string') out.push(chosen['colour']);
  if (out.length === 0) return t('panel.line.plain', 'left plain');
  if (typeof chosen['font'] === 'string') out.push(chosen['font']);
  if (typeof chosen['size'] === 'number') out.push(`${mm(chosen['size'])} ${unit}`);
  if (typeof chosen['finish'] === 'string') out.push(finishName(chosen['finish']));
  return out.join(' · ');
}

const all = { pageSize: 199 } as const;
const by = (column: string, value: DataValue, enabled = true) => ({ filter: [{ column, op: 'eq' as const, value }], sort: [{ column: 'position', direction: 'asc' as const }], pageSize: 199, enabled });

/** The English a sentence is written in, its values filled: what a file says where its font has no letters for the reader's language. */
const english: AddOnTranslate = ((_key: string, words: string, vars?: Readonly<Record<string, unknown>>) => words.replace(/\{(\w+)\}/g, (whole, name: string) => (vars?.[name] === undefined ? whole : String(vars[name])))) as AddOnTranslate;

/** What a laser's file left out, as its row keeps it: `[{column, kind}]`. */
function leftOutOf(raw: unknown): { column: string; kind: string }[] {
  const value = typeof raw === 'string' ? (() => { try { return JSON.parse(raw) as unknown; } catch { return null; } })() : raw;
  if (!Array.isArray(value)) return [];
  return value.flatMap((one) => (typeof one === 'object' && one !== null && typeof (one as { column?: unknown }).column === 'string' ? [{ column: String((one as { column: string }).column), kind: String((one as { kind?: unknown }).kind ?? '') }] : []));
}

/** Why a customer's picture is not in a laser's file, and where the shop engraves it from. */
function leftOutWords(t: AddOnTranslate, left: { column: string; kind: string }): string {
  if (left.column === 'photo_file') return t('panel.files.leftPhoto', 'The photo is a picture, so it is not in the cut file: engrave it from the shopper’s photo.');
  if (left.kind === 'pdf') return t('panel.files.leftLogoPdf', 'The logo is a PDF, so it is not in the cut file: engrave it from the shopper’s logo.');
  return t('panel.files.leftLogo', 'The logo is a picture, so it is not in the cut file: engrave it from the shopper’s logo.');
}

/** How a printed item's words are made: "raised 1 mm", "cut in 1.5 mm". */
function howWords(t: AddOnTranslate, mode: 'raised' | 'cut', depth: string): string {
  return mode === 'raised' ? t('panel.files.raised', 'raised {n} mm', { n: depth }) : t('panel.files.cutIn', 'cut in {n} mm', { n: depth });
}

/** Why a printed item's 3MF could not be made, and what the shop does about it. */
function printedProblem(t: AddOnTranslate, problem: PrintedRefused['problem']): string {
  switch (problem) {
    case 'no-model':
      return t('panel.make.noPrintModel', 'Upload the model to print in the set-up first.');
    case 'no-face':
      return t('panel.make.noPrintFace', 'Mark a face for the words in the set-up first.');
    case 'empty':
      return t('panel.make.noWords', 'There are no words or drawn logo to raise or cut in.');
    case 'off-face':
      return t('panel.make.offFace', 'The words run off the marked face or too near its edge. Make them smaller or shorter, or mark a bigger face.');
    case 'no-room':
      return t('panel.make.noRoom', 'The model is too thin under the words for that depth, or something stands over them. Choose a smaller depth in the set-up.');
    default:
      return t('panel.make.unreadable', 'The model to print can’t be read here. Upload it again in the set-up.');
  }
}

/** What a reader short of a right is told to ask for: the Customiser's own roles, by the names Studio shows them under. */
export function rolesHint(t: AddOnTranslate): string {
  return t('panel.rights.roles', 'The Customiser reader role shows it all; the Customiser designer role also makes the proof and the files.');
}

/** The Customiser's tables a reader may not read, in a line: "fonts, palettes". */
export function unreadLine(t: AddOnTranslate, tables: readonly string[]): string {
  return t('panel.rights.tables', 'Your role can’t read {tables} in the Customiser, so this is shown without them.', { tables: tables.join(', ') });
}

/** The words the files and the proof say, in the reader's language. */
function makeWords(t: AddOnTranslate, design: string, version: number, spec: string): MakeWords {
  return {
    side: (side) => (side === 'front' ? t('panel.files.front', 'Front') : t('panel.files.back', 'Back')),
    printAbout: (size) => t('panel.files.printAbout', '{page} mm page · trim {trim} · {bleed} mm bleed · crop marks', size),
    pieceAbout: (name, size) => `${name} · ${size}`,
    proof: { title: t('panel.proof.title', 'Proof of {design} · version {n}', { design, n: String(version) }), spec, note: t('panel.proof.note', 'The red line is where it is cut; the colour runs past it. Keep words inside the blue dashed line. A person at the works checked this design.') },
    slug: (side) => `${design} · v${String(version)} · ${side}`,
  };
}

export function LinePanel({ t, linked }: { t: AddOnTranslate } & PanelProps): ReactNode {
  const locale = useLocaleTag();
  const access = useAccess();
  const toast = useToast();
  const design = useRecord('designs', linked);
  const row = design.row;
  const readyId = row === null ? null : (row['ready_design_id'] as string | number | null);
  const baseId = row === null ? null : (row['base_id'] as string | number | null);
  const ready = useRecord('ready_designs', readyId ?? null);
  const base = useRecord('bases', baseId ?? (ready.row === null ? null : (ready.row['base_id'] as string | number)));
  const baseKey = base.row === null ? null : (base.row['id'] as string | number);
  const parts = useRecords('ready_parts', by('ready_design_id', readyId, readyId !== null));
  const areas = useRecords('base_areas', by('base_id', baseKey, baseKey !== null));
  const pieces = useRecords('base_pieces', by('base_id', baseKey, baseKey !== null));
  const palettes = useRecords('palettes', { ...all, enabled: row !== null });
  const colours = useRecords('palette_colours', { ...all, enabled: row !== null });
  const fonts = useRecords('fonts', { ...all, enabled: row !== null });
  const features = useRecords('features', { ...all, enabled: row !== null });
  // The shop's starting line for a one-colour logo the customer left as it was; a role that may not read the settings is given the column's own default.
  const settings = useRecords('settings', { pageSize: 1, enabled: row !== null && access.ready && access.canRead('settings') });
  const versions = useRecords('design_versions', { filter: [{ column: 'design_id', op: 'eq', value: linked }], sort: [{ column: 'version', direction: 'desc' }], pageSize: 50, enabled: linked !== null });
  const latest = versions.rows[0];
  const files = useRecords('version_files', { ...by('version_id', latest === undefined ? null : (latest['id'] as string | number), latest !== undefined), pageSize: 199 });
  const versionWrite = useWrite('design_versions');
  const fileWrite = useWrite('version_files');
  const proofUpload = useUploader('design_versions', 'proof_file');
  const fileUpload = useUploader('version_files', 'file');
  const [busy, setBusy] = useState<'proof' | 'files' | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  // A role that may not read the designs at all is told so, never that the line has none.
  if (linked !== null && ((access.ready && !access.canRead('designs')) || isForbidden(design.error?.code))) {
    return <EmptyState title={t('panel.rights.noDesign', 'You can’t see this design')} body={`${t('panel.rights.noDesignBody', 'Your role does not let you read the Customiser’s designs.')} ${rolesHint(t)}`} />;
  }
  if (linked === null || (!design.loading && row === null)) return <EmptyState title={t('panel.line.none', 'No design on this line')} body={t('panel.line.noneBody', 'A line carries a design when the shopper ordered one they made.')} />;
  // A base the role may not read: nothing can be drawn, and the panel says why rather than loading for ever.
  if (row !== null && base.row === null && ((access.ready && !access.canRead('bases')) || isForbidden(base.error?.code))) {
    return <EmptyState title={t('panel.rights.partTitle', 'Part of this design is hidden from you')} body={`${unreadLine(t, unreadTables(access, LINE_READS).length > 0 ? unreadTables(access, LINE_READS) : ['bases'])} ${rolesHint(t)}`} />;
  }
  if (row === null || base.row === null) return <EmptyState title={t('panel.loading', 'Loading')} />;

  // What this reader's role leaves out: tables it may not read, and the customer's personal columns.
  const unread = unreadTables(access, LINE_READS);
  const hidden = [...new Set([...hiddenColumns(row), ...hiddenColumns(latest)])].filter((column) => column === 'values' || column === 'logo_file' || column === 'photo_file');
  const whole = unread.length === 0 && hidden.length === 0;
  const makes = whole && mayMake(access, latest !== undefined);
  const kind = kindOf(base.row);
  const page = kind === 'page';
  const printed = kind === 'printed';
  const unit = page ? 'pt' : 'mm';
  // The newest version is what is made; a design no line snapshotted yet is drawn as it stands.
  const values = valuesOf(latest?.['values'] ?? row['values']) ?? { parts: {} };
  const versionNo = latest === undefined ? 1 : Number(latest['version']);
  const chosen = (jsonOf(row['values'])['parts'] ?? {}) as Record<string, unknown>;
  // The parts of the layout the design is in: a design of two layouts names each of its parts once.
  const layout = values.layout ?? layoutsOf(ready.row)[0] ?? null;
  const named: DataRow[] = readyId === null ? [...areas.rows] : parts.rows.filter((part) => part['locked'] !== true && part['kind'] !== 'shape' && (layout === null || text(part['layout']) === '' || text(part['layout']) === layout));
  const finishName = (code: string): string => text(colours.rows.find((one) => text(one['code']) === code)?.['name']) || code;
  const proofOf = (version: DataRow | undefined): boolean => version !== undefined && text(version['proof_file']) !== '';
  const rows: CatalogueRows = { bases: [base.row], pieces: [...pieces.rows], areas: [...areas.rows], ready: ready.row === null ? [] : [ready.row], parts: [...parts.rows], fonts: [...fonts.rows], palettes: [...palettes.rows], colours: [...colours.rows], features: [...features.rows] };
  const catalogue = catalogueFor(rows, baseKey!);
  const data: DesignData = { base_id: baseKey!, ready_design_id: readyId, values };
  const designName = ready.row === null ? t('panel.line.plainPiece', 'The plain piece') : text(ready.row['name']);
  // The customer's own files, drawn from the dashboard's own copy.
  const pictures: Record<string, Upload> = {};
  for (const column of ['logo_file', 'photo_file']) {
    const id = fileIdOf(row[column]);
    if (id !== null) pictures[column] = { id, name: '', size: 0, kind: '', url: fileAddress(row[column])!, fresh: false };
  }
  const hasLogo = pictures['logo_file'] !== undefined;
  const shared = sharedFor(locale, page ? 'print' : 'maker', '');
  const sides = catalogue === null ? [] : sidesMade(catalogue, data);
  const size = `${mm(Number(base.row['width_mm']))} × ${mm(Number(base.row['height_mm']))} mm`;
  const spec = `${text(base.row['name'])}, ${size}, ${sides.length > 1 ? t('panel.proof.both', 'both sides') : t('panel.proof.one', 'one side')}`;
  const words: MakeWords = { ...makeWords(t, designName, versionNo, spec), english: makeWords(english, designName, versionNo, `${text(base.row['name'])}, ${size}, ${sides.length > 1 ? 'both sides' : 'one side'}`) };

  /** The newest version, made now from the design where no order snapshotted one yet. */
  const versionNow = async (): Promise<DataRow> => {
    if (latest !== undefined) return latest;
    const { row: made } = await versionWrite.create({ app: row['app'] as DataValue, design_id: row['id'] as DataValue, version: 1, values: JSON.stringify(values) });
    return made;
  };

  const fail = (caught: unknown): void => {
    if (caught instanceof RemoveRefused) setProblem(t('panel.rights.again', 'Making the files again replaces the version’s files, and your role may not remove them. That needs the Customiser designer role.'));
    else if (caught instanceof PrintedRefused) setProblem(printedProblem(t, caught.problem));
    else if (caught instanceof FontMissing) setProblem(t('panel.make.noFont', 'The files need the font file of {families}. Upload it in Fonts & finishes, then make them again.', { families: caught.families.join(', ') }));
    else setProblem(refusal(t, asDataError(caught)).message);
  };

  const makeProof = async (): Promise<void> => {
    if (catalogue === null || proofUpload === null || !makes) return;
    setBusy('proof');
    setProblem(null);
    try {
      const version = await versionNow();
      const stem = fileStem(row['id'] as string | number, Number(version['version']));
      const held = await picturesOf(row);
      const sheets = sheetsFor(catalogue, data, (column) => held.pdf[column] !== undefined || pictures[column] !== undefined);
      let blob: Blob | null;
      let name: string;
      if (page) {
        const book = fontBook(catalogue);
        await book.load(new Set(sheets.flatMap((sheet) => sheet.items.flatMap((item) => (item.kind === 'text' ? [item.font] : []))).concat(catalogue.fonts.slice(0, 1).map((one) => one.family))));
        const labelFont = book.font(sheets.flatMap((sheet) => sheet.items).find((item) => item.kind === 'text')?.font ?? catalogue.fonts[0]?.family ?? '', 700);
        blob = await makePageProof(sheets, { font: book.font, pictures: held.pdf }, words, labelFont);
        name = `${stem}-proof.pdf`;
      } else {
        blob = await makePieceProof(sheets[0]!, row, Number(settings.rows[0]?.['one_colour_threshold'] ?? 50) || 50);
        name = `${stem}-proof.png`;
      }
      if (blob === null) {
        setProblem(t('panel.make.noPaint', 'The proof picture couldn’t be drawn in this browser. Try again in another.'));
        return;
      }
      await proofUpload.upload(version['id'] as string | number, blob, { name });
      toast(page ? t('panel.make.proofMade', 'The proof is made. The send-a-proof sheet attaches it.') : t('panel.make.proofPicture', 'The proof picture is made from the saved design. The send-a-proof sheet attaches it.'));
      versions.refetch?.();
    } catch (caught) {
      fail(caught);
    } finally {
      setBusy(null);
    }
  };

  const makeFiles = async (): Promise<void> => {
    if (catalogue === null || fileUpload === null || !makes) return;
    setBusy('files');
    setProblem(null);
    try {
      const version = await versionNow();
      const stem = fileStem(row['id'] as string | number, Number(version['version']));
      const held = await picturesOf(row);
      const sheets = sheetsFor(catalogue, data, (column) => held.pdf[column] !== undefined);
      const book = fontBook(catalogue);
      await book.load(new Set(sheets.flatMap((sheet) => sheet.items.flatMap((item) => (item.kind === 'text' ? [item.font] : [])))));
      const raise = (name: string, said: string, mode: 'raised' | 'cut', depth: string): string => t('panel.files.printedAbout', '{name} — “{words}” {how}', { name, words: said, how: howWords(t, mode, depth) });
      const made: Made[] = printed
        ? [await makePrintedFile(catalogue, data, book.font, held.svg, (column) => held.pdf[column] !== undefined, stem, { about: raise })]
        : page
          ? await makePrintFiles(sheets, { font: book.font, pictures: held.pdf }, stem, words, book.font(catalogue.fonts[0]?.family ?? '', 400)) : await makeLaserFiles(catalogue, sheets[0]!, book.font, held.svg, stem, words, undefined, pieceSheetFor(catalogue, data, (column) => held.pdf[column] !== undefined));
      // Making them again replaces what the version had.
      for (const old of files.rows) {
        try {
          await fileWrite.remove(old['id'] as string | number);
        } catch (refused) {
          throw isForbidden(asDataError(refused).code) ? new RemoveRefused() : refused;
        }
      }
      for (const [position, one] of made.entries()) {
        const leftOut = one.leftOut.map((column) => ({ column, kind: held.pdf[column]?.kind ?? 'png' }));
        const { row: saved } = await fileWrite.create({ app: row['app'] as DataValue, version_id: version['id'] as DataValue, kind: one.kind, name: one.name, about: one.about, layers: one.layers === null ? null : JSON.stringify(one.layers), left_out: leftOut.length === 0 ? null : JSON.stringify(leftOut), position: position + 1 });
        await fileUpload.upload(saved['id'] as string | number, one.blob, { name: one.name });
      }
      toast(page ? t('panel.make.printMade', 'The print files are made, one per side.') : t('panel.make.filesMade', 'The files for the machine are made.'));
      files.refetch?.();
    } catch (caught) {
      fail(caught);
    } finally {
      setBusy(null);
    }
  };

  const downloadAll = (): void => {
    for (const one of files.rows) {
      const address = fileAddress(one['file']);
      if (address === null) continue;
      const link = document.createElement('a');
      link.href = address;
      link.download = text(one['name']);
      document.body.append(link);
      link.click();
      link.remove();
    }
  };

  const firstFace = catalogue?.base.faces[0];
  const printedHow = printed && catalogue !== null && firstFace !== undefined ? reliefOfFace(catalogue, firstFace) : null;
  const proofed = proofOf(latest);
  return (
    <Card
      title={t('panel.title', 'Customising')}
      description={t('panel.line.sub', 'read-only')}
      actions={<StatusPill status={proofed ? 'proof' : 'none'} tone={proofed ? 'info' : 'neutral'}>{proofed ? t('panel.line.proof', 'Proof {n}', { n: String(latest!['version']) }) : t('panel.line.noProof', 'No proof yet')}</StatusPill>}
    >
      <Stack gap="md">
        {whole ? null : (
          <Alert
            tone="warn"
            role="status"
            title={t('panel.rights.partTitle', 'Part of this design is hidden from you')}
            body={[...(hidden.length > 0 ? [t('panel.rights.personal', 'Your role can’t read the customer’s words, logo and photo, so the design is drawn without them.')] : []), ...(unread.length > 0 ? [unreadLine(t, unread)] : []), rolesHint(t)].join(' ')}
          />
        )}
        {catalogue === null ? null : (
          <SharedContext.Provider value={shared}>
            {kind === 'kit' ? (
              <KitViews t={t} catalogue={catalogue} design={data} pictures={pictures} label={t('panel.line.drawn', '{design}, as it will be made', { design: designName })} />
            ) : printed ? (
              <PrintedViews t={t} catalogue={catalogue} design={data} pictures={pictures} label={t('panel.line.drawn', '{design}, as it will be made', { design: designName })} flat={<Drawing catalogue={catalogue} design={data} empty="hide" pictures={pictures} className="w-full" label={t('panel.line.drawn', '{design}, as it will be made', { design: designName })} />} />
            ) : kind === 'piece' ? (
              <PieceViews t={t} catalogue={catalogue} design={data} pictures={pictures} label={t('panel.line.drawn', '{design}, as it will be made', { design: designName })} flat={<Drawing catalogue={catalogue} design={data} empty="hide" pictures={pictures} className="w-full" label={t('panel.line.drawn', '{design}, as it will be made', { design: designName })} />} />
            ) : (
            <div className="flex flex-wrap gap-3" data-design-sides="">
              {sides.map((side) => (
                <div key={side} className="flex min-w-0 flex-1 flex-col gap-1.5">
                  {page ? <span className="text-[11.5px] font-extrabold text-fg-subtle">{words.side(side)}</span> : null}
                  <div className="rounded-xl border border-border bg-surface-3 p-3">
                    <Drawing catalogue={catalogue} design={data} side={side} empty="hide" pictures={pictures} className="w-full" label={t('panel.line.drawn', '{design}, as it will be made', { design: designName }) + (page ? ` · ${words.side(side)}` : '')} />
                  </div>
                </div>
              ))}
            </div>
            )}
          </SharedContext.Provider>
        )}
        <KeyValueList
          items={[
            { label: t('panel.line.design', 'Design'), value: designName, mono: true },
            ...named.map((part) => ({ label: text(part['name']), value: choiceLine(t, chosen[text(part['code'])], unit, finishName), mono: true })),
            { label: t('panel.line.state', 'State'), value: row['state'] === 'ordered' ? t('panel.line.ordered', 'Ordered') : t('panel.line.saved', 'Saved'), mono: true },
            { label: t('panel.line.savedAs', 'Saved as'), value: t('panel.line.savedAt', 'designs / {id} · {at}', { id: String(row['id']), at: moment(row['updated_at'], locale) }), mono: true },
          ]}
        />
        {hasLogo ? (
          <p className="m-0 flex items-center gap-2 text-[12px] text-fg-subtle">
            <LockKeyhole />
            {t('panel.line.private', 'The shopper’s logo is private to them and the shop.')}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" iconLeft={<ImageIcon />} disabled={busy !== null || proofUpload === null || !makes} onClick={() => void makeProof()}>
            {busy === 'proof' ? t('panel.make.making', 'Making the file…') : t('panel.make.proof', 'Make the proof')}
          </Button>
          <Button variant="secondary" iconLeft={<FileDown />} disabled={busy !== null || fileUpload === null || !makes} onClick={() => void makeFiles()}>
            {busy === 'files' ? t('panel.make.making', 'Making the file…') : page ? t('panel.make.print', 'Make the print file') : files.rows.length > 0 ? t('panel.make.again', 'Make the files again') : t('panel.make.files', 'Make the files')}
          </Button>
        </div>
        {proofUpload === null || fileUpload === null ? <p className="m-0 text-[12.5px] text-fg-muted">{t('panel.make.newer', 'Making files here needs a newer Adminium.')}</p> : null}
        {proofUpload !== null && fileUpload !== null && !makes ? <p className="m-0 text-[12.5px] text-fg-muted">{whole ? t('panel.rights.make', 'Making the proof and the files needs the Customiser designer role.') : t('panel.rights.makeWhole', 'The proof and the files are made only from the whole design, which your role can’t read.')}</p> : null}
        {problem === null ? null : (
          <p role="alert" className="m-0 text-[12.5px] text-danger">
            {problem}
          </p>
        )}
        <section aria-labelledby="customiser-proofs" className="flex flex-col gap-2">
          <h3 id="customiser-proofs" className="m-0 text-[12.5px] font-extrabold">
            {t('panel.proofs.title', 'Proofs')}
          </h3>
          {versions.rows.length === 0 ? <p className="m-0 text-[12.5px] text-fg-muted">{t('panel.proofs.none', 'No proof sent yet.')}</p> : null}
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {versions.rows.map((version, index) => {
              const address = fileAddress(version['proof_file']);
              return (
                <Version key={String(version['id'])} newest={index === 0}>
                  <span className="font-mono font-extrabold">{`v${String(version['version'])}`}</span>
                  <StatusPill status={address === null ? 'none' : index === 0 ? 'proof' : 'replaced'} tone={address === null ? 'neutral' : index === 0 ? 'info' : 'neutral'}>
                    {address === null ? t('panel.proofs.notMade', 'No proof made') : index === 0 ? t('panel.proofs.made', 'Proof made') : t('panel.proofs.replaced', 'Replaced')}
                  </StatusPill>
                  <span className="flex-1 text-fg-muted">{text(version['note']) || (version['receipt_id'] === null || version['receipt_id'] === undefined ? t('panel.proofs.byShop', 'Made by the shop.') : t('panel.proofs.ordered', 'Snapshotted when the order was placed.'))}</span>
                  <span className="font-mono text-[11px] text-fg-subtle">{moment(version['made_at'], locale)}</span>
                  {address === null ? null : (
                    <a href={address} download className="font-bold text-accent">
                      {t('panel.proofs.open', 'Open the proof')}
                    </a>
                  )}
                </Version>
              );
            })}
          </ul>
        </section>
        {files.rows.length === 0 ? (
          <p className="m-0 text-[12.5px] text-fg-muted">{t('panel.line.files', 'The files for the machine are listed here once they are made.')}</p>
        ) : (
          <section aria-labelledby="customiser-files" className="overflow-hidden rounded-xl border border-border">
            <div className="flex flex-wrap items-center gap-2.5 border-b border-border px-4 py-3">
              <h3 id="customiser-files" className="m-0 text-[14px] font-extrabold">
                {page ? t('panel.files.press', 'Files for the press') : t('panel.files.machine', 'Files for the machine')}
              </h3>
              <span className="font-mono text-[11.5px] text-fg-subtle">{t('panel.files.count', '{n, plural, one {# file} other {# files}}', { n: files.rows.length })}</span>
              <span className="flex-1" />
              <Button variant="primary" size="sm" iconLeft={<Download />} onClick={downloadAll}>
                {t('panel.files.all', 'Download all')}
              </Button>
            </div>
            <ul className="m-0 list-none p-0">
              {files.rows.map((one) => {
                const layers = (() => {
                  const raw = typeof one['layers'] === 'string' ? (JSON.parse(one['layers']) as unknown) : one['layers'];
                  return Array.isArray(raw) ? raw.map(String) : [];
                })();
                const address = fileAddress(one['file']);
                const leftOut = leftOutOf(one['left_out']);
                return (
                  <li key={String(one['id'])} className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2.5">
                    {text(one['kind']) === 'print' ? <FileText /> : <FileCode />}
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="font-mono text-[12px] font-bold">{text(one['name'])}</span>
                      <span className="font-mono text-[12px] text-fg-subtle">{text(one['about'])}</span>
                      {leftOut.map((left) => {
                        const own = fileAddress(row[left.column]);
                        return (
                          <span key={left.column} className="flex flex-wrap items-center gap-2 text-[12px] text-warn">
                            <TriangleAlert />
                            {leftOutWords(t, left)}
                            {own === null ? null : (
                              <a href={own} download className="font-bold text-accent">
                                {left.column === 'photo_file' ? t('panel.files.getPhoto', 'Download the photo') : t('panel.files.getLogo', 'Download the logo')}
                              </a>
                            )}
                          </span>
                        );
                      })}
                    </span>
                    {layers.length === 0 ? null : (
                      <span className="flex flex-wrap gap-1">
                        {layers.map((layer) => (
                          <span key={layer} className="rounded-[10px] border border-border-strong px-1.5 font-mono text-[10px] font-bold text-fg-muted">
                            {layer}
                          </span>
                        ))}
                      </span>
                    )}
                    {address === null ? null : (
                      <a href={address} download={text(one['name'])} aria-label={t('panel.files.download', 'Download {name}', { name: text(one['name']) })} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border-strong px-3 py-1.5 text-[12px] font-bold">
                        <Download />
                        {t('panel.files.one', 'Download')}
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="m-0 bg-surface-2 px-4 py-2.5 text-[12.5px] text-fg-muted">
              {page
                ? t('panel.files.pressNote', 'It goes to press once the proof is approved.')
                : printedHow !== null
                  ? t('panel.files.printedNote', 'The 3MF holds the model with the words {how}, ready for the slicer.', { how: howWords(t, printedHow.mode, mm(printedHow.depth)) })
                  : t('panel.files.machineNote', 'Words and logos are outlines, so the laser needs no fonts.')}
            </p>
          </section>
        )}
        <Figure>{t('panel.line.foot', "read-only · made from the shopper's saved design")}</Figure>
      </Stack>
    </Card>
  );
}

/** The version's earlier files could not be removed: the reader's role may not delete them. */
class RemoveRefused extends Error {}

/** A version in the list: the newest as it is, an older one greyed (a proof it replaced). */
function Version({ newest, children }: { newest: boolean; children: ReactNode }): ReactNode {
  return newest ? <li className="flex flex-wrap items-center gap-2.5 text-[12.5px]">{children}</li> : <li className="flex flex-wrap items-center gap-2.5 text-[12.5px] text-fg-subtle">{children}</li>;
}

export default function Line(props: PanelProps): ReactNode {
  return <LinePanel t={t} {...props} />;
}
