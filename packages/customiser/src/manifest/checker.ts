/**
 * WHAT ADMINIUM READS FOR A DESIGN BEFORE IT ASKS WHETHER IT MAY BE ORDERED.
 *
 * Every read is keyed, starting from the design, and Adminium reads at most
 * 400 rows for one design. A ready-made business card with two layouts on two
 * sides comes to about 30; a plain base to its few areas.
 *
 * - the ready-made design it starts from, and that design's parts;
 * - the base it is made on, and the base's areas (the parts of a plain one);
 * - the ready-made design's palettes, which its chosen palette must be one of;
 * - the design's own app's priced features, by which a part or a second
 *   side's feature is named by its code. An app keeps few of them, and only
 *   its own are read.
 *
 * Fonts and colours are not read: a part's rules list the fonts and palette
 * roles it offers, and that list is what a design is held to.
 */
export const CHECKER = {
  design: 'designs',
  reads: [
    { id: 'ready', table: 'ready_designs', by: { column: 'id', from: 'design.ready_design_id' } },
    { id: 'parts', table: 'ready_parts', by: { column: 'ready_design_id', from: 'ready.id' } },
    { id: 'base', table: 'bases', by: { column: 'id', from: 'design.base_id' } },
    { id: 'areas', table: 'base_areas', by: { column: 'base_id', from: 'base.id' } },
    { id: 'palettes', table: 'palettes', by: { column: 'ready_design_id', from: 'ready.id' } },
    { id: 'features', table: 'features', by: { column: 'app', from: 'design.app' } },
  ],
} as const;
