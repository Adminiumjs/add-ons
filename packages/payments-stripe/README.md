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
- Adminium 0.3.33 or newer, on an address your customers can reach.
- A **restricted key** (`rk_test_…` / `rk_live_…`), never a secret key. Make it
  with the private app template Studio offers (the way Stripe recommends), or by
  hand in the Stripe dashboard with exactly these permissions. The names are
  the ones on the Stripe form for a restricted key: Checkout Sessions and
  Webhook Endpoints, Event Destinations are groups of their own, Accounts is
  under Connect (set "In your account" to Read), and the rest are in the Core
  list.

  | Permission | Why |
  |---|---|
  | Checkout Sessions: write | start a payment; end one that is no longer needed |
  | Checkout Sessions: read | read how a payment ended |
  | Payment Intents: read | the amount taken |
  | Charges and Refunds: write | give refunds (in Stripe this access also allows changing charges) |
  | Events: read | find a payment whose webhook went missing |
  | Payment Disputes: read | show disputes |
  | Payment Method Configurations: read | show the ways to pay you switched on |
  | Accounts: read | show which Stripe account the key belongs to |
  | Webhook Endpoints, Event Destinations: read (optional) | check your live webhook |

- A **webhook endpoint** per mode in the Stripe dashboard, pointing at the
  address Studio shows, and its signing secret (`whsec_…`).

Set it up in **Studio → Payments**. Everything you type there is kept
encrypted, per mode, and can be replaced without disconnecting.

## Set it up

Do it first in test mode (a Stripe sandbox), make a test payment, then do the
same in live mode. Studio keeps a checklist of the steps, so you can stop and
come back.

### 1. The restricted key

**With your own Stripe App (the way Stripe recommends).** A small private app
that shows nothing in your Stripe dashboard; installing it gives you a
restricted key with exactly the access above.

1. In Studio → Payments → Card payments, choose "With your own Stripe App" and
   download the app template. It is made for your shop: its id is yours alone.
2. You need the Stripe command-line tool 1.25.0 or newer with its `apps`
   plugin 1.19.0 or newer, Node 22 or newer, and pnpm 10.
3. Run `stripe apps create key-app` once, then copy the template's
   `stripe-app.json` over the one it made.
4. Signed in to your sandbox (`stripe login`), run `stripe apps upload` in that
   folder, then install the app in the sandbox from the Stripe dashboard.
5. In the installed app, open "View API keys", copy the key that starts with
   `rk_test_` and paste it into the test key field in Studio. Studio checks it
   at once and names any access it lacks.
6. For live payments, sign in to your live account and run `stripe apps upload`
   again (an upload belongs to one account), install it there, and copy the
   `rk_live_` key. Stripe shows a live key once: copy it at once.

The template folder carries the same steps in its own README. If "View API
keys" shows only a publishable key, the install has no restricted key: upload
a new version or install the app again.

**By hand in the Stripe dashboard (no terminal).**

1. In the Stripe dashboard, open Developers → API keys and choose "Create
   restricted key".
2. Name it (for example "Payments for my shop") and give it exactly the access
   in the table above; leave everything else at None.
3. Create it, copy the key (`rk_test_…` in a sandbox, `rk_live_…` in live mode)
   and paste it into Studio.

A secret key (`sk_…`), a publishable key (`pk_…`) or a signing secret
(`whsec_…`) in the key field is refused, and so is a live key in the test field
or the other way round.

### 2. The webhook, one per mode

1. Studio shows the address for each mode. In the Stripe dashboard, open
   Developers → Webhooks and add a destination for events on your account.
2. Paste the address, choose the **Snapshot** payload, and tick these events
   (Studio lists them with copy buttons): `checkout.session.completed`,
   `checkout.session.async_payment_succeeded`,
   `checkout.session.async_payment_failed`, `checkout.session.expired`,
   `refund.created`, `refund.updated`, `refund.failed`, `charge.refunded`,
   `charge.dispute.created`, `charge.dispute.closed`.
3. Open the destination, reveal its signing secret (`whsec_…`) and paste it
   into the webhook field for that mode. A secret printed by `stripe listen` is
   a different one and does not work here.

Studio ticks the webhook step when the first signed event arrives.

### 3. A test payment

In Studio → Payments, "Send a test payment" opens the pay page for a pretend
invoice of one unit in a new tab. Use the Stripe test card
`4242 4242 4242 4242`, any date in the future and any three digits. Back in
Studio you see what Stripe took, that the webhook arrived, and what would have
been recorded. Nothing is written to your tables.

### 4. Going live

Save and check the live key, add the live webhook, then switch Card payments
to live in Studio. Until the first live event arrives, Studio says the live
webhook is not proven yet and checks for payments more often. Test links stop
working when you go live.

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
