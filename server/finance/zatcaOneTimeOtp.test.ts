import { describe, expect, it } from "vitest";

describe("one-time ZATCA OTP handoff", () => {
  it("accepts only a present six-digit OTP before external onboarding", () => {
    expect(process.env.ZATCA_OTP_ONCE).toMatch(/^\d{6}$/);
  });
});
