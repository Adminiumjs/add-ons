/**
 * WHAT A CHECK FOUND, IN WORDS: where it is (a question by its number and
 * words, a section of the form settings, the form) and what is wrong, in the
 * reader's language. The vocabulary says a code at a path; this says it.
 */
import type { AddOnTranslate } from '../shared/host.ts';
import { languageName } from '../shared/languages.ts';
import type { Problem, SettingsSection } from './checks.ts';
import { numberOf, questionAt, wordIn, type Definition, type Lang } from './draft.ts';

/** A form settings section's own name. */
export function sectionName(t: AddOnTranslate, section: SettingsSection): string {
  switch (section) {
    case 'becomes':
      return t('builder.s.becomes', 'Each answer becomes');
    case 'tick':
      return t('builder.s.tick', 'Agreement tick');
    case 'after':
      return t('builder.s.after', 'After sending');
    case 'tell':
      return t('builder.s.tell', 'Tell');
    case 'limits':
      return t('builder.s.limits', 'Limits');
    case 'files':
      return t('builder.s.files', 'Files');
    default:
      return t('builder.s.survey', 'Survey settings');
  }
}

/** Where a problem is, as a heading over it. */
export function whereWords(t: AddOnTranslate, problem: Problem, d: Definition, lang: Lang): string {
  const where = problem.where;
  if (where.at === 'question') {
    const question = questionAt(d, where.id);
    const n = numberOf(d, where.id);
    return t('builder.where.question', 'Q{n} · {label}', { n, label: wordIn(question?.label, lang, d.defaultLanguage) });
  }
  if (where.at === 'section') return t('builder.where.section', 'Section {n}', { n: problem.n ?? 1 });
  if (where.at === 'settings') return t('builder.where.settings', 'Form settings · {section}', { section: sectionName(t, where.section) });
  return t('builder.where.form', 'The form');
}

/** The text a problem is about, for a sentence that names it. */
function fieldWords(t: AddOnTranslate, problem: Problem): string {
  switch (problem.field) {
    case 'title':
      return t('builder.field.title', 'The title');
    case 'intro':
      return t('builder.field.intro', 'The introduction');
    case 'section':
      return t('builder.field.section', 'The section’s title');
    case 'label':
      return t('builder.field.label', 'The question');
    case 'wording':
      return t('builder.field.wording', 'The tick’s words');
    case 'help':
      return t('builder.field.help', 'The help text');
    case 'choice':
      return t('builder.field.choice', 'Choice {n}', { n: problem.n ?? 1 });
    case 'ending':
      return t('builder.field.ending', 'The thank-you words');
    case 'source':
      return t('builder.field.source', 'The value every new row gets');
    default:
      return t('builder.field.other', 'This part');
  }
}

/** What is wrong, in one sentence. */
export function problemWords(t: AddOnTranslate, problem: Problem): string {
  const language = problem.lang === undefined ? '' : languageName(problem.lang);
  const what = fieldWords(t, problem);
  switch (problem.code) {
    case 'notice-unset':
      return t('builder.problem.notice', 'Set your privacy notice first, in Privacy & public pages.');
    case 'table-gone':
      return t('builder.problem.tableGone', 'Answers can no longer become rows of this table: its app no longer opens it to forms. Pick another table, or just keep the answers.');
    case 'column-gone':
      return t('builder.problem.columnGone', '“{column}” no longer takes this answer. Pick another column.', { column: problem.column ?? '' });
    case 'column-link':
      return t('builder.problem.columnLink', '“{column}” links to another row, so no question can fill it.', { column: problem.column ?? '' });
    case 'column-required':
      return t('builder.problem.columnRequired', '“{column}” must be filled. Pick the question that fills it.', { column: problem.column ?? '' });
    case 'column-values':
      return t('builder.problem.columnValues', '“{column}” takes only {values}. Store these choices as one of them: {choices}.', { column: problem.column ?? '', values: (problem.values ?? []).join(', '), choices: (problem.names ?? []).join(', ') });
    case 'slug':
      return t('builder.problem.slug', 'The link name is not one Adminium can serve.');
    case 'words-missing':
      return t('builder.problem.wordsMissing', '{what} has no {language} words yet.', { what, language });
    case 'too_small':
      if (problem.lang !== undefined) return t('builder.problem.empty', '{what} is empty in {language}.', { what, language });
      if (problem.where.at === 'form') return t('builder.problem.noQuestions', 'Add at least one question.');
      if (problem.where.at === 'settings' && problem.where.section === 'files') return t('builder.problem.fileKinds', 'Tick at least one kind of file.');
      if (problem.where.at === 'settings' && problem.where.section === 'becomes') return t('builder.problem.sourceEmpty', 'Write the value every new row gets.');
      return t('builder.problem.choicesFew', 'Give it at least two choices.');
    case 'too_big':
      if (problem.lang !== undefined) return t('builder.problem.long', '{what} is too long in {language}.', { what, language });
      if (problem.where.at === 'settings' && problem.where.section === 'tell') return t('builder.problem.tellMany', 'Tell at most 10 people and roles.');
      return t('builder.problem.big', 'This is more than a form can take.');
    case 'invalid_format':
      return problem.lang !== undefined ? t('builder.problem.empty', '{what} is empty in {language}.', { what, language }) : t('builder.problem.param', 'The name in the link is 1 to 32 lower-case letters, digits or _, starting with a letter.');
    case 'id-duplicate':
      return t('builder.problem.duplicate', 'Two of its choices, or two hidden fields, are stored under one name.');
    case 'show-if-unknown':
    case 'show-if-forward':
    case 'show-if-kind':
    case 'show-if-test':
    case 'show-if-choice':
    case 'show-if-range':
      return t('builder.problem.showIf', 'Its “Show only if” tests an answer it cannot test. Change it.');
    case 'tick-purpose-twice':
      return t('builder.problem.purposeTwice', 'Another agreement tick asks for the same thing. Pick the other reason.');
    case 'tick-confirm-email':
      return t('builder.problem.confirmEmail', 'Confirming by e-mail needs a Short text question that must be an e-mail address.');
    case 'recommend-twice':
      return t('builder.problem.recommendTwice', 'Only one score can be the recommend score.');
    case 'survey-file':
    case 'survey-tick':
      return t('builder.problem.surveyKind', 'A survey cannot ask this kind of question.');
    case 'several-picks':
      return t('builder.problem.picks', 'The fewest and the most picks do not fit its choices.');
    case 'number-bounds':
      return t('builder.problem.bounds', 'Its smallest number is above its largest.');
    case 'ending-https':
      return t('builder.problem.https', 'The page to go to must be an https:// address.');
    case 'becomes-anonymous':
      return t('builder.problem.becomesAnonymous', 'A survey that keeps no names cannot become a row.');
    case 'becomes-question-unknown':
    case 'becomes-question-kind':
    case 'becomes-column-twice':
      return t('builder.problem.map', 'A column is filled twice, or by a question that cannot fill it.');
    case 'tell-duplicate':
      return t('builder.problem.tellTwice', 'Someone is on the list twice.');
    default:
      return t('builder.problem.other', 'This is not complete yet.');
  }
}
