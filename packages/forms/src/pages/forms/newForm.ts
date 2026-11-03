/**
 * A NEW FORM OR SURVEY: a draft row, made in the reader's language.
 *
 * A draft saves freely and is held to the vocabulary only when it is
 * published, so it starts with a title and no question. Its link name is a
 * short random word Adminium serves under `/x/forms/`: lower-case letters and
 * digits, never one of the words an address of this add-on reserves.
 */
import { FORM_LANGUAGES, FORMS_VOCABULARY_VERSION, FORM_PER_HOUR_DEFAULT, SURVEY_STOP_AFTER_DAYS_DEFAULT, type FormLanguage } from '@adminium/add-on-contracts/forms';

import type { AddOnTranslate, DataValue } from '../shared/host.ts';
import type { Kind } from '../shared/paths.ts';
import { asJson } from '../shared/row.ts';

/** The language a new form is written in: the reader's, where a form may be written in it. */
export function languageFor(locale: string): FormLanguage {
  return (FORM_LANGUAGES as readonly string[]).includes(locale) ? (locale as FormLanguage) : 'en-US';
}

const LETTERS = 'abcdefghijkmnpqrstuvwxyz23456789';

/**
 * `form-k3x9qz`: six letters or digits that read unambiguously, after the
 * kind — always a slug Adminium serves, and never `api` or `surveys`.
 * TODO(0.3.41): check a typed slug with `isFormSlug` from
 * `@adminium/add-on-contracts/forms` (with `FORM_SLUGS_RESERVED`) once the
 * floor is 0.3.41; the builder's slug field needs it, this maker does not.
 */
export function newSlug(kind: Kind, random: (bytes: Uint8Array) => Uint8Array = (bytes) => crypto.getRandomValues(bytes)): string {
  const bytes = random(new Uint8Array(6));
  return `${kind}-${[...bytes].map((byte) => LETTERS[byte % LETTERS.length]).join('')}`;
}

/**
 * A random UUID (version 4). Made from `getRandomValues`, which a page served
 * over plain http on a local network has too (`randomUUID` it has not).
 */
export function randomKey(random: (bytes: Uint8Array) => Uint8Array = (bytes) => crypto.getRandomValues(bytes)): string {
  const bytes = random(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * The values of a new draft's row. Its key is made here: the forms table's
 * key is text that nothing on the server fills on a staff create, and
 * Postgres and MySQL refuse a row without one (SQLite would keep a row no
 * address can open again).
 */
export function draftValues(t: AddOnTranslate, kind: Kind, locale: string, slug: string, newKey: () => string = randomKey): Record<string, DataValue> {
  const language = languageFor(locale);
  const title = kind === 'survey' ? t('list.untitledSurvey', 'Untitled survey') : t('list.untitledForm', 'Untitled form');
  const thanks = kind === 'survey' ? t('list.thanksSurvey', 'Thank you. Your answers help us.') : t('list.thanksForm', 'Thank you. We have your answers.');
  const definition = {
    v: FORMS_VOCABULARY_VERSION,
    kind,
    languages: [language],
    defaultLanguage: language,
    title: { [language]: title },
    questions: [],
    ending: { kind: 'words', words: { [language]: thanks } },
  };
  const settings = {
    becomes: null,
    tell: [],
    limits: { perHour: FORM_PER_HOUR_DEFAULT, harder: false },
    ...(kind === 'survey' ? { survey: { mode: 'named', linkNames: true, stopAfterDays: SURVEY_STOP_AFTER_DAYS_DEFAULT } } : {}),
  };
  return { id: newKey(), kind, slug, name: title, state: 'draft', definition: asJson(definition), settings: asJson(settings) };
}
