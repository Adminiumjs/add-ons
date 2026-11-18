/**
 * EACH SECTION KIND AS THE EDITOR NAMES IT: its name, its icon and the line
 * the picker shows under it (comp `States` 863-868), and the picker's two
 * groups. Hero comes first; Form is the only "Action". There is no Pay link
 * and no Footer: the page's footer is the shell's, always there.
 */
import type { LandingBlockKind } from '@adminium/add-on-contracts/landing';

import type { AddOnTranslate } from '../shared/host.ts';

/** The picker's groups, in order. */
export const CONTENT_KINDS: readonly LandingBlockKind[] = ['hero', 'heading', 'text', 'picture', 'button', 'columns', 'features', 'quote', 'questions', 'spacer'];
export const ACTION_KINDS: readonly LandingBlockKind[] = ['form'];

/** Each kind's icon, by its lucide name. */
export const KIND_ICON: Readonly<Record<LandingBlockKind, string>> = {
  hero: 'layout-template',
  heading: 'heading',
  text: 'align-left',
  picture: 'image',
  button: 'mouse-pointer-click',
  columns: 'columns-2',
  features: 'list-checks',
  quote: 'quote',
  questions: 'circle-help',
  spacer: 'move-vertical',
  form: 'file-text',
};

/** A kind's name: "Hero", "Questions and answers". */
export function kindName(t: AddOnTranslate, kind: LandingBlockKind): string {
  switch (kind) {
    case 'hero':
      return t('editor.kind.hero', 'Hero');
    case 'heading':
      return t('editor.kind.heading', 'Heading');
    case 'text':
      return t('editor.kind.text', 'Text');
    case 'picture':
      return t('editor.kind.picture', 'Picture');
    case 'button':
      return t('editor.kind.button', 'Button');
    case 'columns':
      return t('editor.kind.columns', 'Columns');
    case 'features':
      return t('editor.kind.features', 'Features');
    case 'quote':
      return t('editor.kind.quote', 'Quote');
    case 'questions':
      return t('editor.kind.questions', 'Questions and answers');
    case 'spacer':
      return t('editor.kind.spacer', 'Spacer');
    case 'form':
      return t('editor.kind.form', 'Form');
  }
}

/** The line under a kind's name in the picker and over its settings. */
export function kindHint(t: AddOnTranslate, kind: LandingBlockKind): string {
  switch (kind) {
    case 'hero':
      return t('editor.hint.hero', 'Heading, text, picture and a button');
    case 'heading':
      return t('editor.hint.heading', 'A title for a part of the page');
    case 'text':
      return t('editor.hint.text', 'A paragraph or two');
    case 'picture':
      return t('editor.hint.picture', 'One picture, full width');
    case 'button':
      return t('editor.hint.button', 'A link that stands out');
    case 'columns':
      return t('editor.hint.columns', 'Two or three side by side');
    case 'features':
      return t('editor.hint.features', 'Short points, each with an icon');
    case 'quote':
      return t('editor.hint.quote', 'Words from a customer');
    case 'questions':
      return t('editor.hint.questions', 'Short questions that open one by one');
    case 'spacer':
      return t('editor.hint.spacer', 'Empty room between sections');
    case 'form':
      return t('editor.hint.form', 'One of your forms, filled in on the page');
  }
}
