/**
 * "MAKE IT ONE COLOUR": the customer's logo beside the logo as the laser cuts
 * it, and the line where light becomes dark (Birch Row, the one-colour sheet).
 *
 * The laser cuts one colour: everything darker than the line is engraved,
 * everything lighter is left as the material. Moving the line redraws the
 * laser's picture and measures the finest line again; lines too fine to
 * engrave are told here and in the checks. "Use this" keeps the line, "Cancel"
 * puts it back where it was when the sheet opened. A PDF is not drawn here:
 * its fine detail is checked again when the proof is made.
 *
 * A sheet from the end side on a wide screen, from the foot on a phone.
 */
import { Contrast, ScanLine, X } from 'lucide-react';

import type { PartValue } from '../../rules/index.ts';
import type { Catalogue, EditPart } from '../catalogue.ts';
import { useShared } from './context.tsx';
import { Dialog } from './Overlay.tsx';
import { thresholdOf, useOneColour, type Upload } from './pictures.ts';

/** The colour an engraving burns to in each material, and the material's face. */
const BURNS: readonly { test: RegExp; face: string; ink: string }[] = [
  { test: /walnut/i, face: '#6b4428', ink: '#24130a' },
  { test: /ply|birch/i, face: '#d9b98a', ink: '#6a4321' },
  { test: /slate/i, face: '#3b4248', ink: '#c3cacf' },
  { test: /oak/i, face: '#c9a26b', ink: '#4a2f16' },
];

export interface OneColourProps {
  catalogue: Catalogue;
  part: EditPart;
  value: PartValue;
  picture: Upload | undefined;
  startThreshold: number;
  /** The checks find lines too fine to engrave at this line. */
  fine: boolean;
  narrow: boolean;
  onThreshold: (threshold: number) => void;
  onUse: () => void;
  onCancel: () => void;
}

export function OneColourSheet({ catalogue, part, value, picture, startThreshold, fine, narrow, onThreshold, onUse, onCancel }: OneColourProps) {
  const { t } = useShared();
  const material = catalogue.base.material;
  const burn = BURNS.find((one) => one.test.test(material ?? '')) ?? { face: '#e9e4da', ink: '#3a3530' };
  const threshold = thresholdOf(value, startThreshold);
  const laser = useOneColour(picture, threshold, burn.ink);
  const pdf = picture?.kind === 'pdf';
  return (
    <Dialog labelledBy="cz-oc-title" onClose={onCancel} className={narrow ? 'cz-oc cz-oc-foot' : 'cz-oc cz-oc-side'} scrimClass="cz-scrim cz-scrim-sheet">
      <div className="cz-oc-head">
        <span className="cz-tile cz-tile-accent cz-tile-small">
          <Contrast aria-hidden="true" />
        </span>
        <h2 id="cz-oc-title" className="cz-oc-title">
          {t('editor.oneColour.open', 'Make it one colour')}
        </h2>
        <button type="button" className="cz-icon-button cz-push" aria-label={t('editor.close', 'Close')} onClick={onCancel}>
          <X aria-hidden="true" />
        </button>
      </div>
      <div className="cz-oc-body">
        <p className="cz-oc-lead">
          {material === null ? t('editor.oneColour.leadPlain', 'The laser cuts one colour. Everything darker than the line you set is engraved; everything lighter is left as it is.') : t('editor.oneColour.lead', 'The laser cuts one colour. Everything darker than the line you set is engraved; everything lighter is left as {material}.', { material: material.toLocaleLowerCase() })}
        </p>
        <div className="cz-oc-pair">
          <div className="cz-oc-one">
            <span className="cz-tool-label">{t('editor.oneColour.yours', 'Your file')}</span>
            <div role="img" aria-label={t('editor.oneColour.yoursAria', 'Your logo as uploaded')} className="cz-oc-frame cz-oc-paper">
              {picture?.url === undefined ? <span className="cz-mono cz-small">{picture === undefined ? part.name : picture.name || picture.kind.toUpperCase()}</span> : <img src={picture.url} alt="" className="cz-oc-img" />}
            </div>
          </div>
          <div className="cz-oc-one">
            <span className="cz-tool-label">{t('editor.oneColour.laser', 'As the laser will cut it')}</span>
            <div role="img" aria-label={material === null ? t('editor.oneColour.laserAriaPlain', 'Your logo as the laser engraves it') : t('editor.oneColour.laserAria', 'Your logo engraved in {material}', { material: material.toLocaleLowerCase() })} className="cz-oc-frame">
              <svg viewBox="0 0 100 100" className="cz-oc-svg" aria-hidden="true">
                <rect x="0" y="0" width="100" height="100" fill={burn.face} />
                {laser === null ? null : <image href={laser} x="6" y="6" width="88" height="88" preserveAspectRatio="xMidYMid meet" />}
              </svg>
            </div>
          </div>
        </div>
        <label className="cz-oc-line">
          <span className="cz-scale-head">
            <span className="cz-strong">{t('editor.oneColour.line', 'Where light becomes dark')}</span>
            <span className="cz-mono cz-strong cz-push">{`${String(threshold)}%`}</span>
          </span>
          <input type="range" className="cz-range" min={1} max={99} step={1} value={threshold} aria-describedby={fine ? 'cz-oc-warn' : undefined} onChange={(event) => onThreshold(Number(event.target.value))} />
          <span className="cz-oc-ends">
            <span>{t('editor.oneColour.less', 'Less engraved')}</span>
            <span>{t('editor.oneColour.more', 'More engraved')}</span>
          </span>
        </label>
        {fine ? (
          <div id="cz-oc-warn" role="alert" className="cz-oc-warn">
            <ScanLine aria-hidden="true" />
            <span className="cz-oc-warn-text">
              <span className="cz-strong">{t('editor.oneColour.fine', 'Some lines are too fine to engrave — they may disappear')}</span>
              <span>{t('editor.oneColour.fineHow', 'Move the slider towards “Less engraved” to drop the fine shading, or upload a bolder version of your logo.')}</span>
            </span>
          </div>
        ) : null}
        {pdf ? <span className="cz-small">{t('editor.oneColour.later', 'We check fine detail again when we make your proof.')}</span> : null}
      </div>
      <div className="cz-oc-foot-bar">
        <button type="button" className="cz-primary cz-grow" onClick={onUse}>
          {t('editor.oneColour.use', 'Use this')}
        </button>
        <button type="button" className="cz-button" onClick={onCancel}>
          {t('editor.cancel', 'Cancel')}
        </button>
      </div>
    </Dialog>
  );
}
