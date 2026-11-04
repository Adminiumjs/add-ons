/**
 * STEP 7, PUBLISH: the checks before a base is offered, and the switch.
 *
 * A base is offered once it is finished and has at least one area or shown
 * ready-made design, and a font (the comp's checklist). Until then the
 * product page has no "Make it yours". Each row opens its step.
 */
import type { ReactNode } from 'react';

import { asDataError, Button, Card, Figure, Stack, StatusPill, useWrite, type AddOnTranslate, type DataRow } from '../shared/host.ts';
import { refusal } from '../shared/refusal.ts';
import { useToast } from '../shared/toast.ts';
import { baseReady, canPublish, isPublished, kindOf, mm, sizeOf, type PublishFacts, type Step } from './facts.ts';
import { stepName } from './SetupPage.tsx';

export function PublishStep({ t, base, facts, go }: { t: AddOnTranslate; base: DataRow; facts: PublishFacts; go: (step: Step) => void }): ReactNode {
  const write = useWrite('bases');
  const toast = useToast();
  const published = isPublished(base);
  const ok = canPublish(facts);
  const size = sizeOf(base);
  const rows: { step: Step; done: boolean; optional: boolean; detail: string }[] = [
    { step: 'base', done: baseReady(base), optional: false, detail: baseReady(base) ? (kindOf(base) === 'page' ? t('setup.size', '{w} × {h} mm', { w: mm(size.width), h: mm(size.height) }) : kindOf(base) === 'kit' ? t('setup.publish.model', 'Model · {w} × {h} mm', { w: mm(size.width), h: mm(size.height) }) : t('setup.publish.outline', 'Outline · {w} × {h} mm', { w: mm(size.width), h: mm(size.height) })) : t('setup.publish.needed', 'still needed') },
    { step: 'areas', done: facts.areas > 0, optional: true, detail: t('setup.publish.areas', '{n, plural, one {# area} other {# areas}}', { n: facts.areas }) },
    { step: 'designs', done: facts.shown > 0, optional: true, detail: t('setup.publish.designs', '{shown} shown · {hidden} hidden', { shown: facts.shown, hidden: facts.hidden }) },
    { step: 'fonts', done: facts.fonts > 0, optional: false, detail: t('setup.publish.fonts', '{n, plural, one {# font} other {# fonts}}', { n: facts.fonts }) },
    { step: 'prices', done: true, optional: true, detail: facts.features === 0 ? t('setup.publish.nothingExtra', 'nothing extra') : t('setup.publish.features', '{n, plural, one {# priced feature} other {# priced features}}', { n: facts.features }) },
  ];
  const flip = (): void => {
    if (!published && !ok) return;
    write
      .update(base['id'] as string | number, { state: published ? 'draft' : 'published' })
      .then(() => toast(published ? t('setup.publish.stopped', 'No longer offered for customising.') : t('setup.publish.done', 'Published. Shoppers can make it theirs.'), published ? 'info' : 'success'))
      .catch((caught: unknown) => toast(refusal(t, asDataError(caught)).message, 'error'));
  };
  return (
    <Card>
      <Stack gap="md">
        <ul className="m-0 flex list-none flex-col">
          {rows.map((row) => (
            <li key={row.step} className="border-b border-border">
              <button type="button" onClick={() => go(row.step)} className="flex w-full items-center gap-3 px-3 py-3 text-start hover:bg-surface-2">
                <StatusPill status={row.done ? 'done' : row.optional ? 'optional' : 'needed'} tone={row.done ? 'pos' : row.optional ? 'neutral' : 'warn'}>
                  {row.done ? t('setup.publish.done.mark', 'Done') : row.optional ? t('setup.publish.optional', 'Optional') : t('setup.publish.todo', 'To do')}
                </StatusPill>
                <span className="flex-1 text-[13px] font-extrabold">{stepName(t, row.step)}</span>
                <Figure>{row.detail}</Figure>
              </button>
            </li>
          ))}
        </ul>
        <Stack direction="row" gap="md" align="center" justify="between" wrap>
          <p className="m-0 flex-1 text-[13px] leading-relaxed text-fg-muted">{published ? t('setup.publish.liveNote', 'Shoppers can customise it now. What you change here reaches them straight away.') : t('setup.publish.note', 'Until you publish, the product page has no “Make it yours” and shoppers can’t customise it.')}</p>
          {published ? (
            <Button variant="secondary" onClick={flip}>
              {t('setup.publish.stop', 'Stop offering it')}
            </Button>
          ) : (
            <Button disabled={!ok} onClick={flip}>
              {t('setup.publish.go', 'Publish')}
            </Button>
          )}
        </Stack>
        {!published && !ok ? <p className="m-0 text-[12.5px] text-fg-muted">{t('setup.publish.why', 'Finish the base and add at least one area or ready-made design first.')}</p> : null}
      </Stack>
    </Card>
  );
}
