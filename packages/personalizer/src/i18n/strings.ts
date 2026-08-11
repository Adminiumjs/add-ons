/**
 * The Live Personalizer's user-visible strings, in all eight locales.
 *
 * SHAPE AND PARITY. The nested shape mirrors the host's own string areas
 * exactly — `{ "en-US": { key: value }, "de-DE": { …same keys… }, … }` — and
 * the host merges this module into its bundle at registration, refusing a
 * bundle that is not complete in all eight and naming the locale and the key it
 * is missing. `strings.test.ts` asserts the same thing here, so a hole is a red
 * suite in this repo before it is a failed boot in the host's.
 *
 * Every key is namespaced under `addon.personalizer.` so an add-on can never
 * shadow a host key or another add-on's: the host flattens all areas into one
 * bundle and a later area silently wins a collision.
 *
 * A NOTE FOR TRANSLATORS, AND IT IS NOT OPTIONAL. The English copy avoids
 * several marketing words on purpose, and avoids them as SUBSTRINGS rather than
 * as words, because the release sweep greps built output case-insensitively.
 * The banned runs are listed in `testing/lexicon.ts`, which checks all eight
 * locales; they are not spelled out here because THIS FILE SHIPS — Vite's
 * library build keeps comments so that pure annotations survive, and a warning
 * about a banned word that itself contained the banned word would be the first
 * thing a grep found.
 *
 * The traps in this particular vocabulary are unusually easy to hit, so here is
 * what the eight were written around, without quoting anything:
 *
 *   · The ordinary word for a thing a shop sells contains a banned run in
 *     English, German, French, Czech and Danish alike. Every locale below says
 *     "piece", "item" or "work" instead, which is also what a maker calls it.
 *   · A German verb ending that turns a noun into an action carries another
 *     banned run, and so does the German noun for an animal; several French
 *     nouns for a trade, a district or a whole thing carry the same one.
 *   · The Czech word for "for" is a banned run on its own. Every Czech string
 *     below is written around it — with a case ending or a different
 *     preposition — rather than relying on the carve-out list.
 *   · The Danish and German noun for a scheme is banned, and so is the English
 *     word for a clarification.
 *   · Chinese and Arabic carry no English run at all, so the per-locale table
 *     in `testing/lexicon.ts` is the only thing that can catch a paid-grade
 *     word there. Both are checked.
 *
 * FACE NAMES ARE NAMES. Fenwick, Bramley, Row, Alder and Quarry are what five
 * alphabets are called, and a translated name would be a different alphabet, so
 * they live in `faces.ts` and never here. Millimetres, character counts and
 * references are set in the mono face by the surface, not by the string.
 */

export const LOCALE_TAGS = [
  'en-US',
  'de-DE',
  'fr-FR',
  'cs-CZ',
  'da-DK',
  'zh-CN',
  'zh-TW',
  'ar-EG',
] as const;

export type LocaleTag = (typeof LOCALE_TAGS)[number];

export const personalizerStrings = {
  'en-US': {
    // ── the host's chrome: shelf, connect dialog, manage drawer ──────────────
    'addon.personalizer.line': 'A live picture of what the customer is asking for.',
    'addon.personalizer.what':
      'You draw the areas a customer may change once. After that they type their own words and watch them appear on the piece, at the right size, in the right place.',
    'addon.personalizer.desc':
      'The customer sees the words on the piece as they type. You get a machine-ready file with the letters already turned into outlines, so nothing depends on what is installed on the laser.',
    'addon.personalizer.noCompany': 'The Live Personalizer connects to no outside company.',
    'addon.personalizer.noAccount': 'It needs no account anywhere, and it calls nothing.',
    'addon.personalizer.perm.readPieces': 'Read the pieces you sell and the areas drawn on them',
    'addon.personalizer.perm.saveDesigns': 'Save what a customer asked for against your orders',
    'addon.personalizer.perm.storePreviews': 'Store the picture and the machine file',
    'addon.personalizer.perm.noAccount': 'Nothing else, and no outside account',
    'addon.personalizer.disconnect.goes':
      'Customers go back to the plain note field on every piece.',
    'addon.personalizer.disconnect.stays':
      'Personalizations already on orders are kept and still show here, and so are the areas you drew.',
    'addon.personalizer.act.1': '{when} · a picture went out as a proof · {ref}',
    'addon.personalizer.act.2': '{when} · areas drawn on a new piece',
    'addon.personalizer.act.3': '{when} · machine file made · {ref}',

    // ── settings ────────────────────────────────────────────────────────────
    'addon.personalizer.set.fonts': 'Alphabets a customer may choose from',
    'addon.personalizer.set.fontsHint':
      'Five come with the add-on. Leave at least one on, or there is nothing to pick.',
    'addon.personalizer.set.proof': 'A picture still needs a yes before the piece is made',
    'addon.personalizer.set.proofOn':
      'The customer sees their own picture and says yes. On by default.',
    'addon.personalizer.set.proofOff':
      'An approved picture is not waited for. You can still ask for one on any order.',
    'addon.personalizer.set.finish': 'What a new area starts as',
    'addon.personalizer.set.finishHint': 'A customer can change it on the piece if you let them.',
    'addon.personalizer.set.smallest': 'Smallest is the size below which thin strokes start to close up. The shop warns at that size rather than stopping anyone.',

    // ── the shopper's surface ───────────────────────────────────────────────
    'addon.personalizer.title': 'Make it yours',
    'addon.personalizer.zone.top': 'Top line',
    'addon.personalizer.zone.date': 'Date',
    'addon.personalizer.zone.house': 'House name',
    'addon.personalizer.honest':
      'Your preview shows exactly the words we’ll put on it. Colour and texture vary a little from one piece to the next — each one is made on its own.',
    'addon.personalizer.angle.front': 'Front',
    'addon.personalizer.angle.three': 'Three-quarter',
    'addon.personalizer.angle.top': 'Top',
    'addon.personalizer.angle.detail': 'Detail',
    'addon.personalizer.piece.walnut-coasters': 'Walnut coasters',
    'addon.personalizer.piece.house-sign': 'House sign',
    'addon.personalizer.preview.name': '{piece}, with your wording — {words}',
    'addon.personalizer.preview.blank': '{piece}, with nothing on it yet',
    'addon.personalizer.zoom': 'Closer',
    'addon.personalizer.zoomOut': 'Back out',
    'addon.personalizer.counter': '{used}/{limit}',
    'addon.personalizer.font': 'Alphabet',
    'addon.personalizer.size': 'Size',
    'addon.personalizer.sizeUnit': '{mm} mm',
    'addon.personalizer.smaller': 'Smaller',
    'addon.personalizer.larger': 'Larger',
    'addon.personalizer.finish': 'Finish',
    'addon.personalizer.finish.engraved': 'Engraved',
    'addon.personalizer.finish.raised': 'Raised',
    'addon.personalizer.finish.printed': 'Printed',
    'addon.personalizer.finish.painted': 'Painted',
    'addon.personalizer.finishNote.engraved': 'Cut into the surface. The colour is the timber under the top.',
    'addon.personalizer.finishNote.raised': 'Everything around the words is taken down, so they stand proud.',
    'addon.personalizer.finishNote.printed': 'Flat ink on the surface, in one colour.',
    'addon.personalizer.finishNote.painted': 'Cut, then filled by hand. The edge is a little soft.',
    'addon.personalizer.placeholder': 'Type what you want on it',
    'addon.personalizer.over':
      '{over} characters more than fits at {size} mm.',
    'addon.personalizer.overWide': 'Wider than the area at {size} mm.',
    'addon.personalizer.remedy.size': 'Set it at {size} mm',
    'addon.personalizer.remedy.shorten': 'Shorten it to {chars}',
    'addon.personalizer.noSize':
      'It will not go in at any size we cut, so it has to be shorter.',
    'addon.personalizer.tooMany': '{over} characters over the {limit} this area takes.',
    'addon.personalizer.noLetter': 'We have no letter for {chars}. Everything before it is fine.',
    'addon.personalizer.remedy.swap': 'Cut {to} instead of {from}',
    'addon.personalizer.noLetterSwap': 'We have no letter for {chars}, but we do cut the everyday form of it.',
    'addon.personalizer.noLetterNone': 'We have no letter for {chars}, and nothing stands before it to keep. We cut the Latin alphabet, figures, and the marks on an English keyboard.',
    'addon.personalizer.blockedLetters': '{name} has a letter we can’t cut.',
    'addon.personalizer.fine':
      'Fine work under {mm} mm can fill in on open grain. It will still cut — it just reads softer.',
    'addon.personalizer.required': 'This one is cut into every piece, so it can’t be left empty.',
    'addon.personalizer.blocked': 'Fill in {name} first.',
    'addon.personalizer.notSetUp':
      'This piece has no areas set up yet — the studio will write to you about the wording.',
    'addon.personalizer.notes.label': 'What would you like on it?',
    'addon.personalizer.plain': '{piece} is made plain unless you type something. Type in an area to letter it.',
    'addon.personalizer.replaced':
      'The plain note field is gone while this is on. What you type here goes straight onto the piece.',

    // ── the basket line, the order line and the proof ───────────────────────
    'addon.personalizer.line.picture': 'What we’ll cut',
    'addon.personalizer.line.font': 'ALPHABET',
    'addon.personalizer.line.size': 'SIZE',
    'addon.personalizer.line.finish': 'FINISH',
    'addon.personalizer.line.same':
      'The same picture travels with the order and comes back to you as the proof.',
    'addon.personalizer.line.attention':
      'This wording doesn’t fit the area yet, so it needs a change before it can be cut.',
    'addon.personalizer.notYet': 'The wording doesn’t fit yet — the buttons above will fix it.',

    // ── the maker's set-up surface ──────────────────────────────────────────
    'addon.personalizer.setup.title': 'Areas a customer may change',
    'addon.personalizer.setup.sub': 'Set this up once and any shop on this database can use it.',
    'addon.personalizer.setup.artwork': 'The four angles',
    'addon.personalizer.setup.artworkNote':
      'These are the pictures a customer sees. The words are drawn on top of them.',
    'addon.personalizer.setup.zones': 'The areas',
    'addon.personalizer.setup.add': 'Draw a rectangle',
    'addon.personalizer.setup.addOval': 'Draw an oval',
    'addon.personalizer.setup.remove': 'Take this area off',
    'addon.personalizer.setup.name': 'Name',
    'addon.personalizer.setup.limit': 'Character limit',
    'addon.personalizer.setup.fonts': 'Alphabets offered here',
    'addon.personalizer.setup.range': 'Size range',
    'addon.personalizer.setup.required': 'Cut into every piece',
    'addon.personalizer.setup.optional': 'A customer may leave it empty',
    'addon.personalizer.setup.visible': 'Shown from',
    'addon.personalizer.setup.sample': 'What a customer will see',
    'addon.personalizer.setup.sampleNote':
      'Type a sample here and check your own set-up without leaving the page.',
    'addon.personalizer.setup.empty':
      'This piece has no areas yet — draw one to begin.',
    'addon.personalizer.setup.saved': 'Saved. Nothing already ordered changes.',
    'addon.personalizer.setup.open': 'Set up the areas',
    'addon.personalizer.setup.close': 'Back to the piece',

    // ── the machine file ────────────────────────────────────────────────────
    'addon.personalizer.prod.title': 'What goes to the machine',
    'addon.personalizer.prod.honest':
      'This is a file, not a machine — send it to your laser the way you always do.',
    'addon.personalizer.prod.alphabet':
      'The letters here are the studio’s own cut alphabet, at exactly the size and place the customer’s picture shows. Nothing in the file names a typeface, so it cuts the same wherever it is opened.',
    'addon.personalizer.prod.layer.cut': 'CUT',
    'addon.personalizer.prod.layer.score': 'SCORE',
    'addon.personalizer.prod.layer.engrave': 'ENGRAVE',
    'addon.personalizer.prod.length': '{mm} mm of path',
    'addon.personalizer.prod.area': '{mm} mm² filled',
    'addon.personalizer.prod.count': 'paths: {count}',
    'addon.personalizer.prod.material': 'Material',
    'addon.personalizer.material.walnut': 'Walnut',
    'addon.personalizer.material.birch': 'Birch',
    'addon.personalizer.material.slate': 'Slate',
    'addon.personalizer.material.ceramic': 'Ceramic',
    'addon.personalizer.setup.fieldId': 'Field',
    'addon.personalizer.prod.size': 'Finished size',
    'addon.personalizer.prod.download': 'Download the file',
    'addon.personalizer.prod.open': 'See the machine file',
  },

  'de-DE': {
    'addon.personalizer.line': 'Ein lebendiges Bild dessen, was die Kundschaft möchte.',
    'addon.personalizer.what':
      'Sie legen einmal fest, welche Flächen geändert werden dürfen. Danach tippt die Kundschaft ihre eigenen Worte und sieht sie sofort auf dem Stück, in der richtigen Größe, an der richtigen Stelle.',
    'addon.personalizer.desc':
      'Die Kundschaft sieht die Worte beim Tippen auf dem Stück. Sie bekommen eine maschinenfertige Datei, in der die Buchstaben bereits als Umrisse liegen — nichts hängt davon ab, was am Laser installiert ist.',
    'addon.personalizer.noCompany': 'Der Live-Personalizer verbindet sich mit keiner fremden Firma.',
    'addon.personalizer.noAccount': 'Er braucht nirgends ein Konto und ruft nichts auf.',
    'addon.personalizer.perm.readPieces': 'Ihre Stücke lesen und die darauf gezeichneten Flächen',
    'addon.personalizer.perm.saveDesigns': 'Kundenwünsche zu Ihren Aufträgen speichern',
    'addon.personalizer.perm.storePreviews': 'Das Bild und die Maschinendatei ablegen',
    'addon.personalizer.perm.noAccount': 'Sonst nichts, und kein fremdes Konto',
    'addon.personalizer.disconnect.goes':
      'Die Kundschaft sieht bei jedem Stück wieder das schlichte Notizfeld.',
    'addon.personalizer.disconnect.stays':
      'Bereits bestellte Beschriftungen bleiben erhalten und werden weiter angezeigt, ebenso die Flächen, die Sie gezeichnet haben.',
    'addon.personalizer.act.1': '{when} · ein Bild ging als Korrekturabzug raus · {ref}',
    'addon.personalizer.act.2': '{when} · Flächen auf einem neuen Stück gezeichnet',
    'addon.personalizer.act.3': '{when} · Maschinendatei erstellt · {ref}',

    'addon.personalizer.set.fonts': 'Alphabete, aus denen gewählt werden darf',
    'addon.personalizer.set.fontsHint':
      'Fünf sind dabei. Lassen Sie mindestens eines an, sonst gibt es nichts zu wählen.',
    'addon.personalizer.set.proof': 'Vor der Fertigung braucht das Bild ein Ja',
    'addon.personalizer.set.proofOn':
      'Die Kundschaft sieht ihr eigenes Bild und sagt Ja. Standardmäßig an.',
    'addon.personalizer.set.proofOff':
      'Es wird nicht auf ein bestätigtes Bild gewartet. Sie können es bei jedem Auftrag trotzdem verlangen.',
    'addon.personalizer.set.finish': 'Wie eine neue Fläche ausgeführt wird',
    'addon.personalizer.set.finishHint': 'Die Kundschaft darf es am Stück ändern, wenn Sie es zulassen.',
    'addon.personalizer.set.smallest': 'Kleinste Größe: darunter laufen dünne Striche zu. Der Laden warnt dann, statt jemanden aufzuhalten.',

    'addon.personalizer.title': 'Machen Sie es zu Ihrem',
    'addon.personalizer.zone.top': 'Obere Zeile',
    'addon.personalizer.zone.date': 'Datum',
    'addon.personalizer.zone.house': 'Hausname',
    'addon.personalizer.honest':
      'Ihre Vorschau zeigt genau die Worte, die wir aufbringen. Farbe und Oberfläche schwanken von Stück zu Stück ein wenig — jedes wird einzeln gefertigt.',
    'addon.personalizer.angle.front': 'Vorne',
    'addon.personalizer.angle.three': 'Schräg',
    'addon.personalizer.angle.top': 'Von oben',
    'addon.personalizer.angle.detail': 'Ausschnitt',
    'addon.personalizer.piece.walnut-coasters': 'Untersetzer aus Nussbaum',
    'addon.personalizer.piece.house-sign': 'Hausschild',
    'addon.personalizer.preview.name': '{piece}, mit Ihrer Beschriftung — {words}',
    'addon.personalizer.preview.blank': '{piece}, noch ohne Beschriftung',
    'addon.personalizer.zoom': 'Näher ran',
    'addon.personalizer.zoomOut': 'Wieder ganz',
    'addon.personalizer.counter': '{used}/{limit}',
    'addon.personalizer.font': 'Alphabet',
    'addon.personalizer.size': 'Größe',
    'addon.personalizer.sizeUnit': '{mm} mm',
    'addon.personalizer.smaller': 'Kleiner',
    'addon.personalizer.larger': 'Größer',
    'addon.personalizer.finish': 'Ausführung',
    'addon.personalizer.finish.engraved': 'Graviert',
    'addon.personalizer.finish.raised': 'Erhaben',
    'addon.personalizer.finish.printed': 'Gedruckt',
    'addon.personalizer.finish.painted': 'Ausgemalt',
    'addon.personalizer.finishNote.engraved': 'In die Oberfläche geschnitten. Die Farbe ist das Holz darunter.',
    'addon.personalizer.finishNote.raised': 'Alles um die Worte herum wird abgetragen, sie stehen hervor.',
    'addon.personalizer.finishNote.printed': 'Flache Farbe auf der Oberfläche, einfarbig.',
    'addon.personalizer.finishNote.painted': 'Geschnitten und dann von Hand gefüllt. Die Kante ist etwas weich.',
    'addon.personalizer.placeholder': 'Tippen Sie, was darauf soll',
    'addon.personalizer.over': '{over} Zeichen mehr, als bei {size} mm hineingehen.',
    'addon.personalizer.overWide': 'Breiter als die Fläche bei {size} mm.',
    'addon.personalizer.remedy.size': 'Auf {size} mm stellen',
    'addon.personalizer.remedy.shorten': 'Auf {chars} kürzen',
    'addon.personalizer.noSize':
      'Es geht in keiner Größe hinein, die wir schneiden — es muss kürzer werden.',
    'addon.personalizer.tooMany': '{over} Zeichen über den {limit}, die diese Fläche nimmt.',
    'addon.personalizer.noLetter': 'Für {chars} haben wir keinen Buchstaben. Alles davor passt.',
    'addon.personalizer.remedy.swap': '{to} statt {from} schneiden',
    'addon.personalizer.noLetterSwap': 'Für {chars} haben wir keinen Buchstaben, aber die alltägliche Form schneiden wir.',
    'addon.personalizer.noLetterNone': 'Für {chars} haben wir keinen Buchstaben, und davor steht nichts, was bleiben könnte. Wir schneiden das lateinische Alphabet, Ziffern und die Zeichen einer deutschen Tastatur.',
    'addon.personalizer.blockedLetters': '{name} enthält einen Buchstaben, den wir nicht schneiden können.',
    'addon.personalizer.fine':
      'Feine Arbeit unter {mm} mm kann auf offener Maserung zulaufen. Sie wird trotzdem geschnitten — sie liest sich nur weicher.',
    'addon.personalizer.required': 'Das wird in jedes Stück geschnitten und darf nicht leer bleiben.',
    'addon.personalizer.blocked': 'Füllen Sie zuerst {name} aus.',
    'addon.personalizer.notSetUp':
      'Für dieses Stück sind noch keine Flächen eingerichtet — die Werkstatt schreibt Ihnen wegen des Textes.',
    'addon.personalizer.notes.label': 'Was soll darauf stehen?',
    'addon.personalizer.plain': '{piece} wird ohne Beschriftung gefertigt, solange Sie nichts eintragen. Schreiben Sie in ein Feld, um sie zu beschriften.',
    'addon.personalizer.replaced':
      'Das schlichte Notizfeld ist weg, solange das hier an ist. Was Sie hier tippen, geht direkt auf das Stück.',

    'addon.personalizer.line.picture': 'Was wir schneiden',
    'addon.personalizer.line.font': 'ALPHABET',
    'addon.personalizer.line.size': 'GRÖSSE',
    'addon.personalizer.line.finish': 'AUSFÜHRUNG',
    'addon.personalizer.line.same':
      'Dasselbe Bild reist mit dem Auftrag und kommt als Korrekturabzug zu Ihnen zurück.',
    'addon.personalizer.line.attention':
      'Dieser Text passt noch nicht in die Fläche und muss vor dem Schneiden geändert werden.',
    'addon.personalizer.notYet': 'Der Text passt noch nicht — die Schaltflächen oben lösen das.',

    'addon.personalizer.setup.title': 'Flächen, die geändert werden dürfen',
    'addon.personalizer.setup.sub': 'Einmal einrichten, und jeder Laden an dieser Datenbank kann es nutzen.',
    'addon.personalizer.setup.artwork': 'Die vier Ansichten',
    'addon.personalizer.setup.artworkNote':
      'Das sind die Bilder, die die Kundschaft sieht. Die Worte werden darauf gezeichnet.',
    'addon.personalizer.setup.zones': 'Die Flächen',
    'addon.personalizer.setup.add': 'Rechteck zeichnen',
    'addon.personalizer.setup.addOval': 'Oval zeichnen',
    'addon.personalizer.setup.remove': 'Diese Fläche entfernen',
    'addon.personalizer.setup.name': 'Bezeichnung',
    'addon.personalizer.setup.limit': 'Zeichengrenze',
    'addon.personalizer.setup.fonts': 'Hier angebotene Alphabete',
    'addon.personalizer.setup.range': 'Größenbereich',
    'addon.personalizer.setup.required': 'Wird in jedes Stück geschnitten',
    'addon.personalizer.setup.optional': 'Darf leer bleiben',
    'addon.personalizer.setup.visible': 'Sichtbar von',
    'addon.personalizer.setup.sample': 'Was die Kundschaft sehen wird',
    'addon.personalizer.setup.sampleNote':
      'Tippen Sie hier ein Beispiel und prüfen Sie Ihre Einrichtung, ohne die Seite zu verlassen.',
    'addon.personalizer.setup.empty': 'Dieses Stück hat noch keine Flächen — zeichnen Sie eine.',
    'addon.personalizer.setup.saved': 'Gespeichert. An Bestelltem ändert sich nichts.',
    'addon.personalizer.setup.open': 'Flächen einrichten',
    'addon.personalizer.setup.close': 'Zurück zum Stück',

    'addon.personalizer.prod.title': 'Was zur Maschine geht',
    'addon.personalizer.prod.honest':
      'Das ist eine Datei, keine Maschine — schicken Sie sie an Ihren Laser wie immer.',
    'addon.personalizer.prod.alphabet':
      'Die Buchstaben hier sind das eigene Schnittalphabet der Werkstatt, genau in der Größe und an der Stelle, die das Bild der Kundschaft zeigt. Nichts in der Datei nennt eine Schrift, also wird überall gleich geschnitten.',
    'addon.personalizer.prod.layer.cut': 'SCHNITT',
    'addon.personalizer.prod.layer.score': 'RITZ',
    'addon.personalizer.prod.layer.engrave': 'GRAVUR',
    'addon.personalizer.prod.length': '{mm} mm Weg',
    'addon.personalizer.prod.area': '{mm} mm² gefüllt',
    'addon.personalizer.prod.count': 'Wege: {count}',
    'addon.personalizer.prod.material': 'Material',
    'addon.personalizer.material.walnut': 'Nussbaum',
    'addon.personalizer.material.birch': 'Birke',
    'addon.personalizer.material.slate': 'Schiefer',
    'addon.personalizer.material.ceramic': 'Keramik',
    'addon.personalizer.setup.fieldId': 'Feld',
    'addon.personalizer.prod.size': 'Fertigmaß',
    'addon.personalizer.prod.download': 'Datei herunterladen',
    'addon.personalizer.prod.open': 'Maschinendatei ansehen',
  },

  'fr-FR': {
    'addon.personalizer.line': 'Une image vivante de ce que le client demande.',
    'addon.personalizer.what':
      'Vous délimitez une fois les zones qu’un client peut changer. Ensuite il tape ses propres mots et les voit apparaître sur la pièce, à la bonne taille, au bon endroit.',
    'addon.personalizer.desc':
      'Le client voit les mots sur la pièce pendant qu’il tape. Vous recevez un fichier prêt pour la machine, les lettres déjà converties en tracés — rien ne dépend de ce qui est installé sur le laser.',
    'addon.personalizer.noCompany': 'Le Live Personalizer ne se connecte à aucune société extérieure.',
    'addon.personalizer.noAccount': 'Il ne demande aucun compte nulle part et n’appelle rien.',
    'addon.personalizer.perm.readPieces': 'Lire vos pièces et les zones tracées dessus',
    'addon.personalizer.perm.saveDesigns': 'Enregistrer la demande du client sur vos commandes',
    'addon.personalizer.perm.storePreviews': 'Conserver l’image et le fichier machine',
    'addon.personalizer.perm.noAccount': 'Rien d’autre, et aucun compte extérieur',
    'addon.personalizer.disconnect.goes':
      'Les clients retrouvent le simple champ de note sur chaque pièce.',
    'addon.personalizer.disconnect.stays':
      'Les personnalisations déjà commandées sont conservées et restent visibles, ainsi que les zones que vous avez tracées.',
    'addon.personalizer.act.1': '{when} · une image est partie pour validation · {ref}',
    'addon.personalizer.act.2': '{when} · zones tracées sur une nouvelle pièce',
    'addon.personalizer.act.3': '{when} · fichier machine créé · {ref}',

    'addon.personalizer.set.fonts': 'Alphabets que le client peut choisir',
    'addon.personalizer.set.fontsHint':
      'Cinq sont fournis. Laissez-en au moins un actif, sinon il n’y a rien à choisir.',
    'addon.personalizer.set.proof': 'L’image doit être validée avant la fabrication',
    'addon.personalizer.set.proofOn':
      'Le client voit sa propre image et donne son accord. Actif par défaut.',
    'addon.personalizer.set.proofOff':
      'On n’attend pas d’accord sur l’image. Vous pouvez toujours en demander un sur une commande.',
    'addon.personalizer.set.finish': 'Finition d’une nouvelle zone',
    'addon.personalizer.set.finishHint': 'Le client peut la changer sur la pièce si vous l’autorisez.',
    'addon.personalizer.set.smallest': 'En dessous de cette taille, les traits fins se referment. La boutique prévient à ce moment-là au lieu d’empêcher.',

    'addon.personalizer.title': 'À votre nom',
    'addon.personalizer.zone.top': 'Ligne du haut',
    'addon.personalizer.zone.date': 'Date',
    'addon.personalizer.zone.house': 'Nom de la maison',
    'addon.personalizer.honest':
      'Votre aperçu montre exactement les mots que nous appliquerons. La couleur et la matière varient un peu d’une pièce à l’autre — chacune est fabriquée à l’unité.',
    'addon.personalizer.angle.front': 'De face',
    'addon.personalizer.angle.three': 'Trois quarts',
    'addon.personalizer.angle.top': 'De dessus',
    'addon.personalizer.angle.detail': 'Détail',
    'addon.personalizer.piece.walnut-coasters': 'Sous-verres en noyer',
    'addon.personalizer.piece.house-sign': 'Plaque de maison',
    'addon.personalizer.preview.name': '{piece}, avec votre texte — {words}',
    'addon.personalizer.preview.blank': '{piece}, encore sans texte',
    'addon.personalizer.zoom': 'Plus près',
    'addon.personalizer.zoomOut': 'Vue entière',
    'addon.personalizer.counter': '{used}/{limit}',
    'addon.personalizer.font': 'Alphabet',
    'addon.personalizer.size': 'Taille',
    'addon.personalizer.sizeUnit': '{mm} mm',
    'addon.personalizer.smaller': 'Plus petit',
    'addon.personalizer.larger': 'Plus grand',
    'addon.personalizer.finish': 'Finition',
    'addon.personalizer.finish.engraved': 'Gravé',
    'addon.personalizer.finish.raised': 'En relief',
    'addon.personalizer.finish.printed': 'Imprimé',
    'addon.personalizer.finish.painted': 'Peint',
    'addon.personalizer.finishNote.engraved': 'Creusé dans la surface. La couleur est le bois du dessous.',
    'addon.personalizer.finishNote.raised': 'Tout autour des mots est retiré, ils ressortent.',
    'addon.personalizer.finishNote.printed': 'Encre à plat sur la surface, en une seule couleur.',
    'addon.personalizer.finishNote.painted': 'Gravé puis rempli à la main. Le bord est un peu doux.',
    'addon.personalizer.placeholder': 'Tapez ce que vous voulez dessus',
    'addon.personalizer.over': '{over} caractères de plus que ce qui tient à {size} mm.',
    'addon.personalizer.overWide': 'Plus large que la zone à {size} mm.',
    'addon.personalizer.remedy.size': 'Mettre à {size} mm',
    'addon.personalizer.remedy.shorten': 'Raccourcir à {chars}',
    'addon.personalizer.noSize':
      'Cela ne tiendra à aucune taille que nous gravons, il faut donc raccourcir.',
    'addon.personalizer.tooMany': '{over} caractères au-delà des {limit} que prend cette zone.',
    'addon.personalizer.noLetter': 'Nous n’avons pas de lettre pour {chars}. Tout ce qui précède convient.',
    'addon.personalizer.remedy.swap': 'Graver {to} à la place de {from}',
    'addon.personalizer.noLetterSwap': 'Nous n’avons pas de lettre pour {chars}, mais nous gravons sa forme courante.',
    'addon.personalizer.noLetterNone': 'Nous n’avons pas de lettre pour {chars}, et rien ne le précède qui puisse rester. Nous gravons l’alphabet latin, les chiffres et les signes d’un clavier français.',
    'addon.personalizer.blockedLetters': '{name} contient une lettre que nous ne gravons pas.',
    'addon.personalizer.fine':
      'Un travail fin sous {mm} mm peut se refermer sur un bois ouvert. Cela se grave quand même — cela se lit simplement plus doucement.',
    'addon.personalizer.required': 'Ceci est gravé sur chaque pièce et ne peut pas rester vide.',
    'addon.personalizer.blocked': 'Remplissez d’abord {name}.',
    'addon.personalizer.notSetUp':
      'Aucune zone n’est encore définie sur cette pièce — l’atelier vous écrira au sujet du texte.',
    'addon.personalizer.notes.label': 'Que souhaitez-vous y graver ?',
    'addon.personalizer.plain': '{piece} est fabriqué sans texte tant que vous n’écrivez rien. Écrivez dans une zone pour le faire graver.',
    'addon.personalizer.replaced':
      'Le simple champ de note disparaît tant que ceci est actif. Ce que vous tapez ici va droit sur la pièce.',

    'addon.personalizer.line.picture': 'Ce que nous graverons',
    'addon.personalizer.line.font': 'ALPHABET',
    'addon.personalizer.line.size': 'TAILLE',
    'addon.personalizer.line.finish': 'FINITION',
    'addon.personalizer.line.same':
      'La même image voyage avec la commande et vous revient pour validation.',
    'addon.personalizer.line.attention':
      'Ce texte ne rentre pas encore dans la zone : il faut le modifier avant la découpe.',
    'addon.personalizer.notYet': 'Le texte ne rentre pas encore — les boutons ci-dessus le corrigent.',

    'addon.personalizer.setup.title': 'Zones qu’un client peut changer',
    'addon.personalizer.setup.sub': 'À définir une fois : toute boutique sur cette base peut s’en servir.',
    'addon.personalizer.setup.artwork': 'Les quatre vues',
    'addon.personalizer.setup.artworkNote':
      'Ce sont les images que le client verra. Les mots sont dessinés par-dessus.',
    'addon.personalizer.setup.zones': 'Les zones',
    'addon.personalizer.setup.add': 'Tracer un rectangle',
    'addon.personalizer.setup.addOval': 'Tracer un ovale',
    'addon.personalizer.setup.remove': 'Retirer cette zone',
    'addon.personalizer.setup.name': 'Nom',
    'addon.personalizer.setup.limit': 'Limite de caractères',
    'addon.personalizer.setup.fonts': 'Alphabets offerts ici',
    'addon.personalizer.setup.range': 'Plage de tailles',
    'addon.personalizer.setup.required': 'Gravé sur chaque pièce',
    'addon.personalizer.setup.optional': 'Peut rester vide',
    'addon.personalizer.setup.visible': 'Visible depuis',
    'addon.personalizer.setup.sample': 'Ce que le client verra',
    'addon.personalizer.setup.sampleNote':
      'Tapez un exemple ici et vérifiez votre réglage sans quitter la page.',
    'addon.personalizer.setup.empty': 'Cette pièce n’a encore aucune zone — tracez-en une.',
    'addon.personalizer.setup.saved': 'Enregistré. Rien de ce qui est commandé ne change.',
    'addon.personalizer.setup.open': 'Régler les zones',
    'addon.personalizer.setup.close': 'Retour à la pièce',

    'addon.personalizer.prod.title': 'Ce qui part à la machine',
    'addon.personalizer.prod.honest':
      'C’est un fichier, pas une machine — envoyez-le à votre laser comme d’habitude.',
    'addon.personalizer.prod.alphabet':
      'Les lettres ici viennent de l’alphabet de découpe de l’atelier, exactement à la taille et à l’endroit que montre l’image du client. Rien dans le fichier ne nomme une police, la gravure est donc la même partout.',
    'addon.personalizer.prod.layer.cut': 'DÉCOUPE',
    'addon.personalizer.prod.layer.score': 'RAINURE',
    'addon.personalizer.prod.layer.engrave': 'GRAVURE',
    'addon.personalizer.prod.length': '{mm} mm de tracé',
    'addon.personalizer.prod.area': '{mm} mm² remplis',
    'addon.personalizer.prod.count': 'tracés : {count}',
    'addon.personalizer.prod.material': 'Matière',
    'addon.personalizer.material.walnut': 'Noyer',
    'addon.personalizer.material.birch': 'Bouleau',
    'addon.personalizer.material.slate': 'Ardoise',
    'addon.personalizer.material.ceramic': 'Céramique',
    'addon.personalizer.setup.fieldId': 'Champ',
    'addon.personalizer.prod.size': 'Dimensions finies',
    'addon.personalizer.prod.download': 'Télécharger le fichier',
    'addon.personalizer.prod.open': 'Voir le fichier machine',
  },

  'cs-CZ': {
    'addon.personalizer.line': 'Živý obrázek toho, co si zákazník přeje.',
    'addon.personalizer.what':
      'Jednou vymezíte plochy, které smí zákazník měnit. Pak si napíše vlastní slova a hned je vidí na kusu, ve správné velikosti a na správném místě.',
    'addon.personalizer.desc':
      'Zákazník vidí slova na kusu už při psaní. Vy dostanete soubor hotový do stroje, s písmeny už převedenými na obrysy — nic nezávisí na tom, co je nainstalované u laseru.',
    'addon.personalizer.noCompany': 'Live Personalizer se nepřipojuje k žádné cizí firmě.',
    'addon.personalizer.noAccount': 'Nikde nepotřebuje účet a nikam nevolá.',
    'addon.personalizer.perm.readPieces': 'Číst vaše kusy a plochy na nich nakreslené',
    'addon.personalizer.perm.saveDesigns': 'Ukládat přání zákazníka k vašim zakázkám',
    'addon.personalizer.perm.storePreviews': 'Uchovat obrázek a soubor do stroje',
    'addon.personalizer.perm.noAccount': 'Nic dalšího a žádný cizí účet',
    'addon.personalizer.disconnect.goes':
      'Zákazníci uvidí u každého kusu zase jen prosté pole na poznámku.',
    'addon.personalizer.disconnect.stays':
      'Už objednané popisy zůstanou a dál se zobrazují, stejně jako plochy, které jste nakreslili.',
    'addon.personalizer.act.1': '{when} · obrázek odešel jako náhled ke schválení · {ref}',
    'addon.personalizer.act.2': '{when} · nakresleny plochy na novém kusu',
    'addon.personalizer.act.3': '{when} · vytvořen soubor do stroje · {ref}',

    'addon.personalizer.set.fonts': 'Abecedy, z nichž smí zákazník vybírat',
    'addon.personalizer.set.fontsHint':
      'Pět je součástí. Nechte aspoň jednu zapnutou, jinak není z čeho vybírat.',
    'addon.personalizer.set.proof': 'Před výrobou je potřeba obrázek schválit',
    'addon.personalizer.set.proofOn':
      'Zákazník vidí vlastní obrázek a odsouhlasí ho. Ve výchozím stavu zapnuto.',
    'addon.personalizer.set.proofOff':
      'Na schválený obrázek se nečeká. U kterékoli zakázky si ho můžete vyžádat.',
    'addon.personalizer.set.finish': 'Jak se nová plocha provede',
    'addon.personalizer.set.finishHint': 'Zákazník to smí na kusu změnit, pokud mu to dovolíte.',
    'addon.personalizer.set.smallest': 'Pod touto velikostí se tenké tahy slévají. Obchod v tu chvíli varuje, místo aby zastavil.',

    'addon.personalizer.title': 'Ať je to vaše',
    'addon.personalizer.zone.top': 'Horní řádek',
    'addon.personalizer.zone.date': 'Datum',
    'addon.personalizer.zone.house': 'Název domu',
    'addon.personalizer.honest':
      'Náhled ukazuje přesně ta slova, která na kus přeneseme. Barva a povrch se kus od kusu trochu liší — každý vzniká zvlášť.',
    'addon.personalizer.angle.front': 'Zepředu',
    'addon.personalizer.angle.three': 'Ze tří čtvrtin',
    'addon.personalizer.angle.top': 'Shora',
    'addon.personalizer.angle.detail': 'Detail',
    'addon.personalizer.piece.walnut-coasters': 'Podtácky z ořechu',
    'addon.personalizer.piece.house-sign': 'Domovní štítek',
    'addon.personalizer.preview.name': '{piece} s vaším textem — {words}',
    'addon.personalizer.preview.blank': '{piece}, zatím bez textu',
    'addon.personalizer.zoom': 'Blíž',
    'addon.personalizer.zoomOut': 'Celý kus',
    'addon.personalizer.counter': '{used}/{limit}',
    'addon.personalizer.font': 'Abeceda',
    'addon.personalizer.size': 'Velikost',
    'addon.personalizer.sizeUnit': '{mm} mm',
    'addon.personalizer.smaller': 'Menší',
    'addon.personalizer.larger': 'Větší',
    'addon.personalizer.finish': 'Provedení',
    'addon.personalizer.finish.engraved': 'Vyryté',
    'addon.personalizer.finish.raised': 'Vystouplé',
    'addon.personalizer.finish.printed': 'Tištěné',
    'addon.personalizer.finish.painted': 'Vybarvené',
    'addon.personalizer.finishNote.engraved': 'Vyřezané do povrchu. Barvu dělá dřevo pod ním.',
    'addon.personalizer.finishNote.raised': 'Okolí slov se odebere, takže slova vystoupí.',
    'addon.personalizer.finishNote.printed': 'Plochá barva na povrchu, v jednom odstínu.',
    'addon.personalizer.finishNote.painted': 'Vyřezané a pak ručně vyplněné. Okraj je trochu měkký.',
    'addon.personalizer.placeholder': 'Napište, co tam má být',
    'addon.personalizer.over': 'O {over} znaků víc, než se při {size} mm vejde.',
    'addon.personalizer.overWide': 'Širší než plocha při {size} mm.',
    'addon.personalizer.remedy.size': 'Nastavit na {size} mm',
    'addon.personalizer.remedy.shorten': 'Zkrátit na {chars}',
    'addon.personalizer.noSize':
      'Nevejde se to v žádné velikosti, kterou řežeme, takže to musí být kratší.',
    'addon.personalizer.tooMany': 'O {over} znaků nad {limit}, které tato plocha bere.',
    'addon.personalizer.noLetter': 'Na {chars} nemáme písmeno. Všechno před tím je v pořádku.',
    'addon.personalizer.remedy.swap': 'Vyřezat {to} místo {from}',
    'addon.personalizer.noLetterSwap': 'Na {chars} nemáme písmeno, ale běžný tvar vyřezáváme.',
    'addon.personalizer.noLetterNone': 'Na {chars} nemáme písmeno a nic před ním nezůstává. Vyřezáváme latinku, číslice a znaky z české klávesnice.',
    'addon.personalizer.blockedLetters': '{name} má písmeno, které neumíme vyřezat.',
    'addon.personalizer.fine':
      'Jemná práce pod {mm} mm se na otevřené kresbě může slévat. Vyřeže se stejně — jen čte měkčeji.',
    'addon.personalizer.required': 'Tohle se vyřezává do každého kusu, nesmí zůstat prázdné.',
    'addon.personalizer.blocked': 'Nejdřív vyplňte {name}.',
    'addon.personalizer.notSetUp':
      'U tohoto kusu zatím nejsou nastavené plochy — dílna vám kvůli textu napíše.',
    'addon.personalizer.notes.label': 'Co na to má přijít?',
    'addon.personalizer.plain': '{piece} se vyrobí bez textu, dokud nic nenapíšete. Napište do pole a necháme to vygravírovat.',
    'addon.personalizer.replaced':
      'Dokud je tohle zapnuté, prosté pole na poznámku zmizí. Co sem napíšete, jde rovnou na kus.',

    'addon.personalizer.line.picture': 'Co vyřežeme',
    'addon.personalizer.line.font': 'ABECEDA',
    'addon.personalizer.line.size': 'VELIKOST',
    'addon.personalizer.line.finish': 'PROVEDENÍ',
    'addon.personalizer.line.same':
      'Stejný obrázek putuje se zakázkou a vrátí se vám ke schválení.',
    'addon.personalizer.line.attention':
      'Tento text se do plochy zatím nevejde, před řezáním je potřeba ho upravit.',
    'addon.personalizer.notYet': 'Text se zatím nevejde — tlačítka výše to spraví.',

    'addon.personalizer.setup.title': 'Plochy, které smí zákazník měnit',
    'addon.personalizer.setup.sub': 'Nastavte to jednou a využije to každý obchod nad touto databází.',
    'addon.personalizer.setup.artwork': 'Čtyři pohledy',
    'addon.personalizer.setup.artworkNote':
      'Tyhle obrázky uvidí zákazník. Slova se kreslí na ně.',
    'addon.personalizer.setup.zones': 'Plochy',
    'addon.personalizer.setup.add': 'Nakreslit obdélník',
    'addon.personalizer.setup.addOval': 'Nakreslit ovál',
    'addon.personalizer.setup.remove': 'Odebrat tuto plochu',
    'addon.personalizer.setup.name': 'Název',
    'addon.personalizer.setup.limit': 'Limit znaků',
    'addon.personalizer.setup.fonts': 'Zde nabízené abecedy',
    'addon.personalizer.setup.range': 'Rozsah velikostí',
    'addon.personalizer.setup.required': 'Řeže se do každého kusu',
    'addon.personalizer.setup.optional': 'Smí zůstat prázdné',
    'addon.personalizer.setup.visible': 'Vidět z',
    'addon.personalizer.setup.sample': 'Co uvidí zákazník',
    'addon.personalizer.setup.sampleNote':
      'Napište sem ukázku a zkontrolujte si nastavení, aniž byste opustili stránku.',
    'addon.personalizer.setup.empty': 'Tento kus zatím nemá žádnou plochu — nakreslete ji.',
    'addon.personalizer.setup.saved': 'Uloženo. Na už objednaném se nic nemění.',
    'addon.personalizer.setup.open': 'Nastavit plochy',
    'addon.personalizer.setup.close': 'Zpět na kus',

    'addon.personalizer.prod.title': 'Co jde do stroje',
    'addon.personalizer.prod.honest':
      'Tohle je soubor, ne stroj — pošlete ho na laser tak, jak jste zvyklí.',
    'addon.personalizer.prod.alphabet':
      'Písmena tady jsou vlastní řezací abeceda dílny, přesně ve velikosti a na místě, které ukazuje zákazníkův obrázek. Nic v souboru neuvádí písmo, takže se všude řeže stejně.',
    'addon.personalizer.prod.layer.cut': 'ŘEZ',
    'addon.personalizer.prod.layer.score': 'RÝHA',
    'addon.personalizer.prod.layer.engrave': 'GRAVURA',
    'addon.personalizer.prod.length': '{mm} mm dráhy',
    'addon.personalizer.prod.area': '{mm} mm² vyplněno',
    'addon.personalizer.prod.count': 'Drah: {count}',
    'addon.personalizer.prod.material': 'Materiál',
    'addon.personalizer.material.walnut': 'Ořech',
    'addon.personalizer.material.birch': 'Bříza',
    'addon.personalizer.material.slate': 'Břidlice',
    'addon.personalizer.material.ceramic': 'Keramika',
    'addon.personalizer.setup.fieldId': 'Pole',
    'addon.personalizer.prod.size': 'Hotový rozměr',
    'addon.personalizer.prod.download': 'Stáhnout soubor',
    'addon.personalizer.prod.open': 'Zobrazit soubor do stroje',
  },

  'da-DK': {
    'addon.personalizer.line': 'Et levende billede af det, kunden beder om.',
    'addon.personalizer.what':
      'Du tegner én gang de felter, en kunde må ændre. Derefter skriver kunden sine egne ord og ser dem stå på emnet, i den rigtige størrelse og på det rigtige sted.',
    'addon.personalizer.desc':
      'Kunden ser ordene på emnet, mens der skrives. Du får en fil klar til maskinen, hvor bogstaverne allerede er lavet om til konturer — intet afhænger af, hvad der er installeret ved laseren.',
    'addon.personalizer.noCompany': 'Live Personalizer forbinder til ingen udefrakommende virksomhed.',
    'addon.personalizer.noAccount': 'Den kræver ingen konto noget sted og ringer ingen steder hen.',
    'addon.personalizer.perm.readPieces': 'Læse dine emner og de felter, der er tegnet på dem',
    'addon.personalizer.perm.saveDesigns': 'Gemme kundens ønske på dine ordrer',
    'addon.personalizer.perm.storePreviews': 'Gemme billedet og maskinfilen',
    'addon.personalizer.perm.noAccount': 'Intet andet, og ingen udefrakommende konto',
    'addon.personalizer.disconnect.goes':
      'Kunderne får igen det enkle notefelt på hvert emne.',
    'addon.personalizer.disconnect.stays':
      'Allerede bestilte tekster bevares og vises fortsat, og det samme gør de felter, du har tegnet.',
    'addon.personalizer.act.1': '{when} · et billede gik ud til godkendelse · {ref}',
    'addon.personalizer.act.2': '{when} · felter tegnet på et nyt emne',
    'addon.personalizer.act.3': '{when} · maskinfil lavet · {ref}',

    'addon.personalizer.set.fonts': 'Alfabeter, kunden må vælge mellem',
    'addon.personalizer.set.fontsHint':
      'Fem følger med. Lad mindst ét stå tændt, ellers er der intet at vælge.',
    'addon.personalizer.set.proof': 'Billedet skal godkendes, før emnet laves',
    'addon.personalizer.set.proofOn':
      'Kunden ser sit eget billede og siger ja. Tændt som udgangspunkt.',
    'addon.personalizer.set.proofOff':
      'Der ventes ikke på et godkendt billede. Du kan stadig bede om et på enhver ordre.',
    'addon.personalizer.set.finish': 'Hvordan et nyt felt udføres',
    'addon.personalizer.set.finishHint': 'Kunden må ændre det på emnet, hvis du tillader det.',
    'addon.personalizer.set.smallest': 'Under denne størrelse løber tynde streger sammen. Butikken advarer der, i stedet for at stoppe nogen.',

    'addon.personalizer.title': 'Gør det til dit',
    'addon.personalizer.zone.top': 'Øverste linje',
    'addon.personalizer.zone.date': 'Dato',
    'addon.personalizer.zone.house': 'Husets navn',
    'addon.personalizer.honest':
      'Dit eksempel viser præcis de ord, vi sætter på. Farve og overflade varierer en smule fra emne til emne — hvert emne laves for sig.',
    'addon.personalizer.angle.front': 'Forfra',
    'addon.personalizer.angle.three': 'Skråt',
    'addon.personalizer.angle.top': 'Oppefra',
    'addon.personalizer.angle.detail': 'Detalje',
    'addon.personalizer.piece.walnut-coasters': 'Glasbrikker i valnød',
    'addon.personalizer.piece.house-sign': 'Husskilt',
    'addon.personalizer.preview.name': '{piece} med din tekst — {words}',
    'addon.personalizer.preview.blank': '{piece}, endnu uden tekst',
    'addon.personalizer.zoom': 'Tættere på',
    'addon.personalizer.zoomOut': 'Hele emnet',
    'addon.personalizer.counter': '{used}/{limit}',
    'addon.personalizer.font': 'Alfabet',
    'addon.personalizer.size': 'Størrelse',
    'addon.personalizer.sizeUnit': '{mm} mm',
    'addon.personalizer.smaller': 'Mindre',
    'addon.personalizer.larger': 'Større',
    'addon.personalizer.finish': 'Udførelse',
    'addon.personalizer.finish.engraved': 'Graveret',
    'addon.personalizer.finish.raised': 'Hævet',
    'addon.personalizer.finish.printed': 'Trykt',
    'addon.personalizer.finish.painted': 'Malet',
    'addon.personalizer.finishNote.engraved': 'Skåret ned i overfladen. Farven er træet nedenunder.',
    'addon.personalizer.finishNote.raised': 'Alt omkring ordene tages ned, så de står frem.',
    'addon.personalizer.finishNote.printed': 'Flad farve på overfladen, i én tone.',
    'addon.personalizer.finishNote.painted': 'Skåret og derefter fyldt i hånden. Kanten er lidt blød.',
    'addon.personalizer.placeholder': 'Skriv, hvad der skal stå',
    'addon.personalizer.over': '{over} tegn mere, end der er plads til ved {size} mm.',
    'addon.personalizer.overWide': 'Bredere end feltet ved {size} mm.',
    'addon.personalizer.remedy.size': 'Sæt den til {size} mm',
    'addon.personalizer.remedy.shorten': 'Forkort til {chars}',
    'addon.personalizer.noSize':
      'Det kan ikke være der i nogen størrelse, vi skærer, så det skal være kortere.',
    'addon.personalizer.tooMany': '{over} tegn over de {limit}, feltet tager.',
    'addon.personalizer.noLetter': 'Vi har intet bogstav til {chars}. Alt før det er fint.',
    'addon.personalizer.remedy.swap': 'Skær {to} i stedet for {from}',
    'addon.personalizer.noLetterSwap': 'Vi har intet bogstav til {chars}, men den almindelige form skærer vi.',
    'addon.personalizer.noLetterNone': 'Vi har intet bogstav til {chars}, og der står intet foran det, som kan blive stående. Vi skærer det latinske alfabet, cifre og tegnene på et dansk tastatur.',
    'addon.personalizer.blockedLetters': '{name} har et bogstav, vi ikke kan skære.',
    'addon.personalizer.fine':
      'Fint arbejde under {mm} mm kan løbe sammen i åben åring. Det skæres alligevel — det læses bare blødere.',
    'addon.personalizer.required': 'Dette skæres i hvert eneste emne og må ikke stå tomt.',
    'addon.personalizer.blocked': 'Udfyld {name} først.',
    'addon.personalizer.notSetUp':
      'Der er endnu ingen felter på dette emne — værkstedet skriver til dig om teksten.',
    'addon.personalizer.notes.label': 'Hvad skal der stå på den?',
    'addon.personalizer.plain': '{piece} laves uden tekst, hvis du ikke skriver noget. Skriv i et felt for at få det indgraveret.',
    'addon.personalizer.replaced':
      'Det enkle notefelt er væk, så længe dette er tændt. Det, du skriver her, går lige på emnet.',

    'addon.personalizer.line.picture': 'Det, vi skærer',
    'addon.personalizer.line.font': 'ALFABET',
    'addon.personalizer.line.size': 'STØRRELSE',
    'addon.personalizer.line.finish': 'UDFØRELSE',
    'addon.personalizer.line.same':
      'Det samme billede følger ordren og kommer tilbage til dig til godkendelse.',
    'addon.personalizer.line.attention':
      'Denne tekst passer ikke i feltet endnu og skal ændres, før den kan skæres.',
    'addon.personalizer.notYet': 'Teksten passer ikke endnu — knapperne ovenfor retter det.',

    'addon.personalizer.setup.title': 'Felter, en kunde må ændre',
    'addon.personalizer.setup.sub': 'Sæt det op én gang, og enhver butik på denne database kan bruge det.',
    'addon.personalizer.setup.artwork': 'De fire vinkler',
    'addon.personalizer.setup.artworkNote':
      'Det er de billeder, kunden ser. Ordene tegnes oven på dem.',
    'addon.personalizer.setup.zones': 'Felterne',
    'addon.personalizer.setup.add': 'Tegn et rektangel',
    'addon.personalizer.setup.addOval': 'Tegn en oval',
    'addon.personalizer.setup.remove': 'Fjern dette felt',
    'addon.personalizer.setup.name': 'Navn',
    'addon.personalizer.setup.limit': 'Tegngrænse',
    'addon.personalizer.setup.fonts': 'Alfabeter, der tilbydes her',
    'addon.personalizer.setup.range': 'Størrelsesområde',
    'addon.personalizer.setup.required': 'Skæres i hvert emne',
    'addon.personalizer.setup.optional': 'Må stå tomt',
    'addon.personalizer.setup.visible': 'Ses fra',
    'addon.personalizer.setup.sample': 'Det, kunden vil se',
    'addon.personalizer.setup.sampleNote':
      'Skriv en prøve her, og se din egen opsætning uden at forlade siden.',
    'addon.personalizer.setup.empty': 'Dette emne har endnu ingen felter — tegn et.',
    'addon.personalizer.setup.saved': 'Gemt. Intet bestilt ændrer sig.',
    'addon.personalizer.setup.open': 'Sæt felterne op',
    'addon.personalizer.setup.close': 'Tilbage til emnet',

    'addon.personalizer.prod.title': 'Det, der går til maskinen',
    'addon.personalizer.prod.honest':
      'Dette er en fil, ikke en maskine — send den til din laser, som du plejer.',
    'addon.personalizer.prod.alphabet':
      'Bogstaverne her er værkstedets eget skærealfabet, præcis i den størrelse og på det sted, kundens billede viser. Intet i filen nævner en skrift, så den skæres ens overalt.',
    'addon.personalizer.prod.layer.cut': 'SKÆR',
    'addon.personalizer.prod.layer.score': 'RIDS',
    'addon.personalizer.prod.layer.engrave': 'GRAVER',
    'addon.personalizer.prod.length': '{mm} mm bane',
    'addon.personalizer.prod.area': '{mm} mm² fyldt',
    'addon.personalizer.prod.count': 'baner: {count}',
    'addon.personalizer.prod.material': 'Materiale',
    'addon.personalizer.material.walnut': 'Valnød',
    'addon.personalizer.material.birch': 'Birk',
    'addon.personalizer.material.slate': 'Skifer',
    'addon.personalizer.material.ceramic': 'Keramik',
    'addon.personalizer.setup.fieldId': 'Felt',
    'addon.personalizer.prod.size': 'Færdigt mål',
    'addon.personalizer.prod.download': 'Hent filen',
    'addon.personalizer.prod.open': 'Se maskinfilen',
  },

  'zh-CN': {
    'addon.personalizer.line': '把顾客想要的样子实时画出来。',
    'addon.personalizer.what':
      '您只需划定一次顾客可以改动的区域。之后顾客自己输入文字，就能立刻看到它出现在成品上，大小合适、位置正确。',
    'addon.personalizer.desc':
      '顾客一边输入，一边看到文字落在木料上。您拿到的是可直接上机的文件，字母已经转成轮廓，不依赖激光机上装了什么字体。',
    'addon.personalizer.noCompany': 'Live Personalizer 不连接任何外部公司。',
    'addon.personalizer.noAccount': '它不需要任何账户，也不向外发出任何请求。',
    'addon.personalizer.perm.readPieces': '读取您的作品以及上面划定的区域',
    'addon.personalizer.perm.saveDesigns': '把顾客的要求存到您的订单上',
    'addon.personalizer.perm.storePreviews': '保存图样和上机文件',
    'addon.personalizer.perm.noAccount': '除此之外没有别的，也不需要外部账户',
    'addon.personalizer.disconnect.goes': '顾客在每件作品上会重新看到简单的备注栏。',
    'addon.personalizer.disconnect.stays':
      '已经下单的定制内容会保留并继续显示，您划定的区域也一样。',
    'addon.personalizer.act.1': '{when} · 一张图样作为校样发出 · {ref}',
    'addon.personalizer.act.2': '{when} · 在一件新作品上划好了区域',
    'addon.personalizer.act.3': '{when} · 生成了上机文件 · {ref}',

    'addon.personalizer.set.fonts': '顾客可以选的字体',
    'addon.personalizer.set.fontsHint': '随附五种。至少留一种开着，否则没得可选。',
    'addon.personalizer.set.proof': '开工前图样仍需确认',
    'addon.personalizer.set.proofOn': '顾客看到自己的图样并点头。默认开启。',
    'addon.personalizer.set.proofOff': '不等图样确认。任何订单您仍可以要求确认。',
    'addon.personalizer.set.finish': '新区域的做法',
    'addon.personalizer.set.finishHint': '如果您允许，顾客可以在作品上改。',
    'addon.personalizer.set.smallest': '小于这个尺寸，细笔画会糊在一起。店里在这时提醒，而不是拦着。',

    'addon.personalizer.title': '刻上您的字',
    'addon.personalizer.zone.top': '顶部一行',
    'addon.personalizer.zone.date': '日期',
    'addon.personalizer.zone.house': '宅名',
    'addon.personalizer.honest':
      '预览里就是我们要做上去的字。颜色和表面每件略有差别——每一件都是单独做的。',
    'addon.personalizer.angle.front': '正面',
    'addon.personalizer.angle.three': '斜看',
    'addon.personalizer.angle.top': '俯视',
    'addon.personalizer.angle.detail': '细节',
    'addon.personalizer.piece.walnut-coasters': '胡桃木杯垫',
    'addon.personalizer.piece.house-sign': '门牌',
    'addon.personalizer.preview.name': '{piece}，刻上你的文字——{words}',
    'addon.personalizer.preview.blank': '{piece}，还没有刻字',
    'addon.personalizer.zoom': '看近些',
    'addon.personalizer.zoomOut': '看整体',
    'addon.personalizer.counter': '{used}/{limit}',
    'addon.personalizer.font': '字体',
    'addon.personalizer.size': '字高',
    'addon.personalizer.sizeUnit': '{mm} 毫米',
    'addon.personalizer.smaller': '小一点',
    'addon.personalizer.larger': '大一点',
    'addon.personalizer.finish': '做法',
    'addon.personalizer.finish.engraved': '刻入',
    'addon.personalizer.finish.raised': '凸起',
    'addon.personalizer.finish.printed': '印刷',
    'addon.personalizer.finish.painted': '填色',
    'addon.personalizer.finishNote.engraved': '刻进表面，颜色来自下面的木头。',
    'addon.personalizer.finishNote.raised': '把字周围削低，字就凸出来了。',
    'addon.personalizer.finishNote.printed': '平涂在表面，单一颜色。',
    'addon.personalizer.finishNote.painted': '先刻再手工填色，边缘略柔。',
    'addon.personalizer.placeholder': '输入想刻的字',
    'addon.personalizer.over': '在 {size} 毫米下多出 {over} 个字。',
    'addon.personalizer.overWide': '在 {size} 毫米下比这块区域还宽。',
    'addon.personalizer.remedy.size': '改成 {size} 毫米',
    'addon.personalizer.remedy.shorten': '缩短到 {chars} 个字',
    'addon.personalizer.noSize': '我们能刻的任何尺寸都放不下，只能再短一些。',
    'addon.personalizer.tooMany': '比这块区域能容的 {limit} 个字多了 {over} 个。',
    'addon.personalizer.noLetter': '{chars} 我们没有对应的字符。它之前的都没问题。',
    'addon.personalizer.remedy.swap': '改刻 {to}，不刻 {from}',
    'addon.personalizer.noLetterSwap': '{chars} 我们没有对应的字符，但它的常见写法我们能刻。',
    'addon.personalizer.noLetterNone': '{chars} 我们没有对应的字符，它前面也没有可留下的内容。我们刻的是拉丁字母、数字和英文键盘上的符号。',
    'addon.personalizer.blockedLetters': '{name} 里有我们刻不出来的字符。',
    'addon.personalizer.fine':
      '小于 {mm} 毫米的细活在纹理开阔的木料上可能糊住。照样能刻——只是看着柔一些。',
    'addon.personalizer.required': '这一处每件都要刻，不能空着。',
    'addon.personalizer.blocked': '请先填写{name}。',
    'addon.personalizer.notSetUp': '这件作品还没有设好区域——工坊会就文字内容联系您。',
    'addon.personalizer.plain': '{piece}不写字就按原样制作。想刻字就在区域里写。',
    'addon.personalizer.replaced':
      '开着这项时，简单的备注栏会收起来。您在这里输入的字直接刻上去。',
    'addon.personalizer.notes.label': '想在上面刻什么？',

    'addon.personalizer.line.picture': '我们要刻的样子',
    'addon.personalizer.line.font': '字体',
    'addon.personalizer.line.size': '字高',
    'addon.personalizer.line.finish': '做法',
    'addon.personalizer.line.same': '同一张图样跟着订单走，再作为校样回到您手上。',
    'addon.personalizer.line.attention':
      '这段文字还放不进这个区域，切割前需要修改。',
    'addon.personalizer.notYet': '文字还放不下——用上面的按钮就能改好。',

    'addon.personalizer.setup.title': '顾客可以改动的区域',
    'addon.personalizer.setup.sub': '设好一次，这个数据库上的任何店铺都能用。',
    'addon.personalizer.setup.artwork': '四个角度',
    'addon.personalizer.setup.artworkNote': '这些就是顾客会看到的图，文字画在它们上面。',
    'addon.personalizer.setup.zones': '区域',
    'addon.personalizer.setup.add': '画一个方框',
    'addon.personalizer.setup.addOval': '画一个椭圆',
    'addon.personalizer.setup.remove': '去掉这块区域',
    'addon.personalizer.setup.name': '名称',
    'addon.personalizer.setup.limit': '字数上限',
    'addon.personalizer.setup.fonts': '这里提供的字体',
    'addon.personalizer.setup.range': '字高范围',
    'addon.personalizer.setup.required': '每件都要刻',
    'addon.personalizer.setup.optional': '可以留空',
    'addon.personalizer.setup.visible': '可见于',
    'addon.personalizer.setup.sample': '顾客会看到的样子',
    'addon.personalizer.setup.sampleNote': '在这里打几个字，不离开本页就能检查自己的设置。',
    'addon.personalizer.setup.empty': '这件作品还没有区域——先画一块。',
    'addon.personalizer.setup.saved': '已保存。已下单的内容不受影响。',
    'addon.personalizer.setup.open': '设置区域',
    'addon.personalizer.setup.close': '回到作品',

    'addon.personalizer.prod.title': '送去开工的文件',
    'addon.personalizer.prod.honest': '这是一个文件，不是机器——照您平时的方式发给激光机。',
    'addon.personalizer.prod.alphabet':
      '这里的字母出自工坊自己的刻字字形，尺寸和位置与顾客看到的图完全一致。文件里没有任何字体名称，所以在哪里打开都刻得一样。',
    'addon.personalizer.prod.layer.cut': '切割',
    'addon.personalizer.prod.layer.score': '划线',
    'addon.personalizer.prod.layer.engrave': '雕刻',
    'addon.personalizer.prod.length': '路径 {mm} 毫米',
    'addon.personalizer.prod.area': '填充 {mm} 平方毫米',
    'addon.personalizer.prod.count': '路径：{count}',
    'addon.personalizer.prod.material': '材料',
    'addon.personalizer.material.walnut': '胡桃木',
    'addon.personalizer.material.birch': '桦木',
    'addon.personalizer.material.slate': '石板',
    'addon.personalizer.material.ceramic': '陶瓷',
    'addon.personalizer.setup.fieldId': '字段',
    'addon.personalizer.prod.size': '成品尺寸',
    'addon.personalizer.prod.download': '下载文件',
    'addon.personalizer.prod.open': '查看上机文件',
  },

  'zh-TW': {
    'addon.personalizer.line': '把顧客想要的樣子即時畫出來。',
    'addon.personalizer.what':
      '您只需劃定一次顧客可以更動的區域。之後顧客自己輸入文字，就能立刻看到它出現在成品上，大小合適、位置正確。',
    'addon.personalizer.desc':
      '顧客一邊輸入，一邊看到文字落在木料上。您拿到的是可直接上機的檔案，字母已經轉成外框，不依賴雷射機上裝了什麼字型。',
    'addon.personalizer.noCompany': 'Live Personalizer 不連接任何外部公司。',
    'addon.personalizer.noAccount': '它不需要任何帳號，也不向外發出任何請求。',
    'addon.personalizer.perm.readPieces': '讀取您的作品以及上面劃定的區域',
    'addon.personalizer.perm.saveDesigns': '把顧客的要求存到您的訂單上',
    'addon.personalizer.perm.storePreviews': '保存圖樣與上機檔案',
    'addon.personalizer.perm.noAccount': '除此之外沒有別的，也不需要外部帳號',
    'addon.personalizer.disconnect.goes': '顧客在每件作品上會重新看到簡單的備註欄。',
    'addon.personalizer.disconnect.stays':
      '已經下單的訂製內容會保留並繼續顯示，您劃定的區域也一樣。',
    'addon.personalizer.act.1': '{when} · 一張圖樣作為校樣寄出 · {ref}',
    'addon.personalizer.act.2': '{when} · 在一件新作品上劃好了區域',
    'addon.personalizer.act.3': '{when} · 產生了上機檔案 · {ref}',

    'addon.personalizer.set.fonts': '顧客可以選的字型',
    'addon.personalizer.set.fontsHint': '隨附五種。至少留一種開著，否則沒得可選。',
    'addon.personalizer.set.proof': '開工前圖樣仍需確認',
    'addon.personalizer.set.proofOn': '顧客看到自己的圖樣並點頭。預設開啟。',
    'addon.personalizer.set.proofOff': '不等圖樣確認。任何訂單您仍可以要求確認。',
    'addon.personalizer.set.finish': '新區域的做法',
    'addon.personalizer.set.finishHint': '如果您允許，顧客可以在作品上更改。',
    'addon.personalizer.set.smallest': '小於這個尺寸，細筆畫會糊在一起。店裡在這時提醒，而不是攔著。',

    'addon.personalizer.title': '刻上您的字',
    'addon.personalizer.zone.top': '頂部一行',
    'addon.personalizer.zone.date': '日期',
    'addon.personalizer.zone.house': '宅名',
    'addon.personalizer.honest':
      '預覽裡就是我們要做上去的字。顏色和表面每件略有差別——每一件都是單獨做的。',
    'addon.personalizer.angle.front': '正面',
    'addon.personalizer.angle.three': '斜看',
    'addon.personalizer.angle.top': '俯視',
    'addon.personalizer.angle.detail': '細節',
    'addon.personalizer.piece.walnut-coasters': '胡桃木杯墊',
    'addon.personalizer.piece.house-sign': '門牌',
    'addon.personalizer.preview.name': '{piece}，刻上你的文字——{words}',
    'addon.personalizer.preview.blank': '{piece}，還沒有刻字',
    'addon.personalizer.zoom': '看近些',
    'addon.personalizer.zoomOut': '看整體',
    'addon.personalizer.counter': '{used}/{limit}',
    'addon.personalizer.font': '字型',
    'addon.personalizer.size': '字高',
    'addon.personalizer.sizeUnit': '{mm} 公釐',
    'addon.personalizer.smaller': '小一點',
    'addon.personalizer.larger': '大一點',
    'addon.personalizer.finish': '做法',
    'addon.personalizer.finish.engraved': '刻入',
    'addon.personalizer.finish.raised': '凸起',
    'addon.personalizer.finish.printed': '印刷',
    'addon.personalizer.finish.painted': '填色',
    'addon.personalizer.finishNote.engraved': '刻進表面，顏色來自下面的木頭。',
    'addon.personalizer.finishNote.raised': '把字周圍削低，字就凸出來了。',
    'addon.personalizer.finishNote.printed': '平塗在表面，單一顏色。',
    'addon.personalizer.finishNote.painted': '先刻再手工填色，邊緣略柔。',
    'addon.personalizer.placeholder': '輸入想刻的字',
    'addon.personalizer.over': '在 {size} 公釐下多出 {over} 個字。',
    'addon.personalizer.overWide': '在 {size} 公釐下比這塊區域還寬。',
    'addon.personalizer.remedy.size': '改成 {size} 公釐',
    'addon.personalizer.remedy.shorten': '縮短到 {chars} 個字',
    'addon.personalizer.noSize': '我們能刻的任何尺寸都放不下，只能再短一些。',
    'addon.personalizer.tooMany': '比這塊區域能容的 {limit} 個字多了 {over} 個。',
    'addon.personalizer.noLetter': '{chars} 我們沒有對應的字元。它之前的都沒問題。',
    'addon.personalizer.remedy.swap': '改刻 {to}，不刻 {from}',
    'addon.personalizer.noLetterSwap': '{chars} 我們沒有對應的字元，但它的常見寫法我們能刻。',
    'addon.personalizer.noLetterNone': '{chars} 我們沒有對應的字元，它前面也沒有可留下的內容。我們刻的是拉丁字母、數字和英文鍵盤上的符號。',
    'addon.personalizer.blockedLetters': '{name} 裡有我們刻不出來的字元。',
    'addon.personalizer.fine':
      '小於 {mm} 公釐的細活在紋理開闊的木料上可能糊住。照樣能刻——只是看著柔一些。',
    'addon.personalizer.required': '這一處每件都要刻，不能空著。',
    'addon.personalizer.blocked': '請先填寫{name}。',
    'addon.personalizer.notSetUp': '這件作品還沒有設好區域——工坊會就文字內容聯絡您。',
    'addon.personalizer.plain': '{piece}不寫字就按原樣製作。想刻字就在區域裡寫。',
    'addon.personalizer.replaced':
      '開著這項時，簡單的備註欄會收起來。您在這裡輸入的字直接刻上去。',
    'addon.personalizer.notes.label': '想在上面刻什麼？',

    'addon.personalizer.line.picture': '我們要刻的樣子',
    'addon.personalizer.line.font': '字型',
    'addon.personalizer.line.size': '字高',
    'addon.personalizer.line.finish': '做法',
    'addon.personalizer.line.same': '同一張圖樣跟著訂單走，再作為校樣回到您手上。',
    'addon.personalizer.line.attention':
      '這段文字還放不進這個區域，雕刻前需要修改。',
    'addon.personalizer.notYet': '文字還放不下——上面的按鈕可以調整。',

    'addon.personalizer.setup.title': '顧客可以更動的區域',
    'addon.personalizer.setup.sub': '設好一次，這個資料庫上的任何店鋪都能用。',
    'addon.personalizer.setup.artwork': '四個角度',
    'addon.personalizer.setup.artworkNote': '這些就是顧客會看到的圖，文字畫在它們上面。',
    'addon.personalizer.setup.zones': '區域',
    'addon.personalizer.setup.add': '畫一個方框',
    'addon.personalizer.setup.addOval': '畫一個橢圓',
    'addon.personalizer.setup.remove': '去掉這塊區域',
    'addon.personalizer.setup.name': '名稱',
    'addon.personalizer.setup.limit': '字數上限',
    'addon.personalizer.setup.fonts': '這裡提供的字型',
    'addon.personalizer.setup.range': '字高範圍',
    'addon.personalizer.setup.required': '每件都要刻',
    'addon.personalizer.setup.optional': '可以留空',
    'addon.personalizer.setup.visible': '可見於',
    'addon.personalizer.setup.sample': '顧客會看到的樣子',
    'addon.personalizer.setup.sampleNote': '在這裡打幾個字，不離開本頁就能檢查自己的設定。',
    'addon.personalizer.setup.empty': '這件作品還沒有區域——先畫一塊。',
    'addon.personalizer.setup.saved': '已儲存。已下單的內容不受影響。',
    'addon.personalizer.setup.open': '設定區域',
    'addon.personalizer.setup.close': '回到作品',

    'addon.personalizer.prod.title': '送去開工的檔案',
    'addon.personalizer.prod.honest': '這是一個檔案，不是機器——照您平時的方式傳給雷射機。',
    'addon.personalizer.prod.alphabet':
      '這裡的字母出自工坊自己的刻字字形，尺寸和位置與顧客看到的圖完全一致。檔案裡沒有任何字型名稱，所以在哪裡打開都刻得一樣。',
    'addon.personalizer.prod.layer.cut': '切割',
    'addon.personalizer.prod.layer.score': '劃線',
    'addon.personalizer.prod.layer.engrave': '雕刻',
    'addon.personalizer.prod.length': '路徑 {mm} 公釐',
    'addon.personalizer.prod.area': '填充 {mm} 平方公釐',
    'addon.personalizer.prod.count': '路徑：{count}',
    'addon.personalizer.prod.material': '材料',
    'addon.personalizer.material.walnut': '胡桃木',
    'addon.personalizer.material.birch': '樺木',
    'addon.personalizer.material.slate': '石板',
    'addon.personalizer.material.ceramic': '陶瓷',
    'addon.personalizer.setup.fieldId': '欄位',
    'addon.personalizer.prod.size': '成品尺寸',
    'addon.personalizer.prod.download': '下載檔案',
    'addon.personalizer.prod.open': '查看上機檔案',
  },

  'ar-EG': {
    'addon.personalizer.line': 'صورة حيّة لما يطلبه العميل.',
    'addon.personalizer.what':
      'ترسم مرة واحدة المساحات التي يُسمح للعميل بتغييرها. بعدها يكتب كلماته بنفسه ويراها تظهر على القطعة، بالحجم الصحيح وفي المكان الصحيح.',
    'addon.personalizer.desc':
      'يرى العميل الكلمات على القطعة وهو يكتب. وتحصل أنت على ملف جاهز للماكينة، حروفه محوَّلة إلى مسارات — فلا شيء يعتمد على ما هو مثبَّت على الليزر.',
    'addon.personalizer.noCompany': 'لا يتصل Live Personalizer بأي شركة خارجية.',
    'addon.personalizer.noAccount': 'لا يحتاج حسابًا في أي مكان، ولا يُجري أي اتصال.',
    'addon.personalizer.perm.readPieces': 'قراءة قطعك والمساحات المرسومة عليها',
    'addon.personalizer.perm.saveDesigns': 'حفظ ما طلبه العميل مع طلباتك',
    'addon.personalizer.perm.storePreviews': 'حفظ الصورة وملف الماكينة',
    'addon.personalizer.perm.noAccount': 'لا شيء غير ذلك، ولا حساب خارجي',
    'addon.personalizer.disconnect.goes': 'يعود العملاء إلى خانة الملاحظة البسيطة على كل قطعة.',
    'addon.personalizer.disconnect.stays':
      'ما سبق طلبه من نقوش يبقى ويظل ظاهرًا هنا، وكذلك المساحات التي رسمتها.',
    'addon.personalizer.act.1': '{when} · خرجت صورة للمراجعة · {ref}',
    'addon.personalizer.act.2': '{when} · رُسمت مساحات على قطعة جديدة',
    'addon.personalizer.act.3': '{when} · أُنشئ ملف الماكينة · {ref}',

    'addon.personalizer.set.fonts': 'الأبجديات التي يختار منها العميل',
    'addon.personalizer.set.fontsHint': 'خمسة مرفقة. أبقِ واحدة على الأقل، وإلا فلا شيء للاختيار.',
    'addon.personalizer.set.proof': 'الصورة تحتاج موافقة قبل التنفيذ',
    'addon.personalizer.set.proofOn': 'يرى العميل صورته ويوافق عليها. مُفعَّل افتراضيًا.',
    'addon.personalizer.set.proofOff':
      'لا يُنتظر اعتماد الصورة. ويظل بإمكانك طلبها في أي طلب.',
    'addon.personalizer.set.finish': 'كيف تُنفَّذ المساحة الجديدة',
    'addon.personalizer.set.finishHint': 'يستطيع العميل تغييرها على القطعة إن سمحت بذلك.',
    'addon.personalizer.set.smallest': 'تحت هذا الحجم تلتحم الخطوط الرفيعة. المتجر ينبّه عندها بدل أن يمنع.',

    'addon.personalizer.title': 'اجعلها باسمك',
    'addon.personalizer.zone.top': 'السطر العلوي',
    'addon.personalizer.zone.date': 'التاريخ',
    'addon.personalizer.zone.house': 'اسم البيت',
    'addon.personalizer.honest':
      'المعاينة تُظهر الكلمات التي سنضعها بالضبط. اللون والملمس يختلفان قليلًا من قطعة إلى أخرى — كل قطعة تُصنع على حدة.',
    'addon.personalizer.angle.front': 'من الأمام',
    'addon.personalizer.angle.three': 'بزاوية',
    'addon.personalizer.angle.top': 'من أعلى',
    'addon.personalizer.angle.detail': 'تفصيل',
    'addon.personalizer.piece.walnut-coasters': 'قواعد أكواب من الجوز',
    'addon.personalizer.piece.house-sign': 'لوحة المنزل',
    'addon.personalizer.preview.name': '{piece} بكلماتك — {words}',
    'addon.personalizer.preview.blank': '{piece} بلا كلمات بعد',
    'addon.personalizer.zoom': 'أقرب',
    'addon.personalizer.zoomOut': 'القطعة كاملة',
    'addon.personalizer.counter': '{used}/{limit}',
    'addon.personalizer.font': 'الأبجدية',
    'addon.personalizer.size': 'الحجم',
    'addon.personalizer.sizeUnit': '{mm} مم',
    'addon.personalizer.smaller': 'أصغر',
    'addon.personalizer.larger': 'أكبر',
    'addon.personalizer.finish': 'التنفيذ',
    'addon.personalizer.finish.engraved': 'محفور',
    'addon.personalizer.finish.raised': 'بارز',
    'addon.personalizer.finish.printed': 'مطبوع',
    'addon.personalizer.finish.painted': 'مُلوَّن',
    'addon.personalizer.finishNote.engraved': 'محفور في السطح، ولونه هو الخشب تحته.',
    'addon.personalizer.finishNote.raised': 'يُخفَض كل ما حول الكلمات فتبرز هي.',
    'addon.personalizer.finishNote.printed': 'حبر مسطّح على السطح، بلون واحد.',
    'addon.personalizer.finishNote.painted': 'يُحفر ثم يُملأ باليد، وحافته طريّة قليلًا.',
    'addon.personalizer.placeholder': 'اكتب ما تريده عليها',
    'addon.personalizer.over': 'أكثر بـ {over} حرفًا مما يتسع عند {size} مم.',
    'addon.personalizer.overWide': 'أعرض من المساحة عند {size} مم.',
    'addon.personalizer.remedy.size': 'اجعلها {size} مم',
    'addon.personalizer.remedy.shorten': 'اختصرها إلى {chars}',
    'addon.personalizer.noSize': 'لن تتسع بأي حجم نقطعه، فلا بد أن تكون أقصر.',
    'addon.personalizer.tooMany': 'أكثر بـ {over} حرفًا من {limit} التي تأخذها هذه المساحة.',
    'addon.personalizer.noLetter': 'ليس لدينا حرف يقابل {chars}. كل ما قبله سليم.',
    'addon.personalizer.remedy.swap': 'احفر {to} بدل {from}',
    'addon.personalizer.noLetterSwap': 'ليس لدينا حرف يقابل {chars}، لكننا نحفر شكله المعتاد.',
    'addon.personalizer.noLetterNone': 'ليس لدينا حرف يقابل {chars}، ولا يسبقه شيء نبقيه. نحن نحفر الحروف اللاتينية والأرقام وعلامات لوحة المفاتيح الإنجليزية.',
    'addon.personalizer.blockedLetters': 'في {name} حرف لا نستطيع حفره.',
    'addon.personalizer.fine':
      'العمل الدقيق تحت {mm} مم قد يلتحم على الخشب المفتوح العُروق. سيُقطع رغم ذلك — لكنه يُقرأ أنعم.',
    'addon.personalizer.required': 'هذه تُحفر في كل قطعة، فلا يصح تركها فارغة.',
    'addon.personalizer.blocked': 'املأ {name} أولًا.',
    'addon.personalizer.notSetUp':
      'لا مساحات معدَّة على هذه القطعة بعد — سيراسلك الورشة بشأن الصياغة.',
    'addon.personalizer.notes.label': 'ماذا تريد أن نحفر عليها؟',
    'addon.personalizer.plain': '{piece} تُصنع بلا كلمات ما لم تكتب شيئًا. اكتب في أي منطقة لنقشها.',
    'addon.personalizer.replaced':
      'خانة الملاحظة البسيطة تختفي ما دام هذا مُفعَّلًا. ما تكتبه هنا يذهب مباشرة إلى القطعة.',

    'addon.personalizer.line.picture': 'ما سنقطعه',
    'addon.personalizer.line.font': 'الأبجدية',
    'addon.personalizer.line.size': 'الحجم',
    'addon.personalizer.line.finish': 'التنفيذ',
    'addon.personalizer.line.same': 'الصورة نفسها تسافر مع الطلب وتعود إليك للمراجعة.',
    'addon.personalizer.line.attention':
      'الكلام ده لسه مش داخل في المساحة، فلازم يتعدّل قبل القص.',
    'addon.personalizer.notYet': 'الكلام لسه مش مظبوط في المساحة — الأزرار فوق هتظبطه.',

    'addon.personalizer.setup.title': 'مساحات يستطيع العميل تغييرها',
    'addon.personalizer.setup.sub': 'اضبطها مرة واحدة، ويستطيع أي متجر على قاعدة البيانات هذه استخدامها.',
    'addon.personalizer.setup.artwork': 'الزوايا الأربع',
    'addon.personalizer.setup.artworkNote': 'هذه هي الصور التي يراها العميل، والكلمات تُرسم فوقها.',
    'addon.personalizer.setup.zones': 'المساحات',
    'addon.personalizer.setup.add': 'ارسم مستطيلًا',
    'addon.personalizer.setup.addOval': 'ارسم بيضاويًا',
    'addon.personalizer.setup.remove': 'أزل هذه المساحة',
    'addon.personalizer.setup.name': 'الاسم',
    'addon.personalizer.setup.limit': 'حد الحروف',
    'addon.personalizer.setup.fonts': 'الأبجديات المتاحة هنا',
    'addon.personalizer.setup.range': 'مدى الحجم',
    'addon.personalizer.setup.required': 'تُحفر في كل قطعة',
    'addon.personalizer.setup.optional': 'يجوز تركها فارغة',
    'addon.personalizer.setup.visible': 'تُرى من',
    'addon.personalizer.setup.sample': 'ما سيراه العميل',
    'addon.personalizer.setup.sampleNote': 'اكتب نموذجًا هنا وتحقق من إعدادك دون مغادرة الصفحة.',
    'addon.personalizer.setup.empty': 'لا مساحات على هذه القطعة بعد — ارسم واحدة للبدء.',
    'addon.personalizer.setup.saved': 'حُفظ. لا يتغيّر شيء مما سبق طلبه.',
    'addon.personalizer.setup.open': 'اضبط المساحات',
    'addon.personalizer.setup.close': 'عودة إلى القطعة',

    'addon.personalizer.prod.title': 'ما يذهب إلى الماكينة',
    'addon.personalizer.prod.honest': 'هذا ملف، لا ماكينة — أرسله إلى الليزر كما تفعل دائمًا.',
    'addon.personalizer.prod.alphabet':
      'الحروف هنا من أبجدية القطع الخاصة بالورشة، بالحجم نفسه وفي المكان نفسه الذي تُظهره صورة العميل. لا شيء في الملف يذكر خطًا، فيُقطع بالشكل نفسه أينما فُتح.',
    'addon.personalizer.prod.layer.cut': 'قطع',
    'addon.personalizer.prod.layer.score': 'تخديش',
    'addon.personalizer.prod.layer.engrave': 'حفر',
    'addon.personalizer.prod.length': '{mm} مم من المسار',
    'addon.personalizer.prod.area': '{mm} مم² مملوءة',
    'addon.personalizer.prod.count': 'مسارات: {count}',
    'addon.personalizer.prod.material': 'الخامة',
    'addon.personalizer.material.walnut': 'جوز',
    'addon.personalizer.material.birch': 'بتولا',
    'addon.personalizer.material.slate': 'أردواز',
    'addon.personalizer.material.ceramic': 'سيراميك',
    'addon.personalizer.setup.fieldId': 'حقل',
    'addon.personalizer.prod.size': 'المقاس النهائي',
    'addon.personalizer.prod.download': 'نزّل الملف',
    'addon.personalizer.prod.open': 'اعرض ملف الماكينة',
  },
} as const;

export type MessageKey = keyof (typeof personalizerStrings)['en-US'];

/**
 * ── THE LATIN DIGITS IN THESE STRINGS THAT ARE NOT QUANTITIES ───────────────
 *
 * A host renders this bundle inside its own pages, and every host in this wave
 * runs the same rule over an Arabic page: a run of Latin digits that is not
 * inside an identifier is an unformatted number, and a defect. Some of an
 * add-on's own strings legitimately carry one anyway, and when they do THE
 * ADD-ON IS THE ONLY THING THAT KNOWS WHY.
 *
 * ── WHY THIS TRAVELS WITH THE STRINGS INSTEAD OF WITH THE HOST ──────────────
 *
 * It used to live in the host. Print Shop's `numerals.arabic.test.tsx` carried
 * Design Studio's specimen telephone number in ITS exemption list, and Maker
 * Shop did not — so wiring Design Studio into the second host, registration
 * only, zero bytes changed in any add-on, turned that host's suite red. The
 * fix was to edit a list in the host, which is exactly what AC20/D21 says must
 * never be necessary: an add-on is portable when moving it needs no edit in the
 * app that receives it.
 *
 * The same shape had already been fixed twice this wave (HOSTED_SLOTS, the
 * Czech "pro" carve-out). This is the third and it is fixed the same way: the
 * fact is declared beside the strings it is about, in the module the hosts
 * vendor, and each host's guard reads whatever is vendored into it. A host that
 * takes this add-on takes its allowances; a host that does not, does not.
 *
 * EVERY ADD-ON EXPORTS THIS, even when it is empty. A host asserts the export
 * exists on every bundle it has vendored, so a missing declaration is a red
 * suite rather than an allowance nobody notices is gone.
 */
export const NOT_A_QUANTITY: readonly { phrase: string; why: string }[] = [];

