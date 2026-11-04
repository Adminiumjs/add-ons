/**
 * THE FILE THAT ANSWERS THE DESIGN QUESTION (`design-check@1`).
 *
 * An app's order line that names a customer's design is saved only when this
 * says the design may be ordered as it is; and the features it says the
 * design takes must be the features the line pays for. Adminium reads the
 * design and what the manifest's `addOn.checker` names for it, hands them in,
 * and checks the answer.
 *
 * It is the customer's editor's own rules (`src/rules/`), run on the rows
 * Adminium read: so what the customer was told in the browser is what the
 * order is held to. It reads nothing, keeps no clock and touches no network:
 * Adminium runs it in a bare context with none of them, at most 250 ms.
 */
import { check } from './question/answer.ts';
import { rows } from './versions/snapshot.ts';

/** And `posting-rows@1`: the version an order line snapshots when it orders a design (`versions/snapshot.ts`). */
export default { check, rows };
