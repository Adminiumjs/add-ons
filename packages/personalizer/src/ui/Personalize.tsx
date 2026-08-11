/**
 * THE SHOPPER'S SURFACE — what replaces the plain note field (24 D19).
 *
 * Comp L's screen 2, and the whole reason the add-on exists: a preview that
 * redraws on every keystroke with no "apply" button, one input group per area
 * the maker drew, and — the part that is hardest and matters most — CONSTRAINT
 * FEEDBACK THAT IS SPECIFIC. A red border alone is not feedback. When a line
 * overruns, the area outlines in `--danger`, a sentence beneath says exactly
 * what is wrong with a number in it, and BOTH ways out are buttons that carry
 * their own numbers: set it at N millimetres, or shorten it to N characters.
 *
 * Those numbers come from the engine (`fit` in `template.ts`), never from this
 * file, and a verdict cannot reach here without them — the contract's failing
 * branch requires `remedies` and the conformance suite asserts one is a number.
 * That is criterion 18 turned into two buttons.
 *
 * THREE RULES OF ITS OWN, from comp L, and each is one line of CSS or one line
 * here rather than a paragraph: it updates on every keystroke; the redraw never
 * moves the page or resizes the canvas (`contain: layout paint`, a fixed
 * canvas box); and on a narrow viewport the picture pins to the top while the
 * inputs scroll under it.
 */

import { useId, useState } from 'react';

import type { Personalization, Template, Zone } from '@adminium/add-on-host/contracts';

import { FACE_LIST, faceOf } from '../faces.ts';
import { MATERIALS, pieceFor } from '../pieces.ts';
import { PIECE_NAME_KEYS } from '../seed.ts';
import { useNumber, useT, zoneLabel, type TFunction } from '../i18n/t.ts';
import {
  isRequired,
  check,
  remediesFor,
  settingsFor,
  sizeRange,
  STEP_MM,
  type Block,
  type Remedy,
} from '../template.ts';
import { Chip, Mono, Note, Preview, Remedies, Stepper } from './bits.tsx';

/**
 * WHAT ONE REMEDY SAYS ON ITS BUTTON — every kind, in one place.
 *
 * The value is always IN the words: a size, a character count, or the two marks
 * a swap trades. Criterion 18 is not "there is a button", it is "the shopper is
 * told the number", and a label built anywhere but from the remedy itself is a
 * label that can drift from the action beneath it.
 */
function remedyLabel(
  t: TFunction,
  number: (value: number) => string,
  remedy: Remedy,
): string {
  if (remedy.kind === 'size') {
    return t('addon.personalizer.remedy.size', { size: number(remedy.sizeMm) });
  }
  if (remedy.kind === 'shorten') {
    return t('addon.personalizer.remedy.shorten', { chars: number(remedy.chars) });
  }
  return t('addon.personalizer.remedy.swap', { from: remedy.from, to: remedy.to });
}

/**
 * WHY THE PIECE CANNOT BE MADE YET, in the shopper's words — the one thing that
 * is not a verdict, so the one thing with no button.
 *
 * Two block codes and two sentences, because they are two different facts and a
 * shared one would be wrong about both: an empty required area is a thing to
 * fill in, and a line opening on a letter the studio has no shape for is a thing
 * to rewrite. It is exported because the host's own "add to basket" refuses with
 * the SAME sentence (`setBlocked`), and two copies of that reasoning is how the
 * panel and the button come to disagree about what is wrong.
 */
export function blockSentence(t: TFunction, block: Block, template: Template): string {
  const name = zoneLabel(t, template.zones.find((zone) => zone.id === block.zone)?.name ?? '');
  return block.code === 'no-letter'
    ? t('addon.personalizer.blockedLetters', { name })
    : t('addon.personalizer.blocked', { name });
}

const ANGLES = ['front', 'three', 'top', 'detail'] as const;
const FINISHES = ['engraved', 'raised', 'printed', 'painted'] as const;

export function Personalize({
  template,
  value,
  onChange,
  gated = false,
}: {
  template: Template;
  value: Personalization;
  onChange: (next: Personalization) => void;
  /**
   * Whether the HOST is refusing its own button with our reason (`setBlocked`).
   *
   * It changes exactly one line on this panel and it changes it for a reason
   * worth stating: when the host takes the refusal, repeating it at the foot of
   * this panel makes THREE messages about one empty box — the field's own, this
   * one, and the host's. When the host cannot take it — the field is optional
   * on the payload, and a host without a gate to close does not pass it — this
   * panel is the only place the refusal can be said at all, so it says it.
   */
  gated?: boolean;
}) {
  const t = useT();
  const number = useNumber();
  /*
   * THE INPUTS HAD NO ACCESSIBLE NAME AT ALL — no id, no wrapping `<label>`, no
   * `aria-label`. The heading above each field was a `<label>` with nothing to
   * point at, which is markup that LOOKS labelled and is not: a screen reader
   * announced "edit text, blank" on the one field the whole surface exists for.
   * `useId` gives each field a name that is unique on a page carrying two of
   * these panels and stable across a static render, and the head becomes its
   * `htmlFor`.
   */
  const fieldIds = useId();
  const [angle, setAngle] = useState<string>('front');
  const [zoom, setZoom] = useState(1);
  const [editing, setEditing] = useState<string | undefined>(undefined);

  const { verdicts, detail, blocks, plain } = check(value, template);
  const pieceKey = PIECE_NAME_KEYS[template.productKey];
  const pieceName = pieceKey === undefined ? template.productKey : t(pieceKey as never);
  const bad = detail.filter((entry) => !entry.ok).map((entry) => entry.zone);
  const piece = pieceFor(template.productKey);
  const material = MATERIALS[piece.material];

  const patch = (over: Partial<Personalization>) => onChange({ ...value, ...over });
  const setValue = (zone: Zone, text: string) =>
    patch({ values: { ...value.values, [zone.id]: text } });

  // ONE SIZE AND ONE FACE FOR THE WHOLE PERSONALIZATION, because that is what
  // the contract carries. Each area takes as much of the size as its own range
  // allows, which is what a maker setting a maximum meant by setting it.
  const first = template.zones[0]!;
  const range = sizeRange(first);
  const sizeMm = settingsFor(value, first).capMm;
  const offered = FACE_LIST.filter((face) => first.constraints.fonts?.includes(face.id) !== false);

  return (
    <div className="lp">
      <div className="lp-stage">
        <Preview
          personalization={value}
          template={template}
          angle={angle}
          widthPx={520}
          guides
          editing={editing}
          bad={bad}
          zoom={zoom}
        />
        <div className="lp-angles">
          {ANGLES.map((id) => (
            <button
              key={id}
              type="button"
              className="lp-angle"
              aria-pressed={angle === id}
              onClick={() => setAngle(id)}
            >
              {t(`addon.personalizer.angle.${id}` as never)}
            </button>
          ))}
          <button
            type="button"
            className="lp-angle lp-zoom"
            aria-pressed={zoom > 1}
            onClick={() => setZoom(zoom > 1 ? 1 : 1.7)}
          >
            {zoom > 1 ? t('addon.personalizer.zoomOut') : t('addon.personalizer.zoom')}
          </button>
        </div>
        <p className="lp-honest">{t('addon.personalizer.honest')}</p>
      </div>

      <div className="lp-zones">
        {template.zones.map((zone) => {
          const entry = detail.find((d) => d.zone === zone.id);
          const raw = value.values[zone.id] ?? '';
          const used = [...raw].length;
          const limit = zone.constraints.maxChars ?? 0;
          const block = blocks.find((b) => b.zone === zone.id);
          const state =
            entry !== undefined && !entry.ok ? 'bad' : entry?.code === 'too-small' ? 'warn' : 'ok';
          /*
           * NARROWED ONCE, HERE, rather than inside each button's handler. A
           * closure that re-reads `entry.fit` loses the narrowing and has to be
           * re-asserted with `!` at three call sites; hoisting the overrun into
           * one `const` is the same code with the discriminated union doing its
           * job.
           */
          const over =
            entry !== undefined && !entry.ok && entry.code === 'overrun' && entry.fit !== undefined && !entry.fit.fits
              ? entry.fit
              : undefined;
          const tone =
            state === 'bad' || block !== undefined ? 'bad' : used / (limit || 1) > 0.85 ? 'warn' : 'ok';
          const fieldId = `${fieldIds}${zone.id}`;

          /*
           * ── THE WAYS OUT, TAKEN WHOLE FROM THE ENGINE ────────────────────
           *
           * One list, whatever the verdict is, rendered by one component that
           * does not know the codes. What used to be here was a JSX branch per
           * code, each writing out its own buttons — which is how an `overrun`
           * came to be able to lose one of its two remedies with nothing red,
           * and how the swappable half of `no-letter` came to have none at all.
           * The sentences below still differ per code, because the sentences
           * genuinely are different facts; the BUTTONS are the engine's list.
           */
          const remedies = entry === undefined ? [] : remediesFor(entry);
          const applyRemedy = (index: number) => {
            const remedy = remedies[index];
            if (remedy === undefined) return;
            if (remedy.kind === 'size') patch({ sizeMm: remedy.sizeMm });
            else if (remedy.kind === 'shorten') {
              setValue(zone, [...raw].slice(0, remedy.chars).join(''));
            } else setValue(zone, raw.split(remedy.from).join(remedy.to));
          };
          const ways = (
            <Remedies
              labels={remedies.map((remedy) => remedyLabel(t, number, remedy))}
              onApply={applyRemedy}
            />
          );

          return (
            <div key={zone.id} className="lp-zone" data-state={state}>
              <label className="lp-zone-head" htmlFor={fieldId}>
                <span>{zoneLabel(t, zone.name)}</span>
                {isRequired(zone) ? null : (
                  <span className="lp-honest">{t('addon.personalizer.setup.optional')}</span>
                )}
                <span className="lp-count" data-tone={tone}>
                  {t('addon.personalizer.counter', {
                    used: number(used),
                    limit: number(limit),
                  })}
                </span>
              </label>
              <input
                id={fieldId}
                /* The shopper's own words, in the shopper's own direction. */
                dir="auto"
                className="lp-input"
                value={raw}
                placeholder={t('addon.personalizer.placeholder')}
                onFocus={() => setEditing(zone.id)}
                onBlur={() => setEditing(undefined)}
                onChange={(event) => setValue(zone, event.target.value)}
              />

              {block?.code === 'required-empty' && (
                <Note tone="bad">{t('addon.personalizer.required')}</Note>
              )}

              {/*
               * ── A MARK THE STUDIO HAS NO SHAPE FOR, IN ITS TWO KINDS ──────
               *
               * SWAPPABLE. `’`, `—`, the guillemets a word processor inserts:
               * every one has an exact plain form the studio does cut, and each
               * is offered as itself — a button naming both marks. What used to
               * happen was a rewrite of somebody's surname: the only remedy on
               * offer was "shorten it to N", where N was the index of the
               * apostrophe in O’Brien.
               *
               * STUCK, WITH A CUT. `é` in the middle of a line: there is no
               * plain form, but everything before it is real and the number is
               * the cut. That is the sentence this key has always carried.
               *
               * STUCK, WITH NOTHING BEFORE IT. The first character of the line
               * is one we cannot cut, so there is no prefix to keep and no
               * number in the world to offer. It used to emit `shortenToChars:
               * 0` and draw "Shorten it to 0" beside "everything before it is
               * fine" — both false, and pressing it emptied the field and
               * tripped the empty-area refusal. In ar-EG that was the outcome
               * of a shopper's FIRST KEYSTROKE typing their own name. It is
               * refused in words now, and the words say what we do cut.
               */}
              {entry !== undefined && !entry.ok && entry.code === 'no-letter' && (
                <Note tone="bad">
                  {t('addon.personalizer.noLetterSwap', { chars: (entry.chars ?? []).join(' ') })}
                  {ways}
                </Note>
              )}

              {entry !== undefined && !entry.ok && entry.code === 'no-letter-stuck' && (
                <Note tone="bad">
                  {t(
                    remedies.length > 0
                      ? 'addon.personalizer.noLetter'
                      : 'addon.personalizer.noLetterNone',
                    { chars: (entry.chars ?? []).join(' ') },
                  )}
                  {ways}
                </Note>
              )}

              {entry !== undefined && !entry.ok && entry.code === 'too-many' && (
                <Note tone="bad">
                  {t('addon.personalizer.tooMany', {
                    over: number(used - (entry.limit ?? 0)),
                    limit: number(entry.limit ?? 0),
                  })}
                  {ways}
                </Note>
              )}

              {/*
               * THE OVERRUN, WITH BOTH REMEDIES AS BUTTONS. `fit` computed each
               * number by search rather than by proportion, so pressing either
               * one lands on a personalization that passes — `template.test.ts`
               * asserts exactly that, for both buttons.
               */}
              {over !== undefined && (
                <Note tone="bad">
                  {over.overChars > 0
                    ? t('addon.personalizer.over', {
                        over: number(over.overChars),
                        size: number(over.capMm),
                      })
                    : t('addon.personalizer.overWide', { size: number(over.capMm) })}{' '}
                  {over.remedies.setSizeMm === undefined && t('addon.personalizer.noSize')}
                  {ways}
                </Note>
              )}

              {entry?.code === 'too-small' && entry.ok && (
                <Note tone="warn">
                  {t('addon.personalizer.fine', {
                    mm: number(faceOf(value.font).smallestMm),
                  })}
                </Note>
              )}
            </div>
          );
        })}
      </div>

      <div className="lp-controls">
        <div className="lp-control">
          <span className="lp-control-label">{t('addon.personalizer.font')}</span>
          {offered.map((face) => (
            <Chip
              key={face.id}
              pressed={faceOf(value.font).id === face.id}
              onClick={() => patch({ font: face.id })}
            >
              {/* Each alphabet shown in itself — a name in a list tells a
                  shopper nothing about what they are choosing. */}
              <span style={{ fontFamily: face.css, fontWeight: face.weight, fontSize: 15 }}>
                {face.name}
              </span>
            </Chip>
          ))}
        </div>

        <div className="lp-control">
          <span className="lp-control-label">{t('addon.personalizer.size')}</span>
          <Stepper
            value={<Mono>{t('addon.personalizer.sizeUnit', { mm: number(sizeMm) })}</Mono>}
            lessLabel={t('addon.personalizer.smaller')}
            moreLabel={t('addon.personalizer.larger')}
            onLess={() => patch({ sizeMm: Math.max(range.minMm, sizeMm - STEP_MM) })}
            onMore={() => patch({ sizeMm: Math.min(range.maxMm, sizeMm + STEP_MM) })}
          />
        </div>

        <div className="lp-control">
          <span className="lp-control-label">{t('addon.personalizer.finish')}</span>
          {FINISHES.map((finish) => (
            <Chip
              key={finish}
              pressed={(value.finish ?? first.finish) === finish}
              onClick={() => patch({ finish })}
              title={t(`addon.personalizer.finishNote.${finish}` as never)}
            >
              <span
                className="lp-swatch"
                style={{
                  background:
                    finish === 'engraved'
                      ? material.engraved
                      : finish === 'raised'
                        ? material.raised
                        : finish === 'printed'
                          ? material.printed
                          : material.paint.white,
                }}
              />
              {t(`addon.personalizer.finish.${finish}` as never)}
            </Chip>
          ))}
        </div>
        <p className="lp-honest">
          {t(`addon.personalizer.finishNote.${value.finish ?? first.finish}` as never)}
        </p>
      </div>

      {blocks.length > 0 && !gated && (
        <Note tone="info">{blockSentence(t, blocks[0]!, template)}</Note>
      )}
      {/*
       * NOTHING TYPED IS AN ANSWER, and saying so is the other half of the D19
       * repair in `check`. The panel opened with "Fill in Top line first." in
       * `--danger` under a disabled button, which told a shopper who wanted a
       * plain coaster that they had done something wrong. They had not; they
       * had finished. So the untouched state says what will happen and how to
       * change it, in the ordinary voice, and the refusal is kept for the case
       * that is really half-finished.
       */}
      {plain && (
        <p className="lp-honest">{t('addon.personalizer.plain', { piece: pieceName })}</p>
      )}
      {!plain && blocks.length === 0 && verdicts.every((verdict) => verdict.ok) && (
        <p className="lp-honest">{t('addon.personalizer.replaced')}</p>
      )}
    </div>
  );
}
