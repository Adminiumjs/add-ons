/**
 * TRY A QUESTION (comp 3b, 3c): what a visitor asking it would get, from the
 * real automatic answers (Adminium's own answerer, counted against today's
 * limit like a visitor's question). Visitors never see a try.
 *
 * It runs when the person asks it to (Enter, or "Try"), never on each key,
 * because each try spends the chat's tokens.
 */
import { useState, type ReactNode } from 'react';

import { Button, type AddOnTranslate } from '../shared/host.ts';
import { chatRoutes, refusalOf, type Tried } from '../shared/chat.ts';
import { Icon } from '../shared/parts.tsx';
import { versionIn, type Answer } from '../shared/rows.ts';
import { Segs } from '../shared/Segs.tsx';
import { Section, SectionTitle } from './parts.tsx';

/** Why the chat would go to a person, in words. */
export function handOverWhy(t: AddOnTranslate, tried: Tried): string {
  switch (tried.outcome) {
    case 'budget':
      return t('settings.try.budget', 'Today’s limit is used up, so a person would answer.');
    case 'cap':
      return t('settings.try.cap', 'This chat has had as many automatic answers as one chat may.');
    case 'off':
      return t('settings.try.off', 'Automatic answers can’t run on this server.');
    case 'error':
      return t('settings.try.error', 'The AI service did not answer, so a person would.');
    default:
      return t('settings.try.none', 'None of your answers fits this question.');
  }
}

export function TryQuestion({ t, answers, defaultLanguage }: { t: AddOnTranslate; answers: readonly Answer[]; defaultLanguage: string }): ReactNode {
  const [question, setQuestion] = useState('');
  const [tried, setTried] = useState<Tried | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  const ask = async (): Promise<void> => {
    if (question.trim() === '' || asking) return;
    setAsking(true);
    setFailed(null);
    try {
      setTried(await chatRoutes.tryQuestion(question.trim()));
    } catch (caught) {
      const said = refusalOf(caught);
      setTried(null);
      setFailed(said.status === 429 ? t('settings.try.rate', 'Too many tries. Wait a minute.') : said.code === 'FORBIDDEN' ? t('shared.refusal.forbidden', 'You do not have permission to do this.') : t('settings.try.failed', 'The question could not be tried. Try again.'));
    } finally {
      setAsking(false);
    }
  };

  const picked = tried?.answerRef === null || tried === null ? null : answers.find((answer) => answer.ref === tried.answerRef);
  const version = picked === null || picked === undefined ? null : versionIn(picked, defaultLanguage, defaultLanguage);

  let result: ReactNode = <span className="text-[12.5px] text-fg-subtle">{t('settings.try.empty', 'The result shows here.')}</span>;
  if (failed !== null) result = <span className="text-[12.5px] text-danger">{failed}</span>;
  else if (tried !== null && version !== null)
    result = (
      <div className="flex items-start gap-2.5">
        <span className="inline-flex pt-px text-pos">
          <Icon name="circle-check" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[13px] font-bold">{t('settings.try.pick', 'Would pick: {question}', { question: version.title })}</span>
          <span className="text-[12.5px] leading-normal text-fg-muted [overflow-wrap:anywhere]">
            <Segs text={version.text} />
          </span>
        </div>
      </div>
    );
  else if (tried !== null)
    result = (
      <div className="flex items-start gap-2.5">
        <span className="inline-flex pt-px text-info">
          <Icon name="user-round" />
        </span>
        <div className="flex flex-col gap-1">
          <span className="text-[13px] font-bold">{t('settings.try.hand', 'Would hand over to a person')}</span>
          <span className="text-[12.5px] text-fg-muted">{handOverWhy(t, tried)}</span>
        </div>
      </div>
    );

  return (
    <Section labelledBy="chat-try-title">
      <SectionTitle id="chat-try-title">{t('settings.try.title', 'Try a question')}</SectionTitle>
      <p className="m-0 text-[12.5px] text-fg-muted">{t('settings.try.text', 'Type what a visitor might ask. Visitors don’t see this.')}</p>
      <div className="flex items-center gap-2">
        <input
          aria-label={t('settings.try.field', 'A visitor’s question')}
          placeholder={t('settings.try.placeholder', 'can you remove old chairs')}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void ask();
          }}
          className="h-11 min-w-0 flex-1 rounded-[10px] border border-border-strong bg-surface px-3 text-[13px] text-fg"
        />
        <Button variant="secondary" loading={asking} onClick={() => void ask()}>
          {t('settings.try.run', 'Try')}
        </Button>
      </div>
      <div role="status" aria-live="polite" className="rounded-[10px] border border-border bg-surface-2 px-3.5 py-3">
        {result}
      </div>
    </Section>
  );
}
