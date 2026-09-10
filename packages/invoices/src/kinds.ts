/**
 * The three kinds this add-on renders, and the outline of each.
 *
 * ── WHAT AN OUTLINE IS, AND WHAT IT IS NOT ─────────────────────────────────
 *
 * An outline is the MAPPING vocabulary: the values an operator can bind a
 * table's columns to, so that a row becomes a document. It is not the
 * document's composition. The redesigned comp made a document's layout
 * per-record data — which blocks, in what order, with which of the eighteen
 * optional ones switched on — and none of that is expressible as a slot list.
 * That half arrives through `RenderInput.body`, which the contract leaves
 * opaque for exactly this reason (34 O28(a2) → D54), and `document.ts` is
 * where this provider decodes it.
 *
 * So: `body` says how the page is arranged, `subject` says what goes in the
 * bound values, and a document may have either, or both. A purely mapped
 * render — a receipt fired by a till, with no authored template behind it —
 * has no body at all and is drawn from the outline's defaults.
 *
 * ── THREE KINDS, TWELVE STARTERS, AND WHY THOSE ARE DIFFERENT NUMBERS ──────
 *
 * The surface offers twelve starters over eight titles, four of which
 * (PROFORMA, ESTIMATE, DEPOSIT, COMMERCIAL INVOICE) no kind covers. A starter
 * is a TEMPLATE PRESET, not a kind (34 O28(b) → D54): as a preset it costs
 * nothing, and as a kind each would have cost another `describe()` outline
 * with eight-locale labels on every slot. `kinds()` is three because three is
 * the number of distinct MAPPING shapes — money owed, money received, money
 * returned.
 *
 * ── WHY THE LABELS ARE HERE AND NOT IN `i18n/strings.ts` ───────────────────
 *
 * `i18n/strings.ts` is this add-on's UI copy, read through the host's `t()`
 * inside this add-on's own bundle. These are read by ADMINIUM, in Studio's
 * profile editor, where this bundle is not loaded and that `t()` does not
 * exist. The contract's answer is that a provider carries its own strings
 * (34 D14), so they live beside the provider — and every record must carry all
 * eight, because a hole is a raw slot id on somebody's screen.
 */

import type {
  DocumentKind,
  DocumentOutline,
  LocalizedText,
  OutlineSlot,
} from '@adminium/add-on-host/contracts';

/*
 * ── A NOTE FOR TRANSLATORS, AND IT IS NOT OPTIONAL ─────────────────────────
 *
 * The release sweep reads BUILT BYTES case-insensitively for a short list of
 * commercial words as SUBSTRINGS (17 §2, 24 D12) — the list lives in
 * `testing/lexicon.ts`, executable rather than quoted, so there is one copy of
 * it. An innocent word with an unlucky spelling still trips it, and THIS
 * BUNDLE HAS A PARTICULARLY BAD CASE, worth knowing before editing a line:
 *
 *   · the ordinary word for "percent" carries a banned run in German, Czech
 *     and Danish, so those three say `Satz`, `sazba` and `sats` — the word for
 *     the RATE — and never the cognate;
 *   · Czech's everyday preposition meaning "for" is itself a banned run, so
 *     the Czech throughout is written with `na`, `k` and `u` — and BOTH standard
 *     Czech words for a gratuity carry it too, so the receipt says `Dýško`,
 *     which is the everyday word and carries none;
 *   · the French for "entire" carries one, so the reduction's help says
 *     `l’ensemble du document` rather than `le document entier`;
 *   · in English, `property`, `approved` and `provide` all carry one, which is
 *     why the copy below says "field", "agreed" and "gives".
 *
 * Nothing here may suggest this add-on decides what a document COSTS. It
 * renders numbers somebody else computed and it says so.
 */

/** Every locale, one string — for a label that is genuinely the same everywhere. */
function sameEverywhere(text: string): LocalizedText {
  return {
    'en-US': text,
    'de-DE': text,
    'fr-FR': text,
    'cs-CZ': text,
    'da-DK': text,
    'zh-CN': text,
    'zh-TW': text,
    'ar-EG': text,
  };
}

const KIND_LABELS = {
  invoice: {
    'en-US': 'Invoice',
    'de-DE': 'Rechnung',
    'fr-FR': 'Facture',
    'cs-CZ': 'Faktura',
    'da-DK': 'Faktura',
    'zh-CN': '发票',
    'zh-TW': '發票',
    'ar-EG': 'فاتورة',
  },
  receipt: {
    'en-US': 'Receipt',
    'de-DE': 'Quittung',
    'fr-FR': 'Reçu',
    'cs-CZ': 'Stvrzenka',
    'da-DK': 'Kvittering',
    'zh-CN': '收据',
    'zh-TW': '收據',
    'ar-EG': 'إيصال',
  },
  'credit-note': {
    'en-US': 'Credit note',
    'de-DE': 'Gutschrift',
    'fr-FR': 'Avoir',
    'cs-CZ': 'Dobropis',
    'da-DK': 'Kreditnota',
    'zh-CN': '贷记单',
    'zh-TW': '貸記單',
    'ar-EG': 'إشعار دائن',
  },
} as const satisfies Readonly<Record<string, LocalizedText>>;

// ── the slots, each defined once and shared by the kinds that carry it ──────

const NUMBER: OutlineSlot = {
  id: 'number',
  label: {
    'en-US': 'Document number',
    'de-DE': 'Belegnummer',
    'fr-FR': 'Numéro du document',
    'cs-CZ': 'Číslo dokladu',
    'da-DK': 'Bilagsnummer',
    'zh-CN': '单据编号',
    'zh-TW': '單據編號',
    'ar-EG': 'رقم المستند',
  },
  help: {
    'en-US': 'Left unmapped, Adminium gives out the next number in sequence.',
    'de-DE': 'Ohne Zuordnung vergibt Adminium die nächste Nummer der Reihe.',
    'fr-FR': 'Sans correspondance, Adminium attribue le numéro suivant de la série.',
    'cs-CZ': 'Bez přiřazení vydá Adminium další číslo v řadě.',
    'da-DK': 'Uden tilknytning giver Adminium det næste nummer i rækken.',
    'zh-CN': '不映射时，Adminium 按顺序给出下一个编号。',
    'zh-TW': '不對應時，Adminium 依序給出下一個編號。',
    'ar-EG': 'بدون ربط، يمنح Adminium الرقم التالي في التسلسل.',
  },
  type: 'text',
  required: true,
  default: 'sequence',
};

const ISSUED_AT: OutlineSlot = {
  id: 'issuedAt',
  label: {
    'en-US': 'Issued on',
    'de-DE': 'Ausgestellt am',
    'fr-FR': 'Établi le',
    'cs-CZ': 'Vystaveno dne',
    'da-DK': 'Udstedt den',
    'zh-CN': '开具日期',
    'zh-TW': '開立日期',
    'ar-EG': 'تاريخ الإصدار',
  },
  help: {
    'en-US': 'Left unmapped, the day the document is made is used.',
    'de-DE': 'Ohne Zuordnung wird der Tag der Erstellung verwendet.',
    'fr-FR': 'Sans correspondance, le jour de création est utilisé.',
    'cs-CZ': 'Bez přiřazení se použije den vytvoření.',
    'da-DK': 'Uden tilknytning bruges dagen, dokumentet laves.',
    'zh-CN': '不映射时，使用制作当天的日期。',
    'zh-TW': '不對應時，使用製作當天的日期。',
    'ar-EG': 'بدون ربط، يُستخدم يوم إنشاء المستند.',
  },
  type: 'date',
  required: true,
  default: 'now',
};

const DUE_AT: OutlineSlot = {
  id: 'dueAt',
  label: {
    'en-US': 'Settle by',
    'de-DE': 'Zu zahlen bis',
    'fr-FR': 'À régler avant le',
    'cs-CZ': 'Uhradit do',
    'da-DK': 'Betales senest',
    'zh-CN': '付款期限',
    'zh-TW': '付款期限',
    'ar-EG': 'السداد قبل',
  },
  type: 'date',
  required: false,
};

const CUSTOMER_NAME: OutlineSlot = {
  id: 'customerName',
  label: {
    'en-US': 'Made out to',
    'de-DE': 'Ausgestellt an',
    'fr-FR': 'Établi à l’ordre de',
    'cs-CZ': 'Vystaveno na',
    'da-DK': 'Udstedt til',
    'zh-CN': '抬头',
    'zh-TW': '抬頭',
    'ar-EG': 'صادر إلى',
  },
  type: 'text',
  required: true,
};

const CUSTOMER_LINES: OutlineSlot = {
  id: 'customerLines',
  label: {
    'en-US': 'Invoice address',
    'de-DE': 'Rechnungsanschrift',
    'fr-FR': 'Adresse de facturation',
    'cs-CZ': 'Fakturační adresa',
    'da-DK': 'Fakturaadresse',
    'zh-CN': '开票地址',
    'zh-TW': '開票地址',
    'ar-EG': 'عنوان الفاتورة',
  },
  help: {
    'en-US': 'One line each, drawn under the name.',
    'de-DE': 'Je eine Zeile, unter dem Namen gedruckt.',
    'fr-FR': 'Une ligne chacune, imprimée sous le nom.',
    'cs-CZ': 'Každá na jednom řádku, vytištěno pod jménem.',
    'da-DK': 'Én linje hver, trykt under navnet.',
    'zh-CN': '每行一条，印在名称下方。',
    'zh-TW': '每行一條，印在名稱下方。',
    'ar-EG': 'سطر لكل واحد، يُطبع تحت الاسم.',
  },
  type: 'text[]',
  required: false,
};

const CUSTOMER_EMAIL: OutlineSlot = {
  id: 'customerEmail',
  label: {
    'en-US': 'Where to send it',
    'de-DE': 'Versand an',
    'fr-FR': 'Envoyer à',
    'cs-CZ': 'Odeslat na',
    'da-DK': 'Send til',
    'zh-CN': '发送至',
    'zh-TW': '寄送至',
    'ar-EG': 'يُرسل إلى',
  },
  help: {
    'en-US': 'Stored with the document. Nothing is sent until somebody presses send.',
    'de-DE': 'Wird beim Dokument gespeichert. Nichts geht raus, bis jemand auf Senden drückt.',
    'fr-FR': 'Conservée avec le document. Rien ne part tant que personne n’a cliqué sur Envoyer.',
    'cs-CZ': 'Uloženo u dokladu. Nic se neodešle, dokud někdo nestiskne Odeslat.',
    'da-DK': 'Gemmes sammen med dokumentet. Intet sendes, før nogen trykker send.',
    'zh-CN': '与单据一起保存。在有人点击发送前不会发出任何内容。',
    'zh-TW': '與單據一起儲存。在有人點擊寄送前不會發出任何內容。',
    'ar-EG': 'يُحفظ مع المستند. لا يُرسل شيء حتى يضغط أحد على الإرسال.',
  },
  type: 'email',
  required: false,
};

const CURRENCY: OutlineSlot = {
  id: 'currency',
  label: {
    'en-US': 'Currency',
    'de-DE': 'Währung',
    'fr-FR': 'Devise',
    'cs-CZ': 'Měna',
    'da-DK': 'Valuta',
    'zh-CN': '货币',
    'zh-TW': '貨幣',
    'ar-EG': 'العملة',
  },
  type: 'currency',
  required: false,
  default: 'connection',
};

const PO_NUMBER: OutlineSlot = {
  id: 'poNumber',
  label: {
    'en-US': 'Their reference',
    'de-DE': 'Ihre Referenz',
    'fr-FR': 'Votre référence',
    'cs-CZ': 'Vaše značka',
    'da-DK': 'Jeres reference',
    'zh-CN': '对方参考号',
    'zh-TW': '對方參考號',
    'ar-EG': 'مرجعهم',
  },
  help: {
    'en-US': 'The number the customer asked you to quote back — an order number, a case number.',
    'de-DE': 'Die Nummer, die der Kunde angegeben haben möchte — eine Bestellnummer, ein Aktenzeichen.',
    'fr-FR': 'Le numéro que le client demande de rappeler — un numéro de commande, un numéro de dossier.',
    'cs-CZ': 'Číslo, které zákazník žádá uvádět — číslo objednávky nebo spisu.',
    'da-DK': 'Det nummer, kunden beder jer oplyse — et ordrenummer, et sagsnummer.',
    'zh-CN': '客户要求回填的编号——订单号或案件号。',
    'zh-TW': '客戶要求回填的編號——訂單號或案件號。',
    'ar-EG': 'الرقم الذي يطلب العميل ذكره — رقم طلب أو رقم ملف.',
  },
  type: 'text',
  required: false,
};

const ITEMS: OutlineSlot = {
  id: 'items',
  label: {
    'en-US': 'Lines',
    'de-DE': 'Positionen',
    'fr-FR': 'Lignes',
    'cs-CZ': 'Položky',
    'da-DK': 'Linjer',
    'zh-CN': '明细',
    'zh-TW': '明細',
    'ar-EG': 'البنود',
  },
  help: {
    'en-US': 'The child table holding one row per line — usually the invoice items table.',
    'de-DE': 'Die untergeordnete Tabelle mit einer Zeile je Position — meist die Positionstabelle.',
    'fr-FR': 'La table enfant contenant une ligne par poste — en général la table des lignes.',
    'cs-CZ': 'Podřízená tabulka s jedním řádkem na položku — obvykle tabulka položek.',
    'da-DK': 'Undertabellen med én række per linje — som regel linjetabellen.',
    'zh-CN': '每行一条记录的子表——通常是明细表。',
    'zh-TW': '每列一筆記錄的子表——通常是明細表。',
    'ar-EG': 'الجدول الفرعي الذي يحمل سطراً لكل بند — عادةً جدول البنود.',
  },
  type: 'collection',
  required: false,
  columns: [
    {
      id: 'desc',
      label: {
        'en-US': 'What it is',
        'de-DE': 'Beschreibung',
        'fr-FR': 'Désignation',
        'cs-CZ': 'Popis',
        'da-DK': 'Beskrivelse',
        'zh-CN': '内容',
        'zh-TW': '內容',
        'ar-EG': 'الوصف',
      },
      type: 'text',
      required: true,
    },
    {
      id: 'qty',
      label: {
        'en-US': 'How many',
        'de-DE': 'Menge',
        'fr-FR': 'Quantité',
        'cs-CZ': 'Množství',
        'da-DK': 'Antal',
        'zh-CN': '数量',
        'zh-TW': '數量',
        'ar-EG': 'الكمية',
      },
      type: 'number',
      required: true,
    },
    {
      id: 'rate',
      label: {
        'en-US': 'Each',
        'de-DE': 'Einzelbetrag',
        'fr-FR': 'Montant unitaire',
        'cs-CZ': 'Za jednotku',
        'da-DK': 'Pr. enhed',
        'zh-CN': '单价',
        'zh-TW': '單價',
        'ar-EG': 'للوحدة',
      },
      type: 'money',
      required: true,
    },
    {
      id: 'taxRate',
      label: {
        'en-US': 'Tax rate on this line',
        'de-DE': 'Steuersatz dieser Position',
        'fr-FR': 'Taux de taxe de cette ligne',
        'cs-CZ': 'Daňová sazba této položky',
        'da-DK': 'Afgiftssats på denne linje',
        'zh-CN': '本行税率',
        'zh-TW': '本列稅率',
        'ar-EG': 'نسبة الضريبة لهذا السطر',
      },
      help: {
        'en-US': 'Only where lines differ. Left unmapped, the document’s own rate is used.',
        'de-DE': 'Nur wenn Positionen sich unterscheiden. Ohne Zuordnung gilt der Satz des Belegs.',
        'fr-FR': 'Uniquement si les lignes diffèrent. Sans correspondance, le taux du document s’applique.',
        'cs-CZ': 'Jen když se položky liší. Bez přiřazení platí sazba dokladu.',
        'da-DK': 'Kun hvor linjer er forskellige. Uden tilknytning bruges bilagets egen sats.',
        'zh-CN': '仅当各行不同时使用。不映射时使用单据自身的税率。',
        'zh-TW': '僅當各列不同時使用。不對應時使用單據自身的稅率。',
        'ar-EG': 'فقط عند اختلاف السطور. بدون ربط تُستخدم نسبة المستند نفسه.',
      },
      type: 'percent',
      required: false,
    },
  ],
};

const TAX_RATE: OutlineSlot = {
  id: 'taxRate',
  label: {
    'en-US': 'Tax rate',
    'de-DE': 'Steuersatz',
    'fr-FR': 'Taux de taxe',
    'cs-CZ': 'Daňová sazba',
    'da-DK': 'Afgiftssats',
    'zh-CN': '税率',
    'zh-TW': '稅率',
    'ar-EG': 'نسبة الضريبة',
  },
  help: {
    // NO `default: 'setting'` — D20. A rate that came from a workspace setting
    // would change every already-issued document the day somebody edited it.
    'en-US': 'Map a column, or type one rate for every document this mapping makes.',
    'de-DE': 'Eine Spalte zuordnen oder einen Satz für alle Belege dieser Zuordnung eintragen.',
    'fr-FR': 'Associer une colonne, ou saisir un taux unique pour tous les documents créés ici.',
    'cs-CZ': 'Přiřaďte sloupec nebo zadejte jednu sazbu na všechny doklady tohoto přiřazení.',
    'da-DK': 'Tilknyt en kolonne, eller skriv én sats for alle bilag fra denne tilknytning.',
    'zh-CN': '映射一列，或为此映射生成的所有单据输入同一税率。',
    'zh-TW': '對應一欄，或為此對應產生的所有單據輸入同一稅率。',
    'ar-EG': 'اربط عموداً، أو اكتب نسبة واحدة لكل مستندات هذا الربط.',
  },
  type: 'percent',
  required: false,
};

const DISCOUNT_RATE: OutlineSlot = {
  id: 'discountRate',
  label: {
    'en-US': 'Reduction',
    'de-DE': 'Nachlass',
    'fr-FR': 'Remise',
    'cs-CZ': 'Sleva',
    'da-DK': 'Rabat',
    'zh-CN': '折让',
    'zh-TW': '折讓',
    'ar-EG': 'الخصم',
  },
  help: {
    'en-US': 'Taken off the whole document, before tax.',
    'de-DE': 'Wird vom gesamten Beleg abgezogen, vor Steuer.',
    'fr-FR': 'Déduite de l’ensemble du document, avant taxe.',
    'cs-CZ': 'Odečítá se z celého dokladu, před daní.',
    'da-DK': 'Trækkes fra hele bilaget, før afgift.',
    'zh-CN': '从整张单据中扣除，计税之前。',
    'zh-TW': '從整張單據中扣除，計稅之前。',
    'ar-EG': 'يُخصم من المستند كله، قبل الضريبة.',
  },
  type: 'percent',
  required: false,
};

const PAID_WITH: OutlineSlot = {
  id: 'paidWith',
  label: {
    'en-US': 'Settled with',
    'de-DE': 'Beglichen mit',
    'fr-FR': 'Réglé par',
    'cs-CZ': 'Uhrazeno čím',
    'da-DK': 'Betalt med',
    'zh-CN': '结算方式',
    'zh-TW': '結算方式',
    'ar-EG': 'تمت التسوية بـ',
  },
  type: 'text',
  required: false,
};

const TIP: OutlineSlot = {
  id: 'tip',
  label: {
    'en-US': 'Gratuity',
    'de-DE': 'Trinkgeld',
    'fr-FR': 'Pourboire',
    'cs-CZ': 'Dýško',
    'da-DK': 'Drikkepenge',
    'zh-CN': '小费',
    'zh-TW': '小費',
    'ar-EG': 'إكرامية',
  },
  type: 'money',
  required: false,
};

const REFERENCES: OutlineSlot = {
  id: 'references',
  label: {
    'en-US': 'Corrects document',
    'de-DE': 'Berichtigt Beleg',
    'fr-FR': 'Rectifie le document',
    'cs-CZ': 'Opravuje doklad',
    'da-DK': 'Retter bilag',
    'zh-CN': '更正单据',
    'zh-TW': '更正單據',
    'ar-EG': 'يصحّح المستند',
  },
  help: {
    'en-US': 'The number of the document this one puts right. Drawn at the top.',
    'de-DE': 'Die Nummer des Belegs, den dieser berichtigt. Wird oben gedruckt.',
    'fr-FR': 'Le numéro du document que celui-ci rectifie. Imprimé en haut.',
    'cs-CZ': 'Číslo dokladu, který tento opravuje. Tiskne se nahoře.',
    'da-DK': 'Nummeret på det bilag, dette retter. Trykkes øverst.',
    'zh-CN': '本单更正的单据编号。印在顶部。',
    'zh-TW': '本單更正的單據編號。印在頂部。',
    'ar-EG': 'رقم المستند الذي يصحّحه هذا. يُطبع في الأعلى.',
  },
  type: 'text',
  required: false,
};

const SHARED: readonly OutlineSlot[] = [
  NUMBER,
  ISSUED_AT,
  CUSTOMER_NAME,
  CUSTOMER_LINES,
  CUSTOMER_EMAIL,
  CURRENCY,
  ITEMS,
  TAX_RATE,
  DISCOUNT_RATE,
];

const OUTLINES: Readonly<Record<string, DocumentOutline>> = {
  invoice: { slots: [...SHARED, DUE_AT, PO_NUMBER] },
  /*
   * `paidWith` and `tip` are drawn nowhere in `Invoice Builder.dc.html`, and
   * that is not an oversight on either side: the comp is the INVOICE authoring
   * surface, and a receipt is what a till prints after money has changed hands
   * (34 §6.1 — the point-of-sale mount is the owner's own example). They have a
   * caller in 34f and none in the comp.
   */
  receipt: { slots: [...SHARED, PAID_WITH, TIP] },
  'credit-note': { slots: [...SHARED, REFERENCES] },
};

export const KINDS: readonly DocumentKind[] = [
  {
    id: 'invoice',
    label: KIND_LABELS.invoice,
    formats: ['html', 'pdf'],
    paper: ['a4', 'letter'],
    coverage: 'winansi',
  },
  {
    id: 'receipt',
    label: KIND_LABELS.receipt,
    formats: ['html', 'pdf'],
    // A till roll first, because that is what most receipts are printed on.
    paper: ['receipt-80mm', 'a4', 'letter'],
    coverage: 'winansi',
  },
  {
    id: 'credit-note',
    label: KIND_LABELS['credit-note'],
    formats: ['html', 'pdf'],
    paper: ['a4', 'letter'],
    coverage: 'winansi',
  },
];

export function kinds(): readonly DocumentKind[] {
  return KINDS;
}

/** Throws for a kind `kinds()` does not list — the data path is `render`'s refusal. */
export function describe(kind: string): DocumentOutline {
  const outline = OUTLINES[kind];
  if (outline === undefined) throw new Error(`unknown document kind: ${kind}`);
  return outline;
}

export function isKnownKind(kind: string): boolean {
  // Not `Object.prototype.hasOwnProperty.call` — comments are stripped from the
  // built bundle but identifiers are not, and that one spells a banned run
  // twice (`ALLOWED_TOKENS` masks whole words, and this is not one). The
  // lexicon gate reads bytes, not meaning.
  return OUTLINES[kind] !== undefined;
}

export { sameEverywhere };
