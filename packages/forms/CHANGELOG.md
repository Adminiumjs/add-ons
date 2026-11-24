# @adminium/add-on-forms

## 1.0.37

### Patch Changes

- 4bb04fd: Forms opens its forms, invitations and answers to the app roles that grant them again, which 1.0.33 had closed. An app's role reads what a form is and where it stands, who was asked about which row and when, and when an answer came and what it became; never an address, a name, a person, a token or the answers themselves.

## 1.0.36

## 1.0.35

## 1.0.34

### Patch Changes

- 7660736: On a survey with "Link answers to names" off, the Invitations screen says that a person answered and shows no date. Adminium keeps no answering time for these invitations, so that an answer cannot be matched to the person it came from. A record's Survey tab now says Answered or Not yet for every survey, with no date; a named survey's exact date stays on its Invitations screen.
- e2b7270: Google reviews, a new add-on: a business's own Google reviews, loaded in the visitor's browser in a sandboxed page, never stored. Offers sells packs online (`voucher-sale-online@1`), sends a gift card on a date, and lets a signed-in customer read and spend what they hold without a code in the browser. Forms has a fifth hide reason, "The author asked", and the fourth now reads "Names someone who isn't on our team". Holiday Calendars attaches to Bookings.

## 1.0.33

### Patch Changes

- 98c620f: Forms keeps customers' reviews. A reviews table of its own (stars, title, words, the name shown, waiting, published or hidden with a reason, and the shop's reply) and the totals of each thing reviewed, counted from the published reviews by Adminium. An app takes a review through its own `review` word; its roles read and moderate their app's reviews only; its pages read the published reviews (ten a page, newest first, by the thing) and the totals through the app's own key. Needs Adminium 0.3.68.

## 1.0.32

## 1.0.31

### Patch Changes

- 9a97ad2: Forms: after sending, a form can go to one of your own landing pages ("Go to a landing page"), picked from the live pages of a landing pages add-on installed beside it. The form keeps the page by its key, so a new address or host never breaks it; Publish says so when the page is not live. Offered with a live landing page; forms stored before read as they always did. Forms now needs Adminium 0.3.65 or newer: an older one refuses a form that ends on a landing page.

## 1.0.30

### Patch Changes

- 4ef8848: Forms now needs Adminium 0.3.42 or newer, the first release that judges a survey's consent on the person it goes to rather than on the invitation row.
- b3721e6: Forms: on Adminium 0.3.64 or newer the answers list follows new answers as they are written, and the builder's blocked cards say when this server cannot tell whether visitors come through a proxy or a load balancer (they would see "not available" until the server trusts it). An older Adminium shows both as before.

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

### Patch Changes

- Forms & surveys: forms and surveys whose pages Adminium draws for strangers, with answers, results and survey invitations.
