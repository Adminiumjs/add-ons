---
'@adminium/add-on-inventory': patch
---

Inventory: a count no longer runs its counter out of requests. Typing a line re-read six lists; it now re-reads the three a count can change, and a post that meets "too many requests" waits and goes on by itself.
