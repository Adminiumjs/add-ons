import { describe, expect, it } from "vitest";

import { assessImport, requiredSize, type ImportJob } from "../import.ts";
import { createDemoTransport, type Clock } from "./transport.ts";

/** The pinned clock: Wednesday, 5 August 2026, 10:20. */
const CLOCK: Clock = { iso: "2026-08-05", hour: 10, minute: 20 };

/**
 * The host's default business-card configuration: 85 × 55mm, 3mm bleed, TWO
 * printed sides (`defaultConfig()` in the Print Shop's `store.ts`). Both seeded
 * cards are checked against it because it is the job a visitor gets without
 * touching a control — a fixture that only behaves against a job nobody
 * configures is a fixture that proves nothing about the demo.
 */
const CARDS: ImportJob = {
  trimWidthMm: 85,
  trimHeightMm: 55,
  bleedMm: 3,
  sides: 2,
  minDpi: 150,
};

describe("the seeded account", () => {
  it("holds four designs", async () => {
    const designs = await createDemoTransport(CLOCK).list();
    expect(designs.map((d) => d.id)).toEqual([
      "bakery-loyalty",
      "cycles-service",
      "yoga-timetable",
      "gallery-invite",
    ]);
  });

  it("dates every design from the pinned clock, never from a real one", async () => {
    const designs = await createDemoTransport(CLOCK).list();
    expect(designs.map((d) => d.editedIso)).toEqual([
      "2026-08-04",
      "2026-08-01",
      "2026-07-27",
      "2026-07-13",
    ]);
    // Advancing the demo clock carries the whole account with it, so no screen
    // is ever left claiming a design was edited in the future.
    const later = await createDemoTransport({ ...CLOCK, iso: "2026-08-12" }).list();
    expect(later[0].editedIso).toBe("2026-08-11");
  });

  it("mints file ids from the clock alone — no counter, no randomness", async () => {
    const transport = createDemoTransport(CLOCK);
    const once = await transport.export("bakery-loyalty");
    const twice = await createDemoTransport(CLOCK).export("bakery-loyalty");
    expect(once.fileId).toBe("cnv-20260805-1020-bakery-loyalty");
    expect(twice).toEqual(once);
  });

  it("refuses an unknown id with a message naming what was asked for", async () => {
    await expect(createDemoTransport(CLOCK).export("no-such-design")).rejects.toThrow(
      /no-such-design/,
    );
  });
});

describe("the two designs the flow is built around", () => {
  it("imports the loyalty card blocked, with both remedies", async () => {
    const { design } = await createDemoTransport(CLOCK).export("bakery-loyalty");
    // Two pages, because the default job prints two sides. A one-page card
    // would fail the page check first and the scale remedy — the +10.9% the
    // whole demo is built around — would never be offered. See `import.test.ts`.
    expect(design.pages).toBe(2);
    const assessment = assessImport(design, CARDS);
    expect(assessment.blocked).toBe(true);
    expect(assessment.remedies.map((r) => r.kind)).toEqual(["scale", "redo"]);
  });

  it("imports the service card clean, so the flow is not only its failure case", async () => {
    const { design } = await createDemoTransport(CLOCK).export("cycles-service");
    const assessment = assessImport(design, CARDS);
    expect(assessment.blocked).toBe(false);
    expect(assessment.verdicts.every((v) => v.level === "pass")).toBe(true);
  });
});

describe("the redo remedy, taken", () => {
  it("comes back at the size the customer was told to set, and passes", async () => {
    const need = requiredSize(CARDS);
    const { fileId, design } = await createDemoTransport(CLOCK).export("bakery-loyalty", {
      widthMm: need.widthMm,
      heightMm: need.heightMm,
      bleedMm: CARDS.bleedMm,
    });
    // Re-making a design at a bigger size re-renders it, so the resolution is
    // the one thing that does NOT move — which is the whole difference between
    // this remedy and scaling the export we already have.
    expect(design).toEqual({ widthMm: 91, heightMm: 61, bleedMm: 3, dpi: 300, pages: 2 });
    expect(assessImport(design, CARDS).blocked).toBe(false);
    expect(fileId).toBe("cnv-20260805-1020-bakery-loyalty-refit");
  });
});

describe("D11", () => {
  it("says out loud that its answers are simulated", () => {
    expect(createDemoTransport(CLOCK).simulated).toBe(true);
  });
});
