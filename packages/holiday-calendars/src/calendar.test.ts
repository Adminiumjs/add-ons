/**
 * THE TWO BEHAVIOURS THIS ADD-ON IS FOR: THE REFUSAL, AND IDEMPOTENCY.
 *
 * ── WHY THEY ARE TESTED HERE AND NOT THROUGH THE PANEL ─────────────────────
 *
 * Both are properties of the ENGINE, and the engine takes plain data and
 * returns plain data. A suite that drove them through React would be testing
 * two things at once and would go red the day somebody moved a button — which
 * is the ordinary reason a rule stops being enforced. `settings-panel.test.tsx`
 * covers the other question, which is whether the panel actually renders what
 * the engine says.
 *
 * ── WHAT "IDEMPOTENT" HAS TO MEAN, AND THE WEAKER VERSION THAT IS NOT IT ────
 *
 * "Re-importing does not duplicate rows" is the claim that is easy to make and
 * easy to satisfy badly: a `Set` keyed on date satisfies it, and it also
 * silently deletes the clinic's own closure on any date a public holiday
 * happens to share. So the assertions below are stronger and are stated in
 * pairs:
 *
 *   the second import produces a list DEEPLY EQUAL to the first, and
 *   every day nobody imported is still there, byte for byte, afterwards.
 *
 * The second half is the one that matters. A clinic shuts for reasons that are
 * not public holidays, and losing one of those loses a real appointment.
 */

import { describe, expect, it } from "vitest";

import {
  addOwnDay,
  applyImport,
  forgetOwnDay,
  forgetSet,
  nonWorkingDays,
  readStored,
  reviewedYears,
  writeStored,
  type StoredDay,
} from "./calendar.ts";
import { epochDayOf } from "./civil.ts";
import { daySetFor, expandSet, YEARS } from "./daysets.ts";

const US = daySetFor("US")!;
const DE = daySetFor("DE")!;
const DK = daySetFor("DK")!;
const FR = daySetFor("FR")!;
const FR_AM = daySetFor("FR", "alsace-moselle")!;

/** Import a year, insisting it succeeded — the happy path, as a fixture. */
function imported(current: readonly StoredDay[], set = US, year = 2026): readonly StoredDay[] {
  const result = applyImport(current, set, year);
  if (!result.ok) throw new Error(`import refused: ${result.collisions.map((c) => c.date).join(", ")}`);
  return result.days;
}

describe("importing a year", () => {
  it("brings every day of the set, stamped with where it came from", () => {
    const days = imported([]);
    expect(days.length).toBe(US.days.length);
    for (const day of days) {
      expect(day.from).toEqual({ country: "US", year: 2026 });
    }
    expect(days.map((day) => day.date)).toEqual(expandSet(US, 2026).map((day) => day.date));
  });

  it("carries a region into the stamp, and leaves it off a national set", () => {
    expect(imported([], FR, 2026)[0]!.from).toEqual({ country: "FR", year: 2026 });
    expect(imported([], FR_AM, 2026)[0]!.from).toEqual({
      country: "FR",
      region: "alsace-moselle",
      year: 2026,
    });
  });

  it("reports what it added", () => {
    const result = applyImport([], US, 2026);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.added).toBe(US.days.length);
    expect(result.replaced).toBe(0);
  });

  it("comes back sorted by date, then by name", () => {
    const days = imported(imported([], DE, 2026), FR, 2026);
    const keys = days.map((day) => `${day.date} ${day.name}`);
    expect(keys).toEqual([...keys].sort());
  });
});

/**
 * ═════════════════════════════════════════════════════════════════════════════
 * THE REFUSAL (25 D10)
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * A real rule, a named cause, and a fix the reader can carry out — then the
 * same import succeeds. All four halves are asserted, because a refusal whose
 * fix nobody has driven end to end is a refusal that might not be fixable.
 */
describe("the refusal: a day somebody typed, on a date the set also names", () => {
  const own = (date: string, name: string): StoredDay => ({ date, name });

  it("refuses, and imports nothing at all", () => {
    const current = [own("2026-12-25", "Closed — family")];
    const result = applyImport(current, US, 2026);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.collisions).toEqual([
      { date: "2026-12-25", yours: "Closed — family", theirs: "Christmas Day" },
    ]);
  });

  it("names every collision, in date order, not just the first", () => {
    const current = [
      own("2026-11-26", "Shut — long weekend"),
      own("2026-01-01", "Shut — stocktake"),
      own("2026-03-02", "Training"),
    ];
    const result = applyImport(current, US, 2026);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.collisions.map((collision) => collision.date)).toEqual([
      "2026-01-01",
      "2026-11-26",
    ]);
    // The third day is not on the set at all, so it is not a collision — a
    // refusal that named it would be telling the reader to delete something for
    // no reason.
    expect(result.collisions.map((collision) => collision.date)).not.toContain("2026-03-02");
  });

  it("says what BOTH sides call the day, which is what makes it actionable", () => {
    const result = applyImport([own("2026-07-04", "Shop closed")], US, 2026);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.collisions[0]).toEqual({
      date: "2026-07-04",
      yours: "Shop closed",
      theirs: "Independence Day",
    });
  });

  it("is fixed by removing the day, and the same import then succeeds", () => {
    const current = [own("2026-12-25", "Closed — family"), own("2026-03-02", "Training")];
    expect(applyImport(current, US, 2026).ok).toBe(false);

    const fixed = forgetOwnDay(current, "2026-12-25");
    const after = applyImport(fixed, US, 2026);
    expect(after.ok, "the fix the refusal describes did not make the import work").toBe(true);
    if (!after.ok) return;

    // …and the OTHER hand-written day is untouched by the fix and by the
    // import. Fixing a refusal must cost the reader exactly the row named.
    expect(after.days.filter((day) => day.from === undefined)).toEqual([
      own("2026-03-02", "Training"),
    ]);
    expect(after.added).toBe(US.days.length);
  });

  /**
   * THE HALF THAT KEEPS THE RULE HONEST. If everything on a shared date
   * refused, a business working in two countries could never import the second
   * one — and nobody chose either name, so there is nothing for a person to
   * decide.
   */
  it("does NOT refuse when two curated sets share a date", () => {
    const german = imported([], DE, 2026);
    expect(german.map((day) => day.date)).toContain("2026-12-25");

    const result = applyImport(german, US, 2026);
    expect(result.ok, "a second country was refused for sharing Christmas").toBe(true);
    if (!result.ok) return;

    const christmas = result.days.filter((day) => day.date === "2026-12-25");
    expect(christmas.map((day) => day.name).sort()).toEqual([
      "Christmas Day",
      "Erster Weihnachtstag",
    ]);
  });

  it("does NOT refuse a re-import against the days it laid down itself", () => {
    // The naive form of this check — "is this date already taken?" — refuses
    // the second import of every year against its own output. The rule is
    // written against ORIGIN, which is why it does not.
    const once = imported([], US, 2026);
    expect(applyImport(once, US, 2026).ok).toBe(true);
  });

  it("does not refuse a different YEAR of the same set", () => {
    const y26 = imported([], US, 2026);
    const result = applyImport(y26, US, 2027);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.replaced).toBe(0);
    expect(result.days.length).toBe(US.days.length * 2);
  });
});

/**
 * ═════════════════════════════════════════════════════════════════════════════
 * IDEMPOTENCY, AND THE THING IT MUST NOT COST
 * ═════════════════════════════════════════════════════════════════════════════
 */
describe("re-importing a year", () => {
  it("produces a list deeply equal to the first import", () => {
    const once = imported([], US, 2026);
    const twice = imported(once, US, 2026);
    expect(twice).toEqual(once);
  });

  it("stays equal however many times it is run", () => {
    let days = imported([], DK, 2026);
    for (let i = 0; i < 5; i += 1) days = imported(days, DK, 2026);
    expect(days.length).toBe(DK.days.length);
  });

  it("reports the second run as a replacement rather than an addition", () => {
    const once = imported([], US, 2026);
    const result = applyImport(once, US, 2026);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.replaced).toBe(US.days.length);
    expect(result.added).toBe(US.days.length);
    expect(result.days.length).toBe(US.days.length);
  });

  /**
   * THE WORST BUG THIS ADD-ON COULD HAVE, ASSERTED DIRECTLY.
   *
   * The local day sits on 2026-12-24 — Christmas Eve, which is an ordinary
   * working day in America and a public holiday in Czechia. A re-import that
   * cleared by DATE rather than by ORIGIN would take it out on the day the
   * business also imported the Czech set, and would do it silently.
   */
  it("never touches a day somebody typed, however many sets are imported over it", () => {
    // Written in date order, because the engine returns days sorted and this
    // case asserts DEEP equality — the point is that the two typed days come
    // back untouched, not that they come back in the order they were typed.
    const mine: StoredDay[] = [
      { date: "2026-08-17", name: "Moving the workshop" },
      { date: "2026-12-24", name: "Shut — stocktake" },
    ];
    let days: readonly StoredDay[] = mine;
    for (const set of [US, DE, DK, FR_AM]) {
      for (const year of YEARS) {
        const result = applyImport(days, set, year);
        expect(result.ok, `${set.country} ${year} was refused`).toBe(true);
        if (!result.ok) return;
        days = result.days;
      }
    }
    // Twice again, to make sure repetition is what does not accumulate.
    days = imported(imported(days, US, 2026), US, 2026);

    expect(days.filter((day) => day.from === undefined)).toEqual(mine);
  });

  it("keeps every OTHER set intact when one is re-imported", () => {
    const both = imported(imported([], DE, 2026), FR, 2026);
    const before = both.filter((day) => day.from?.country === "DE");
    const after = imported(both, FR, 2026).filter((day) => day.from?.country === "DE");
    expect(after).toEqual(before);
  });

  it("replaces a set in place when its data changes underneath it", () => {
    /*
     * The case the origin stamp is really for. A day-set is corrected in a
     * later version of this add-on — here, a shortened one standing in for that
     * — and the shop re-imports. The old days must GO rather than accumulate
     * beside the new ones, which is what a date-keyed merge would do.
     */
    const stale = imported([], US, 2026);
    const corrected = { ...US, days: US.days.slice(0, 3) };
    const result = applyImport(stale, corrected, 2026);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.days.length).toBe(3);
    expect(result.replaced).toBe(US.days.length);
  });
});

describe("removing what was imported", () => {
  it("drops exactly one set and one year", () => {
    let days = imported(imported([], US, 2026), US, 2027);
    days = imported(days, DE, 2026);
    days = [...days, { date: "2026-03-02", name: "Training" }];

    const after = forgetSet(days, "US", undefined, 2026);
    expect(after.filter((day) => day.from?.country === "US" && day.from.year === 2026)).toEqual([]);
    expect(after.filter((day) => day.from?.country === "US" && day.from.year === 2027).length).toBe(
      US.days.length,
    );
    expect(after.filter((day) => day.from?.country === "DE").length).toBe(DE.days.length);
    expect(after.filter((day) => day.from === undefined).length).toBe(1);
  });

  it("tells a national set apart from a regional one when removing", () => {
    const days = imported(imported([], FR, 2026), FR_AM, 2026);
    const after = forgetSet(days, "FR", "alsace-moselle", 2026);
    expect(after.length).toBe(FR.days.length);
    expect(after.every((day) => day.from?.region === undefined)).toBe(true);
  });

  it("removes a typed day by date, and only a typed one", () => {
    const days = [...imported([], US, 2026), { date: "2026-07-04", name: "Also our own" }];
    const after = forgetOwnDay(days, "2026-07-04");
    expect(after.filter((day) => day.date === "2026-07-04")).toEqual([
      { date: "2026-07-04", name: "Independence Day", from: { country: "US", year: 2026 } },
    ]);
  });
});

describe("writing in a day of the business's own", () => {
  it("adds one, sorted into place", () => {
    const result = addOwnDay(imported([], US, 2026), "2026-03-02", "Training");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const dates = result.days.map((day) => day.date);
    expect(dates).toEqual([...dates].sort());
    expect(result.days.find((day) => day.date === "2026-03-02")).toEqual({
      date: "2026-03-02",
      name: "Training",
    });
  });

  it("trims the name, and refuses one that is only spaces", () => {
    const ok = addOwnDay([], "2026-03-02", "  Training  ");
    expect(ok.ok && ok.days[0]!.name).toBe("Training");
    expect(addOwnDay([], "2026-03-02", "   ")).toEqual({ ok: false, why: "name" });
  });

  it("refuses a date that is not on the calendar", () => {
    expect(addOwnDay([], "2026-02-30", "Training")).toEqual({ ok: false, why: "date" });
    expect(addOwnDay([], "", "Training")).toEqual({ ok: false, why: "date" });
  });

  it("refuses a second typed day on a date somebody already typed", () => {
    const once = addOwnDay([], "2026-03-02", "Training");
    expect(once.ok).toBe(true);
    if (!once.ok) return;
    expect(addOwnDay(once.days, "2026-03-02", "Something else")).toEqual({
      ok: false,
      why: "duplicate",
    });
  });

  it("allows a typed day on a date an imported holiday already covers", () => {
    // Coherent, and refusing it would make an imported set an obstacle: a
    // business can have its own reason for being shut on Christmas Day.
    const result = addOwnDay(imported([], US, 2026), "2026-12-25", "Shut — whole week");
    expect(result.ok).toBe(true);
  });
});

describe("reading what the host holds, believing none of it", () => {
  it("round-trips through the shape `patch` takes", () => {
    const days = imported([], US, 2026);
    expect(readStored(writeStored(days))).toEqual(days);
  });

  it("is empty for a shop that has never used the add-on", () => {
    expect(readStored(undefined)).toEqual([]);
    expect(readStored({})).toEqual([]);
    expect(nonWorkingDays(undefined)).toEqual([]);
  });

  it("drops what it cannot read, and keeps what it can", () => {
    const stored = readStored({
      days: [
        { date: "2026-12-25", name: "Christmas Day", from: { country: "US", year: 2026 } },
        { date: "2026-02-30", name: "A day that does not exist" },
        { date: "not a date", name: "Nor this" },
        { date: "2026-03-02", name: "   " },
        { date: "2026-03-03" },
        "a string where a day should be",
        null,
        { date: "2026-03-04", name: "Training" },
      ],
    });
    expect(stored.map((day) => day.date)).toEqual(["2026-03-04", "2026-12-25"]);
  });

  it("keeps a day whose origin is unreadable, as a typed one", () => {
    // Losing a closure is the worst thing this package can do. "We could not
    // read where it came from" is not a reason to lose the day itself.
    const stored = readStored({
      days: [{ date: "2026-03-04", name: "Training", from: { country: 7, year: "x" } }],
    });
    expect(stored).toEqual([{ date: "2026-03-04", name: "Training" }]);
  });

  it("survives a values document that is not a list at all", () => {
    expect(readStored({ days: "nope" })).toEqual([]);
    expect(readStored({ days: 42 })).toEqual([]);
    expect(readStored({ days: null })).toEqual([]);
  });
});

describe("the read surface a host consumes", () => {
  it("hands over ISO days, sorted, with their origin", () => {
    const days = nonWorkingDays(writeStored(imported([], DE, 2026)));
    expect(days.length).toBe(DE.days.length);
    for (const day of days) {
      expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(day.from).toEqual({ country: "DE", year: 2026 });
    }
  });

  it("marks a typed day by leaving its origin off, and nothing else", () => {
    const withOwn = addOwnDay(imported([], DE, 2026), "2026-03-02", "Training");
    expect(withOwn.ok).toBe(true);
    if (!withOwn.ok) return;
    const days = nonWorkingDays(writeStored(withOwn.days));
    const typed = days.filter((day) => day.from === undefined);
    expect(typed).toEqual([{ date: "2026-03-02", name: "Training" }]);
  });

  it("answers for exactly the years the pack has been reviewed for", () => {
    expect(reviewedYears()).toEqual(YEARS);
  });
});

/**
 * THE TWO HOSTS' MAPPINGS, WRITTEN OUT AS CODE.
 *
 * ── WHY A SUITE IN THIS REPOSITORY ASSERTS SOMETHING ABOUT TWO OTHER REPOS ──
 *
 * It does not. It asserts something about THIS package's read surface: that the
 * shape it hands over can be turned into each host's own record with a mapping
 * short enough to sit at a mount site, and that the mapping loses nothing.
 * `people-ops` stores `{ serial, name }` and `clinic-desk` stores
 * `{ on_date, reason, clinician_id }`, and the README documents both; a claim
 * in a README that no code has ever run is a claim on trust.
 *
 * The two record shapes are declared inline rather than imported. Importing
 * them would make this repository depend on two applications it does not build
 * — which is exactly the coupling the read surface exists to avoid — and the
 * shapes are three fields each. If a host changes its record, this suite goes
 * on passing and the host's own build is what fails, which is the right place.
 */
describe("both hosts can map this into their own record, at the seam", () => {
  const values = writeStored(
    (() => {
      const withOwn = addOwnDay(imported(imported([], DE, 2026), FR, 2026), "2026-03-02", "Training");
      if (!withOwn.ok) throw new Error("fixture failed");
      return withOwn.days;
    })(),
  );

  it("becomes people-ops' Holiday — a day serial and an i18n-or-literal name", () => {
    // `{ serial, name }`, where `serial` is whole days since the epoch UTC and
    // `name` is resolved through `label()`, which falls back to the raw string.
    const holidays = nonWorkingDays(values).map((day) => ({
      serial: epochDayOf(day.date)!,
      name: day.name,
    }));
    expect(holidays.length).toBe(DE.days.length + FR.days.length + 1);
    for (const holiday of holidays) {
      expect(Number.isInteger(holiday.serial)).toBe(true);
      expect(holiday.name.length).toBeGreaterThan(0);
    }
    // The serials are what the leave engine compares, so they must be usable
    // as such: strictly increasing where the dates are, and never NaN.
    const serials = holidays.map((holiday) => holiday.serial);
    expect(serials).toEqual([...serials].sort((a, b) => a - b));
    expect(serials.some(Number.isNaN)).toBe(false);
  });

  it("becomes clinic-desk's closure row — an ISO date, a reason, no clinician", () => {
    // `{ on_date, reason, clinician_id }`, where a null clinician is the
    // schema's own way of saying the whole practice is shut that day.
    const closures = nonWorkingDays(values).map((day) => ({
      on_date: day.date,
      reason: day.name,
      clinician_id: null,
    }));
    expect(closures.length).toBeGreaterThan(20);
    for (const closure of closures) {
      expect(closure.on_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(closure.reason.trim()).toBe(closure.reason);
      expect(closure.clinician_id).toBeNull();
    }
    // The practice's own closure is in there beside the public holidays, which
    // is the whole reason the surface carries both.
    expect(closures).toContainEqual({
      on_date: "2026-03-02",
      reason: "Training",
      clinician_id: null,
    });
  });

  it("hands neither host anything it would have to reach into storage for", () => {
    // Every field a mapping above reads is on `NonWorkingDay`. If a host needed
    // a fifth, the seam would be wrong rather than the host.
    const [first] = nonWorkingDays(values);
    expect(Object.keys(first!).sort()).toEqual(["date", "from", "name"]);
  });
});

/*
 * `epochDayOf` is the conversion this package exports for the host that stores
 * day serials, and the mapping above uses THAT rather than a copy written here.
 * A test that reimplemented the conversion would pass while the exported one
 * was broken, which is the one thing this block is meant to rule out: the whole
 * claim is that people-ops can reach its own record shape with what the add-on
 * hands it, and a conversion the add-on does not export is not that.
 */
