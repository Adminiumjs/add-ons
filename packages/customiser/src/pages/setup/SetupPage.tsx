/**
 * THE PAGE `customiser`: a product's customising set-up, step by step.
 *
 * A product of the shop app links to its base here (the app's own column,
 * `rules.addOnLink` into `bases`); the base carries the product's name. So
 * the picker lists the bases, each named as its product, and a base opens at
 * `/add-ons/customiser/customiser/<base>`, its step in `?step=`.
 *
 * The seven steps are the comp's. Ready-made designs (3) is the design
 * editor's (`../designs/`); Preview (6) opens the customer's editor, which
 * comes with that editor, and says so until then.
 */
import { useState, type ReactNode } from 'react';

import { PageFrame } from '../shared/PageFrame.tsx';
import { Button, Figure, Select, Stack, StatusPill, useNavigate, useParams, useRecords, useSearch, type AddOnTranslate, type DataRow } from '../shared/host.ts';
import { pageAt } from '../shared/paths.ts';
import { AreasStep } from './AreasStep.tsx';
import { BaseStep } from './BaseStep.tsx';
import { useSetupData } from './data.ts';
import { FontsStep } from './FontsStep.tsx';
import { LaterStep } from './LaterStep.tsx';
import { isPublished, isStep, offeredOf, STEPS, stepDone, text, type PublishFacts, type Step } from './facts.ts';
import { NewBase } from './NewBase.tsx';
import { PricesStep } from './PricesStep.tsx';
import { PublishStep } from './PublishStep.tsx';
import { DesignsStep } from '../designs/DesignsStep.tsx';

/** The base an address opens: `customiser/<id>`, or none. */
export function baseIdOf(splat: string): string | null {
  const parts = splat.split('/').filter((part) => part !== '');
  return parts.length === 2 && parts[1] !== undefined ? parts[1] : null;
}

export function stepName(t: AddOnTranslate, step: Step): string {
  switch (step) {
    case 'base':
      return t('setup.step.base', 'Base');
    case 'areas':
      return t('setup.step.areas', 'Areas');
    case 'designs':
      return t('setup.step.designs', 'Ready-made designs');
    case 'fonts':
      return t('setup.step.fonts', 'Fonts & finishes');
    case 'prices':
      return t('setup.step.prices', 'Prices');
    case 'preview':
      return t('setup.step.preview', 'Preview');
    default:
      return t('setup.step.publish', 'Publish');
  }
}

export function factsOf(base: DataRow | null, data: { areas: readonly DataRow[]; designs: readonly DataRow[]; features: readonly DataRow[] }): PublishFacts {
  const shown = data.designs.filter((row) => row['state'] === 'published').length;
  return { base, areas: data.areas.length, shown, hidden: data.designs.length - shown, fonts: offeredOf(base).fonts.length, features: data.features.length };
}

export function SetupPage({ t }: { t: AddOnTranslate }): ReactNode {
  const { _splat } = useParams({ strict: false });
  const search = useSearch({ strict: false });
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const bases = useRecords('bases', { sort: [{ column: 'position', direction: 'asc' }, { column: 'id', direction: 'asc' }], pageSize: 199 });
  const wanted = baseIdOf(_splat ?? '');
  const base = (wanted === null ? bases.rows[0] : bases.rows.find((row) => String(row['id']) === wanted)) ?? null;
  const step: Step = isStep(search['step']) ? search['step'] : 'base';
  const data = useSetupData(base);
  const go = (to: Step, id: string | number | null = base === null ? null : (base['id'] as string | number)): void => {
    if (id === null) return;
    void navigate({ to: `${pageAt()}/${String(id)}`, search: to === 'base' ? {} : { step: to } });
  };
  const title = t('setup.title', 'Customising set-up');
  const newBase = (
    <Button variant="secondary" onClick={() => setAdding(true)}>
      {t('setup.newBase', 'New base')}
    </Button>
  );
  if (!bases.loading && bases.error === null && bases.rows.length === 0) {
    return (
      <PageFrame t={t} title={title} actions={newBase}>
        <LaterStep t={t} kind="none" onAdd={() => setAdding(true)} />
        <NewBase t={t} open={adding} onClose={() => setAdding(false)} onMade={(id) => go('base', id)} />
      </PageFrame>
    );
  }
  if (wanted !== null && !bases.loading && base === null) {
    return <PageFrame t={t} title={title} error={{ code: 'NOT_FOUND', message: '' }} />;
  }
  const facts = factsOf(base, data);
  const published = isPublished(base);
  const at = STEPS.indexOf(step);
  const picker = (
    <Select
      label={t('setup.product', 'Product')}
      value={base === null ? '' : String(base['id'])}
      onChange={(event) => go('base', event.target.value)}
      options={bases.rows.map((row) => ({ value: String(row['id']), label: isPublished(row) ? text(row['name']) : t('setup.notOfferedName', '{name} — not offered yet', { name: text(row['name']) }) }))}
    />
  );
  return (
    <PageFrame
      t={t}
      title={base === null ? title : text(base['name'])}
      adornment={base === null ? undefined : <StatusPill status={published ? 'published' : 'draft'} tone={published ? 'pos' : 'warn'}>{published ? t('setup.status.on', 'Offered for customising') : t('setup.status.off', 'Not offered yet')}</StatusPill>}
      actions={newBase}
      loading={bases.loading || (base !== null && data.loading)}
      error={bases.error ?? data.error}
      onRetry={() => {
        bases.refetch();
        data.refetch();
      }}
    >
      {base === null ? null : (
        <Stack gap="lg">
          <Stack direction="row" gap="md" align="end" justify="between" wrap>
            <Figure>{t('setup.crumb', 'Bases / {id}', { id: String(base['id']) })}</Figure>
            {picker}
          </Stack>
          <nav aria-label={t('setup.steps', 'Steps')}>
            <ol className="flex list-none flex-wrap gap-1.5">
              {STEPS.map((one, index) => (
                <li key={one} className="flex">
                  <StepButton current={one === step} done={one !== step && stepDone(one, facts)} number={index + 1} label={stepName(t, one)} onClick={() => go(one)} />
                </li>
              ))}
            </ol>
          </nav>
          {step === 'base' ? <BaseStep t={t} base={base} bases={bases.rows} settings={data.settings} /> : null}
          {step === 'areas' ? <AreasStep t={t} base={base} data={data} /> : null}
          {step === 'designs' ? <DesignsStep t={t} base={base} data={data} /> : null}
          {step === 'fonts' ? <FontsStep t={t} base={base} data={data} /> : null}
          {step === 'prices' ? <PricesStep t={t} base={base} data={data} /> : null}
          {step === 'preview' ? <LaterStep t={t} kind="preview" /> : null}
          {step === 'publish' ? <PublishStep t={t} base={base} facts={facts} go={go} /> : null}
          <Stack direction="row" gap="md" justify="between">
            {at > 0 ? (
              <Button variant="secondary" onClick={() => go(STEPS[at - 1]!)}>
                {stepName(t, STEPS[at - 1]!)}
              </Button>
            ) : (
              <span />
            )}
            {at < STEPS.length - 1 ? <Button onClick={() => go(STEPS[at + 1]!)}>{t('setup.next', 'Next: {step}', { step: stepName(t, STEPS[at + 1]!) })}</Button> : null}
          </Stack>
        </Stack>
      )}
      <NewBase t={t} open={adding} onClose={() => setAdding(false)} onMade={(id) => go('base', id)} />
    </PageFrame>
  );
}

/** One step of the stepper: the current one in the accent, a done one ticked (the comp's ✓). */
function StepButton({ current, done, number, label, onClick }: { current: boolean; done: boolean; number: number; label: string; onClick: () => void }): ReactNode {
  const dot = done ? '✓' : String(number);
  if (current) {
    return (
      <button type="button" aria-current="step" onClick={onClick} className="inline-flex h-[38px] items-center gap-2 rounded-full border border-accent bg-accent-soft px-1.5 text-[12.5px] font-bold text-accent">
        <span className="inline-flex size-[26px] items-center justify-center rounded-full bg-surface font-mono text-[11px] font-extrabold">{dot}</span>
        {label}
      </button>
    );
  }
  return (
    <button type="button" onClick={onClick} className="inline-flex h-[38px] items-center gap-2 rounded-full border border-border-strong bg-surface px-1.5 text-[12.5px] font-bold text-fg hover:border-accent">
      <span className="inline-flex size-[26px] items-center justify-center rounded-full bg-surface-3 font-mono text-[11px] font-extrabold">{dot}</span>
      {label}
    </button>
  );
}
