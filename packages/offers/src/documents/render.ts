/**
 * DRAWING A CARD.
 *
 * One page of HTML with its own few styles, drawn from the subject alone: the
 * same subject gives the same bytes, whoever asks and whenever. The code is
 * drawn in groups of four, always left to right; its QR code holds the code
 * as it is stored, which is what a scanner at the counter looks up.
 *
 * A first print shows the amount the card was loaded with. Any later print
 * shows what is on it and the day it was printed: a card in a drawer says
 * when its figure was true.
 */
import type { DocumentQrValue, DocumentSubject } from '@adminium/add-on-contracts';

import { isCard, isStrip } from './kinds.ts';
import { RTL, localeOf, say } from './words.ts';

const escape = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const text = (value: unknown): string => (value === null || value === undefined ? '' : String(value)).trim();

/**
 * A code as a person reads it: its two letters, then fours. A card's code is
 * kept with its letters, a voucher's without. Twelve characters are a whole
 * code with no letters before it, even where they begin as the word does;
 * any other length that begins with the word has the word on it — an older
 * card brought in from a till is kept as `GC-` and eight characters.
 */
export function groupedCode(stored: string, word: string): string {
  const bare = stored.replace(/[\s-]/g, '').toUpperCase();
  const body = bare.startsWith(word) && bare.length !== 12 ? bare.slice(word.length) : bare;
  return [word, ...(body.match(/.{1,4}/g) ?? [])].join('-');
}

/**
 * An amount as the language writes it. A money slot arrives in the currency's
 * smallest unit, a whole number (1900 is $19.00); a voucher's value is a
 * plain figure as it is kept (`5.000`).
 */
function money(value: unknown, subject: DocumentSubject, locale: string, minor: boolean): string {
  const amount = Number(text(value));
  if (text(value) === '' || !Number.isFinite(amount)) return '';
  // Adminium's own count of a currency's decimals, never the language data's: the two differ for a few currencies,
  // and a figure divided by the wrong one is out by a hundred.
  const scale = currencyScale(subject.currency);
  const format = new Intl.NumberFormat(locale, { style: 'currency', currency: subject.currency, minimumFractionDigits: scale, maximumFractionDigits: scale });
  return format.format(minor ? amount / 10 ** scale : amount);
}

/** The decimals a currency's smallest unit stands for, as Adminium counts them when it hands money over (ISO 4217). */
const NO_DECIMALS = new Set(['BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW', 'PYG', 'RWF', 'UGX', 'UYI', 'VND', 'VUV', 'XAF', 'XOF', 'XPF']);
const THREE_DECIMALS = new Set(['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND']);
export function currencyScale(code: string): number {
  const upper = code.toUpperCase();
  return NO_DECIMALS.has(upper) ? 0 : THREE_DECIMALS.has(upper) ? 3 : 2;
}

/** A day as the language writes it. A bare day is that day; a moment is the day it was on the venue's clock. */
function day(value: unknown, subject: DocumentSubject, locale: string): string {
  const read = text(value);
  if (!/^\d{4}-\d{2}-\d{2}/.test(read)) return '';
  const bare = read.length === 10;
  const moment = new Date(bare ? `${read}T12:00:00Z` : read);
  if (Number.isNaN(moment.getTime())) return '';
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric', timeZone: bare ? 'UTC' : subject.now.timezone }).format(moment);
}

const plain = (value: unknown): string => {
  const read = text(value);
  return /^-?\d+\.\d+$/.test(read) ? read.replace(/0+$/, '').replace(/\.$/, '') : read;
};

export interface Drawn {
  html: string;
  /** Every piece of text on the page, for a writer that must know what it draws. */
  words: string[];
}

export function draw(kind: string, subject: DocumentSubject): Drawn {
  const locale = localeOf(subject.locale);
  const fields = subject.fields;
  const card = isCard(kind);
  const worth = text(fields['worth']);
  const word = card ? 'GC' : worth === 'pack' ? 'PK' : 'VC';
  const code = groupedCode(text(fields['code']), word);
  const qr = fields['qr'] as DocumentQrValue | undefined;
  const printed = day(fields['printedAt'] ?? subject.now.iso, subject, locale);
  const useBy = day(fields['useBy'], subject, locale);

  const title = card ? say('giftCard', locale) : text(fields['name']) || say(worth === 'pack' ? 'pack' : 'voucher', locale);
  let figure = '';
  if (card) {
    const amount = money(fields['amount'], subject, locale, true);
    figure = text(fields['first']) === '1' ? amount : say('balanceOn', locale, { amount, date: printed });
  } else if (worth === 'amount') figure = money(fields['value'], subject, locale, false);
  else if (worth === 'percent') figure = say('percentOff', locale, { n: plain(fields['value']) });
  else if (worth === 'pack' && text(fields['usesTotal']) !== '') figure = say('usesLeft', locale, { left: text(fields['usesLeft']) || text(fields['usesTotal']), total: text(fields['usesTotal']) });

  const lines = [subject.business.name, title, figure, code, useBy === '' ? '' : say('useBy', locale, { date: useBy }), say('show', locale)];
  const strip = isStrip(kind);
  const page = strip ? '80mm auto' : 'A6';
  const html = `<!doctype html>
<html lang="${escape(locale)}" dir="${RTL.has(locale) ? 'rtl' : 'ltr'}">
<head>
<meta charset="utf-8">
<title>${escape(title)}</title>
<style>
@page { size: ${page}; margin: ${strip ? '4mm' : '8mm'}; }
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", "Noto Sans", sans-serif; color: #111; text-align: center; }
.card { padding: ${strip ? '2mm 0' : '6mm 4mm'}; }
.from { font-size: ${strip ? '10pt' : '11pt'}; letter-spacing: 0.02em; }
.title { font-size: ${strip ? '13pt' : '16pt'}; font-weight: 700; margin: 2mm 0; }
.figure { font-size: ${strip ? '15pt' : '20pt'}; font-weight: 700; margin: 3mm 0; }
.code { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: ${strip ? '12pt' : '14pt'}; font-weight: 600; letter-spacing: 0.06em; white-space: nowrap; margin: 3mm 0; unicode-bidi: isolate; }
.qr { width: ${strip ? '34mm' : '40mm'}; height: ${strip ? '34mm' : '40mm'}; image-rendering: pixelated; }
.small { font-size: 9pt; margin: 2mm 0; }
</style>
</head>
<body>
<div class="card">
<div class="from">${escape(subject.business.name)}</div>
<div class="title">${escape(title)}</div>
${figure === '' ? '' : `<div class="figure"><bdi>${escape(figure)}</bdi></div>\n`}${qr === undefined ? '' : `<img class="qr" alt="" src="${escape(qr.png)}">\n`}<div class="code" dir="ltr">${escape(code)}</div>
${useBy === '' ? '' : `<div class="small">${escape(say('useBy', locale, { date: useBy }))}</div>\n`}<div class="small">${escape(say('show', locale))}</div>
</div>
</body>
</html>
`;
  return { html, words: lines.filter((line) => line !== '') };
}
