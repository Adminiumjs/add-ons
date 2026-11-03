import { describe, expect, it } from 'vitest';

import { format } from '../testing/host.tsx';
import { BECOMES, KEEPS, SHOWROOM, showroom } from '../testing/answers.ts';
import { formRowOf } from '../shared/row.ts';
import { answerOf, askedOf, becameOf, becomesOf, companyQuestion, emailQuestion, filtersOf, notAskedOf, questionsOf, searchColumnOf, shownOf, shortKey, sinceOf, sizeOf, tickOf, wordsIn, type Question } from './read.ts';

const t = (_key: string, fallback: string, args?: Record<string, unknown>): string => format(fallback, args);
const questions = questionsOf(formRowOf(showroom()));
const q = (id: string): Question => questions.list.find((one) => one.id === id) as Question;
const order = ['en-US', 'de-DE', 'en-US'];

describe('the questions an answer was sent to', () => {
  it('are the published copy’s, and the draft’s before anything was published', () => {
    expect(questions.list.map((one) => one.id)).toEqual(SHOWROOM.questions.map((one) => one.id));
    const draft = { ...SHOWROOM, questions: SHOWROOM.questions.slice(0, 2) };
    expect(questionsOf(formRowOf({ ...showroom({ definition: draft }), published: JSON.stringify({ definition: SHOWROOM, settings: KEEPS }) })).list).toHaveLength(SHOWROOM.questions.length);
    expect(questionsOf(formRowOf({ ...showroom({ definition: draft }), published: null })).list).toHaveLength(2);
  });

  it('name the address and the company by their role', () => {
    expect(emailQuestion(questions)?.id).toBe('qmail');
    expect(companyQuestion(questions)?.id).toBe('qco');
    const plain = { ...questions, list: questions.list.filter((one) => one.role === undefined) };
    expect(emailQuestion(plain)).toBeUndefined();
    expect(companyQuestion(plain)).toBeUndefined();
    // An address question with no role is found by its check.
    const checked = { ...questions, list: [{ ...q('qmail'), role: undefined } as Question] };
    expect(emailQuestion(checked)?.id).toBe('qmail');
  });

  it('say which table answers become rows of, or none', () => {
    expect(becomesOf(formRowOf(showroom()))).toBe(BECOMES.becomes.table);
    expect(becomesOf(formRowOf(showroom({ settings: KEEPS })))).toBeNull();
  });
});

describe('what the list asks for', () => {
  it('starts "When" a whole number of days back, to the minute, and asks nothing for all time', () => {
    const now = Date.parse('2026-11-03T12:00:41.500Z');
    expect(sinceOf('7', now)).toBe('2026-10-27T12:00:00.000Z');
    expect(sinceOf('30', now)).toBe('2026-10-04T12:00:00.000Z');
    expect(sinceOf('all', now)).toBeNull();
    // The same minute asks the same thing: a list re-asked on every draw would never settle.
    expect(sinceOf('30', now + 10_000)).toBe(sinceOf('30', now));
  });

  it('searches a name, or an address when an @ is typed', () => {
    expect(searchColumnOf('marta')).toBe('name');
    expect(searchColumnOf('marta@')).toBe('email');
  });

  it('holds every list to the form, and adds exactly the filters chosen', () => {
    expect(filtersOf('7', { language: 'all', since: null, search: '' })).toEqual([{ column: 'form_id', op: 'eq', value: 7 }]);
    expect(filtersOf('f-uuid', { language: 'de-DE', since: '2026-10-04T12:00:00.000Z', search: '  cobalt.example@ ' })).toEqual([
      { column: 'form_id', op: 'eq', value: 'f-uuid' },
      { column: 'language', op: 'eq', value: 'de-DE' },
      { column: 'submitted_at', op: 'gte', value: '2026-10-04T12:00:00.000Z' },
      { column: 'email', op: 'contains', value: 'cobalt.example@' },
    ]);
  });
});

describe('the words an answer is shown in', () => {
  it('sizes a file as the door counts it', () => {
    expect(sizeOf(Math.round(2.1 * 1024 * 1024), 'en-US')).toBe('2.1 MB');
    expect(sizeOf(840 * 1024, 'en-US')).toBe('840 KB');
    expect(sizeOf(10, 'en-US')).toBe('1 KB');
    expect(sizeOf(null, 'en-US')).toBeNull();
    expect(sizeOf(Math.round(2.5 * 1024 * 1024), 'de-DE')).toBe('2,5 MB');
  });

  it('cuts a long key and keeps a short one', () => {
    expect(shortKey('1042')).toBe('1042');
    expect(shortKey('3f2a9c1e-0b7d-4f1a-9c3e-1234567890ab')).toBe('3f2a9c1e…');
  });

  it('picks words in the reader’s language, else the answer’s, else any', () => {
    expect(wordsIn({ 'en-US': 'Seating', 'de-DE': 'Sitzmöbel' }, ['de-DE', 'en-US'])).toBe('Sitzmöbel');
    expect(wordsIn({ 'en-US': 'Seating', 'de-DE': 'Sitzmöbel' }, ['fr-FR', 'de-DE'])).toBe('Sitzmöbel');
    expect(wordsIn({ 'en-US': 'Seating' }, ['fr-FR', null])).toBe('Seating');
    expect(wordsIn({}, ['fr-FR'])).toBeNull();
  });

  it('shows each kind of answer, mono for an address, a day and a number', () => {
    expect(shownOf(t, q('qmail'), 'a@b.example', order, 'en-US')).toEqual({ text: 'a@b.example', mono: true });
    expect(shownOf(t, q('qco'), 'Cobalt Legal', order, 'en-US')).toEqual({ text: 'Cobalt Legal', mono: false });
    expect(shownOf(t, q('qday'), '2026-08-06', order, 'en-GB')).toEqual({ text: 'Thu, 6 Aug 2026', mono: true });
    expect(shownOf(t, q('qcount'), 1200, order, 'en-US')).toEqual({ text: '1,200', mono: true });
    expect(shownOf(t, q('qsee'), ['booths', 'seating'], order, 'en-US')).toEqual({ text: 'Acoustic booths, Seating', mono: false });
    expect(shownOf(t, q('qsee'), ['booths'], ['de-DE'], 'de-DE').text).toBe('Akustikkabinen');
    expect(shownOf(t, q('qroom'), 'south', order, 'en-US').text).toBe('South hall');
    expect(shownOf(t, q('qroom'), 'gone', order, 'en-US').text).toBe('gone');
    expect(shownOf(t, q('qstars'), 4, order, 'en-US')).toEqual({ text: '4 of 5', mono: true });
    expect(shownOf(t, q('qscore'), 9, order, 'en-US')).toEqual({ text: '9 of 10', mono: true });
    expect(shownOf(t, q('qnote'), undefined, order, 'en-US').text).toBe('No answer');
    expect(shownOf(t, undefined, ['x', 'y'], order, 'en-US').text).toBe('x, y');
  });

  it('says why a question was not asked, from its "show if"', () => {
    const seats = q('qseats');
    expect(notAskedOf(t, seats, questions, { qsee: ['storage'] }, order)).toBe('Not asked. “Seating” wasn’t picked.');
    expect(notAskedOf(t, seats, questions, {}, order)).toBe('Not asked. “What would you like to see?” had no answer.');
    const by = (showIf: Question['showIf']): Question => ({ ...seats, showIf });
    expect(notAskedOf(t, by({ question: 'qroom', is: 'north' }), questions, { qroom: 'south' }, order)).toBe('Not asked. “North hall” wasn’t picked.');
    expect(notAskedOf(t, by({ question: 'qscore', is: 10 }), questions, { qscore: 3 }, order)).toBe('Not asked. “How likely are you to come back?” wasn’t 10.');
    expect(notAskedOf(t, by({ question: 'qscore', atLeast: 7 }), questions, { qscore: 3 }, order)).toBe('Not asked. “How likely are you to come back?” was below 7.');
    expect(notAskedOf(t, by({ question: 'qscore', atMost: 6 }), questions, { qscore: 9 }, order)).toBe('Not asked. “How likely are you to come back?” was above 6.');
    expect(notAskedOf(t, by({ question: 'qnope', is: 'x' }), questions, {}, order)).toBe('Not asked.');
  });

  it('knows which questions an answer was shown, by the vocabulary’s rule', () => {
    expect(askedOf(questions, { qsee: ['seating'] }).has('qseats')).toBe(true);
    expect(askedOf(questions, { qsee: ['storage'] }).has('qseats')).toBe(false);
    // A hidden field is never "shown".
    expect(askedOf(questions, {}).has('qsrc')).toBe(false);
  });

  it('words every state of the tick', () => {
    const tick = q('qtick');
    const at = { submittedAt: '2026-11-02T09:12:00.000Z' };
    // The time is the reader's own clock's.
    expect(tickOf(t, { ...at, confirm: 'pending', consentVersion: 3 }, tick, true, 'en-GB')).toMatch(/^Ticked, words v3\. Confirmation mail sent \d Nov, \d\d:12\. Not confirmed yet\.$/);
    expect(tickOf(t, { ...at, confirm: 'confirmed', consentVersion: 2 }, tick, true, 'en-GB')).toBe('Ticked, words v2. Confirmed by e-mail.');
    expect(tickOf(t, { ...at, confirm: 'expired', consentVersion: null }, tick, true, 'en-GB')).toBe('Ticked, words v3. Not confirmed in time.');
    expect(tickOf(t, { ...at, confirm: 'none', consentVersion: 3 }, tick, true, 'en-GB')).toBe('Ticked, words v3.');
    expect(tickOf(t, { ...at, confirm: 'none', consentVersion: null }, { ...tick, wordingVersion: undefined } as Question, true, 'en-GB')).toBe('Ticked.');
    expect(tickOf(t, { ...at, confirm: 'pending', consentVersion: 3 }, tick, false, 'en-GB')).toBe('Not ticked.');
  });

  it('names the row an answer became, linked only where the reader may open its page', () => {
    const tables = [{ id: 't1', tableRef: 'crm:enquiries', label: 'Enquiries', app: 'Sales CRM', columns: [], page: 'team-inbox' }];
    expect(becameOf({ becameTable: 'crm:enquiries', becameKey: '1042' }, tables)).toEqual({ table: 'Enquiries', key: '1042', to: '/p/team-inbox/r/1042' });
    expect(becameOf({ becameTable: 'crm:enquiries', becameKey: '1042' }, [{ ...tables[0]!, page: undefined }])).toEqual({ table: 'Enquiries', key: '1042', to: null });
    expect(becameOf({ becameTable: 'crm:contacts', becameKey: '9' }, tables)).toEqual({ table: 'contacts', key: '9', to: null });
    expect(becameOf({ becameTable: null, becameKey: null }, tables)).toBeNull();
  });

  it('reads an answer row as either database hands it back', () => {
    const row = { id: 3, submitted_at: '2026-11-02T09:12:00.000Z', language: 'de-DE', values: { qname: 'Tomas' }, email: null, name: 'Tomas', became_table: null, became_key: null, confirm: 'weird', consent_version: '3', consent_wording: null, sent_from: null };
    const read = answerOf(row as never);
    expect(read).toMatchObject({ id: '3', language: 'de-DE', values: { qname: 'Tomas' }, confirm: 'none', consentVersion: 3 });
    expect(answerOf({ ...row, values: '{"qname":"T"}', consent_version: null } as never)).toMatchObject({ values: { qname: 'T' }, consentVersion: null });
  });
});
