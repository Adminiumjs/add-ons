---
"@adminium/add-on-holiday-calendars": patch
---

Add an England and Wales bank-holiday set (`GB`, region `england-and-wales`) for 2026 and 2027, with the substitute weekday the statute names when New Year's Day, Christmas Day or Boxing Day falls at the weekend, and its rows in the `holidays` seed (150 rows). Starting rows are written into an empty table only, so an install that already holds the table does not gain them.
