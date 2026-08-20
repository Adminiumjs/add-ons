/**
 * THE PAYLOADS THE HARNESS PASSES, IN A MODULE OF THEIR OWN SO A SUITE CAN
 * RENDER THEM.
 *
 * They were inline in `main.tsx`, which mounts a React root the moment it is
 * imported — so the only way to find out whether they still worked was to open a
 * browser and click. They did not: they were the host's OLD
 * `{ config: { product, size, sides, quantity } }` record long after the slot
 * started carrying a resolved `job` in millimetres, and nothing was red, because
 * the fill was cast to `(p: unknown) => ReactNode` at the call site. Splitting
 * them out is what lets `src/harness.test.tsx` drive them headlessly.
 *
 * A host maps its own catalogue record into `ArtworkJob` AT THE MOUNT SITE —
 * that mapping is the seam — so what appears here is what a print works has
 * already worked out, never its own size preset key. `productLabel` arrives
 * translated for the same reason; this harness has only English copy of its own,
 * which is why the label stays English when its language picker does not.
 */

import type { ArtworkJob } from "@adminium/add-on-host";

/** One panel of the harness: the shop's own reference, its note, and the job. */
export interface HarnessJob {
  /** The reference both sides already use — what a works prints on its paperwork. */
  ref: string;
  /** What the panel says above the slot, and therefore what it promises to show. */
  note: string;
  job: ArtworkJob;
}

export const HARNESS_JOBS: readonly HarnessJob[] = [
  {
    ref: "MP-4127",
    note: "500 business cards, 85 × 55mm at 3mm bleed — a size a starting layout matches exactly, so the editor opens straight onto it.",
    job: {
      productKey: "business-cards",
      productLabel: "Business cards, 350gsm silk",
      trimWidthMm: 85,
      trimHeightMm: 55,
      bleedMm: 3,
      sides: 2,
      quantity: 500,
    },
  },
  {
    ref: "MP-4131",
    note: "250 A4 posters — 210 × 297mm, a size no starting layout matches, so the picker opens.",
    job: {
      productKey: "posters",
      productLabel: "A4 posters",
      trimWidthMm: 210,
      trimHeightMm: 297,
      bleedMm: 3,
      sides: 1,
      quantity: 250,
    },
  },
  /*
   * THE ZERO, WHICH IS AN INSTRUCTION AND NOT AN ABSENCE.
   *
   * `payloads.ts` argues this case at length and Canva Import drives it end to
   * end; nothing drove it through THIS add-on's editor, which is the half a
   * customer actually draws in. A shop printing onto a fixed-size blank knows
   * the artwork reaches the finished edge and no further, so it says
   * `bleedMm: 0` — and because `artworkSource.ts` binds the job's bleed into
   * `startDoc`, the canvas opens with no hatch around it and the file comes back
   * at exactly 60 × 60mm rather than at the 3mm-larger sheet the editor used to
   * build regardless.
   *
   * 60 × 60mm is the sticker layout's size on purpose: an exact match skips the
   * picker, so the tile opens straight onto the canvas where the missing hatch
   * is the thing to look at.
   */
  {
    ref: "MP-4136",
    note: "400 fridge magnets, printed onto 60 × 60mm blanks — no bleed at all, so the canvas has no hatch and the file comes back at exactly the trim size.",
    job: {
      productKey: "fridge-magnets",
      productLabel: "Fridge magnets, 60mm square",
      trimWidthMm: 60,
      trimHeightMm: 60,
      bleedMm: 0,
      sides: 1,
      quantity: 400,
    },
  },
];
