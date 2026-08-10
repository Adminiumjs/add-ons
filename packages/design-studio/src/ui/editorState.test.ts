import { describe, expect, it } from "vitest";

import { layersOn } from "../doc.ts";
import { docFromLayout, LAYOUTS } from "../layouts.ts";
import { editorReducer, initialState, type EditorState } from "./editorState.ts";

const CARD = LAYOUTS.find((l) => l.id === "business-card")!;

function open(): EditorState {
  return initialState(docFromLayout(CARD));
}

/** Replay a whole drag the way the view does: one action per pointer sample. */
function dragBy(state: EditorState, id: string, samples: number): EditorState {
  let next = state;
  const layer = next.history.present.layers.find((l) => l.id === id)!;
  for (let i = 1; i <= samples; i += 1) {
    next = editorReducer(next, {
      type: "drag",
      id,
      xMm: layer.xMm + i * 0.4,
      yMm: layer.yMm,
      zoom: 1,
    });
  }
  return editorReducer(next, { type: "endGesture" });
}

describe("the editor reducer", () => {
  it("drops the selection when the side flips, so the inspector never edits the unseen", () => {
    let state = open();
    state = editorReducer(state, { type: "select", id: "text-1" });
    state = editorReducer(state, { type: "side", side: "back" });
    expect(state.selected).toBeNull();
    expect(state.side).toBe("back");
  });

  it("adds onto the side that is showing", () => {
    let state = open();
    state = editorReducer(state, { type: "side", side: "back" });
    const before = layersOn(state.history.present, "back").length;
    state = editorReducer(state, {
      type: "add",
      draft: {
        kind: "shape",
        name: "Rectangle",
        xMm: 5,
        yMm: 5,
        wMm: 10,
        hMm: 10,
        shape: "rect",
        fill: "#191920",
        stroke: "none",
        strokeMm: 0,
        radiusMm: 0,
      },
    });
    expect(layersOn(state.history.present, "back")).toHaveLength(before + 1);
    expect(state.selected).toBe(state.history.present.layers.at(-1)!.id);
  });

  it("turns a whole drag into one undo step and lights the snap line", () => {
    let state = dragBy(open(), "text-1", 60);
    expect(state.history.past).toHaveLength(1);
    expect(state.snapLines).toEqual([]); // cleared on pointer-up

    const moved = state.history.present.layers.find((l) => l.id === "text-1")!.xMm;
    state = editorReducer(state, { type: "undo" });
    expect(state.history.present.layers.find((l) => l.id === "text-1")!.xMm).not.toBe(moved);
    expect(state.history.past).toHaveLength(0);
  });

  it("coalesces typing per field and starts fresh on blur", () => {
    let state = editorReducer(open(), { type: "select", id: "text-1" });
    for (const text of ["H", "Ha", "Har"]) {
      state = editorReducer(state, { type: "patch", patch: { name: text }, token: "edit:text-1:name" });
    }
    expect(state.history.past).toHaveLength(1);

    state = editorReducer(state, { type: "endGesture" });
    state = editorReducer(state, { type: "patch", patch: { name: "Harb" }, token: "edit:text-1:name" });
    expect(state.history.past).toHaveLength(2);
  });

  it("says why it will not spread two things, instead of doing nothing", () => {
    let state = open();
    // The card seeds three layers on the front; hide one to get down to two.
    state = editorReducer(state, { type: "toggleHidden", id: "shape-1" });
    state = editorReducer(state, { type: "distribute", axis: "x" });
    expect(state.notice).toBe("addon.design-studio.insp.spreadNeedsThree");
    state = editorReducer(state, { type: "dismissNotice" });
    expect(state.notice).toBeNull();
  });

  it("spreads three things and clears the notice", () => {
    const state = editorReducer(open(), { type: "distribute", axis: "y" });
    expect(state.notice).toBeNull();
    expect(state.history.past).toHaveLength(1);
  });

  it("forgets a selection that an undo has deleted out from under it", () => {
    let state = editorReducer(open(), { type: "select", id: "text-1" });
    state = editorReducer(state, {
      type: "add",
      draft: {
        kind: "shape",
        name: "Rectangle",
        xMm: 5,
        yMm: 5,
        wMm: 10,
        hMm: 10,
        shape: "rect",
        fill: "#191920",
        stroke: "none",
        strokeMm: 0,
        radiusMm: 0,
      },
    });
    const added = state.selected!;
    state = editorReducer(state, { type: "undo" });
    expect(state.selected).toBeNull();
    expect(state.history.present.layers.some((l) => l.id === added)).toBe(false);
  });

  it("ignores every selection-shaped action when nothing is selected", () => {
    const state = open();
    for (const action of [
      { type: "delete" } as const,
      { type: "z", move: "front" } as const,
      { type: "alignPage", align: "centreX" } as const,
      { type: "patch", patch: { xMm: 3 } } as const,
    ]) {
      expect(editorReducer(state, action)).toBe(state);
    }
  });

  it("starts over on `open`, so a second design does not inherit the first's undo", () => {
    let state = dragBy(open(), "text-1", 5);
    state = editorReducer(state, { type: "open", doc: docFromLayout(LAYOUTS[2]!) });
    expect(state.history.past).toHaveLength(0);
    expect(state.selected).toBeNull();
    expect(state.side).toBe("front");
  });
});
