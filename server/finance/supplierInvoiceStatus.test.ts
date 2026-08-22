import { describe, expect, it } from "vitest";
import { canTransitionSupplierInvoice } from "../../shared/supplierInvoiceStatus";

describe("supplier invoice workflow", () => {
  it("يفصل المسودة عن المراجعة ثم الاعتماد", () => {
    expect(canTransitionSupplierInvoice("draft", "pending_review")).toBe(true);
    expect(canTransitionSupplierInvoice("pending_review", "approved")).toBe(true);
  });

  it("يمنع الاعتماد المباشر أو إعادة فتح فاتورة مرحلة", () => {
    expect(canTransitionSupplierInvoice("draft", "approved")).toBe(false);
    expect(canTransitionSupplierInvoice("posted", "draft")).toBe(false);
  });

  it("يبقي الفاتورة الملغاة نهائية", () => {
    expect(canTransitionSupplierInvoice("voided", "pending_review")).toBe(false);
    expect(canTransitionSupplierInvoice("voided", "voided")).toBe(true);
  });
});
