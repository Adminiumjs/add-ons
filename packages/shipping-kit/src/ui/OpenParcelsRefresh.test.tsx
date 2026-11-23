// @vitest-environment happy-dom
/** A person opening the list is the only trigger: once, on old data, and never on a timer. */

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { EngineCarrier, EngineRefreshOpen } from "@adminium/add-on-host/engine-carrier";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { translate } from "../i18n/t.ts";
import { connectEngineCarrier, resetRuntime } from "../runtime.ts";
import { isOldList, OPEN_PARCELS_OLD_AFTER_MS, OpenParcelsRefresh } from "./OpenParcelsRefresh.tsx";

const NOW = 1_800_000_000_000;
const DONE: EngineRefreshOpen = { outcome: "done", checked: 3, updated: 1, failed: 0, remaining: 0, more: false, oldestCheckedAt: NOW - 1_000, neverChecked: 0, retryAt: null };

function fake(answer: EngineRefreshOpen | Error = DONE) {
  const refreshOpenParcels = vi.fn(async () => {
    if (answer instanceof Error) throw answer;
    return answer;
  });
  connectEngineCarrier({ addOnKey: "shipping-test", refreshOpenParcels } as unknown as EngineCarrier);
  return refreshOpenParcels;
}

beforeEach(() => document.documentElement.setAttribute("lang", "en-US"));
afterEach(() => {
  cleanup();
  resetRuntime();
  vi.restoreAllMocks();
});

describe("when it runs by itself", () => {
  it("counts a list that cannot say how old it is as old", () => {
    expect(isOldList(null, NOW, OPEN_PARCELS_OLD_AFTER_MS)).toBe(true);
    expect(isOldList(NOW, undefined, OPEN_PARCELS_OLD_AFTER_MS)).toBe(true);
    expect(isOldList(NOW - OPEN_PARCELS_OLD_AFTER_MS, NOW, OPEN_PARCELS_OLD_AFTER_MS)).toBe(true);
    expect(isOldList(NOW - 1, NOW, OPEN_PARCELS_OLD_AFTER_MS)).toBe(false);
  });

  it("runs once when an old list opens, through re-renders and strict mode", async () => {
    const ask = fake();
    const old = NOW - OPEN_PARCELS_OLD_AFTER_MS;
    const view = render(
      <StrictMode>
        <OpenParcelsRefresh oldestCheckedAt={old} nowMs={NOW} />
      </StrictMode>,
    );
    await screen.findByText(/Checked 3 open parcels/);
    view.rerender(
      <StrictMode>
        <OpenParcelsRefresh oldestCheckedAt={old} nowMs={NOW + 5} />
      </StrictMode>,
    );
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it("asks nothing when the list is fresh", async () => {
    const ask = fake();
    render(<OpenParcelsRefresh oldestCheckedAt={NOW - 1_000} nowMs={NOW} />);
    await act(async () => undefined);
    expect(ask).not.toHaveBeenCalled();
  });

  it("asks nothing on an empty list, and turns the button off", async () => {
    const ask = fake();
    render(<OpenParcelsRefresh hasOpenParcels={false} />);
    await act(async () => undefined);
    expect(ask).not.toHaveBeenCalled();
    expect((screen.getByTestId("open-parcels-refresh") as HTMLButtonElement).disabled).toBe(true);
  });

  it("draws nothing without an engine client", () => {
    const { container } = render(<OpenParcelsRefresh />);
    expect(container.textContent).toBe("");
  });
});

describe("what it says", () => {
  it("refreshes again on a press, and tells the list", async () => {
    const ask = fake();
    const heard = vi.fn();
    render(<OpenParcelsRefresh oldestCheckedAt={NOW - 1_000} nowMs={NOW} onRefreshed={heard} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId("open-parcels-refresh"));
    });
    await waitFor(() => expect(heard).toHaveBeenCalledWith(DONE));
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it("shows there are more", async () => {
    fake({ ...DONE, more: true, remaining: 12 });
    render(<OpenParcelsRefresh />);
    await waitFor(() => expect(screen.getByTestId("open-parcels-line").textContent).toContain(translate("en-US", "addon.shipping-kit.engine.openParcels.more")));
  });

  it("reads never checked while any open parcel has not been", async () => {
    fake({ ...DONE, neverChecked: 2 });
    render(<OpenParcelsRefresh />);
    await screen.findByText(/Checked 3 open parcels/);
    expect(screen.getByTestId("open-parcels-checked").textContent).toBe(translate("en-US", "addon.shipping-kit.engine.track.never"));
  });

  it("keeps the ages it has when the engine answers recent", async () => {
    const seen = NOW - 7_200_000;
    fake({ outcome: "recent", checked: 0, updated: 0, failed: 0, remaining: 0, more: true, oldestCheckedAt: null, neverChecked: 0, retryAt: NOW + 60_000 });
    render(<OpenParcelsRefresh oldestCheckedAt={seen} nowMs={NOW} />);
    await screen.findByText(/Checked recently/);
    expect(screen.getByTestId("open-parcels-checked").textContent).not.toBe(translate("en-US", "addon.shipping-kit.engine.track.never"));
    expect(screen.getByTestId("open-parcels-line").textContent).not.toContain(translate("en-US", "addon.shipping-kit.engine.openParcels.more"));
  });

  it("says so when the refresh fails", async () => {
    fake(new Error("nope"));
    render(<OpenParcelsRefresh />);
    expect(await screen.findByText(translate("en-US", "addon.shipping-kit.engine.openParcels.failed"))).toBeTruthy();
  });
});
