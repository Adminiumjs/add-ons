---
'@adminium/add-on-barcode-labels': patch
'@adminium/add-on-design-studio': patch
'@adminium/add-on-holiday-calendars': patch
'@adminium/add-on-import-canva': patch
'@adminium/add-on-personalizer': patch
'@adminium/add-on-shipping-dhl': patch
---

`addOn.attaches` now names the app versions that ship. Every range said `^1.0.0`, a major no app has reached: apps are 0.x and patch-only, so each range is now the minor line its app ships on — `^0.2.0` for Clinic Desk, `^0.1.0` for every other app.
