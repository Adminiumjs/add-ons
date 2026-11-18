/**
 * WHAT THE EDITOR SAYS WHEN SOMETHING STOPS IT: a field the page cannot go
 * live with, and a refusal from Adminium, in the reader's own language.
 *
 * Adminium decides: the publish seal refuses a page whose copy does not
 * parse, that still carries Milo's mark, or whose address is not one a page
 * may have (`details.reason`). The editor checks the same three first, so
 * the person is told before anything is sent; whatever Adminium still
 * refuses, it says in these words, and in the server's own when it names
 * nothing this editor knows.
 */
import type { AddOnTranslate, DataError } from '../shared/host.ts';
import type { Page, Problem } from './doc.ts';
import { kindName } from './kinds.ts';

/** A field of a section, by the name the inspector gives it. */
export function fieldName(t: AddOnTranslate, field: string): string {
  switch (field) {
    case 'heading':
      return t('editor.field.heading', 'Heading');
    case 'text':
      return t('editor.field.text', 'Text');
    case 'label':
      return t('editor.field.label', 'Button words');
    case 'href':
    case 'link':
    case 'key':
      return t('editor.field.link', 'Where it goes');
    case 'alt':
      return t('editor.field.alt', 'Describe the picture');
    case 'file':
    case 'picture':
      return t('editor.field.picture', 'Picture');
    case 'who':
      return t('editor.field.who', 'Who said it');
    case 'question':
      return t('editor.field.question', 'Question');
    case 'answer':
      return t('editor.field.answer', 'Answer');
    case 'title':
      return t('editor.field.title', 'Title');
    case 'description':
      return t('editor.field.description', 'Description');
    case 'form':
    case 'addOn':
      return t('editor.field.form', 'Form');
    case 'items':
      return t('editor.field.items', 'Points');
    case 'columns':
      return t('editor.field.columns', 'Columns');
    default:
      return t('editor.field.other', 'A field');
  }
}

/** Where a problem is: the section's kind, or the page's settings. */
export function whereOf(t: AddOnTranslate, problem: Problem, page: Page): string {
  if (problem.code === 'field' && problem.block !== null) {
    const block = page.blocks.find((one) => one.id === problem.block);
    if (block !== undefined) return kindName(t, block.kind);
  }
  if (problem.code === 'marked') return t('editor.problem.whereMilo', 'Milo’s draft');
  return t('editor.problem.wherePage', 'Page settings');
}

/** What is wrong, in one sentence. */
export function problemWords(t: AddOnTranslate, problem: Problem): string {
  switch (problem.code) {
    case 'marked':
      return t('editor.problem.marked', 'Some sections still carry Milo’s mark. Look at each one, or press “Looks right”.');
    case 'slug':
      return t('editor.problem.slug', 'The address may hold only lower-case letters, digits and dashes, and may not be a word the addresses use.');
    case 'empty':
      return t('editor.problem.empty', 'The page has no sections yet.');
    case 'field': {
      const field = fieldName(t, problem.field);
      switch (problem.issue) {
        case 'too_small':
        case 'blank':
          return t('editor.problem.blank', '{field} is empty.', { field });
        case 'too_big':
          return t('editor.problem.long', '{field} is too long.', { field });
        case 'link-https':
          return t('editor.problem.https', '{field} needs a whole address that starts with https.', { field });
        case 'link-form-missing':
          return t('editor.problem.noForm', '{field} goes to the form on this page, and the page has no form.', { field });
        case 'picture-file':
          return t('editor.problem.picture', 'Choose a picture.');
        case 'control-character':
          return t('editor.problem.character', '{field} holds a character a page cannot show.', { field });
        default:
          return t('editor.problem.other', '{field} is not filled in right.', { field });
      }
    }
  }
}

const reasonOf = (error: DataError): string | null => {
  const reason = error.details?.['reason'];
  return typeof reason === 'string' ? reason : null;
};

/** A refusal of a save or a publish, in words. */
export function refusalWords(t: AddOnTranslate, error: DataError): string {
  switch (reasonOf(error)) {
    case 'landing-marked':
      return t('editor.refusal.marked', 'This page can’t be published while a section still carries Milo’s mark. Look at each one first.');
    case 'landing-unparsable':
      return t('editor.refusal.unparsable', 'This page can’t be published: Adminium can’t draw it as it is. Check each section.');
    case 'landing-slug':
      // The address is unique in the table, so a clash is refused when it is saved; here the address itself is wrong.
      return t('editor.refusal.slug', 'This page can’t be published at that address. Use lower-case letters, digits and dashes.');
    case 'picture-refused':
      return t('editor.picture.refused', 'This file can’t be used. Use a PNG, JPEG, WebP or GIF of up to 5 MB.');
    default:
      break;
  }
  switch (error.code) {
    case 'UNIQUE_VIOLATION':
      return t('editor.refusal.slugTaken', 'Another page already has this address.');
    case 'RATE_LIMITED':
      return t('editor.refusal.rate', 'Too many tries. Wait a minute.');
    case 'STATE_MOVE_REFUSED':
      return t('editor.refusal.state', 'This page changed meanwhile. Open it again to see where it stands.');
    case 'FORBIDDEN':
    case 'TABLE_FORBIDDEN':
    case 'COLUMN_FORBIDDEN':
      return t('editor.refusal.forbidden', 'You do not have permission to do this.');
    default:
      return error.message !== '' ? error.message : t('editor.refusal.other', 'This could not be saved. Try again.');
  }
}
