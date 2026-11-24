# @adminium/add-on-offers

## 1.0.36

## 1.0.35

## 1.0.34

### Patch Changes

- e2b7270: Google reviews, a new add-on: a business's own Google reviews, loaded in the visitor's browser in a sandboxed page, never stored. Offers sells packs online (`voucher-sale-online@1`), sends a gift card on a date, and lets a signed-in customer read and spend what they hold without a code in the browser. Forms has a fifth hide reason, "The author asked", and the fourth now reads "Names someone who isn't on our team". Holiday Calendars attaches to Bookings.
- 0f10fb4: "Delete my details" now reaches packs, gift cards and store credit. One with no balance left loses its holder's name and email. One with a balance keeps them so its holder can still use it, and loses them once it is used up or expires. Reminders stop for a kept gift card.

## 1.0.33

### Patch Changes

- 40a3b9c: Offers sells gift cards online. A shopper's line makes its own card: `issue` takes the recipient's name, address, message, the sender and a language, and gains a reserve phase — the card is made inactive when the order is written, loaded, made active and mailed once when it is paid, and cancelled when the order is given up unpaid. A new action, `recall`, named by the selling line and under the card's own lock, cancels a paid order's card while it is unspent and refuses with what is left when any of it was spent — read from the card's payments, so a top-up or a cancel by hand hides nothing — so a spent card's order cannot be refunded. A guest's own save never makes such a card active. The new `card-sale-online@1` shape carries both postings; a card sold online is told to be typed at checkout, and its recipient is mailed when the shop cancels it, in eight languages. A till's cards are sold, loaded and taken back as before.

## 1.0.32

## 1.0.31

## 1.0.30

## 1.0.29

## 1.0.28

## 1.0.27

## 1.0.26

## 1.0.25

## 1.0.24

## 1.0.23

## 1.0.22

## 1.0.21

## 1.0.20

## 1.0.19

## 1.0.18

### Patch Changes

- 806631b: The starting rows of the `holidays` table (`seeds/holidays.json`) now ship in the Holiday Calendars package. 1.0.16 and 1.0.17 left the file out, so installing it, alone or with an app that includes it, stopped at the seeds stage (`APP_INSTALL_INCOMPLETE`). Every package now ships each file its manifest names, read from the manifest itself. Forms, Inventory and Offers ship the same files as before; their package lists the one sample file by name instead of the whole `seeds` folder.

## 1.0.17

## 1.0.16

### Patch Changes

- 9c9a52f: Built and tested against the published Adminium 0.3.43 packages (manifest, add-on contracts, public client, tokens, i18n and the dashboard's parts). Nothing changes for a shop.

## 1.0.15

## 1.0.14

## 1.0.13

## 1.0.12

### Patch Changes

- 192042b: Offers gives Automations a step, "Issue a voucher": a rule says who it is for and what it is worth, and the voucher's own email carries the code. Offers and Inventory tell the assistant what their tables are and offer questions on their pages. Both need Adminium 0.3.22.

## 1.0.11

## 1.0.10

### Patch Changes

- e0aa128: Money given back to a gift card from a payment, taken back after that payment itself was undone, is no longer taken off the card a second time. Undoing the payment already gave the card everything it took; in either order the card now ends with all of it. Before, voiding the payment first and the give-back second left the card short by what had been given back.

## 1.0.9

### Patch Changes

- a310355: Offers & gift cards: discounts, codes, vouchers, packs and gift cards, worked out and recorded in the same save as the order they belong to. An offer by itself or by a typed code; a staff discount with a reason and a ceiling for each role; a gift card sold, loaded, spent and given back to, with every movement kept. Works with no app, and fits an app's own orders, lines and payments. Eight languages, sample data, three roles.
