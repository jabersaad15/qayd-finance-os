import { describe, expect, it } from "vitest";
import { DEFAULT_WORKSPACE_SETUP, toWorkspaceBootstrapInput } from "../client/src/lib/workspaceDefaults";

describe("CompanySetup bootstrap submission", () => {
  it("sends the visible default identifiers as non-empty values", () => {
    const input = toWorkspaceBootstrapInput(DEFAULT_WORKSPACE_SETUP);
    expect(input.vatNumber).toMatch(/^\d{15}$/);
    expect(input.legalName.length).toBeGreaterThanOrEqual(2);
    expect(input.legalNameAr.length).toBeGreaterThanOrEqual(2);
  });
});
