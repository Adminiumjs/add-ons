# @adminium/add-on-forms

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
