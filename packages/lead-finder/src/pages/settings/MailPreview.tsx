/**
 * THE MAIL A FOUND PERSON IS SENT, AS A PREVIEW (comp 3h).
 *
 * "Service mail": sent as soon as Lead finder keeps someone's details, in the
 * language of their company's country (or the install's, or English, as the
 * purpose is written). What it says, in order: the add-on's own opening (its
 * template, editable in Email templates), then Adminium's fixed sentences
 * (where the details came from and when, why they are kept, the basis, for
 * how long counted from the day they were found, their rights, the privacy
 * notice), then, set apart, "Don't want us to keep your details?" and Object.
 *
 * The sentences here follow the engine's own (its tell mail's words), filled
 * with this install's purpose and keeping time and a made-up person; the
 * business's name, address and privacy contact are the ones set in Server settings,
 * shown here as what they stand for. It is shown in the reader's language.
 */
import { useMemo, useState, type ReactNode } from 'react';

import { Link, useLocaleTag, useRecords, type AddOnTranslate } from '../shared/host.ts';
import { longDay } from '../shared/dates.ts';
import { Icon, Pill } from '../shared/parts.tsx';
import { peopleSettingsAt } from '../shared/paths.ts';
import { purposeOf } from './PeopleCard.tsx';

export function MailPreview({ t }: { t: AddOnTranslate }): ReactNode {
  const locale = useLocaleTag();
  const settings = useRecords('settings', { pageSize: 1 });
  const row = settings.rows[0] ?? null;
  const purpose = useMemo(() => purposeOf(row?.['purpose']), [row]);
  // Shown in the reader's language, with the purpose as written in it (else in English).
  const shownIn = (purpose[locale] ?? '').trim() !== '' ? locale : 'en-US';
  const years = Number(row?.['keep_years'] ?? 3);
  const [today] = useState(() => Date.now());
  const day = longDay(today, locale);

  return (
    <div className="flex flex-col gap-3.5">
      <Link to={peopleSettingsAt()}>
        <span className="inline-flex items-center gap-1.5 text-[12.5px] font-bold">
          <span className="rtl:-scale-x-100">
            <Icon name="arrow-left" />
          </span>
          {t('mail.back', 'Back to People')}
        </span>
      </Link>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
        <Pill tone="info" icon="mail">
          {t('mail.service', 'Service mail')}
        </Pill>
        <span className="text-[12.5px] text-fg-muted">{t('mail.when', 'A preview. Lead finder sends this as soon as it keeps someone’s details, in the language of their company’s country.')}</span>
      </div>
      <dl className="m-0 flex flex-col gap-1.5 rounded-[10px] border border-border bg-surface px-4 py-3.5 text-[12.5px]">
        <div className="flex gap-3">
          <dt className="w-24 font-semibold text-fg-subtle">{t('mail.to', 'To')}</dt>
          <dd className="m-0 font-mono text-[12px]">petra.lindqvist@cobaltlegal.example</dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-24 font-semibold text-fg-subtle">{t('mail.subjectLabel', 'Subject')}</dt>
          <dd className="m-0 font-bold">{t('mail.subject', 'Why we have your details')}</dd>
        </div>
      </dl>
      <article className="flex flex-col gap-3.5 rounded-[14px] border border-border bg-surface p-5 text-[14px] leading-normal shadow-sm">
        <h2 className="m-0 text-[18px] font-extrabold tracking-[-0.02em]">{t('mail.subject', 'Why we have your details')}</h2>
        <p className="m-0">{t('mail.hello', 'Hello {name},', { name: 'Petra' })}</p>
        <p className="m-0">{t('mail.opening', 'We keep your name, your role and your work e-mail address, as someone at {company}.', { company: 'Cobalt Legal' })}</p>
        <p className="m-0">{t('mail.source', '{source} found your work address on {date}.', { source: 'Hunter (hunter.io)', date: day })}</p>
        <p className="m-0">{t('mail.why', 'Why we keep them: {purpose}', { purpose: (purpose[shownIn] ?? '').trim() === '' ? t('mail.noPurpose', '(not written yet)') : purpose[shownIn]! })}</p>
        <p className="m-0">{t('mail.basis', 'We rely on our legitimate interest in this (GDPR Article 6(1)(f)).')}</p>
        <p className="m-0">{t('mail.keep', '{years, plural, one {We keep your details for # year from {date}, or from the last time you write to us.} other {We keep your details for # years from {date}, or from the last time you write to us.}}', { years, date: day })}</p>
        <p className="m-0">{t('mail.rights', 'You can ask to see, correct or delete your details, to limit what we do with them, to object to our keeping them, or to get a copy of them. You can also complain to the authority for data privacy where you live.')}</p>
        <p className="m-0">{t('mail.notice', 'Our privacy notice: {url}', { url: t('mail.noticeStands', '(the address set in Server settings → Privacy & public pages)') })}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-[10px] border border-border-strong px-5 py-4">
          <span className="min-w-0 flex-1 basis-64 font-bold">{t('mail.objectAsk', 'Don’t want us to keep your details?')}</span>
          <span className="inline-flex h-10 items-center rounded-[10px] border border-border-strong bg-surface px-4 text-[13px] font-bold">{t('mail.object', 'Object')}</span>
        </div>
        <p className="m-0 border-t border-border pt-3.5 text-[12px] text-fg-muted">{t('mail.footer', 'Questions? Write to {contact}. {who}.', { contact: t('mail.contactStands', '(your privacy contact)'), who: t('mail.whoStands', '(your business name and address)') })}</p>
      </article>
    </div>
  );
}
