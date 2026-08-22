import { describe, expect, it } from "vitest";
import { selectPreferredSimulationEgsId } from "./zatcaSelection";

describe("selectPreferredSimulationEgsId", () => {
  it("prefers the fixed Simulation EGS over failed numeric legacy units", () => {
    expect(selectPreferredSimulationEgsId([
      { id: 1, serialNumber: "531873", csrStatus: "issued", complianceCsidStatus: "failed" },
      { id: 2, serialNumber: "121541", csrStatus: "issued", complianceCsidStatus: "failed" },
      { id: 4, serialNumber: "QAYD-EGS-SIM-001", csrStatus: "not_started", complianceCsidStatus: "not_started" },
    ])).toBe(4);
  });

  it("uses the first unconfigured EGS when the preferred serial does not exist", () => {
    expect(selectPreferredSimulationEgsId([
      { id: 1, serialNumber: "FAILED-001", csrStatus: "issued", complianceCsidStatus: "failed" },
      { id: 2, serialNumber: "VALID-001", csrStatus: "not_started", complianceCsidStatus: "not_started" },
    ])).toBe(2);
  });
});
