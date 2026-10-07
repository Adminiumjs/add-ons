# Inventory

Keeps stock for a business that already runs on its own tables: what is on
hand, where, in which batch, and what it cost. The rows of your own tables —
an order line, a visit, a booked room — take from it, hold it and give it back
in the same save that writes them, or the save writes nothing.

Nothing is fetched from anywhere and no account is needed.

## What it keeps

- **Items**, with a unit, a reorder level and an average cost.
- **Places** stock is kept in, and how much of each item is in each.
- **Batches**, with an expiry date where the item has one. The earliest
  expiry is used first.
- **Movements**: every change of a quantity, with what caused it.

## How your tables use it

An app says, in its own manifest, which of its rows use stock and when: a line
holds two bottles while its order is open, takes them when the order is paid
and gives them back when it is cancelled. Adminium asks this add-on which rows
that makes, checks the answer and writes it with the order. The add-on decides;
Adminium reads and writes.

It attaches to no app in particular, and works with none at all: stock can be
received, counted and moved from its own screens.

## The file that decides

`dist/server.js` implements the `posting-rows@1` contract. It is one classic
script with no `import` and no `require`. It is pure: no clock, no randomness,
no network. The moment a posting is made is handed to it as text, so the same
input always gives the same answer.

## Building it

```bash
npm run build       # dist/server.js
npm test            # the manifest, the built bytes and the release sweep
```
