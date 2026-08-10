# Trademarks

This repository holds every Adminium add-on. Some of them connect to a
third-party service and have to name it; some connect to nothing at all. This
file is the whole list, in one place, so that a reader does not have to open
three packages to find out which marks are involved.

Each add-on's own section below carries its detail. Nothing has been dropped in
the move from three repositories to one: what used to be three `TRADEMARKS.md`
files is now three sections of this one, and each package keeps a short pointer
back here.

---

## The affiliation disclaimer, once, for everything in this repository

**Adminium is an independent project. It is not affiliated with, sponsored by,
endorsed by, certified by, or in any partnership with any company named in this
repository.** No approval of any kind has been sought or given by any of them.
Nothing in this repository, in any add-on's user interface, in any manifest, in
any README or on the Adminium website states or implies otherwise, and no
wording that could be read as implying it may be added.

Where a company **is** named, it is named **nominatively only** — solely to say
which service is being connected to, which is the one thing that cannot be said
without naming it. That, and the disclaimer above, is what makes the naming
permissible at all.

## No logo, no brand colour, anywhere

**No real company logo is drawn, redrawn, traced, approximated or embedded**
anywhere in this repository — not in code, not in a stylesheet, not in a
generated document, not in a screenshot, not in a README, not in a design comp,
and not in this file. Neither is any brand colour, typeface, icon or other
creative asset belonging to a company named here.

Every add-on is represented by a **monogram tile**: a `--surface-3` rounded
square with a 1px border and two or three letters in `--fg-muted`, drawn from
the host application's own design tokens and from nothing else.

That is a deliberate design constraint rather than a shortcut. A shelf of twenty
add-ons has to read as one system rather than as twenty logos — and beyond
taste, reproducing someone else's mark would be a legal problem rather than an
aesthetic one. The rule (24 D12, amended 2026-08-09) binds every add-on in here,
including the ones that name no company.

## Every mark any package in this repository references

| Add-on | Package | Monogram | Mark referenced | Owner |
|---|---|---|---|---|
| Design Studio | `packages/design-studio` | `DS` | *(none)* | — |
| DHL Shipping | `packages/shipping-dhl` | `DHL` | **DHL** | Deutsche Post AG |
| Canva Import | `packages/import-canva` | `CNV` | **Canva** | its owner |

Adminium and the Adminium name are marks of the Adminium project. Every add-on
here is published by the project itself (`publisher.id: adminium`), which in v1
is the only publisher an add-on may have.

---

# Design Studio — references no third-party trademarks

**This add-on connects to no outside company.** It calls no third-party API,
requires no account, and declares no network egress. There is therefore no
company to name, and none is named — in the code, in the interface, in the
manifest or on the website.

## Why it still has a section here

The brand rule above is binding on every add-on, not only on the ones that name
a company. Design Studio's monogram is `DS`
(`packages/design-studio/src/ui/Monogram.tsx`), with no brand colours and no
brand tints, for exactly the same reason the other two have theirs.

## The affiliation line, and what stands in its place

The two add-ons below carry the line *"Adminium is not affiliated with this
company"* on their detail surfaces. Design Studio reports
`namesCompany: false` from `register()`, so the host does not render it here:
there is no company to disclaim a relationship with, and a disclaimer about a
company that does not exist is noise rather than care.

**An absent line is indistinguishable from a forgotten one**, so this add-on
states the positive fact in its own words, in all eight locales: *"Design Studio
connects to no outside company. It needs no outside account at all."*

It says it **in the disclaimer's own place**, not merely somewhere nearby. The
two keys travel on the registration object as `noCompanyKeys`
(`packages/design-studio/src/index.ts`), and the host's `Affiliation` component
renders the not-affiliated line for an add-on that names a company and this
sentence for one that does not — so all three detail surfaces end on a statement
about who else is involved: the connect dialog, the consent panel and the manage
drawer. The settings panel repeats it at the foot of its own form
(`packages/design-studio/src/ui/SettingsPanel.tsx`), where a shop owner changing
a setting is looking.

The sentence lives in the add-on rather than in the host because the host names
no add-on and holds no add-on's copy — a host-side version of it would be the
host asserting a fact about an add-on it is not supposed to know.

24 AC6 is worded as though every add-on carries the not-affiliated line; taken
literally that asks this add-on to disclaim a relationship it could not have.
The criterion should read *"every add-on that names a company"*, with the rule
above covering the ones that name none. **That amendment has been accepted**,
and the `namesCompany: false` flag stays as it is; what changed is that the
surface now says something true where it used to say nothing.

If a future version ever names a company — an image library, a font foundry, a
stock provider — that flag flips to `true`, the table above gains the mark and
the vendor's terms link, and the line appears with it.

## Fonts and icons in its interface

The font list the editor offers is `Manrope`, `JetBrains Mono`, `Georgia` and
`Helvetica`. The first two are open-licensed faces the host app already loads
(Manrope: SIL Open Font Licence 1.1; JetBrains Mono: SIL Open Font Licence 1.1).
The last two are named as generic system families and are not bundled,
redistributed or embedded by this repository. Custom font upload is out of scope
by design (24 §6's cutline), which also keeps this list closed.

Icons throughout this repository are [Lucide](https://lucide.dev) (ISC Licence),
used unmodified.

---

# DHL Shipping — DHL

**DHL** is a trademark of Deutsche Post AG. It is referenced **nominatively
only** — to say which delivery company this add-on connects to. That is the
whole of the use.

## Not affiliated

Adminium is not affiliated with, endorsed by, sponsored by, certified by or in
partnership with Deutsche Post AG or any DHL entity. Nothing in this repository,
in the add-on's screens, or in the marketplace listing states or implies
otherwise, and no wording that could be read as implying it may be added.

That line — *"Adminium is not affiliated with this company."* — appears on every
one of the add-on's surfaces that names the company, in all eight locales, and
it is not decoration: it is the reason the naming is permissible at all.

## No logo, and a label that cannot be mistaken for one

The add-on is represented by the monogram tile `DHL`, in `--fg-muted` on
`--surface-3`, using no brand colour of any kind.

The generated demo label carries the line *"DEMO LABEL - NOT VALID FOR
CARRIAGE"* as its first row of text, has no barcode, and states that the carrier
is simulated. It cannot be mistaken for a real shipping document, which is the
other half of the same rule.

## The vendor's own terms

Anyone connecting a real account is bound by the vendor's API terms, not by
Adminium's:

- API catalogue — <https://developer.dhl.com/api-catalog>
- API terms and conditions — <https://developer.dhl.com/terms-conditions>

This repository ships no credentials, makes no call to any third-party service
in its demo, and does not grant anyone the right to use the mark above.

## If you are writing the next carrier add-on

Copy this section, change the mark and the links, and keep every other line. The
rule is the same for every carrier: name the company only to say what is being
connected to, never draw the mark, always carry the disclaimer, and link the
vendor's own terms.

---

# Canva Import — Canva

**Canva** is a trademark of its owner. It is used **nominatively only** — that
is, solely to identify the third-party service this add-on connects to, which is
the one thing that cannot be said without naming it.

## Not affiliated

Adminium, the Adminium marketplace, this add-on and the Print Shop example app
are **not affiliated with, sponsored by, endorsed by, or in any partnership
with** the owner of the mark above, and nothing in this repository, its user
interface or its documentation may be written so as to state or imply otherwise.
No approval of any kind has been sought or given. The line *"Adminium is not
affiliated with this company."* appears on this add-on's own surfaces — the
consent panel, the connect step and the import step — in all eight locales, not
only in this file.

## No logo, no brand colour

This add-on is represented by the monogram tile `CNV`: those three letters in a
neutral `--surface-3` tile with a 1px border, in `--fg-muted`.

That is not a stand-in for artwork that could not be obtained. There is no
vendor imagery in the bundle, in the stylesheet, in the README or in the design
comp this add-on was built from. Every colour it renders comes from the host
application's own design tokens.

## The vendor's own terms

Anyone who enables a real connection — rather than the demo transport this
repository ships with — is responsible for reading and accepting the vendor's
own developer and API terms, published at <https://www.canva.com/policies/>.
Nothing here grants any right in the vendor's API, brand, content or services,
and nothing here is a substitute for their terms.

Note that this repository as published **makes no call to that API at all**: it
answers from fixed demo data, and the endpoints named in
`packages/import-canva/src/oauth.ts` are marked unverified and are never
requested. See that package's README.

---

## Corrections

If you own a mark referenced here and believe any use is incorrect or
overstepping, open an issue on this repository and it will be corrected.
