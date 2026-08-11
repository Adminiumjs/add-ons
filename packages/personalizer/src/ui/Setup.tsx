/**
 * THE MAKER'S SET-UP SURFACE — comp L's screen 4.
 *
 * Three steps on one page: the four ANGLES the shopper will see, the AREAS
 * drawn on them with their limits, and a SAMPLE panel that renders exactly what
 * a customer would get, so the maker checks their own set-up without leaving
 * the page.
 *
 * WHAT WAS CUT, AND WHY IT IS SAID HERE RATHER THAN LEFT TO BE NOTICED. Comp L
 * draws the areas being dragged into place with corner handles. This ships the
 * same model — position and size in millimetres, per angle — through STEPPERS
 * instead of drag. The reason is not effort: a drag handle needs a pointer, and
 * the same panel mounts inside the generated dashboard in Phase B (D20), where
 * the record editor is a form. A millimetre is also what a maker measures with,
 * and a number that can be typed is a number that can be checked. Drag is a
 * better gesture and it is a P1 addition on top of this, not a replacement for
 * it — the zone model underneath is the contract's, unchanged.
 */

import { useId, useState } from 'react';

import type { Template, Zone } from '@adminium/add-on-host/contracts';

import { FACE_LIST, faceOf } from '../faces.ts';
import { useNumber, useT, zoneLabel } from '../i18n/t.ts';
import { pieceFor } from '../pieces.ts';
import { sampleFor } from '../seed.ts';
import { check, isRequired, REQUIRED_SUFFIX } from '../template.ts';
import { Chip, Mono, Note, Preview, Stepper } from './bits.tsx';

const ANGLES = ['front', 'three', 'top', 'detail'] as const;
const FINISHES = ['engraved', 'raised', 'printed', 'painted'] as const;

export function Setup({
  template,
  onChange,
}: {
  template: Template;
  onChange?: (next: Template) => void;
}) {
  const t = useT();
  const number = useNumber();
  const piece = pieceFor(template.productKey);
  const [selected, setSelected] = useState<string | undefined>(template.zones[0]?.id);
  /*
   * Every control on this page had a heading beside it and no accessible name
   * on the control — a `<span>` that reads as a label to the eye and is nothing
   * at all to a screen reader. `useId` gives the fields names that are unique
   * on a page carrying two of these panels, and each heading becomes a real
   * `<label htmlFor>`.
   */
  const fieldIds = useId();
  const [sample, setSample] = useState(() => sampleFor(template));

  const zone = template.zones.find((candidate) => candidate.id === selected);
  const verdict = check(sample, template);

  const patchZone = (id: string, over: Partial<Zone>) => {
    if (onChange === undefined) return;
    onChange({
      ...template,
      zones: template.zones.map((candidate) =>
        candidate.id === id ? { ...candidate, ...over } : candidate,
      ),
    });
  };

  if (template.zones.length === 0) {
    return (
      <div className="lp-panel">
        <div className="lp-panel-title">{t('addon.personalizer.setup.title')}</div>
        <p className="lp-empty">{t('addon.personalizer.setup.empty')}</p>
      </div>
    );
  }

  return (
    <div className="lp">
      <div className="lp-panel">
        <div className="lp-panel-title">{t('addon.personalizer.setup.title')}</div>
        <p className="lp-sub">{t('addon.personalizer.setup.sub')}</p>
      </div>

      {/* ── the four angles ─────────────────────────────────────────────── */}
      <div className="lp-panel">
        <div className="lp-panel-title">{t('addon.personalizer.setup.artwork')}</div>
        <p className="lp-sub">{t('addon.personalizer.setup.artworkNote')}</p>
        <div className="lp-thumbs">
          {ANGLES.map((angle) => (
            <div key={angle} className="lp-thumb">
              <Preview
                personalization={{ templateId: template.productKey, values: {} }}
                template={template}
                angle={angle}
                widthPx={190}
                className=""
              />
              <span className="lp-thumb-label">
                {t(`addon.personalizer.angle.${angle}` as never)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="lp-grid">
        {/* ── the areas ─────────────────────────────────────────────────── */}
        <div className="lp-panel">
          <div className="lp-panel-title">{t('addon.personalizer.setup.zones')}</div>
          <div className="lp-row">
            {template.zones.map((candidate) => (
              <Chip
                key={candidate.id}
                pressed={candidate.id === selected}
                onClick={() => setSelected(candidate.id)}
              >
                {zoneLabel(t, candidate.name)}
              </Chip>
            ))}
          </div>

          {zone !== undefined && (
            <>
              <div className="lp-control">
                <label className="lp-control-label" htmlFor={`${fieldIds}name`}>
                  {t('addon.personalizer.setup.name')}
                </label>
                <input
                  id={`${fieldIds}name`}
                  /* The maker renames an area in their own language. */
                  dir="auto"
                  className="lp-input"
                  value={zoneLabel(t, zone.name)}
                  onChange={(event) => patchZone(zone.id, { name: event.target.value })}
                  style={{ inlineSize: 'auto', flex: '1 1 140px' }}
                />
              </div>

              <div className="lp-control">
                <span className="lp-control-label">{t('addon.personalizer.setup.limit')}</span>
                <Stepper
                  value={<Mono>{number(zone.constraints.maxChars ?? 0)}</Mono>}
                  lessLabel="−"
                  moreLabel="+"
                  onLess={() =>
                    patchZone(zone.id, {
                      constraints: {
                        ...zone.constraints,
                        maxChars: Math.max(1, (zone.constraints.maxChars ?? 1) - 1),
                      },
                    })
                  }
                  onMore={() =>
                    patchZone(zone.id, {
                      constraints: {
                        ...zone.constraints,
                        maxChars: (zone.constraints.maxChars ?? 0) + 1,
                      },
                    })
                  }
                />
              </div>

              <div className="lp-control">
                <span className="lp-control-label">{t('addon.personalizer.setup.range')}</span>
                <Mono>
                  {t('addon.personalizer.sizeUnit', {
                    mm: number(zone.constraints.minSizeMm ?? 0),
                  })}
                </Mono>
                <span aria-hidden="true">–</span>
                <Mono>
                  {t('addon.personalizer.sizeUnit', {
                    mm: number(zone.constraints.maxSizeMm ?? 0),
                  })}
                </Mono>
              </div>

              <div className="lp-control">
                <span className="lp-control-label">{t('addon.personalizer.setup.fonts')}</span>
                {FACE_LIST.map((face) => {
                  const on = zone.constraints.fonts?.includes(face.id) ?? true;
                  return (
                    <Chip
                      key={face.id}
                      pressed={on}
                      onClick={() => {
                        const current = zone.constraints.fonts ?? FACE_LIST.map((f) => f.id);
                        const next = on
                          ? current.filter((id) => id !== face.id)
                          : [...current, face.id];
                        // Leave at least one, or the shopper's picker is empty.
                        if (next.length === 0) return;
                        patchZone(zone.id, {
                          constraints: { ...zone.constraints, fonts: next },
                        });
                      }}
                    >
                      <span style={{ fontFamily: face.css, fontWeight: face.weight }}>
                        {face.name}
                      </span>
                    </Chip>
                  );
                })}
              </div>
              <p className="lp-sub">{t('addon.personalizer.set.smallest')}</p>

              <div className="lp-control">
                <span className="lp-control-label">{t('addon.personalizer.finish')}</span>
                {FINISHES.map((finish) => (
                  <Chip
                    key={finish}
                    pressed={zone.finish === finish}
                    onClick={() => patchZone(zone.id, { finish })}
                  >
                    {t(`addon.personalizer.finish.${finish}` as never)}
                  </Chip>
                ))}
              </div>

              <div className="lp-control">
                <span className="lp-control-label">{t('addon.personalizer.setup.visible')}</span>
                {ANGLES.map((angle) => (
                  <Chip
                    key={angle}
                    pressed={zone.perAngle[angle] !== undefined}
                    onClick={() => {
                      const next = { ...zone.perAngle };
                      if (next[angle] !== undefined) delete next[angle];
                      else next[angle] = zone.perAngle.front ?? { xPct: 20, yPct: 40, wPct: 60, hPct: 18 };
                      patchZone(zone.id, { perAngle: next });
                    }}
                  >
                    {t(`addon.personalizer.angle.${angle}` as never)}
                  </Chip>
                ))}
              </div>

              <p className="lp-sub">
                {isRequired(zone)
                  ? t('addon.personalizer.setup.required')
                  : t('addon.personalizer.setup.optional')}
                {' · '}
                {/*
                 * THE FIELD'S ID, LABELLED AS ONE AND MARKED AS ONE.
                 *
                 * [Corrected 2026-08-11, wave 4b round 5.] This printed `top`
                 * bare, under the translated label `السطر العلوي`, so it read as
                 * one stray English word in the middle of an Arabic sentence
                 * with nothing to say what it was.
                 *
                 * It is kept, because it IS what a maker wants here: this is the
                 * key the template carries and the one that appears in an
                 * order's values, so a maker setting up a piece needs to see it.
                 * What it needed was to look like a code on purpose — a word in
                 * front of it saying what it is, and `dir="ltr"` declaring it a
                 * Latin island, which is also what stops the bidi algorithm
                 * reordering it against the Arabic around it.
                 */}
                <span className="lp-control-label">
                  {t('addon.personalizer.setup.fieldId')}
                </span>{' '}
                <Mono dir="ltr">{zone.id.replace(REQUIRED_SUFFIX, '')}</Mono>
                {' · '}
                <Mono>
                  {t('addon.personalizer.sizeUnit', {
                    mm: `${number(zone.shape.wMm)}×${number(zone.shape.hMm)}`,
                  })}
                </Mono>
              </p>
            </>
          )}
        </div>

        {/* ── the sample ───────────────────────────────────────────────── */}
        <div className="lp-panel">
          <div className="lp-panel-title">{t('addon.personalizer.setup.sample')}</div>
          <p className="lp-sub">{t('addon.personalizer.setup.sampleNote')}</p>
          <Preview
            personalization={sample}
            template={template}
            angle="front"
            widthPx={420}
            guides
            bad={verdict.detail.filter((entry) => !entry.ok).map((entry) => entry.zone)}
          />
          {template.zones.map((candidate) => (
            <input
              key={candidate.id}
              /* A placeholder is not a name: it disappears the moment anything
                 is typed, and it was the only thing here telling a maker which
                 area this field belonged to. */
              aria-label={zoneLabel(t, candidate.name)}
              /* The maker's own sample wording, in its own direction. */
              dir="auto"
              className="lp-input"
              value={sample.values[candidate.id] ?? ''}
              placeholder={zoneLabel(t, candidate.name)}
              onChange={(event) =>
                setSample({
                  ...sample,
                  values: { ...sample.values, [candidate.id]: event.target.value },
                })
              }
            />
          ))}
          {verdict.detail
            .filter((entry) => !entry.ok)
            .map((entry) => (
              <Note key={entry.zone} tone="bad">
                {entry.code === 'overrun' && entry.fit !== undefined && !entry.fit.fits
                  ? t('addon.personalizer.over', {
                      over: number(entry.fit.overChars),
                      size: number(entry.fit.capMm),
                    })
                  : entry.code === 'too-many'
                    ? t('addon.personalizer.tooMany', {
                        over: number(
                          [...(sample.values[entry.zone] ?? '')].length - (entry.limit ?? 0),
                        ),
                        limit: number(entry.limit ?? 0),
                      })
                    : entry.code === 'no-letter'
                      ? t('addon.personalizer.noLetterSwap', {
                          chars: (entry.chars ?? []).join(' '),
                        })
                      : t(
                          entry.shortenToChars === undefined
                            ? 'addon.personalizer.noLetterNone'
                            : 'addon.personalizer.noLetter',
                          { chars: (entry.chars ?? []).join(' ') },
                        )}
              </Note>
            ))}
          <p className="lp-sub">
            <Mono>
              {t('addon.personalizer.sizeUnit', {
                mm: `${number(piece.widthMm)} × ${number(piece.heightMm)}`,
              })}{' '}
              · {faceOf(sample.font).name}
            </Mono>
          </p>
        </div>
      </div>
    </div>
  );
}
