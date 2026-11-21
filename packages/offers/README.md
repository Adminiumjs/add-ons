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

## The six shapes

`src/shapes/*.json` are the parts an app spells out on its own tables, under
its own column names: `discountable@1` (an order, its lines and its typed
codes), `card-payment@1`, `card-sale@1`, `voucher-sale@1`,
`card-sale-online@1` and `voucher-sale-online@1`. An app copies the files it adopts and holds its tables to
them with `shapeFit` (`src/testing/fit.ts`) in its own suite.

## Selling a gift card

A line sells a card in one of two ways.

**At a till** (`card-sale@1`). A cashier makes the card first and the line
names it (`gift_card_id`). When the order is paid, `issue` loads the card and
makes it active, and its mail goes out; when the order is cancelled, the
sale's reverse takes back what is still on the card and tells staff to check
when some of it was spent.

**Online** (`card-sale-online@1`). Nobody can make a card for a shopper, and a
host is never handed the key of a row Offers makes, so the sale makes it. The
line carries what the card needs (`to_name`, `to_email`, `message`, `sender`,
`language`) and the amount, and two postings:

- `issue`, with three phases. **Reserve**, when the order is written: a card is
  made, inactive and holding nothing, for the recipient, and it names the line
  that made it (`gift_cards.source_table`, `source_row`). Cards paused, the
  least and the most a card is sold for, an address that is none and a message
  with more than 20 digits are refused here, before anything is paid.
  **Post**, when the order is paid: the card is loaded, made active and mailed
  once — what was judged at the reserve is not judged again. A post set off by
  a guest's own save is refused (`not-allowed`): a guest never pays by saving,
  the money is recorded by the payment's own path or by staff, and a card made
  active from the public door would be a card nobody paid for. A line that
  sold a card and finds none made in its round (posted again after a cancel,
  or a rule with no reserve) loads nothing and tells staff to check. **Reverse**, when
  the order is cancelled: a card whose order was never paid is cancelled
  (`void`) and nobody is told; a paid order's card is left for the recall.
- `recall` (post only), named by the line itself (`{"row": true}`), fired by
  the same cancel. It takes the card's own lock — the one a payment by the
  card takes — so a spend and a recall take turns. It is refused (`used-up`,
  with what is left) when the card has paid for anything — read from its
  payments, not its balance, so a top-up since or a manager cancelling a spent
  card by hand hides nothing — or, still in use, holds less than the sale put
  on it: the order's money cannot then go back. A card cancelled or run out by
  its last day with nothing spent passes and writes nothing. A card spent and
  then run out is refused like any spent card: staff refund by hand what they
  judge is owed. Otherwise what is on the card is written
  off, the card is cancelled with a reason (the host may map its own to
  `reason`), and a recipient who was sent the card gets the "cancelled" mail.

Every reverse of a save runs before its posts, so the two must fire on the
same cancel. **A host that does not post `recall` on that cancel — on a later
save, or not at all — leaves a paid, cancelled order's card alive**, with its
money given back.

**A card's amount is never a guest's value.** The line copies it from the
shop's own row (a price the shopper picks); a public entry that lets a guest
write it sells a card of any worth for whatever the order charges. The fit
check says so. A host that gives a
card's balance no page (`outbox.pages.app.balance`) still prints the mail's
"Ask at the counter for your balance."; a shop that sells cards online names
its balance page.

A shopper's line may carry `send_on`, the day the card is to be sent. It is
judged when the order is written: not a past day, not over a year ahead, and not
after the last day a card sold today would have.

Offers cannot tell from a payment whether the order it pays holds a gift card:
`spend` pays what the host maps to `due`. To keep a card from paying for a
card, map `due` to what is due for goods, or refuse card payments on such an
order with the posting's own `refuses`.

## Selling a pack online

`voucher-sale-online@1`. The line carries what the pack is (`sale_amount`,
`pack_name`, `pack_uses`, `pack_what`, a link to what it covers), all copied from
the shop's own row, and who holds it, from the signed-in customer. A guest
writes none of them; the fit check says so.

- `sell-pack`. **Reserve**, when the order is written: nothing is made, and
  everything is judged. A guest's order must have proved who is buying
  (`proved`: a column Adminium attests, or that only a verified, claimed create
  sets). **Post**, when it is paid: the pack is made, sold, in the holder's name,
  and its mail goes once. An unpaid order that is cancelled has made nothing.
- `recall-pack`, fired by the same cancel, under the pack's lock. It is refused
  (`used-up`) once any use stands, held or counted. A use given back no longer
  counts. Otherwise the pack is cancelled. Its `reverse` fires when the order is
  paid, so a cancel, a new payment and a second cancel each recall their pack.

**A pack's money goes back through the cancel, and no other way.** A refund row
that does not cancel the order runs no recall, so the pack would stay usable. A
host keeps the refund of a pack sale behind the cancel.

## What a signed-in customer holds

Two reads on the app's key, for a verified session: the packs and vouchers held
in the address it proved, and the gift cards sent to it. Each shows a name, what
is left, the last day and the code's last four characters, and never a code. A
card dated for a later day is neither listed nor spent online before that day.

To spend one, the page sends `held:<id>` where a code goes. Adminium finds a
voucher only if it has a holder, and Offers then holds it to the proved customer.
It finds a card only if the host's `lookup` names `held: "recipient_email"` and
that column holds the address the session proved. Anybody else is answered as
for a code nobody knows.

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

Five emails: a gift card, credit, a voucher with a name on it, a reminder
before a card's last day, and a word to a card's recipient when the shop
cancels it with its sale. A card dated for a day is sent that morning. A card
sold online is told to be typed at checkout; one sold at a till, shown at the
counter. A card
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
