/**
 * THE RULES OF A DESIGN, IN ONE PLACE FOR THE THREE THAT ASK THEM.
 *
 * The shop's editor (what a part may be), the customer's editor (the checks
 * the customer sees) and the answer Adminium asks before a design is ordered
 * all read this module, so the browser and the server can never disagree.
 * It is plain TypeScript: no React, no page, no clock.
 *
 * For now it holds the one fact every saved design carries: the version of
 * the shape its data is written in. A design keeps the number it was saved
 * with, so an older design is still read the way it was meant when the shape
 * grows.
 */
export const DESIGN_FORMAT = 1;
