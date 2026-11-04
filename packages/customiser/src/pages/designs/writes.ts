/**
 * THE DESIGNS LIST'S OWN WRITES: a new design, a copy, a design moved up or
 * down, shown or hidden, and deleted. Each is made at once, as the comps'
 * list does; only the editor keeps a draft.
 *
 * - A new design starts hidden, named "New design" (Marlow's `newDesign`,
 *   Birch Row F17): a page with its paper and a name, a palette and a
 *   layout; a piece with a part for each of the base's areas.
 * - A copy is hidden until it is shown (Marlow D8): nothing half-made reaches
 *   a customer. It copies the parts, the palettes and their colours.
 * - Moving renumbers the list, so two designs never share a place.
 * - Deleting asks first. A design a customer has made something from stays
 *   (their order keeps its copy, and so does the design they saved): the
 *   page says so and offers Hide. Its colours, palettes and parts go before
 *   it, so nothing is left pointing at it.
 */
import { listAll, useRead, useWrite, type DataRow } from '../shared/host.ts';
import { num, text } from '../setup/facts.ts';
import { partOf, partValues, startParts, ROLES, type FaceFacts, type PartDraft, type Role } from './draft.ts';

export class InUse extends Error {}

/** A JSON column as text to write back, whether the read handed it parsed or as text. */
const jsonColumn = (value: unknown): string | null => (value === undefined || value === null || value === '' ? null : typeof value === 'string' ? value : JSON.stringify(value));

export function useDesignWrites(base: DataRow) {
  const designs = useWrite('ready_designs');
  const parts = useWrite('ready_parts');
  const palettes = useWrite('palettes');
  const colours = useWrite('palette_colours');
  const read = useRead();
  const app = text(base['app']) === '' ? null : text(base['app']);

  /** Every design of the base in its place, written where its place changed. */
  const renumber = async (ordered: readonly DataRow[]): Promise<void> => {
    for (const [index, row] of ordered.entries()) if (num(row['position']) !== index + 1) await designs.update(row['id'] as string | number, { position: index + 1 });
  };

  /** The palettes a design owns, with their colours, made for another design. */
  const copyPalettes = async (from: readonly DataRow[], fromColours: readonly DataRow[], to: string | number): Promise<void> => {
    for (const palette of from) {
      const { row } = await palettes.create({ app, ready_design_id: to, kind: 'colours', code: text(palette['code']), name: text(palette['name']), position: num(palette['position']) ?? 0 });
      for (const colour of fromColours.filter((one) => String(one['palette_id']) === String(palette['id']))) {
        await colours.create({ app, palette_id: row['id'] as string | number, code: text(colour['code']), role: (colour['role'] as string | null) ?? null, name: text(colour['name']), hex: text(colour['hex']), position: num(colour['position']) ?? 0 });
      }
    }
  };

  return {
    move: async (list: readonly DataRow[], id: string | number, dir: -1 | 1): Promise<void> => {
      const at = list.findIndex((row) => String(row['id']) === String(id));
      const to = at + dir;
      if (at < 0 || to < 0 || to >= list.length) return;
      const ordered = [...list];
      [ordered[at], ordered[to]] = [ordered[to]!, ordered[at]!];
      await renumber(ordered);
    },

    shown: async (id: string | number, shown: boolean): Promise<void> => {
      await designs.update(id, { state: shown ? 'published' : 'draft' });
    },

    /** A hidden copy, placed after the design it copies; answers the copy's row. */
    duplicate: async (list: readonly DataRow[], design: DataRow, name: string, rows: { parts: readonly DataRow[]; palettes: readonly DataRow[]; colours: readonly DataRow[] }): Promise<DataRow> => {
      const id = design['id'] as string | number;
      const { row } = await designs.create({ app, base_id: base['id'] as string | number, name, tags: jsonColumn(design['tags']), layouts: jsonColumn(design['layouts']), state: 'draft', position: list.length + 1 });
      const copy = row['id'] as string | number;
      const own = rows.parts.filter((part) => String(part['ready_design_id']) === String(id)).sort((a, b) => (num(a['position']) ?? 0) - (num(b['position']) ?? 0));
      for (const [index, part] of own.entries()) await parts.create(partValues(partOf(part), { id: copy, app }, index + 1));
      await copyPalettes(rows.palettes.filter((palette) => String(palette['ready_design_id']) === String(id)), rows.colours, copy);
      const at = list.findIndex((one) => String(one['id']) === String(id));
      await renumber([...list.slice(0, at + 1), row, ...list.slice(at + 1)]);
      return row;
    },

    /** A design and everything it owns, unless a customer made a design from it. */
    remove: async (design: DataRow, rows: { parts: readonly DataRow[]; palettes: readonly DataRow[]; colours: readonly DataRow[] }): Promise<void> => {
      const id = design['id'] as string | number;
      const used = await read.list('designs', { filter: [{ column: 'ready_design_id', op: 'eq', value: id }], columns: ['id'], pageSize: 1 });
      if (used.rows.length > 0) throw new InUse();
      const own = rows.palettes.filter((palette) => String(palette['ready_design_id']) === String(id));
      for (const palette of own) {
        for (const colour of rows.colours.filter((one) => String(one['palette_id']) === String(palette['id']))) await colours.remove(colour['id'] as string | number);
        await palettes.remove(palette['id'] as string | number);
      }
      // Every part, the ones past the first page of the list's read among them.
      const all = await listAll(read, 'ready_parts', { filter: [{ column: 'ready_design_id', op: 'eq', value: id }], columns: ['id'] });
      for (const part of all) await parts.remove(part['id'] as string | number);
      await designs.remove(id);
    },

    /** A new, hidden design at the end of the list; answers its row. */
    create: async (list: readonly DataRow[], face: FaceFacts, areas: readonly DataRow[], words: { name: string; paper: string; partName: string; sample: string; palette: string; layout: string; roles: Readonly<Record<Role, string>> }, font: string | undefined): Promise<DataRow> => {
      const page = face.kind === 'page';
      const { row } = await designs.create({ app, base_id: base['id'] as string | number, name: words.name, tags: null, layouts: page ? JSON.stringify([{ key: 'std', name: words.layout }]) : null, state: 'draft', position: list.length + 1 });
      const id = row['id'] as string | number;
      const start = startParts(face, areas, { paper: words.paper, name: words.partName, sample: words.sample }, font);
      for (const [index, part] of start.entries()) await parts.create(partValues({ ...part, key: '', id: null } as PartDraft, { id, app }, index + 1));
      if (page) {
        const { row: palette } = await palettes.create({ app, ready_design_id: id, kind: 'colours', code: 'palette-1', name: words.palette, position: 1 });
        const hex: Record<Role, string> = { paper: '#ffffff', ink: '#191920', accent: '#c0562f' };
        for (const [at, role] of ROLES.entries()) await colours.create({ app, palette_id: palette['id'] as string | number, code: role, role, name: words.roles[role], hex: hex[role], position: at + 1 });
      }
      return row;
    },
  };
}
