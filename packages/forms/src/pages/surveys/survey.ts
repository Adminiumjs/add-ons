/**
 * A SURVEY'S OWN SETTINGS AND QUESTIONS, READ LENIENTLY.
 *
 * A draft may be half made, so nothing here parses a definition against the
 * vocabulary: it reads what is there, and every change it makes is a new
 * settings object the vocabulary accepts (`formSettingsSchema`):
 *
 *  - "People you invite" (`mode: 'named'`): invitations only, each person's
 *    own link; names linked to answers unless switched off; each invitation's
 *    link stops after `stopAfterDays`.
 *  - "Anyone with the link" (`mode: 'anonymous'`): one open link, names never
 *    kept, so `linkNames` is off and nothing becomes a row.
 *
 * An answer that keeps no name becomes no row (the row would say who
 * answered), so turning names off takes the survey's "becomes" away with it.
 */
import { keepsNames, SURVEY_STOP_AFTER_DAYS_DEFAULT } from '@adminium/add-on-contracts/forms';

export type SurveyMode = 'named' | 'anonymous';

export interface SurveyShape {
  mode: SurveyMode;
  linkNames: boolean;
  stopAfterDays: number;
}

/** The most days a survey's invitation link may stay open, and the fewest. */
export const STOP_AFTER_MIN = 1;
export const STOP_AFTER_MAX = 365;
/** The score at most which "Only when the score is low" tells, unless set otherwise. */
export const LOW_SCORE_DEFAULT = 6;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** The settings as an object, whatever the column held. */
export const settingsObject = (settings: unknown): Record<string, unknown> => (isRecord(settings) ? settings : {});

/** A survey's three settings, with the vocabulary's defaults where a draft has none. */
export function surveyOf(settings: unknown): SurveyShape {
  const survey = settingsObject(settings)['survey'];
  const held = isRecord(survey) ? survey : {};
  const mode: SurveyMode = held['mode'] === 'anonymous' ? 'anonymous' : 'named';
  const days = held['stopAfterDays'];
  return {
    mode,
    linkNames: mode === 'named' && held['linkNames'] !== false,
    stopAfterDays: typeof days === 'number' && Number.isInteger(days) ? days : SURVEY_STOP_AFTER_DAYS_DEFAULT,
  };
}

/** Whether the survey's answers say who sent them: named, with names linked. */
export const keepsNamesOf = (settings: unknown): boolean => keepsNames({ survey: surveyOf(settings) });

function withSurvey(settings: unknown, survey: SurveyShape): Record<string, unknown> {
  const next: Record<string, unknown> = { ...settingsObject(settings), survey };
  // A survey that keeps no names becomes no row: the vocabulary refuses one that tries.
  if (!keepsNames({ survey })) next['becomes'] = null;
  return next;
}

/** Who answers: invited people, or anyone with the open link (which never keeps names). */
export function withMode(settings: unknown, mode: SurveyMode): Record<string, unknown> {
  const now = surveyOf(settings);
  return withSurvey(settings, { ...now, mode, linkNames: mode === 'named' });
}

/** Link answers to names, on a named survey; an anonymous one never does. */
export function withLinkNames(settings: unknown, linkNames: boolean): Record<string, unknown> {
  const now = surveyOf(settings);
  return withSurvey(settings, { ...now, linkNames: now.mode === 'named' && linkNames });
}

/** How many days after each invitation its link takes answers; null when the number is not one it may be. */
export function withStopAfter(settings: unknown, typed: string): Record<string, unknown> | null {
  if (!/^\d{1,3}$/.test(typed.trim())) return null;
  const days = Number(typed.trim());
  if (days < STOP_AFTER_MIN || days > STOP_AFTER_MAX) return null;
  return withSurvey(settings, { ...surveyOf(settings), stopAfterDays: days });
}

/** One question of a definition, as much as the results and the settings read of it. */
export interface QuestionGlance {
  id: string;
  kind: string;
  label: Readonly<Record<string, string>>;
  recommend: boolean;
  choices: readonly { id: string; label: Readonly<Record<string, string>> }[];
}

const wordsOf = (value: unknown): Readonly<Record<string, string>> => (isRecord(value) ? (Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string')) as Record<string, string>) : {});

/** The questions of a definition, in order, read leniently. */
export function questionsOf(definition: unknown): QuestionGlance[] {
  if (!isRecord(definition) || !Array.isArray(definition['questions'])) return [];
  return definition['questions'].filter(isRecord).map((question) => ({
    id: typeof question['id'] === 'string' ? question['id'] : '',
    kind: typeof question['kind'] === 'string' ? question['kind'] : '',
    label: wordsOf(question['label']),
    recommend: question['recommend'] === true,
    choices: Array.isArray(question['choices']) ? question['choices'].filter(isRecord).map((choice) => ({ id: typeof choice['id'] === 'string' ? choice['id'] : '', label: wordsOf(choice['label']) })) : [],
  }));
}

/** The survey's recommend question: its one Score 0–10 marked so. */
export const recommendOf = (definition: unknown): QuestionGlance | null => questionsOf(definition).find((question) => question.kind === 'score' && question.recommend) ?? null;

/** "Only when the score is low": the score at most which Tell tells; null when it tells on every answer. */
export function lowScoreOf(settings: unknown): number | null {
  const when = settingsObject(settings)['tellWhen'];
  return isRecord(when) && typeof when['atMost'] === 'number' ? when['atMost'] : null;
}

/** Tell only on a low recommend score, or on every answer again (`question` null). */
export function withLowScore(settings: unknown, question: string | null): Record<string, unknown> {
  const next: Record<string, unknown> = { ...settingsObject(settings) };
  if (question === null) delete next['tellWhen'];
  else next['tellWhen'] = { question, atMost: lowScoreOf(settings) ?? LOW_SCORE_DEFAULT };
  return next;
}

/** A text in the reader's language where it has one, else in the form's own, else any. */
export function wordsIn(words: Readonly<Record<string, string>>, locale: string, fallback: string | null): string {
  return words[locale] ?? (fallback === null ? undefined : words[fallback]) ?? Object.values(words)[0] ?? '';
}
