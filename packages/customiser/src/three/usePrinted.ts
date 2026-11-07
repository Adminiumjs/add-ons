/**
 * A 3D-PRINTED ITEM WITH THE CUSTOMER'S WORDS STOOD UP ON IT: its preview
 * model (the shop's GLB), and on each face the shop marked, the words of
 * that face's sheet raised from it or cut into it, as the face says. The
 * face is the one marked on the model to print, laid on the preview
 * (`MarkedFace.preview`). No three.js in it: the stage stands the words up.
 *
 * Nothing here is shared with the stage's own file (it reads no geometry),
 * so the editor's file and the stage's stay apart.
 *
 * The whole model is shown in the plastic chosen (the item is printed in
 * one), not in the colour its GLB was exported in; a base with no colour
 * to choose keeps the GLB's own.
 *
 * The preview stands the words up from slices of their outline's picture,
 * not from the solid the 3MF holds: the solid needs the model to print,
 * which is the shop's own file and never sent to a visitor.
 */
import { useMemo } from 'react';

import type { Catalogue } from '../browser/catalogue.ts';
import type { DesignData } from '../browser/api.ts';
import { flatSheet, plasticOf, type FlatLabels } from '../draw/flat.ts';
import type { MarkedFace } from './faces.ts';
import { readRelief } from './faceStore.ts';
import { reliefCanvas, type ReliefLook } from './load.ts';
import type { Decal, ShopModel } from './shopModel.ts';
import { usePainted } from './usePiece.ts';
import { useShopModel, type ModelSource } from './useModel.ts';

/**
 * How a printed item's words sit on a face: the face's own say, else the
 * rules of the area on it (or, with no face marked, of the base's first
 * area that says), else raised 1 mm, the comp's.
 */
export function reliefOf(catalogue: Catalogue, face?: MarkedFace): ReliefLook {
  if (face?.relief !== undefined) return { mode: face.relief.mode, depth: face.relief.depth };
  for (const area of catalogue.rows.areas) {
    if (face !== undefined && area['face'] !== face.code) continue;
    const raw: unknown = typeof area['rules'] === 'string' ? (() => { try { return JSON.parse(area['rules']) as unknown; } catch { return null; } })() : area['rules'];
    const rules = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
    const read = readRelief({ mode: rules['mode'], depth: rules['depthMm'], smallest: rules['smallestLetterMm'] });
    if (read !== null) return { mode: read.mode, depth: read.depth };
  }
  return { mode: 'raised', depth: 1 };
}

/** Whether a printed item's preview can show its words: a face marked and laid on its preview model. */
export const previewFaces = (catalogue: Catalogue): MarkedFace[] => catalogue.base.faces.filter((face) => face.preview !== undefined);

export interface PrintedModelOptions {
  empty: 'sample' | 'dim' | 'hide';
  labels: FlatLabels;
  pictures: Readonly<Record<string, string>>;
  holds: (column: string) => boolean;
}

/** The printed item's preview model with the design's words stood up on its marked faces; none until its file is read. */
export function usePrintedModel(catalogue: Catalogue, design: DesignData | null, source: ModelSource | null, options: PrintedModelOptions): { model: ShopModel | null; unreadable: boolean } {
  const { painted, fontsIn } = usePainted(options.pictures);
  const designKey = design === null ? '' : JSON.stringify(design.values) + String(design.ready_design_id);
  const decals = useMemo((): Decal[] => {
    if (design === null) return [];
    return previewFaces(catalogue).map((face) => {
      const on = { piece: null, face: face.code, width: Math.max(face.size.w, 1), height: Math.max(face.size.h, 1) };
      const sheet = flatSheet(catalogue, design, { on, empty: options.empty, labels: options.labels, holds: options.holds });
      const look = reliefOf(catalogue, face);
      const plane = face.preview!;
      // The depth in the preview's own units: as many as the face's width is across it.
      const scale = (plane.bounds.u1 - plane.bounds.u0) / on.width;
      return { code: face.code, plane, canvas: reliefCanvas(sheet, painted), width: on.width, height: on.height, relief: { mode: look.mode, depth: look.depth * scale, depthMm: look.depth, colour: sheet.face.colour } };
    });
  }, [catalogue, designKey, painted, fontsIn, options.empty]); // eslint-disable-line react-hooks/exhaustive-deps
  const colour = useMemo(() => (design === null ? undefined : plasticOf(catalogue, design)?.hex), [catalogue, designKey]); // eslint-disable-line react-hooks/exhaustive-deps
  return useShopModel(source, decals, undefined, colour);
}
