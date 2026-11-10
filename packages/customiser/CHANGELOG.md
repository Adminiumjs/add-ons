# @adminium/add-on-customiser

## 1.0.25

### Patch Changes

- 0e55701: Customiser: the order-line panel on a shop app's own screens (a maker's studio, a print works' prepress) draws the design again instead of saying "Loading" for ever. The panel keeps the shop's set-up it read once itself, where 1.0.24 left it to the screen, which hands a list it no longer reads back empty.

## 1.0.24

### Patch Changes

- 98c1916: Customiser: the full editor offers the base's offered fonts alone, and new words start in the base's first offered font. A words layer already set in a font the base no longer offers keeps it, listed beside the offered ones. A base that names no fonts, or none still switched on, offers the starter fonts and its own shop's, never a font another app on the install uploaded, and a design set in another app's font is refused when ordered.
- 0c8aa1e: Customiser: the "New base" dialog marks the kind of the shop it is for: a flat page for a print shop, a flat piece for a maker shop, until the owner picks another.
- 4c736ee: Customiser: the order-line panel says what the Customiser made, not what the shop sent: its badge reads "No proof made" instead of "No proof yet", and a design with no version yet reads "The Customiser has made no proof of this design yet." instead of "No proof sent yet.". A shop may send its own file as a proof from its own app, which the panel does not read.
- 528a6fe: Customiser: the order-line panel reads the shop's set-up (bases, ready-made designs, fonts, colours, features, settings) once, and after making a proof or the files reads again only the design's versions and their files, not all fourteen of its tables. Each "Make the proof" and "Make the files" reads the fonts and the shop's one-colour line as they are then, so a font file or a line changed in another tab since the panel opened is used.
- 9188505: Customiser: the set-up's Fonts step draws each font's sample in that font, loading every font that has a file into the page. A font whose file is replaced is loaded again, one that failed to load is tried again, and the shop's fonts are loaded under the Customiser's own names, so a shop's Manrope never stands in for the dashboard's.
- 273f34a: Customiser: the order-line panel calls a picture added in the full editor "their own picture", never "their own logo": the full editor keeps any picture in the first picture column it has room in, which says nothing of whether it is a logo or a photo. The privacy line now covers any picture the shopper gave: "The shopper's pictures are private to them and the shop."
- 7e62f48: Customiser: an order with two or more customised items is taken. Each new design version an order makes is labelled by its design as well as its number, so two new designs in one order no longer both ask for the label "v1", which Adminium refused ("We couldn't take the order as it is").

## 1.0.23

### Patch Changes

- cdcf39f: Customiser set-up: emptying a base's "Rounded corners" field takes the corners back to none, instead of keeping the old figure with no word said.
- 3ef1f4f: Customiser: the order-line panel lists what a design taken into the full editor holds (its words, its logo, its photo, each under its own name) instead of every part of its form as "left plain"; a photo is named as the shopper's photo, not their logo.
- 1e54c39: Customiser: on the shop's "Choose a design" page, each card of a piece, a kit or a printed item shows its own ready-made design in 3D again, instead of every card showing the last one (the cards' stills are now drawn one after another on their shared stage).
- 7600f65: Customiser: the order-line panel waits for a picture's lightness only so long, and never on a printed page; a one-colour logo whose lightness was not read is said to be drawn in full colour, and a missing or unreadable settings row is said to leave the shop's one-colour line unknown. A blank proof is refused before any version is saved, a design taken into the full editor included. On "Choose a design", a card whose 3D model never comes keeps its flat drawing and no longer holds up the cards after it.
- bcf09db: Customiser: the order-line panel's "Make the proof" and files buttons stay off, with "Loading the design…", until the design, its versions and files, the shop's parts, fonts and finishes, its one-colour line and each picture's lightness are in; a proof that would leave out every word and picture the shopper chose is refused instead of saved. A role that may not read the Customiser's settings is told its one-colour logo is drawn at the 50% line, not the shop's own.
- b1762d8: Customiser: the set-up page has **Shop settings**, where the shop keeps its one-colour line (where light becomes dark when a shopper makes their logo one colour), a new page's bleed and safe line, the thinnest line and the sharpness a picture needs; Adminium's own add-on settings screen draws only settings a manifest declares, and the Customiser keeps its own in a table. The settings are one row for the whole install, covering every shop app on it, and the dialog says so; an app's role may now change them (`appGrants`), every one but the unit sizes are shown in, which nothing reads yet. The README's grants keep each app's roles to the app's own rows by its `app` column: a shop's owner sees, changes and removes only its own app's set-up and makes rows only for it, reads and fills the starter fonts but never removes one, and no app's role makes a font a starter or takes one out of the set (`starter` is no longer an app's to change). The proof-maker's grants read the settings, so its proof uses the shop's own line, and read only the app's own customers' designs, versions and files: on an install running Maker Shop and Print Shop, neither app's staff read the other's customers' words or logos. "New base" offers only the shop apps the reader's role works for, so an app's owner is never offered the other's.
- b1762d8: Customiser set-up: while the starter fonts' files are added on the first visit, the page's lists wait and are read once when every file is in, instead of all of them again after each font.

## 1.0.22

### Patch Changes

- 9044e6b: Customiser: a shop's own 3D model (a kit's assembled GLB, a printed item's GLB preview) opens seen from above, as a flat piece does, instead of from below; dragging, the turn buttons and the arrow keys still move its near side the way the pointer goes. A printed item's preview model is shown in the plastic the shopper picked, not only its raised words.

## 1.0.21

### Patch Changes

- 0ad200b: Customiser: an app's role may now be given everything the set-up page reads and writes (the settings to read; the shop's bases, pieces, areas, ready-made designs and their parts, fonts, palettes, colours and features to add, change and remove, a base never removed), so a shop's owner opens the set-up without the Customiser designer role. The set-up adds the starter fonts' files into their rows the first time somebody who may change the fonts opens it. The order-line panel names each part of the design's own layout once, and a piece's proof shows a logo set to "Make it one colour" as the laser cuts it. A link to a design version is named by its number. Holiday Calendars' picker starts on the shop's own country: the set it already took, else its browser's time zone or language. `@adminium/add-on-host/testing` no longer exports `HOST_BEHAVIOURS`, which no host reads.

## 1.0.20

## 1.0.19

### Patch Changes

- af4bb56: The Customiser says how far a shop app's own role may go on each of its tables (`appGrants`), so an app's maker or pre-press role makes the proof and the production files without a Customiser role: it reads the shop's set-up, reads a customer's design with its words, logo and photo, adds a proof version and sets its proof file (never the words an order's posting copied), and makes, attaches and replaces a version's files. The settings, the postings and the log of mailed links are given to no app's role. Needs Adminium 0.3.47. The README lists the entries an app's role takes, the set-up page's address, and the set-up page's view a role needs to make files in a starter font.
- 72a38b5: The panels on a product and on an order line say plainly when the reader's role is short of a right, instead of a blank drawing, "Designs: none yet" or "No design on this line": which of the Customiser's tables the role may not read, that the customer's words, logo and photo are hidden from it, and which Customiser role shows it all or makes the proof and the files. The order-line panel makes no proof or file from a design the role cannot read whole, and says so when making the files again is refused for want of the right to remove the earlier ones. The README lists what an app's role needs for each panel.
- 2d08c4f: The order-line panel makes the proof and the production files in a starter font nobody uploaded yet, from the font file the package ships for it. A fresh install no longer stops at "The files need the font file of Manrope" before someone pressed "Add the starter fonts" in the set-up. The file is handed out beside the set-up page, so the person making the files needs that page's view (the Customiser designer role holds it).

## 1.0.18

## 1.0.17

## 1.0.16

### Patch Changes

- 9c9a52f: Customiser: things a shop's customers make their own, for Maker Shop and Print Shop. The shop sets up bases (flat sheets, kits of pieces in 3D, printed items and printed pages), their areas, ready-made designs, fonts and finishes on one set-up page; a customer fills a design in the editor the app vendors from the package's `dist/browser/` (`index.js`, `stage3d.js`, `editor.css`); every design is checked by `dist/check.js` and kept as data, and the order line panel makes the proofs, print PDFs and laser files from it. The open-licence starter fonts ship in the package with their licence texts, and the set-up page adds them on an Adminium that serves the files beside a page (0.3.44). Needs Adminium 0.3.43.
