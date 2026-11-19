/**
 * ONE SECTION'S SETTINGS, kind by kind (comp 488-506, `States` 775-799).
 *
 * Every text is plain text, with its limit from the vocabulary. A link is
 * never typed into a text: a button goes to one of three typed places, an
 * https address, another landing page, or the form on this page. A picture is
 * the page's own copy, described or marked as decoration. A Form section
 * picks one of the live forms and shows where the form goes after sending,
 * which is the form's to change ("Edit this form →").
 *
 * A change here is a person's: it takes Milo's mark off the section
 * (`doc.ts` `update`).
 */
import {
  LANDING_COLUMNS_MAX,
  LANDING_COLUMNS_MIN,
  LANDING_FEATURE_ICONS,
  LANDING_FEATURES_MAX,
  LANDING_QUESTIONS_MAX,
  LANDING_TEXT_MAX,
  isLandingHref,
} from '@adminium/add-on-contracts/landing';
import type { ReactNode } from 'react';

import { Alert, Button, Field, Input, Link as RouteLink, Select, Textarea, type AddOnTranslate } from '../shared/host.ts';
import type { Block, BlockOf, Link, Picture } from './doc.ts';
import { formSpeaks, type LiveForm } from './engine.ts';
import { PictureField } from './PictureField.tsx';
import { languageName } from './row.ts';

/** Another page of the add-on, as a link may name it. */
export interface OtherPage {
  key: string;
  name: string;
  live: boolean;
}

export interface BlockFieldsProps {
  t: AddOnTranslate;
  pageKey: string;
  block: Block;
  language: string;
  mayEdit: boolean;
  hasForm: boolean;
  pages: readonly OtherPage[];
  forms: readonly LiveForm[];
  formsRead: boolean;
  onChange: (change: (block: Block) => Block, group?: string) => void;
}

/** A text field, one line or several. */
function Words({ label, hint, value, max, lines, mayEdit, onChange }: { label: string; hint?: string; value: string; max: number; lines?: number; mayEdit: boolean; onChange: (value: string) => void }): ReactNode {
  if (lines === undefined) return <Input label={label} {...(hint === undefined ? {} : { hint })} value={value} maxLength={max} disabled={!mayEdit} onChange={(event) => onChange(event.target.value)} />;
  return (
    <Field label={label} {...(hint === undefined ? {} : { hint })}>
      <Textarea value={value} rows={lines} maxLength={max} disabled={!mayEdit} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}

/** Where a button goes: an https address, another landing page, or the form on this page. */
function LinkField({ t, id, link, hasForm, pages, mayEdit, onChange }: { t: AddOnTranslate; id: string; link: Link; hasForm: boolean; pages: readonly OtherPage[]; mayEdit: boolean; onChange: (link: Link, group?: string) => void }): ReactNode {
  const href = link.kind === 'url' ? link.href : '';
  const wrong = link.kind === 'url' && href !== '' && !isLandingHref(href);
  return (
    <div data-lpe-fields="">
      <Select
        label={t('editor.link.goes', 'Where it goes')}
        value={link.kind}
        disabled={!mayEdit}
        options={[
          { value: 'form', label: t('editor.link.form', 'The form on this page'), disabled: !hasForm },
          { value: 'page', label: t('editor.link.page', 'Another landing page'), disabled: pages.length === 0 },
          { value: 'url', label: t('editor.link.url', 'An address on the web') },
        ]}
        onChange={(event) => {
          const kind = event.target.value;
          if (kind === 'form') onChange({ kind: 'form' });
          else if (kind === 'page') onChange({ kind: 'page', key: pages[0]?.key ?? '' });
          else onChange({ kind: 'url', href: '' });
        }}
      />
      {link.kind === 'url' ? (
        <Input
          label={t('editor.link.address', 'Address')}
          hint={t('editor.link.addressHint', 'The whole address, starting with https.')}
          {...(wrong ? { error: t('editor.link.addressWrong', 'Use a whole address that starts with https.') } : {})}
          value={href}
          dir="ltr"
          maxLength={LANDING_TEXT_MAX.href}
          disabled={!mayEdit}
          onChange={(event) => onChange({ kind: 'url', href: event.target.value.trim() }, `${id}:href`)}
        />
      ) : null}
      {link.kind === 'page' ? (
        <Select
          label={t('editor.link.whichPage', 'Page')}
          value={link.key}
          disabled={!mayEdit}
          options={pages.map((page) => ({ value: page.key, label: page.live ? page.name : t('editor.link.notLive', '{name} (not live yet)', { name: page.name }) }))}
          onChange={(event) => onChange({ kind: 'page', key: event.target.value })}
        />
      ) : null}
      {link.kind === 'form' && !hasForm ? <p data-lpe-alert="">{t('editor.link.noForm', 'This page has no form yet. Add a Form section, or choose another place.')}</p> : null}
    </div>
  );
}

/** A Form section: one of the live forms, and where it goes after sending (the form's own setting). */
function FormFields({ t, block, language, forms, formsRead, pages, mayEdit, onChange }: { t: AddOnTranslate; block: BlockOf<'form'>; language: string; forms: readonly LiveForm[]; formsRead: boolean; pages: readonly OtherPage[]; mayEdit: boolean; onChange: BlockFieldsProps['onChange'] }): ReactNode {
  const value = block.form === '' ? '' : `${block.addOn}:${block.form}`;
  const form = forms.find((one) => one.addOn === block.addOn && one.key === block.form);
  const ending = (() => {
    if (form === undefined) return null;
    if (form.ending.kind === 'page') return t('editor.form.endingUrl', 'Goes to {address}', { address: form.ending.url });
    if (form.ending.kind === 'landing') {
      const page = form.ending.page;
      const name = pages.find((one) => one.key === page)?.name ?? page;
      return form.ending.broken ? t('editor.form.endingBroken', 'Goes to the page “{name}”, which is not live: visitors see the form’s own thanks instead.', { name }) : t('editor.form.endingPage', 'Goes to the page “{name}”', { name });
    }
    return t('editor.form.endingWords', 'Shows the form’s own thank-you words');
  })();
  const missing = block.form !== '' && formsRead && form === undefined;
  return (
    <div data-lpe-fields="">
      <Select
        label={t('editor.form.which', 'Form')}
        value={value}
        disabled={!mayEdit}
        options={[{ value: '', label: t('editor.form.choose', 'Choose a form'), disabled: true }, ...forms.map((one) => ({ value: `${one.addOn}:${one.key}`, label: one.name }))]}
        onChange={(event) => {
          const picked = forms.find((one) => `${one.addOn}:${one.key}` === event.target.value);
          if (picked !== undefined) onChange((current) => ({ ...(current as BlockOf<'form'>), form: picked.key, addOn: picked.addOn }));
        }}
      />
      {formsRead && forms.length === 0 ? <p data-lpe-note="">{t('editor.form.noneLive', 'No form is live yet. Publish a form first, then pick it here.')}</p> : null}
      {missing ? <Alert tone="warn" role="status" title={t('editor.form.gone', 'This form is not live any more, so visitors don’t see it on the page.')} /> : null}
      {form !== undefined && !formSpeaks(form, language) ? (
        <Alert tone="warn" role="status" title={t('editor.form.noLanguage', 'This form has no {language} version, so visitors don’t see it on this page. Add {language} to the form.', { language: languageName(language) })} />
      ) : null}
      {ending === null ? null : (
        <div data-lpe-group="">
          <span data-lpe-micro="">{t('editor.form.after', 'After sending')}</span>
          <span className="text-[13px]">{ending}</span>
          {form === undefined ? null : <RouteLink to={`/add-ons/${form.addOn}/forms/${encodeURIComponent(form.slug)}`}>{t('editor.form.edit', 'Edit this form →')}</RouteLink>}
        </div>
      )}
    </div>
  );
}

export function BlockFields({ t, pageKey, block, language, mayEdit, hasForm, pages, forms, formsRead, onChange }: BlockFieldsProps): ReactNode {
  const id = block.id;
  /** Change one field of this section; typing into it is one step of Undo. */
  const set = <B extends Block>(field: string, patch: (current: B) => B): void => onChange((current) => patch(current as B), `${id}:${field}`);
  const picture = (value: Picture | undefined, then: (next: Picture | undefined) => Block, group?: string): void => onChange(() => then(value), group);

  switch (block.kind) {
    case 'hero':
      return (
        <div data-lpe-fields="">
          <Words label={t('editor.field.heading', 'Heading')} value={block.heading} max={LANDING_TEXT_MAX.heading} mayEdit={mayEdit} onChange={(value) => set<BlockOf<'hero'>>('heading', (b) => ({ ...b, heading: value }))} />
          <Words label={t('editor.field.text', 'Text')} hint={t('editor.field.paragraphs', 'A blank line starts a new paragraph.')} value={block.text} max={LANDING_TEXT_MAX.short} lines={4} mayEdit={mayEdit} onChange={(value) => set<BlockOf<'hero'>>('text', (b) => ({ ...b, text: value }))} />
          {block.button === undefined ? (
            mayEdit ? (
              <Button variant="secondary" size="sm" onClick={() => onChange((b) => ({ ...(b as BlockOf<'hero'>), button: { label: '', link: hasForm ? { kind: 'form' } : { kind: 'url', href: '' } } }))}>
                {t('editor.hero.addButton', 'Add a button')}
              </Button>
            ) : null
          ) : (
            <div data-lpe-group="">
              <Words label={t('editor.field.label', 'Button words')} value={block.button.label} max={LANDING_TEXT_MAX.label} mayEdit={mayEdit} onChange={(value) => set<BlockOf<'hero'>>('label', (b) => ({ ...b, ...(b.button === undefined ? {} : { button: { ...b.button, label: value } }) }))} />
              <LinkField t={t} id={`${id}-link`} link={block.button.link} hasForm={hasForm} pages={pages} mayEdit={mayEdit} onChange={(link, group) => onChange((b) => { const hero = b as BlockOf<'hero'>; return hero.button === undefined ? hero : { ...hero, button: { ...hero.button, link } }; }, group)} />
              {mayEdit ? (
                <Button variant="ghost" size="sm" onClick={() => onChange((b) => { const { button: _button, ...rest } = b as BlockOf<'hero'>; return rest; })}>
                  {t('editor.hero.removeButton', 'Remove the button')}
                </Button>
              ) : null}
            </div>
          )}
          <PictureField t={t} pageKey={pageKey} id={`${id}-picture`} label={t('editor.field.picture', 'Picture')} value={block.picture} mayEdit={mayEdit} removable onChange={(next, group) => picture(next, () => { const { picture: _picture, ...rest } = block; return next === undefined ? rest : { ...rest, picture: next }; }, group)} />
          {block.picture === undefined && mayEdit ? <p data-lpe-note="">{t('editor.hero.pictureNote', 'Choose a picture to show beside the words, or leave it out.')}</p> : null}
        </div>
      );
    case 'heading':
      return <Words label={t('editor.field.heading', 'Heading')} value={block.text} max={LANDING_TEXT_MAX.heading} mayEdit={mayEdit} onChange={(value) => set<BlockOf<'heading'>>('text', (b) => ({ ...b, text: value }))} />;
    case 'text':
      return <Words label={t('editor.field.text', 'Text')} hint={t('editor.field.paragraphs', 'A blank line starts a new paragraph.')} value={block.text} max={LANDING_TEXT_MAX.long} lines={8} mayEdit={mayEdit} onChange={(value) => set<BlockOf<'text'>>('text', (b) => ({ ...b, text: value }))} />;
    case 'picture':
      return <PictureField t={t} pageKey={pageKey} id={`${id}-picture`} label={t('editor.field.picture', 'Picture')} value={block.picture} mayEdit={mayEdit} onChange={(next, group) => picture(next, () => ({ ...block, picture: next ?? { file: '', alt: '' } }), group)} />;
    case 'button':
      return (
        <div data-lpe-fields="">
          <Words label={t('editor.field.label', 'Button words')} value={block.label} max={LANDING_TEXT_MAX.label} mayEdit={mayEdit} onChange={(value) => set<BlockOf<'button'>>('label', (b) => ({ ...b, label: value }))} />
          <LinkField t={t} id={`${id}-link`} link={block.link} hasForm={hasForm} pages={pages} mayEdit={mayEdit} onChange={(link, group) => onChange((b) => ({ ...(b as BlockOf<'button'>), link }), group)} />
        </div>
      );
    case 'columns':
      return (
        <div data-lpe-fields="">
          <Select
            label={t('editor.columns.count', 'How many columns')}
            value={String(block.columns.length)}
            disabled={!mayEdit}
            options={Array.from({ length: LANDING_COLUMNS_MAX - LANDING_COLUMNS_MIN + 1 }, (_, index) => String(LANDING_COLUMNS_MIN + index)).map((count) => ({ value: count, label: count }))}
            onChange={(event) => {
              const count = Number(event.target.value);
              onChange((b) => {
                const columns = (b as BlockOf<'columns'>).columns.slice(0, count);
                while (columns.length < count) columns.push({ text: '' });
                return { ...(b as BlockOf<'columns'>), columns };
              });
            }}
          />
          {block.columns.map((column, index) => (
            <div key={String(index)} data-lpe-group="">
              <span data-lpe-micro="">{t('editor.columns.one', 'Column {n}', { n: index + 1 })}</span>
              <Words
                label={t('editor.columns.heading', 'Heading (if you like)')}
                value={column.heading ?? ''}
                max={LANDING_TEXT_MAX.heading}
                mayEdit={mayEdit}
                onChange={(value) =>
                  set<BlockOf<'columns'>>(`c${String(index)}-heading`, (b) => ({
                    ...b,
                    columns: b.columns.map((one, at) => {
                      if (at !== index) return one;
                      const { heading: _heading, ...rest } = one;
                      return value === '' ? rest : { ...rest, heading: value };
                    }),
                  }))
                }
              />
              <Words label={t('editor.field.text', 'Text')} value={column.text} max={LANDING_TEXT_MAX.medium} lines={4} mayEdit={mayEdit} onChange={(value) => set<BlockOf<'columns'>>(`c${String(index)}-text`, (b) => ({ ...b, columns: b.columns.map((one, at) => (at === index ? { ...one, text: value } : one)) }))} />
              <PictureField
                t={t}
                pageKey={pageKey}
                id={`${id}-c${String(index)}-picture`}
                label={t('editor.field.picture', 'Picture')}
                value={column.picture}
                mayEdit={mayEdit}
                removable
                onChange={(next, group) =>
                  onChange(
                    (b) => ({
                      ...(b as BlockOf<'columns'>),
                      columns: (b as BlockOf<'columns'>).columns.map((one, at) => {
                        if (at !== index) return one;
                        const { picture: _picture, ...rest } = one;
                        return next === undefined ? rest : { ...rest, picture: next };
                      }),
                    }),
                    group,
                  )
                }
              />
            </div>
          ))}
        </div>
      );
    case 'features':
      return (
        <div data-lpe-fields="">
          <Words
            label={t('editor.features.title', 'Title (if you like)')}
            value={block.title ?? ''}
            max={LANDING_TEXT_MAX.heading}
            mayEdit={mayEdit}
            onChange={(value) =>
              set<BlockOf<'features'>>('title', (b) => {
                const { title: _title, ...rest } = b;
                return value === '' ? rest : { ...rest, title: value };
              })
            }
          />
          {block.items.map((item, index) => (
            <div key={String(index)} data-lpe-group="">
              <span data-lpe-micro="">{t('editor.features.point', 'Point {n}', { n: index + 1 })}</span>
              <Select
                label={t('editor.features.icon', 'Icon')}
                value={item.icon ?? ''}
                disabled={!mayEdit}
                options={[{ value: '', label: t('editor.features.noIcon', 'No icon') }, ...LANDING_FEATURE_ICONS.map((icon) => ({ value: icon, label: icon.replace(/-/g, ' ') }))]}
                onChange={(event) => {
                  const icon = event.target.value;
                  onChange((b) => ({
                    ...(b as BlockOf<'features'>),
                    items: (b as BlockOf<'features'>).items.map((one, at) => {
                      if (at !== index) return one;
                      const { icon: _icon, ...rest } = one;
                      return icon === '' ? rest : { ...rest, icon: icon as (typeof LANDING_FEATURE_ICONS)[number] };
                    }),
                  }));
                }}
              />
              <Words label={t('editor.field.heading', 'Heading')} value={item.heading} max={LANDING_TEXT_MAX.heading} mayEdit={mayEdit} onChange={(value) => set<BlockOf<'features'>>(`f${String(index)}-heading`, (b) => ({ ...b, items: b.items.map((one, at) => (at === index ? { ...one, heading: value } : one)) }))} />
              <Words label={t('editor.field.text', 'Text')} value={item.text} max={LANDING_TEXT_MAX.short} lines={2} mayEdit={mayEdit} onChange={(value) => set<BlockOf<'features'>>(`f${String(index)}-text`, (b) => ({ ...b, items: b.items.map((one, at) => (at === index ? { ...one, text: value } : one)) }))} />
              {mayEdit && block.items.length > 1 ? (
                <Button variant="ghost" size="sm" onClick={() => onChange((b) => ({ ...(b as BlockOf<'features'>), items: (b as BlockOf<'features'>).items.filter((_, at) => at !== index) }))}>
                  {t('editor.features.remove', 'Remove point {n}', { n: index + 1 })}
                </Button>
              ) : null}
            </div>
          ))}
          {mayEdit && block.items.length < LANDING_FEATURES_MAX ? (
            <Button variant="secondary" size="sm" onClick={() => onChange((b) => ({ ...(b as BlockOf<'features'>), items: [...(b as BlockOf<'features'>).items, { heading: '', text: '' }] }))}>
              {t('editor.features.add', 'Add a point')}
            </Button>
          ) : null}
        </div>
      );
    case 'quote':
      return (
        <div data-lpe-fields="">
          <Words label={t('editor.quote.words', 'Words')} value={block.text} max={LANDING_TEXT_MAX.short} lines={4} mayEdit={mayEdit} onChange={(value) => set<BlockOf<'quote'>>('text', (b) => ({ ...b, text: value }))} />
          <Words label={t('editor.field.who', 'Who said it')} value={block.who} max={LANDING_TEXT_MAX.heading} mayEdit={mayEdit} onChange={(value) => set<BlockOf<'quote'>>('who', (b) => ({ ...b, who: value }))} />
          <p data-lpe-note="">{t('editor.quote.note', 'Use a customer’s own words, with their leave.')}</p>
        </div>
      );
    case 'questions':
      return (
        <div data-lpe-fields="">
          <Words label={t('editor.field.title', 'Title')} value={block.title} max={LANDING_TEXT_MAX.heading} mayEdit={mayEdit} onChange={(value) => set<BlockOf<'questions'>>('title', (b) => ({ ...b, title: value }))} />
          {block.items.map((item, index) => (
            <div key={String(index)} data-lpe-group="">
              <Words label={t('editor.questions.question', 'Question {n}', { n: index + 1 })} value={item.question} max={LANDING_TEXT_MAX.question} mayEdit={mayEdit} onChange={(value) => set<BlockOf<'questions'>>(`q${String(index)}`, (b) => ({ ...b, items: b.items.map((one, at) => (at === index ? { ...one, question: value } : one)) }))} />
              <Words label={t('editor.field.answer', 'Answer')} value={item.answer} max={LANDING_TEXT_MAX.medium} lines={3} mayEdit={mayEdit} onChange={(value) => set<BlockOf<'questions'>>(`a${String(index)}`, (b) => ({ ...b, items: b.items.map((one, at) => (at === index ? { ...one, answer: value } : one)) }))} />
              {mayEdit && block.items.length > 1 ? (
                <Button variant="ghost" size="sm" onClick={() => onChange((b) => ({ ...(b as BlockOf<'questions'>), items: (b as BlockOf<'questions'>).items.filter((_, at) => at !== index) }))}>
                  {t('editor.questions.remove', 'Remove question {n}', { n: index + 1 })}
                </Button>
              ) : null}
            </div>
          ))}
          {mayEdit && block.items.length < LANDING_QUESTIONS_MAX ? (
            <Button variant="secondary" size="sm" onClick={() => onChange((b) => ({ ...(b as BlockOf<'questions'>), items: [...(b as BlockOf<'questions'>).items, { question: '', answer: '' }] }))}>
              {t('editor.questions.add', 'Add a question')}
            </Button>
          ) : null}
        </div>
      );
    case 'spacer':
      return (
        <Select
          label={t('editor.spacer.size', 'Size')}
          value={block.size}
          disabled={!mayEdit}
          options={[
            { value: 's', label: t('editor.spacer.s', 'Small') },
            { value: 'm', label: t('editor.spacer.m', 'Medium') },
            { value: 'l', label: t('editor.spacer.l', 'Large') },
          ]}
          onChange={(event) => onChange((b) => ({ ...(b as BlockOf<'spacer'>), size: event.target.value as 's' | 'm' | 'l' }))}
        />
      );
    case 'form':
      return <FormFields t={t} block={block} language={language} forms={forms} formsRead={formsRead} pages={pages} mayEdit={mayEdit} onChange={onChange} />;
  }
}
