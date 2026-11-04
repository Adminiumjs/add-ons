/**
 * A FLAT PIECE'S DESIGN ON THE ORDER LINE, IN 3D OR FLAT (BC-E1, BC-D9).
 *
 * The shop checks the same design the shopper saw: "3D" is the piece made
 * from its outline and thickness with the design on its top (a still, drawn
 * once for the page), "Flat" the drawing the proof and the laser's file are
 * made from. A device that cannot draw 3D shows it flat, with no switch.
 */
import { useState, type ReactNode } from 'react';

import type { DesignData } from '../browser/api.ts';
import type { Catalogue } from '../browser/catalogue.ts';
import { usePaintedPictures } from '../browser/ui/PieceStage.tsx';
import type { Upload } from '../browser/ui/pictures.ts';
import { partsOf, readyOf } from '../browser/catalogue.ts';
import { PiecesDrawing } from '../browser/ui/KitPieces.tsx';
import { flatSheet } from '../draw/flat.ts';
import { carryingPieces, kitPieces } from '../draw/kit.ts';
import { PieceStillBox, storedOutline } from '../pages/shared/Piece3d.tsx';
import { PieceStill } from '../three/PieceView.tsx';
import { previewFaces, reliefOf, usePrintedModel } from '../three/usePrinted.ts';
import { storedModel } from '../pages/shared/ShopModel3d.tsx';
import { fileAddress } from '../pages/shared/stored.ts';
import { SegmentedControl, type AddOnTranslate } from '../pages/shared/host.ts';
import { hasWebGL } from '../three/load.ts';
import { ModelStill } from '../three/PieceView.tsx';
import { useKitModel } from '../three/useKit.ts';
import { startView } from '../three/view.ts';

export interface PieceViewsProps {
  t: AddOnTranslate;
  catalogue: Catalogue;
  design: DesignData;
  pictures: Readonly<Record<string, Upload>>;
  /** What the picture is, for a reader: "{design}, as it will be made". */
  label: string;
  /** The design drawn flat. */
  flat: ReactNode;
}

export function PieceViews({ t, catalogue, design, pictures, label, flat }: PieceViewsProps): ReactNode {
  const [shown, setShown] = useState<'3d' | 'flat'>('3d');
  const painted = usePaintedPictures(catalogue, design, pictures, 50);
  if (!hasWebGL())
    return (
      <div className="rounded-xl border border-border bg-surface-3 p-3" data-design-sides="">
        {flat}
      </div>
    );
  const sheet = flatSheet(catalogue, design, { empty: 'hide', labels: { logo: '', photo: '' }, holds: (column) => pictures[column] !== undefined });
  return (
    <div className="flex flex-col gap-2" data-part="customiser-line-views" data-design-sides="">
      {shown === '3d' ? (
        <PieceStillBox sheet={sheet} thickness={catalogue.base.thickness} outline={storedOutline(catalogue.base.row['outline_file'])} pictures={painted} label={label} fallback={flat} />
      ) : (
        <div className="rounded-xl border border-border bg-surface-3 p-3">{flat}</div>
      )}
      <div className="self-start">
        <SegmentedControl
          aria-label={t('panel.views.label', 'How to show the design')}
          options={[
            { value: '3d', label: t('panel.views.3d', '3D') },
            { value: 'flat', label: t('panel.views.flat', 'Flat') },
          ]}
          value={shown}
          onValueChange={(value) => setShown(value === 'flat' ? 'flat' : '3d')}
        />
      </div>
    </div>
  );
}

/**
 * A KIT'S DESIGN ON THE ORDER LINE: 3D, Flat or Pieces (BC-E1, BC-D9). "3D"
 * is the shop's model with the design on its marked faces (a still drawn
 * once for the page), "Flat" the pieces that carry the design (what the
 * laser cuts), "Pieces" every piece laid flat with the one carrying the
 * words outlined. Without a model, or a device that cannot draw 3D, there
 * is no "3D".
 */
export function KitViews({ t, catalogue, design, pictures, label }: Omit<PieceViewsProps, 'flat'>): ReactNode {
  const source = storedModel(catalogue.base.row['model_file'], 'glb');
  const webgl = source !== null && hasWebGL();
  const [picked, setShown] = useState<'3d' | 'flat' | 'pieces'>(webgl ? '3d' : 'flat');
  const painted = usePaintedPictures(catalogue, design, pictures, 50);
  const pieces = kitPieces(catalogue);
  const outlines = Object.fromEntries(pieces.flatMap((piece) => {
    const address = fileAddress(piece.file);
    return address === null ? [] : [[piece.id, address]];
  }));
  const parts = partsOf(catalogue, readyOf(catalogue, design.ready_design_id));
  const carrying = carryingPieces(catalogue, parts);
  const highlight = pieces.find((one) => carrying.has(one.id))?.id ?? null;
  const { model, unreadable } = useKitModel(catalogue, picked === '3d' ? design : null, picked === '3d' && webgl ? source : null, { empty: 'hide', labels: { logo: '', photo: '' }, pictures: painted, holds: (column) => pictures[column] !== undefined });
  // A model this device cannot read has no "3D": the design is shown flat.
  const can3d = webgl && !unreadable;
  const shown = picked === '3d' && !can3d ? 'flat' : picked;
  const laid = (only?: ReadonlySet<string>): ReactNode => (
    <div className="rounded-xl border border-border bg-surface-3 p-3">
      <PiecesDrawing catalogue={catalogue} design={design} pieces={pieces} outlines={outlines} {...(only === undefined ? {} : { only })} highlight={highlight} pictures={pictures} empty="hide" label={label} className="w-full" />
    </div>
  );
  return (
    <div className="flex flex-col gap-2" data-part="customiser-line-views" data-design-sides="">
      {shown === '3d' && can3d ? (
        <div role="img" aria-label={label} className="relative aspect-square overflow-hidden rounded-xl border border-border bg-surface-3">
          <ModelStill model={model} view={startView('kit')} width={480} height={480} cacheKey={`kit|${String(source?.key)}|${JSON.stringify(design.values)}|${JSON.stringify(painted)}`} alt="" className="absolute inset-0 size-full" fallback={<div className="p-3" />} />
        </div>
      ) : shown === 'pieces' ? (
        laid()
      ) : (
        laid(carrying)
      )}
      <div className="self-start">
        <SegmentedControl
          aria-label={t('panel.views.label', 'How to show the design')}
          options={[...(can3d ? [{ value: '3d', label: t('panel.views.3d', '3D') }] : []), { value: 'flat', label: t('panel.views.flat', 'Flat') }, { value: 'pieces', label: t('panel.views.pieces', 'Pieces') }]}
          value={shown}
          onValueChange={(value) => setShown(value === 'pieces' ? 'pieces' : value === '3d' ? '3d' : 'flat')}
        />
      </div>
    </div>
  );
}

/**
 * A 3D-PRINTED ITEM'S DESIGN ON THE ORDER LINE, IN 3D OR FLAT (BC-E1, BC-D9),
 * as the shopper's stage shows it: the shop's preview model with the words
 * stood up from (or sunk into) its marked faces; with no preview model or no
 * face laid on it, the item made from its size with the words on its top.
 * "Flat" is the drawing the proof is made from. A device that cannot draw 3D,
 * or a preview model it cannot read, shows it flat with no switch.
 */
export function PrintedViews({ t, catalogue, design, pictures, label, flat }: PieceViewsProps): ReactNode {
  const [shown, setShown] = useState<'3d' | 'flat'>('3d');
  const painted = usePaintedPictures(catalogue, design, pictures, 50);
  const webgl = hasWebGL();
  const source = webgl && previewFaces(catalogue).length > 0 ? storedModel(catalogue.base.row['model_file'], 'glb') : null;
  const options = { empty: 'hide' as const, labels: { logo: '', photo: '' }, pictures: painted, holds: (column: string) => pictures[column] !== undefined };
  const { model, unreadable } = usePrintedModel(catalogue, shown === '3d' ? design : null, shown === '3d' ? source : null, options);
  const boxed = <div className="rounded-xl border border-border bg-surface-3 p-3">{flat}</div>;
  if (!webgl)
    return (
      <div data-part="customiser-line-views" data-design-sides="">
        {boxed}
      </div>
    );
  const sheet = flatSheet(catalogue, design, { empty: 'hide', labels: { logo: '', photo: '' }, holds: options.holds });
  const still =
    source !== null && !unreadable ? (
      <ModelStill model={model} view={startView('printed')} width={480} height={480} cacheKey={`printed|${source.key}|${JSON.stringify(design.values)}|${JSON.stringify(painted)}`} alt="" className="absolute inset-0 size-full" fallback={<div className="p-3">{flat}</div>} />
    ) : (
      <PieceStill sheet={sheet} thickness={catalogue.base.thickness} outline={storedOutline(catalogue.base.row['outline_file'])} pictures={painted} relief={reliefOf(catalogue, catalogue.base.faces[0])} kind="printed" width={480} height={480} alt="" className="absolute inset-0 size-full" fallback={<div className="p-3">{flat}</div>} />
    );
  return (
    <div className="flex flex-col gap-2" data-part="customiser-line-views" data-design-sides="">
      {shown === '3d' ? (
        <div role="img" aria-label={label} className="relative aspect-square overflow-hidden rounded-xl border border-border bg-surface-3">
          {still}
        </div>
      ) : (
        boxed
      )}
      <div className="self-start">
        <SegmentedControl
          aria-label={t('panel.views.label', 'How to show the design')}
          options={[
            { value: '3d', label: t('panel.views.3d', '3D') },
            { value: 'flat', label: t('panel.views.flat', 'Flat') },
          ]}
          value={shown}
          onValueChange={(value) => setShown(value === 'flat' ? 'flat' : '3d')}
        />
      </div>
    </div>
  );
}
