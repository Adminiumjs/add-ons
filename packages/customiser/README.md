# Customiser

Products your customers make their own: they choose a ready-made design, put
in their own words, logo, photo and colours, and see it as it will be made.
The shop proofs the design and makes it from the same data.

It serves the two shop apps, Maker Shop and Print Shop, which require it. One
install may run both on one Customiser: every row says which app it is for,
and each app's visitors see only that app's.

Two apps on two databases each have a Customiser of their own. Adminium
installs it with each app, in that app's database, and nothing crosses
between the two copies: their bases, designs, fonts, settings and customers'
designs are each their own. The dashboard's menu lists the set-up page once
for each copy you can open, with its database's name beside it, and each row
opens its own copy. The first copy's page is at
`/add-ons/customiser/customiser`, a later one's at
`/add-ons/customiser~<slug>/customiser`, where `<slug>` is the short name
Adminium made from its database's name (Adminium 0.3.53).

## What it needs

- Adminium **0.3.47** or later: how far an app's role may go on each table
  (`appGrants`, below) needs it.
- The two shop apps ask for more: Maker Shop and Print Shop 0.2.4 need
  Adminium **0.3.53**, which also opens the set-up page of each copy when two
  apps are on two databases.

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

## The customer's editor

Adminium serves no add-on code to a shop's visitors. The editor a customer
designs in ships in the app's own customer bundle and runs on the app's own
React (React 19). The package's `./browser` entry is that editor, and
`./browser/editor.css` its stylesheet. Maker Shop and Print Shop import a
vendored copy of both (below, `vendor/customiser/index.js` and `editor.css`);
from the package they read:

```tsx
import { CustomiserEditor, customiserApi } from '@adminiumjs/add-on-customiser/browser';
import '@adminiumjs/add-on-customiser/browser/editor.css';

const api = customiserApi({
  shop: client, // the app's public client, of its customer key
  link: () => createPublicClient({ baseUrl, publishableKey: keys['customiser-link'] })!,
  baseUrl,
});

<CustomiserEditor api={api} base={product.base_id} product={{ name: product.name, price: '£34.00' }}
  onAddToBasket={(design) => addLine(design.code, design.used)} />
```

- **`CustomiserEditor`**: choose a design, fill it in, check it, save it and
  come back to it, add it to the basket.
- **`YourDesigns`**: the designs this browser holds, and those an order names.
- **`WaysIn`**: a print shop's three ways in, for its product page.
- **`customiserApi`**: the calls the editor makes, through the clients the app
  hands in. The editor never makes a client of its own. `link` makes a new
  client of the add-on's link key for each saved design, since a client holds
  one session at a time.
- **`openSavedLink`, `readDesigns`, `heldDesign`, `hasSavedDesigns`,
  `designRefusal`**: for the app's own routes (the e-mailed link's page, the
  order lookup, a design's session, the header's "Your designs", a refused
  order). The editor keeps nothing in the browser's storage: the app keeps
  the sessions it is handed.

The stylesheet holds the editor's classes, each starting `cz-`. It takes the app's colours and type from the CSS variables the
app sets (`--accent`, `--surface`, `--fg` and the rest). The 3D stage is a
third file, `stage3d.js`, which the editor fetches from beside `index.js`
only when a piece is shown in 3D.

### What it reaches

The editor reaches Adminium through the Customiser's public entries, and
nothing else:

- **Through the app's customer key.** Every entry with no `key` of its own
  rides the customer key of each app the Customiser is attached to. Most are
  held to the app by `appColumn: "app"`: through Print Shop's key they read
  only Print Shop's rows, and a design saved through it is Print Shop's
  whatever the browser sends. The shop's catalogue is read this way (its
  published bases, their pieces and areas, its published ready-made designs
  and their parts, palettes, colours and features), with the fonts on offer
  and three of the settings (the sharpness a picture needs, the thinnest line,
  the one-colour line). A new design is saved this way too, behind the human
  check, and the reply hands back the design's code and its own link, once.
  An ordered design is read by its code, with the session the app's order
  lookup holds.
- **Through the design's own link** (the key `customiser-link`). It reads one
  design and changes or deletes it while it is a draft, and reaches no other
  row. The page that saved the design holds the link's session already; the
  e-mailed link opens it from any device.

### How an app vendors it

An app copies the editor's three files (`index.js`, `stage3d.js`,
`editor.css`) into its own repository, from the release its attach range asks
for. A shop then runs the editor it was built with: updating the add-on does
not change it until the app vendors the new one.

Maker Shop and Print Shop do it with `npm run sync:customiser`
(`scripts/sync-customiser.mjs`), into `vendor/customiser/`:

- `--tarball <file.tgz> --ledger <RELEASES.json>` takes the files from the
  released package, after its bytes are held to the integrity this
  repository's release ledger wrote for that version. A tarball the ledger
  does not name, or whose bytes differ, is refused and nothing is written.
- `<dir>` takes them from a built checkout's `packages/customiser/dist/browser`.
- `--check` writes nothing, and fails when the vendored files are not the
  ones the source gives.

Beside the files it writes `app-grants.json` (each table's `appGrants`, from
this package's `manifest.json`, which the app's tests hold its roles to) and
`SOURCE.json` (the version the files came from, and each file's hash).

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
| `base_pieces`, `base_areas`, `ready_designs`, `ready_parts`, `palettes`, `palette_colours`, `features` | read; create (every column); update (every column but `app`); delete |
| `fonts` | read; create (every column); update (every column but `app` and `starter`); delete |
| `settings` | read; update (every column but `length_unit`, which nothing reads yet) |
| `designs` | read, read_pii |
| `design_versions` | read, read_pii; create (`app`, `design_id`, `version`, `values`); update (`proof_file`) |
| `version_files` | read; create (`app`, `version_id`, `kind`, `name`, `about`, `layers`, `left_out`, `position`); update (`file`); delete |
| `postings`, `design_mails` | nothing |

The writes on the shop's tables are the set-up page's (add-ons 1.0.21): a role
an app gives the set-up changes there what the Customiser's own designer
does. The panels only read them. The settings are changed from the set-up
page's **Shop settings** (add-ons 1.0.23): the one-colour line a shopper's
editor starts on, a new page's bleed and safe line, the thinnest line and the
sharpness a picture needs. They are the install's: one row that covers every
shop app on it, and the dialog says so.

`appGrants` says how far a role may go on a table, never on which rows. Every
row but the settings names the app it belongs to (`app`), a customer's design
and its versions and files among them; an app keeps its roles to its own
rows itself, with a row limit on `app` (the examples below).

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

For an app whose key is `maker` (Print Shop writes `printing` wherever `maker`
stands), `OWN` standing for `{ "reach": "all", "while": { "column": "app", "in": ["maker"] } }`:

```json
{
  "permissions": ["table:@order_lines:read", "page:@customiser-line:view", "page:@customiser:view"],
  "tables": [
    { "addOn": "customiser", "table": "designs", "actions": ["read", "read_pii"],
      "limit": { "rows": { "read": OWN } } },
    { "addOn": "customiser", "table": "design_versions", "actions": ["read", "read_pii", "create", "update"],
      "limit": {
        "creatable": ["app", "design_id", "version", "values"], "creatableValues": { "app": ["maker"] },
        "writable": ["proof_file"],
        "rows": { "read": OWN, "update": OWN }
      } },
    { "addOn": "customiser", "table": "version_files", "actions": ["read", "create", "update", "delete"],
      "limit": {
        "creatable": ["app", "version_id", "kind", "name", "about", "layers", "left_out", "position"], "creatableValues": { "app": ["maker"] },
        "writable": ["file"],
        "rows": { "read": OWN, "update": OWN, "delete": OWN }
      } },
    { "addOn": "customiser", "table": "settings", "actions": ["read"] },
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

`ownPanel(app)` in `src/manifest/app-grants.ts` writes these entries out.
**The row limits are what keep one app's customers from the other's staff**:
without them, Print Shop's pre-press reads a Maker Shop customer's words and
logo on an install that runs both. With them, another app's design, version
or file is "not found" to the role. The set-up tables hold no personal data
and are read whole.

A role that only looks at the panel takes the same entries with `["read",
"read_pii"]` on `designs` and `design_versions` (each with `rows: { read: OWN }`),
`["read"]` on the rest, and no `page:@customiser:view`. `table:@order_lines:read` stands for the app's own
table the panel is on.

**`settings: read` on a role that makes a piece's proof.** A logo the shopper
made one colour and left at the line it started on is drawn at the shop's own
one-colour line, which is in the settings. A role that may not read them is
told on the panel that its proof uses the 50% line, which may not be what the
shopper saw. A page (a print shop's card) is printed in colour and never uses
the line.

**`page:@customiser:view` on a role that makes files, screens-only roles
too.** A starter font nobody uploaded is read from the file this package
ships, through the set-up page's files route
(`/api/v1/add-ons/customiser/pages/customiser/files/…`), which answers only a
reader who may open that page. Without it the panel names the font file it is
missing. A screens-only role never sees the page in a menu; the grant only
lets its panels read the files.

### The set-up page

A role that sets up the shop's side (a shop's owner) opens
`/add-ons/customiser/customiser` and reads and writes what that page does,
and only its own app's rows of it. For an app whose key is `maker` (Print
Shop writes `printing` wherever `maker` stands):

```json
{
  "permissions": ["page:@customiser:view"],
  "tables": [
    { "addOn": "customiser", "table": "settings", "actions": ["read", "update"],
      "limit": { "writable": ["default_bleed_mm", "default_safe_mm", "one_colour_threshold", "smallest_line_mm", "min_dpi"] } },
    { "addOn": "customiser", "table": "designs", "actions": ["read"],
      "limit": { "rows": { "read": { "reach": "all", "while": { "column": "app", "in": ["maker"] } } } } },
    { "addOn": "customiser", "table": "bases", "actions": ["read", "create", "update"],
      "limit": {
        "creatable": ["app", "name", "kind", "width_mm", "…every column of the table"],
        "creatableValues": { "app": ["maker"] },
        "writable": ["name", "kind", "width_mm", "…every column but app"],
        "rows": {
          "read": { "reach": "all", "while": { "column": "app", "in": ["maker"] } },
          "update": { "reach": "all", "while": { "column": "app", "in": ["maker"] } }
        }
      } },
    { "addOn": "customiser", "table": "base_pieces", "actions": ["read", "create", "update", "delete"],
      "limit": {
        "creatable": ["app", "…every column of the table"],
        "creatableValues": { "app": ["maker"] },
        "writable": ["…every column but app"],
        "rows": {
          "read": { "reach": "all", "while": { "column": "app", "in": ["maker"] } },
          "update": { "reach": "all", "while": { "column": "app", "in": ["maker"] } },
          "delete": { "reach": "all", "while": { "column": "app", "in": ["maker"] } }
        }
      } },
    { "addOn": "customiser", "table": "fonts", "actions": ["read", "create", "update", "delete"],
      "limit": {
        "creatable": ["app", "…every column of the table"],
        "creatableValues": { "app": ["maker"], "starter": [false] },
        "writable": ["…every column but app and starter"],
        "rows": {
          "read": [{ "reach": "all", "while": { "column": "app", "in": ["maker"] } }, { "reach": "all", "while": { "column": "starter", "in": [true] } }],
          "update": [{ "reach": "all", "while": { "column": "app", "in": ["maker"] } }, { "reach": "all", "while": { "column": "starter", "in": [true] } }],
          "delete": { "reach": "all", "while": { "column": "app", "in": ["maker"] } }
        }
      } }
  ]
}
```

`base_areas`, `ready_designs`, `ready_parts`, `palettes`, `palette_colours`
and `features` take the entry `base_pieces` takes. Each table's `creatable`
and `writable` are its columns in the table above ("What an app's role
needs"), listed in full: `appGrants` in `manifest.json` holds them, and
`ownSetUp(app, table)`, `ownSettings()` and `ownDesigns(app, false)` in
`src/manifest/app-grants.ts` write each entry out.

- **Its own rows.** A new row is tagged with the app's own key, and the role
  reads, changes and removes only rows tagged with it. With Maker Shop and
  Print Shop on one install, neither owner sees or changes the other's
  bases, designs, fonts or finishes, nor makes a row for the other.
- **The starter fonts.** They are the install's and no app's (their `app`
  is empty, which a value limit cannot name), so the fonts' read and change
  reach adds `starter`: every owner reads them, and its set-up adds their
  files, but none removes one. `starter` itself is no app's to change, and a
  font an app adds is never a starter (`creatableValues`), so no owner makes
  its own font reachable by the other, nor takes a starter out of reach.
  Adminium's limits give one `writable` list a grant, not one a reach: on a
  starter font an owner may change what it may change on its own fonts
  (its name, its file, whether it is offered), never `app` or `starter`.
- **The settings** are one row for the whole install: either owner keeps the
  one-colour line, for every shop app on it.
- **A customer's design** is read only of the app's own customers (`designs`
  with `rows.read`), as on the panel.

The read of `designs` is what lets the page remove a ready-made design: it
first asks whether a customer's design came from it. That is eleven of a
role's 24 add-on tables; a role that also makes proofs takes `designs` with
`read_pii` and adds `design_versions` and `version_files` (thirteen). The first time
such a role opens the set-up, the page adds the starter fonts' files into
their rows, so a shopper's editor can load them; a role that may not change
the fonts sees "Add the starter fonts" instead.

The Customiser's own **designer** and **reader** roles hold the same and more
(the designer also sets up the shop's side), for a person who works in the
dashboard rather than in an app's screens. They reach every app's rows.

## Sample data

Each shop app ships its own sample for the Customiser, taken from
`seeds/maker.sample.json` (Birch Row) and `seeds/printing.sample.json`
(Marlow Press).
