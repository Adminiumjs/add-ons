/**
 * THE SETTINGS PAGE'S OWN PARTS: a card as the comp draws one, and the
 * comp's switch (a `button role="switch"`), which stays pressable while it
 * is blocked so a press can say why.
 */
import type { ReactNode } from 'react';

/** A card: surface, border, radius 14, the comp's padding and gap. */
export function Section({ children, labelledBy }: { children: ReactNode; labelledBy?: string }): ReactNode {
  return (
    <section aria-labelledby={labelledBy} className="flex flex-col gap-3.5 rounded-[14px] border border-border bg-surface p-5 shadow-sm">
      {children}
    </section>
  );
}

export function SectionTitle({ id, children }: { id?: string; children: ReactNode }): ReactNode {
  return (
    <h3 id={id} className="m-0 text-[14.5px] font-bold tracking-[-0.01em]">
      {children}
    </h3>
  );
}

export interface ToggleProps {
  on: boolean;
  /** Blocked: drawn faded and `aria-disabled`, still pressable so it can say why. */
  blocked?: boolean;
  label?: string;
  labelledBy?: string;
  onPress: () => void;
}

export function Toggle({ on, blocked = false, label, labelledBy, onPress }: ToggleProps): ReactNode {
  const knob = on ? <span className="ms-4 size-5 rounded-full bg-white shadow-sm" /> : <span className="size-5 rounded-full bg-white shadow-sm" />;
  if (blocked)
    return (
      <button type="button" role="switch" aria-checked={on} aria-disabled="true" aria-label={label} aria-labelledby={labelledBy} onClick={onPress} className="inline-flex h-6 w-10 shrink-0 cursor-not-allowed items-center rounded-full bg-border-strong p-0.5 opacity-50">
        {knob}
      </button>
    );
  return on ? (
    <button type="button" role="switch" aria-checked="true" aria-label={label} aria-labelledby={labelledBy} onClick={onPress} className="inline-flex h-6 w-10 shrink-0 items-center rounded-full bg-accent p-0.5">
      {knob}
    </button>
  ) : (
    <button type="button" role="switch" aria-checked="false" aria-label={label} aria-labelledby={labelledBy} onClick={onPress} className="inline-flex h-6 w-10 shrink-0 items-center rounded-full bg-fg-muted p-0.5">
      {knob}
    </button>
  );
}
