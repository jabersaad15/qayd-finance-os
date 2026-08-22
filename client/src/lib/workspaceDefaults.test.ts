import { describe, expect, it } from "vitest";
import { DEFAULT_WORKSPACE_SETUP, toWorkspaceBootstrapInput } from "./workspaceDefaults";

describe("workspace setup bootstrap input", () => {
  it("builds a non-empty request from the visible default values", () => {
    expect(toWorkspaceBootstrapInput(DEFAULT_WORKSPACE_SETUP)).toEqual(DEFAULT_WORKSPACE_SETUP);
  });

  it("trims user edits without turning legal identifiers into empty values", () => {
    expect(toWorkspaceBootstrapInput({ vatNumber: "310 000 000 000 003", legalName: " Demo Co ", legalNameAr: " شركة تجريبية " })).toEqual({ vatNumber: "310000000000003", legalName: "Demo Co", legalNameAr: "شركة تجريبية" });
  });
});
