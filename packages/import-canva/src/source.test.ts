import { describe, expect, it } from "vitest";

import type { JobSpec } from "@adminium/add-on-host/contracts";
import { createDemoTransport, type Clock } from "./demo/transport.ts";
import { assessImport, scaleToCover } from "./import.ts";
import { toImportJob } from "./job.ts";
import { createCanvaSource, toArtworkRef, type Chooser } from "./source.ts";
import { describeArtworkSource } from "@adminium/add-on-host/testing";

const CLOCK: Clock = { iso: "2026-08-05", hour: 10, minute: 20 };

/** The host's default business-card configuration — two printed sides. */
const CARDS: JobSpec = {
  productKey: "business-cards",
  productLabel: "Business cards",
  trimWidthMm: 85,
  trimHeightMm: 55,
  bleedMm: 3,
  sides: 2,
  quantity: 500,
};

/** A 2m roll-up banner: past what an exported design can carry. */
const BANNER: JobSpec = {
  ...CARDS,
  productKey: "roll-up-banners",
  productLabel: "Roll-up banners",
  trimWidthMm: 850,
  trimHeightMm: 2000,
  quantity: 1,
};

/**
 * The headless stand-in for the customer: it picks a design by id, and can be
 * told to back out once. `cancel` has to be sticky rather than immediate
 * because `start()` reaches the chooser only after the design list has come
 * back, so the suite's synchronous `cancel()` lands before it is called.
 */
function scriptedChooser(designId: string): { choose: Chooser; cancelOnce: () => void } {
  let cancelling = false;
  return {
    cancelOnce: () => {
      cancelling = true;
    },
    choose: async ({ transport }) => {
      if (cancelling) {
        cancelling = false;
        return null;
      }
      return transport.export(designId);
    },
  };
}

const clean = scriptedChooser("cycles-service");

describeArtworkSource(
  createCanvaSource({ transport: createDemoTransport(CLOCK), choose: clean.choose }),
  { job: CARDS, unavailableJob: BANNER, cancel: clean.cancelOnce },
);

describe("what the source hands back", () => {
  it("reports the design's TRUE measurements, not the ones the works wanted", async () => {
    const blocked = scriptedChooser("bakery-loyalty");
    const source = createCanvaSource({
      transport: createDemoTransport(CLOCK),
      choose: blocked.choose,
    });

    const ref = await source.start(CARDS);
    // The bleed is 0 and the ref says so. The host's own checks then fail it,
    // which is exactly what should happen to a design imported without bleed —
    // this add-on does not get to grade its own import.
    expect(ref).toEqual({
      fileId: "cnv-20260805-1020-bakery-loyalty",
      source: "import-canva",
      widthMm: 85,
      heightMm: 55,
      bleedMm: 0,
      dpi: 300,
      pages: 2,
      previewFileId: "cnv-20260805-1020-bakery-loyalty-preview",
    });
  });

  it("carries the cost of the scale remedy into the ref", async () => {
    const transport = createDemoTransport(CLOCK);
    const exported = await transport.export("bakery-loyalty");
    const scaled = scaleToCover(exported.design, toImportJob(CARDS));
    const ref = toArtworkRef({ ...exported, design: scaled });

    // 94.3 × 61mm at 270dpi with 3mm of bleed: the enlargement bought the
    // bleed and spent 30dpi doing it, and both numbers travel with the file.
    expect(ref.widthMm).toBeCloseTo(94.27, 2);
    expect(ref.bleedMm).toBeCloseTo(3, 9);
    expect(ref.dpi).toBe(270);
    expect(assessImport(scaled, toImportJob(CARDS)).blocked).toBe(false);
  });
});

describe("availability", () => {
  it("declines a banner with the size in the reason", () => {
    const source = createCanvaSource({
      transport: createDemoTransport(CLOCK),
      choose: clean.choose,
    });
    const verdict = source.available(BANNER);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.reason).toContain("850");
      expect(verdict.reason).toContain("2000");
    }
  });

  it("backs out rather than serving a job it declined", async () => {
    const source = createCanvaSource({
      transport: createDemoTransport(CLOCK),
      choose: clean.choose,
    });
    await expect(source.start(BANNER)).resolves.toBeNull();
  });
});
