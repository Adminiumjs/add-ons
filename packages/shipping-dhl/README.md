# DHL Shipping — an Adminium add-on

One delivery company, implemented so that the second one is a copy.

The works fills a parcel from the job, fetches rates, books a collection, and gets back a tracking
reference and a label. That is the whole of it.

**Scope boundary, and it is a hard line.** This books parcel collections with a carrier. It is
**not** job dispatch, **not** field-service routing and **not** driver management, and it gains none
of those screens even as an empty state.

## What it attaches to

An add-on never stands alone. This one attaches to the `printing` app (`^1.0.0`) and fills four of
its slots:

| Slot | Surface | What appears |
|---|---|---|
| `order.dispatch.actions` | staff | "Book a collection" and the whole dispatch flow behind it |
| `checkout.delivery.methods` | customer | selectable rate rows with prices and delivery dates |
| `order.dispatch.panel` | customer | a read-only tracking view |
| `settings.add-on.panel` | admin | the demo switch, the collection cut-off, and the default parcel weights |

The **default parcel weights belong here**, and that is not a detail. The host
knows its own catalogue and passes one representative job per product family; it
does not know what any of them weighs, because weight is a property of the
carrier's own arithmetic. The host used to compute that table by importing
`parcel.ts` from this repo — a print shop that imported one delivery company's
weight engine into its own chrome, which is exactly what the app claims not to
do. The settings form and every sentence in it are rendered here too.

It provides `shipping-carrier@1`. The contract is not print-specific, so once a second app hosts
those slots the correct `attaches` value is `"*"`.

Switch the add-on off and all three surfaces disappear, leaving the app's own words behind — "no
delivery companies are connected" at checkout, "collection from the works" on the customer's order.
The shipment history stays: disconnecting removes surfaces and credentials, never data.

## The two transports

Both satisfy the same contract, and both run the same conformance suite. That is the entire basis
for the claim at the top of this file.

### `src/demo-carrier.ts` — the default

Deterministic, seeded from a pinned clock of **Wednesday 5 August 2026, 10:20**. No network, no
`Date.now()`, no `Math.random()`. It prices three services from the parcel's chargeable weight and
the route's zone, delivers on the next and second working day, mints tracking references from a
seeded counter starting at `00 3400 1234 5678 9012`, generates a real one-page PDF label, and
returns three tracking events.

Wherever a real shipment would have been created the UI says one was not: *"Demo carrier — no real
shipment was booked."*

**One seeded destination is refused**, so the failure path is demonstrable rather than theoretical.
It is refused by a rule, not by a flag — the carrier checks a postcode against its destination
country, and one seeded address is an Irish address carrying a British postcode. It surfaces as a
typed `CarrierError` carrying the carrier's own words verbatim, *"Postcode not recognised for the
destination country"*, and fixing the postcode in the dispatch screen makes the retry genuinely
succeed.

A live demo that posted to a real carrier on every visitor click would be a defect, not a feature.

### `src/carrier.ts` — the real one, for self-hosting

Targets DHL's published Express API through an HTTP client the host injects and binds to the single
hostname in the manifest's `addOn.network.allow`. Add-on code never receives raw `fetch`.

**This repo pins no live call, and the endpoint paths, authentication header and field names in it
are NOT verified.** They are gathered in one `WIRE` constant in `src/carrier.ts`, every one of them
marked `TODO(vendor-docs)`, and they must be read from the vendor's current documentation at
implementation time.

| | |
|---|---|
| Vendor API documentation | <https://developer.dhl.com/api-catalog> |
| API terms | <https://developer.dhl.com/terms-conditions> |
| Endpoints read on | **NOT YET READ — fill in this date in the same commit that pins `WIRE`** |

When you pin them: replace the placeholders in `WIRE`, put the date above, and flip the
`wireIsPinned()` assertion in `src/carrier.test.ts` from `false` to `true`. All three belong in one
commit, because a pinned endpoint with no recorded date is a guess with a timestamp missing.

What *is* finished in that module, and is tested: request construction, the auth header's shape,
response mapping into the contract's types, error mapping into `CarrierError` with the carrier's own
message verbatim and a retryability derived from the status, `book` idempotency, and `track`'s
"unknown reference is an empty list" rule. No wire object escapes the module.

Real credentials are a self-host path and are off by default. `api_key` and `account_number` are
manifest settings marked `secret: true`: encrypted at rest, redacted in every response, injected
only into the server context. Nothing under `src/ui/` may read them, and a test greps for it.

## Conformance

```
npm install
npx tsc -b
npx vitest run
```

`describeShippingCarrier` — copied verbatim from `@adminium/add-on-contracts/testing` — runs against
**both** transports. The real one is driven through an injected HTTP fake, offline, and the fake
builds its responses from the same `WIRE` constant the module reads them with, so the test cannot
drift from the module by keeping its own copy of a field name.

A `shipping-ups` or `shipping-royal-mail` repo is this repo with `carrier.ts` replaced and nothing
in `printing` touched. The suite passing on both transports is what makes that sentence true rather
than hopeful.

## What it brings

Two tables, kept when the add-on is disconnected:

- `shipments` — id, job, carrier, service, tracking, label file, amount, currency, collection
  window, status, created at
- `shipment_events` — id, shipment, at, place, status, description

## Package notes

The contract types and the host's `AddOn` interface are **imported** from
`@adminium/add-on-host` — `packages/host`, one directory over. That package is
itself a *mirror* of `@adminium/add-on-contracts` and of the print shop's own
`src/add-ons/`, copied rather than imported for the same reason `tokens.css` and
`locales.ts` are copied in the example apps: this repo is published standalone to
the Adminiumjs org and the package is not yet on npm. When it is published,
delete the mirror and import the types. Do not change a shape in it to make
local code compile.

This add-on used to carry its own copy of both files, and so did the other two.
`packages/host/src/host-mirror.test.ts` now reads the print shop's own source and
fails when the one remaining mirror falls behind it.

What stays here rather than in the shared package: `src/host-payloads.ts` — the
job and basket records the host hands this add-on's fills, narrowed to the fields
it reads — and `src/label-store.ts`, which the contract deliberately does not
carry. A type this add-on constructs and hands back to the host is shared; a type
it only reads is its own.

`src/i18n/strings.ts` carries every user-visible string in all eight locales — en-US, de-DE, fr-FR,
cs-CZ, da-DK, zh-CN, zh-TW, ar-EG — with parity enforced at compile time. Arabic renders
right-to-left with no RTL stylesheet, so every style in this repo uses CSS logical properties; a
physical `left` is a bug, and a test greps for that too.

## Build output

`npm run build` writes exactly two files, and they are the two `manifest.json` names:

- `dist/client.js` — the client half, built from `src/index.ts`: the four slot fills, the strings,
  the settings seam and the demo transport. A single self-contained ESM bundle (24 D7), with React
  and `lucide-react` external because the host already has them.
- `dist/server.js` — the server half, built from `src/server.ts`: the real transport, the HTTP
  client seam and the credential types. It never reaches a browser (24 D15).

Both paths in `manifest.json` are **relative to this repository's root** — the directory a host
clones and the directory `manifest.json` itself sits in — so `dist/client.js` resolves with no
context about what the build's output directory happens to be called. `manifest.test.ts` asserts
every declared entry point resolves that way onto a file that exists.

**No sourcemaps.** `dist/` is the published artefact, not a debugging session: a `.map` carries a
verbatim copy of every source file, comments included, which triples the artefact and puts the
repo's own prose into the bytes the release sweep reads. The sources are public under AGPL-3.0
anyway. `dist.test.ts` greps every file in `dist/` with no extension filter, and fails if a `.map`
appears at all.

Two Vite runs rather than one build with two entries, because two entries in one run share their
common modules through a generated chunk — and a client bundle that imports a sibling file the
manifest does not name is a client bundle the host cannot load. `manifest.test.ts` asserts the
manifest names these two paths and nothing else; `dist.test.ts` builds the repo and asserts the
files exist, that the client half has no relative imports left in it, that no secret setting key or
carrier hostname appears in it, and that the built bytes are clean of the release sweep's word list.

## License

AGPL-3.0-only. The full text is in [`LICENSE`](LICENSE), and `package.json` and `manifest.json`
both declare it. See the repository-root `TRADEMARKS.md` for the marks this repo references and the affiliation it
disclaims.
