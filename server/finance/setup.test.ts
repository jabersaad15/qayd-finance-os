import { describe, expect, it } from "vitest";
import { createFiscalPeriodName, defaultChartOfAccounts } from "./setup";

describe("company setup defaults", () => {
  it("يعطي دليل حسابات متوازن التصنيف وقابل للتنبؤ", () => {
    expect(defaultChartOfAccounts.some((account) => account.code === "4100" && account.normalBalance === "credit")).toBe(true);
    expect(defaultChartOfAccounts.some((account) => account.code === "2200" && account.accountType === "liability")).toBe(true);
  });

  it("ينشئ اسماً ثابتاً للفترة المالية", () => {
    expect(createFiscalPeriodName("2026-01-01", "2026-12-31")).toBe("2026-2026");
  });
});
