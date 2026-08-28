/**
 * The small pieces this add-on's two surfaces are built from.
 *
 * Everything is styled from the token custom properties the host already
 * defines (`--surface`, `--fg-muted`, `--accent`…), never from the host's class
 * names: an add-on that depended on one app's stylesheet would break the moment
 * a second app hosted the same slot, and this one claims two.
 *
 * CSS LOGICAL PROPERTIES ONLY — `padding-inline`, `inset-inline-start`,
 * `border-block-end`. The host renders Arabic right-to-left with no RTL
 * stylesheet, so a physical `left` here is a bug that only one of eight locales
 * would ever show. `sources.test.ts` greps for the physical spellings.
 *
 * COPIED, NOT SHARED, and that is the same decision the host mirror and the `t`
 * seam make: this repository publishes each add-on standalone and there is no
 * package sitting between them. Five copies of a button is a cost; a shared
 * runtime dependency an add-on's host does not have is a D7 violation.
 */

import type { CSSProperties, ReactNode } from 'react';

import { runsOf, type Modules } from '../modules.ts';

export const MONO = 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)';

/**
 * A NUMBER THIS ADD-ON WORKED OUT, AND NOTHING ELSE GOES THROUGH IT.
 *
 * Isolated LTR: Arabic reads right to left and its figures do not, and without
 * the isolation the bidi algorithm cheerfully reorders the parts of a measured
 * value in exactly one of the eight locales.
 *
 * It declares its isolation in CSS rather than with `dir`, which is deliberate
 * and is the distinction `shipping-dhl`'s atoms had to learn: a host's
 * Arabic-page guard reads the `dir` ATTRIBUTE, so anything carrying it is
 * treated as an island the guard must not judge. A count this add-on computed
 * should stay visible to that guard — if one ever arrives here unformatted, a
 * host is supposed to report it.
 */
export function Mono({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <span
      style={{
        fontFamily: MONO,
        fontVariantNumeric: 'tabular-nums',
        direction: 'ltr',
        unicodeBidi: 'isolate',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/**
 * SOMEBODY ELSE'S IDENTIFIER — a barcode number, a catalogue key, a digit of a
 * number somebody typed.
 *
 * ── WHY AN ADD-ON WITH TWO SMALL SURFACES NEEDS THIS ───────────────────────
 *
 * Because almost everything on those surfaces is somebody else's text. A row
 * key is the host's; a number is the shop's; and both are written in Latin
 * digits on an Arabic page, because a barcode is Latin digits — the label will
 * print them that way whatever language the screen is in, and a check digit
 * transliterated into Arabic-Indic could not be matched against the number in
 * the box above it.
 *
 * `dir="auto"` rather than `"ltr"` because the direction genuinely depends on
 * the characters — a host's row key may be written in any script — and "auto"
 * says whose text it is instead of guessing which way it runs.
 *
 * It is the marker a host's numeral guard reads, which is why it is NOT applied
 * to the counts this add-on works out for itself: marking those would quiet the
 * guard by lying to it.
 */
export function Typed({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <span dir="auto" style={{ unicodeBidi: 'isolate', ...style }}>
      {children}
    </span>
  );
}

/**
 * THE SYMBOL, ON SCREEN, from the very modules the sheet is drawn from.
 *
 * ── WHY A PREVIEW EXISTS AT ALL ────────────────────────────────────────────
 *
 * Because the alternative is a button that produces a file somebody has to open
 * to find out whether it was right. The one failure this add-on has to make
 * impossible is a label that looks fine and scans as something else, and the
 * cheapest guard against it is letting a person see the bars beside the number
 * before they print two hundred of them.
 *
 * ── AND WHY IT SHARES `runsOf` WITH THE PDF ────────────────────────────────
 *
 * A preview drawn from a second encoding would be a preview of a different
 * barcode, which is worse than none: it would look like confirmation. This
 * takes the same `Modules` string `sheet.ts` takes, through the same run
 * collapser, so the only thing that differs between the screen and the paper is
 * the unit. `record-action.test.tsx` asserts the rect count on screen equals the
 * dark-run count of the encoding.
 *
 * `shapeRendering="crispEdges"` because a barcode is the one graphic where
 * anti-aliasing is a defect rather than a nicety: a half-lit pixel column at a
 * bar edge is exactly what a camera decoder reads as a narrower bar.
 *
 * IT IS `aria-hidden` AND CARRIES NO LABEL, which is the right answer rather
 * than a gap. The number is rendered as text immediately beside it, in every
 * place this is used, so a screen reader announcing the bars as well would read
 * the same thing twice — and there is no useful third thing to say about a
 * picture of a number that is already on the page.
 */
export function Bars({
  modules,
  height = 44,
  moduleWidth = 2,
}: {
  modules: Modules;
  height?: number;
  moduleWidth?: number;
}) {
  const width = modules.length * moduleWidth;
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="xMidYMid meet"
      shapeRendering="crispEdges"
      style={{ display: 'block', maxInlineSize: '100%' }}
    >
      <rect x={0} y={0} width={width} height={height} fill="var(--surface)" />
      {runsOf(modules)
        .filter((run) => run.dark)
        .map((run) => (
          <rect
            key={run.at}
            x={run.at * moduleWidth}
            y={0}
            width={run.width * moduleWidth}
            height={height}
            fill="var(--fg)"
          />
        ))}
    </svg>
  );
}

export function Panel({
  children,
  tone,
  style,
}: {
  children: ReactNode;
  /** A coloured edge for a card carrying an outcome. */
  tone?: 'pos' | 'danger';
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        border: tone === undefined ? '1px solid var(--border)' : `1.5px solid var(--${tone})`,
        background: 'var(--surface)',
        borderRadius: 14,
        padding: '15px 16px',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function PanelTitle({ children, tone }: { children: ReactNode; tone?: 'pos' | 'danger' }) {
  return (
    <div
      style={{
        fontSize: 13.5,
        fontWeight: 800,
        color: tone === undefined ? 'var(--fg)' : `var(--${tone})`,
      }}
    >
      {children}
    </div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--fg-muted)', marginBlockEnd: 8 }}>
      {children}
    </div>
  );
}

export function Note({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <p
      style={{
        margin: 0,
        fontSize: 11.5,
        lineHeight: 1.55,
        color: 'var(--fg-subtle)',
        ...style,
      }}
    >
      {children}
    </p>
  );
}

/**
 * A pill. IT WRAPS, and that is a repair inherited rather than a preference.
 *
 * `whiteSpace: 'nowrap'` is right for a two-word chip and wrong for the longest
 * thing a pill in this repository is ever asked to hold. `shipping-dhl`'s
 * overflowed a narrow panel and cut off the half of its own sentence that
 * mattered; `minInlineSize: 0` is the other half of the fix, because without it
 * a pill refuses to shrink below its content inside a flex row and wrapping
 * never gets a chance.
 */
export function Tag({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'pos' | 'warn' | 'info';
  children: ReactNode;
}) {
  const fg = tone === 'neutral' ? 'var(--fg-muted)' : `var(--${tone})`;
  const bg = tone === 'neutral' ? 'var(--surface-3)' : `var(--${tone}-soft)`;
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: fg,
        background: bg,
        padding: '3px 9px',
        borderRadius: 99,
        lineHeight: 1.45,
        minInlineSize: 0,
        overflowWrap: 'anywhere',
      }}
    >
      {children}
    </span>
  );
}

export function Button({
  children,
  onClick,
  variant = 'accent',
  disabled = false,
  style,
}: {
  children: ReactNode;
  onClick: () => void;
  variant?: 'accent' | 'ghost';
  disabled?: boolean;
  style?: CSSProperties;
}) {
  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 11,
    padding: '10px 15px',
    fontSize: 13,
    fontWeight: 800,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
  };
  const skin: CSSProperties =
    variant === 'ghost'
      ? { border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--fg)' }
      : { border: 0, background: 'var(--accent)', color: 'var(--accent-fg)' };

  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{ ...base, ...skin, ...style }}>
      {children}
    </button>
  );
}

/** A small text button for a destructive row action, so a row can be undone. */
export function LinkButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: 0,
        background: 'transparent',
        color: 'var(--fg-muted)',
        fontSize: 11.5,
        fontWeight: 700,
        cursor: 'pointer',
        padding: '2px 4px',
        textDecoration: 'underline',
      }}
    >
      {children}
    </button>
  );
}

export function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <label
      style={{ display: 'flex', flexDirection: 'column', gap: 5, minInlineSize: 0, flex: '1 1 160px' }}
    >
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-muted)' }}>{label}</span>
      {children}
    </label>
  );
}

export const inputStyle: CSSProperties = {
  border: '1px solid var(--border-strong)',
  borderRadius: 10,
  background: 'var(--surface-2)',
  padding: '9px 11px',
  fontSize: 13,
  color: 'var(--fg)',
  inlineSize: '100%',
  minInlineSize: 0,
};

/**
 * The line that stands where an add-on's not-affiliated notice would go.
 *
 * 24 AC6 asks every add-on's detail surface to be clear about who else is
 * involved. This one involves nobody, and rendering NOTHING there is
 * indistinguishable from having forgotten the notice — so it states the
 * positive fact instead. The host renders the same sentence from
 * `noCompanyKeys`; this repeats it at the foot of the form, where somebody
 * changing a setting is actually looking.
 */
export function NoCompany({ children }: { children: ReactNode }) {
  return (
    <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.5, color: 'var(--fg-subtle)' }}>
      {children}
    </p>
  );
}
