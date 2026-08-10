import { describe, expect, it } from "vitest";

import { MAX_AREA_SQM, createArtworkSource } from "./artworkSource.ts";
import type { JobSpec } from "@adminium/add-on-host/contracts";
import type { Doc } from "./doc.ts";
import { docFromLayout, LAYOUTS, layoutForSize } from "./layouts.ts";
import { describeArtworkSource } from "@adminium/add-on-host/testing";

const CARD_JOB: JobSpec = {
  productKey: "business-cards",
  productLabel: "Business cards",
  trimWidthMm: 85,
  trimHeightMm: 55,
  bleedMm: 3,
  sides: 2,
  quantity: 500,
};

/** Bigger than the works itself will run — 3 × 3m is 9m², over the 6m² cap. */
const HOARDING_JOB: JobSpec = {
  ...CARD_JOB,
  productKey: "large-format",
  productLabel: "Hoarding",
  trimWidthMm: 3000,
  trimHeightMm: 3000,
  sides: 1,
  quantity: 1,
};

/**
 * A headless stand-in for the editor.
 *
 * `open()` behaves the way the real one does from the contract's point of view:
 * it stays open for a moment and then resolves with the document the customer
 * built, UNLESS they back out first — in which case the same promise resolves
 * to null. One harness serves both paths because the contract has one path with
 * two endings, and a fixture that could only ever finish would leave the cancel
 * assertion testing a second implementation nobody ships.
 */
function harness() {
  let resolveOpen: ((doc: Doc | null) => void) | null = null;

  const source = createArtworkSource({
    open: (job) => {
      const layout = layoutForSize(job.trimWidthMm, job.trimHeightMm) ?? LAYOUTS[0]!;
      return new Promise<Doc | null>((resolve) => {
        resolveOpen = resolve;
        // The editor closes itself on the next tick. A promise settles once, so
        // a `cancel()` that lands first wins and this becomes a no-op.
        setTimeout(() => resolve(docFromLayout(layout)), 0);
      });
    },
  });

  return { source, cancel: () => resolveOpen?.(null) };
}

// The contract's own suite, run against this implementation.
const conformance = harness();
describeArtworkSource(conformance.source, {
  job: CARD_JOB,
  unavailableJob: HOARDING_JOB,
  cancel: conformance.cancel,
});

describe("what this source will and will not take", () => {
  it("declines a job larger than the works itself runs, with the reason", () => {
    const verdict = harness().source.available(HOARDING_JOB);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toContain("PDF");
  });

  it("takes the roll-up banner, which is large but well inside the cap", () => {
    const banner: JobSpec = { ...CARD_JOB, trimWidthMm: 850, trimHeightMm: 2000, sides: 1 };
    expect((850 / 1000) * (2000 / 1000)).toBeLessThan(MAX_AREA_SQM);
    expect(harness().source.available(banner).ok).toBe(true);
  });

  it("declines everything when the shop has switched every layout off", () => {
    const source = createArtworkSource({
      open: () => Promise.resolve(null),
      allowedLayouts: [],
    });
    const verdict = source.available(CARD_JOB);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason.length).toBeGreaterThan(0);
  });

  it("offers only the layouts the shop switched on", async () => {
    let offered: readonly { id: string }[] = [];
    const source = createArtworkSource({
      allowedLayouts: ["business-card", "sticker"],
      open: (_job, layouts) => {
        offered = layouts;
        return Promise.resolve(null);
      },
    });
    await source.start(CARD_JOB);
    expect(offered.map((l) => l.id)).toEqual(["business-card", "sticker"]);
  });

  it("ignores a layout id the shop's setting names but this build does not have", () => {
    const source = createArtworkSource({
      open: () => Promise.resolve(null),
      allowedLayouts: ["business-card", "beer-mat"],
    });
    expect(source.available(CARD_JOB).ok).toBe(true);
  });
});

describe("what the source hands back", () => {
  it("describes the document, adding nothing and fixing nothing", async () => {
    const ref = await harness().source.start(CARD_JOB);
    expect(ref).not.toBeNull();
    expect(ref!.widthMm).toBe(91);
    expect(ref!.heightMm).toBe(61);
    expect(ref!.bleedMm).toBe(3);
    expect(ref!.pages).toBe(2);
    expect(ref!.source).toBe("design-studio");
  });

  it("is stable: the same job twice produces the same file id", async () => {
    const a = await harness().source.start(CARD_JOB);
    const b = await harness().source.start(CARD_JOB);
    expect(b!.fileId).toBe(a!.fileId);
  });
});
