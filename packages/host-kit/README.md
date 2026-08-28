# The host kit — retrofitting the AddOnHost seam

The seam that lets an Adminium app host add-ons — the mount component, the paint rule, the CSS pair,
and the guards that keep all three honest — packaged so that installing it into a twelfth app is a
**supported operation** rather than a hand-copy.

This file is the procedure. It is written for somebody who has never opened `print-shop`, and it is
ordered: do the steps in the order they are numbered, and verify each one before starting the next.
Nothing here asks you to read another repository first.

---

## 1. Why this package exists, and what it means for you

The seam is roughly **2,200 lines of runtime and 3,400 lines of suites**. It existed in exactly two
apps, it was hand-copied between them, and within a fortnight the two copies had drifted in **eight
measured ways**. Two of the eight are not stylistic variance — they are **missing guards**.

That is the sentence to carry into every decision below:

> **"Copy what the other host does" loses a guard, whichever host you copy.**

### The drift inventory, and which side the kit took

| # | The drift | `print-shop` | `maker-shop` | What the kit does |
|---|---|---|---|---|
| 1 | **Brand gate** — the check that no shipped file outside the vendor tree and the registration lines names a company (acceptance criterion 5) | has it (`sources.test.ts`, *"the host names no company"*) | **absent** | Ships it to every host. `guards/brand.ts`. |
| 2 | **Vendored-copy gate** — the check that every vendored file carries its sync header, resolves its imports inside the vendor tree, and vendors the shared contract exactly once | has it (`sources.test.ts`, *"the vendored halves are copies, and say so"*) | **absent** | Ships it to every host, and `scripts/install-host-kit.sh status` applies the same discipline to the kit's own files. |
| 3 | **The npm entry point** — `add-ons:status` / `add-ons:sync` | declares both | **declares neither**, while shipping the same `scripts/sync-add-ons.sh` | Takes **neither side**: `status` FAILS with `NO-SCRIPTS` until the host declares its own. A gate with no documented way to run it is the same defect as a gate nobody can run. |
| 4 | **The mount component's generic** | `AddOnSlot<S extends SlotId>` — the closed registry | `AddOnSlot<S extends HostedSlotId>` — the ids this host mounts | Takes **`maker-shop`'s side**: the host's own union, still bounded by `SlotId`. See §6. |
| 5 | **Store wiring** | boots an EMPTY registry and has a `registerAddOns` action | builds the registry at store-init from `demoAddOns()` | Takes **`print-shop`'s side**. See §7. |
| 6 | **`testing/lexicon.ts`** | 722 lines | 769 lines, with an extra `CRAFT_TRAPS` export | Takes **neither**: the shared lists are kit-owned and a host may **add nothing** to them. A host's own domain traps stay in a host-owned file the kit's gate never reads. See §8. |
| 7 | **Quote style** | 31 files single-quoted, 69 double | 25 single, 77 double | Kit sources are single-quoted throughout and are **never hand-edited**, so the question stops being one. Exclude the two installed directories from your formatter — see step 3's verify. |
| 8 | **The class prefix** (`mp-` / `br-`) | duplicated across five files | duplicated across five files | One field, `classPrefix`, in one config. See §5. |

Items 1 and 2 are the reason this is a package and not a wiki page. A retrofitter copying
`maker-shop` — the newer host, the obvious model — would have shipped an app with no brand gate and
no vendored-copy gate and had nothing to tell them.

---

## 2. Before you start

You need all of these. None is supplied by the kit.

- **React 19** and a React-rendering app. The mount component is a React component.
- **The shared contract, vendored.** The kit imports `@adminium/add-on-host` for its types, and the
  install rewrites that to `../vendor/host/index.ts`. If your app does not already vendor the
  contract into `src/add-ons/vendor/host/`, do that first with the add-ons monorepo's own
  `scripts/sync-add-ons.sh` (it ships in each host; see the print-shop copy). A retrofit that
  installs the kit into an app with no vendor tree gets a clean install and a red `tsc`.
- **A store with the five add-on fields.** See §7.
- **Eight locales.** The lexicon gate runs per locale, and a host that ran only `en-US` would be
  repeating the release grep and performing none of the seven checks it cannot.
- **`vitest`.** Every guard is a function your own suites call.

---

## 3. The procedure

### Step 1 — decide your level, and write it down

`1` = the guards that need no DOM. `2` = all of them. §9 is the table; read it before choosing.

Declaring `1` while your `package.json` has `jsdom` is a **failure**, and there is no exemption
field. A host with a DOM available and five guards switched off is leaving them off for no reason
anybody wrote down.

**Verify:** you can state, out loud, which guards you are not running and what each one closes. If
you cannot, you have chosen level 1 by accident.

### Step 2 — get the kit beside your host

```
<somewhere>/your-app          ← the host
<somewhere>/add-ons           ← the monorepo; the kit is packages/host-kit
```

Anywhere else works; set `KIT_DIR`.

### Step 3 — install

From the kit:

```sh
HOST_DIR=../../../your-app bash scripts/install-host-kit.sh install
```

Three things land, and the split is deliberate:

| Lands at | What it is |
|---|---|
| `src/add-ons/kit/` | the **runtime** half — `AddOnSlot`, `slot-content`, `styles`, `config`. Compiles into your bundle. |
| `src/testing/kit/` | the **guard** half. Your suites import it; nothing that ships may. |
| `scripts/host-kit.sh` | this installer, installing itself, so your app owns its own gate. |

The two halves do not share a roof because **`guards/lexicon.ts` spells every banned word.** Under
`src/add-ons/` it would be one ordinary import away from a screen, and the failure would arrive as a
red release (17 §2 greps the built bundle) rather than as a red test.

**Verify:**

```sh
npx tsc -b            # the rewritten imports resolve
bash scripts/host-kit.sh status
```

`status` re-emits every source through the same rewrite, strips the provenance header, and compares
byte for byte. It will report `CONFIG-MISSING` and `NO-SCRIPTS` — that is correct; steps 4 and 5 fix
them. Add `src/add-ons/kit/` and `src/testing/kit/` to your formatter's ignore list now: a formatter
run over an installed file is reported as `DRIFT` on every file it touches, for ever.

### Step 4 — write `src/add-ons/host-kit.config.ts`

**By hand, once.** It is host-owned and never synced — the install refuses to write it and `status`
refuses to compare it, because everything in it is a fact about your app.

```ts
import type { HostKitConfig } from './kit/index.ts';
import { HOSTED_SLOTS, type HostedSlotId } from './slots.ts';   // YOURS, not the vendor's

export const hostKit: HostKitConfig<HostedSlotId> = {
  appKey: 'your-app',
  classPrefix: 'ya',          // WITHOUT the trailing hyphen
  hostedSlots: HOSTED_SLOTS,  // YOUR list, not the closed registry — see below
  slotEmptyBehaviour: { /* one row per hosted slot; total by type */ },
  // …and the `1 | 2` level field, which `config.ts` documents immediately below
  // `slotEmptyBehaviour`. Its NAME is the one word this document may not write —
  // see §9 — so copy the line from there rather than from here.
  rootDir: …, srcDir: …, vendorDir: …,
  localeTags: [...],
  stylesheets: [...],
  affiliationExempt: { 'src/…': 'why' },
};
```

**The one trap in this file:** `vendor/host/slots.ts` exports the **closed registry** under the name
`HOSTED_SLOTS`, which is the same identifier your app uses for the five or nine slots it actually
mounts. Importing the wrong one silently widens every check in the kit — the mounts guard would
demand mounts for twelve ids, the empty-behaviour table would need twelve rows, and the payload
generic would accept ids you never draw. `hostedSlots` takes **yours**, and the mounts guard asserts
it is a strict subset of the registry so a mis-import is a named failure.

**Verify:** `npx tsc -b`. `slotEmptyBehaviour` is total by type, so a slot in `hostedSlots` with no
empty-state decision is a compile error here, which is where the decision belongs.

### Step 5 — declare the entry point

Paste into your `package.json`:

```json
"host-kit:status": "bash scripts/host-kit.sh status",
"host-kit:install": "bash scripts/host-kit.sh install"
```

The installer prints these rather than writing them. Editing your `package.json` from a shell means a
JSON round trip, and a JSON round trip reformats the whole file and flattens escape sequences in any
string that carries one — a hundred-line diff a reviewer skims, instead of a three-line one they read.

**Verify:** `npm run host-kit:status` no longer says `NO-SCRIPTS`. Then put it in CI. Drift item 3 is
what happens when nobody does.

### Step 6 — paste the CSS rule pair into one stylesheet

```ts
import { slotRuleBlock } from './add-ons/kit/styles.ts';
console.log(slotRuleBlock(hostKit));   // or read it out of a scratch test
```

Paste the output — comment included — into **exactly one** of the stylesheets named in
`config.stylesheets`. Exactly one, not "somewhere": two copies of a cascade rule is how one gets
edited and the other does not.

**Verify:** the styles guard finds the pair, with both negations, in exactly one file.

**Do not paste only the CSS.** See trap 2 in §4 — the rule alone silently degrades to the version
that blanked a real screen.

### Step 7 — bind the component

One file, once, at module scope:

```tsx
import { createAddOnSlot, type UseSlotFills } from './kit/index.ts';
import { hostKit } from './host-kit.config.ts';
import { useStore } from '../state/store.ts';
import type { HostedSlotId } from './slots.ts';

const useSlotFills: UseSlotFills<HostedSlotId> = (slot, forAddOn) => ({
  fills: useStore((s) => s.registry).fillsFor(slot, useStore((s) => s.enabled), forAddOn),
  settings: useStore((s) => s.addOnSettings),
});

export const { AddOnSlot, SlotFill } = createAddOnSlot(hostKit, useSlotFills);
```

Both existing hosts declare `AddOnSlot` as a plain component with `className="mp-slot-fill"` written
in and `useStore` imported by a fixed relative path. Those two lines are exactly why the file could
only ever be installed by hand-editing it — and a copy that must be edited to be installed is a fork
from the first keystroke. The factory turns both into arguments.

**Call it once.** A second call makes a second component identity, so React unmounts and remounts
every fill under it whenever a screen renders the other one.

**Verify:** `npx tsc -b`, and boot the app. A wrong `classPrefix` throws here, at module load, with a
message naming the field — deliberately, so it cannot present as a missing style on one screen.

### Step 8 — mount your slots

```tsx
<AddOnSlot slot="order.dispatch.panel" payload={{ order, items }} fallback={<p>{t('…')}</p>} />
```

Five props and only five:

| Prop | |
|---|---|
| `slot` | the id. Must be in `hostedSlots`. |
| `payload` | that slot's declared shape **minus `settings`**. The kit injects each fill's own settings. |
| `forAddOn` | scope to one add-on — what a `per-add-on` slot means. |
| `fallback` | what to draw when nothing fills it. **Omit for a silent slot.** |
| `wrap` | wraps the fills when there is at least one — a panel, a row, a grid. |

`fallback` present means the slot **speaks**: an honest empty state in words, where a person has
something to be told. `fallback` absent means it is **silent**. That decision is recorded twice on
purpose — as `slotEmptyBehaviour` in the config, and as the presence of this prop — and a guard
compares them.

**Verify:** every id in `hostedSlots` is mounted somewhere in `src/`, and every mount's slot is in
`hostedSlots`. The mounts guard checks both directions.

### Step 9 — the store, and registration

§7 has the five actions and the one rule that is not negotiable. Register your add-ons **and their
strings** — §10 is a warning worth reading before you write that line, not after.

**Verify:** with no add-ons registered, every slot draws its fallback and the app looks exactly as it
did before the retrofit. That is the check worth having: **the seam is installable and verifiable
before any add-on exists.**

### Step 10 — wire the guards into your own suites

Each guard is a function you call from a test file you own:

```ts
import { brandGuard } from '../testing/kit/brand.ts';
import { hostKit } from '../add-ons/host-kit.config.ts';

describe('the host names no company', () => {
  it('does not', () => brandGuard(hostKit));
});
```

They are **not** auto-discovered. A guard that runs because a file exists is a guard that stops
running when a glob changes, silently.

**Verify:** the level guard fails if you declared `2` and left one of them unreferenced.

### Step 11 — run everything

```sh
npx tsc -b && npx vitest run && npm run host-kit:status && npm run add-ons:status && npx vite build
```

`vite build` last and not optional: the lexicon and egress gates read the **built bundle**, and a
suite that passes on sources can still fail on what a bundler emitted.

**`add-ons:status` is in that line because it was missing from it, and the omission cost a day.**
It checks a different tree from `host-kit:status` — the vendored ADD-ON sources and the vendored
shared contract, not the kit — so a green `host-kit:status` says nothing about it. Two separate
retrofits hit the same thing within an hour: a concurrent change to
`add-ons/packages/host/src/delivery.ts` left their vendored copy stale, and the first one to notice
was this command, reporting `DRIFT delivery.ts` in one line. A retrofitter following an earlier
version of this list exactly would have shipped a stale contract with everything else green.

**And it is not only your own repo.** At the end of that same wave the two ORIGINAL hosts —
`print-shop` and `maker-shop` — were both carrying the stale copy and `print-shop` had three red
suites, because the wave had amended `packages/host` while working somewhere else entirely. So:

> **A change to `packages/host` obliges a re-sync in EVERY host, not only the one you are in.**
> `scripts/sync-add-ons.sh sync` in each, then their suites. There is no gate that will tell you
> this from inside the repo you are editing — the drift is in the repos you are not looking at.

---

## 4. The traps

Every one of these was a defect first.

### Trap 1 — `AddOnFill<never>` is the original sin

`AddOn.fills` was once typed `readonly AddOnFill<never>[]`. `never` **erases**: every payload is
assignable to it, so a fill declaring `render: (p: anything) => …` type-checked, and nothing anywhere
compared what a host passes with what a fill reads. `tsc` was green in all three repos. The
components threw in the **second host**, on three separate screens — the only place the mismatch
could show up and the last place anybody was looking.

Fills are typed with the `PayloadFor<S>` generic now. **If a retrofit widens a payload type to make
an error go away, it is re-committing that sin: the error was the guarantee.**

### Trap 2 — `:empty` is not "drew nothing", and the CSS alone is not the fix

Three parts, and they only work together:

1. `slot-content.ts` — reads the DOM and answers *did this paint anything?*
2. `SlotFill` — a MutationObserver that asks after every mutation and writes `data-drew`.
3. The CSS rule pair — keys off **both** `:empty` and `data-drew`.

**Shipping the CSS alone re-introduces the defect.** A host with the rule pair and a mount component
without the observer has a `[data-drew]` nothing ever writes, so the second negation is always true,
so the rule degrades silently to the earlier version — the one where a fill returning a bare empty
`<div/>` blanked the host's own picture. It does not fail. It stops protecting anything.

The defect underneath, stated once: an add-on can register a fill and correctly draw **nothing** for
a particular record. When it does, a fill exists, so the fallback was suppressed, and the fill
rendered null — so **connecting an add-on took a picture away**.

### Trap 3 — the MutationObserver has no dependency array, and skips its own writes

Both are deliberate and both are commented in the source as **do not clean this up**.

- **No array.** The effect re-runs every render and re-attaches. What it watches is the fill's
  output, which the component does not own and cannot list as a dependency. `[]` would answer for the
  first tree only — right on mount, wrong the moment a fill re-renders, which is the ordinary case.
- **Skips its own `data-drew` writes.** Setting the attribute is itself a mutation on the observed
  element. An observer that did not filter them would see its own answer, re-measure, set it again,
  and go round for the rest of the session — a loop that shows up as a warm laptop, not as a failure.

A lint rule will want an array here. It is right about the general case and wrong about this one.

### Trap 4 — `data-add-on-slot` is for the test tour, not for the stylesheet

Nothing in `styles.ts` reads it and nothing should. A host's `testing/tour.tsx` reaches an add-on's
own surfaces — an editor, a wizard, a settings form — by pressing what a fill drew and looking at
what appears, because no store field names any of them. To do that it must be able to say *this part
of the page belongs to an add-on* **without naming an add-on**, which is the same constraint the
brand gate puts on everything else. A class a stylesheet happens to use is not that: it can be
renamed, shared, or dropped for a grid, and the crawl would silently stop crawling — finding nothing
and reporting green.

### Trap 5 — a `sed -E` backreference in a **pattern** matches nothing on macOS

The install rewrites import specifiers, and the obvious way to write "either quote style" is a
capture-and-put-back with `\1` in the pattern. BSD ERE has no backreferences: on macOS it matches
nothing and every specifier is copied through untouched — **silently**, because `status` applies the
same broken rewrite to the source, so the two sides agree perfectly and the build fails. That is why
`unresolved_in` exists in the install script and why it greps the installed file directly instead of
trusting the comparison. Both quote styles are spelled out. Do not "simplify" them.

### Trap 6 — a guard's own fixtures look like imports

The first run of the install reported `UNRESOLVED` on a line in `guards/brand.ts` that reads
`expect(bites("import { register } from '@adminium/…'"))` — a **fixture**, a string the guard feeds
itself to prove it bites. A refusal there would have made the kit uninstallable for a reason that
does not exist, and a gate that cries wolf on its own test data is a gate somebody deletes. The check
now requires a real statement rather than a quoted one.

### Trap 7 — the rewrite edits a guard's fixtures too, and only one of them failed

Trap 6 is the install *refusing* a fixture. This is the install *rewriting* one, which is quieter and
worse. `install-host-kit.sh` turns a literal `'@adminium/add-on-host'` into the vendored path and a
literal `'../x` into `'../../add-ons/kit/x`; `sed` cannot tell an import at the top of a file from a
string a guard feeds itself. Found on the **first retrofit**, in two files:

- `guards/vendored.ts` — a bare-specifier fixture became a relative path, so the guard's own
  self-test asserted that `'../../add-ons/vendor/host/index.ts'` is a bare specifier. **It failed**,
  which was the lucky half.
- `guards/brand.ts` — two path fixtures were rewritten and both assertions **went on passing**, no
  longer asking what they were written to ask.

Both are fixed at the source: the specifiers are built from pieces (`` `@${'adminium'}/…` ``) so the
rewrite cannot match them. If you add a fixture containing a specifier, do the same. Do not inline it.

### Trap 8 — `factory-ops` found three more, all fixed here

Recorded because each one is a thing the kit's own suites structurally could not see.

- **The guards would not accept a host's config.** Every guard was annotated `config: HostKitConfig`
  — the default, meaning `HostKitConfig<SlotId>` — and `Record<'a' | 'b', V>` is not assignable to
  `Record<AllTwelve, V>`. So **step 4's config could not be passed to a single guard in step 10**.
  The kit's `synthetic-host.ts` never saw it because it builds its config as `HostKitConfig` and
  *casts* the table. Guards now take `HostFacts` — the config minus the two slot-shaped members, none
  of which a level-1 guard reads. `mountsGuard` stays generic over `S`.
- **`guards/facts.ts` globbed one directory too far up.** It said
  `'../../../add-ons/vendor/*/add-on-facts.ts'` and described itself as installed at
  `testing/kit/guards/facts.ts`; the install writes the guard half **flat**, at `testing/kit/`. Three
  levels reaches the host's checkout root, so the discovery matched nothing and every gate that reads
  it — egress, credentials, marks — would have run blind. `factsGuard`'s first case caught it. The
  glob is a string literal a bundler resolves, so it is the one path in the package nothing rewrites
  and `tsc` has no opinion about: **write it for the installed layout, not for this repository's.**
- **The one allowed company line was single-quoted only.** `vendorImportLine` matched
  `from '…/vendor/<key>/index.ts';` and nothing else, so a double-quoted host — `factory-ops` is
  double-quoted throughout — had its `registry.ts` reported as naming a company, on the exact line
  the rule exists to permit. Both quote styles are accepted now, alternated rather than a character
  class so a mismatched pair is still refused. **The kit's quote style settles `src/add-ons/kit/`
  and settles nothing about the host source a guard reads.**

### Trap 9 — `host-kit.config.ts` is imported by the browser half

It holds four absolute paths and only Node ever reads them, but the **module** is loaded in the
browser: `createAddOnSlot` reads `classPrefix` off it at module load. So do not reach for
`fileURLToPath` from `node:url` to build them — that puts `node:url` in the import graph of every
screen that mounts a slot. `new URL('../../', import.meta.url).pathname` works in both, and
`decodeURIComponent` it, because a checkout under a path with a space in it is an ordinary thing.

---

## 5. The prefix, and the five places that must agree

`mp-` in one host, `br-` in the other, and it appears in **five** places that all have to match:

1. the mount component's `className`,
2. the CSS rule pair,
3. the dock exclusion in the label-pairing gate,
4. the shelf selectors in the claims gate,
5. the fixture in the slot-content suite.

**Four of those are test files.** A prefix changed in the component and missed in a suite does not
fail: the suite goes on querying a selector that now matches nothing, finds zero offenders, and
reports green. That is a gate going blind by a route nobody looks down, and it is the exact shape
wave 4b found eleven times.

`config.classPrefix` is one field and all five read it, through `selectorsFor`. A host that renames
its classes changes one line; a host that changes the field without changing its stylesheet fails the
styles guard — a real failure, in the right place, instead of four silent passes.

Overrides exist (`config.selectors`) for a retrofit target that already shipped class names not
following the pattern. Overriding one is a decision a reader can see; twelve hosts each inventing
their own is not.

---

## 6. The generic: `SlotId` or your own union?

The kit takes **your own hosted union**, bounded by `SlotId`. `maker-shop`'s side, and not for
symmetry:

- **`HostKitConfig<S>` is already generic over it.** `hostedSlots` is `readonly S[]` and
  `slotEmptyBehaviour` is `Record<S, …>`, total by type. Typing the component over the wider union
  puts the component and the config on two different unions, and the config is the contract.
- **The wider union makes a real mistake compile.** Mounting an id you do not host is accepted by
  `SlotId`, and then `slotEmptyBehaviour` has no row for it — so the one decision the seam insists you
  make, *speaks or silent*, is simply undecided at the site where it is decided. That is the
  difference between a compile error and an undecided empty state.
- **Nothing is lost.** `S extends SlotId`, so an id outside the closed registry is still a compile
  error, and the mounts guard asserts `hostedSlots` is a strict subset of the registry.

The cost is real and small: adding a slot means adding it to `hostedSlots` and giving it an empty
behaviour first. Two lines, in one file, that the mounts guard would have demanded anyway.

---

## 7. The store: five actions, and one rule

The seam needs five things from your state, and they are the same five in both existing hosts:

| | |
|---|---|
| `registry` | an `AddOnRegistry`, from `createRegistry(addOns)`. |
| `registerAddOns(addOns)` | replaces the registry. |
| `toggleAddOn(key)` | switch one on or off — the reviewer's dock, and the shelf. |
| `connectAddOn(key)` / `disconnectAddOn(key)` | connect and disconnect are **not** the same fact as enabled/disabled, which is why `enabled` and `credentialled` are separate sets. Disconnecting removes surfaces and credentials; it never removes data. |
| `patchAddOnSettings(addOn, patch)` | merge a patch into one add-on's saved values. |

### The rule: `patchAddOnSettings` **pushes**

```ts
patchAddOnSettings: (addOn, patch) => {
  const addOnSettings = { ...get().addOnSettings, [addOn]: { ...(get().addOnSettings[addOn] ?? {}), ...patch } };
  set({ addOnSettings });
  applyAddOnSettings(get().registry.all, addOnSettings);   // ← this line
},
```

That last line is the rule. Add-ons are handed their settings; **they never poll for them.** An
add-on that reads the host's store is an add-on coupled to a host's state shape, which is the
coupling every other decision in this seam exists to prevent — and one that reads it on a timer is
worse, because the version that works is indistinguishable from the version that is one tick stale.

### The wiring drift (inventory item 5), and why the kit chose `print-shop`

`print-shop` boots `createRegistry([])` and calls `registerAddOns` at bootstrap. `maker-shop` builds
the registry at store-init from `demoAddOns()`. The kit takes the first, for three reasons:

1. **A retrofit can land before any add-on exists.** With an empty registry every slot draws its
   fallback and the app is unchanged on screen — so the seam is installable, reviewable and mergeable
   on its own. With the second shape it cannot be installed until an add-on is ready.
2. **The store stops importing add-on bundles.** Every screen imports the store; under the second
   shape every screen's module graph therefore contains every add-on.
3. **Connected mode needs it.** In Phase B the list comes from `GET /api/v1/add-ons` and the bundles
   are `import()`ed. Only the *source of the list* changes — which is only true if the list is not
   baked in at module load.

---

## 8. The lexicon gate, and the 31 D4 scoping ruling

The gate a retrofit installs asserts **add-on-contributed strings only** — registered message
bundles, and the copy a slot fill draws. **Pre-existing host copy is reported as debt, not failed.**

This is not a softening. Without it the flagship retrofit fails on day one, on a string it did not
write. Quantified: `ecommerce-storefront`'s **built bundle** carries **102 hits across six of the
banned runs**, 70 of them one word, which appears 139 times across 21 source files — while
`factory-ops`'s dist is clean apart from one run React uses internally. Same fleet, same gate, two
completely different bills. **The exemption problem is per-host, not one rule** — which is precisely
why the kit owns the lists and each host declares its own `affiliationExempt` with a written reason
per entry.

(The runs are not spelled here for the reason §9 gives.)

A retrofit **never silently "fixes"** pre-existing host copy. Fixing it is a separate change, on its
own, where a reviewer can see what a sentence used to claim.

### And a host may add nothing to the lists (inventory item 6)

The banned-word list, the company regex and the idea×language table are facts about a **release rule
and about languages**, not about a shop. `maker-shop` was allowed its own additions and records what
happened: registering a portable add-on turned that host's vocabulary gate red until somebody edited a
list under `src/testing/`, because a Czech phrase had been carved out in one host and not the other.
**A host that must be edited before a portable add-on passes its gates makes 24 D21 false**, by a
route nobody would look down.

So the lists live in the kit and every host gets all of them. `maker-shop`'s extra `CRAFT_TRAPS` —
genuinely its own vocabulary, a shop that sells pots — moves to a **host-owned file the kit's gate
never reads**, and its own suite keeps asserting it. Do not merge a host's traps into the kit's list;
that is the same defect in the other direction.

---

## 9. The level table — and a word this file may not write

**The config field is spelled differently in the code.** `config.ts` names it, its doc comment is the
ruling, and this document calls it the *level* instead — because the release sweep (17 §2) bans that
substring, `packages/host/src/docs-lexicon.test.ts` sweeps **every Markdown file in this repository**
for the seven runs with no ordinary-English homograph, and it reads raw text with no word boundary
and no sense of irony. A document that names a banned word while explaining the ban is the first
thing that grep finds — which is exactly what the first draft of this README did: nineteen hits
across twelve lines, caught by that suite and not by review.
TypeScript comments are not swept, so the code says it plainly and the prose does not.

| | Level 1 | Level 2 |
|---|---|---|
| **Needs** | `node:fs` and a TypeScript parser | the above **plus `jsdom`** |
| **Runs** | the file-and-text guards: lexicon, brand, the source half of label-pairing, payload-casts, facts, the vendored-copy/styles checks | all of them |
| **Cannot check** | anything about **paint** or about what React actually called | — |
| **Every run prints** | by name, the guards that are **not** running and the defect each one closes | — |

A host may sit at level 1. It **may not sit there quietly** — that is the whole ratchet. There is no
exemption field, because an exemption list is where nine of wave 4b's holes came from.

**Why level 2 needs a DOM at all:** the defects those guards close are defects about paint and about
what actually rendered. `:empty` is not "drew nothing", and a mount inside a JSX comment satisfies a
grep.

### Dev dependencies do **not** violate 25 D11 — do not "fix" this later

25 D11 says an add-on ships no **runtime** dependency its host lacks. It is about what reaches a
browser. A `devDependencies` entry used by `vitest run` reaches no bundle, and both hosts that already
carry the seam have had `jsdom` since wave 4b with no change to what they ship.

**Verified, not assumed** (2026-08-28): `people-ops` and `clinic-desk` have **no `jsdom`, no
`@testing-library/react`, and zero `.test.tsx` files** between them. Their cost to reach level 2 is
one `devDependencies` line each: `jsdom`.

**And one correction worth having before you copy a host:** *neither* existing host uses
`@testing-library/react`. `print-shop` and `maker-shop` drive React through `react-dom/client` +
`act` under a per-file `@vitest-environment jsdom` pragma, and carry no testing-library dependency at
all. If you prefer testing-library, adding it is permitted by the same reasoning above — but do not
add it "to match print-shop", because print-shop does not have it.

The pragma is per file rather than a glob in `vitest.config` on purpose: a pragma travels with the
file when the install vendors it, and a config entry does not.

---

## 10. An add-on's strings travel with the add-on, and the merge **throws**

An add-on's eight-locale bundle rides on the add-on object and is merged at **registration**, by a
function that throws — naming the add-on, the locale and the key — on:

- a missing `en-US` bundle,
- a **missing locale**, entirely,
- a **missing key** in any locale, or an empty one,
- a **collision** with the host's own message bundle.

It runs at module load on **every boot, including the demo**, so it cannot be skipped the way a test
can. That placement is the guarantee: an add-on's keys are no longer members of the host's
`MessageKey` type, so the compiler no longer checks them, and this function is what took that job
over.

> **A retrofit that merges add-on strings without porting that function loses the guarantee with
> nothing to say so.** `Object.assign(MESSAGES[locale], bundle[locale])` in a loop is four lines,
> works, passes every test you have, and silently accepts an add-on missing three locales — which
> then falls back to English on screen for a reader who cannot read it.

Port it, or write it. `print-shop/src/i18n/messages/index.ts` (`registerAddOnMessages`) is the
reference implementation.

---

## 11. Honest scope: what a retrofit has to **build**

**Four of the wave-6 hosts have no settings screen at all.** `ecommerce-storefront`, `factory-ops`,
`people-ops` and `clinic-desk` contain no settings file of any kind — checked, not assumed. The only
settings screen in the entire fleet is `booking-scheduler`'s, and it has no tax field and does not
persist.

`settings.add-on.panel` is `surface: 'admin'`, `fill: 'per-add-on'`, and in those four apps **there
is nowhere to mount it.** A retrofit must **build that surface**, not find it. Budget it.

Two more, while you are there:

- **`SettingsPanelPayload.samples` is required**, and its own comment records why: the second host
  once passed `{ patch }` alone, `tsc` was happy, and the carrier's settings form threw on `.map`.
- **Neither existing host has a shop address**, and `CheckoutPayload.origin` and
  `OutboundOrder.origin` are both required `PostalAddress`. If your retrofit mounts a delivery
  surface, that is a schema-and-seed change before it is a slot change.

---

## 12. What the kit deliberately does not do

- **It does not edit your `package.json`.** It prints two lines and fails until they are there.
- **It does not write into your stylesheets.** It hands you the rule pair as text.
- **It does not write your config.** That file is entirely facts about your app.
- **It does not auto-discover guards.** You call them from suites you own.
- **It does not guess what to install.** Every file is named in the script — and a file that stays
  behind is named too, in a second list, with its reason. "Not in the list" cannot mean both
  *forgotten* and *decided*, so both are written down and forgetting still fails as `UNLISTED`.
- **It does not vendor add-ons.** That is `scripts/sync-add-ons.sh`, which owns a disjoint tree
  (`src/add-ons/vendor/`); this one owns `src/add-ons/kit/`, `src/testing/kit/` and `scripts/`. Two
  scripts with no shared file list cannot fall out of step with each other.

---

## 13. The install script's refusal states

Each has a distinct name because each calls for a different action.

| State | Means | Fix |
|---|---|---|
| `MISSING` | a listed file is not installed | `install` |
| `DRIFT` | an installed file differs from the kit | `install`, or push the edit back to the kit |
| `EXTRA` | an installed file no list names | delete it, or name it in the script |
| `UNRESOLVED` | a specifier the host cannot resolve | the rewrite did not fire — trap 5 |
| `ESCAPES` | a kit source climbs out of its own half | fix the kit |
| `UNLISTED` | a kit file no list names | add it to the file list |
| `CONFIG-MISSING` | no `host-kit.config.ts` | write it (step 4) |
| `NO-SCRIPTS` | no npm entry point | paste two lines (step 5) |
| `SOURCE-MISSING` | no kit beside the host | nothing to compare; exits **0**, so a clean clone of your app still passes its own gate |

That last row is the point of installing the script into your app at all. The anti-drift check for the
add-ons once lived only in one gitignored directory: a host's source told readers to *"re-run the sync
script"*, CI had no script to run, and a cloner could not have run one. **A gate nobody but one laptop
can execute is not a gate.**
