# Customiser

Products your customers make their own: they choose a ready-made design, put
in their own words, logo, photo and colours, and see it as it will be made.
The shop proofs the design and makes it from the same data.

It serves the two shop apps, Maker Shop and Print Shop, which require it. One
install may run both on one Customiser: every row says which app it is for,
and each app's visitors see only that app's.

## What it keeps

- **Bases**: what gets customised. A flat page (a business card, a flyer, at
  its finished size, with bleed and a safe line), a flat piece (a coaster, a
  sign, from its outline, material and thickness), a kit of pieces (a book
  nook) or a 3D-printed item (a keyring). A kit's **pieces**, and the
  **areas** where a customer may add words or a logo.
- **Ready-made designs** on a base, made by the shop. Every **part** is the
  shop's (locked) or the customer's to change within its rules: how many
  characters, which fonts, sizes and colours; how a logo sits in its box;
  which choices a motif offers.
- **Fonts**, starting with an open-licence set every install has, and the
  shop's own. **Palettes** and their **colours**: a design's paper, ink and
  accent, or the finishes a workshop offers.
- **Priced features**: what costs more ("Your own logo", "Engrave both
  sides"). The Customiser keeps only the feature and its code: **the price is
  the app's**, an option row of its own priced like every other option, which
  names the feature by its code. A feature is charged as one flat amount,
  never lowered by a quantity break.
- **Customers' designs**, kept as data, never as a picture: which ready-made
  design or base it starts from, what the customer chose, their own files,
  and the version of the data's shape. Each has a code the app's order line
  finds it by, and a private link that only ever goes to the customer by
  e-mail. A design nobody ordered goes 90 days after its last change, with
  its files.
- **Design versions**: the snapshot an order is made from, and the proof the
  shop sends of it. **Production files**: the print PDF of each side and the
  laser's SVG of each piece, made in the shop's browser from a version.

## What an app's order lines declare

An order line that names a design checks it (`check`, by
`{ "addOn": "customiser" }`) and posts it when the line is made, which
snapshots the design's version and locks its draft in the same save:

```json
"postings": [
  {
    "id": "design",
    "into": { "addOn": "customiser", "ledger": "designs", "action": "order" },
    "via": "order_id",
    "post": { "on": { "create": true } },
    "map": { "design": "design_id" },
    "only": { "column": "design_id", "set": true }
  }
]
```

`design_id` is the line's link into the Customiser's designs, filled by
looking the design up by its code. A design ordered again without a change
gets no new version.

## Who sees what

A shop's visitors read what it offers (its published bases, the designs it
shows, their parts, fonts, palettes and features) and may save a design,
behind the human check. Nobody reads a saved design through the shop; it
opens again only by its private link, which reads that one design.

Staff with the **Customiser designer** role set up the shop's side and make
proofs; the **Customiser reader** reads everything and changes nothing.

## Sample data

Each shop app ships its own sample for the Customiser, taken from
`seeds/maker.sample.json` (Birch Row) and `seeds/printing.sample.json`
(Marlow Press).
