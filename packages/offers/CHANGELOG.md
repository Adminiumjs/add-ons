# @adminium/add-on-offers

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
