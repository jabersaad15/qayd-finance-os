import { describe, expect, it } from "vitest";
import { isValidOnRequestPrice } from "../../shared/salesPricing";
import { isoDatePattern } from "../routers/sales";

describe("urgent sales input validation", () => {
  it("accepts the browser date value used by CRM forms", () => {
    expect(isoDatePattern.test("2026-08-17")).toBe(true);
    expect(isoDatePattern.test("٢٠٢٦-٠٨-١٧")).toBe(false);
    expect(isoDatePattern.test("2026/08/17")).toBe(false);
  });

  it("rejects blank or non-positive service prices before quotation creation", () => {
    expect(isValidOnRequestPrice("")).toBe(false);
    expect(isValidOnRequestPrice("0")).toBe(false);
    expect(isValidOnRequestPrice("1500.00")).toBe(true);
  });
});
