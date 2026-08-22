import { describe, expect, it } from "vitest";
import { generateSimulationCsr } from "./zatcaCsrService";

describe("ZATCA EGS serial validation", () => {
  it("rejects a numeric OTP when it is supplied as an EGS serial number", async () => {
    await expect(generateSimulationCsr({ legalName: "QAYD Test Company", vatNumber: "312345678901237", serialNumber: "775038" })).rejects.toThrow(/cannot be a numeric OTP/);
  });
});
