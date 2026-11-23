# Shipping labels

**Connects to Shippo.** Staff compare your carriers' rates on an order, buy the
label once, download it and follow the parcel.

Adminium is software you run. The Shippo account, its key and its charges are
yours, and Adminium is not a party to any purchase. Each shop uses its own
account: Shippo's terms do not allow one account to be shared between businesses.

Adminium is not affiliated with Shippo.

## What it needs

- A Shippo account of your own, and its API key. A test key (`shippo_test_…`)
  makes sample labels at no charge, and nothing can be delivered on them.
- Adminium 0.3.72 or newer.

## What leaves your server

- To Shippo and the carrier you choose: both addresses and the parcel's size
  and weight.
- Inside one country, the customer's phone and e-mail are **not** sent.
- The key goes to `api.goshippo.com` only. Label files come from a signed
  address on `deliver.goshippo.com`, which never receives the key.

## Tracking updates

Tracking updates reach Adminium through a webhook address you paste into Shippo.
The address holds a secret token, because Shippo's webhook setup has no header
option. Adminium keeps it out of its own logs. **A reverse proxy in front of
Adminium may write full addresses to its access log**, so turn that off for this
path or keep that log private.

## What Shippo's test mode showed (2026-11-23)

- Buying the same rate twice makes two labels, so Adminium keeps its own booking
  record and never repeats a purchase.
- A failed label answers HTTP 201 with `status: ERROR`.
- Test tracking numbers repeat, and only Shippo's sample numbers can be tracked.
- USPS refused a street written in Arabic, with no reason given. An Arabic or
  Cyrillic name was accepted. Evri accepted Cyrillic and Chinese addresses.
  Real carriers may behave differently.

Not proved in test mode: live prices, which live carriers a shop outside the US
gets, and how a live carrier treats a refund.
