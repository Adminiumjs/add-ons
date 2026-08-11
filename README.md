# Adminium add-ons

One repository, one shared host contract, and every add-on written against it.

```
packages/host/            the ONE mirror of the host seam + the contracts
packages/design-studio/   Design Studio   — artwork-source@1, connects to nothing
packages/shipping-dhl/    DHL Shipping    — shipping-carrier@1, api-key
packages/import-canva/    Canva Import    — artwork-source@1, oauth2
packages/personalizer/    Live Personalizer — product-personalizer@1, connects to nothing
scripts/sync-to-host.sh   vendor the client halves into a host app checkout
```

## One test runner, one version

Hoisting the dev dependencies to the root had a side effect worth naming: `design-studio`
and `import-canva` each pinned `vitest@^2.1.9` as standalone repos, and the shared root
resolves `^3.2.4`. All 461 migrated tests pass unchanged on v3, so nothing broke — but a
major version of the test runner changed because of where a file moved, which is exactly
the class of thing a monorepo should make visible rather than silent. It is pinned once,
here, and every package now runs the same runner. That is the point of the consolidation:
the version is a decision taken in one place instead of three that drift.

## What an add-on is

An add-on is a package a host application loads to add a surface it did not have
— a way to send artwork, a way to book a collection. It is optional by
construction: the host renders the slot whether or not anything fills it, and it
does not know which add-ons exist.

Four things make one:

- **`manifest.json`** — `kind: "add-on"`. What it attaches to, which contracts
  it provides, which slots it fills, what it may reach on the network, which of
  its settings are non-secret. Every entry-point path in it is relative to the
  **package root**, because the package directory is what a host installs.
- **`register(): AddOn`** — one function returning one plain object. No side
  effects at import time, no global registration, no reaching into the host: the
  host asks, the add-on answers, and everything needed to draw a shelf row, a
  connect dialog and its surfaces is in the value that comes back. Its strings
  in all eight locales travel on that object too.
- **Slot fills** — a `render(payload)` per slot, from the closed registry in
  `packages/host/src/slots.ts`. Never invent an id.
- **A contract implementation** — a pure engine behind `artwork-source@1` or
  `shipping-carrier@1`, which runs the shared conformance suite. **The suite is
  part of the contract, not a courtesy**: two add-ons sharing no code fill one
  slot, and that claim rests entirely on both running the same assertions.

## Why `packages/host` exists, and why it is one file per shape

`packages/host` is a **mirror** of two things this repository cannot import: the
host app's own `src/add-ons/{host,slots}.ts`, and the closed contract registry in
`@adminium/add-on-contracts`. Both live in repositories this one cannot depend
on — the host app is published standalone to the Adminiumjs org, the contracts
package is not on npm. So the shapes are restated here.

They used to be restated **three times**. Each add-on shipped as its own
repository with its own copy, and each copy carried only the members that add-on
happened to use. Within a day of shipping they disagreed: `demoSwitch` existed
in one, `account` in another, `proofsArtwork` in a third, `nameKey` and `inDemo`
in none. Adding a field to the host meant three repositories each having to
notice independently. Nothing failed, and nothing could have — no suite anywhere
had both sides in front of it.

Now there is one mirror, and a suite watching it:
`packages/host/src/host-mirror.test.ts` reads BOTH host apps' own sources —
`print-shop` and `maker-shop` — and
fails when a member the host declares is missing here. It checks host ⊆ mirror
rather than equality — the host is authoritative, and this repository may carry
a member one particular host has not adopted yet. It **skips with a clear
message** when no host checkout is beside this one, so a clean clone of this
repository alone builds and tests green.

Point it somewhere else with `ADMINIUM_PRINT_SHOP=/path/to/print-shop`.

### And a second suite, because the mirror guard has a blind side

`host-mirror.test.ts` answers *has a copy drifted*. It cannot answer *is anyone
reading it*, and that is the way this failure actually recurred. When
`testing/purity.ts` became one file, the repair reached the shared contract and
the two hosts and stopped: all four add-on packages went on running the private
regular expressions they already had, none of them checked
`crypto.getRandomValues`, and there was no second copy of the file for any guard
to find a difference in. `crypto.getRandomValues` appended to the personalizer's
template engine left that package at 157 of 157 green.

`packages/host/src/shared-rule.test.ts` asks the other question of every package
and every checked-out host: does it **call** the shared rule, and does it state
that rule **anywhere else**. The four packages reach the rule through the
workspace — one file, no copy — while each host vendors and mirrors its own,
because a host is a standalone app published from a clean clone with no sibling
checkout. Both halves are in that file's header.

### What is shared, and what stays with an add-on

**The rule this section used to state was wrong, and the correction is the whole
of 24 D21.** It read:

> ~~A type the add-on **constructs and hands back** must match the host exactly,
> so it is shared. A type the add-on **only reads** may be narrowed, so it lives
> with the add-on.~~

That is sound about *ownership* and silent about *shape*, and the shape is what a
second host changes. Every add-on duly wrote down "the fields I read", which in
practice was "the fields the one host I was built against happened to send":
`SampleJob` carried `trimWidthMm` and `packagingKey` — a print works' job record
under a general name — and the personalizer read `payload.line.productKey`, a
maker studio's basket line, equally particular in the other direction. Wired into
a second host by registration alone, everything compiled and three components
threw. The rule in force now:

> **A slot id names a SURFACE.** Its payload is the smallest shape *every* host
> of that surface can honestly produce, it is declared once in
> `packages/host/src/payloads.ts`, and **each host maps its own records into it
> at the mount site**. A field only some hosts have is optional, and the add-on
> handles its absence in words on screen.

| Shared (`packages/host`) | With the add-on |
|---|---|
| `AddOn`, `AddOnFill<S>`, `AnyAddOnFill`, `AddOnSetting`, `AddOnSettingValues`, `Permission`, `ActivityEntry`, `DemoSwitch` | each package's `FILLED_SLOTS` — its own narrowing, `satisfies readonly SlotId[]` |
| **every slot payload**, one per id, in `payloads.ts` — `ArtworkSlotPayload`, `CheckoutPayload`, `DispatchPayload`, `SettingsPanelPayload`, `PersonalizePayload`, `CartLinePayload`, `ProductAdminPayload`, `OrderLinePayload`, `RoutePayload`, `RecordEditorPayload` | each package's own engines, seed data and settings shape |
| the neutral vocabulary they are built from — `SlotItem`, `OutboundOrder`, `PostalAddress`, `Party`, `Money`, `Dimensions`, `HostProduct`, `LineOrder`, `CatalogueSample`, `ShopClock` | `LabelStore` (`shipping-dhl`) — explicitly *not* part of `shipping-carrier@1` |
| `PayloadFor<S>` + `SlotPayloads`, so a fill's `render` is typed by the id it names | |
| `AddOnCategory`, `ConnectKind` — closed vocabularies | |
| `HOSTED_SLOTS`, `SlotId`, `SLOT_FILL`, `SLOT_EMPTY_BEHAVIOUR` | |
| `createRegistry`, `defaultSettingsFor`, `applyAddOnSettings`, `isConnectable` | |
| `DeliveryChoice` — built by a fill, stored by the host, handed back down | |
| `artwork-source@1` and `shipping-carrier@1` types + `CarrierError` | |
| both conformance suites and their Zod validators, under `/testing` | |

An add-on may still **narrow** what it reads — `render` is contravariant in its
payload — but it now narrows against a shape both hosts promise rather than
against one host's memory. The check bites in both directions: a host passing the
wrong record is red in the **host's** repo, an add-on reading a field the surface
does not carry is red in the **add-on's**.

`shipping-dhl/src/host-payloads.ts` is gone; so is every per-add-on copy of a
payload. `packages/host/src/host-mirror.test.ts` lists every shape above and
fails when either host declares a member this mirror has not heard of.

`zod` is behind the separate `@adminium/add-on-host/testing` entry point and
nothing under the other two entry points imports it, so no add-on's `dist/` can
reach it. **An add-on takes no runtime dependency the host does not already
have** (24 D7): React, its DOM renderer and `lucide-react`, all `external`.

## Commands

One `npm install` at the root covers every package. Every script fans out, so
"change one thing across all add-ons" is one command:

```sh
npm install
npm run typecheck    # tsc -b in every package
npm test             # vitest run in every package
npm run build        # tsc -b && vite build in every package
npm run verify       # all three, in that order
```

Each package runs the same three scripts on its own if you `cd` into it.

## Adding a new add-on

1. `mkdir packages/<key>` and copy the nearest existing add-on's shape. The
   package name is `@adminium/add-on-<key>`; the directory name, the manifest
   `key` and the add-on's own machine key are all the same string.
2. `package.json`: `peerDependencies` for React and `lucide-react` (the host has
   them), `devDependencies: { "@adminium/add-on-host": "*" }`, and the three
   scripts. Nothing else — shared tooling lives in the root `package.json` so
   there is one version of TypeScript, Vite, vitest and zod across the repo.
3. `tsconfig.app.json` and `tsconfig.node.json` extend `../../tsconfig.base.json`
   and set `include` and nothing else.
4. `src/slots.ts`: the slots it fills, `as const satisfies readonly SlotId[]`. A
   typo is a compile error, and so is a slot the host stops hosting.
5. `src/index.ts`: `register(): AddOn`, importing the seam from
   `@adminium/add-on-host`. Every payload type it only reads gets narrowed in
   its own module, next to the engine that reads it.
6. Implement a contract and run the shared suite from
   `@adminium/add-on-host/testing`. If it cannot pass, the implementation is
   wrong — do not soften an assertion.
7. `manifest.json`, with entry points relative to the **package root**, and a
   `manifest.test.ts` asserting that every path it names is a file the build
   actually emits and that its slots are exactly `FILLED_SLOTS`.
8. Add its section to the root `TRADEMARKS.md` — including if it names no
   company, which is a section that says so.

`npm install` at the root picks it up; every root script then includes it.

## The rules that bind every package in here

- **No real company logo**, drawn, redrawn, traced, approximated or embedded,
  anywhere. Monogram tiles only. See `TRADEMARKS.md`.
- **No real third-party call in any demo**, and every simulated result labelled
  as one on screen.
- **Secrets never in a client half.** The credentialled module is a separate
  bundle a browser never loads, and each package's `sources.test.ts` proves it
  at every depth of the import graph.
- **Pure deterministic engines**: no `Date.now()`, no `Math.random()`, no
  `fetch`. A demo pinned to a fixed clock looks the same a year from now.
- **CSS logical properties only.** Arabic renders right-to-left with no RTL
  stylesheet, so a physical `left` is a bug exactly one of eight locales shows.
- **The vocabulary ban**, as a case-insensitive **substring** over user-visible
  copy in all eight locales *and* over built output. Two words for a paid grade
  of a product are banned as standalone-token concepts as well, in each
  language's own spelling — this paragraph does not print either of them,
  because the ban is a substring ban and a document describing it must not be
  the first thing the release grep finds. `testing/lexicon.ts` in each package
  is the list, with a named reason beside every carve-out; each package greps
  its own `dist/`.

## Licence

AGPL-3.0-only. One `LICENSE` at the root covers every package.
