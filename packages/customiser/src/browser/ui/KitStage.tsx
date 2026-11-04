/**
 * A KIT OF PIECES ON THE CUSTOMER'S STAGE (BC-B7b, BC-F7): the comp's 3D
 * preview with "Assembled" and "Pieces" beside "See it flat".
 *
 * - Assembled: the shop's own model (its GLB) turned in 3D, with the
 *   customer's design laid on each face the shop marked, painted from the
 *   same sheet the piece's laser file is made from. A tap on a design takes
 *   the customer to the field of the part it lands on.
 * - Pieces: every piece laid flat from its own drawing, numbered, the
 *   design on the pieces that carry it, the piece being changed outlined.
 * - "See it flat", a device that cannot draw 3D, and a kit with no model yet
 *   show the pieces that carry the design, flat: what the laser cuts.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { flatSheet } from '../../draw/flat.ts';
import { carryingPieces, kitPieces, onFace, type KitPiece } from '../../draw/kit.ts';
import { hasWebGL } from '../../three/load.ts';
import { ModelStill } from '../../three/PieceView.tsx';
import type { ModelSource } from '../../three/useModel.ts';
import { startView } from '../../three/view.ts';
import { useKitModel } from '../../three/useKit.ts';
import type { CustomiserApi, DesignData } from '../api.ts';
import { partsOf, readyOf, type Catalogue } from '../catalogue.ts';
import { useShared } from './context.tsx';
import { PiecesDrawing } from './KitPieces.tsx';
import type { Upload } from './pictures.ts';
import { PieceStage, usePaintedPictures, type PieceStageProps } from './PieceStage.tsx';

/** Where the customer's model is read from: the shop's asset, by its address. */
export function modelOf(api: CustomiserApi, catalogue: Catalogue): ModelSource | null {
  const file = catalogue.base.row['model_file'];
  if (typeof file !== 'string' || file === '' || api.modelUrl === undefined) return null;
  const modelUrl = api.modelUrl;
  return {
    key: `${String(catalogue.base.id)}:${file}`,
    kind: 'glb',
    read: async () => {
      const url = await modelUrl(catalogue.base.row);
      if (url === null) return null;
      const answer = await fetch(url);
      return answer.ok ? await answer.arrayBuffer() : null;
    },
  };
}

/** The addresses of the kit's pieces' own drawings, by piece. */
export function usePieceOutlines(api: CustomiserApi | undefined, catalogue: Catalogue): Record<string, string> {
  const [found, setFound] = useState<Record<string, string>>({});
  const rows = catalogue.rows.pieces;
  useEffect(() => {
    const pieceUrl = api?.pieceUrl;
    if (pieceUrl === undefined) return;
    let alive = true;
    void Promise.all(rows.map(async (row) => [String(row['id']), await pieceUrl(row).catch(() => null)] as const)).then((all) => {
      if (alive) setFound(Object.fromEntries(all.filter((one): one is readonly [string, string] => one[1] !== null)));
    });
    return () => {
      alive = false;
    };
  }, [api, rows]);
  return found;
}

export interface KitStageProps extends Omit<PieceStageProps, 'flat'> {
  selected: string | null;
  lockShown: string | null;
  onLock: (code: string | null) => void;
  pictures: Readonly<Record<string, Upload>>;
}

/** The piece a part of the design is on: its own, or its marked face's. */
function pieceOfPart(catalogue: Catalogue, part: { piece: string | null; face: string | null } | undefined): string | null {
  if (part === undefined) return null;
  return part.piece ?? catalogue.base.faces.find((one) => one.code === part.face)?.piece ?? null;
}

export function KitStage(props: KitStageProps): ReactNode {
  const { t } = useShared();
  const { api, catalogue, design, pictures, startThreshold } = props;
  const [mode, setMode] = useState<'assembled' | 'pieces'>('assembled');
  const pieces: KitPiece[] = useMemo(() => kitPieces(catalogue), [catalogue]);
  const outlines = usePieceOutlines(api, catalogue);
  const source = useMemo(() => modelOf(api, catalogue), [api, catalogue]);
  const painted = usePaintedPictures(catalogue, design, pictures, startThreshold);
  const labels = { logo: t('editor.drawing.logo', 'Your logo'), photo: t('editor.drawing.photo', 'Your photo') };
  const holds = (column: string): boolean => pictures[column] !== undefined;
  const { model, unreadable } = useKitModel(catalogue, mode === 'assembled' && source !== null ? design : null, mode === 'assembled' ? source : null, { empty: 'dim', labels, pictures: painted, holds });
  const parts = partsOf(catalogue, readyOf(catalogue, design.ready_design_id));
  const carrying = carryingPieces(catalogue, parts);
  const highlight = pieceOfPart(catalogue, parts.find((one) => one.code === props.selected)) ?? pieces.find((one) => carrying.has(one.id))?.id ?? null;

  // A tap on a face's design: the part drawn where it landed, on that face's sheet.
  const pickPart = (stage: Parameters<NonNullable<PieceStageProps['pickPart']>>[0], x: number, y: number): string | null => {
    const spot = stage.pickDecal(x, y);
    const face = spot === null ? undefined : catalogue.base.faces.find((one) => one.code === spot.code);
    if (spot === null || face === undefined) return null;
    const sheet = flatSheet(catalogue, design, { on: onFace(face, pieces), empty: 'dim', labels, holds });
    const { x: px, y: py } = spot.point;
    return [...sheet.items].reverse().find((item) => item.live && px >= item.box.x && px <= item.box.x + item.box.w && py >= item.box.y && py <= item.box.y + item.box.h)?.code ?? null;
  };

  const drawn = (only: ReadonlySet<string> | undefined): ReactNode => (
    <PiecesDrawing
      catalogue={catalogue}
      design={design}
      pieces={pieces}
      outlines={outlines}
      {...(only === undefined ? {} : { only })}
      highlight={highlight}
      pictures={pictures}
      startThreshold={startThreshold}
      empty="dim"
      onPart={props.onPart}
      selected={props.selected}
      lockShown={props.lockShown}
      onLock={props.onLock}
      label={props.product}
    />
  );
  return (
    <PieceStage
      {...props}
      kind="kit"
      model={source === null || unreadable ? null : model}
      forceFlat={mode === 'pieces' || source === null || unreadable}
      pickPart={pickPart}
      flat={mode === 'pieces' ? drawn(undefined) : drawn(carrying)}
      modes={
        <div role="radiogroup" aria-label={t('editor.stage.kitModes', 'How to show the kit')} className="cz-seg">
          {(['assembled', 'pieces'] as const).map((one) => (
            <button key={one} type="button" role="radio" aria-checked={mode === one} className={mode === one ? 'cz-on' : ''} onClick={() => setMode(one)}>
              {one === 'assembled' ? t('editor.stage.assembled', 'Assembled') : t('editor.stage.pieces3d', 'Pieces')}
            </button>
          ))}
        </div>
      }
    />
  );
}

export interface KitStillProps {
  api: CustomiserApi;
  catalogue: Catalogue;
  design: DesignData;
  width: number;
  height: number;
  className?: string;
  /** Shown until the still is drawn, and where it cannot be. */
  fallback: ReactNode;
}

/** A kit's gallery card: its model with the ready-made design on its marked faces, drawn once for the page. */
export function KitStill({ api, catalogue, design, width, height, className, fallback }: KitStillProps): ReactNode {
  const { t } = useShared();
  const webgl = hasWebGL();
  const source = useMemo(() => (webgl ? modelOf(api, catalogue) : null), [api, catalogue, webgl]);
  const labels = { logo: t('editor.drawing.logo', 'Your logo'), photo: t('editor.drawing.photo', 'Your photo') };
  const { model } = useKitModel(catalogue, source === null ? null : design, source, { empty: 'sample', labels, pictures: NO_PICTURES, holds: () => false });
  if (source === null) return fallback;
  return <ModelStill model={model} view={START_KIT} width={width} height={height} cacheKey={`kit|${source.key}|${JSON.stringify(design.values)}|${String(design.ready_design_id)}`} alt="" {...(className === undefined ? {} : { className })} fallback={fallback} />;
}

const NO_PICTURES: Readonly<Record<string, string>> = {};
const START_KIT = startView('kit');
