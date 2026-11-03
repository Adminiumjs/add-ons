/**
 * WHAT EVERY TAB OF A FORM IS HANDED.
 *
 * The frame (`forms/FormScreen.tsx`) reads the form's row once and draws the
 * header and the tabs; each tab's body is a screen of its own folder
 * (`builder/`, `share/`, `answers/`, `surveys/`) and takes exactly this.
 */
import type { AddOnTranslate, FormSummaryAnswer } from './host.ts';
import type { FormRow } from './row.ts';

export interface TabProps {
  t: AddOnTranslate;
  form: FormRow;
  /** Read the row again: after a save that changed what the frame shows. */
  refetch: () => void;
  /** The form's counted results, when it has any (null while loading and for a draft). */
  summary: FormSummaryAnswer | null;
  /** `?answer=<id>`: the answer a staff link opens (the answers sheet, a survey's results). */
  answer: string | null;
  /** `?settings=<section>`: the form settings section a staff link opens (`limits`). */
  settings: string | null;
}
