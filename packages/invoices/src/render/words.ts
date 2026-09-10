/**
 * The words a DRAWN document uses — "Subtotal", "Total", "Issued on" — in all
 * eight compiled locales.
 *
 * ── THREE DIFFERENT KINDS OF STRING LIVE IN THREE DIFFERENT PLACES, AND ────
 * ── CONFLATING THEM IS THE MISTAKE THIS HEADER EXISTS TO PREVENT ───────────
 *
 *   1. `i18n/strings.ts` — this add-on's UI copy: the settings panel, the
 *      record button, the toasts. Read through the HOST's `t()`, inside this
 *      add-on's own bundle, in the VIEWER's locale.
 *   2. `kinds.ts` — the outline's slot labels. Read by ADMINIUM, in Studio's
 *      profile editor, where this bundle is not loaded and that `t()` does not
 *      exist — which is why a provider carries them itself (34 D14).
 *   3. THIS FILE — the chrome printed ON the document. Not the viewer's
 *      language and not the operator's: the DOCUMENT's. An Arabic invoice read
 *      by an English-speaking accountant is still an Arabic invoice.
 *
 * ── WHAT IS NOT HERE: THE AUTHORED CONTENT ─────────────────────────────────
 *
 * The document's title, terms and notes are AUTHORED, and the surface carries
 * its own six document languages for them (34 D49 — en, de, fr, es, pt, ja,
 * with the comp's dictionaries verbatim). Those live in the body and arrive
 * already in the language the author chose. This file never touches them.
 *
 * That is also why a document language outside these eight is not a hole:
 * `wordsFor` falls back by language subtag and then to English, so a `ja`
 * document prints Japanese content under English chrome rather than under a
 * row of missing keys. Recorded rather than discovered — a Japanese chrome
 * set is a translation, not a code change.
 */

import type { LayoutWords } from './layout.ts';

const WORDS: Readonly<Record<string, LayoutWords>> = {
  'en-US': {
    from: 'From',
    to: 'Made out to',
    issued: 'Issued on',
    due: 'Settle by',
    reference: 'Their reference',
    corrects: 'Corrects document',
    description: 'What it is',
    quantity: 'How many',
    unit: 'Each',
    amount: 'Amount',
    subtotal: 'Subtotal',
    reduction: 'Reduction',
    tax: 'Tax',
    gratuity: 'Gratuity',
    total: 'Total',
    settledWith: 'Settled with',
    terms: 'Terms',
    notes: 'Notes',
    payment: 'How to settle',
  },
  'de-DE': {
    from: 'Von',
    to: 'Ausgestellt an',
    issued: 'Ausgestellt am',
    due: 'Zu zahlen bis',
    reference: 'Ihre Referenz',
    corrects: 'Berichtigt Beleg',
    description: 'Beschreibung',
    quantity: 'Menge',
    unit: 'Einzelbetrag',
    amount: 'Betrag',
    subtotal: 'Zwischensumme',
    reduction: 'Nachlass',
    tax: 'Steuer',
    gratuity: 'Trinkgeld',
    total: 'Gesamt',
    settledWith: 'Beglichen mit',
    terms: 'Bedingungen',
    notes: 'Hinweise',
    payment: 'Zahlungsweg',
  },
  'fr-FR': {
    from: 'De',
    to: 'Établi à l’ordre de',
    issued: 'Établi le',
    due: 'À régler avant le',
    reference: 'Votre référence',
    corrects: 'Rectifie le document',
    description: 'Désignation',
    quantity: 'Quantité',
    unit: 'Montant unitaire',
    amount: 'Montant',
    subtotal: 'Sous-total',
    reduction: 'Remise',
    tax: 'Taxe',
    gratuity: 'Pourboire',
    total: 'Total',
    settledWith: 'Réglé par',
    terms: 'Conditions',
    notes: 'Notes',
    payment: 'Modalités de règlement',
  },
  'cs-CZ': {
    from: 'Od',
    to: 'Vystaveno na',
    issued: 'Vystaveno dne',
    due: 'Uhradit do',
    reference: 'Vaše značka',
    corrects: 'Opravuje doklad',
    description: 'Popis',
    quantity: 'Množství',
    unit: 'Za jednotku',
    amount: 'Částka',
    subtotal: 'Mezisoučet',
    reduction: 'Sleva',
    tax: 'Daň',
    gratuity: 'Dýško',
    total: 'Celkem',
    settledWith: 'Uhrazeno čím',
    terms: 'Podmínky',
    notes: 'Poznámky',
    payment: 'Jak uhradit',
  },
  'da-DK': {
    from: 'Fra',
    to: 'Udstedt til',
    issued: 'Udstedt den',
    due: 'Betales senest',
    reference: 'Jeres reference',
    corrects: 'Retter bilag',
    description: 'Beskrivelse',
    quantity: 'Antal',
    unit: 'Pr. enhed',
    amount: 'Beløb',
    subtotal: 'Subtotal',
    reduction: 'Rabat',
    tax: 'Afgift',
    gratuity: 'Drikkepenge',
    total: 'I alt',
    settledWith: 'Betalt med',
    terms: 'Vilkår',
    notes: 'Noter',
    payment: 'Sådan betales der',
  },
  'zh-CN': {
    from: '开具方',
    to: '抬头',
    issued: '开具日期',
    due: '付款期限',
    reference: '对方参考号',
    corrects: '更正单据',
    description: '内容',
    quantity: '数量',
    unit: '单价',
    amount: '金额',
    subtotal: '小计',
    reduction: '折让',
    tax: '税',
    gratuity: '小费',
    total: '合计',
    settledWith: '结算方式',
    terms: '条款',
    notes: '备注',
    payment: '结算办法',
  },
  'zh-TW': {
    from: '開立方',
    to: '抬頭',
    issued: '開立日期',
    due: '付款期限',
    reference: '對方參考號',
    corrects: '更正單據',
    description: '內容',
    quantity: '數量',
    unit: '單價',
    amount: '金額',
    subtotal: '小計',
    reduction: '折讓',
    tax: '稅',
    gratuity: '小費',
    total: '合計',
    settledWith: '結算方式',
    terms: '條款',
    notes: '備註',
    payment: '結算辦法',
  },
  'ar-EG': {
    from: 'من',
    to: 'صادر إلى',
    issued: 'تاريخ الإصدار',
    due: 'السداد قبل',
    reference: 'مرجعهم',
    corrects: 'يصحّح المستند',
    description: 'الوصف',
    quantity: 'الكمية',
    unit: 'للوحدة',
    amount: 'المبلغ',
    subtotal: 'المجموع الفرعي',
    reduction: 'الخصم',
    tax: 'الضريبة',
    gratuity: 'إكرامية',
    total: 'الإجمالي',
    settledWith: 'تمت التسوية بـ',
    terms: 'الشروط',
    notes: 'ملاحظات',
    payment: 'طريقة السداد',
  },
};

/** The locales whose script runs right to left. */
const RTL = new Set(['ar']);

export const LOCALES: readonly string[] = Object.keys(WORDS);

/**
 * The chrome for a document language.
 *
 * Exact tag, then the language subtag, then English. `zh-HK` gets the
 * traditional set because `zh` matches `zh-CN` first — so the subtag pass
 * prefers a REGION-matched entry before falling back to the first of the
 * language, which is why the two Chinese entries are not interchangeable.
 */
export function wordsFor(locale: string): LayoutWords {
  const exact = WORDS[locale];
  if (exact !== undefined) return exact;

  const language = locale.split(/[-_]/)[0]?.toLowerCase() ?? 'en';
  if (language === 'zh') return WORDS[locale.toLowerCase().includes('tw') || locale.toLowerCase().includes('hant') || locale.toLowerCase().includes('hk') ? 'zh-TW' : 'zh-CN']!;
  const sameLanguage = LOCALES.find((tag) => tag.split('-')[0] === language);
  return WORDS[sameLanguage ?? 'en-US']!;
}

/** Whether a document in this language is drawn right to left. */
export function isRtl(locale: string): boolean {
  return RTL.has(locale.split(/[-_]/)[0]?.toLowerCase() ?? '');
}
