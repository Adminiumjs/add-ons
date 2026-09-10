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
 * Nothing here may suggest that this add-on decides what anything COSTS,
 * settles anything, or keeps a ledger. It renders a document from numbers
 * somebody else computed, and it says so. A translation that softened
 * "renders" into "manages your invoicing" would be turning a limit somebody
 * can work around into a claim that is false.
 */

export const strings = {
  'en-US': {
    // ── host chrome this add-on owns ──────────────────────────────────────
    'addon.invoices.line':
      'Invoices, receipts and credit notes drawn from your own records. Pick the table, map the columns, and a row becomes a numbered document you can print, download or email.',
    'addon.invoices.what':
      'This turns a row into a document somebody can keep. You say which table holds the invoices and which columns hold the customer, the dates and the lines; a document is drawn from that, in the language you choose, as a web page and — for Latin scripts — as a PDF. Nothing is fetched from anywhere and no account is needed: the sheet is drawn from tables inside the add-on. It does no arithmetic of its own beyond adding up the lines it was given, and it keeps no ledger.',
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
    'addon.invoices.setting.number_prefix': 'Number prefix',
    'addon.invoices.setting.number_prefix.help':
      'The next number is shown here. Numbers are never reused, and gaps can happen.',
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
      'Rechnungen, Quittungen und Gutschriften aus Ihren eigenen Datensätzen. Tabelle wählen, Spalten zuordnen — und aus einer Zeile wird ein nummerierter Beleg zum Drucken, Herunterladen oder Versenden.',
    'addon.invoices.what':
      'Hieraus wird aus einer Zeile ein Beleg, den jemand aufbewahren kann. Sie geben an, welche Tabelle die Rechnungen enthält und welche Spalten Kunde, Daten und Positionen tragen; daraus wird ein Beleg gezeichnet, in der von Ihnen gewählten Sprache, als Webseite und — bei lateinischer Schrift — als PDF. Nichts wird irgendwoher geladen und es ist kein Konto nötig: der Bogen wird aus Tabellen im Add-on gezeichnet. Es rechnet nichts selbst, außer die übergebenen Positionen zu summieren, und führt kein Journal.',
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
    'addon.invoices.setting.number_prefix': 'Nummernpräfix',
    'addon.invoices.setting.number_prefix.help':
      'Die nächste Nummer steht hier. Nummern werden nie erneut vergeben, und Lücken sind möglich.',
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
      'Factures, reçus et avoirs établis à partir de vos enregistrements à vous. Choisissez la table, associez les colonnes, et une ligne devient un document numéroté à imprimer, télécharger ou envoyer.',
    'addon.invoices.what':
      'Ceci transforme une ligne en un document que l’on peut conserver. Vous indiquez quelle table contient les factures et quelles colonnes portent le client, les dates et les lignes ; un document en est tiré, dans la langue de votre choix, sous forme de page web et — pour les écritures latines — de PDF. Rien n’est récupéré ailleurs et aucun compte n’est nécessaire : la feuille est tracée à partir de tables internes à l’add-on. Il ne calcule rien de lui-même au-delà de l’addition des lignes qu’on lui donne, et ne tient aucun journal.',
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
    'addon.invoices.setting.number_prefix': 'Préfixe de numéro',
    'addon.invoices.setting.number_prefix.help':
      'Le numéro suivant est indiqué ici. Un numéro n’est jamais réutilisé, et des trous peuvent apparaître.',
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
      'Faktury, stvrzenky a dobropisy z vašich vlastních záznamů. Vyberte tabulku, přiřaďte sloupce a z řádku se stane číslovaný doklad k tisku, stažení nebo odeslání.',
    'addon.invoices.what':
      'Tímto se z řádku stane doklad, který si někdo může nechat. Určíte, která tabulka drží faktury a které sloupce nesou zákazníka, data a položky; z toho se nakreslí doklad, v jazyce, který zvolíte, jako webová stránka a — u latinky — jako PDF. Nic se odnikud nenačítá a není potřeba žádný účet: list se kreslí z tabulek uvnitř add-onu. Sám nic nepočítá kromě sečtení předaných položek a nevede žádný deník.',
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
    'addon.invoices.setting.number_prefix': 'Předčíslí',
    'addon.invoices.setting.number_prefix.help':
      'Další číslo je uvedeno zde. Čísla se nikdy nepoužívají znovu a mezery mohou nastat.',
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
      'Fakturaer, kvitteringer og kreditnotaer tegnet ud fra jeres egne rækker. Vælg tabellen, tilknyt kolonnerne, og en række bliver til et nummereret bilag, I kan udskrive, hente eller sende.',
    'addon.invoices.what':
      'Dette gør en række til et bilag, nogen kan gemme. I angiver, hvilken tabel der rummer fakturaerne, og hvilke kolonner der bærer kunden, datoerne og linjerne; ud af det tegnes et bilag, i den udgave I vælger, som en webside og — ved latinsk skrift — som PDF. Intet hentes nogen steder fra, og der kræves ingen konto: arket tegnes ud fra tabeller inde i add-on’et. Det regner ikke selv ud over at lægge de givne linjer sammen, og det fører ingen journal.',
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
    'addon.invoices.setting.number_prefix': 'Nummerforstavelse',
    'addon.invoices.setting.number_prefix.help':
      'Det næste nummer står her. Numre genbruges aldrig, og huller kan forekomme.',
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
      '从你自己的记录生成发票、收据和贷记单。选好表、对应好列，一行记录就变成一份可以打印、下载或发送的编号单据。',
    'addon.invoices.what':
      '这会把一行记录变成一份可以留存的单据。你指明哪张表存放发票，以及哪些列存放客户、日期和明细；据此绘制出一份单据，语言由你选择，形式是网页，若为拉丁文字还会有 PDF。不会从任何地方取数，也不需要账号：整张单据由插件内部的表格绘制而成。除了把给定的明细相加，它自己不做任何计算，也不记任何账。',
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
    'addon.invoices.setting.number_prefix': '编号前缀',
    'addon.invoices.setting.number_prefix.help':
      '下一个编号显示在这里。编号从不重复使用，出现断号是正常的。',
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
    'addon.invoices.record.none': '这类记录还没有单据按钮。请在插件设置中添加。',
    'addon.invoices.record.drawn': '已绘制{kind} {number}。',
    'addon.invoices.refuse.missing': '没有绘制任何内容：这条记录的 {columns} 没有值。',
    'addon.invoices.refuse.latinOnly':
      '网页已绘制，PDF 未绘制：内置字体画不出 {glyphs}。这一份请用浏览器自带的“另存为 PDF”。',
  },

  'zh-TW': {
    'addon.invoices.line':
      '從你自己的記錄產生發票、收據和貸記單。選好表、對應好欄位，一列記錄就變成一份可列印、下載或寄送的編號單據。',
    'addon.invoices.what':
      '這會把一列記錄變成一份可以留存的單據。你指明哪張表存放發票，以及哪些欄位存放客戶、日期和明細；據此繪製出一份單據，語言由你選擇，形式是網頁，若為拉丁文字還會有 PDF。不會從任何地方取數，也不需要帳號：整張單據由外掛內部的表格繪製而成。除了把給定的明細相加，它自己不做任何計算，也不記任何帳。',
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
    'addon.invoices.setting.number_prefix': '編號前綴',
    'addon.invoices.setting.number_prefix.help':
      '下一個編號顯示在這裡。編號從不重複使用，出現斷號是正常的。',
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
    'addon.invoices.record.none': '這類記錄還沒有單據按鈕。請在外掛設定中新增。',
    'addon.invoices.record.drawn': '已繪製{kind} {number}。',
    'addon.invoices.refuse.missing': '沒有繪製任何內容：這筆記錄的 {columns} 沒有值。',
    'addon.invoices.refuse.latinOnly':
      '網頁已繪製，PDF 未繪製：內建字型畫不出 {glyphs}。這一份請用瀏覽器內建的「另存為 PDF」。',
  },

  'ar-EG': {
    'addon.invoices.line':
      'فواتير وإيصالات وإشعارات دائنة من سجلاتك أنت. اختر الجدول، واربط الأعمدة، فيتحول السطر إلى مستند مرقّم تطبعه أو تنزّله أو ترسله.',
    'addon.invoices.what':
      'هذا يحوّل سطراً إلى مستند يمكن لأحد أن يحتفظ به. تحدّد أنت أيّ جدول يحمل الفواتير، وأيّ أعمدة تحمل العميل والتواريخ والبنود؛ ومن ذلك يُرسم مستند، باللغة التي تختارها، كصفحة ويب، وبصيغة PDF للكتابات اللاتينية. لا شيء يُجلب من أي مكان ولا حاجة إلى حساب: تُرسم الورقة من جداول داخل الإضافة. ولا تحسب شيئاً من عندها سوى جمع البنود التي تُعطى لها، ولا تمسك أي دفتر.',
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
    'addon.invoices.setting.number_prefix': 'بادئة الترقيم',
    'addon.invoices.setting.number_prefix.help':
      'الرقم التالي معروض هنا. لا يُعاد استخدام رقم أبداً، وقد تحدث فجوات.',
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
