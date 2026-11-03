/**
 * A number field the builder's cards and settings share: what is typed
 * stays on screen, and the draft takes it only while it is a number in range.
 */
import { useEffect, useState, type ReactNode } from 'react';

import { NumberInput, type AddOnTranslate } from '../shared/host.ts';

export interface NumberFieldProps {
  t: AddOnTranslate;
  label: ReactNode;
  value: number | undefined;
  /** A number in range, or undefined when the field is emptied (and `optional`). */
  onChange: (value: number | undefined) => void;
  min: number;
  max: number;
  whole?: boolean;
  optional?: boolean;
  disabled?: boolean;
  unit?: ReactNode;
}

/** A number field: what is typed stays on screen; the draft changes only for a number in range. */
export function NumberField({ t, label, value, onChange, min, max, whole = true, optional = false, disabled, unit }: NumberFieldProps): ReactNode {
  const [text, setText] = useState(value === undefined ? '' : String(value));
  // A change made elsewhere (another language, an undo) shows; what is being typed stays.
  useEffect(() => {
    setText((typed) => (typed.trim() !== '' && Number(typed.replace(',', '.')) === value ? typed : value === undefined ? '' : String(value)));
  }, [value]);
  const parsed = text.trim() === '' ? undefined : Number(text.replace(',', '.'));
  const wrong = parsed === undefined ? !optional : Number.isNaN(parsed) || parsed < min || parsed > max || (whole && !Number.isInteger(parsed));
  return (
    <NumberInput
      label={label}
      value={text}
      whole={whole}
      negative={min < 0}
      disabled={disabled}
      {...(unit === undefined ? {} : { unit })}
      {...(wrong ? { error: t('builder.number.range', 'A number from {min} to {max}.', { min, max }) } : {})}
      onChange={(typed) => {
        setText(typed);
        const next = typed.trim() === '' ? undefined : Number(typed.replace(',', '.'));
        if (next === undefined ? optional : !Number.isNaN(next) && next >= min && next <= max && (!whole || Number.isInteger(next))) onChange(next);
      }}
    />
  );
}
