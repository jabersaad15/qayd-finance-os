import { isValidOnRequestPrice } from "../../shared/salesPricing";
import { describe, expect, it } from "vitest";

describe("on-request service pricing", () => {
  it("لا يسمح بسعر صفري أو سالب عند إنشاء مستند مبيعات", () => {
    expect(isValidOnRequestPrice("0")).toBe(false);
    expect(isValidOnRequestPrice("0.000000")).toBe(false);
    expect(isValidOnRequestPrice("-10")).toBe(false);
  });

  it("يقبل سعراً عشرياً موجباً حتى ست منازل عشرية", () => {
    expect(isValidOnRequestPrice("2500")).toBe(true);
    expect(isValidOnRequestPrice("2500.125000")).toBe(true);
    expect(isValidOnRequestPrice("2500.1234567")).toBe(false);
  });
});
