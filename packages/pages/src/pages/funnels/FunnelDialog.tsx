/**
 * "NEW FUNNEL" AND "EDIT FUNNEL" (comp 2b).
 *
 * A name, the steps in order (live pages of this add-on and live forms of the
 * forms add-ons, at most eight), and the rule that follows, picked by hand.
 * "Edit funnel" opens with the funnel as it is, its linked rule picked. At
 * eight steps "Add a step" is switched off, and says why.
 *
 * Only someone who manages rules may list them: anyone else sees the rule
 * linked now and "None", and is told why there is nothing more to pick.
 */
import { useEffect, useId, useState, type ReactNode } from 'react';

import { readFunnelRule, readRules, type LiveForm, type RuleChoice } from '../../engine.ts';
import { Button, Dialog, DialogBody, DialogFooter, DialogHeader, IconButton, Input, Menu, MenuItem, RadioCard, RadioGroup, api, asDataError, useWrite, type AddOnTranslate } from '../shared/host.ts';
import { useLanding } from '../shared/landing.tsx';
import { MicroTitle, SmallIcon } from '../shared/parts.tsx';
import { ADD_ON, FUNNELS_TABLE } from '../shared/paths.ts';
import { refusal } from '../shared/refusal.ts';
import { asJson, FUNNEL_STEPS_MAX, sameStep, storedSteps, type FunnelRow, type PageRow, type Step } from '../shared/rows.ts';
import { useToast } from '../shared/toast.ts';
import { stepKindWords, stepNameOf } from './words.ts';

/** The rule picker's "None". */
const NONE = '';

/** Moves the step at `from` by one place (`by` −1 up, +1 down); the same list when it cannot move. */
export function moved<T>(list: readonly T[], from: number, by: -1 | 1): T[] {
  const to = from + by;
  if (from < 0 || from >= list.length || to < 0 || to >= list.length) return [...list];
  const out = [...list];
  const [one] = out.splice(from, 1);
  out.splice(to, 0, one as T);
  return out;
}

/** A step added at the end, unless the funnel holds eight already or holds that step. */
export function added(steps: readonly Step[], step: Step): Step[] {
  if (steps.length >= FUNNEL_STEPS_MAX || steps.some((one) => sameStep(one, step))) return [...steps];
  return [...steps, step];
}

export function FunnelDialog({ t, funnel, pages, onClose, onSaved }: { t: AddOnTranslate; funnel: FunnelRow | null; pages: readonly PageRow[]; onClose: () => void; onSaved: (key: string) => void }): ReactNode {
  const landing = useLanding();
  const write = useWrite(FUNNELS_TABLE);
  const toast = useToast();
  const ids = useId();
  const forms: readonly LiveForm[] = landing.forms ?? [];
  const [name, setName] = useState(funnel?.name ?? '');
  const [steps, setSteps] = useState<Step[]>(funnel?.steps ?? []);
  const [rule, setRule] = useState<string>(funnel?.ruleId ?? NONE);
  const [rules, setRules] = useState<readonly RuleChoice[] | null | undefined>(undefined);
  const [linkedName, setLinkedName] = useState<string | null>(null);
  const [said, setSaid] = useState<{ name?: string; steps?: string; save?: string }>({});
  const [busy, setBusy] = useState(false);
  const [spoken, setSpoken] = useState('');

  useEffect(() => {
    let live = true;
    void readRules(api).then((list) => {
      if (live) setRules(list);
    });
    // Someone who may not list the rules still sees the one linked now, by its name.
    if (funnel !== null && funnel.ruleId !== null)
      void readFunnelRule(api, ADD_ON, funnel.key)
        .then((linked) => {
          if (live && linked.state === 'linked') setLinkedName(linked.name);
        })
        .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [funnel]);

  const nameOf = (step: Step): string => stepNameOf(t, step, pages, forms);
  const full = steps.length >= FUNNEL_STEPS_MAX;
  const offeredPages = pages.filter((page) => page.state === 'live' && !steps.some((one) => sameStep(one, { kind: 'page', key: page.key })));
  const offeredForms = forms.filter((form) => !steps.some((one) => sameStep(one, { kind: 'form', key: form.key, addOn: form.addOn })));
  const choices: readonly RuleChoice[] = rules ?? (funnel?.ruleId === null || funnel?.ruleId === undefined ? [] : [{ id: funnel.ruleId, name: linkedName ?? t('funnels.dialog.linkedRule', 'The rule linked now') }]);

  const move = (i: number, by: -1 | 1): void => {
    const step = steps[i];
    const to = i + by;
    if (step === undefined || to < 0 || to >= steps.length) return;
    setSteps(moved(steps, i, by));
    // The new place is said, as the sections' Move up and Move down say it.
    setSpoken(t('funnels.dialog.movedTo', '{name} moved to {place} of {count}.', { name: nameOf(step), place: to + 1, count: steps.length }));
  };

  const save = async (): Promise<void> => {
    const wrong: typeof said = {};
    if (name.trim() === '') wrong.name = t('funnels.dialog.nameMissing', 'Give the funnel a name.');
    if (steps.length === 0) wrong.steps = t('funnels.dialog.stepsMissing', 'Add the page that comes first.');
    setSaid(wrong);
    if (wrong.name !== undefined || wrong.steps !== undefined) return;
    setBusy(true);
    try {
      const values = { name: name.trim(), steps: asJson(storedSteps(steps)), rule_id: rule === NONE ? null : rule };
      const result = funnel === null ? await write.create(values) : await write.update(funnel.key, values);
      toast(funnel === null ? t('funnels.dialog.made', 'Funnel made.') : t('funnels.dialog.saved', 'Funnel saved.'));
      onSaved(String(result.row['id'] ?? funnel?.key ?? ''));
    } catch (caught) {
      setSaid({ save: refusal(t, asDataError(caught)).message });
    } finally {
      setBusy(false);
    }
  };

  const capId = `${ids}-cap`;
  const stepsId = `${ids}-steps`;
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())} size="md">
      <DialogHeader title={funnel === null ? t('funnels.dialog.new', 'New funnel') : t('funnels.dialog.edit', 'Edit funnel')} closeLabel={t('shared.close', 'Close')} />
      <DialogBody>
        <span className="flex flex-col gap-[18px]">
          <Input label={t('funnels.dialog.name', 'Name')} value={name} maxLength={200} error={said.name} onChange={(event) => setName(event.target.value)} />
          <span className="flex flex-col gap-2">
            <span id={stepsId} className="text-[13px] font-bold">
              {t('funnels.dialog.steps', 'Steps')}
            </span>
            {steps.length === 0 ? (
              <p className="m-0 rounded-lg border border-dashed border-border-strong p-3.5 text-center text-[12.5px] text-fg-muted">{t('funnels.dialog.none', 'No steps yet. Start with the page that comes first.')}</p>
            ) : (
              <ol aria-labelledby={stepsId} className="m-0 flex list-none flex-col gap-1.5 p-0">
                {steps.map((step, i) => {
                  const named = nameOf(step);
                  return (
                    <li key={`${step.kind}:${step.kind === 'form' ? (step.addOn ?? '') : ''}:${step.key}`} className="flex items-center gap-2.5 rounded-lg border border-border bg-surface-2 py-1.5 pe-2 ps-2.5">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-surface-3 font-mono text-[11.5px] font-bold">{i + 1}</span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <MicroTitle>{stepKindWords(t, step)}</MicroTitle>
                        <span className="truncate text-[13px] font-bold">{named}</span>
                      </span>
                      <IconButton label={t('funnels.dialog.up', 'Move {name} up', { name: named })} disabled={i === 0} onClick={() => move(i, -1)}>
                        <SmallIcon name="arrow-up" />
                      </IconButton>
                      <IconButton label={t('funnels.dialog.down', 'Move {name} down', { name: named })} disabled={i === steps.length - 1} onClick={() => move(i, 1)}>
                        <SmallIcon name="arrow-down" />
                      </IconButton>
                      <IconButton label={t('funnels.dialog.remove', 'Remove {name}', { name: named })} onClick={() => setSteps(steps.filter((_, at) => at !== i))}>
                        <SmallIcon name="x" />
                      </IconButton>
                    </li>
                  );
                })}
              </ol>
            )}
            {said.steps === undefined ? null : (
              <span role="alert" className="text-[12.5px] text-danger">
                {said.steps}
              </span>
            )}
            <span className="flex flex-wrap items-center gap-3">
              {full ? (
                <span aria-describedby={capId} className="inline-flex">
                  <Button variant="secondary" iconLeft={<SmallIcon name="plus" />} disabled>
                    {t('funnels.dialog.add', 'Add a step')}
                  </Button>
                </span>
              ) : (
                <Menu
                  label={t('funnels.dialog.add', 'Add a step')}
                  trigger={
                    <Button variant="secondary" iconLeft={<SmallIcon name="plus" />}>
                      {t('funnels.dialog.add', 'Add a step')}
                    </Button>
                  }
                >
                  <span role="presentation" className="block px-2.5 pb-0.5 pt-2">
                    <MicroTitle>{t('funnels.dialog.pages', 'Pages')}</MicroTitle>
                  </span>
                  {offeredPages.map((page) => (
                    <MenuItem key={`page:${page.key}`} onSelect={() => setSteps((was) => added(was, { kind: 'page', key: page.key }))}>
                      {page.name}
                    </MenuItem>
                  ))}
                  <span role="presentation" className="block px-2.5 pb-0.5 pt-2">
                    <MicroTitle>{t('funnels.dialog.forms', 'Forms')}</MicroTitle>
                  </span>
                  {offeredForms.map((form) => (
                    <MenuItem key={`form:${form.addOn}:${form.key}`} onSelect={() => setSteps((was) => added(was, { kind: 'form', key: form.key, addOn: form.addOn }))}>
                      {form.name}
                    </MenuItem>
                  ))}
                  {offeredPages.length + offeredForms.length === 0 ? (
                    <MenuItem disabled onSelect={() => undefined}>
                      {t('funnels.dialog.nothing', 'No live page or form left to add')}
                    </MenuItem>
                  ) : null}
                </Menu>
              )}
              <span id={capId} className="text-[12px] text-fg-muted">
                {t('funnels.dialog.cap', 'At most 8 steps.')}
              </span>
            </span>
            <span role="status" className="sr-only">
              {spoken}
            </span>
          </span>
          <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
            <legend className="mb-1.5 p-0 text-[13px] font-bold">{t('funnels.dialog.after', 'What happens after')}</legend>
            <RadioGroup value={rule} onValueChange={setRule} aria-label={t('funnels.dialog.after', 'What happens after')}>
              {choices.map((choice) => (
                <RadioCard key={choice.id} value={choice.id} title={choice.name} />
              ))}
              <RadioCard value={NONE} title={t('funnels.dialog.noRule', 'None')} />
            </RadioGroup>
            {rules === null ? <span className="text-[12px] text-fg-muted">{t('funnels.dialog.rulesClosed', 'Only someone who manages rules can link another rule.')}</span> : null}
          </fieldset>
          {said.save === undefined ? null : (
            <span role="alert" className="text-[12.5px] text-danger">
              {said.save}
            </span>
          )}
        </span>
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={onClose}>
          {t('shared.cancel', 'Cancel')}
        </Button>
        <Button variant="primary" loading={busy} onClick={() => void save()}>
          {funnel === null ? t('funnels.dialog.create', 'Create funnel') : t('funnels.dialog.save', 'Save funnel')}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
