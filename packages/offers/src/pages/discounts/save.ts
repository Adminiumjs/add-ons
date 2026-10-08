/**
 * SAVING A DISCOUNT.
 *
 * A new one is one save: the offer with its steps, its targets and its first
 * code, made together or not at all. One that exists is changed row by row —
 * the offer first, then each list — because the page kit saves a tree only
 * when it makes one; a refusal part-way says so and what was saved stays.
 *
 * A typed code is first shown to Adminium, which says whether it is taken
 * and what it reads like. A code somebody else has stops the save; one that
 * only LOOKS like another is a warning, and the save goes on.
 */
import { api, type DataRow, type DataValue, type TreeNode, type WriteResult, type Writes } from '../shared/host.ts';
import { codeWord, keptSteps, keptTargets, offerValues, stepValues, targetValues, type Form, type Stored } from './form.ts';

export interface CodeSaid {
  code: string;
  taken?: boolean;
  lookAlikes?: readonly { code: string; name: string }[];
}

/** Ask Adminium about a word, or — with none — for a code of its own making. */
export const askCode = (word?: string): Promise<CodeSaid> => api.post<CodeSaid>('/api/v1/add-ons/offers/codes/make', word === undefined ? {} : { word });

export interface Savers {
  tree: { create: (tree: TreeNode) => Promise<WriteResult> };
  offers: Writes;
  steps: Writes;
  targets: Writes;
  codes: Writes;
}

export type Saved = { ok: true; row: DataRow; lookAlike: { code: string; name: string } | null } | { ok: false; taken: true };

const keyOf = (id: string): string | number => (/^\d+$/.test(id) ? Number(id) : id);

/** A list of rows brought to what the form holds: the gone removed, the kept changed, the new made. */
async function bring<Row extends { id?: string }>(writes: Writes, parent: DataValue, had: readonly string[], now: readonly Row[], values: (row: Row) => Record<string, DataValue>): Promise<void> {
  const keeping = new Set(now.flatMap((row) => (row.id === undefined ? [] : [row.id])));
  for (const id of had) if (!keeping.has(id)) await writes.remove(keyOf(id));
  for (const row of now) {
    if (row.id === undefined) await writes.create({ offer_id: parent, ...values(row) });
    else await writes.update(keyOf(row.id), values(row));
  }
}

export async function saveDiscount(savers: Savers, form: Form, stored: Stored): Promise<Saved> {
  const typed = form.trigger === 'code' ? codeWord(form.code) : '';
  let lookAlike: { code: string; name: string } | null = null;
  // A code is asked about only when it is a new one for this discount.
  if (typed !== '' && typed !== codeWord(stored.code)) {
    const said = await askCode(typed);
    if (said.taken === true) return { ok: false, taken: true };
    lookAlike = said.lookAlikes?.[0] ?? null;
  }
  if (stored.id === null) {
    const reply = await savers.tree.create({
      values: offerValues(form),
      children: {
        offer_breaks: keptSteps(form).map((step) => ({ values: stepValues(step) })),
        offer_targets: keptTargets(form).map((target) => ({ values: targetValues(target) })),
        ...(typed === '' ? {} : { codes: [{ values: { code: typed } }] }),
      },
    });
    return { ok: true, row: reply.row, lookAlike };
  }
  const id = keyOf(stored.id);
  const reply = await savers.offers.update(id, offerValues(form));
  await bring(savers.steps, id, stored.steps, keptSteps(form), stepValues);
  await bring(savers.targets, id, stored.targets, keptTargets(form), targetValues);
  if (typed !== '' && typed !== codeWord(stored.code)) {
    if (stored.codeId === null) await savers.codes.create({ offer_id: id, code: typed });
    else await savers.codes.update(keyOf(stored.codeId), { code: typed });
  }
  return { ok: true, row: reply.row, lookAlike };
}
