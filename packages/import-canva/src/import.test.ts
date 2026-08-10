import { describe, expect, it } from "vitest";

import { createDemoTransport, type Clock } from "./demo/transport.ts";
import {
  SAFE_AREA_MM,
  assessImport,
  coverScale,
  requiredSize,
  scaleToCover,
  type DesignSize,
  type ImportJob,
  type ScaleRemedy,
} from "./import.ts";

/**
 * A single-sided business-card job — 85 × 55mm trim, 3mm bleed on every edge.
 * `minDpi` is the works' own floor (150), copied from the host's `rates.ts`
 * rather than invented here.
 *
 * NOTE that this is NOT the job the demo's default path uses: the Print Shop
 * defaults business cards to TWO printed sides. This constant isolates the
 * geometry, and `DEFAULT_PATH` below covers what a visitor actually walks.
 */
const CARDS: ImportJob = {
  trimWidthMm: 85,
  trimHeightMm: 55,
  bleedMm: 3,
  sides: 1,
  minDpi: 150,
};

/** The seeded design that has no bleed — made at trim size, as design tools do. */
const NO_BLEED: DesignSize = {
  widthMm: 85,
  heightMm: 55,
  bleedMm: 0,
  dpi: 300,
  pages: 1,
};

describe("requiredSize", () => {
  it("is trim plus bleed on every edge", () => {
    expect(requiredSize(CARDS)).toEqual({ widthMm: 91, heightMm: 61 });
  });
});

describe("the worked case — 85 × 55mm against a required 91 × 61mm", () => {
  const assessment = assessImport(NO_BLEED, CARDS);

  it("blocks the design and says so through the bleed row", () => {
    expect(assessment.blocked).toBe(true);
    const bleed = assessment.verdicts.find((v) => v.key === "check.bleedMissing");
    expect(bleed?.level).toBe("fail");
    // Every number the sentence renders comes from the engine, not the screen.
    expect(bleed?.measured).toEqual({
      mm: 0,
      needMm: 3,
      haveW: 85,
      haveH: 55,
      needW: 91,
      needH: 61,
    });
  });

  it("scales to cover by max(91/85, 61/55) = 1.109, i.e. +10.9%", () => {
    // The HEIGHT ratio is the binding one — 1.1091 against the width's 1.0706 —
    // which is precisely why the width is what overshoots.
    expect(coverScale(NO_BLEED, CARDS)).toBeCloseTo(61 / 55, 12);

    const scale = assessment.remedies.find(
      (r): r is ScaleRemedy => r.kind === "scale",
    );
    expect(scale).toBeDefined();
    expect(scale!.scale).toBe(1.109);
    expect(scale!.scalePct).toBe(10.9);
  });

  it("overshoots the width to 94.3mm and trims ≈1.6mm off EACH of the left and right edges", () => {
    const scale = assessment.remedies.find(
      (r): r is ScaleRemedy => r.kind === "scale",
    )!;
    expect(scale.scaledWidthMm).toBe(94.3);
    expect(scale.scaledHeightMm).toBe(61);
    expect(scale.trimPerEdgeMm).toBe(1.6);
    // The height was the binding axis, so nothing comes off the top or bottom
    // beyond the bleed — the two figures are not interchangeable and the copy
    // only ever claims the left and right.
    expect(scale.blockTrimPerEdgeMm).toBe(0);
  });

  it("carries BOTH remedies, the scale first and the redo with what to change", () => {
    expect(assessment.remedies.map((r) => r.kind)).toEqual(["scale", "redo"]);
    const redo = assessment.remedies[1];
    expect(redo).toEqual({
      kind: "redo",
      needWidthMm: 91,
      needHeightMm: 61,
      trimWidthMm: 85,
      trimHeightMm: 55,
      bleedMm: 3,
      safeAreaMm: SAFE_AREA_MM,
    });
  });

  it("passes every check once the scale is applied — the promise the button makes", () => {
    const scaled = scaleToCover(NO_BLEED, CARDS);
    const after = assessImport(scaled, CARDS);
    expect(after.blocked).toBe(false);
    expect(after.remedies).toEqual([]);
    expect(after.verdicts.map((v) => v.level)).toEqual(["pass", "pass", "pass", "pass"]);
  });

  it("leaves exactly the works' 3mm of bleed, and spends 30dpi buying it", () => {
    const scaled = scaleToCover(NO_BLEED, CARDS);
    // The binding axis gives the bleed: (61 − 55) / 2. The other axis has more
    // and is trimmed back to it.
    expect(scaled.bleedMm).toBeCloseTo(3, 9);
    expect(Math.round(scaled.dpi)).toBe(270);
  });
});

describe("a design that already carries the bleed", () => {
  const CLEAN: DesignSize = {
    widthMm: 91,
    heightMm: 61,
    bleedMm: 3,
    dpi: 300,
    pages: 1,
  };

  it("passes with no remedies to offer", () => {
    const assessment = assessImport(CLEAN, CARDS);
    expect(assessment.blocked).toBe(false);
    expect(assessment.remedies).toEqual([]);
    expect(assessment.verdicts.find((v) => v.key === "check.bleedOk")?.measured).toEqual({
      mm: 3,
    });
  });

  it("is not shrunk to fit — a design that covers is left alone", () => {
    expect(coverScale(CLEAN, CARDS)).toBe(1);
    expect(scaleToCover(CLEAN, CARDS)).toEqual(CLEAN);
  });
});

describe("a design of the wrong shape", () => {
  // An A5 flyer offered to a business-card job: it covers twice over, so the
  // bleed is not the problem — the proportions are.
  const A5: DesignSize = {
    widthMm: 154,
    heightMm: 216,
    bleedMm: 3,
    dpi: 300,
    pages: 1,
  };

  it("warns with the millimetres that would come off each pair of edges", () => {
    const assessment = assessImport(A5, CARDS);
    const shape = assessment.verdicts.find((v) => v.key === "check.shapeOff");
    expect(shape?.level).toBe("warn");
    expect(shape?.measured).toEqual({ inline: 31.5, block: 77.5 });
  });

  it("does not block the order — a warning is not a refusal", () => {
    expect(assessImport(A5, CARDS).blocked).toBe(false);
  });
});

describe("resolution, which scaling spends", () => {
  it("refuses to offer a scale that would trade a missing bleed for too few dots", () => {
    // 160dpi has 10dpi of headroom over the works' floor; covering this job
    // needs +10.9%, which lands at 144. The button that would promise a pass is
    // therefore not offered, and only the honest remedy is left.
    const thin: DesignSize = { ...NO_BLEED, dpi: 160 };
    const assessment = assessImport(thin, CARDS);
    expect(Math.round(scaleToCover(thin, CARDS).dpi)).toBe(144);
    expect(assessment.remedies.map((r) => r.kind)).toEqual(["redo"]);
  });

  it("fails a design below the works' floor before any scaling", () => {
    const coarse: DesignSize = { widthMm: 91, heightMm: 61, bleedMm: 3, dpi: 96, pages: 1 };
    const assessment = assessImport(coarse, CARDS);
    expect(assessment.blocked).toBe(true);
    expect(assessment.verdicts.find((v) => v.key === "check.dpiLow")?.measured).toEqual({
      dpi: 96,
      need: 150,
    });
  });
});

describe("pages against printed sides", () => {
  const TWO_SIDED: ImportJob = { ...CARDS, sides: 2 };

  it("fails a one-page design on a two-sided job", () => {
    const assessment = assessImport(
      { widthMm: 91, heightMm: 61, bleedMm: 3, dpi: 300, pages: 1 },
      TWO_SIDED,
    );
    expect(assessment.blocked).toBe(true);
    expect(assessment.verdicts.find((v) => v.key === "check.pagesShort")?.measured).toEqual({
      pages: 1,
      need: 2,
    });
  });

  it("only warns about spare pages — the customer may have meant them", () => {
    const assessment = assessImport(
      { widthMm: 91, heightMm: 61, bleedMm: 3, dpi: 300, pages: 4 },
      CARDS,
    );
    expect(assessment.blocked).toBe(false);
    expect(assessment.verdicts.find((v) => v.key === "check.pagesExtra")?.level).toBe("warn");
  });
});

/**
 * THE PATH A VISITOR ACTUALLY WALKS, asserted end to end.
 *
 * AC4 claims "the Canva no-bleed path shows +10.9% and ≈1.6mm trimmed". Every
 * assertion above proves the engine can produce those figures; none of them
 * proved the DEMO reaches them, and for a while it did not. The Print Shop
 * defaults business cards to two printed sides, the seeded design carried one
 * page, and `check.pagesShort` failed first — which correctly suppresses the
 * scale remedy, because scaling cannot add a back to a card. The screen a
 * visitor saw offered only "fix it and import again", and the wave's headline
 * number appeared nowhere.
 *
 * So this block reads the SEEDED design out of the shipped fixture rather than
 * retyping it, and runs it against the host's default configuration. If anyone
 * changes the seed, the default sides, or the remedy rules, this fails — which
 * is the only kind of assertion that keeps a demo honest.
 */
describe("the default path — the seeded design against a two-sided card job", () => {
  const CLOCK: Clock = { iso: "2026-08-05", hour: 10, minute: 20 };
  /** `defaultConfig()` in the host's `store.ts`: business cards, both sides. */
  const DEFAULT_PATH: ImportJob = { ...CARDS, sides: 2 };

  const seeded = async (): Promise<DesignSize> =>
    (await createDemoTransport(CLOCK).export("bakery-loyalty")).design;

  it("seeds a design with a back, so the page check is not what blocks it", async () => {
    const design = await seeded();
    expect(design.pages).toBe(2);
    const assessment = assessImport(design, DEFAULT_PATH);
    expect(assessment.verdicts.find((v) => v.key === "check.pages")?.level).toBe("pass");
    // Blocked, but by the missing bleed — which is the thing the demo is about.
    expect(assessment.blocked).toBe(true);
    expect(assessment.verdicts.find((v) => v.key === "check.bleedMissing")?.level).toBe("fail");
  });

  it("reaches +10.9% and ≈1.6mm on the default path, with both remedies offered", async () => {
    const assessment = assessImport(await seeded(), DEFAULT_PATH);
    expect(assessment.remedies.map((r) => r.kind)).toEqual(["scale", "redo"]);
    const scale = assessment.remedies.find((r): r is ScaleRemedy => r.kind === "scale")!;
    expect(scale.scalePct).toBe(10.9);
    expect(scale.trimPerEdgeMm).toBe(1.6);
    expect(scale.scaledWidthMm).toBe(94.3);
    expect(scale.scaledDpi).toBe(270);
  });

  it("passes every row once the button is pressed, back included", async () => {
    const after = assessImport(scaleToCover(await seeded(), DEFAULT_PATH), DEFAULT_PATH);
    expect(after.blocked).toBe(false);
    expect(after.verdicts.map((v) => v.level)).toEqual(["pass", "pass", "pass", "pass"]);
  });

  it("would have hidden the scale remedy if the design had one page", async () => {
    // The regression this block exists for, stated as its own case: with a
    // single page the engine is right to withhold the button, and the demo
    // would be wrong to seed a design that triggers it.
    const design = { ...(await seeded()), pages: 1 };
    expect(assessImport(design, DEFAULT_PATH).remedies.map((r) => r.kind)).toEqual(["redo"]);
  });
});

describe("determinism", () => {
  it("gives byte-identical assessments for the same inputs", () => {
    expect(assessImport(NO_BLEED, CARDS)).toEqual(assessImport(NO_BLEED, CARDS));
  });
});
