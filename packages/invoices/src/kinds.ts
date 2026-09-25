/**
 * The five kinds this add-on renders, and the outline of each.
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
 * ── FIVE KINDS, TWELVE STARTERS, AND WHY THOSE ARE DIFFERENT NUMBERS ───────
 *
 * The surface offers twelve starters over eight titles, four of which
 * (PROFORMA, ESTIMATE, DEPOSIT, COMMERCIAL INVOICE) no kind covers. A starter
 * is a TEMPLATE PRESET, not a kind (34 O28(b) → D54): as a preset it costs
 * nothing, and as a kind each would have cost another `describe()` outline
 * with eight-locale labels on every slot. `kinds()` is five because five is
 * the number of distinct MAPPING shapes — money owed, money received, money
 * returned, money offered (a quote), and one client's account over a period
 * (a statement, which is not one row but a read of many).
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
  quote: {
    'en-US': 'Quote',
    'de-DE': 'Angebot',
    'fr-FR': 'Devis',
    'cs-CZ': 'Nabídka',
    'da-DK': 'Tilbud',
    'zh-CN': '报价单',
    'zh-TW': '報價單',
    'ar-EG': 'عرض سعر',
  },
  statement: {
    'en-US': 'Statement',
    'de-DE': 'Kontoauszug',
    'fr-FR': 'Relevé de compte',
    'cs-CZ': 'Výpis z účtu',
    'da-DK': 'Kontoudtog',
    'zh-CN': '对账表',
    'zh-TW': '對帳表',
    'ar-EG': 'كشف حساب',
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
    /*
     * NO PER-LINE TAX RATE. A document carries one rate, and a column
     * that used to sit here was mapped by profiles and then dropped on the way
     * to the page (`subject.ts` never read it), so nothing that ever printed
     * loses anything by its going. The four below are for the tables an app
     * builds on this add-on's shapes: a line's reduction, its kind, the amount
     * Adminium stored for it, and the share of a quote a stage line bills.
     */
    {
      id: 'discount',
      label: {
        'en-US': 'Reduction on this line',
        'de-DE': 'Nachlass dieser Position',
        'fr-FR': 'Remise sur cette ligne',
        'cs-CZ': 'Sleva na této položce',
        'da-DK': 'Rabat på denne linje',
        'zh-CN': '本行折让',
        'zh-TW': '本列折讓',
        'ar-EG': 'خصم هذا السطر',
      },
      help: {
        'en-US': 'An amount, or a rate when the reduction kind says so. Printed under the line.',
        'de-DE': 'Ein Betrag oder, wenn die Art es sagt, ein Satz. Unter der Position gedruckt.',
        'fr-FR': 'Un montant, ou un taux si le type de remise l’indique. Imprimée sous la ligne.',
        'cs-CZ': 'Částka, nebo sazba, když to říká druh slevy. Tiskne se pod položkou.',
        'da-DK': 'Et beløb, eller en sats når rabattypen siger det. Trykkes under linjen.',
        'zh-CN': '金额；折让类型为比例时为比例。印在该行下方。',
        'zh-TW': '金額；折讓類型為比例時為比例。印在該列下方。',
        'ar-EG': 'مبلغ، أو نسبة إذا قال نوع الخصم ذلك. يُطبع تحت السطر.',
      },
      type: 'number',
      required: false,
    },
    {
      id: 'discountKind',
      label: {
        'en-US': 'Reduction kind',
        'de-DE': 'Art des Nachlasses',
        'fr-FR': 'Type de remise',
        'cs-CZ': 'Druh slevy',
        'da-DK': 'Rabattype',
        'zh-CN': '折让类型',
        'zh-TW': '折讓類型',
        'ar-EG': 'نوع الخصم',
      },
      help: {
        'en-US': '“amount” or “percent”, as the line stores it.',
        'de-DE': '„amount“ oder „percent“, wie die Position es speichert.',
        'fr-FR': '« amount » ou « percent », tel que la ligne l’enregistre.',
        'cs-CZ': '„amount“ nebo „percent“, jak to položka ukládá.',
        'da-DK': '“amount” eller “percent”, som linjen gemmer det.',
        'zh-CN': '按该行的存储值，为“amount”或“percent”。',
        'zh-TW': '依該列的儲存值，為「amount」或「percent」。',
        'ar-EG': '“amount” أو “percent” كما يخزنه السطر.',
      },
      type: 'text',
      required: false,
    },
    {
      id: 'amount',
      label: {
        'en-US': 'Line amount',
        'de-DE': 'Betrag der Position',
        'fr-FR': 'Montant de la ligne',
        'cs-CZ': 'Částka položky',
        'da-DK': 'Linjens beløb',
        'zh-CN': '本行金额',
        'zh-TW': '本列金額',
        'ar-EG': 'مبلغ السطر',
      },
      help: {
        'en-US': 'The amount stored for the line. Mapped, it is printed as stored; unmapped, quantity times each.',
        'de-DE': 'Der gespeicherte Betrag der Position. Zugeordnet wird er so gedruckt; sonst Menge mal Einzelbetrag.',
        'fr-FR': 'Le montant enregistré de la ligne. Associé, il est imprimé tel quel ; sinon quantité fois montant unitaire.',
        'cs-CZ': 'Uložená částka položky. Přiřazená se tiskne, jak je; jinak množství krát cena za jednotku.',
        'da-DK': 'Linjens gemte beløb. Tilknyttet trykkes det som gemt; ellers antal gange pris pr. enhed.',
        'zh-CN': '该行存储的金额。映射时按存储值打印；不映射时为数量乘单价。',
        'zh-TW': '該列儲存的金額。對應時依儲存值列印；不對應時為數量乘單價。',
        'ar-EG': 'المبلغ المخزن للسطر. عند ربطه يُطبع كما هو؛ وإلا فالكمية مضروبة في سعر الوحدة.',
      },
      type: 'money',
      required: false,
    },
    {
      id: 'share',
      label: {
        'en-US': 'Share of a quote',
        'de-DE': 'Anteil an einem Angebot',
        'fr-FR': 'Part d’un devis',
        'cs-CZ': 'Podíl z nabídky',
        'da-DK': 'Andel af et tilbud',
        'zh-CN': '报价单所占比例',
        'zh-TW': '報價單所占比例',
        'ar-EG': 'حصة من عرض السعر',
      },
      help: {
        'en-US': 'For a line that bills a stage of a quote: its share, printed where the quantity goes.',
        'de-DE': 'Für eine Position, die eine Stufe eines Angebots abrechnet: ihr Anteil, gedruckt an Stelle der Menge.',
        'fr-FR': 'Pour une ligne qui facture une étape d’un devis : sa part, imprimée à la place de la quantité.',
        'cs-CZ': 'U položky, která účtuje část nabídky: její podíl, vytištěný místo množství.',
        'da-DK': 'For en linje, der fakturerer et trin af et tilbud: dens andel, trykt hvor antallet står.',
        'zh-CN': '用于按报价单阶段开票的行：其所占比例，印在数量的位置。',
        'zh-TW': '用於按報價單階段開票的列：其所占比例，印在數量的位置。',
        'ar-EG': 'لسطر يفوتر مرحلة من عرض سعر: حصته، تُطبع مكان الكمية.',
      },
      type: 'number',
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
  help: {
    'en-US': 'Printed above the total and added to it, so map a stored total that does not include it.',
    'de-DE': 'Über der Gesamtsumme gedruckt und zu ihr addiert — ordnen Sie also eine gespeicherte Gesamtsumme ohne Trinkgeld zu.',
    'fr-FR': 'Imprimé au-dessus du total et ajouté à celui-ci : associez donc un total enregistré qui ne le compte pas.',
    'cs-CZ': 'Tiskne se nad celkovou částkou a přičítá se k ní, takže přiřaďte uloženou celkovou částku bez dýška.',
    'da-DK': 'Trykkes over totalen og lægges til den, så tilknyt en gemt total uden drikkepenge.',
    'zh-CN': '打印在合计上方并计入合计，因此请映射不含小费的存储合计。',
    'zh-TW': '列印在合計上方並計入合計，因此請對應不含小費的儲存合計。',
    'ar-EG': 'تُطبع فوق الإجمالي وتُضاف إليه، فاربط إجمالياً مخزناً لا يشملها.',
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

/*
 * ── THE SLOTS BELOW ARE FOR THE TABLES AN APP BUILDS ON THIS ADD-ON'S SHAPES ─
 *
 * Every one is optional, so a profile an operator mapped by hand before they
 * existed keeps rendering exactly as it did. A shape's document profile maps
 * them to the columns Adminium keeps — the stored totals, the payments, the
 * void — and the renderer then prints those figures as stored rather than
 * adding anything up itself. The client's own details (name, address, tax
 * number, contact) are the app's columns, so the app maps them.
 */

const TITLE: OutlineSlot = {
  id: 'title',
  label: {
    'en-US': 'What it is for',
    'de-DE': 'Betreff',
    'fr-FR': 'Objet',
    'cs-CZ': 'Předmět',
    'da-DK': 'Emne',
    'zh-CN': '事由',
    'zh-TW': '事由',
    'ar-EG': 'الموضوع',
  },
  help: {
    'en-US': 'A line saying what the document is about, printed above the lines.',
    'de-DE': 'Eine Zeile, worum es im Beleg geht, über den Positionen gedruckt.',
    'fr-FR': 'Une ligne qui dit l’objet du document, imprimée au-dessus des lignes.',
    'cs-CZ': 'Řádek o tom, čeho se doklad týká, vytištěný nad položkami.',
    'da-DK': 'En linje om, hvad bilaget handler om, trykt over linjerne.',
    'zh-CN': '说明单据内容的一行，印在明细上方。',
    'zh-TW': '說明單據內容的一行，印在明細上方。',
    'ar-EG': 'سطر يقول موضوع المستند، يُطبع فوق البنود.',
  },
  type: 'text',
  required: false,
};

const CUSTOMER_CONTACT: OutlineSlot = {
  id: 'customerContact',
  label: {
    'en-US': 'Contact person',
    'de-DE': 'Ansprechperson',
    'fr-FR': 'Personne à contacter',
    'cs-CZ': 'Kontaktní osoba',
    'da-DK': 'Kontaktperson',
    'zh-CN': '联系人',
    'zh-TW': '聯絡人',
    'ar-EG': 'جهة الاتصال',
  },
  type: 'text',
  required: false,
};

const CUSTOMER_TAX_NUMBER: OutlineSlot = {
  id: 'customerTaxNumber',
  label: {
    'en-US': 'Their tax number',
    'de-DE': 'Steuernummer des Empfängers',
    'fr-FR': 'Numéro fiscal du destinataire',
    'cs-CZ': 'Daňové číslo odběratele',
    'da-DK': 'Modtagerens skattenummer',
    'zh-CN': '对方税号',
    'zh-TW': '對方稅號',
    'ar-EG': 'الرقم الضريبي للعميل',
  },
  type: 'text',
  required: false,
};

const TERMS: OutlineSlot = {
  id: 'terms',
  label: {
    'en-US': 'Terms',
    'de-DE': 'Zahlungsziel',
    'fr-FR': 'Conditions de règlement',
    'cs-CZ': 'Splatnost',
    'da-DK': 'Betalingsbetingelser',
    'zh-CN': '付款条件',
    'zh-TW': '付款條件',
    'ar-EG': 'شروط السداد',
  },
  help: {
    'en-US': 'The terms stored with the document — net7, net14, net30 or on-receipt are printed in the document’s language.',
    'de-DE': 'Die beim Beleg gespeicherte Bedingung — net7, net14, net30 und on-receipt werden in der Sprache des Belegs gedruckt.',
    'fr-FR': 'Les conditions enregistrées avec le document — net7, net14, net30 et on-receipt sont imprimées dans la langue du document.',
    'cs-CZ': 'Splatnost uložená u dokladu — net7, net14, net30 a on-receipt se tisknou v jazyce dokladu.',
    'da-DK': 'Betingelserne gemt med bilaget — net7, net14, net30 og on-receipt trykkes på bilagets eget sprog.',
    'zh-CN': '与单据一起存储的付款条件——net7、net14、net30 和 on-receipt 以单据语言打印。',
    'zh-TW': '與單據一起儲存的付款條件——net7、net14、net30 和 on-receipt 以單據語言列印。',
    'ar-EG': 'الشروط المخزنة مع المستند — تُطبع net7 وnet14 وnet30 وon-receipt بلغة المستند.',
  },
  type: 'text',
  required: false,
};

const TAX_NAME: OutlineSlot = {
  id: 'taxName',
  label: {
    'en-US': 'Tax name on this document',
    'de-DE': 'Steuerbezeichnung auf diesem Beleg',
    'fr-FR': 'Nom de la taxe sur ce document',
    'cs-CZ': 'Název daně na tomto dokladu',
    'da-DK': 'Afgiftens navn på dette bilag',
    'zh-CN': '本单据的税名',
    'zh-TW': '本單據的稅名',
    'ar-EG': 'اسم الضريبة في هذا المستند',
  },
  help: {
    'en-US': 'Copied onto the document when it was made. Unmapped, the word from the settings is used.',
    'de-DE': 'Beim Erstellen auf den Beleg kopiert. Ohne Zuordnung gilt das Wort aus den Einstellungen.',
    'fr-FR': 'Copié sur le document à sa création. Sans correspondance, le mot des réglages est utilisé.',
    'cs-CZ': 'Zkopírováno na doklad při jeho vytvoření. Bez přiřazení se použije slovo z nastavení.',
    'da-DK': 'Kopieret over på bilaget, da det blev lavet. Uden tilknytning bruges ordet fra indstillingerne.',
    'zh-CN': '创建单据时复制到单据上。不映射时使用设置中的名称。',
    'zh-TW': '建立單據時複製到單據上。不對應時使用設定中的名稱。',
    'ar-EG': 'يُنسخ على المستند عند إنشائه. بدون ربط تُستخدم الكلمة من الإعدادات.',
  },
  type: 'text',
  required: false,
};

const SUBTOTAL: OutlineSlot = {
  id: 'subtotal',
  label: {
    'en-US': 'Subtotal',
    'de-DE': 'Zwischensumme',
    'fr-FR': 'Sous-total',
    'cs-CZ': 'Mezisoučet',
    'da-DK': 'Subtotal',
    'zh-CN': '小计',
    'zh-TW': '小計',
    'ar-EG': 'المجموع الفرعي',
  },
  type: 'money',
  required: false,
};

const TAX: OutlineSlot = {
  id: 'tax',
  label: {
    'en-US': 'Tax',
    'de-DE': 'Steuer',
    'fr-FR': 'Taxe',
    'cs-CZ': 'Daň',
    'da-DK': 'Afgift',
    'zh-CN': '税额',
    'zh-TW': '稅額',
    'ar-EG': 'الضريبة',
  },
  type: 'money',
  required: false,
};

const TOTAL: OutlineSlot = {
  id: 'total',
  label: {
    'en-US': 'Total',
    'de-DE': 'Gesamt',
    'fr-FR': 'Total',
    'cs-CZ': 'Celkem',
    'da-DK': 'I alt',
    'zh-CN': '合计',
    'zh-TW': '合計',
    'ar-EG': 'الإجمالي',
  },
  help: {
    'en-US': 'Map the stored subtotal, tax and total and they are printed exactly as stored. Unmapped, the lines are added up here.',
    'de-DE': 'Gespeicherte Zwischensumme, Steuer und Gesamtsumme zuordnen, und sie werden genau so gedruckt. Ohne Zuordnung werden die Positionen hier addiert.',
    'fr-FR': 'Associez le sous-total, la taxe et le total enregistrés : ils sont imprimés tels quels. Sans correspondance, les lignes sont additionnées ici.',
    'cs-CZ': 'Přiřaďte uložený mezisoučet, daň a celkovou částku a vytisknou se přesně tak. Bez přiřazení se položky sečtou zde.',
    'da-DK': 'Tilknyt den gemte subtotal, afgift og total, så trykkes de præcis som gemt. Uden tilknytning lægges linjerne sammen her.',
    'zh-CN': '映射存储的小计、税额和合计，即按存储值原样打印。不映射时在此处合计明细。',
    'zh-TW': '對應儲存的小計、稅額和合計，即依儲存值原樣列印。不對應時在此處合計明細。',
    'ar-EG': 'اربط المجموع الفرعي والضريبة والإجمالي المخزنة فتُطبع كما هي تماماً. بدون ربط تُجمع البنود هنا.',
  },
  type: 'money',
  required: false,
};

const PAID: OutlineSlot = {
  id: 'paid',
  label: {
    'en-US': 'Paid so far',
    'de-DE': 'Bisher bezahlt',
    'fr-FR': 'Déjà réglé',
    'cs-CZ': 'Dosud uhrazeno',
    'da-DK': 'Betalt indtil nu',
    'zh-CN': '已付金额',
    'zh-TW': '已付金額',
    'ar-EG': 'المدفوع حتى الآن',
  },
  type: 'money',
  required: false,
};

const BALANCE: OutlineSlot = {
  id: 'balance',
  label: {
    'en-US': 'Amount due',
    'de-DE': 'Offener Betrag',
    'fr-FR': 'Montant dû',
    'cs-CZ': 'K úhradě',
    'da-DK': 'Skyldigt beløb',
    'zh-CN': '应付金额',
    'zh-TW': '應付金額',
    'ar-EG': 'المبلغ المستحق',
  },
  type: 'money',
  required: false,
};

const STATUS: OutlineSlot = {
  id: 'status',
  label: {
    'en-US': 'State',
    'de-DE': 'Status',
    'fr-FR': 'Statut',
    'cs-CZ': 'Stav',
    'da-DK': 'Status',
    'zh-CN': '状态',
    'zh-TW': '狀態',
    'ar-EG': 'الحالة',
  },
  help: {
    'en-US': 'When it says void, the document is drawn marked Void, with the day it was voided and never the reason.',
    'de-DE': 'Steht hier void, wird der Beleg als storniert gezeichnet, mit dem Tag der Stornierung und nie dem Grund.',
    'fr-FR': 'Quand il vaut void, le document est dessiné marqué Annulé, avec le jour de l’annulation et jamais le motif.',
    'cs-CZ': 'Když je zde void, doklad se vykreslí jako stornovaný, s dnem storna a nikdy s důvodem.',
    'da-DK': 'Når der står void, tegnes bilaget som annulleret, med dagen for annulleringen og aldrig grunden.',
    'zh-CN': '值为 void 时，单据会标为作废，附作废日期，从不显示原因。',
    'zh-TW': '值為 void 時，單據會標為作廢，附作廢日期，從不顯示原因。',
    'ar-EG': 'عندما تكون القيمة void يُرسم المستند موسوماً بالإلغاء، مع يوم الإلغاء ودون السبب أبداً.',
  },
  type: 'text',
  required: false,
};

const VOIDED_ON: OutlineSlot = {
  id: 'voidedOn',
  label: {
    'en-US': 'Voided on',
    'de-DE': 'Storniert am',
    'fr-FR': 'Annulé le',
    'cs-CZ': 'Stornováno dne',
    'da-DK': 'Annulleret den',
    'zh-CN': '作废日期',
    'zh-TW': '作廢日期',
    'ar-EG': 'تاريخ الإلغاء',
  },
  type: 'date',
  required: false,
};

const PREPARED_BY: OutlineSlot = {
  id: 'preparedBy',
  label: {
    'en-US': 'Prepared by',
    'de-DE': 'Erstellt von',
    'fr-FR': 'Préparé par',
    'cs-CZ': 'Vystavil',
    'da-DK': 'Udarbejdet af',
    'zh-CN': '经办人',
    'zh-TW': '經辦人',
    'ar-EG': 'أعدّه',
  },
  type: 'text',
  required: false,
};

const SENT_ON: OutlineSlot = {
  id: 'sentOn',
  label: {
    'en-US': 'Sent on',
    'de-DE': 'Gesendet am',
    'fr-FR': 'Envoyé le',
    'cs-CZ': 'Odesláno dne',
    'da-DK': 'Sendt den',
    'zh-CN': '发送日期',
    'zh-TW': '發送日期',
    'ar-EG': 'تاريخ الإرسال',
  },
  type: 'date',
  required: false,
};

const VALID_UNTIL: OutlineSlot = {
  id: 'validUntil',
  label: {
    'en-US': 'Valid until',
    'de-DE': 'Gültig bis',
    'fr-FR': 'Valable jusqu’au',
    'cs-CZ': 'Platí do',
    'da-DK': 'Gyldig til',
    'zh-CN': '有效期至',
    'zh-TW': '有效期至',
    'ar-EG': 'صالح حتى',
  },
  type: 'date',
  required: false,
};

const SCOPE: OutlineSlot = {
  id: 'scope',
  label: {
    'en-US': 'What it covers',
    'de-DE': 'Umfang',
    'fr-FR': 'Périmètre',
    'cs-CZ': 'Rozsah',
    'da-DK': 'Omfang',
    'zh-CN': '范围',
    'zh-TW': '範圍',
    'ar-EG': 'النطاق',
  },
  help: {
    'en-US': 'Paragraphs printed under the title, one each.',
    'de-DE': 'Absätze unter dem Betreff, je einer.',
    'fr-FR': 'Paragraphes imprimés sous l’objet, un par un.',
    'cs-CZ': 'Odstavce vytištěné pod předmětem, každý zvlášť.',
    'da-DK': 'Afsnit trykt under emnet, ét ad gangen.',
    'zh-CN': '印在事由下方的段落，每段一条。',
    'zh-TW': '印在事由下方的段落，每段一條。',
    'ar-EG': 'فقرات تُطبع تحت الموضوع، كل واحدة على حدة.',
  },
  type: 'text[]',
  required: false,
};

const PAYMENT_SPLIT: OutlineSlot = {
  id: 'paymentSplit',
  label: {
    'en-US': 'How it gets paid',
    'de-DE': 'Zahlungsaufteilung',
    'fr-FR': 'Échéancier',
    'cs-CZ': 'Rozložení plateb',
    'da-DK': 'Betalingsopdeling',
    'zh-CN': '付款安排',
    'zh-TW': '付款安排',
    'ar-EG': 'طريقة الدفع',
  },
  type: 'text[]',
  required: false,
};

const SIGNED_NAME: OutlineSlot = {
  id: 'signedName',
  label: {
    'en-US': 'Accepted and signed by',
    'de-DE': 'Angenommen und unterschrieben von',
    'fr-FR': 'Accepté et signé par',
    'cs-CZ': 'Přijal a podepsal',
    'da-DK': 'Accepteret og underskrevet af',
    'zh-CN': '接受并签署人',
    'zh-TW': '接受並簽署人',
    'ar-EG': 'قبِله ووقّعه',
  },
  type: 'text',
  required: false,
};

const SIGNED_ON: OutlineSlot = {
  id: 'signedOn',
  label: {
    'en-US': 'Signed on',
    'de-DE': 'Unterschrieben am',
    'fr-FR': 'Signé le',
    'cs-CZ': 'Podepsáno dne',
    'da-DK': 'Underskrevet den',
    'zh-CN': '签署日期',
    'zh-TW': '簽署日期',
    'ar-EG': 'تاريخ التوقيع',
  },
  type: 'date',
  required: false,
};

const TERMS_VERSION: OutlineSlot = {
  id: 'termsVersion',
  label: {
    'en-US': 'Terms version',
    'de-DE': 'Fassung der Bedingungen',
    'fr-FR': 'Version des conditions',
    'cs-CZ': 'Verze podmínek',
    'da-DK': 'Vilkårsversion',
    'zh-CN': '条款版本',
    'zh-TW': '條款版本',
    'ar-EG': 'إصدار الشروط',
  },
  type: 'text',
  required: false,
};

const FINGERPRINT: OutlineSlot = {
  id: 'fingerprint',
  label: {
    'en-US': 'Fingerprint',
    'de-DE': 'Fingerabdruck',
    'fr-FR': 'Empreinte',
    'cs-CZ': 'Otisk',
    'da-DK': 'Fingeraftryk',
    'zh-CN': '指纹',
    'zh-TW': '指紋',
    'ar-EG': 'البصمة',
  },
  help: {
    'en-US': 'Printed shortened, first four and last four characters.',
    'de-DE': 'Gekürzt gedruckt, die ersten und letzten vier Zeichen.',
    'fr-FR': 'Imprimée abrégée : les quatre premiers et les quatre derniers caractères.',
    'cs-CZ': 'Tiskne se zkráceně, první a poslední čtyři znaky.',
    'da-DK': 'Trykkes forkortet, de første og sidste fire tegn.',
    'zh-CN': '缩短打印，保留前四位和后四位。',
    'zh-TW': '縮短列印，保留前四位和後四位。',
    'ar-EG': 'تُطبع مختصرة: أول أربعة أحرف وآخر أربعة.',
  },
  type: 'text',
  required: false,
};

const AMOUNT: OutlineSlot = {
  id: 'amount',
  label: {
    'en-US': 'Amount received',
    'de-DE': 'Erhaltener Betrag',
    'fr-FR': 'Montant reçu',
    'cs-CZ': 'Přijatá částka',
    'da-DK': 'Modtaget beløb',
    'zh-CN': '收款金额',
    'zh-TW': '收款金額',
    'ar-EG': 'المبلغ المستلم',
  },
  type: 'money',
  required: false,
};

const INVOICE_NUMBER: OutlineSlot = {
  id: 'invoiceNumber',
  label: {
    'en-US': 'For invoice',
    'de-DE': 'Zu Rechnung',
    'fr-FR': 'Pour la facture',
    'cs-CZ': 'K faktuře',
    'da-DK': 'Til faktura',
    'zh-CN': '对应发票',
    'zh-TW': '對應發票',
    'ar-EG': 'عن الفاتورة',
  },
  type: 'text',
  required: false,
};

const INVOICE_TOTAL: OutlineSlot = {
  id: 'invoiceTotal',
  label: {
    'en-US': 'Invoice total',
    'de-DE': 'Rechnungsbetrag',
    'fr-FR': 'Total de la facture',
    'cs-CZ': 'Celkem na faktuře',
    'da-DK': 'Fakturabeløb',
    'zh-CN': '发票合计',
    'zh-TW': '發票合計',
    'ar-EG': 'إجمالي الفاتورة',
  },
  type: 'money',
  required: false,
};

const BALANCE_AFTER: OutlineSlot = {
  id: 'balanceAfter',
  label: {
    'en-US': 'Balance left',
    'de-DE': 'Restbetrag',
    'fr-FR': 'Reste à régler',
    'cs-CZ': 'Zbývá uhradit',
    'da-DK': 'Resterende beløb',
    'zh-CN': '剩余金额',
    'zh-TW': '剩餘金額',
    'ar-EG': 'الرصيد المتبقي',
  },
  type: 'money',
  required: false,
};

const VOIDED: OutlineSlot = {
  id: 'voided',
  label: {
    'en-US': 'Voided',
    'de-DE': 'Storniert',
    'fr-FR': 'Annulé',
    'cs-CZ': 'Stornováno',
    'da-DK': 'Annulleret',
    'zh-CN': '已作废',
    'zh-TW': '已作廢',
    'ar-EG': 'ملغى',
  },
  help: {
    'en-US': 'True when the payment was voided: its receipt is then drawn marked Void.',
    'de-DE': 'Wahr, wenn die Zahlung storniert wurde: die Quittung wird dann als storniert gezeichnet.',
    'fr-FR': 'Vrai quand le règlement a été annulé : son reçu est alors dessiné marqué Annulé.',
    'cs-CZ': 'Pravda, když byla platba stornována: stvrzenka se pak vykreslí jako stornovaná.',
    'da-DK': 'Sand, når betalingen er annulleret: kvitteringen tegnes da som annulleret.',
    'zh-CN': '付款已作废时为真：其收据会标为作废。',
    'zh-TW': '付款已作廢時為真：其收據會標為作廢。',
    'ar-EG': 'صحيح عند إلغاء الدفعة: عندها يُرسم إيصالها موسوماً بالإلغاء.',
  },
  type: 'text',
  required: false,
};

/*
 * ── WHAT A PAYMENT WAS FOR, WHEN IT WAS NOT AN INVOICE ─────────────────────
 *
 * A practice's receipt is for a VISIT, and the insurer who repays the patient
 * reads three things off it besides the amount: the day of the visit, who saw
 * the patient, and the claim number the insurer gave. A till's receipt maps
 * none of them — the sale is the service, the day is the day it was paid — so
 * every one is optional and drawn only when it holds a value. The names are
 * the trade's, not the clinic's: a stylist, a repair or a class uses them too.
 */

const SERVICE_DATE: OutlineSlot = {
  id: 'serviceDate',
  label: {
    'en-US': 'Date of service',
    'de-DE': 'Leistungsdatum',
    'fr-FR': 'Date de la prestation',
    'cs-CZ': 'Datum služby',
    'da-DK': 'Ydelsesdato',
    'zh-CN': '服务日期',
    'zh-TW': '服務日期',
    'ar-EG': 'تاريخ الخدمة',
  },
  help: {
    'en-US': 'The day the service was given — a visit, a treatment, a repair — when it is not the day of the payment.',
    'de-DE': 'Der Tag, an dem die Leistung erbracht wurde — ein Besuch, eine Behandlung, eine Reparatur —, wenn er nicht der Tag der Zahlung ist.',
    'fr-FR': 'Le jour de la prestation — une visite, un soin, une réparation — quand ce n’est pas le jour du règlement.',
    'cs-CZ': 'Den, kdy byla služba poskytnuta — návštěva, ošetření, oprava — pokud to není den platby.',
    'da-DK': 'Dagen, ydelsen blev givet — et besøg, en behandling, en reparation — når det ikke er betalingsdagen.',
    'zh-CN': '提供服务的日期——一次就诊、一次治疗、一次维修——与付款日期不同时填写。',
    'zh-TW': '提供服務的日期——一次看診、一次治療、一次維修——與付款日期不同時填寫。',
    'ar-EG': 'يوم تقديم الخدمة — زيارة أو علاج أو إصلاح — إذا لم يكن يوم الدفع.',
  },
  type: 'date',
  required: false,
};

const ATTENDED_BY: OutlineSlot = {
  id: 'attendedBy',
  label: {
    'en-US': 'Attended by',
    'de-DE': 'Betreut von',
    'fr-FR': 'Pris en charge par',
    'cs-CZ': 'Obsluha',
    'da-DK': 'Betjent af',
    'zh-CN': '服务人员',
    'zh-TW': '服務人員',
    'ar-EG': 'مقدّم الخدمة',
  },
  help: {
    'en-US': 'Who gave the service or served at the till — a clinician, a stylist, a cashier.',
    'de-DE': 'Wer die Leistung erbracht oder an der Kasse bedient hat — eine Ärztin, ein Friseur, eine Kassiererin.',
    'fr-FR': 'Qui a assuré la prestation ou servi en caisse — une praticienne, un coiffeur, une caissière.',
    'cs-CZ': 'Kdo službu poskytl nebo obsluhoval u pokladny — lékařka, kadeřník, pokladní.',
    'da-DK': 'Hvem der gav ydelsen eller betjente kassen — en behandler, en frisør, en kasseassistent.',
    'zh-CN': '提供服务或在收银台接待的人——医生、发型师、收银员。',
    'zh-TW': '提供服務或在收銀台接待的人——醫師、髮型師、收銀員。',
    'ar-EG': 'من قدّم الخدمة أو خدم عند الصندوق — طبيب أو مصفف شعر أو أمين صندوق.',
  },
  type: 'text',
  required: false,
};

const REFERENCE: OutlineSlot = {
  id: 'reference',
  label: {
    'en-US': 'Reference',
    'de-DE': 'Referenz',
    'fr-FR': 'Référence',
    'cs-CZ': 'Referenční číslo',
    'da-DK': 'Reference',
    'zh-CN': '参考号',
    'zh-TW': '參考號',
    'ar-EG': 'المرجع',
  },
  help: {
    'en-US': 'A number somebody asked to see on the receipt — an insurer’s claim or authorisation number, an order number.',
    'de-DE': 'Eine Nummer, die jemand auf der Quittung sehen will — die Schadens- oder Genehmigungsnummer einer Versicherung, eine Bestellnummer.',
    'fr-FR': 'Un numéro que quelqu’un veut voir sur le reçu — le numéro de dossier ou d’accord d’un assureur, un numéro de commande.',
    'cs-CZ': 'Číslo, které někdo chce na stvrzence vidět — číslo pojistné události nebo schválení od pojišťovny, číslo objednávky.',
    'da-DK': 'Et nummer, nogen vil se på kvitteringen — et forsikringsselskabs skade- eller godkendelsesnummer, et ordrenummer.',
    'zh-CN': '有人要求在收据上看到的编号——保险公司的理赔号或授权号、订单号。',
    'zh-TW': '有人要求在收據上看到的編號——保險公司的理賠號或授權號、訂單號。',
    'ar-EG': 'رقم طلب أحدهم رؤيته على الإيصال — رقم مطالبة أو موافقة من شركة التأمين، أو رقم طلب.',
  },
  type: 'text',
  required: false,
};

const PERIOD_FROM: OutlineSlot = {
  id: 'periodFrom',
  label: {
    'en-US': 'Period from',
    'de-DE': 'Zeitraum ab',
    'fr-FR': 'Période du',
    'cs-CZ': 'Období od',
    'da-DK': 'Periode fra',
    'zh-CN': '期间起始',
    'zh-TW': '期間起始',
    'ar-EG': 'الفترة من',
  },
  type: 'date',
  required: false,
};

const PERIOD_TO: OutlineSlot = {
  id: 'periodTo',
  label: {
    'en-US': 'Period to',
    'de-DE': 'Zeitraum bis',
    'fr-FR': 'Période au',
    'cs-CZ': 'Období do',
    'da-DK': 'Periode til',
    'zh-CN': '期间截止',
    'zh-TW': '期間截止',
    'ar-EG': 'الفترة إلى',
  },
  type: 'date',
  required: false,
};

const OPENING_BALANCE: OutlineSlot = {
  id: 'openingBalance',
  label: {
    'en-US': 'Owed at the start',
    'de-DE': 'Stand zu Beginn',
    'fr-FR': 'Solde d’ouverture',
    'cs-CZ': 'Počáteční zůstatek',
    'da-DK': 'Primosaldo',
    'zh-CN': '期初余额',
    'zh-TW': '期初餘額',
    'ar-EG': 'الرصيد الافتتاحي',
  },
  type: 'money',
  required: false,
};

const DOCUMENTS_TOTAL: OutlineSlot = {
  id: 'documentsTotal',
  label: {
    'en-US': 'Invoiced',
    'de-DE': 'In Rechnung gestellt',
    'fr-FR': 'Facturé',
    'cs-CZ': 'Fakturováno',
    'da-DK': 'Faktureret',
    'zh-CN': '开票合计',
    'zh-TW': '開票合計',
    'ar-EG': 'المفوتر',
  },
  type: 'money',
  required: false,
};

const PAYMENTS_TOTAL: OutlineSlot = {
  id: 'paymentsTotal',
  label: {
    'en-US': 'Paid',
    'de-DE': 'Bezahlt',
    'fr-FR': 'Réglé',
    'cs-CZ': 'Uhrazeno',
    'da-DK': 'Betalt',
    'zh-CN': '已付',
    'zh-TW': '已付',
    'ar-EG': 'المدفوع',
  },
  type: 'money',
  required: false,
};

const CLOSING_BALANCE: OutlineSlot = {
  id: 'closingBalance',
  label: {
    'en-US': 'Still open',
    'de-DE': 'Noch offen',
    'fr-FR': 'Reste dû',
    'cs-CZ': 'Zbývá',
    'da-DK': 'Udestående',
    'zh-CN': '未结余额',
    'zh-TW': '未結餘額',
    'ar-EG': 'المتبقي',
  },
  type: 'money',
  required: false,
};

const PAYMENTS: OutlineSlot = {
  id: 'payments',
  label: {
    'en-US': 'Payments recorded',
    'de-DE': 'Erfasste Zahlungen',
    'fr-FR': 'Règlements enregistrés',
    'cs-CZ': 'Zaznamenané platby',
    'da-DK': 'Registrerede betalinger',
    'zh-CN': '已记录的付款',
    'zh-TW': '已記錄的付款',
    'ar-EG': 'المدفوعات المسجلة',
  },
  help: {
    'en-US': 'The payments against this document. Voided ones are left off the page.',
    'de-DE': 'Die Zahlungen zu diesem Beleg. Stornierte stehen nicht auf dem Blatt.',
    'fr-FR': 'Les règlements de ce document. Les annulés ne sont pas imprimés.',
    'cs-CZ': 'Platby k tomuto dokladu. Stornované se netisknou.',
    'da-DK': 'Betalingerne til dette bilag. Annullerede kommer ikke med på siden.',
    'zh-CN': '该单据的付款。已作废的不打印。',
    'zh-TW': '該單據的付款。已作廢的不列印。',
    'ar-EG': 'المدفوعات على هذا المستند. الملغاة لا تُطبع.',
  },
  type: 'collection',
  required: false,
  columns: [
    {
      id: 'number',
      label: {
        'en-US': 'Receipt number',
        'de-DE': 'Quittungsnummer',
        'fr-FR': 'Numéro du reçu',
        'cs-CZ': 'Číslo stvrzenky',
        'da-DK': 'Kvitteringsnummer',
        'zh-CN': '收据编号',
        'zh-TW': '收據編號',
        'ar-EG': 'رقم الإيصال',
      },
      type: 'text',
      required: false,
    },
    {
      id: 'paidOn',
      label: {
        'en-US': 'Paid on',
        'de-DE': 'Bezahlt am',
        'fr-FR': 'Réglé le',
        'cs-CZ': 'Uhrazeno dne',
        'da-DK': 'Betalt den',
        'zh-CN': '付款日期',
        'zh-TW': '付款日期',
        'ar-EG': 'تاريخ الدفع',
      },
      type: 'date',
      required: false,
    },
    {
      id: 'method',
      label: {
        'en-US': 'Method',
        'de-DE': 'Zahlungsweg',
        'fr-FR': 'Moyen',
        'cs-CZ': 'Způsob',
        'da-DK': 'Betalingsmåde',
        'zh-CN': '方式',
        'zh-TW': '方式',
        'ar-EG': 'الطريقة',
      },
      type: 'text',
      required: false,
    },
    {
      id: 'amount',
      label: {
        'en-US': 'Amount',
        'de-DE': 'Betrag',
        'fr-FR': 'Montant',
        'cs-CZ': 'Částka',
        'da-DK': 'Beløb',
        'zh-CN': '金额',
        'zh-TW': '金額',
        'ar-EG': 'المبلغ',
      },
      type: 'money',
      required: false,
    },
    {
      id: 'voided',
      label: {
        'en-US': 'Voided',
        'de-DE': 'Storniert',
        'fr-FR': 'Annulé',
        'cs-CZ': 'Stornováno',
        'da-DK': 'Annulleret',
        'zh-CN': '已作废',
        'zh-TW': '已作廢',
        'ar-EG': 'ملغى',
      },
      type: 'text',
      required: false,
    },
  ],
};

const ENTRIES: OutlineSlot = {
  id: 'entries',
  label: {
    'en-US': 'Entries',
    'de-DE': 'Buchungen',
    'fr-FR': 'Écritures',
    'cs-CZ': 'Položky výpisu',
    'da-DK': 'Poster',
    'zh-CN': '明细',
    'zh-TW': '明細',
    'ar-EG': 'القيود',
  },
  help: {
    'en-US': 'One row per document and per payment in the period, oldest first, with the balance after each.',
    'de-DE': 'Eine Zeile je Beleg und je Zahlung im Zeitraum, älteste zuerst, mit dem Saldo danach.',
    'fr-FR': 'Une ligne par document et par règlement de la période, du plus ancien au plus récent, avec le solde après chacun.',
    'cs-CZ': 'Jeden řádek na doklad a na platbu v období, od nejstarších, se zůstatkem po každém.',
    'da-DK': 'Én række pr. bilag og pr. betaling i perioden, ældste først, med saldoen efter hver.',
    'zh-CN': '期间内每张单据和每笔付款一行，按时间先后，附每笔之后的余额。',
    'zh-TW': '期間內每張單據和每筆付款一列，按時間先後，附每筆之後的餘額。',
    'ar-EG': 'صف لكل مستند ولكل دفعة في الفترة، الأقدم أولاً، مع الرصيد بعد كل منها.',
  },
  type: 'collection',
  required: false,
  columns: [
    {
      id: 'date',
      label: {
        'en-US': 'Date',
        'de-DE': 'Datum',
        'fr-FR': 'Date',
        'cs-CZ': 'Datum',
        'da-DK': 'Dato',
        'zh-CN': '日期',
        'zh-TW': '日期',
        'ar-EG': 'التاريخ',
      },
      type: 'date',
      required: false,
    },
    {
      id: 'kind',
      label: {
        'en-US': 'Entry kind',
        'de-DE': 'Art',
        'fr-FR': 'Type',
        'cs-CZ': 'Druh',
        'da-DK': 'Type',
        'zh-CN': '类型',
        'zh-TW': '類型',
        'ar-EG': 'النوع',
      },
      type: 'text',
      required: false,
    },
    {
      id: 'number',
      label: {
        'en-US': 'Number',
        'de-DE': 'Nummer',
        'fr-FR': 'Numéro',
        'cs-CZ': 'Číslo',
        'da-DK': 'Nummer',
        'zh-CN': '编号',
        'zh-TW': '編號',
        'ar-EG': 'الرقم',
      },
      type: 'text',
      required: false,
    },
    {
      id: 'amount',
      label: {
        'en-US': 'Amount',
        'de-DE': 'Betrag',
        'fr-FR': 'Montant',
        'cs-CZ': 'Částka',
        'da-DK': 'Beløb',
        'zh-CN': '金额',
        'zh-TW': '金額',
        'ar-EG': 'المبلغ',
      },
      type: 'money',
      required: false,
    },
    {
      id: 'balance',
      label: {
        'en-US': 'Balance after',
        'de-DE': 'Saldo danach',
        'fr-FR': 'Solde après',
        'cs-CZ': 'Zůstatek po',
        'da-DK': 'Saldo efter',
        'zh-CN': '之后余额',
        'zh-TW': '之後餘額',
        'ar-EG': 'الرصيد بعده',
      },
      type: 'money',
      required: false,
    },
  ],
};

/** On a receipt the customer is optional: a till receipt names nobody, and a payment's client is two rows away. */
const CUSTOMER_NAME_OPTIONAL: OutlineSlot = { ...CUSTOMER_NAME, required: false };

/** The details every kind can carry about the party a document is made out to. */
const PARTY: readonly OutlineSlot[] = [CUSTOMER_CONTACT, CUSTOMER_TAX_NUMBER];

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

/** The figures Adminium stores on a document built on a shape, printed as stored. */
const STORED_TOTALS: readonly OutlineSlot[] = [TAX_NAME, SUBTOTAL, TAX, TOTAL];

const OUTLINES: Readonly<Record<string, DocumentOutline>> = {
  invoice: {
    slots: [
      ...SHARED,
      DUE_AT,
      PO_NUMBER,
      TITLE,
      ...PARTY,
      TERMS,
      ...STORED_TOTALS,
      PAID,
      BALANCE,
      PAYMENTS,
      STATUS,
      VOIDED_ON,
      PREPARED_BY,
    ],
  },
  /*
   * `paidWith` and `tip` are drawn nowhere in `Invoice Builder.dc.html`, and
   * that is not an oversight on either side: the comp is the INVOICE authoring
   * surface, and a receipt is what a till prints after money has changed hands
   * (34 §6.1 — the point-of-sale mount is the owner's own example). They have a
   * caller in 34f and none in the comp.
   *
   * The receipt of ONE PAYMENT — a shape's payments row — maps `amount`, the
   * invoice it pays and the balance left, and `paidWith` to its method.
   *
   * The receipt of a SALE — a till's ticket — maps its lines, the stored
   * subtotal, tax and total (the total before the gratuity) and the tip, and
   * may map what was received too; its lines are drawn either way. A visit's
   * receipt adds the day of the visit, who gave it and the payer's reference.
   */
  receipt: {
    slots: [
      NUMBER,
      ISSUED_AT,
      CUSTOMER_NAME_OPTIONAL,
      CUSTOMER_LINES,
      CUSTOMER_EMAIL,
      CURRENCY,
      ITEMS,
      TAX_RATE,
      DISCOUNT_RATE,
      PAID_WITH,
      TIP,
      TITLE,
      ...PARTY,
      ...STORED_TOTALS,
      AMOUNT,
      INVOICE_NUMBER,
      INVOICE_TOTAL,
      BALANCE_AFTER,
      VOIDED,
      VOIDED_ON,
      SERVICE_DATE,
      ATTENDED_BY,
      REFERENCE,
      PREPARED_BY,
    ],
  },
  'credit-note': { slots: [...SHARED, REFERENCES, TITLE, ...PARTY, PREPARED_BY] },
  quote: {
    slots: [
      ...SHARED,
      TITLE,
      ...PARTY,
      ...STORED_TOTALS,
      STATUS,
      SENT_ON,
      VALID_UNTIL,
      SCOPE,
      PAYMENT_SPLIT,
      SIGNED_NAME,
      SIGNED_ON,
      TERMS_VERSION,
      FINGERPRINT,
      PREPARED_BY,
    ],
  },
  /*
   * A statement is one client and a period, not one row and its lines: no
   * number of its own (it is not a document in any series), and its entries
   * and balances come from Adminium's statement read, keyed by the slot ids
   * here — `entries` (date, kind, number, amount, balance after), the opening
   * balance, the two totals and what is still open.
   */
  statement: {
    slots: [
      ISSUED_AT,
      CUSTOMER_NAME,
      CUSTOMER_LINES,
      CUSTOMER_EMAIL,
      ...PARTY,
      CURRENCY,
      PERIOD_FROM,
      PERIOD_TO,
      OPENING_BALANCE,
      DOCUMENTS_TOTAL,
      PAYMENTS_TOTAL,
      CLOSING_BALANCE,
      ENTRIES,
      PREPARED_BY,
    ],
  },
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
  {
    id: 'quote',
    label: KIND_LABELS.quote,
    formats: ['html', 'pdf'],
    paper: ['a4', 'letter'],
    coverage: 'winansi',
  },
  {
    id: 'statement',
    label: KIND_LABELS.statement,
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
