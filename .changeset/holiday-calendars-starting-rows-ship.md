---
"@adminium/add-on-holiday-calendars": patch
"@adminium/add-on-forms": patch
"@adminium/add-on-inventory": patch
"@adminium/add-on-offers": patch
---

The starting rows of the `holidays` table (`seeds/holidays.json`) now ship in the Holiday Calendars package. 1.0.16 and 1.0.17 left the file out, so installing it, alone or with an app that includes it, stopped at the seeds stage (`APP_INSTALL_INCOMPLETE`). Every package now ships each file its manifest names, read from the manifest itself. Forms, Inventory and Offers ship the same files as before; their package lists the one sample file by name instead of the whole `seeds` folder.
