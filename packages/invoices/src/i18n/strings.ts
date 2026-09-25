/**
 * Every user-visible string this add-on has, in all eight locales.
 *
 * Same nested shape as every other add-on here — `{ locale: { key: value } }` —
 * because the host merges these into its own bundle and types the key union
 * off English. A locale missing a key is a COMPILE error at the foot of this
 * file, not a runtime fallback.
 *
 * Keys are namespaced under `addon.invoices.*`. Every add-on's strings land in
 * one flat bundle with the host's, so a bare `refuse.missing` would be a
 * collision waiting for the second add-on that refuses anything.
 *
 * ── WHAT IS NOT IN HERE, AND IT IS MOST OF THE WORDS THIS PACKAGE PRINTS ───
 *
 * The chrome ON a document — "Subtotal", "Total", "Issued on" — is in
 * `render/words.ts`, and the outline's slot labels are in `kinds.ts`. Three
 * files, three audiences, and conflating them is the mistake worth naming:
 *
 *   THIS FILE is read in the VIEWER's language, through the host's `t()`,
 *   inside this add-on's own bundle. It is the settings panel and the record
 *   button.
 *   `kinds.ts` is read by ADMINIUM, in Studio, where this bundle is not
 *   loaded and that `t()` does not exist.
 *   `render/words.ts` is read by nobody — it is PRINTED, in the DOCUMENT's
 *   language, which is neither of the other two.
 *
 * ── A NOTE FOR TRANSLATORS, AND IT IS NOT OPTIONAL ─────────────────────────
 *
 * The English avoids a short list of commercial words on purpose. The list is
 * not spelled out here — it lives in `testing/lexicon.ts` as the guard that
 * fails the build when one appears, so there is one copy of it and it is an
 * executable one rather than a comment that drifts.
 *
 * Please keep the equivalent restraint in your language rather than reaching
 * for the marketing word, and where your language's natural term happens to
 * contain one of the banned English fragments as a substring, prefer the
 * plainer phrase — the release check reads bytes, not meaning, so an innocent
 * word with an unlucky spelling still trips it. THIS BUNDLE HAS AN UNUSUALLY
 * BAD CASE OF THAT, and it is worth knowing before editing a line:
 *
 *   · the ordinary word for "percent" carries a banned run in German, Czech
 *     and Danish, so those three say the word for the RATE instead —
 *     `Satz`, `sazba`, `sats` — and never the cognate;
 *   · Czech's everyday preposition meaning "for" is itself a banned run, so
 *     the Czech throughout is written with `na`, `k` and `u`;
 *   · both standard Czech words for a gratuity carry it too, so the receipt
 *     says `dýško`;
 *   · the French for "entire" carries one, so the copy says `l’ensemble`, and
 *     so do `propres` and `prochain`, so the copy says `à vous` and `suivant`;
 *   · DANISH `sprog` — the ordinary word for "language" — carries one, which
 *     nothing warned about until this bundle: the Danish says `udgave`
 *     (version) wherever English says "language";
 *   · Czech `prohlížeč` (browser) carries one too, so the Czech says "where
 *     you open the page" rather than naming the browser;
 *   · in English, `property`, `approved`, `provide` and `professional` all
 *     carry one, which is why the copy says `field`, `agreed`, `gives` and
 *     `the work`.
 *
 * ── AND ONE RULE THAT IS THIS ADD-ON'S OWN ─────────────────────────────────
 *
 * Nothing here may suggest that this add-on TAKES money, charges a card or
 * decides a price. The figures on its documents are Adminium's — worked out
 * by the rules the add-on's shapes declare, or computed from lines somebody
 * mapped — and a payment is only ever what a person records. A translation
 * that softened "records a payment" into "collects payments" would be turning
 * a limit somebody can work around into a claim that is false.
 */

export const strings = {
  'en-US': {
    // ── host chrome this add-on owns ──────────────────────────────────────
    'addon.invoices.line':
      'Invoices, quotes, receipts, credit notes and statements drawn from your own records, in eight languages — printed, downloaded or emailed.',
    'addon.invoices.what':
      'This turns a row into a document somebody can keep. An app can build its invoices, quotes and payments on this add-on’s shapes: Adminium then numbers them without gaps, works out every line, the tax and the total in the currency’s own decimals, records each payment as somebody enters it, and holds three reminders for each unpaid invoice until somebody sends them. The documents print those stored figures as they are, with your letterhead and how to pay, in the document’s language — as a page for every language, and as a PDF for Latin text. It never takes a payment and never charges a card: money moves outside it, and a payment is only ever what a person records. Nothing is fetched from anywhere and no account is needed.',
    'addon.invoices.disconnect.goes':
      'The receipt and invoice buttons go from your record screens.',
    'addon.invoices.disconnect.stays':
      'Every document already made stays in your database, exactly as it was.',
    'addon.invoices.activity.rendered': 'a receipt was drawn',
    'addon.invoices.activity.sent': 'an invoice went out as a PDF',
    'addon.invoices.demo': 'sample',

    // ── settings panel ────────────────────────────────────────────────────
    'addon.invoices.settings.title': 'Letterhead and defaults',
    'addon.invoices.settings.intro':
      'These seed a new template. A template’s own values win, and a document keeps what its template had when it was made.',
    'addon.invoices.setting.business_name': 'Business name',
    'addon.invoices.setting.business_name.help': 'On every document’s letterhead.',
    'addon.invoices.setting.business_lines': 'Address lines',
    'addon.invoices.setting.business_lines.help':
      'One line each, under the name — your invoice address.',
    'addon.invoices.setting.logo_data_url': 'Letterhead image',
    'addon.invoices.setting.logo_data_url.help':
      'Small — 32 KB at most. It travels inside every document.',
    'addon.invoices.settings.section.letterhead': 'Letterhead',
    'addon.invoices.settings.section.numbers': 'Numbers',
    'addon.invoices.settings.section.defaults': 'New documents',
    'addon.invoices.settings.section.reminders': 'Reminders',
    'addon.invoices.settings.section.printing': 'Printing',
    'addon.invoices.setting.tax_name': 'Tax name',
    'addon.invoices.setting.tax_name.help': 'VAT, GST, Sales tax — printed beside the rate, and copied onto each new document.',
    'addon.invoices.setting.tax_number': 'Tax number',
    'addon.invoices.setting.tax_number.help': 'Printed in the letterhead, after the tax name.',
    'addon.invoices.setting.payment_instructions': 'How to pay',
    'addon.invoices.setting.payment_instructions.help': 'Bank details, or whatever your clients should follow. Printed on every invoice with its number as the reference. Your own staff screens and the documents show it, and a client signed in to an app sees it on their own invoices — never an open page.',
    'addon.invoices.setting.footer': 'Footer',
    'addon.invoices.setting.footer.help': 'Printed at the foot of invoices and statements, under Terms.',
    'addon.invoices.setting.default_tax_rate': 'Default tax rate',
    'addon.invoices.setting.default_tax_rate.help': 'A percentage, copied onto a document when it is created. Changing it never changes a document already made.',
    'addon.invoices.setting.default_terms': 'Default terms',
    'addon.invoices.setting.default_terms.help': 'When a new invoice falls due, counted from the day it is sent.',
    'addon.invoices.terms.net7': 'Net 7',
    'addon.invoices.terms.net14': 'Net 14',
    'addon.invoices.terms.net30': 'Net 30',
    'addon.invoices.terms.onReceipt': 'On receipt',
    'addon.invoices.setting.prefix_invoice': 'Invoice prefix',
    'addon.invoices.setting.prefix_receipt': 'Receipt prefix',
    'addon.invoices.setting.prefix_quote': 'Quote prefix',
    'addon.invoices.setting.prefix.help': 'Up to 12 letters, digits and - _ / . — a change applies from the next number.',
    'addon.invoices.setting.number_start_invoice': 'First invoice number',
    'addon.invoices.setting.number_start_receipt': 'First receipt number',
    'addon.invoices.setting.number_start_quote': 'First quote number',
    'addon.invoices.setting.number_start.help': 'Numbers run without gaps from here. The first number can only move up: a number already given is never given again.',
    'addon.invoices.setting.ladders': 'Reminder ladders',
    'addon.invoices.setting.ladders.help': 'The days after the due date when each of the three reminders wakes. Each one waits for somebody to send it.',
    'addon.invoices.ladder.gentle': 'Gentle',
    'addon.invoices.ladder.standard': 'Standard',
    'addon.invoices.ladder.firm': 'Firm',
    'addon.invoices.setting.default_ladder': 'Default ladder',
    'addon.invoices.setting.default_ladder.help': 'The ladder a new invoice starts with.',
    'addon.invoices.setting.show_payment_ledger': 'Show payments on documents',
    'addon.invoices.setting.show_payment_ledger.help': 'Lists each payment above the amount due. Off, only the amount due is printed.',
    'addon.invoices.problem.prefix': 'Up to 12 letters, digits and - _ / . only.',
    'addon.invoices.problem.start': 'The first number can only move up. {number} is the lowest it can be now.',
    'addon.invoices.problem.ladder': 'Three whole days, each later than the one before.',
    'addon.invoices.problem.rate': 'A rate from 0 to 100.',
    'addon.invoices.setting.terms': 'Terms',
    'addon.invoices.setting.terms.help':
      'Printed under the totals. One language — write it as you want it read.',
    'addon.invoices.setting.tax_label': 'Word for the tax line',
    'addon.invoices.setting.tax_label.help':
      'VAT, GST, Sales tax — your word. No tax line appears unless a rate or a column is mapped.',
    'addon.invoices.setting.paper': 'Paper',
    'addon.invoices.setting.paper.help': 'Receipts always use 80 mm.',
    'addon.invoices.setting.default_formats': 'What to draw',
    'addon.invoices.setting.default_formats.help':
      'PDF is drawn for Latin text; other scripts get a print-ready page instead. Stated, not hidden.',
    'addon.invoices.setting.entities': 'Where the button shows',
    'addon.invoices.setting.entities.help':
      'Which record kinds get a document button. What the columns mean is set where the button is mounted, never here.',
    'addon.invoices.sample.title': 'What a document looks like',
    'addon.invoices.sample.note': 'Drawn here from made-up figures.',
    'addon.invoices.logo.tooLarge':
      'That image is {size} and the limit is 32 KB. It travels inside every document, so it has to stay small.',

    // ── the record button ─────────────────────────────────────────────────
    'addon.invoices.record.title': 'Documents',
    'addon.invoices.record.make': 'Make a document',
    'addon.invoices.record.download': 'Download',
    'addon.invoices.record.print': 'Print',
    'addon.invoices.record.kind.invoice': 'Invoice',
    'addon.invoices.record.kind.receipt': 'Receipt',
    'addon.invoices.record.kind.creditNote': 'Credit note',
    'addon.invoices.record.kind.quote': 'Quote',
    'addon.invoices.record.kind.statement': 'Statement',
    'addon.invoices.record.none':
      'This kind of record has no document button yet. Add it in the add-on’s settings.',
    'addon.invoices.record.drawn': 'Drawn {kind} {number}.',
    'addon.invoices.refuse.missing':
      'Nothing was drawn: {columns} has no value on this record.',
    'addon.invoices.refuse.latinOnly':
      'The web page was drawn. The PDF was not: {glyphs} cannot be drawn in the built-in fonts. Use your browser’s own Save as PDF for this one.',
  },

  'de-DE': {
    'addon.invoices.line':
      'Rechnungen, Angebote, Quittungen, Gutschriften und Kontoauszüge aus Ihren eigenen Datensätzen, in acht Sprachen — gedruckt, heruntergeladen oder versendet.',
    'addon.invoices.what':
      'Hieraus wird aus einer Zeile ein Beleg, den jemand aufbewahren kann. Eine App kann ihre Rechnungen, Angebote und Zahlungen auf den Formen dieses Add-ons aufbauen: Adminium nummeriert sie dann lückenlos, rechnet jede Position, die Steuer und die Summe in den Nachkommastellen der Währung, erfasst jede Zahlung, sobald jemand sie einträgt, und hält für jede offene Rechnung drei Erinnerungen bereit, bis jemand sie sendet. Die Belege drucken diese gespeicherten Werte so, wie sie sind, mit Ihrem Briefkopf und dem Zahlungsweg, in der Sprache des Belegs — als Seite für jede Sprache und als PDF bei lateinischer Schrift. Es nimmt nie eine Zahlung entgegen und belastet nie eine Karte: Geld fließt außerhalb, und eine Zahlung ist immer nur das, was ein Mensch erfasst. Nichts wird irgendwoher geladen, und es ist kein Konto nötig.',
    'addon.invoices.disconnect.goes':
      'Die Schaltflächen für Quittung und Rechnung verschwinden von Ihren Datensatz-Bildschirmen.',
    'addon.invoices.disconnect.stays':
      'Jeder bereits erstellte Beleg bleibt unverändert in Ihrer Datenbank.',
    'addon.invoices.activity.rendered': 'eine Quittung wurde gezeichnet',
    'addon.invoices.activity.sent': 'eine Rechnung ging als PDF hinaus',
    'addon.invoices.demo': 'Beispiel',

    'addon.invoices.settings.title': 'Briefkopf und Vorgaben',
    'addon.invoices.settings.intro':
      'Diese Angaben füllen eine neue Vorlage vor. Die Werte der Vorlage gehen vor, und ein Beleg behält, was seine Vorlage bei der Erstellung hatte.',
    'addon.invoices.setting.business_name': 'Name des Unternehmens',
    'addon.invoices.setting.business_name.help': 'Auf dem Briefkopf jedes Belegs.',
    'addon.invoices.setting.business_lines': 'Anschriftzeilen',
    'addon.invoices.setting.business_lines.help':
      'Je eine Zeile, unter dem Namen — Ihre Rechnungsanschrift.',
    'addon.invoices.setting.logo_data_url': 'Bild für den Briefkopf',
    'addon.invoices.setting.logo_data_url.help':
      'Klein — höchstens 32 KB. Es steckt in jedem Beleg mit drin.',
    'addon.invoices.settings.section.letterhead': 'Briefkopf',
    'addon.invoices.settings.section.numbers': 'Nummern',
    'addon.invoices.settings.section.defaults': 'Neue Belege',
    'addon.invoices.settings.section.reminders': 'Erinnerungen',
    'addon.invoices.settings.section.printing': 'Druck',
    'addon.invoices.setting.tax_name': 'Steuerbezeichnung',
    'addon.invoices.setting.tax_name.help': 'MwSt., USt., Sales tax — neben dem Satz gedruckt und auf jeden neuen Beleg kopiert.',
    'addon.invoices.setting.tax_number': 'Steuernummer',
    'addon.invoices.setting.tax_number.help': 'Im Briefkopf gedruckt, nach der Steuerbezeichnung.',
    'addon.invoices.setting.payment_instructions': 'So bezahlen Sie',
    'addon.invoices.setting.payment_instructions.help': 'Bankverbindung oder was Ihre Kunden sonst befolgen sollen. Auf jede Rechnung gedruckt, mit ihrer Nummer als Verwendungszweck. Ihre eigenen Mitarbeiterbildschirme und die Belege zeigen es, und ein in einer App angemeldeter Kunde sieht es auf seinen eigenen Rechnungen — nie eine offene Seite.',
    'addon.invoices.setting.footer': 'Fußzeile',
    'addon.invoices.setting.footer.help': 'Unten auf Rechnungen und Kontoauszügen gedruckt, unter „Bedingungen“.',
    'addon.invoices.setting.default_tax_rate': 'Vorgabe-Steuersatz',
    'addon.invoices.setting.default_tax_rate.help': 'Ein Prozentsatz, beim Erstellen auf den Beleg kopiert. Eine Änderung ändert nie einen bereits erstellten Beleg.',
    'addon.invoices.setting.default_terms': 'Vorgabe-Zahlungsziel',
    'addon.invoices.setting.default_terms.help': 'Wann eine neue Rechnung fällig wird, gezählt ab dem Tag des Versands.',
    'addon.invoices.terms.net7': 'Netto 7 Tage',
    'addon.invoices.terms.net14': 'Netto 14 Tage',
    'addon.invoices.terms.net30': 'Netto 30 Tage',
    'addon.invoices.terms.onReceipt': 'Bei Erhalt',
    'addon.invoices.setting.prefix_invoice': 'Rechnungspräfix',
    'addon.invoices.setting.prefix_receipt': 'Quittungspräfix',
    'addon.invoices.setting.prefix_quote': 'Angebotspräfix',
    'addon.invoices.setting.prefix.help': 'Bis zu 12 Buchstaben, Ziffern und - _ / . — eine Änderung gilt ab der nächsten Nummer.',
    'addon.invoices.setting.number_start_invoice': 'Erste Rechnungsnummer',
    'addon.invoices.setting.number_start_receipt': 'Erste Quittungsnummer',
    'addon.invoices.setting.number_start_quote': 'Erste Angebotsnummer',
    'addon.invoices.setting.number_start.help': 'Ab hier laufen die Nummern lückenlos. Die erste Nummer kann nur steigen: eine vergebene Nummer wird nie erneut vergeben.',
    'addon.invoices.setting.ladders': 'Erinnerungsstufen',
    'addon.invoices.setting.ladders.help': 'Die Tage nach dem Fälligkeitstag, an denen jede der drei Erinnerungen bereitliegt. Jede wartet, bis jemand sie sendet.',
    'addon.invoices.ladder.gentle': 'Sanft',
    'addon.invoices.ladder.standard': 'Normal',
    'addon.invoices.ladder.firm': 'Bestimmt',
    'addon.invoices.setting.default_ladder': 'Vorgabe-Stufe',
    'addon.invoices.setting.default_ladder.help': 'Die Stufenfolge, mit der eine neue Rechnung beginnt.',
    'addon.invoices.setting.show_payment_ledger': 'Zahlungen auf Belegen zeigen',
    'addon.invoices.setting.show_payment_ledger.help': 'Führt jede Zahlung über dem offenen Betrag auf. Aus, wird nur der offene Betrag gedruckt.',
    'addon.invoices.problem.prefix': 'Nur bis zu 12 Buchstaben, Ziffern und - _ / .',
    'addon.invoices.problem.start': 'Die erste Nummer kann nur steigen. {number} ist jetzt der kleinste mögliche Wert.',
    'addon.invoices.problem.ladder': 'Drei ganze Tage, jeder später als der vorige.',
    'addon.invoices.problem.rate': 'Ein Satz von 0 bis 100.',
    'addon.invoices.setting.terms': 'Bedingungen',
    'addon.invoices.setting.terms.help':
      'Wird unter den Summen gedruckt. Eine Sprache — schreiben Sie es so, wie es gelesen werden soll.',
    'addon.invoices.setting.tax_label': 'Wort für die Steuerzeile',
    'addon.invoices.setting.tax_label.help':
      'USt., MwSt., Umsatzsteuer — Ihr Wort. Eine Steuerzeile erscheint nur, wenn ein Satz oder eine Spalte zugeordnet ist.',
    'addon.invoices.setting.paper': 'Papier',
    'addon.invoices.setting.paper.help': 'Quittungen nutzen immer 80 mm.',
    'addon.invoices.setting.default_formats': 'Was gezeichnet wird',
    'addon.invoices.setting.default_formats.help':
      'PDF wird für lateinische Schrift gezeichnet; andere Schriften erhalten stattdessen eine druckfertige Seite. Gesagt, nicht verschwiegen.',
    'addon.invoices.setting.entities': 'Wo die Schaltfläche erscheint',
    'addon.invoices.setting.entities.help':
      'Welche Datensatzarten eine Beleg-Schaltfläche bekommen. Was die Spalten bedeuten, wird dort festgelegt, wo die Schaltfläche eingebaut ist, nie hier.',
    'addon.invoices.sample.title': 'So sieht ein Beleg aus',
    'addon.invoices.sample.note': 'Hier aus erfundenen Zahlen gezeichnet.',
    'addon.invoices.logo.tooLarge':
      'Dieses Bild hat {size}, die Grenze liegt bei 32 KB. Es steckt in jedem Beleg mit drin und muss deshalb klein bleiben.',

    'addon.invoices.record.title': 'Belege',
    'addon.invoices.record.make': 'Beleg erstellen',
    'addon.invoices.record.download': 'Herunterladen',
    'addon.invoices.record.print': 'Drucken',
    'addon.invoices.record.kind.invoice': 'Rechnung',
    'addon.invoices.record.kind.receipt': 'Quittung',
    'addon.invoices.record.kind.creditNote': 'Gutschrift',
    'addon.invoices.record.kind.quote': 'Angebot',
    'addon.invoices.record.kind.statement': 'Kontoauszug',
    'addon.invoices.record.none':
      'Diese Datensatzart hat noch keine Beleg-Schaltfläche. Fügen Sie sie in den Einstellungen des Add-ons hinzu.',
    'addon.invoices.record.drawn': '{kind} {number} gezeichnet.',
    'addon.invoices.refuse.missing':
      'Es wurde nichts gezeichnet: {columns} hat in diesem Datensatz keinen Wert.',
    'addon.invoices.refuse.latinOnly':
      'Die Webseite wurde gezeichnet, das PDF nicht: {glyphs} lässt sich mit den eingebauten Schriften nicht zeichnen. Nutzen Sie hierfür „Als PDF sichern“ Ihres Browsers.',
  },

  'fr-FR': {
    'addon.invoices.line':
      'Factures, devis, reçus, avoirs et relevés établis à partir de vos propres données, en huit langues — imprimés, téléchargés ou envoyés.',
    'addon.invoices.what':
      'Ceci transforme une ligne en un document que l’on peut garder. Une app peut bâtir ses factures, devis et règlements sur les formes de cet add-on : Adminium les numérote alors sans trou, calcule chaque ligne, la taxe et le total dans les décimales de la devise, enregistre chaque règlement dès qu’on le saisit, et prépare trois relances pour chaque facture impayée, qui attendent qu’on les envoie. Les documents impriment ces montants enregistrés tels quels, avec votre en-tête et la façon de régler, dans la langue du document — en page pour chaque langue, et en PDF pour l’écriture latine. Il n’encaisse jamais rien et ne débite jamais de carte : l’argent circule ailleurs, et un règlement n’est que ce qu’une personne enregistre. Rien n’est chargé d’ailleurs et aucun compte n’est nécessaire.',
    'addon.invoices.disconnect.goes':
      'Les boutons de reçu et de facture disparaissent de vos écrans d’enregistrement.',
    'addon.invoices.disconnect.stays':
      'Tout document déjà établi reste dans votre base, tel quel.',
    'addon.invoices.activity.rendered': 'un reçu a été établi',
    'addon.invoices.activity.sent': 'une facture est partie en PDF',
    'addon.invoices.demo': 'exemple',

    'addon.invoices.settings.title': 'En-tête et valeurs par défaut',
    'addon.invoices.settings.intro':
      'Ces valeurs préremplissent un nouveau modèle. Celles du modèle l’emportent, et un document garde celles que son modèle avait à sa création.',
    'addon.invoices.setting.business_name': 'Nom de l’entreprise',
    'addon.invoices.setting.business_name.help': 'Sur l’en-tête de chaque document.',
    'addon.invoices.setting.business_lines': 'Lignes d’adresse',
    'addon.invoices.setting.business_lines.help':
      'Une ligne chacune, sous le nom — votre adresse de facturation.',
    'addon.invoices.setting.logo_data_url': 'Image d’en-tête',
    'addon.invoices.setting.logo_data_url.help':
      'Petite — 32 Ko au maximum. Elle voyage à l’intérieur de chaque document.',
    'addon.invoices.settings.section.letterhead': 'En-tête',
    'addon.invoices.settings.section.numbers': 'Numéros',
    'addon.invoices.settings.section.defaults': 'Nouveaux documents',
    'addon.invoices.settings.section.reminders': 'Relances',
    'addon.invoices.settings.section.printing': 'Impression',
    'addon.invoices.setting.tax_name': 'Nom de la taxe',
    'addon.invoices.setting.tax_name.help': 'TVA, GST, Sales tax — imprimé à côté du taux et copié sur chaque nouveau document.',
    'addon.invoices.setting.tax_number': 'Numéro fiscal',
    'addon.invoices.setting.tax_number.help': 'Imprimé dans l’en-tête, après le nom de la taxe.',
    'addon.invoices.setting.payment_instructions': 'Comment régler',
    'addon.invoices.setting.payment_instructions.help': 'Coordonnées bancaires, ou ce que vos clients doivent suivre. Imprimé sur chaque facture, avec son numéro comme référence. Visible sur les écrans de votre équipe et sur les documents, et par un client connecté à une application sur ses propres factures — jamais sur une page ouverte.',
    'addon.invoices.setting.footer': 'Pied de page',
    'addon.invoices.setting.footer.help': 'Imprimé en bas des factures et des relevés, sous « Conditions ».',
    'addon.invoices.setting.default_tax_rate': 'Taux de taxe par défaut',
    'addon.invoices.setting.default_tax_rate.help': 'Un taux, copié sur un document à sa création. Le modifier ne change jamais un document déjà établi.',
    'addon.invoices.setting.default_terms': 'Conditions par défaut',
    'addon.invoices.setting.default_terms.help': 'Quand une nouvelle facture arrive à échéance, compté depuis le jour de son envoi.',
    'addon.invoices.terms.net7': 'Net 7 jours',
    'addon.invoices.terms.net14': 'Net 14 jours',
    'addon.invoices.terms.net30': 'Net 30 jours',
    'addon.invoices.terms.onReceipt': 'À réception',
    'addon.invoices.setting.prefix_invoice': 'Préfixe des factures',
    'addon.invoices.setting.prefix_receipt': 'Préfixe des reçus',
    'addon.invoices.setting.prefix_quote': 'Préfixe des devis',
    'addon.invoices.setting.prefix.help': 'Jusqu’à 12 lettres, chiffres et - _ / . — un changement vaut à partir du numéro suivant.',
    'addon.invoices.setting.number_start_invoice': 'Premier numéro de facture',
    'addon.invoices.setting.number_start_receipt': 'Premier numéro de reçu',
    'addon.invoices.setting.number_start_quote': 'Premier numéro de devis',
    'addon.invoices.setting.number_start.help': 'Les numéros se suivent sans trou à partir d’ici. Le premier numéro ne peut que monter : un numéro déjà attribué ne l’est jamais deux fois.',
    'addon.invoices.setting.ladders': 'Paliers de relance',
    'addon.invoices.setting.ladders.help': 'Les jours après l’échéance où chacune des trois relances se prépare. Chacune attend que quelqu’un l’envoie.',
    'addon.invoices.ladder.gentle': 'Douce',
    'addon.invoices.ladder.standard': 'Normale',
    'addon.invoices.ladder.firm': 'Ferme',
    'addon.invoices.setting.default_ladder': 'Palier par défaut',
    'addon.invoices.setting.default_ladder.help': 'La suite de relances avec laquelle commence une nouvelle facture.',
    'addon.invoices.setting.show_payment_ledger': 'Afficher les règlements sur les documents',
    'addon.invoices.setting.show_payment_ledger.help': 'Liste chaque règlement au-dessus du montant dû. Désactivé, seul le montant dû est imprimé.',
    'addon.invoices.problem.prefix': 'Uniquement 12 lettres, chiffres et - _ / . au plus.',
    'addon.invoices.problem.start': 'Le premier numéro ne peut que monter. {number} est désormais le plus bas possible.',
    'addon.invoices.problem.ladder': 'Trois jours entiers, chacun après le précédent.',
    'addon.invoices.problem.rate': 'Un taux de 0 à 100.',
    'addon.invoices.setting.terms': 'Conditions',
    'addon.invoices.setting.terms.help':
      'Imprimées sous les totaux. Une seule langue — écrivez-les comme elles doivent être lues.',
    'addon.invoices.setting.tax_label': 'Mot pour la ligne de taxe',
    'addon.invoices.setting.tax_label.help':
      'TVA, taxe de vente — votre mot. Aucune ligne de taxe n’apparaît sans taux ni colonne associée.',
    'addon.invoices.setting.paper': 'Papier',
    'addon.invoices.setting.paper.help': 'Les reçus utilisent toujours 80 mm.',
    'addon.invoices.setting.default_formats': 'Ce qui est tracé',
    'addon.invoices.setting.default_formats.help':
      'Le PDF est tracé pour les écritures latines ; les autres reçoivent une page prête à imprimer. Dit, pas caché.',
    'addon.invoices.setting.entities': 'Où le bouton apparaît',
    'addon.invoices.setting.entities.help':
      'Quelles sortes d’enregistrement reçoivent un bouton. Ce que signifient les colonnes se règle là où le bouton est monté, jamais ici.',
    'addon.invoices.sample.title': 'À quoi ressemble un document',
    'addon.invoices.sample.note': 'Tracé ici à partir de chiffres inventés.',
    'addon.invoices.logo.tooLarge':
      'Cette image fait {size} et la limite est de 32 Ko. Elle voyage à l’intérieur de chaque document et doit donc rester petite.',

    'addon.invoices.record.title': 'Documents',
    'addon.invoices.record.make': 'Établir un document',
    'addon.invoices.record.download': 'Télécharger',
    'addon.invoices.record.print': 'Imprimer',
    'addon.invoices.record.kind.invoice': 'Facture',
    'addon.invoices.record.kind.receipt': 'Reçu',
    'addon.invoices.record.kind.creditNote': 'Avoir',
    'addon.invoices.record.kind.quote': 'Devis',
    'addon.invoices.record.kind.statement': 'Relevé',
    'addon.invoices.record.none':
      'Cette sorte d’enregistrement n’a pas encore de bouton. Ajoutez-la dans les réglages de l’add-on.',
    'addon.invoices.record.drawn': '{kind} {number} établi.',
    'addon.invoices.refuse.missing':
      'Rien n’a été tracé : {columns} n’a pas de valeur sur cet enregistrement.',
    'addon.invoices.refuse.latinOnly':
      'La page web a été tracée, le PDF non : {glyphs} ne peut pas être tracé avec les polices intégrées. Utilisez « Enregistrer au format PDF » de votre navigateur pour celui-ci.',
  },

  'cs-CZ': {
    'addon.invoices.line':
      'Faktury, nabídky, stvrzenky, dobropisy a výpisy z vašich vlastních záznamů, v osmi jazycích — k tisku, stažení nebo odeslání.',
    'addon.invoices.what':
      'Z řádku se tu stává doklad, který si lze ponechat. Aplikace může své faktury, nabídky a platby postavit na tvarech tohoto doplňku: Adminium je pak čísluje bez mezer, spočítá každou položku, daň i celkovou částku na desetinná místa měny, zaznamená každou platbu, jakmile ji někdo zadá, a ke každé neuhrazené faktuře připraví tři upomínky, které čekají, až je někdo odešle. Doklady tisknou tyto uložené částky tak, jak jsou, s vaší hlavičkou a pokyny k platbě, v jazyce dokladu — jako stránku v každém jazyce a jako PDF u latinky. Nikdy nepřijímá platbu a nikdy nestrhává peníze z karty: peníze se pohybují mimo něj a platba je vždy jen to, co zaznamená člověk. Nic se odnikud nestahuje a není potřeba žádný účet.',
    'addon.invoices.disconnect.goes':
      'Tlačítka na stvrzenku a fakturu zmizí z obrazovek vašich záznamů.',
    'addon.invoices.disconnect.stays':
      'Každý už vytvořený doklad zůstane ve vaší databázi přesně tak, jak byl.',
    'addon.invoices.activity.rendered': 'byla nakreslena stvrzenka',
    'addon.invoices.activity.sent': 'faktura odešla jako PDF',
    'addon.invoices.demo': 'ukázka',

    'addon.invoices.settings.title': 'Hlavička a výchozí hodnoty',
    'addon.invoices.settings.intro':
      'Tyto hodnoty předvyplní novou šablonu. Hodnoty šablony mají přednost a doklad si nechá to, co šablona měla při jeho vytvoření.',
    'addon.invoices.setting.business_name': 'Název firmy',
    'addon.invoices.setting.business_name.help': 'V hlavičce každého dokladu.',
    'addon.invoices.setting.business_lines': 'Řádky adresy',
    'addon.invoices.setting.business_lines.help':
      'Každý na jednom řádku, pod názvem — vaše fakturační adresa.',
    'addon.invoices.setting.logo_data_url': 'Obrázek do hlavičky',
    'addon.invoices.setting.logo_data_url.help':
      'Malý — nejvýše 32 KB. Cestuje uvnitř každého dokladu.',
    'addon.invoices.settings.section.letterhead': 'Hlavička',
    'addon.invoices.settings.section.numbers': 'Čísla',
    'addon.invoices.settings.section.defaults': 'Nové doklady',
    'addon.invoices.settings.section.reminders': 'Upomínky',
    'addon.invoices.settings.section.printing': 'Tisk',
    'addon.invoices.setting.tax_name': 'Název daně',
    'addon.invoices.setting.tax_name.help': 'DPH, GST, Sales tax — tiskne se vedle sazby a kopíruje se na každý nový doklad.',
    'addon.invoices.setting.tax_number': 'Daňové číslo',
    'addon.invoices.setting.tax_number.help': 'Tiskne se v hlavičce za názvem daně.',
    'addon.invoices.setting.payment_instructions': 'Jak zaplatit',
    'addon.invoices.setting.payment_instructions.help': 'Bankovní spojení nebo cokoli, čím se mají klienti řídit. Tiskne se na každou fakturu s jejím číslem jako označením platby. Uvidí to vaši zaměstnanci a doklady a klient přihlášený do aplikace na svých vlastních fakturách — nikdy otevřená stránka.',
    'addon.invoices.setting.footer': 'Zápatí',
    'addon.invoices.setting.footer.help': 'Tiskne se dole na fakturách a výpisech, pod „Podmínky“.',
    'addon.invoices.setting.default_tax_rate': 'Výchozí sazba daně',
    'addon.invoices.setting.default_tax_rate.help': 'Sazba, která se při vytvoření zkopíruje na doklad. Její změna nikdy nezmění už vytvořený doklad.',
    'addon.invoices.setting.default_terms': 'Výchozí splatnost',
    'addon.invoices.setting.default_terms.help': 'Kdy je nová faktura splatná, počítáno ode dne odeslání.',
    'addon.invoices.terms.net7': 'Splatnost 7 dní',
    'addon.invoices.terms.net14': 'Splatnost 14 dní',
    'addon.invoices.terms.net30': 'Splatnost 30 dní',
    'addon.invoices.terms.onReceipt': 'Při převzetí',
    'addon.invoices.setting.prefix_invoice': 'Předčíslí faktur',
    'addon.invoices.setting.prefix_receipt': 'Předčíslí stvrzenek',
    'addon.invoices.setting.prefix_quote': 'Předčíslí nabídek',
    'addon.invoices.setting.prefix.help': 'Až 12 písmen, číslic a - _ / . — změna platí od dalšího čísla.',
    'addon.invoices.setting.number_start_invoice': 'První číslo faktury',
    'addon.invoices.setting.number_start_receipt': 'První číslo stvrzenky',
    'addon.invoices.setting.number_start_quote': 'První číslo nabídky',
    'addon.invoices.setting.number_start.help': 'Odtud čísla běží bez mezer. První číslo se může jen zvýšit: jednou vydané číslo se nikdy nevydá znovu.',
    'addon.invoices.setting.ladders': 'Stupně upomínek',
    'addon.invoices.setting.ladders.help': 'Dny po splatnosti, kdy se připraví každá ze tří upomínek. Každá čeká, až ji někdo odešle.',
    'addon.invoices.ladder.gentle': 'Mírné',
    'addon.invoices.ladder.standard': 'Běžné',
    'addon.invoices.ladder.firm': 'Důrazné',
    'addon.invoices.setting.default_ladder': 'Výchozí stupně',
    'addon.invoices.setting.default_ladder.help': 'Stupně, se kterými začíná nová faktura.',
    'addon.invoices.setting.show_payment_ledger': 'Zobrazit platby na dokladech',
    'addon.invoices.setting.show_payment_ledger.help': 'Vypíše každou platbu nad částkou k úhradě. Vypnuto, tiskne se jen částka k úhradě.',
    'addon.invoices.problem.prefix': 'Jen až 12 písmen, číslic a - _ / .',
    'addon.invoices.problem.start': 'První číslo se může jen zvýšit. {number} je teď nejnižší možná hodnota.',
    'addon.invoices.problem.ladder': 'Tři celé dny, každý pozdější než předchozí.',
    'addon.invoices.problem.rate': 'Sazba od 0 do 100.',
    'addon.invoices.setting.terms': 'Podmínky',
    'addon.invoices.setting.terms.help':
      'Tisknou se pod součty. Jeden jazyk — napište to tak, jak se to má číst.',
    'addon.invoices.setting.tax_label': 'Slovo na daňový řádek',
    'addon.invoices.setting.tax_label.help':
      'DPH, daň z obratu — vaše slovo. Daňový řádek se objeví jen tehdy, když je přiřazena sazba nebo sloupec.',
    'addon.invoices.setting.paper': 'Papír',
    'addon.invoices.setting.paper.help': 'Stvrzenky používají vždy 80 mm.',
    'addon.invoices.setting.default_formats': 'Co se kreslí',
    'addon.invoices.setting.default_formats.help':
      'PDF se kreslí u latinky; ostatní písma dostanou stránku připravenou k tisku. Řečeno, nezamlčeno.',
    'addon.invoices.setting.entities': 'Kde se tlačítko ukáže',
    'addon.invoices.setting.entities.help':
      'Které druhy záznamů dostanou tlačítko. Co sloupce znamenají, se nastavuje tam, kde je tlačítko zabudováno, nikdy zde.',
    'addon.invoices.sample.title': 'Jak doklad vypadá',
    'addon.invoices.sample.note': 'Nakresleno zde z vymyšlených čísel.',
    'addon.invoices.logo.tooLarge':
      'Tento obrázek má {size} a mez je 32 KB. Cestuje uvnitř každého dokladu, a musí tedy zůstat malý.',

    'addon.invoices.record.title': 'Doklady',
    'addon.invoices.record.make': 'Vytvořit doklad',
    'addon.invoices.record.download': 'Stáhnout',
    'addon.invoices.record.print': 'Tisk',
    'addon.invoices.record.kind.invoice': 'Faktura',
    'addon.invoices.record.kind.receipt': 'Stvrzenka',
    'addon.invoices.record.kind.creditNote': 'Dobropis',
    'addon.invoices.record.kind.quote': 'Nabídka',
    'addon.invoices.record.kind.statement': 'Výpis z účtu',
    'addon.invoices.record.none':
      'Tento druh záznamu zatím tlačítko nemá. Přidejte jej v nastavení add-onu.',
    'addon.invoices.record.drawn': 'Nakresleno: {kind} {number}.',
    'addon.invoices.refuse.missing':
      'Nic se nenakreslilo: {columns} nemá u tohoto záznamu hodnotu.',
    'addon.invoices.refuse.latinOnly':
      'Webová stránka se nakreslila, PDF ne: {glyphs} nelze vestavěnými písmy nakreslit. Použijte na to „Uložit jako PDF“ tam, kde si stránku otevřete.',
  },

  'da-DK': {
    'addon.invoices.line':
      'Fakturaer, tilbud, kvitteringer, kreditnotaer og kontoudtog ud fra jeres egne data — udskrevet, hentet eller sendt.',
    'addon.invoices.what':
      'Her bliver en række til et bilag, man kan gemme. En app kan bygge sine fakturaer, tilbud og betalinger på dette tilføjelsesprograms former: Adminium nummererer dem så uden huller, regner hver linje, afgiften og totalen ud med valutaens egne decimaler, registrerer hver betaling, når nogen indtaster den, og holder tre rykkere klar for hver ubetalt faktura, indtil nogen sender dem. Bilagene trykker de gemte tal, som de er, med jeres brevhoved og betalingsvejledning, på bilagets eget sprog — som en side på alle sprog og som PDF ved latinsk skrift. Det tager aldrig imod en betaling og trækker aldrig på et kort: pengene flytter sig udenfor, og en betaling er altid kun det, et menneske registrerer. Intet hentes udefra, og der kræves ingen konto.',
    'addon.invoices.disconnect.goes':
      'Knapperne til kvittering og faktura forsvinder fra jeres rækkeskærme.',
    'addon.invoices.disconnect.stays':
      'Ethvert bilag, der allerede er lavet, bliver i jeres database, nøjagtig som det var.',
    'addon.invoices.activity.rendered': 'der blev tegnet en kvittering',
    'addon.invoices.activity.sent': 'en faktura gik ud som PDF',
    'addon.invoices.demo': 'eksempel',

    'addon.invoices.settings.title': 'Brevhoved og standardværdier',
    'addon.invoices.settings.intro':
      'Disse udfylder en ny skabelon på forhånd. Skabelonens egne værdier vinder, og et bilag beholder dem, skabelonen havde, da det blev lavet.',
    'addon.invoices.setting.business_name': 'Virksomhedens navn',
    'addon.invoices.setting.business_name.help': 'På hvert bilags brevhoved.',
    'addon.invoices.setting.business_lines': 'Adresselinjer',
    'addon.invoices.setting.business_lines.help':
      'Én linje hver, under navnet — jeres fakturaadresse.',
    'addon.invoices.setting.logo_data_url': 'Billede til brevhovedet',
    'addon.invoices.setting.logo_data_url.help':
      'Lille — højst 32 KB. Det rejser med inde i hvert bilag.',
    'addon.invoices.settings.section.letterhead': 'Brevhoved',
    'addon.invoices.settings.section.numbers': 'Numre',
    'addon.invoices.settings.section.defaults': 'Nye bilag',
    'addon.invoices.settings.section.reminders': 'Rykkere',
    'addon.invoices.settings.section.printing': 'Udskrift',
    'addon.invoices.setting.tax_name': 'Afgiftens navn',
    'addon.invoices.setting.tax_name.help': 'Moms, GST, Sales tax — trykt ved siden af satsen og kopieret over på hvert nyt bilag.',
    'addon.invoices.setting.tax_number': 'Skattenummer',
    'addon.invoices.setting.tax_number.help': 'Trykt i brevhovedet efter afgiftens navn.',
    'addon.invoices.setting.payment_instructions': 'Sådan betaler du',
    'addon.invoices.setting.payment_instructions.help': 'Bankoplysninger, eller hvad jeres kunder ellers skal følge. Trykt på hver faktura med dens nummer som reference. Det vises på jeres egne medarbejderskærme og bilagene, og en kunde, der er logget ind i en app, ser det på sine egne fakturaer — aldrig på en åben side.',
    'addon.invoices.setting.footer': 'Sidefod',
    'addon.invoices.setting.footer.help': 'Trykt nederst på fakturaer og kontoudtog, under “Betingelser”.',
    'addon.invoices.setting.default_tax_rate': 'Standardafgiftssats',
    'addon.invoices.setting.default_tax_rate.help': 'En sats, kopieret over på et bilag, når det laves. En ændring ændrer aldrig et bilag, der allerede er lavet.',
    'addon.invoices.setting.default_terms': 'Standardbetingelser',
    'addon.invoices.setting.default_terms.help': 'Hvornår en ny faktura forfalder, regnet fra dagen den sendes.',
    'addon.invoices.terms.net7': 'Netto 7 dage',
    'addon.invoices.terms.net14': 'Netto 14 dage',
    'addon.invoices.terms.net30': 'Netto 30 dage',
    'addon.invoices.terms.onReceipt': 'Ved modtagelse',
    'addon.invoices.setting.prefix_invoice': 'Fakturaforstavelse',
    'addon.invoices.setting.prefix_receipt': 'Kvitteringsforstavelse',
    'addon.invoices.setting.prefix_quote': 'Tilbudsforstavelse',
    'addon.invoices.setting.prefix.help': 'Op til 12 bogstaver, cifre og - _ / . — en ændring gælder fra næste nummer.',
    'addon.invoices.setting.number_start_invoice': 'Første fakturanummer',
    'addon.invoices.setting.number_start_receipt': 'Første kvitteringsnummer',
    'addon.invoices.setting.number_start_quote': 'Første tilbudsnummer',
    'addon.invoices.setting.number_start.help': 'Herfra løber numrene uden huller. Det første nummer kan kun gå op: et nummer, der er givet, gives aldrig igen.',
    'addon.invoices.setting.ladders': 'Rykkertrin',
    'addon.invoices.setting.ladders.help': 'Dagene efter forfaldsdagen, hvor hver af de tre rykkere bliver klar. Hver venter på, at nogen sender den.',
    'addon.invoices.ladder.gentle': 'Blid',
    'addon.invoices.ladder.standard': 'Normal',
    'addon.invoices.ladder.firm': 'Fast',
    'addon.invoices.setting.default_ladder': 'Standardtrin',
    'addon.invoices.setting.default_ladder.help': 'De trin, en ny faktura starter med.',
    'addon.invoices.setting.show_payment_ledger': 'Vis betalinger på bilag',
    'addon.invoices.setting.show_payment_ledger.help': 'Viser hver betaling over det skyldige beløb. Slået fra trykkes kun det skyldige beløb.',
    'addon.invoices.problem.prefix': 'Kun op til 12 bogstaver, cifre og - _ / .',
    'addon.invoices.problem.start': 'Det første nummer kan kun gå op. {number} er det laveste, det kan være nu.',
    'addon.invoices.problem.ladder': 'Tre hele dage, hver senere end den før.',
    'addon.invoices.problem.rate': 'En sats fra 0 til 100.',
    'addon.invoices.setting.terms': 'Vilkår',
    'addon.invoices.setting.terms.help':
      'Trykkes under summerne. Kun én udgave — skriv det, som det skal læses.',
    'addon.invoices.setting.tax_label': 'Ord til afgiftslinjen',
    'addon.invoices.setting.tax_label.help':
      'Moms, salgsafgift — jeres ord. Der kommer ingen afgiftslinje, medmindre en sats eller en kolonne er tilknyttet.',
    'addon.invoices.setting.paper': 'Papir',
    'addon.invoices.setting.paper.help': 'Kvitteringer bruger altid 80 mm.',
    'addon.invoices.setting.default_formats': 'Hvad der tegnes',
    'addon.invoices.setting.default_formats.help':
      'PDF tegnes ved latinsk skrift; andre skrifter får en side klar til udskrift i stedet. Sagt, ikke skjult.',
    'addon.invoices.setting.entities': 'Hvor knappen vises',
    'addon.invoices.setting.entities.help':
      'Hvilke slags rækker der får en knap. Hvad kolonnerne betyder, sættes der, hvor knappen er sat ind, aldrig her.',
    'addon.invoices.sample.title': 'Sådan ser et bilag ud',
    'addon.invoices.sample.note': 'Tegnet her ud fra opdigtede tal.',
    'addon.invoices.logo.tooLarge':
      'Det billede fylder {size}, og grænsen er 32 KB. Det rejser med inde i hvert bilag og skal derfor blive lille.',

    'addon.invoices.record.title': 'Bilag',
    'addon.invoices.record.make': 'Lav et bilag',
    'addon.invoices.record.download': 'Hent',
    'addon.invoices.record.print': 'Udskriv',
    'addon.invoices.record.kind.invoice': 'Faktura',
    'addon.invoices.record.kind.receipt': 'Kvittering',
    'addon.invoices.record.kind.creditNote': 'Kreditnota',
    'addon.invoices.record.kind.quote': 'Tilbud',
    'addon.invoices.record.kind.statement': 'Kontoudtog',
    'addon.invoices.record.none':
      'Denne slags række har endnu ingen knap. Tilføj den i add-on’ets indstillinger.',
    'addon.invoices.record.drawn': 'Tegnede {kind} {number}.',
    'addon.invoices.refuse.missing':
      'Der blev intet tegnet: {columns} har ingen værdi på denne række.',
    'addon.invoices.refuse.latinOnly':
      'Websiden blev tegnet, PDF’en ikke: {glyphs} kan ikke tegnes med de indbyggede skrifter. Brug jeres browsers eget „Gem som PDF“ til denne.',
  },

  'zh-CN': {
    'addon.invoices.line':
      '根据您自己的记录生成发票、报价单、收据、贷记单和对账表，支持八种语言——可打印、下载或发送。',
    'addon.invoices.what':
      '这会把一行记录变成可以保存的单据。应用可以把自己的发票、报价单和付款建立在本附加组件的形态上：Adminium 会为其连续编号、按币种自身的小数位计算每一行、税额和合计，在有人录入时记录每笔付款，并为每张未付发票准备三次提醒，等待有人发送。单据按原样打印这些存储的数字，附上您的信头和付款方法，使用单据的语言——所有语言都有网页版，拉丁文字另有 PDF。它从不收款，也从不扣卡：资金在它之外流转，付款永远只是有人记录下来的内容。不从任何地方获取内容，也无需账户。',
    'addon.invoices.disconnect.goes': '记录页面上的收据和发票按钮会消失。',
    'addon.invoices.disconnect.stays': '已经生成的单据原样留在你的数据库里。',
    'addon.invoices.activity.rendered': '绘制了一张收据',
    'addon.invoices.activity.sent': '一张发票以 PDF 发出',
    'addon.invoices.demo': '示例',

    'addon.invoices.settings.title': '信头与默认值',
    'addon.invoices.settings.intro':
      '这些值用于预填新模板。模板自身的值优先，单据保留其模板在创建时的值。',
    'addon.invoices.setting.business_name': '公司名称',
    'addon.invoices.setting.business_name.help': '出现在每份单据的信头上。',
    'addon.invoices.setting.business_lines': '地址行',
    'addon.invoices.setting.business_lines.help': '每行一条，位于名称下方——你的开票地址。',
    'addon.invoices.setting.logo_data_url': '信头图片',
    'addon.invoices.setting.logo_data_url.help': '要小——最多 32 KB。它会随每份单据一起传送。',
    'addon.invoices.settings.section.letterhead': '信头',
    'addon.invoices.settings.section.numbers': '编号',
    'addon.invoices.settings.section.defaults': '新单据',
    'addon.invoices.settings.section.reminders': '提醒',
    'addon.invoices.settings.section.printing': '打印',
    'addon.invoices.setting.tax_name': '税名',
    'addon.invoices.setting.tax_name.help': '增值税、商品及服务税、销售税——印在税率旁，并复制到每张新单据上。',
    'addon.invoices.setting.tax_number': '税号',
    'addon.invoices.setting.tax_number.help': '印在信头中，位于税名之后。',
    'addon.invoices.setting.payment_instructions': '付款方法',
    'addon.invoices.setting.payment_instructions.help': '银行信息，或您希望客户遵循的其他方式。印在每张发票上，以发票编号作为付款备注。显示在您自己员工的屏幕和单据上，登录应用的客户也能在自己的发票上看到——从不出现在开放页面。',
    'addon.invoices.setting.footer': '页脚',
    'addon.invoices.setting.footer.help': '印在发票和对账表底部，“付款条件”下方。',
    'addon.invoices.setting.default_tax_rate': '默认税率',
    'addon.invoices.setting.default_tax_rate.help': '创建单据时复制到单据上的比例。修改它不会改变已开具的单据。',
    'addon.invoices.setting.default_terms': '默认付款条件',
    'addon.invoices.setting.default_terms.help': '新发票自发送之日起多少天到期。',
    'addon.invoices.terms.net7': '7 天内付款',
    'addon.invoices.terms.net14': '14 天内付款',
    'addon.invoices.terms.net30': '30 天内付款',
    'addon.invoices.terms.onReceipt': '收到即付',
    'addon.invoices.setting.prefix_invoice': '发票前缀',
    'addon.invoices.setting.prefix_receipt': '收据前缀',
    'addon.invoices.setting.prefix_quote': '报价单前缀',
    'addon.invoices.setting.prefix.help': '最多 12 个字母、数字及 - _ / . ——修改从下一个编号起生效。',
    'addon.invoices.setting.number_start_invoice': '首个发票编号',
    'addon.invoices.setting.number_start_receipt': '首个收据编号',
    'addon.invoices.setting.number_start_quote': '首个报价单编号',
    'addon.invoices.setting.number_start.help': '编号从这里开始连续无空缺。首个编号只能调大：已给出的编号永不重复使用。',
    'addon.invoices.setting.ladders': '提醒梯度',
    'addon.invoices.setting.ladders.help': '到期日后三次提醒各自就绪的天数。每次提醒都会等待有人发送。',
    'addon.invoices.ladder.gentle': '温和',
    'addon.invoices.ladder.standard': '标准',
    'addon.invoices.ladder.firm': '严格',
    'addon.invoices.setting.default_ladder': '默认梯度',
    'addon.invoices.setting.default_ladder.help': '新发票开始时使用的提醒梯度。',
    'addon.invoices.setting.show_payment_ledger': '在单据上显示付款',
    'addon.invoices.setting.show_payment_ledger.help': '在应付金额上方逐笔列出付款。关闭时只打印应付金额。',
    'addon.invoices.problem.prefix': '只能是最多 12 个字母、数字及 - _ / .',
    'addon.invoices.problem.start': '首个编号只能调大。现在最小只能是 {number}。',
    'addon.invoices.problem.ladder': '三个整天数，每个都晚于前一个。',
    'addon.invoices.problem.rate': '0 到 100 之间的比例。',
    'addon.invoices.setting.terms': '条款',
    'addon.invoices.setting.terms.help': '印在合计下方。只用一种语言——照你希望被读到的样子写。',
    'addon.invoices.setting.tax_label': '税行的用词',
    'addon.invoices.setting.tax_label.help':
      '增值税、销售税——用你的说法。没有对应税率或列时，不会出现税行。',
    'addon.invoices.setting.paper': '纸张',
    'addon.invoices.setting.paper.help': '收据一律使用 80 毫米。',
    'addon.invoices.setting.default_formats': '绘制什么',
    'addon.invoices.setting.default_formats.help':
      '拉丁文字会绘制 PDF；其他文字改为提供可直接打印的页面。明说，不隐瞒。',
    'addon.invoices.setting.entities': '按钮出现的位置',
    'addon.invoices.setting.entities.help':
      '哪些记录类型会有单据按钮。各列的含义在按钮挂载的地方设置，绝不在这里。',
    'addon.invoices.sample.title': '单据长什么样',
    'addon.invoices.sample.note': '此处用虚构数字绘制。',
    'addon.invoices.logo.tooLarge':
      '这张图片有 {size}，上限是 32 KB。它会随每份单据一起传送，所以必须保持小巧。',

    'addon.invoices.record.title': '单据',
    'addon.invoices.record.make': '生成单据',
    'addon.invoices.record.download': '下载',
    'addon.invoices.record.print': '打印',
    'addon.invoices.record.kind.invoice': '发票',
    'addon.invoices.record.kind.receipt': '收据',
    'addon.invoices.record.kind.creditNote': '贷记单',
    'addon.invoices.record.kind.quote': '报价单',
    'addon.invoices.record.kind.statement': '对账表',
    'addon.invoices.record.none': '这类记录还没有单据按钮。请在插件设置中添加。',
    'addon.invoices.record.drawn': '已绘制{kind} {number}。',
    'addon.invoices.refuse.missing': '没有绘制任何内容：这条记录的 {columns} 没有值。',
    'addon.invoices.refuse.latinOnly':
      '网页已绘制，PDF 未绘制：内置字体画不出 {glyphs}。这一份请用浏览器自带的“另存为 PDF”。',
  },

  'zh-TW': {
    'addon.invoices.line':
      '根據您自己的記錄產生發票、報價單、收據、貸記單和對帳表，支援八種語言——可列印、下載或寄送。',
    'addon.invoices.what':
      '這會把一列記錄變成可以保存的單據。應用可以把自己的發票、報價單和付款建立在本附加元件的形態上：Adminium 會為其連續編號、依幣別自身的小數位計算每一列、稅額和合計，在有人輸入時記錄每筆付款，並為每張未付發票準備三次提醒，等待有人發送。單據依原樣列印這些儲存的數字，附上您的信頭和付款方法，使用單據的語言——所有語言都有網頁版，拉丁文字另有 PDF。它從不收款，也從不扣卡：資金在它之外流轉，付款永遠只是有人記錄下來的內容。不從任何地方取得內容，也無需帳戶。',
    'addon.invoices.disconnect.goes': '記錄頁面上的收據和發票按鈕會消失。',
    'addon.invoices.disconnect.stays': '已經產生的單據原樣留在你的資料庫裡。',
    'addon.invoices.activity.rendered': '繪製了一張收據',
    'addon.invoices.activity.sent': '一張發票以 PDF 寄出',
    'addon.invoices.demo': '範例',

    'addon.invoices.settings.title': '信頭與預設值',
    'addon.invoices.settings.intro':
      '這些值用於預填新範本。範本自身的值優先，單據保留其範本在建立時的值。',
    'addon.invoices.setting.business_name': '公司名稱',
    'addon.invoices.setting.business_name.help': '出現在每份單據的信頭上。',
    'addon.invoices.setting.business_lines': '地址行',
    'addon.invoices.setting.business_lines.help': '每行一條，位於名稱下方——你的開票地址。',
    'addon.invoices.setting.logo_data_url': '信頭圖片',
    'addon.invoices.setting.logo_data_url.help': '要小——最多 32 KB。它會隨每份單據一起傳送。',
    'addon.invoices.settings.section.letterhead': '信頭',
    'addon.invoices.settings.section.numbers': '編號',
    'addon.invoices.settings.section.defaults': '新單據',
    'addon.invoices.settings.section.reminders': '提醒',
    'addon.invoices.settings.section.printing': '列印',
    'addon.invoices.setting.tax_name': '稅名',
    'addon.invoices.setting.tax_name.help': '營業稅、商品及服務稅、銷售稅——印在稅率旁，並複製到每張新單據上。',
    'addon.invoices.setting.tax_number': '稅號',
    'addon.invoices.setting.tax_number.help': '印在信頭中，位於稅名之後。',
    'addon.invoices.setting.payment_instructions': '付款方法',
    'addon.invoices.setting.payment_instructions.help': '銀行資訊，或您希望客戶遵循的其他方式。印在每張發票上，以發票編號作為付款備註。顯示在您自己員工的螢幕和單據上，登入應用程式的客戶也能在自己的發票上看到——從不出現在開放頁面。',
    'addon.invoices.setting.footer': '頁尾',
    'addon.invoices.setting.footer.help': '印在發票和對帳表底部，「付款條件」下方。',
    'addon.invoices.setting.default_tax_rate': '預設稅率',
    'addon.invoices.setting.default_tax_rate.help': '建立單據時複製到單據上的比例。修改它不會改變已開立的單據。',
    'addon.invoices.setting.default_terms': '預設付款條件',
    'addon.invoices.setting.default_terms.help': '新發票自發送之日起多少天到期。',
    'addon.invoices.terms.net7': '7 天內付款',
    'addon.invoices.terms.net14': '14 天內付款',
    'addon.invoices.terms.net30': '30 天內付款',
    'addon.invoices.terms.onReceipt': '收到即付',
    'addon.invoices.setting.prefix_invoice': '發票前綴',
    'addon.invoices.setting.prefix_receipt': '收據前綴',
    'addon.invoices.setting.prefix_quote': '報價單前綴',
    'addon.invoices.setting.prefix.help': '最多 12 個字母、數字及 - _ / . ——修改從下一個編號起生效。',
    'addon.invoices.setting.number_start_invoice': '首個發票編號',
    'addon.invoices.setting.number_start_receipt': '首個收據編號',
    'addon.invoices.setting.number_start_quote': '首個報價單編號',
    'addon.invoices.setting.number_start.help': '編號從這裡開始連續無空缺。首個編號只能調大：已給出的編號永不重複使用。',
    'addon.invoices.setting.ladders': '提醒梯度',
    'addon.invoices.setting.ladders.help': '到期日後三次提醒各自就緒的天數。每次提醒都會等待有人發送。',
    'addon.invoices.ladder.gentle': '溫和',
    'addon.invoices.ladder.standard': '標準',
    'addon.invoices.ladder.firm': '嚴格',
    'addon.invoices.setting.default_ladder': '預設梯度',
    'addon.invoices.setting.default_ladder.help': '新發票開始時使用的提醒梯度。',
    'addon.invoices.setting.show_payment_ledger': '在單據上顯示付款',
    'addon.invoices.setting.show_payment_ledger.help': '在應付金額上方逐筆列出付款。關閉時只列印應付金額。',
    'addon.invoices.problem.prefix': '只能是最多 12 個字母、數字及 - _ / .',
    'addon.invoices.problem.start': '首個編號只能調大。現在最小只能是 {number}。',
    'addon.invoices.problem.ladder': '三個整天數，每個都晚於前一個。',
    'addon.invoices.problem.rate': '0 到 100 之間的比例。',
    'addon.invoices.setting.terms': '條款',
    'addon.invoices.setting.terms.help': '印在合計下方。只用一種語言——照你希望被讀到的樣子寫。',
    'addon.invoices.setting.tax_label': '稅行的用詞',
    'addon.invoices.setting.tax_label.help':
      '加值稅、營業稅——用你的說法。沒有對應稅率或欄位時，不會出現稅行。',
    'addon.invoices.setting.paper': '紙張',
    'addon.invoices.setting.paper.help': '收據一律使用 80 毫米。',
    'addon.invoices.setting.default_formats': '繪製什麼',
    'addon.invoices.setting.default_formats.help':
      '拉丁文字會繪製 PDF；其他文字改為提供可直接列印的頁面。明說，不隱瞞。',
    'addon.invoices.setting.entities': '按鈕出現的位置',
    'addon.invoices.setting.entities.help':
      '哪些記錄類型會有單據按鈕。各欄位的含義在按鈕掛載的地方設定，絕不在這裡。',
    'addon.invoices.sample.title': '單據長什麼樣',
    'addon.invoices.sample.note': '此處用虛構數字繪製。',
    'addon.invoices.logo.tooLarge':
      '這張圖片有 {size}，上限是 32 KB。它會隨每份單據一起傳送，所以必須保持小巧。',

    'addon.invoices.record.title': '單據',
    'addon.invoices.record.make': '產生單據',
    'addon.invoices.record.download': '下載',
    'addon.invoices.record.print': '列印',
    'addon.invoices.record.kind.invoice': '發票',
    'addon.invoices.record.kind.receipt': '收據',
    'addon.invoices.record.kind.creditNote': '貸記單',
    'addon.invoices.record.kind.quote': '報價單',
    'addon.invoices.record.kind.statement': '對帳表',
    'addon.invoices.record.none': '這類記錄還沒有單據按鈕。請在外掛設定中新增。',
    'addon.invoices.record.drawn': '已繪製{kind} {number}。',
    'addon.invoices.refuse.missing': '沒有繪製任何內容：這筆記錄的 {columns} 沒有值。',
    'addon.invoices.refuse.latinOnly':
      '網頁已繪製，PDF 未繪製：內建字型畫不出 {glyphs}。這一份請用瀏覽器內建的「另存為 PDF」。',
  },

  'ar-EG': {
    'addon.invoices.line':
      'فواتير وعروض أسعار وإيصالات وإشعارات دائنة وكشوف حساب من سجلاتك أنت، بثماني لغات — للطباعة أو التنزيل أو الإرسال.',
    'addon.invoices.what':
      'يحوّل هذا صفاً إلى مستند يمكن الاحتفاظ به. يمكن للتطبيق أن يبني فواتيره وعروض أسعاره ومدفوعاته على أشكال هذه الإضافة: عندها يرقّمها Adminium بلا فراغات، ويحسب كل سطر والضريبة والإجمالي بعدد خانات العملة نفسها، ويسجّل كل دفعة عندما يُدخلها أحد، ويُعدّ ثلاثة تذكيرات لكل فاتورة غير مدفوعة تنتظر أن يرسلها أحد. تطبع المستندات هذه الأرقام المخزنة كما هي، مع ترويستك وطريقة الدفع، بلغة المستند — صفحةً لكل لغة، وملف PDF للكتابة اللاتينية. لا يستلم أي دفعة أبداً ولا يسحب من أي بطاقة: المال يتحرك خارجه، والدفعة دائماً هي ما يسجّله شخص فقط. لا يُجلب شيء من أي مكان ولا حاجة إلى حساب.',
    'addon.invoices.disconnect.goes': 'يختفي زرّا الإيصال والفاتورة من شاشات سجلاتك.',
    'addon.invoices.disconnect.stays': 'كل مستند صُنع بالفعل يبقى في قاعدة بياناتك كما هو تماماً.',
    'addon.invoices.activity.rendered': 'رُسم إيصال',
    'addon.invoices.activity.sent': 'خرجت فاتورة بصيغة PDF',
    'addon.invoices.demo': 'عيّنة',

    'addon.invoices.settings.title': 'الترويسة والقيم الافتراضية',
    'addon.invoices.settings.intro':
      'هذه القيم تملأ قالباً جديداً مسبقاً. قيم القالب نفسه هي المقدَّمة، ويحتفظ المستند بما كان لدى قالبه وقت إنشائه.',
    'addon.invoices.setting.business_name': 'اسم الشركة',
    'addon.invoices.setting.business_name.help': 'في ترويسة كل مستند.',
    'addon.invoices.setting.business_lines': 'أسطر العنوان',
    'addon.invoices.setting.business_lines.help': 'سطر لكل واحد، تحت الاسم — عنوان فاتورتك.',
    'addon.invoices.setting.logo_data_url': 'صورة الترويسة',
    'addon.invoices.setting.logo_data_url.help': 'صغيرة — 32 كيلوبايت على الأكثر. تسافر داخل كل مستند.',
    'addon.invoices.settings.section.letterhead': 'الترويسة',
    'addon.invoices.settings.section.numbers': 'الأرقام',
    'addon.invoices.settings.section.defaults': 'المستندات الجديدة',
    'addon.invoices.settings.section.reminders': 'التذكيرات',
    'addon.invoices.settings.section.printing': 'الطباعة',
    'addon.invoices.setting.tax_name': 'اسم الضريبة',
    'addon.invoices.setting.tax_name.help': 'ضريبة القيمة المضافة أو غيرها — يُطبع بجانب النسبة ويُنسخ على كل مستند جديد.',
    'addon.invoices.setting.tax_number': 'الرقم الضريبي',
    'addon.invoices.setting.tax_number.help': 'يُطبع في الترويسة بعد اسم الضريبة.',
    'addon.invoices.setting.payment_instructions': 'طريقة الدفع',
    'addon.invoices.setting.payment_instructions.help': 'بيانات البنك، أو ما تريد أن يتبعه عملاؤك. تُطبع على كل فاتورة مع رقمها مرجعاً. تظهر على شاشات فريقك وفي المستندات، ويراها العميل المسجِّل دخوله في تطبيق على فواتيره هو — ولا تظهر أبداً في صفحة مفتوحة.',
    'addon.invoices.setting.footer': 'التذييل',
    'addon.invoices.setting.footer.help': 'يُطبع أسفل الفواتير وكشوف الحساب، تحت «الشروط».',
    'addon.invoices.setting.default_tax_rate': 'نسبة الضريبة الافتراضية',
    'addon.invoices.setting.default_tax_rate.help': 'نسبة تُنسخ على المستند عند إنشائه. تغييرها لا يغيّر أبداً مستنداً أُنشئ من قبل.',
    'addon.invoices.setting.default_terms': 'الشروط الافتراضية',
    'addon.invoices.setting.default_terms.help': 'متى تستحق الفاتورة الجديدة، محسوباً من يوم إرسالها.',
    'addon.invoices.terms.net7': 'صافي ٧ أيام',
    'addon.invoices.terms.net14': 'صافي ١٤ يوماً',
    'addon.invoices.terms.net30': 'صافي ٣٠ يوماً',
    'addon.invoices.terms.onReceipt': 'عند الاستلام',
    'addon.invoices.setting.prefix_invoice': 'بادئة الفواتير',
    'addon.invoices.setting.prefix_receipt': 'بادئة الإيصالات',
    'addon.invoices.setting.prefix_quote': 'بادئة عروض الأسعار',
    'addon.invoices.setting.prefix.help': 'حتى ١٢ حرفاً ورقماً و - _ / . — يسري التغيير من الرقم التالي.',
    'addon.invoices.setting.number_start_invoice': 'أول رقم فاتورة',
    'addon.invoices.setting.number_start_receipt': 'أول رقم إيصال',
    'addon.invoices.setting.number_start_quote': 'أول رقم عرض سعر',
    'addon.invoices.setting.number_start.help': 'من هنا تتوالى الأرقام بلا فراغات. أول رقم يمكن أن يرتفع فقط: الرقم الذي أُعطي لا يُعطى مرة أخرى أبداً.',
    'addon.invoices.setting.ladders': 'درجات التذكير',
    'addon.invoices.setting.ladders.help': 'الأيام بعد تاريخ الاستحقاق التي يجهز فيها كل من التذكيرات الثلاثة. كل تذكير ينتظر أن يرسله أحد.',
    'addon.invoices.ladder.gentle': 'لطيف',
    'addon.invoices.ladder.standard': 'عادي',
    'addon.invoices.ladder.firm': 'حازم',
    'addon.invoices.setting.default_ladder': 'الدرجات الافتراضية',
    'addon.invoices.setting.default_ladder.help': 'الدرجات التي تبدأ بها الفاتورة الجديدة.',
    'addon.invoices.setting.show_payment_ledger': 'إظهار المدفوعات على المستندات',
    'addon.invoices.setting.show_payment_ledger.help': 'يسرد كل دفعة فوق المبلغ المستحق. عند الإيقاف يُطبع المبلغ المستحق فقط.',
    'addon.invoices.problem.prefix': 'حتى ١٢ حرفاً ورقماً و - _ / . فقط.',
    'addon.invoices.problem.start': 'أول رقم يمكن أن يرتفع فقط. {number} هو أدنى قيمة ممكنة الآن.',
    'addon.invoices.problem.ladder': 'ثلاثة أيام كاملة، كل منها بعد الذي قبله.',
    'addon.invoices.problem.rate': 'نسبة من ٠ إلى ١٠٠.',
    'addon.invoices.setting.terms': 'الشروط',
    'addon.invoices.setting.terms.help': 'تُطبع تحت المجاميع. لغة واحدة — اكتبها كما تريدها أن تُقرأ.',
    'addon.invoices.setting.tax_label': 'كلمة سطر الضريبة',
    'addon.invoices.setting.tax_label.help':
      'ضريبة القيمة المضافة، ضريبة المبيعات — كلمتك أنت. لا يظهر سطر ضريبة ما لم تُربط نسبة أو عمود.',
    'addon.invoices.setting.paper': 'الورق',
    'addon.invoices.setting.paper.help': 'الإيصالات تستخدم 80 مم دائماً.',
    'addon.invoices.setting.default_formats': 'ما الذي يُرسم',
    'addon.invoices.setting.default_formats.help':
      'يُرسم PDF للكتابات اللاتينية؛ أما غيرها فتحصل على صفحة جاهزة للطباعة. مذكور، لا مخفي.',
    'addon.invoices.setting.entities': 'أين يظهر الزر',
    'addon.invoices.setting.entities.help':
      'أي أنواع السجلات تحصل على زر مستند. أما معنى الأعمدة فيُضبط حيث رُكّب الزر، لا هنا أبداً.',
    'addon.invoices.sample.title': 'كيف يبدو المستند',
    'addon.invoices.sample.note': 'مرسوم هنا من أرقام متخيَّلة.',
    'addon.invoices.logo.tooLarge':
      'حجم هذه الصورة {size} والحد 32 كيلوبايت. تسافر داخل كل مستند، فيجب أن تبقى صغيرة.',

    'addon.invoices.record.title': 'المستندات',
    'addon.invoices.record.make': 'إنشاء مستند',
    'addon.invoices.record.download': 'تنزيل',
    'addon.invoices.record.print': 'طباعة',
    'addon.invoices.record.kind.invoice': 'فاتورة',
    'addon.invoices.record.kind.receipt': 'إيصال',
    'addon.invoices.record.kind.creditNote': 'إشعار دائن',
    'addon.invoices.record.kind.quote': 'عرض سعر',
    'addon.invoices.record.kind.statement': 'كشف حساب',
    'addon.invoices.record.none': 'هذا النوع من السجلات ليس له زر بعد. أضفه من إعدادات الإضافة.',
    'addon.invoices.record.drawn': 'رُسم {kind} {number}.',
    'addon.invoices.refuse.missing': 'لم يُرسم شيء: {columns} بلا قيمة في هذا السجل.',
    'addon.invoices.refuse.latinOnly':
      'رُسمت صفحة الويب ولم يُرسم PDF: الخطوط المدمجة لا تستطيع رسم {glyphs}. استخدم «حفظ بصيغة PDF» في متصفحك لهذه.',
  },
} as const;

/** English defines the keys; the other seven must carry every one of them. */
export type StringKey = keyof (typeof strings)['en-US'];

export type LocaleTag = keyof typeof strings;

export const LOCALE_TAGS = Object.keys(strings) as LocaleTag[];

/**
 * Parity, enforced at COMPILE time rather than by a test that might not run.
 *
 * The annotation is the assertion: a locale missing a key, or grown one
 * English has not got, stops this line compiling.
 */
const _parity: { [L in LocaleTag]: Record<StringKey, string> } = strings;
void _parity;

/**
 * ── THE LATIN DIGITS IN THESE STRINGS THAT ARE NOT QUANTITIES ──────────────
 *
 * Every host in this wave runs the same rule over an Arabic page: a run of
 * Latin digits that is not inside an identifier is an unformatted number, and
 * a defect. Some of an add-on's own strings legitimately carry one anyway, and
 * when they do THE ADD-ON IS THE ONLY THING THAT KNOWS WHY.
 *
 * It travels with the strings rather than with the host, because a host
 * holding one add-on's allowance would turn red the day a second host vendored
 * the same add-on without it — the defect AC20/D21 exists to prevent.
 */
export const NOT_A_QUANTITY: readonly { phrase: string; why: string }[] = [
  {
    phrase: '32 KB',
    why: 'A byte limit, not a count of anything a reader is being told about. It is written the same way in every language because a kilobyte is a kilobyte, and the Arabic copy spells the unit out in Arabic while leaving the figure Latin — which is how a size is written in Arabic technical writing.',
  },
  {
    phrase: '80 mm',
    why: 'The width of a till roll: a physical measurement of a standard paper stock, which is the same number everywhere and is how the stock is named in a shop.',
  },
  {
    phrase: 'PDF',
    why: 'The name of a file format, written the same way in every language including the two Chinese bundles and the Arabic one. It carries no digits at all and is listed here only so a reader looking for it finds the reasoning rather than assuming it was missed.',
  },
];
