import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: { isLoading: false, error: null as Error | null, data: { customer: { name: "شركة تجريبية" }, company: { legalNameAr: "شركة كونسيدرا" }, expiresAt: new Date("2026-09-01") } as any },
  documents: { isLoading: false, error: null as Error | null, data: { quotations: [{ id: 1, quoteNumber: "Q-001", issueDate: new Date("2026-08-16"), status: "sent", grandTotal: "1150", customerResponseNote: null }], invoices: [{ id: 2, invoiceNumber: "INV-001", issueDate: new Date("2026-08-16"), dueDate: new Date("2026-08-20"), status: "overdue", grandTotal: "1150", paidTotal: "500" }] } as any },
  responseMutation: { isPending: false, mutate: vi.fn() },
  token: "valid-token-12345678901234567890",
}));

vi.mock("@/lib/trpc", () => ({ trpc: { useUtils: () => ({ customerPortal: { documents: { invalidate: vi.fn() } } }), customerPortal: { session: { useQuery: () => mocks.session }, documents: { useQuery: () => mocks.documents }, respondToQuotation: { useMutation: () => mocks.responseMutation } } } }));
vi.mock("wouter", () => ({ useRoute: () => [true, { token: mocks.token }] }));

import CustomerPortalPage from "../../client/src/pages/CustomerPortalPage";

describe("customer portal UX", () => {
  beforeEach(() => {
    mocks.session.error = null;
    mocks.documents.error = null;
  });

  it("يعرض الملخصات وعروض الأسعار والفاتورة والمتبقي بالأرقام الإنجليزية", () => {
    const html = renderToStaticMarkup(<CustomerPortalPage />);
    expect(html).toContain("مرحباً، شركة تجريبية");
    expect(html).toContain("عروض الأسعار");
    expect(html).toContain("Q-001");
    expect(html).toContain("INV-001");
    expect(html).toContain("المتبقي");
    expect(html).toContain("كشف الحساب");
    expect(html).toContain("الاستحقاق");
    expect(html).toContain("650.00");
    expect(html).not.toContain("٦٥٠");
  });

  it("يعرض إجراءات قبول ورفض العرض وحقل الملاحظة الاختيارية", () => {
    const html = renderToStaticMarkup(<CustomerPortalPage />);
    expect(html).toContain("قبول العرض");
    expect(html).toContain("رفض العرض");
    expect(html).toContain("ملاحظة اختيارية");
  });

  it("يعرض حالة الرابط غير الصالح دون كشف المستندات", () => {
    mocks.session.error = new Error("expired");
    const html = renderToStaticMarkup(<CustomerPortalPage />);
    expect(html).toContain("تعذر فتح بوابة العميل");
    expect(html).toContain("الرابط غير صالح");
    expect(html).not.toContain("INV-001");
  });
});
