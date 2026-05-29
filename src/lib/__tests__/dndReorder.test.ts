import { describe, it, expect } from "vitest";
import { adjustCurrentIndex, buildPositionMap } from "../dndUtils";

describe("adjustCurrentIndex", () => {
  it("follows dragged item: current is the dragged item", () => {
    expect(adjustCurrentIndex(2, 2, 0)).toBe(0);
    expect(adjustCurrentIndex(1, 1, 3)).toBe(3);
  });

  it("shifts down when item above current moves below current", () => {
    // Item at 0 moves to 3, current is 2 → current shifts to 1
    expect(adjustCurrentIndex(2, 0, 3)).toBe(1);
  });

  it("shifts up when item below current moves above current", () => {
    // Item at 4 moves to 1, current is 2 → current shifts to 3
    expect(adjustCurrentIndex(2, 4, 1)).toBe(3);
  });

  it("does not shift when move is entirely above current", () => {
    // Item at 0 moves to 1, current is 3 → no change
    expect(adjustCurrentIndex(3, 0, 1)).toBe(3);
  });

  it("does not shift when move is entirely below current", () => {
    // Item at 4 moves to 5, current is 2 → no change
    expect(adjustCurrentIndex(2, 4, 5)).toBe(2);
  });
});

describe("buildPositionMap", () => {
  it("returns track_id/position pairs in order", () => {
    const result = buildPositionMap([10, 20, 30]);
    expect(result).toEqual([
      { track_id: 10, position: 0 },
      { track_id: 20, position: 1 },
      { track_id: 30, position: 2 },
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(buildPositionMap([])).toEqual([]);
  });
});
