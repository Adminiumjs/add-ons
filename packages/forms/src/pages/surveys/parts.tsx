/**
 * THE SMALL PARTS A SURVEY'S RESULTS ARE DRAWN WITH.
 *
 * Built from the dashboard's own parts and classes: an add-on ships no
 * stylesheet and writes no inline style, so a bar of a given length is the
 * host's progress bar, and a bar of a given height is an SVG sized by its own
 * attributes. Every chart here reads left to right in every language: 0 is
 * always at the start of the scores, as on the stranger's page.
 */
import type { ComponentType, ReactNode } from 'react';

import { Figure, ProgressBar, lucideByName } from '../shared/host.ts';

/** The host's icon by name, hidden from a screen reader (the words beside it say what it means). */
export function Icon({ name, filled }: { name: string; filled?: boolean }): ReactNode {
  const Found = lucideByName(name) as ComponentType<{ className?: string; 'aria-hidden'?: boolean; fill?: string }>;
  return <Found aria-hidden className="size-4" {...(filled === true ? { fill: 'currentColor' } : {})} />;
}

/** A sentence with each number in it set in the mono face, as the comp sets its figures. */
export function Figures({ text }: { text: string }): ReactNode {
  const parts = text.split(/([+−-]?\d[\d.,]*%?)/u);
  return (
    <>
      {parts.map((part, i) => (i % 2 === 1 ? <Figure key={String(i)}>{part}</Figure> : part === '' ? null : <span key={String(i)}>{part}</span>))}
    </>
  );
}

/** The kind of question in micro capitals over its title, at the head of each results card. */
export function Head({ kind, title, id }: { kind: string; title: string; id: string }): ReactNode {
  return (
    <span className="flex flex-col gap-1">
      <span className="text-[10.5px] font-bold uppercase tracking-wide text-fg-subtle">{kind}</span>
      <h2 id={id} className="text-[14.5px] font-bold text-fg">
        {title}
      </h2>
    </span>
  );
}

/** The host's progress bar, with the height it takes (the host's part draws 4, 6 or 10 px). */
const Bar = ProgressBar as ComponentType<{ value: number; max?: number; label?: string; tone?: 'neutral' | 'accent' | 'pos' | 'warn' | 'danger' | 'info'; size?: 'sm' | 'md' | 'lg' }>;

/** One row of counted answers: what was given, a bar as long as its share, and how many gave it. */
export function CountRow({ label, n, of, tone, mono }: { label: ReactNode; n: number; of: number; tone: 'accent' | 'warn'; mono?: boolean }): ReactNode {
  return (
    <div className="flex items-center gap-3 text-body-sm" data-part="count-row">
      {mono === true ? <span className="inline-flex w-11 shrink-0 items-center gap-1 font-mono text-fg-muted">{label}</span> : <span className="w-28 shrink-0 truncate text-fg-muted">{label}</span>}
      <span className="min-w-0 flex-1">
        <Bar value={n} max={Math.max(of, 1)} tone={tone} size="md" />
      </span>
      <span className="w-7 shrink-0 text-end font-mono">{String(n)}</span>
    </div>
  );
}

/** The bar under "{n} answers from {m} invited": 8 px in the comp, the host's nearest. */
export function AnsweredBar({ answered, invited, label }: { answered: number; invited: number; label: string }): ReactNode {
  return (
    <span className="block max-w-[420px]">
      <Bar value={answered} max={Math.max(invited, 1)} label={label} size="md" />
    </span>
  );
}

type Tone = 'danger' | 'neutral' | 'pos';

/** Paints what it holds in a tone's colour: the SVG's `currentColor`. */
function Tint({ tone, children }: { tone: Tone; children: ReactNode }): ReactNode {
  if (tone === 'danger') return <g className="text-danger">{children}</g>;
  if (tone === 'pos') return <g className="text-pos">{children}</g>;
  return <g className="text-fg-subtle">{children}</g>;
}

const toneOfScore = (score: number): 'danger' | 'neutral' | 'pos' => (score <= 6 ? 'danger' : score <= 8 ? 'neutral' : 'pos');

/** Wouldn't, neutral and would recommend side by side, each as long as its share (comp 593). */
export function ThreePart({ wouldnt, neutral, would, label }: { wouldnt: number; neutral: number; would: number; label: string }): ReactNode {
  const total = wouldnt + neutral + would;
  if (total === 0) return null;
  // Would recommend first, as the comp draws it.
  const parts: { n: number; tone: Tone }[] = [
    { n: would, tone: 'pos' },
    { n: neutral, tone: 'neutral' },
    { n: wouldnt, tone: 'danger' },
  ];
  let at = 0;
  return (
    <span role="img" aria-label={label} className="block overflow-hidden rounded-full" dir="ltr">
      <svg aria-hidden width="100%" height="10" focusable="false">
        {parts.map((part, i) => {
          const x = (at / total) * 100;
          at += part.n;
          if (part.n === 0) return null;
          // Each part after the first leaves a 2 px gap at its start.
          return (
            <svg key={String(i)} x={`${x}%`} width={`${(part.n / total) * 100}%`} height="10">
              <Tint tone={part.tone}>
                <rect x={x === 0 ? 0 : 2} width="100%" height="10" fill="currentColor" />
              </Tint>
            </svg>
          );
        })}
      </svg>
    </span>
  );
}

/** The eleven bars of a 0–10 score, 0 at the start whatever the language, the count over each and the score under it (comp 598-604). */
export function Spread({ counts, label }: { counts: readonly number[]; label: string }): ReactNode {
  const most = Math.max(1, ...counts);
  return (
    <span className="flex flex-col gap-2" dir="ltr">
      <span role="img" aria-label={label} className="flex items-end gap-1.5" data-part="spread">
        {counts.map((n, score) => {
          const height = Math.max(3, Math.round((n / most) * 120));
          return (
            <span key={String(score)} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1" data-score={String(score)} data-height={String(height)}>
              <span className="font-mono text-caption text-fg-muted">{String(n)}</span>
              <svg aria-hidden width="100%" height={height} focusable="false" data-tone={toneOfScore(score)}>
                <Tint tone={toneOfScore(score)}>
                  <rect width="100%" height="100%" rx="6" fill="currentColor" />
                  <rect y={height / 2} width="100%" height={height / 2} rx="2" fill="currentColor" />
                </Tint>
              </svg>
            </span>
          );
        })}
      </span>
      <span aria-hidden className="flex gap-1.5 border-t border-border pt-2">
        {counts.map((_, score) => (
          <span key={String(score)} className="min-w-0 flex-1 text-center font-mono text-caption font-bold">
            {String(score)}
          </span>
        ))}
      </span>
    </span>
  );
}

/** Five stars, as many filled as the average rounds to. */
export function FiveStars({ average }: { average: number }): ReactNode {
  const filled = Math.round(average);
  return (
    <span aria-hidden className="inline-flex gap-1 text-warn" data-part="five-stars" data-filled={String(filled)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon key={String(n)} name="star" filled={n <= filled} />
      ))}
    </span>
  );
}
