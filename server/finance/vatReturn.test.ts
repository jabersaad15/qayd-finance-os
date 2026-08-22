import { describe, expect, it } from "vitest";
import { summarizeVatReturn, sumVatAmounts } from "./vatReturn";

describe("vat return preparation", () => {
  it("يجمع ضريبة المدخلات بدقة ويحسب صافي المستحق من ضريبة المخرجات", () => {
    expect(sumVatAmounts(["15.125000", "4.875000"])).toBe("20.000000");
    expect(summarizeVatReturn({ taxableSales: "100.000000", outputVat: "15.000000", inputVat: "4.500000" })).toEqual({ taxableSales: "100.000000", outputVat: "15.000000", inputVat: "4.500000", netVatDue: "10.500000" });
  });

  it("يحفظ إشارة الرصيد الدائن عندما تزيد المدخلات على المخرجات", () => {
    expect(summarizeVatReturn({ taxableSales: "0.000000", outputVat: "5.000000", inputVat: "8.000000" }).netVatDue).toBe("-3.000000");
  });
});
