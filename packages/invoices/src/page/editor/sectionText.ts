// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Every label the editor prints for a section, an optional block, a custom
 * type or a seeded row (the comp's `insMeta` 1565, `optionalSecs()`
 * 1257-1265, `customDefs()` 1266-1272, `newCustom` 1274-1281, `addItem`
 * 1356, `addCustomRow` 1315), in one place so the canvas, the inspector and
 * the Add-section modal never disagree.
 *
 * Every string is an `invoices:` key with the comp's English as its inline
 * fallback — byte-identical to `locales/en-US/invoices.json` (the deferred
 * namespace gate, `i18n/invoicesNamespace.test.ts`). Three of them are the
 * lexicon's, not the comp's (34 Appendix D.2): *Invoice to* for the comp's
 * column label, *Charge schedule* for the recurring hint, and the two custom
 * hints re-worded so the built bytes pass the substring sweep.
 */
import { t } from '../messages.js';
import type { CustomSectionType } from '../model/envelope.js';
import type { CustomSeed } from '../model/ops.js';
import { CUSTOM_SECTION_ICON, SECTION_ICONS, isCustomKey, type FixedSectionKey, type OptionalFlag, type SectionKey } from '../model/blocks.js';

export interface SectionHeader {
  icon: string;
  title: string;
  hint: string;
}

/** The comp's `insMeta` (1565) for a fixed section. */
export function fixedSectionHeader(section: FixedSectionKey): SectionHeader {
  const icon = SECTION_ICONS[section];
  switch (section) {
    case 'branding':
      return { icon, title: t('section.branding.title', 'Branding'), hint: t('section.branding.hint', 'Logo & brand name') };
    case 'theme':
      return { icon, title: t('section.theme.title', 'Title & theme'), hint: t('section.theme.hint', 'Colour, currency, status') };
    case 'from':
      return { icon, title: t('section.from.title', 'From'), hint: t('section.from.hint', 'Your company details') };
    case 'customer':
      return { icon, title: t('section.customer.title', 'Invoice to'), hint: t('section.customer.hint', 'Client details') };
    case 'meta':
      return { icon, title: t('section.meta.title', 'Invoice details'), hint: t('section.meta.hint', 'Number, dates, PO & terms') };
    case 'items':
      return { icon, title: t('section.items.title', 'Line items'), hint: t('section.items.hint', 'Products & services') };
    case 'tax':
      return { icon, title: t('section.tax.title', 'Tax & totals'), hint: t('section.tax.hint', 'Rates & discounts') };
    case 'payment':
      return { icon, title: t('section.payment.title', 'Payment'), hint: t('section.payment.hint', 'How to pay') };
    case 'notes':
      return { icon, title: t('section.notes.title', 'Notes'), hint: t('section.notes.hint', 'Footer text') };
    case 'shipto':
      return { icon, title: t('section.shipto.title', 'Ship to'), hint: t('section.shipto.hint', 'Delivery address') };
    case 'signature':
      return { icon, title: t('section.signature.title', 'Signature'), hint: t('section.signature.hint', 'Authorised sign-off') };
    case 'terms':
      return { icon, title: t('section.terms.title', 'Terms'), hint: t('section.terms.hint', 'Acceptance checkbox') };
    case 'attachments':
      return { icon, title: t('section.attachments.title', 'Attachments'), hint: t('section.attachments.hint', 'Attached files') };
    case 'approval':
      return { icon, title: t('section.approval.title', 'Approval'), hint: t('section.approval.hint', 'Sign-off status') };
    case 'qr':
      return { icon, title: t('section.qr.title', 'Payment QR'), hint: t('section.qr.hint', 'Scan-to-pay code') };
    case 'latefees':
      return { icon, title: t('section.latefees.title', 'Late fees'), hint: t('section.latefees.hint', 'Overdue penalty') };
    case 'poterms':
      return { icon, title: t('section.poterms.title', 'PO terms'), hint: t('section.poterms.hint', 'Purchase order terms') };
    case 'multicurrency':
      return { icon, title: t('section.multicurrency.title', 'Multi-currency'), hint: t('section.multicurrency.hint', 'Totals in other currencies') };
    case 'recurring':
      return { icon, title: t('section.recurring.title', 'Recurring'), hint: t('section.recurring.hint', 'Charge schedule') };
    case 'discount':
      return { icon, title: t('section.discount.title', 'Discount codes'), hint: t('section.discount.hint', 'Applied promo codes') };
    case 'taxbreak':
      return { icon, title: t('section.taxbreak.title', 'Tax breakdown'), hint: t('section.taxbreak.hint', 'Tax components') };
    case 'payhistory':
      return { icon, title: t('section.payhistory.title', 'Payment history'), hint: t('section.payhistory.hint', 'Past payments') };
    case 'legal':
      return { icon, title: t('section.legal.title', 'Legal footer'), hint: t('section.legal.hint', 'Fine print') };
    case 'refund':
      return { icon, title: t('section.refund.title', 'Refund policy'), hint: t('section.refund.hint', 'Returns & refunds') };
    case 'contact':
      return { icon, title: t('section.contact.title', 'Contact'), hint: t('section.contact.hint', 'Support details') };
    case 'loyalty':
      return { icon, title: t('section.loyalty.title', 'Loyalty points'), hint: t('section.loyalty.hint', 'Rewards balance') };
    case 'delivery':
      return { icon, title: t('section.delivery.title', 'Delivery timeline'), hint: t('section.delivery.hint', 'Fulfilment status') };
    case 'images':
      return { icon, title: t('section.images.title', 'Images'), hint: t('section.images.hint', 'Logo, background, QR & photos') };
  }
}

/** The header for any selection: a custom section shows its own title (comp 1565's `cus:` branch). */
export function sectionHeader(section: SectionKey, customTitle: string | null): SectionHeader {
  if (isCustomKey(section)) {
    return {
      icon: CUSTOM_SECTION_ICON,
      title: customTitle === null || customTitle === '' ? t('section.custom.title', 'Custom section') : customTitle,
      hint: t('section.custom.hint', 'Your own section'),
    };
  }
  return fixedSectionHeader(section);
}

/** The Add-section modal's chip labels (comp `optionalSecs()`, 1258-1263). */
export function optionalSectionLabel(flag: OptionalFlag): string {
  switch (flag) {
    case 'shipShow':
      return t('optional.shipShow', 'Ship to');
    case 'sigShow':
      return t('optional.sigShow', 'Signature');
    case 'termsShow':
      return t('optional.termsShow', 'Terms acceptance');
    case 'attachShow':
      return t('optional.attachShow', 'Attachments');
    case 'approvalShow':
      return t('optional.approvalShow', 'Approval');
    case 'qrShow':
      return t('optional.qrShow', 'Payment QR');
    case 'lateShow':
      return t('optional.lateShow', 'Late fees');
    case 'poShow':
      return t('optional.poShow', 'PO terms');
    case 'mcShow':
      return t('optional.mcShow', 'Multi-currency');
    case 'recurShow':
      return t('optional.recurShow', 'Recurring');
    case 'discShow':
      return t('optional.discShow', 'Discount codes');
    case 'taxbShow':
      return t('optional.taxbShow', 'Tax breakdown');
    case 'payhShow':
      return t('optional.payhShow', 'Payment history');
    case 'legalShow':
      return t('optional.legalShow', 'Legal footer');
    case 'refShow':
      return t('optional.refShow', 'Refund policy');
    case 'conShow':
      return t('optional.conShow', 'Contact');
    case 'loyShow':
      return t('optional.loyShow', 'Loyalty points');
    case 'delShow':
      return t('optional.delShow', 'Delivery timeline');
  }
}

/** The modal's *Build your own* tiles (comp `customDefs()`, 1268-1271; two hints re-worded per 34 Appendix D.2). */
export function customTypeText(type: CustomSectionType): { label: string; hint: string } {
  switch (type) {
    case 'text':
      return { label: t('custom.text.label', 'Text section'), hint: t('custom.text.hint', 'Your own copy — notes, scope, conditions') };
    case 'image':
      return { label: t('custom.image.label', 'Image block'), hint: t('custom.image.hint', 'Upload a photo, drawing or certificate') };
    case 'kv':
      return { label: t('custom.kv.label', 'Detail rows'), hint: t('custom.kv.hint', 'Label / value pairs') };
    case 'gallery':
      return { label: t('custom.gallery.label', 'Image row'), hint: t('custom.gallery.hint', 'Two or three images side by side') };
  }
}

/** What a new custom section starts with (comp `newCustom`, 1277-1280), in the viewer's language. */
export function customSeed(): CustomSeed {
  return {
    text: {
      title: t('seed.text.title', 'Additional notes'),
      body: t('seed.text.body', 'Add your own copy here — scope, delivery notes, conditions or a message to the client.'),
    },
    image: { title: t('seed.image.title', 'Image'), caption: t('seed.image.caption', 'Add a caption') },
    kv: {
      title: t('seed.kv.title', 'Reference details'),
      rows: [
        { k: t('seed.kv.row1k', 'Cost centre'), v: 'CC-4410' },
        { k: t('seed.kv.row2k', 'Contract'), v: 'MSA-2026-08' },
      ],
    },
    gallery: { title: t('seed.gallery.title', 'Images') },
  };
}

/** `addCustomRow`'s seed (comp 1315). */
export function customRowSeed(): { k: string; v: string } {
  return { k: t('seed.kv.label', 'Label'), v: t('seed.kv.value', 'Value') };
}

/** `addItem`'s seed description (comp 1356). */
export function newItemDescription(): string {
  return t('seed.item', 'New item');
}
