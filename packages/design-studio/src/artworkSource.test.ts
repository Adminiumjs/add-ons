import { describe, expect, it } from "vitest";

import { MAX_AREA_SQM, createArtworkSource } from "./artworkSource.ts";
import type { JobSpec } from "@adminium/add-on-host/contracts";
import type { Doc } from "./doc.ts";
import { LAYOUTS, layoutForSize } from "./layouts.ts";
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
 *
 * IT BUILDS ITS DOCUMENT WITH `startDoc`, WHICH IS THE POINT OF THE BLEED
 * ASSERTIONS BELOW. Calling `docFromLayout()` here and passing `job.bleedMm` in
 * would move the fix into the fixture: the harness would be doing the reading,
 * and the add-on could go on ignoring the field while the suite stayed green.
 * `startDoc` is what `start()` hands the real editor, so a bleed that arrives
 * here arrived through the shipped path.
 */
function harness() {
  let resolveOpen: ((doc: Doc | null) => void) | null = null;

  const source = createArtworkSource({
    open: (job, _layouts, startDoc) => {
      const layout = layoutForSize(job.trimWidthMm, job.trimHeightMm) ?? LAYOUTS[0]!;
      return new Promise<Doc | null>((resolve) => {
        resolveOpen = resolve;
        // The editor closes itself on the next tick. A promise settles once, so
        // a `cancel()` that lands first wins and this becomes a no-op.
        setTimeout(() => resolve(startDoc(layout)), 0);
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

/**
 * THE BLEED IS THE JOB'S, AND 3mm IS NOT A SYNONYM FOR "THE BLEED".
 *
 * The assertion above that `CARD_JOB` comes back at 91 × 61 held for a year
 * while this add-on read no bleed at all: the job said 3, the document was built
 * from a constant 3, and the two agreed by coincidence. Every job here asks for
 * something else, so a constant cannot pass them.
 *
 * Zero is the case worth naming. A host that reproduces a design onto a
 * fixed-size object — a mug, a slate, a phone case — has no edge to trim and
 * says `bleedMm: 0`, which is an INSTRUCTION (reach the finished edge and no
 * further) rather than a gap to fill in. And the consequence of getting it wrong
 * is not a near miss: the HOST runs the artwork check, so a file built 3mm
 * oversize is a file the host rejects from its own add-on.
 */
describe("the bleed comes from the job", () => {
  const at = (bleedMm: number): JobSpec => ({ ...CARD_JOB, bleedMm });

  it("builds at exactly the finished size when the job asks for no bleed", async () => {
    const ref = await harness().source.start(at(0));
    expect(ref!.bleedMm).toBe(0);
    expect(ref!.widthMm).toBe(85);
    expect(ref!.heightMm).toBe(55);
  });

  it("builds 5mm larger on every edge when the job asks for 5", async () => {
    const ref = await harness().source.start(at(5));
    expect(ref!.bleedMm).toBe(5);
    expect(ref!.widthMm).toBe(95);
    expect(ref!.heightMm).toBe(65);
  });

  it("reports back whatever the job asked for, rather than one house number", async () => {
    for (const bleedMm of [0, 1.5, 3, 5, 10]) {
      const ref = await harness().source.start(at(bleedMm));
      expect(ref!.bleedMm, `job asked for ${bleedMm}mm`).toBe(bleedMm);
      expect(ref!.widthMm).toBe(85 + bleedMm * 2);
      expect(ref!.heightMm).toBe(55 + bleedMm * 2);
    }
  });

  /*
   * Two different sheets, not one sheet described two ways. The file id is a
   * hash of the document, and the document's bleed is part of it — so an
   * implementation that built one document and relabelled the output would pass
   * the three assertions above and fail this one.
   */
  it("makes a different document, not a different label on the same one", async () => {
    const zero = await harness().source.start(at(0));
    const five = await harness().source.start(at(5));
    expect(zero!.fileId).not.toBe(five!.fileId);
  });
});
