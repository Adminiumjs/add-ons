/**
 * THE MANAGE DRAWER'S ACCOUNT ROW IS A SIMULATED RESULT, AND MUST SAY SO (AC7).
 *
 * This suite exists because of a real defect. The settings fill printed
 * `DEMO_ACCOUNT` and `DEMO_AUTHORIZED_ON` — "studio@marlowpress.test ·
 * authorized 1 Aug" — with no label of any kind, in the same quiet grey card a
 * genuine connection would use. Four other surfaces in this add-on carried the
 * `DemoNote`; this one did not, and it is the one a shop owner opens to ask
 * "which accounts are connected?".
 *
 * AC7's test is whether a reviewer could screenshot the panel and take it for
 * real. An account name and an authorization date is exactly the kind of thing
 * a real OAuth connection produces, so the label is not decoration on a happy
 * path — it is the difference between a demo and a claim.
 *
 * Rendered with `renderToStaticMarkup` rather than a DOM harness: this repo
 * ships no jsdom, the panel holds no state, and `useSyncExternalStore` is given
 * a server snapshot (`t.ts`), so the static render is the real component tree
 * and not a stand-in for it.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createDemoTransport, DEMO_ACCOUNT, type CanvaTransport } from "../demo/transport.ts";
import { importCanvaStrings } from "../i18n/strings.ts";
import { PINNED_CLOCK, register } from "../index.ts";
import { SettingsPanel } from "./SettingsPanel.tsx";

const EN = importCanvaStrings["en-US"];
const DEMO_LABEL = EN["addon.import-canva.demo.account"];

/** The demo transport the host actually mounts this panel with. */
const simulated = createDemoTransport(PINNED_CLOCK);

/**
 * What a self-host build hands over instead: the host's authorized client,
 * wrapped. `simulated` is false, so the label must disappear on its own —
 * a demo note that survives a real connection is its own kind of lie.
 */
const connected: CanvaTransport = {
  simulated: false,
  list: () => Promise.resolve([]),
  export: () => Promise.resolve({ fileId: "x", filename: "x.pdf", design: simulatedSize() }),
};

function simulatedSize() {
  return { widthMm: 85, heightMm: 55, bleedMm: 3, dpi: 300, pages: 2 };
}

describe("the settings panel labels its fixture account (AC7)", () => {
  it("carries the demo note whenever the transport is simulated", () => {
    const html = renderToStaticMarkup(<SettingsPanel transport={simulated} />);
    expect(html).toContain(DEMO_ACCOUNT);
    expect(html).toContain(DEMO_LABEL);
  });

  it("says it in the panel the HOST renders, not only in a component a test picked", () => {
    // The gate has to sit on the thing that ships. `register()` is what the
    // host mounts; if the fill stopped passing the transport through, the panel
    // could not know it was simulated and this assertion is what would notice.
    const fill = register().fills.find((f) => f.slot === "settings.add-on.panel");
    expect(fill).toBeDefined();
    const html = renderToStaticMarkup(<>{fill?.render(undefined as never)}</>);
    expect(html).toContain(DEMO_ACCOUNT);
    expect(html).toContain(DEMO_LABEL);
  });

  it("drops the note when the transport is a real one, leaving no orphan copy", () => {
    const html = renderToStaticMarkup(<SettingsPanel transport={connected} />);
    expect(html).not.toContain(DEMO_LABEL);
    expect(html).not.toContain("Simulated");
    // The panel still does its job — it is the LABEL that is conditional, not
    // the account row.
    expect(html).toContain(DEMO_ACCOUNT);
    expect(html).toContain(EN["addon.import-canva.set.nothingElse"]);
  });

  it("has the label in all eight locales, so it is not an English-only warning", () => {
    for (const [tag, bundle] of Object.entries(importCanvaStrings)) {
      const line = (bundle as Record<string, string>)["addon.import-canva.demo.account"];
      expect(line, `${tag} is missing the settings demo label`).toBeTruthy();
      expect(line).not.toBe(tag === "en-US" ? "" : DEMO_LABEL);
    }
  });
});
