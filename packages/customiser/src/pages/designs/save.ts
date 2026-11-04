/**
 * "SAVE THE DESIGN": the draft's changes written to the four tables a
 * ready-made design lives in, and the draft as it now stands in them.
 *
 * The writes go in an order no row can refuse: the design's own row, then
 * its parts (gone, changed, new), then its palettes (a gone palette's
 * colours before the palette, a new palette before its colours). Each reply
 * hands back the row as it was saved, so the editor carries on from what was
 * written, the new rows with their ids, without reading anything again.
 */
import { useWrite } from '../shared/host.ts';
import { changesOf, partOf, ROLES, type DesignDraft, type Role } from './draft.ts';

export function useSaveDesign(): (before: DesignDraft, now: DesignDraft, app: string | null, roleNames: Readonly<Record<Role, string>>) => Promise<DesignDraft> {
  const designs = useWrite('ready_designs');
  const parts = useWrite('ready_parts');
  const palettes = useWrite('palettes');
  const colours = useWrite('palette_colours');
  return async (before, now, app, roleNames) => {
    const changes = changesOf(before, now, app, roleNames);
    if (changes.design !== null) await designs.update(now.id, changes.design);
    for (const id of changes.parts.remove) await parts.remove(id);
    for (const [id, values] of changes.parts.update) await parts.update(id, values);
    // The new parts, in the order they are drawn, each swapped for the row it became.
    const saved = [...now.parts];
    let next = 0;
    for (const [index, part] of now.parts.entries()) {
      if (part.id !== null && before.parts.some((one) => one.key === part.key)) continue;
      const values = changes.parts.create[next];
      next += 1;
      if (values === undefined) continue;
      const { row } = await parts.create(values);
      saved[index] = partOf(row);
    }
    for (const id of changes.palettes.remove) {
      const gone = before.palettes.find((palette) => palette.id === id);
      for (const role of ROLES) {
        const colour = gone?.colourIds[role];
        if (colour !== undefined) await colours.remove(colour);
      }
      await palettes.remove(id);
    }
    for (const [id, values] of changes.palettes.update) await palettes.update(id, values);
    for (const [id, values] of changes.colours.update) await colours.update(id, values);
    const placed = [...now.palettes];
    for (const made of changes.palettes.create) {
      const { row } = await palettes.create(made.values);
      const ids: Partial<Record<Role, string | number>> = {};
      for (const values of made.colours) {
        const { row: colour } = await colours.create({ ...values, palette_id: row['id'] as string | number });
        ids[values['role'] as Role] = colour['id'] as string | number;
      }
      const at = placed.findIndex((palette) => palette.key === made.key);
      if (at >= 0) placed[at] = { ...placed[at]!, key: `row:${String(row['id'])}`, id: row['id'] as string | number, colourIds: ids };
    }
    for (const values of changes.colours.create) {
      const { row } = await colours.create(values);
      const at = placed.findIndex((palette) => String(palette.id) === String(values['palette_id']));
      if (at >= 0) placed[at] = { ...placed[at]!, colourIds: { ...placed[at]!.colourIds, [values['role'] as Role]: row['id'] as string | number } };
    }
    return { ...now, name: changes.design?.['name'] === undefined ? now.name : String(changes.design['name']), parts: saved, palettes: placed };
  };
}
