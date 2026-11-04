/**
 * A PAGE'S PANEL (Marlow Press, MC-E2): the design, or the part selected, and
 * the layers of the side shown.
 *
 * - Nothing selected, "The design": its name, whether customers are shown
 *   it, the design's palettes (each a Paper, an Ink and an Accent colour) and
 *   its layout choices ("Add a layout from this one" copies the parts).
 * - A part, "This part": where it sits in millimetres; a text's sample
 *   words, font, size in points, weight and alignment, warned when it runs
 *   past the safe line; its colour from the palette; and "For the customer":
 *   "Customer can change this", then a text's field name, "Up to" so many
 *   characters (fixed on a page, CR3), the fonts, sizes and colours allowed,
 *   one line or several; a picture's kind and how it fits its box; Required.
 * - "Layers": every part of the side, top first, brought forward or sent back.
 */
import { useId, useState, type ReactNode } from 'react';

import { Figure, IconButton, Input, lucideByName, NumberInput, SegmentedControl, Select, Switch, Textarea, ToggleChip, type AddOnTranslate } from '../shared/host.ts';
import { mm } from '../setup/facts.ts';
import { textSizeMm, wordsOf } from '../../draw/parts.ts';
import { addLayout, addPalette, patchPalette, patchPart, patchRules, removeLayout, removePalette, removePart, renameLayout, ROLES, setLocked, textHeightMm, toggleRule, zMoved, type DesignDraft, type FaceFacts, type PartDraft, type Role, type Side } from './draft.ts';
import { Chips } from './PiecePanel.tsx';

const Lock = lucideByName('lock');
const Trash = lucideByName('trash-2');
const Up = lucideByName('chevron-up');
const Down = lucideByName('chevron-down');
const Plus = lucideByName('plus');
const Close = lucideByName('x');
const ICONS = { text: lucideByName('type'), picture: lucideByName('image'), choice: lucideByName('sprout'), shape: lucideByName('square'), colour: lucideByName('palette') } as const;

/** The sizes a page's text may be offered in, in points (Marlow's list, up to 40). */
export const PAGE_SIZES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 10, 11, 12, 13, 15, 18, 24, 32, 40] as const;
/** The weights a page's text may be set in. */
const WEIGHTS = [400, 500, 600, 700, 800] as const;

const numberOf = (value: unknown, fallback: number): number => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
const listOf = (value: unknown): (string | number)[] => (Array.isArray(value) ? (value as (string | number)[]) : []);
/** A text's width, near enough to warn by: Marlow's average letter (0.56 of the size), a little wider when bold. */
const textWidthMm = (words: string, part: PartDraft): number => {
  const longest = words.split(/\r?\n/).reduce((most, line) => Math.max(most, [...line].length), 0);
  return longest * textSizeMm(part.rules) * 0.56 * (numberOf(part.rules['weight'], 400) >= 700 ? 1.05 : 1);
};

export interface PagePanelProps {
  t: AddOnTranslate;
  face: FaceFacts;
  draft: DesignDraft;
  side: Side;
  layout: string | null;
  paletteKey: string | null;
  selected: PartDraft | null;
  /** The parts of the side and layout shown, in the order they are drawn. */
  visible: readonly PartDraft[];
  fonts: readonly string[];
  readOnly: boolean;
  change: (next: (draft: DesignDraft) => DesignDraft, token?: string) => void;
  onSelect: (key: string | null) => void;
  onLayout: (key: string) => void;
  onPalette: (key: string) => void;
}

export function PagePanel(props: PagePanelProps): ReactNode {
  const { t, selected } = props;
  return (
    <aside aria-label={selected === null ? t('designs.page.design', 'The design') : t('designs.page.part', 'This part')} className="flex w-full flex-col gap-4 rounded-xl border border-border bg-surface p-4">
      <fieldset disabled={props.readOnly} className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0">
        {selected === null ? <DesignFields {...props} /> : <PartFields {...props} part={selected} />}
      </fieldset>
      <Layers {...props} />
    </aside>
  );
}

function Heading({ id, children }: { id?: string; children: ReactNode }): ReactNode {
  return (
    <span id={id} className="text-[11px] font-extrabold text-fg-subtle">
      {children}
    </span>
  );
}

function DesignFields({ t, draft, layout, paletteKey, change, onLayout, onPalette, onSelect }: PagePanelProps): ReactNode {
  const palettesId = useId();
  const layoutsId = useId();
  const shown = draft.state === 'published';
  const current = draft.palettes.find((one) => one.key === paletteKey) ?? draft.palettes[0];
  const roleName = (role: Role): string => (role === 'paper' ? t('designs.role.paper', 'Paper') : role === 'ink' ? t('designs.role.ink', 'Ink') : t('designs.role.accent', 'Accent'));
  return (
    <>
      <Input label={t('designs.name', 'Design name')} value={draft.name} maxLength={120} onChange={(event) => change((d) => ({ ...d, name: event.target.value }), 'name')} />
      <Switch label={shown ? t('designs.shown', 'Shown to customers') : t('designs.hidden', 'Hidden from customers')} checked={shown} onCheckedChange={(checked) => change((d) => ({ ...d, state: checked ? 'published' : 'draft' }))} />
      <div className="flex flex-col gap-2">
        <Heading id={palettesId}>{t('designs.palettes', 'The design’s palettes')}</Heading>
        <div role="radiogroup" aria-labelledby={palettesId} className="flex flex-col gap-1.5">
          {draft.palettes.map((palette) => {
            const on = palette.key === (current?.key ?? null);
            return (
              <div key={palette.key} className="flex items-center gap-1.5 rounded-[10px] border border-border bg-surface-2 px-2 py-1.5">
                <button type="button" role="radio" aria-checked={on} onClick={() => onPalette(palette.key)} className="flex min-w-0 flex-1 text-start text-[12.5px] font-bold">
                  {palette.name}
                </button>
                {ROLES.map((role) => (
                  <input key={role} type="color" value={palette.colours[role]} aria-label={t('designs.paletteColour', '{role} colour of {name}', { role: roleName(role), name: palette.name })} onChange={(event) => change((d) => patchPalette(d, palette.key, { colour: [role, event.target.value] }), `colour:${palette.key}:${role}`)} />
                ))}
                {draft.palettes.length > 1 ? (
                  <IconButton label={t('designs.remove', 'Remove {name}', { name: palette.name })} variant="ghost" onClick={() => change((d) => removePalette(d, palette.key))}>
                    <Close />
                  </IconButton>
                ) : null}
              </div>
            );
          })}
        </div>
        <span className="flex">
          <ToggleChip
            pressed={false}
            onPressedChange={() => {
              const made = addPalette(draft, t('designs.paletteName', 'Palette {n}', { n: draft.palettes.length + 1 }), current);
              change(() => made.draft);
              onPalette(made.key);
            }}
          >
            <span className="inline-flex items-center gap-1.5">
              <Plus />
              {t('designs.addPalette', 'Add a palette')}
            </span>
          </ToggleChip>
        </span>
      </div>
      {draft.layouts.length > 0 ? (
        <div className="flex flex-col gap-2">
          <Heading id={layoutsId}>{t('designs.layouts', 'Layout choices')}</Heading>
          <div role="radiogroup" aria-labelledby={layoutsId} className="flex flex-col gap-1.5">
            {draft.layouts.map((one, index) => (
              <div key={one.key} className="flex items-center gap-1.5 rounded-[10px] border border-border bg-surface-2 px-2 py-1.5">
                <button
                  type="button"
                  role="radio"
                  aria-checked={one.key === layout}
                  aria-label={t('designs.editLayout', 'Edit {name}', { name: one.name })}
                  onClick={() => {
                    onLayout(one.key);
                    onSelect(null);
                  }}
                  className="inline-flex size-[22px] items-center justify-center rounded-full border border-border-strong"
                >
                  {one.key === layout ? <span className="size-2.5 rounded-full bg-accent" /> : null}
                </button>
                <span className="flex min-w-0 flex-1">
                  <Input aria-label={t('designs.layoutName', 'Name of layout {n}', { n: index + 1 })} value={one.name} maxLength={60} onChange={(event) => change((d) => renameLayout(d, one.key, event.target.value), `layout:${one.key}`)} />
                </span>
                {draft.layouts.length > 1 ? (
                  <IconButton label={t('designs.remove', 'Remove {name}', { name: one.name })} variant="ghost" onClick={() => change((d) => removeLayout(d, one.key))}>
                    <Close />
                  </IconButton>
                ) : null}
              </div>
            ))}
          </div>
          <span className="flex">
            <ToggleChip
              pressed={false}
              onPressedChange={() => {
                const made = addLayout(draft, layout, t('designs.layoutNameNew', 'Layout {n}', { n: draft.layouts.length + 1 }));
                change(() => made.draft);
                onLayout(made.key);
                onSelect(null);
              }}
            >
              <span className="inline-flex items-center gap-1.5">
                <Plus />
                {t('designs.addLayout', 'Add a layout from this one')}
              </span>
            </ToggleChip>
          </span>
        </div>
      ) : null}
      <p className="m-0 text-[12px] leading-relaxed text-fg-subtle">{t('designs.page.pick', 'Select a part on the card to decide what the customer can change.')}</p>
    </>
  );
}

function PartFields({ t, face, part, fonts, change, onSelect, draft, paletteKey }: PagePanelProps & { part: PartDraft }): ReactNode {
  const rules = part.rules;
  const isText = part.kind === 'text';
  const isPicture = part.kind === 'picture';
  const isShape = part.kind === 'shape';
  const open = !part.locked;
  const canSwitch = isText || isPicture;
  const rule = (next: (rules: Record<string, unknown>) => Record<string, unknown>, token?: string): void => change((d) => patchRules(d, part.key, next), token);
  const coloursId = useId();
  const palette = draft.palettes.find((one) => one.key === paletteKey) ?? draft.palettes[0];
  const roleName = (role: Role): string => (role === 'paper' ? t('designs.role.paper', 'Paper') : role === 'ink' ? t('designs.role.ink', 'Ink') : t('designs.role.accent', 'Accent'));
  const box = part.box;
  const geometry: [keyof NonNullable<PartDraft['box']>, string, string][] = [
    ['x', 'X', t('designs.geom.x', 'Across in millimetres')],
    ['y', 'Y', t('designs.geom.y', 'Down in millimetres')],
    ['w', 'W', t('designs.geom.w', 'Width in millimetres')],
    ...(isText ? [] : ([['h', 'H', t('designs.geom.h', 'Height in millimetres')]] as [keyof NonNullable<PartDraft['box']>, string, string][])),
  ];
  const words = wordsOf(part);
  const width = isText ? textWidthMm(words, part) : 0;
  const align = rules['align'] === 'center' || rules['align'] === 'end' ? rules['align'] : 'start';
  const startX = box === null ? 0 : align === 'center' ? box.x + (box.w - width) / 2 : align === 'end' ? box.x + box.w - width : box.x;
  const pastSafe = isText && box !== null && (startX < face.safe - 0.01 || startX + width > face.width - face.safe + 0.01);
  const lines = Math.max(1, numberOf(rules['lines'], 1));
  const colourRule = isText ? 'colour' : 'fill';
  const Icon = ICONS[part.kind];
  return (
    <>
      <div className="flex items-center gap-2">
        {part.locked ? (
          <span className="inline-flex text-fg-subtle" aria-label={t('designs.locked', 'Locked')} role="img">
            <Lock />
          </span>
        ) : (
          <span className="inline-flex text-fg-subtle" aria-hidden="true">
            <Icon />
          </span>
        )}
        <span className="min-w-0 flex-1 text-[13.5px] font-extrabold">{part.name}</span>
        <IconButton
          label={t('designs.delete', 'Delete')}
          variant="bordered"
          onClick={() => {
            change((d) => removePart(d, part.key));
            onSelect(null);
          }}
        >
          <Trash />
        </IconButton>
      </div>
      {box === null ? null : (
        <div className="flex flex-col gap-2">
          <Heading>
            {t('designs.geom.title', 'Position and size')} <span className="font-mono">mm</span>
          </Heading>
          <div className="grid grid-cols-2 gap-2">
            {geometry.map(([key, letter, aria]) => (
              <LiveNumber key={key} ariaLabel={aria} label={letter} negative value={box[key]} onNumber={(value) => change((d) => patchPart(d, part.key, { box: { ...box, [key]: Math.round(value * 10) / 10 } }), `geom:${part.key}:${key}`)} />
            ))}
          </div>
        </div>
      )}
      {isText ? (
        <div className="flex flex-col gap-2.5">
          <label className="flex flex-col gap-1">
            <Heading>{t('designs.sample', 'Sample words')}</Heading>
            <Textarea
              rows={2}
              maxLength={400}
              value={part.locked ? String(part.value?.['text'] ?? '') : String(rules['placeholder'] ?? '')}
              onChange={(event) => {
                const value = event.target.value;
                change((d) => (part.locked ? patchPart(d, part.key, { value: { ...(part.value ?? {}), text: value } }) : patchRules(d, part.key, (r) => ({ ...r, placeholder: value }))), `sample:${part.key}`);
              }}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Select
              label={t('designs.font', 'Font')}
              value={String(rules['font'] ?? fonts[0] ?? '')}
              options={[...new Set([...fonts, ...listOf(rules['fonts']).map(String), String(rules['font'] ?? '')])].filter((one) => one !== '').map((family) => ({ value: family, label: family }))}
              onChange={(event) => {
                const font = event.target.value;
                rule((r) => ({ ...r, font, fonts: listOf(r['fonts']).includes(font) ? r['fonts'] : [...listOf(r['fonts']), font] }));
              }}
            />
            <LiveNumber
              label={t('designs.textSize', 'Size')}
              unit="pt"
              value={numberOf(rules['size'], 9)}
              onNumber={(size) => {
                if (!(size > 0)) return;
                change((d) => patchRules(d, part.key, (r) => ({ ...r, size, sizes: [...new Set([...listOf(r['sizes']).map(Number), size])].sort((a, b) => a - b) })), `size:${part.key}`);
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select
              label={t('designs.weight', 'Weight')}
              value={String(numberOf(rules['weight'], 400))}
              options={WEIGHTS.map((weight) => ({ value: String(weight), label: weightName(t, weight) }))}
              onChange={(event) => rule((r) => ({ ...r, weight: Number(event.target.value) }))}
            />
            <SegmentedControl
              aria-label={t('designs.align', 'Alignment')}
              value={align}
              onValueChange={(value) => rule((r) => ({ ...r, align: value }))}
              options={[
                { value: 'start', label: t('designs.align.start', 'Start') },
                { value: 'center', label: t('designs.align.centre', 'Centre') },
                { value: 'end', label: t('designs.align.end', 'End') },
              ]}
            />
          </div>
          {pastSafe ? (
            <p role="status" className="m-0 text-[12px] font-bold text-warn">
              {t('designs.pastSafe', 'This runs past the safe line. Make it smaller or move it in.')}
            </p>
          ) : null}
        </div>
      ) : null}
      {(isText || isShape) && palette !== undefined ? (
        <div className="flex flex-col gap-1.5">
          <span id={coloursId} className="text-[11px] font-bold text-fg-muted">
            {isText ? t('designs.colour', 'Colour') : t('designs.fill', 'Fill')}
          </span>
          <SegmentedControl
            aria-label={isText ? t('designs.colour', 'Colour') : t('designs.fill', 'Fill')}
            value={String(rules[colourRule] ?? (isText ? 'ink' : 'accent'))}
            onValueChange={(value) => rule((r) => ({ ...r, [colourRule]: value }))}
            options={ROLES.map((role) => ({ value: role, label: `${roleName(role)} (${palette.colours[role]})` }))}
          />
        </div>
      ) : null}
      {isPicture ? <p className="m-0 text-[12px] leading-relaxed text-fg-subtle">{t('designs.page.uploadNote', 'Customers upload their own here. It is checked at this box’s size.')}</p> : null}
      <div className="flex flex-col gap-3 rounded-xl border border-border-strong bg-surface-2 p-3">
        <Heading>{t('designs.page.forCustomer', 'For the customer')}</Heading>
        {canSwitch ? <Switch label={t('designs.page.canChange', 'Customer can change this')} checked={open} onCheckedChange={(checked) => change((d) => setLocked(d, part.key, !checked))} /> : <p className="m-0 text-[12px] leading-relaxed text-fg-muted">{t('designs.page.shapeNote', 'Shapes take their colour from the palette. A customer changes it by choosing another palette.')}</p>}
        {isText && open ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Input label={t('designs.page.field', 'Field name')} value={part.name} maxLength={120} onChange={(event) => change((d) => patchPart(d, part.key, { name: event.target.value }), `field:${part.key}`)} />
              <LiveNumber label={t('designs.page.upTo', 'Up to')} unit={t('designs.page.chars', 'chars')} whole value={numberOf(rules['chars'], 30)} onNumber={(value) => (value > 0 ? change((d) => patchRules(d, part.key, (r) => ({ ...r, chars: Math.floor(value), grows: false })), `chars:${part.key}`) : undefined)} />
            </div>
            <Chips label={t('designs.piece.fonts', 'Fonts allowed')} all={[...new Set([...fonts, ...listOf(rules['fonts']).map(String)])]} on={listOf(rules['fonts']).map(String)} name={(family) => family} toggle={(family) => rule((r) => toggleRule(r, 'fonts', family))} />
            <Chips label={t('designs.page.sizes', 'Sizes allowed (pt)')} all={[...new Set([...PAGE_SIZES, ...listOf(rules['sizes']).map(Number)])].sort((a, b) => a - b).map(String)} on={listOf(rules['sizes']).map(String)} name={(size) => size} toggle={(size) => rule((r) => toggleRule(r, 'sizes', Number(size)))} />
            {palette === undefined ? null : <Chips label={t('designs.page.colours', 'Colours from the palette')} all={[...ROLES]} on={listOf(rules['colours']).map(String)} name={(role) => roleName(role as Role)} toggle={(role) => rule((r) => toggleRule(r, 'colours', role))} />}
            <div className="flex flex-wrap items-end gap-2">
              <SegmentedControl
                aria-label={t('designs.page.lines', 'Lines')}
                value={lines > 1 ? 'several' : 'one'}
                onValueChange={(value) => {
                  const count = value === 'one' ? 1 : Math.max(2, lines);
                  change((d) => {
                    const next = patchRules(d, part.key, (r) => ({ ...r, lines: count }));
                    return box === null ? next : patchPart(next, part.key, { box: { ...box, h: textHeightMm(numberOf(rules['size'], 9), count) } });
                  });
                }}
                options={[
                  { value: 'one', label: t('designs.page.oneLine', 'One line') },
                  { value: 'several', label: t('designs.page.severalLines', 'Several lines') },
                ]}
              />
              {lines > 1 ? (
                <LiveNumber
                  label={t('designs.page.upToLines', 'Up to so many lines')}
                  whole
                  value={lines}
                  onNumber={(value) => {
                    const count = Math.floor(value);
                    if (count < 2 || count > 6) return;
                    change((d) => {
                      const next = patchRules(d, part.key, (r) => ({ ...r, lines: count }));
                      return box === null ? next : patchPart(next, part.key, { box: { ...box, h: textHeightMm(numberOf(rules['size'], 9), count) } });
                    }, `lines:${part.key}`);
                  }}
                />
              ) : null}
            </div>
          </>
        ) : null}
        {isPicture && open ? (
          <>
            <SegmentedControl aria-label={t('designs.page.pictureKind', 'Kind of picture')} value={rules['picture'] === 'photo' ? 'photo' : 'logo'} onValueChange={(value) => change((d) => patchRules(d, part.key, (r) => ({ ...r, picture: value, file: value === 'photo' ? 'photo_file' : 'logo_file' })))} options={[{ value: 'logo', label: t('designs.page.logo', 'Logo') }, { value: 'photo', label: t('designs.page.photo', 'Photo') }]} />
            <SegmentedControl aria-label={t('designs.page.fits', 'How it fits its box')} value={rules['fit'] === 'fill' ? 'fill' : 'inside'} onValueChange={(value) => rule((r) => ({ ...r, fit: value }))} options={[{ value: 'inside', label: t('designs.fit.inside', 'Fit inside') }, { value: 'fill', label: t('designs.fit.fill', 'Fill') }]} />
          </>
        ) : null}
        {canSwitch && open ? <Switch label={t('designs.required', 'Required')} checked={part.required} onCheckedChange={(checked) => change((d) => patchPart(d, part.key, { required: checked }))} /> : null}
        {canSwitch && !open ? <p className="m-0 text-[12px] leading-relaxed text-fg-subtle">{t('designs.page.lockedNote', 'Customers see this as it is. A padlock shows when they tap it.')}</p> : null}
      </div>
    </>
  );
}

/**
 * A number field that changes the part as it is typed, once what is typed is
 * a number, and shows what is typed meanwhile ("1." on the way to "1.5").
 */
function LiveNumber({ label, ariaLabel, value, unit, whole, negative, onNumber }: { label: string; ariaLabel?: string; value: number; unit?: string; whole?: boolean; negative?: boolean; onNumber: (value: number) => void }): ReactNode {
  const [typed, setTyped] = useState<string | null>(null);
  return (
    <NumberInput
      label={label}
      {...(ariaLabel === undefined ? {} : { 'aria-label': ariaLabel })}
      {...(unit === undefined ? {} : { unit })}
      {...(whole === true ? { whole: true } : { decimals: 1 })}
      {...(negative === true ? { negative: true } : {})}
      value={typed ?? mm(value)}
      onChange={(next) => {
        setTyped(next);
        if (next.trim() !== '' && Number.isFinite(Number(next))) onNumber(Number(next));
      }}
      onBlur={() => setTyped(null)}
    />
  );
}

function weightName(t: AddOnTranslate, weight: number): string {
  switch (weight) {
    case 500:
      return t('designs.weight.500', 'Medium');
    case 600:
      return t('designs.weight.600', 'Semibold');
    case 700:
      return t('designs.weight.700', 'Bold');
    case 800:
      return t('designs.weight.800', 'Extrabold');
    default:
      return t('designs.weight.400', 'Regular');
  }
}

/** One layer's row: the selected one in the accent. */
function Layer({ on, children }: { on: boolean; children: ReactNode }): ReactNode {
  if (on) return <li className="flex items-center gap-1 rounded-[10px] border border-accent bg-accent-soft px-1.5">{children}</li>;
  return <li className="flex items-center gap-1 rounded-[10px] border border-border bg-surface-2 px-1.5">{children}</li>;
}

function Layers({ t, visible, selected, change, onSelect, readOnly }: PagePanelProps): ReactNode {
  const id = useId();
  const top = [...visible].reverse();
  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3">
      <Heading id={id}>{t('designs.layers', 'Layers')}</Heading>
      {top.length === 0 ? <Figure>{t('designs.layers.none', 'Nothing on this side yet.')}</Figure> : null}
      <ul aria-labelledby={id} className="m-0 flex list-none flex-col gap-1 p-0">
        {top.map((part) => {
          const Icon = ICONS[part.kind];
          const on = part.key === selected?.key;
          return (
            <Layer key={part.key} on={on}>
              <span className="inline-flex text-fg-subtle" aria-hidden="true">
                <Icon />
              </span>
              <button type="button" aria-pressed={on} onClick={() => onSelect(part.key)} className="flex min-w-0 flex-1 py-1.5 text-start text-[12px] font-bold">
                {part.name}
              </button>
              {part.locked && part.rules['background'] !== true ? (
                <span className="inline-flex text-fg-subtle" role="img" aria-label={t('designs.locked', 'Locked')}>
                  <Lock />
                </span>
              ) : null}
              <IconButton label={t('designs.forward', 'Bring {name} forward', { name: part.name })} variant="ghost" disabled={readOnly} onClick={() => change((d) => zMoved(d, part.key, 1))}>
                <Up />
              </IconButton>
              <IconButton label={t('designs.backward', 'Send {name} back', { name: part.name })} variant="ghost" disabled={readOnly} onClick={() => change((d) => zMoved(d, part.key, -1))}>
                <Down />
              </IconButton>
            </Layer>
          );
        })}
      </ul>
    </div>
  );
}
