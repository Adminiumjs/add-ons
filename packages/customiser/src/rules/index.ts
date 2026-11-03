/**
 * THE RULES OF A DESIGN, IN ONE PLACE FOR THE THREE THAT ASK THEM.
 *
 * The shop's editor (what a part may be), the customer's editor (the checks
 * the customer sees) and the answer Adminium asks before a design is ordered
 * (`dist/check.js`) all read this module, so the browser and the server can
 * never disagree. It is plain TypeScript: no React, no page, no clock, no
 * fonts, no network.
 *
 * - `shapes.ts`: what a part's rules hold, kind by kind, and what a design
 *   saves (`format` 1).
 * - `text.ts`: how much text a part takes, at which sizes.
 * - `design.ts`: whether a design may be ordered, the advice the customer
 *   sees, and the priced features it takes.
 */
export { DESIGN_FORMAT, LOGO_SMALLEST_MM, PICTURE_KINDS, PT_MM, readValues, SCALE_MAX, SCALE_MIN, TEXT_MAX } from './shapes.ts';
export type { DesignValues, PartValue, PictureRules, TextRules } from './shapes.ts';
export { charCount, charLimit, lineCount, sizeAllowed, sizeInMm, sizeThatFits } from './text.ts';
export { contrast } from './colour.ts';
export { checkDesign, DEFAULT_MIN_DPI, DEFAULT_SMALLEST_LINE_MM, REASONS } from './design.ts';
export type { Advice, DesignAnswer, DesignFacts, FileFact, Measure, Reason, Refusal } from './design.ts';
