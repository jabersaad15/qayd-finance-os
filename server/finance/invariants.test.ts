import { describe, expect, it } from "vitest";
import { addMoney, calculateInvoiceTotals, preIssueStructuralCheck, subtractMoney, validateJournalEntry } from "./invariants";

describe("accounting invariants", () => {
  it("يحسب إجمالي الفاتورة بالصيغة العشرية الحتمية", () => {
    expect(calculateInvoiceTotals([{ quantity: "2.000000", unitPrice: "100.000000", discountAmount: "10.000000", taxRateBps: 1500 }])).toEqual({
      subtotal: "200.000000",
      discountTotal: "10.000000",
      taxableTotal: "190.000000",
      taxTotal: "28.500000",
      grandTotal: "218.500000",
    });
  });

  it("يرفض القيد غير المتوازن", () => {
    expect(validateJournalEntry([{ debit: "100.000000", credit: "0.000000" }, { debit: "0.000000", credit: "90.000000" }]).valid).toBe(false);
  });

  it("يقبل القيد المتوازن ويمنع المدين والدائن في السطر نفسه", () => {
    expect(validateJournalEntry([{ debit: "100.000000", credit: "0.000000" }, { debit: "0.000000", credit: "100.000000" }]).valid).toBe(true);
    expect(validateJournalEntry([{ debit: "100.000000", credit: "100.000000" }, { debit: "0.000000", credit: "0.000000" }]).valid).toBe(false);
  });

  it("يمنع إصدار المستند عندما تنقص عناصر الفحص الحرجة", () => {
    const result = preIssueStructuralCheck({ sellerTaxNumber: "", invoiceNumber: "", invoiceType: "", lines: [] });
    expect(result.canIssue).toBe(false);
    expect(result.score).toBeLessThan(100);
  });

  it("يجمع ويطرح أرصدة التحصيل بقواعد عشرية حتمية", () => {
    expect(addMoney(["0.100000", "0.200000", "10.000000"])).toBe("10.300000");
    expect(subtractMoney("100.000000", "25.125000")).toBe("74.875000");
  });
});
