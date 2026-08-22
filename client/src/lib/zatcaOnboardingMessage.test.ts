import { describe, expect, it } from "vitest";
import { formatZatcaOnboardingError } from "./zatcaOnboardingMessage";

describe("رسائل onboarding الآمنة في ZATCA", () => {
  it("يعرض توجيه OTP دون كشف أي قيمة", () => {
    const message = formatZatcaOnboardingError("ZATCA_INVALID_OTP: OTP=123456");
    expect(message).toContain("OTP");
    expect(message).not.toContain("123456");
  });

  it("يفرّق بين CSR وعدم تطابق البيئة", () => {
    expect(formatZatcaOnboardingError("ZATCA_INVALID_CSR")).toContain("CSR");
    expect(formatZatcaOnboardingError("ZATCA_ENVIRONMENT_OR_REGISTRATION_MISMATCH")).toContain("Simulation");
  });
});
