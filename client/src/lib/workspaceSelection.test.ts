import { describe, expect, it } from "vitest";
import { selectActiveWorkspace } from "./workspaceSelection";

describe("workspace selection", () => {
  it("selects the active tenant/company membership instead of the first incomplete row", () => {
    const selected = selectActiveWorkspace([
      { tenant: { id: 99, status: "active" }, company: null },
      { tenant: { id: 1, status: "active" }, company: { id: 1, status: "active" } },
    ]);
    expect(selected?.tenant?.id).toBe(1);
    expect(selected?.company?.id).toBe(1);
  });

  it("does not call a loading or empty response configured", () => {
    expect(selectActiveWorkspace(undefined)).toBeUndefined();
    expect(selectActiveWorkspace([])).toBeUndefined();
  });

  it("falls back to a linked membership when status is not present in legacy data", () => {
    const selected = selectActiveWorkspace([
      { tenant: { id: 7 }, company: { id: 7 } },
    ]);
    expect(selected?.tenant?.id).toBe(7);
    expect(selected?.company?.id).toBe(7);
  });
});
