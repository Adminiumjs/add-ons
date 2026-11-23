// @vitest-environment happy-dom
/** The list reads once, opens orders, and never calls an unknown label bought. */

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { EngineAccess, EngineAttention, EngineAttentionItem, EngineAttentionReason, EngineBooking, EngineCarrier, EngineLookUp } from "@adminium/add-on-host/engine-carrier";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { translate } from "../i18n/t.ts";
import type { StringKey } from "../i18n/strings.ts";
import { connectEngineCarrier, resetRuntime } from "../runtime.ts";
import { NeedsAttentionList } from "./NeedsAttentionList.tsx";

const AT = 1_800_000_000_000;
const en = (key: StringKey, params?: Record<string, string | number>) => translate("en-US", key, params);

const BOOKING: EngineBooking = {
  id: "b1",
  state: "booked",
  test: false,
  purpose: "outbound",
  parcelNumber: 1,
  carrier: "shipping-test",
  service: "Parcel 48",
  tracking: "TRK-1",
  carrierName: "Northline Post",
  reason: null,
  duplicates: 0,
  createdAt: AT,
  calledAt: AT,
  checkedAt: null,
  releaseAfter: null,
  applied: true,
  label: { state: "ready", size: "a4", sizeGot: "a4", sizeDiffers: false, customsInvoice: false, customsInvoiceOwed: false },
};

const item = (reasons: EngineAttentionReason[], booking: Partial<EngineBooking> = {}): EngineAttentionItem => ({
  reasons,
  reference: "NL-1049",
  source: { table: "orders", id: "1049" },
  orderGone: false,
  booking: { ...BOOKING, ...booking },
});

const UNKNOWN = item(["unknown"], { state: "unknown", tracking: null, carrierName: null, releaseAfter: AT + 900_000, amount: "7.25", currency: "GBP" });

function fake(...answers: (EngineAttention | Error)[]) {
  let at = 0;
  const attention = vi.fn(async () => {
    const answer = answers[Math.min(at, answers.length - 1)]!;
    at += 1;
    if (answer instanceof Error) throw answer;
    return answer;
  });
  connectEngineCarrier({ addOnKey: "shipping-test", attention } as unknown as EngineCarrier);
  return attention;
}

const refusal = (code: string) => Object.assign(new Error("no"), { code, status: 403 });

beforeEach(() => document.documentElement.setAttribute("lang", "en-US"));
afterEach(() => {
  cleanup();
  resetRuntime();
  vi.restoreAllMocks();
});

describe("reading the list", () => {
  it("says it is looking, then shows the row, and opens its order", async () => {
    const ask = fake({ items: [item(["quiet"])], more: false });
    const open = vi.fn();
    render(<NeedsAttentionList onOpen={open} />);
    expect(screen.getByRole("status").textContent).toBe(en("addon.shipping-kit.engine.attention.loading"));
    fireEvent.click(await screen.findByTestId("attention-row-b1"));
    expect(open).toHaveBeenCalledWith({ table: "orders", id: "1049" });
    expect(ask).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("needs-attention-count").textContent).toBe("1");
    const row = screen.getByTestId("attention-row-b1").textContent!;
    for (const part of ["NL-1049", "Northline Post · Parcel 48", "TRK-1"]) expect(row).toContain(part);
  });

  it("shows the comp's quiet line when nothing needs a person", async () => {
    fake({ items: [], more: false });
    render(<NeedsAttentionList onOpen={vi.fn()} />);
    expect(await screen.findByText(en("addon.shipping-kit.engine.attention.empty"))).toBeTruthy();
    expect(screen.getByTestId("needs-attention-count").textContent).toBe("0");
  });

  it("says when it failed, and a retry reads it again", async () => {
    const ask = fake(new Error("nope"), { items: [item(["quiet"])], more: false });
    render(<NeedsAttentionList onOpen={vi.fn()} />);
    expect((await screen.findByRole("alert")).textContent).toContain(en("addon.shipping-kit.engine.attention.failed"));
    await act(async () => {
      fireEvent.click(screen.getByTestId("needs-attention-retry"));
    });
    expect(await screen.findByTestId("attention-row-b1")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(ask).toHaveBeenCalledTimes(2);
  });

  it("draws nothing for someone with no right on the labels", async () => {
    const ask = fake(refusal("FORBIDDEN"));
    const { container } = render(<NeedsAttentionList onOpen={vi.fn()} />);
    await waitFor(() => expect(ask).toHaveBeenCalled());
    await waitFor(() => expect(container.textContent).toBe(""));
  });

  it("draws nothing without an engine client", () => {
    const { container } = render(<NeedsAttentionList onOpen={vi.fn()} />);
    expect(container.textContent).toBe("");
  });

  it("says when more are waiting", async () => {
    fake({ items: [item(["quiet"])], more: true });
    render(<NeedsAttentionList onOpen={vi.fn()} />);
    expect((await screen.findByTestId("needs-attention-more")).textContent).toBe(en("addon.shipping-kit.engine.attention.more"));
    expect(screen.getByTestId("needs-attention-count").textContent).toBe("1+");
  });

  it("does not call a cut list with no row of this person's empty", async () => {
    fake({ items: [], more: true });
    render(<NeedsAttentionList onOpen={vi.fn()} />);
    await screen.findByTestId("needs-attention-more");
    expect(screen.queryByText(en("addon.shipping-kit.engine.attention.empty"))).toBeNull();
  });

  it("reads again when told to, keeping the rows it has meanwhile", async () => {
    const ask = fake({ items: [item(["quiet"])], more: false }, { items: [], more: false });
    const view = render(<NeedsAttentionList onOpen={vi.fn()} reloadKey={1} />);
    await screen.findByTestId("attention-row-b1");
    view.rerender(<NeedsAttentionList onOpen={vi.fn()} reloadKey={2} />);
    expect(screen.getByTestId("attention-row-b1")).toBeTruthy();
    await screen.findByText(en("addon.shipping-kit.engine.attention.empty"));
    expect(ask).toHaveBeenCalledTimes(2);
  });

  it("ignores an answer that arrives after a newer one", async () => {
    const answers: ((list: EngineAttention) => void)[] = [];
    const attention = vi.fn(() => new Promise<EngineAttention>((resolve) => answers.push(resolve)));
    connectEngineCarrier({ addOnKey: "shipping-test", attention } as unknown as EngineCarrier);
    const view = render(<NeedsAttentionList onOpen={vi.fn()} reloadKey={1} />);
    view.rerender(<NeedsAttentionList onOpen={vi.fn()} reloadKey={2} />);
    await act(async () => {
      answers[1]!({ items: [], more: false });
    });
    await act(async () => {
      answers[0]!({ items: [item(["quiet"])], more: false });
    });
    expect(screen.queryByTestId("attention-row-b1")).toBeNull();
  });
});

describe("an unknown result", () => {
  it("says buying again is blocked and when we asked, and never that it was bought", async () => {
    fake({ items: [UNKNOWN], more: false });
    render(<NeedsAttentionList onOpen={vi.fn()} />);
    const row = (await screen.findByTestId("attention-row-b1")).textContent!;
    expect(row).toContain("Buying again is blocked");
    expect(row).toContain("Asked at");
    expect(row).toContain(en("addon.shipping-kit.engine.attention.noNumber"));
    expect(row).toContain(en("addon.shipping-kit.engine.attention.unknown"));
    expect(row.toLowerCase()).not.toContain("bought");
    expect(row).not.toContain("7.25");
  });

  it("does not claim a time nobody asked at", async () => {
    fake({ items: [item(["unknown"], { state: "unknown", calledAt: null, tracking: null })], more: false });
    render(<NeedsAttentionList onOpen={vi.fn()} />);
    const row = (await screen.findByTestId("attention-row-b1")).textContent!;
    expect(row).toContain(en("addon.shipping-kit.engine.attention.unknownNoTime"));
    expect(row).not.toContain("Asked at");
  });

  it("says a label nobody recorded here is on the order", async () => {
    fake({ items: [item(["unknown"], { state: "unknown", calledAt: null, reason: "label-on-order", tracking: "FOREIGN-1" })], more: false });
    render(<NeedsAttentionList onOpen={vi.fn()} />);
    const row = (await screen.findByTestId("attention-row-b1")).textContent!;
    expect(row).toContain(en("addon.shipping-kit.engine.unknown.foreignBody"));
    expect(row).toContain("FOREIGN-1");
  });

  it("leads with it when a row has other reasons too", async () => {
    fake({ items: [item(["unknown", "duplicates"], { state: "unknown", duplicates: 2 })], more: false });
    render(<NeedsAttentionList onOpen={vi.fn()} />);
    const row = (await screen.findByTestId("attention-row-b1")).textContent!;
    expect(row).toContain("Buying again is blocked");
    expect(row).not.toContain("more labels");
  });

  it("marks a test booking", async () => {
    fake({ items: [item(["unknown"], { state: "unknown", test: true, tracking: null })], more: false });
    render(<NeedsAttentionList onOpen={vi.fn()} />);
    expect((await screen.findByTestId("attention-row-b1")).textContent).toContain(en("addon.shipping-kit.engine.test.sample"));
  });
});

describe("the line for each reason", () => {
  const company = "Northline Post";
  const statusAt = AT - 60_000;
  it.each<[EngineAttentionReason, Partial<EngineBooking>, string]>([
    ["duplicates", { duplicates: 2 }, en("addon.shipping-kit.engine.label.duplicates", { company, n: 2 })],
    ["label-owed", {}, en("addon.shipping-kit.engine.label.owedBody", { company })],
    ["new-number", {}, en("addon.shipping-kit.engine.track.newNumber")],
    ["tracking-failed", { track: { status: "FAILURE", statusAt, checkedAt: null, flag: null, newNumber: false } }, en("addon.shipping-kit.engine.attention.trackingFailed", { carrier: company })],
    ["returned", { track: { status: "RETURNED", statusAt, checkedAt: null, flag: null, newNumber: false } }, en("addon.shipping-kit.engine.attention.returned", { carrier: company })],
    ["ambiguous", {}, en("addon.shipping-kit.engine.track.ambiguous")],
    ["quiet", { track: { status: "TRANSIT", statusAt, checkedAt: null, flag: null, newNumber: false } }, en("addon.shipping-kit.engine.attention.quiet")],
  ])("%s", async (reason, booking, line) => {
    fake({ items: [item([reason], booking)], more: false });
    render(<NeedsAttentionList onOpen={vi.fn()} />);
    expect((await screen.findByTestId("attention-row-b1")).textContent).toContain(line);
  });

  it("gives the last event on a parcel that has stopped", async () => {
    fake({ items: [item(["quiet"], { track: { status: "TRANSIT", statusAt, checkedAt: null, flag: null, newNumber: false } })], more: false });
    render(<NeedsAttentionList onOpen={vi.fn()} />);
    expect((await screen.findByTestId("attention-row-b1")).textContent).toContain("Last event");
  });

  it("still shows a row whose reason this build has no word for", async () => {
    fake({ items: [item([])], more: false });
    render(<NeedsAttentionList onOpen={vi.fn()} />);
    expect((await screen.findByTestId("attention-row-b1")).textContent).toContain(en("addon.shipping-kit.engine.attention.other"));
  });
});

describe("an unknown booking whose order was deleted", () => {
  const RELEASE_AFTER = AT + 900_000;
  const GONE: EngineAttentionItem = { ...item(["unknown"], { state: "unknown", tracking: null, releaseAfter: RELEASE_AFTER }), orderGone: true };
  const OTHER: EngineAttentionItem = { ...item(["quiet"], { id: "b2" }), reference: "NL-1050" };
  const MANAGER: EngineAccess = { appUpdated: true, carrier: "shipping-test", activeHere: true, mode: "live", manages: true, mayBook: true, mayCancel: true, mayCustoms: true, mayShipAbroad: true, shipsAbroad: false, pricesHidden: false, booking: "open" };
  const list = (...items: EngineAttentionItem[]): EngineAttention => ({ items, more: false });

  function client(lists: EngineAttention[], over: { access?: () => Promise<EngineAccess>; check?: () => Promise<EngineLookUp>; release?: () => Promise<EngineBooking> } = {}) {
    let at = 0;
    const attention = vi.fn(async () => lists[Math.min(at++, lists.length - 1)]!);
    const access = vi.fn(over.access ?? (async () => MANAGER));
    const checkBooking = vi.fn(over.check ?? (async (): Promise<EngineLookUp> => ({ outcome: "no-match", booking: GONE.booking })));
    const releaseBooking = vi.fn(over.release ?? (async () => ({ ...GONE.booking, state: "released" as const })));
    connectEngineCarrier({ addOnKey: "shipping-test", attention, access, checkBooking, releaseBooking } as unknown as EngineCarrier);
    return { attention, access, checkBooking, releaseBooking };
  }
  const press = async (id: string) => {
    await act(async () => {
      fireEvent.click(screen.getByTestId(id));
    });
  };

  it("asks what this person may do only when such a row is on the list", async () => {
    const { access } = client([list(OTHER)]);
    render(<NeedsAttentionList onOpen={vi.fn()} />);
    await screen.findByTestId("attention-row-b2");
    expect(access).not.toHaveBeenCalled();
  });

  it("says the order was deleted, opens nothing, and offers the card's actions", async () => {
    const { access } = client([list(GONE, OTHER)]);
    const open = vi.fn();
    render(<NeedsAttentionList onOpen={open} />);
    const row = await screen.findByTestId("attention-gone-b1");
    expect(row.textContent).toContain(en("addon.shipping-kit.engine.attention.orderGone"));
    await screen.findByTestId("engine-check");
    expect(screen.getByTestId("engine-release-open")).toBeTruthy();
    expect(screen.queryByTestId("attention-row-b1")).toBeNull();
    fireEvent.click(row);
    expect(open).not.toHaveBeenCalled();
    expect(access).toHaveBeenCalledTimes(1);
  });

  it("keeps the card's gating: no release for someone who does not manage shipping", async () => {
    client([list(GONE)], { access: async () => ({ ...MANAGER, manages: false }) });
    render(<NeedsAttentionList onOpen={vi.fn()} />);
    await screen.findByTestId("engine-check");
    expect(screen.queryByTestId("engine-release-open")).toBeNull();
  });

  it("offers no action until it knows, and a retry when it could not ask", async () => {
    let fail = true;
    const { access } = client([list(GONE)], {
      access: async () => {
        if (fail) throw new Error("nope");
        return MANAGER;
      },
    });
    render(<NeedsAttentionList onOpen={vi.fn()} />);
    await screen.findByTestId("needs-attention-rights-retry");
    expect(screen.queryByTestId("engine-check")).toBeNull();
    fail = false;
    await press("needs-attention-rights-retry");
    await screen.findByTestId("engine-check");
    expect(access).toHaveBeenCalledTimes(2);
  });

  it("offers nothing when the engine refuses what this person may do", async () => {
    client([list(GONE)], { access: async () => Promise.reject(refusal("FORBIDDEN")) });
    render(<NeedsAttentionList onOpen={vi.fn()} />);
    expect(await screen.findByText(en("addon.shipping-kit.engine.gate.noRight.title"))).toBeTruthy();
    expect(screen.queryByTestId("engine-check")).toBeNull();
  });

  it("reads the list again after a look-up, which is what opens the quiet period's door", async () => {
    const checked = { ...GONE, booking: { ...GONE.booking, checkedAt: RELEASE_AFTER + 1 } };
    const { attention, checkBooking } = client([list(GONE), list(checked)], { check: async () => ({ outcome: "no-match", booking: checked.booking }) });
    render(<NeedsAttentionList onOpen={vi.fn()} />);
    await screen.findByTestId("engine-check");
    await press("engine-release-open");
    expect((screen.getByTestId("engine-release-confirm") as HTMLButtonElement).disabled).toBe(true);
    await press("engine-release-keep");
    await press("engine-check");
    expect(checkBooking).toHaveBeenCalledWith("b1");
    await waitFor(() => expect(attention).toHaveBeenCalledTimes(2));
    await screen.findByTestId("engine-check-outcome");
    await press("engine-release-open");
    await waitFor(() => expect((screen.getByTestId("engine-release-confirm") as HTMLButtonElement).disabled).toBe(false));
  });

  it("will not release without the declaration, then releases, reads again and says so", async () => {
    const ready = { ...GONE, booking: { ...GONE.booking, checkedAt: RELEASE_AFTER + 1 } };
    const { attention, releaseBooking } = client([list(ready), list()]);
    render(<NeedsAttentionList onOpen={vi.fn()} />);
    await screen.findByTestId("engine-check");
    await press("engine-release-open");
    await press("engine-release-confirm");
    expect(releaseBooking).not.toHaveBeenCalled();
    await press("engine-release-tick");
    await press("engine-release-confirm");
    expect(releaseBooking).toHaveBeenCalledWith("b1");
    await waitFor(() => expect(attention).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByTestId("attention-gone-b1")).toBeNull());
    const line = screen.getByTestId("needs-attention-settled");
    expect(line.textContent).toBe(en("addon.shipping-kit.engine.attention.goneReleased"));
    expect(document.activeElement).toBe(line);
    expect(screen.getByTestId("engine-live").textContent).toBe(en("addon.shipping-kit.engine.attention.goneReleased"));
    expect(document.body.textContent).not.toContain(en("addon.shipping-kit.engine.release.done"));
  });

  it.each([
    ["found", "addon.shipping-kit.engine.attention.goneFound"],
    ["not-bought", "addon.shipping-kit.engine.attention.goneNotBought"],
  ] as const)("says what a look-up of %s means for an order that is gone", async (outcome, key) => {
    client([list(GONE), list()], { check: async () => ({ outcome, booking: { ...GONE.booking, state: outcome === "found" ? "booked" : "refused" } }) });
    render(<NeedsAttentionList onOpen={vi.fn()} />);
    await screen.findByTestId("engine-check");
    await press("engine-check");
    await waitFor(() => expect(screen.queryByTestId("attention-gone-b1")).toBeNull());
    expect(screen.getByTestId("needs-attention-settled").textContent).toBe(en(key));
  });

  it("reads again when someone else settled it first", async () => {
    const { attention } = client([list(GONE), list()], { check: async () => Promise.reject(Object.assign(new Error("moved"), { code: "BOOKING_NOT_UNKNOWN", status: 409 })) });
    render(<NeedsAttentionList onOpen={vi.fn()} />);
    await screen.findByTestId("engine-check");
    await press("engine-check");
    await waitFor(() => expect(attention).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByTestId("attention-gone-b1")).toBeNull());
  });
});
