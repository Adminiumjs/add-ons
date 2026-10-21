# Card payments

**Connects to Stripe.** Your customers pay an invoice, or any record with an
amount, by card and the other ways your Stripe account offers, on the Stripe
page. The payment is recorded in Adminium, against the record, the moment
Stripe says it went through.

Adminium is software you run. You are the seller: the account, the keys and
the money are yours, and Adminium is not a party to any payment. The customer
pays on the Stripe page, so no card number ever reaches your server.

## What it needs

- A Stripe account in one of the countries Stripe serves sellers in.
- Adminium 0.3.32 or newer, on an address your customers can reach.
- A **restricted key** (`rk_test_…` / `rk_live_…`), never a secret key. Make it
  with the private app template Studio offers (the way Stripe recommends), or by
  hand in the Stripe dashboard with exactly these permissions:

  | Permission | Why |
  |---|---|
  | Checkout Sessions: write | start a payment; end one that is no longer needed |
  | Checkout Sessions: read | read how a payment ended |
  | PaymentIntents: read | the amount taken |
  | Charges and Refunds: write | give refunds (in Stripe this access also allows changing charges) |
  | Events: read | find a payment whose webhook went missing |
  | Disputes: read | show disputes |
  | Payment Method Configurations: read | show the ways to pay you switched on |
  | Accounts: read | show which Stripe account the key belongs to |
  | Webhook endpoints: read (optional) | check your live webhook |

- A **webhook endpoint** per mode in the Stripe dashboard, pointing at the
  address Studio shows, and its signing secret (`whsec_…`).

Set it up in **Studio → Payments**. Everything you type there is kept
encrypted, per mode, and can be replaced without disconnecting.

## What it does not do

It holds no money, takes no fee and keeps no card. It never sends a customer
anywhere but the Stripe page. Payments in BHD, JOD, KWD, OMR, TND and UGX are
held until it is checked how Stripe takes them.

## Trademarks

Stripe and Link are trademarks of Stripe, Inc., named here only to say which
service this add-on connects to. Adminium is not affiliated with Stripe. See
[TRADEMARKS.md](./TRADEMARKS.md).

## Licence

AGPL-3.0-only.
