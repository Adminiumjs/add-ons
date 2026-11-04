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
import { flatSheet } from '../draw/flat.ts';
import { PieceStillBox, storedOutline } from '../pages/shared/Piece3d.tsx';
import { SegmentedControl, type AddOnTranslate } from '../pages/shared/host.ts';
import { hasWebGL } from '../three/load.ts';

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
