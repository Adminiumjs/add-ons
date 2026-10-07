/**
 * A QUANTITY, AS TEXT.
 *
 * Counted in packs it takes whole numbers; counted in units it takes the
 * unit's own decimals, none to three. Text in and text out: a quantity is
 * never a number on its way through a screen.
 */
import type { ReactNode } from 'react';

import { NumberInput } from './host.ts';

export interface QtyInputProps {
  value: string;
  onChange: (value: string) => void;
  /** The unit's decimals, 0 to 3. Ignored when counting packs. */
  decimals?: number;
  /** Counting packs: whole numbers only. */
  packs?: boolean;
  unit?: ReactNode;
  error?: ReactNode;
  disabled?: boolean;
  id?: string;
  label: string;
  /** Draw the label above the field (a card) instead of naming the field for a screen reader only (a table cell). */
  labelled?: boolean;
  onBlur?: () => void;
}

export function QtyInput({ value, onChange, decimals, packs, unit, error, disabled, id, label, labelled, onBlur }: QtyInputProps): ReactNode {
  const places = Math.min(3, Math.max(0, Math.trunc(decimals ?? 0)));
  return (
    <NumberInput
      value={value}
      onChange={onChange}
      {...(packs === true ? { whole: true } : { decimals: places })}
      {...(unit === undefined ? {} : { unit })}
      {...(error === undefined ? {} : { error })}
      {...(disabled === undefined ? {} : { disabled })}
      {...(id === undefined ? {} : { id })}
      {...(onBlur === undefined ? {} : { onBlur })}
      {...(labelled === true ? { label } : { 'aria-label': label })}
    />
  );
}
