# Live Personalizer

The maker prepares a piece once — puts up its artwork and draws the areas a
customer may change, with their limits — and from then on a shopper types their
own words and watches them appear on the piece, at the right size, in the right
place, in the right finish. Out of the other end comes a machine-ready file with
the text already converted to outlines.

Add-on key `personalizer`, category **artwork**, `connect: { kind: "none" }`. It
connects to no outside company, needs no account anywhere, and makes no network
call of any kind — `src/sources.test.ts` greps for every form of one.

Provides **`product-personalizer@1`**. Attaches to `maker ^1.0.0`, and to the
generated dashboard's `products` and `order_lines` tables (24 D20).

It used to claim `printing ^1.0.0` as well. The contract is app-neutral and the
add-on would run there — but the print works mounts none of the surfaces this
add-on draws on, so the only slot the two have in common is the add-on's own
settings panel. An install would have given a shop a form for configuring a
feature with nowhere to happen, which is a promise to an installer rather than a
fill that harmlessly does not render. The claim is gone; the portability is not,
and the first app that hosts `product.options.personalize` gets it back.

## What is in here

| file | what it is |
|---|---|
| `src/faces.ts` | the five alphabets the studio cuts, and **the measured advance table** |
| `src/glyphs.ts` | the studio's own cut alphabet — skeletons offset to closed contours |
| `src/template.ts` | the engine: `fit`, `check`, `previewSvg`, `toProductionPaths` |
| `src/pieces.ts` | how big each piece is and what it is made of |
| `src/seed.ts` | the two pieces the studio has set up, and four sample personalizations |
| `src/personalizer.ts` | `product-personalizer@1`, implemented |
| `src/store.ts` | where a shopper's choices live between the piece's page and the basket |
| `src/ui/` | the six slot fills |
| `tools/measure-faces.html` | the page that produced the numbers in `faces.ts` |

## The metric table, and why it is a table

Comp L measures text with `document.createElement("canvas").getContext("2d")`.
**24 D5c overrules that**, and the reason is acceptance criterion 17 rather than
taste: canvas advances depend on the platform, on which fonts happen to be
installed, and on the browser's own fallback chain. A verdict measured that way
says "two characters more than fits" on one machine and "it fits" on the next,
the cart thumbnail and the proof stop being the same picture, and none of it is
reproducible headlessly.

So the numbers are committed. `tools/measure-faces.html` produced them — canvas
`measureText` at 1000 px for every printable ASCII character, plus cap height,
x-height and ink extents off `H`, `x` and `Hgjy` — run once in Chrome on macOS
on 2026-08-10. Open it, copy the JSON, replace the arrays.

**A committed table on a machine whose fonts differ still cannot lie.** The
preview does not ask the browser to lay the text out: every `<text>` it draws
carries `textLength` set to the width this table computed, with
`lengthAdjust="spacingAndGlyphs"`. The browser is told the answer. The
production file places each glyph from the same numbers, so the file and the
picture agree by construction rather than by luck.

## One picture, three surfaces

Criterion 17 says the cart thumbnail, **the proof** and the order line are the
same picture for the same values. Deterministic drawing is necessary for that
and is not sufficient, and this add-on shipped a release proving it: the engine
was perfectly deterministic while the basket drew the preview, the order line
opened the *production* file — a different picture, in the studio's cut alphabet
— and the proof drew the host's own material tile, because nothing had mounted a
slot there at all. Three correct pictures, three different pictures, every suite
green.

Two structures hold it now, and neither is a comment:

- **One renderer.** `Preview` in `ui/bits.tsx` calls `drawPreview`, which is
  `previewSvg` plus filing the bytes under their digest. Drawing a picture and
  filing it are one act, so the bytes on the screen cannot differ from the bytes
  behind the file id that travels on the order.
- **One set of options.** `widthPx` is written into the SVG string and hashed
  with it, so three surfaces each choosing their own width are three surfaces
  each able to break the criterion. `LinePicture` takes no options: the three
  that must match go through it and size themselves with CSS. The shopper's
  editing canvas is deliberately not one of the three — it draws larger, with
  guides.

  (Those two sentences were written with a word this repo bans as a substring,
  in a paragraph about keeping the bytes honest. The ban is checked over built
  output, and prose is built output here — see `testing/lexicon.ts`.)

`ui/surfaces.test.tsx` renders the actual fills through the actual payloads and
compares the strings. It was checked by mutation: reverting either structure
turns it red.

## Outlines, never a font

The production file is SVG paths and nothing else — no `<text>`, no
`font-family`, no `@font-face`, no font file (criterion 19). A file that named a
face would cut differently depending on what was installed on the machine that
opened it, which is the one thing this add-on exists to prevent.

Outlines need outlines. This package cannot lift them out of somebody's
typeface, so the studio has its own: a single-stroke skeleton per letter in
`glyphs.ts`, offset to a closed contour by the face's stroke weight. The
preview draws real type and the file carries the studio's alphabet, so the
letterforms differ — what does not differ is every pen position, because both
walk the same measured table. The production screen says so in one plain line
rather than leaving a reader to work it out.

## Every failing verdict carries a number

`fit()` returns either a fit or a typed overrun carrying **both** remedies with
their values: drop to N millimetres, or shorten to N characters. A bare "doesn't
fit" is a contract violation, not a UI choice (criterion 18), and the surface
renders each remedy as a button. Both numbers are computed by search rather than
estimated from a ratio — `template.test.ts` asserts that applying either one
makes the next `fit` pass, and that each is the *largest* size and the *longest*
prefix that work.

**A block is not a verdict.** An empty required area has no number to offer, so
it stops "Add to basket" with a plain reason instead of producing a verdict with
an empty `remedies`. That split is what lets criterion 18 be absolute.

## Phase B: the dashboard mount is declared and not built

`record.editor.panel` is the seventh slot in `manifest.json` and there is **no
fill for it in this bundle**. Its host is Adminium's generated dashboard rather
than an example app, and it needs the add-on runtime that `POST /manifests` does
not yet provide (24 §5.10, D20). Comp L designs those four screens and 24 §8B
specifies them.

Shipping a fill nothing can mount is the exact defect §5.4 records against
`nav.add-on.routes` — an add-on author reads the list and writes code to it — so
the manifest declares the attachment, the code ships nothing, and
`manifest.test.ts` asserts the difference **by name** rather than letting it look
like an oversight.

## What else was cut, and why

- **Drag-to-draw zones.** The set-up surface ships the contract's zone model
  through millimetre steppers rather than corner handles. A drag handle needs a
  pointer and the same panel mounts inside a dashboard record editor in Phase B,
  where the editor is a form; a millimetre is also what a maker measures with.
  Drag is a P1 addition on top of this, not a replacement for it.
- **Image and colour zones.** The contract carries all four kinds; this build
  renders the two text kinds, which is what 24 §8B's cutline says.
- **Curved text on a path, and per-angle independent values.** Same cutline.

## Running it

```
npm test        # 113 assertions, including the conformance suite
npm run build   # dist/client.js, dist/client.css, dist/server.js
npm run typecheck
```

The surfaces are seen in a host. `maker-shop` vendors this package through its
own `scripts/sync-add-ons.sh` and the demo dock carries a toggle, so a reviewer
watches the plain note field become a live preview and go back again.

## Trademarks

See [`../../TRADEMARKS.md`](../../TRADEMARKS.md). This add-on references no
company's marks, connects to no outside service, and needs no account anywhere —
which is what its detail surfaces say in place of a disclaimer it cannot
honestly make (24 AC6, as amended).
