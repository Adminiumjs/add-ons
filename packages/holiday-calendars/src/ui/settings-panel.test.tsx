/**
 * THE PANEL RENDERS WORDS, AND RENDERS WHAT THE ENGINE DECIDED.
 *
 * ── WHAT THIS SUITE CAN AND CANNOT SEE ──────────────────────────────────────
 *
 * Rendered with `renderToStaticMarkup` rather than a DOM harness: this
 * repository ships no jsdom, and `t.ts` gives `useSyncExternalStore` a server
 * snapshot, so the static render is the real component tree rather than a
 * stand-in for it. What it cannot do is CLICK, so the refusal card and the
 * "days taken" card — both of which appear only after a press — are not
 * reachable by rendering.
 *
 * That is a real limit and it is met head-on rather than papered over. It is
 * split in two:
 *
 *   THE DECISION is `calendar.test.ts`, over the pure engine. Whether an import
 *   refuses, what it names, and what a re-import costs are all properties of
 *   plain data and are tested as such — a suite that drove them through React
 *   would be testing two things and would go red the day somebody moved a
 *   button, which is the ordinary reason a rule stops being enforced.
 *
 *   THE WIRING is the source pairing at the foot of this file: every outcome
 *   the engine can return has to be rendered by THIS component, by key. That is
 *   the same shape `shipping-dhl` uses to keep a "this result is simulated"
 *   label attached to the card it belongs to, and it is what catches an engine
 *   that refuses into a screen that says nothing.
 *
 * Between them: what the panel decides, and that the panel says it.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { SettingsPanelPayload } from "@adminium/add-on-host";

import { applyImport, writeStored } from "../calendar.ts";
import { ANNOUNCED_ANNUALLY, DAY_SETS, MAINTENANCE, YEARS, daySetFor, expandSet } from "../daysets.ts";
import { strings } from "../i18n/strings.ts";
import { register } from "../index.ts";
import { SettingsPanel } from "./SettingsPanel.tsx";

const EN = strings["en-US"];
const US = daySetFor("US")!;

/**
 * A payload shaped like the one a host passes.
 *
 * `samples` is REQUIRED by `SettingsPanelPayload` and this panel reads none of
 * it — a shop's catalogue has nothing to do with a public holiday. It is passed
 * anyway, because the fixture's job is to be what a host really sends: the
 * second host of the delivery add-on passed `{ patch }` alone, `tsc` was happy,
 * and that add-on's settings form threw on `.map`.
 */
function payloadWith(settings?: Record<string, unknown>): SettingsPanelPayload {
  return {
    patch: () => {},
    samples: [{ key: "consultation", label: "Consultation", quantity: 1 }],
    settings,
  };
}

const renderPanel = (settings?: Record<string, unknown>) =>
  renderToStaticMarkup(<SettingsPanel payload={payloadWith(settings)} />);

/**
 * A string as it appears IN MARKUP, which is not always as it appears in the
 * bundle.
 *
 * React escapes five characters on the way out, and the apostrophe is the one
 * that matters here: half this add-on's English copy is possessive — "New
 * Year's Day", "each year's arrangement", "the business's decision" — so a
 * plain `toContain` on the bundle value reports a missing string for copy that
 * is on the screen. Every assertion below goes through this, so the failure a
 * reader gets is a real absence rather than an encoding.
 */
const asRendered = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");

/** `expect(html).toContain(...)`, for text that has been through JSX. */
const shows = (html: string, text: string): boolean => html.includes(asRendered(text));

describe("the panel the host actually mounts", () => {
  it("is the one `register()` fills `settings.add-on.panel` with", () => {
    // The gate has to sit on the thing that ships. Rendering a component a test
    // reached for directly proves nothing about what a shop sees.
    const fill = register().fills.find((entry) => entry.slot === "settings.add-on.panel");
    expect(fill).toBeDefined();
    const html = renderToStaticMarkup(<>{fill!.render(payloadWith() as never)}</>);
    expect(shows(html, EN["addon.holiday-calendars.pick.area"])).toBe(true);
  });

  it("renders words, never a raw message key", () => {
    // The failure this catches is a key added to a component and not to the
    // bundle: `t()` falls back to the key itself, so the screen quietly reads
    // `addon.holiday-calendars.pick.year`.
    const html = renderPanel();
    expect(html).not.toContain("addon.holiday-calendars.");
  });
});

describe("the picker shows the days before anything is taken", () => {
  const html = renderPanel();

  it("lists every day of the default set, by its own name", () => {
    const missing = expandSet(US, YEARS[0]!)
      .map((day) => day.name)
      .filter((name) => !shows(html, name));
    expect(missing, `the preview does not show: ${missing.join(", ")}`).toEqual([]);
  });

  it("counts them, and says what the set leaves out and where it came from", () => {
    expect(shows(html, `${US.days.length} days`)).toBe(true);
    expect(shows(html, EN[US.noteKey])).toBe(true);
    expect(shows(html, EN[US.derivation.statedIn])).toBe(true);
  });

  it("says a weekend holiday gains no substitute day", () => {
    // The one thing about this data a reader would otherwise have to infer from
    // its absence — and 4 July 2026 is a Saturday, so it matters immediately.
    expect(shows(html, EN["addon.holiday-calendars.pick.noSubstitutes"])).toBe(true);
  });

  it("offers every area and every reviewed year", () => {
    for (const set of DAY_SETS) expect(shows(html, EN[set.labelKey]), set.country).toBe(true);
    for (const year of YEARS) expect(html).toContain(String(year));
  });

  it("shows the review date as a date, not as the ISO string it is stored as", () => {
    // `2026-08-28` is how the set stores it and is not a date anybody reads.
    // The literal here is the en-US rendering, so it moves if the formatter
    // ever stops being asked for a long month.
    expect(html).toContain("August 28, 2026");
    expect(html).not.toContain(US.derivation.reviewedOn);
  });
});

/**
 * THE REFUSAL LIST, RENDERED WHERE SOMEBODY IS CHOOSING.
 *
 * This is the section a reader is most likely to think is a gap in the product
 * rather than a statement, so it is asserted whole: all three countries, each
 * with the sentence saying why there is no set. A picker that silently omitted
 * them would leave an operator in Cairo assuming Egypt had not been got round
 * to yet, which is a different and false claim.
 */
describe("the countries with no set are named on the screen", () => {
  const html = renderPanel();

  it("names all three, with the reason each", () => {
    expect(shows(html, EN["addon.holiday-calendars.announced.title"])).toBe(true);
    expect(shows(html, EN["addon.holiday-calendars.announced.lead"])).toBe(true);
    for (const entry of ANNOUNCED_ANNUALLY) {
      expect(shows(html, EN[entry.labelKey]), entry.country).toBe(true);
      expect(shows(html, EN[entry.whyKey]), entry.country).toBe(true);
    }
  });

  it("has three of them to name, so the case is not vacuous", () => {
    expect(ANNOUNCED_ANNUALLY.length).toBe(3);
  });
});

describe("the panel says who keeps the data current", () => {
  const html = renderPanel();

  it("names the owner, the last read and the next one", () => {
    expect(shows(html, EN[MAINTENANCE.ownerKey])).toBe(true);
    expect(html).toContain("August 28, 2026");
    expect(html).toContain("August 31, 2027");
  });

  it("says where a wrong date should be reported", () => {
    expect(shows(html, EN["addon.holiday-calendars.maint.corrections"])).toBe(true);
  });

  it("states that it connects to no company, where the notice would go", () => {
    // 24 AC6: rendering nothing there is indistinguishable from having
    // forgotten the not-affiliated line, so the positive fact is stated.
    expect(shows(html, EN["addon.holiday-calendars.noCompany"])).toBe(true);
  });
});

describe("what is already held is on the screen before anything changes it", () => {
  it("says so plainly when nothing is held", () => {
    const html = renderPanel();
    expect(shows(html, EN["addon.holiday-calendars.held.none"])).toBe(true);
  });

  it("shows an imported year as one row, named and counted", () => {
    const result = applyImport([], US, 2026);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const html = renderPanel(writeStored(result.days));
    expect(shows(html, EN["addon.holiday-calendars.held.none"])).toBe(false);
    expect(shows(html, EN[US.labelKey])).toBe(true);
    expect(shows(html, EN["addon.holiday-calendars.held.removeSet"])).toBe(true);
    // The count appears twice — once for the preview, once for the held row —
    // and both are this set's length, so a row that had lost days would show it.
    expect([...html.matchAll(new RegExp(`${US.days.length} days`, "g"))].length).toBeGreaterThan(1);
  });

  it("shows a day somebody wrote in as its own row, with its own words", () => {
    const html = renderPanel({ days: [{ date: "2026-03-02", name: "Moving the workshop" }] });
    expect(html).toContain("Moving the workshop");
    expect(shows(html, EN["addon.holiday-calendars.held.own"])).toBe(true);
    expect(shows(html, EN["addon.holiday-calendars.held.remove"])).toBe(true);
  });

  it("still offers to remove a set this version of the pack no longer carries", () => {
    // A country dropped from the pack leaves real days behind. The row falls
    // back to the stored country code rather than disappearing, or the shop
    // would have days it could not get rid of.
    const html = renderPanel({
      days: [{ date: "2026-01-01", name: "Nytårsdag", from: { country: "ZZ", year: 2026 } }],
    });
    expect(html).toContain("ZZ");
    expect(shows(html, EN["addon.holiday-calendars.held.removeSet"])).toBe(true);
  });

  /**
   * ── A DAY'S NAME IS SOMEBODY ELSE'S WORDS, AND SAYS SO IN THE MARKUP ──────
   *
   * A host's Arabic-page guard reads the `dir` ATTRIBUTE to tell an island of
   * foreign text from a number this add-on failed to format. Every name drawn
   * here is the first kind: `Tag der Deutschen Einheit` is German running the
   * other way inside an Arabic paragraph, and `Victoire 1945` carries Latin
   * digits that are part of a French proper noun rather than a quantity
   * anybody computed.
   *
   * The property is per NAME rather than per set, which is what this case
   * asserts — a preview day and a day somebody typed, both wrapped. It cannot
   * assert it of the French set, because a group row shows a set's NAME and not
   * its days, and reaching the French preview needs a press this render has no
   * way to make. What it CAN do is show that the concern is real, which is the
   * first line: there are day names in this pack with digits in them.
   */
  it("renders a day's name as somebody else's words, not as a quantity", () => {
    const withDigits = DAY_SETS.flatMap((set) => set.days)
      .map((day) => day.name)
      .filter((name) => /\d/.test(name));
    expect(withDigits, "no day name carries a digit, so this case guards nothing").toContain(
      "Victoire 1945",
    );

    const html = renderPanel({ days: [{ date: "2026-03-02", name: "Moving the workshop" }] });
    for (const name of ["Thanksgiving Day", "Moving the workshop"]) {
      const at = html.indexOf(name);
      expect(at, `${name} is not on the screen`).toBeGreaterThan(-1);
      expect(html.slice(Math.max(0, at - 160), at), name).toContain('dir="auto"');
    }
  });
});

/**
 * ═════════════════════════════════════════════════════════════════════════════
 * EVERY OUTCOME THE ENGINE CAN RETURN IS RENDERED BY THIS COMPONENT
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * A static render cannot press the button, so this reads the component's own
 * source and asserts that each engine result reaches a message key — and that
 * the key is in all eight bundles.
 *
 * A SOURCE GREP IS A WEAK TEST AND IT IS THE RIGHT ONE HERE, because the defect
 * it catches is specific and silent: an engine that refuses into a screen that
 * renders nothing. The operator presses Import, nothing happens, and no suite
 * anywhere is red. Pairing the outcome with the copy is what makes deleting the
 * card a failure rather than a regression nobody sees.
 */
describe("no engine outcome reaches a screen with nothing on it", () => {
  const source = readFileSync(new URL("./SettingsPanel.tsx", import.meta.url), "utf8");

  /** engine outcome → the keys the panel must render for it. */
  const RENDERED: Readonly<Record<string, readonly string[]>> = {
    "applyImport refuses": [
      "addon.holiday-calendars.refuse.title",
      "addon.holiday-calendars.refuse.body",
      "addon.holiday-calendars.refuse.row",
    ],
    "applyImport succeeds": [
      "addon.holiday-calendars.done.added",
      "addon.holiday-calendars.done.replaced",
    ],
    "addOwnDay refuses": [
      "addon.holiday-calendars.own.badDate",
      "addon.holiday-calendars.own.badName",
      "addon.holiday-calendars.own.duplicate",
    ],
  };

  it.each(Object.entries(RENDERED))("%s reaches copy", (_outcome, keys) => {
    const missing = keys.filter((key) => !source.includes(key));
    expect(missing, `the panel renders nothing for: ${missing.join(", ")}`).toEqual([]);
  });

  it("has every one of those keys in all eight locales", () => {
    const keys = Object.values(RENDERED).flat();
    for (const [locale, bundle] of Object.entries(strings)) {
      for (const key of keys) {
        expect(Object.keys(bundle), `${locale} is missing ${key}`).toContain(key);
      }
    }
  });

  it("calls the engine rather than deciding for itself", () => {
    // The other half of the same defect: a panel that reimplemented the
    // collision rule would drift from the one `calendar.test.ts` guards.
    for (const call of ["applyImport(", "addOwnDay(", "forgetSet(", "forgetOwnDay(", "readStored("]) {
      expect(source, `the panel does not call ${call}`).toContain(call);
    }
  });

  it("writes through `patch`, and only through `patch`", () => {
    // `SettingsPanelPayload.patch` writes THE ADD-ON'S OWN VALUES. Everything
    // this panel saves goes through one function, which is what makes a
    // re-import idempotent however many times a button is pressed.
    expect([...source.matchAll(/payload\.patch\(/g)]).toHaveLength(1);
    expect(source).toContain("payload.patch(writeStored(days))");
  });
});
