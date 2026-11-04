/**
 * THE MAKER'S LOOK: one row a part, in the design's order, in the "Make it
 * yours" card (Birch Row, Customise).
 *
 * Words: the label, "Needed" or "Optional", the counter (amber with 3 left,
 * red over), the field, the over-limit box with "Shorten it" and, where
 * smaller letters fit more, "Make it smaller"; the fonts as chips drawn in
 * their own face; the letter size stepper with its range; the finishes.
 * A logo: its price, the drop zone and "Upload your logo" (the checks of the
 * file itself are the upload's own, beside this). A part that takes words or
 * a logo and is still empty: "Add words" or "Add your logo". A motif or a
 * colour: chips. A part only the shop sets: its value, and "Set by the
 * studio" shown when it is pointed at or reached.
 */
import { FileImage, ImageUp, Lock, LockKeyhole, Minus, Plus, Ruler, Trash2, Type, Upload as UploadIcon } from 'lucide-react';
import { useState } from 'react';

import { sizeAllowed, type PartValue } from '../../rules/index.ts';
import { mm, pt } from '../i18n.ts';
import { areaMode, valueOf, type EditPart } from '../model.ts';
import { useShared } from './context.tsx';
import { CheckIcon, fieldId, fullness, Swatch, usePicker, type FieldsProps } from './fieldKit.tsx';
import { fontClass } from './fonts.ts';

/** The next size a stepper goes to: half a millimetre at 10 mm or under, a millimetre above, or the next of a list. */
function stepped(part: EditPart, size: number, up: boolean): number | null {
  const rules = part.text!;
  if (rules.sizes !== null) {
    const list = [...new Set([rules.size, ...rules.sizes])].sort((a, b) => a - b);
    const next = up ? list.find((one) => one > size + 1e-6) : [...list].reverse().find((one) => one < size - 1e-6);
    return next ?? null;
  }
  if (rules.min === null && rules.max === null) return null;
  const step = size <= 10 ? 0.5 : 1;
  const next = Math.round((up ? size + step : size - step) * 10) / 10;
  const bounded = up ? Math.min(rules.max ?? next, next) : Math.max(rules.min ?? next, next);
  return Math.abs(bounded - size) < 1e-6 || !sizeAllowed(rules, bounded) ? null : bounded;
}

export function MakerFields(props: FieldsProps) {
  const { t } = useShared();
  const editable = props.parts.filter((part) => !part.locked && part.kind !== 'shape');
  return (
    <>
      {props.parts
        .filter((part) => part.kind !== 'shape' || part.fixed !== '')
        .map((part) => (
          <div key={part.code} className={props.selected === part.code ? 'cz-row cz-row-on' : 'cz-row'} onFocus={() => props.onSelect(part.code)}>
            <Row {...props} part={part} />
          </div>
        ))}
      {editable.length === 0 ? <p className="cz-row cz-small">{t('editor.fields.nothing', 'Nothing on this design is yours to change.')}</p> : null}
    </>
  );
}

function Row(props: FieldsProps & { part: EditPart }) {
  const { part, values } = props;
  if (part.locked) return <LockedRow part={part} />;
  if (part.kind === 'text') {
    const mode = areaMode(values, part);
    const either = part.text?.alsoLogo !== null && part.text?.alsoLogo !== undefined;
    if (either && mode === null && !part.required) return <EitherRow {...props} />;
    if (mode === 'logo') return <LogoRow {...props} either />;
    return <TextRow {...props} either={either || part.fromArea} />;
  }
  if (part.kind === 'picture') return <LogoRow {...props} either={false} />;
  if (part.kind === 'colour' || part.kind === 'choice') return <ChoiceRow {...props} />;
  return null;
}

function TextRow({ part, values, checks, tried, setPart, onTyping, catalogue, either }: FieldsProps & { part: EditPart; either: boolean }) {
  const { t, locale } = useShared();
  const rules = part.text!;
  const value = valueOf(values, part);
  const id = fieldId(part.code);
  const mine = checks.filter((one) => one.part === part.code);
  const over = mine.find((one) => one.kind === 'too-long');
  const missing = tried ? mine.find((one) => one.kind === 'required-empty') : undefined;
  const others = mine.filter((one) => one !== over && one.kind !== 'required-empty');
  const { count, limit, state } = fullness(part, value);
  const size = value.size ?? rules.size;
  const unitWord = (at: number) => (rules.unit === 'pt' ? pt(at, locale) : mm(at, locale));
  const fonts = rules.fonts ?? (rules.font === null ? [] : [rules.font]);
  const finishes = rules.finishes ?? [];
  const down = stepped(part, size, false);
  const up = stepped(part, size, true);
  const set = (patch: PartValue): void => setPart(part.code, { ...value, ...patch, ...(either ? { mode: 'words' as const } : {}) });
  const range = rules.sizes !== null ? [...new Set([rules.size, ...rules.sizes])].sort((a, b) => a - b) : null;
  const hint = range !== null ? range.map(unitWord).join(' · ') : rules.min !== null && rules.max !== null ? `${String(rules.min)}–${unitWord(rules.max)}` : null;
  const describedBy = [`${id}-count`, over === undefined ? '' : `${id}-fix`, missing === undefined ? '' : `${id}-err`, ...others.map((_, i) => `${id}-m${String(i)}`)].filter((one) => one !== '').join(' ');
  return (
    <>
      <div className="cz-row-head">
        <label htmlFor={id} className="cz-label">
          {either ? t('editor.fields.yourWords', '{part} — your words', { part: part.name }) : part.name}
        </label>
        <span className="cz-req">{part.required ? t('editor.fields.needed', 'Needed') : t('editor.fields.optional', 'Optional')}</span>
        <span id={`${id}-count`} aria-live="polite" className={`cz-mono cz-counter cz-counter-${state}`}>
          {t('editor.fields.counter', '{count} / {limit}', { count, limit })}
        </span>
      </div>
      <input
        id={id}
        className={over !== undefined || missing !== undefined ? 'cz-input cz-input-bad' : 'cz-input'}
        value={value.text ?? ''}
        placeholder={part.placeholder}
        autoComplete="off"
        aria-invalid={over !== undefined || missing !== undefined}
        aria-describedby={describedBy}
        onChange={(event) => set({ text: event.target.value })}
        onFocus={() => onTyping(true)}
        onBlur={() => onTyping(false)}
      />
      {missing === undefined ? null : (
        <span id={`${id}-err`} className="cz-error">
          <CheckIcon icon="alert" />
          {missing.inline}
        </span>
      )}
      {over === undefined ? null : (
        <div id={`${id}-fix`} role="alert" className="cz-fixbox">
          <span className="cz-fixbox-text">
            <Ruler aria-hidden="true" />
            {over.inline}
          </span>
          <div className="cz-fixbox-actions">
            {over.fixes.map((fix) => (
              <button key={fix.label} type="button" className="cz-fix" onClick={() => setPart(part.code, fix.value)}>
                {fix.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {others.map((one, i) => (
        <span key={i} id={`${id}-m${String(i)}`} className={one.block ? 'cz-error' : 'cz-advice'}>
          <CheckIcon icon={one.icon} />
          {one.inline}
          {one.fixes.map((fix) => (
            <button key={fix.label} type="button" className="cz-link" onClick={() => setPart(part.code, fix.value)}>
              {fix.label}
            </button>
          ))}
        </span>
      ))}
      {fonts.length > 1 ? (
        <div role="radiogroup" aria-label={t('editor.fields.fontFor', 'Font for {part}', { part: part.name })} className="cz-chips">
          {fonts.map((family) => {
            const on = (value.font ?? rules.font) === family;
            const font = catalogue.fonts.find((one) => one.family === family);
            return (
              <button key={family} type="button" role="radio" aria-checked={on} className={`cz-chip cz-font-chip ${fontClass(family)}${on ? ' cz-on' : ''}`} onClick={() => set({ font: family })}>
                {font?.name ?? family}
              </button>
            );
          })}
        </div>
      ) : null}
      {down !== null || up !== null ? (
        <div className="cz-size-line">
          <div role="group" aria-label={t('editor.fields.sizeFor', 'Letter size for {part}', { part: part.name })} className="cz-stepper">
            <button type="button" aria-label={t('editor.fields.smaller', 'Smaller letters')} aria-disabled={down === null} onClick={() => down !== null && set({ size: down })}>
              <Minus aria-hidden="true" />
            </button>
            <span aria-live="polite" className="cz-mono cz-stepper-value">
              {unitWord(size)}
            </span>
            <button type="button" aria-label={t('editor.fields.bigger', 'Bigger letters')} aria-disabled={up === null} onClick={() => up !== null && set({ size: up })}>
              <Plus aria-hidden="true" />
            </button>
          </div>
          {hint === null ? null : <span className="cz-mono cz-hint">{hint}</span>}
          {either && !part.required ? (
            <button type="button" className="cz-quiet cz-push" onClick={() => setPart(part.code, null)}>
              {t('editor.fields.leaveEmpty', 'Leave it empty')}
            </button>
          ) : null}
        </div>
      ) : either && !part.required ? (
        <button type="button" className="cz-quiet cz-push" onClick={() => setPart(part.code, null)}>
          {t('editor.fields.leaveEmpty', 'Leave it empty')}
        </button>
      ) : null}
      {finishes.length > 0 ? (
        <div role="radiogroup" aria-label={t('editor.fields.finishFor', 'Finish for {part}', { part: part.name })} className="cz-chips">
          {finishes.map((code) => {
            const finish = catalogue.finishes[code];
            const on = (value.finish ?? values.finish ?? rules.finish ?? finishes[0]) === code;
            return (
              <button key={code} type="button" role="radio" aria-checked={on} className={on ? 'cz-chip cz-chip-round cz-on' : 'cz-chip cz-chip-round'} onClick={() => set({ finish: code })}>
                <Swatch hex={finish?.hex ?? '#888888'} />
                {finish?.name ?? code}
              </button>
            );
          })}
        </div>
      ) : null}
    </>
  );
}

function LogoRow({ part, values, featurePrices, uploads, upload, setPart, checks, either }: FieldsProps & { part: EditPart; either: boolean }) {
  const { t } = useShared();
  const rules = part.picture ?? part.text?.alsoLogo ?? null;
  const column = rules?.file ?? 'logo_file';
  const value = valueOf(values, part);
  const id = fieldId(part.code);
  const have = value.file !== undefined ? uploads[column] : undefined;
  const picker = usePicker(part, column, upload);
  const price = part.feature === null ? undefined : featurePrices[part.feature];
  const mine = checks.filter((one) => one.part === part.code);
  const photo = rules?.picture === 'photo';
  return (
    <>
      <div className="cz-row-head">
        <span className="cz-label">{either ? t('editor.fields.yourLogo', '{part} — your logo', { part: part.name }) : part.name}</span>
        {price === undefined ? null : <span className="cz-mono cz-price">{price}</span>}
        {either && !part.required ? (
          <button type="button" className="cz-quiet cz-push" onClick={() => setPart(part.code, null)}>
            {t('editor.fields.leaveEmpty', 'Leave it empty')}
          </button>
        ) : null}
      </div>
      {picker.element}
      {value.file === undefined ? (
        <div className="cz-drop">
          <span className="cz-tile">
            <ImageUp aria-hidden="true" />
          </span>
          <span className="cz-drop-text">
            <span className="cz-strong">{photo ? t('editor.fields.dropPhoto', 'Drop your photo here') : t('editor.fields.dropLogo', 'Drop your logo here')}</span>
            <span className="cz-small">{t('editor.fields.logoKinds', 'SVG, PDF, PNG or JPEG, up to {size}', { size: '10 MB' })}</span>
          </span>
          <button id={id} type="button" className="cz-primary" aria-describedby={picker.failed ? `${id}-err` : undefined} aria-busy={picker.busy} onClick={picker.pick}>
            <UploadIcon aria-hidden="true" />
            {photo ? t('editor.fields.uploadPhoto', 'Upload your photo') : t('editor.fields.uploadLogo', 'Upload your logo')}
          </button>
        </div>
      ) : (
        <div className="cz-file">
          <span className="cz-tile">
            <FileImage aria-hidden="true" />
          </span>
          <span className="cz-file-text">
            <span className="cz-mono cz-strong">{have?.name ?? t('editor.fields.kept', 'Kept with your design')}</span>
            {have === undefined ? null : <span className="cz-mono cz-small">{`${have.kind.toUpperCase()} · ${String(Math.max(1, Math.round(have.size / 1024)))} KB`}</span>}
          </span>
          <button id={id} type="button" className="cz-button" onClick={picker.pick}>
            {t('editor.fields.replace', 'Replace')}
          </button>
          <button
            type="button"
            className="cz-icon-button"
            aria-label={photo ? t('editor.fields.removePhoto', 'Remove your photo') : t('editor.fields.removeLogo', 'Remove your logo')}
            onClick={() => {
              const { file: _file, ...rest } = value;
              void _file;
              setPart(part.code, either ? { ...rest, mode: 'logo' } : Object.keys(rest).length === 0 ? null : rest);
            }}
          >
            <Trash2 aria-hidden="true" />
          </button>
        </div>
      )}
      {picker.failed ? (
        <span id={`${id}-err`} role="alert" className="cz-error">
          <CheckIcon icon="alert" />
          {picker.failedText}
        </span>
      ) : null}
      {mine.map((one, i) => (
        <span key={i} className={one.block ? 'cz-error' : 'cz-advice'}>
          <CheckIcon icon={one.icon} />
          {one.inline}
        </span>
      ))}
      <span className="cz-private">
        <LockKeyhole aria-hidden="true" />
        {t('editor.fields.privateMaker', 'Your logo is private. Only you and the studio can see it.')}
      </span>
    </>
  );
}

function EitherRow({ part, setPart, featurePrices }: FieldsProps & { part: EditPart }) {
  const { t } = useShared();
  const price = part.feature === null ? undefined : featurePrices[part.feature];
  return (
    <>
      <div className="cz-row-head">
        <span className="cz-label">{part.name}</span>
        <span className="cz-req">{t('editor.fields.optional', 'Optional')}</span>
      </div>
      <p className="cz-small">{t('editor.fields.either', 'Leave it plain, or put your own words or logo here.')}</p>
      <div className="cz-chips">
        <button id={fieldId(part.code)} type="button" className="cz-button" onClick={() => setPart(part.code, { mode: 'words', text: '' })}>
          <Type aria-hidden="true" />
          {t('editor.fields.addWords', 'Add words')}
        </button>
        <button type="button" className="cz-button" onClick={() => setPart(part.code, { mode: 'logo' })}>
          <ImageUp aria-hidden="true" />
          {t('editor.fields.addLogo', 'Add your logo')}
          {price === undefined ? null : <span className="cz-mono cz-price">{price}</span>}
        </button>
      </div>
    </>
  );
}

function ChoiceRow({ part, values, setPart, catalogue }: FieldsProps & { part: EditPart }) {
  const value = valueOf(values, part);
  const labelId = `${fieldId(part.code)}-label`;
  const colours = part.kind === 'colour' ? (part.palette === null ? Object.values(catalogue.shared).flat() : (catalogue.shared[part.palette] ?? [])) : [];
  const current = value.choice ?? part.start?.choice;
  return (
    <>
      <span id={labelId} className="cz-label">
        {part.name}
      </span>
      <div role="radiogroup" aria-labelledby={labelId} className="cz-chips">
        {part.choices.map((code) => {
          const colour = colours.find((one) => one.code === code);
          const on = current === code;
          return (
            <button key={code} id={on ? fieldId(part.code) : undefined} type="button" role="radio" aria-checked={on} className={on ? 'cz-chip cz-chip-tall cz-on' : 'cz-chip cz-chip-tall'} onClick={() => setPart(part.code, { ...value, choice: code })}>
              {colour === undefined ? null : <Swatch hex={colour.hex} />}
              {colour?.name ?? choiceName(code)}
            </button>
          );
        })}
      </div>
    </>
  );
}

/** A motif's code as words, until the shop names its motifs: "book-open" → "Book open". */
export const choiceName = (code: string): string => {
  const words = code.replace(/[-_]+/g, ' ').trim();
  return words.charAt(0).toLocaleUpperCase() + words.slice(1);
};

function LockedRow({ part }: { part: EditPart }) {
  const { t } = useShared();
  const [shown, setShown] = useState(false);
  const value = part.kind === 'text' ? `“${part.fixed}”` : part.fixed !== '' ? part.fixed : choiceName(part.start?.choice ?? '');
  return (
    <div
      id={fieldId(part.code)}
      tabIndex={0}
      className="cz-locked"
      aria-label={t('editor.fields.lockedAria', '{part}, set by the studio: {value}', { part: part.name, value })}
      onMouseEnter={() => setShown(true)}
      onMouseLeave={() => setShown(false)}
      onFocus={() => setShown(true)}
      onBlur={() => setShown(false)}
    >
      <span className="cz-locked-text">
        <span className="cz-label cz-muted">{part.name}</span>
        <span className="cz-small">{value}</span>
      </span>
      <span className={shown ? 'cz-locked-tag cz-shown' : 'cz-locked-tag'}>
        <Lock aria-hidden="true" />
        {t('editor.fields.setByStudio', 'Set by the studio')}
      </span>
    </div>
  );
}
