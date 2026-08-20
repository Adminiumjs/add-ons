/**
 * THE DEV HARNESS'S PAYLOADS, RENDERED.
 *
 * ── WHY A SUITE FOR SOMETHING THAT DOES NOT SHIP ────────────────────────────
 *
 * `dev/main.tsx` is a HOST. It resolves this add-on's `artwork.sources` fill out
 * of a registry and hands it a payload, which is the same act the print works
 * performs and the only place in this repo where that act is written down. It
 * went stale and nothing said so: it was still passing the host's old
 * `{ config: { product, size, sides, quantity } }` record long after the slot
 * started carrying a resolved `job` in millimetres, so `jobFromPayload()`
 * returned `undefined` and every tile threw on `job.trimWidthMm` at the first
 * click. `npm run typecheck` stayed green — the fill was cast to
 * `(p: unknown) => ReactNode` at the call site, which erased the payload type —
 * and no suite had ever rendered the harness, so the only thing that could have
 * noticed was somebody opening a browser.
 *
 * The cast is gone, so the SHAPE is the compiler's business now. This file is
 * the other half of the repair, and it makes two claims a type cannot:
 *
 *   THE PAYLOAD DRAWS. A shape that satisfies `ArtworkSlotPayload` and still
 *   cannot be rendered — a job the source declines, a field that reads as
 *   `undefined` at run time — is red here rather than on somebody's screen.
 *
 *   THE PANELS STILL DEMONSTRATE WHAT THEY SAY. Each one exists to show one
 *   case, and says so above the slot: this size matches a starting layout, this
 *   one matches none, this one asks for no bleed at all. A harness whose notes
 *   have drifted from its jobs is worse than no harness, because it is read as
 *   evidence.
 *
 * ── HOW IT RENDERS ──────────────────────────────────────────────────────────
 *
 * `renderToStaticMarkup`, for the reason `import-canva`'s settings-panel suite
 * gives: this repo ships no jsdom, and it does not need one here. The tile holds
 * its state in `useState` and reads the reader's language from `<html lang>`
 * through a guard that answers `en-US` where there is no document, so the static
 * render is the real component tree rather than a stand-in for it.
 */

import { Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createRegistry, type ArtworkJob, type ArtworkResult } from "@adminium/add-on-host";
import { jobSpecSchema } from "@adminium/add-on-host/testing";

import { HARNESS_JOBS } from "../dev/jobs.ts";
import { createArtworkSource } from "./artworkSource.ts";
import { designStudioStrings } from "./i18n/strings.ts";
import { register } from "./index.ts";
import { LAYOUTS } from "./layouts.ts";
import { initialLayoutFor } from "./ui/SourceTile.tsx";

const EN = designStudioStrings["en-US"];
const addOn = register();

/**
 * Resolved THROUGH THE REGISTRY, exactly as `dev/main.tsx` resolves it.
 *
 * Reaching into `addOn.fills` and picking the entry out by hand would test a
 * path nothing runs. `fillsFor` is what a mount site calls, and it is also what
 * gives the harness a `render` typed to this slot's payload instead of the union
 * over every id — the erasure that let the stale payload through in the first
 * place.
 */
const artworkFills = createRegistry([addOn]).fillsFor("artwork.sources", new Set([addOn.key]));

/** Every layout this build ships, which is what a shop that has changed nothing offers. */
const OFFERED = LAYOUTS;

/** The harness's own panels, by the reference each one is headed with. */
const jobFor = (ref: string): ArtworkJob => {
  const panel = HARNESS_JOBS.find((entry) => entry.ref === ref);
  if (panel === undefined) throw new Error(`the harness no longer has a panel for ${ref}`);
  return panel.job;
};

/**
 * What the harness draws for one panel: every fill the registry resolved,
 * handed the payload and rendered.
 */
function drawnFor(job: ArtworkJob): { html: string; handedBack: ArtworkResult[] } {
  const handedBack: ArtworkResult[] = [];
  const html = renderToStaticMarkup(
    <>
      {artworkFills.map(({ addOn: key, fill }) => (
        <Fragment key={key}>
          {fill.render({ job, onArtwork: (result) => handedBack.push(result) })}
        </Fragment>
      ))}
    </>,
  );
  return { html, handedBack };
}

describe("the harness mounts the slot the way a host does", () => {
  it("resolves this add-on's artwork fill, so the assertions below are about something", () => {
    expect(artworkFills.map((f) => f.addOn)).toEqual(["design-studio"]);
  });

  it("has a panel for each case it means to show", () => {
    expect(HARNESS_JOBS.map((entry) => entry.ref)).toEqual(["MP-4127", "MP-4131", "MP-4136"]);
    // A note is the panel's promise to the reader; a blank one promises nothing.
    for (const { ref, note } of HARNESS_JOBS) {
      expect(note.trim(), `${ref} says nothing above its slot`).not.toBe("");
    }
  });
});

describe.each(HARNESS_JOBS)("$ref — the payload dev/main.tsx passes", ({ job }) => {
  it("carries a job the artwork-source contract itself would accept", () => {
    /*
     * THE CONTRACT'S OWN VALIDATOR, and `.strict()` is what makes it bite where
     * rendering does not. A tile whose measurements are all `undefined` draws
     * perfectly well — `undefined > MAX_SIDE_MM` is false, so the source finds
     * nothing to decline — and the customer only meets the defect at the canvas.
     * The stale shape that broke this harness fails here on the key it has and
     * on the seven it does not.
     */
    const parsed = jobSpecSchema.safeParse(job);
    expect(parsed.success, parsed.error?.message).toBe(true);
  });

  it("renders the tile rather than throwing on a field the payload does not carry", () => {
    const { html } = drawnFor(job);
    expect(html).toContain(EN["addon.design-studio.tile.title"]);
  });

  it("offers the tile, rather than drawing it disabled with a reason", () => {
    // The tile is disabled when `available()` declines — too big, or a shop with
    // every layout switched off. A harness panel nobody can click demonstrates
    // nothing, so a job that has drifted past the works' own limits fails here.
    const { html } = drawnFor(job);
    expect(html).toContain(EN["addon.design-studio.tile.body"]);
    expect(html).not.toMatch(/\sdisabled/);
  });

  it("hands nothing back until the customer has been through the editor", () => {
    // `onArtwork` is the host's sink. A fill that called it on the way past would
    // put a design on an order nobody drew, which is the failure this cheap
    // assertion is here to catch.
    expect(drawnFor(job).handedBack).toEqual([]);
  });
});

/**
 * WHAT EACH PANEL IS FOR, held to what it says.
 *
 * Through `initialLayoutFor` — the shipped decision — rather than through a
 * restatement of it here. That is the difference between a suite that follows
 * the code and one that agrees with an old copy of it.
 */
describe("each panel still demonstrates the case it was added for", () => {
  it("MP-4127 opens straight onto a starting layout, because a layout is that size", () => {
    const job = jobFor("MP-4127");
    const layout = initialLayoutFor(job.trimWidthMm, job.trimHeightMm, OFFERED);
    expect(layout?.id).toBe("business-card");
    expect(layout?.sides).toBe(job.sides);
  });

  it("MP-4131 opens the picker, because no starting layout is A4", () => {
    const job = jobFor("MP-4131");
    expect(initialLayoutFor(job.trimWidthMm, job.trimHeightMm, OFFERED)).toBeUndefined();
  });

  /*
   * THE ZERO IS AN INSTRUCTION, AND THIS PANEL IS WHERE A CUSTOMER MEETS IT.
   *
   * `artworkSource.test.ts` already drives a zero-bleed job through the source,
   * and this does not duplicate it: what is asserted here is that the HARNESS
   * still carries the case at all, and that the job it carries resolves to a
   * canvas — an exact layout match, so the picker is skipped and the missing
   * hatch is the first thing on screen.
   */
  it("MP-4136 drives the bleedMm: 0 case the payload registry documents", async () => {
    const job = jobFor("MP-4136");
    expect(job.bleedMm).toBe(0);

    const layout = initialLayoutFor(job.trimWidthMm, job.trimHeightMm, OFFERED);
    expect(layout?.id).toBe("sticker");

    const ref = await createArtworkSource({
      // The editor, headless: it opens on the layout the tile chose and builds
      // its document with `startDoc`, which is where the job's bleed is bound.
      open: (_job, _layouts, startDoc) => Promise.resolve(startDoc(layout!)),
    }).start(job);

    expect(ref).not.toBeNull();
    expect(ref!.bleedMm).toBe(0);
    expect(ref!.widthMm).toBe(job.trimWidthMm);
    expect(ref!.heightMm).toBe(job.trimHeightMm);
  });

  it("MP-4127 comes back at the trim plus the bleed on every edge, for contrast", async () => {
    // The panel beside it, through the same path: the zero above is only worth
    // asserting if a job that DOES ask for bleed still gets a bigger sheet.
    const job = jobFor("MP-4127");
    const layout = initialLayoutFor(job.trimWidthMm, job.trimHeightMm, OFFERED)!;
    const ref = await createArtworkSource({
      open: (_job, _layouts, startDoc) => Promise.resolve(startDoc(layout)),
    }).start(job);

    expect(ref!.bleedMm).toBe(job.bleedMm);
    expect(ref!.widthMm).toBe(job.trimWidthMm + job.bleedMm * 2);
    expect(ref!.heightMm).toBe(job.trimHeightMm + job.bleedMm * 2);
  });
});
