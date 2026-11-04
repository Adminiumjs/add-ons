/**
 * A 3D-PRINTED ITEM ON THE CUSTOMER'S STAGE (BC-B7c, BC-F7): the comp's
 * keyring, "SAM" raised 1 mm in Amber, "PLA · Amber", "56 × 24 × 4 mm".
 *
 * - With the shop's preview model and a face marked on it: that model turned
 *   in 3D, the customer's words stood up from the marked face by its depth
 *   (or sunk into it as a darker inset), in the plastic's colour. A tap on
 *   the words takes the customer to their field.
 * - Without one (a shop still setting up, the sample keyring): the item made
 *   from its size and rounded corners, the words stood up from its top the
 *   same way.
 * - "See it flat", a device that cannot draw 3D, and reduced motion: the
 *   item drawn flat, as for a piece.
 *
 * Its gallery card is a still of the same, drawn once for the page.
 */
import { useMemo, type ReactNode } from 'react';

import { flatSheet } from '../../draw/flat.ts';
import { hasWebGL } from '../../three/load.ts';
import { ModelStill, PieceStill } from '../../three/PieceView.tsx';
import { previewFaces, reliefOf, usePrintedModel } from '../../three/usePrinted.ts';
import { startView } from '../../three/view.ts';
import type { CustomiserApi, DesignData } from '../api.ts';
import type { Catalogue } from '../catalogue.ts';
import { useShared } from './context.tsx';
import { modelOf } from './KitStage.tsx';
import { outlineOf, PieceStage, usePaintedPictures, type PieceStageProps } from './PieceStage.tsx';
import type { Upload } from './pictures.ts';

export interface PrintedStageProps extends Omit<PieceStageProps, 'kind' | 'model' | 'relief'> {
  pictures: Readonly<Record<string, Upload>>;
}

export function PrintedStage(props: PrintedStageProps): ReactNode {
  const { t } = useShared();
  const { api, catalogue, design, pictures, startThreshold } = props;
  const faces = previewFaces(catalogue);
  const source = useMemo(() => (faces.length > 0 ? modelOf(api, catalogue) : null), [api, catalogue, faces.length]);
  const painted = usePaintedPictures(catalogue, design, pictures, startThreshold);
  const labels = { logo: t('editor.drawing.logo', 'Your logo'), photo: t('editor.drawing.photo', 'Your photo') };
  const holds = (column: string): boolean => pictures[column] !== undefined;
  const { model, unreadable } = usePrintedModel(catalogue, source === null ? null : design, source, { empty: 'dim', labels, pictures: painted, holds });

  // A tap on the words on a marked face: the part drawn where it landed, on that face's sheet.
  const pickPart = (stage: Parameters<NonNullable<PieceStageProps['pickPart']>>[0], x: number, y: number): string | null => {
    const spot = stage.pickDecal(x, y);
    const face = spot === null ? undefined : faces.find((one) => one.code === spot.code);
    if (spot === null || face === undefined) return null;
    const sheet = flatSheet(catalogue, design, { on: { piece: null, face: face.code, width: Math.max(face.size.w, 1), height: Math.max(face.size.h, 1) }, empty: 'dim', labels, holds });
    const { x: px, y: py } = spot.point;
    return [...sheet.items].reverse().find((item) => item.live && px >= item.box.x && px <= item.box.x + item.box.w && py >= item.box.y && py <= item.box.y + item.box.h)?.code ?? null;
  };

  if (source === null || unreadable) return <PieceStage {...props} kind="printed" relief={reliefOf(catalogue, catalogue.base.faces[0])} />;
  return <PieceStage {...props} kind="printed" model={model} pickPart={pickPart} />;
}

export interface PrintedStillProps {
  api: CustomiserApi | undefined;
  catalogue: Catalogue;
  design: DesignData;
  width: number;
  height: number;
  className?: string;
  fallback: ReactNode;
}

/** A printed item's gallery card: its preview model with the design's words stood up, else the item made from its size. */
export function PrintedStill({ api, catalogue, design, width, height, className, fallback }: PrintedStillProps): ReactNode {
  const { t } = useShared();
  const webgl = hasWebGL();
  const faces = previewFaces(catalogue);
  const source = useMemo(() => (webgl && api !== undefined && faces.length > 0 ? modelOf(api, catalogue) : null), [api, catalogue, webgl, faces.length]);
  const labels = { logo: t('editor.drawing.logo', 'Your logo'), photo: t('editor.drawing.photo', 'Your photo') };
  const { model } = usePrintedModel(catalogue, source === null ? null : design, source, { empty: 'sample', labels, pictures: NO_PICTURES, holds: () => false });
  const extra = className === undefined ? {} : { className };
  if (source !== null) return <ModelStill model={model} view={START_PRINTED} width={width} height={height} cacheKey={`printed|${source.key}|${JSON.stringify(design.values)}|${String(design.ready_design_id)}`} alt="" {...extra} fallback={fallback} />;
  return (
    <PieceStill
      sheet={flatSheet(catalogue, design, { labels })}
      thickness={catalogue.base.thickness}
      outline={api === undefined ? null : outlineOf(api, catalogue)}
      relief={reliefOf(catalogue, catalogue.base.faces[0])}
      kind="printed"
      width={width}
      height={height}
      alt=""
      {...extra}
      fallback={fallback}
    />
  );
}

const NO_PICTURES: Readonly<Record<string, string>> = {};
const START_PRINTED = startView('printed');
