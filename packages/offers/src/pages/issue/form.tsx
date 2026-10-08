/** What the three forms of the Issue sheet share: what needs fixing, said once at the top and again on each field. */
import type { ReactNode } from 'react';

import { Alert, type AddOnTranslate, type DataError } from '../shared/host.ts';
import { refusal } from '../shared/refusal.ts';

/** A field's name, and what is wrong with it. */
export type Wrong = Readonly<Record<string, string>>;

export const wrongOf = (t: AddOnTranslate, error: DataError): Wrong => {
  const said = refusal(t, error);
  return { [said.field ?? '']: said.message };
};

/** "3 things need fixing", or the one sentence a refusal had no field for. */
export function Fixes({ t, wrong }: { t: AddOnTranslate; wrong: Wrong }): ReactNode {
  const fields = Object.keys(wrong).filter((field) => field !== '');
  const general = wrong[''];
  if (general !== undefined) return <Alert tone="danger" role="alert" title={general} />;
  if (fields.length === 0) return null;
  return <Alert tone="danger" role="alert" title={t('issue.fixes', '{n, plural, one {# thing needs} other {# things need}} fixing', { n: fields.length })} />;
}

export const positive = (amount: string): boolean => /^\d+(\.\d+)?$/.test(amount) && /[1-9]/.test(amount);
export const isEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
export const blankToNull = (value: string): string | null => (value.trim() === '' ? null : value.trim());
