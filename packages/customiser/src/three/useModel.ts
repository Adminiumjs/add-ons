/**
 * A SHOP'S MODEL A PAGE SHOWS IN 3D, KEPT UP TO DATE: its file read once,
 * and the stage's model made again when the design on its faces or the
 * outlines change. No three.js in it: the stage reads the file itself.
 */
import { useEffect, useMemo, useState } from 'react';

import { bytesOnce } from './load.ts';
import type { Decal, Marks, ShopModel } from './shopModel.ts';
import type { ModelKind } from './sniff.ts';

/** Where a model's file comes from: the key it is kept under (its stored id), its kind, and how its bytes are read. */
export interface ModelSource {
  key: string;
  kind: ModelKind;
  read: () => Promise<ArrayBuffer | null>;
}

/** The file's bytes: none until read, `false` where it cannot be. */
export function useModelBytes(source: ModelSource | null): ArrayBuffer | null | false {
  const [read, setRead] = useState<{ key: string; bytes: ArrayBuffer | null } | null>(null);
  useEffect(() => {
    if (source === null) return;
    let alive = true;
    void bytesOnce(source.key, source.read).then((bytes) => {
      if (alive) setRead({ key: source.key, bytes });
    });
    return () => {
      alive = false;
    };
    // Read again only for another file.
  }, [source?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (source === null || read === null || read.key !== source.key) return null;
  return read.bytes ?? false;
}

/** The stage's model for a shop's file, with the design on its faces and, while marking, the outlines. */
export function useShopModel(source: ModelSource | null, decals: readonly Decal[], marks?: Marks, colour?: string): { model: ShopModel | null; unreadable: boolean } {
  const bytes = useModelBytes(source);
  const model = useMemo((): ShopModel | null => {
    if (source === null || bytes === null || bytes === false) return null;
    return { kind: 'model', file: source.kind, key: source.key, bytes, decals, ...(marks === undefined ? {} : { marks }), ...(colour === undefined ? {} : { colour }) };
  }, [source?.key, source?.kind, bytes, decals, marks, colour]); // eslint-disable-line react-hooks/exhaustive-deps
  return { model, unreadable: bytes === false };
}
