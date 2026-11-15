# Card readers

**Connects to Square.** The till puts the amount on a Square Terminal at your
counter, the customer taps or inserts a card (and adds a tip, if you let
them), and the payment is recorded in Adminium against the record, once
Square says it went through.

Adminium is software you run. You are the seller: the account, the access
token and the money are yours, and Adminium is not a party to any payment.
The card is read by the Terminal and goes to Square, so no card number reaches
your server.

If you take card payments online with Stripe, you need not install this: the
Card payments add-on runs Stripe readers with the same key. Square is
not offered to sellers in every country (in Germany, for one, it is not); where
it is not, use a Stripe reader.

## What it needs

- A **Square account** in a country where Square sells Square Terminal (the
  United States, Canada, the United Kingdom and Australia among them; the Square
  pages list where).
- A **Square Terminal**, on the shop's network.
- Adminium 0.3.60 or newer. It is installed once for the whole server. Readers
  are asked from the server, every second while a charge is on one, so the
  server needs no public address for it.
- An **application** in the Square Developer Console. Its **access token**
  goes into Studio: the sandbox token for test payments, the production token
  for live ones. A personal access token opens the whole Square account (Square
  has no narrower token for an application of your own), so keep it in Studio
  and nowhere else, and make a new one in the Console if it ever leaks.

## Set it up

1. In the Square Developer Console, open your application and copy its access
   token for the mode you set up (Sandbox or Production).
2. In **Studio → Payments**, connect **Card readers** and paste the token for
   that mode. **Check** says whose account it is.
3. In **Payments → Card readers**, choose **Pair a reader**, give it a name
   ("Front counter") and choose Next. Studio shows a code.
4. On the Square Terminal, sign in with a device code and type that code.
   Choose **Done** in Studio once the Terminal shows it is signed in.
5. Each till picks its reader in its own settings.

The code lasts a few minutes; if it runs out, start the pairing again.

## At the till

The till sends the amount to the reader. The Terminal asks for a tip when the
till allows one, then for the card. The till shows what was taken: the tip
apart, the card's brand and last four digits. If the customer cancels on the
Terminal, or nobody takes the payment within five minutes, the charge ends
with the reason Square gives and nothing is taken. Cancelling from the till takes the
amount off the Terminal; a card tapped a moment before the cancel is a payment
and is recorded as one.

A card that is declined does not end the charge: the Terminal lets the
customer try another card.

## Refunds

A refund made in Adminium goes back through Square to the card. An **Interac**
payment (Canada) can only be refunded on the Terminal with the card, so it is
refused here: give it back in cash or store credit. Refunds and disputes made
in the Square Dashboard are read every few minutes and shown in Payments →
Activity.

## Good to know

- **Unpairing.** Square has no way to unpair a Terminal from outside it.
  Unpairing in Studio forgets the reader here; sign the Terminal out on the
  device itself.
- **Square keeps a Terminal checkout for 30 days.** Adminium keeps its own copy
  of what was taken, so older payments still read in full.
- **Test mode.** In the sandbox, Square cannot pair a real Terminal. The test
  device ids Square documents stand in for one (each gives one outcome); the
  add-on's own tests run against them.

## Licence

AGPL-3.0-only. See `LICENSE` and, for the marks this add-on names,
`TRADEMARKS.md`.
