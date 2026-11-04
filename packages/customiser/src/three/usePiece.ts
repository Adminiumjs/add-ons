/**
 * THE PIECE A PAGE SHOWS IN 3D, KEPT UP TO DATE: its outline read once, the
 * customer's pictures loaded, its top repainted when the design or the
 * page's fonts change.
 */
import { useEffect, useMemo, useState } from 'react';

import type { Painted } from '../draw/canvas.ts';
import type { FlatSheet } from '../draw/flat.ts';
import type { ReadSvg } from '../draw/svgread.ts';
import { outlineOnce, paintedOnce, pieceModel } from './load.ts';
import type { PieceModel } from './piece.ts';

/** Where a piece's outline comes from: a key it is kept under, and how its text is read. */
export interface OutlineSource {
  key: string;
  text: () => Promise<string | null>;
}

/**
 * The piece for a sheet; none until its outline has been read (a piece with
 * no outline is its rectangle at once). `pictures` are the addresses of the
 * customer's pictures this page holds, by file column.
 */
export function usePieceModel(sheet: FlatSheet | null, thickness: number | null, outline: OutlineSource | null, pictures: Readonly<Record<string, string>> = {}): PieceModel | null {
  const [read, setRead] = useState<{ key: string; svg: ReadSvg | null } | null>(null);
  const { painted, fontsIn } = usePainted(pictures);

  useEffect(() => {
    if (outline === null) return;
    let alive = true;
    void outlineOnce(outline.key, outline.text).then((svg) => {
      if (alive) setRead({ key: outline.key, svg });
    });
    return () => {
      alive = false;
    };
    // Read again only for another outline.
  }, [outline?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const sheetKey = sheet === null ? '' : JSON.stringify(sheet);
  const ready = outline === null || read?.key === outline.key;
  const svg = outline === null ? null : (read?.svg ?? null);
  return useMemo(() => (sheet === null || !ready ? null : pieceModel(sheet, svg, thickness, painted)), [sheetKey, ready, svg, thickness, painted, fontsIn]); // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * The customer's pictures this page holds, loaded to paint (by file column),
 * and a count that goes up when the shop's fonts arrive, so words painted
 * before them are painted again in them.
 */
export function usePainted(pictures: Readonly<Record<string, string>>): { painted: Readonly<Record<string, Painted>>; fontsIn: number } {
  const [painted, setPainted] = useState<Readonly<Record<string, Painted>>>({});
  const [fontsIn, setFontsIn] = useState(0);
  const pictureKey = JSON.stringify(pictures);
  useEffect(() => {
    let alive = true;
    const columns = Object.entries(pictures);
    void Promise.all(columns.map(async ([column, url]) => [column, await paintedOnce(url)] as const)).then((loaded) => {
      if (alive) setPainted(Object.fromEntries(loaded.filter((one): one is readonly [string, Painted] => one[1] !== null)));
    });
    return () => {
      alive = false;
    };
  }, [pictureKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Words painted before the shop's fonts arrived are painted again in them.
  useEffect(() => {
    const fonts = typeof document === 'undefined' ? undefined : (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts;
    let alive = true;
    void fonts?.ready?.then(() => {
      if (alive) setFontsIn((n) => n + 1);
    });
    return () => {
      alive = false;
    };
  }, []);

  return { painted, fontsIn };
}
