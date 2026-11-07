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

## The saved design's link

"Save and come back" asks the customer for their e-mail and mails them the
design's private link: the Customiser's one e-mail, a service message in the
customer's language. The button in it opens the page each app names on its
customer side under the route key `customiserDesign`, with the link's code
after the `#`; an app that names no such page sends the message without a
button. The link changes the design while it is a draft, and deletes it
(its logo and photo with it); once ordered it only reads it. The mail never
keeps a design: one nobody ordered still goes 90 days after its last change.

## Who sees what

A shop's visitors read what it offers (its published bases, the designs it
shows, their parts, fonts, palettes and features) and may save a design,
behind the human check. Nobody reads a saved design through the shop; it
opens again only by its private link, which reads that one design.

Staff with the **Customiser designer** role set up the shop's side and make
proofs; the **Customiser reader** reads everything and changes nothing.

## What an app's role needs

The Customiser draws two panels on an app's records: **on a product**
(`customiser-product`, on the product's link into `bases`) and **on an order
line** (`customiser-line`, on the line's link into `designs`). The order-line
panel is where the shop makes the proof and the production files. An app
gives its own roles what they need with `roles[].tables` (up to 24 add-on
tables a role) and `page:@…:view` grants, besides the role's own read of the
record's table. Where something is missing the panel says which, and makes
nothing.

The Customiser says how far an app's role may go on each table
(`appGrants`, Adminium 0.3.47):

| Table | The most an app's role holds |
|---|---|
| `bases` | read; create (every column); update (every column but `app`) |
| `base_pieces`, `base_areas`, `ready_designs`, `ready_parts`, `fonts`, `palettes`, `palette_colours`, `features` | read; create (every column); update (every column but `app`); delete |
| `settings` | read |
| `designs` | read, read_pii |
| `design_versions` | read, read_pii; create (`app`, `design_id`, `version`, `values`); update (`proof_file`) |
| `version_files` | read; create (`app`, `version_id`, `kind`, `name`, `about`, `layers`, `left_out`, `position`); update (`file`); delete |
| `postings`, `design_mails` | nothing |

The writes on the shop's tables are the set-up page's (add-ons 1.0.21): a role
an app gives the set-up changes there what the Customiser's own designer
does. The panels only read them.

An entry asking for more is cut to this, and the install check says what was
cut. `read_pii` is what shows the customer's words (`values`), logo and photo:
without it they read as empty and the design is drawn without them. `delete`
on `version_files` is what lets "Make the files again" replace the version's
earlier files.

### The product panel

```json
{
  "permissions": ["table:@products:read", "page:@customiser-product:view", "page:@customiser:view"],
  "tables": [
    { "addOn": "customiser", "table": "bases", "actions": ["read"] },
    { "addOn": "customiser", "table": "base_areas", "actions": ["read"] },
    { "addOn": "customiser", "table": "ready_designs", "actions": ["read"] },
    { "addOn": "customiser", "table": "features", "actions": ["read"] }
  ]
}
```

`table:@products:read` stands for the app's own table the panel is on.
`page:@customiser:view` is the set-up page, at `/add-ons/customiser/customiser`,
that the panel's "Open the set-up" goes to; leave it out for a role that does
not set up.

### The order-line panel, the proof and the production files

A role that makes the proof and the files:

```json
{
  "permissions": ["table:@order_lines:read", "page:@customiser-line:view", "page:@customiser:view"],
  "tables": [
    { "addOn": "customiser", "table": "designs", "actions": ["read", "read_pii"] },
    { "addOn": "customiser", "table": "design_versions", "actions": ["read", "read_pii", "create", "update"] },
    { "addOn": "customiser", "table": "version_files", "actions": ["read", "create", "update", "delete"] },
    { "addOn": "customiser", "table": "bases", "actions": ["read"] },
    { "addOn": "customiser", "table": "base_pieces", "actions": ["read"] },
    { "addOn": "customiser", "table": "base_areas", "actions": ["read"] },
    { "addOn": "customiser", "table": "ready_designs", "actions": ["read"] },
    { "addOn": "customiser", "table": "ready_parts", "actions": ["read"] },
    { "addOn": "customiser", "table": "fonts", "actions": ["read"] },
    { "addOn": "customiser", "table": "palettes", "actions": ["read"] },
    { "addOn": "customiser", "table": "palette_colours", "actions": ["read"] },
    { "addOn": "customiser", "table": "features", "actions": ["read"] }
  ]
}
```

A role that only looks at the panel takes the same entries with `["read",
"read_pii"]` on `designs` and `design_versions`, `["read"]` on the rest, and no
`page:@customiser:view`. `table:@order_lines:read` stands for the app's own
table the panel is on.

**`page:@customiser:view` on a role that makes files, screens-only roles
too.** A starter font nobody uploaded is read from the file this package
ships, through the set-up page's files route
(`/api/v1/add-ons/customiser/pages/customiser/files/…`), which answers only a
reader who may open that page. Without it the panel names the font file it is
missing. A screens-only role never sees the page in a menu; the grant only
lets its panels read the files.

### The set-up page

A role that sets up the shop's side (a shop's owner) opens
`/add-ons/customiser/customiser` and reads and writes what that page does:

```json
{
  "permissions": ["page:@customiser:view"],
  "tables": [
    { "addOn": "customiser", "table": "settings", "actions": ["read"] },
    { "addOn": "customiser", "table": "bases", "actions": ["read", "create", "update"] },
    { "addOn": "customiser", "table": "base_pieces", "actions": ["read", "create", "update", "delete"] },
    { "addOn": "customiser", "table": "base_areas", "actions": ["read", "create", "update", "delete"] },
    { "addOn": "customiser", "table": "ready_designs", "actions": ["read", "create", "update", "delete"] },
    { "addOn": "customiser", "table": "ready_parts", "actions": ["read", "create", "update", "delete"] },
    { "addOn": "customiser", "table": "fonts", "actions": ["read", "create", "update", "delete"] },
    { "addOn": "customiser", "table": "palettes", "actions": ["read", "create", "update", "delete"] },
    { "addOn": "customiser", "table": "palette_colours", "actions": ["read", "create", "update", "delete"] },
    { "addOn": "customiser", "table": "features", "actions": ["read", "create", "update", "delete"] }
  ]
}
```

That is ten of a role's 24 add-on tables; a role that also makes proofs adds
`designs`, `design_versions` and `version_files` (thirteen). The first time
such a role opens the set-up, the page adds the starter fonts' files into
their rows, so a shopper's editor can load them; a role that may not change
the fonts sees "Add the starter fonts" instead.

The Customiser's own **designer** and **reader** roles hold the same and more
(the designer also sets up the shop's side), for a person who works in the
dashboard rather than in an app's screens.

## Sample data

Each shop app ships its own sample for the Customiser, taken from
`seeds/maker.sample.json` (Birch Row) and `seeds/printing.sample.json`
(Marlow Press).
