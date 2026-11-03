/**
 * WHERE A SURVEY'S OWN SETTINGS JOIN THE BUILDER.
 *
 * On a survey the form settings' column shows "Each answer becomes", "After
 * sending" and "Tell" from this folder, and the survey's own sections
 * (who answers, linking names, when to stop taking answers) from the
 * surveys' folder, listed here. "Tell" also draws the surveys' low-score
 * condition under its rows when one is given.
 *
 * Each body edits the same draft as the rest of the builder, through
 * `change`, and is saved with it.
 */
import type { ComponentType } from 'react';

import type { AddOnTranslate } from '../shared/host.ts';
import type { FormRow } from '../shared/row.ts';
import type { Draft, Lang } from './draft.ts';

export interface SurveySectionProps {
  t: AddOnTranslate;
  form: FormRow;
  draft: Draft;
  change: (next: (draft: Draft) => Draft) => void;
  /** The language being edited. */
  editing: Lang;
  mayEdit: boolean;
}

export interface SurveySection {
  /** Its name in `?settings=<id>`. */
  id: string;
  /** A Lucide icon's name, for the head's tile. */
  icon: string;
  title: (t: AddOnTranslate) => string;
  /** The one line the head shows while the section is closed. */
  summary: (t: AddOnTranslate, draft: Draft) => string;
  Body: ComponentType<SurveySectionProps>;
}

/** The survey's own sections, after this folder's three. */
export const SURVEY_SECTIONS: readonly SurveySection[] = [];

/** Drawn under Tell's rows on a survey: the low-score condition. */
export const SURVEY_TELL_EXTRA: ComponentType<SurveySectionProps> | null = null;
