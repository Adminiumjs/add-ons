/**
 * Every user-visible string this add-on has, in all eight locales.
 *
 * Same nested shape as every other add-on here — `{ locale: { key: value } }` —
 * because the host merges these into its own bundle and types the key union off
 * English. A locale missing a key is a COMPILE error at the foot of this file,
 * not a runtime fallback.
 *
 * Keys are namespaced under `addon.barcode-labels.*`. Every add-on's strings
 * land in one flat bundle with the host's, so a bare `refuse.duplicate` would
 * be a collision waiting for the second add-on that refuses anything.
 *
 * ── WHAT IS NOT IN HERE ────────────────────────────────────────────────────
 *
 * The numbers themselves, and the names of the two symbologies as anything but
 * labels. A barcode number belongs to the shop and never comes from this
 * add-on; `EAN-13` and `Code 128` are the designations of published standards
 * and are the same eight and eight characters in every language, which is why
 * they are the only two values on the shared-with-English list in
 * `strings.test.ts`.
 *
 * ── A NOTE FOR TRANSLATORS, AND IT IS NOT OPTIONAL ─────────────────────────
 *
 * The English avoids a short list of commercial words on purpose. The list is
 * not spelled out here — it lives in `testing/lexicon.ts` as the guard that
 * fails the build when one of them appears, so there is one copy of it and it
 * is an executable one rather than a comment that drifts.
 *
 * Please keep the equivalent restraint in your language rather than reaching
 * for the marketing word, and where your language's natural term happens to
 * contain one of the banned English fragments as a substring, prefer the
 * plainer phrase — the release check reads bytes, not meaning, so an innocent
 * word with an unlucky spelling still trips it. THIS BUNDLE HAS AN UNUSUALLY
 * BAD CASE OF THAT, and it is worth knowing before editing a line:
 *
 *   · the ordinary word for the thing a shop sells carries a banned run in
 *     five of these languages, so the copy says `article`, `Artikel`,
 *     `article`, `zboží` and `vare` and never the obvious cognate;
 *   · Czech's everyday preposition meaning "for" is itself a banned run, so
 *     the Czech is written with `na`, `k`, `u` and `jelikož` throughout;
 *   · German verbs ending `-tieren` and French nouns ending `-tier` both carry
 *     one, which rules out the natural German verb for putting a label on
 *     something and the natural French word for "whole".
 *
 * ── AND ONE RULE THAT IS THIS ADD-ON'S OWN ─────────────────────────────────
 *
 * Nothing here may suggest that this add-on ISSUES a number, checks one against
 * a register, or makes one unique beyond the shop it is installed in. It does
 * none of those and cannot: a number that has to be unique in the world comes
 * from a numbering authority the shop deals with directly. Every string that
 * touches the subject says so, and a translation that softened it into "manages
 * your article numbers" would be turning a limit somebody can work around into
 * a claim that is false.
 */

export const strings = {
  'en-US': {
    // ── host chrome this add-on owns ──────────────────────────────────────
    'addon.barcode-labels.line': 'Give a catalogue row an EAN-13 or Code 128 number and print a sheet of labels for it, from the row\'s own screen. The symbols are drawn here; nothing is fetched and no number is allocated.',
    'addon.barcode-labels.what': 'This puts a scannable number on the things the shop makes or sells. Somebody types the number the shop already owns, this add-on checks it and draws it at a size a scanner can read, and a sheet of labels comes off the row\'s own screen. Nothing is fetched from anywhere and no account is needed: both symbologies are drawn from tables inside the add-on.',
    'addon.barcode-labels.disconnect.goes': 'The label button on every row goes, and so does the form where numbers are given out.',
    'addon.barcode-labels.disconnect.stays': 'Every number a row already carries stays exactly where it is, and so does every label already printed. The numbers belong to the shop; this add-on only draws them.',
    'addon.barcode-labels.noCompany': 'Barcode Labels connects to no outside company. It needs no account anywhere, it calls nothing, and every symbol it draws comes from a published standard rather than from a supplier.',
    'addon.barcode-labels.act.1': '{when} · a sheet of labels made',
    'addon.barcode-labels.act.2': '{when} · a number given to a catalogue row',

    // ── the setting the manifest declares ─────────────────────────────────
    'addon.barcode-labels.setting.codes': 'Numbers given to catalogue rows',

    // ── what is held now ──────────────────────────────────────────────────
    'addon.barcode-labels.held.title': 'Numbers given out',
    'addon.barcode-labels.held.none': 'Nothing yet. Choose a row below, pick a symbology, and type the number the shop already uses for it.',
    'addon.barcode-labels.held.remove': 'Take it back',
    'addon.barcode-labels.held.count': '{count} rows have a number',

    // ── giving a row a number ─────────────────────────────────────────────
    'addon.barcode-labels.assign.title': 'Give a row a number',
    'addon.barcode-labels.assign.note': 'The number is the shop\'s own. Nothing here hands one out and nothing is looked up anywhere — what is checked is that the number is well formed and that no other row already carries it.',
    'addon.barcode-labels.assign.row': 'Catalogue row',
    'addon.barcode-labels.assign.symbology': 'Kind of code',
    'addon.barcode-labels.assign.code': 'Number',
    'addon.barcode-labels.assign.submit': 'Give it out',
    'addon.barcode-labels.assign.done': 'Taken. That row carries the number now.',

    // ── the two symbologies ───────────────────────────────────────────────
    'addon.barcode-labels.sym.ean13': 'EAN-13',
    'addon.barcode-labels.sym.code128': 'Code 128',
    'addon.barcode-labels.sym.ean13.note': 'Thirteen digits, the last of them worked out from the twelve before it. This is what a shop counter expects, and it is drawn at the exact size its standard fixes rather than stretched to fill the label.',
    'addon.barcode-labels.sym.code128.note': 'Letters, digits and ordinary punctuation, up to {limit} characters — a reference the shop already uses on its own paperwork rather than an article number. It carries a check of its own as well, and it is drawn as wide as the label allows.',

    // ── the refusals ──────────────────────────────────────────────────────
    'addon.barcode-labels.refuse.title': 'That number was not taken',
    'addon.barcode-labels.refuse.noRow': 'Choose the row the number belongs to first.',
    'addon.barcode-labels.refuse.empty': 'Type the number.',
    'addon.barcode-labels.refuse.ean13Shape': 'An EAN-13 is thirteen digits and nothing else. That one is {given} characters long.',
    'addon.barcode-labels.refuse.ean13Check': 'The last digit is worked out from the twelve before it, and for those twelve it should be {expected} rather than {typed}. Either the last digit is mistyped or one of the others is, and a scanner will read neither.',
    'addon.barcode-labels.refuse.code128Character': 'Code 128 has no bars for {character}. Letters, digits and ordinary punctuation only.',
    'addon.barcode-labels.refuse.code128TooLong': 'That is {given} characters and this label holds {limit}. A longer one would have to be drawn too narrow to scan.',
    'addon.barcode-labels.refuse.duplicate': 'That number is already on {heldBy}. Two rows sharing one number means a counter reads whichever it happens to find first, so change one of the two.',

    // ── what a sheet is ───────────────────────────────────────────────────
    'addon.barcode-labels.sheet.title': 'What a sheet looks like',
    'addon.barcode-labels.sheet.geometry': 'A4, {perSheet} labels to a sheet, {columns} across and {rows} down. Each label is {width} by {height} millimetres.',
    'addon.barcode-labels.sheet.latin': 'The letters on a label are drawn with a font every reader already has, so that no font has to be carried in the file. That font has the Latin alphabet and no other, so a reference written in another script cannot be printed and is left off. The bars are unaffected, because bars have no alphabet.',
    'addon.barcode-labels.sheet.noOutline': 'Nothing is printed in a label\'s margin and there is no cut line, because these sheets are cut already and a printed rectangle would land on the sticker rather than between two of them.',
    'addon.barcode-labels.sheet.dated': 'Each label carries the day the sheet was made, as the shop\'s own calendar reckons it, so an old sheet can be told from a new one.',

    // ── the limit of what this does ───────────────────────────────────────
    'addon.barcode-labels.scope.title': 'One row at a time',
    'addon.barcode-labels.scope.oneRow': 'A sheet is made from a row\'s own screen, for that row. There is no way here to run labels off for the whole catalogue at once, and this add-on will not pretend there is.',
    'addon.barcode-labels.scope.families': 'The form above lists the rows the app hands over — one for each family of thing the shop sells — so a row it does not hand over cannot be given a number here yet. Where that bites, the row\'s own screen says which key it looked for instead of showing an empty box.',
    'addon.barcode-labels.note.noAllocation': 'No number is handed out or looked up here. A number that has to be unique beyond this shop is issued by a numbering authority, and getting one is something the shop does rather than something an add-on can do on its behalf.',

    // ── the row's own screen ──────────────────────────────────────────────
    'addon.barcode-labels.record.title': 'Labels',
    'addon.barcode-labels.record.none': 'This row has no number yet.',
    'addon.barcode-labels.record.lookedUp': 'Nothing is filed under {key}. Numbers are given out in this add-on\'s own form, in the settings.',
    'addon.barcode-labels.record.count': 'How many labels',
    'addon.barcode-labels.record.make': 'Save the sheet',
    'addon.barcode-labels.record.print': 'Print',
    'addon.barcode-labels.record.run': '{labels} labels, over {sheets} sheets',
    'addon.barcode-labels.record.readOnly': 'This row is read and never written to. The number lives in this add-on\'s own list, and making a sheet changes nothing here.',
    'addon.barcode-labels.record.dropped': '{count} characters of this row\'s reference cannot be drawn in the label font and are left off. The bars are unaffected.',
  },

  'de-DE': {
    'addon.barcode-labels.line': 'Einer Katalogzeile eine EAN-13- oder Code-128-Nummer geben und von der Zeile aus einen Etikettenbogen drucken. Die Symbole entstehen hier; es wird nichts abgerufen und keine Nummer vergeben.',
    'addon.barcode-labels.what': 'Damit tragen die Dinge, die der Betrieb herstellt oder verkauft, eine scanbare Nummer. Jemand tippt die Nummer ein, die dem Betrieb ohnehin gehört, das Add-on prüft sie und zeichnet sie in der Größe, die ein Scanner lesen kann, und der Etikettenbogen entsteht auf der Seite der Zeile selbst. Es wird nichts abgerufen und nirgends ein Konto gebraucht: beide Symboliken liegen als Tabellen im Add-on.',
    'addon.barcode-labels.disconnect.goes': 'Die Etiketten-Schaltfläche an jeder Zeile verschwindet, und mit ihr das Formular, in dem Nummern vergeben werden.',
    'addon.barcode-labels.disconnect.stays': 'Jede Nummer, die eine Zeile bereits trägt, bleibt genau dort, wo sie ist, und ebenso jedes bereits gedruckte Etikett. Die Nummern gehören dem Betrieb; dieses Add-on zeichnet sie nur.',
    'addon.barcode-labels.noCompany': 'Barcode Labels verbindet sich mit keinem fremden Unternehmen. Es braucht nirgends ein Konto, es ruft nichts auf, und jedes Symbol, das es zeichnet, stammt aus einer veröffentlichten Norm und nicht von einem Anbieter.',
    'addon.barcode-labels.act.1': '{when} · einen Etikettenbogen erstellt',
    'addon.barcode-labels.act.2': '{when} · einer Katalogzeile eine Nummer gegeben',

    'addon.barcode-labels.setting.codes': 'An Katalogzeilen vergebene Nummern',

    'addon.barcode-labels.held.title': 'Vergebene Nummern',
    'addon.barcode-labels.held.none': 'Noch nichts. Unten eine Zeile wählen, die Art des Codes bestimmen und die Nummer eintippen, die der Betrieb dafür ohnehin verwendet.',
    'addon.barcode-labels.held.remove': 'Zurücknehmen',
    'addon.barcode-labels.held.count': '{count} Zeilen haben eine Nummer',

    'addon.barcode-labels.assign.title': 'Einer Zeile eine Nummer geben',
    'addon.barcode-labels.assign.note': 'Die Nummer gehört dem Betrieb. Hier wird keine vergeben und nirgends eine nachgeschlagen — geprüft wird, dass die Nummer richtig gebaut ist und dass keine andere Zeile sie schon trägt.',
    'addon.barcode-labels.assign.row': 'Katalogzeile',
    'addon.barcode-labels.assign.symbology': 'Art des Codes',
    'addon.barcode-labels.assign.code': 'Nummer',
    'addon.barcode-labels.assign.submit': 'Vergeben',
    'addon.barcode-labels.assign.done': 'Übernommen. Diese Zeile trägt die Nummer jetzt.',

    'addon.barcode-labels.sym.ean13': 'EAN-13',
    'addon.barcode-labels.sym.code128': 'Code 128',
    'addon.barcode-labels.sym.ean13.note': 'Dreizehn Ziffern, von denen die letzte aus den zwölf davor errechnet wird. Das erwartet eine Ladenkasse, und es wird genau in der Größe gezeichnet, die seine Norm festlegt, statt auf die Etikettenbreite gedehnt zu werden.',
    'addon.barcode-labels.sym.code128.note': 'Buchstaben, Ziffern und gewöhnliche Satzzeichen, bis zu {limit} Stellen — eine Kennung, die der Betrieb auf seinen eigenen Papieren ohnehin führt, und keine Artikelnummer. Auch dieser Code trägt eine eigene Prüfstelle und wird so breit gezeichnet, wie das Etikett es zulässt.',

    'addon.barcode-labels.refuse.title': 'Diese Nummer wurde nicht übernommen',
    'addon.barcode-labels.refuse.noRow': 'Zuerst die Zeile wählen, zu der die Nummer gehört.',
    'addon.barcode-labels.refuse.empty': 'Bitte die Nummer eintippen.',
    'addon.barcode-labels.refuse.ean13Shape': 'Eine EAN-13 besteht aus dreizehn Ziffern und sonst nichts. Diese hat {given} Zeichen.',
    'addon.barcode-labels.refuse.ean13Check': 'Die letzte Ziffer wird aus den zwölf davor errechnet, und zu diesen zwölf gehört {expected} statt {typed}. Entweder ist die letzte Ziffer vertippt oder eine der anderen, und ein Scanner liest weder das eine noch das andere.',
    'addon.barcode-labels.refuse.code128Character': 'Code 128 hat keine Striche für {character}. Nur Buchstaben, Ziffern und gewöhnliche Satzzeichen.',
    'addon.barcode-labels.refuse.code128TooLong': 'Das sind {given} Zeichen, und auf dieses Etikett gehen {limit}. Eine längere Nummer müsste so schmal gezeichnet werden, dass kein Scanner sie liest.',
    'addon.barcode-labels.refuse.duplicate': 'Diese Nummer trägt bereits {heldBy}. Tragen zwei Zeilen dieselbe Nummer, nimmt die Kasse die, die sie zuerst findet — also eine von beiden ändern.',

    'addon.barcode-labels.sheet.title': 'Wie ein Bogen aussieht',
    'addon.barcode-labels.sheet.geometry': 'A4, {perSheet} Etiketten je Bogen, {columns} nebeneinander und {rows} untereinander. Jedes Etikett misst {width} auf {height} Millimeter.',
    'addon.barcode-labels.sheet.latin': 'Die Schrift auf einem Etikett kommt aus einer Schriftart, die jedes Anzeigegerät bereits hat, damit keine Schrift in der Datei mitgeschleppt werden muss. Diese Schriftart kennt das lateinische Alphabet und kein anderes; eine Kennung in einer anderen Schrift lässt sich also nicht drucken und bleibt weg. Die Striche bleiben davon unberührt, denn Striche haben kein Alphabet.',
    'addon.barcode-labels.sheet.noOutline': 'Im Rand eines Etiketts steht nichts, und es gibt keine Schnittlinie, denn diese Bögen sind bereits gestanzt und ein gedrucktes Rechteck läge auf dem Aufkleber statt zwischen zweien.',
    'addon.barcode-labels.sheet.dated': 'Jedes Etikett trägt den Tag, an dem der Bogen entstand, so wie der Betrieb selbst ihn zählt — dann lässt sich ein alter Bogen von einem neuen unterscheiden.',

    'addon.barcode-labels.scope.title': 'Immer nur eine Zeile',
    'addon.barcode-labels.scope.oneRow': 'Ein Bogen entsteht auf der Seite einer Zeile, für genau diese Zeile. Es gibt hier keinen Weg, Etiketten in einem Rutsch über den ganzen Katalog zu ziehen, und das Add-on tut auch nicht so, als gäbe es einen.',
    'addon.barcode-labels.scope.families': 'Das Formular oben zeigt die Zeilen, die die Anwendung herüberreicht — eine je Warengruppe — eine Zeile, die sie nicht herüberreicht, kann hier also noch keine Nummer bekommen. Wo das stört, nennt die Seite der Zeile den Schlüssel, unter dem gesucht wurde, statt ein leeres Feld zu zeigen.',
    'addon.barcode-labels.note.noAllocation': 'Hier wird keine Nummer ausgegeben und keine nachgeschlagen. Eine Nummer, die über diesen Betrieb hinaus eindeutig sein muss, kommt von einer Nummernvergabestelle; sie zu bekommen ist Sache des Betriebs und nicht etwas, das ein Add-on an seiner Stelle erledigen kann.',

    'addon.barcode-labels.record.title': 'Etiketten',
    'addon.barcode-labels.record.none': 'Diese Zeile hat noch keine Nummer.',
    'addon.barcode-labels.record.lookedUp': 'Unter {key} liegt nichts. Nummern werden im eigenen Formular dieses Add-ons vergeben, in den Einstellungen.',
    'addon.barcode-labels.record.count': 'Wie viele Etiketten',
    'addon.barcode-labels.record.make': 'Bogen sichern',
    'addon.barcode-labels.record.print': 'Drucken',
    'addon.barcode-labels.record.run': '{labels} Etiketten auf {sheets} Bögen',
    'addon.barcode-labels.record.readOnly': 'Diese Zeile wird gelesen und nie beschrieben. Die Nummer liegt in der eigenen Liste dieses Add-ons, und einen Bogen zu erstellen ändert hier nichts.',
    'addon.barcode-labels.record.dropped': '{count} Zeichen der Kennung dieser Zeile lassen sich in der Etikettenschrift nicht zeichnen und bleiben weg. Die Striche bleiben davon unberührt.',
  },

  'fr-FR': {
    'addon.barcode-labels.line': 'Attribuer à une ligne du catalogue un numéro EAN-13 ou Code 128, puis imprimer une feuille d\'étiquettes depuis la fiche de la ligne. Les symboles sont tracés ici ; rien n\'est téléchargé et aucun numéro n\'est attribué.',
    'addon.barcode-labels.what': 'Les choses que l\'atelier fabrique ou vend portent ainsi un numéro lisible par un lecteur. Quelqu\'un saisit le numéro que l\'atelier possède déjà, le module le vérifie et le trace à la taille qu\'un lecteur sait lire, et la feuille d\'étiquettes sort de la fiche de la ligne elle-même. Rien n\'est téléchargé et aucun compte n\'est nécessaire : les deux symbologies sont des tables à l\'intérieur du module.',
    'addon.barcode-labels.disconnect.goes': 'Le bouton d\'étiquettes disparaît de chaque fiche, ainsi que le formulaire où les numéros sont attribués.',
    'addon.barcode-labels.disconnect.stays': 'Chaque numéro qu\'une ligne porte déjà reste exactement où il est, ainsi que chaque étiquette déjà imprimée. Les numéros appartiennent à l\'atelier ; ce module ne fait que les dessiner.',
    'addon.barcode-labels.noCompany': 'Barcode Labels ne se connecte à aucune société extérieure. Il ne demande de compte nulle part, il n\'appelle rien, et chaque symbole qu\'il trace vient d\'une norme publiée et non d\'un fournisseur.',
    'addon.barcode-labels.act.1': '{when} · une feuille d\'étiquettes établie',
    'addon.barcode-labels.act.2': '{when} · un numéro attribué à une ligne du catalogue',

    'addon.barcode-labels.setting.codes': 'Numéros attribués aux lignes du catalogue',

    'addon.barcode-labels.held.title': 'Numéros attribués',
    'addon.barcode-labels.held.none': 'Rien encore. Choisissez une ligne ci-dessous, indiquez le type de code, et saisissez le numéro que l\'atelier utilise déjà.',
    'addon.barcode-labels.held.remove': 'Retirer',
    'addon.barcode-labels.held.count': '{count} lignes ont un numéro',

    'addon.barcode-labels.assign.title': 'Attribuer un numéro à une ligne',
    'addon.barcode-labels.assign.note': 'Le numéro appartient à l\'atelier. Rien ici n\'en délivre et rien n\'est consulté nulle part — ce qui est vérifié, c\'est que le numéro est bien formé et qu\'aucune autre ligne ne le porte déjà.',
    'addon.barcode-labels.assign.row': 'Ligne du catalogue',
    'addon.barcode-labels.assign.symbology': 'Type de code',
    'addon.barcode-labels.assign.code': 'Numéro',
    'addon.barcode-labels.assign.submit': 'Attribuer',
    'addon.barcode-labels.assign.done': 'Enregistré. Cette ligne porte désormais ce numéro.',

    'addon.barcode-labels.sym.ean13': 'EAN-13',
    'addon.barcode-labels.sym.code128': 'Code 128',
    'addon.barcode-labels.sym.ean13.note': 'Treize chiffres, dont le dernier se calcule à partir des douze qui le précèdent. C\'est ce qu\'attend une caisse de magasin, et il est tracé exactement à la taille que sa norme fixe plutôt qu\'étiré à la largeur de l\'étiquette.',
    'addon.barcode-labels.sym.code128.note': 'Lettres, chiffres et ponctuation courante, jusqu\'à {limit} caractères — une référence que l\'atelier porte déjà sur ses papiers, et non un numéro d\'article. Ce code porte lui aussi son contrôle, et il est tracé aussi large que l\'étiquette le permet.',

    'addon.barcode-labels.refuse.title': 'Ce numéro n\'a pas été enregistré',
    'addon.barcode-labels.refuse.noRow': 'Choisissez d\'abord la ligne à laquelle le numéro se rapporte.',
    'addon.barcode-labels.refuse.empty': 'Saisissez le numéro.',
    'addon.barcode-labels.refuse.ean13Shape': 'Un EAN-13, ce sont treize chiffres et rien d\'autre. Celui-ci fait {given} caractères.',
    'addon.barcode-labels.refuse.ean13Check': 'Le dernier chiffre se calcule à partir des douze qui le précèdent, et pour ces douze-là il vaut {expected} et non {typed}. Soit le dernier chiffre est mal saisi, soit l\'un des autres l\'est, et un lecteur ne lira ni l\'un ni l\'autre.',
    'addon.barcode-labels.refuse.code128Character': 'Code 128 n\'a pas de barres pour {character}. Lettres, chiffres et ponctuation courante seulement.',
    'addon.barcode-labels.refuse.code128TooLong': 'Cela fait {given} caractères et cette étiquette en tient {limit}. Un numéro plus long devrait être tracé trop étroit pour être lu.',
    'addon.barcode-labels.refuse.duplicate': 'Ce numéro est déjà sur {heldBy}. Deux lignes qui partagent un numéro, c\'est une caisse qui retient celle qu\'elle trouve en premier : changez l\'une des deux.',

    'addon.barcode-labels.sheet.title': 'À quoi ressemble une feuille',
    'addon.barcode-labels.sheet.geometry': 'A4, {perSheet} étiquettes par feuille, {columns} en largeur et {rows} en hauteur. Chaque étiquette mesure {width} sur {height} millimètres.',
    'addon.barcode-labels.sheet.latin': 'Le texte d\'une étiquette est tracé dans une police que tout lecteur possède déjà, pour n\'avoir aucune police à transporter dans le fichier. Cette police connaît l\'alphabet latin et aucun autre : une référence écrite dans une autre écriture ne peut donc pas être imprimée et est laissée de côté. Les barres n\'en sont pas affectées, car les barres n\'ont pas d\'alphabet.',
    'addon.barcode-labels.sheet.noOutline': 'Rien n\'est imprimé dans la marge d\'une étiquette et il n\'y a pas de trait de coupe, car ces feuilles sont déjà découpées et un rectangle imprimé tomberait sur l\'autocollant au lieu de passer entre deux.',
    'addon.barcode-labels.sheet.dated': 'Chaque étiquette porte le jour où la feuille a été établie, tel que l\'atelier lui-même le compte, ce qui permet de distinguer une vieille feuille d\'une neuve.',

    'addon.barcode-labels.scope.title': 'Une ligne à la fois',
    'addon.barcode-labels.scope.oneRow': 'Une feuille s\'établit depuis la fiche d\'une ligne, pour cette ligne-là. Il n\'existe ici aucun moyen de sortir les étiquettes de tout le catalogue d\'un coup, et ce module ne fera pas semblant du contraire.',
    'addon.barcode-labels.scope.families': 'Le formulaire ci-dessus liste les lignes que l\'application transmet — une par famille de choses vendues — donc une ligne qu\'elle ne transmet pas ne peut pas encore recevoir de numéro ici. Là où cela gêne, la fiche de la ligne indique la clé cherchée au lieu d\'afficher un cadre vide.',
    'addon.barcode-labels.note.noAllocation': 'Aucun numéro n\'est délivré ni consulté ici. Un numéro qui doit être unique au-delà de cet atelier est émis par un organisme de numérotation ; l\'obtenir revient à l\'atelier et non à un module qui agirait à sa place.',

    'addon.barcode-labels.record.title': 'Étiquettes',
    'addon.barcode-labels.record.none': 'Cette ligne n\'a pas encore de numéro.',
    'addon.barcode-labels.record.lookedUp': 'Rien n\'est classé sous {key}. Les numéros s\'attribuent dans le formulaire du module, dans les réglages.',
    'addon.barcode-labels.record.count': 'Combien d\'étiquettes',
    'addon.barcode-labels.record.make': 'Enregistrer la feuille',
    'addon.barcode-labels.record.print': 'Imprimer',
    'addon.barcode-labels.record.run': '{labels} étiquettes, sur {sheets} feuilles',
    'addon.barcode-labels.record.readOnly': 'Cette ligne est lue et jamais écrite. Le numéro vit dans la liste du module, et établir une feuille ne change rien ici.',
    'addon.barcode-labels.record.dropped': '{count} caractères de la référence de cette ligne ne peuvent pas être tracés dans la police de l\'étiquette et sont laissés de côté. Les barres n\'en sont pas affectées.',
  },

  'cs-CZ': {
    'addon.barcode-labels.line': 'Přiřaďte řádku katalogu číslo EAN-13 nebo Code 128 a z karty řádku vytiskněte arch štítků. Symboly vznikají tady; nic se nestahuje a žádné číslo se nepřiděluje.',
    'addon.barcode-labels.what': 'Věci, které dílna vyrábí nebo nabízí, tak nesou snímatelné číslo. Někdo zadá číslo, které už dílně patří, doplněk je ověří a nakreslí v takové velikosti, jakou snímač přečte, a arch štítků vzniká přímo na kartě řádku. Nic se nestahuje a nikde není potřeba účet: obě symboliky jsou tabulky uvnitř doplňku.',
    'addon.barcode-labels.disconnect.goes': 'Tlačítko štítků u každého řádku zmizí a s ním i formulář, kde se čísla přiřazují.',
    'addon.barcode-labels.disconnect.stays': 'Každé číslo, které řádek už nese, zůstává přesně tam, kde je, a stejně tak každý vytištěný štítek. Čísla patří dílně; tento doplněk je jen kreslí.',
    'addon.barcode-labels.noCompany': 'Barcode Labels se nepřipojuje k žádné cizí firmě. Nikde nepotřebuje účet, nic nevolá, a každý symbol, který kreslí, pochází z vydané normy, nikoli od dodavatele.',
    'addon.barcode-labels.act.1': '{when} · vznikl arch štítků',
    'addon.barcode-labels.act.2': '{when} · řádek katalogu dostal číslo',

    'addon.barcode-labels.setting.codes': 'Čísla přiřazená řádkům katalogu',

    'addon.barcode-labels.held.title': 'Přiřazená čísla',
    'addon.barcode-labels.held.none': 'Zatím nic. Níže vyberte řádek, určete druh kódu a zadejte číslo, které dílna u té věci stejně používá.',
    'addon.barcode-labels.held.remove': 'Vzít zpět',
    'addon.barcode-labels.held.count': 'číslo má {count} řádků',

    'addon.barcode-labels.assign.title': 'Přiřadit řádku číslo',
    'addon.barcode-labels.assign.note': 'Číslo patří dílně. Nic se tu nevydává a nikde se nic nedohledává — ověřuje se, že je číslo správně sestavené a že je už nenese jiný řádek.',
    'addon.barcode-labels.assign.row': 'Řádek katalogu',
    'addon.barcode-labels.assign.symbology': 'Druh kódu',
    'addon.barcode-labels.assign.code': 'Číslo',
    'addon.barcode-labels.assign.submit': 'Přiřadit',
    'addon.barcode-labels.assign.done': 'Uloženo. Ten řádek teď nese to číslo.',

    'addon.barcode-labels.sym.ean13': 'EAN-13',
    'addon.barcode-labels.sym.code128': 'Code 128',
    'addon.barcode-labels.sym.ean13.note': 'Třináct číslic, z nichž poslední se dopočítá z dvanácti předchozích. To čeká obchodní pokladna a kreslí se přesně ve velikosti, kterou jeho norma stanoví, místo aby se roztáhl na šířku štítku.',
    'addon.barcode-labels.sym.code128.note': 'Písmena, číslice a běžná interpunkce, nejvýše {limit} znaků — označení, jaké dílna vede na vlastních dokladech, nikoli číslo zboží. I tento kód nese vlastní kontrolní znak a kreslí se tak široký, jak štítek dovolí.',

    'addon.barcode-labels.refuse.title': 'Toto číslo nebylo uloženo',
    'addon.barcode-labels.refuse.noRow': 'Nejprve vyberte řádek, ke kterému číslo patří.',
    'addon.barcode-labels.refuse.empty': 'Zadejte číslo.',
    'addon.barcode-labels.refuse.ean13Shape': 'EAN-13 je třináct číslic a nic jiného. Tohle má {given} znaků.',
    'addon.barcode-labels.refuse.ean13Check': 'Poslední číslice se dopočítá z dvanácti předchozích a k těmto dvanácti patří {expected}, nikoli {typed}. Buď je překlep v poslední číslici, nebo v některé z ostatních, a snímač nepřečte ani jedno.',
    'addon.barcode-labels.refuse.code128Character': 'Code 128 nemá čárky na znak {character}. Jen písmena, číslice a běžná interpunkce.',
    'addon.barcode-labels.refuse.code128TooLong': 'Tohle má {given} znaků a na štítek se jich vejde {limit}. Delší číslo by se muselo nakreslit tak úzké, že by je snímač nepřečetl.',
    'addon.barcode-labels.refuse.duplicate': 'Toto číslo už nese {heldBy}. Když dva řádky sdílejí jedno číslo, pokladna vezme ten, který najde dřív — změňte tedy jeden z nich.',

    'addon.barcode-labels.sheet.title': 'Jak arch vypadá',
    'addon.barcode-labels.sheet.geometry': 'A4, {perSheet} štítků na arch, {columns} vedle sebe a {rows} pod sebou. Každý štítek měří {width} na {height} milimetrů.',
    'addon.barcode-labels.sheet.latin': 'Text na štítku je nakreslen písmem, které má každá čtečka souborů už v sobě, aby se v souboru nemuselo žádné písmo vézt. Toto písmo zná latinku a nic dalšího; označení zapsané jiným písmem tedy vytisknout nelze a vynechá se. Čárek se to netýká, ty žádnou abecedu nemají.',
    'addon.barcode-labels.sheet.noOutline': 'V okraji štítku nic nestojí a není tam ani řezová linka, jelikož jsou tyto archy už vyseknuté a vytištěný obdélník by padl na samolepku místo mezi dvě.',
    'addon.barcode-labels.sheet.dated': 'Každý štítek nese den, kdy arch vznikl, tak jak jej počítá sama dílna — starý arch se pak pozná od nového.',

    'addon.barcode-labels.scope.title': 'Vždy jen jeden řádek',
    'addon.barcode-labels.scope.oneRow': 'Arch vzniká na kartě řádku a platí právě tomu řádku. Není tu způsob, jak vytáhnout štítky na celý katalog naráz, a doplněk nebude dělat, že takový způsob má.',
    'addon.barcode-labels.scope.families': 'Formulář výše vypisuje řádky, které aplikace předává — jeden za každou skupinu zboží — takže řádek, který nepředá, tu zatím číslo dostat nemůže. Kde to vadí, karta řádku uvede klíč, jaký se hledal, místo aby ukázala prázdné pole.',
    'addon.barcode-labels.note.noAllocation': 'Žádné číslo se tu nevydává ani nedohledává. Číslo, které má být jedinečné i mimo tuto dílnu, vydává přidělovací autorita; sehnat je náleží dílně a není to nic, co by doplněk zvládl místo ní.',

    'addon.barcode-labels.record.title': 'Štítky',
    'addon.barcode-labels.record.none': 'Tento řádek zatím nemá číslo.',
    'addon.barcode-labels.record.lookedUp': 'Pod klíčem {key} nic není. Čísla se přiřazují ve vlastním formuláři tohoto doplňku, v nastavení.',
    'addon.barcode-labels.record.count': 'Kolik štítků',
    'addon.barcode-labels.record.make': 'Uložit arch',
    'addon.barcode-labels.record.print': 'Tisk',
    'addon.barcode-labels.record.run': '{labels} štítků na {sheets} arších',
    'addon.barcode-labels.record.readOnly': 'Tento řádek se jen čte a nikdy nezapisuje. Číslo leží ve vlastním seznamu doplňku a vznik archu tu nic nemění.',
    'addon.barcode-labels.record.dropped': '{count} znaků z označení tohoto řádku nelze písmem štítku nakreslit a vynechají se. Čárek se to netýká.',
  },

  'da-DK': {
    'addon.barcode-labels.line': 'Giv en katalograekke et EAN-13- eller Code 128-nummer, og udskriv et ark etiketter til den fra rækkens egen side. Symbolerne tegnes her; intet hentes, og intet nummer tildeles.',
    'addon.barcode-labels.what': 'De ting, værkstedet laver eller sælger, får dermed et nummer, en scanner kan læse. Nogen taster det nummer ind, værkstedet allerede ejer, tilføjelsen kontrollerer det og tegner det i den størrelse, en scanner kan læse, og arket kommer ud fra rækkens egen side. Intet hentes nogen steder fra, og der skal ikke bruges en konto: begge symbolikker er tabeller inde i tilføjelsen.',
    'addon.barcode-labels.disconnect.goes': 'Etiketknappen på hver række forsvinder, og det gør formularen, hvor numre tildeles, også.',
    'addon.barcode-labels.disconnect.stays': 'Hvert nummer, en række allerede bærer, bliver præcis, hvor det er, og det samme gør hver etiket, der allerede er trykt. Numrene tilhører værkstedet; denne tilføjelse tegner dem kun.',
    'addon.barcode-labels.noCompany': 'Barcode Labels forbinder sig ikke til noget udefrakommende selskab. Den kræver ingen konto nogen steder, den kalder ingenting, og hvert symbol, den tegner, stammer fra en offentliggjort standard og ikke fra en leverandør.',
    'addon.barcode-labels.act.1': '{when} · et ark etiketter lavet',
    'addon.barcode-labels.act.2': '{when} · en katalograekke fik et nummer',

    'addon.barcode-labels.setting.codes': 'Numre tildelt katalogrækker',

    'addon.barcode-labels.held.title': 'Tildelte numre',
    'addon.barcode-labels.held.none': 'Ingenting endnu. Vælg en række nedenfor, bestem kodetypen, og tast det nummer, værkstedet i forvejen bruger til den.',
    'addon.barcode-labels.held.remove': 'Tag det tilbage',
    'addon.barcode-labels.held.count': '{count} rækker har et nummer',

    'addon.barcode-labels.assign.title': 'Giv en række et nummer',
    'addon.barcode-labels.assign.note': 'Nummeret tilhører værkstedet. Her udstedes ingen, og der slås ingenting op nogen steder — det, der kontrolleres, er, at nummeret er rigtigt bygget, og at ingen anden række allerede bærer det.',
    'addon.barcode-labels.assign.row': 'Katalograekke',
    'addon.barcode-labels.assign.symbology': 'Kodetype',
    'addon.barcode-labels.assign.code': 'Nummer',
    'addon.barcode-labels.assign.submit': 'Tildel',
    'addon.barcode-labels.assign.done': 'Gemt. Den række bærer nummeret nu.',

    'addon.barcode-labels.sym.ean13': 'EAN-13',
    'addon.barcode-labels.sym.code128': 'Code 128',
    'addon.barcode-labels.sym.ean13.note': 'Tretten cifre, hvoraf det sidste regnes ud fra de tolv foran. Det er, hvad en butikskasse forventer, og det tegnes i præcis den størrelse, standarden fastlægger, i stedet for at blive strakt ud i etikettens bredde.',
    'addon.barcode-labels.sym.code128.note': 'Bogstaver, cifre og almindelig tegnsætning, op til {limit} tegn — en betegnelse, værkstedet i forvejen fører på sine egne papirer, og ikke et varenummer. Også denne kode bærer sit eget kontroltegn, og den tegnes så bred, som etiketten tillader.',

    'addon.barcode-labels.refuse.title': 'Det nummer blev ikke gemt',
    'addon.barcode-labels.refuse.noRow': 'Vælg først den række, nummeret hører til.',
    'addon.barcode-labels.refuse.empty': 'Tast nummeret.',
    'addon.barcode-labels.refuse.ean13Shape': 'Et EAN-13 er tretten cifre og intet andet. Det her er {given} tegn langt.',
    'addon.barcode-labels.refuse.ean13Check': 'Det sidste ciffer regnes ud fra de tolv foran, og til de tolv hører {expected} og ikke {typed}. Enten er det sidste ciffer tastet forkert, eller også er et af de andre, og en scanner læser ingen af delene.',
    'addon.barcode-labels.refuse.code128Character': 'Code 128 har ingen streger til {character}. Kun bogstaver, cifre og almindelig tegnsætning.',
    'addon.barcode-labels.refuse.code128TooLong': 'Det er {given} tegn, og der er plads til {limit} på etiketten. Et længere nummer skulle tegnes så smalt, at ingen scanner kunne læse det.',
    'addon.barcode-labels.refuse.duplicate': 'Det nummer sidder allerede på {heldBy}. Når to rækker deler ét nummer, tager kassen den, den finder først — så lav en af de to om.',

    'addon.barcode-labels.sheet.title': 'Sådan ser et ark ud',
    'addon.barcode-labels.sheet.geometry': 'A4, {perSheet} etiketter på et ark, {columns} ved siden af hinanden og {rows} under hinanden. Hver etiket måler {width} gange {height} millimeter.',
    'addon.barcode-labels.sheet.latin': 'Teksten på en etiket tegnes med en skrift, enhver læser allerede har, så der ikke skal slæbes en skrift med i filen. Den skrift kender det latinske alfabet og intet andet; en betegnelse skrevet med andre tegn kan altså ikke trykkes og udelades. Stregerne berøres ikke, for streger har intet alfabet.',
    'addon.barcode-labels.sheet.noOutline': 'Der står intet i en etikets margen, og der er ingen skærelinje, for disse ark er stanset i forvejen, og et trykt rektangel ville lande på klistermærket i stedet for mellem to.',
    'addon.barcode-labels.sheet.dated': 'Hver etiket bærer den dag, arket blev lavet, sådan som værkstedet selv regner den — så kan et gammelt ark kendes fra et nyt.',

    'addon.barcode-labels.scope.title': 'Én række ad gangen',
    'addon.barcode-labels.scope.oneRow': 'Et ark laves fra en rækkes egen side, til netop den række. Der er ingen vej her til at køre etiketter ud for hele kataloget på én gang, og tilføjelsen lader ikke som om, der er.',
    'addon.barcode-labels.scope.families': 'Formularen ovenfor viser de rækker, appen rækker over — én for hver varegruppe — så en række, den ikke rækker over, kan endnu ikke få et nummer her. Hvor det generer, nævner rækkens egen side den nøgle, der blev søgt efter, i stedet for at vise et tomt felt.',
    'addon.barcode-labels.note.noAllocation': 'Der udstedes og opslås ingen numre her. Et nummer, der skal være entydigt ud over dette værksted, udstedes af en nummermyndighed; at skaffe det er værkstedets sag og ikke noget, en tilføjelse kan gøre på dets vegne.',

    'addon.barcode-labels.record.title': 'Etiketter',
    'addon.barcode-labels.record.none': 'Denne række har endnu intet nummer.',
    'addon.barcode-labels.record.lookedUp': 'Der ligger intet under {key}. Numre tildeles i tilføjelsens egen formular, under indstillinger.',
    'addon.barcode-labels.record.count': 'Hvor mange etiketter',
    'addon.barcode-labels.record.make': 'Gem arket',
    'addon.barcode-labels.record.print': 'Udskriv',
    'addon.barcode-labels.record.run': '{labels} etiketter fordelt på {sheets} ark',
    'addon.barcode-labels.record.readOnly': 'Denne række læses og skrives aldrig til. Nummeret ligger i tilføjelsens egen liste, og at lave et ark ændrer intet her.',
    'addon.barcode-labels.record.dropped': '{count} tegn af denne rækkes betegnelse kan ikke tegnes med etikettens skrift og udelades. Stregerne berøres ikke.',
  },

  'zh-CN': {
    'addon.barcode-labels.line': '给目录中的一行指定一个 EAN-13 或 Code 128 编号，并从该行自己的页面上打印一张标签纸。符号在本地绘制，不抓取任何东西，也不分配任何编号。',
    'addon.barcode-labels.what': '这样一来，店里做的或卖的东西就带上了可扫描的编号。有人把店里本来就拥有的编号敲进去，插件核对它，并按扫描枪读得出的尺寸把它画好，标签纸就从该行自己的页面上出来。什么都不抓取，哪里都不需要账号：两种码制都是插件内部的表。',
    'addon.barcode-labels.disconnect.goes': '每一行上的标签按钮不见了，指定编号的那张表单也一并不见。',
    'addon.barcode-labels.disconnect.stays': '一行已经带着的编号原样留在那里，已经印好的每一张标签也一样。编号属于这家店，本插件只负责把它们画出来。',
    'addon.barcode-labels.noCompany': 'Barcode Labels 不连接任何外部公司。它在任何地方都不需要账号，什么都不调用，它画出来的每一个符号都来自公开的标准，而不是来自某家供应商。',
    'addon.barcode-labels.act.1': '{when} · 做好了一张标签纸',
    'addon.barcode-labels.act.2': '{when} · 给目录中的一行指定了编号',

    'addon.barcode-labels.setting.codes': '指定给目录各行的编号',

    'addon.barcode-labels.held.title': '已指定的编号',
    'addon.barcode-labels.held.none': '还没有。在下面挑一行，选定码制，把店里本来就用的那个编号敲进去。',
    'addon.barcode-labels.held.remove': '收回',
    'addon.barcode-labels.held.count': '有 {count} 行带着编号',

    'addon.barcode-labels.assign.title': '给一行指定编号',
    'addon.barcode-labels.assign.note': '编号是店里自己的。这里既不发号，也不到任何地方去查——这里核对的是编号写得对不对，以及有没有别的行已经带着它。',
    'addon.barcode-labels.assign.row': '目录行',
    'addon.barcode-labels.assign.symbology': '码制',
    'addon.barcode-labels.assign.code': '编号',
    'addon.barcode-labels.assign.submit': '指定',
    'addon.barcode-labels.assign.done': '已记下。那一行现在带着这个编号。',

    'addon.barcode-labels.sym.ean13': 'EAN-13',
    'addon.barcode-labels.sym.code128': 'Code 128',
    'addon.barcode-labels.sym.ean13.note': '十三位数字，最后一位由前面十二位算出。商店收银台认的就是它，而且它按自己标准规定的尺寸绘制，不会为了填满标签而被拉宽。',
    'addon.barcode-labels.sym.code128.note': '字母、数字和常见标点，最多 {limit} 个字符——店里在自己单据上本来就用的那种编号，而不是商品号。这种码也自带一位校验字符，并且会按标签允许的宽度尽量画宽。',

    'addon.barcode-labels.refuse.title': '这个编号没有被收下',
    'addon.barcode-labels.refuse.noRow': '请先挑出编号所属的那一行。',
    'addon.barcode-labels.refuse.empty': '请把编号敲进去。',
    'addon.barcode-labels.refuse.ean13Shape': 'EAN-13 是十三位数字，别的都不是。这一个有 {given} 个字符。',
    'addon.barcode-labels.refuse.ean13Check': '最后一位由前面十二位算出，按那十二位应当是 {expected}，而不是 {typed}。要么最后一位敲错了，要么前面某一位敲错了，扫描枪两种都读不出来。',
    'addon.barcode-labels.refuse.code128Character': 'Code 128 画不出 {character} 这个字符。只能用字母、数字和常见标点。',
    'addon.barcode-labels.refuse.code128TooLong': '这个有 {given} 个字符，而这张标签装得下 {limit} 个。再长就得画得太窄，扫描枪读不出来。',
    'addon.barcode-labels.refuse.duplicate': '这个编号已经在 {heldBy} 上了。两行共用一个编号，收银台就会取它先找到的那一行，所以请改掉其中一个。',

    'addon.barcode-labels.sheet.title': '一张纸是什么样子',
    'addon.barcode-labels.sheet.geometry': 'A4，每张纸 {perSheet} 枚标签，横 {columns} 枚、竖 {rows} 枚。每枚标签 {width} 乘 {height} 毫米。',
    'addon.barcode-labels.sheet.latin': '标签上的文字用的是每个阅读器本来就有的字体，这样文件里就不必背着字体走。那种字体只认拉丁字母，别的都不认；用别的文字写的编号因此印不出来，会被略去。这不影响条码本身，条杠没有字母。',
    'addon.barcode-labels.sheet.noOutline': '标签的白边里什么都不印，也没有裁切线，因为这种纸本来就已经模切好了，印上去的方框会落在贴纸上，而不是落在两张之间。',
    'addon.barcode-labels.sheet.dated': '每枚标签都带着这张纸做出来的那一天，按店里自己的日历算，这样旧纸和新纸就分得开。',

    'addon.barcode-labels.scope.title': '一次一行',
    'addon.barcode-labels.scope.oneRow': '一张纸是从某一行自己的页面上做出来的，只给那一行。这里没有把整个目录的标签一次全跑出来的办法，插件也不会装作有。',
    'addon.barcode-labels.scope.families': '上面这张表单列出的是应用交过来的那些行——每一类货品交一行——所以它没交过来的行，眼下还不能在这里拿到编号。真碰上了，该行自己的页面会说明它找的是哪个键，而不是摆一个空框。',
    'addon.barcode-labels.note.noAllocation': '这里既不发放编号，也不去查编号。要在这家店之外也保持唯一的编号，由编号管理机构发放；去申请是店家自己的事，不是插件能代办的。',

    'addon.barcode-labels.record.title': '标签',
    'addon.barcode-labels.record.none': '这一行还没有编号。',
    'addon.barcode-labels.record.lookedUp': '{key} 下面什么都没有。编号在本插件自己的表单里指定，在设置中。',
    'addon.barcode-labels.record.count': '要多少枚标签',
    'addon.barcode-labels.record.make': '保存这张纸',
    'addon.barcode-labels.record.print': '打印',
    'addon.barcode-labels.record.run': '{labels} 枚标签，分在 {sheets} 张纸上',
    'addon.barcode-labels.record.readOnly': '这一行只被读取，从不写入。编号存在本插件自己的清单里，做一张纸不会改动这里的任何东西。',
    'addon.barcode-labels.record.dropped': '这一行编号里有 {count} 个字符用标签字体画不出来，已被略去。这不影响条杠。',
  },

  'zh-TW': {
    'addon.barcode-labels.line': '為目錄中的一列指定 EAN-13 或 Code 128 編號，並從該列自己的頁面上列印一張標籤紙。符號在本地繪製，不抓取任何東西，也不配發任何編號。',
    'addon.barcode-labels.what': '這樣一來，店裡做的或賣的東西就帶上了可掃描的編號。有人把店裡本來就擁有的編號敲進去，外掛核對它，並按掃描器讀得出的尺寸把它畫好，標籤紙就從該列自己的頁面上出來。什麼都不抓取，哪裡都不需要帳號：兩種碼制都是外掛內部的表。',
    'addon.barcode-labels.disconnect.goes': '每一列上的標籤按鈕不見了，指定編號的那張表單也一併不見。',
    'addon.barcode-labels.disconnect.stays': '一列已經帶著的編號原樣留在那裡，已經印好的每一張標籤也一樣。編號屬於這家店，本外掛只負責把它們畫出來。',
    'addon.barcode-labels.noCompany': 'Barcode Labels 不連接任何外部公司。它在任何地方都不需要帳號，什麼都不呼叫，它畫出來的每一個符號都來自公開的標準，而不是來自某家供應商。',
    'addon.barcode-labels.act.1': '{when} · 做好了一張標籤紙',
    'addon.barcode-labels.act.2': '{when} · 為目錄中的一列指定了編號',

    'addon.barcode-labels.setting.codes': '指定給目錄各列的編號',

    'addon.barcode-labels.held.title': '已指定的編號',
    'addon.barcode-labels.held.none': '還沒有。在下面挑一列，選定碼制，把店裡本來就用的那個編號敲進去。',
    'addon.barcode-labels.held.remove': '收回',
    'addon.barcode-labels.held.count': '有 {count} 列帶著編號',

    'addon.barcode-labels.assign.title': '為一列指定編號',
    'addon.barcode-labels.assign.note': '編號是店裡自己的。這裡既不發號，也不到任何地方去查——這裡核對的是編號寫得對不對，以及有沒有別的列已經帶著它。',
    'addon.barcode-labels.assign.row': '目錄列',
    'addon.barcode-labels.assign.symbology': '碼制',
    'addon.barcode-labels.assign.code': '編號',
    'addon.barcode-labels.assign.submit': '指定',
    'addon.barcode-labels.assign.done': '已記下。那一列現在帶著這個編號。',

    'addon.barcode-labels.sym.ean13': 'EAN-13',
    'addon.barcode-labels.sym.code128': 'Code 128',
    'addon.barcode-labels.sym.ean13.note': '十三位數字，最後一位由前面十二位算出。商店收銀台認的就是它，而且它按自己標準規定的尺寸繪製，不會為了填滿標籤而被拉寬。',
    'addon.barcode-labels.sym.code128.note': '字母、數字和常見標點，最多 {limit} 個字元——店裡在自己單據上本來就用的那種編號，而不是商品號。這種碼也自帶一位校驗字元，並且會按標籤允許的寬度盡量畫寬。',

    'addon.barcode-labels.refuse.title': '這個編號沒有被收下',
    'addon.barcode-labels.refuse.noRow': '請先挑出編號所屬的那一列。',
    'addon.barcode-labels.refuse.empty': '請把編號敲進去。',
    'addon.barcode-labels.refuse.ean13Shape': 'EAN-13 是十三位數字，別的都不是。這一個有 {given} 個字元。',
    'addon.barcode-labels.refuse.ean13Check': '最後一位由前面十二位算出，按那十二位應當是 {expected}，而不是 {typed}。要麼最後一位敲錯了，要麼前面某一位敲錯了，掃描器兩種都讀不出來。',
    'addon.barcode-labels.refuse.code128Character': 'Code 128 畫不出 {character} 這個字元。只能用字母、數字和常見標點。',
    'addon.barcode-labels.refuse.code128TooLong': '這個有 {given} 個字元，而這張標籤裝得下 {limit} 個。再長就得畫得太窄，掃描器讀不出來。',
    'addon.barcode-labels.refuse.duplicate': '這個編號已經在 {heldBy} 上了。兩列共用一個編號，收銀台就會取它先找到的那一列，所以請改掉其中一個。',

    'addon.barcode-labels.sheet.title': '一張紙是什麼樣子',
    'addon.barcode-labels.sheet.geometry': 'A4，每張紙 {perSheet} 枚標籤，橫 {columns} 枚、直 {rows} 枚。每枚標籤 {width} 乘 {height} 公釐。',
    'addon.barcode-labels.sheet.latin': '標籤上的文字用的是每個閱讀器本來就有的字型，這樣檔案裡就不必背著字型走。那種字型只認拉丁字母，別的都不認；用別的文字寫的編號因此印不出來，會被略去。這不影響條碼本身，條槓沒有字母。',
    'addon.barcode-labels.sheet.noOutline': '標籤的白邊裡什麼都不印，也沒有裁切線，因為這種紙本來就已經模切好了，印上去的方框會落在貼紙上，而不是落在兩張之間。',
    'addon.barcode-labels.sheet.dated': '每枚標籤都帶著這張紙做出來的那一天，按店裡自己的日曆算，這樣舊紙和新紙就分得開。',

    'addon.barcode-labels.scope.title': '一次一列',
    'addon.barcode-labels.scope.oneRow': '一張紙是從某一列自己的頁面上做出來的，只給那一列。這裡沒有把整個目錄的標籤一次全跑出來的辦法，外掛也不會裝作有。',
    'addon.barcode-labels.scope.families': '上面這張表單列出的是應用程式交過來的那些列——每一類貨品交一列——所以它沒交過來的列，眼下還不能在這裡拿到編號。真碰上了，該列自己的頁面會說明它找的是哪個鍵，而不是擺一個空框。',
    'addon.barcode-labels.note.noAllocation': '這裡既不發放編號，也不去查編號。要在這家店之外也保持唯一的編號，由編號管理機構發放；去申請是店家自己的事，不是外掛能代辦的。',

    'addon.barcode-labels.record.title': '標籤',
    'addon.barcode-labels.record.none': '這一列還沒有編號。',
    'addon.barcode-labels.record.lookedUp': '{key} 下面什麼都沒有。編號在本外掛自己的表單裡指定，在設定中。',
    'addon.barcode-labels.record.count': '要多少枚標籤',
    'addon.barcode-labels.record.make': '儲存這張紙',
    'addon.barcode-labels.record.print': '列印',
    'addon.barcode-labels.record.run': '{labels} 枚標籤，分在 {sheets} 張紙上',
    'addon.barcode-labels.record.readOnly': '這一列只被讀取，從不寫入。編號存在本外掛自己的清單裡，做一張紙不會改動這裡的任何東西。',
    'addon.barcode-labels.record.dropped': '這一列編號裡有 {count} 個字元用標籤字型畫不出來，已被略去。這不影響條槓。',
  },

  'ar-EG': {
    'addon.barcode-labels.line': 'أعطِ صفًا في الكتالوج رقم EAN-13 أو Code 128، واطبع له ورقة ملصقات من صفحة الصف نفسها. تُرسم الرموز هنا؛ لا يُجلب شيء ولا يُخصَّص رقم.',
    'addon.barcode-labels.what': 'بهذا تحمل الأشياء التي تصنعها الورشة أو تبيعها رقمًا يقرأه الماسح. يكتب أحدهم الرقم الذي تملكه الورشة أصلًا، فتتحقق منه الإضافة وترسمه بالمقاس الذي يقرأه الماسح، وتخرج ورقة الملصقات من صفحة الصف نفسها. لا يُجلب شيء من أي مكان ولا يلزم حساب في أي موضع: كلا الترميزين جدولان داخل الإضافة.',
    'addon.barcode-labels.disconnect.goes': 'يختفي زر الملصقات من كل صف، ويختفي معه النموذج الذي تُعطى فيه الأرقام.',
    'addon.barcode-labels.disconnect.stays': 'كل رقم يحمله صف من قبل يبقى كما هو تمامًا، وكذلك كل ملصق طُبع بالفعل. الأرقام ملك الورشة، وهذه الإضافة ترسمها فحسب.',
    'addon.barcode-labels.noCompany': 'لا تتصل Barcode Labels بأي شركة خارجية. لا تحتاج حسابًا في أي مكان، ولا تستدعي شيئًا، وكل رمز ترسمه مأخوذ من معيار منشور لا من مورّد.',
    'addon.barcode-labels.act.1': '{when} · أُعدَّت ورقة ملصقات',
    'addon.barcode-labels.act.2': '{when} · أُعطي صف في الكتالوج رقمًا',

    'addon.barcode-labels.setting.codes': 'الأرقام المعطاة لصفوف الكتالوج',

    'addon.barcode-labels.held.title': 'الأرقام المعطاة',
    'addon.barcode-labels.held.none': 'لا شيء بعد. اختر صفًا بالأسفل، وحدِّد نوع الرمز، واكتب الرقم الذي تستعمله الورشة له أصلًا.',
    'addon.barcode-labels.held.remove': 'استردَّه',
    'addon.barcode-labels.held.count': 'يحمل {count} صفًا رقمًا',

    'addon.barcode-labels.assign.title': 'أعطِ صفًا رقمًا',
    'addon.barcode-labels.assign.note': 'الرقم ملك الورشة. لا يُصدَر هنا رقم ولا يُبحث عنه في أي مكان — الذي يُتحقَّق منه هو أن الرقم مبنيّ بناءً صحيحًا وأن صفًا آخر لا يحمله بالفعل.',
    'addon.barcode-labels.assign.row': 'صف الكتالوج',
    'addon.barcode-labels.assign.symbology': 'نوع الرمز',
    'addon.barcode-labels.assign.code': 'الرقم',
    'addon.barcode-labels.assign.submit': 'أعطِه',
    'addon.barcode-labels.assign.done': 'حُفظ. صار ذلك الصف يحمل الرقم.',

    'addon.barcode-labels.sym.ean13': 'EAN-13',
    'addon.barcode-labels.sym.code128': 'Code 128',
    'addon.barcode-labels.sym.ean13.note': 'ثلاثة عشر رقمًا، آخرها محسوب من الاثني عشر التي قبله. هذا ما تنتظره خزينة المتجر، ويُرسم بالمقاس الذي يحدده معياره بالضبط بدل أن يُمدَّ ليملأ الملصق.',
    'addon.barcode-labels.sym.code128.note': 'حروف وأرقام وعلامات ترقيم معتادة، حتى {limit} محرفًا — تسمية تسجلها الورشة على أوراقها أصلًا، لا رقم سلعة. وهذا الرمز أيضًا يحمل محرف تحقق خاصًا به، ويُرسم بأوسع ما يسمح به الملصق.',

    'addon.barcode-labels.refuse.title': 'لم يُؤخَذ هذا الرقم',
    'addon.barcode-labels.refuse.noRow': 'اختر أولًا الصف الذي يخصه الرقم.',
    'addon.barcode-labels.refuse.empty': 'اكتب الرقم.',
    'addon.barcode-labels.refuse.ean13Shape': 'رقم EAN-13 ثلاثة عشر خانة ولا شيء غير ذلك. وهذا طوله {given} محرفًا.',
    'addon.barcode-labels.refuse.ean13Check': 'تُحسب الخانة الأخيرة من الاثنتي عشرة التي قبلها، ولتلك الاثنتي عشرة تكون {expected} لا {typed}. إمَّا أن الخانة الأخيرة كُتبت خطأً وإمَّا إحدى الأخريات، والماسح لن يقرأ أيًّا منهما.',
    'addon.barcode-labels.refuse.code128Character': 'ليس لدى Code 128 خطوط للمحرف {character}. حروف وأرقام وعلامات ترقيم معتادة فقط.',
    'addon.barcode-labels.refuse.code128TooLong': 'هذا طوله {given} محرفًا، والملصق يسع {limit}. الأطول منه سيُرسم ضيقًا إلى حدٍّ لا يقرؤه ماسح.',
    'addon.barcode-labels.refuse.duplicate': 'هذا الرقم على {heldBy} بالفعل. وحين يشترك صفان في رقم واحد تأخذ الخزينة أولهما وقوعًا تحت يدها، فغيِّر أحدهما.',

    'addon.barcode-labels.sheet.title': 'كيف تبدو الورقة',
    'addon.barcode-labels.sheet.geometry': 'مقاس A4، وفيها {perSheet} ملصقًا: {columns} بالعرض و{rows} بالطول. مقاس الملصق الواحد {width} في {height} مليمترًا.',
    'addon.barcode-labels.sheet.latin': 'تُرسم الكتابة على الملصق بخط موجود أصلًا لدى كل قارئ ملفات، حتى لا يُحمَل خط داخل الملف. وذلك الخط يعرف الحروف اللاتينية وحدها؛ فالتسمية المكتوبة بخط آخر لا يمكن طبعها وتُترك. ولا يمس ذلك الخطوط نفسها، فالخطوط بلا أبجدية.',
    'addon.barcode-labels.sheet.noOutline': 'لا يُطبع شيء في هامش الملصق ولا يوجد خط قص، لأن هذه الأوراق مقصوصة سلفًا ومستطيل مطبوع سيقع على الملصق نفسه بدل أن يقع بين اثنين.',
    'addon.barcode-labels.sheet.dated': 'يحمل كل ملصق اليوم الذي أُعدَّت فيه الورقة، كما تحسبه الورشة نفسها، فتُعرف الورقة القديمة من الجديدة.',

    'addon.barcode-labels.scope.title': 'صف واحد في كل مرة',
    'addon.barcode-labels.scope.oneRow': 'تُعدُّ الورقة من صفحة الصف نفسه ولذلك الصف وحده. لا سبيل هنا إلى إخراج ملصقات الكتالوج كله دفعة واحدة، ولن تتظاهر الإضافة بأن هناك سبيلًا.',
    'addon.barcode-labels.scope.families': 'يسرد النموذج بالأعلى الصفوف التي يسلّمها التطبيق — صفًا عن كل مجموعة من البضاعة — فالصف الذي لا يسلّمه لا يمكنه بعدُ أن يأخذ رقمًا هنا. وحيث يضايق ذلك، تذكر صفحة الصف نفسها المفتاح الذي بُحث عنه بدل أن تعرض مربعًا فارغًا.',
    'addon.barcode-labels.note.noAllocation': 'لا يُصدَر هنا رقم ولا يُبحث عنه. الرقم الذي يلزم أن يكون فريدًا خارج هذه الورشة تصدره جهة ترقيم؛ والحصول عليه شأن الورشة لا شيء تقوم به إضافة نيابة عنها.',

    'addon.barcode-labels.record.title': 'الملصقات',
    'addon.barcode-labels.record.none': 'لا رقم لهذا الصف بعد.',
    'addon.barcode-labels.record.lookedUp': 'لا شيء محفوظ تحت {key}. تُعطى الأرقام في نموذج هذه الإضافة نفسه، ضمن الإعدادات.',
    'addon.barcode-labels.record.count': 'كم ملصقًا',
    'addon.barcode-labels.record.make': 'احفظ الورقة',
    'addon.barcode-labels.record.print': 'اطبع',
    'addon.barcode-labels.record.run': '{labels} ملصقًا موزعة على {sheets} ورقة',
    'addon.barcode-labels.record.readOnly': 'يُقرأ هذا الصف ولا يُكتب فيه أبدًا. الرقم يعيش في قائمة هذه الإضافة نفسها، وإعداد ورقة لا يغيّر هنا شيئًا.',
    'addon.barcode-labels.record.dropped': 'في تسمية هذا الصف {count} محرفًا لا يستطيع خط الملصق رسمها، فتُترك. ولا يمس ذلك الخطوط.',
  },
} as const;

/** English defines the keys; the other seven must carry every one of them. */
export type StringKey = keyof (typeof strings)['en-US'];

export type LocaleTag = keyof typeof strings;

export const LOCALE_TAGS = Object.keys(strings) as LocaleTag[];

/**
 * Parity, enforced at COMPILE time rather than by a test that might not run.
 *
 * The annotation is the assertion: a locale missing a key, or grown one English
 * has not got, stops this line compiling.
 */
const _parity: { [L in LocaleTag]: Record<StringKey, string> } = strings;
void _parity;

/**
 * ── THE LATIN DIGITS IN THESE STRINGS THAT ARE NOT QUANTITIES ──────────────
 *
 * Every host in this wave runs the same rule over an Arabic page: a run of
 * Latin digits that is not inside an identifier is an unformatted number, and a
 * defect. Some of an add-on's own strings legitimately carry one anyway, and
 * when they do THE ADD-ON IS THE ONLY THING THAT KNOWS WHY.
 *
 * It travels with the strings rather than with the host because a host holding
 * one add-on's allowance would turn red the day a second host vendored the same
 * add-on without it — which is what happened to Design Studio's specimen
 * telephone number, and is the defect AC20/D21 exists to prevent.
 *
 * ── THIS BUNDLE DECLARES EXACTLY ONE, AND THE ASYMMETRY IS THE INTERESTING
 *    PART ──────────────────────────────────────────────────────────────────
 *
 * Two symbology names reach an Arabic page from this add-on, and the rule sees
 * them completely differently:
 *
 *   `EAN-13` needs no allowance. The rule skips any token carrying a Latin
 *   letter that does not open with its figure, because that is what an
 *   identifier looks like — and a hyphen counts as part of a token, so the
 *   whole of `EAN-13` is one identifier to it.
 *
 *   `Code 128` needs one, because of the SPACE. It splits into `Code` and
 *   `128`, and `128` on its own is indistinguishable from a quantity somebody
 *   forgot to format. The allowance is the whole phrase rather than the bare
 *   figure, for the reason the shared suite gives at length: allowing `128`
 *   would allow a Latin 128 anywhere in the bundle.
 *
 * Both are the designations of published standards and are written the same way
 * in every language — which is also why they are the only two entries on the
 * shared-with-English list in `strings.test.ts`. Every other figure this add-on
 * can put on an Arabic page is a count it worked out, and every one of those
 * goes through the formatter in `t.ts`.
 */
export const NOT_A_QUANTITY: readonly { phrase: string; why: string }[] = [
  {
    phrase: 'Code 128',
    why: 'The published designation of a symbology, whose digits are part of its name rather than a quantity. It is spelt with a space, so the numeral rule reads the 128 as a bare figure unless the whole phrase is named here; EAN-13 needs no entry because its hyphen keeps it one token.',
  },
];
