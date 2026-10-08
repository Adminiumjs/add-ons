/**
 * HOW A CODE IS SHOWN.
 *
 * A card's, a voucher's or a pack's whole code is shown in two places only:
 * the result of the save that made it, once, and the heading that repeats
 * what a person has just typed. Everywhere else it is its last four
 * characters. Always left to right, whatever the language.
 */
import type { ReactNode } from 'react';

import { Figure } from './host.ts';

/** "···· Q4XP": the end of a code, for a reader who is never shown the rest. */
export function CodeEnd({ last4 }: { last4: string | null | undefined }): ReactNode {
  if (last4 === null || last4 === undefined || last4 === '') return null;
  return (
    <span dir="ltr">
      <Figure>{`···· ${last4}`}</Figure>
    </span>
  );
}

/** Twelve characters as three groups of four; anything else as it is. */
export function groupsOf(code: string): string[] {
  const bare = code.replace(/[\s-]/g, '').toUpperCase();
  if (bare.length !== 12) return [bare];
  return [bare.slice(0, 4), bare.slice(4, 8), bare.slice(8, 12)];
}

/** The two letters a code is said with: a card's, a pack's, a voucher's. */
export function wordOf(kind: 'gift-card' | 'pack' | 'voucher'): string {
  return kind === 'gift-card' ? 'GC' : kind === 'pack' ? 'PK' : 'VC';
}

/** A whole code, drawn large in its groups — the "shown once" result. */
export function CodeChips({ code, word, label }: { code: string; word: string; label: string }): ReactNode {
  const groups = [word, ...groupsOf(code)];
  return (
    <span dir="ltr" role="group" aria-label={label} data-part="code-chips">
      {groups.map((group, index) => (
        <Figure key={String(index)}>{index === 0 ? group : `-${group}`}</Figure>
      ))}
    </span>
  );
}
