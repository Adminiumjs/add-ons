/**
 * A FORM BEING BUILT: its definition and its settings as the builder edits
 * them, and every change the builder makes to them.
 *
 * A draft saves freely and is held to the vocabulary only when it is
 * published, so nothing here refuses a change: it reads what is stored
 * leniently, and each change gives back a new draft that `parseForm` judges
 * later. What it does keep is the shape: questions grouped in their sections'
 * order, ids the vocabulary takes, a "show if" never pointing forward, and
 * nothing left behind that names a question no longer there.
 *
 * Pure: no I/O, no clock (a day is handed in).
 */
import {
  FORM_CHOICES_MAX,
  FORM_FILE_KINDS,
  FORM_LANGUAGES,
  FORM_PER_HOUR_DEFAULT,
  FORM_QUESTION_KINDS,
  FORM_TICK_PURPOSES,
  FORMS_VOCABULARY_VERSION,
  SHOW_IF_KINDS,
  type FormDefinitionInput,
  type FormFileKind,
  type FormLanguage,
  type FormQuestionKind,
  type FormSettingsInput,
  type FormTickPurpose,
  type ShowIf,
} from '@adminium/add-on-contracts/forms';

export type Lang = FormLanguage;
export type Words = Partial<Record<Lang, string>>;
export type Question = FormDefinitionInput['questions'][number];
export type QuestionOf<K extends FormQuestionKind> = Extract<Question, { kind: K }>;
export type Section = NonNullable<FormDefinitionInput['sections']>[number];
export type Definition = FormDefinitionInput & { sections?: Section[]; questions: Question[] };
export type Settings = FormSettingsInput;
export type Becomes = NonNullable<Settings['becomes']>;
export type Tell = NonNullable<Settings['tell']>[number];

/** What the builder holds: the two JSON columns of the form's row. */
export interface Draft {
  definition: Definition;
  settings: Settings;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isLang = (value: unknown): value is Lang => typeof value === 'string' && (FORM_LANGUAGES as readonly string[]).includes(value);

function wordsOf(value: unknown): Words {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [Lang, string] => isLang(entry[0]) && typeof entry[1] === 'string'));
}

/** A stored definition, read leniently: whatever is not a form's shape is left out. */
export function definitionOf(stored: unknown, kind: 'form' | 'survey', fallback: Lang): Definition {
  const d = isRecord(stored) ? stored : {};
  const listed = Array.isArray(d['languages']) ? d['languages'].filter(isLang) : [];
  const languages = listed.length === 0 ? [isLang(d['defaultLanguage']) ? d['defaultLanguage'] : fallback] : [...new Set(listed)];
  const defaultLanguage = isLang(d['defaultLanguage']) && languages.includes(d['defaultLanguage']) ? d['defaultLanguage'] : languages[0]!;
  const questions = (Array.isArray(d['questions']) ? d['questions'] : []).filter(
    (question): question is Question => isRecord(question) && typeof question['id'] === 'string' && (FORM_QUESTION_KINDS as readonly unknown[]).includes(question['kind']),
  );
  const sections = (Array.isArray(d['sections']) ? d['sections'] : []).filter((section): section is Section => isRecord(section) && typeof section['id'] === 'string').map((section) => ({ id: section.id, title: wordsOf(section.title) }));
  const ending = isRecord(d['ending']) && d['ending']['kind'] === 'page' && typeof d['ending']['url'] === 'string' ? { kind: 'page' as const, url: d['ending']['url'] } : { kind: 'words' as const, words: wordsOf(isRecord(d['ending']) ? d['ending']['words'] : undefined) };
  return {
    v: FORMS_VOCABULARY_VERSION,
    kind,
    languages,
    defaultLanguage,
    title: wordsOf(d['title']),
    ...(d['intro'] === undefined ? {} : { intro: wordsOf(d['intro']) }),
    ...(sections.length === 0 ? {} : { sections }),
    questions: questions.map((question) => ({ ...question, label: wordsOf(question.label), ...(question.help === undefined ? {} : { help: wordsOf(question.help) }) }) as Question),
    ending,
  };
}

/** Stored settings, read leniently. */
export function settingsOf(stored: unknown, kind: 'form' | 'survey'): Settings {
  const s = isRecord(stored) ? stored : {};
  const limits = isRecord(s['limits']) ? s['limits'] : {};
  const becomes = isRecord(s['becomes']) && typeof s['becomes']['table'] === 'string' ? (s['becomes'] as Becomes) : null;
  return {
    becomes: becomes === null ? null : { table: becomes.table, map: isRecord(becomes.map) ? { ...(becomes.map as Record<string, string>) } : {}, ...(isRecord(becomes.source) ? { source: becomes.source } : {}) },
    tell: Array.isArray(s['tell']) ? (s['tell'].filter((one) => isRecord(one) && (one['kind'] === 'role' || one['kind'] === 'person') && typeof one['id'] === 'string') as Tell[]) : [],
    ...(isRecord(s['tellWhen']) ? { tellWhen: s['tellWhen'] as Settings['tellWhen'] } : {}),
    limits: { perHour: typeof limits['perHour'] === 'number' ? limits['perHour'] : FORM_PER_HOUR_DEFAULT, harder: limits['harder'] === true },
    ...(kind === 'survey' && isRecord(s['survey']) ? { survey: s['survey'] as Settings['survey'] } : {}),
  };
}

export const draftOf = (definition: unknown, settings: unknown, kind: 'form' | 'survey', fallback: Lang): Draft => ({ definition: definitionOf(definition, kind, fallback), settings: settingsOf(settings, kind) });

/* ── reading ────────────────────────────────────────────────────────────── */

/** A text in a language, else in the form's own, else nothing. */
export const wordIn = (words: Words | undefined, lang: Lang, fallback?: Lang): string => words?.[lang] ?? (fallback === undefined ? undefined : words?.[fallback]) ?? '';

export const questionAt = (d: Definition, id: string): Question | undefined => d.questions.find((question) => question.id === id);
export const numberOf = (d: Definition, id: string): number => d.questions.findIndex((question) => question.id === id) + 1;
export const ticksOf = (d: Definition): QuestionOf<'tick'>[] => d.questions.filter((question): question is QuestionOf<'tick'> => question.kind === 'tick');
export const filesOf = (d: Definition): QuestionOf<'file'>[] => d.questions.filter((question): question is QuestionOf<'file'> => question.kind === 'file');

/** The kinds the rail offers: a survey takes no file and signs nobody up. */
export const kindsFor = (kind: 'form' | 'survey'): readonly FormQuestionKind[] => (kind === 'survey' ? FORM_QUESTION_KINDS.filter((one) => one !== 'file' && one !== 'tick') : FORM_QUESTION_KINDS);

/** The purposes no tick of the form asks for yet: a tick may only take one of these. */
export const freePurposes = (d: Definition, except?: string): FormTickPurpose[] => FORM_TICK_PURPOSES.filter((purpose) => !ticksOf(d).some((tick) => tick.id !== except && tick.purpose === purpose));

/** The questions a "show if" on this question may name: earlier ones whose answer is a pick or a number. */
export function showIfTargets(d: Definition, id: string): Question[] {
  const at = d.questions.findIndex((question) => question.id === id);
  if (at <= 0 || d.questions[at]?.kind === 'hidden') return [];
  return d.questions.slice(0, at).filter((question) => (SHOW_IF_KINDS as readonly string[]).includes(question.kind));
}

/** The test a "show if" makes, by the kind of question it names. */
export function testsFor(kind: FormQuestionKind): readonly ('is' | 'includes' | 'atLeast' | 'atMost')[] {
  if (kind === 'one') return ['is'];
  if (kind === 'several') return ['includes'];
  return ['is', 'atLeast', 'atMost'];
}

/** The questions whose "show if" names this one. */
export const dependentsOf = (d: Definition, id: string): Question[] => d.questions.filter((question) => question.showIf?.question === id);

/* ── ids ────────────────────────────────────────────────────────────────── */

function nextId(taken: Iterable<string>, prefix: 'q' | 's'): string {
  let most = 0;
  for (const id of taken) {
    const n = /^[qs](\d+)$/.exec(id)?.[1];
    if (n !== undefined) most = Math.max(most, Number(n));
  }
  return `${prefix}${String(most + 1)}`;
}

/** A choice's id read from its words: lower-case letters and digits, joined by dashes, never one taken. */
export function choiceIdFrom(words: string, taken: readonly string[]): string {
  const base =
    words
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 36)
      .replace(/-+$/, '') || 'choice';
  if (!taken.includes(base)) return base;
  for (let n = 2; ; n += 1) if (!taken.includes(`${base}-${String(n)}`)) return `${base}-${String(n)}`;
}

/* ── changing ───────────────────────────────────────────────────────────── */

const withQuestions = (d: Definition, questions: Question[]): Definition => ({ ...d, questions });
const mapQuestion = (d: Definition, id: string, change: (question: Question) => Question): Definition => withQuestions(d, d.questions.map((question) => (question.id === id ? change(question) : question)));

/** The words a new question starts with, in the language being edited. */
export interface Starting {
  question: string;
  choice: (n: number) => string;
  tick: string;
}

/** A new question of a kind, at the end, in the last section. */
export function newQuestion(d: Definition, kind: FormQuestionKind, lang: Lang, words: Starting, today: string): Question {
  const id = nextId(
    d.questions.map((question) => question.id),
    'q',
  );
  const section = d.sections?.at(-1)?.id;
  const base = { id, label: { [lang]: words.question } as Words, required: false, ...(section === undefined ? {} : { section }) };
  switch (kind) {
    case 'one':
    case 'several':
    {
      const choices: { id: string; label: Words }[] = [];
      for (const n of [1, 2]) choices.push({ id: choiceIdFrom(words.choice(n), choices.map((choice) => choice.id)), label: { [lang]: words.choice(n) } });
      return { ...base, kind, choices } as Question;
    }
    case 'file':
      return { ...base, kind, maxMb: 10, kinds: ['pdf', 'jpg', 'png'], many: true };
    case 'tick':
      return { ...base, kind, label: { [lang]: words.tick }, purpose: freePurposes(d)[0] ?? 'newsletter', wordingVersion: 1, wordingChangedAt: today, confirm: true };
    case 'hidden': {
      const taken = d.questions.flatMap((question) => (question.kind === 'hidden' ? [question.param] : []));
      let param = 'from';
      for (let n = 2; taken.includes(param); n += 1) param = `from_${String(n)}`;
      return { ...base, kind, param };
    }
    default:
      return { ...base, kind } as Question;
  }
}

export const addQuestion = (d: Definition, question: Question): Definition => withQuestions(d, [...d.questions, question]);

/**
 * Questions and section heads as one list, in the order they are drawn: the
 * questions of no section first, then each section's head and its questions.
 */
export type Item = { type: 'question'; question: Question } | { type: 'section'; section: Section };

export function itemsOf(d: Definition): Item[] {
  const sections = d.sections ?? [];
  const known = new Set(sections.map((section) => section.id));
  const items: Item[] = d.questions.filter((question) => question.section === undefined || !known.has(question.section)).map((question) => ({ type: 'question', question }));
  for (const section of sections) {
    items.push({ type: 'section', section });
    for (const question of d.questions) if (question.section === section.id) items.push({ type: 'question', question });
  }
  return items;
}

/** The list back into a definition: each question in the section whose head is above it. */
export function fromItems(d: Definition, items: readonly Item[]): Definition {
  const questions: Question[] = [];
  const sections: Section[] = [];
  let section: string | undefined;
  for (const item of items) {
    if (item.type === 'section') {
      sections.push(item.section);
      section = item.section.id;
    } else {
      const { section: _was, ...rest } = item.question;
      void _was;
      questions.push((section === undefined ? rest : { ...rest, section }) as Question);
    }
  }
  const { sections: _old, ...rest } = d;
  void _old;
  return clearForwardShowIf({ ...rest, ...(sections.length === 0 ? {} : { sections }), questions });
}

/** A "show if" that now names a later question (or itself) is dropped: it could never be judged. */
function clearForwardShowIf(d: Definition): Definition {
  const seen = new Set<string>();
  return withQuestions(
    d,
    d.questions.map((question) => {
      const named = question.showIf?.question;
      const keep = named === undefined || seen.has(named);
      seen.add(question.id);
      if (keep) return question;
      const { showIf: _dropped, ...rest } = question;
      void _dropped;
      return rest as Question;
    }),
  );
}

/** Move a question or a section head one place up or down. */
export function move(d: Definition, id: string, by: -1 | 1): Definition {
  const items = itemsOf(d);
  const at = items.findIndex((item) => (item.type === 'question' ? item.question.id : item.section.id) === id);
  const to = at + by;
  if (at < 0 || to < 0 || to >= items.length) return d;
  const next = [...items];
  [next[at], next[to]] = [next[to]!, next[at]!];
  return fromItems(d, next);
}

/** Whether a question or a head can move that way at all. */
export function canMove(d: Definition, id: string, by: -1 | 1): boolean {
  const items = itemsOf(d);
  const at = items.findIndex((item) => (item.type === 'question' ? item.question.id : item.section.id) === id);
  return at >= 0 && at + by >= 0 && at + by < items.length;
}

/** A copy right under it: its own id, a tick its own purpose, a hidden field its own parameter. */
export function duplicate(d: Definition, id: string): { definition: Definition; id: string } {
  const source = questionAt(d, id);
  if (source === undefined) return { definition: d, id };
  const copyId = nextId(
    d.questions.map((question) => question.id),
    'q',
  );
  let copy: Question = { ...structuredClone(source), id: copyId };
  if (copy.kind === 'tick') copy = { ...copy, purpose: freePurposes(d)[0] ?? copy.purpose };
  if (copy.kind === 'hidden') {
    const taken = d.questions.flatMap((question) => (question.kind === 'hidden' ? [question.param] : []));
    let param = `${copy.param.slice(0, 28)}_2`;
    for (let n = 3; taken.includes(param); n += 1) param = `${copy.param.slice(0, 28)}_${String(n)}`;
    copy = { ...copy, param };
  }
  const at = d.questions.findIndex((question) => question.id === id);
  return { definition: withQuestions(d, [...d.questions.slice(0, at + 1), copy, ...d.questions.slice(at + 1)]), id: copyId };
}

/** Delete a question: every "show if" naming it goes, and the settings forget it. */
export function remove(draft: Draft, id: string): Draft {
  const questions = draft.definition.questions
    .filter((question) => question.id !== id)
    .map((question) => {
      if (question.showIf?.question !== id) return question;
      const { showIf: _dropped, ...rest } = question;
      void _dropped;
      return rest as Question;
    });
  return { definition: withQuestions(draft.definition, questions), settings: forgetQuestion(draft.settings, id) };
}

function forgetQuestion(settings: Settings, id: string): Settings {
  const becomes = settings.becomes === null || settings.becomes === undefined ? (settings.becomes ?? null) : { ...settings.becomes, map: Object.fromEntries(Object.entries(settings.becomes.map).filter(([question]) => question !== id)) };
  const { tellWhen, ...rest } = settings;
  return { ...rest, becomes, ...(tellWhen === undefined || tellWhen.question === id ? {} : { tellWhen }) };
}

export const updateQuestion = (d: Definition, id: string, change: (question: Question) => Question): Definition => mapQuestion(d, id, change);

/** One language's version of a text set; an empty one is a version no longer there. */
export function setWords(words: Words | undefined, lang: Lang, text: string): Words {
  const next: Words = { ...(words ?? {}) };
  if (text === '') delete next[lang];
  else next[lang] = text;
  return next;
}

export function setLabel(d: Definition, id: string, lang: Lang, text: string): Definition {
  return mapQuestion(d, id, (question) => ({ ...question, label: { ...question.label, [lang]: text } }) as Question);
}

/** Help text in a language; a help with no version left is no help at all. */
export function setHelp(d: Definition, id: string, lang: Lang, text: string | null): Definition {
  return mapQuestion(d, id, (question) => {
    const help = text === null ? {} : setWords(question.help, lang, text);
    const { help: _was, ...rest } = question;
    void _was;
    return (Object.keys(help).length === 0 ? rest : { ...rest, help }) as Question;
  });
}

export const setRequired = (d: Definition, id: string, required: boolean): Definition => mapQuestion(d, id, (question) => ({ ...question, required }) as Question);

export function setShowIf(d: Definition, id: string, showIf: ShowIf | null): Definition {
  return mapQuestion(d, id, (question) => {
    const { showIf: _was, ...rest } = question;
    void _was;
    return (showIf === null ? rest : { ...rest, showIf }) as Question;
  });
}

/* ── choices ────────────────────────────────────────────────────────────── */

type Choicey = QuestionOf<'one'> | QuestionOf<'several'>;
const isChoicey = (question: Question): question is Choicey => question.kind === 'one' || question.kind === 'several';

export function addChoice(d: Definition, id: string, lang: Lang, text: string): Definition {
  return mapQuestion(d, id, (question) => {
    if (!isChoicey(question) || question.choices.length >= FORM_CHOICES_MAX) return question;
    const taken = question.choices.map((choice) => choice.id);
    return { ...question, choices: [...question.choices, { id: choiceIdFrom(text, taken), label: { [lang]: text } }] };
  });
}

/**
 * A choice's words in a language. While its id has never gone live, a choice
 * written in the form's own language takes its id from those words, so the
 * row a several-choice answer fills reads them; a "show if" naming it follows.
 */
export function setChoiceLabel(d: Definition, id: string, choiceId: string, lang: Lang, text: string, frozen: ReadonlySet<string>): Definition {
  let renamed: string | null = null;
  const next = mapQuestion(d, id, (question) => {
    if (!isChoicey(question)) return question;
    return {
      ...question,
      choices: question.choices.map((choice) => {
        if (choice.id !== choiceId) return choice;
        const label = { ...choice.label, [lang]: text };
        if (lang !== d.defaultLanguage || frozen.has(`${id}:${choice.id}`) || text.trim() === '') return { ...choice, label };
        const fresh = choiceIdFrom(
          text,
          question.choices.filter((other) => other.id !== choice.id).map((other) => other.id),
        );
        if (fresh !== choice.id) renamed = fresh;
        return { id: fresh, label };
      }),
    };
  });
  return renamed === null ? next : renameChoiceRefs(next, id, choiceId, renamed);
}

/** A choice's stored id set by hand (an enum column's value, say). */
export function setChoiceId(d: Definition, id: string, choiceId: string, fresh: string): Definition {
  const next = mapQuestion(d, id, (question) => (isChoicey(question) ? { ...question, choices: question.choices.map((choice) => (choice.id === choiceId ? { ...choice, id: fresh } : choice)) } : question));
  return renameChoiceRefs(next, id, choiceId, fresh);
}

function renameChoiceRefs(d: Definition, question: string, from: string, to: string): Definition {
  return withQuestions(
    d,
    d.questions.map((one) => {
      const showIf = one.showIf;
      if (showIf?.question !== question) return one;
      if (showIf.is === from) return { ...one, showIf: { ...showIf, is: to } } as Question;
      if (showIf.includes === from) return { ...one, showIf: { ...showIf, includes: to } } as Question;
      return one;
    }),
  );
}

/** Remove a choice; a "show if" that named it goes too. */
export function removeChoice(d: Definition, id: string, choiceId: string): Definition {
  const next = mapQuestion(d, id, (question) => (isChoicey(question) ? { ...question, choices: question.choices.filter((choice) => choice.id !== choiceId) } : question));
  return withQuestions(
    next,
    next.questions.map((one) => {
      if (one.showIf?.question !== id || (one.showIf.is !== choiceId && one.showIf.includes !== choiceId)) return one;
      const { showIf: _dropped, ...rest } = one;
      void _dropped;
      return rest as Question;
    }),
  );
}

/** The choices of a question already live: their ids are what stored answers hold. */
export function frozenChoices(published: unknown): Set<string> {
  const out = new Set<string>();
  const definition = isRecord(published) ? published['definition'] : undefined;
  const questions = isRecord(definition) && Array.isArray(definition['questions']) ? definition['questions'] : [];
  for (const question of questions) {
    if (!isRecord(question) || !Array.isArray(question['choices'])) continue;
    for (const choice of question['choices']) if (isRecord(choice) && typeof choice['id'] === 'string') out.add(`${String(question['id'])}:${choice['id']}`);
  }
  return out;
}

/* ── the agreement tick ─────────────────────────────────────────────────── */

/** New words for a tick: a new version, changed today. */
export function setTickWords(d: Definition, id: string, lang: Lang, text: string, today: string): Definition {
  return mapQuestion(d, id, (question) => (question.kind === 'tick' ? { ...question, label: { ...question.label, [lang]: text }, wordingVersion: question.wordingVersion + 1, wordingChangedAt: today } : question));
}

/* ── sections ───────────────────────────────────────────────────────────── */

/** A new section at the end; the questions added after it are its own. */
export function addSection(d: Definition, lang: Lang, title: string): { definition: Definition; id: string } {
  const id = nextId(
    (d.sections ?? []).map((section) => section.id),
    's',
  );
  return { definition: { ...d, sections: [...(d.sections ?? []), { id, title: { [lang]: title } }] }, id };
}

export const setSectionTitle = (d: Definition, id: string, lang: Lang, text: string): Definition => ({ ...d, sections: (d.sections ?? []).map((section) => (section.id === id ? { ...section, title: { ...section.title, [lang]: text } } : section)) });

/** Remove a section's head: its questions join the section above it. */
export const removeSection = (d: Definition, id: string): Definition => fromItems(
  d,
  itemsOf(d).filter((item) => item.type === 'question' || item.section.id !== id),
);

/* ── languages ──────────────────────────────────────────────────────────── */

/** Every text of a form, as a getter and a setter, so a language can be added to or taken from all of them. */
function eachWords(d: Definition, change: (words: Words) => Words): Definition {
  const questions = d.questions.map((question) => {
    let next = { ...question, label: change(question.label) } as Question;
    if (question.help !== undefined) next = { ...next, help: change(question.help) } as Question;
    if (isChoicey(next)) next = { ...next, choices: next.choices.map((choice) => ({ ...choice, label: change(choice.label) })) };
    return next;
  });
  return {
    ...d,
    title: change(d.title),
    ...(d.intro === undefined ? {} : { intro: change(d.intro) }),
    ...(d.sections === undefined ? {} : { sections: d.sections.map((section) => ({ ...section, title: change(section.title) })) }),
    questions,
    ending: d.ending.kind === 'words' ? { kind: 'words', words: change(d.ending.words) } : d.ending,
  };
}

/** Every text with its version in the form's own language: what a language is translated from. */
export function textsOf(d: Definition): Words[] {
  const out: Words[] = [d.title];
  if (d.intro !== undefined) out.push(d.intro);
  for (const section of d.sections ?? []) out.push(section.title);
  for (const question of d.questions) {
    out.push(question.label);
    if (question.help !== undefined) out.push(question.help);
    if (isChoicey(question)) for (const choice of question.choices) out.push(choice.label);
  }
  if (d.ending.kind === 'words') out.push(d.ending.words);
  return out;
}

/** A language added: every text starts as the form's own language's words. */
export function addLanguage(d: Definition, lang: Lang): Definition {
  if (d.languages.includes(lang)) return d;
  const from = d.defaultLanguage;
  const next = eachWords(d, (words) => (words[from] === undefined ? words : { ...words, [lang]: words[from] }));
  return { ...next, languages: [...d.languages, lang] };
}

/** A language taken away, with every word in it. The form's own language stays. */
export function removeLanguage(d: Definition, lang: Lang): Definition {
  if (lang === d.defaultLanguage || !d.languages.includes(lang)) return d;
  const next = eachWords(d, (words) => {
    const out = { ...words };
    delete out[lang];
    return out;
  });
  return { ...next, languages: d.languages.filter((one) => one !== lang) };
}

/** Another language becomes the form's own: listed first, and the one a visitor sees by default. */
export const makeDefault = (d: Definition, lang: Lang): Definition => (d.languages.includes(lang) ? { ...d, defaultLanguage: lang, languages: [lang, ...d.languages.filter((one) => one !== lang)] } : d);

export type Translation = 'missing' | 'same' | 'done';

/**
 * Where a language stands: a text it has no words for, or one whose words are
 * still the form's own language's (as an added language starts), needs
 * translating. Nothing else is kept: the words themselves say it.
 */
export function translationOf(d: Definition, lang: Lang): Translation {
  if (lang === d.defaultLanguage) return 'done';
  let same = false;
  for (const words of textsOf(d)) {
    const own = words[d.defaultLanguage];
    if (own === undefined) continue;
    const there = words[lang];
    if (there === undefined || there.trim() === '') return 'missing';
    if (there === own && /\p{L}/u.test(own)) same = true;
  }
  return same ? 'same' : 'done';
}

/* ── settings ───────────────────────────────────────────────────────────── */

export const fileKindsOf = (kinds: readonly FormFileKind[]): FormFileKind[] => FORM_FILE_KINDS.filter((kind) => kinds.includes(kind));

/** A new "becomes": the table, its map kept where the table still takes it, and the fixed source row. */
export function becomesFor(table: string, map: Readonly<Record<string, string>>, source: { column: string; value: string } | undefined): Becomes {
  return { table, map: { ...map }, ...(source === undefined ? {} : { source }) };
}

/** A column filled by a question (or by none): a question fills one column at most, a column takes one question. */
export function mapColumn(becomes: Becomes, column: string, question: string | null): Becomes {
  const map = Object.fromEntries(Object.entries(becomes.map).filter(([id, filled]) => filled !== column && id !== question));
  if (question !== null) map[question] = column;
  return { ...becomes, map };
}

/** A stable text of a JSON value: the same object in any key order reads the same. */
export function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (isRecord(value))
    return `{${Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable(value[key])}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}

/** Whether a live form's draft says something its published version does not. */
export function differsFromPublished(draft: Draft, published: unknown): boolean {
  if (!isRecord(published)) return true;
  return stable({ definition: draft.definition, settings: draft.settings }) !== stable({ definition: published['definition'], settings: published['settings'] });
}

/** The day as the tick's `wordingChangedAt` takes it. */
export const dayOf = (at: Date): string => `${String(at.getFullYear())}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
