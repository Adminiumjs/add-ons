/**
 * REUSE AREAS — copy a set-up piece's areas onto a piece that has none.
 *
 * ── THE WORK IT SAVES, WHICH IS THE ONLY REASON IT EXISTS ───────────────────
 *
 * A maker who has drawn "top line, twenty-four characters, three faces, 4–9 mm"
 * on the walnut coasters has drawn exactly the same thing for the birch ply
 * ones, which are the same square in a different timber. Drawing it again is
 * the job this add-on was bought to stop doing. So: pick a piece that is set
 * up, pick one that is not, copy.
 *
 * ── WHAT IT REFUSES TO PRETEND ──────────────────────────────────────────────
 *
 * A zone is stored in MILLIMETRES, not in fractions of the piece, because a
 * laser cuts millimetres — so the same rectangle on a 250 × 120 slate sign is
 * not the same rectangle it was on a 95 mm coaster. The screen does not hide
 * that behind a scale factor and quietly move everything: it copies the numbers
 * and says, in words, to check each area on a piece of a different size. A
 * silent rescale would be the kind of help that produces one wrong batch.
 *
 * The empty case is honest in the same way: a shop where every piece is already
 * set up has nothing to copy TO, and says so instead of drawing a disabled
 * button (D19).
 *
 * ── WHY THE LIST IS THE ADD-ON'S OWN SEED ───────────────────────────────────
 *
 * An add-on may not read a host's catalogue — `nav.add-on.routes` carries no
 * payload but the settings, and inventing a shop's product list would be D21's
 * defect exactly. What it may list is what it has itself: its templates, and
 * the pieces its own seed knows have no areas yet.
 */

import { useState } from 'react';

import type { Template, Zone } from '@adminium/add-on-host/contracts';

import { useNumber, useT, zoneLabel } from '../i18n/t.ts';
import type { MessageKey } from '../i18n/strings.ts';
import { pieceFor } from '../pieces.ts';
import { NOT_SET_UP, PIECE_NAME_KEYS, TEMPLATES } from '../seed.ts';
import { Chip, Mono, Note } from './bits.tsx';

/** A piece with no areas, as somewhere to copy to. */
interface Target {
  productKey: string;
  widthMm: number;
  heightMm: number;
}

const TARGETS: readonly Target[] = NOT_SET_UP.map((productKey) => {
  const piece = pieceFor(productKey);
  return { productKey, widthMm: piece.widthMm, heightMm: piece.heightMm };
});

export function Reuse({ onCopied }: { onCopied?: (to: string, zones: readonly Zone[]) => void }) {
  const t = useT();
  const number = useNumber();
  const [fromKey, setFromKey] = useState(TEMPLATES[0]?.productKey ?? '');
  const [toKey, setToKey] = useState<string | null>(null);
  const [copiedTo, setCopiedTo] = useState<string | null>(null);

  const source: Template | undefined = TEMPLATES.find((tpl) => tpl.productKey === fromKey);
  const name = (key: string): string => {
    const messageKey = PIECE_NAME_KEYS[key];
    return messageKey === undefined ? key : t(messageKey as MessageKey);
  };

  return (
    <div className="lp">
      <div>
        <h2 className="lp-page-title">{t('addon.personalizer.reuse.title')}</h2>
        <p className="lp-sub">{t('addon.personalizer.reuse.sub')}</p>
      </div>

      {TARGETS.length === 0 ? (
        <p className="lp-empty">{t('addon.personalizer.reuse.none')}</p>
      ) : (
        <div className="lp-reuse">
          <section className="lp-panel">
            <div className="lp-panel-title">{t('addon.personalizer.reuse.from')}</div>
            <div className="lp-row">
              {TEMPLATES.map((tpl) => (
                <Chip
                  key={tpl.productKey}
                  pressed={tpl.productKey === fromKey}
                  onClick={() => {
                    setFromKey(tpl.productKey);
                    setCopiedTo(null);
                  }}
                >
                  {name(tpl.productKey)}
                </Chip>
              ))}
            </div>
            <ul className="lp-zonelist">
              {(source?.zones ?? []).map((zone) => (
                <li key={zone.id} className="lp-zonelist-item">
                  <span className="lp-zonelist-name">{zoneLabel(t, zone.name)}</span>
                  <Mono>
                    {t('addon.personalizer.reuse.zoneMeta', {
                      chars: zone.constraints.maxChars ?? 0,
                      width: Math.round(zone.shape.wMm),
                    })}
                  </Mono>
                </li>
              ))}
            </ul>
          </section>

          <section className="lp-panel">
            <div className="lp-panel-title">{t('addon.personalizer.reuse.to')}</div>
            <div className="lp-targets">
              {TARGETS.map((target) => (
                <button
                  key={target.productKey}
                  type="button"
                  className="lp-target"
                  aria-pressed={target.productKey === toKey}
                  onClick={() => {
                    setToKey(target.productKey);
                    setCopiedTo(null);
                  }}
                >
                  <span className="lp-target-name">{name(target.productKey)}</span>
                  <span className="lp-target-meta">
                    {/*
                     * `sizeUnit` rather than a key of this screen's own: the
                     * whole string is two numbers, a multiplication sign and
                     * `mm`, which is the SI symbol and not a word in any
                     * language — a second key for it would be a second row on
                     * the shared-with-English exemption list saying exactly
                     * what `sizeUnit`'s row already says.
                     */}
                    <Mono>
                      {t('addon.personalizer.sizeUnit', {
                        mm: `${number(target.widthMm)} × ${number(target.heightMm)}`,
                      })}
                    </Mono>
                    <span className="lp-target-state">
                      {t('addon.personalizer.reuse.notSetUp')}
                    </span>
                  </span>
                </button>
              ))}
            </div>

            <Note tone="info">{t('addon.personalizer.reuse.warn')}</Note>

            <button
              type="button"
              className="lp-button lp-button--primary"
              disabled={toKey === null || source === undefined}
              onClick={() => {
                if (toKey === null || source === undefined) return;
                onCopied?.(toKey, source.zones);
                setCopiedTo(toKey);
              }}
            >
              {toKey === null
                ? t('addon.personalizer.reuse.pick')
                : t('addon.personalizer.reuse.cta')}
            </button>

            {copiedTo !== null && (
              <Note tone="info">
                {t('addon.personalizer.reuse.done', { piece: name(copiedTo) })}
              </Note>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
