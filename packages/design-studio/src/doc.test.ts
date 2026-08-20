import { describe, expect, it } from "vitest";

import {
  BLEED_MM,
  HISTORY_LIMIT,
  OUTPUT_DPI,
  SAFE_MM,
  SNAP_TOLERANCE_MM,
  addLayer,
  alignToPage,
  canRedo,
  canUndo,
  commit,
  createDoc,
  createHistory,
  distribute,
  endGesture,
  fileIdFor,
  hitTest,
  layersOn,
  moveLayer,
  moveZ,
  nearestInkMm,
  outsideSafeArea,
  redo,
  selectAt,
  setHidden,
  snap,
  snapToleranceMm,
  toArtworkFile,
  toArtworkRef,
  toDesignRecord,
  undo,
  updateLayer,
  type Doc,
  type LayerDraft,
} from "./doc.ts";
import { LOCALE_TAGS, designStudioStrings } from "./i18n/strings.ts";
import {
  BLANK_LAYOUT,
  DEFAULT_SEED_TEXT,
  LAYOUTS,
  docFromLayout,
  layoutForSize,
} from "./layouts.ts";

// ── the host's artwork checks, COPIED ────────────────────────────────────────

/**
 * `checkArtwork()` from the host app, print-shop `src/lib/quote.ts:633`, with
 * its three constants (`BLEED_MM` 3, `MIN_DPI` 150, `SAFE_AREA_ADVISORY_MM` 4)
 * inlined and `resolveSize(config)` replaced by the trim size passed in.
 *
 * COPIED RATHER THAN IMPORTED, and the choice is worth stating plainly: a
 * cross-repo import would reach out of this repo into a sibling checkout on one
 * developer's disk. This repo is published standalone to the Adminiumjs org, so
 * that import resolves nowhere for anyone who clones it, and a test that only
 * passes on the machine it was written on is not a test.
 *
 * The cost of copying is that a change to the works' checks does not break this
 * suite. Nothing here detects that drift — the honest mitigation is that the
 * three numbers are the works' published tolerances rather than internals, and
 * that the assertion below is about a property (the bleed is right by
 * construction) rather than about a particular threshold.
 */
type VerdictLevel = "pass" | "warn" | "fail";
interface ArtworkVerdict {
  level: VerdictLevel;
  key: string;
  measured: Record<string, number | string>;
}
interface HostArtworkFile {
  filename: string;
  widthPx: number;
  heightPx: number;
  widthMm: number;
  heightMm: number;
  bleedMm: number;
  nearestInkMm: number;
  colourSpace: "CMYK" | "RGB";
  fontsEmbedded: boolean;
  pages: number;
}

function hostCheckArtwork(
  file: HostArtworkFile,
  job: { trimWidthMm: number; trimHeightMm: number; sides: 1 | 2; bleedMm?: number },
): ArtworkVerdict[] {
  /*
   * A PARAMETER, BECAUSE A HOST CHECKS AGAINST THE SAME NUMBER IT ASKED FOR.
   * In the works this was copied from, `checkArtwork()` and the `job.bleedMm`
   * it hands an add-on both read one constant (print-shop `src/lib/rates.ts`,
   * used at `src/lib/quote.ts:638` and `src/add-ons/artwork.ts:70`) — so a host
   * whose job says 0 is a host whose check wants 0, and passing the job's value
   * here is faithful to the copy rather than a softening of it. It defaults to
   * this works' own 3 so every case that does not care reads as it did.
   */
  const HOST_BLEED_MM = job.bleedMm ?? 3;
  const HOST_MIN_DPI = 150;
  const HOST_SAFE_AREA_ADVISORY_MM = 4;
  const verdicts: ArtworkVerdict[] = [];

  if (file.bleedMm >= HOST_BLEED_MM) {
    verdicts.push({ level: "pass", key: "verdict.bleedOk", measured: { mm: file.bleedMm } });
  } else {
    verdicts.push({
      level: "fail",
      key: "verdict.bleedMissing",
      measured: {
        mm: file.bleedMm,
        needMm: HOST_BLEED_MM,
        haveW: file.widthMm,
        haveH: file.heightMm,
        needW: job.trimWidthMm + HOST_BLEED_MM * 2,
        needH: job.trimHeightMm + HOST_BLEED_MM * 2,
      },
    });
  }

  const dpi = Math.round(file.widthPx / (file.widthMm / 25.4));
  if (dpi >= HOST_MIN_DPI) {
    verdicts.push({ level: "pass", key: "verdict.dpiOk", measured: { dpi } });
  } else {
    verdicts.push({ level: "fail", key: "verdict.dpiLow", measured: { dpi, need: HOST_MIN_DPI } });
  }

  if (file.nearestInkMm < HOST_SAFE_AREA_ADVISORY_MM) {
    verdicts.push({
      level: "warn",
      key: "verdict.nearTrim",
      measured: { mm: file.nearestInkMm, suggest: HOST_SAFE_AREA_ADVISORY_MM },
    });
  }
  if (file.colourSpace !== "CMYK") {
    verdicts.push({ level: "warn", key: "verdict.rgb", measured: { space: file.colourSpace } });
  }
  if (!file.fontsEmbedded) {
    verdicts.push({ level: "fail", key: "verdict.fonts", measured: {} });
  }
  if (file.pages !== job.sides) {
    verdicts.push({
      level: job.sides === 2 && file.pages < 2 ? "fail" : "warn",
      key: "verdict.pages",
      measured: { pages: file.pages, need: job.sides },
    });
  }
  return verdicts;
}

const hostBlocked = (v: ArtworkVerdict[]) => v.some((x) => x.level === "fail");

// ── fixtures ─────────────────────────────────────────────────────────────────

const CARD = LAYOUTS.find((l) => l.id === "business-card")!;

function boxDraft(name: string, xMm: number, yMm: number, wMm: number, hMm: number): LayerDraft {
  return {
    kind: "shape",
    name,
    xMm,
    yMm,
    wMm,
    hMm,
    shape: "rect",
    fill: "#191920",
    stroke: "none",
    strokeMm: 0,
    radiusMm: 0,
  };
}

/** An 85 × 55 card with one 20 × 10 box at (10, 10). */
function cardWithBox(): { doc: Doc; id: string } {
  const base = createDoc({
    layoutId: "business-card",
    widthMm: 85,
    heightMm: 55,
    sides: 1,
  });
  return addLayer(base, "front", boxDraft("Box", 10, 10, 20, 10));
}

// ── the model ────────────────────────────────────────────────────────────────

describe("the document model", () => {
  it("defaults to the works' bleed and safe area", () => {
    const doc = createDoc({ layoutId: "blank", widthMm: 100, heightMm: 100, sides: 1 });
    expect(doc.bleedMm).toBe(BLEED_MM);
    expect(doc.safeMm).toBe(SAFE_MM);
  });

  it("derives layer ids from the document, so two identical builds match", () => {
    const a = cardWithBox();
    const b = cardWithBox();
    expect(a.id).toBe("shape-1");
    expect(b.id).toBe(a.id);
    expect(fileIdFor(a.doc)).toBe(fileIdFor(b.doc));
  });

  it("keeps ids unique after a delete, rather than reusing the freed one", () => {
    const first = cardWithBox();
    const second = addLayer(first.doc, "front", boxDraft("Box", 40, 10, 10, 10));
    expect(second.id).toBe("shape-2");
    const pruned = { ...second.doc, layers: second.doc.layers.filter((l) => l.id === "shape-2") };
    const third = addLayer(pruned, "front", boxDraft("Box", 0, 0, 5, 5));
    expect(third.id).toBe("shape-3");
  });

  it("refuses to let a patch change a layer's kind", () => {
    const { doc, id } = cardWithBox();
    const patched = updateLayer(doc, id, { kind: "text" } as never);
    expect(patched.layers[0]!.kind).toBe("shape");
  });
});

describe("hit-testing", () => {
  it("picks the topmost visible layer under the point", () => {
    const { doc } = cardWithBox();
    const two = addLayer(doc, "front", boxDraft("Over", 12, 12, 20, 10));
    expect(hitTest(two.doc, "front", { xMm: 15, yMm: 14 })!.id).toBe(two.id);
  });

  it("skips a hidden layer and falls through to what is under it", () => {
    const { doc } = cardWithBox();
    const two = addLayer(doc, "front", boxDraft("Over", 12, 12, 20, 10));
    const hidden = setHidden(two.doc, two.id, true);
    expect(hitTest(hidden, "front", { xMm: 15, yMm: 14 })!.id).toBe("shape-1");
  });

  it("tests an ellipse against the ellipse, not its bounding box", () => {
    const base = createDoc({ layoutId: "blank", widthMm: 85, heightMm: 55, sides: 1 });
    const { doc } = addLayer(base, "front", {
      kind: "shape",
      name: "Ellipse",
      xMm: 10,
      yMm: 10,
      wMm: 20,
      hMm: 20,
      shape: "ellipse",
      fill: "#0b7d59",
      stroke: "none",
      strokeMm: 0,
      radiusMm: 0,
    });
    expect(hitTest(doc, "front", { xMm: 20, yMm: 20 })).not.toBeNull(); // centre
    expect(hitTest(doc, "front", { xMm: 10.2, yMm: 10.2 })).toBeNull(); // corner
  });

  it("pads a hairline so a 0.4mm rule can still be picked up", () => {
    const base = createDoc({ layoutId: "blank", widthMm: 85, heightMm: 55, sides: 1 });
    const { doc } = addLayer(base, "front", boxDraft("Rule", 10, 20, 30, 0.4));
    expect(hitTest(doc, "front", { xMm: 20, yMm: 20.25 })).not.toBeNull();
    expect(hitTest(doc, "front", { xMm: 20, yMm: 24 })).toBeNull();
  });

  it("never reaches across to the other side of the sheet", () => {
    const doc = docFromLayout(CARD);
    expect(layersOn(doc, "back")).toHaveLength(1);
    const backText = layersOn(doc, "back")[0]!;
    const middle = { xMm: backText.xMm + 1, yMm: backText.yMm + 1 };
    expect(selectAt(doc, "back", middle)!).toBe(backText.id);
    const front = selectAt(doc, "front", middle);
    expect(front === null || front !== backText.id).toBe(true);
  });
});

// ── the snap solver ──────────────────────────────────────────────────────────

describe("the snap solver", () => {
  it("keeps the felt tolerance constant by dividing by the zoom", () => {
    expect(snapToleranceMm(1)).toBe(SNAP_TOLERANCE_MM);
    expect(snapToleranceMm(2)).toBe(SNAP_TOLERANCE_MM / 2);
    expect(snapToleranceMm(0.5)).toBe(SNAP_TOLERANCE_MM * 2);
    // The product is what the customer feels: the same slack on screen.
    expect(snapToleranceMm(4) * 4).toBeCloseTo(snapToleranceMm(1) * 1, 12);
  });

  it("leaves a position alone when nothing is within tolerance", () => {
    const { doc, id } = cardWithBox();
    const result = snap(doc, "front", id, 33.3, 21.7, 1);
    expect(result).toEqual({ xMm: 33.3, yMm: 21.7, lines: [] });
  });

  it("lands exactly on the page centre, not near it", () => {
    const { doc, id } = cardWithBox();
    const centreX = (85 - 20) / 2; // 32.5
    const centreY = (55 - 10) / 2; // 22.5
    const result = snap(doc, "front", id, centreX + 0.3, centreY - 0.25, 1);
    expect(result.xMm).toBe(centreX);
    expect(result.yMm).toBe(centreY);
    expect(result.lines).toEqual([
      { axis: "x", atMm: 42.5 },
      { axis: "y", atMm: 27.5 },
    ]);
  });

  it("snaps to the trim edge, the safe area and the bleed edge", () => {
    const { doc, id } = cardWithBox();
    expect(snap(doc, "front", id, 0.4, 30, 1).xMm).toBe(0); // trim
    expect(snap(doc, "front", id, SAFE_MM - 0.4, 30, 1).xMm).toBe(SAFE_MM); // safe
    expect(snap(doc, "front", id, -BLEED_MM + 0.2, 30, 1).xMm).toBe(-BLEED_MM); // bleed
    expect(snap(doc, "front", id, 85 - 20 - 0.3, 30, 1).xMm).toBe(65); // trim, far edge
  });

  it("snaps to another object's edges and to its centre", () => {
    const { doc } = cardWithBox(); // box at (10,10) 20 × 10
    const second = addLayer(doc, "front", boxDraft("Other", 50, 40, 10, 6));
    const id = second.id;

    // start edge to start edge
    expect(snap(second.doc, "front", id, 10.3, 40, 1).xMm).toBe(10);
    // end edge to end edge: 10 + 20 - 10 = 20
    expect(snap(second.doc, "front", id, 20.2, 40, 1).xMm).toBe(20);
    // centre to centre: 10 + 10 - 5 = 15
    expect(snap(second.doc, "front", id, 15.2, 40, 1).xMm).toBe(15);
  });

  it("ignores hidden neighbours and itself", () => {
    const { doc } = cardWithBox();
    const second = addLayer(doc, "front", boxDraft("Other", 50, 40, 10, 6));
    const hidden = setHidden(second.doc, "shape-1", true);
    // 10.3 would have snapped to the hidden box's edge; now nothing is there.
    expect(snap(hidden, "front", second.id, 10.3, 40, 1).xMm).toBe(10.3);
  });

  it("gives the page priority over a neighbour sitting at the same place", () => {
    // A neighbour whose start edge IS the page centre for the moving layer.
    const base = createDoc({ layoutId: "blank", widthMm: 85, heightMm: 55, sides: 1 });
    const a = addLayer(base, "front", boxDraft("Neighbour", 32.5, 40, 20, 5));
    const b = addLayer(a.doc, "front", boxDraft("Moving", 60, 10, 20, 10));
    const result = snap(b.doc, "front", b.id, 32.6, 30, 1);
    expect(result.xMm).toBe(32.5);
    // The page centre's guide is the page centre, not the neighbour's edge.
    expect(result.lines).toContainEqual({ axis: "x", atMm: 42.5 });
  });

  it("engages over a narrower window as the customer zooms in", () => {
    const { doc, id } = cardWithBox();
    const off = 0.3; // inside 0.5mm, outside 0.25mm
    expect(snap(doc, "front", id, 32.5 + off, 30, 1).xMm).toBe(32.5);
    expect(snap(doc, "front", id, 32.5 + off, 30, 2).xMm).toBe(32.5 + off);
  });

  it("engages over a wider window in millimetres as the customer zooms out", () => {
    const { doc, id } = cardWithBox();
    const off = 0.8; // outside 0.5mm, inside 1.0mm
    expect(snap(doc, "front", id, 32.5 + off, 30, 1).xMm).toBe(32.5 + off);
    expect(snap(doc, "front", id, 32.5 + off, 30, 0.5).xMm).toBe(32.5);
  });

  it("takes the nearest candidate when two are in range", () => {
    const { doc, id } = cardWithBox();
    // 0 (trim) and 4 (safe) are 4mm apart; at a very low zoom both are in range.
    const result = snap(doc, "front", id, 2.6, 30, 0.05);
    expect(result.xMm).toBe(SAFE_MM);
  });

  it("reports one guide line per axis and none when nothing engaged", () => {
    const { doc, id } = cardWithBox();
    expect(snap(doc, "front", id, 0.2, 30.4, 1).lines).toEqual([{ axis: "x", atMm: 0 }]);
    expect(snap(doc, "front", id, 30.4, 30.4, 1).lines).toEqual([]);
  });

  it("returns the position untouched for a layer that is not there", () => {
    const { doc } = cardWithBox();
    expect(snap(doc, "front", "no-such-layer", 7, 9, 1)).toEqual({ xMm: 7, yMm: 9, lines: [] });
  });

  it("moveLayer writes the snapped position onto the document", () => {
    const { doc, id } = cardWithBox();
    const { doc: moved, lines } = moveLayer(doc, id, 32.6, 22.4, 1);
    expect(moved.layers[0]!.xMm).toBe(32.5);
    expect(moved.layers[0]!.yMm).toBe(22.5);
    expect(lines).toHaveLength(2);
  });
});

// ── history ──────────────────────────────────────────────────────────────────

describe("undo and redo", () => {
  const step = (doc: Doc, x: number) => updateLayer(doc, "shape-1", { xMm: x });

  it("steps back and forward through separate edits", () => {
    const { doc } = cardWithBox();
    let h = createHistory(doc);
    expect(canUndo(h)).toBe(false);

    h = commit(h, step(doc, 20));
    h = commit(h, step(h.present, 30));
    expect(h.present.layers[0]!.xMm).toBe(30);

    h = undo(h);
    expect(h.present.layers[0]!.xMm).toBe(20);
    h = undo(h);
    expect(h.present.layers[0]!.xMm).toBe(10);
    expect(canUndo(h)).toBe(false);

    h = redo(h);
    expect(h.present.layers[0]!.xMm).toBe(20);
    expect(canRedo(h)).toBe(true);
  });

  it("collapses a sixty-sample drag into ONE undo step", () => {
    const { doc } = cardWithBox();
    let h = createHistory(doc);
    for (let i = 1; i <= 60; i += 1) h = commit(h, step(h.present, 10 + i * 0.5), "drag:shape-1");
    h = endGesture(h);

    expect(h.present.layers[0]!.xMm).toBe(40);
    expect(h.past).toHaveLength(1);

    h = undo(h);
    expect(h.present.layers[0]!.xMm).toBe(10);
    expect(canUndo(h)).toBe(false);
  });

  it("starts a new step when the same layer is picked up a second time", () => {
    const { doc } = cardWithBox();
    let h = createHistory(doc);
    h = commit(h, step(h.present, 20), "drag:shape-1");
    h = endGesture(h);
    h = commit(h, step(h.present, 30), "drag:shape-1");
    h = endGesture(h);

    expect(h.past).toHaveLength(2);
    expect(undo(h).present.layers[0]!.xMm).toBe(20);
  });

  it("breaks the run when a different layer is dragged", () => {
    const { doc } = cardWithBox();
    const two = addLayer(doc, "front", boxDraft("Other", 40, 40, 10, 6));
    let h = createHistory(two.doc);
    h = commit(h, updateLayer(h.present, "shape-1", { xMm: 20 }), "drag:shape-1");
    h = commit(h, updateLayer(h.present, "shape-2", { xMm: 50 }), "drag:shape-2");
    expect(h.past).toHaveLength(2);
  });

  it("does not coalesce two edits that merely happen to be adjacent", () => {
    const { doc } = cardWithBox();
    let h = createHistory(doc);
    h = commit(h, step(h.present, 20));
    h = commit(h, step(h.present, 30));
    expect(h.past).toHaveLength(2);
  });

  it("throws away the redo branch as soon as a new edit lands", () => {
    const { doc } = cardWithBox();
    let h = createHistory(doc);
    h = commit(h, step(h.present, 20));
    h = undo(h);
    expect(canRedo(h)).toBe(true);
    h = commit(h, step(h.present, 25));
    expect(canRedo(h)).toBe(false);
  });

  it("does not let a drag coalesce into the state an undo just restored", () => {
    const { doc } = cardWithBox();
    let h = createHistory(doc);
    h = commit(h, step(h.present, 20), "drag:shape-1");
    h = undo(h); // back to 10, and the token is cleared
    h = commit(h, step(h.present, 15), "drag:shape-1");
    expect(h.past).toHaveLength(1);
    expect(undo(h).present.layers[0]!.xMm).toBe(10);
  });

  it("holds fifty steps and drops the oldest, never the newest", () => {
    const { doc } = cardWithBox();
    let h = createHistory(doc);
    for (let i = 1; i <= HISTORY_LIMIT + 20; i += 1) h = commit(h, step(h.present, i));

    expect(h.past).toHaveLength(HISTORY_LIMIT);
    expect(h.present.layers[0]!.xMm).toBe(HISTORY_LIMIT + 20);
    for (let i = 0; i < HISTORY_LIMIT; i += 1) h = undo(h);
    expect(canUndo(h)).toBe(false);
    expect(h.present.layers[0]!.xMm).toBe(20); // the twenty oldest are gone
  });

  it("undo and redo on an exhausted stack are no-ops, not errors", () => {
    const { doc } = cardWithBox();
    const h = createHistory(doc);
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
  });
});

// ── align, distribute, z-order ───────────────────────────────────────────────

describe("align and distribute", () => {
  it("aligns to each page edge and to both centres", () => {
    const { doc, id } = cardWithBox();
    expect(alignToPage(doc, id, "left").layers[0]!.xMm).toBe(0);
    expect(alignToPage(doc, id, "right").layers[0]!.xMm).toBe(65);
    expect(alignToPage(doc, id, "centreX").layers[0]!.xMm).toBe(32.5);
    expect(alignToPage(doc, id, "top").layers[0]!.yMm).toBe(0);
    expect(alignToPage(doc, id, "bottom").layers[0]!.yMm).toBe(45);
    expect(alignToPage(doc, id, "middle").layers[0]!.yMm).toBe(22.5);
  });

  it("refuses to spread two things WITH A REASON rather than a bare false", () => {
    const { doc } = cardWithBox();
    const two = addLayer(doc, "front", boxDraft("Other", 40, 10, 10, 10));
    const result = distribute(two.doc, "front", "x");
    expect(result).toEqual({ ok: false, reason: "needs-three" });
  });

  it("evens the gaps between three things, leaving the outer two alone", () => {
    let doc = createDoc({ layoutId: "blank", widthMm: 100, heightMm: 50, sides: 1 });
    doc = addLayer(doc, "front", boxDraft("A", 0, 10, 10, 10)).doc;
    doc = addLayer(doc, "front", boxDraft("B", 20, 10, 10, 10)).doc;
    doc = addLayer(doc, "front", boxDraft("C", 70, 10, 10, 10)).doc;

    const result = distribute(doc, "front", "x");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const xs = result.doc.layers.map((l) => l.xMm);
    expect(xs).toEqual([0, 35, 70]);
  });

  it("does not spread hidden layers", () => {
    let doc = createDoc({ layoutId: "blank", widthMm: 100, heightMm: 50, sides: 1 });
    doc = addLayer(doc, "front", boxDraft("A", 0, 10, 10, 10)).doc;
    doc = addLayer(doc, "front", boxDraft("B", 20, 10, 10, 10)).doc;
    doc = addLayer(doc, "front", boxDraft("C", 70, 10, 10, 10)).doc;
    doc = setHidden(doc, "shape-2", true);
    expect(distribute(doc, "front", "x")).toEqual({ ok: false, reason: "needs-three" });
  });
});

describe("z-order", () => {
  function threeUp(): Doc {
    let doc = createDoc({ layoutId: "blank", widthMm: 85, heightMm: 55, sides: 2 });
    doc = addLayer(doc, "front", boxDraft("A", 0, 0, 5, 5)).doc;
    doc = addLayer(doc, "back", boxDraft("Back", 0, 0, 5, 5)).doc;
    doc = addLayer(doc, "front", boxDraft("B", 6, 0, 5, 5)).doc;
    doc = addLayer(doc, "front", boxDraft("C", 12, 0, 5, 5)).doc;
    return doc;
  }
  const frontOrder = (doc: Doc) => layersOn(doc, "front").map((l) => l.name);

  it("moves through the four steps", () => {
    const doc = threeUp();
    expect(frontOrder(doc)).toEqual(["A", "B", "C"]);
    expect(frontOrder(moveZ(doc, "shape-1", "front"))).toEqual(["B", "C", "A"]);
    expect(frontOrder(moveZ(doc, "shape-1", "forward"))).toEqual(["B", "A", "C"]);
    expect(frontOrder(moveZ(doc, "shape-4", "backward"))).toEqual(["A", "C", "B"]);
    expect(frontOrder(moveZ(doc, "shape-4", "back"))).toEqual(["C", "A", "B"]);
  });

  it("leaves the other side exactly where it was", () => {
    const doc = threeUp();
    const before = doc.layers.findIndex((l) => l.side === "back");
    const after = moveZ(doc, "shape-1", "front").layers.findIndex((l) => l.side === "back");
    expect(after).toBe(before);
    expect(layersOn(moveZ(doc, "shape-1", "front"), "back").map((l) => l.name)).toEqual(["Back"]);
  });

  it("is a no-op at the ends rather than an error", () => {
    const doc = threeUp();
    expect(moveZ(doc, "shape-1", "backward")).toEqual(doc);
    expect(moveZ(doc, "shape-4", "forward")).toEqual(doc);
    expect(moveZ(doc, "no-such-layer", "front")).toBe(doc);
  });
});

// ── warnings ─────────────────────────────────────────────────────────────────

describe("the seeded starting layouts", () => {
  /**
   * Seeded text has to FIT ITS OWN BOX, at every size from an 85mm card to an
   * 850 × 2000mm banner.
   *
   * This is the regression guard for a real bug: a headline sized from the box
   * HEIGHT alone came out at 553pt on the roll-up banner, wrapped to three
   * lines, and ran through the line beneath it. The damage was not only visual
   * — the drawn ink left the safe area while `outsideSafeArea()`, which measures
   * boxes, said nothing was wrong.
   *
   * The two constants mirror the seeder's own estimate (`layouts.ts`): an
   * average glyph advance of 0.52 × the font size, and the 1.16 line-height the
   * canvas renders text at.
   */
  const ADVANCE = 0.52;
  const LINE_HEIGHT = 1.16;
  const MM_PER_PT = 0.3528;

  const width = (text: string) => {
    let total = 0;
    for (const ch of text) {
      const code = ch.codePointAt(0) ?? 0;
      total +=
        (code >= 0x1100 && code <= 0x115f) ||
        (code >= 0x2e80 && code <= 0xa4cf) ||
        (code >= 0xac00 && code <= 0xd7a3) ||
        (code >= 0xf900 && code <= 0xfaff) ||
        (code >= 0xff01 && code <= 0xff60)
          ? 2
          : 1;
    }
    return total;
  };

  /**
   * Run over ALL EIGHT locales, not just English. The German copy is longer
   * than the English and the Chinese glyphs are twice as wide, so a seed that
   * fits in one language proves nothing about the other seven.
   */
  const CASES = LOCALE_TAGS.flatMap((tag) =>
    [...LAYOUTS, BLANK_LAYOUT].map((layout) => ({ tag, layout, id: `${layout.id} · ${tag}` })),
  );

  it.each(CASES)("$id keeps its seeded text inside its box", ({ tag, layout }) => {
    const bundle = designStudioStrings[tag];
    const doc = docFromLayout(layout, {
      headline: bundle["addon.design-studio.seed.headline"],
      detail: bundle["addon.design-studio.seed.detail"],
      back: bundle["addon.design-studio.seed.back"],
      textName: bundle["addon.design-studio.layer.text"],
      lineName: bundle["addon.design-studio.layer.line"],
    });

    for (const layer of doc.layers) {
      if (layer.kind !== "text") continue;
      const sizeMm = layer.sizePt * MM_PER_PT;
      const runMm = width(layer.text) * ADVANCE * sizeMm;
      const lines = Math.max(1, Math.ceil(runMm / layer.wMm));
      const neededMm = lines * sizeMm * LINE_HEIGHT;
      expect(
        neededMm,
        `${layout.id}/${tag}: "${layer.text}" needs ${neededMm}mm in ${layer.hMm}mm`,
      ).toBeLessThanOrEqual(layer.hMm + 0.5);
    }
  });

  it("puts every seeded layer inside the safe area, on both sides", () => {
    for (const layout of LAYOUTS) {
      const doc = docFromLayout(layout);
      for (const layer of doc.layers) {
        expect(layer.xMm, layout.id).toBeGreaterThanOrEqual(SAFE_MM);
        expect(layer.yMm, layout.id).toBeGreaterThanOrEqual(SAFE_MM);
        expect(layer.xMm + layer.wMm, layout.id).toBeLessThanOrEqual(layout.widthMm - SAFE_MM);
        expect(layer.yMm + layer.hMm, layout.id).toBeLessThanOrEqual(layout.heightMm - SAFE_MM);
      }
    }
  });

  it("seeds the back only where the product has one", () => {
    for (const layout of LAYOUTS) {
      const doc = docFromLayout(layout);
      expect(layersOn(doc, "back").length > 0, layout.id).toBe(layout.sides === 2);
    }
  });

  it("opens blank from blank — a starting layout with nothing on it", () => {
    expect(docFromLayout(BLANK_LAYOUT).layers).toEqual([]);
  });
});

describe("outsideSafeArea", () => {
  it("says nothing about a fresh document from any of the six layouts", () => {
    for (const layout of LAYOUTS) {
      expect(outsideSafeArea(docFromLayout(layout))).toEqual([]);
    }
    expect(outsideSafeArea(docFromLayout(BLANK_LAYOUT))).toEqual([]);
  });

  it("names a layer that has crossed the safe boundary", () => {
    const { doc, id } = cardWithBox();
    const nudged = updateLayer(doc, id, { xMm: SAFE_MM - 0.5 });
    expect(outsideSafeArea(nudged).map((l) => l.id)).toEqual([id]);
  });

  it("stays quiet about a deliberate full-bleed background", () => {
    const base = createDoc({ layoutId: "blank", widthMm: 85, heightMm: 55, sides: 1 });
    const { doc } = addLayer(base, "front", boxDraft("Background", -3, -3, 91, 61));
    expect(outsideSafeArea(doc)).toEqual([]);
  });

  it("ignores hidden layers, because hidden ink does not print", () => {
    const { doc, id } = cardWithBox();
    const nudged = setHidden(updateLayer(doc, id, { xMm: 1 }), id, true);
    expect(outsideSafeArea(nudged)).toEqual([]);
  });

  it("looks at both sides of the sheet", () => {
    const doc = docFromLayout(CARD);
    const backId = layersOn(doc, "back")[0]!.id;
    expect(outsideSafeArea(updateLayer(doc, backId, { yMm: -1 })).map((l) => l.id)).toEqual([backId]);
  });
});

// ── output ───────────────────────────────────────────────────────────────────

describe("toArtworkRef", () => {
  it("adds the document's own bleed to the finished size", () => {
    const doc = docFromLayout(CARD);
    const ref = toArtworkRef(doc);
    expect(ref.widthMm).toBe(91);
    expect(ref.heightMm).toBe(61);
    expect(ref.bleedMm).toBe(3);
    expect(ref.dpi).toBe(OUTPUT_DPI);
    expect(ref.pages).toBe(2);
    expect(ref.source).toBe("design-studio");
    expect(ref.previewFileId).toBe(`${fileIdFor(doc)}-preview.png`);
  });

  it("is the finished size exactly when the document carries no bleed", () => {
    const doc = docFromLayout(CARD, DEFAULT_SEED_TEXT, 0);
    const ref = toArtworkRef(doc);
    expect(ref.bleedMm).toBe(0);
    expect(ref.widthMm).toBe(85);
    expect(ref.heightMm).toBe(55);
    // The pixels follow the sheet rather than a remembered one: 300dpi of 85mm,
    // not of the 91mm this add-on used to build whatever it was asked for.
    expect(toArtworkFile(doc).widthPx).toBe(Math.round((85 / 25.4) * OUTPUT_DPI));
  });

  it("grows the sheet, and only the sheet, when the job asks for more", () => {
    const five = docFromLayout(CARD, DEFAULT_SEED_TEXT, 5);
    expect(toArtworkRef(five).widthMm).toBe(95);
    expect(toArtworkRef(five).heightMm).toBe(65);
    // NOTHING THE CUSTOMER PUT DOWN MOVES. The seeds are clamped into the safe
    // area, which is measured from the trim, so the bleed changes the sheet the
    // design sits on and not the design.
    expect(five.layers).toEqual(docFromLayout(CARD).layers);
  });

  it("gives the same file id for the same document and a different one otherwise", () => {
    const a = docFromLayout(CARD);
    const b = docFromLayout(CARD);
    expect(toArtworkRef(a).fileId).toBe(toArtworkRef(b).fileId);
    const moved = updateLayer(a, layersOn(a, "front")[0]!.id, { xMm: 9 });
    expect(toArtworkRef(moved).fileId).not.toBe(toArtworkRef(a).fileId);
  });

  it("measures the nearest ink off the document rather than guessing", () => {
    const { doc, id } = cardWithBox();
    expect(nearestInkMm(doc)).toBe(10);
    expect(nearestInkMm(updateLayer(doc, id, { xMm: -3 }))).toBe(-3);
    const empty = createDoc({ layoutId: "blank", widthMm: 85, heightMm: 55, sides: 1 });
    expect(nearestInkMm(empty)).toBe(27.5);
  });

  it("exports at 300dpi, comfortably over the works' 150dpi floor", () => {
    const file = toArtworkFile(docFromLayout(CARD));
    expect(Math.round(file.widthPx / (file.widthMm / 25.4))).toBe(300);
  });
});

/**
 * THE ASSERTION THIS WHOLE ADD-ON EXISTS TO EARN. The host runs the checks, not
 * the add-on (24 §5.5), and the output passes because it was built at the
 * finished size with the bleed already on it.
 */
describe("the host's own artwork checks, run against this editor's output", () => {
  it("passes on every one of the six starting layouts, with nothing to fix", () => {
    for (const layout of LAYOUTS) {
      const doc = docFromLayout(layout);
      const verdicts = hostCheckArtwork(toArtworkFile(doc), {
        trimWidthMm: layout.widthMm,
        trimHeightMm: layout.heightMm,
        sides: layout.sides,
      });
      expect(hostBlocked(verdicts), `${layout.id} was blocked`).toBe(false);
      expect(verdicts.every((v) => v.level === "pass"), `${layout.id} had a warning`).toBe(true);
      expect(verdicts.map((v) => v.key)).toContain("verdict.bleedOk");
    }
  });

  it("still passes the bleed check after the customer drags ink off the edge", () => {
    const doc = docFromLayout(CARD);
    const id = layersOn(doc, "front")[0]!.id;
    const bled = updateLayer(doc, id, { xMm: -3, yMm: -3 });
    const verdicts = hostCheckArtwork(toArtworkFile(bled), {
      trimWidthMm: 85,
      trimHeightMm: 55,
      sides: 2,
    });
    // The bleed is a property of the DOCUMENT, so it cannot be edited away.
    expect(hostBlocked(verdicts)).toBe(false);
    // Ink at the cut is still worth a word — a warning, which the customer ticks.
    expect(verdicts.some((v) => v.key === "verdict.nearTrim")).toBe(true);
  });

  /*
   * THE CASE THE OLD CONSTANT WOULD HAVE FAILED, both ways round.
   *
   * A host asking for 5mm rejected a 3mm file outright — its own add-on's file,
   * for its own job. A host asking for none passed the bleed check (3 ≥ 0) and
   * took delivery of a sheet 6mm too big in each direction, which is worse: no
   * verdict fires, and the mug the design is reproduced onto is a fixed size, so
   * the error surfaces as a design that does not fit.
   */
  it("passes at a bleed this add-on does not think of as the usual one", () => {
    for (const bleedMm of [0, 5]) {
      const doc = docFromLayout(CARD, DEFAULT_SEED_TEXT, bleedMm);
      const file = toArtworkFile(doc);
      const verdicts = hostCheckArtwork(file, {
        trimWidthMm: CARD.widthMm,
        trimHeightMm: CARD.heightMm,
        sides: CARD.sides,
        bleedMm,
      });
      expect(hostBlocked(verdicts), `${bleedMm}mm was blocked`).toBe(false);
      expect(verdicts.map((v) => v.key)).toContain("verdict.bleedOk");
      // And the file IS the size that host asked for — a pass on the bleed
      // check alone would also be a pass for a file that is simply too big.
      expect(file.widthMm).toBe(CARD.widthMm + bleedMm * 2);
      expect(file.heightMm).toBe(CARD.heightMm + bleedMm * 2);
    }
  });

  it("sends one page per printed side, so the page-count check is quiet", () => {
    const oneSided = LAYOUTS.find((l) => l.sides === 1)!;
    const verdicts = hostCheckArtwork(toArtworkFile(docFromLayout(oneSided)), {
      trimWidthMm: oneSided.widthMm,
      trimHeightMm: oneSided.heightMm,
      sides: 1,
    });
    expect(verdicts.some((v) => v.key === "verdict.pages")).toBe(false);
  });
});

describe("the saved design record", () => {
  it("takes the clock as an argument and never reads one", () => {
    const doc = docFromLayout(CARD);
    const now = "2026-08-05T10:20:00";
    const record = toDesignRecord(doc, { jobRef: "MP-4127", product: "business-cards", nowIso: now });
    expect(record.createdAt).toBe(now);
    expect(record.updatedAt).toBe(now);
    expect(record.widthMm).toBe(85);
    expect(record.bleedMm).toBe(3);
    expect(record.previewFile).toBe(`${fileIdFor(doc)}-preview.png`);
  });

  it("keeps the original creation time when a saved design is edited again", () => {
    const doc = docFromLayout(CARD);
    const record = toDesignRecord(doc, {
      id: "d-1",
      jobRef: "MP-4127",
      product: "business-cards",
      nowIso: "2026-08-05T14:00:00",
      createdAtIso: "2026-08-05T10:20:00",
    });
    expect(record.createdAt).toBe("2026-08-05T10:20:00");
    expect(record.updatedAt).toBe("2026-08-05T14:00:00");
  });
});

describe("layoutForSize", () => {
  it("matches a job's finished size exactly, in either orientation", () => {
    expect(layoutForSize(85, 55)!.id).toBe("business-card");
    expect(layoutForSize(55, 85)!.id).toBe("business-card");
    expect(layoutForSize(105, 148)!.id).toBe("flyer");
  });

  it("falls back to the nearest shape rather than to nothing", () => {
    expect(layoutForSize(90, 58)!.id).toBe("business-card");
    expect(layoutForSize(800, 1900)!.id).toBe("roll-up");
  });
});
