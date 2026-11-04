/**
 * A PIECE'S PART, AND ITS RULES (Birch Row, BC-0.RMD and BC-D4).
 *
 * "Shopper can change this": locked, the shopper sees the part and cannot
 * change it (a locked text keeps "What it says"); open, the shopper changes
 * it within THE RULES. A shape is always the studio's, so its switch is off.
 *
 * - Text: "Characters at {size} mm" (the limit grows with smaller letters on
 *   a piece, CR3), "Smallest", "Largest" in millimetres, "Fonts allowed",
 *   "Finishes allowed".
 * - A logo box: "Box width", "Box height", "How it sits" (Fit inside, Fill),
 *   "Colour" (one colour for engraving, full colour for painted finishes).
 * - A motif: "Motifs to choose from". A colour: "Colours" from the app's
 *   palette the part names.
 */
import { useId, type ReactNode } from 'react';

import { Button, Input, lucideByName, Switch, ToggleChip, type AddOnTranslate, type DataRow } from '../shared/host.ts';
import { Stepper } from '../setup/AreasStep.tsx';
import { mm, num, text } from '../setup/facts.ts';
import { MOTIFS, patchPart, patchRules, removePart, resizedBox, setLocked, toggleRule, type DesignDraft, type FaceFacts, type PartDraft } from './draft.ts';
import { kindName, motifName } from './words.ts';

const ICONS = { text: lucideByName('type'), picture: lucideByName('image'), choice: lucideByName('sprout'), shape: lucideByName('square'), colour: lucideByName('palette') } as const;

const clamp = (value: number, low: number, high: number): number => Math.max(low, Math.min(high, value));
const half = (value: number): number => Math.round(value * 2) / 2;
const numberOf = (value: unknown, fallback: number): number => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
const listOf = (value: unknown): (string | number)[] => (Array.isArray(value) ? (value as (string | number)[]) : []);

export interface PiecePanelProps {
  t: AddOnTranslate;
  face: FaceFacts;
  part: PartDraft;
  /** The fonts the base offers. */
  fonts: readonly string[];
  /** The app's finishes, and the codes the base offers. */
  finishes: readonly DataRow[];
  offeredFinishes: readonly string[];
  appPalettes: readonly DataRow[];
  colours: readonly DataRow[];
  readOnly: boolean;
  change: (next: (draft: DesignDraft) => DesignDraft, token?: string) => void;
  onRemoved: () => void;
}

export function PiecePanel({ t, face, part, fonts, finishes, offeredFinishes, appPalettes, colours, readOnly, change, onRemoved }: PiecePanelProps): ReactNode {
  const Icon = ICONS[part.kind];
  const shape = part.kind === 'shape';
  const open = !part.locked && !shape;
  const rules = part.rules;
  const rule = (next: (rules: Record<string, unknown>) => Record<string, unknown>, token?: string): void => change((draft) => patchRules(draft, part.key, next), token);
  const note = shape ? t('designs.piece.shapeNote', 'Shapes are always the studio’s') : part.locked ? t('designs.piece.lockedNote', 'Locked — shoppers see it but can’t change it') : t('designs.piece.openNote', 'Shoppers can change it within these rules');
  const finishName = (code: string): string => text(finishes.find((row) => text(row['code']) === code)?.['name']) || code;
  const size = numberOf(rules['size'], 6);
  const box = part.box;
  return (
    <section aria-label={t('designs.piece.panel', 'The part: {name}', { name: part.name })} className="flex w-full flex-col gap-3 rounded-xl border border-border-strong bg-surface p-3">
      <div className="flex items-center gap-2">
        <span className="inline-flex text-accent">
          <Icon />
        </span>
        <span className="flex-1 text-[14px] font-extrabold">{part.name}</span>
        <span className="font-mono text-[10.5px] text-fg-subtle">{kindName(t, part.kind, rules['alsoLogo'] !== undefined)}</span>
      </div>
      <div className="flex flex-col gap-1 rounded-[10px] border border-border bg-surface-2 px-3 py-2.5">
        <Switch label={t('designs.piece.canChange', 'Shopper can change this')} checked={open} disabled={shape || readOnly} onCheckedChange={(checked) => change((draft) => setLocked(draft, part.key, !checked))} />
        <span className="text-[11.5px] text-fg-subtle">{note}</span>
      </div>
      {part.locked && part.kind === 'text' ? <Input label={t('designs.piece.says', 'What it says')} value={text(part.value?.['text'] as string | undefined)} maxLength={400} disabled={readOnly} onChange={(event) => change((draft) => patchPart(draft, part.key, { value: { ...(part.value ?? {}), text: event.target.value } }), `says:${part.key}`)} /> : null}
      {open ? (
        <>
          <span className="font-mono text-[10px] font-bold text-fg-subtle">{t('designs.piece.rules', 'THE RULES')}</span>
          {part.kind === 'text' ? (
            <>
              <div className="flex flex-wrap gap-3">
                <Stepper t={t} label={t('designs.piece.chars', 'Characters at {size} mm', { size: mm(size) })} value={String(numberOf(rules['chars'], 20))} down={() => rule((r) => ({ ...r, chars: clamp(numberOf(r['chars'], 20) - 1, 1, 60) }))} up={() => rule((r) => ({ ...r, chars: clamp(numberOf(r['chars'], 20) + 1, 1, 60) }))} />
                <Stepper t={t} label={t('designs.piece.smallest', 'Smallest')} value={t('setup.mm', '{n} mm', { n: mm(numberOf(rules['min'], 4)) })} down={() => rule((r) => sized(r, 'min', -0.5))} up={() => rule((r) => sized(r, 'min', 0.5))} />
                <Stepper t={t} label={t('designs.piece.largest', 'Largest')} value={t('setup.mm', '{n} mm', { n: mm(numberOf(rules['max'], 8)) })} down={() => rule((r) => sized(r, 'max', -0.5))} up={() => rule((r) => sized(r, 'max', 0.5))} />
              </div>
              <Chips label={t('designs.piece.fonts', 'Fonts allowed')} all={[...new Set([...fonts, ...listOf(rules['fonts']).map(String)])]} on={listOf(rules['fonts']).map(String)} name={(family) => family} toggle={(family) => rule((r) => toggleRule(r, 'fonts', family))} />
              {offeredFinishes.length > 0 ? <Chips label={t('designs.piece.finishes', 'Finishes allowed')} all={offeredFinishes} on={listOf(rules['finishes']).map(String)} name={finishName} toggle={(code) => rule((r) => toggleRule(r, 'finishes', code))} /> : null}
            </>
          ) : null}
          {part.kind === 'picture' && box !== null ? (
            <>
              <div className="flex flex-wrap gap-3">
                <Stepper t={t} label={t('designs.piece.boxWidth', 'Box width')} value={t('setup.mm', '{n} mm', { n: mm(box.w) })} down={() => change((draft) => patchPart(draft, part.key, { box: resizedBox(box, -2, 0, face) }))} up={() => change((draft) => patchPart(draft, part.key, { box: resizedBox(box, 2, 0, face) }))} />
                <Stepper t={t} label={t('designs.piece.boxHeight', 'Box height')} value={t('setup.mm', '{n} mm', { n: mm(box.h) })} down={() => change((draft) => patchPart(draft, part.key, { box: resizedBox(box, 0, -2, face) }))} up={() => change((draft) => patchPart(draft, part.key, { box: resizedBox(box, 0, 2, face) }))} />
              </div>
              <OneOf label={t('designs.piece.sits', 'How it sits')} value={rules['fit'] === 'fill' ? 'fill' : 'inside'} options={[['inside', t('designs.fit.inside', 'Fit inside')], ['fill', t('designs.fit.fill', 'Fill')]]} pick={(fit) => rule((r) => ({ ...r, fit }))} />
              <OneOf label={t('designs.piece.colour', 'Colour')} value={rules['colour'] === 'full' ? 'full' : 'one'} options={[['one', t('designs.piece.oneColour', 'One colour (engraving)')], ['full', t('designs.piece.fullColour', 'Full colour (painted finishes)')]]} pick={(colour) => rule((r) => ({ ...r, colour }))} />
            </>
          ) : null}
          {part.kind === 'choice' ? <Chips label={t('designs.piece.motifs', 'Motifs to choose from')} all={[...new Set([...MOTIFS, ...listOf(rules['choices']).map(String)])]} on={listOf(rules['choices']).map(String)} name={(code) => motifName(t, code)} toggle={(code) => rule((r) => toggleRule(r, 'choices', code))} /> : null}
          {part.kind === 'colour' ? <Colours t={t} rules={rules} appPalettes={appPalettes} colours={colours} toggle={(code) => rule((r) => toggleRule(r, 'choices', code))} /> : null}
          {part.kind === 'text' || part.kind === 'picture' ? <Switch label={t('designs.required', 'Required')} checked={part.required} disabled={readOnly} onCheckedChange={(checked) => change((draft) => patchPart(draft, part.key, { required: checked }))} /> : null}
        </>
      ) : null}
      {readOnly ? null : (
        <span className="flex">
          <Button
            variant="ghost"
            onClick={() => {
              change((draft) => removePart(draft, part.key));
              onRemoved();
            }}
          >
            {t('designs.piece.remove', 'Remove this part')}
          </Button>
        </span>
      )}
    </section>
  );
}

/** A size rule moved by a step, kept so the smallest is never above the largest and the start size between them. */
function sized(rules: Record<string, unknown>, which: 'min' | 'max', step: number): Record<string, unknown> {
  const min = numberOf(rules['min'], 4);
  const max = numberOf(rules['max'], 8);
  const next = which === 'min' ? { min: clamp(half(min + step), 2, 40), max } : { min, max: clamp(half(max + step), 3, 60) };
  if (next.min > next.max) {
    if (which === 'min') next.max = next.min;
    else next.min = next.max;
  }
  const size = numberOf(rules['size'], next.min);
  return { ...rules, ...next, size: clamp(size, next.min, next.max) };
}

export function Chips({ label, all, on, name, toggle }: { label: string; all: readonly string[]; on: readonly string[]; name: (value: string) => string; toggle: (value: string) => void }): ReactNode {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <span id={id} className="text-[11.5px] font-bold text-fg-muted">
        {label}
      </span>
      <div role="group" aria-labelledby={id} className="flex flex-wrap gap-1.5">
        {all.map((value) => (
          <ToggleChip key={value} pressed={on.includes(value)} onPressedChange={() => toggle(value)}>
            {name(value)}
          </ToggleChip>
        ))}
      </div>
    </div>
  );
}

/** One of a few, as the comp's chips are: pressed is the part's own. */
function OneOf({ label, value, options, pick }: { label: string; value: string; options: readonly (readonly [string, string])[]; pick: (value: string) => void }): ReactNode {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <span id={id} className="text-[11.5px] font-bold text-fg-muted">
        {label}
      </span>
      <div role="group" aria-labelledby={id} className="flex flex-wrap gap-1.5">
        {options.map(([one, words]) => (
          <ToggleChip key={one} pressed={value === one} onPressedChange={() => pick(one)}>
            {words}
          </ToggleChip>
        ))}
      </div>
    </div>
  );
}

function Colours({ t, rules, appPalettes, colours, toggle }: { t: AddOnTranslate; rules: Readonly<Record<string, unknown>>; appPalettes: readonly DataRow[]; colours: readonly DataRow[]; toggle: (code: string) => void }): ReactNode {
  const palette = appPalettes.find((row) => text(row['code']) === text(rules['palette'] as string | undefined)) ?? appPalettes[0];
  const own = palette === undefined ? [] : colours.filter((row) => String(row['palette_id']) === String(palette['id'])).sort((a, b) => (num(a['position']) ?? 0) - (num(b['position']) ?? 0));
  return <Chips label={t('designs.piece.colours', 'Colours')} all={own.map((row) => text(row['code']))} on={listOf(rules['choices']).map(String)} name={(code) => text(own.find((row) => text(row['code']) === code)?.['name']) || code} toggle={toggle} />;
}
