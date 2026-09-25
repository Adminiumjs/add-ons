/**
 * The words a DRAWN document uses — "Subtotal", "Total", "Issued", "How to
 * pay", "Payments so far" — in all eight compiled locales.
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

/**
 * Every fixed word the printed sheet carries, for every kind.
 *
 * `{name}`-style holes are filled by `fill` below, once, with values that are
 * already formatted for the document's language — never re-read as a pattern.
 * The words follow the printed copy's own wording (the invoice's "How to pay",
 * "Payments so far", "Amount due"; the receipt's "Thank you"; the statement's
 * "Statement of account").
 */
export interface LayoutWords {
  readonly from: string;
  readonly to: string;
  readonly invoiceTo: string;
  readonly quoteFor: string;
  readonly receivedFrom: string;
  readonly statementFor: string;
  readonly issued: string;
  readonly due: string;
  readonly reference: string;
  readonly corrects: string;
  readonly terms: string;
  readonly voided: string;
  readonly sent: string;
  readonly validUntil: string;
  readonly forInvoice: string;
  readonly received: string;
  readonly method: string;
  readonly period: string;
  readonly documents: string;
  readonly kindInvoice: string;
  readonly kindReceipt: string;
  readonly kindCreditNote: string;
  readonly kindQuote: string;
  readonly kindStatement: string;
  readonly description: string;
  readonly quantity: string;
  readonly unit: string;
  readonly amount: string;
  readonly entry: string;
  readonly date: string;
  readonly balance: string;
  readonly subtotal: string;
  readonly reduction: string;
  readonly tax: string;
  readonly gratuity: string;
  readonly total: string;
  readonly invoiceTotal: string;
  readonly receivedOn: string;
  readonly balanceLeft: string;
  readonly invoiced: string;
  readonly paid: string;
  readonly openingBalance: string;
  readonly paymentsSoFar: string;
  readonly amountDue: string;
  readonly lessDiscount: string;
  readonly acceptedAndSigned: string;
  readonly termsVersion: string;
  readonly fingerprint: string;
  readonly howToPay: string;
  readonly referenceLine: string;
  readonly referenceInvoiceNumber: string;
  readonly howItGetsPaid: string;
  readonly thankYou: string;
  readonly receivedLine: string;
  readonly balanceLeftLine: string;
  readonly note: string;
  readonly receiptNote: string;
  readonly voidedFooter: string;
  readonly voidMark: string;
  readonly preparedBy: string;
  readonly taxNumber: string;
  readonly statementTitle: string;
  readonly invoiceEntry: string;
  readonly paymentEntry: string;
  readonly paymentAgainst: string;
  readonly receiptTitle: string;
  readonly termNet7: string;
  readonly termNet14: string;
  readonly termNet30: string;
  readonly termOnReceipt: string;
  readonly methodBankTransfer: string;
  readonly methodCard: string;
  readonly methodCheque: string;
  readonly methodCash: string;
  readonly methodOther: string;
  readonly settledWith: string;
  readonly notes: string;
  readonly payment: string;
  readonly noPdf: string;
}

const WORDS: Readonly<Record<string, LayoutWords>> = {
  'en-US': {
    from: 'From',
    to: 'Made out to',
    invoiceTo: 'Invoice to',
    quoteFor: 'Quote for',
    receivedFrom: 'Received from',
    statementFor: 'Statement for',
    issued: 'Issued',
    due: 'Due',
    reference: 'Their reference',
    corrects: 'Corrects document',
    terms: 'Terms',
    voided: 'Void',
    sent: 'Sent',
    validUntil: 'Valid until',
    forInvoice: 'For',
    received: 'Received',
    method: 'Method',
    period: 'Period',
    documents: 'Documents',
    kindInvoice: 'Invoice',
    kindReceipt: 'Receipt',
    kindCreditNote: 'Credit note',
    kindQuote: 'Quote',
    kindStatement: 'Statement',
    description: 'Description',
    quantity: 'Qty',
    unit: 'Rate',
    amount: 'Amount',
    entry: 'Entry',
    date: 'Date',
    balance: 'Balance',
    subtotal: 'Subtotal',
    reduction: 'Reduction',
    tax: 'Tax',
    gratuity: 'Gratuity',
    total: 'Total',
    invoiceTotal: 'Invoice total',
    receivedOn: 'Received {date}',
    balanceLeft: 'Balance left',
    invoiced: 'Invoiced',
    paid: 'Paid',
    openingBalance: 'Owed at the start',
    paymentsSoFar: 'Payments so far',
    amountDue: 'Amount due',
    lessDiscount: 'less {amount} discount',
    acceptedAndSigned: 'Accepted and signed',
    termsVersion: 'terms {version}',
    fingerprint: 'fingerprint {print}',
    howToPay: 'How to pay',
    referenceLine: 'Reference: {number}',
    referenceInvoiceNumber: 'Reference: the invoice number',
    howItGetsPaid: 'How it gets paid',
    thankYou: 'Thank you',
    receivedLine: '{amount} received {date}',
    balanceLeftLine: 'balance left {amount}',
    note: 'Note',
    receiptNote: 'This receipt confirms money received. It is not a new invoice.',
    voidedFooter: 'Voided on {date}. The number is kept so the sequence has no gaps. Nothing is owed on it.',
    voidMark: 'VOID',
    preparedBy: 'Prepared by {name}, {date}',
    taxNumber: 'Tax number {number}',
    statementTitle: 'Statement of account',
    invoiceEntry: 'Invoice {number}',
    paymentEntry: 'Payment {number}',
    paymentAgainst: 'Payment against {number}',
    receiptTitle: 'Receipt {number} · for {invoice}',
    termNet7: 'Net 7',
    termNet14: 'Net 14',
    termNet30: 'Net 30',
    termOnReceipt: 'On receipt',
    methodBankTransfer: 'Bank transfer',
    methodCard: 'Card',
    methodCheque: 'Cheque',
    methodCash: 'Cash',
    methodOther: 'Other',
    settledWith: 'Settled with',
    notes: 'Notes',
    payment: 'How to settle',
    noPdf: 'For this language, use Print and choose Save as PDF.',
  },
  'de-DE': {
    from: 'Von',
    to: 'Ausgestellt an',
    invoiceTo: 'Rechnung an',
    quoteFor: 'Angebot für',
    receivedFrom: 'Erhalten von',
    statementFor: 'Kontoauszug für',
    issued: 'Ausgestellt',
    due: 'Fällig',
    reference: 'Ihre Referenz',
    corrects: 'Berichtigt Beleg',
    terms: 'Bedingungen',
    voided: 'Storniert',
    sent: 'Gesendet',
    validUntil: 'Gültig bis',
    forInvoice: 'Zu',
    received: 'Erhalten',
    method: 'Zahlungsweg',
    period: 'Zeitraum',
    documents: 'Belege',
    kindInvoice: 'Rechnung',
    kindReceipt: 'Quittung',
    kindCreditNote: 'Gutschrift',
    kindQuote: 'Angebot',
    kindStatement: 'Kontoauszug',
    description: 'Beschreibung',
    quantity: 'Menge',
    unit: 'Einzelbetrag',
    amount: 'Betrag',
    entry: 'Buchung',
    date: 'Datum',
    balance: 'Saldo',
    subtotal: 'Zwischensumme',
    reduction: 'Nachlass',
    tax: 'Steuer',
    gratuity: 'Trinkgeld',
    total: 'Gesamt',
    invoiceTotal: 'Rechnungsbetrag',
    receivedOn: 'Erhalten am {date}',
    balanceLeft: 'Restbetrag',
    invoiced: 'In Rechnung gestellt',
    paid: 'Bezahlt',
    openingBalance: 'Stand zu Beginn',
    paymentsSoFar: 'Bisherige Zahlungen',
    amountDue: 'Offener Betrag',
    lessDiscount: 'abzüglich {amount} Nachlass',
    acceptedAndSigned: 'Angenommen und unterschrieben',
    termsVersion: 'Bedingungen {version}',
    fingerprint: 'Fingerabdruck {print}',
    howToPay: 'So bezahlen Sie',
    referenceLine: 'Verwendungszweck: {number}',
    referenceInvoiceNumber: 'Verwendungszweck: die Rechnungsnummer',
    howItGetsPaid: 'Zahlungsaufteilung',
    thankYou: 'Vielen Dank',
    receivedLine: '{amount} erhalten am {date}',
    balanceLeftLine: 'Restbetrag {amount}',
    note: 'Hinweis',
    receiptNote: 'Diese Quittung bestätigt einen erhaltenen Betrag. Sie ist keine neue Rechnung.',
    voidedFooter: 'Storniert am {date}. Die Nummer bleibt vergeben, damit die Reihe lückenlos bleibt. Es ist nichts zu zahlen.',
    voidMark: 'STORNIERT',
    preparedBy: 'Erstellt von {name}, {date}',
    taxNumber: 'Steuernummer {number}',
    statementTitle: 'Kontoauszug',
    invoiceEntry: 'Rechnung {number}',
    paymentEntry: 'Zahlung {number}',
    paymentAgainst: 'Zahlung zu {number}',
    receiptTitle: 'Quittung {number} · zu {invoice}',
    termNet7: 'Netto 7 Tage',
    termNet14: 'Netto 14 Tage',
    termNet30: 'Netto 30 Tage',
    termOnReceipt: 'Bei Erhalt',
    methodBankTransfer: 'Überweisung',
    methodCard: 'Karte',
    methodCheque: 'Scheck',
    methodCash: 'Bar',
    methodOther: 'Sonstiges',
    settledWith: 'Beglichen mit',
    notes: 'Hinweise',
    payment: 'Zahlungsweg',
    noPdf: 'Für diese Sprache: Drucken wählen und als PDF sichern.',
  },
  'fr-FR': {
    from: 'De',
    to: 'Établi à l’ordre de',
    invoiceTo: 'Facturé à',
    quoteFor: 'Devis pour',
    receivedFrom: 'Reçu de',
    statementFor: 'Relevé pour',
    issued: 'Établi le',
    due: 'Échéance',
    reference: 'Votre référence',
    corrects: 'Rectifie le document',
    terms: 'Conditions',
    voided: 'Annulé',
    sent: 'Envoyé',
    validUntil: 'Valable jusqu’au',
    forInvoice: 'Pour',
    received: 'Reçu le',
    method: 'Moyen',
    period: 'Période',
    documents: 'Documents',
    kindInvoice: 'Facture',
    kindReceipt: 'Reçu',
    kindCreditNote: 'Avoir',
    kindQuote: 'Devis',
    kindStatement: 'Relevé',
    description: 'Désignation',
    quantity: 'Qté',
    unit: 'Montant unitaire',
    amount: 'Montant',
    entry: 'Écriture',
    date: 'Date',
    balance: 'Solde',
    subtotal: 'Sous-total',
    reduction: 'Remise',
    tax: 'Taxe',
    gratuity: 'Pourboire',
    total: 'Total',
    invoiceTotal: 'Total de la facture',
    receivedOn: 'Reçu le {date}',
    balanceLeft: 'Reste à régler',
    invoiced: 'Facturé',
    paid: 'Réglé',
    openingBalance: 'Solde d’ouverture',
    paymentsSoFar: 'Règlements reçus',
    amountDue: 'Montant dû',
    lessDiscount: 'moins {amount} de remise',
    acceptedAndSigned: 'Accepté et signé',
    termsVersion: 'conditions {version}',
    fingerprint: 'empreinte {print}',
    howToPay: 'Comment régler',
    referenceLine: 'Référence : {number}',
    referenceInvoiceNumber: 'Référence : le numéro de facture',
    howItGetsPaid: 'Échéancier',
    thankYou: 'Merci',
    receivedLine: '{amount} reçus le {date}',
    balanceLeftLine: 'reste à régler {amount}',
    note: 'Note',
    receiptNote: 'Ce reçu confirme une somme reçue. Ce n’est pas une nouvelle facture.',
    voidedFooter: 'Annulé le {date}. Le numéro est conservé pour que la série reste sans trou. Rien n’est dû.',
    voidMark: 'ANNULÉ',
    preparedBy: 'Préparé par {name}, le {date}',
    taxNumber: 'Numéro fiscal {number}',
    statementTitle: 'Relevé de compte',
    invoiceEntry: 'Facture {number}',
    paymentEntry: 'Règlement {number}',
    paymentAgainst: 'Règlement de {number}',
    receiptTitle: 'Reçu {number} · pour {invoice}',
    termNet7: 'Net 7 jours',
    termNet14: 'Net 14 jours',
    termNet30: 'Net 30 jours',
    termOnReceipt: 'À réception',
    methodBankTransfer: 'Virement',
    methodCard: 'Carte',
    methodCheque: 'Chèque',
    methodCash: 'Espèces',
    methodOther: 'Autre',
    settledWith: 'Réglé par',
    notes: 'Notes',
    payment: 'Modalités de règlement',
    noPdf: 'Pour cette langue, utilisez Imprimer puis Enregistrer en PDF.',
  },
  'cs-CZ': {
    from: 'Od',
    to: 'Vystaveno na',
    invoiceTo: 'Odběratel',
    quoteFor: 'Nabídka na jméno',
    receivedFrom: 'Přijato od',
    statementFor: 'Výpis na jméno',
    issued: 'Vystaveno',
    due: 'Splatnost',
    reference: 'Vaše značka',
    corrects: 'Opravuje doklad',
    terms: 'Podmínky',
    voided: 'Stornováno',
    sent: 'Odesláno',
    validUntil: 'Platí do',
    forInvoice: 'K faktuře',
    received: 'Přijato',
    method: 'Způsob',
    period: 'Období',
    documents: 'Doklady',
    kindInvoice: 'Faktura',
    kindReceipt: 'Stvrzenka',
    kindCreditNote: 'Dobropis',
    kindQuote: 'Nabídka',
    kindStatement: 'Výpis z účtu',
    description: 'Popis',
    quantity: 'Množství',
    unit: 'Za jednotku',
    amount: 'Částka',
    entry: 'Položka',
    date: 'Datum',
    balance: 'Zůstatek',
    subtotal: 'Mezisoučet',
    reduction: 'Sleva',
    tax: 'Daň',
    gratuity: 'Dýško',
    total: 'Celkem',
    invoiceTotal: 'Celkem na faktuře',
    receivedOn: 'Přijato {date}',
    balanceLeft: 'Zbývá uhradit',
    invoiced: 'Fakturováno',
    paid: 'Uhrazeno',
    openingBalance: 'Počáteční zůstatek',
    paymentsSoFar: 'Dosavadní platby',
    amountDue: 'K úhradě',
    lessDiscount: 'sleva {amount}',
    acceptedAndSigned: 'Přijato a podepsáno',
    termsVersion: 'podmínky {version}',
    fingerprint: 'otisk {print}',
    howToPay: 'Jak zaplatit',
    referenceLine: 'Označení platby: {number}',
    referenceInvoiceNumber: 'Označení platby: číslo faktury',
    howItGetsPaid: 'Rozložení plateb',
    thankYou: 'Děkujeme',
    receivedLine: '{amount} přijato {date}',
    balanceLeftLine: 'zbývá uhradit {amount}',
    note: 'Poznámka',
    receiptNote: 'Tato stvrzenka potvrzuje přijetí peněz. Není to nová faktura.',
    voidedFooter: 'Stornováno {date}. Číslo zůstává, aby řada neměla mezery. Nic se nedluží.',
    voidMark: 'STORNO',
    preparedBy: 'Vystavil {name}, {date}',
    taxNumber: 'DIČ {number}',
    statementTitle: 'Výpis z účtu',
    invoiceEntry: 'Faktura {number}',
    paymentEntry: 'Platba {number}',
    paymentAgainst: 'Platba k {number}',
    receiptTitle: 'Stvrzenka {number} · k {invoice}',
    termNet7: 'Splatnost 7 dní',
    termNet14: 'Splatnost 14 dní',
    termNet30: 'Splatnost 30 dní',
    termOnReceipt: 'Při převzetí',
    methodBankTransfer: 'Bankovní převod',
    methodCard: 'Karta',
    methodCheque: 'Šek',
    methodCash: 'Hotovost',
    methodOther: 'Jiné',
    settledWith: 'Uhrazeno čím',
    notes: 'Poznámky',
    payment: 'Jak uhradit',
    noPdf: 'U tohoto jazyka zvolte Tisk a uložte jako PDF.',
  },
  'da-DK': {
    from: 'Fra',
    to: 'Udstedt til',
    invoiceTo: 'Faktura til',
    quoteFor: 'Tilbud til',
    receivedFrom: 'Modtaget fra',
    statementFor: 'Kontoudtog for',
    issued: 'Udstedt',
    due: 'Forfald',
    reference: 'Jeres reference',
    corrects: 'Retter bilag',
    terms: 'Betingelser',
    voided: 'Annulleret',
    sent: 'Sendt',
    validUntil: 'Gyldig til',
    forInvoice: 'Til',
    received: 'Modtaget',
    method: 'Betalingsmåde',
    period: 'Periode',
    documents: 'Bilag',
    kindInvoice: 'Faktura',
    kindReceipt: 'Kvittering',
    kindCreditNote: 'Kreditnota',
    kindQuote: 'Tilbud',
    kindStatement: 'Kontoudtog',
    description: 'Beskrivelse',
    quantity: 'Antal',
    unit: 'Pr. enhed',
    amount: 'Beløb',
    entry: 'Post',
    date: 'Dato',
    balance: 'Saldo',
    subtotal: 'Subtotal',
    reduction: 'Rabat',
    tax: 'Afgift',
    gratuity: 'Drikkepenge',
    total: 'I alt',
    invoiceTotal: 'Fakturabeløb',
    receivedOn: 'Modtaget {date}',
    balanceLeft: 'Resterende',
    invoiced: 'Faktureret',
    paid: 'Betalt',
    openingBalance: 'Primosaldo',
    paymentsSoFar: 'Betalinger indtil nu',
    amountDue: 'Skyldigt beløb',
    lessDiscount: 'minus {amount} i rabat',
    acceptedAndSigned: 'Accepteret og underskrevet',
    termsVersion: 'vilkår {version}',
    fingerprint: 'fingeraftryk {print}',
    howToPay: 'Sådan betaler du',
    referenceLine: 'Reference: {number}',
    referenceInvoiceNumber: 'Reference: fakturanummeret',
    howItGetsPaid: 'Betalingsopdeling',
    thankYou: 'Tak',
    receivedLine: '{amount} modtaget {date}',
    balanceLeftLine: 'resterende {amount}',
    note: 'Bemærk',
    receiptNote: 'Denne kvittering bekræfter modtagne penge. Den er ikke en ny faktura.',
    voidedFooter: 'Annulleret {date}. Nummeret beholdes, så rækken ikke har huller. Intet skyldes.',
    voidMark: 'ANNULLERET',
    preparedBy: 'Udarbejdet af {name}, {date}',
    taxNumber: 'Skattenummer {number}',
    statementTitle: 'Kontoudtog',
    invoiceEntry: 'Faktura {number}',
    paymentEntry: 'Betaling {number}',
    paymentAgainst: 'Betaling til {number}',
    receiptTitle: 'Kvittering {number} · til {invoice}',
    termNet7: 'Netto 7 dage',
    termNet14: 'Netto 14 dage',
    termNet30: 'Netto 30 dage',
    termOnReceipt: 'Ved modtagelse',
    methodBankTransfer: 'Bankoverførsel',
    methodCard: 'Kort',
    methodCheque: 'Check',
    methodCash: 'Kontant',
    methodOther: 'Andet',
    settledWith: 'Betalt med',
    notes: 'Noter',
    payment: 'Sådan betales der',
    noPdf: 'Her: vælg Udskriv, og gem som PDF.',
  },
  'zh-CN': {
    from: '开具方',
    to: '抬头',
    invoiceTo: '发票抬头',
    quoteFor: '报价对象',
    receivedFrom: '付款方',
    statementFor: '对账对象',
    issued: '开具日期',
    due: '到期日',
    reference: '对方参考号',
    corrects: '更正单据',
    terms: '付款条件',
    voided: '已作废',
    sent: '发送日期',
    validUntil: '有效期至',
    forInvoice: '对应发票',
    received: '收款日期',
    method: '付款方式',
    period: '期间',
    documents: '单据',
    kindInvoice: '发票',
    kindReceipt: '收据',
    kindCreditNote: '贷记单',
    kindQuote: '报价单',
    kindStatement: '对账表',
    description: '说明',
    quantity: '数量',
    unit: '单价',
    amount: '金额',
    entry: '项目',
    date: '日期',
    balance: '余额',
    subtotal: '小计',
    reduction: '折让',
    tax: '税',
    gratuity: '小费',
    total: '合计',
    invoiceTotal: '发票合计',
    receivedOn: '{date} 收款',
    balanceLeft: '剩余金额',
    invoiced: '开票金额',
    paid: '已付',
    openingBalance: '期初余额',
    paymentsSoFar: '已收付款',
    amountDue: '应付金额',
    lessDiscount: '减免 {amount}',
    acceptedAndSigned: '已接受并签署',
    termsVersion: '条款 {version}',
    fingerprint: '指纹 {print}',
    howToPay: '付款方法',
    referenceLine: '付款备注：{number}',
    referenceInvoiceNumber: '付款备注：发票编号',
    howItGetsPaid: '付款安排',
    thankYou: '谢谢',
    receivedLine: '{date} 收到 {amount}',
    balanceLeftLine: '剩余 {amount}',
    note: '说明',
    receiptNote: '本收据确认已收到款项，并非新的发票。',
    voidedFooter: '已于 {date} 作废。编号保留，以免序列出现空缺。无需付款。',
    voidMark: '作废',
    preparedBy: '经办人 {name}，{date}',
    taxNumber: '税号 {number}',
    statementTitle: '往来对账表',
    invoiceEntry: '发票 {number}',
    paymentEntry: '付款 {number}',
    paymentAgainst: '支付 {number}',
    receiptTitle: '收据 {number} · 对应 {invoice}',
    termNet7: '7 天内付款',
    termNet14: '14 天内付款',
    termNet30: '30 天内付款',
    termOnReceipt: '收到即付',
    methodBankTransfer: '银行转账',
    methodCard: '银行卡',
    methodCheque: '支票',
    methodCash: '现金',
    methodOther: '其他',
    settledWith: '结算方式',
    notes: '备注',
    payment: '结算办法',
    noPdf: '此语言请使用“打印”并选择“另存为 PDF”。',
  },
  'zh-TW': {
    from: '開立方',
    to: '抬頭',
    invoiceTo: '發票抬頭',
    quoteFor: '報價對象',
    receivedFrom: '付款方',
    statementFor: '對帳對象',
    issued: '開立日期',
    due: '到期日',
    reference: '對方參考號',
    corrects: '更正單據',
    terms: '付款條件',
    voided: '已作廢',
    sent: '發送日期',
    validUntil: '有效期至',
    forInvoice: '對應發票',
    received: '收款日期',
    method: '付款方式',
    period: '期間',
    documents: '單據',
    kindInvoice: '發票',
    kindReceipt: '收據',
    kindCreditNote: '貸記單',
    kindQuote: '報價單',
    kindStatement: '對帳表',
    description: '說明',
    quantity: '數量',
    unit: '單價',
    amount: '金額',
    entry: '項目',
    date: '日期',
    balance: '餘額',
    subtotal: '小計',
    reduction: '折讓',
    tax: '稅',
    gratuity: '小費',
    total: '合計',
    invoiceTotal: '發票合計',
    receivedOn: '{date} 收款',
    balanceLeft: '剩餘金額',
    invoiced: '開票金額',
    paid: '已付',
    openingBalance: '期初餘額',
    paymentsSoFar: '已收付款',
    amountDue: '應付金額',
    lessDiscount: '減免 {amount}',
    acceptedAndSigned: '已接受並簽署',
    termsVersion: '條款 {version}',
    fingerprint: '指紋 {print}',
    howToPay: '付款方法',
    referenceLine: '付款備註：{number}',
    referenceInvoiceNumber: '付款備註：發票編號',
    howItGetsPaid: '付款安排',
    thankYou: '謝謝',
    receivedLine: '{date} 收到 {amount}',
    balanceLeftLine: '剩餘 {amount}',
    note: '說明',
    receiptNote: '本收據確認已收到款項，並非新的發票。',
    voidedFooter: '已於 {date} 作廢。編號保留，以免序列出現空缺。無需付款。',
    voidMark: '作廢',
    preparedBy: '經辦人 {name}，{date}',
    taxNumber: '稅號 {number}',
    statementTitle: '往來對帳表',
    invoiceEntry: '發票 {number}',
    paymentEntry: '付款 {number}',
    paymentAgainst: '支付 {number}',
    receiptTitle: '收據 {number} · 對應 {invoice}',
    termNet7: '7 天內付款',
    termNet14: '14 天內付款',
    termNet30: '30 天內付款',
    termOnReceipt: '收到即付',
    methodBankTransfer: '銀行轉帳',
    methodCard: '銀行卡',
    methodCheque: '支票',
    methodCash: '現金',
    methodOther: '其他',
    settledWith: '結算方式',
    notes: '備註',
    payment: '結算辦法',
    noPdf: '此語言請使用「列印」並選擇「另存為 PDF」。',
  },
  'ar-EG': {
    from: 'من',
    to: 'صادر إلى',
    invoiceTo: 'فاتورة إلى',
    quoteFor: 'عرض سعر إلى',
    receivedFrom: 'استُلم من',
    statementFor: 'كشف حساب لـ',
    issued: 'تاريخ الإصدار',
    due: 'تاريخ الاستحقاق',
    reference: 'مرجعهم',
    corrects: 'يصحّح المستند',
    terms: 'الشروط',
    voided: 'ملغاة',
    sent: 'أُرسل',
    validUntil: 'صالح حتى',
    forInvoice: 'عن',
    received: 'تاريخ الاستلام',
    method: 'الطريقة',
    period: 'الفترة',
    documents: 'المستندات',
    kindInvoice: 'فاتورة',
    kindReceipt: 'إيصال',
    kindCreditNote: 'إشعار دائن',
    kindQuote: 'عرض سعر',
    kindStatement: 'كشف حساب',
    description: 'الوصف',
    quantity: 'الكمية',
    unit: 'سعر الوحدة',
    amount: 'المبلغ',
    entry: 'القيد',
    date: 'التاريخ',
    balance: 'الرصيد',
    subtotal: 'المجموع الفرعي',
    reduction: 'الخصم',
    tax: 'الضريبة',
    gratuity: 'إكرامية',
    total: 'الإجمالي',
    invoiceTotal: 'إجمالي الفاتورة',
    receivedOn: 'استُلم في {date}',
    balanceLeft: 'الرصيد المتبقي',
    invoiced: 'المفوتر',
    paid: 'المدفوع',
    openingBalance: 'الرصيد الافتتاحي',
    paymentsSoFar: 'المدفوعات حتى الآن',
    amountDue: 'المبلغ المستحق',
    lessDiscount: 'مخصوم منه {amount}',
    acceptedAndSigned: 'قُبل ووُقّع',
    termsVersion: 'الشروط {version}',
    fingerprint: 'البصمة {print}',
    howToPay: 'طريقة الدفع',
    referenceLine: 'المرجع: {number}',
    referenceInvoiceNumber: 'المرجع: رقم الفاتورة',
    howItGetsPaid: 'مراحل الدفع',
    thankYou: 'شكراً لك',
    receivedLine: 'استُلم {amount} في {date}',
    balanceLeftLine: 'المتبقي {amount}',
    note: 'ملاحظة',
    receiptNote: 'يؤكد هذا الإيصال استلام المبلغ، وهو ليس فاتورة جديدة.',
    voidedFooter: 'أُلغيت في {date}. يُحتفظ بالرقم حتى لا يكون في التسلسل فراغ. لا شيء مستحق عليها.',
    voidMark: 'ملغاة',
    preparedBy: 'أعدّه {name}، {date}',
    taxNumber: 'الرقم الضريبي {number}',
    statementTitle: 'كشف حساب',
    invoiceEntry: 'فاتورة {number}',
    paymentEntry: 'دفعة {number}',
    paymentAgainst: 'دفعة عن {number}',
    receiptTitle: 'إيصال {number} · عن {invoice}',
    termNet7: 'صافي ٧ أيام',
    termNet14: 'صافي ١٤ يوماً',
    termNet30: 'صافي ٣٠ يوماً',
    termOnReceipt: 'عند الاستلام',
    methodBankTransfer: 'تحويل بنكي',
    methodCard: 'بطاقة',
    methodCheque: 'شيك',
    methodCash: 'نقداً',
    methodOther: 'أخرى',
    settledWith: 'تمت التسوية بـ',
    notes: 'ملاحظات',
    payment: 'طريقة السداد',
    noPdf: 'لهذه اللغة، استخدم الطباعة واختر الحفظ بصيغة PDF.',
  },
};

/** Fill `{hole}`s in one pass. A hole with no value is left as it is, which a test would see. */
export function fill(template: string, values: Readonly<Record<string, string>>): string {
  return template.replace(/\{([a-zA-Z]+)\}/g, (whole, name: string) => values[name] ?? whole);
}

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
