# Adminium add-ons

One repository, one shared host contract, and every add-on written against it.

```
packages/host/            the ONE mirror of the host seam + the contracts
packages/design-studio/   Design Studio   — artwork-source@1, connects to nothing
packages/shipping-dhl/    DHL Shipping    — shipping-carrier@1, api-key
packages/import-canva/    Canva Import    — artwork-source@1, oauth2
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
`packages/host/src/host-mirror.test.ts` reads the host app's own source and
fails when a member the host declares is missing here. It checks host ⊆ mirror
rather than equality — the host is authoritative, and this repository may carry
a member one particular host has not adopted yet. It **skips with a clear
message** when no host checkout is beside this one, so a clean clone of this
repository alone builds and tests green.

Point it somewhere else with `ADMINIUM_PRINT_SHOP=/path/to/print-shop`.

### What is shared, and what stays with an add-on

The rule:

> A type the add-on **constructs and hands back** to the host must match the
> host exactly, so it is shared. A type the add-on **only reads** may be
> narrowed, so it lives with the add-on.

| Shared (`packages/host`) | With the add-on |
|---|---|
| `AddOn`, `AddOnFill`, `AddOnSetting`, `AddOnSettingValues`, `Permission`, `ActivityEntry`, `DemoSwitch`, `SampleJob`, `SlotPayload`, `SettingsPanelPayload` | `HostJob`, `DispatchPayload`, `HostBasketLine`, `CheckoutPayload` (`shipping-dhl/src/host-payloads.ts`) |
| `AddOnCategory`, `ConnectKind` — closed vocabularies | each artwork add-on's own `ArtworkSlotPayload` + `HostConfiguration` |
| `HOSTED_SLOTS`, `SlotId`, `SLOT_FILL`, `SLOT_EMPTY_BEHAVIOUR` | each package's `FILLED_SLOTS` — its own narrowing, `satisfies readonly SlotId[]` |
| `createRegistry`, `defaultSettingsFor`, `applyAddOnSettings`, `isConnectable` | `LabelStore` (`shipping-dhl`) — explicitly *not* part of `shipping-carrier@1` |
| `DeliveryChoice` — built by a fill, stored by the host, handed back down | |
| `artwork-source@1` and `shipping-carrier@1` types + `CarrierError` | |
| both conformance suites and their Zod validators, under `/testing` | |

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
  copy in all eight locales *and* over built output, with `premium` and `pro`
  also banned as standalone-token concepts in each language's own spelling.
  Each package carries the tables and greps its own `dist/`.

## Licence

AGPL-3.0-only. One `LICENSE` at the root covers every package.
