import { describe, it, expect } from "vitest";
import { KANBAN_COLUMNS } from "../constants";

describe("KANBAN_COLUMNS", () => {
  it("contains the expected columns in order", () => {
    expect(KANBAN_COLUMNS).toEqual(["backlog", "ongoing", "unfinished", "done"]);
  });

  it("has exactly 4 columns", () => {
    expect(KANBAN_COLUMNS).toHaveLength(4);
  });
});
