# @adminium/add-on-forms

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
