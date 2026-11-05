/**
 * WHAT THE READER'S ROLE LETS THE PANELS READ AND MAKE.
 *
 * A panel drawn for a role short of a right would otherwise show a blank
 * drawing or "none yet", as if the shop had set nothing up. Each panel asks
 * here which of the Customiser's tables the reader may not read, which of a
 * row's personal columns came back hidden, and whether the reader may make
 * the proof and the files; it then says so in plain words, and makes
 * nothing from a design it cannot read whole.
 */
import type { DataRow, UseAccessResult } from '../pages/shared/host.ts';

/** What the panel on a product reads besides its base. */
export const PRODUCT_READS = ['base_areas', 'ready_designs', 'features'] as const;
/** What the panel on an order line reads besides the design. */
export const LINE_READS = ['bases', 'base_pieces', 'base_areas', 'ready_designs', 'ready_parts', 'fonts', 'palettes', 'palette_colours', 'features', 'design_versions', 'version_files'] as const;

/** The tables of these the reader may not read, once their grants are known. */
export function unreadTables(access: Pick<UseAccessResult, 'ready' | 'canRead'>, tables: readonly string[]): string[] {
  return access.ready ? tables.filter((table) => !access.canRead(table)) : [];
}

/** The columns a row came back without because the reader may not see personal data (`_masked`). */
export function hiddenColumns(row: DataRow | null | undefined): string[] {
  const masked = row?.['_masked'];
  return Array.isArray(masked) ? masked.filter((column): column is string => typeof column === 'string') : [];
}

/** Whether the reader may make the proof and the files of a design: a version to make (or one to add), and the version's files. */
export function mayMake(access: Pick<UseAccessResult, 'ready' | 'canCreate' | 'canUpdate'>, hasVersion: boolean): boolean {
  if (!access.ready) return false;
  return access.canUpdate('design_versions') && (hasVersion || access.canCreate('design_versions')) && access.canCreate('version_files') && access.canUpdate('version_files');
}

/** Whether a refusal says the reader lacks a right. */
export const isForbidden = (code: string | undefined): boolean => code === 'FORBIDDEN' || code === 'TABLE_FORBIDDEN' || code === 'COLUMN_FORBIDDEN';
