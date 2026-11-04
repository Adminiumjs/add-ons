/**
 * WHAT AN ORDER LINE POSTS WHEN IT ORDERS A DESIGN.
 *
 * A shop app's order line that names a customer's design posts it into this
 * ledger when the line is made (its manifest's `postings`, into
 * `{ addOn: "customiser", ledger: "designs", action: "order" }`, mapping
 * `design` to the line's design link). In the same save, Adminium writes
 * what the Customiser's code answers: the design's first version, a copy of
 * what the customer chose that no later change reaches, which the shop
 * proofs and makes from; and the design itself marked ordered, so its own
 * link reads it and never changes it again (the link changes a draft only).
 *
 * A design ordered again (a second line, a repeat order) gets no second
 * version while nothing in it changed: the version the shop proofed stands.
 */
export const LEDGER = {
  id: 'designs',
  // A guest whose design cannot be snapshotted hears it is not available any more.
  refusal: 'stock',
  receipts: 'postings',
  writes: {
    design_versions: { insert: ['app', 'design_id', 'version', 'values', 'note'] },
    designs: { update: { by: ['id'], set: ['state'] } },
  },
  actions: {
    order: {
      inputs: { design: 'link' },
      phases: ['post'],
      reads: [
        { as: 'design', table: 'designs', by: [{ column: 'id', from: 'input.design' }] },
        { as: 'versions', table: 'design_versions', by: [{ column: 'design_id', from: 'input.design' }] },
      ],
      locks: [{ read: 'design', column: 'id', table: 'designs' }],
    },
  },
} as const;

/** The ledger, its action and the input an app's posting names. */
export const POSTING_INTO = { addOn: 'customiser', ledger: LEDGER.id, action: 'order' } as const;
