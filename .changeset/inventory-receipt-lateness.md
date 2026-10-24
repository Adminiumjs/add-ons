---
'@adminium/add-on-inventory': patch
---

Inventory: a receipt now says whether its delivery came late. Each receipt keeps the day its purchase order expected the delivery ("Expected on", taken from the order when the receipt is made), the day it came in ("Received on", set when the receipt is posted), and "Late": 1 when it came after the expected day, 0 when it came on or before it. "Days late" says by how many days. A receipt with no order behind it, such as opening stock, says nothing in either, and neither does a receipt posted before this update, so it is never counted as on time. The sample's order now comes in two deliveries, one on the day expected and one two days late.
