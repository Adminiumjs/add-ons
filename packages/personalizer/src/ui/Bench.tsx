/**
 * THE BENCH SHEET — the pictures, in a list, with a tick beside each.
 *
 * ── WHAT IT IS FOR ─────────────────────────────────────────────────────────
 *
 * A batch comes off the laser as a sheet of near-identical squares, and the
 * only thing telling them apart is the wording cut into them. The maker's
 * question at that moment is not "what is the state of that order", it is
 * "which of these is which" — so this is the pictures, at a size you can read
 * across a bench, in a list you tick as you lift each one off.
 *
 * ── WHERE THE ROWS COME FROM, AND WHY NOT FROM THE SHOP ────────────────────
 *
 * From `store.remembered()`: everything this add-on has drawn. That is a
 * deliberate limit rather than a shortcut. `nav.add-on.routes` hands a fill the
 * settings and nothing else, so an add-on drawing "today's orders" would be
 * inventing a host's paperwork — the exact defect `seed.ts` records against the
 * order references that used to live in this package. What this add-on knows is
 * what it drew, and that is what the sheet lists.
 *
 * The consequence is honest and visible: a fresh session has drawn nothing, and
 * the empty state says so and says where the rows come from, rather than
 * seeding four rows of somebody else's Thursday.
 *
 * ── THE TICK IS LOCAL AND SAYS NOTHING TO THE SHOP ─────────────────────────
 *
 * Ticking a line is a maker crossing something off a sheet of paper. It is not
 * a stage change: the shop owns stages, this add-on owns pictures, and an
 * add-on that quietly advanced an order from a checkbox on its own page would
 * be writing to a record it does not own. So the tick lives here, resets with
 * the page, and is captioned as what it is.
 */

import { useState } from 'react';

import { useT } from '../i18n/t.ts';
import type { MessageKey } from '../i18n/strings.ts';
import { PIECE_NAME_KEYS, templateFor } from '../seed.ts';
import { remembered, summarize } from '../store.ts';
import { LinePicture, Mono } from './bits.tsx';

export function Bench() {
  const t = useT();
  const [done, setDone] = useState<ReadonlySet<string>>(new Set());

  const lines = remembered().flatMap((personalization) => {
    const template = templateFor(personalization.templateId);
    if (template === undefined) return [];
    const words = summarize(personalization);
    return [{ key: `${personalization.templateId} ${words}`, personalization, template, words }];
  });

  const nameOf = (productKey: string): string => {
    const key = PIECE_NAME_KEYS[productKey];
    return key === undefined ? productKey : t(key as MessageKey);
  };

  function toggle(key: string) {
    setDone((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="lp">
      <div className="lp-bench-head">
        <div>
          <h2 className="lp-page-title">{t('addon.personalizer.bench.title')}</h2>
          <p className="lp-sub">{t('addon.personalizer.bench.sub')}</p>
        </div>
        {lines.length > 0 && (
          <Mono>
            {t('addon.personalizer.bench.count', {
              done: lines.filter((line) => done.has(line.key)).length,
              total: lines.length,
            })}
          </Mono>
        )}
      </div>

      {lines.length === 0 ? (
        <div className="lp-panel">
          <div className="lp-panel-title">{t('addon.personalizer.bench.empty')}</div>
          <p className="lp-sub">{t('addon.personalizer.bench.emptyBody')}</p>
        </div>
      ) : (
        <ul className="lp-bench">
          {lines.map((line) => {
            const off = done.has(line.key);
            const piece = nameOf(line.personalization.templateId);
            return (
              <li key={line.key} className="lp-bench-row" data-done={off}>
                <button
                  type="button"
                  className="lp-tick"
                  aria-pressed={off}
                  aria-label={t(
                    off ? 'addon.personalizer.bench.untick' : 'addon.personalizer.bench.tick',
                    { piece },
                  )}
                  onClick={() => toggle(line.key)}
                />
                <LinePicture
                  personalization={line.personalization}
                  template={line.template}
                  className="lp-bench-pic"
                />
                <div className="lp-bench-what">
                  <span className="lp-bench-piece">{piece}</span>
                  {/* The shopper's own text: a Latin island on an Arabic page,
                      marked the way every other quoted wording here is. */}
                  <span className="lp-bench-words" dir="auto">
                    {line.words}
                  </span>
                </div>
                <span className="lp-bench-state">
                  {t(off ? 'addon.personalizer.bench.done' : 'addon.personalizer.bench.waiting')}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
