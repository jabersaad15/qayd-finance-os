import { describe, expect, it } from "vitest";
import { buildDocumentStorageKey } from "../routers/documents";
import { defaultChartOfAccounts } from "./setup";

describe("document and sales readiness", () => {
  it("ينشئ مفتاح تخزين ASCII حتى مع اسم ملف عربي", () => {
    const key = buildDocumentStorageKey({ tenantId: 1, companyId: 1, classification: "supplier", filename: "عقد شركة كونسيدرا.pdf", nonce: "fixed-token" });
    expect(key).toBe("tenants/1/companies/1/supplier/document-fixed-token.pdf");
    expect(key).toMatch(/^[\x00-\x7F]+$/);
  });

  it("يتضمن دليل الحسابات الافتراضي حساب الإيرادات وحسابات دورة الفاتورة", () => {
    expect(defaultChartOfAccounts.map((account) => account.code)).toEqual(expect.arrayContaining(["1200", "2200", "4100"]));
  });
});
