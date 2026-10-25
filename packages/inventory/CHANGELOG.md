# @adminium/add-on-inventory

## 1.0.14

### Patch Changes

- ae1423c: Inventory: a receipt now says whether its delivery came late. Each receipt keeps the day its purchase order expected the delivery ("Expected on", taken from the order when the receipt is made), the day it came in ("Received on", set when the receipt is posted), and "Late": 1 when it came after the expected day, 0 when it came on or before it. "Days late" says by how many days. A receipt with no order behind it, such as opening stock, says nothing in either, and neither does a receipt posted before this update, so it is never counted as on time. The sample's order now comes in two deliveries, one on the day expected and one two days late.

## 1.0.13

## 1.0.12

### Patch Changes

- 192042b: Offers gives Automations a step, "Issue a voucher": a rule says who it is for and what it is worth, and the voucher's own email carries the code. Offers and Inventory tell the assistant what their tables are and offer questions on their pages. Both need Adminium 0.3.22.

## 1.0.11

### Patch Changes

- ee8a401: Inventory: a count no longer runs its counter out of requests. Typing a line re-read six lists; it now re-reads the three a count can change, and a post that meets "too many requests" waits and goes on by itself.

## 1.0.10

## 1.0.9

## 1.0.8

### Patch Changes

- 7abe23e: Inventory: stock by place and by batch — received, counted, moved and ordered — and taken by the rows of your own tables in the same save. Works with no app. Eight languages, sample data, four automations, three roles.
