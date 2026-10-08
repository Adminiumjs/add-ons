# Offers & gift cards

Discounts, discount codes, vouchers, packs of uses, gift cards and store
credit for a business that already runs on its own tables. An order's
reductions are worked out, and what was used is recorded, in the same save
that writes the order — or the save writes nothing.

Nothing is fetched from anywhere and no account is needed.

## What it keeps

- **Offers**: a percent, an amount, a fixed price, a bonus item or a price by
  quantity, with the days, hours, minimums, groups and limits it is held to.
- **Codes** a customer types, each with its own limit and last day.
- **Vouchers and packs**: one use of a thing or an amount, or ten classes.
- **Gift cards and store credit**, with every row that put value on one or
  took it off. A card never goes below nothing.
- **What was applied** to each order line, as it read at that moment.

## How your tables use it

An app says, in its own manifest, which of its tables is an order whose price
may be lowered, which a payment a card may make, and which a line that sells a
card or a voucher. Adminium asks this add-on what the reductions come to and
which rows a use, a payment or a sale makes, checks the answers and writes
them with the order. The add-on decides; Adminium reads and writes.

It attaches to no app in particular, and works with none at all: a card can be
issued, a voucher used and a code made from its own screens.

## The four shapes

`src/shapes/*.json` are the parts an app spells out on its own tables, under
its own column names: `discountable@1` (an order, its lines and its typed
codes), `card-payment@1`, `card-sale@1` and `voucher-sale@1`. An app copies the
files it adopts and holds its tables to them with `shapeFit`
(`src/testing/fit.ts`) in its own suite.

## Who reads a code

A card's code spends the card, so the two roles that work a counter read the
last four characters only. The manager reads every code. A person who holds a
second role with a plain read of the table reads it too: roles add up.

## The file that decides

`dist/server.js` implements the `posting-rows@1` and the `price-adjust@1`
contracts. It is one classic script with no `import` and no `require`. It is
pure: no clock, no randomness, no network. The moment of a save is handed to it
as text, so the same input always gives the same answer.

## The screens

An Overview and eleven lists come from the manifest. Four screens are code,
each its own file under `dist/pages/`: **Discounts** (make one and try it on
a sample order), **Issue** (a card, a voucher, a batch), **Look up** (scan or
type a code, or an email address for credit) and **Offer rules** (say which of
your own tables takes discounts, takes a card, sells one). Their words are in
`src/pages/strings/`, in eight languages; `node scripts/page-strings.mjs`
rewrites the English file from the screens' own source.

## Mail, print and the balance door

Four emails: a gift card, credit, a voucher with a name on it, and a reminder
before a card's last day. A card dated for a day is sent that morning. A card
and a voucher are drawn by `dist/documents.js` (`document-render@1`), on a
page or on receipt paper, with the code in fours and as a QR picture; the code
is in the print and is kept nowhere else.

An app that serves customers may show a card's balance: by its code, or by the
link in the card's mail. Either answers the status, the balance and the last
day, and nothing more; a code that is not a usable card answers nothing, and
says no more than that.

## The sample

`seeds/offers.sample.json` is written by `node scripts/sample.mjs` from
`src/sample/bundle.ts`: six offers, twelve cards and credits, a batch of 200
vouchers, a month of orders that used them. The Overview's figures are sums over it.

## Building it

```bash
npm run build       # dist/server.js, dist/documents.js, dist/pages/*
npm test            # the manifest, the roles, the shapes, the screens, the built bytes and the release sweep
```
