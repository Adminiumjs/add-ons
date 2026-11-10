/**
 * A READY-MADE DESIGN'S PREVIEW PICTURE, MADE WHEN IT IS SHOWN TO CUSTOMERS.
 *
 * Each time the shop saves a design that customers see, its front is painted
 * as a customer's gallery card draws it (the shop's example words, in the
 * shop's fonts, each logo box empty) and kept in the design's
 * `preview_file`: the picture a list or a card shows without drawing the
 * design again. It is made from the rows as saved, read back, so the picture
 * is the design customers are served, not the screen it was edited on.
 *
 * A picture is the same in every language, so it carries no words of the
 * screen's own: an empty logo box is a dashed box, with no "Your logo" in it.
 */
import type { CatalogueRows } from '../../browser/api.ts';
import { freshValues, readCatalogue, readyOf } from '../../browser/catalogue.ts';
import { sheetPng } from '../../draw/canvas.ts';
import { flatSheet, type FlatSheet } from '../../draw/flat.ts';
import { listAll, useRead, useUploader, type DataRow, type DataValue } from '../shared/host.ts';
import { loadFamilies, shopFamily } from '../shared/stored.ts';

/** The longest side of the picture, in pixels: sharp on a gallery card twice its size on screen. */
export const PREVIEW_PIXELS = 800;

/** Paints a sheet as a PNG; the page's own canvas unless a test hands another. */
export type Painter = (sheet: FlatSheet) => Promise<Blob | null>;
const canvasPainter: Painter = (sheet) => sheetPng(sheet, PREVIEW_PIXELS);

/** The rows a ready-made design is drawn from, read as they were saved. */
export async function rowsOfDesign(read: ReturnType<typeof useRead>, base: DataRow, readyId: string | number): Promise<CatalogueRows> {
  const at = (column: string, value: DataValue) => ({ filter: [{ column, op: 'eq' as const, value }] });
  const [ready, parts, areas, pieces, palettes, colours, fonts, features] = await Promise.all([
    read.get('ready_designs', readyId),
    listAll(read, 'ready_parts', { ...at('ready_design_id', readyId), sort: [{ column: 'position', direction: 'asc' }] }),
    listAll(read, 'base_areas', at('base_id', base['id'] as DataValue)),
    listAll(read, 'base_pieces', at('base_id', base['id'] as DataValue)),
    listAll(read, 'palettes'),
    listAll(read, 'palette_colours'),
    listAll(read, 'fonts'),
    listAll(read, 'features'),
  ]);
  return { bases: [base], pieces, areas, ready: ready === null ? [] : [ready], parts, fonts, palettes, colours, features };
}

/** The design's front as its gallery card draws it, or none for a design that is not there. */
export function previewSheet(rows: CatalogueRows, baseId: string | number, readyId: string | number): FlatSheet | null {
  const catalogue = readCatalogue(rows, baseId);
  if (catalogue === null) return null;
  const ready = readyOf(catalogue, readyId);
  if (ready === null) return null;
  return flatSheet(catalogue, { base_id: baseId, ready_design_id: ready.id, values: freshValues(catalogue, ready) }, { side: 'front', empty: 'sample', labels: { logo: '', photo: '' } });
}

/**
 * Makes and keeps a shown design's preview picture. Answers what happened:
 * `made`; `skipped` where this Adminium or this page cannot make one (the
 * design then shows drawn); `failed` when the upload was refused.
 */
export function usePreviewPicture(paint: Painter = canvasPainter): (base: DataRow, readyId: string | number) => Promise<'made' | 'skipped' | 'failed'> {
  const read = useRead();
  const uploader = useUploader('ready_designs', 'preview_file');
  return async (base, readyId) => {
    if (uploader === null) return 'skipped';
    try {
      const rows = await rowsOfDesign(read, base, readyId);
      const sheet = previewSheet(rows, base['id'] as string | number, readyId);
      if (sheet === null) return 'skipped';
      const families = new Set(sheet.items.flatMap((item) => (item.kind === 'text' ? [item.font] : [])));
      await loadFamilies(rows.fonts.map((row) => ({ family: String(row['family'] ?? ''), file: row['file'] })), families);
      // Painted in the shop's files, loaded under the Customiser's own names: never the dashboard's face of a family.
      const png = await paint({ ...sheet, items: sheet.items.map((item) => (item.kind === 'text' ? { ...item, font: shopFamily(item.font) } : item)) });
      if (png === null) return 'skipped';
      await uploader.upload(readyId, png, { name: `preview-${String(readyId)}.png` });
      return 'made';
    } catch {
      return 'failed';
    }
  };
}
