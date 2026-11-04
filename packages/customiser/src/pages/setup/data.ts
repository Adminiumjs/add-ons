/**
 * WHAT ONE BASE'S SET-UP READS: the base, its areas, its ready-made designs,
 * the fonts, the app's finishes and priced features, and the settings' page
 * defaults. Read once here so every step draws from the same rows, and a
 * write anywhere is seen by every step (the data kit's cache).
 */
import { useRecords, type DataError, type DataRow } from '../shared/host.ts';
import { text } from './facts.ts';

export interface SetupData {
  areas: readonly DataRow[];
  designs: readonly DataRow[];
  parts: readonly DataRow[];
  fonts: readonly DataRow[];
  finishes: readonly DataRow[];
  finishPalette: DataRow | null;
  features: readonly DataRow[];
  settings: DataRow | null;
  loading: boolean;
  error: DataError | null;
  refetch: () => void;
}

const PAGE = 199;

/** The rows of one base's set-up; nothing is read until a base is chosen. */
export function useSetupData(base: DataRow | null): SetupData {
  const id = base === null ? null : (base['id'] as string | number);
  const app = text(base?.['app']);
  const on = id !== null;
  const areas = useRecords('base_areas', { filter: [{ column: 'base_id', op: 'eq', value: id }], sort: [{ column: 'position', direction: 'asc' }], pageSize: PAGE, enabled: on });
  const designs = useRecords('ready_designs', { filter: [{ column: 'base_id', op: 'eq', value: id }], sort: [{ column: 'position', direction: 'asc' }], pageSize: PAGE, enabled: on });
  const parts = useRecords('ready_parts', { filter: app === '' ? [] : [{ column: 'app', op: 'eq', value: app }], columns: ['id', 'ready_design_id', 'rules'], pageSize: PAGE, enabled: on });
  const fonts = useRecords('fonts', { sort: [{ column: 'name', direction: 'asc' }], pageSize: PAGE, enabled: on });
  const palettes = useRecords('palettes', { filter: [{ column: 'kind', op: 'eq', value: 'finishes' }, ...(app === '' ? [] : [{ column: 'app', op: 'eq' as const, value: app }])], sort: [{ column: 'position', direction: 'asc' }], pageSize: PAGE, enabled: on });
  // A shop's own finishes: the palette no ready-made design owns.
  const finishPalette = palettes.rows.find((row) => row['ready_design_id'] === null || row['ready_design_id'] === undefined) ?? null;
  const colours = useRecords('palette_colours', { filter: [{ column: 'palette_id', op: 'eq', value: finishPalette === null ? null : (finishPalette['id'] as string | number) }], sort: [{ column: 'position', direction: 'asc' }], pageSize: PAGE, enabled: on && finishPalette !== null });
  const features = useRecords('features', { filter: app === '' ? [] : [{ column: 'app', op: 'eq', value: app }], sort: [{ column: 'name', direction: 'asc' }], pageSize: PAGE, enabled: on });
  const settings = useRecords('settings', { pageSize: 1, enabled: on });
  const all = [areas, designs, parts, fonts, palettes, colours, features, settings];
  // A font is offered to the shops on this install: the starter set (no app) and this app's own.
  const ownFonts = fonts.rows.filter((row) => text(row['app']) === '' || text(row['app']) === app);
  return {
    areas: areas.rows,
    designs: designs.rows,
    parts: parts.rows,
    fonts: ownFonts,
    finishes: finishPalette === null ? [] : colours.rows,
    finishPalette,
    features: features.rows,
    settings: settings.rows[0] ?? null,
    loading: all.some((one) => one.loading),
    error: all.find((one) => one.error !== null)?.error ?? null,
    refetch: () => {
      for (const one of all) one.refetch();
    },
  };
}
