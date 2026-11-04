/**
 * A KIT PUT TOGETHER, WITH THE CUSTOMER'S DESIGN ON IT: the shop's model,
 * and on each face the shop marked a decal painted from that face's sheet
 * (the parts on the face and on the piece it is, at the piece's size). The
 * same sheet the piece's laser file is made from, so what is shown on the
 * model is what is cut. No three.js in it.
 */
import { useMemo } from 'react';

import type { Catalogue } from '../browser/catalogue.ts';
import type { DesignData } from '../browser/api.ts';
import { flatSheet, type FlatLabels } from '../draw/flat.ts';
import { kitPieces, onFace } from '../draw/kit.ts';
import { decalCanvas } from './load.ts';
import type { Decal, ShopModel } from './shopModel.ts';
import { usePainted } from './usePiece.ts';
import { useShopModel, type ModelSource } from './useModel.ts';

export interface KitModelOptions {
  /** Empty parts with their example words (a gallery card), dimmed (the stage) or left out (a still of what is made). */
  empty: 'sample' | 'dim' | 'hide';
  labels: FlatLabels;
  /** The customer's pictures this page holds, as they are painted, by file column. */
  pictures: Readonly<Record<string, string>>;
  /** Whether this page holds a column's file (a box without one says it holds one). */
  holds: (column: string) => boolean;
}

/** The kit's model with the design on its marked faces; none until its file is read, `unreadable` where it cannot be. */
export function useKitModel(catalogue: Catalogue, design: DesignData | null, source: ModelSource | null, options: KitModelOptions): { model: ShopModel | null; unreadable: boolean } {
  const { painted, fontsIn } = usePainted(options.pictures);
  const designKey = design === null ? '' : JSON.stringify(design.values) + String(design.ready_design_id);
  const decals = useMemo((): Decal[] => {
    if (design === null) return [];
    const pieces = kitPieces(catalogue);
    return catalogue.base.faces.map((face) => {
      const on = onFace(face, pieces);
      const sheet = flatSheet(catalogue, design, { on, empty: options.empty, labels: options.labels, holds: options.holds });
      return { code: face.code, plane: face, canvas: decalCanvas(sheet, painted), width: on.width, height: on.height };
    });
  }, [catalogue, designKey, painted, fontsIn, options.empty]); // eslint-disable-line react-hooks/exhaustive-deps
  return useShopModel(source, decals);
}
