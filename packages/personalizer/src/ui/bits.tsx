/**
 * The pieces every surface here is built from.
 *
 * `Preview` is the interesting one: it renders the ENGINE'S OWN BYTES. The
 * shopper's canvas, the basket thumbnail, the maker's sample and the proof all
 * pass the same personalization through `drawPreview` — which is `previewSvg`
 * plus filing the result under its digest — and set the resulting string as
 * HTML. So "the cart thumbnail, the proof and the order line are the same
 * picture" is not three renderers agreeing: there is one renderer, it produces
 * text, and the same text is what the digest is taken over (criterion 17).
 *
 * `LinePicture` is the second half of that. One renderer is not enough on its
 * own — three surfaces calling it with three different `widthPx` values produce
 * three different strings and three different digests — so the three surfaces
 * criterion 17 names go through a component with NO options to pass.
 *
 * `dangerouslySetInnerHTML` IS THE POINT AND IS SAFE HERE, which is a sentence
 * that deserves the two lines it takes to justify. Everything a shopper types
 * goes through `esc()` in `template.ts` before it reaches the markup —
 * `template.test.ts` asserts that with `<b>&"Row"`, and `nameSvg` escapes the
 * accessible name through the same function — and the rest of the string is
 * geometry this package computed. Rebuilding the same SVG as JSX would give
 * React a tree to diff and would give us TWO renderers to keep byte-identical,
 * which is exactly the thing the criterion is about.
 *
 * THE ONE THING THE SCREEN HAS THAT THE FILE DOES NOT IS THE NAME. `previews`
 * holds the picture; the DOM holds the picture plus an `aria-label` and a
 * `<title>` in the reader's language. That difference is deliberate and is the
 * subject of `nameSvg`'s header: a file id must not change because a shopper
 * switched language.
 */

import type { ReactNode } from 'react';

import type { Personalization, Template } from '@adminium/add-on-host/contracts';

import { useT, type TFunction } from '../i18n/t.ts';
import type { MessageKey } from '../i18n/strings.ts';
import { drawPreview, LINE_PICTURE } from '../personalizer.ts';
import { PIECE_NAME_KEYS } from '../seed.ts';
import { nameSvg, type PreviewOptions } from '../template.ts';

export function Mono({ children, dir }: { children: ReactNode; dir?: "ltr" }) {
  /*
   * `dir` is opt-in and there is exactly one value for it, which is the point.
   *
   * `.lp-mono` isolates its run in CSS, and that is typography rather than a
   * DECLARATION: a host's Arabic-page guard reads the `dir` ATTRIBUTE, because
   * `dir` is the only marker that costs something to apply — it moves the run on
   * the page. Everything drawn through `Mono` therefore reads to a host as this
   * add-on's own prose, which is what keeps every millimetre and every count
   * visible to that guard.
   *
   * A genuine CODE is the exception: a field id is not a quantity anybody
   * computed and transliterating its characters would be the worse bug. Those
   * pass `dir="ltr"` and say so. Making it the default would silence the guard
   * over every measurement in this add-on at a stroke.
   */
  return (
    <span className="lp-mono" dir={dir}>
      {children}
    </span>
  );
}

/**
 * IT DRAWS THROUGH `drawPreview`, NOT THROUGH `previewSvg`, and the difference
 * is the whole of criterion 17's invariant.
 *
 * `personalizer.ts` has claimed since the first commit that "every surface goes
 * through `drawPreview`, so the picture a shopper sees is by construction the
 * one whose id travels on the order". It was not: this component called
 * `previewSvg` and nothing it drew was ever filed. The two happened to agree
 * because one pure function sat under both — an accident of the arguments, and
 * an accident is not what "by construction" means. One call now, so the bytes
 * on the screen and the bytes behind the file id cannot be two things.
 */
export function Preview({
  personalization,
  template,
  className = 'lp-canvas',
  ...options
}: PreviewOptions & {
  personalization: Personalization;
  template: Template;
  className?: string;
}) {
  const t = useT();
  const { svg } = drawPreview(personalization, template, options);
  /*
   * `dir="auto"` ON THE BOX, because what is inside it is the SHOPPER'S text.
   *
   * The picture draws words a customer typed and its accessible name repeats
   * them, so this box is a Latin island in an Arabic page exactly the way the
   * host's `<Typed>` spans are — same reason, same marker. The host's
   * Arabic-numeral guard reads that marker, which is right here: the prose half
   * of the name comes from `t()` and is formatted by construction, and the
   * other half is a year somebody wants engraved and must not be transliterated.
   */
  return (
    <div
      dir="auto"
      className={className}
      dangerouslySetInnerHTML={{ __html: nameSvg(svg, pictureName(t, personalization, template)) }}
    />
  );
}

/**
 * WHAT THE PICTURE SAYS, AS ITS NAME — computed here so no surface can forget.
 *
 * The five places this add-on draws all went through `Preview` and all shipped
 * an `<svg role="img">` with no name, which is one defect five times over. A
 * `name` PROP would have been five chances to leave it off; the argument is the
 * same one `LinePicture` makes about `widthPx`, and the answer is the same:
 * there is nothing to pass.
 *
 * The name is the shopper's own wording, because that is what the picture
 * draws — a sighted reader gets "The Hartleys" from the coaster and a blind one
 * should get it from the same node. A piece with nothing on it yet says so
 * rather than being announced as an unnamed image.
 */
export function pictureName(
  t: TFunction,
  personalization: Personalization,
  template: Template,
): string {
  const key = PIECE_NAME_KEYS[template.productKey];
  const piece = key === undefined ? template.productKey : t(key as MessageKey);
  const words = template.zones
    .map((zone) => (personalization.values[zone.id] ?? '').trim())
    .filter((value) => value !== '');
  return words.length === 0
    ? t('addon.personalizer.preview.blank', { piece })
    : t('addon.personalizer.preview.name', { piece, words: words.join(' · ') });
}

/**
 * THE PICTURE THAT TRAVELS — the cart line, the proof and the maker's order
 * line, and it takes no options because none of the three may differ.
 *
 * Criterion 17 says those three are byte-identical for identical values.
 * `widthPx` is written into the SVG string and hashed with it, so a surface
 * free to pass its own would be a surface free to break the criterion by
 * choosing 240 instead of 184 — which is exactly how the order line came to be
 * showing a different picture from the basket. There is no prop to get wrong:
 * hand it the personalization and the template, size it with CSS.
 */
export function LinePicture({
  personalization,
  template,
  // No box of its own: the surface around it supplies one (`.lp-line-pic`),
  // and the SVG fills it. Scaling is CSS, so it changes not one byte.
  className = '',
}: {
  personalization: Personalization;
  template: Template;
  className?: string;
}) {
  return <Preview {...LINE_PICTURE} personalization={personalization} template={template} className={className} />;
}

export function Chip({
  pressed,
  onClick,
  children,
  title,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
  title?: string;
}) {
  return (
    <button type="button" className="lp-chip" aria-pressed={pressed} onClick={onClick} title={title}>
      {children}
    </button>
  );
}

export function Stepper({
  value,
  onLess,
  onMore,
  lessLabel,
  moreLabel,
}: {
  value: ReactNode;
  onLess: () => void;
  onMore: () => void;
  lessLabel: string;
  moreLabel: string;
}) {
  return (
    <span className="lp-stepper">
      <button type="button" aria-label={lessLabel} onClick={onLess}>
        −
      </button>
      <span className="lp-stepper-value">{value}</span>
      <button type="button" aria-label={moreLabel} onClick={onMore}>
        +
      </button>
    </span>
  );
}

export function Note({ tone, children }: { tone: 'bad' | 'warn' | 'info'; children: ReactNode }) {
  return (
    <p className="lp-note" data-tone={tone}>
      {children}
    </p>
  );
}

/**
 * EVERY WAY OUT OF ONE FAILURE, AND THE SURFACE DOES NOT CHOOSE WHICH.
 *
 * It is handed `remediesFor(entry)` and renders the whole list. That is the
 * point rather than a tidying: the buttons used to be written out per verdict
 * code, one JSX branch each, and a branch is a thing that can be deleted. A
 * verifier wrapped the SIZE button in `false &&` — removing a working way out
 * for every shopper whose wording will not fit at any length — and the suite
 * stayed green, because it asked only whether the failure had SOME button.
 *
 * There is nothing to wrap now. The list comes from the engine, this maps over
 * it, and `surfaces.test.tsx` counts the buttons against `remediesFor` and
 * reads each one's value off the screen. A remedy can no longer be lost between
 * the two.
 *
 * `title` carries the same words as the label because the label is the whole
 * instruction — "Set it at 6.5 mm" — and a shopper on a narrow viewport gets
 * the text elided; nothing is said in a tooltip that is not said on the button.
 */
export function Remedies({
  labels,
  onApply,
}: {
  labels: readonly string[];
  onApply: (index: number) => void;
}) {
  if (labels.length === 0) return null;
  return (
    <span className="lp-remedies">
      {labels.map((label, index) => (
        <button
          key={label}
          type="button"
          className="lp-remedy"
          title={label}
          onClick={() => onApply(index)}
        >
          {label}
        </button>
      ))}
    </span>
  );
}
