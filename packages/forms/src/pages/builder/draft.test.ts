import { FORM_QUESTION_KINDS, parseForm, type FormQuestionKind } from '@adminium/add-on-contracts/forms';
import { describe, expect, it } from 'vitest';

import { draftValues } from '../forms/newForm.ts';
import {
  addChoice,
  addLanguage,
  addQuestion,
  addSection,
  definitionOf,
  dependentsOf,
  differsFromPublished,
  draftOf,
  duplicate,
  freePurposes,
  frozenChoices,
  itemsOf,
  kindsFor,
  makeDefault,
  move,
  newQuestion,
  remove,
  removeLanguage,
  removeSection,
  setChoiceLabel,
  setLabel,
  setShowIf,
  setTickWords,
  showIfTargets,
  translationOf,
  type Definition,
  type Draft,
} from './draft.ts';
import { startingWords } from './starting.ts';

const t = (_key: string, english: string, args: Record<string, unknown> = {}): string => english.replace(/\{(\w+)\}/g, (_, name: string) => String(args[name] ?? ''));
const TODAY = '2026-11-03';

/** A new draft as the list makes one, read the way the builder reads it. */
function fresh(kind: 'form' | 'survey' = 'form'): Draft {
  const values = draftValues(t, kind, 'en-US', `${kind}-abc234`);
  return draftOf(values['definition'], values['settings'], kind, 'en-US');
}

function withKinds(draft: Draft, kinds: readonly FormQuestionKind[]): Draft {
  let d = draft.definition;
  for (const kind of kinds) d = addQuestion(d, newQuestion(d, kind, 'en-US', startingWords('en-US'), TODAY));
  return { ...draft, definition: d };
}

describe('a draft, as the builder makes it', () => {
  it('parses with every kind a form may ask, each as the rail adds it', () => {
    // The tick asks for confirmation by e-mail, so the form asks for an address too.
    let draft = withKinds(fresh(), FORM_QUESTION_KINDS);
    const email = draft.definition.questions.find((one) => one.kind === 'short')!;
    draft = { ...draft, definition: { ...draft.definition, questions: draft.definition.questions.map((one) => (one.id === email.id ? { ...one, check: 'email' as const, role: 'email' as const } : one)) } };
    const parsed = parseForm(draft.definition, draft.settings);
    expect(parsed.ok ? [] : parsed.issues).toEqual([]);
  });

  it('parses with every kind a survey may ask, and the rail offers no file and no tick on one', () => {
    expect(kindsFor('survey')).not.toContain('file');
    expect(kindsFor('survey')).not.toContain('tick');
    expect(kindsFor('form')).toEqual(FORM_QUESTION_KINDS);
    const draft = withKinds(fresh('survey'), kindsFor('survey'));
    const parsed = parseForm(draft.definition, draft.settings);
    expect(parsed.ok ? [] : parsed.issues).toEqual([]);
  });

  it('gives each question its own id, each choice a readable one, and a second hidden field its own parameter', () => {
    const draft = withKinds(fresh(), ['several', 'hidden', 'hidden', 'one']);
    expect(draft.definition.questions.map((one) => one.id)).toEqual(['q1', 'q2', 'q3', 'q4']);
    const several = draft.definition.questions[0]!;
    expect(several.kind === 'several' ? several.choices.map((choice) => choice.id) : []).toEqual(['choice-1', 'choice-2']);
    expect(draft.definition.questions.flatMap((one) => (one.kind === 'hidden' ? [one.param] : []))).toEqual(['from', 'from_2']);
  });

  it('starts a tick unticked-by-nobody: version 1, changed today, confirmation on, never required', () => {
    const tick = withKinds(fresh(), ['tick']).definition.questions[0]!;
    expect(tick).toMatchObject({ kind: 'tick', purpose: 'newsletter', wordingVersion: 1, wordingChangedAt: TODAY, confirm: true, required: false });
    // No value of its own: a visitor ticks it.
    expect(Object.keys(tick)).not.toContain('value');
    expect(Object.keys(tick)).not.toContain('default');
  });

  it('starts new words in the language being edited, not the reader’s', () => {
    const d = fresh().definition;
    const question = newQuestion(d, 'one', 'de-DE', startingWords('de-DE'), TODAY);
    expect(question.label).toEqual({ 'de-DE': 'Unbenannte Frage' });
  });
});

describe('the agreement tick', () => {
  it('asks for one purpose once: a second tick takes the other purpose, a third none is left for', () => {
    let d = fresh().definition;
    d = addQuestion(d, newQuestion(d, 'tick', 'en-US', startingWords('en-US'), TODAY));
    expect(freePurposes(d)).toEqual(['surveys']);
    d = addQuestion(d, newQuestion(d, 'tick', 'en-US', startingWords('en-US'), TODAY));
    expect(d.questions.map((one) => (one.kind === 'tick' ? one.purpose : null))).toEqual(['newsletter', 'surveys']);
    expect(freePurposes(d)).toEqual([]);
  });

  it('makes a new version, changed that day, with new words', () => {
    const d = withKinds(fresh(), ['tick']).definition;
    const next = setTickWords(d, 'q1', 'en-US', 'Yes, mail me now and then.', '2026-11-04');
    expect(next.questions[0]).toMatchObject({ wordingVersion: 2, wordingChangedAt: '2026-11-04', label: { 'en-US': 'Yes, mail me now and then.' } });
  });
});

describe('show if', () => {
  const d = withKinds(fresh(), ['short', 'one', 'several', 'hidden', 'score', 'stars', 'number', 'date', 'long']).definition;

  it('offers only earlier questions whose answer is a pick or a number', () => {
    expect(showIfTargets(d, 'q9').map((one) => one.kind)).toEqual(['one', 'several', 'score', 'stars', 'number']);
    expect(showIfTargets(d, 'q3').map((one) => one.kind)).toEqual(['one']);
    expect(showIfTargets(d, 'q1')).toEqual([]);
  });

  it('never puts one on a hidden field', () => {
    expect(showIfTargets(d, 'q4')).toEqual([]);
  });

  it('is dropped when the question it names moves below it', () => {
    const shown = setShowIf(d, 'q3', { question: 'q2', is: 'choice-1' });
    expect(move(shown, 'q2', 1).questions.find((one) => one.id === 'q3')?.showIf).toBeUndefined();
  });

  it('goes with the question it names, and the settings forget that question', () => {
    const shown = setShowIf(d, 'q3', { question: 'q2', is: 'choice-1' });
    expect(dependentsOf(shown, 'q2').map((one) => one.id)).toEqual(['q3']);
    const gone = remove({ definition: shown, settings: { becomes: { table: 't', map: { q2: 'kind', q1: 'name' } }, tell: [], tellWhen: { question: 'q2', atMost: 6 } } }, 'q2');
    expect(gone.definition.questions.find((one) => one.id === 'q3')?.showIf).toBeUndefined();
    expect(gone.settings.becomes?.map).toEqual({ q1: 'name' });
    expect(gone.settings.tellWhen).toBeUndefined();
  });

  it('follows a choice whose stored name follows its words', () => {
    let next = setShowIf(d, 'q3', { question: 'q2', is: 'choice-1' });
    next = setChoiceLabel(next, 'q2', 'choice-1', 'en-US', 'Seating', new Set());
    const one = next.questions[1]!;
    expect(one.kind === 'one' ? one.choices[0]?.id : null).toBe('seating');
    expect(next.questions[2]?.showIf).toEqual({ question: 'q2', is: 'seating' });
  });

  it('keeps a live choice’s stored name when its words change', () => {
    const next = setChoiceLabel(d, 'q2', 'choice-1', 'en-US', 'Seating', new Set(['q2:choice-1']));
    const one = next.questions[1]!;
    expect(one.kind === 'one' ? one.choices[0] : null).toEqual({ id: 'choice-1', label: { 'en-US': 'Seating' } });
  });
});

describe('sections', () => {
  it('group the questions under their heads, in order, and moving a question past a head moves it into that section', () => {
    let d = withKinds(fresh(), ['short']).definition;
    const made = addSection(d, 'en-US', 'About the visit');
    d = addQuestion(made.definition, newQuestion(made.definition, 'date', 'en-US', startingWords('en-US'), TODAY));
    expect(itemsOf(d).map((item) => (item.type === 'section' ? item.section.id : item.question.id))).toEqual(['q1', 's1', 'q2']);
    expect(d.questions[1]?.section).toBe('s1');
    d = move(d, 'q2', -1);
    expect(itemsOf(d).map((item) => (item.type === 'section' ? item.section.id : item.question.id))).toEqual(['q1', 'q2', 's1']);
    expect(d.questions[1]?.section).toBeUndefined();
    const parsed = parseForm(d, fresh().settings);
    expect(parsed.ok ? [] : parsed.issues).toEqual([]);
  });

  it('leave their questions to the section above when removed', () => {
    let d = addSection(withKinds(fresh(), []).definition, 'en-US', 'A').definition;
    d = addQuestion(d, newQuestion(d, 'long', 'en-US', startingWords('en-US'), TODAY));
    d = removeSection(d, 's1');
    expect(d.sections).toBeUndefined();
    expect(d.questions[0]?.section).toBeUndefined();
  });
});

describe('languages', () => {
  const base = withKinds(fresh(), ['one']).definition;

  it('an added language starts with the form’s own words, and needs translating until they differ', () => {
    const d = addLanguage(base, 'de-DE');
    expect(d.languages).toEqual(['en-US', 'de-DE']);
    expect(d.questions[0]?.label['de-DE']).toBe('Untitled question');
    expect(translationOf(d, 'de-DE')).toBe('same');
    expect(parseForm(d, fresh().settings).ok).toBe(true);
  });

  it('a question added later has no words in the other languages, and the form does not parse until it does', () => {
    let d = addLanguage(base, 'de-DE');
    d = addQuestion(d, newQuestion(d, 'long', 'en-US', startingWords('en-US'), TODAY));
    expect(translationOf(d, 'de-DE')).toBe('missing');
    const parsed = parseForm(d, fresh().settings);
    expect(parsed.ok ? [] : parsed.issues).toContainEqual({ path: ['definition', 'questions', 1, 'label', 'de-DE'], code: 'words-missing' });
  });

  it('is translated once every text differs from the form’s own', () => {
    let d = addLanguage(base, 'de-DE');
    const texts = (one: Definition) => [one.title, ...one.questions.map((question) => question.label), ...one.questions.flatMap((question) => (question.kind === 'one' ? question.choices.map((choice) => choice.label) : [])), ...(one.ending.kind === 'words' ? [one.ending.words] : [])];
    for (const words of texts(d)) words['de-DE'] = `${words['en-US'] ?? ''} (de)`;
    d = setLabel(d, 'q1', 'de-DE', 'Frage');
    expect(translationOf(d, 'de-DE')).toBe('done');
  });

  it('another language made the form’s own goes first; a language taken away takes its words', () => {
    const d = makeDefault(addLanguage(base, 'fr-FR'), 'fr-FR');
    expect(d.languages).toEqual(['fr-FR', 'en-US']);
    expect(d.defaultLanguage).toBe('fr-FR');
    const gone = removeLanguage(addLanguage(base, 'de-DE'), 'de-DE');
    expect(gone.languages).toEqual(['en-US']);
    expect(gone.questions[0]?.label).toEqual({ 'en-US': 'Untitled question' });
    expect(removeLanguage(base, 'en-US')).toBe(base);
  });
});

describe('copies, and reading what is stored', () => {
  it('a copy of a tick asks for the other purpose', () => {
    const d = withKinds(fresh(), ['tick']).definition;
    const copy = duplicate(d, 'q1');
    expect(copy.id).toBe('q2');
    expect(copy.definition.questions.map((one) => (one.kind === 'tick' ? one.purpose : null))).toEqual(['newsletter', 'surveys']);
  });

  it('reads a definition stored as anything, keeping only a form’s shape', () => {
    expect(definitionOf(null, 'form', 'de-DE')).toMatchObject({ languages: ['de-DE'], defaultLanguage: 'de-DE', questions: [] });
    expect(definitionOf({ languages: ['xx', 'fr-FR'], questions: [{ id: 'q1', kind: 'nope' }, { id: 'q2', kind: 'long', label: { 'fr-FR': 'Bonjour', 'xx-YY': 'drop' } }] }, 'form', 'en-US')).toMatchObject({ languages: ['fr-FR'], questions: [{ id: 'q2', label: { 'fr-FR': 'Bonjour' } }] });
  });

  it('tells a draft that says something its published copy does not', () => {
    const draft = withKinds(fresh(), ['long']);
    expect(differsFromPublished(draft, null)).toBe(true);
    expect(differsFromPublished(draft, JSON.parse(JSON.stringify({ settings: draft.settings, definition: draft.definition })))).toBe(false);
    expect(differsFromPublished({ ...draft, definition: addChoice(draft.definition, 'q1', 'en-US', 'x') }, { definition: draft.definition, settings: draft.settings })).toBe(false);
    expect(differsFromPublished({ ...draft, definition: setLabel(draft.definition, 'q1', 'en-US', 'Changed') }, { definition: draft.definition, settings: draft.settings })).toBe(true);
  });

  it('knows the choices already live', () => {
    const draft = withKinds(fresh(), ['one']);
    expect([...frozenChoices({ definition: draft.definition, settings: draft.settings })]).toEqual(['q1:choice-1', 'q1:choice-2']);
    expect(frozenChoices(null).size).toBe(0);
  });
});
