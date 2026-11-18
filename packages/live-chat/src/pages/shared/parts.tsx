/**
 * THE SMALL PARTS EVERY SCREEN DRAWS: an icon by its name, a person's round
 * initials, the "Website" chip, a status pill, a micro title.
 *
 * Every class here is one the dashboard already draws (an add-on ships no
 * stylesheet), and each is written out whole, never put together while the
 * screen runs, so the check in `strings.test.ts` can read it.
 */
import type { ReactNode } from 'react';

import { lucideByName } from './host.ts';

export function Icon({ name }: { name: string }): ReactNode {
  const Found = lucideByName(name);
  return <Found className="size-4" aria-hidden="true" />;
}

/** A smaller icon, for chips and lines of 11–12.5 px. */
export function SmallIcon({ name }: { name: string }): ReactNode {
  const Found = lucideByName(name);
  return <Found className="size-3.5" aria-hidden="true" />;
}

export type Tone = 'info' | 'pos' | 'warn' | 'neutral' | 'accent';
const TONES: readonly Tone[] = ['info', 'pos', 'warn', 'accent', 'neutral'];

/** The same tone for the same chat every time it is drawn. */
export const toneOf = (id: string, named: boolean): Tone => (named ? TONES[Math.abs(Number(id) || 0) % 4]! : 'neutral');

function ToneFill({ tone, children }: { tone: Tone; children: ReactNode }): ReactNode {
  switch (tone) {
    case 'info':
      return <span className="flex size-full items-center justify-center rounded-full bg-info-soft text-info">{children}</span>;
    case 'pos':
      return <span className="flex size-full items-center justify-center rounded-full bg-pos-soft text-pos">{children}</span>;
    case 'warn':
      return <span className="flex size-full items-center justify-center rounded-full bg-warn-soft text-warn">{children}</span>;
    case 'accent':
      return <span className="flex size-full items-center justify-center rounded-full bg-accent-soft text-accent">{children}</span>;
    case 'neutral':
      return <span className="flex size-full items-center justify-center rounded-full bg-surface-3 text-fg-muted">{children}</span>;
  }
}

/** Round initials: 28 beside a message, 36 in a row and the thread's header, 44 in the side rail. */
export function Avatar({ initials, tone, size }: { initials: string; tone: Tone; size: 28 | 36 | 44 }): ReactNode {
  const fill = <ToneFill tone={tone}>{initials}</ToneFill>;
  if (size === 28)
    return (
      <span aria-hidden="true" className="inline-flex size-7 shrink-0 text-[10px] font-extrabold">
        {fill}
      </span>
    );
  if (size === 36)
    return (
      <span aria-hidden="true" className="inline-flex size-9 shrink-0 text-[13px] font-extrabold">
        {fill}
      </span>
    );
  return (
    <span aria-hidden="true" className="inline-flex size-11 shrink-0 text-[16px] font-extrabold">
      {fill}
    </span>
  );
}

/** "Website": where every chat of this add-on comes from. */
export function WebsiteChip({ label }: { label: string }): ReactNode {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-info-soft px-1.5 text-[10.5px] font-bold text-info">
      <SmallIcon name="globe" />
      {label}
    </span>
  );
}

/** The thread's status: amber waiting, accent answering, neutral closed. */
export function Pill({ tone, children }: { tone: 'warn' | 'accent' | 'neutral'; children: ReactNode }): ReactNode {
  if (tone === 'warn') return <span className="whitespace-nowrap rounded-full bg-warn-soft px-2 text-[11.5px] font-bold text-warn">{children}</span>;
  if (tone === 'accent') return <span className="whitespace-nowrap rounded-full bg-accent-soft px-2 text-[11.5px] font-bold text-accent">{children}</span>;
  return <span className="whitespace-nowrap rounded-full bg-surface-3 px-2 text-[11.5px] font-bold text-fg-muted">{children}</span>;
}

/** A label in small capitals: "Visitor", "Automatic answers in this chat". */
export function MicroTitle({ children }: { children: ReactNode }): ReactNode {
  return <span className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-fg-subtle">{children}</span>;
}
