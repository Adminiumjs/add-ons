/**
 * THE BUILDER'S BUTTONS IN THE TOP BAR: the language button, the save state,
 * "Preview" (forms only) and the primary button — "Publish", or "Close form"
 * / "Close survey" while it is live.
 *
 * Drawn here, and not yet working: the builder fills them (the language
 * popover, the preview, publishing and closing).
 */
import type { ReactNode } from 'react';

import { AutosaveIndicator, Button, lucideByName } from '../shared/host.ts';
import { languageName } from '../shared/languages.ts';
import { glanceOf } from '../shared/row.ts';
import type { TabProps } from '../shared/slot.ts';

const Icon = ({ name }: { name: string }): ReactNode => {
  const Found = lucideByName(name);
  return <Found className="size-4" />;
};

export function HeaderActions({ t, form }: TabProps): ReactNode {
  const glance = glanceOf(form.definition);
  const language = glance.defaultLanguage ?? 'en-US';
  const live = form.state === 'live';
  return (
    <>
      <Button variant="secondary" iconLeft={<Icon name="languages" />} aria-label={t('builder.languages', 'Language variations')} disabled>
        <span className="inline-flex items-center gap-2">
          <span lang={language}>{languageName(language)}</span>
          <span className="font-mono text-caption text-fg-muted">{String(Math.max(glance.languages.length, 1))}</span>
          <Icon name="chevron-down" />
        </span>
      </Button>
      <AutosaveIndicator status="saved" savingLabel={t('builder.saving', 'Saving')} savedLabel={t('builder.saved', 'All changes saved')} />
      {form.kind === 'form' ? (
        <Button variant="secondary" iconLeft={<Icon name="eye" />} disabled>
          {t('builder.preview', 'Preview')}
        </Button>
      ) : null}
      <Button variant="primary" iconLeft={<Icon name={live ? 'x' : 'send'} />} disabled>
        {live ? (form.kind === 'survey' ? t('builder.closeSurvey', 'Close survey') : t('builder.closeForm', 'Close form')) : t('builder.publish', 'Publish')}
      </Button>
    </>
  );
}
