# @adminium/add-on-customiser

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
