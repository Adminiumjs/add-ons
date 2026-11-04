/**
 * THE PRINT LOOK: the fields grouped by side, then the layout, the colours
 * and the line that a person checks every design (Marlow Press, Fill in).
 *
 * Words: the label, "needed", the counter, the field (a box of several lines
 * where the part takes them), the checks under it with their fixes, and the
 * part's font, size and colour behind a summary ("Manrope · 13 pt · Ink")
 * that opens them. A logo or a photo: its kinds and size, the drop zone,
 * "Upload your logo", and who sees it.
 */
import { ChevronDown, ChevronUp, FlipHorizontal2, ImageUp, LayoutPanelLeft, Lock, Palette as PaletteIcon, RectangleHorizontal, Trash2, Type, Upload as UploadIcon, UserCheck } from 'lucide-react';
import { useState } from 'react';

import { pt } from '../i18n.ts';
import { hexOf, valueOf, type EditPart, type Ready } from '../catalogue.ts';
import { useShared } from './context.tsx';
import { acceptOf, CheckIcon, fieldId, fileMeta, fullness, Swatch, TransferBar, usePicker, WarnIcon, type FieldsProps } from './fieldKit.tsx';
import { CAP_WORDS } from './pictures.ts';

/** What a browser may fill a field with, by the part's code, where the code says what it is. */
const AUTOCOMPLETE: Readonly<Record<string, string>> = { name: 'name', title: 'organization-title', phone: 'tel', email: 'email', web: 'url', addr: 'street-address' };

export function PrintFields(props: FieldsProps & { ready: Ready | null; sides: number }) {
  const { t } = useShared();
  const { ready, values, setDesign, palette } = props;
  const groups = (['front', 'back'] as const)
    .filter((side) => side === 'front' || props.sides >= 2)
    .map((side) => ({ side, parts: props.parts.filter((part) => part.side === side && !part.locked && part.kind !== 'shape') }))
    .filter((group) => group.parts.length > 0);
  return (
    <div className="cz-groups">
      {groups.map((group) => (
        <div key={group.side} role="group" aria-labelledby={`cz-g-${group.side}`} className="cz-group">
          <h2 id={`cz-g-${group.side}`} className="cz-group-title">
            {group.side === 'front' ? <RectangleHorizontal aria-hidden="true" /> : <FlipHorizontal2 aria-hidden="true" />}
            {group.side === 'front' ? t('editor.side.front', 'Front') : t('editor.side.back', 'Back')}
          </h2>
          <div className="cz-group-fields">
            {group.parts.map((part) => (part.kind === 'picture' ? <ImageField key={part.code} {...props} part={part} /> : part.kind === 'text' ? <TextField key={part.code} {...props} part={part} /> : null))}
          </div>
        </div>
      ))}
      {ready !== null && ready.layouts.length > 1 ? (
        <div className="cz-group">
          <h2 id="cz-layouts" className="cz-group-title">
            <LayoutPanelLeft aria-hidden="true" />
            {t('editor.fields.layout', 'Layout')}
          </h2>
          <div role="radiogroup" aria-labelledby="cz-layouts" className="cz-chips">
            {ready.layouts.map((layout) => {
              const on = (values.layout ?? ready.layouts[0]?.key) === layout.key;
              return (
                <button key={layout.key} type="button" role="radio" aria-checked={on} className={on ? 'cz-chip cz-chip-tall cz-on' : 'cz-chip cz-chip-tall'} onClick={() => setDesign({ layout: layout.key })}>
                  {layout.name}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      {ready !== null && ready.palettes.length > 0 ? (
        <div className="cz-group">
          <h2 id="cz-palettes" className="cz-group-title">
            <PaletteIcon aria-hidden="true" />
            {t('editor.fields.colours', 'Colours')}
          </h2>
          <p className="cz-small">{t('editor.fields.coloursSub', 'Changes every part that uses them, on both sides.')}</p>
          <div role="radiogroup" aria-labelledby="cz-palettes" className="cz-chips">
            {ready.palettes.map((one) => {
              const on = palette?.code === one.code;
              return (
                <button key={one.code} type="button" role="radio" aria-checked={on} className={on ? 'cz-chip cz-chip-tall cz-on' : 'cz-chip cz-chip-tall'} onClick={() => setDesign({ palette: one.code })}>
                  <svg className="cz-palette-swatch" width="32" height="22" viewBox="0 0 32 22" aria-hidden="true">
                    <rect x="0" y="0" width="14" height="22" fill={hexOf(one, 'paper') ?? '#ffffff'} />
                    <rect x="14" y="0" width="9" height="22" fill={hexOf(one, 'ink') ?? '#000000'} />
                    <rect x="23" y="0" width="9" height="22" fill={hexOf(one, 'accent') ?? '#888888'} />
                  </svg>
                  {one.name}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      <p className="cz-person">
        <UserCheck aria-hidden="true" />
        {t('editor.fields.person', 'A person checks every design before we send your proof.')}
      </p>
    </div>
  );
}

function TextField({ part, values, checks, setPart, onSelect, onTyping, catalogue, palette }: FieldsProps & { part: EditPart }) {
  const { t, locale } = useShared();
  const [open, setOpen] = useState(false);
  const rules = part.text!;
  const value = valueOf(values, part);
  const id = fieldId(part.code);
  const mine = checks.filter((one) => one.part === part.code);
  const blocking = mine.some((one) => one.block);
  const { count, limit, state } = fullness(part, value);
  const fonts = rules.fonts ?? (rules.font === null ? [] : [rules.font]);
  const sizes = rules.sizes === null ? [] : [...new Set([rules.size, ...rules.sizes])].sort((a, b) => a - b);
  const colours = rules.colours ?? [];
  const font = value.font ?? rules.font ?? '';
  const size = value.size ?? rules.size;
  const colour = value.colour ?? rules.colour ?? 'ink';
  const roleName = (role: string): string => palette?.colours.find((one) => one.role === role || one.code === role)?.name ?? role;
  const set = (patch: Record<string, unknown>): void => setPart(part.code, { ...value, ...patch });
  const describedBy = [`${id}-count`, ...mine.map((_, i) => `${id}-m${String(i)}`)].join(' ');
  const common = {
    id,
    className: blocking ? 'cz-input cz-input-bad' : mine.length > 0 ? 'cz-input cz-input-warn' : 'cz-input',
    value: value.text ?? '',
    placeholder: part.placeholder,
    'aria-invalid': blocking,
    'aria-describedby': describedBy,
    onFocus: () => {
      onSelect(part.code);
      onTyping(true);
    },
    onBlur: () => onTyping(false),
  };
  return (
    <div className="cz-field">
      <div className="cz-row-head">
        <label htmlFor={id} className="cz-label">
          {part.name}
        </label>
        {part.required ? <span className="cz-req">{t('editor.fields.neededLower', 'needed')}</span> : null}
        <span id={`${id}-count`} className={`cz-mono cz-counter cz-counter-${state}`} aria-label={t('editor.fields.counterAria', '{count} of {limit} characters', { count, limit })}>
          {t('editor.fields.counter', '{count} / {limit}', { count, limit })}
        </span>
      </div>
      {rules.lines > 1 ? <textarea {...common} rows={rules.lines} onChange={(event) => set({ text: event.target.value })} /> : <input {...common} autoComplete={AUTOCOMPLETE[part.code] ?? 'off'} onChange={(event) => set({ text: event.target.value })} />}
      <div aria-live="polite" className="cz-messages">
        {mine.map((one, i) => (
          <div key={i} id={`${id}-m${String(i)}`} className={one.block ? 'cz-error' : 'cz-advice'}>
            {one.block ? <CheckIcon icon={one.icon} /> : one.icon === 'contrast' ? <CheckIcon icon="contrast" /> : <WarnIcon aria-hidden="true" />}
            <span>
              {one.inline}{' '}
              {one.fixes
                .filter((fix) => one.kind !== 'too-long' || fix.label !== t('editor.fix.shorten', 'Shorten it'))
                .map((fix) => (
                  <button key={fix.label} type="button" className="cz-link" onClick={() => setPart(part.code, fix.value)}>
                    {fix.label}
                  </button>
                ))}
            </span>
          </div>
        ))}
      </div>
      {fonts.length > 1 || sizes.length > 1 || colours.length > 1 ? (
        <>
          <button type="button" className="cz-quiet cz-style-toggle" aria-expanded={open} aria-controls={`${id}-style`} onClick={() => setOpen(!open)}>
            <Type aria-hidden="true" />
            {[catalogue.fonts.find((one) => one.family === font)?.name ?? font, pt(size, locale), roleName(colour)].filter((one) => one !== '').join(' · ')}
            {open ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
          </button>
          {open ? (
            <div id={`${id}-style`} className="cz-style">
              {fonts.length > 1 ? (
                <label className="cz-style-item">
                  <span className="cz-style-label">{t('editor.fields.font', 'Font')}</span>
                  <select className="cz-select" value={font} onChange={(event) => set({ font: event.target.value })}>
                    {fonts.map((family) => (
                      <option key={family} value={family}>
                        {catalogue.fonts.find((one) => one.family === family)?.name ?? family}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {sizes.length > 1 ? (
                <label className="cz-style-item">
                  <span className="cz-style-label">{t('editor.fields.size', 'Size')}</span>
                  <select className="cz-select cz-mono" value={String(size)} onChange={(event) => set({ size: Number(event.target.value) })}>
                    {sizes.map((one) => (
                      <option key={one} value={String(one)}>
                        {pt(one, locale)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {colours.length > 1 ? (
                <div className="cz-style-item">
                  <span id={`${id}-colour`} className="cz-style-label">
                    {t('editor.fields.colour', 'Colour')}
                  </span>
                  <div role="radiogroup" aria-labelledby={`${id}-colour`} className="cz-chips">
                    {colours.map((role) => (
                      <button key={role} type="button" role="radio" aria-checked={colour === role} aria-label={roleName(role)} title={roleName(role)} className={colour === role ? 'cz-swatch-button cz-on' : 'cz-swatch-button'} onClick={() => set({ colour: role })}>
                        <Swatch hex={hexOf(palette, role) ?? '#000000'} size={24} />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function ImageField({ part, values, pictures, transfers, problems, upload, setPart, checks, onSelect }: FieldsProps & { part: EditPart }) {
  const { t, shop } = useShared();
  const rules = part.picture!;
  const value = valueOf(values, part);
  const id = fieldId(part.code);
  const held = value.file !== undefined ? pictures[rules.file] : undefined;
  const transfer = transfers[rules.file];
  const problem = problems[rules.file];
  const picker = usePicker(part, rules.file, upload);
  const photo = rules.picture === 'photo';
  const mine = checks.filter((one) => one.part === part.code);
  const errId = `${id}-err`;
  const describedBy = [...(problem === undefined ? [] : [errId]), ...mine.map((_, i) => `${id}-m${String(i)}`)].join(' ');
  const fit = value.fit ?? rules.fit;
  return (
    <div className="cz-field">
      <div className="cz-row-head">
        <span className="cz-label">{part.name}</span>
        {part.required ? <span className="cz-req">{t('editor.fields.neededLower', 'needed')}</span> : null}
        <span className="cz-mono cz-hint cz-push">{`${acceptOf(part).map((one) => one.toUpperCase()).join(' · ')} · ${CAP_WORDS}`}</span>
      </div>
      {picker.element}
      {transfer !== undefined ? (
        <TransferBar transfer={transfer} label={photo ? t('editor.upload.sendingPhoto', 'Uploading your photo') : t('editor.upload.sendingLogo', 'Uploading your logo')} />
      ) : value.file === undefined ? (
        <div className={picker.over ? 'cz-drop cz-drop-centre cz-drop-over' : 'cz-drop cz-drop-centre'} {...picker.drop}>
          <ImageUp aria-hidden="true" />
          <span className="cz-small">{photo ? t('editor.fields.dropPhoto', 'Drop your photo here') : t('editor.fields.dropLogo', 'Drop your logo here')}</span>
          <button id={id} type="button" className="cz-primary" aria-describedby={describedBy === '' ? undefined : describedBy} onFocus={() => onSelect(part.code)} onClick={picker.pick}>
            <UploadIcon aria-hidden="true" />
            {photo ? t('editor.fields.uploadPhoto', 'Upload your photo') : t('editor.fields.uploadLogo', 'Upload your logo')}
          </button>
        </div>
      ) : (
        <>
          <div className="cz-file cz-file-print">
            <span className="cz-thumb">{held?.url === undefined ? <span className="cz-mono cz-thumb-kind">{held === undefined ? '' : held.kind.toUpperCase()}</span> : <img src={held.url} alt="" className="cz-thumb-img" />}</span>
            <span className="cz-file-text">
              <span className="cz-mono cz-strong cz-ellipsis">{held === undefined || held.name === '' ? t('editor.fields.kept', 'Kept with your design') : held.name}</span>
              {held === undefined ? null : <span className="cz-mono cz-small">{fileMeta(held, true)}</span>}
            </span>
            <button id={id} type="button" className="cz-button cz-button-small" aria-describedby={describedBy === '' ? undefined : describedBy} onFocus={() => onSelect(part.code)} onClick={picker.pick}>
              {t('editor.fields.replace', 'Replace')}
            </button>
            <button
              type="button"
              className="cz-icon-button"
              aria-label={photo ? t('editor.fields.removePhotoPrint', 'Remove the photo') : t('editor.fields.removeLogoPrint', 'Remove the logo')}
              title={photo ? t('editor.fields.removePhotoPrint', 'Remove the photo') : t('editor.fields.removeLogoPrint', 'Remove the logo')}
              onClick={() => {
                const { file: _file, ...rest } = value;
                void _file;
                setPart(part.code, Object.keys(rest).length === 0 ? null : rest);
              }}
            >
              <Trash2 aria-hidden="true" />
            </button>
          </div>
          <div role="radiogroup" aria-label={photo ? t('editor.fields.fitPhotoAria', 'How the photo sits in its box') : t('editor.logo.fitAria', 'How the logo sits in its box')} className="cz-seg cz-seg-start">
            {(['inside', 'fill'] as const).map((one) => (
              <button key={one} type="button" role="radio" aria-checked={fit === one} className={fit === one ? 'cz-on' : ''} onClick={() => setPart(part.code, { ...value, fit: one })}>
                {one === 'inside' ? t('editor.logo.fitInside', 'Fit inside') : t('editor.logo.fill', 'Fill')}
              </button>
            ))}
          </div>
        </>
      )}
      {problem === undefined ? null : (
        <div id={errId} role="alert" className="cz-error">
          <CheckIcon icon="alert" />
          <span>
            {problem.text}
            {problem.detail === undefined ? null : (
              <span lang="en" className="cz-detail">
                {problem.detail}
              </span>
            )}
          </span>
        </div>
      )}
      {mine.map((one, i) => (
        <div key={i} id={`${id}-m${String(i)}`} className={one.block ? 'cz-error' : 'cz-advice'}>
          <CheckIcon icon={one.icon} />
          <span>
            {one.inline}
            {one.detail === undefined ? null : <span className="cz-mono cz-detail">{one.detail}</span>}
          </span>
        </div>
      ))}
      <p className="cz-private">
        <Lock aria-hidden="true" />
        {photo ? t('editor.fields.privatePhoto', 'Only you and {shop} can see your photo.', { shop }) : t('editor.fields.privateLogo', 'Only you and {shop} can see your logo.', { shop })}
      </p>
    </div>
  );
}
