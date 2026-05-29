import { describe, it, expect } from "vitest";
import { trackMatchesTags } from "../tagFilter";

describe("trackMatchesTags", () => {
  it("OR mode: returns true if any filter tag is in track tags", () => {
    expect(trackMatchesTags([1, 2, 3], [2, 5], "or")).toBe(true);
  });

  it("OR mode: returns false if no filter tag is in track tags", () => {
    expect(trackMatchesTags([1, 2, 3], [4, 5], "or")).toBe(false);
  });

  it("AND mode: returns true if all filter tags are in track tags", () => {
    expect(trackMatchesTags([1, 2, 3], [1, 3], "and")).toBe(true);
  });

  it("AND mode: returns false if any filter tag is missing from track tags", () => {
    expect(trackMatchesTags([1, 2, 3], [1, 4], "and")).toBe(false);
  });

  it("empty filterTagIds always returns true regardless of mode", () => {
    expect(trackMatchesTags([], [], "and")).toBe(true);
    expect(trackMatchesTags([1, 2], [], "or")).toBe(true);
  });

  it("track with no tags returns false when filter is non-empty (OR)", () => {
    expect(trackMatchesTags([], [1], "or")).toBe(false);
  });

  it("track with no tags returns false when filter is non-empty (AND)", () => {
    expect(trackMatchesTags([], [1], "and")).toBe(false);
  });
});
