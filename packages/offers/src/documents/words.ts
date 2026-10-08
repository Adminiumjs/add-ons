/** Every word a printed card or voucher carries, and every name a slot is shown under, in the eight languages. */
import type { LocalizedText } from '@adminium/add-on-contracts';

const L = ['en-US', 'de-DE', 'fr-FR', 'da-DK', 'cs-CZ', 'ar-EG', 'zh-CN', 'zh-TW'] as const;
const tr = (...words: string[]): LocalizedText => Object.fromEntries(L.map((tag, at) => [tag, words[at] as string])) as LocalizedText;

export const WORDS = {
  giftCard: tr('Gift card', 'Geschenkkarte', 'Carte cadeau', 'Gavekort', 'Dárková karta', 'بطاقة هدية', '礼品卡', '禮品卡'),
  giftCardStrip: tr('Gift card, receipt strip', 'Geschenkkarte, Bonstreifen', 'Carte cadeau, ticket', 'Gavekort, bonstrimmel', 'Dárková karta, účtenka', 'بطاقة هدية، شريط إيصال', '礼品卡（小票）', '禮品卡（收據）'),
  voucher: tr('Voucher', 'Gutschein', 'Bon', 'Voucher', 'Poukaz', 'قسيمة', '代金券', '兌換券'),
  voucherStrip: tr('Voucher, receipt strip', 'Gutschein, Bonstreifen', 'Bon, ticket', 'Voucher, bonstrimmel', 'Poukaz, účtenka', 'قسيمة، شريط إيصال', '代金券（小票）', '兌換券（收據）'),
  pack: tr('Pack', 'Paket', 'Forfait', 'Klippekort', 'Balíček', 'باقة', '次卡', '次卡'),
  balanceOn: tr('Balance {amount} on {date}', 'Guthaben {amount} am {date}', 'Solde de {amount} au {date}', 'Saldo {amount} pr. {date}', 'Zůstatek {amount} ke dni {date}', 'الرصيد {amount} في {date}', '{date} 余额 {amount}', '{date} 餘額 {amount}'),
  useBy: tr('Use it by {date}', 'Einlösbar bis {date}', 'À utiliser avant le {date}', 'Bruges senest {date}', 'Využijte do {date}', 'تُستخدم قبل {date}', '请在 {date} 前使用', '請於 {date} 前使用'),
  usesLeft: tr('{left} of {total} uses left', 'Noch {left} von {total} Einlösungen', '{left} utilisations restantes sur {total}', '{left} af {total} klip tilbage', 'Zbývá {left} z {total} použití', 'متبقٍ {left} من {total} مرات استخدام', '剩余 {left} 次，共 {total} 次', '剩餘 {left} 次，共 {total} 次'),
  percentOff: tr('{n}% off', '{n} % Rabatt', '{n} % de remise', '{n} % rabat', 'Sleva {n} %', 'خصم {n}%', '{n}% 折扣', '{n}% 折扣'),
  show: tr('Show this code or its QR code at the counter.', 'Zeigen Sie diesen Code oder den QR-Code an der Kasse vor.', 'Présentez ce code ou son QR code en caisse.', 'Vis denne kode eller QR-koden ved kassen.', 'Tento kód nebo jeho QR kód ukažte u pokladny.', 'اعرض هذا الرمز أو رمز QR عند الكاشير.', '请在收银台出示此码或二维码。', '請在櫃檯出示此碼或 QR 碼。'),
  // Slots
  code: tr('Code', 'Code', 'Code', 'Kode', 'Kód', 'الرمز', '卡号', '卡號'),
  qr: tr('QR code', 'QR-Code', 'QR code', 'QR-kode', 'QR kód', 'رمز QR', '二维码', 'QR 碼'),
  amount: tr('Amount', 'Betrag', 'Montant', 'Beløb', 'Částka', 'المبلغ', '金额', '金額'),
  useBySlot: tr('Use it by', 'Einlösbar bis', 'À utiliser avant le', 'Bruges senest', 'Využijte do', 'تُستخدم قبل', '有效期至', '有效期限'),
  first: tr('First print', 'Erstdruck', 'Première impression', 'Første udskrift', 'První tisk', 'الطباعة الأولى', '首次打印', '首次列印'),
  firstHelp: tr('Set for the print made when the card is issued: it shows the amount, not a balance on a day.', 'Für den Druck bei der Ausstellung der Karte: zeigt den Betrag, nicht ein Guthaben an einem Tag.', 'Pour l’impression faite à l’émission de la carte : affiche le montant, et non un solde à une date.', 'Angives ved udskriften, når kortet udstedes: viser beløbet, ikke en saldo på en dag.', 'Nastaveno při tisku při vystavení karty: zobrazí částku, nikoli zůstatek k určitému dni.', 'تُضبط للطباعة عند إصدار البطاقة: تعرض المبلغ لا الرصيد في يوم معيّن.', '发卡时打印使用：显示金额，而非某日余额。', '發卡時列印使用：顯示金額，而非某日餘額。'),
  printedAt: tr('Printed on', 'Gedruckt am', 'Imprimé le', 'Udskrevet den', 'Vytištěno dne', 'تاريخ الطباعة', '打印日期', '列印日期'),
  name: tr('What it is called', 'Bezeichnung', 'Intitulé', 'Betegnelse', 'Název', 'الاسم', '名称', '名稱'),
  worth: tr('Worth', 'Wert', 'Valeur', 'Værdi', 'Hodnota', 'القيمة', '面值类型', '面值類型'),
  value: tr('Value', 'Wert', 'Valeur', 'Værdi', 'Hodnota', 'القيمة', '面值', '面值'),
  usesLeftSlot: tr('Uses left', 'Verbleibende Einlösungen', 'Utilisations restantes', 'Klip tilbage', 'Zbývající použití', 'مرات الاستخدام المتبقية', '剩余次数', '剩餘次數'),
  usesTotal: tr('Uses in all', 'Einlösungen insgesamt', 'Utilisations au total', 'Klip i alt', 'Použití celkem', 'إجمالي مرات الاستخدام', '总次数', '總次數'),
} as const;

export type Word = keyof typeof WORDS;
export const RTL = new Set(['ar-EG']);
/** The language a document is drawn in: the subject's own, when it is one of the eight. */
export const localeOf = (asked: string): (typeof L)[number] => L.find((tag) => tag === asked) ?? L.find((tag) => tag.slice(0, 2) === asked.slice(0, 2)) ?? 'en-US';
export const say = (word: Word, locale: string, places: Readonly<Record<string, string>> = {}): string => WORDS[word][localeOf(locale)].replace(/\{(\w+)\}/g, (_all, name: string) => places[name] ?? '');
