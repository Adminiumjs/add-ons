# Design Studio

A small artwork editor that runs inside a print shop's own site. The customer
picks a starting layout, edits on a canvas drawn at exactly the finished size
with the bleed and safe-area guides on it, and sends the result into the order
**with the bleed correct by construction** — which is why the works' own artwork
checks pass on its output instead of arguing with it.

It is deliberately small: text, images, simple shapes, guides and layers. The
editor says so in its own words, under the canvas:

> This is a simple editor for straightforward jobs — for complex artwork, send a
> print-ready PDF.

## What it attaches to

An **add-on**, not an app: it cannot stand on its own, because it has nothing to
attach a design to. It attaches to **Print Shop** (`printing ^1.0.0`) and fills
two of the host's slots:

| Slot | What appears |
|---|---|
| `artwork.sources` (order 10) | the "Design it here" action tile on the artwork screen |
| `settings.add-on.panel` (order 10) | the shop's own settings form — starting layouts, and whether a design still needs a proof |

The settings form is **rendered here, not by the host**, and that includes the
sentence under each control. A host cannot write "The works checks it like any
other job before it goes on a press" from a `{ key, kind }` schema, and a host
that hard-codes it is a host that has to be edited to add a fourth add-on.

With the add-on switched off, the host renders its own honest empty state
("More ways to send artwork") and nothing here leaves a trace — no orphan
button, no dead link, no placeholder. That is the point of the slot design (24
D6): the add-on is optional, not the way the app was always going to work.

It implements the **`artwork-source@1`** contract and runs that contract's
conformance suite against itself (`src/artworkSource.test.ts`). The host — never
this add-on — runs the artwork checks on what comes back, so no implementation
marks its own homework.

## What it brings

One table, `artwork_designs`: id, job fk, product, width/height/bleed in
millimetres, the document as JSON, a preview file, and timestamps.
**Disconnecting keeps it** (24 D16). Disconnect removes the surfaces and stops
the add-on; it does not drop the table, delete the files or strip anything from
the shop's own records. A customer's saved designs outlive the add-on being
switched off, and the confirm dialog says so.

## The transport, and why there isn't one

Every add-on in this wave ships a deterministic **demo transport** so that no
demo makes a real third-party call (24 D11). **This one has nothing to
simulate.** It calls no API, contacts no company, needs no account and declares
no `network.allow` — `connect` is `none` and connecting is one click. There is
no `Date.now()`, no `Math.random()` and no `fetch` anywhere in `src/`:

- **File ids are content-derived.** `fileIdFor()` is an FNV-1a hash over a
  canonical serialization of the document, so exporting the same design twice
  gives the same file id and two runs of the demo agree.
- **The clock is an argument.** `toDesignRecord(doc, { nowIso })` takes the time
  rather than reading it. The demo's pinned clock is Wednesday 5 August 2026,
  10:20, and the engine never has an opinion about that.
- **Layer ids come from the document**, not from a counter living outside it.

## The engine

`src/doc.ts` is pure, deterministic and has no imports from React or the DOM.

- a millimetre-based document: `{ widthMm, heightMm, bleedMm, safeMm, sides, layers[] }`
- exactly three layer kinds — **text, image, shape** — and no more
- hit-testing (an ellipse is tested against the ellipse; a hairline rule is
  padded so it can be picked up) and selection
- a **snap solver**: object edges, object centres, the page centre and the three
  guides, at 0.5mm tolerance at 100% zoom **divided by the zoom** so the felt
  tolerance on screen stays constant
- align to the page, spread across/down, and z-order
- a **bounded undo stack**: 50 steps, and a whole drag is ONE step — sixty
  pointer samples coalesce through one token, and `endGesture()` on pointer-up
  starts the next one
- `outsideSafeArea(doc)` — the layers a customer should be warned about, with
  deliberate full-bleed backgrounds excluded, because a warning that fires on
  every design teaches people to ignore warnings
- `toArtworkRef(doc)` — the print payload at 300dpi whose `bleedMm` is 3 **by
  construction**, because the bleed is a property of the document the customer
  has been editing rather than a number computed at export time

`src/doc.test.ts` runs the **host's own `checkArtwork()`** against this
engine's output for all six starting layouts and asserts that every verdict
passes. That check is copied into the test file rather than imported — the note
at the top of the file says why, and what copying costs.

## Package layout

```
manifest.json          kind: "add-on", validated by @adminium/manifest
src/slots.ts           the slots this add-on fills, checked against SlotId
src/doc.ts             the engine        (+ doc.test.ts)
src/layouts.ts         six starting layouts, twelve swatches, the font list
src/artworkSource.ts   the contract implementation (+ its conformance run)
src/hostJob.ts         the slot payload → JobSpec
src/i18n/strings.ts    every user-visible string, in all eight locales
src/testing/           this package's build + vocabulary-ban helpers
src/ui/                the editor, the picker, the inspector, the slot fills
src/index.ts           register(): AddOn
dev/                   a local harness standing in for the host (not shipped)
```

`dev/` is a small page carrying the host's tokens and an artwork panel, so the
editor can be looked at in the colours it inherits and in all eight locales
without checking out the print shop. It has its own Vite config; `vite build`
only ever sees `src/index.ts`.

The contract types, the host's `AddOn` interface and the conformance suite are
**not here**. They used to be — three add-ons, three copies, drifting — and they
now live once, in `packages/host`, imported as `@adminium/add-on-host`. That
package is still a *mirror* rather than a dependency on the real thing, for the
reason its header gives: this repo is published standalone to the Adminiumjs org
and `@adminium/add-on-contracts` is not on npm yet. What changed is that there
is one mirror instead of three, and a suite watching it.

What is still copied here and belongs here: the works' preset sizes
(`hostJob.ts`) and the host's own `checkArtwork()` (`doc.test.ts`). Each carries
a header saying so and what the copy costs.

## Build and test

Run these from this directory, or from the monorepo root to fan them out across
every add-on at once:

```sh
npm install          # at the monorepo root, once, for every package
npm run typecheck    # tsc -b
npm test             # vitest run
npm run build        # tsc -b && vite build
npm run dev          # the harness in dev/, on :5199
```

The build writes exactly three files, and `manifest.json` names two of them:

| File | Named by | What it is |
|---|---|---|
| `dist/client.js` | every `addOn.slots[].client` | the client half — both slot fills in one bundle |
| `dist/client.css` | *(nothing — the slot schema has no stylesheet field)* | its stylesheet, served beside it |
| `dist/server.js` | `addOn.provides[0].server` | the server half — engine + `artwork-source@1`, no React |

Every path a manifest field names is written **relative to the package root**,
`dist/` and all — the package directory is what a host installs. It is the same
convention `shipping-dhl` and `import-canva` use, so a host resolving an entry
point never has to know which add-on wrote it. `manifest.test.ts` asserts the prefix and asserts that both
paths are files the build actually emitted; `built-output.test.ts` asserts the
emitted list exactly, including that **no sourcemap** is written — a `.map`
would put every source file, comments and all, into the published artefact.

The client half builds to a single ESM bundle with React, the JSX runtime and
`lucide-react` external, because the host already has all three (24 D7): the
host serves it from its own origin at `/add-ons/design-studio/client.js` and
`import()`s it lazily (§5.7 item 2), which is why both slots point at one
file rather than at a file each. The server half is a **separate rollup pass**
for a reason worth knowing before anyone tidies it into one — two entries in a
single lib build share their common modules through a third, hash-named chunk,
and the client half then stops being the single bundle D7 requires.

This add-on takes **no runtime dependency the host does not already carry**;
`zod` appears in devDependencies only, reached only by the conformance suite, and
never in the shipped bundle.

`src/built-output.test.ts` builds the repo and asserts all of the above against
what actually landed in `dist/`: that every path the manifest names exists, that
no fourth file appeared, that the server half contains no renderer, and that the
built bytes carry none of the banned vocabulary. `src/sources.test.ts` checks the
same rules a build earlier, where a failure can name the file that broke them.

## Trademarks

This add-on names no company and connects to nothing. See [TRADEMARKS.md](../../TRADEMARKS.md).

## Licence

AGPL-3.0-only. See [LICENSE](LICENSE).
