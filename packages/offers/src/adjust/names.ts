/**
 * WHAT A REDUCTION IS CALLED.
 *
 * A customer reads, on a receipt or at a checkout, what was taken off and
 * why: "10 % off your first order", "Voucher · One candle", "Staff ·
 * Goodwill". An offer's name is the owner's own, in the languages they wrote
 * it in. A voucher's and a staff reduction's is its own text behind one word,
 * and that word is said here in eight languages — the only words this file
 * ships.
 */

export const LOCALES = ['en-US', 'de-DE', 'fr-FR', 'da-DK', 'cs-CZ', 'ar-EG', 'zh-CN', 'zh-TW'] as const;
type Words = Readonly<Record<(typeof LOCALES)[number], string>>;

const VOUCHER: Words = { 'en-US': 'Voucher', 'de-DE': 'Gutschein', 'fr-FR': 'Bon', 'da-DK': 'Voucher', 'cs-CZ': 'Poukaz', 'ar-EG': 'قسيمة', 'zh-CN': '代金券', 'zh-TW': '兌換券' };
const PREPAID: Words = {
  'en-US': 'Paid by voucher',
  'de-DE': 'Mit Gutschein bezahlt',
  'fr-FR': 'Payé par bon',
  'da-DK': 'Betalt med voucher',
  'cs-CZ': 'Zaplaceno poukazem',
  'ar-EG': 'مدفوع بقسيمة',
  'zh-CN': '代金券支付',
  'zh-TW': '兌換券支付',
};
const PACK: Words = { 'en-US': 'Pack', 'de-DE': 'Paket', 'fr-FR': 'Forfait', 'da-DK': 'Klippekort', 'cs-CZ': 'Balíček', 'ar-EG': 'باقة', 'zh-CN': '次卡', 'zh-TW': '次卡' };
const STAFF: Words = { 'en-US': 'Staff', 'de-DE': 'Personal', 'fr-FR': 'Personnel', 'da-DK': 'Personale', 'cs-CZ': 'Personál', 'ar-EG': 'الموظفون', 'zh-CN': '员工', 'zh-TW': '員工' };

/** A name as an answer carries one: a text for every language, or one text for all. */
export type Name = Record<string, string> | string;

/** The longest a name may be: what an answer's check allows. */
const MAX = 200;
/** Cut by whole characters: a character made of two halves is never left as one. */
const cut = (text: string): string => (text.length > MAX ? Array.from(text).slice(0, MAX).join('').slice(0, MAX) : text);

/** A word and what it stands before, in each language: "Voucher · One candle". */
const behind = (word: Words, text: string): Name => (text === '' ? { ...word } : Object.fromEntries(LOCALES.map((locale) => [locale, cut(`${word[locale]} · ${text}`)])));

/**
 * An offer's name as its row keeps it. The column is a map of languages kept
 * as text on every database; text that does not read as such a map is one
 * name for every language.
 */
export function offerName(stored: unknown, fallback: string): Name {
  const named = (read: unknown): Name | null => {
    if (typeof read === 'string') return read.trim() === '' ? null : cut(read.trim());
    if (typeof read !== 'object' || read === null || Array.isArray(read)) return null;
    const names: Record<string, string> = {};
    // Only a language tag is a name's key: nothing else of the map is read.
    for (const [locale, name] of Object.entries(read)) if (/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(locale) && typeof name === 'string' && name !== '') names[locale] = cut(name);
    return Object.keys(names).length > 0 ? names : null;
  };
  if (typeof stored === 'object' && stored !== null) return named(stored) ?? cut(fallback);
  if (typeof stored !== 'string' || stored.trim() === '') return cut(fallback);
  const text = stored.trim();
  if (text.startsWith('{') || text.startsWith('"')) {
    try {
      const read = named(JSON.parse(text));
      if (read !== null) return read;
    } catch {
      // Not what it looked like: the text itself is the name.
    }
  }
  return cut(text);
}

/** A voucher's or a pack's name: its own text behind the word for what it is. */
export function voucherName(row: { worth: string; sold: boolean; name: string }): Name {
  return behind(row.worth === 'pack' ? PACK : row.sold ? PREPAID : VOUCHER, row.name);
}

/** A reduction staff gave: "Staff · Goodwill", or "Staff" alone where no reason was given. */
export const staffName = (reason: string): Name => behind(STAFF, reason);

/** One text of a name, for a note that carries only one: the reader's language, else English, else any. */
export function nameIn(name: Name, locale: string): string {
  if (typeof name === 'string') return name;
  return name[locale] ?? name['en-US'] ?? Object.values(name)[0] ?? '';
}
