/**
 * WHAT THE READY-MADE DESIGNS STEP READS beside the set-up's own rows: every
 * part of the base's designs (their pictures in the list, and the editor's
 * draft), the designs' own palettes with their colours (a page's Paper, Ink
 * and Accent), and the app's own colour palettes a colour part offers (the
 * PLA a printed piece comes in).
 */
import { useRecords, type DataError, type DataRow } from '../shared/host.ts';
import { text } from '../setup/facts.ts';

export interface DesignRows {
  parts: readonly DataRow[];
  palettes: readonly DataRow[];
  colours: readonly DataRow[];
  /** The app's own palettes of colours (no design owns them), and their colours. */
  appPalettes: readonly DataRow[];
  loading: boolean;
  error: DataError | null;
}

const PAGE = 199;

export function useDesignRows(base: DataRow, designs: readonly DataRow[]): DesignRows {
  const app = text(base['app']);
  const ids = designs.map((row) => row['id'] as string | number);
  const on = ids.length > 0;
  const parts = useRecords('ready_parts', { filter: [{ column: 'ready_design_id', op: 'in', value: ids }], sort: [{ column: 'position', direction: 'asc' }, { column: 'id', direction: 'asc' }], pageSize: PAGE, enabled: on });
  const palettes = useRecords('palettes', { filter: [{ column: 'kind', op: 'eq', value: 'colours' }, ...(app === '' ? [] : [{ column: 'app', op: 'eq' as const, value: app }])], sort: [{ column: 'position', direction: 'asc' }, { column: 'id', direction: 'asc' }], pageSize: PAGE });
  const paletteIds = palettes.rows.map((row) => row['id'] as string | number);
  const colours = useRecords('palette_colours', { filter: [{ column: 'palette_id', op: 'in', value: paletteIds }], sort: [{ column: 'position', direction: 'asc' }], pageSize: PAGE, enabled: paletteIds.length > 0 });
  const owned = (row: DataRow): boolean => row['ready_design_id'] !== null && row['ready_design_id'] !== undefined && row['ready_design_id'] !== '';
  const all = [parts, palettes, colours];
  return {
    parts: on ? parts.rows : [],
    palettes: palettes.rows.filter((row) => owned(row) && ids.some((id) => String(id) === String(row['ready_design_id']))),
    colours: colours.rows,
    appPalettes: palettes.rows.filter((row) => !owned(row)),
    loading: all.some((one) => one.loading),
    error: all.find((one) => one.error !== null)?.error ?? null,
  };
}
