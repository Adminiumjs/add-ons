/**
 * A SURVEY'S SETTINGS: the settings column of the Questions tab, on a survey.
 *
 * A survey's column is its own (comp 432-455): who answers, whether answers
 * keep names, what an answer becomes, the thank-you words, who is told (and
 * only on a low score), and how long each invitation's link takes answers. It
 * takes the place of a form's limits, files and agreement tick, which a
 * survey has none of.
 *
 * The builder holds the draft and saves it: this panel reads the settings
 * it is handed and hands back the whole new settings object. Three sections
 * are the builder's own and are drawn here as it hands them in (`becomes`,
 * `after`, `tell`): the column map, the thank-you words in each language and
 * the people and roles told. What a survey adds to each is drawn here around
 * them.
 */
import { useId, useState, type ReactNode } from 'react';

import { Card, Divider, NumberInput, RadioCard, RadioGroup, Stack, Switch, type AddOnTranslate } from '../shared/host.ts';
import { Icon } from './parts.tsx';
import { keepsNamesOf, lowScoreOf, recommendOf, STOP_AFTER_MAX, STOP_AFTER_MIN, surveyOf, withLinkNames, withLowScore, withMode, withStopAfter, type SurveyMode } from './survey.ts';

export interface SurveySettingsProps {
  t: AddOnTranslate;
  /** The draft's definition, as the builder holds it: the recommend question is read from it. */
  definition: unknown;
  /** The draft's settings, as the builder holds them. */
  settings: unknown;
  /** The whole new settings object; the builder saves it with the rest of the draft. */
  onChange: (settings: Record<string, unknown>) => void;
  /** The builder's "Each answer becomes" body: drawn only while answers keep names. */
  becomes?: ReactNode;
  /** The builder's thank-you words. */
  after?: ReactNode;
  /** The builder's rows of people and roles told, with "Add a person or role". */
  tell?: ReactNode;
  /** Nothing may be changed (a reader, or a save under way). */
  disabled?: boolean;
}

function Section({ title, titleId, children }: { title: ReactNode; titleId?: string; children?: ReactNode }): ReactNode {
  return (
    <section aria-labelledby={titleId}>
      <Stack gap="sm">
        <h3 id={titleId} className="text-body font-bold text-fg">
          {title}
        </h3>
        {children}
      </Stack>
    </section>
  );
}

const Note = ({ children }: { children: ReactNode }): ReactNode => <span className="text-caption text-fg-subtle">{children}</span>;

/** A link column of the table an answer becomes: filled from the invitation, never from a question (comp's lock row). */
export function FromInvitation({ t, column }: { t: AddOnTranslate; column: string }): ReactNode {
  return (
    <span className="inline-flex items-center gap-2 text-body-sm text-fg-muted" data-part="from-invitation">
      <span className="font-bold text-fg">{column}</span>
      <Icon name="lock" />
      {t('surveys.settings.fromInvitation', "From the invitation: the record the rule's step names")}
    </span>
  );
}

/** "Only when the score is low", under the Tell rows, and the line that says when they are told. */
export function LowScoreTell({ t, definition, settings, onChange, disabled }: Pick<SurveySettingsProps, 't' | 'definition' | 'settings' | 'onChange' | 'disabled'>): ReactNode {
  const recommend = recommendOf(definition);
  const atMost = lowScoreOf(settings);
  const on = atMost !== null;
  const hint = useId();
  return (
    <Stack gap="xs">
      <Switch
        label={t('surveys.settings.lowScore', 'Only when the score is low')}
        checked={on}
        disabled={disabled === true || (recommend === null && !on)}
        onCheckedChange={(checked) => onChange(withLowScore(settings, checked && recommend !== null ? recommend.id : null))}
      />
      <span id={hint} className="text-caption text-fg-subtle">
        {on
          ? t('surveys.settings.lowScoreLine', 'Gets a bell and an e-mail when an answer scores 0–{n}.', { n: atMost })
          : recommend === null
            ? t('surveys.settings.noRecommend', 'Gets a bell and an e-mail for each answer. To tell only on a low score, mark a Score 0–10 question as the recommend question.')
            : t('surveys.settings.everyAnswer', 'Gets a bell and an e-mail for each answer.')}
      </span>
    </Stack>
  );
}

export function SurveySettings({ t, definition, settings, onChange, becomes, after, tell, disabled }: SurveySettingsProps): ReactNode {
  const survey = surveyOf(settings);
  const named = survey.mode === 'named';
  const keeps = keepsNamesOf(settings);
  const ids = { who: useId(), answers: useId(), becomes: useId(), after: useId(), tell: useId(), stop: useId(), days: useId() };
  const [days, setDays] = useState<string | null>(null);
  const typed = days ?? String(survey.stopAfterDays);
  const daysWrong = days !== null && withStopAfter(settings, days) === null;
  const off = disabled === true;

  return (
    <aside aria-label={t('surveys.settings.title', 'Survey settings')} data-part="survey-settings">
      <Card title={t('surveys.settings.title', 'Survey settings')}>
        <Stack gap="md">
          <Section title={t('surveys.settings.who', 'Who answers')} titleId={ids.who}>
            <RadioGroup value={survey.mode} onValueChange={(mode) => onChange(withMode(settings, mode as SurveyMode))} aria-label={t('surveys.settings.who', 'Who answers')}>
              <RadioCard value="named" disabled={off} title={t('surveys.settings.named', 'People you invite')} description={t('surveys.settings.namedHelp', 'A rule sends each person their own link. There is no open link.')} />
              <RadioCard value="anonymous" disabled={off} title={t('surveys.settings.anonymous', 'Anyone with the link')} description={t('surveys.settings.anonymousHelp', 'One open link anyone may answer, and a rule may mail it too. Names are never kept.')} />
            </RadioGroup>
          </Section>
          <Divider />
          <Section title={t('surveys.settings.answers', 'Answers')} titleId={ids.answers}>
            <Switch label={t('surveys.settings.linkNames', 'Link answers to names')} checked={survey.linkNames} disabled={off || !named} onCheckedChange={(checked) => onChange(withLinkNames(settings, checked))} />
            <Note>
              {!named
                ? t('surveys.settings.linkNamesOpen', 'Answers to an open link come with no name, so they cannot be linked to anyone.')
                : survey.linkNames
                  ? t('surveys.settings.linkNamesOn', 'Each answer shows who sent it. Turn off to make answers anonymous.')
                  : t('surveys.settings.linkNamesOff', 'Anonymous: names never show with answers, and answers can only be downloaded without names.')}
            </Note>
          </Section>
          <Divider />
          <Section title={t('surveys.settings.becomes', 'Each answer becomes')} titleId={ids.becomes}>
            {keeps ? becomes : <Note>{t('surveys.settings.becomesOff', 'Nothing: an answer with no name becomes no row, because a row would say who answered.')}</Note>}
          </Section>
          <Divider />
          <Section title={t('surveys.settings.after', 'After sending')} titleId={ids.after}>
            {after}
          </Section>
          <Divider />
          <Section title={t('surveys.settings.tell', 'Tell')} titleId={ids.tell}>
            {tell}
            <LowScoreTell t={t} definition={definition} settings={settings} onChange={onChange} disabled={off} />
          </Section>
          {named ? (
            <>
              <Divider />
              <Section title={t('surveys.settings.stop', 'Stop taking answers')} titleId={ids.stop}>
                <NumberInput
                  id={ids.days}
                  aria-label={t('surveys.settings.stopLabel', 'Stop taking answers this many days after each invitation')}
                  value={typed}
                  whole
                  disabled={off}
                  unit={t('surveys.settings.stopUnit', 'days after each invitation')}
                  {...(daysWrong ? { error: t('surveys.settings.stopRange', 'A whole number of days from {min} to {max}.', { min: STOP_AFTER_MIN, max: STOP_AFTER_MAX }) } : {})}
                  onChange={(value) => {
                    setDays(value);
                    const next = withStopAfter(settings, value);
                    if (next !== null) onChange(next);
                  }}
                  onBlur={() => {
                    if (!daysWrong) setDays(null);
                  }}
                />
              </Section>
            </>
          ) : null}
        </Stack>
      </Card>
    </aside>
  );
}
