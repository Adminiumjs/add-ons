/**
 * THE SIX FILLS — one component per slot, and the only places this add-on ever
 * draws.
 *
 * Every one is handed a payload by the host's `<AddOnSlot>` and nothing else.
 * None of them reaches into the host's store, imports its `useT`, or knows what
 * app it is running inside — which is D21's claim made structural rather than
 * asserted: the same bundle renders inside Birch Row and inside the print works
 * because a slot id names a SURFACE.
 *
 * THE SEVENTH SLOT, `record.editor.panel`, IS DECLARED IN THE MANIFEST AND HAS
 * NO FILL HERE. Its host is Adminium's generated dashboard rather than an
 * example app, and it needs the add-on runtime that `POST /manifests` does not
 * yet provide (§5.10, D20). Comp L designs those four screens and 8B specifies
 * them; shipping a fill nothing can mount is the exact defect §5.4 records
 * against `nav.add-on.routes`, so the manifest declares the attachment and the
 * code ships nothing. `manifest.test.ts` asserts that difference BY NAME rather
 * than letting it look like an oversight.
 */

import { useEffect, useId, useState } from 'react';

import type {
  CartLinePayload,
  OrderLinePayload,
  PersonalizePayload,
  ProductAdminPayload,
  SettingsPanelPayload,
  SlotItem,
} from '@adminium/add-on-host';
import type { Personalization, Template } from '@adminium/add-on-host/contracts';

import { FACE_LIST } from '../faces.ts';
import { useNumber, useT, zoneLabel, type TFunction } from '../i18n/t.ts';
import type { MessageKey } from '../i18n/strings.ts';
import { PIECE_NAME_KEYS, TEMPLATES, templateFor } from '../seed.ts';
import { blankFor, commit, fromNote, recall } from '../store.ts';
import { check, defaultSizeMm, settingsFor } from '../template.ts';
import { Chip, LinePicture, Mono, Note } from './bits.tsx';
import { blockSentence, Personalize } from './Personalize.tsx';
import { Production } from './Production.tsx';
import { Setup } from './Setup.tsx';

// ── WHAT EACH FILL IS HANDED ────────────────────────────────────────────────
//
// FOUR PAYLOAD INTERFACES USED TO BE DECLARED HERE, and declaring them here was
// the defect rather than the tidy choice it was argued to be. The rule they
// were written to — "a type an add-on only READS may be narrowed, so it lives
// with the add-on" — is sound about OWNERSHIP and silent about SHAPE, and the
// shape is what a second host changes. So what got written down was not "the
// fields I read" but "the fields the one host I was built against happened to
// send": `product.key`, `config.note`, `patchConfig`, `line.productKey` — a
// maker studio's basket line, as particular to Birch Row as `SampleJob` was to
// the print works, and just as invisible until somebody mounted it elsewhere.
//
// They are the shared registry's now, one per slot id, named for the surface.
// Narrowing is still allowed and still safe — `render` is contravariant in its
// payload, so a component that reads fewer fields is assignable — but the
// narrowing is now checked against a shape both hosts promise instead of
// against one host's memory.

// ── ONE LOOKUP AND ONE PICTURE, SHARED BY THE THREE SURFACES OF AC17 ────────

/**
 * WHAT ONE LINE WAS PERSONALIZED WITH — the same two steps everywhere.
 *
 * There used to be three answers to this question and they disagreed. The
 * basket asked `recall(key, note)` and gave up if it missed. The order line
 * asked `recall`, then `lineFor(payload.order.ref)` — an ORDER reference handed
 * to a function matching LINE ids, so that branch could not match under any
 * data — and then `fromNote`. The proof asked nobody at all: the host drew its
 * own material tile and criterion 17's three pictures were two.
 *
 * Two steps, in this order, and no host-specific field in either:
 *
 *   1. `recall(key, note)` — the shopper configured it in this session, so the
 *      font, size and finish they actually chose are known.
 *   2. `fromNote(key, note)` — they did not, or it was ordered before this
 *      add-on was ever connected. The words are still on the line, because the
 *      words live in the HOST's own note field (D16), so they are laid into the
 *      areas the maker drew and everything else falls back to the piece's own
 *      defaults. That is a true statement about that order rather than an
 *      invented one.
 *
 * `key` and `note` are `SlotItem`'s, which every host of these surfaces
 * carries. Nothing here reads a reference, a line id, a material or a size key.
 */
function personalizationOf(
  line: SlotItem,
): { personalization: Personalization; template: Template } | undefined {
  const note = line.note ?? '';
  const personalization = recall(line.key, note) ?? fromNote(line.key, note);
  if (personalization === undefined) return undefined;
  const template = templateFor(personalization.templateId);
  if (template === undefined) return undefined;
  return { personalization, template };
}

/**
 * THE PICTURE PLUS WHAT IT WAS SET IN — the cart line, the proof, the order
 * line, one component (criterion 17).
 *
 * It is one component rather than three that agree because three that agree is
 * what this add-on shipped and it was not true: the basket drew the preview,
 * the order line opened the PRODUCTION file — a structurally different SVG in
 * the studio's cut alphabet — and the proof drew the host's material tile. The
 * production file is still one click away on the maker's side, where it
 * belongs; what a customer approves and what the bench works from now start as
 * the same picture.
 */
function LineFace({ personalization, template }: { personalization: Personalization; template: Template }) {
  const t = useT();
  const zone = template.zones[0]!;
  const { face, capMm, finish } = settingsFor(personalization, zone);
  const failing = check(personalization, template).verdicts.filter((verdict) => !verdict.ok);

  return (
    <div className="lp-line">
      <div className="lp-line-pic">
        <LinePicture personalization={personalization} template={template} className="" />
      </div>
      <div className="lp-line-rows">
        <div className="lp-line-row">
          <span className="lp-line-k">{t('addon.personalizer.line.font')}</span>
          <span className="lp-line-v">{face.name}</span>
        </div>
        <div className="lp-line-row">
          <span className="lp-line-k">{t('addon.personalizer.line.size')}</span>
          <span className="lp-line-v">
            <Mono>{t('addon.personalizer.sizeUnit', { mm: capMm })}</Mono>
          </span>
        </div>
        <div className="lp-line-row">
          <span className="lp-line-k">{t('addon.personalizer.line.finish')}</span>
          <span className="lp-line-v">
            {t(`addon.personalizer.finish.${finish}` as never)}
          </span>
        </div>
        {/*
         * A LINE THAT DOES NOT FIT SAYS SO, HERE, instead of looking finished.
         *
         * The shopper's own surface gates the button now, so nothing failing
         * can be added from this shop. Lines still arrive failing from the
         * other direction — an order placed before the add-on was connected,
         * whose words the studio has never checked against an area — and the
         * honest thing on a picture of one of those is to say that somebody
         * will come back to you about it, rather than to draw the words
         * overflowing the piece and leave a reader to notice.
         */}
        {failing.length > 0 && <Note tone="bad">{t('addon.personalizer.line.attention')}</Note>}
        <p className="lp-honest">{t('addon.personalizer.line.same')}</p>
      </div>
    </div>
  );
}

/**
 * WHY THIS SURFACE IS NOT FINISHED, in the shopper's language — what the host's
 * own "add to basket" refuses with.
 *
 * `undefined` means ready. The two failing shapes are different in kind and the
 * copy says so: an empty required area is a thing to fill in, and a line that
 * will not fit is a thing to shorten or shrink, with the buttons that do it
 * sitting right above.
 */
export function blockReason(
  t: TFunction,
  value: Personalization,
  template: Template,
): string | undefined {
  const { verdicts, blocks } = check(value, template);
  const first = blocks[0];
  // The panel says the same sentence at its own foot, from the same function —
  // a second copy of this reasoning is how a button and the panel above it come
  // to disagree about what is wrong.
  if (first !== undefined) return blockSentence(t, first, template);
  return verdicts.every((verdict) => verdict.ok) ? undefined : t('addon.personalizer.notYet');
}

// ── product.options.personalize ─────────────────────────────────────────────

/**
 * THE ONE THAT REPLACES A FINISHED SCREEN.
 *
 * The host's fallback here is not a placeholder: a note field, a live counter,
 * the maker's instructions and a proof promise (D19). This block takes its
 * place wholesale, so the arrival of the add-on is a visible gain in capability
 * rather than the repair of a broken page.
 */
export function PersonalizeFill({ payload }: { payload: PersonalizePayload }) {
  const template = templateFor(payload.product.key);
  const [value, setValue] = useState(
    () =>
      recall(payload.product.key, payload.note) ??
      blankFor(payload.product.key, template === undefined ? 8 : defaultSizeMm(template))!,
  );

  // A piece the maker has not drawn areas on yet. `product.options.personalize`
  // is a `single` slot, so the host's own note field is GONE while this add-on
  // is on, and what stood here was a sentence and nothing else. See `NoteFill`
  // for why that was the wrong answer and what it costs.
  if (template === undefined) return <NoteFill payload={payload} />;

  return (
    <>
      <PersonalizeGate payload={payload} value={value} template={template} />
      <Personalize
        template={template}
        value={value}
        // The host is refusing its own button with our sentence, so this panel
        // does not repeat it at its foot. See `Personalize`'s own note.
        gated={payload.setBlocked !== undefined}
        onChange={(next) => {
          setValue(next);
          /*
           * ── THE WORDS ARE WRITTEN WHATEVER HAPPENS ───────────────────────
           *
           * This line used to read `isReady(next) ? remember(next) : ''`, and
           * the `''` is as bad as it looks: every keystroke that left ANY area
           * failing wiped the host's note field. Type a name too long for the
           * coaster and the shop forgot you had typed anything — while "add to
           * basket" stayed enabled, so the way to find out was to look in your
           * basket and see a blank line. Two bugs holding each other up.
           *
           * Both are fixed and neither by the other's half. `commit` writes the
           * words on every keystroke, ready or not, and files the picture only
           * when the piece can actually be made — its own header says why. The
           * GATE below is what stops an unmakeable line reaching the basket,
           * and it says why on screen.
           *
           * It is a named function in `store.ts` rather than two words here
           * because the old version was two words here, and no suite anywhere
           * could see them.
           */
          commit(next, payload.setNote);
        }}
      />
    </>
  );
}

/**
 * THE NOTE FIELD, KEPT — for every piece the maker has not drawn areas on yet.
 *
 * ── SWITCHING THE ADD-ON ON USED TO REMOVE A CAPABILITY ─────────────────────
 *
 * `product.options.personalize` is a `single` slot: while a fill is mounted the
 * host's own block is gone, and the host's own block is a finished thing (D19) —
 * a note field, a live counter against the shop's limit, and the promise that a
 * picture comes back before anything is cut. Two of Birch Row's twelve pieces
 * have a template. On the other ten this fill rendered one sentence and NO
 * INPUT, so a shopper who could type "Sam & Jo, 2019" onto a keyring with the
 * add-on off could type nothing at all with it on. Driven and confirmed in the
 * DOM for all twelve.
 *
 * That inverts what an add-on is for. D19 says the arrival of one is a visible
 * gain in capability rather than the repair of a broken page, and there is no
 * reading of "gain" under which a working field becomes a paragraph.
 *
 * ── WHY THE FALLBACK RATHER THAN A TEMPLATE PER PIECE ───────────────────────
 *
 * Drawing areas on the other ten would fix these twelve and not the thirteenth.
 * A host's catalogue is the HOST's, this add-on ships two templates as seed data
 * for a demo, and a shop that adds a piece tomorrow must not lose its note field
 * for the afternoon between adding it and drawing on it. The floor is the
 * behaviour the host already had; the template is the upgrade on top of it.
 *
 * `noteLimit` comes off the payload because it is the HOST's limit — the words
 * go back into the host's own field (D16), and an add-on that let a shopper type
 * more than the shop can store would be filling a column that truncates. A host
 * that caps nothing passes nothing and the counter is not drawn.
 *
 * `surfaces.test.tsx` walks a piece with a template, a piece without, and a key
 * this add-on has never heard of, and asserts a NAMED writable field on each —
 * so a thirteenth piece cannot silently lose it.
 */
function NoteFill({ payload }: { payload: PersonalizePayload }) {
  const t = useT();
  const number = useNumber();
  const fieldId = useId();
  const [note, setNote] = useState(payload.note);
  const limit = payload.product.noteLimit;

  return (
    <div className="lp-panel">
      <div className="lp-panel-title">{t('addon.personalizer.title')}</div>
      <div className="lp-zone">
        <label className="lp-zone-head" htmlFor={fieldId}>
          <span>{t('addon.personalizer.notes.label')}</span>
          {limit !== undefined && (
            <span className="lp-count" data-tone={[...note].length > limit * 0.85 ? 'warn' : 'ok'}>
              {t('addon.personalizer.counter', {
                used: number([...note].length),
                limit: number(limit),
              })}
            </span>
          )}
        </label>
        <input
          id={fieldId}
          /* The shopper's own words, in the shopper's own direction — see the
             host's `<Typed>`. Latin wording typed into an Arabic page is a
             Latin island, and an undeclared one reorders against the
             paragraph. */
          dir="auto"
          className="lp-input"
          value={note}
          placeholder={t('addon.personalizer.placeholder')}
          maxLength={limit}
          onChange={(event) => {
            setNote(event.target.value);
            payload.setNote(event.target.value);
          }}
        />
      </div>
      {/*
       * ── AND WHATEVER ELSE THE HOST WAS SAYING HERE ────────────────────────
       *
       * The first repair gave the field back. It did not give back the rest of
       * the block: the host's empty state on this slot is three parts, and this
       * fill replaced all three with a field and one sentence. Driven live on
       * "Photo block", both states on the same page, two of the three were
       * gone — the maker's own instructions for what to type on that piece, and
       * the promise that a picture comes back before anything is made.
       *
       * They are not this add-on's to write. They are the shop's copy, about
       * the shop's process, on a piece the shop set up — which is exactly why
       * the payload carries them now (`hostSays`), already translated, and why
       * this renders them verbatim rather than paraphrasing them into something
       * an add-on author guessed.
       *
       * THE TEMPLATE BRANCH DOES NOT DO THIS, deliberately. There, the shopper
       * sees the actual piece with their actual words on it, and the controls
       * that change them: "tell us the name and we will set it in the lettering
       * shown" and "we send a picture before we cut" are both superseded by
       * being shown the thing. That is D19's "visible gain in capability".
       * Here nothing has been gained — this IS the host's field — so nothing
       * may be lost either.
       */}
      {(payload.hostSays ?? []).map((line) => (
        <p key={line} className="lp-host-says">
          {line}
        </p>
      ))}
      <p className="lp-empty">{t('addon.personalizer.notSetUp')}</p>
    </div>
  );
}

/**
 * The gate, as an effect rather than as something `onChange` does.
 *
 * TWO REASONS IT IS ITS OWN COMPONENT AND ITS OWN EFFECT. Calling the host's
 * setter DURING a render is a side effect in a render, which React is entitled
 * to run twice; and the interesting case is not a keystroke at all but the
 * UNMOUNT — a shopper switching the add-on off in the dock with a half-typed
 * name that does not fit. The fill disappears, and if the gate did not clean up
 * after itself the shop would be left unable to sell that piece with nothing on
 * screen to explain why. The cleanup runs on the way out and clears it.
 */
function PersonalizeGate({
  payload,
  value,
  template,
}: {
  payload: PersonalizePayload;
  value: Personalization;
  template: Template;
}) {
  const t = useT();
  const setBlocked = payload.setBlocked;
  const reason = blockReason(t, value, template);

  useEffect(() => {
    setBlocked?.(reason);
  }, [setBlocked, reason]);

  useEffect(() => () => setBlocked?.(undefined), [setBlocked]);

  return null;
}

// ── cart.line.preview ───────────────────────────────────────────────────────

/**
 * A SILENT SLOT: with nothing connected the host renders nothing at all here,
 * because the basket line already quotes the shopper's own words back at them
 * and a dashed box would be noise. What this adds is the picture beside them.
 */
export function LinePreviewFill({ payload }: { payload: CartLinePayload }) {
  /*
   * IT RESOLVES THE SAME WAY THE ORDER LINE DOES, which it did not: this fill
   * asked `recall` alone and gave up on a miss, so it drew the picture for a
   * line configured in this session and NOTHING for a line that arrived with
   * the order. That is why the proof on `BR-2279` had no picture in it even
   * after this slot was mounted there — the words were on the line, the areas
   * were drawn, and one missing fallback made the whole surface silent.
   *
   * A LINE WITH NOTHING TO DRAW STILL RENDERS NOTHING. `personalizationOf`
   * returns nothing for a piece with no areas set up and for a line with no
   * words on it, and this slot is silent by declaration: a dashed box under
   * every basket line would be the defect rather than the feature.
   */
  const found = personalizationOf(payload.line);
  if (found === undefined) return null;
  return <LineFace personalization={found.personalization} template={found.template} />;
}

// ── product.admin.panel ─────────────────────────────────────────────────────

export function AdminFill({ payload }: { payload: ProductAdminPayload }) {
  const t = useT();
  const number = useNumber();
  const [template, setTemplate] = useState(() => templateFor(payload.product.key));
  const [open, setOpen] = useState(false);

  if (template === undefined) {
    return (
      <div className="lp-panel">
        <div className="lp-panel-title">{t('addon.personalizer.setup.title')}</div>
        <p className="lp-empty">{t('addon.personalizer.setup.empty')}</p>
      </div>
    );
  }

  return open ? (
    <div className="lp">
      <Setup template={template} onChange={setTemplate} />
      <div className="lp-row">
        <button type="button" className="lp-button" onClick={() => setOpen(false)}>
          {t('addon.personalizer.setup.close')}
        </button>
      </div>
    </div>
  ) : (
    <div className="lp-panel">
      <div className="lp-panel-title">{t('addon.personalizer.setup.title')}</div>
      <p className="lp-sub">{t('addon.personalizer.setup.sub')}</p>
      <div className="lp-row">
        {template.zones.map((zone) => (
          <Chip key={zone.id} pressed={false} onClick={() => setOpen(true)}>
            {zoneLabel(t, zone.name)} · <Mono>{number(zone.constraints.maxChars ?? 0)}</Mono>
          </Chip>
        ))}
        <button type="button" className="lp-button" onClick={() => setOpen(true)}>
          {t('addon.personalizer.setup.open')}
        </button>
      </div>
    </div>
  );
}

// ── order.line.actions ──────────────────────────────────────────────────────

/**
 * The maker's end: the picture the customer approved, and the machine file
 * behind it.
 *
 * ── IT USED TO OPEN STRAIGHT ONTO THE PRODUCTION FILE ───────────────────────
 *
 * One button, and behind it `productionSvg` — the studio's own CUT ALPHABET,
 * geometry on a neutral ground, structurally a different picture from the one
 * the shopper saw. That was criterion 17 broken in the most easily missed way,
 * because both pictures are correct: the cart carried the preview, the order
 * line carried the file, and the sentence that says they are the same picture
 * was under both of them. The preview comes first now, from the same component
 * the basket and the proof draw with, and the file is one click behind it —
 * which is also the order a maker wants them in. `Production` says in its own
 * words why the letterforms differ once you are looking at it.
 *
 * `payload.order` IS READ FOR NOTHING, and that is the fix to the other half.
 * It used to be `lineFor(payload.order.ref)` — an order reference passed to a
 * function that matches line ids, against a table of another shop's order
 * references. It could not match; it was dead code guarding dead data. What a
 * line was personalized with is resolved from the LINE, by the two steps every
 * surface here shares.
 */
export function OrderLineFill({ payload }: { payload: OrderLinePayload }) {
  const t = useT();
  const [open, setOpen] = useState(false);

  const found = personalizationOf(payload.line);
  if (found === undefined) return null;
  const { personalization, template } = found;

  return open ? (
    <div className="lp">
      <Production personalization={personalization} template={template} />
      <div className="lp-row">
        <button type="button" className="lp-button" onClick={() => setOpen(false)}>
          {t('addon.personalizer.setup.close')}
        </button>
      </div>
    </div>
  ) : (
    <div className="lp lp-orderline">
      <LineFace personalization={personalization} template={template} />
      <div className="lp-row">
        <button type="button" className="lp-button" onClick={() => setOpen(true)}>
          {t('addon.personalizer.prod.open')}
        </button>
      </div>
    </div>
  );
}

// ── nav.add-on.routes ───────────────────────────────────────────────────────

/**
 * The full-screen set-up route, at `/add-ons/personalizer/edit`.
 *
 * A HOST THAT MOUNTS THIS SLOT IS WHY IT IS FILLED AT ALL. Design Studio shipped
 * a fill for this id for one release into a host with no router, and nothing
 * ever drew it (§5.4's amendment). Birch Row's maker shell has a view for an
 * add-on to occupy and mounts the slot in it, and its own suite asserts that
 * every id it lists is mounted somewhere in `src/`.
 */
export function RouteFill() {
  const t = useT();
  const [productKey, setProductKey] = useState(TEMPLATES[0]!.productKey);
  const [template, setTemplate] = useState(() => templateFor(TEMPLATES[0]!.productKey));

  return (
    <div className="lp">
      <div className="lp-row">
        {/*
         * ── THE CHIPS USED TO READ `walnut-coasters` AND `house-sign` ───────
         *
         * A hard-coded array of product keys, with `{key}` as the chip's body:
         * a machine slug rendered as a name, on a maker-facing screen, in all
         * eight locales. A key is not a word in any language.
         *
         * The list is now the seeded templates themselves — one source rather
         * than an array beside them that could disagree — and each is named
         * through this add-on's own bundle, the way its angles and zones are.
         * `template.test.ts` asserts every seeded template has a name, so a
         * third one cannot quietly go back to showing its key.
         */}
        {TEMPLATES.map(({ productKey: key }) => (
          <Chip
            key={key}
            pressed={key === productKey}
            onClick={() => {
              setProductKey(key);
              setTemplate(templateFor(key));
            }}
          >
            {t(PIECE_NAME_KEYS[key] as MessageKey)}
          </Chip>
        ))}
      </div>
      {template === undefined ? (
        <p className="lp-empty">{t('addon.personalizer.setup.empty')}</p>
      ) : (
        <Setup template={template} onChange={setTemplate} />
      )}
    </div>
  );
}

// ── settings.add-on.panel ───────────────────────────────────────────────────

export function SettingsFill({ payload }: { payload: SettingsPanelPayload }) {
  const t = useT();
  const settings = (payload.settings ?? {}) as {
    offered_fonts?: string[];
    proof_required?: boolean;
    default_finish?: string;
  };
  const offered = settings.offered_fonts ?? FACE_LIST.map((face) => face.id);
  const proof = settings.proof_required !== false;

  return (
    <div className="lp">
      <div className="lp-panel">
        <div className="lp-panel-title">{t('addon.personalizer.set.fonts')}</div>
        <p className="lp-sub">{t('addon.personalizer.set.fontsHint')}</p>
        <div className="lp-row">
          {FACE_LIST.map((face) => {
            const on = offered.includes(face.id);
            return (
              <Chip
                key={face.id}
                pressed={on}
                onClick={() => {
                  const next = on
                    ? offered.filter((id) => id !== face.id)
                    : [...offered, face.id];
                  if (next.length === 0) return;
                  payload.patch({ offered_fonts: next });
                }}
              >
                <span style={{ fontFamily: face.css, fontWeight: face.weight }}>{face.name}</span>
                <Mono>{t('addon.personalizer.sizeUnit', { mm: face.smallestMm })}</Mono>
              </Chip>
            );
          })}
        </div>
        <p className="lp-sub">{t('addon.personalizer.set.smallest')}</p>
      </div>

      <div className="lp-panel">
        <div className="lp-panel-title">{t('addon.personalizer.set.proof')}</div>
        <div className="lp-row">
          <Chip pressed={proof} onClick={() => payload.patch({ proof_required: !proof })}>
            {proof ? t('addon.personalizer.set.proofOn') : t('addon.personalizer.set.proofOff')}
          </Chip>
        </div>
      </div>

      <div className="lp-panel">
        <div className="lp-panel-title">{t('addon.personalizer.set.finish')}</div>
        <p className="lp-sub">{t('addon.personalizer.set.finishHint')}</p>
        <div className="lp-row">
          {(['engraved', 'raised', 'printed', 'painted'] as const).map((finish) => (
            <Chip
              key={finish}
              pressed={(settings.default_finish ?? 'engraved') === finish}
              onClick={() => payload.patch({ default_finish: finish })}
            >
              {t(`addon.personalizer.finish.${finish}` as never)}
            </Chip>
          ))}
        </div>
      </div>

      {/*
       * 24 AC6, as amended: an add-on that names a company carries the
       * not-affiliated line; one that names none says so positively, in its own
       * words. The host renders whichever applies from `noCompanyKeys`, and the
       * panel repeats it where a shop owner changing a setting is looking.
       */}
      {/*
        * A STRAY LINE USED TO FOLLOW THIS ONE, and it rendered as
        * "Fenwick · Alphabets a customer may choose from" — the first offered
        * face's name, a middle dot, and the heading of the panel two blocks up.
        * It said nothing, it was not a sentence in any of the eight locales,
        * and it sat under the one paragraph on the form a reader is meant to
        * take at its word. Removed rather than reworded: there was no fact it
        * was trying to state that the chips above do not already show.
        */}
      <p className="lp-honest">
        {t('addon.personalizer.noCompany')} {t('addon.personalizer.noAccount')}
      </p>
    </div>
  );
}
