# Canva Import

An **add-on** for [Print Shop](https://github.com/Adminiumjs/print-shop), the Adminium example
app for a print works. It lets a customer bring in a design they made somewhere else instead of
uploading a file: connect the account, pick the design, import it — and then **run the same
artwork checks the upload path runs**.

It is the second implementation of the `artwork-source@1` contract (Design Studio is the first),
and it exists as much to prove the contract as to serve the use case. The two add-ons share no
code. Both pass the same conformance suite. **The host runs the checks**, so neither
implementation marks its own homework — and that asymmetry is the demo: an artwork editor built at
the finished size passes by construction, while a design made in a general-purpose tool routinely
arrives without bleed.

Adminium is not affiliated with the company named here. See [TRADEMARKS.md](../../TRADEMARKS.md).

---

## What it attaches to

| | |
|---|---|
| Manifest kind | `add-on` |
| Key | `import-canva` |
| Attaches to | `printing ^1.0.0` |
| Category | `artwork` |
| Provides | `artwork-source@1` |
| Fills | `artwork.sources`, order **20** — behind Design Studio's 10, because the shop's own editor leads |
| Connect | `oauth2` (authorization code + PKCE, **run by the host**) |
| Capabilities | `oauth-connect`, `outbound-http`, `file-storage` |
| Scopes | `records:jobs:read`, `files:write` |
| Egress allow-list | `api.canva.com` and nothing else |
| Settings | none — there is nothing to configure beyond the account, so the manage panel renders no form rather than an empty one |

Removing it returns the app to its base state: the artwork screen's "More ways to send artwork"
panel goes back to its honest empty state, and no orphan button is left behind. Designs already
imported into an order **stay** (24 D16).

## The demo transport — no third-party call, ever

This repo makes **no network request to anybody**. `src/demo/transport.ts` answers from four
seeded designs, and every date and file id in it is derived from the **pinned clock**
(Wednesday 5 August 2026, 10:20) that `src/index.ts` mirrors from the host. There is no
`Date.now()` and no `Math.random()` anywhere in the repo, so two visitors a month apart see the
same account with the same designs edited on the same days. Wherever the flow shows a result that
came from the fixture, it says so on screen.

| Design | Size | Bleed | Outcome against a business-card job |
|---|---|---|---|
| Harbour Bakery — loyalty card | 85 × 55 mm | none | **blocked** — this is the one the demo imports |
| Two Rivers Cycles — service card | 91 × 61 mm | 3 mm | passes, so the flow is not only its failure case |
| Bramble Yoga — class timetable | 154 × 216 mm | 3 mm | a different size: warned, not blocked |
| The Little Gallery — private view | 154 × 216 mm | 3 mm | 220 dpi, two pages |

### The worked case

An 85 × 55 mm design against an 85 × 55 mm trim needs **91 × 61 mm** with the works' 3 mm of
bleed on every edge. `src/import.ts` computes the two honest ways out and both carry their
numbers:

- **Scale to cover** `max(91/85, 61/55) = 1.109`, i.e. **+10.9%**. The height is the binding axis,
  so the width overshoots to **94.3 mm** and about **1.6 mm** is trimmed from **each** of the left
  and right edges beyond the bleed. Applying it re-runs the checks, which pass — at 270 dpi
  instead of 300, and the ref carries that cost rather than hiding it.
- **Fix it in Canva and import again**, with the plain instruction: set the design size to
  91 × 61 mm and let the background run to the edge.

Every one of those figures is asserted in `src/import.test.ts`. The scale remedy is offered only
when scaling actually fixes the file — a design with no headroom on resolution gets the second
remedy alone, because a button that promises a pass it cannot deliver is worse than no button.

## OAuth: what this repo declares, and what it does not implement

**The host runs the flow** (24 §5.6). This add-on declares an authorize URL, a token URL and its
scopes; the host performs the authorization-code exchange with PKCE, stores and refreshes the
tokens, and hands back an already-authorized HTTP client. There is **no client secret in this
repo**, no token endpoint call and no refresh timer — and there must never be one.

### Endpoints and scopes — NOT YET VERIFIED

| | Value in this repo | Status |
|---|---|---|
| Authorize URL | `https://www.canva.com/api/oauth/authorize` | **not read from the vendor's documentation** |
| Token URL | `https://api.canva.com/rest/v1/oauth/token` | **not read from the vendor's documentation** |
| API hostname | `api.canva.com` | **not read from the vendor's documentation** |
| Scopes | `design:meta:read`, `design:content:read` | **not read from the vendor's documentation** |
| Date read | — | **never — nobody has read them yet** |

Read them from the vendor's current developer documentation (start at <https://www.canva.dev/>)
before this add-on connects to anything real, then replace the table above with the values and
**the date you read them**. Until that happens the constants live in `src/oauth.ts` marked
`verified: false`, nothing calls them, and the demo transport answers every request from a
fixture — so a wrong endpoint here cannot produce a wrong request, only a wrong document.

**The rule that outranks convenience when they are read:** if the vendor's real scope vocabulary
cannot be narrowed to *list the designs* plus *export the one chosen*, that is a finding to bring
back — **not** a scope to widen quietly. The consent panel promises the customer two things and
nothing else, and a third scope arriving without the panel changing is how a permission list
becomes a lie.

**Vendor terms.** Anyone enabling a real connection must read and accept the vendor's own
developer/API terms, published at <https://www.canva.com/policies/>. Nothing in this repo grants
any right in the vendor's API, brand or content.

## Manifest paths

The build emits two bundles, named relative to the package root (the directory a host installs) — the same convention the other
wave-4 add-ons use, so a reader who has seen one add-on's `dist/` knows where to look in the next:

| Manifest field | File | What it holds |
|---|---|---|
| `addOn.slots[].client` | `dist/client.js` | both slot fills, the React half — plus `dist/client.css` |
| `addOn.provides[].server` | `dist/server.js` | the `artwork-source@1` implementation |
| `addOn.demoTransport` | `dist/server.js` | the four seeded designs (24 D11) |

`vite.config.ts` exports those two names as `OUTPUT` and the build writes exactly them, so the
manifest and the build cannot drift into a manifest that validates and then fails to load.

The split is real rather than a naming convention: `dist/server.js` imports no renderer, reads no
DOM it has not guarded, and is loaded and exercised under Node by the test suite — which is why
`src/i18n/t.ts` (the translator) and `src/i18n/useT.ts` (its hooks) are two files rather than one.
The vendor's authorize URL, token URL and API hostname live in the server half and the manifest
only: the host runs the OAuth flow (24 §5.6), so a page has no use for them, and
`src/built-output.test.ts` asserts none of the three reaches `dist/client.js`.
`src/manifest.test.ts` asserts that every path above exists in the build output — so a manifest
that names a file the build stopped producing fails here rather than on someone else's install.

## What the host passes, and what it does not

The Print Shop's artwork screen passes the configured job plus `onArtwork`, which is what carries
an imported design back onto the order. `src/job.ts` still types it optional, and deliberately: an
add-on that reached into the host's store to place a file would have stopped being optional, so
the way back has to be given rather than taken.

Two slots are filled here — `artwork.sources` (order 20, behind the shop's own editor at 10) and
`settings.add-on.panel`. The second one is a panel about not having any settings: this add-on's
whole configuration is the account, and it says so in its own words. The host used to say it, in a
branch that tested `addOn.key === "import-canva"`; an add-on with nothing to set still gets to
describe itself.

## Build, test, typecheck

```sh
npm install
npm run typecheck   # tsc -b
npm test            # vitest run — engine, transport, i18n parity, conformance,
                    #              source guards, and a lexicon grep over the BUILT output
npm run build       # tsc -b && vite build → dist/client/ + dist/server/
```

`npm test` runs `describeArtworkSource` — the conformance suite copied verbatim from
`@adminium/add-on-contracts/testing` — against this implementation. The claim that a second
`artwork-source` is a copy of the first rests entirely on both repos running that same suite, so
its assertions are not to be edited to suit an implementation.

## Layout

```
src/
  slots.ts            the slots this add-on fills, checked against SlotId
  import.ts           the engine: required size, cover scale, verdicts, both remedies
  job.ts              host payload → JobSpec; the copied preset table and the works' constants
  oauth.ts            what is declared, what is never implemented, and what is unverified
  source.ts           the ArtworkSource implementation
  demo/transport.ts   four seeded designs, clock-derived, no network
  i18n/               every string in all eight locales; t.ts translates, useT.ts is its hooks
  client/             the tile, the three-step flow, the consent panel, the stylesheet
  sources.test.ts     the absence guards: no call, no clock, no secret, no physical CSS
  built-output.test.ts the release lexicon grep, run against dist/ rather than src/
  testing/            the copied conformance suite, and the dist/ reader those two tests share
```

## Licence

AGPL-3.0-only, as with everything in the Adminium marketplace.
